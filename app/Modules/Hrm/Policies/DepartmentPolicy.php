<?php

namespace App\Modules\Hrm\Policies;

use App\Models\User;
use App\Modules\Hrm\Models\Department;
use Illuminate\Auth\Access\HandlesAuthorization;

class DepartmentPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('erp.hrm.department.view');
    }

    public function view(User $user, Department $department): bool
    {
        return $user->can('erp.hrm.department.view');
    }

    public function create(User $user): bool
    {
        return $user->can('erp.hrm.department.manage');
    }

    public function update(User $user, Department $department): bool
    {
        return $user->can('erp.hrm.department.manage');
    }

    public function delete(User $user, Department $department): bool
    {
        return $user->can('erp.hrm.department.manage');
    }
}