<?php

namespace App\Modules\Invoicing\Policies;

use App\Models\User;
use App\Modules\Invoicing\Models\CreditNote;
use Illuminate\Auth\Access\HandlesAuthorization;

class CreditNotePolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('erp.invoicing.view');
    }

    public function view(User $user, CreditNote $creditNote): bool
    {
        return $user->can('erp.invoicing.view');
    }

    public function create(User $user): bool
    {
        return $user->can('erp.invoicing.manage');
    }

    public function update(User $user, CreditNote $creditNote): bool
    {
        return $user->can('erp.invoicing.manage') && $creditNote->canBeEdited();
    }

    public function delete(User $user, CreditNote $creditNote): bool
    {
        return $user->can('erp.invoicing.manage') && $creditNote->canBeEdited();
    }

    public function issue(User $user, CreditNote $creditNote): bool
    {
        return $user->can('erp.invoicing.manage') && $creditNote->canBeIssued();
    }

    public function cancel(User $user, CreditNote $creditNote): bool
    {
        return $user->can('erp.invoicing.manage') && $creditNote->canBeCancelled();
    }

    public function print(User $user, CreditNote $creditNote): bool
    {
        return $user->can('erp.invoicing.view');
    }

    public function apply(User $user, CreditNote $creditNote): bool
    {
        return $user->can('erp.invoicing.manage') && $creditNote->status === 'issued';
    }
}