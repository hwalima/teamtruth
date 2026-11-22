<?php

namespace App\Modules\Sales\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Currency;
use App\Modules\Core\Services\AuditLogService;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\DocumentRenderer;
use App\Modules\Core\Services\ErpRoleService;
use App\Modules\Inventory\Models\InventoryProduct;
use App\Modules\Invoicing\Models\Customer;
use App\Modules\Sales\Http\Requests\StoreQuotationRequest;
use App\Modules\Sales\Mail\QuotationMail;
use App\Modules\Sales\Models\Opportunity;
use App\Modules\Sales\Models\Quotation;
use App\Modules\Sales\Services\SalesService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

/** Quotations: the list, the multi-line form, the detail page, the PDF and emailing it to the customer. */
class QuotationController extends Controller
{
    public const STATUSES = ['draft', 'pending_approval', 'approved', 'converted', 'cancelled'];

    /** A quotation goes to the customer once it has been approved. */
    private const SENDABLE = ['approved', 'converted'];

    public function __construct(private SalesService $salesService) {}

    public function index(Request $request): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $search = trim((string) $request->query('search', ''));
        $status = in_array($request->query('status'), self::STATUSES, true) ? $request->query('status') : 'all';

        $counts = Quotation::query()->where('company_id', $company->id)
            ->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status')
            ->map(fn ($total) => (int) $total);

        $quotations = Quotation::query()->where('company_id', $company->id)
            ->when($status !== 'all', fn ($query) => $query->where('status', $status))
            ->when($search !== '', fn ($query) => $query->where(fn ($query) => $query
                ->where('document_number', 'like', "%{$search}%")
                ->orWhereHas('customer', fn ($customer) => $customer->where('name', 'like', "%{$search}%")->orWhere('code', 'like', "%{$search}%"))))
            ->with('customer:id,name,code')
            ->withCount(['lines', 'salesOrders', 'approvalRequests'])
            ->latest('id')
            ->paginate(20)
            ->withQueryString()
            ->through(fn (Quotation $quotation) => [
                'id' => $quotation->id,
                'document_number' => $quotation->document_number,
                'status' => $quotation->status,
                'currency_code' => $quotation->currency_code,
                'total' => $quotation->total,
                'valid_until' => $quotation->valid_until?->toDateString(),
                'created_at' => $quotation->created_at?->toDateString(),
                'sent_at' => $quotation->sent_at?->toIso8601String(),
                'lines_count' => $quotation->lines_count,
                'customer' => $quotation->customer?->only(['id', 'name', 'code']),
                'can_edit' => $quotation->status === 'draft',
                'can_cancel' => in_array($quotation->status, ['draft', 'pending_approval', 'approved'], true),
                'can_delete' => self::deletable($quotation),
            ]);

        return Inertia::render('Erp/Sales/Quotations/Index', [
            'company' => $company->only(['id', 'code', 'name', 'default_currency']),
            'quotations' => $quotations,
            'filters' => ['search' => $search, 'status' => $status],
            'counts' => collect(self::STATUSES)->mapWithKeys(fn ($key) => [$key => $counts[$key] ?? 0]),
            'canManage' => $this->allowsErpPermission('erp.sales.manage'),
        ]);
    }

    public function create(Request $request): Response
    {
        $this->authorizeErpPermission('erp.sales.manage');

        return Inertia::render('Erp/Sales/Quotations/Create', [
            ...$this->formProps(),
            'defaults' => [
                'opportunity_id' => $request->integer('opportunity') ?: null,
                'valid_until' => now()->addDays(30)->toDateString(),
            ],
            'quotation' => null,
        ]);
    }

    public function edit(Quotation $quotation): Response|RedirectResponse
    {
        $this->authorizeErpPermission('erp.sales.manage');
        if ($quotation->status !== 'draft') {
            return redirect()->route('erp.sales.quotations.show', $quotation)
                ->withErrors(['quotation' => 'Only draft quotations can be edited. Duplicate it to make a new version.']);
        }
        $quotation->load('lines');

        return Inertia::render('Erp/Sales/Quotations/Create', [
            ...$this->formProps(),
            'defaults' => ['opportunity_id' => null, 'valid_until' => now()->addDays(30)->toDateString()],
            'quotation' => [
                'id' => $quotation->id,
                'document_number' => $quotation->document_number,
                'customer_id' => $quotation->customer_id,
                'opportunity_id' => $quotation->opportunity_id,
                'currency_code' => $quotation->currency_code,
                'valid_until' => $quotation->valid_until?->toDateString(),
                'notes' => $quotation->notes,
                'terms' => $quotation->terms,
                'lines' => $quotation->lines->sortBy('sort_order')->values()->map(fn ($line) => [
                    'product_id' => $line->product_id,
                    'description' => $line->description,
                    'quantity' => (string) (float) $line->quantity,
                    'unit_price' => (string) (float) $line->unit_price,
                    'discount' => (string) (float) $line->discount,
                    'tax_rate' => (string) (float) $line->tax_rate,
                    'notes' => $line->notes,
                ]),
            ],
        ]);
    }

    public function update(StoreQuotationRequest $request, Quotation $quotation): RedirectResponse
    {
        $quotation = $this->salesService->updateQuotation($quotation, $request->validated(), $request->user());

        return redirect()->route('erp.sales.quotations.show', $quotation)
            ->with('success', 'Quotation '.$quotation->document_number.' updated.');
    }

    public function cancel(Request $request, Quotation $quotation): RedirectResponse
    {
        $this->authorizeErpPermission('erp.sales.manage');
        $quotation = $this->salesService->cancelQuotation($quotation, $request->user());

        return back()->with('success', 'Quotation '.$quotation->document_number.' cancelled.');
    }

    public function duplicate(Request $request, Quotation $quotation): RedirectResponse
    {
        $this->authorizeErpPermission('erp.sales.manage');
        $copy = $this->salesService->duplicateQuotation($quotation, $request->user());

        return redirect()->route('erp.sales.quotations.show', $copy)
            ->with('success', 'Quotation '.$copy->document_number.' created as a copy of '.$quotation->document_number.'.');
    }

    public function destroy(Request $request, Quotation $quotation): RedirectResponse
    {
        $this->authorizeErpPermission('erp.sales.manage');
        $number = $quotation->document_number;
        $this->salesService->deleteQuotation($quotation, $request->user());

        return redirect()->route('erp.sales.quotations.index')->with('success', 'Quotation '.$number.' deleted.');
    }

    /** Whether a quotation can still be removed outright (otherwise it is cancelled and kept). */
    public static function deletable(Quotation $quotation): bool
    {
        return in_array($quotation->status, ['draft', 'cancelled'], true)
            && (int) ($quotation->sales_orders_count ?? $quotation->salesOrders()->count()) === 0
            && (int) ($quotation->approval_requests_count ?? $quotation->approvalRequests()->count()) === 0;
    }

    /** @return array<string, mixed> */
    private function formProps(): array
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        return [
            'company' => $company->only(['id', 'code', 'name', 'default_currency']),
            'customers' => Customer::query()->where('company_id', $company->id)->where('is_active', true)
                ->orderBy('name')->get(['id', 'code', 'name', 'currency_code']),
            'opportunities' => Opportunity::query()->where('company_id', $company->id)->where('status', 'open')
                ->orderBy('title')->get(['id', 'title', 'customer_id']),
            'products' => InventoryProduct::query()->where('company_id', $company->id)->where('is_active', true)
                ->with('unit:id,abbreviation')->orderBy('name')
                ->get(['id', 'sku', 'name', 'description', 'sale_price', 'unit_id']),
            'currencies' => Currency::query()->orderBy('code')->get(['code', 'name']),
        ];
    }

    public function store(StoreQuotationRequest $request): RedirectResponse
    {
        $quotation = $this->salesService->createQuotation($request->validated(), $request->user());

        return redirect()->route('erp.sales.quotations.show', $quotation)
            ->with('success', 'Quotation '.$quotation->document_number.' created.');
    }

    public function show(Quotation $quotation): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $quotation->load([
            'customer:id,code,name,email,phone,billing_address',
            'opportunity:id,title',
            'creator:id,name',
            'lines.product:id,sku,name',
            'salesOrders:id,quotation_id,document_number,status,total,currency_code',
        ]);

        return Inertia::render('Erp/Sales/Quotations/Show', [
            'company' => $company->only(['id', 'code', 'name', 'default_currency']),
            'quotation' => [
                ...$quotation->only([
                    'id', 'document_number', 'status', 'currency_code', 'subtotal', 'discount_total', 'tax_total', 'total',
                    'notes', 'terms', 'sent_to', 'customer', 'opportunity', 'creator', 'lines',
                ]),
                'sales_orders' => $quotation->salesOrders,
                'valid_until' => $quotation->valid_until?->toDateString(),
                'created_at' => $quotation->created_at?->toIso8601String(),
                'submitted_at' => $quotation->submitted_at?->toIso8601String(),
                'approved_at' => $quotation->approved_at?->toIso8601String(),
                'sent_at' => $quotation->sent_at?->toIso8601String(),
            ],
            'canManage' => $this->allowsErpPermission('erp.sales.manage'),
            'canSend' => in_array($quotation->status, self::SENDABLE, true),
            'canEdit' => $quotation->status === 'draft',
            'canCancel' => in_array($quotation->status, ['draft', 'pending_approval', 'approved'], true),
            'canDelete' => self::deletable($quotation),
        ]);
    }

    public function pdf(Request $request, Quotation $quotation, DocumentRenderer $renderer): HttpResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        app(ErpRoleService::class)->authorize($company, $request->user(), 'erp.sales.view');

        return response($this->render($quotation, $renderer), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$this->filename($quotation).'"',
        ]);
    }

    public function send(Request $request, Quotation $quotation, DocumentRenderer $renderer, AuditLogService $audit): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        app(ErpRoleService::class)->authorize($company, $request->user(), 'erp.sales.manage');
        $data = $request->validate([
            'email' => ['required', 'email:rfc', 'max:255'],
            'message' => ['nullable', 'string', 'max:2000'],
        ]);
        if (! in_array($quotation->status, self::SENDABLE, true)) {
            throw ValidationException::withMessages(['email' => 'Only approved quotations can be sent to the customer.']);
        }

        $pdf = $this->render($quotation, $renderer);
        try {
            Mail::to($data['email'])->send(new QuotationMail($quotation, $company, $request->user(), $pdf, $data['message'] ?? null));
        } catch (Throwable $exception) {
            Log::error('Quotation email failed', ['quotation_id' => $quotation->id, 'error' => $exception->getMessage()]);

            throw ValidationException::withMessages(['email' => 'The email could not be sent. Check the mail settings and try again.']);
        }

        $quotation->forceFill(['sent_at' => now(), 'sent_to' => $data['email']])->save();
        $audit->record($company, 'sales.quotation.sent', $quotation, [], ['to' => $data['email']], $request->user());

        return back()->with('success', 'Quotation '.$quotation->document_number.' sent to '.$data['email'].'.');
    }

    private function render(Quotation $quotation, DocumentRenderer $renderer): string
    {
        $quotation->loadMissing(['customer', 'opportunity', 'creator', 'lines.product.unit']);

        return $renderer->render($quotation, 'pdf.documents.quotation');
    }

    private function filename(Quotation $quotation): string
    {
        return 'quotation-'.preg_replace('/[^A-Za-z0-9_-]+/', '-', $quotation->document_number).'.pdf';
    }
}
