<?php

namespace App\Modules\Hrm\Policies;

use App\Models\User;
use App\Modules\Hrm\Models\DisciplinaryCase;
use Illuminate\Auth\Access\HandlesAuthorization;

class DisciplinaryCasePolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('erp.hrm.disciplinary.view');
    }

    public function view(User $user, DisciplinaryCase $case): bool
    {
        // Employee can view their own cases
        if ($case->employee->user_id === $user->id) {
            return true;
        }
        // Manager of the employee can view
        if ($case->employee->manager_id) {
            $manager = \App\Modules\Hrm\Models\Employee::find($case->employee->manager_id);
            if ($manager && $manager->user_id === $user->id) {
                return true;
            }
        }
        return $user->can('erp.hrm.disciplinary.view');
    }

    public function create(User $user): bool
    {
        return $user->can('erp.hrm.disciplinary.manage');
    }

    public function update(User $user, DisciplinaryCase $case): bool
    {
        return $user->can('erp.hrm.disciplinary.manage');
    }

    public function delete(User $user, DisciplinaryCase $case): bool
    {
        return $user->can('erp.hrm.disciplinary.manage');
    }

    public function investigate(User $user, DisciplinaryCase $case): bool
    {
        return $user->can('erp.hrm.disciplinary.manage');
    }

    public function hear(User $user, DisciplinaryCase $case): bool
    {
        return $user->can('erp.hrm.disciplinary.manage');
    }

    public function decide(User $user, DisciplinaryCase $case): bool
    {
        return $user->can('erp.hrm.disciplinary.manage');
    }

    public function appeal(User $user, DisciplinaryCase $case): bool
    {
        // Employee can appeal their own case
        if ($case->employee->user_id === $user->id) {
            return $case->status === \App\Modules\Hrm\Enums\DisciplinaryStatus::OutcomeDecided
                && ! $case->isExpired();
        }
        return $user->can('erp.hrm.disciplinary.manage');
    }

    public function decideAppeal(User $user, DisciplinaryCase $case): bool
    {
        return $user->can('erp.hrm.disciplinary.manage');
    }

    public function manageDocuments(User $user, DisciplinaryCase $case): bool
    {
        return $user->can('erp.hrm.disciplinary.manage');
    }
}