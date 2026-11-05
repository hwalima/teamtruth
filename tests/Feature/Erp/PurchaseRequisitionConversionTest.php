<?php

use App\Models\Currency;
use App\Models\User;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Inventory\Models\InventoryProduct;
use App\Modules\Inventory\Models\InventoryUnit;
use App\Modules\Inventory\Models\InventoryWarehouse;
use App\Modules\Inventory\Models\StockLocation;
use App\Modules\Purchase\Models\PurchaseRFQ;
use App\Modules\Requisitions\Enums\RequisitionStatus;
use App\Modules\Requisitions\Models\Requisition;

function purchaseRequisitionConversionFixture(string $code): array
{
    $user = User::factory()->create();
    $company = Company::create(['code' => $code, 'name' => "{$code} Purchase Company"]);
    $company->users()->attach($user->id, ['role' => 'owner', 'is_active' => true]);
    app(CompanyContext::class)->setActiveCompany($company);
    Currency::create(['name' => 'US Dollar', 'code' => 'USD', 'symbol' => '$']);
    $unit = InventoryUnit::create([
        'name' => 'Each',
        'abbreviation' => 'ea',
        'category' => 'quantity',
        'factor_to_base' => '1',
        'is_base' => true,
        'is_active' => true,
    ]);
    $product = InventoryProduct::create([
        'unit_id' => $unit->id,
        'sku' => "{$code}-ITEM",
        'name' => 'Catalog item',
        'type' => 'storable',
        'costing_method' => 'average',
        'tracking' => 'none',
        'is_active' => true,
    ]);
    $requisition = Requisition::create([
        'document_number' => "{$code}/REQ/2026/00001",
        'requisition_type' => 'purchase',
        'status' => RequisitionStatus::Approved,
        'requested_by' => $user->id,
        'department' => 'Stores',
        'justification' => 'Approved stock replenishment.',
        'currency_code' => 'USD',
        'estimated_total' => '20.0000',
    ]);
    $line = $requisition->lines()->create([
        'item' => 'Pens',
        'description' => 'Blue ink pens',
        'quantity' => '10.0000',
        'unit' => 'EA',
        'estimated_unit_price' => '2.0000',
        'estimated_total' => '20.0000',
        'sort_order' => 1,
    ]);
    app(CompanyContext::class)->setActiveCompany(null);

    return [$user, $company, $product, $requisition, $line];
}

function approvedStoreIssueFixture(string $code): array
{
    $user = User::factory()->create();
    $company = Company::create(['code' => $code, 'name' => "{$code} Store Issue Company"]);
    $company->users()->attach($user->id, ['role' => 'owner', 'is_active' => true]);
    app(CompanyContext::class)->setActiveCompany($company);
    $unit = InventoryUnit::create([
        'name' => 'Each',
        'abbreviation' => 'ea',
        'category' => 'quantity',
        'factor_to_base' => '1',
        'is_base' => true,
        'is_active' => true,
    ]);
    $product = InventoryProduct::create([
        'unit_id' => $unit->id,
        'sku' => "{$code}-ITEM",
        'name' => 'Catalog item',
        'type' => 'storable',
        'costing_method' => 'average',
        'tracking' => 'none',
        'is_active' => true,
    ]);
    $warehouse = InventoryWarehouse::create(['code' => 'MAIN', 'name' => 'Main store', 'is_active' => true]);
    $supplier = StockLocation::create([
        'warehouse_id' => $warehouse->id,
        'code' => 'SUPPLIER',
        'name' => 'Supplier',
        'usage' => 'supplier',
        'is_active' => true,
    ]);
    $internal = StockLocation::create([
        'warehouse_id' => $warehouse->id,
        'code' => 'STOCK',
        'name' => 'Main stock',
        'usage' => 'internal',
        'is_active' => true,
    ]);
    $department = StockLocation::create([
        'warehouse_id' => $warehouse->id,
        'code' => 'DEPT',
        'name' => 'Stores department',
        'usage' => 'department',
        'is_active' => true,
    ]);
    $requisition = Requisition::create([
        'document_number' => "{$code}/REQ/2026/00001",
        'requisition_type' => 'store_issue',
        'status' => RequisitionStatus::Approved,
        'requested_by' => $user->id,
        'department' => 'Stores',
        'justification' => 'Approved stock issue.',
        'currency_code' => 'USD',
        'estimated_total' => '10.0000',
    ]);
    $line = $requisition->lines()->create([
        'item' => 'Pens',
        'quantity' => '2.0000',
        'unit' => 'ea',
        'estimated_unit_price' => '5.0000',
        'estimated_total' => '10.0000',
        'sort_order' => 1,
    ]);
    app(CompanyContext::class)->setActiveCompany(null);

    return [$user, $company, $product, $requisition, $line, $supplier, $internal, $department];
}

test('approved purchase requisitions are mapped to catalog products and converted to RFQs', function () {
    [$user, $company, $product, $requisition, $line] = purchaseRequisitionConversionFixture('PRC');

    $this->actingAs($user)
        ->withSession(['active_erp_company_id' => $company->id])
        ->post(route('erp.purchase.requisitions.rfqs.store', $requisition), [
            'lines' => [
                ['requisition_line_id' => $line->id, 'product_id' => $product->id],
            ],
        ])
        ->assertRedirect()
        ->assertSessionHas('success');

    $rfq = PurchaseRFQ::query()->with('lines')->firstOrFail();
    expect($rfq->source_requisition_id)->toBe($requisition->id)
        ->and($rfq->currency_code)->toBe('USD')
        ->and($rfq->reference)->toBe($requisition->document_number)
        ->and($rfq->lines)->toHaveCount(1)
        ->and($rfq->lines[0]->product_id)->toBe($product->id)
        ->and($rfq->lines[0]->quantity)->toBe('10.0000')
        ->and($requisition->fresh()->status)->toBe(RequisitionStatus::Converted);

    $this->post(route('erp.purchase.requisitions.rfqs.store', $requisition), [
        'lines' => [
            ['requisition_line_id' => $line->id, 'product_id' => $product->id],
        ],
    ])->assertSessionHasErrors('requisition');
    expect(PurchaseRFQ::query()->count())->toBe(1);
});

test('requisition conversion rejects mismatched product units without changing the requisition', function () {
    [$user, $company, , $requisition, $line] = purchaseRequisitionConversionFixture('PRU');
    app(CompanyContext::class)->setActiveCompany($company);
    $unit = InventoryUnit::create([
        'name' => 'Box',
        'abbreviation' => 'box',
        'category' => 'quantity',
        'factor_to_base' => '1',
        'is_base' => true,
        'is_active' => true,
    ]);
    $product = InventoryProduct::create([
        'unit_id' => $unit->id,
        'sku' => 'PRU-BOX',
        'name' => 'Boxed item',
        'type' => 'consumable',
        'costing_method' => 'average',
        'tracking' => 'none',
        'is_active' => true,
    ]);
    app(CompanyContext::class)->setActiveCompany(null);

    $this->actingAs($user)
        ->withSession(['active_erp_company_id' => $company->id])
        ->post(route('erp.purchase.requisitions.rfqs.store', $requisition), [
            'lines' => [
                ['requisition_line_id' => $line->id, 'product_id' => $product->id],
            ],
        ])
        ->assertSessionHasErrors('lines.0.product_id');

    expect($requisition->fresh()->status)->toBe(RequisitionStatus::Approved)
        ->and(PurchaseRFQ::query()->count())->toBe(0);
});

test('approved store-issue requisitions post stock moves and become issued', function () {
    [$user, $company, $product, $requisition, $line, $supplier, $internal, $department] = approvedStoreIssueFixture('PSI');
    $this->actingAs($user)->withSession(['active_erp_company_id' => $company->id]);
    $this->post(route('erp.inventory.stock.movements.store'), [
        'operation' => 'receipt',
        'product_id' => $product->id,
        'from_location_id' => $supplier->id,
        'to_location_id' => $internal->id,
        'quantity' => '3.0000',
    ])->assertRedirect();

    $this->post(route('erp.purchase.requisitions.issue-stock', $requisition), [
        'source_location_id' => $internal->id,
        'destination_location_id' => $department->id,
        'lines' => [
            [
                'requisition_line_id' => $line->id,
                'product_id' => $product->id,
                'lot_code' => '',
                'serial_codes' => '',
            ],
        ],
    ])->assertRedirect()->assertSessionHas('success');

    expect($requisition->fresh()->status)->toBe(RequisitionStatus::Issued);
    $this->assertDatabaseHas('stock_moves', [
        'company_id' => $company->id,
        'operation' => 'issue',
        'reference' => $requisition->document_number,
    ]);
    $this->assertDatabaseHas('stock_move_lines', [
        'product_id' => $product->id,
        'from_location_id' => $internal->id,
        'to_location_id' => $department->id,
        'quantity' => '2.0000',
    ]);
});
