<?php

namespace App\Modules\Hrm\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Hrm\Models\LeaveType;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LeaveTypeController extends Controller
{
    public function index(Request $request): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        $leaveTypes = LeaveType::where('company_id', $company->id)
            ->orderBy('name')
            ->paginate(20);

        return Inertia::render('Erp/Hrm/Leave/Types/Index', [
            'company' => $company,
            'leaveTypes' => $leaveTypes,
            'categoryOptions' => \App\Modules\Hrm\Enums\LeaveTypeCategory::options(),
        ]);
    }

    public function store(Request $request)
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'code' => 'required|string|max:10|unique:hrm_leave_types,code,NULL,id,company_id,' . $company->id,
            'category' => 'required|in:' . implode(',', array_column(\App\Modules\Hrm\Enums\LeaveTypeCategory::cases(), 'value')),
            'description' => 'nullable|string',
            'color' => 'nullable|string|max:7',
            'icon' => 'nullable|string|max:50',
            'default_entitlement' => 'nullable|numeric|min:0|max:365',
            'accrual_frequency' => 'required|in:annually,monthly,weekly,daily,none',
            'accrual_rate' => 'nullable|numeric|min:0',
            'max_accrual' => 'nullable|numeric|min:0|max:365',
            'min_service_months' => 'nullable|integer|min:0',
            'gender_restriction' => 'nullable|in:' . implode(',', array_column(\App\Modules\Hrm\Enums\Gender::cases(), 'value')),
            'employment_types' => 'nullable|array',
            'requires_approval' => 'nullable|boolean',
            'requires_attachment' => 'nullable|boolean',
            'allows_past_dates' => 'nullable|boolean',
            'requires_future_date' => 'nullable|boolean',
            'min_duration_days' => 'nullable|numeric|min:0.5',
            'max_duration_days' => 'nullable|numeric|min:0.5',
            'max_consecutive_days' => 'nullable|numeric|min:1',
            'allows_carry_forward' => 'nullable|boolean',
            'max_carry_forward' => 'nullable|numeric|min:0|max:365',
            'carry_forward_expiry_months' => 'nullable|integer|min:1',
            'is_active' => 'nullable|boolean',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        LeaveType::create(array_merge($validated, [
            'company_id' => $company->id,
        ]));

        return redirect()->route('erp.hrm.leave.types.index')
            ->with('success', 'Leave type created successfully.');
    }

    public function update(Request $request, LeaveType $leaveType)
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        if ((int) $leaveType->company_id !== (int) $company->id) {
            abort(403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:100',
            'code' => 'sometimes|required|string|max:10|unique:hrm_leave_types,code,' . $leaveType->id . ',id,company_id,' . $company->id,
            'category' => 'sometimes|required|in:' . implode(',', array_column(\App\Modules\Hrm\Enums\LeaveTypeCategory::cases(), 'value')),
            'description' => 'nullable|string',
            'color' => 'nullable|string|max:7',
            'icon' => 'nullable|string|max:50',
            'default_entitlement' => 'nullable|numeric|min:0|max:365',
            'accrual_frequency' => 'sometimes|required|in:annually,monthly,weekly,daily,none',
            'accrual_rate' => 'nullable|numeric|min:0',
            'max_accrual' => 'nullable|numeric|min:0|max:365',
            'min_service_months' => 'nullable|integer|min:0',
            'gender_restriction' => 'nullable|in:' . implode(',', array_column(\App\Modules\Hrm\Enums\Gender::cases(), 'value')),
            'employment_types' => 'nullable|array',
            'requires_approval' => 'nullable|boolean',
            'requires_attachment' => 'nullable|boolean',
            'allows_past_dates' => 'nullable|boolean',
            'requires_future_date' => 'nullable|boolean',
            'min_duration_days' => 'nullable|numeric|min:0.5',
            'max_duration_days' => 'nullable|numeric|min:0.5',
            'max_consecutive_days' => 'nullable|numeric|min:1',
            'allows_carry_forward' => 'nullable|boolean',
            'max_carry_forward' => 'nullable|numeric|min:0|max:365',
            'carry_forward_expiry_months' => 'nullable|integer|min:1',
            'is_active' => 'nullable|boolean',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        $leaveType->update($validated);

        return back()->with('success', 'Leave type updated successfully.');
    }

    public function destroy(LeaveType $leaveType)
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        if ((int) $leaveType->company_id !== (int) $company->id) {
            abort(403);
        }

        // Check if leave type has requests
        if ($leaveType->leaveRequests()->exists()) {
            return back()->withErrors(['leaveType' => 'Cannot delete leave type with existing leave requests.']);
        }

        $leaveType->delete();

        return redirect()->route('erp.hrm.leave.types.index')
            ->with('success', 'Leave type deleted successfully.');
    }
}