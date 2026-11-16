<?php

namespace App\Modules\Sales\Policies;

use App\Models\User;
use App\Modules\Sales\Models\SalesOrder;
use Illuminate\Auth\Access\HandlesAuthorization;

class SalesOrderPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('erp.sales.view');
    }

    public function view(User $user, SalesOrder $salesOrder): bool
    {
        return $user->can('erp.sales.view');
    }

    public function create(User $user): bool
    {
        return $user->can('erp.sales.manage');
    }

    public function update(User $user, SalesOrder $salesOrder): bool
    {
        return $user->can('erp.sales.manage') && $salesOrder->status === 'draft';
    }

    public function delete(User $user, SalesOrder $salesOrder): bool
    {
        return $user->can('erp.sales.manage') && $salesOrder->status === 'draft';
    }

    public function submit(User $user, SalesOrder $salesOrder): bool
    {
        return $user->can('erp.sales.manage') && $salesOrder->status === 'draft';
    }

    public function approve(User $user, SalesOrder $salesOrder): bool
    {
        return $user->can('erp.sales.manage') && $salesOrder->status === 'pending_approval';
    }

    public function confirm(User $user, SalesOrder $salesOrder): bool
    {
        return $user->can('erp.sales.manage') && $salesOrder->status === 'approved';
    }

    public function print(User $user, SalesOrder $salesOrder): bool
    {
        return $user->can('erp.sales.view');
    }
}
