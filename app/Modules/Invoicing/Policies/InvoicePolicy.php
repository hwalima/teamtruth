<?php

namespace App\Modules\Invoicing\Policies;

use App\Models\User;
use App\Modules\Invoicing\Models\Invoice;
use Illuminate\Auth\Access\HandlesAuthorization;

class InvoicePolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('erp.invoicing.view');
    }

    public function view(User $user, Invoice $invoice): bool
    {
        return $user->can('erp.invoicing.view');
    }

    public function create(User $user): bool
    {
        return $user->can('erp.invoicing.manage');
    }

    public function update(User $user, Invoice $invoice): bool
    {
        return $user->can('erp.invoicing.manage') && $invoice->canBeEdited();
    }

    public function delete(User $user, Invoice $invoice): bool
    {
        return $user->can('erp.invoicing.manage') && $invoice->canBeEdited();
    }

    public function send(User $user, Invoice $invoice): bool
    {
        return $user->can('erp.invoicing.manage') && $invoice->canBeSent();
    }

    public function post(User $user, Invoice $invoice): bool
    {
        return $user->can('erp.invoicing.manage') && $invoice->canBePosted();
    }

    public function cancel(User $user, Invoice $invoice): bool
    {
        return $user->can('erp.invoicing.manage') && $invoice->canBeCancelled();
    }

    public function print(User $user, Invoice $invoice): bool
    {
        return $user->can('erp.invoicing.view');
    }

    public function recordPayment(User $user, Invoice $invoice): bool
    {
        return $user->can('erp.invoicing.manage');
    }
}