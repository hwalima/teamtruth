<?php

namespace App\Modules\Hrm\Http\Controllers;

use App\Modules\Hrm\Enums\LeaveAccrualType;
use App\Modules\Hrm\Models\LeaveType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class LeaveTypeController extends OrganizationUnitController
{
    protected function model(): string
    {
        return LeaveType::class;
    }

    protected function page(): string
    {
        return 'Erp/Hrm/Leave/Types/Index';
    }

    protected function indexRoute(): string
    {
        return 'erp.hrm.leave.types.index';
    }

    protected function permission(): string
    {
        return 'erp.hrm.leave.manage';
    }

    protected function rules(?Model $record): array
    {
        return [
            'accrual_type' => ['required', Rule::enum(LeaveAccrualType::class)],
            'accrual_rate' => 'required|numeric|min:0|max:366',
            'max_accrual' => 'nullable|numeric|min:0|max:366',
            'carry_over_limit' => 'nullable|numeric|min:0|max:366',
            'carry_over_expiry_months' => 'nullable|integer|min:0|max:120',
            'is_paid' => 'boolean',
            'requires_approval' => 'boolean',
            'requires_document' => 'boolean',
            'color' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
        ];
    }

    protected function options(): array
    {
        return ['accrualTypeOptions' => LeaveAccrualType::options()];
    }

    protected function inUse(Model $record): ?string
    {
        return $record->requests()->exists() ? 'Leave requests use this leave type. Deactivate it instead.' : null;
    }

    public function store(Request $request): RedirectResponse
    {
        return $this->storeRecord($this->withFlags($request));
    }

    public function update(Request $request, LeaveType $leaveType): RedirectResponse
    {
        return $this->updateRecord($this->withFlags($request), $leaveType);
    }

    public function destroy(LeaveType $leaveType): RedirectResponse
    {
        return $this->destroyRecord($leaveType);
    }

    private function withFlags(Request $request): Request
    {
        $request->merge([
            'is_paid' => $request->boolean('is_paid', true),
            'requires_approval' => $request->boolean('requires_approval', true),
            'requires_document' => $request->boolean('requires_document'),
            'accrual_rate' => $request->input('accrual_rate') ?? 0,
        ]);

        return $request;
    }
}
