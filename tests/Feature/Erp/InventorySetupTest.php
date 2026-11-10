<?php

use App\Models\User;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Models\CompanyErpRole;

function inventoryOwner(): array
{
    $user = User::factory()->create();
    $company = Company::create(['code' => 'INV', 'name' => 'Inventory Test Company']);
    $company->users()->attach($user->id, ['role' => 'owner', 'is_active' => true]);

    return [$user, $company];
}

test('company inventory setup creates units categories products and warehouses', function () {
    [$user, $company] = inventoryOwner();

    $this->actingAs($user)
        ->withSession(['active_erp_company_id' => $company->id])
        ->get(route('erp.inventory.setup'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('Erp/Inventory/Setup'));

    $this->post(route('erp.inventory.units.store'), [
        'name' => 'Each',
        'abbreviation' => 'ea',
        'category' => 'quantity',
        'factor_to_base' => '1',
        'is_base' => true,
    ])->assertRedirect();

    $unitId = DB::table('inventory_units')->where('company_id', $company->id)->value('id');

    $this->post(route('erp.inventory.categories.store'), [
        'name' => 'School supplies',
        'description' => 'Consumable learning materials',
    ])->assertRedirect();

    $categoryId = DB::table('inventory_categories')->where('company_id', $company->id)->value('id');

    $this->post(route('erp.inventory.products.store'), [
        'sku' => 'PENCIL-001',
        'name' => 'HB Pencil',
        'category_id' => $categoryId,
        'unit_id' => $unitId,
        'type' => 'storable',
        'costing_method' => 'average',
        'tracking' => 'none',
    ])->assertRedirect();

    $this->post(route('erp.inventory.warehouses.store'), [
        'code' => 'MAIN',
        'name' => 'Main store',
    ])->assertRedirect();

    $this->assertDatabaseHas('inventory_products', [
        'company_id' => $company->id,
        'sku' => 'PENCIL-001',
        'unit_id' => $unitId,
        'category_id' => $categoryId,
    ]);
    $this->assertDatabaseHas('stock_locations', [
        'company_id' => $company->id,
        'code' => 'STOCK',
        'usage' => 'internal',
    ]);
});

test('inventory foundation records are isolated to the active company', function () {
    [$user, $company] = inventoryOwner();
    $otherCompany = Company::create(['code' => 'OTHERINV', 'name' => 'Other Inventory Company']);
    $otherRole = CompanyErpRole::create([
        'company_id' => $otherCompany->id,
        'name' => 'Viewer',
        'slug' => 'viewer',
        'permissions' => ['erp.inventory.view'],
    ]);
    $otherCompany->users()->attach($user->id, [
        'role' => $otherRole->slug,
        'erp_role_id' => $otherRole->id,
        'is_active' => true,
    ]);

    $this->actingAs($user)
        ->withSession(['active_erp_company_id' => $company->id])
        ->post(route('erp.inventory.units.store'), [
            'name' => 'Each',
            'abbreviation' => 'ea',
            'category' => 'quantity',
            'factor_to_base' => '1',
            'is_base' => true,
        ])
        ->assertRedirect();

    $this->withSession(['active_erp_company_id' => $otherCompany->id])
        ->get(route('erp.inventory.setup'))
        ->assertInertia(fn ($page) => $page->where('units', []));
});
