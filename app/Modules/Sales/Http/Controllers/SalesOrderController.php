<?php

namespace App\Modules\Sales\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\DocumentRenderer;
use App\Modules\Inventory\Models\StockLocation;
use App\Modules\Inventory\Services\InventoryStockService;
use App\Modules\Sales\Models\Delivery;
use App\Modules\Sales\Models\SalesOrder;
use App\Modules\Sales\Models\SalesOrderLine;
use App\Modules\Sales\Services\SalesService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Inertia\Inertia;
use Inertia\Response;

/** Sales orders: the list, the order page, delivering goods from stock and invoicing what went out. */
class SalesOrderController extends Controller
{
    public const STATUSES = ['draft', 'pending_approval', 'approved', 'partially_delivered', 'delivered', 'cancelled'];

    public function __construct(private SalesService $salesService) {}

    public function index(Request $request): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $search = trim((string) $request->query('search', ''));
        $status = in_array($request->query('status'), self::STATUSES, true) ? $request->query('status') : 'all';

        $counts = SalesOrder::query()->where('company_id', $company->id)
            ->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status')
            ->map(fn ($total) => (int) $total);

        $orders = SalesOrder::query()->where('company_id', $company->id)
            ->when($status !== 'all', fn ($query) => $query->where('status', $status))
            ->when($search !== '', fn ($query) => $query->where(fn ($query) => $query
                ->where('document_number', 'like', "%{$search}%")
                ->orWhere('customer_reference', 'like', "%{$search}%")
                ->orWhereHas('customer', fn ($customer) => $customer->where('name', 'like', "%{$search}%")->orWhere('code', 'like', "%{$search}%"))))
            ->with(['customer:id,name,code', 'quotation:id,document_number', 'lines.product:id,type'])
            ->withCount(['deliveries', 'invoices', 'approvalRequests'])
            ->latest('id')
            ->paginate(20)
            ->withQueryString()
            ->through(fn (SalesOrder $order) => [
                'id' => $order->id,
                'document_number' => $order->document_number,
                'status' => $order->status,
                'currency_code' => $order->currency_code,
                'total' => $order->total,
                'expected_delivery_date' => $order->expected_delivery_date?->toDateString(),
                'created_at' => $order->created_at?->toDateString(),
                'customer' => $order->customer?->only(['id', 'name', 'code']),
                'quotation' => $order->quotation?->only(['id', 'document_number']),
                'customer_reference' => $order->customer_reference,
                ...$this->progress($order),
                ...$this->flags($order),
            ]);

        return Inertia::render('Erp/Sales/Orders/Index', [
            'company' => $company->only(['id', 'code', 'name']),
            'orders' => $orders,
            'filters' => ['search' => $search, 'status' => $status],
            'counts' => collect(self::STATUSES)->mapWithKeys(fn ($key) => [$key => $counts[$key] ?? 0]),
            'canManage' => $this->allowsErpPermission('erp.sales.manage'),
        ]);
    }

    public function show(SalesOrder $salesOrder, InventoryStockService $stock): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $salesOrder->load([
            'customer:id,code,name,email,phone,billing_address',
            'quotation:id,document_number',
            'creator:id,name',
            'lines.product:id,sku,name,type,tracking,unit_id',
            'lines.product.unit:id,abbreviation',
            'deliveries.deliveredBy:id,name',
            'deliveries.lines.orderLine:id,description',
            'deliveries.lines.location:id,code,name',
            'invoices:id,document_number,status,total_amount,currency_code,invoice_date',
        ])->loadCount(['deliveries', 'invoices', 'approvalRequests']);

        // Stock on hand for the products on this order, per store location, so the delivery form can offer them.
        $productIds = $salesOrder->lines->pluck('product_id')->filter()->unique();
        $locations = StockLocation::query()->where('company_id', $company->id)->where('usage', 'internal')->where('is_active', true)
            ->get(['id', 'code', 'name'])->keyBy('id');
        $onHand = collect($stock->balances($company))
            ->filter(fn (object $row) => $productIds->contains($row->product_id) && $locations->has($row->location_id))
            ->groupBy('product_id')
            ->map(fn ($rows) => $rows->map(fn (object $row) => [
                'location_id' => $row->location_id,
                'location' => $locations[$row->location_id]->code.' · '.$locations[$row->location_id]->name,
                'lot_code' => $row->lot_code,
                'quantity' => $row->quantity,
            ])->values());

        return Inertia::render('Erp/Sales/Orders/Show', [
            'order' => [
                ...$salesOrder->only([
                    'id', 'document_number', 'status', 'currency_code', 'subtotal', 'discount_total', 'tax_total', 'total',
                    'customer_reference', 'notes', 'customer', 'quotation', 'creator',
                ]),
                'expected_delivery_date' => $salesOrder->expected_delivery_date?->toDateString(),
                'created_at' => $salesOrder->created_at?->toIso8601String(),
                'submitted_at' => $salesOrder->submitted_at?->toIso8601String(),
                'approved_at' => $salesOrder->approved_at?->toIso8601String(),
                'lines' => $salesOrder->lines->map(fn (SalesOrderLine $line) => [
                    ...$line->only(['id', 'description', 'quantity', 'delivered_quantity', 'invoiced_quantity', 'unit_price', 'discount', 'tax_rate', 'total', 'notes']),
                    'product' => $line->product ? [
                        ...$line->product->only(['id', 'sku', 'name', 'tracking']),
                        'unit' => $line->product->unit?->abbreviation,
                    ] : null,
                    'needs_delivery' => $line->needsDelivery(),
                    'to_deliver' => $line->needsDelivery() ? bcsub((string) $line->quantity, (string) $line->delivered_quantity, 4) : '0.0000',
                    'to_invoice' => SalesService::invoiceableQuantity($line),
                    'stock' => $onHand->get($line->product_id, []),
                ]),
                'deliveries' => $salesOrder->deliveries->map(fn (Delivery $delivery) => [
                    'id' => $delivery->id,
                    'kind' => $delivery->kind ?? Delivery::KIND_DELIVERY,
                    'document_number' => $delivery->document_number,
                    'delivered_at' => $delivery->delivered_at?->toIso8601String(),
                    'delivered_by' => $delivery->deliveredBy?->name,
                    'notes' => $delivery->notes,
                    'lines' => $delivery->lines->map(fn ($line) => [
                        'id' => $line->id,
                        'description' => $line->orderLine?->description,
                        'quantity' => $line->quantity,
                        'location' => $line->location ? $line->location->code.' · '.$line->location->name : null,
                        'lot_code' => $line->lot_code,
                    ]),
                ]),
                'invoices' => $salesOrder->invoices->map(fn ($invoice) => $invoice->only(['id', 'document_number', 'status', 'total_amount', 'currency_code']) + [
                    'invoice_date' => $invoice->invoice_date?->toDateString(),
                ]),
                ...$this->progress($salesOrder),
                ...$this->flags($salesOrder),
            ],
            // Store locations returned goods can go back to.
            'locations' => $locations->values()->map(fn (StockLocation $location) => ['id' => $location->id, 'label' => $location->code.' · '.$location->name]),
            'canManage' => $this->allowsErpPermission('erp.sales.manage'),
            'canInvoice' => $this->allowsErpPermission('erp.invoicing.view'),
        ]);
    }

    public function deliver(Request $request, SalesOrder $salesOrder): RedirectResponse
    {
        $this->authorizeErpPermission('erp.sales.manage');
        $data = $request->validate([
            'notes' => ['nullable', 'string', 'max:2000'],
            'lines' => ['required', 'array', 'min:1', 'max:200'],
            'lines.*.sales_order_line_id' => ['required', 'integer'],
            'lines.*.quantity' => ['nullable', 'numeric', 'min:0'],
            'lines.*.location_id' => ['nullable', 'integer'],
            'lines.*.lot_code' => ['nullable', 'string', 'max:100'],
        ]);
        $delivery = $this->salesService->deliverSalesOrder($salesOrder, $request->user(), $data['lines'], $data['notes'] ?? null);

        return back()->with('success', 'Delivery '.$delivery->document_number.' recorded and stock updated.');
    }

    public function returnGoods(Request $request, SalesOrder $salesOrder): RedirectResponse
    {
        $this->authorizeErpPermission('erp.sales.manage');
        $data = $request->validate([
            'reason' => ['required', 'string', 'max:2000'],
            'lines' => ['required', 'array', 'min:1', 'max:200'],
            'lines.*.sales_order_line_id' => ['required', 'integer'],
            'lines.*.quantity' => ['nullable', 'numeric', 'min:0'],
            'lines.*.location_id' => ['nullable', 'integer'],
            'lines.*.lot_code' => ['nullable', 'string', 'max:100'],
        ]);
        $result = $this->salesService->returnFromCustomer($salesOrder, $request->user(), $data['lines'], $data['reason']);
        $message = 'Return '.$result['return']->document_number.' recorded and the goods are back in stock.';
        if ($result['invoiced_quantity_returned']) {
            $message .= ' Some of these goods were already invoiced: raise a credit note for them in Invoicing.';
        }

        return back()->with('success', $message);
    }

    /** The delivery note (or return note) as a branded PDF, to go with the goods and be signed. */
    public function deliveryPdf(SalesOrder $salesOrder, Delivery $delivery, DocumentRenderer $renderer): HttpResponse
    {
        abort_unless((int) $delivery->sales_order_id === (int) $salesOrder->id, 404);
        $delivery->loadMissing(['salesOrder.customer', 'deliveredBy', 'lines.orderLine.product.unit', 'lines.location']);
        $name = ($delivery->isReturn() ? 'return-note-' : 'delivery-note-').preg_replace('/[^A-Za-z0-9_-]+/', '-', $delivery->document_number).'.pdf';

        return response($renderer->render($delivery, 'pdf.documents.delivery-note'), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$name.'"',
        ]);
    }

    public function invoice(Request $request, SalesOrder $salesOrder): RedirectResponse
    {
        $this->authorizeErpPermission('erp.sales.manage');
        $invoice = $this->salesService->createInvoiceFromSalesOrder($salesOrder, $request->user());

        return redirect()->route('erp.invoicing.show', $invoice)
            ->with('success', 'Invoice '.$invoice->document_number.' created from sales order '.$salesOrder->document_number.'.');
    }

    public function cancel(Request $request, SalesOrder $salesOrder): RedirectResponse
    {
        $this->authorizeErpPermission('erp.sales.manage');
        $order = $this->salesService->cancelSalesOrder($salesOrder, $request->user());

        return back()->with('success', 'Sales order '.$order->document_number.' cancelled.');
    }

    public function destroy(Request $request, SalesOrder $salesOrder): RedirectResponse
    {
        $this->authorizeErpPermission('erp.sales.manage');
        $number = $salesOrder->document_number;
        $this->salesService->deleteSalesOrder($salesOrder, $request->user());

        return redirect()->route('erp.sales.orders.index')->with('success', 'Sales order '.$number.' deleted.');
    }

    /** Delivered and invoiced shares of the order, as percentages of the goods and of the whole order. */
    private function progress(SalesOrder $order): array
    {
        $goods = $order->lines->filter(fn (SalesOrderLine $line) => $line->needsDelivery());
        $ordered = $goods->reduce(fn ($sum, $line) => bcadd($sum, (string) $line->quantity, 4), '0');
        $delivered = $goods->reduce(fn ($sum, $line) => bcadd($sum, (string) min((float) $line->delivered_quantity, (float) $line->quantity), 4), '0');
        $all = $order->lines->reduce(fn ($sum, $line) => bcadd($sum, (string) $line->quantity, 4), '0');
        $invoiced = $order->lines->reduce(fn ($sum, $line) => bcadd($sum, (string) $line->invoiced_quantity, 4), '0');

        return [
            'has_goods' => $goods->isNotEmpty(),
            'delivered_percent' => bccomp($ordered, '0', 4) > 0 ? (int) floor((float) bcdiv(bcmul($delivered, '100', 4), $ordered, 4)) : null,
            'invoiced_percent' => bccomp($all, '0', 4) > 0 ? min(100, (int) floor((float) bcdiv(bcmul($invoiced, '100', 4), $all, 4))) : 0,
            'can_invoice' => in_array($order->status, SalesService::OPEN_ORDER_STATUSES, true)
                && $order->lines->contains(fn (SalesOrderLine $line) => bccomp(SalesService::invoiceableQuantity($line), '0', 4) > 0),
        ];
    }

    private function flags(SalesOrder $order): array
    {
        $untouched = (int) $order->deliveries_count === 0 && (int) $order->invoices_count === 0 && $order->invoice_id === null;

        return [
            'can_submit' => $order->status === 'draft',
            'can_deliver' => in_array($order->status, ['approved', 'partially_delivered'], true) && $order->lines->contains(fn (SalesOrderLine $line) => $line->needsDelivery()),
            'can_return' => in_array($order->status, ['partially_delivered', 'delivered'], true) && $order->lines->contains(fn (SalesOrderLine $line) => $line->needsDelivery() && bccomp((string) $line->delivered_quantity, '0', 4) > 0),
            'can_cancel' => in_array($order->status, ['draft', 'pending_approval', 'approved'], true) && $untouched,
            'can_delete' => in_array($order->status, ['draft', 'cancelled'], true) && $untouched && (int) $order->approval_requests_count === 0,
        ];
    }
}
