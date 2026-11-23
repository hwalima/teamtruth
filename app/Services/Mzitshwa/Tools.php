<?php

namespace App\Services\Mzitshwa;

use App\Models\Bug;
use App\Models\Project;
use App\Models\Task;
use App\Models\Timesheet;
use App\Models\User;
use App\Modules\Accounting\Services\AccountingReportService;
use App\Modules\Accounting\Services\FinancialStatementService;
use App\Modules\Banking\Models\BankAccount;
use App\Modules\Banking\Models\Money;
use App\Modules\Core\Enums\ApprovalStatus;
use App\Modules\Core\Models\ApprovalRequest;
use App\Modules\Core\Services\ApprovalWorkflowService;
use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Models\LeaveRequest;
use App\Modules\Inventory\Models\InventoryProduct;
use App\Modules\Inventory\Services\InventoryStockService;
use App\Modules\Invoicing\Models\Customer;
use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Purchase\Models\PurchaseBill;
use App\Modules\Purchase\Models\PurchaseOrder;
use App\Modules\Requisitions\Models\Requisition;
use App\Modules\Sales\Models\Lead;
use App\Modules\Sales\Models\Opportunity;
use App\Modules\Sales\Models\Quotation;
use App\Modules\Sales\Models\SalesOrder;
use Carbon\Carbon;

/**
 * The read-only look-ups Mzitshwa can use. Each tool is offered to the AI only
 * when the user may see that data: workspace tools follow the workspace role,
 * ERP tools follow the ERP role in the active company (which every ERP model
 * is already scoped to).
 */
class Tools
{
    private const LIMIT = 25;

    private const CLOSED_INVOICE = ['draft', 'cancelled', 'paid', 'proforma'];

    /** @var array<string, array{description: string, parameters: array, run: callable}> */
    private array $tools = [];

    public function __construct(
        private User $user,
        private array $workspacePermissions,
        private ErpScope $erp,
    ) {
        $this->register();
    }

    /** Tool definitions in the OpenAI "tools" format. */
    public function definitions(): array
    {
        return array_values(array_map(fn (string $name, array $tool) => [
            'type' => 'function',
            'function' => [
                'name' => $name,
                'description' => $tool['description'],
                'parameters' => $tool['parameters'] ?: ['type' => 'object', 'properties' => new \stdClass],
            ],
        ], array_keys($this->tools), $this->tools));
    }

    public function names(): array
    {
        return array_keys($this->tools);
    }

    public function has(string $name): bool
    {
        return isset($this->tools[$name]);
    }

    public function run(string $name, array $args): array
    {
        if (! $this->has($name)) {
            return ['error' => 'This look-up is not available to this user.'];
        }

        try {
            return ($this->tools[$name]['run'])($args);
        } catch (\Throwable $e) {
            report($e);

            return ['error' => 'The look-up failed: ' . class_basename($e)];
        }
    }

    // ── Registration ────────────────────────────────────────────────────────

    private function register(): void
    {
        $ws = $this->user->current_workspace_id;

        if ($ws && $this->can('project_view_any', 'project_view', 'task_view_any', 'task_view')) {
            $this->add('workspace_overview', 'Summary of the current workspace: project and task counts, overdue tasks, open bugs.', [], fn () => $this->workspaceOverview());
        }
        if ($ws && $this->can('project_view_any', 'project_view')) {
            $this->add('list_projects', 'List projects in the current workspace with status, progress and deadline.', [
                'status' => ['type' => 'string', 'description' => 'Optional status filter, e.g. active, completed, on_hold'],
            ], fn (array $a) => $this->listProjects($a));
        }
        if ($ws && $this->can('task_view_any', 'task_view')) {
            $this->add('find_tasks', 'Search tasks in the current workspace.', [
                'search' => ['type' => 'string', 'description' => 'Words in the task title'],
                'project' => ['type' => 'string', 'description' => 'Project title (partial)'],
                'mine_only' => ['type' => 'boolean', 'description' => 'Only tasks assigned to the user'],
                'overdue_only' => ['type' => 'boolean'],
            ], fn (array $a) => $this->findTasks($a));
        }
        if ($ws && $this->can('bug_view_any', 'bug_view')) {
            $this->add('list_bugs', 'List bugs in the current workspace.', [
                'open_only' => ['type' => 'boolean', 'description' => 'Hide resolved and closed bugs (default true)'],
            ], fn (array $a) => $this->listBugs($a));
        }
        if ($ws && $this->can('timesheet_view_any', 'timesheet_view')) {
            $this->add('my_timesheets', "The user's own timesheets: hours, billable hours and status.", [
                'from' => ['type' => 'string', 'description' => 'YYYY-MM-DD'],
                'to' => ['type' => 'string', 'description' => 'YYYY-MM-DD'],
            ], fn (array $a) => $this->myTimesheets($a));
        }

        if (! $this->erp->company()) {
            return;
        }

        if ($this->erp->allows('erp.dashboard.view', 'erp.accounting.view', 'erp.invoicing.view', 'erp.purchase.view', 'erp.sales.view')) {
            $this->add('erp_company_overview', 'Key figures for the active ERP company: receivables, overdue invoices, unpaid bills, open purchase orders, pending requisitions, sales pipeline.', [], fn () => $this->companyOverview());
        }
        if ($this->erp->allows('erp.accounting.view')) {
            $this->add('profit_and_loss', 'Profit and loss (income statement) for a period, from posted journal entries.', [
                'from' => ['type' => 'string', 'description' => 'YYYY-MM-DD, default start of this year'],
                'to' => ['type' => 'string', 'description' => 'YYYY-MM-DD, default today'],
            ], fn (array $a) => app(AccountingReportService::class)->profitAndLoss($this->erp->company(), $this->date($a['from'] ?? null, now()->startOfYear()), $this->date($a['to'] ?? null)));
            $this->add('balance_sheet', 'Balance sheet (assets, liabilities, equity) as at a date.', [
                'as_of' => ['type' => 'string', 'description' => 'YYYY-MM-DD, default today'],
            ], fn (array $a) => app(FinancialStatementService::class)->balanceSheet($this->erp->company(), $this->date($a['as_of'] ?? null)));
            $this->add('trial_balance', 'Trial balance: debit and credit totals per ledger account as at a date.', [
                'as_of' => ['type' => 'string', 'description' => 'YYYY-MM-DD, default today'],
            ], fn (array $a) => app(AccountingReportService::class)->trialBalance($this->erp->company(), $this->date($a['as_of'] ?? null)));
        }
        if ($this->erp->allows('erp.accounting.view', 'erp.invoicing.view')) {
            $this->add('aged_receivables', 'What customers owe, split by how overdue it is.', [
                'as_of' => ['type' => 'string', 'description' => 'YYYY-MM-DD, default today'],
            ], fn (array $a) => app(FinancialStatementService::class)->agedReceivables($this->erp->company(), $this->date($a['as_of'] ?? null)));
        }
        if ($this->erp->allows('erp.accounting.view', 'erp.purchase.view')) {
            $this->add('aged_payables', 'What the company owes vendors, split by how overdue it is.', [
                'as_of' => ['type' => 'string', 'description' => 'YYYY-MM-DD, default today'],
            ], fn (array $a) => app(FinancialStatementService::class)->agedPayables($this->erp->company(), $this->date($a['as_of'] ?? null)));
        }
        if ($this->erp->allows('erp.invoicing.view')) {
            $this->add('find_invoices', 'Search customer invoices.', [
                'customer' => ['type' => 'string', 'description' => 'Customer name (partial)'],
                'status' => ['type' => 'string', 'description' => 'One of: draft, sent, partial_paid, overdue, paid, cancelled, proforma'],
                'overdue_only' => ['type' => 'boolean'],
                'from' => ['type' => 'string', 'description' => 'Invoice date from, YYYY-MM-DD'],
                'to' => ['type' => 'string', 'description' => 'Invoice date to, YYYY-MM-DD'],
            ], fn (array $a) => $this->findInvoices($a));
            $this->add('find_customers', 'Search customers, with how much each owes.', [
                'search' => ['type' => 'string', 'description' => 'Name or code (partial); empty lists the biggest balances'],
            ], fn (array $a) => $this->findCustomers($a));
        }
        if ($this->erp->allows('erp.banking.view')) {
            $this->add('bank_balances', 'Balances of the active company\'s bank accounts and how many statement lines are not yet reconciled.', [], fn () => $this->bankBalances());
        }
        if ($this->erp->allows('erp.inventory.view', 'erp.stock.manage')) {
            $this->add('stock_on_hand', 'Quantity on hand per product (internal locations).', [
                'search' => ['type' => 'string', 'description' => 'Product name or SKU (partial)'],
            ], fn (array $a) => $this->stockOnHand($a));
        }
        if ($this->erp->allows('erp.purchase.view')) {
            $this->add('find_purchases', 'Search purchase orders or vendor bills.', [
                'kind' => ['type' => 'string', 'enum' => ['orders', 'bills'], 'description' => 'Default orders'],
                'vendor' => ['type' => 'string', 'description' => 'Vendor name (partial)'],
                'status' => ['type' => 'string'],
                'unpaid_only' => ['type' => 'boolean', 'description' => 'Bills only: still owing'],
            ], fn (array $a) => $this->findPurchases($a));
        }
        if ($this->erp->allows('erp.requisitions.view', 'erp.requisitions.manage', 'erp.requisitions.create')) {
            $this->add('find_requisitions', 'Search purchase requisitions.', [
                'status' => ['type' => 'string', 'description' => 'e.g. draft, submitted, approved, rejected'],
                'mine_only' => ['type' => 'boolean'],
            ], fn (array $a) => $this->findRequisitions($a));
        }
        if ($this->erp->allows('erp.sales.view')) {
            $this->add('sales_pipeline', 'Sales pipeline: leads, opportunities, quotations and sales orders by status with values.', [], fn () => $this->salesPipeline());
            $this->add('find_sales_documents', 'Search quotations or sales orders.', [
                'kind' => ['type' => 'string', 'enum' => ['quotations', 'orders'], 'description' => 'Default quotations'],
                'customer' => ['type' => 'string'],
                'status' => ['type' => 'string'],
            ], fn (array $a) => $this->findSalesDocuments($a));
        }
        if ($this->erp->allows('erp.hrm.employee.view')) {
            $this->add('hr_overview', 'Headcount by status and department, and recent hires.', [], fn () => $this->hrOverview());
            $this->add('find_employees', 'Search employees (work details only, never personal or pay data).', [
                'search' => ['type' => 'string', 'description' => 'Name or employee number'],
                'department' => ['type' => 'string'],
            ], fn (array $a) => $this->findEmployees($a));
        }
        if ($this->erp->allows('erp.hrm.leave.view', 'erp.hrm.leave.approve')) {
            $this->add('leave_overview', 'Leave requests awaiting a decision and who is on leave on a date.', [
                'date' => ['type' => 'string', 'description' => 'YYYY-MM-DD, default today'],
            ], fn (array $a) => $this->leaveOverview($a));
        }
        if ($this->erp->allows('erp.approvals.view', 'erp.approvals.act')) {
            $this->add('my_pending_approvals', 'Approval requests waiting for this user to approve or reject.', [], fn () => $this->myApprovals());
        }
    }

    private function add(string $name, string $description, array $properties, callable $run): void
    {
        $this->tools[$name] = [
            'description' => $description,
            'parameters' => $properties ? ['type' => 'object', 'properties' => $properties] : [],
            'run' => $run,
        ];
    }

    private function can(string ...$permissions): bool
    {
        return array_intersect($permissions, $this->workspacePermissions) !== [];
    }

    private function date(?string $value, ?Carbon $default = null): string
    {
        try {
            return $value ? Carbon::parse($value)->toDateString() : ($default ?? now())->toDateString();
        } catch (\Throwable) {
            return ($default ?? now())->toDateString();
        }
    }

    private function like(string $value): string
    {
        return '%' . addcslashes($value, '%_\\') . '%';
    }

    // ── Workspace ───────────────────────────────────────────────────────────

    private function workspaceTasks()
    {
        return Task::whereHas('project', fn ($q) => $q->where('workspace_id', $this->user->current_workspace_id));
    }

    private function workspaceOverview(): array
    {
        $ws = $this->user->current_workspace_id;
        $overdue = $this->workspaceTasks()->where('progress', '<', 100)->whereNotNull('end_date')->whereDate('end_date', '<', now())
            ->with(['project:id,title', 'assignedTo:id,name'])->orderBy('end_date')->limit(10)->get();

        return [
            'workspace' => $this->user->currentWorkspace?->name,
            'projects_by_status' => Project::where('workspace_id', $ws)->selectRaw('status, COUNT(*) as n')->groupBy('status')->pluck('n', 'status'),
            'tasks_total' => $this->workspaceTasks()->count(),
            'tasks_completed' => $this->workspaceTasks()->where('progress', 100)->count(),
            'tasks_unassigned' => $this->workspaceTasks()->whereNull('assigned_to')->where('progress', '<', 100)->count(),
            'tasks_assigned_to_me_open' => $this->workspaceTasks()->where('assigned_to', $this->user->id)->where('progress', '<', 100)->count(),
            'overdue_tasks' => $overdue->map(fn ($t) => [
                'title' => $t->title, 'project' => $t->project?->title, 'assigned_to' => $t->assignedTo?->name,
                'due' => $t->end_date?->toDateString(), 'progress' => $t->progress, 'priority' => $t->priority,
            ]),
            'open_bugs' => Bug::whereHas('project', fn ($q) => $q->where('workspace_id', $ws))
                ->whereHas('bugStatus', fn ($q) => $q->whereNotIn('name', ['Resolved', 'Closed']))->count(),
        ];
    }

    private function listProjects(array $a): array
    {
        return Project::where('workspace_id', $this->user->current_workspace_id)
            ->when($a['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->withCount('tasks')->orderBy('deadline')->limit(self::LIMIT)->get()
            ->map(fn ($p) => [
                'id' => $p->id, 'title' => $p->title, 'status' => $p->status, 'priority' => $p->priority,
                'progress' => $p->progress, 'deadline' => $p->deadline ? Carbon::parse($p->deadline)->toDateString() : null, 'tasks' => $p->tasks_count,
            ])->all();
    }

    private function findTasks(array $a): array
    {
        return $this->workspaceTasks()
            ->when($a['search'] ?? null, fn ($q, $s) => $q->where('title', 'like', $this->like($s)))
            ->when($a['project'] ?? null, fn ($q, $p) => $q->whereHas('project', fn ($p2) => $p2->where('title', 'like', $this->like($p))))
            ->when($a['mine_only'] ?? false, fn ($q) => $q->where('assigned_to', $this->user->id))
            ->when($a['overdue_only'] ?? false, fn ($q) => $q->where('progress', '<', 100)->whereNotNull('end_date')->whereDate('end_date', '<', now()))
            ->with(['project:id,title', 'assignedTo:id,name', 'taskStage:id,name'])
            ->orderBy('end_date')->limit(self::LIMIT)->get()
            ->map(fn ($t) => [
                'id' => $t->id, 'title' => $t->title, 'project' => $t->project?->title, 'stage' => $t->taskStage?->name,
                'assigned_to' => $t->assignedTo?->name, 'priority' => $t->priority, 'progress' => $t->progress,
                'due' => $t->end_date?->toDateString(),
            ])->all();
    }

    private function listBugs(array $a): array
    {
        return Bug::whereHas('project', fn ($q) => $q->where('workspace_id', $this->user->current_workspace_id))
            ->when($a['open_only'] ?? true, fn ($q) => $q->whereHas('bugStatus', fn ($s) => $s->whereNotIn('name', ['Resolved', 'Closed'])))
            ->with(['project:id,title', 'bugStatus:id,name', 'assignedTo:id,name'])
            ->latest()->limit(self::LIMIT)->get()
            ->map(fn ($b) => [
                'id' => $b->id, 'title' => $b->title, 'project' => $b->project?->title, 'status' => $b->bugStatus?->name,
                'severity' => $b->severity, 'priority' => $b->priority, 'assigned_to' => $b->assignedTo?->name,
            ])->all();
    }

    private function myTimesheets(array $a): array
    {
        $sheets = Timesheet::where('workspace_id', $this->user->current_workspace_id)->where('user_id', $this->user->id)
            ->when($a['from'] ?? null, fn ($q, $d) => $q->whereDate('end_date', '>=', $this->date($d)))
            ->when($a['to'] ?? null, fn ($q, $d) => $q->whereDate('start_date', '<=', $this->date($d)))
            ->orderByDesc('start_date')->limit(self::LIMIT)->get();

        return [
            'total_hours' => (float) $sheets->sum('total_hours'),
            'billable_hours' => (float) $sheets->sum('billable_hours'),
            'timesheets' => $sheets->map(fn ($s) => [
                'from' => $s->start_date?->toDateString(), 'to' => $s->end_date?->toDateString(),
                'hours' => (float) $s->total_hours, 'billable' => (float) $s->billable_hours, 'status' => $s->status,
            ])->all(),
        ];
    }

    // ── ERP ─────────────────────────────────────────────────────────────────

    private function money($value): float
    {
        return round((float) $value, 2);
    }

    private function openInvoices()
    {
        return Invoice::query()->whereNotIn('status', self::CLOSED_INVOICE)->where('balance_due', '>', 0);
    }

    private function companyOverview(): array
    {
        $company = $this->erp->company();
        $out = ['company' => $company->name, 'currency' => $company->default_currency, 'today' => now()->toDateString()];

        if ($this->erp->allows('erp.invoicing.view', 'erp.accounting.view')) {
            $out['receivables_outstanding'] = $this->money($this->openInvoices()->sum('balance_due'));
            $out['invoices_overdue'] = $this->openInvoices()->whereDate('due_date', '<', now())->count();
            $out['invoices_overdue_amount'] = $this->money($this->openInvoices()->whereDate('due_date', '<', now())->sum('balance_due'));
        }
        if ($this->erp->allows('erp.purchase.view', 'erp.accounting.view')) {
            $out['vendor_bills_unpaid_amount'] = $this->money(PurchaseBill::where('amount_residual', '>', 0)->whereNotIn('status', ['draft', 'cancelled'])->sum('amount_residual'));
        }
        if ($this->erp->allows('erp.purchase.view')) {
            $out['purchase_orders_by_status'] = PurchaseOrder::selectRaw('status, COUNT(*) as n')->groupBy('status')->pluck('n', 'status');
        }
        if ($this->erp->allows('erp.requisitions.view', 'erp.requisitions.manage')) {
            $out['requisitions_by_status'] = Requisition::selectRaw('status, COUNT(*) as n')->groupBy('status')->pluck('n', 'status');
        }
        if ($this->erp->allows('erp.sales.view')) {
            $out['open_opportunities_value'] = $this->money(Opportunity::whereNotIn('status', ['won', 'lost'])->sum('expected_value'));
        }
        if ($this->erp->allows('erp.hrm.employee.view')) {
            $out['active_employees'] = Employee::where('status', 'active')->count();
        }

        return $out;
    }

    private function findInvoices(array $a): array
    {
        $query = Invoice::query()->with('customer:id,name')
            ->when($a['customer'] ?? null, fn ($q, $c) => $q->whereHas('customer', fn ($c2) => $c2->where('name', 'like', $this->like($c))))
            ->when($a['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->when($a['overdue_only'] ?? false, fn ($q) => $q->whereNotIn('status', self::CLOSED_INVOICE)->where('balance_due', '>', 0)->whereDate('due_date', '<', now()))
            ->when($a['from'] ?? null, fn ($q, $d) => $q->whereDate('invoice_date', '>=', $this->date($d)))
            ->when($a['to'] ?? null, fn ($q, $d) => $q->whereDate('invoice_date', '<=', $this->date($d)));

        return [
            'count' => (clone $query)->count(),
            'total_amount' => $this->money((clone $query)->sum('total_amount')),
            'total_balance_due' => $this->money((clone $query)->sum('balance_due')),
            'invoices' => $query->orderByDesc('invoice_date')->limit(self::LIMIT)->get()->map(fn ($i) => [
                'number' => $i->document_number, 'customer' => $i->customer?->name, 'status' => $i->status,
                'date' => optional($i->invoice_date)->toDateString(), 'due' => optional($i->due_date)->toDateString(),
                'currency' => $i->currency_code, 'total' => $this->money($i->total_amount), 'balance_due' => $this->money($i->balance_due),
            ])->all(),
        ];
    }

    private function findCustomers(array $a): array
    {
        $owing = $this->openInvoices()->selectRaw('customer_id, SUM(balance_due) as owing')->groupBy('customer_id')->pluck('owing', 'customer_id');

        $customers = Customer::query()
            ->when($a['search'] ?? null, fn ($q, $s) => $q->where(fn ($w) => $w->where('name', 'like', $this->like($s))->orWhere('code', 'like', $this->like($s))))
            ->when(! ($a['search'] ?? null), fn ($q) => $q->whereIn('id', $owing->sortDesc()->keys()->take(self::LIMIT)))
            ->limit(self::LIMIT)->get();

        return $customers->map(fn ($c) => [
            'code' => $c->code, 'name' => $c->name, 'currency' => $c->currency_code, 'active' => (bool) $c->is_active,
            'credit_limit' => $c->credit_limit !== null ? $this->money($c->credit_limit) : null,
            'owes' => $this->money($owing[$c->id] ?? 0),
        ])->sortByDesc('owes')->values()->all();
    }

    private function bankBalances(): array
    {
        return BankAccount::query()->where('company_id', $this->erp->company()->id)->where('status', '!=', 'closed')
            ->with('bank:id,name')->withCount(['transactions as unreconciled_lines' => fn ($q) => $q->whereNull('reconciled_at')])
            ->orderBy('account_name')->get()
            ->map(fn ($acc) => [
                'account' => $acc->account_name, 'bank' => $acc->bank?->name, 'number' => $acc->account_number,
                'currency' => $acc->currency, 'balance' => Money::format($acc->balanceCents()),
                'unreconciled_lines' => $acc->unreconciled_lines,
            ])->all();
    }

    private function stockOnHand(array $a): array
    {
        $balances = collect(app(InventoryStockService::class)->balances($this->erp->company()))
            ->groupBy('product_id')->map(fn ($rows) => $rows->sum(fn ($r) => (float) $r->quantity));

        $products = InventoryProduct::query()
            ->when($a['search'] ?? null, fn ($q, $s) => $q->where(fn ($w) => $w->where('name', 'like', $this->like($s))->orWhere('sku', 'like', $this->like($s))))
            ->where('is_active', true)->orderBy('name')->limit(self::LIMIT)->get();

        return $products->map(fn ($p) => [
            'sku' => $p->sku, 'name' => $p->name, 'type' => $p->type,
            'on_hand' => $balances[$p->id] ?? 0, 'cost_price' => $this->money($p->cost_price), 'sale_price' => $this->money($p->sale_price),
        ])->all();
    }

    private function findPurchases(array $a): array
    {
        if (($a['kind'] ?? 'orders') === 'bills') {
            return PurchaseBill::query()->with('vendor:id,name')
                ->when($a['vendor'] ?? null, fn ($q, $v) => $q->whereHas('vendor', fn ($v2) => $v2->where('name', 'like', $this->like($v))))
                ->when($a['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
                ->when($a['unpaid_only'] ?? false, fn ($q) => $q->where('amount_residual', '>', 0)->whereNotIn('status', ['draft', 'cancelled']))
                ->orderByDesc('bill_date')->limit(self::LIMIT)->get()
                ->map(fn ($b) => [
                    'number' => $b->document_number, 'vendor' => $b->vendor?->name, 'status' => $b->status,
                    'date' => optional($b->bill_date)->toDateString(), 'due' => optional($b->due_date)->toDateString(),
                    'currency' => $b->currency_code, 'total' => $this->money($b->total_amount), 'still_owing' => $this->money($b->amount_residual),
                ])->all();
        }

        return PurchaseOrder::query()->with('vendor:id,name')
            ->when($a['vendor'] ?? null, fn ($q, $v) => $q->whereHas('vendor', fn ($v2) => $v2->where('name', 'like', $this->like($v))))
            ->when($a['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->latest()->limit(self::LIMIT)->get()
            ->map(fn ($o) => [
                'number' => $o->document_number, 'vendor' => $o->vendor?->name, 'status' => $o->status,
                'expected_delivery' => optional($o->expected_delivery_date)->toDateString(),
                'currency' => $o->currency_code, 'total' => $this->money($o->total),
            ])->all();
    }

    private function findRequisitions(array $a): array
    {
        return Requisition::query()->with('requester:id,name')
            ->when($a['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->when($a['mine_only'] ?? false, fn ($q) => $q->where('requested_by', $this->user->id))
            ->latest()->limit(self::LIMIT)->get()
            ->map(fn ($r) => [
                'number' => $r->document_number, 'type' => $r->requisition_type, 'status' => $r->status,
                'requested_by' => $r->requester?->name, 'department' => $r->department, 'priority' => $r->priority,
                'required_by' => optional($r->required_by)->toDateString(), 'currency' => $r->currency_code,
                'estimated_total' => $this->money($r->estimated_total),
            ])->all();
    }

    private function salesPipeline(): array
    {
        $byStatus = fn ($model, string $value) => $model::selectRaw("status, COUNT(*) as n, COALESCE(SUM({$value}), 0) as value")
            ->groupBy('status')->get()->mapWithKeys(fn ($r) => [$r->status => ['count' => (int) $r->n, 'value' => $this->money($r->value)]]);

        return [
            'leads_by_status' => Lead::selectRaw('status, COUNT(*) as n')->groupBy('status')->pluck('n', 'status'),
            'opportunities' => $byStatus(Opportunity::class, 'expected_value'),
            'quotations' => $byStatus(Quotation::class, 'total'),
            'sales_orders' => $byStatus(SalesOrder::class, 'total'),
        ];
    }

    private function findSalesDocuments(array $a): array
    {
        $model = ($a['kind'] ?? 'quotations') === 'orders' ? SalesOrder::class : Quotation::class;

        return $model::query()->with('customer:id,name')
            ->when($a['customer'] ?? null, fn ($q, $c) => $q->whereHas('customer', fn ($c2) => $c2->where('name', 'like', $this->like($c))))
            ->when($a['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->latest()->limit(self::LIMIT)->get()
            ->map(fn ($d) => [
                'number' => $d->document_number, 'customer' => $d->customer?->name, 'status' => $d->status,
                'date' => $d->created_at?->toDateString(), 'currency' => $d->currency_code, 'total' => $this->money($d->total),
            ])->all();
    }

    private function hrOverview(): array
    {
        return [
            'employees_by_status' => Employee::selectRaw('status, COUNT(*) as n')->groupBy('status')->pluck('n', 'status'),
            'active_by_department' => Employee::where('status', 'active')->with('department:id,name')->get()
                ->groupBy(fn ($e) => $e->department?->name ?? 'No department')->map->count(),
            'recent_hires' => Employee::whereNotNull('hire_date')->orderByDesc('hire_date')->limit(5)->get()
                ->map(fn ($e) => ['name' => $e->full_name, 'hired' => optional($e->hire_date)->toDateString()]),
        ];
    }

    private function findEmployees(array $a): array
    {
        return Employee::query()->with(['department:id,name', 'position:id,name'])
            ->when($a['search'] ?? null, fn ($q, $s) => $q->where(fn ($w) => $w->where('first_name', 'like', $this->like($s))
                ->orWhere('last_name', 'like', $this->like($s))->orWhere('employee_number', 'like', $this->like($s))))
            ->when($a['department'] ?? null, fn ($q, $d) => $q->whereHas('department', fn ($d2) => $d2->where('name', 'like', $this->like($d))))
            ->orderBy('first_name')->limit(self::LIMIT)->get()
            ->map(fn ($e) => [
                'number' => $e->employee_number, 'name' => $e->full_name, 'department' => $e->department?->name,
                'position' => $e->position?->name, 'status' => $e->status, 'hired' => optional($e->hire_date)->toDateString(),
            ])->all();
    }

    private function leaveOverview(array $a): array
    {
        $date = $this->date($a['date'] ?? null);
        $row = fn ($l) => [
            'employee' => $l->employee?->full_name, 'type' => $l->leaveType?->name,
            'from' => optional($l->start_date)->toDateString(), 'to' => optional($l->end_date)->toDateString(),
            'days' => (float) $l->total_days, 'status' => $l->status,
        ];

        return [
            'awaiting_decision' => LeaveRequest::whereIn('status', ['submitted', 'in_approval'])->with(['employee', 'leaveType:id,name'])
                ->orderBy('start_date')->limit(self::LIMIT)->get()->map($row),
            "on_leave_{$date}" => LeaveRequest::where('status', 'approved')->whereDate('start_date', '<=', $date)->whereDate('end_date', '>=', $date)
                ->with(['employee', 'leaveType:id,name'])->limit(self::LIMIT)->get()->map($row),
        ];
    }

    private function myApprovals(): array
    {
        $service = app(ApprovalWorkflowService::class);

        return ApprovalRequest::where('status', ApprovalStatus::Pending)->with(['requester:id,name', 'workflow'])
            ->latest('submitted_at')->limit(100)->get()
            ->filter(fn ($r) => $service->canAct($r, $this->user))->take(self::LIMIT)
            ->map(fn ($r) => [
                'what' => class_basename($r->approvable_type) . ' #' . $r->approvable_id,
                'workflow' => $r->workflow?->name, 'requested_by' => $r->requester?->name,
                'amount' => $r->amount !== null ? $this->money($r->amount) : null, 'currency' => $r->currency_code,
                'submitted' => $r->submitted_at ? Carbon::parse($r->submitted_at)->toDateString() : null,
            ])->values()->all();
    }
}
