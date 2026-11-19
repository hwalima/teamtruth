<?php

namespace App\Modules\Hrm\Policies;

use App\Models\User;
use App\Modules\Hrm\Models\Grade;
use Illuminate\Auth\Access\HandlesAuthorization;

class GradePolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('erp.hrm.grade.view');
    }

    public function view(User $user, Grade $grade): bool
    {
        return $user->can('erp.hrm.grade.view');
    }

    public function create(User $user): bool
    {
        return $user->can('erp.hrm.grade.manage');
    }

    public function update(User $user, Grade $grade): bool
    {
        return $user->can('erp.hrm.grade.manage');
    }

    public function delete(User $user, Grade $grade): bool
    {
        return $user->can('erp.hrm.grade.manage');
    }
}