<?php

namespace App\Modules\Hrm\Services;

use App\Models\User;
use App\Modules\Hrm\Enums\SelfServiceRequestStatus as Status;
use App\Modules\Hrm\Enums\SelfServiceRequestType as Type;
use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Models\SelfServiceRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * Requests employees send to HR: profile changes, documents, payslips,
 * certificates and general questions.
 *
 * request_data holds: subject, details, changes (profile updates), period
 * (payslips), purpose (certificates) and attachments [{path, name, mime, size, by}].
 */
class SelfServiceService
{
    /** Employee fields a profile-update request may change, with their labels. */
    public const PROFILE_FIELDS = [
        'personal_phone' => 'Personal phone',
        'personal_email' => 'Personal email',
        'marital_status' => 'Marital status',
        'emergency_contact_name' => 'Emergency contact name',
        'emergency_contact_phone' => 'Emergency contact phone',
        'emergency_contact_relation' => 'Emergency contact relation',
        'bank_name' => 'Bank name',
        'bank_account_name' => 'Bank account name',
        'bank_account_number' => 'Bank account number',
        'bank_branch' => 'Bank branch',
        'tax_number' => 'Tax number',
        'nssa_number' => 'NSSA number',
    ];

    public function __construct(private EmployeeService $employees) {}

    public function createRequest(User $actor, Employee $employee, array $data, array $files = []): SelfServiceRequest
    {
        return DB::transaction(function () use ($actor, $employee, $data, $files) {
            $request = SelfServiceRequest::query()->create([
                'employee_id' => $employee->id,
                'request_type' => $data['request_type'],
                'request_data' => $this->requestData($employee, $data),
                'status' => Status::Pending,
                'created_by' => $actor->id,
                'updated_by' => $actor->id,
            ]);

            foreach ($files as $file) {
                $this->attach($actor, $request, $file);
            }

            return $request->refresh();
        });
    }

    public function updateRequest(User $actor, SelfServiceRequest $request, array $data): SelfServiceRequest
    {
        $this->expect($request, [Status::Pending], 'Only pending requests can be changed.');

        $attachments = $request->request_data['attachments'] ?? [];
        $request->update([
            'request_data' => [...$this->requestData($request->employee, [...$data, 'request_type' => $request->request_type->value]), 'attachments' => $attachments],
            'updated_by' => $actor->id,
        ]);

        return $request->refresh();
    }

    /** HR takes the request on. */
    public function startProcessing(User $actor, SelfServiceRequest $request): SelfServiceRequest
    {
        $this->expect($request, [Status::Pending], 'Only pending requests can be taken on.');
        $request->update(['status' => Status::InProgress, 'processed_by' => $actor->id, 'updated_by' => $actor->id]);

        return $request->refresh();
    }

    /** Complete or reject. Completing a profile update writes the changes to the employee record. */
    public function review(User $actor, SelfServiceRequest $request, bool $approve, ?string $notes): SelfServiceRequest
    {
        $this->expect($request, [Status::Pending, Status::InProgress], 'This request has already been dealt with.');

        if (! $approve && blank($notes)) {
            throw ValidationException::withMessages(['notes' => 'Say why the request is rejected.']);
        }

        DB::transaction(function () use ($actor, $request, $approve, $notes) {
            if ($approve && $request->request_type === Type::ProfileUpdate) {
                $changes = $request->request_data['changes'] ?? [];
                if ($changes !== []) {
                    $this->employees->updateEmployee($actor, $request->employee, $changes);
                }
            }

            $request->update([
                'status' => $approve ? Status::Completed : Status::Rejected,
                'processed_by' => $actor->id,
                'processed_at' => now(),
                'notes' => $notes,
                'updated_by' => $actor->id,
            ]);
        });

        return $request->refresh();
    }

    /** The employee withdraws a request nobody has started on. */
    public function withdraw(SelfServiceRequest $request): void
    {
        $this->expect($request, [Status::Pending], 'Only pending requests can be withdrawn.');

        foreach ($request->request_data['attachments'] ?? [] as $attachment) {
            Storage::disk('local')->delete($attachment['path']);
        }
        $request->delete();
    }

    public function attach(User $actor, SelfServiceRequest $request, UploadedFile $file): SelfServiceRequest
    {
        $this->expect($request, [Status::Pending, Status::InProgress, Status::Completed], 'Files cannot be added to a rejected request.');

        $data = $request->request_data ?? [];
        $data['attachments'] = [...($data['attachments'] ?? []), [
            'path' => $file->store("hrm/{$request->company_id}/self-service/{$request->id}", 'local'),
            'name' => $file->getClientOriginalName(),
            'mime' => $file->getClientMimeType(),
            'size' => $file->getSize(),
            'by' => $actor->name,
            'at' => now()->toIso8601String(),
        ]];
        $request->forceFill(['request_data' => $data, 'updated_by' => $actor->id])->save();

        return $request->refresh();
    }

    /** Profile changes as rows of label / current value / requested value. */
    public function describeChanges(SelfServiceRequest $request): array
    {
        $employee = $request->employee;

        return collect($request->request_data['changes'] ?? [])
            ->map(fn ($value, $field) => [
                'field' => $field,
                'label' => self::PROFILE_FIELDS[$field] ?? $field,
                'current' => $employee?->getRawOriginal($field),
                'requested' => $value,
            ])->values()->all();
    }

    private function requestData(Employee $employee, array $data): array
    {
        $type = Type::from($data['request_type']);
        $result = [
            'subject' => $data['subject'] ?? null,
            'details' => $data['details'] ?? null,
        ];

        if ($type === Type::ProfileUpdate) {
            $changes = collect($data['changes'] ?? [])
                ->only(array_keys(self::PROFILE_FIELDS))
                ->map(fn ($value) => is_string($value) ? trim($value) : $value)
                ->filter(fn ($value, $field) => (string) $value !== (string) $employee->getRawOriginal($field))
                ->all();

            if ($changes === []) {
                throw ValidationException::withMessages(['changes' => 'Change at least one detail.']);
            }
            $result['changes'] = $changes;
        }
        if ($type === Type::PayslipRequest) {
            $result['period'] = $data['period'] ?? null;
        }
        if ($type === Type::CertificateRequest) {
            $result['purpose'] = $data['purpose'] ?? null;
        }

        return array_filter($result, fn ($value) => $value !== null && $value !== '');
    }

    /** @param list<Status> $allowed */
    private function expect(SelfServiceRequest $request, array $allowed, string $message): void
    {
        if (! in_array($request->status, $allowed, true)) {
            throw ValidationException::withMessages(['request' => $message]);
        }
    }
}
