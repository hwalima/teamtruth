<?php

use App\Models\Currency;
use App\Models\User;
use App\Modules\Core\Models\Company;
use App\Modules\Accounting\Models\AccountingAccount;
use App\Modules\Inventory\Models\InventoryProduct;
use App\Modules\Inventory\Models\InventoryUnit;
use App\Modules\Inventory\Models\InventoryWarehouse;
use App\Modules\Inventory\Models\StockLocation;
use App\Modules\Purchase\Models\PurchaseOrder;
use App\Modules\Purchase\Models\PurchaseOrderLine;
use App\Modules\Purchase\Models\PurchaseBlanketOrder;
use App\Modules\Purchase\Models\PurchaseVendor;
use App\Modules\Purchase\Models\PurchaseVendorEvaluation;
use App\Modules\Purchase\Models\PurchaseVendorPriceList;
use App\Modules\Purchase\Services\PurchaseService;
use Illuminate\Support\Facades\DB;

function purchasePhaseThreeFixture(string $code): array
{
    $user = User::factory()->create();
    $company = Company::create(['code' => $code, 'name' => "{$code} Company", 'default_currency' => 'USD']);
    $company->users()->attach($user->id, ['role' => 'owner', 'is_active' => true]);
    Currency::firstOrCreate(['code' => 'USD'], ['name' => 'US Dollar', 'symbol' => '$']);
    app(\App\Modules\Core\Services\CompanyContext::class)->setActiveCompany($company);
    $unit = InventoryUnit::create([
        'name' => 'Each', 'abbreviation' => 'ea', 'category' => 'quantity', 'factor_to_base' => '1', 'is_base' => true, 'is_active' => true,
    ]);
    $product = InventoryProduct::create([
        'unit_id' => $unit->id, 'sku' => "{$code}-SKU", 'name' => 'Test item', 'type' => 'storable',
        'costing_method' => 'average', 'tracking' => 'none', 'is_active' => true,
    ]);
    $vendor = PurchaseVendor::create(['code' => "{$code}-V", 'name' => 'Test vendor', 'payment_terms_days' => 30, 'currency_code' => 'USD', 'is_active' => true]);
    app(\App\Modules\Core\Services\CompanyContext::class)->setActiveCompany(null);

    return [$user, $company, $product, $vendor];
}

test('blanket orders and vendor price lists are created for the active company', function () {
    [$user, $company, $product, $vendor] = purchasePhaseThreeFixture('P3F');
    $this->actingAs($user)->withSession(['active_erp_company_id' => $company->id])
        ->post(route('erp.purchase.blanket-orders.store'), [
            'vendor_id' => $vendor->id, 'currency_code' => 'USD', 'max_amount' => '500.0000',
            'starts_on' => '2026-01-01', 'ends_on' => '2026-12-31',
            'lines' => [['product_id' => $product->id, 'quantity' => '10', 'unit_price' => '20']],
        ])->assertRedirect()->assertSessionHas('success');

    $blanket = PurchaseBlanketOrder::query()->with('lines')->firstOrFail();
    expect($blanket->vendor_id)->toBe($vendor->id)->and($blanket->lines)->toHaveCount(1);

    $this->post(route('erp.purchase.vendors.price-lists.store'), [
        'vendor_id' => $vendor->id, 'product_id' => $product->id, 'min_quantity' => '2', 'price' => '18.25',
        'currency_code' => 'USD', 'valid_from' => '2026-01-01', 'valid_to' => '2026-12-31',
    ])->assertRedirect()->assertSessionHas('success');
    expect(PurchaseVendorPriceList::query()->count())->toBe(1);
});

test('purchase returns move received stock back to the supplier and prevent excess returns', function () {
    [$user, $company, $product, $vendor] = purchasePhaseThreeFixture('P3R');
    app(\App\Modules\Core\Services\CompanyContext::class)->setActiveCompany($company);
    $warehouse = InventoryWarehouse::create(['code' => 'MAIN', 'name' => 'Main', 'is_active' => true]);
    $supplier = StockLocation::create(['warehouse_id' => $warehouse->id, 'code' => 'SUP', 'name' => 'Supplier', 'usage' => 'supplier', 'is_active' => true]);
    $stock = StockLocation::create(['warehouse_id' => $warehouse->id, 'code' => 'STK', 'name' => 'Stock', 'usage' => 'internal', 'is_active' => true]);
    $order = PurchaseOrder::create([
        'document_number' => 'P3R/PO/1', 'vendor_id' => $vendor->id, 'status' => 'approved',
        'currency_code' => 'USD', 'total' => '20.0000', 'created_by' => $user->id,
    ]);
    $orderLine = PurchaseOrderLine::create([
        'purchase_order_id' => $order->id, 'product_id' => $product->id, 'quantity' => '2.0000',
        'received_quantity' => '0.0000', 'unit_price' => '10.0000', 'line_total' => '20.0000',
    ]);
    $receipt = app(PurchaseService::class)->receiveOrderLine($order, $orderLine, $user, '2.0000', $supplier->id, $stock->id);
    $receiptLine = $receipt->lines()->firstOrFail();
    $account = AccountingAccount::create(['code' => '6100', 'name' => 'Freight in', 'account_type' => 'expense', 'is_group' => false, 'is_active' => true]);
    $landedCost = app(PurchaseService::class)->createLandedCost($user, [
        'purchase_receipt_id' => $receipt->id, 'vendor_id' => $vendor->id, 'currency_code' => 'USD',
    ], [['product_id' => '', 'account_id' => $account->id, 'name' => 'Freight', 'amount' => '30.0000', 'split_method' => 'by_quantity']]);
    expect($landedCost->total_amount)->toBe('30.0000')
        ->and((string) DB::table('purchase_landed_cost_allocations')->where('purchase_landed_cost_line_id', $landedCost->lines->first()->id)->value('amount'))->toBe('30');
    $purchaseReturn = app(PurchaseService::class)->createPurchaseReturn($user, [
        'purchase_receipt_id' => $receipt->id, 'source_location_id' => $stock->id,
        'destination_location_id' => $supplier->id, 'return_date' => '2026-11-16', 'reason' => 'Damaged goods',
    ], [['purchase_receipt_line_id' => $receiptLine->id, 'quantity' => '1.0000']]);
    expect($purchaseReturn->status)->toBe('posted')
        ->and($receiptLine->fresh()->returned_quantity)->toBe('1.0000')
        ->and(app(\App\Modules\Inventory\Services\InventoryStockService::class)->balances($company)[0]->quantity)->toBe('1.0000');

    expect(fn () => app(PurchaseService::class)->createPurchaseReturn($user, [
        'purchase_receipt_id' => $receipt->id, 'source_location_id' => $stock->id,
        'destination_location_id' => $supplier->id, 'return_date' => '2026-11-16', 'reason' => 'Excess',
    ], [['purchase_receipt_line_id' => $receiptLine->id, 'quantity' => '2.0000']]))
        ->toThrow(\Illuminate\Validation\ValidationException::class);
});

test('vendor evaluations refresh to zeroed metrics when the period has no purchase activity', function () {
    [$user, $company, , $vendor] = purchasePhaseThreeFixture('P3E');
    app(\App\Modules\Core\Services\CompanyContext::class)->setActiveCompany($company);
    $evaluation = app(PurchaseService::class)->refreshVendorEvaluation($vendor->id, 2026, 1, $user);
    expect($evaluation)->toBeInstanceOf(PurchaseVendorEvaluation::class)
        ->and($evaluation->total_orders)->toBe(0)
        ->and($evaluation->on_time_delivery_rate)->toBe('0.00')
        ->and($evaluation->rejection_rate)->toBe('0.00');
});
