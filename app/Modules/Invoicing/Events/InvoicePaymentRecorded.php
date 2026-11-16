<?php

namespace App\Modules\Invoicing\Events;

use App\Models\User;
use App\Modules\Invoicing\Models\InvoicePayment;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Dispatched when a payment (or credit-note allocation) is recorded against an invoice.
 * Consumed by the Accounting module to create the cash/bank vs receivable entry.
 */
class InvoicePaymentRecorded
{
    use Dispatchable;

    public function __construct(
        public InvoicePayment $payment,
        public User $actor,
    ) {}
}
