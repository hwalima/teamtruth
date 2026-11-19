<?php

namespace App\Modules\Hrm\Policies;

use App\Models\User;
use App\Modules\Hrm\Models\ContractTemplate;
use Illuminate\Auth\Access\HandlesAuthorization;

class ContractTemplatePolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('erp.hrm.contract.view');
    }

    public function view(User $user, ContractTemplate $template): bool
    {
        return $user->can('erp.hrm.contract.view');
    }

    public function create(User $user): bool
    {
        return $user->can('erp.hrm.contract.manage');
    }

    public function update(User $user, ContractTemplate $template): bool
    {
        return $user->can('erp.hrm.contract.manage');
    }

    public function delete(User $user, ContractTemplate $template): bool
    {
        return $user->can('erp.hrm.contract.manage');
    }
}