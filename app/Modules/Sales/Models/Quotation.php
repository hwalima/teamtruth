<?php

namespace App\Modules\Sales\Models;

use App\Modules\Core\Enums\ApprovalStatus;
use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Modules\Core\Models\Concerns\HasApprovals;
use App\Modules\Core\Models\Company;
use App\Modules\Invoicing\Models\Customer;
use App\Modules\Sales\Enums\QuotationStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;

class Quotation extends Model
{
    use BelongsToCompany, HasApprovals;

    protected $table = 'sal_quotations';

    protected $fillable = [
        'company_id',
        'customer_id',
        'opportunity_id',
        'document_number',
        'status',
        'currency_code',
        'subtotal',
        'discount_total',
        'tax_total',
        'total',
        'valid_until',
        'created_by',
        'submitted_at',
        'approved_at',
    ];

    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:4',
            'discount_total' => 'decimal:4',
            'tax_total' => 'decimal:4',
            'total' => 'decimal:4',
            'valid_until' => 'date',
            'submitted_at' => 'datetime',
            'approved_at' => 'datetime',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function opportunity(): BelongsTo
    {
        return $this->belongsTo(Opportunity::class);
    }

    public function lines(): HasMany
    {
        return $this->hasMany(QuotationLine::class)->orderBy('sort_order');
    }

    public function salesOrders(): HasMany
    {
        return $this->hasMany(SalesOrder::class, 'quotation_id');
    }

    public function syncApprovalStatus(ApprovalStatus $status): void
    {
        DB::transaction(function () use ($status): void {
            $this->status = match ($status) {
                ApprovalStatus::Approved => QuotationStatus::Approved->value,
                ApprovalStatus::Rejected => QuotationStatus::Cancelled->value,
                ApprovalStatus::Returned => QuotationStatus::Draft->value,
                ApprovalStatus::Cancelled => QuotationStatus::Cancelled->value,
                ApprovalStatus::Pending => 'pending_approval',
            };

            if ($status === ApprovalStatus::Approved) {
                $this->approved_at = now();
            }

            $this->saveQuietly();
        });
    }
}
