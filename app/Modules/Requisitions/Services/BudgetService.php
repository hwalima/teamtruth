<?php

namespace App\Modules\Requisitions\Services;

use App\Models\User;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\AuditLogService;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Requisitions\Models\ErpBudget\ErpBudget;
use App\Modules\Requisitions\Models\ErpBudget\ErpBudgetCommitment;
use App\Modules\Requisitions\Models\ErpBudget\ErpBudgetLine;
use App\Modules\Requisitions\Models\Requisition;
use App\Modules\Requisitions\Models\RequisitionLine;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BudgetService
{
    /**
     * Validate that a requisition's lines don't exceed budget limits.
     * If $blockOnOverBudget is true, throws ValidationException on over-budget.
     * If false, only logs a warning (allows submission with warning).
     */
    public function validateRequisitionBudget(Requisition $requisition, User $actor, bool $blockOnOverBudget = true): array
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $warnings = [];
        $errors = [];

        foreach ($requisition->lines as $line) {
            $budgetLine = $this->findBudgetLineForRequisitionLine($company, $requisition, $line);

            if (! $budgetLine) {
                // No budget line mapped - this is OK, just skip validation
                continue;
            }

            $available = $budgetLine->available_amount;
            $lineTotal = (string) $line->estimated_total;

            if ($this->compareDecimals($lineTotal, $available) > 0) {
                $message = "Line '{$line->item}' (budget: {$budgetLine->code} - {$budgetLine->name}) "
                    . "exceeds available budget. Available: {$budgetLine->currency_code} {$available}, "
                    . "Requested: {$requisition->currency_code} {$lineTotal}.";

                if ($blockOnOverBudget) {
                    $errors[] = $message;
                } else {
                    $warnings[] = $message;
                }
            }
        }

        if (! empty($errors)) {
            throw ValidationException::withMessages([
                'budget' => $errors,
            ]);
        }

        return $warnings;
    }

    /**
     * Reserve budget for a requisition (when submitted for approval).
     * Creates ErpBudgetCommitment records with status 'reserved'.
     */
    public function reserveBudget(Requisition $requisition, User $actor): void
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        DB::transaction(function () use ($company, $requisition, $actor): void {
            foreach ($requisition->lines as $line) {
                $budgetLine = $this->findBudgetLineForRequisitionLine($company, $requisition, $line);

                if (! $budgetLine) {
                    continue;
                }

                ErpBudgetCommitment::create([
                    'company_id' => $company->id,
                    'budget_line_id' => $budgetLine->id,
                    'commitment_type' => 'requisition',
                    'commitment_id' => $requisition->id,
                    'amount' => (string) $line->estimated_total,
                    'currency_code' => $requisition->currency_code,
                    'status' => 'reserved',
                ]);
            }

            app(AuditLogService::class)->record(
                $company,
                'budget.reserved',
                $requisition,
                ['commitment_count' => $requisition->lines->count()],
                actor: $actor,
            );
        });
    }

    /**
     * Confirm budget reservation when requisition is approved.
     * Updates commitments from 'reserved' to 'confirmed'.
     */
    public function confirmBudgetReservation(Requisition $requisition, User $actor): void
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        DB::transaction(function () use ($company, $requisition, $actor): void {
            $commitments = ErpBudgetCommitment::query()
                ->where('company_id', $company->id)
                ->where('commitment_type', 'requisition')
                ->where('commitment_id', $requisition->id)
                ->where('status', 'reserved')
                ->get();

            foreach ($commitments as $commitment) {
                $commitment->confirm();
            }

            app(AuditLogService::class)->record(
                $company,
                'budget.confirmed',
                $requisition,
                ['commitment_count' => $commitments->count()],
                actor: $actor,
            );
        });
    }

    /**
     * Release budget reservation when requisition is rejected, returned, or cancelled.
     * Updates commitments from 'reserved' to 'released'.
     */
    public function releaseBudgetReservation(Requisition $requisition, User $actor): void
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        DB::transaction(function () use ($company, $requisition, $actor): void {
            $commitments = ErpBudgetCommitment::query()
                ->where('company_id', $company->id)
                ->where('commitment_type', 'requisition')
                ->where('commitment_id', $requisition->id)
                ->whereIn('status', ['reserved', 'confirmed'])
                ->get();

            foreach ($commitments as $commitment) {
                $commitment->release();
            }

            app(AuditLogService::class)->record(
                $company,
                'budget.released',
                $requisition,
                ['commitment_count' => $commitments->count()],
                actor: $actor,
            );
        });
    }

    /**
     * Convert requisition budget commitment to purchase order commitment.
     * Called when approved purchase requisition is converted to PO.
     */
    public function convertToPurchaseOrderCommitment(Requisition $requisition, int $purchaseOrderId, User $actor): void
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        DB::transaction(function () use ($company, $requisition, $purchaseOrderId, $actor): void {
            $commitments = ErpBudgetCommitment::query()
                ->where('company_id', $company->id)
                ->where('commitment_type', 'requisition')
                ->where('commitment_id', $requisition->id)
                ->where('status', 'confirmed')
                ->get();

            foreach ($commitments as $commitment) {
                // Release the requisition commitment
                $commitment->release();

                // Create new PO commitment
                ErpBudgetCommitment::create([
                    'company_id' => $company->id,
                    'budget_line_id' => $commitment->budget_line_id,
                    'commitment_type' => 'purchase_order',
                    'commitment_id' => $purchaseOrderId,
                    'amount' => $commitment->amount,
                    'currency_code' => $commitment->currency_code,
                    'status' => 'reserved', // PO will be submitted for approval
                ]);
            }

            app(AuditLogService::class)->record(
                $company,
                'budget.converted_to_po',
                $requisition,
                ['purchase_order_id' => $purchaseOrderId, 'commitment_count' => $commitments->count()],
                actor: $actor,
            );
        });
    }

    /**
     * Find the ERP budget line that corresponds to a requisition line.
     * First checks requisition.budget_id, then falls back to gl_account/budget_line on the line.
     */
    private function findBudgetLineForRequisitionLine(Company $company, Requisition $requisition, RequisitionLine $line): ?ErpBudgetLine
    {
        // Priority 1: Requisition has a specific budget_id
        if ($requisition->budget_id) {
            $budgetLine = ErpBudgetLine::query()
                ->where('company_id', $company->id)
                ->where('budget_id', $requisition->budget_id)
                ->where('code', $line->budget_line ?? $line->gl_account)
                ->where('is_active', true)
                ->first();

            if ($budgetLine) {
                return $budgetLine;
            }
        }

        // Priority 2: Match by gl_account or budget_line code against active budgets
        $code = $line->budget_line ?? $line->gl_account;
        if ($code) {
            return ErpBudgetLine::query()
                ->where('company_id', $company->id)
                ->whereHas('budget', fn ($q) => $q->where('status', 'active')
                    ->where('start_date', '<=', now())
                    ->where('end_date', '>=', now()))
                ->where('code', $code)
                ->where('is_active', true)
                ->first();
        }

        return null;
    }

    /**
     * Compare two decimal strings (returns -1, 0, 1).
     */
    private function compareDecimals(string $left, string $right): int
    {
        [$leftWhole, $leftFraction] = explode('.', self::normalizeDecimal($left), 2);
        [$rightWhole, $rightFraction] = explode('.', self::normalizeDecimal($right), 2);

        if (strlen($leftWhole) !== strlen($rightWhole)) {
            return strlen($leftWhole) <=> strlen($rightWhole);
        }

        $wholeComparison = strcmp($leftWhole, $rightWhole);
        if ($wholeComparison !== 0) {
            return $wholeComparison <=> 0;
        }

        return strcmp($leftFraction, $rightFraction) <=> 0;
    }

    private static function normalizeDecimal(string $value): string
    {
        if (! preg_match('/^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/', trim($value), $matches)) {
            throw new \RuntimeException('Invalid decimal value: '.$value);
        }

        $sign = $matches[1];
        $whole = $matches[2] !== '' ? $matches[2] : '0';
        $fraction = $matches[3] ?? '';
        $digits = $whole.$fraction;
        $decimalPoint = strlen($whole) + (int) ($matches[4] ?? 0);

        if ($decimalPoint <= 0) {
            $whole = '0';
            $fraction = str_repeat('0', -$decimalPoint).$digits;
        } elseif ($decimalPoint >= strlen($digits)) {
            $whole = $digits.str_repeat('0', $decimalPoint - strlen($digits));
            $fraction = '';
        } else {
            $whole = substr($digits, 0, $decimalPoint);
            $fraction = substr($digits, $decimalPoint);
        }

        $whole = ltrim($whole, '0') ?: '0';
        $fraction = str_pad($fraction, 5, '0');
        $scaled = $whole.str_pad(substr($fraction, 0, 4), 4, '0');
        if ((int) $fraction[4] >= 5) {
            $scaled = self::incrementDigits($scaled);
        }
        $scaled = str_pad($scaled, 5, '0', STR_PAD_LEFT);
        $normalizedWhole = ltrim(substr($scaled, 0, -4), '0') ?: '0';
        $normalizedFraction = substr($scaled, -4);
        $normalized = $normalizedWhole.'.'.$normalizedFraction;

        return $sign === '-' && $normalized !== '0.0000' ? '-'.$normalized : $normalized;
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