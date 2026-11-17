<?php

namespace App\Modules\Invoicing\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Invoicing\Http\Requests\StoreCustomerRequest;
use App\Modules\Invoicing\Models\Customer;
use Inertia\Inertia;
use Inertia\Response;

class CustomerController extends Controller
{
    public function index(Request $request): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        $query = Customer::query()
            ->where('company_id', $company->id)
            ->with('paymentTerm');

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('code', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%")
                    ->orWhere('tax_no', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if ($request->filled('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        $customers = $query->orderBy('name')->paginate(20)->withQueryString();

        return Inertia::render('Erp/Invoicing/Customers/Index', [
            'company' => $company,
            'customers' => $customers,
            'filters' => $request->only(['search', 'is_active']),
        ]);
    }

    public function create(): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        $paymentTerms = \App\Modules\Invoicing\Models\PaymentTerm::query()
            ->where('company_id', $company->id)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'net_days', 'discount_days', 'discount_percent']);

        $currencies = \App\Models\Currency::query()->orderBy('code')->get(['code', 'name']);

        return Inertia::render('Erp/Invoicing/Customers/Create', [
            'company' => $company,
            'paymentTerms' => $paymentTerms,
            'currencies' => $currencies,
        ]);
    }

    public function store(StoreCustomerRequest $request)
    {
        $user = $request->user();
        $company = app(CompanyContext::class)->requireActiveCompany();

        $data = $request->validated();
        $data['company_id'] = $company->id;
        $data['created_by'] = $user->id;

        Customer::query()->create($data);

        return redirect()->route('erp.invoicing.customers.index')
            ->with('success', 'Customer created successfully.');
    }

    public function show(Customer $customer): Response
    {
        $this->authorizeErpPermission('erp.invoicing.view');

        $customer->load(['paymentTerm', 'invoices' => function ($q) {
            $q->orderBy('invoice_date', 'desc')->limit(10);
        }, 'creditNotes' => function ($q) {
            $q->orderBy('credit_note_date', 'desc')->limit(10);
        }]);

        $company = app(CompanyContext::class)->requireActiveCompany();

        return Inertia::render('Erp/Invoicing/Customers/Show', [
            'company' => $company,
            'customer' => $customer,
            'outstandingBalance' => $customer->getOutstandingBalance(),
            'isOverCreditLimit' => $customer->isOverCreditLimit(),
        ]);
    }

    public function edit(Customer $customer): Response
    {
        $this->authorizeErpPermission('erp.invoicing.manage');

        $company = app(CompanyContext::class)->requireActiveCompany();

        $paymentTerms = \App\Modules\Invoicing\Models\PaymentTerm::query()
            ->where('company_id', $company->id)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'net_days', 'discount_days', 'discount_percent']);

        $currencies = \App\Models\Currency::query()->orderBy('code')->get(['code', 'name']);

        return Inertia::render('Erp/Invoicing/Customers/Edit', [
            'customer' => $customer,
            'paymentTerms' => $paymentTerms,
            'currencies' => $currencies,
        ]);
    }

    public function update(StoreCustomerRequest $request, Customer $customer)
    {
        $this->authorizeErpPermission('erp.invoicing.manage');

        $data = $request->validated();
        $data['updated_by'] = $request->user()->id;

        $customer->update($data);

        return redirect()->route('erp.invoicing.customers.show', $customer)
            ->with('success', 'Customer updated successfully.');
    }

    public function destroy(Customer $customer)
    {
        $this->authorizeErpPermission('erp.invoicing.manage');

        // Check if customer has invoices or credit notes
        if ($customer->invoices()->exists() || $customer->creditNotes()->exists()) {
            return back()->with('error', 'Cannot delete customer with associated invoices or credit notes.');
        }

        $customer->delete();

        return redirect()->route('erp.invoicing.customers.index')
            ->with('success', 'Customer deleted successfully.');
    }
}