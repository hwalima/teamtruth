<?php

namespace App\Modules\Sales\Models;

use App\Modules\Core\Enums\ApprovalStatus;
use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Modules\Core\Models\Concerns\HasApprovals;
use App\Modules\Core\Models\Company;
use App\Modules\Invoicing\Models\Customer;
use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Sales\Enums\SalesOrderStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;

class SalesOrder extends Model
{
    use BelongsToCompany, HasApprovals;

    protected $table = 'sal_sales_orders';

    protected $fillable = [
        'company_id',
        'customer_id',
        'quotation_id',
        'invoice_id',
        'document_number',
        'status',
        'currency_code',
        'subtotal',
        'discount_total',
        'tax_total',
        'total',
        'expected_delivery_date',
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
            'expected_delivery_date' => 'date',
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

    public function quotation(): BelongsTo
    {
        return $this->belongsTo(Quotation::class);
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function lines(): HasMany
    {
        return $this->hasMany(SalesOrderLine::class)->orderBy('sort_order');
    }

    public function syncApprovalStatus(ApprovalStatus $status): void
    {
        DB::transaction(function () use ($status): void {
            $this->status = match ($status) {
                ApprovalStatus::Approved => SalesOrderStatus::Approved->value,
                ApprovalStatus::Rejected => SalesOrderStatus::Cancelled->value,
                ApprovalStatus::Returned => SalesOrderStatus::Draft->value,
                ApprovalStatus::Cancelled => SalesOrderStatus::Cancelled->value,
                ApprovalStatus::Pending => 'pending_approval',
            };

            if ($status === ApprovalStatus::Approved) {
                $this->approved_at = now();
            }

            $this->saveQuietly();
        });
    }
}
