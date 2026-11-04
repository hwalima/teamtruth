<?php

namespace App\Modules\Core\Services;

use App\Modules\Core\Models\Company;
use App\Modules\Core\Models\DocumentSequence;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use LogicException;

class SequenceService
{
    public function next(
        Company $company,
        string $documentType,
        ?string $prefix = null,
        ?int $fiscalYear = null,
        int $padding = 5,
    ): string {
        $activeCompany = app(CompanyContext::class)->requireActiveCompany();

        if ((int) $activeCompany->getKey() !== (int) $company->getKey()) {
            throw new AuthorizationException(
                'A document sequence can only be issued for the active company.'
            );
        }

        $documentType = strtolower(trim($documentType));

        if (! preg_match('/^[a-z][a-z0-9_-]{0,63}$/', $documentType)) {
            throw new InvalidArgumentException('The document type must be a short identifier.');
        }

        if ($padding < 1 || $padding > 12) {
            throw new InvalidArgumentException('Sequence padding must be between 1 and 12 digits.');
        }

        $fiscalYear ??= (int) now()->format('Y');
        if ($fiscalYear < 1 || $fiscalYear > 9999) {
            throw new InvalidArgumentException('The fiscal year must be between 1 and 9999.');
        }

        $typeCode = match ($documentType) {
            'invoice' => 'INV',
            'purchase_order' => 'PO',
            'requisition' => 'REQ',
            'journal_entry' => 'JE',
            default => strtoupper($documentType),
        };
        $prefix ??= sprintf('%s/%s/%04d/', $company->code, $typeCode, $fiscalYear);
        if ($prefix === '' || strlen($prefix) > 96) {
            throw new InvalidArgumentException('The sequence prefix must contain 1 to 96 characters.');
        }

        return DB::transaction(function () use ($company, $documentType, $fiscalYear, $prefix, $padding): string {
            DB::table('document_sequences')->insertOrIgnore([
                'company_id' => $company->id,
                'document_type' => $documentType,
                'fiscal_year' => $fiscalYear,
                'prefix' => $prefix,
                'last_number' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $sequence = DocumentSequence::query()
                ->where('company_id', $company->id)
                ->where('document_type', $documentType)
                ->where('fiscal_year', $fiscalYear)
                ->lockForUpdate()
                ->firstOrFail();

            if ($sequence->prefix !== $prefix) {
                throw new LogicException('A document sequence prefix cannot change after the sequence is created.');
            }

            $sequence->last_number++;
            $sequence->save();

            return $sequence->prefix.str_pad((string) $sequence->last_number, $padding, '0', STR_PAD_LEFT);
        });
    }
}
