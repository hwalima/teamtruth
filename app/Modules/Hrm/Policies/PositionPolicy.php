<?php

namespace App\Modules\Hrm\Policies;

use App\Models\User;
use App\Modules\Hrm\Models\Position;
use Illuminate\Auth\Access\HandlesAuthorization;

class PositionPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('erp.hrm.position.view');
    }

    public function view(User $user, Position $position): bool
    {
        return $user->can('erp.hrm.position.view');
    }

    public function create(User $user): bool
    {
        return $user->can('erp.hrm.position.manage');
    }

    public function update(User $user, Position $position): bool
    {
        return $user->can('erp.hrm.position.manage');
    }

    public function delete(User $user, Position $position): bool
    {
        return $user->can('erp.hrm.position.manage');
    }

    public function assignEmployee(User $user, Position $position): bool
    {
        return $user->can('erp.hrm.position.manage');
    }
}