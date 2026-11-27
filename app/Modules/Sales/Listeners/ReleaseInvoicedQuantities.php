<?php

namespace App\Modules\Sales\Listeners;

use App\Modules\Core\Services\AuditLogService;
use App\Modules\Invoicing\Events\InvoiceCancelled;
use App\Modules\Invoicing\Models\InvoiceLine;
use App\Modules\Sales\Models\SalesOrder;
use App\Modules\Sales\Models\SalesOrderLine;
use Illuminate\Support\Facades\DB;

/**
 * When an invoice raised from a sales order is cancelled, take its quantities
 * off the order lines' invoiced quantity so they can be invoiced again.
 */
class ReleaseInvoicedQuantities
{
    public function handle(InvoiceCancelled $event): void
    {
        $invoice = $event->invoice;
        $orderIds = DB::table('sal_sales_order_invoices')->where('invoice_id', $invoice->id)->pluck('sales_order_id');
        if ($orderIds->isEmpty()) {
            return;
        }

        DB::transaction(function () use ($event, $invoice, $orderIds): void {
            $orderLines = SalesOrderLine::query()->withoutGlobalScopes()
                ->where('company_id', $invoice->company_id)
                ->whereIn('sales_order_id', $orderIds)
                ->lockForUpdate()->get();
            $released = [];

            foreach ($invoice->lines()->get() as $invoiceLine) {
                $orderLine = $this->orderLineFor($invoiceLine, $orderLines);
                if (! $orderLine) {
                    continue;
                }
                $left = bcsub((string) $orderLine->invoiced_quantity, (string) $invoiceLine->quantity, 4);
                $orderLine->invoiced_quantity = bccomp($left, '0', 4) > 0 ? $left : '0.0000';
                $orderLine->save();
                $released[] = ['line_id' => $orderLine->id, 'quantity' => (string) $invoiceLine->quantity];
            }

            if ($released === []) {
                return;
            }
            foreach (SalesOrder::query()->withoutGlobalScopes()->whereIn('id', $orderIds)->get() as $order) {
                app(AuditLogService::class)->record($order->company, 'sales.order.invoice_cancelled', $order, changes: [
                    'invoice_id' => $invoice->id,
                    'lines' => array_values(array_filter($released, fn (array $row): bool => $orderLines->firstWhere('id', $row['line_id'])?->sales_order_id === $order->id)),
                ], actor: $event->actor);
            }
        });
    }

    /** The order line an invoice line billed: recorded on the line, or for older invoices matched by product and description. */
    private function orderLineFor(InvoiceLine $invoiceLine, $orderLines): ?SalesOrderLine
    {
        $id = $invoiceLine->metadata['sales_order_line_id'] ?? null;
        if ($id !== null) {
            return $orderLines->firstWhere('id', (int) $id);
        }

        return $orderLines->first(fn (SalesOrderLine $line): bool => (int) $line->product_id === (int) $invoiceLine->product_id
            && $line->description === $invoiceLine->name
            && bccomp((string) $line->invoiced_quantity, '0', 4) > 0);
    }
}
