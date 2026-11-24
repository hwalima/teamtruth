<?php

namespace App\Modules\Core\Services;

use App\Models\User;
use App\Modules\Banking\Models\BankAccount;
use App\Modules\Banking\Models\BankTransaction;
use App\Modules\Core\Models\ApprovalRequest;
use App\Modules\Core\Models\Company;
use App\Modules\Hrm\Enums\ContractStatus;
use App\Modules\Hrm\Enums\EmployeeStatus;
use App\Modules\Hrm\Enums\LeaveRequestStatus;
use App\Modules\Hrm\Models\Contract;
use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Models\LeaveBalance;
use App\Modules\Hrm\Models\LeaveRequest;
use App\Modules\Invoicing\Enums\InvoiceStatus;
use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Purchase\Models\PurchaseBill;
use App\Modules\Purchase\Models\PurchaseOrder;
use App\Modules\Purchase\Models\PurchaseRFQ;
use App\Modules\Requisitions\Enums\RequisitionStatus;
use App\Modules\Requisitions\Models\Requisition;
use Closure;

/**
 * The ERP home page: what needs this person today (approvals, their own
 * requisitions and leave), then a few figures for the work their role covers.
 * Every figure is only worked out when the role can open the page behind it.
 */
class ErpHomeService
{
    private const LIST_SIZE = 5;

    /**
     * @param  Closure(string): bool  $allows
     * @return array<string, mixed>
     */
    public function myWork(Company $company, User $user, Closure $allows): array
    {
        return [
            'approvals' => $allows('erp.approvals.act') ? $this->approvals($company, $user) : null,
            'requisitions' => $allows('erp.requisitions.view') ? $this->requisitions($company, $user) : null,
            'leave' => $this->leave($company, $user, $allows),
        ];
    }

    /**
     * Figures for the work the person's role covers, each linking to the page
     * where it is dealt with.
     *
     * @param  Closure(string): bool  $allows
     * @return list<array{key: string, group: string, label: string, value: string, hint: string|null, href: string, attention: bool}>
     */
    public function tiles(Company $company, Closure $allows): array
    {
        $today = now()->toDateString();
        $tiles = [];

        if ($allows('erp.hrm.employee.view')) {
            $count = Employee::query()->where('company_id', $company->id)
                ->whereNotIn('status', [EmployeeStatus::Terminated->value, EmployeeStatus::Inactive->value])->count();
            $tiles[] = $this->tile('employees', 'People', 'Employees', (string) $count, null, route('erp.hrm.employees.index'));
        }
        if ($allows('erp.hrm.leave.approve')) {
            $count = LeaveRequest::query()->where('company_id', $company->id)
                ->whereIn('status', [LeaveRequestStatus::Submitted->value, LeaveRequestStatus::InApproval->value])->count();
            $tiles[] = $this->tile('leave-to-approve', 'People', 'Leave requests waiting', (string) $count, null, route('erp.hrm.leave.requests.index'), $count > 0);
        }
        if ($allows('erp.hrm.contract.view')) {
            $count = Contract::query()->where('company_id', $company->id)
                ->where('status', ContractStatus::Active->value)
                ->whereNotNull('end_date')
                ->whereBetween('end_date', [$today, now()->addDays(30)->toDateString()])
                ->count();
            $tiles[] = $this->tile('contracts-ending', 'People', 'Contracts ending in 30 days', (string) $count, null, route('erp.hrm.contracts.index'), $count > 0);
        }

        if ($allows('erp.requisitions.manage')) {
            $count = Requisition::query()->where('company_id', $company->id)
                ->where('status', RequisitionStatus::Approved->value)->count();
            $tiles[] = $this->tile('requisitions-to-fulfil', 'Buying & stock', 'Approved requisitions to fulfil', (string) $count, 'Waiting to be bought or issued', route('erp.requisitions.index'), $count > 0);
        }
        if ($allows('erp.purchase.view')) {
            $open = PurchaseRFQ::query()->where('company_id', $company->id)->where('status', 'open')->count();
            $tiles[] = $this->tile('rfqs-open', 'Buying & stock', 'Open requests for quotation', (string) $open, null, route('erp.purchase.index').'#rfqs');

            $orders = PurchaseOrder::query()->where('company_id', $company->id)
                ->whereIn('status', ['approved', 'partially_received']);
            $late = (clone $orders)->whereNotNull('expected_delivery_date')->where('expected_delivery_date', '<', $today)->count();
            $tiles[] = $this->tile('orders-to-receive', 'Buying & stock', 'Orders waiting for delivery', (string) $orders->count(), $late > 0 ? "{$late} overdue" : null, route('erp.purchase.index').'#orders', $late > 0);
        }

        if ($allows('erp.purchase.bills')) {
            $unpaid = PurchaseBill::query()->where('company_id', $company->id)
                ->where('status', 'posted')->where('amount_residual', '>', 0);
            $dueSoon = (clone $unpaid)->whereNotNull('due_date')->where('due_date', '<=', now()->addDays(7)->toDateString())->count();
            $tiles[] = $this->tile('bills-due', 'Money', 'Vendor bills due within 7 days', (string) $dueSoon, $unpaid->count().' unpaid in total', route('erp.purchase.index').'#bills', $dueSoon > 0);
        }
        if ($allows('erp.invoicing.view')) {
            $overdue = Invoice::query()->where('company_id', $company->id)
                ->whereIn('status', [InvoiceStatus::Sent->value, InvoiceStatus::Overdue->value, InvoiceStatus::PartialPaid->value])
                ->where('balance_due', '>', 0)
                ->whereNotNull('due_date')->where('due_date', '<', $today)
                ->count();
            $tiles[] = $this->tile('invoices-overdue', 'Money', 'Customer invoices overdue', (string) $overdue, null, route('erp.invoicing.index'), $overdue > 0);
        }
        if ($allows('erp.banking.view')) {
            $accounts = BankAccount::query()->where('company_id', $company->id)->where('status', 'active')->get();
            $balances = $accounts->groupBy('currency')
                ->map(fn ($group, $currency): string => $currency.' '.number_format($group->sum(fn (BankAccount $account): int => $account->balanceCents()) / 100, 2))
                ->values()->all();
            $tiles[] = $this->tile('cash', 'Money', 'Cash in the bank', $balances === [] ? '—' : implode(' · ', $balances), $accounts->count().' active account'.($accounts->count() === 1 ? '' : 's'), route('erp.banking.dashboard'));

            $unmatched = BankTransaction::query()->whereIn('account_id', $accounts->pluck('id'))->whereNull('reconciled_at')->count();
            $tiles[] = $this->tile('bank-lines', 'Money', 'Bank lines to match', (string) $unmatched, null, route('erp.banking.index'), $unmatched > 0);
        }

        return $tiles;
    }

    /** @return array{count: int, items: list<array<string, mixed>>, href: string} */
    private function approvals(Company $company, User $user): array
    {
        $pending = app(ApprovalWorkflowService::class)->pendingFor($company, $user);
        $pending->loadMissing('approvable');

        return [
            'count' => $pending->count(),
            'items' => $pending->take(self::LIST_SIZE)->map(fn (ApprovalRequest $approval): array => [
                'id' => $approval->id,
                'type' => $this->documentType((string) $approval->approvable_type),
                'reference' => $approval->approvable?->getAttribute('document_number') ?? '#'.$approval->approvable_id,
                'requester' => $approval->requester?->name,
                'amount' => $approval->amount !== null ? (string) $approval->amount : null,
                'currency' => $approval->currency_code,
                'submitted_at' => $approval->submitted_at?->toDateString(),
                'href' => route('erp.approvals.show', $approval),
            ])->values()->all(),
            'href' => route('erp.approvals.index'),
        ];
    }

    /** @return array{open: int, items: list<array<string, mixed>>, href: string, create: string} */
    private function requisitions(Company $company, User $user): array
    {
        $open = Requisition::query()->where('company_id', $company->id)->where('requested_by', $user->id)
            ->whereNotIn('status', [RequisitionStatus::Closed->value, RequisitionStatus::Cancelled->value, RequisitionStatus::Rejected->value]);

        return [
            'open' => (clone $open)->count(),
            'items' => $open->latest('id')->limit(self::LIST_SIZE)->get()->map(fn (Requisition $requisition): array => [
                'id' => $requisition->id,
                'reference' => $requisition->document_number,
                'status' => $requisition->status instanceof RequisitionStatus ? $requisition->status->value : (string) $requisition->status,
                'amount' => $requisition->estimated_total !== null ? (string) $requisition->estimated_total : null,
                'currency' => $requisition->currency_code,
                'href' => route('erp.requisitions.show', $requisition),
            ])->values()->all(),
            'href' => route('erp.requisitions.index'),
            'create' => route('erp.requisitions.create'),
        ];
    }

    /**
     * The person's own leave, when they have an employee record here.
     *
     * @param  Closure(string): bool  $allows
     * @return array<string, mixed>|null
     */
    private function leave(Company $company, User $user, Closure $allows): ?array
    {
        if (! $allows('erp.hrm.self_service.view')) {
            return null;
        }
        $employee = Employee::query()->where('company_id', $company->id)->where('user_id', $user->id)->first();
        if (! $employee) {
            return null;
        }

        $today = now()->toDateString();
        $balances = LeaveBalance::query()->with('leaveType:id,name')
            ->where('company_id', $company->id)->where('employee_id', $employee->id)
            ->where('period_start', '<=', $today)->where('period_end', '>=', $today)
            ->get()
            ->map(fn (LeaveBalance $balance): array => ['type' => $balance->leaveType?->name ?? 'Leave', 'available' => $balance->available])
            ->values()->all();

        return [
            'balances' => $balances,
            'pending' => LeaveRequest::query()->where('company_id', $company->id)->where('employee_id', $employee->id)
                ->whereIn('status', [LeaveRequestStatus::Submitted->value, LeaveRequestStatus::InApproval->value])->count(),
            'href' => route('erp.hrm.self-service.index'),
        ];
    }

    /** @return array{key: string, group: string, label: string, value: string, hint: string|null, href: string, attention: bool} */
    private function tile(string $key, string $group, string $label, string $value, ?string $hint, string $href, bool $attention = false): array
    {
        return compact('key', 'group', 'label', 'value', 'hint', 'href', 'attention');
    }

    private function documentType(string $class): string
    {
        // PurchaseOrder -> Purchase Order, PurchaseRFQ -> Purchase RFQ
        return (string) preg_replace('/(?<=[a-z])(?=[A-Z])/', ' ', class_basename($class));
    }
}
