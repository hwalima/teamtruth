<?php

namespace App\Modules\Invoicing\Events;

use App\Models\User;
use App\Modules\Invoicing\Models\CreditNote;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Dispatched when a credit note is issued.
 * Consumed by the Accounting module to post the reversal entry (credit receivable,
 * debit revenue/tax).
 */
class CreditNoteIssued
{
    use Dispatchable;

    public function __construct(
        public CreditNote $creditNote,
        public User $actor,
    ) {}
}
