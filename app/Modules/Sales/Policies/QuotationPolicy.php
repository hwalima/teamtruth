<?php

namespace App\Modules\Sales\Policies;

use App\Models\User;
use App\Modules\Sales\Models\Quotation;
use Illuminate\Auth\Access\HandlesAuthorization;

class QuotationPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('erp.sales.view');
    }

    public function view(User $user, Quotation $quotation): bool
    {
        return $user->can('erp.sales.view');
    }

    public function create(User $user): bool
    {
        return $user->can('erp.sales.manage');
    }

    public function update(User $user, Quotation $quotation): bool
    {
        return $user->can('erp.sales.manage') && $quotation->status === 'draft';
    }

    public function delete(User $user, Quotation $quotation): bool
    {
        return $user->can('erp.sales.manage') && $quotation->status === 'draft';
    }

    public function submit(User $user, Quotation $quotation): bool
    {
        return $user->can('erp.sales.manage') && $quotation->status === 'draft';
    }

    public function approve(User $user, Quotation $quotation): bool
    {
        return $user->can('erp.sales.manage') && $quotation->status === 'pending_approval';
    }

    public function convert(User $user, Quotation $quotation): bool
    {
        return $user->can('erp.sales.manage') && $quotation->status === 'approved';
    }

    public function print(User $user, Quotation $quotation): bool
    {
        return $user->can('erp.sales.view');
    }
}
