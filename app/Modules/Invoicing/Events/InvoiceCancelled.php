<?php

namespace App\Modules\Invoicing\Events;

use App\Models\User;
use App\Modules\Invoicing\Models\Invoice;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Dispatched when an invoice is cancelled.
 * Consumed by the Sales module to give the quantities back to the sales order.
 */
class InvoiceCancelled
{
    use Dispatchable;

    public function __construct(
        public Invoice $invoice,
        public User $actor,
    ) {}
}
