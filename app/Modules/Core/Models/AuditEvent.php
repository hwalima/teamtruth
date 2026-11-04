<?php

namespace App\Modules\Core\Models;

use App\Models\User;
use App\Modules\Core\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

class AuditEvent extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'actor_id',
        'event',
        'subject_type',
        'subject_id',
        'changes',
        'metadata',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'changes' => 'array',
            'metadata' => 'array',
            'occurred_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Audit events are immutable.'));
        static::deleting(fn () => throw new LogicException('Audit events are immutable.'));
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
