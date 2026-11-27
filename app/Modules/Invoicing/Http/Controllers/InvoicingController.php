<?php

namespace App\Modules\Invoicing\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Currency;
use App\Models\User;
use App\Modules\Accounting\Models\AccountingAccount;
use App\Modules\Accounting\Models\AccountingJournal;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\DocumentRenderer;
use App\Modules\Inventory\Models\InventoryProduct;
use App\Modules\Invoicing\Events\InvoiceCancelled;
use App\Modules\Invoicing\Http\Requests\StoreInvoiceRequest;
use App\Modules\Invoicing\Http\Requests\UpdateInvoiceRequest;
use App\Modules\Invoicing\Models\Customer;
use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Invoicing\Models\InvoiceLine;
use App\Modules\Invoicing\Models\PaymentTerm;
use App\Modules\Invoicing\Services\InvoicingService;
use App\Notifications\InvoiceCreatedNotification;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class InvoicingController extends Controller
{
    public function __construct(
        private InvoicingService $invoicingService,
    ) {}

    public function index(Request $request): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        $query = Invoice::query()
            ->where('company_id', $company->id)
            ->with(['customer', 'lines'])
            ->withSum('payments as paid_amount_sum', 'base_amount');

        // Filters
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('document_number', 'like', "%{$search}%")
                    ->orWhereHas('customer', fn ($q) => $q->where('name', 'like', "%{$search}%"));
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('customer_id')) {
            $query->where('customer_id', $request->customer_id);
        }

        if ($request->filled('date_from')) {
            $query->whereDate('invoice_date', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('invoice_date', '<=', $request->date_to);
        }

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        // Sorting
        $sortBy = $request->get('sort_by', 'invoice_date');
        $sortOrder = $request->get('sort_order', 'desc');
        $allowedSorts = ['document_number', 'invoice_date', 'due_date', 'total_amount', 'status', 'created_at'];
        if (! in_array($sortBy, $allowedSorts)) {
            $sortBy = 'invoice_date';
        }
        $query->orderBy($sortBy, $sortOrder);

        $invoices = $query->with('journalEntry:id,source_type,source_id,status')->paginate(20)->withQueryString()
            ->through(function (Invoice $invoice) {
                $posted = $invoice->journalEntry?->status === 'posted';

                return $invoice->setAttribute('can_edit', $invoice->canBeEdited())
                    ->setAttribute('can_cancel', in_array($invoice->status, ['draft', 'sent'], true) && ! $posted)
                    ->setAttribute('is_posted', $posted)
                    ->unsetRelation('journalEntry');
            });

        // Get customers for filter dropdown
        $customers = Customer::query()
            ->where('company_id', $company->id)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        return Inertia::render('Erp/Invoicing/Index', [
            'company' => $company,
            'invoices' => $invoices,
            'customers' => $customers,
            'filters' => $request->only(['search', 'status', 'customer_id', 'date_from', 'date_to', 'type', 'sort_by', 'sort_order']),
            'statusOptions' => [
                'draft' => 'Draft',
                'sent' => 'Sent',
                'paid' => 'Paid',
                'overdue' => 'Overdue',
                'cancelled' => 'Cancelled',
                'proforma' => 'Proforma',
                'partial_paid' => 'Partially Paid',
            ],
            'typeOptions' => [
                'invoice' => 'Invoice',
                'proforma' => 'Proforma',
            ],
        ]);
    }

    public function create(): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        $customers = Customer::query()
            ->where('company_id', $company->id)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'currency_code', 'payment_term_id']);

        $paymentTerms = PaymentTerm::query()
            ->where('company_id', $company->id)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'net_days', 'discount_days', 'discount_percent']);

        $products = InventoryProduct::query()
            ->where('company_id', $company->id)
            ->where('is_active', true)
            ->with('unit')
            ->orderBy('name')
            ->get(['id', 'sku', 'name', 'unit_id', 'type']);

        $accounts = AccountingAccount::query()
            ->where('company_id', $company->id)
            ->where('is_active', true)
            ->where('is_group', false)
            ->whereIn('account_type', ['revenue', 'asset'])
            ->orderBy('code')
            ->get(['id', 'code', 'name']);

        $journals = AccountingJournal::query()
            ->where('company_id', $company->id)
            ->where('is_active', true)
            ->where('journal_type', 'sales')
            ->get(['id', 'code', 'name']);

        $currencies = Currency::query()->orderBy('code')->get(['code', 'name']);

        return Inertia::render('Erp/Invoicing/Create', [
            'company' => $company,
            'customers' => $customers,
            'paymentTerms' => $paymentTerms,
            'products' => $products,
            'accounts' => $accounts,
            'journals' => $journals,
            'currencies' => $currencies,
        ]);
    }

    public function store(StoreInvoiceRequest $request)
    {
        $user = $request->user();

        $data = $request->only([
            'customer_id', 'type', 'invoice_date', 'due_date',
            'currency_code', 'journal_id', 'notes', 'terms', 'footer_notes',
        ]);

        $lines = $request->input('lines', []);

        $invoice = $this->invoicingService->createInvoice($user, $data, $lines);

        return redirect()->route('erp.invoicing.show', $invoice)
            ->with('success', 'Invoice created successfully.');
    }

    public function show(Invoice $invoice): Response
    {
        $this->authorizeErpPermission('erp.invoicing.view');

        $invoice->load([
            'customer',
            'lines.product.unit',
            'lines.account',
            'payments',
            'creditNotes',
            'fiscalDocuments',
            'journalEntry.lines.account',
        ]);

        $payments = $invoice->payments()
            ->with('journalEntry')
            ->orderBy('payment_date', 'desc')
            ->get();

        $company = app(CompanyContext::class)->requireActiveCompany();

        return Inertia::render('Erp/Invoicing/Show', [
            'company' => $company,
            'invoice' => $invoice,
            'payments' => $payments,
            'canSend' => $this->allowsErpPermission('erp.invoicing.manage'),
            'canPost' => $this->allowsErpPermission('erp.invoicing.manage'),
            'canCancel' => $this->allowsErpPermission('erp.invoicing.manage'),
            'canRecordPayment' => $this->allowsErpPermission('erp.invoicing.manage'),
        ]);
    }

    public function edit(Invoice $invoice): Response
    {
        $this->authorizeErpPermission('erp.invoicing.manage');

        $company = app(CompanyContext::class)->requireActiveCompany();

        $customers = Customer::query()
            ->where('company_id', $company->id)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'currency_code', 'payment_term_id']);

        $products = InventoryProduct::query()
            ->where('company_id', $company->id)
            ->where('is_active', true)
            ->with('unit')
            ->orderBy('name')
            ->get(['id', 'sku', 'name', 'unit_id', 'type']);

        $accounts = AccountingAccount::query()
            ->where('company_id', $company->id)
            ->where('is_active', true)
            ->where('is_group', false)
            ->whereIn('account_type', ['revenue', 'asset'])
            ->orderBy('code')
            ->get(['id', 'code', 'name']);

        $journals = AccountingJournal::query()
            ->where('company_id', $company->id)
            ->where('is_active', true)
            ->where('journal_type', 'sales')
            ->get(['id', 'code', 'name']);

        $currencies = Currency::query()->orderBy('code')->get(['code', 'name']);

        $invoice->load(['lines.product', 'lines.account']);

        return Inertia::render('Erp/Invoicing/Edit', [
            'company' => $company,
            'invoice' => $invoice,
            'customers' => $customers,
            'products' => $products,
            'accounts' => $accounts,
            'journals' => $journals,
            'currencies' => $currencies,
        ]);
    }

    public function update(UpdateInvoiceRequest $request, Invoice $invoice)
    {
        $this->authorizeErpPermission('erp.invoicing.manage');

        $data = $request->only([
            'customer_id', 'type', 'invoice_date', 'due_date',
            'currency_code', 'journal_id', 'notes', 'terms', 'footer_notes',
        ]);

        $lines = $request->input('lines', []);

        // Delete existing lines and create new ones
        $invoice->lines()->delete();

        foreach ($lines as $index => $line) {
            InvoiceLine::query()->create([
                'company_id' => $invoice->company_id,
                'invoice_id' => $invoice->id,
                'product_id' => $line['product_id'] ?? null,
                'account_id' => $line['account_id'] ?? null,
                'name' => $line['name'],
                'description' => $line['description'] ?? null,
                'quantity' => $line['quantity'] ?? 1,
                'unit' => $line['unit'] ?? null,
                'unit_price' => $line['unit_price'] ?? 0,
                'discount_percent' => $line['discount_percent'] ?? 0,
                'tax_rate' => $line['tax_rate'] ?? 0,
                'sort_order' => $index + 1,
                'metadata' => $line['metadata'] ?? null,
            ])->recalculate()->save();
        }

        $invoice->update($data);
        $invoice->load('lines')->recalculateTotals()->save();

        return redirect()->route('erp.invoicing.show', $invoice)
            ->with('success', 'Invoice updated successfully.');
    }

    public function send(Request $request, Invoice $invoice)
    {
        $this->authorizeErpPermission('erp.invoicing.manage');

        // Send invoice via email with PDF attachment
        $this->sendInvoiceEmail($request->user(), $invoice, $request->input('message'));

        // Update status to sent
        $this->invoicingService->sendInvoice($request->user(), $invoice);

        return back()->with('success', 'Invoice sent successfully.');
    }

    /**
     * Send invoice email with PDF attachment.
     */
    private function sendInvoiceEmail($user, Invoice $invoice, ?string $message = null): void
    {
        $invoice->load(['customer', 'company.branding']);

        if (! $invoice->customer->email) {
            // Log warning but don't fail - invoice status still changes to 'sent'
            \Log::warning('Cannot send invoice email: customer has no email address', [
                'invoice_id' => $invoice->id,
                'customer_id' => $invoice->customer_id,
            ]);

            return;
        }

        // Generate PDF
        $renderer = app(DocumentRenderer::class);
        $pdf = $renderer->render($invoice, 'pdf.documents.invoice', [
            'company' => $invoice->company->load('branding', 'signatories'),
        ]);

        // Send notification with PDF attachment
        $invoice->customer->notify(new InvoiceCreatedNotification(
            $invoice,
            $message // Optional custom message from user
        ));
    }

    public function post(Request $request, Invoice $invoice)
    {
        $this->authorizeErpPermission('erp.invoicing.manage');

        $this->invoicingService->postInvoice($request->user(), $invoice);

        return back()->with('success', 'Invoice posted to accounting successfully.');
    }

    public function cancel(Request $request, Invoice $invoice)
    {
        $this->authorizeErpPermission('erp.invoicing.manage');

        if (! $invoice->canBeCancelled()) {
            return back()->with('error', 'Only draft or unposted invoices can be cancelled. Raise a credit note against a posted invoice instead.');
        }

        $invoice->update([
            'status' => 'cancelled',
            'updated_by' => $request->user()->id,
        ]);
        InvoiceCancelled::dispatch($invoice, $request->user());

        return back()->with('success', 'Invoice cancelled successfully.');
    }

    public function recordPayment(Request $request, Invoice $invoice)
    {
        $this->authorizeErpPermission('erp.invoicing.manage');

        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.0001',
            'payment_date' => 'required|date',
            'currency_code' => 'required|string|size:3|exists:currencies,code',
            'payment_method' => 'nullable|string|max:50',
            'reference' => 'nullable|string|max:100',
            'notes' => 'nullable|string',
        ]);

        $payment = $this->invoicingService->recordPayment($request->user(), $invoice, $validated);

        return back()->with('success', 'Payment recorded successfully.');
    }

    public function downloadPdf(Invoice $invoice)
    {
        $this->authorizeErpPermission('erp.invoicing.view');

        $renderer = app(DocumentRenderer::class);
        $pdf = $renderer->render($invoice, 'pdf.documents.invoice', [
            'company' => $invoice->company->load('branding', 'signatories'),
        ]);

        return response($pdf)
            ->header('Content-Type', 'application/pdf')
            ->header('Content-Disposition', 'inline; filename="invoice-'.$invoice->document_number.'.pdf"');
    }
}
