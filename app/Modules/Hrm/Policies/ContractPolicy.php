<?php

namespace App\Modules\Hrm\Policies;

use App\Models\User;
use App\Modules\Hrm\Enums\ContractStatus;
use App\Modules\Hrm\Models\Contract;

class ContractPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('erp.hrm.contract.view');
    }

    /** Employees can always see their own contracts. */
    public function view(User $user, Contract $contract): bool
    {
        return $this->isOwn($user, $contract) || $user->can('erp.hrm.contract.view');
    }

    public function create(User $user): bool
    {
        return $user->can('erp.hrm.contract.manage');
    }

    public function update(User $user, Contract $contract): bool
    {
        return $user->can('erp.hrm.contract.manage');
    }

    /** Only the employee named on the contract signs as the employee. */
    public function signAsEmployee(User $user, Contract $contract): bool
    {
        return $contract->status === ContractStatus::Draft
            && $contract->signed_by_employee_at === null
            && $this->isOwn($user, $contract);
    }

    /** HR signs for the employer, but never on their own contract. */
    public function signAsEmployer(User $user, Contract $contract): bool
    {
        return $contract->status === ContractStatus::Draft
            && $contract->signed_by_employer_at === null
            && ! $this->isOwn($user, $contract)
            && $user->can('erp.hrm.contract.manage');
    }

    private function isOwn(User $user, Contract $contract): bool
    {
        return $contract->employee !== null && $contract->employee->user_id === $user->id;
    }
}
