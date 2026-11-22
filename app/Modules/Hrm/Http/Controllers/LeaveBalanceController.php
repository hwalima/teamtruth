<?php

namespace App\Modules\Hrm\Http\Controllers;

use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Models\LeaveBalance;
use App\Modules\Hrm\Models\LeaveType;
use App\Modules\Hrm\Services\LeaveService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class LeaveBalanceController extends HrmController
{
    public function __construct(
        private LeaveService $leaveService,
    ) {}

    public function index(Request $request): Response
    {
        $filters = $request->only(['search', 'leave_type_id', 'year']);
        $year = (int) ($filters['year'] ?? now()->year);
        $canManage = $this->allowsErpPermission('erp.hrm.leave.manage');
        $ownEmployee = Employee::query()->where('user_id', $request->user()->id)->first();

        $balances = LeaveBalance::query()
            ->with(['employee:id,employee_number,first_name,middle_name,last_name', 'leaveType:id,name,code,color'])
            ->whereYear('period_start', $year)
            ->when(! $this->allowsErpPermission('erp.hrm.leave.approve') && ! $canManage, fn ($q) => $q->where('employee_id', $ownEmployee?->id ?? 0))
            ->when($filters['leave_type_id'] ?? null, fn ($q, $id) => $q->where('leave_type_id', $id))
            ->when($filters['search'] ?? null, fn ($q, $search) => $q->whereHas('employee', fn ($e) => $e
                ->where('first_name', 'like', "%{$search}%")
                ->orWhere('last_name', 'like', "%{$search}%")
                ->orWhere('employee_number', 'like', "%{$search}%")))
            ->orderBy('employee_id')
            ->paginate(50)
            ->withQueryString();

        return Inertia::render('Erp/Hrm/Leave/Balances/Index', [
            'company' => $this->company(),
            'balances' => $balances,
            'filters' => [...$filters, 'year' => $year],
            'leaveTypes' => LeaveType::query()->orderBy('name')->get(['id', 'name', 'code']),
            'employees' => $canManage
                ? Employee::query()->where('status', '!=', 'terminated')->orderBy('last_name')->get(['id', 'employee_number', 'first_name', 'middle_name', 'last_name'])
                : [],
            'canManage' => $canManage,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $companyId = $this->company()->id;
        $data = $request->validate([
            'employee_id' => ['required', 'integer', Rule::exists('hrm_employees', 'id')->where('company_id', $companyId)],
            'leave_type_id' => ['required', 'integer', Rule::exists('hrm_leave_types', 'id')->where('company_id', $companyId)],
            'period_start' => 'required|date',
            'period_end' => 'required|date|after:period_start',
            'brought_forward' => 'nullable|numeric|min:0|max:366',
            'accrued' => 'nullable|numeric|min:0|max:366',
        ]);

        $overlaps = LeaveBalance::query()
            ->where('employee_id', $data['employee_id'])
            ->where('leave_type_id', $data['leave_type_id'])
            ->whereDate('period_start', '<=', $data['period_end'])
            ->whereDate('period_end', '>=', $data['period_start'])
            ->exists();

        if ($overlaps) {
            throw ValidationException::withMessages(['period_start' => 'This employee already has a balance for this leave type in that period.']);
        }

        LeaveBalance::query()->create([
            ...$data,
            'brought_forward' => $data['brought_forward'] ?? 0,
            'accrued' => $data['accrued'] ?? 0,
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
        ]);

        return back()->with('success', 'Leave balance created.');
    }

    public function update(Request $request, LeaveBalance $balance): RedirectResponse
    {
        $data = $request->validate([
            'brought_forward' => 'required|numeric|min:0|max:366',
            'accrued' => 'required|numeric|min:0|max:366',
            'carried_over' => 'nullable|numeric|min:0|max:366',
        ]);

        $balance->update([...$data, 'carried_over' => $data['carried_over'] ?? $balance->carried_over, 'updated_by' => $request->user()->id]);

        return back()->with('success', 'Leave balance updated.');
    }

    public function adjust(Request $request, LeaveBalance $balance): RedirectResponse
    {
        $data = $request->validate([
            'days' => 'required|numeric|between:-366,366|not_in:0',
            'reason' => 'required|string|max:500',
        ]);

        $this->leaveService->adjustBalance($request->user(), $balance, (float) $data['days'], $data['reason']);

        return back()->with('success', 'Leave balance adjusted.');
    }
}
