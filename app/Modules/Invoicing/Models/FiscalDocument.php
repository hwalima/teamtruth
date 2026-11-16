<?php

namespace App\Modules\Invoicing\Models;

use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Modules\Core\Models\Company;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class FiscalDocument extends Model
{
    use BelongsToCompany;

    protected $table = 'inv_fiscal_documents';

    protected $fillable = [
        'company_id',
        'document_type',
        'document_id',
        'fiscal_device_id',
        'fiscal_invoice_number',
        'fiscal_receipt_number',
        'fiscal_day_end_number',
        'fiscal_signature',
        'fiscal_qr_code',
        'fiscalized_at',
        'request_payload',
        'response_payload',
        'status',
        'error_message',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'fiscalized_at' => 'datetime',
            'request_payload' => 'array',
            'response_payload' => 'array',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function document(): MorphTo
    {
        return $this->morphTo();
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    public function isSuccess(): bool
    {
        return $this->status === 'success';
    }

    public function isFailed(): bool
    {
        return $this->status === 'failed';
    }

    public function markAsSuccess(array $response): void
    {
        $this->update([
            'status' => 'success',
            'fiscalized_at' => now(),
            'response_payload' => $response,
            'fiscal_invoice_number' => $response['fiscal_invoice_number'] ?? null,
            'fiscal_receipt_number' => $response['fiscal_receipt_number'] ?? null,
            'fiscal_day_end_number' => $response['fiscal_day_end_number'] ?? null,
            'fiscal_signature' => $response['fiscal_signature'] ?? null,
            'fiscal_qr_code' => $response['fiscal_qr_code'] ?? null,
        ]);
    }

    public function markAsFailed(string $error): void
    {
        $this->update([
            'status' => 'failed',
            'error_message' => $error,
        ]);
    }
}