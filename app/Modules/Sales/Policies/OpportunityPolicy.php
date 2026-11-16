<?php

namespace App\Modules\Sales\Policies;

use App\Models\User;
use App\Modules\Sales\Models\Opportunity;
use Illuminate\Auth\Access\HandlesAuthorization;

class OpportunityPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('erp.sales.view');
    }

    public function view(User $user, Opportunity $opportunity): bool
    {
        return $user->can('erp.sales.view');
    }

    public function create(User $user): bool
    {
        return $user->can('erp.sales.manage');
    }

    public function update(User $user, Opportunity $opportunity): bool
    {
        return $user->can('erp.sales.manage');
    }

    public function delete(User $user, Opportunity $opportunity): bool
    {
        return $user->can('erp.sales.manage');
    }
}
