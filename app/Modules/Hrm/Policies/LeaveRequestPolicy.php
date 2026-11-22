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
        return $this->isOwn($user, $leaveRequest)
            || $user->can('erp.hrm.leave.approve')
            || $user->can('erp.hrm.leave.manage');
    }

    public function create(User $user): bool
    {
        return $user->can('erp.hrm.leave.request');
    }

    public function update(User $user, LeaveRequest $leaveRequest): bool
    {
        return $user->can('erp.hrm.leave.manage');
    }

    public function delete(User $user, LeaveRequest $leaveRequest): bool
    {
        return $user->can('erp.hrm.leave.manage');
    }

    /** Nobody approves their own leave. */
    public function approve(User $user, LeaveRequest $leaveRequest): bool
    {
        return ! $this->isOwn($user, $leaveRequest) && $user->can('erp.hrm.leave.approve');
    }

    public function reject(User $user, LeaveRequest $leaveRequest): bool
    {
        return $this->approve($user, $leaveRequest);
    }

    public function cancel(User $user, LeaveRequest $leaveRequest): bool
    {
        return $this->isOwn($user, $leaveRequest) || $user->can('erp.hrm.leave.manage');
    }

    private function isOwn(User $user, LeaveRequest $leaveRequest): bool
    {
        return $leaveRequest->employee !== null && (int) $leaveRequest->employee->user_id === (int) $user->id;
    }
}
