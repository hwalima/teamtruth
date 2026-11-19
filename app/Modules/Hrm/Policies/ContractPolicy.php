<?php

namespace App\Modules\Hrm\Policies;

use App\Models\User;
use App\Modules\Hrm\Models\Contract;
use Illuminate\Auth\Access\HandlesAuthorization;

class ContractPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('erp.hrm.contract.view');
    }

    public function view(User $user, Contract $contract): bool
    {
        // Employees can view their own contracts
        if ($contract->employee->user_id === $user->id) {
            return true;
        }
        return $user->can('erp.hrm.contract.view');
    }

    public function create(User $user): bool
    {
        return $user->can('erp.hrm.contract.manage');
    }

    public function update(User $user, Contract $contract): bool
    {
        return $user->can('erp.hrm.contract.manage');
    }

    public function delete(User $user, Contract $contract): bool
    {
        return $user->can('erp.hrm.contract.manage');
    }

    public function sign(User $user, Contract $contract): bool
    {
        // Employee can sign their own contract
        if ($contract->employee->user_id === $user->id) {
            return $contract->status === \App\Modules\Hrm\Enums\ContractStatus::PendingSignature;
        }
        // Employer representatives can sign
        return $user->can('erp.hrm.contract.manage');
    }

    public function renew(User $user, Contract $contract): bool
    {
        return $user->can('erp.hrm.contract.manage');
    }

    public function terminate(User $user, Contract $contract): bool
    {
        return $user->can('erp.hrm.contract.manage');
    }
}