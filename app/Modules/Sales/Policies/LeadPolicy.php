<?php

namespace App\Modules\Sales\Policies;

use App\Models\User;
use App\Modules\Sales\Models\Lead;
use Illuminate\Auth\Access\HandlesAuthorization;

class LeadPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('erp.sales.view');
    }

    public function view(User $user, Lead $lead): bool
    {
        return $user->can('erp.sales.view');
    }

    public function create(User $user): bool
    {
        return $user->can('erp.sales.manage');
    }

    public function update(User $user, Lead $lead): bool
    {
        return $user->can('erp.sales.manage');
    }

    public function delete(User $user, Lead $lead): bool
    {
        return $user->can('erp.sales.manage');
    }
}
