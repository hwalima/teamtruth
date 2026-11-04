<?php

namespace App\Modules\Core\Models;

use App\Models\User;
use App\Modules\Core\Enums\ApprovalActionType;
use App\Modules\Core\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

class ApprovalAction extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'request_id',
        'step_id',
        'actor_id',
        'action',
        'comment',
        'acted_at',
        'signature_snapshot',
    ];

    protected function casts(): array
    {
        return [
            'action' => ApprovalActionType::class,
            'signature_snapshot' => 'array',
            'acted_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Approval actions are immutable.'));
        static::deleting(fn () => throw new LogicException('Approval actions are immutable.'));
    }

    public function approvalRequest(): BelongsTo
    {
        return $this->belongsTo(ApprovalRequest::class, 'request_id');
    }

    public function step(): BelongsTo
    {
        return $this->belongsTo(ApprovalWorkflowStep::class, 'step_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
