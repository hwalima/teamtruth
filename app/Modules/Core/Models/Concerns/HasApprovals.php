<?php

namespace App\Modules\Core\Models\Concerns;

use App\Modules\Core\Enums\ApprovalStatus;
use App\Modules\Core\Models\ApprovalRequest;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Validation\ValidationException;

trait HasApprovals
{
    protected static function bootHasApprovals(): void
    {
        static::updating(function ($model): void {
            if ($model->approvalRequests()->where('status', ApprovalStatus::Pending->value)->exists()) {
                throw ValidationException::withMessages([
                    'approval' => 'This record cannot be edited while an approval is pending.',
                ]);
            }
        });
    }

    public function approvalRequests(): MorphMany
    {
        return $this->morphMany(ApprovalRequest::class, 'approvable');
    }
}
