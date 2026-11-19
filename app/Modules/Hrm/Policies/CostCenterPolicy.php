<?php

namespace App\Modules\Hrm\Policies;

use App\Models\User;
use App\Modules\Hrm\Models\CostCenter;
use Illuminate\Auth\Access\HandlesAuthorization;

class CostCenterPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('erp.hrm.cost_center.view');
    }

    public function view(User $user, CostCenter $costCenter): bool
    {
        return $user->can('erp.hrm.cost_center.view');
    }

    public function create(User $user): bool
    {
        return $user->can('erp.hrm.cost_center.manage');
    }

    public function update(User $user, CostCenter $costCenter): bool
    {
        return $user->can('erp.hrm.cost_center.manage');
    }

    public function delete(User $user, CostCenter $costCenter): bool
    {
        return $user->can('erp.hrm.cost_center.manage');
    }
}