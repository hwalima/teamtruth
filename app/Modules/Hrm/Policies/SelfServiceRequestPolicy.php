<?php

namespace App\Modules\Hrm\Policies;

use App\Models\User;
use App\Modules\Hrm\Enums\SelfServiceRequestStatus as Status;
use App\Modules\Hrm\Models\SelfServiceRequest;

class SelfServiceRequestPolicy
{
    public function view(User $user, SelfServiceRequest $request): bool
    {
        return $this->isOwn($user, $request) || $user->can('erp.hrm.self_service.manage');
    }

    /** The employee changes or withdraws their own request until HR starts on it. */
    public function update(User $user, SelfServiceRequest $request): bool
    {
        return $this->isOwn($user, $request) && $request->status === Status::Pending;
    }

    public function attach(User $user, SelfServiceRequest $request): bool
    {
        return ($this->isOwn($user, $request) || $user->can('erp.hrm.self_service.manage'))
            && $request->status !== Status::Rejected;
    }

    /** HR handles requests, but nobody handles their own. */
    public function process(User $user, SelfServiceRequest $request): bool
    {
        return $user->can('erp.hrm.self_service.manage') && ! $this->isOwn($user, $request);
    }

    private function isOwn(User $user, SelfServiceRequest $request): bool
    {
        return $request->employee !== null && $request->employee->user_id === $user->id;
    }
}
