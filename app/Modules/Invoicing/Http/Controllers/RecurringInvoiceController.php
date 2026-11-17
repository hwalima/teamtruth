<?php

namespace App\Modules\Invoicing\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Invoicing\Http\Requests\StoreRecurringInvoiceRequest;
use App\Modules\Invoicing\Models\RecurringInvoice;
use App\Modules\Invoicing\Services\InvoicingService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class RecurringInvoiceController extends Controller
{
    public function __construct(
        private InvoicingService $invoicingService,
    ) {}

    public function index(Request $request): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        $query = RecurringInvoice::query()
            ->where('company_id', $company->id)
            ->with(['customer', 'paymentTerm']);

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhereHas('customer', fn ($q) => $q->where('name', 'like', "%{$search}%"));
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $recurringInvoices = $query->orderBy('next_run_date')->paginate(20)->withQueryString();

        return Inertia::render('Erp/Invoicing/RecurringInvoices/Index', [
            'company' => $company,
            'recurringInvoices' => $recurringInvoices,
            'filters' => $request->only(['search', 'status']),
            'statusOptions' => [
                'active' => 'Active',
                'paused' => 'Paused',
                'completed' => 'Completed',
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
            ->get(['id', 'name', 'code', 'currency_code', 'payment_term_id']);

        $paymentTerms = \App\Modules\Invoicing\Models\PaymentTerm::query()
            ->where('company_id', $company->id)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'net_days', 'discount_days', 'discount_percent']);

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

        $currencies = \App\Models\Currency::query()->orderBy('code')->get(['code', 'name']);

        return Inertia::render('Erp/Invoicing/RecurringInvoices/Create', [
            'company' => $company,
            'customers' => $customers,
            'paymentTerms' => $paymentTerms,
            'products' => $products,
            'accounts' => $accounts,
            'currencies' => $currencies,
            'frequencyOptions' => [
                'daily' => 'Daily',
                'weekly' => 'Weekly',
                'monthly' => 'Monthly',
                'quarterly' => 'Quarterly',
                'yearly' => 'Yearly',
            ],
        ]);
    }

    public function store(StoreRecurringInvoiceRequest $request)
    {
        $user = $request->user();

        $data = $request->only([
            'name', 'customer_id', 'payment_term_id', 'currency_code',
            'frequency', 'interval', 'start_date', 'end_date', 'max_occurrences',
            'template_data', 'notes', 'terms',
        ]);

        $recurring = \App\Modules\Invoicing\Models\RecurringInvoice::query()->create([
            'company_id' => app(CompanyContext::class)->requireActiveCompany()->id,
            ...$data,
            'next_run_date' => $data['start_date'],
            'occurrences_count' => 0,
            'status' => 'active',
            'created_by' => $user->id,
        ]);

        return redirect()->route('erp.invoicing.recurring.show', $recurring)
            ->with('success', 'Recurring invoice template created successfully.');
    }

    public function show(RecurringInvoice $recurring): Response
    {
        $this->authorizeErpPermission('erp.invoicing.view');

        $company = app(CompanyContext::class)->requireActiveCompany();
        $recurring->load(['customer', 'paymentTerm']);

        return Inertia::render('Erp/Invoicing/RecurringInvoices/Show', [
            'company' => $company,
            'recurring' => $recurring,
            'canPause' => $this->allowsErpPermission('erp.invoicing.manage'),
            'canResume' => $this->allowsErpPermission('erp.invoicing.manage'),
            'canDelete' => $this->allowsErpPermission('erp.invoicing.manage'),
        ]);
    }

    public function pause(RecurringInvoice $recurring)
    {
        $this->authorizeErpPermission('erp.invoicing.manage');

        $recurring->update([
            'status' => 'paused',
            'updated_by' => request()->user()->id,
        ]);

        return back()->with('success', 'Recurring invoice paused successfully.');
    }

    public function resume(RecurringInvoice $recurring)
    {
        $this->authorizeErpPermission('erp.invoicing.manage');

        $recurring->update([
            'status' => 'active',
            'updated_by' => request()->user()->id,
        ]);

        return back()->with('success', 'Recurring invoice resumed successfully.');
    }

    public function destroy(RecurringInvoice $recurring)
    {
        $this->authorizeErpPermission('erp.invoicing.manage');

        $recurring->delete();

        return redirect()->route('erp.invoicing.recurring.index')
            ->with('success', 'Recurring invoice template deleted successfully.');
    }

    public function generateNow(RecurringInvoice $recurring)
    {
        $this->authorizeErpPermission('erp.invoicing.manage');

        try {
            $template = $recurring->getTemplateInvoice();
            $lines = $template['lines'] ?? [];

            $this->invoicingService->createInvoice(
                request()->user(),
                [
                    'customer_id' => $recurring->customer_id,
                    'currency_code' => $recurring->currency_code,
                    'invoice_date' => now()->toDateString(),
                    'due_date' => $recurring->paymentTerm
                        ? $recurring->paymentTerm->calculateDueDate(now()->toDateString())
                        : now()->toDateString(),
                    'status' => 'draft',
                    'notes' => $recurring->notes,
                    'terms' => $recurring->terms,
                ],
                $lines
            );

            $recurring->incrementOccurrence();

            return back()->with('success', 'Invoice generated successfully from recurring template.');
        } catch (\Throwable $e) {
            return back()->with('error', 'Failed to generate invoice: ' . $e->getMessage());
        }
    }
}