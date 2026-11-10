<?php

namespace App\Modules\Purchase\Models;

use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Modules\Core\Models\Concerns\HasApprovals;
use App\Modules\Core\Enums\ApprovalStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PurchaseBill extends Model
{
    use BelongsToCompany;
    use HasApprovals;

    protected $fillable = [
        'company_id',
        'document_number',
        'vendor_id',
        'purchase_order_id',
        'purchase_receipt_id',
        'vendor_reference',
        'status',
        'currency_code',
        'exchange_rate',
        'untaxed_amount',
        'tax_amount',
        'total_amount',
        'amount_paid',
        'amount_residual',
        'bill_date',
        'due_date',
        'journal_id',
        'account_id',
        'created_by',
        'posted_by',
        'posted_at',
    ];

    protected function casts(): array
    {
        return [
            'exchange_rate' => 'decimal:10',
            'untaxed_amount' => 'decimal:4',
            'tax_amount' => 'decimal:4',
            'total_amount' => 'decimal:4',
            'amount_paid' => 'decimal:4',
            'amount_residual' => 'decimal:4',
            'bill_date' => 'date',
            'due_date' => 'date',
            'posted_at' => 'datetime',
        ];
    }

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(PurchaseVendor::class, 'vendor_id');
    }

    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class, 'purchase_order_id');
    }

    public function purchaseReceipt(): BelongsTo
    {
        return $this->belongsTo(PurchaseReceipt::class, 'purchase_receipt_id');
    }

    public function journal(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Accounting\Models\AccountingJournal::class, 'journal_id');
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Accounting\Models\AccountingAccount::class, 'account_id');
    }

    public function lines(): HasMany
    {
        return $this->hasMany(PurchaseBillLine::class, 'purchase_bill_id')->orderBy('sort_order');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(PurchasePaymentAllocation::class, 'purchase_bill_id');
    }

    public function syncApprovalStatus(ApprovalStatus $status): void
    {
        $this->status = match ($status) {
            ApprovalStatus::Approved => 'approved',
            ApprovalStatus::Rejected => 'rejected',
            ApprovalStatus::Returned => 'returned',
            ApprovalStatus::Cancelled => 'cancelled',
            ApprovalStatus::Pending => 'pending_approval',
            default => $this->status,
        };
        if ($status === ApprovalStatus::Approved) {
            $this->posted_at = now();
        }
        $this->save();
    }

    public function isEditable(): bool
    {
        return in_array($this->status, ['draft', 'pending_approval', 'returned'], true);
    }

    public function isPosted(): bool
    {
        return $this->status === 'approved';
    }
}