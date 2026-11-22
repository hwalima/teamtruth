<?php

use App\Models\User;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Inventory\Models\InventoryCategory;
use App\Modules\Inventory\Models\InventoryProduct;
use App\Modules\Inventory\Models\InventoryUnit;
use App\Modules\Inventory\Models\InventoryWarehouse;
use App\Modules\Inventory\Models\StockLocation;
use App\Modules\Inventory\Services\InventoryStockService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('public');
    $this->user = User::factory()->create();
    $this->company = Company::create(['code' => 'CRUD', 'name' => 'Crud Mining', 'email' => 'info@crud.test']);
    $this->company->users()->attach($this->user->id, ['role' => 'owner', 'is_active' => true]);
    $this->actingAs($this->user)->withSession(['active_erp_company_id' => $this->company->id]);
    app(CompanyContext::class)->setActiveCompany($this->company);

    $this->unit = InventoryUnit::query()->create(['name' => 'Each', 'abbreviation' => 'ea', 'category' => 'quantity', 'factor_to_base' => 1, 'is_base' => true]);
    $this->category = InventoryCategory::query()->create(['name' => 'Spares']);
    $this->warehouse = InventoryWarehouse::query()->create(['code' => 'MAIN', 'name' => 'Main store']);
    $this->stock = StockLocation::query()->create(['warehouse_id' => $this->warehouse->id, 'code' => 'STOCK', 'name' => 'Stock', 'usage' => 'internal']);
});

function productData(array $overrides = []): array
{
    return [
        'sku' => 'BIT-45',
        'name' => 'Drill bit 45mm',
        'category_id' => test()->category->id,
        'unit_id' => test()->unit->id,
        'type' => 'storable',
        'costing_method' => 'average',
        'tracking' => 'none',
        'sale_price' => '120.50',
        'cost_price' => '80',
        ...$overrides,
    ];
}

function addStock(InventoryProduct $product, string $quantity = '5'): void
{
    $adjustment = StockLocation::query()->firstOrCreate(
        ['warehouse_id' => test()->warehouse->id, 'code' => 'ADJ'],
        ['name' => 'Adjustments', 'usage' => 'adjustment'],
    );
    app(InventoryStockService::class)->postMovement(test()->company, test()->user, [
        'operation' => 'adjustment', 'product_id' => $product->id, 'from_location_id' => $adjustment->id, 'to_location_id' => test()->stock->id, 'quantity' => $quantity,
    ]);
}

test('the product pages load', function () {
    $product = InventoryProduct::query()->create(productData());
    addStock($product);

    $this->get(route('erp.inventory.products.index'))->assertOk()
        ->assertInertia(fn ($page) => $page->component('Erp/Inventory/Products/Index')->where('products.data.0.on_hand', fn ($q) => (float) $q === 5.0));
    $this->get(route('erp.inventory.products.show', $product))->assertOk()
        ->assertInertia(fn ($page) => $page->component('Erp/Inventory/Products/Show')->has('stock', 1)->has('movements', 1));
    $this->get(route('erp.inventory.products.create'))->assertOk()->assertInertia(fn ($page) => $page->component('Erp/Inventory/Products/Form'));
    $this->get(route('erp.inventory.products.edit', $product))->assertOk()->assertInertia(fn ($page) => $page->where('hasStock', true));

    foreach (['Index', 'Show', 'Form'] as $page) {
        expect(file_exists(resource_path("js/pages/Erp/Inventory/Products/{$page}.tsx")))->toBeTrue();
    }
});

test('a product is created with a picture, changed, and deleted', function () {
    $this->post(route('erp.inventory.products.store'), productData(['image' => UploadedFile::fake()->image('bit.png')]))
        ->assertSessionHasNoErrors()->assertRedirect();
    $product = InventoryProduct::query()->where('sku', 'BIT-45')->firstOrFail();
    expect((float) $product->sale_price)->toBe(120.5);

    $this->put(route('erp.inventory.products.update', $product), productData(['name' => 'Drill bit 45 mm', 'is_active' => false]))
        ->assertSessionHasNoErrors()->assertRedirect(route('erp.inventory.products.show', $product));
    expect($product->refresh()->name)->toBe('Drill bit 45 mm')->and($product->is_active)->toBeFalse();

    $this->delete(route('erp.inventory.products.destroy', $product))->assertRedirect(route('erp.inventory.products.index'));
    expect(InventoryProduct::query()->count())->toBe(0);
});

test('a product with stock cannot be deleted or change its unit', function () {
    $product = InventoryProduct::query()->create(productData());
    addStock($product);
    $box = InventoryUnit::query()->create(['name' => 'Box', 'abbreviation' => 'box', 'category' => 'quantity', 'factor_to_base' => 10, 'is_base' => false]);

    $this->delete(route('erp.inventory.products.destroy', $product))->assertSessionHas('error');
    $this->put(route('erp.inventory.products.update', $product), productData(['unit_id' => $box->id]))->assertSessionHasErrors('unit_id');

    expect(InventoryProduct::query()->count())->toBe(1)->and($product->refresh()->unit_id)->toBe($this->unit->id);
});

test('the product catalogue PDF carries the company branding', function () {
    InventoryProduct::query()->create(productData());

    $response = $this->get(route('erp.inventory.products.pdf', ['status' => 'active']));
    $response->assertOk()->assertHeader('Content-Type', 'application/pdf');
    expect(substr($response->getContent(), 0, 4))->toBe('%PDF');

    $html = view('pdf.documents.inventory-report', [
        'company' => $this->company, 'reportTitle' => 'Product catalogue', 'reportSubtitle' => 'Status: Active',
        'columns' => ['SKU', 'Qty'], 'numericColumns' => [1], 'rows' => [['BIT-45', '5']], 'stats' => ['Products' => '1'],
    ])->render();
    expect($html)->toContain('Crud Mining')->toContain('info@crud.test')->toContain('Product catalogue')->toContain('Status: Active')->toContain('class="num"');
});

test('the stock report PDFs still render', function (string $report) {
    $this->get(route('erp.inventory.stock.reports.export', ['report' => $report, 'format' => 'pdf']))
        ->assertOk()->assertHeader('Content-Type', 'application/pdf');
})->with(['on-hand', 'movements']);

test('categories, units, warehouses and locations can be edited', function () {
    $child = InventoryCategory::query()->create(['name' => 'Drilling', 'parent_id' => $this->category->id]);

    $this->put(route('erp.inventory.categories.update', $this->category), ['name' => 'Mining spares', 'parent_id' => $child->id, 'is_active' => true])
        ->assertSessionHasErrors('parent_id');
    $this->put(route('erp.inventory.categories.update', $this->category), ['name' => 'Mining spares', 'description' => 'All spares', 'is_active' => true])
        ->assertSessionHasNoErrors();
    $this->put(route('erp.inventory.units.update', $this->unit), ['name' => 'Piece', 'abbreviation' => 'pc', 'is_active' => true])->assertSessionHasNoErrors();
    $this->put(route('erp.inventory.warehouses.update', $this->warehouse), ['code' => 'MAIN', 'name' => 'Main yard', 'is_active' => true])->assertSessionHasNoErrors();
    $this->put(route('erp.inventory.locations.update', $this->stock), ['code' => 'STOCK', 'name' => 'Shelves', 'usage' => 'internal', 'is_active' => false])->assertSessionHasNoErrors();

    expect($this->category->refresh()->name)->toBe('Mining spares')
        ->and($this->unit->refresh()->abbreviation)->toBe('pc')
        ->and($this->warehouse->refresh()->name)->toBe('Main yard')
        ->and($this->stock->refresh()->is_active)->toBeFalse();

    $this->get(route('erp.inventory.setup'))->assertOk()
        ->assertInertia(fn ($page) => $page->component('Erp/Inventory/Setup')->has('categories', 2)->where('canManage', true));
});

test('unused setup records are deleted and used ones are kept', function () {
    $product = InventoryProduct::query()->create(productData());
    $spare = InventoryCategory::query()->create(['name' => 'Empty']);
    $shelf = StockLocation::query()->create(['warehouse_id' => $this->warehouse->id, 'code' => 'SHELF', 'name' => 'Shelf', 'usage' => 'internal']);

    $this->delete(route('erp.inventory.categories.destroy', $this->category))->assertSessionHas('error');
    $this->delete(route('erp.inventory.units.destroy', $this->unit))->assertSessionHas('error');
    $this->delete(route('erp.inventory.categories.destroy', $spare))->assertSessionHas('success');
    $this->delete(route('erp.inventory.locations.destroy', $shelf))->assertSessionHas('success');

    addStock($product);
    $this->delete(route('erp.inventory.warehouses.destroy', $this->warehouse))->assertSessionHas('error');

    $empty = InventoryWarehouse::query()->create(['code' => 'SPARE', 'name' => 'Spare yard']);
    $top = StockLocation::query()->create(['warehouse_id' => $empty->id, 'code' => 'STOCK', 'name' => 'Stock', 'usage' => 'internal']);
    StockLocation::query()->create(['warehouse_id' => $empty->id, 'parent_id' => $top->id, 'code' => 'BIN', 'name' => 'Bin', 'usage' => 'internal']);
    $this->delete(route('erp.inventory.warehouses.destroy', $empty))->assertSessionHas('success');

    expect(InventoryCategory::query()->pluck('name')->all())->toBe(['Spares'])
        ->and(InventoryWarehouse::query()->pluck('code')->all())->toBe(['MAIN'])
        ->and(StockLocation::query()->where('warehouse_id', $empty->id)->count())->toBe(0);
});
