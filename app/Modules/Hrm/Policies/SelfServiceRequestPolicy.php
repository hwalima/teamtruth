<?php

namespace App\Modules\Hrm\Policies;

use App\Models\User;
use App\Modules\Hrm\Models\SelfServiceRequest;
use Illuminate\Auth\Access\HandlesAuthorization;

class SelfServiceRequestPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('erp.hrm.self_service.view');
    }

    public function view(User $user, SelfServiceRequest $request): bool
    {
        // Employee can view their own requests
        if ($request->employee->user_id === $user->id) {
            return true;
        }
        // Assigned reviewer can view
        if ($request->assigned_to === $user->id) {
            return true;
        }
        return $user->can('erp.hrm.self_service.view');
    }

    public function create(User $user): bool
    {
        return $user->can('erp.hrm.self_service.request');
    }

    public function update(User $user, SelfServiceRequest $request): bool
    {
        // Employee can update their own pending request
        if ($request->employee->user_id === $user->id) {
            return in_array($request->status, [
                \App\Modules\Hrm\Enums\SelfServiceRequestStatus::Pending,
                \App\Modules\Hrm\Enums\SelfServiceRequestStatus::UnderReview,
            ]);
        }
        return $user->can('erp.hrm.self_service.manage');
    }

    public function delete(User $user, SelfServiceRequest $request): bool
    {
        return $user->can('erp.hrm.self_service.manage');
    }

    public function review(User $user, SelfServiceRequest $request): bool
    {
        // Assigned reviewer or HR can review
        if ($request->assigned_to === $user->id) {
            return true;
        }
        return $user->can('erp.hrm.self_service.manage');
    }

    public function cancel(User $user, SelfServiceRequest $request): bool
    {
        // Employee can cancel their own request
        if ($request->employee->user_id === $user->id) {
            return in_array($request->status, [
                \App\Modules\Hrm\Enums\SelfServiceRequestStatus::Pending,
                \App\Modules\Hrm\Enums\SelfServiceRequestStatus::UnderReview,
            ]);
        }
        return $user->can('erp.hrm.self_service.manage');
    }
}