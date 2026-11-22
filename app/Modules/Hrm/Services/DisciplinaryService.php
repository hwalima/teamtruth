<?php

namespace App\Modules\Hrm\Services;

use App\Models\User;
use App\Modules\Hrm\Enums\DisciplinaryOutcome;
use App\Modules\Hrm\Enums\DisciplinaryStatus as Status;
use App\Modules\Hrm\Models\DisciplinaryCase;
use App\Modules\Hrm\Models\DisciplinaryDocument;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * Disciplinary cases follow a fixed path:
 * open → under investigation → notice issued → hearing scheduled → hearing completed
 * → outcome decided → (appealed → appeal decided) → closed.
 *
 * Every step is written to the case timeline with who did it and any notes.
 */
class DisciplinaryService
{
    /** How long a warning stays on record, in months. */
    public const WARNING_MONTHS = [
        'verbal_warning' => 6,
        'written_warning' => 12,
        'final_warning' => 12,
    ];

    /** Days the employee has to appeal once the outcome is decided. */
    public const APPEAL_WINDOW_DAYS = 14;

    public function createCase(User $actor, array $data): DisciplinaryCase
    {
        return DB::transaction(function () use ($actor, $data) {
            $case = DisciplinaryCase::query()->create([
                'employee_id' => $data['employee_id'],
                'case_number' => $this->nextCaseNumber(),
                'incident_date' => $data['incident_date'],
                'reported_date' => $data['reported_date'] ?? today(),
                'reported_by' => $actor->id,
                'incident_description' => $data['incident_description'],
                'incident_location' => $data['incident_location'] ?? null,
                'witnesses' => $this->names($data['witnesses'] ?? null),
                'status' => Status::Open,
                'created_by' => $actor->id,
                'updated_by' => $actor->id,
            ]);

            return $this->log($case, $actor, 'Case opened');
        });
    }

    public function updateCase(User $actor, DisciplinaryCase $case, array $data): DisciplinaryCase
    {
        $this->expect($case, [Status::Open, Status::UnderInvestigation], 'Incident details can only be changed before a notice is issued.');

        $case->update([
            'incident_date' => $data['incident_date'],
            'incident_description' => $data['incident_description'],
            'incident_location' => $data['incident_location'] ?? null,
            'witnesses' => $this->names($data['witnesses'] ?? null),
            'updated_by' => $actor->id,
        ]);

        return $this->log($case, $actor, 'Incident details updated');
    }

    public function startInvestigation(User $actor, DisciplinaryCase $case, ?string $notes): DisciplinaryCase
    {
        $this->expect($case, [Status::Open], 'Only open cases can be put under investigation.');

        return $this->move($case, $actor, Status::UnderInvestigation, 'Investigation started', $notes);
    }

    /**
     * Finish the investigation. Either a notice to attend a hearing is issued,
     * or the case is dropped with no action.
     */
    public function completeInvestigation(User $actor, DisciplinaryCase $case, string $findings, bool $proceed): DisciplinaryCase
    {
        $this->expect($case, [Status::UnderInvestigation], 'The case is not under investigation.');

        if ($proceed) {
            return $this->move($case, $actor, Status::NoticeIssued, 'Investigation completed – notice issued', $findings);
        }

        $case->update([
            'outcome' => DisciplinaryOutcome::NoAction,
            'outcome_details' => $findings,
            'outcome_date' => today(),
        ]);

        return $this->move($case, $actor, Status::Closed, 'Investigation completed – no case to answer', $findings);
    }

    public function scheduleHearing(User $actor, DisciplinaryCase $case, array $data): DisciplinaryCase
    {
        $this->expect($case, [Status::NoticeIssued, Status::HearingScheduled], 'A notice must be issued before a hearing is scheduled.');

        $rescheduled = $case->status === Status::HearingScheduled;
        $at = Carbon::parse($data['hearing_at']);
        $case->update(['hearing_at' => $at, 'hearing_location' => $data['hearing_location'] ?? null]);

        $title = ($rescheduled ? 'Hearing rescheduled for ' : 'Hearing scheduled for ').$at->format('j M Y H:i')
            .($case->hearing_location ? " at {$case->hearing_location}" : '');

        return $this->move($case, $actor, Status::HearingScheduled, $title, $data['notes'] ?? null);
    }

    public function completeHearing(User $actor, DisciplinaryCase $case, string $notes): DisciplinaryCase
    {
        $this->expect($case, [Status::HearingScheduled], 'No hearing is scheduled.');

        return $this->move($case, $actor, Status::HearingCompleted, 'Hearing held', $notes);
    }

    public function recordOutcome(User $actor, DisciplinaryCase $case, array $data): DisciplinaryCase
    {
        $this->expect($case, [Status::HearingCompleted], 'The outcome is recorded after the hearing.');

        $outcome = DisciplinaryOutcome::from($data['outcome']);
        $date = Carbon::parse($data['outcome_date'] ?? today());

        $case->update([
            'outcome' => $outcome,
            'outcome_details' => $data['outcome_details'],
            'outcome_date' => $date,
            'expiry_date' => $data['expiry_date'] ?? $this->defaultExpiry($outcome, $date),
        ]);

        return $this->move($case, $actor, Status::OutcomeDecided, "Outcome: {$outcome->label()}", $data['outcome_details']);
    }

    public function appealDeadline(DisciplinaryCase $case): ?Carbon
    {
        return $case->outcome_date ? Carbon::parse($case->outcome_date)->addDays(self::APPEAL_WINDOW_DAYS) : null;
    }

    public function canStillAppeal(DisciplinaryCase $case): bool
    {
        return $case->status === Status::OutcomeDecided
            && $case->outcome !== DisciplinaryOutcome::NoAction
            && $case->appeal_date === null
            && ($deadline = $this->appealDeadline($case)) !== null
            && today()->lte($deadline);
    }

    public function submitAppeal(User $actor, DisciplinaryCase $case, string $grounds): DisciplinaryCase
    {
        if (! $this->canStillAppeal($case)) {
            throw ValidationException::withMessages(['case' => 'This outcome can no longer be appealed.']);
        }

        $case->update(['appeal_details' => $grounds, 'appeal_date' => today()]);

        return $this->move($case, $actor, Status::Appealed, 'Appeal lodged', $grounds);
    }

    /**
     * upheld: outcome stands; overturned: no action; reduced / increased: a new outcome.
     * The case is closed once the appeal is decided.
     */
    public function decideAppeal(User $actor, DisciplinaryCase $case, array $data): DisciplinaryCase
    {
        $this->expect($case, [Status::Appealed], 'There is no appeal to decide.');

        $decision = $data['appeal_decision'];
        $changes = ['appeal_decision' => $decision];

        if ($decision === 'overturned') {
            $changes += ['outcome' => DisciplinaryOutcome::NoAction, 'expiry_date' => null];
        } elseif (in_array($decision, ['reduced', 'increased'], true)) {
            $new = DisciplinaryOutcome::from($data['new_outcome'] ?? '');
            $current = $case->outcome;
            if ($current && (($decision === 'reduced' && $new->severity() >= $current->severity())
                || ($decision === 'increased' && $new->severity() <= $current->severity()))) {
                throw ValidationException::withMessages(['new_outcome' => "The new outcome must be ".($decision === 'reduced' ? 'lighter' : 'heavier').' than '.$current->label().'.']);
            }
            $changes += ['outcome' => $new, 'expiry_date' => $this->defaultExpiry($new, Carbon::parse($case->outcome_date ?? today()))];
        }

        $case->update($changes);
        $title = 'Appeal '.$decision.($case->outcome ? " – outcome now {$case->outcome->label()}" : '');

        return $this->move($case, $actor, Status::Closed, $title, $data['notes'] ?? null);
    }

    public function closeCase(User $actor, DisciplinaryCase $case, ?string $notes): DisciplinaryCase
    {
        if ($case->status === Status::Closed) {
            throw ValidationException::withMessages(['case' => 'The case is already closed.']);
        }
        if ($case->status === Status::Appealed) {
            throw ValidationException::withMessages(['case' => 'Decide the appeal before closing the case.']);
        }

        return $this->move($case, $actor, Status::Closed, 'Case closed', $notes);
    }

    public function uploadDocument(User $actor, DisciplinaryCase $case, UploadedFile $file, array $data): DisciplinaryDocument
    {
        $path = $file->store("hrm/{$case->company_id}/disciplinary/{$case->id}", 'local');

        $document = $case->documents()->create([
            'company_id' => $case->company_id,
            'document_type' => $data['document_type'],
            'title' => ($data['title'] ?? null) ?: $file->getClientOriginalName(),
            'file_path' => $path,
            'file_mime' => $file->getClientMimeType(),
            'file_size' => $file->getSize(),
            'created_by' => $actor->id,
        ]);

        $this->log($case, $actor, "Document added: {$document->title}");

        return $document;
    }

    public function deleteDocument(User $actor, DisciplinaryDocument $document): void
    {
        Storage::disk('local')->delete($document->file_path);
        $document->delete();
        $this->log($document->disciplinaryCase, $actor, "Document removed: {$document->title}");
    }

    private function move(DisciplinaryCase $case, User $actor, Status $status, string $title, ?string $notes): DisciplinaryCase
    {
        $case->update(['status' => $status, 'updated_by' => $actor->id]);

        return $this->log($case, $actor, $title, $notes);
    }

    private function log(DisciplinaryCase $case, User $actor, string $title, ?string $notes = null): DisciplinaryCase
    {
        $timeline = $case->timeline ?? [];
        $timeline[] = [
            'at' => now()->toIso8601String(),
            'by' => $actor->name,
            'title' => $title,
            'notes' => $notes ?: null,
            'status' => $case->status?->value,
        ];
        $case->forceFill(['timeline' => $timeline])->save();

        return $case->refresh();
    }

    /** @param list<Status> $allowed */
    private function expect(DisciplinaryCase $case, array $allowed, string $message): void
    {
        if (! in_array($case->status, $allowed, true)) {
            throw ValidationException::withMessages(['case' => $message]);
        }
    }

    private function defaultExpiry(DisciplinaryOutcome $outcome, Carbon $from): ?Carbon
    {
        $months = self::WARNING_MONTHS[$outcome->value] ?? null;

        return $months ? $from->copy()->addMonths($months) : null;
    }

    private function nextCaseNumber(): string
    {
        $prefix = 'DC-'.now()->format('Y').'-';
        $last = DisciplinaryCase::query()->where('case_number', 'like', $prefix.'%')->lockForUpdate()->max('case_number');
        $next = $last ? ((int) substr($last, strlen($prefix))) + 1 : 1;

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }

    /** @return list<string>|null */
    private function names(mixed $value): ?array
    {
        $list = is_array($value) ? $value : preg_split('/[\r\n,]+/', (string) $value);
        $list = array_values(array_filter(array_map('trim', $list), fn ($name) => $name !== ''));

        return $list ?: null;
    }
}
