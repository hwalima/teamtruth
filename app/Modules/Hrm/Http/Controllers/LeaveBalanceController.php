<?php

namespace App\Modules\Hrm\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Models\LeaveBalance;
use App\Modules\Hrm\Models\LeaveType;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LeaveBalanceController extends Controller
{
    public function index(Request $request): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        $query = LeaveBalance::where('company_id', $company->id)
            ->with(['employee.user', 'leaveType'])
            ->withSum('ledgerEntries as used_sum', 'days')
            ->withSum('ledgerEntries as pending_sum', 'days');

        if ($request->filled('search')) {
            $search = $request->search;
            $query->whereHas('employee', fn ($q) => $q->where('first_name', 'like', "%{$search}%")
                ->orWhere('last_name', 'like', "%{$search}%")
                ->orWhere('employee_number', 'like', "%{$search}%"));
        }

        if ($request->filled('leave_type_id')) {
            $query->where('leave_type_id', $request->leave_type_id);
        }

        if ($request->filled('period_start')) {
            $query->where('period_start', $request->period_start);
        }

        if ($request->filled('period_end')) {
            $query->where('period_end', $request->period_end);
        }

        $balances = $query->orderBy('period_start', 'desc')
            ->orderBy('period_end', 'desc')
            ->paginate(20)->withQueryString();

        $employees = Employee::where('company_id', $company->id)
            ->where('employment_status', 'active')
            ->with('user')
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get(['id', 'employee_number', 'first_name', 'last_name', 'user_id']);

        $leaveTypes = LeaveType::where('company_id', $company->id)
            ->where('is_active', true)
            ->where('tracks_balance', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'default_entitlement']);

        // Get distinct periods
        $periods = LeaveBalance::where('company_id', $company->id)
            ->select('period_start', 'period_end')
            ->distinct()
            ->orderBy('period_start', 'desc')
            ->get();

        return Inertia::render('Erp/Hrm/Leave/Balances/Index', [
            'company' => $company,
            'balances' => $balances,
            'employees' => $employees,
            'leaveTypes' => $leaveTypes,
            'periods' => $periods,
            'filters' => $request->only(['search', 'leave_type_id', 'period_start', 'period_end']),
        ]);
    }

    public function store(Request $request)
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        $validated = $request->validate([
            'employee_id' => 'required|exists:hrm_employees,id',
            'leave_type_id' => 'required|exists:hrm_leave_types,id',
            'period_start' => 'required|date',
            'period_end' => 'required|date|after_or_equal:period_start',
            'entitled_days' => 'nullable|numeric|min:0|max:365',
            'carried_forward' => 'nullable|numeric|min:0|max:365',
            'accrued_days' => 'nullable|numeric|min:0|max:365',
        ]);

        // Check if balance already exists
        $existing = LeaveBalance::where('company_id', $company->id)
            ->where('employee_id', $validated['employee_id'])
            ->where('leave_type_id', $validated['leave_type_id'])
            ->where('period_start', $validated['period_start'])
            ->where('period_end', $validated['period_end'])
            ->first();

        if ($existing) {
            return back()->withErrors(['leave_type_id' => 'Leave balance already exists for this period.']);
        }

        $leaveType = LeaveType::findOrFail($validated['leave_type_id']);

        LeaveBalance::create([
            'company_id' => $company->id,
            'employee_id' => $validated['employee_id'],
            'leave_type_id' => $validated['leave_type_id'],
            'period_start' => $validated['period_start'],
            'period_end' => $validated['period_end'],
            'entitled_days' => $validated['entitled_days'] ?? $leaveType->default_entitlement ?? 0,
            'carried_forward' => $validated['carried_forward'] ?? 0,
            'accrued_days' => $validated['accrued_days'] ?? 0,
            'used_days' => 0,
            'pending_days' => 0,
            'adjusted_days' => 0,
            'is_frozen' => false,
        ]);

        return redirect()->route('erp.hrm.leave.balances.index')
            ->with('success', 'Leave balance created successfully.');
    }

    public function update(Request $request, LeaveBalance $balance)
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        if ((int) $balance->company_id !== (int) $company->id) {
            abort(403);
        }

        $validated = $request->validate([
            'entitled_days' => 'nullable|numeric|min:0|max:365',
            'carried_forward' => 'nullable|numeric|min:0|max:365',
            'accrued_days' => 'nullable|numeric|min:0|max:365',
            'is_frozen' => 'nullable|boolean',
        ]);

        $balance->update($validated);

        return back()->with('success', 'Leave balance updated successfully.');
    }

    public function adjust(Request $request, LeaveBalance $balance)
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        if ((int) $balance->company_id !== (int) $company->id) {
            abort(403);
        }

        $validated = $request->validate([
            'adjustment' => 'required|numeric',
            'reason' => 'required|string|max:500',
        ]);

        try {
            app(\App\Modules\Hrm\Services\LeaveService::class)->adjustLeaveBalance(
                $request->user(),
                $balance,
                $validated['adjustment'],
                $validated['reason']
            );

            return back()->with('success', 'Leave balance adjusted successfully.');
        } catch (\Illuminate\Validation\ValidationException $e) {
            return back()->withErrors($e->errors());
        }
    }
}