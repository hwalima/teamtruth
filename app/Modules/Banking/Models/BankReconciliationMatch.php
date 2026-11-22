<?php

namespace App\Modules\Banking\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One recorded payment matched to a statement line. */
class BankReconciliationMatch extends Model
{
    public const CUSTOMER_PAYMENT = 'customer_payment';

    public const VENDOR_PAYMENT = 'vendor_payment';

    protected $table = 'banking_reconciliation_matches';

    protected $fillable = ['transaction_id', 'company_id', 'matchable_type', 'matchable_id', 'amount', 'created_by'];

    protected function casts(): array
    {
        return ['amount' => 'decimal:2', 'matchable_id' => 'integer'];
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(BankTransaction::class, 'transaction_id');
    }
}
