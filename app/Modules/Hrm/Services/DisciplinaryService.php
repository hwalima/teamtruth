<?php

namespace App\Modules\Hrm\Services;

use App\Models\User;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Hrm\Enums\DisciplinaryOutcome;
use App\Modules\Hrm\Enums\DisciplinaryStatus;
use App\Modules\Hrm\Models\DisciplinaryCase;
use App\Modules\Hrm\Models\DisciplinaryDocument;
use App\Modules\Hrm\Models\Employee;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class DisciplinaryService
{
    public function __construct(
        private CompanyContext $companyContext,
    ) {}

    /**
     * Create a new disciplinary case
     */
    public function createCase(User $actor, array $data): DisciplinaryCase
    {
        $company = $this->companyContext->requireActiveCompany();

        return DB::transaction(function () use ($company, $actor, $data) {
            // Validate employee
            $employee = Employee::where('company_id', $company->id)
                ->where('id', $data['employee_id'])
                ->firstOrFail();

            // Validate reported_by user belongs to company
            if (! empty($data['reported_by'])) {
                $reportedBy = User::whereHas('companies', fn ($q) => $q->where('company_id', $company->id))
                    ->where('id', $data['reported_by'])
                    ->firstOrFail();
            } else {
                $data['reported_by'] = $actor->id;
            }

            // Generate case number
            $caseNumber = $this->generateCaseNumber($company);

            $case = DisciplinaryCase::query()->create([
                'company_id' => $company->id,
                'employee_id' => $employee->id,
                'case_number' => $caseNumber,
                'incident_date' => $data['incident_date'],
                'reported_date' => $data['reported_date'] ?? now()->toDateString(),
                'reported_by' => $data['reported_by'],
                'incident_description' => $data['incident_description'],
                'incident_location' => $data['incident_location'] ?? null,
                'witnesses' => $data['witnesses'] ?? [],
                'evidence_attachments' => $data['evidence_attachments'] ?? [],
                'status' => DisciplinaryStatus::Open,
                'outcome' => null,
                'outcome_details' => null,
                'outcome_date' => null,
                'expiry_date' => null,
                'appeal_details' => null,
                'appeal_decision' => null,
                'appeal_date' => null,
                'created_by' => $actor->id,
                'updated_by' => $actor->id,
            ]);

            return $case->load(['employee.user', 'reportedBy']);
        });
    }

    /**
     * Update a disciplinary case
     */
    public function updateCase(User $actor, DisciplinaryCase $case, array $data): DisciplinaryCase
    {
        $company = $this->companyContext->requireActiveCompany();

        if ((int) $case->company_id !== (int) $company->id) {
            throw new AuthorizationException('Case belongs to a different company.');
        }

        // Prevent editing closed cases
        if ($case->status === DisciplinaryStatus::Closed) {
            throw ValidationException::withMessages(['case' => 'Closed cases cannot be modified.']);
        }

        $case->update(array_merge($data, ['updated_by' => $actor->id]));

        return $case->fresh()->load(['employee.user', 'reportedBy']);
    }

    /**
     * Start investigation
     */
    public function startInvestigation(User $actor, DisciplinaryCase $case, array $data = []): DisciplinaryCase
    {
        $company = $this->companyContext->requireActiveCompany();

        if ((int) $case->company_id !== (int) $company->id) {
            throw new AuthorizationException('Case belongs to a different company.');
        }

        if ($case->status !== DisciplinaryStatus::Open) {
            throw ValidationException::withMessages(['case' => 'Only open cases can be moved to investigation.']);
        }

        $case->update([
            'status' => DisciplinaryStatus::UnderInvestigation,
            'investigation_started_at' => now(),
            'investigator_id' => $data['investigator_id'] ?? $actor->id,
            'investigation_notes' => $data['investigation_notes'] ?? null,
            'updated_by' => $actor->id,
        ]);

        return $case->fresh()->load(['employee.user', 'reportedBy', 'investigator']);
    }

    /**
     * Complete investigation
     */
    public function completeInvestigation(User $actor, DisciplinaryCase $case, array $data): DisciplinaryCase
    {
        $company = $this->companyContext->requireActiveCompany();

        if ((int) $case->company_id !== (int) $company->id) {
            throw new AuthorizationException('Case belongs to a different company.');
        }

        if ($case->status !== DisciplinaryStatus::UnderInvestigation) {
            throw ValidationException::withMessages(['case' => 'Only cases under investigation can be completed.']);
        }

        $case->update([
            'status' => DisciplinaryStatus::InvestigationComplete,
            'investigation_completed_at' => now(),
            'investigation_findings' => $data['investigation_findings'] ?? null,
            'recommended_outcome' => $data['recommended_outcome'] ?? null,
            'updated_by' => $actor->id,
        ]);

        return $case->fresh()->load(['employee.user', 'reportedBy', 'investigator']);
    }

    /**
     * Schedule hearing
     */
    public function scheduleHearing(User $actor, DisciplinaryCase $case, array $data): DisciplinaryCase
    {
        $company = $this->companyContext->requireActiveCompany();

        if ((int) $case->company_id !== (int) $company->id) {
            throw new AuthorizationException('Case belongs to a different company.');
        }

        if (! in_array($case->status, [DisciplinaryStatus::InvestigationComplete, DisciplinaryStatus::UnderInvestigation])) {
            throw ValidationException::withMessages(['case' => 'Investigation must be complete before scheduling a hearing.']);
        }

        $hearingDate = CarbonImmutable::parse($data['hearing_date']);
        if ($hearingDate->lt(now())) {
            throw ValidationException::withMessages(['hearing_date' => 'Hearing date must be in the future.']);
        }

        $case->update([
            'status' => DisciplinaryStatus::HearingScheduled,
            'hearing_date' => $hearingDate->toDateString(),
            'hearing_time' => $data['hearing_time'] ?? '09:00',
            'hearing_location' => $data['hearing_location'] ?? null,
            'hearing_officer_id' => $data['hearing_officer_id'] ?? $actor->id,
            'hearing_notes' => $data['hearing_notes'] ?? null,
            'updated_by' => $actor->id,
        ]);

        return $case->fresh()->load(['employee.user', 'reportedBy', 'investigator', 'hearingOfficer']);
    }

    /**
     * Complete hearing
     */
    public function completeHearing(User $actor, DisciplinaryCase $case, array $data): DisciplinaryCase
    {
        $company = $this->companyContext->requireActiveCompany();

        if ((int) $case->company_id !== (int) $company->id) {
            throw new AuthorizationException('Case belongs to a different company.');
        }

        if ($case->status !== DisciplinaryStatus::HearingScheduled) {
            throw ValidationException::withMessages(['case' => 'No hearing scheduled for this case.']);
        }

        $case->update([
            'status' => DisciplinaryStatus::HearingCompleted,
            'hearing_completed_at' => now(),
            'hearing_outcome' => $data['hearing_outcome'] ?? null,
            'hearing_minutes' => $data['hearing_minutes'] ?? null,
            'updated_by' => $actor->id,
        ]);

        return $case->fresh()->load(['employee.user', 'reportedBy', 'investigator', 'hearingOfficer']);
    }

    /**
     * Record outcome
     */
    public function recordOutcome(User $actor, DisciplinaryCase $case, array $data): DisciplinaryCase
    {
        $company = $this->companyContext->requireActiveCompany();

        if ((int) $case->company_id !== (int) $company->id) {
            throw new AuthorizationException('Case belongs to a different company.');
        }

        if (! in_array($case->status, [DisciplinaryStatus::HearingCompleted, DisciplinaryStatus::InvestigationComplete])) {
            throw ValidationException::withMessages(['case' => 'Case must have completed hearing or investigation before recording outcome.']);
        }

        $outcome = DisciplinaryOutcome::tryFrom($data['outcome']);
        if (! $outcome) {
            throw ValidationException::withMessages(['outcome' => 'Invalid disciplinary outcome.']);
        }

        $outcomeDate = CarbonImmutable::parse($data['outcome_date'] ?? now()->toDateString());

        // Calculate expiry date if outcome has expiry
        $expiryDate = null;
        if ($outcome->hasExpiry()) {
            $expiryMonths = $data['expiry_months'] ?? $this->getDefaultExpiryMonths($outcome);
            $expiryDate = $outcomeDate->addMonths($expiryMonths);
        }

        $case->update([
            'status' => DisciplinaryStatus::OutcomeDecided,
            'outcome' => $outcome,
            'outcome_details' => $data['outcome_details'] ?? null,
            'outcome_date' => $outcomeDate->toDateString(),
            'expiry_date' => $expiryDate?->toDateString(),
            'outcome_decided_by' => $actor->id,
            'updated_by' => $actor->id,
        ]);

        // Apply outcome consequences
        $this->applyOutcomeConsequences($case->fresh(), $actor);

        return $case->fresh()->load(['employee.user', 'reportedBy', 'investigator', 'hearingOfficer']);
    }

    /**
     * Submit appeal
     */
    public function submitAppeal(User $actor, DisciplinaryCase $case, array $data): DisciplinaryCase
    {
        $company = $this->companyContext->requireActiveCompany();

        if ((int) $case->company_id !== (int) $company->id) {
            throw new AuthorizationException('Case belongs to a different company.');
        }

        if ($case->status !== DisciplinaryStatus::OutcomeDecided) {
            throw ValidationException::withMessages(['case' => 'Appeal can only be submitted after outcome is decided.']);
        }

        if ($case->isExpired()) {
            throw ValidationException::withMessages(['case' => 'Appeal period has expired.']);
        }

        // Check if employee is the one appealing (or their representative)
        $employee = $case->employee;
        if ($employee->user_id !== $actor->id && ! $actor->can('appeal on behalf', $case)) {
            throw new AuthorizationException('Only the employee or authorized representative can submit an appeal.');
        }

        $case->update([
            'status' => DisciplinaryStatus::Appealed,
            'appeal_details' => $data['appeal_details'],
            'appeal_submitted_at' => now(),
            'appeal_submitted_by' => $actor->id,
            'updated_by' => $actor->id,
        ]);

        return $case->fresh()->load(['employee.user', 'reportedBy', 'investigator', 'hearingOfficer']);
    }

    /**
     * Decide appeal
     */
    public function decideAppeal(User $actor, DisciplinaryCase $case, array $data): DisciplinaryCase
    {
        $company = $this->companyContext->requireActiveCompany();

        if ((int) $case->company_id !== (int) $company->id) {
            throw new AuthorizationException('Case belongs to a different company.');
        }

        if ($case->status !== DisciplinaryStatus::Appealed) {
            throw ValidationException::withMessages(['case' => 'No pending appeal for this case.']);
        }

        $appealDecision = $data['appeal_decision'];
        if (! in_array($appealDecision, ['upheld', 'overturned', 'reduced', 'increased'])) {
            throw ValidationException::withMessages(['appeal_decision' => 'Invalid appeal decision.']);
        }

        $newOutcome = $case->outcome;
        $newExpiryDate = $case->expiry_date;

        if ($appealDecision === 'overturned') {
            $newOutcome = null;
            $newExpiryDate = null;
            $newStatus = DisciplinaryStatus::Closed;
        } elseif ($appealDecision === 'reduced' || $appealDecision === 'increased') {
            $newOutcome = DisciplinaryOutcome::tryFrom($data['new_outcome'] ?? $case->outcome?->value);
            $newStatus = DisciplinaryStatus::OutcomeDecided;
            if ($newOutcome && $newOutcome->hasExpiry()) {
                $expiryMonths = $data['expiry_months'] ?? $this->getDefaultExpiryMonths($newOutcome);
                $newExpiryDate = now()->addMonths($expiryMonths)->toDateString();
            }
        } else { // upheld
            $newStatus = DisciplinaryStatus::Closed;
        }

        $case->update([
            'status' => $newStatus,
            'outcome' => $newOutcome,
            'outcome_details' => $data['appeal_outcome_details'] ?? $case->outcome_details,
            'outcome_date' => now()->toDateString(),
            'expiry_date' => $newExpiryDate,
            'appeal_decision' => $appealDecision,
            'appeal_date' => now()->toDateString(),
            'appeal_decided_by' => $actor->id,
            'updated_by' => $actor->id,
        ]);

        // Apply updated outcome consequences
        if ($newOutcome && $newOutcome !== $case->outcome) {
            $this->applyOutcomeConsequences($case->fresh(), $actor);
        }

        return $case->fresh()->load(['employee.user', 'reportedBy', 'investigator', 'hearingOfficer']);
    }

    /**
     * Close case
     */
    public function closeCase(User $actor, DisciplinaryCase $case, string $notes = null): DisciplinaryCase
    {
        $company = $this->companyContext->requireActiveCompany();

        if ((int) $case->company_id !== (int) $company->id) {
            throw new AuthorizationException('Case belongs to a different company.');
        }

        if ($case->status === DisciplinaryStatus::Closed) {
            throw ValidationException::withMessages(['case' => 'Case is already closed.']);
        }

        $case->update([
            'status' => DisciplinaryStatus::Closed,
            'closed_at' => now(),
            'closed_by' => $actor->id,
            'closure_notes' => $notes,
            'updated_by' => $actor->id,
        ]);

        return $case->fresh()->load(['employee.user', 'reportedBy', 'investigator', 'hearingOfficer']);
    }

    /**
     * Upload document to case
     */
    public function uploadDocument(User $actor, DisciplinaryCase $case, array $data): DisciplinaryDocument
    {
        $company = $this->companyContext->requireActiveCompany();

        if ((int) $case->company_id !== (int) $company->id) {
            throw new AuthorizationException('Case belongs to a different company.');
        }

        return DB::transaction(function () use ($actor, $case, $data) {
            $document = DisciplinaryDocument::query()->create([
                'company_id' => $company->id,
                'case_id' => $case->id,
                'document_type' => $data['document_type'],
                'name' => $data['name'],
                'file_path' => $data['file_path'],
                'file_size' => $data['file_size'] ?? null,
                'mime_type' => $data['mime_type'] ?? null,
                'description' => $data['description'] ?? null,
                'is_confidential' => $data['is_confidential'] ?? false,
                'uploaded_by' => $actor->id,
            ]);

            return $document;
        });
    }

    /**
     * Delete document
     */
    public function deleteDocument(User $actor, DisciplinaryDocument $document): void
    {
        $company = $this->companyContext->requireActiveCompany();

        if ((int) $document->company_id !== (int) $company->id) {
            throw new AuthorizationException('Document belongs to a different company.');
        }

        $document->delete();
    }

    /**
     * Get cases expiring soon
     */
    public function getExpiringCases(int $daysAhead = 30): \Illuminate\Database\Eloquent\Collection
    {
        $company = $this->companyContext->requireActiveCompany();

        return DisciplinaryCase::where('company_id', $company->id)
            ->whereIn('status', [DisciplinaryStatus::OutcomeDecided, DisciplinaryStatus::Appealed])
            ->whereNotNull('expiry_date')
            ->whereDate('expiry_date', '<=', now()->addDays($daysAhead))
            ->whereDate('expiry_date', '>=', now())
            ->with(['employee.user', 'reportedBy'])
            ->orderBy('expiry_date')
            ->get();
    }

    /**
     * Get overdue cases (no action taken for X days)
     */
    public function getOverdueCases(int $daysInactive = 30): \Illuminate\Database\Eloquent\Collection
    {
        $company = $this->companyContext->requireActiveCompany();

        return DisciplinaryCase::where('company_id', $company->id)
            ->whereNotIn('status', [DisciplinaryStatus::Closed, DisciplinaryStatus::OutcomeDecided])
            ->where('updated_at', '<=', now()->subDays($daysInactive))
            ->with(['employee.user', 'reportedBy', 'investigator', 'hearingOfficer'])
            ->orderBy('updated_at')
            ->get();
    }

    /**
     * Search cases
     */
    public function searchCases(array $filters, int $perPage = 15)
    {
        $company = $this->companyContext->requireActiveCompany();

        $query = DisciplinaryCase::where('company_id', $company->id)
            ->with(['employee.user', 'reportedBy', 'investigator', 'hearingOfficer']);

        if (! empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('case_number', 'like', "%{$search}%")
                    ->orWhere('incident_description', 'like', "%{$search}%")
                    ->orWhereHas('employee', fn ($q2) => $q2->where('first_name', 'like', "%{$search}%")
                        ->orWhere('last_name', 'like', "%{$search}%")
                        ->orWhere('employee_number', 'like', "%{$search}%"));
            });
        }

        if (! empty($filters['employee_id'])) {
            $query->where('employee_id', $filters['employee_id']);
        }

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['outcome'])) {
            $query->where('outcome', $filters['outcome']);
        }

        if (! empty($filters['reported_by'])) {
            $query->where('reported_by', $filters['reported_by']);
        }

        if (! empty($filters['incident_date_from'])) {
            $query->whereDate('incident_date', '>=', $filters['incident_date_from']);
        }

        if (! empty($filters['incident_date_to'])) {
            $query->whereDate('incident_date', '<=', $filters['incident_date_to']);
        }

        return $query->orderBy('created_at', 'desc')->paginate($perPage);
    }

    /**
     * Apply outcome consequences to employee
     */
    private function applyOutcomeConsequences(DisciplinaryCase $case, User $actor): void
    {
        $employee = $case->employee;
        $outcome = $case->outcome;

        if (! $outcome) {
            return;
        }

        switch ($outcome) {
            case DisciplinaryOutcome::WrittenWarning:
            case DisciplinaryOutcome::FinalWrittenWarning:
                // Record warning in employee record
                $employee->update([
                    'disciplinary_warnings' => array_merge(
                        $employee->disciplinary_warnings ?? [],
                        [[
                            'outcome' => $outcome->value,
                            'date' => $case->outcome_date,
                            'expiry' => $case->expiry_date,
                            'case_id' => $case->id,
                            'case_number' => $case->case_number,
                        ]]
                    ),
                    'updated_by' => $actor->id,
                ]);
                break;

            case DisciplinaryOutcome::Suspension:
                // Update employee status to suspended
                $employee->update([
                    'employment_status' => \App\Modules\Hrm\Enums\EmploymentStatus::Suspended,
                    'suspension_end_date' => $case->expiry_date,
                    'updated_by' => $actor->id,
                ]);
                break;

            case DisciplinaryOutcome::Demotion:
                // Position change would be handled separately via transfer
                // Just record for now
                $employee->update([
                    'updated_by' => $actor->id,
                ]);
                break;

            case DisciplinaryOutcome::Dismissal:
                // Terminate employee
                $employee->update([
                    'employment_status' => \App\Modules\Hrm\Enums\EmploymentStatus::Terminated,
                    'termination_date' => $case->outcome_date,
                    'termination_reason' => 'Dismissal following disciplinary case ' . $case->case_number,
                    'updated_by' => $actor->id,
                ]);

                if ($employee->position_id) {
                    \App\Modules\Hrm\Models\Position::where('id', $employee->position_id)->decrement('headcount_current');
                }
                break;

            case DisciplinaryOutcome::NoAction:
            case DisciplinaryOutcome::VerbalWarning:
            case DisciplinaryOutcome::Counselling:
            case DisciplinaryOutcome::TrainingRequired:
                // Record but no employment status change
                break;
        }
    }

    /**
     * Get default expiry months for outcome
     */
    private function getDefaultExpiryMonths(DisciplinaryOutcome $outcome): int
    {
        return match ($outcome) {
            DisciplinaryOutcome::VerbalWarning => 6,
            DisciplinaryOutcome::WrittenWarning => 12,
            DisciplinaryOutcome::FinalWrittenWarning => 18,
            DisciplinaryOutcome::Suspension => 12,
            DisciplinaryOutcome::Demotion => 24,
            DisciplinaryOutcome::Dismissal => 0, // Permanent
            DisciplinaryOutcome::Counselling => 6,
            DisciplinaryOutcome::TrainingRequired => 12,
            DisciplinaryOutcome::NoAction => 0,
            default => 12,
        };
    }

    /**
     * Generate unique case number
     */
    private function generateCaseNumber(\App\Modules\Core\Models\Company $company): string
    {
        $prefix = 'DISC';
        $lastNumber = DisciplinaryCase::where('company_id', $company->id)
            ->where('case_number', 'like', $prefix . '-%')
            ->latest('case_number')
            ->value('case_number');

        if ($lastNumber) {
            $num = (int) substr($lastNumber, strlen($prefix) + 1) + 1;
        } else {
            $num = 1;
        }

        return sprintf('%s-%05d', $prefix, $num);
    }
}