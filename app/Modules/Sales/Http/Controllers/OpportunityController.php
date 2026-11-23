<?php

namespace App\Modules\Sales\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Invoicing\Models\Customer;
use App\Modules\Sales\Enums\OpportunityStatus;
use App\Modules\Sales\Http\Requests\StoreOpportunityRequest;
use App\Modules\Sales\Models\Opportunity;
use App\Modules\Sales\Services\SalesService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Opportunities: possible deals with a value and a chance of winning, quoted from here. */
class OpportunityController extends Controller
{
    public function __construct(private SalesService $salesService) {}

    public function index(Request $request): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $statuses = array_column(OpportunityStatus::cases(), 'value');
        $search = trim((string) $request->query('search', ''));
        $status = in_array($request->query('status'), [...$statuses, 'all'], true) ? $request->query('status') : 'open';

        $summary = Opportunity::query()->where('company_id', $company->id)
            ->selectRaw('status, count(*) as total, sum(expected_value) as value, sum(expected_value * probability / 100) as weighted')
            ->groupBy('status')->get()->keyBy('status');

        $opportunities = Opportunity::query()->where('company_id', $company->id)
            ->when($status !== 'all', fn ($query) => $query->where('status', $status))
            ->when($search !== '', fn ($query) => $query->where(fn ($query) => $query
                ->where('title', 'like', "%{$search}%")
                ->orWhereHas('customer', fn ($customer) => $customer->where('name', 'like', "%{$search}%")->orWhere('code', 'like', "%{$search}%"))
                ->orWhereHas('lead', fn ($lead) => $lead->where('name', 'like', "%{$search}%"))))
            ->with(['customer:id,code,name', 'lead:id,name', 'assignedTo:id,name'])
            ->withCount('quotations')
            ->orderByRaw('close_date is null')->orderBy('close_date')->latest('id')
            ->paginate(20)->withQueryString();

        return Inertia::render('Erp/Sales/Opportunities/Index', [
            'company' => $company->only(['id', 'code', 'name', 'default_currency']),
            'opportunities' => $opportunities,
            'filters' => ['search' => $search, 'status' => $status],
            'counts' => collect($statuses)->mapWithKeys(fn ($key) => [$key => (int) ($summary[$key]->total ?? 0)]),
            'pipeline' => [
                'open_value' => (string) ($summary['open']->value ?? 0),
                'weighted_value' => (string) ($summary['open']->weighted ?? 0),
                'won_value' => (string) ($summary['won']->value ?? 0),
            ],
            'members' => $company->activeUsers()->orderBy('name')->get(['users.id', 'users.name']),
            'customers' => Customer::query()->where('company_id', $company->id)->where('is_active', true)
                ->orderBy('name')->get(['id', 'code', 'name']),
            'canManage' => $this->allowsErpPermission('erp.sales.manage'),
        ]);
    }

    public function store(StoreOpportunityRequest $request): RedirectResponse
    {
        $opportunity = $this->salesService->createOpportunity($request->validated());

        return back()->with('success', __('Opportunity ":title" added.', ['title' => $opportunity->title]));
    }

    public function update(StoreOpportunityRequest $request, Opportunity $opportunity): RedirectResponse
    {
        $this->salesService->updateOpportunity($opportunity, $request->validated());

        return back()->with('success', __('Opportunity ":title" saved.', ['title' => $opportunity->title]));
    }

    public function status(Request $request, Opportunity $opportunity): RedirectResponse
    {
        $this->authorizeErpPermission('erp.sales.manage');
        $data = $request->validate(['status' => ['required', 'string']]);
        $this->salesService->setOpportunityStatus($opportunity, $data['status']);

        $message = match ($data['status']) {
            'won' => 'Opportunity ":title" marked won.',
            'lost' => 'Opportunity ":title" marked lost.',
            default => 'Opportunity ":title" reopened.',
        };

        return back()->with('success', __($message, ['title' => $opportunity->title]));
    }

    public function destroy(Opportunity $opportunity): RedirectResponse
    {
        $this->authorizeErpPermission('erp.sales.manage');
        $this->salesService->deleteOpportunity($opportunity);

        return back()->with('success', __('Opportunity ":title" deleted.', ['title' => $opportunity->title]));
    }
}
