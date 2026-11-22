<?php

namespace App\Modules\Hrm\Services;

use App\Models\User;
use App\Modules\Hrm\Enums\ContractStatus;
use App\Modules\Hrm\Models\Contract;
use App\Modules\Hrm\Models\ContractTemplate;
use App\Modules\Hrm\Models\Employee;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Employment contracts: drafting, two-party signing, renewal and termination.
 *
 * A contract starts as a draft and becomes active once both the employee and
 * the employer have signed. An employee has at most one active contract.
 */
class ContractService
{
    public const FIELDS = [
        'employee_id', 'template_id', 'contract_type', 'start_date', 'end_date', 'probation_end_date',
        'basic_salary', 'currency_code', 'pay_frequency', 'working_hours_per_week',
    ];

    public function createContract(User $actor, array $data): Contract
    {
        return Contract::query()->create([
            ...array_intersect_key($data, array_flip(self::FIELDS)),
            'basic_salary' => $data['basic_salary'] ?? 0,
            'working_hours_per_week' => $data['working_hours_per_week'] ?? 40,
            'status' => ContractStatus::Draft,
            'created_by' => $actor->id,
            'updated_by' => $actor->id,
        ]);
    }

    public function updateContract(User $actor, Contract $contract, array $data): Contract
    {
        if (in_array($contract->status, [ContractStatus::Terminated, ContractStatus::Renewed, ContractStatus::Expired], true)) {
            throw ValidationException::withMessages(['contract' => 'Closed contracts cannot be edited.']);
        }

        $fields = array_intersect_key($data, array_flip(self::FIELDS));
        unset($fields['employee_id']);

        // Changing the terms of a signed contract means it has to be signed again.
        $termsChanged = collect($fields)->contains(fn ($value, $key) => (string) $value !== (string) $this->raw($contract, $key));
        if ($termsChanged && $contract->status === ContractStatus::Draft) {
            $fields += ['signed_by_employee_at' => null, 'signed_by_employer_at' => null];
        }

        $contract->update([...$fields, 'updated_by' => $actor->id]);

        return $contract->refresh();
    }

    public function signByEmployee(User $actor, Contract $contract): Contract
    {
        $this->assertDraft($contract);
        $contract->forceFill(['signed_by_employee_at' => now(), 'updated_by' => $actor->id])->save();

        return $this->activateIfFullySigned($contract);
    }

    public function signByEmployer(User $actor, Contract $contract): Contract
    {
        $this->assertDraft($contract);
        $contract->forceFill(['signed_by_employer_at' => now(), 'updated_by' => $actor->id])->save();

        return $this->activateIfFullySigned($contract);
    }

    /** Close the contract and open a draft successor with the same terms unless overridden. */
    public function renewContract(User $actor, Contract $contract, array $data): Contract
    {
        if (! in_array($contract->status, [ContractStatus::Active, ContractStatus::Expired], true)) {
            throw ValidationException::withMessages(['contract' => 'Only active or expired contracts can be renewed.']);
        }

        return DB::transaction(function () use ($actor, $contract, $data) {
            $terms = collect(self::FIELDS)
                ->mapWithKeys(fn ($field) => [$field => $this->raw($contract, $field)])
                ->merge(array_filter(array_intersect_key($data, array_flip(self::FIELDS)), fn ($v) => $v !== null))
                ->all();

            $successor = $this->createContract($actor, $terms);
            $contract->update(['status' => ContractStatus::Renewed, 'updated_by' => $actor->id]);

            return $successor;
        });
    }

    public function terminateContract(User $actor, Contract $contract, array $data): Contract
    {
        if (in_array($contract->status, [ContractStatus::Terminated, ContractStatus::Renewed], true)) {
            throw ValidationException::withMessages(['contract' => 'This contract is already closed.']);
        }

        $date = Carbon::parse($data['termination_date']);
        if ($date->lt($contract->start_date)) {
            throw ValidationException::withMessages(['termination_date' => 'The termination date cannot be before the contract start date.']);
        }

        $contract->update(['status' => ContractStatus::Terminated, 'end_date' => $date, 'updated_by' => $actor->id]);

        return $contract->refresh();
    }

    /** Mark active contracts whose end date has passed as expired. Returns how many changed. */
    public function expireEndedContracts(): int
    {
        return Contract::query()
            ->where('status', ContractStatus::Active)
            ->whereNotNull('end_date')
            ->whereDate('end_date', '<', today())
            ->update(['status' => ContractStatus::Expired]);
    }

    /** The template text with merge fields filled in, or null when there is no template text. */
    public function renderDocument(Contract $contract): ?string
    {
        $body = $contract->template?->template_content['body'] ?? null;
        if (! $body) {
            return null;
        }

        $employee = $contract->employee;
        $values = [
            'employee_name' => $employee?->full_name,
            'employee_number' => $employee?->employee_number,
            'company_name' => $contract->company?->name,
            'contract_type' => $contract->contract_type?->label(),
            'start_date' => $contract->start_date?->format('j F Y'),
            'end_date' => $contract->end_date?->format('j F Y') ?? 'indefinite',
            'probation_end_date' => $contract->probation_end_date?->format('j F Y') ?? '—',
            'basic_salary' => number_format((float) $contract->basic_salary, 2),
            'currency' => $contract->currency_code,
            'pay_frequency' => $contract->pay_frequency ? ucfirst($contract->pay_frequency->value) : null,
            'working_hours' => rtrim(rtrim((string) $contract->working_hours_per_week, '0'), '.'),
            'position' => $employee?->position?->name,
            'department' => $employee?->department?->name,
        ];

        return preg_replace_callback('/\{\{\s*(\w+)\s*\}\}/', fn ($m) => (string) ($values[$m[1]] ?? $m[0]), $body);
    }

    public const MERGE_FIELDS = [
        'employee_name', 'employee_number', 'company_name', 'contract_type', 'start_date', 'end_date',
        'probation_end_date', 'basic_salary', 'currency', 'pay_frequency', 'working_hours', 'position', 'department',
    ];

    public function defaultTemplateFor(string $contractType): ?ContractTemplate
    {
        return ContractTemplate::query()->where('contract_type', $contractType)->where('is_default', true)->first();
    }

    private function activateIfFullySigned(Contract $contract): Contract
    {
        if (! $contract->signed_by_employee_at || ! $contract->signed_by_employer_at) {
            return $contract->refresh();
        }

        DB::transaction(function () use ($contract) {
            Contract::query()
                ->where('employee_id', $contract->employee_id)
                ->where('id', '!=', $contract->id)
                ->where('status', ContractStatus::Active)
                ->update(['status' => ContractStatus::Renewed]);

            $contract->update(['status' => ContractStatus::Active]);
        });

        return $contract->refresh();
    }

    private function assertDraft(Contract $contract): void
    {
        if ($contract->status !== ContractStatus::Draft) {
            throw ValidationException::withMessages(['contract' => 'Only draft contracts can be signed.']);
        }
    }

    private function raw(Contract $contract, string $field): mixed
    {
        $value = $contract->getAttribute($field);

        return match (true) {
            $value instanceof \BackedEnum => $value->value,
            $value instanceof \DateTimeInterface => $value->format('Y-m-d'),
            default => $value,
        };
    }
}
