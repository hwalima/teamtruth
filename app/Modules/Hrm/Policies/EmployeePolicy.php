<?php

namespace App\Modules\Hrm\Policies;

use App\Models\User;
use App\Modules\Hrm\Models\Employee;
use Illuminate\Auth\Access\HandlesAuthorization;

class EmployeePolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('erp.hrm.employee.view');
    }

    public function view(User $user, Employee $employee): bool
    {
        // Employees can view their own record
        if ($employee->user_id === $user->id) {
            return true;
        }
        return $user->can('erp.hrm.employee.view');
    }

    public function create(User $user): bool
    {
        return $user->can('erp.hrm.employee.manage');
    }

    public function update(User $user, Employee $employee): bool
    {
        return $user->can('erp.hrm.employee.manage');
    }

    public function delete(User $user, Employee $employee): bool
    {
        return $user->can('erp.hrm.employee.terminate');
    }

    public function manageDocuments(User $user, Employee $employee): bool
    {
        if ($employee->user_id === $user->id) {
            return true;
        }
        return $user->can('erp.hrm.employee.manage');
    }

    public function manageContracts(User $user, Employee $employee): bool
    {
        return $user->can('erp.hrm.contract.manage');
    }

    public function viewSalary(User $user, Employee $employee): bool
    {
        if ($employee->user_id === $user->id) {
            return true;
        }
        return $user->can('erp.hrm.employee.view_salary');
    }

    public function terminate(User $user, Employee $employee): bool
    {
        return $user->can('erp.hrm.employee.terminate');
    }

    public function rehire(User $user, Employee $employee): bool
    {
        return $user->can('erp.hrm.employee.terminate');
    }
}