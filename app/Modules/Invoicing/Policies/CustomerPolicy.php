<?php

namespace App\Modules\Invoicing\Policies;

use App\Models\User;
use App\Modules\Invoicing\Models\Customer;
use Illuminate\Auth\Access\HandlesAuthorization;

class CustomerPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('erp.invoicing.view');
    }

    public function view(User $user, Customer $customer): bool
    {
        return $user->can('erp.invoicing.view');
    }

    public function create(User $user): bool
    {
        return $user->can('erp.invoicing.manage');
    }

    public function update(User $user, Customer $customer): bool
    {
        return $user->can('erp.invoicing.manage');
    }

    public function delete(User $user, Customer $customer): bool
    {
        return $user->can('erp.invoicing.manage');
    }
}