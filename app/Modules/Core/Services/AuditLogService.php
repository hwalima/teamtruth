<?php

namespace App\Modules\Core\Services;

use App\Models\User;
use App\Modules\Core\Models\AuditEvent;
use App\Modules\Core\Models\Company;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

class AuditLogService
{
    public function record(
        Company $company,
        string $event,
        Model|string $subject,
        array $changes = [],
        array $metadata = [],
        ?User $actor = null,
    ): AuditEvent {
        $activeCompany = app(CompanyContext::class)->requireActiveCompany();
        if ((int) $activeCompany->getKey() !== (int) $company->getKey()) {
            throw new AuthorizationException('Audit events can only be recorded for the active company.');
        }

        if ($event === '' || strlen($event) > 100) {
            throw new \InvalidArgumentException('Audit event names must contain 1 to 100 characters.');
        }

        $actor ??= Auth::user();

        return AuditEvent::create([
            'company_id' => $company->id,
            'actor_id' => $actor?->getKey(),
            'event' => $event,
            'subject_type' => $subject instanceof Model ? $subject::class : $subject,
            'subject_id' => $subject instanceof Model ? (string) $subject->getKey() : null,
            'changes' => $changes,
            'metadata' => $metadata,
            'occurred_at' => now(),
        ]);
    }
}
