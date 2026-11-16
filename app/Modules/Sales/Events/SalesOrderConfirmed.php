<?php

namespace App\Modules\Sales\Events;

use App\Modules\Sales\Models\SalesOrder;
use Illuminate\Queue\SerializesModels;

class SalesOrderConfirmed
{
    use SerializesModels;

    public function __construct(
        public SalesOrder $salesOrder,
    ) {
    }
}
