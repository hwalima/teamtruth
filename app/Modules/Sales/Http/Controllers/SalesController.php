<?php

namespace App\Modules\Sales\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Invoicing\Models\Customer;
use App\Modules\Sales\Http\Requests\StoreLeadRequest;
use App\Modules\Sales\Http\Requests\StoreOpportunityRequest;
use App\Modules\Sales\Http\Requests\StoreQuotationRequest;
use App\Modules\Sales\Http\Requests\StoreSalesTeamRequest;
use App\Modules\Sales\Models\Lead;
use App\Modules\Sales\Models\Opportunity;
use App\Modules\Sales\Models\Quotation;
use App\Modules\Sales\Models\SalesOrder;
use App\Modules\Sales\Models\SalesTeam;
use App\Modules\Sales\Services\SalesService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SalesController extends Controller
{
    public function __construct(private SalesService $salesService)
    {
    }

    public function index(Request $request): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $search = trim((string) $request->query('search', ''));

        return Inertia::render('Erp/Sales/Index', [
            'leads' => Lead::query()->where('company_id', $company->id)
                ->when($search !== '', fn ($query) => $query->where('name', 'like', "%{$search}%"))
                ->with('assignedTo:id,name')->latest()->paginate(15)->withQueryString(),
            'opportunities' => Opportunity::query()->where('company_id', $company->id)
                ->with(['customer:id,name', 'assignedTo:id,name'])->latest()->limit(50)->get(),
            'quotations' => Quotation::query()->where('company_id', $company->id)
                ->with('customer:id,name')->latest()->limit(50)->get(),
            'orders' => SalesOrder::query()->where('company_id', $company->id)
                ->with('customer:id,name')->latest()->limit(50)->get(),
            'customers' => Customer::query()->where('company_id', $company->id)->where('is_active', true)->orderBy('name')->get(['id', 'name', 'currency_code']),
            'products' => \App\Modules\Inventory\Models\InventoryProduct::query()->where('company_id', $company->id)->where('is_active', true)->orderBy('name')->get(['id', 'name', 'sku']),
            'currencies' => \App\Models\Currency::query()->orderBy('code')->get(['code', 'name']),
            'filters' => ['search' => $search],
            'canManage' => $this->allowsErpPermission('erp.sales.manage'),
        ]);
    }

    public function storeLead(StoreLeadRequest $request)
    {
        $lead = $this->salesService->createLead($request->validated());

        return back()->with('success', __('Lead created.'));
    }

    public function convertLead(Request $request, Lead $lead)
    {
        $this->authorizeErpPermission('erp.sales.manage');
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'customer_id' => ['nullable', 'integer'],
            'expected_value' => ['nullable', 'numeric', 'min:0'],
            'probability' => ['nullable', 'integer', 'between:0,100'],
            'close_date' => ['nullable', 'date'],
        ]);
        $this->salesService->convertLeadToOpportunity($lead, $data);

        return back()->with('success', __('Lead converted to opportunity.'));
    }

    public function storeOpportunity(StoreOpportunityRequest $request)
    {
        $this->salesService->createOpportunity($request->validated());

        return back()->with('success', __('Opportunity created.'));
    }

    public function storeQuotation(StoreQuotationRequest $request)
    {
        $this->salesService->createQuotation($request->validated(), $request->user());

        return back()->with('success', __('Quotation created.'));
    }

    public function submitQuotation(Request $request, Quotation $quotation)
    {
        $this->authorizeErpPermission('erp.sales.manage');
        $this->salesService->submitQuotation($quotation, $request->user());

        return back()->with('success', __('Quotation submitted for approval.'));
    }

    public function convertQuotation(Request $request, Quotation $quotation)
    {
        $this->authorizeErpPermission('erp.sales.manage');
        $this->salesService->convertQuotationToSalesOrder($quotation);

        return back()->with('success', __('Sales order created.'));
    }

    public function submitSalesOrder(Request $request, SalesOrder $salesOrder)
    {
        $this->authorizeErpPermission('erp.sales.manage');
        $this->salesService->submitSalesOrder($salesOrder, $request->user());

        return back()->with('success', __('Sales order submitted for approval.'));
    }

    public function createInvoice(Request $request, SalesOrder $salesOrder)
    {
        $this->authorizeErpPermission('erp.sales.manage');
        $invoice = $this->salesService->createInvoiceFromSalesOrder($salesOrder, $request->user());

        return redirect()->route('erp.invoicing.show', $invoice)->with('success', __('Invoice created from sales order.'));
    }

    public function confirmSalesOrder(Request $request, SalesOrder $salesOrder)
    {
        $this->authorizeErpPermission('erp.sales.manage');
        $this->salesService->confirmSalesOrder($salesOrder);

        return back()->with('success', __('Sales order confirmed.'));
    }

    public function storeTeam(StoreSalesTeamRequest $request)
    {
        $this->salesService->createTeam($request->validated());

        return back()->with('success', __('Sales team created.'));
    }
}
