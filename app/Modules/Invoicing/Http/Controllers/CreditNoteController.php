<?php

namespace App\Modules\Invoicing\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Invoicing\Http\Requests\StoreCreditNoteRequest;
use App\Modules\Invoicing\Models\CreditNote;
use App\Modules\Invoicing\Models\CreditNoteLine;
use App\Modules\Invoicing\Services\InvoicingService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CreditNoteController extends Controller
{
    public function __construct(
        private InvoicingService $invoicingService,
    ) {}

    public function index(Request $request): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        $query = CreditNote::query()
            ->where('company_id', $company->id)
            ->with(['customer', 'originalInvoice', 'lines']);

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

        $creditNotes = $query->orderBy('credit_note_date', 'desc')->paginate(20)->withQueryString();

        $customers = \App\Modules\Invoicing\Models\Customer::query()
            ->where('company_id', $company->id)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        return Inertia::render('Erp/Invoicing/CreditNotes/Index', [
            'creditNotes' => $creditNotes,
            'customers' => $customers,
            'filters' => $request->only(['search', 'status']),
            'statusOptions' => [
                'draft' => 'Draft',
                'issued' => 'Issued',
                'applied' => 'Applied',
                'cancelled' => 'Cancelled',
            ],
        ]);
    }

    public function create(): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        $customers = \App\Modules\Invoicing\Models\Customer::query()
            ->where('company_id', $company->id)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        $invoices = \App\Modules\Invoicing\Models\Invoice::query()
            ->where('company_id', $company->id)
            ->whereIn('status', ['sent', 'paid', 'partial_paid', 'overdue'])
            ->with('customer')
            ->orderBy('invoice_date', 'desc')
            ->get(['id', 'document_number', 'customer_id', 'total_amount', 'balance_due']);

        $products = \App\Modules\Inventory\Models\InventoryProduct::query()
            ->where('company_id', $company->id)
            ->where('is_active', true)
            ->with('unit')
            ->orderBy('name')
            ->get(['id', 'sku', 'name', 'unit_id', 'type']);

        $accounts = \App\Modules\Accounting\Models\AccountingAccount::query()
            ->where('company_id', $company->id)
            ->where('is_active', true)
            ->where('is_group', false)
            ->whereIn('account_type', ['revenue', 'asset'])
            ->orderBy('code')
            ->get(['id', 'code', 'name']);

        $journals = \App\Modules\Accounting\Models\AccountingJournal::query()
            ->where('company_id', $company->id)
            ->where('is_active', true)
            ->where('journal_type', 'sales')
            ->get(['id', 'code', 'name']);

        $currencies = \App\Models\Currency::query()->orderBy('code')->get(['code', 'name']);

        return Inertia::render('Erp/Invoicing/CreditNotes/Create', [
            'customers' => $customers,
            'invoices' => $invoices,
            'products' => $products,
            'accounts' => $accounts,
            'journals' => $journals,
            'currencies' => $currencies,
        ]);
    }

    public function store(StoreCreditNoteRequest $request)
    {
        $user = $request->user();

        $data = $request->only([
            'customer_id', 'original_invoice_id', 'credit_note_date',
            'currency_code', 'journal_id', 'reason', 'notes',
        ]);

        $lines = $request->input('lines', []);

        $creditNote = $this->invoicingService->createCreditNote($user, $data, $lines);

        return redirect()->route('erp.invoicing.credit-notes.show', $creditNote)
            ->with('success', 'Credit note created successfully.');
    }

    public function show(CreditNote $creditNote): Response
    {
        $this->authorizeErpPermission('erp.invoicing.view');

        $creditNote->load([
            'customer',
            'originalInvoice',
            'lines.product.unit',
            'lines.account',
            'payments',
            'fiscalDocuments',
        ]);

        return Inertia::render('Erp/Invoicing/CreditNotes/Show', [
            'creditNote' => $creditNote,
            'canIssue' => $this->allowsErpPermission('erp.invoicing.manage'),
            'canCancel' => $this->allowsErpPermission('erp.invoicing.manage'),
            'canApply' => $this->allowsErpPermission('erp.invoicing.manage'),
        ]);
    }

    public function issue(CreditNote $creditNote)
    {
        $this->authorizeErpPermission('erp.invoicing.manage');

        $this->invoicingService->issueCreditNote(request()->user(), $creditNote);

        return back()->with('success', 'Credit note issued successfully.');
    }

    public function cancel(CreditNote $creditNote)
    {
        $this->authorizeErpPermission('erp.invoicing.manage');

        $creditNote->update([
            'status' => 'cancelled',
            'updated_by' => request()->user()->id,
        ]);

        return back()->with('success', 'Credit note cancelled successfully.');
    }

    public function apply(Request $request, CreditNote $creditNote)
    {
        $this->authorizeErpPermission('erp.invoicing.manage');

        $validated = $request->validate([
            'invoice_id' => 'required|exists:inv_invoices,id',
            'amount' => 'required|numeric|min:0.0001',
        ]);

        $invoice = \App\Modules\Invoicing\Models\Invoice::query()
            ->where('company_id', $creditNote->company_id)
            ->where('id', $validated['invoice_id'])
            ->whereIn('status', ['sent', 'partial_paid', 'overdue'])
            ->firstOrFail();

        $this->invoicingService->applyCreditNote(
            $request->user(),
            $creditNote,
            $invoice,
            $validated['amount']
        );

        return back()->with('success', 'Credit note applied successfully.');
    }

    public function downloadPdf(CreditNote $creditNote)
    {
        $this->authorizeErpPermission('erp.invoicing.view');

        $renderer = app(\App\Modules\Core\Services\DocumentRenderer::class);
        $pdf = $renderer->render($creditNote, 'pdf.documents.credit_note', [
            'company' => $creditNote->company->load('branding', 'signatories'),
        ]);

        return response($pdf)
            ->header('Content-Type', 'application/pdf')
            ->header('Content-Disposition', 'inline; filename="credit-note-' . $creditNote->document_number . '.pdf"');
    }
}