<?php

namespace App\Modules\Requisitions\Services;

use App\Models\User;
use App\Modules\Core\Models\ApprovalWorkflow;
use App\Modules\Core\Services\ApprovalWorkflowService;
use App\Modules\Core\Services\AuditLogService;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\SequenceService;
use App\Modules\Requisitions\Enums\RequisitionStatus;
use App\Modules\Requisitions\Models\Requisition;
use App\Modules\Requisitions\Models\RequisitionAttachment;
use App\Modules\Requisitions\Services\BudgetService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use LogicException;
use RuntimeException;

class RequisitionService
{
    public function createDraft(User $requester, array $attributes, array $lines): Requisition
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        return DB::transaction(function () use ($company, $requester, $attributes, $lines): Requisition {
            $requisition = Requisition::create([
                ...$attributes,
                'company_id' => $company->id,
                'document_number' => app(SequenceService::class)->next($company, 'requisition'),
                'requested_by' => $requester->id,
                'status' => RequisitionStatus::Draft,
                'estimated_total' => $this->totalFor($lines),
            ]);
            $this->replaceLines($requisition, $lines);

            app(AuditLogService::class)->record(
                $company,
                'requisition.created',
                $requisition,
                ['status' => ['new' => RequisitionStatus::Draft->value]],
                actor: $requester,
            );

            return $requisition;
        });
    }

    public function updateDraft(Requisition $requisition, User $actor, array $attributes, array $lines): Requisition
    {
        if (! $requisition->isEditableBy($actor)) {
            throw ValidationException::withMessages([
                'requisition' => __('Only your draft or returned requisitions can be edited.'),
            ]);
        }

        return DB::transaction(function () use ($requisition, $actor, $attributes, $lines): Requisition {
            $before = [
                'requisition_type' => $requisition->requisition_type,
                'department' => $requisition->department,
                'cost_center' => $requisition->cost_center,
                'justification' => $requisition->justification,
                'estimated_total' => $requisition->estimated_total,
            ];
            $requisition->fill([
                ...$attributes,
                'estimated_total' => $this->totalFor($lines),
            ])->save();
            $this->replaceLines($requisition, $lines);

            app(AuditLogService::class)->record(
                app(CompanyContext::class)->requireActiveCompany(),
                'requisition.updated',
                $requisition,
                ['before' => $before, 'after' => $requisition->only(array_keys($before))],
                actor: $actor,
            );

            return $requisition->fresh(['lines']);
        });
    }

    public function submit(Requisition $requisition, User $actor): void
    {
        if (! $requisition->isEditableBy($actor)) {
            throw ValidationException::withMessages([
                'requisition' => __('Only your draft or returned requisitions can be submitted.'),
            ]);
        }

        if ($requisition->lines()->doesntExist()) {
            throw ValidationException::withMessages([
                'lines' => __('Add at least one line before submitting this requisition.'),
            ]);
        }
        if (! ApprovalWorkflow::query()
            ->where('approvable_type', Requisition::class)
            ->where('is_active', true)
            ->exists()) {
            throw ValidationException::withMessages([
                'approval' => __('Configure an active requisition approval workflow before submitting.'),
            ]);
        }

        // Validate budget (block on over-budget)
        app(BudgetService::class)->validateRequisitionBudget($requisition, $actor, true);

        DB::transaction(function () use ($requisition, $actor): void {
            $oldStatus = $requisition->status->value;
            $requisition->load('lines');
            $requisition->setAttribute('status', RequisitionStatus::InApproval);
            $requisition->setAttribute('submitted_at', now());
            $requisition->save();

            try {
                app(ApprovalWorkflowService::class)->submit(
                    $requisition,
                    $actor,
                    (string) $requisition->estimated_total,
                    $requisition->currency_code,
                    [
                        'requisition_type' => $requisition->requisition_type,
                        'department' => $requisition->department ?? '',
                        'document_type' => 'requisition',
                    ],
                );
            } catch (LogicException $exception) {
                throw ValidationException::withMessages([
                    'approval' => __($exception->getMessage()),
                ]);
            }

            // Reserve budget
            app(BudgetService::class)->reserveBudget($requisition, $actor);

            app(AuditLogService::class)->record(
                app(CompanyContext::class)->requireActiveCompany(),
                'requisition.submitted',
                $requisition,
                ['status' => ['old' => $oldStatus, 'new' => RequisitionStatus::InApproval->value]],
                actor: $actor,
            );
        });
    }

    /**
     * @param  array<int, UploadedFile>  $files
     */
    public function attachFiles(Requisition $requisition, User $actor, array $files): void
    {
        if (! $requisition->isEditableBy($actor)) {
            throw ValidationException::withMessages([
                'attachments' => __('Attachments can only be added to your draft or returned requisitions.'),
            ]);
        }

        $storedPaths = [];
        try {
            DB::transaction(function () use ($requisition, $actor, $files, &$storedPaths): void {
                foreach ($files as $file) {
                    $path = $file->store(
                        "erp-requisitions/{$requisition->company_id}/{$requisition->id}",
                        'local',
                    );
                    if (! $path) {
                        throw new RuntimeException('The requisition attachment could not be stored.');
                    }
                    $storedPaths[] = $path;

                    RequisitionAttachment::create([
                        'company_id' => $requisition->company_id,
                        'requisition_id' => $requisition->id,
                        'uploaded_by' => $actor->id,
                        'original_name' => $file->getClientOriginalName(),
                        'path' => $path,
                        'mime_type' => $file->getMimeType() ?? 'application/octet-stream',
                        'size' => $file->getSize(),
                    ]);
                }
                app(AuditLogService::class)->record(
                    app(CompanyContext::class)->requireActiveCompany(),
                    'requisition.attachments_added',
                    $requisition,
                    metadata: ['count' => count($files)],
                    actor: $actor,
                );
            });
        } catch (\Throwable $exception) {
            Storage::disk('local')->delete($storedPaths);
            throw $exception;
        }
    }

    private function replaceLines(Requisition $requisition, array $lines): void
    {
        $requisition->lines()->delete();
        $requisition->lines()->createMany(array_map(
            fn (array $line, int $index): array => [
                ...$line,
                'company_id' => $requisition->company_id,
                'estimated_total' => self::multiplyDecimals(
                    (string) $line['quantity'],
                    (string) $line['estimated_unit_price'],
                ),
                'sort_order' => $index + 1,
            ],
            $lines,
            array_keys($lines),
        ));
    }

    private function totalFor(array $lines): string
    {
        $totalScaled = 0;
        foreach ($lines as $line) {
            $totalScaled += self::toScaledInteger(self::multiplyDecimals(
                (string) $line['quantity'],
                (string) $line['estimated_unit_price'],
            ));
        }

        return self::fromScaledInteger($totalScaled);
    }

    private static function multiplyDecimals(string $left, string $right): string
    {
        $leftDigits = self::toScaledDigits($left);
        $rightDigits = self::toScaledDigits($right);
        $digits = array_fill(0, strlen($leftDigits) + strlen($rightDigits), 0);

        for ($i = strlen($leftDigits) - 1; $i >= 0; $i--) {
            for ($j = strlen($rightDigits) - 1; $j >= 0; $j--) {
                $digits[$i + $j + 1] += (int) $leftDigits[$i] * (int) $rightDigits[$j];
            }
        }
        for ($i = count($digits) - 1; $i > 0; $i--) {
            $digits[$i - 1] += intdiv($digits[$i], 10);
            $digits[$i] %= 10;
        }

        $product = ltrim(implode('', $digits), '0') ?: '0';
        $product = str_pad($product, 5, '0', STR_PAD_LEFT);
        $scaled = substr($product, 0, -4);
        $remainder = (int) substr($product, -4);
        if ($remainder >= 5000) {
            $scaled = self::incrementDigits($scaled);
        }

        return self::formatScaledDigits($scaled);
    }

    private static function toScaledDigits(string $decimal): string
    {
        [$whole, $fraction] = array_pad(explode('.', $decimal, 2), 2, '');

        return ltrim($whole.str_pad($fraction, 4, '0'), '0') ?: '0';
    }

    private static function toScaledInteger(string $decimal): int
    {
        $digits = self::toScaledDigits($decimal);
        if (strlen($digits) > 18) {
            throw new RuntimeException('The requisition total exceeds the supported amount.');
        }

        return (int) $digits;
    }

    private static function fromScaledInteger(int $scaled): string
    {
        return self::formatScaledDigits((string) $scaled);
    }

    private static function formatScaledDigits(string $scaled): string
    {
        $scaled = str_pad($scaled, 5, '0', STR_PAD_LEFT);

        return substr($scaled, 0, -4).'.'.substr($scaled, -4);
    }

    private static function incrementDigits(string $digits): string
    {
        $digits = str_split($digits);
        for ($index = count($digits) - 1; $index >= 0; $index--) {
            if ($digits[$index] !== '9') {
                $digits[$index] = (string) ((int) $digits[$index] + 1);

                return implode('', $digits);
            }
            $digits[$index] = '0';
        }

        return '1'.implode('', $digits);
    }
}
