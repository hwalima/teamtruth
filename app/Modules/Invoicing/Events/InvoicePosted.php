<?php

namespace App\Modules\Invoicing\Events;

use App\Models\User;
use App\Modules\Invoicing\Models\Invoice;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Dispatched when an invoice is posted to the general ledger.
 * Consumed by the Accounting module to create the receivable journal entry.
 */
class InvoicePosted
{
    use Dispatchable;

    public function __construct(
        public Invoice $invoice,
        public User $actor,
    ) {}
}
