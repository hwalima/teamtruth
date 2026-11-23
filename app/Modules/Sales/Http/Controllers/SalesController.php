<?php

namespace App\Modules\Sales\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Core\Services\CompanyContext;
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

    /** The Sales overview: what needs attention at each step, and the latest documents. */
    public function index(): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $count = fn (string $model, array $statuses) => $model::query()->where('company_id', $company->id)->whereIn('status', $statuses)->count();

        return Inertia::render('Erp/Sales/Index', [
            'company' => $company->only(['id', 'code', 'name', 'default_currency']),
            'stats' => [
                'leads_open' => $count(Lead::class, ['new', 'qualified']),
                'opportunities_open' => $count(Opportunity::class, ['open']),
                'pipeline_value' => (string) Opportunity::query()->where('company_id', $company->id)->where('status', 'open')->sum('expected_value'),
                'quotations_pending' => $count(Quotation::class, ['pending_approval']),
                'quotations_approved' => $count(Quotation::class, ['approved']),
                'orders_to_deliver' => $count(SalesOrder::class, ['approved', 'partially_delivered']),
                'orders_pending' => $count(SalesOrder::class, ['draft', 'pending_approval']),
            ],
            'quotations' => Quotation::query()->where('company_id', $company->id)
                ->with('customer:id,name')->latest('id')->limit(6)
                ->get(['id', 'customer_id', 'document_number', 'status', 'currency_code', 'total', 'created_at']),
            'orders' => SalesOrder::query()->where('company_id', $company->id)
                ->with('customer:id,name')->latest('id')->limit(6)
                ->get(['id', 'customer_id', 'document_number', 'status', 'currency_code', 'total', 'created_at']),
            'canManage' => $this->allowsErpPermission('erp.sales.manage'),
        ]);
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
        $order = $this->salesService->convertQuotationToSalesOrder($quotation);

        return redirect()->route('erp.sales.orders.show', $order)
            ->with('success', __('Sales order :number created. Submit it for approval, then deliver and invoice it from here.', ['number' => $order->document_number]));
    }

    public function submitSalesOrder(Request $request, SalesOrder $salesOrder)
    {
        $this->authorizeErpPermission('erp.sales.manage');
        $this->salesService->submitSalesOrder($salesOrder, $request->user());

        return back()->with('success', __('Sales order submitted for approval.'));
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
