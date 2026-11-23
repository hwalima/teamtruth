<?php

namespace App\Modules\Sales\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Invoicing\Models\Customer;
use App\Modules\Sales\Enums\LeadStatus;
use App\Modules\Sales\Http\Requests\StoreLeadRequest;
use App\Modules\Sales\Models\Lead;
use App\Modules\Sales\Services\SalesService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Leads: people or organisations that may buy. Qualify them, then turn them into opportunities. */
class LeadController extends Controller
{
    public function __construct(private SalesService $salesService) {}

    public function index(Request $request): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $statuses = array_column(LeadStatus::cases(), 'value');
        $search = trim((string) $request->query('search', ''));
        $status = in_array($request->query('status'), $statuses, true) ? $request->query('status') : 'all';

        $counts = Lead::query()->where('company_id', $company->id)
            ->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status')
            ->map(fn ($total) => (int) $total);

        $leads = Lead::query()->where('company_id', $company->id)
            ->when($status !== 'all', fn ($query) => $query->where('status', $status))
            ->when($search !== '', fn ($query) => $query->where(fn ($query) => $query
                ->where('name', 'like', "%{$search}%")
                ->orWhere('contact_person', 'like', "%{$search}%")
                ->orWhere('email', 'like', "%{$search}%")
                ->orWhere('phone', 'like', "%{$search}%")
                ->orWhere('source', 'like', "%{$search}%")))
            ->with(['assignedTo:id,name', 'opportunities:id,lead_id,title'])
            ->latest()->paginate(20)->withQueryString();

        return Inertia::render('Erp/Sales/Leads/Index', [
            'company' => $company->only(['id', 'code', 'name', 'default_currency']),
            'leads' => $leads,
            'filters' => ['search' => $search, 'status' => $status],
            'counts' => collect($statuses)->mapWithKeys(fn ($key) => [$key => $counts[$key] ?? 0]),
            'members' => $company->activeUsers()->orderBy('name')->get(['users.id', 'users.name']),
            'customers' => Customer::query()->where('company_id', $company->id)->where('is_active', true)
                ->orderBy('name')->get(['id', 'code', 'name']),
            'canManage' => $this->allowsErpPermission('erp.sales.manage'),
        ]);
    }

    public function store(StoreLeadRequest $request): RedirectResponse
    {
        $lead = $this->salesService->createLead($request->validated());

        return back()->with('success', __('Lead :name added.', ['name' => $lead->name]));
    }

    public function update(StoreLeadRequest $request, Lead $lead): RedirectResponse
    {
        $this->salesService->updateLead($lead, $request->validated());

        return back()->with('success', __('Lead :name saved.', ['name' => $lead->name]));
    }

    public function status(Request $request, Lead $lead): RedirectResponse
    {
        $this->authorizeErpPermission('erp.sales.manage');
        $data = $request->validate(['status' => ['required', 'string']]);
        $this->salesService->setLeadStatus($lead, $data['status']);

        return back()->with('success', __('Lead :name marked :status.', ['name' => $lead->name, 'status' => $data['status']]));
    }

    public function convert(Request $request, Lead $lead): RedirectResponse
    {
        $this->authorizeErpPermission('erp.sales.manage');
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'customer_id' => ['nullable', 'integer'],
            'expected_value' => ['nullable', 'numeric', 'min:0'],
            'probability' => ['nullable', 'integer', 'between:0,100'],
            'close_date' => ['nullable', 'date'],
        ]);
        $opportunity = $this->salesService->convertLeadToOpportunity($lead, $data);

        return redirect()->route('erp.sales.opportunities.index')
            ->with('success', __('Lead :name is now the opportunity ":title".', ['name' => $lead->name, 'title' => $opportunity->title]));
    }

    public function destroy(Lead $lead): RedirectResponse
    {
        $this->authorizeErpPermission('erp.sales.manage');
        $this->salesService->deleteLead($lead);

        return back()->with('success', __('Lead :name deleted.', ['name' => $lead->name]));
    }
}
