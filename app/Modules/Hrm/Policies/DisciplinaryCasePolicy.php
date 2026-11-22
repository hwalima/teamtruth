<?php

namespace App\Modules\Hrm\Policies;

use App\Models\User;
use App\Modules\Hrm\Models\DisciplinaryCase;
use App\Modules\Hrm\Services\DisciplinaryService;

class DisciplinaryCasePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('erp.hrm.disciplinary.view');
    }

    /** HR, the employee concerned and their line manager can see a case. */
    public function view(User $user, DisciplinaryCase $case): bool
    {
        return $this->isOwn($user, $case)
            || $case->employee?->lineManager?->user_id === $user->id
            || $user->can('erp.hrm.disciplinary.view');
    }

    public function update(User $user, DisciplinaryCase $case): bool
    {
        return $user->can('erp.hrm.disciplinary.manage') && ! $this->isOwn($user, $case);
    }

    /** Only the employee concerned appeals, within the appeal window. */
    public function appeal(User $user, DisciplinaryCase $case): bool
    {
        return $this->isOwn($user, $case) && app(DisciplinaryService::class)->canStillAppeal($case);
    }

    /** Documents are visible to HR, and to the employee concerned. */
    public function downloadDocument(User $user, DisciplinaryCase $case): bool
    {
        return $this->isOwn($user, $case) || $user->can('erp.hrm.disciplinary.view');
    }

    private function isOwn(User $user, DisciplinaryCase $case): bool
    {
        return $case->employee !== null && $case->employee->user_id === $user->id;
    }
}
