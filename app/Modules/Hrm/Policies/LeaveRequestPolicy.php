<?php

namespace App\Modules\Hrm\Policies;

use App\Models\User;
use App\Modules\Hrm\Models\LeaveRequest;
use Illuminate\Auth\Access\HandlesAuthorization;

class LeaveRequestPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('erp.hrm.leave.view');
    }

    public function view(User $user, LeaveRequest $leaveRequest): bool
    {
        // Employees can view their own requests
        if ($leaveRequest->employee->user_id === $user->id) {
            return true;
        }
        // Managers can view their subordinates' requests
        if ($user->can('erp.hrm.leave.approve')) {
            return true;
        }
        return $user->can('erp.hrm.leave.view');
    }

    public function create(User $user): bool
    {
        return $user->can('erp.hrm.leave.request');
    }

    public function update(User $user, LeaveRequest $leaveRequest): bool
    {
        // Employee can update their own pending request
        if ($leaveRequest->employee->user_id === $user->id) {
            return $leaveRequest->status === \App\Modules\Hrm\Enums\LeaveStatus::Pending;
        }
        return $user->can('erp.hrm.leave.manage');
    }

    public function delete(User $user, LeaveRequest $leaveRequest): bool
    {
        return $user->can('erp.hrm.leave.manage');
    }

    public function approve(User $user, LeaveRequest $leaveRequest): bool
    {
        return $user->can('erp.hrm.leave.approve');
    }

    public function reject(User $user, LeaveRequest $leaveRequest): bool
    {
        return $user->can('erp.hrm.leave.approve');
    }

    public function cancel(User $user, LeaveRequest $leaveRequest): bool
    {
        // Employee can cancel their own request
        if ($leaveRequest->employee->user_id === $user->id) {
            return in_array($leaveRequest->status, [
                \App\Modules\Hrm\Enums\LeaveStatus::Pending,
                \App\Modules\Hrm\Enums\LeaveStatus::Approved,
            ]);
        }
        return $user->can('erp.hrm.leave.manage');
    }
}