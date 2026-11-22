<?php

namespace App\Modules\Banking\Models;

use App\Models\User;
use App\Modules\Core\Models\Company;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A request to move money out of one company's account into another
 * company's account. It needs the paying company's manager to approve it
 * before the transfer can be made.
 */
class FundRequest extends Model
{
    public const PENDING = 'pending';

    public const APPROVED = 'approved';

    public const REJECTED = 'rejected';

    public const TRANSFERRED = 'transferred';

    public const CANCELLED = 'cancelled';

    public const STATUSES = [self::PENDING, self::APPROVED, self::REJECTED, self::TRANSFERRED, self::CANCELLED];

    protected $table = 'banking_fund_requests';

    protected $fillable = [
        'reference', 'from_account_id', 'to_account_id', 'from_company_id', 'to_company_id', 'amount', 'currency', 'purpose', 'status',
        'requested_by', 'requested_at', 'requester_name', 'requester_title', 'requester_signature_path',
        'decided_by', 'decided_at', 'approver_name', 'approver_title', 'approver_signature_path', 'decision_note',
        'transfer_id', 'transferred_by', 'transferred_at', 'cancelled_at',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'requested_at' => 'datetime',
            'decided_at' => 'datetime',
            'transferred_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    public function fromAccount(): BelongsTo
    {
        return $this->belongsTo(BankAccount::class, 'from_account_id');
    }

    public function toAccount(): BelongsTo
    {
        return $this->belongsTo(BankAccount::class, 'to_account_id');
    }

    public function fromCompany(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'from_company_id');
    }

    public function toCompany(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'to_company_id');
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function decider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }

    public function transfer(): BelongsTo
    {
        return $this->belongsTo(BankTransfer::class, 'transfer_id');
    }

    public function transferrer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'transferred_by');
    }
}
