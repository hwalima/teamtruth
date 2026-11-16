<?php

namespace App\Modules\Invoicing\Policies;

use App\Models\User;
use App\Modules\Invoicing\Models\RecurringInvoice;
use Illuminate\Auth\Access\HandlesAuthorization;

class RecurringInvoicePolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('erp.invoicing.view');
    }

    public function view(User $user, RecurringInvoice $recurringInvoice): bool
    {
        return $user->can('erp.invoicing.view');
    }

    public function create(User $user): bool
    {
        return $user->can('erp.invoicing.manage');
    }

    public function update(User $user, RecurringInvoice $recurringInvoice): bool
    {
        return $user->can('erp.invoicing.manage');
    }

    public function delete(User $user, RecurringInvoice $recurringInvoice): bool
    {
        return $user->can('erp.invoicing.manage');
    }

    public function pause(User $user, RecurringInvoice $recurringInvoice): bool
    {
        return $user->can('erp.invoicing.manage');
    }

    public function resume(User $user, RecurringInvoice $recurringInvoice): bool
    {
        return $user->can('erp.invoicing.manage');
    }
}