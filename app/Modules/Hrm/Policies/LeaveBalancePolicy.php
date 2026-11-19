<?php

namespace App\Modules\Hrm\Policies;

use App\Models\User;
use App\Modules\Hrm\Models\LeaveBalance;
use Illuminate\Auth\Access\HandlesAuthorization;

class LeaveBalancePolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('erp.hrm.leave.view');
    }

    public function view(User $user, LeaveBalance $balance): bool
    {
        // Employees can view their own balance
        if ($balance->employee->user_id === $user->id) {
            return true;
        }
        return $user->can('erp.hrm.leave.view');
    }

    public function create(User $user): bool
    {
        return $user->can('erp.hrm.leave.manage');
    }

    public function update(User $user, LeaveBalance $balance): bool
    {
        return $user->can('erp.hrm.leave.manage');
    }

    public function delete(User $user, LeaveBalance $balance): bool
    {
        return $user->can('erp.hrm.leave.manage');
    }

    public function adjust(User $user, LeaveBalance $balance): bool
    {
        return $user->can('erp.hrm.leave.manage');
    }
}