<?php

use App\Modules\Core\Models\Company;
use Illuminate\Support\Facades\DB;

function stockFixture(Company $company, string $tracking = 'none'): array
{
    $unitId = DB::table('inventory_units')->insertGetId([
        'company_id' => $company->id,
        'name' => 'Each',
        'abbreviation' => 'ea',
        'category' => 'quantity',
        'factor_to_base' => 1,
        'is_base' => true,
        'is_active' => true,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    $productId = DB::table('inventory_products')->insertGetId([
        'company_id' => $company->id,
        'unit_id' => $unitId,
        'sku' => 'STOCK-001',
        'name' => 'Test stock item',
        'type' => 'storable',
        'costing_method' => 'average',
        'tracking' => $tracking,
        'is_active' => true,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    $warehouseId = DB::table('inventory_warehouses')->insertGetId([
        'company_id' => $company->id,
        'code' => 'MAIN',
        'name' => 'Main store',
        'is_active' => true,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    $locations = [];
    foreach (['supplier', 'internal', 'department', 'internal'] as $index => $usage) {
        $locations[$index] = DB::table('stock_locations')->insertGetId([
            'company_id' => $company->id,
            'warehouse_id' => $warehouseId,
            'code' => ['SUPPLIER', 'STOCK', 'DEPARTMENT', 'SECONDARY'][$index],
            'name' => ucfirst($usage),
            'usage' => $usage,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    return [$productId, $locations];
}

test('stock receipts, issues and transfers keep on-hand derived from posted moves', function () {
    $user = User::factory()->create();
    $company = Company::create(['code' => 'STK', 'name' => 'Stock Test Company']);
    $company->users()->attach($user->id, ['role' => 'owner', 'is_active' => true]);
    [$productId, $locations] = stockFixture($company);

    $this->actingAs($user)->withSession(['active_erp_company_id' => $company->id]);
    $this->post(route('erp.inventory.stock.movements.store'), [
        'operation' => 'receipt',
        'product_id' => $productId,
        'from_location_id' => $locations[0],
        'to_location_id' => $locations[1],
        'quantity' => '12.5000',
        'reference' => 'PO-TEST-1',
    ])->assertRedirect();

    $this->post(route('erp.inventory.stock.movements.store'), [
        'operation' => 'issue',
        'product_id' => $productId,
        'from_location_id' => $locations[1],
        'to_location_id' => $locations[2],
        'quantity' => '2.2500',
        'reference' => 'REQ-TEST-1',
    ])->assertRedirect();

    $this->post(route('erp.inventory.stock.movements.store'), [
        'operation' => 'transfer',
        'product_id' => $productId,
        'from_location_id' => $locations[1],
        'to_location_id' => $locations[3],
        'quantity' => '3.0000',
    ])->assertRedirect();

    $this->get(route('erp.inventory.stock.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('balances.0.quantity', '7.2500')
            ->where('balances.1.quantity', '3.0000'));

    $this->assertDatabaseCount('stock_moves', 3);
});

test('stock movements reject overspending and require serial numbers', function () {
    $user = User::factory()->create();
    $company = Company::create(['code' => 'SER', 'name' => 'Serial Test Company']);
    $company->users()->attach($user->id, ['role' => 'owner', 'is_active' => true]);
    [$productId, $locations] = stockFixture($company, 'serial');
    $this->actingAs($user)->withSession(['active_erp_company_id' => $company->id]);

    $this->post(route('erp.inventory.stock.movements.store'), [
        'operation' => 'receipt',
        'product_id' => $productId,
        'from_location_id' => $locations[0],
        'to_location_id' => $locations[1],
        'quantity' => '2',
        'lot_code' => 'SN-0001',
    ])->assertSessionHasErrors('quantity');

    $this->post(route('erp.inventory.stock.movements.store'), [
        'operation' => 'receipt',
        'product_id' => $productId,
        'from_location_id' => $locations[0],
        'to_location_id' => $locations[1],
        'quantity' => '1',
    ])->assertSessionHasErrors('lot_code');

    $this->post(route('erp.inventory.stock.movements.store'), [
        'operation' => 'receipt',
        'product_id' => $productId,
        'from_location_id' => $locations[0],
        'to_location_id' => $locations[1],
        'quantity' => '1',
        'lot_code' => 'SN-0001',
    ])->assertRedirect();

    $this->post(route('erp.inventory.stock.movements.store'), [
        'operation' => 'issue',
        'product_id' => $productId,
        'from_location_id' => $locations[1],
        'to_location_id' => $locations[2],
        'quantity' => '2',
        'lot_code' => 'SN-0001',
    ])->assertSessionHasErrors('quantity');

    $this->assertDatabaseCount('stock_moves', 1);
});
