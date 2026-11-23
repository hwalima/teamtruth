<?php

use App\Models\Currency;
use App\Models\User;
use App\Modules\Core\Models\AuditEvent;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Inventory\Models\InventoryProduct;
use App\Modules\Inventory\Models\InventoryUnit;
use App\Modules\Inventory\Models\InventoryWarehouse;
use App\Modules\Inventory\Models\StockLocation;
use App\Modules\Inventory\Services\InventoryStockService;
use App\Modules\Invoicing\Models\Customer;
use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Sales\Models\Delivery;
use App\Modules\Sales\Models\SalesOrder;

beforeEach(function () {
    $this->user = User::factory()->create(['name' => 'Sam Seller', 'email' => 'seller@example.test']);
    $this->company = Company::create(['code' => 'SMP', 'name' => 'Sample Mining', 'default_currency' => 'USD']);
    $this->company->users()->attach($this->user->id, ['role' => 'owner', 'is_active' => true]);
    Currency::firstOrCreate(['code' => 'USD'], ['name' => 'US Dollar', 'symbol' => '$']);
    $this->actingAs($this->user)->withSession(['active_erp_company_id' => $this->company->id]);
    app(CompanyContext::class)->setActiveCompany($this->company);

    $unit = InventoryUnit::create(['name' => 'Each', 'abbreviation' => 'ea', 'category' => 'quantity', 'factor_to_base' => '1', 'is_base' => true, 'is_active' => true]);
    $this->product = InventoryProduct::create(['unit_id' => $unit->id, 'sku' => 'DRL-1', 'name' => 'Drill bit', 'type' => 'storable', 'costing_method' => 'average', 'tracking' => 'none', 'sale_price' => '80.0000', 'is_active' => true]);
    $this->customer = Customer::create(['code' => 'C-1', 'name' => 'Beta Construction', 'currency_code' => 'USD', 'is_active' => true]);

    $warehouse = InventoryWarehouse::create(['code' => 'MAIN', 'name' => 'Main store', 'is_active' => true]);
    $supplier = StockLocation::create(['warehouse_id' => $warehouse->id, 'code' => 'SUP', 'name' => 'Suppliers', 'usage' => 'supplier', 'is_active' => true]);
    $this->store = StockLocation::create(['warehouse_id' => $warehouse->id, 'code' => 'STORE', 'name' => 'Main store', 'usage' => 'internal', 'is_active' => true]);
    app(InventoryStockService::class)->postMovement($this->company, $this->user, [
        'operation' => 'receipt', 'product_id' => $this->product->id, 'from_location_id' => $supplier->id,
        'to_location_id' => $this->store->id, 'quantity' => '20',
    ]);
});

/** An approved order: 10 drill bits at 80 (goods) and one installation at 200 (service, no product). */
function approvedOrder(string $status = 'approved'): SalesOrder
{
    $order = SalesOrder::create([
        'customer_id' => test()->customer->id, 'document_number' => 'SMP/SO/0001', 'status' => $status,
        'currency_code' => 'USD', 'subtotal' => '1000.0000', 'total' => '1000.0000', 'created_by' => test()->user->id,
        'customer_reference' => 'PO-7781',
    ]);
    $order->lines()->create([
        'product_id' => test()->product->id, 'description' => 'Drill bit', 'quantity' => '10', 'unit_price' => '80',
        'discount' => '0', 'tax_rate' => '0', 'total' => '800.0000', 'sort_order' => 1,
    ]);
    $order->lines()->create([
        'product_id' => null, 'description' => 'Installation', 'quantity' => '1', 'unit_price' => '200',
        'discount' => '0', 'tax_rate' => '0', 'total' => '200.0000', 'sort_order' => 2,
    ]);

    return $order->load('lines');
}

test('the sales order list searches and shows progress', function () {
    approvedOrder();
    $other = Customer::create(['code' => 'C-2', 'name' => 'Delta Holdings', 'currency_code' => 'USD', 'is_active' => true]);
    SalesOrder::create(['customer_id' => $other->id, 'document_number' => 'SMP/SO/0002', 'status' => 'draft', 'currency_code' => 'USD', 'created_by' => $this->user->id]);

    $this->get(route('erp.sales.orders.index'))->assertOk()
        ->assertInertia(fn ($page) => $page->component('Erp/Sales/Orders/Index')
            ->has('orders.data', 2)
            ->where('counts.approved', 1)
            ->where('counts.draft', 1));

    $this->get(route('erp.sales.orders.index', ['search' => 'PO-7781']))
        ->assertInertia(fn ($page) => $page->has('orders.data', 1)
            ->where('orders.data.0.document_number', 'SMP/SO/0001')
            ->where('orders.data.0.delivered_percent', 0)
            ->where('orders.data.0.can_deliver', true)
            ->where('orders.data.0.can_invoice', true));
});

test('the order page lists lines with stock on hand to deliver from', function () {
    $order = approvedOrder();

    $this->get(route('erp.sales.orders.show', $order))->assertOk()
        ->assertInertia(fn ($page) => $page->component('Erp/Sales/Orders/Show')
            ->where('order.lines.0.needs_delivery', true)
            ->where('order.lines.0.to_deliver', '10.0000')
            ->where('order.lines.0.stock.0.location_id', $this->store->id)
            ->where('order.lines.0.stock.0.quantity', '20.0000')
            ->where('order.lines.1.needs_delivery', false)
            ->where('order.lines.1.to_invoice', '1.0000'));
});

test('goods are delivered in parts, taking stock out, and the order follows', function () {
    $order = approvedOrder();
    $goods = $order->lines[0];

    $this->post(route('erp.sales.orders.deliver', $order), ['lines' => [
        ['sales_order_line_id' => $goods->id, 'quantity' => '4', 'location_id' => $this->store->id],
    ]])->assertSessionHasNoErrors()->assertSessionHas('success');

    expect($order->fresh()->status)->toBe('partially_delivered')
        ->and($goods->fresh()->delivered_quantity)->toBe('4.0000')
        ->and(app(InventoryStockService::class)->quantityOnHand($this->company, $this->product->id, $this->store->id, null))->toBe('16.0000')
        ->and(StockLocation::query()->where('usage', 'customer')->count())->toBe(1)
        ->and(Delivery::query()->sole()->document_number)->toContain('SALES_DELIVERY')
        ->and(AuditEvent::query()->where('event', 'sales.order.delivered')->count())->toBe(1);

    // More than is left on the order is refused, and so is a service line.
    $this->post(route('erp.sales.orders.deliver', $order), ['lines' => [
        ['sales_order_line_id' => $goods->id, 'quantity' => '7', 'location_id' => $this->store->id],
    ]])->assertSessionHasErrors('lines.0.quantity');
    $this->post(route('erp.sales.orders.deliver', $order), ['lines' => [
        ['sales_order_line_id' => $order->lines[1]->id, 'quantity' => '1', 'location_id' => $this->store->id],
    ]])->assertSessionHasErrors('lines.0.quantity');

    $this->post(route('erp.sales.orders.deliver', $order), ['lines' => [
        ['sales_order_line_id' => $goods->id, 'quantity' => '6', 'location_id' => $this->store->id],
    ]])->assertSessionHasNoErrors();

    expect($order->fresh()->status)->toBe('delivered')
        ->and(app(InventoryStockService::class)->quantityOnHand($this->company, $this->product->id, $this->store->id, null))->toBe('10.0000');
});

test('a delivery cannot take more than the store holds', function () {
    $order = approvedOrder();
    $order->lines[0]->update(['quantity' => '50']);

    $this->post(route('erp.sales.orders.deliver', $order), ['lines' => [
        ['sales_order_line_id' => $order->lines[0]->id, 'quantity' => '30', 'location_id' => $this->store->id],
    ]])->assertSessionHasErrors('quantity');

    expect(Delivery::query()->count())->toBe(0)
        ->and($order->lines[0]->fresh()->delivered_quantity)->toBe('0.0000');
});

test('invoicing bills what was delivered plus services, and the rest later', function () {
    $order = approvedOrder();
    $goods = $order->lines[0];
    $this->post(route('erp.sales.orders.deliver', $order), ['lines' => [
        ['sales_order_line_id' => $goods->id, 'quantity' => '4', 'location_id' => $this->store->id],
    ]]);

    $response = $this->post(route('erp.sales.orders.invoice', $order));
    $first = Invoice::query()->with('lines')->sole();
    $response->assertRedirect(route('erp.invoicing.show', $first));

    // 4 × 80 delivered + the installation at 200.
    expect($first->total_amount)->toBe('520.0000')
        ->and($first->lines)->toHaveCount(2)
        ->and($first->notes)->toContain('PO-7781')
        ->and($goods->fresh()->invoiced_quantity)->toBe('4.0000')
        ->and($order->fresh()->invoice_id)->toBe($first->id);

    // Nothing new has gone out, so there is nothing to invoice.
    $this->post(route('erp.sales.orders.invoice', $order))->assertSessionHasErrors('sales_order');

    $this->post(route('erp.sales.orders.deliver', $order), ['lines' => [
        ['sales_order_line_id' => $goods->id, 'quantity' => '6', 'location_id' => $this->store->id],
    ]]);
    $this->post(route('erp.sales.orders.invoice', $order));

    $second = Invoice::query()->whereKeyNot($first->id)->sole();
    expect($second->total_amount)->toBe('480.0000')
        ->and($order->fresh()->invoices()->count())->toBe(2);
    $this->get(route('erp.sales.orders.show', $order))
        ->assertInertia(fn ($page) => $page->has('order.invoices', 2)->where('order.invoiced_percent', 100)->where('order.can_invoice', false));
});

test('orders can only be delivered once approved', function () {
    $order = approvedOrder('draft');

    $this->post(route('erp.sales.orders.deliver', $order), ['lines' => [
        ['sales_order_line_id' => $order->lines[0]->id, 'quantity' => '1', 'location_id' => $this->store->id],
    ]])->assertSessionHasErrors('sales_order');
    $this->post(route('erp.sales.orders.invoice', $order))->assertSessionHasErrors('sales_order');
});

test('an untouched order can be cancelled or deleted, a delivered one is kept', function () {
    $draft = approvedOrder('draft');
    $this->delete(route('erp.sales.orders.destroy', $draft))->assertRedirect(route('erp.sales.orders.index'));
    expect(SalesOrder::query()->count())->toBe(0);

    $order = approvedOrder();
    $order->update(['document_number' => 'SMP/SO/0002']);
    $this->post(route('erp.sales.orders.deliver', $order), ['lines' => [
        ['sales_order_line_id' => $order->lines[0]->id, 'quantity' => '1', 'location_id' => $this->store->id],
    ]]);
    $this->post(route('erp.sales.orders.cancel', $order))->assertSessionHasErrors('sales_order');
    $this->delete(route('erp.sales.orders.destroy', $order))->assertSessionHasErrors('sales_order');

    $fresh = approvedOrder();
    $fresh->update(['document_number' => 'SMP/SO/0003']);
    $this->post(route('erp.sales.orders.cancel', $fresh))->assertSessionHasNoErrors();
    expect($fresh->fresh()->status)->toBe('cancelled')
        ->and(AuditEvent::query()->where('event', 'sales.order.cancelled')->count())->toBe(1);
});

test('members can see orders but not deliver, invoice, cancel or delete them', function () {
    $order = approvedOrder();
    $member = User::factory()->create();
    $this->company->users()->attach($member->id, ['role' => 'member', 'is_active' => true]);
    $this->actingAs($member);

    $this->post(route('erp.sales.orders.deliver', $order), ['lines' => [
        ['sales_order_line_id' => $order->lines[0]->id, 'quantity' => '1', 'location_id' => $this->store->id],
    ]])->assertForbidden();
    $this->post(route('erp.sales.orders.invoice', $order))->assertForbidden();
    $this->post(route('erp.sales.orders.cancel', $order))->assertForbidden();
    $this->delete(route('erp.sales.orders.destroy', $order))->assertForbidden();
});

test('an order from another company cannot be opened', function () {
    $order = approvedOrder();
    $other = Company::create(['code' => 'OTH', 'name' => 'Other Co', 'default_currency' => 'USD']);
    $other->users()->attach($this->user->id, ['role' => 'owner', 'is_active' => true]);
    app(CompanyContext::class)->setActiveCompany($other);

    $this->withSession(['active_erp_company_id' => $other->id])->get(route('erp.sales.orders.show', $order))->assertNotFound();
});
