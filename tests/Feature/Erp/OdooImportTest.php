<?php

use App\Models\Currency;
use App\Models\User;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\DataImport\Models\DataImport;
use App\Modules\DataImport\Models\ExternalId;
use App\Modules\Inventory\Models\InventoryCategory;
use App\Modules\Inventory\Models\InventoryProduct;
use App\Modules\Inventory\Models\InventoryUnit;
use App\Modules\Inventory\Models\StockLocation;
use App\Modules\Inventory\Services\InventoryStockService;
use App\Modules\Invoicing\Models\Customer;
use App\Modules\Purchase\Models\PurchaseVendor;
use App\Modules\Purchase\Models\PurchaseVendorPriceList;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

beforeEach(function () {
    Storage::fake('local');
    Storage::fake('public');
    $this->user = User::factory()->create();
    $this->company = Company::create(['code' => 'ODO', 'name' => 'Odoo Client', 'default_currency' => 'USD']);
    $this->company->users()->attach($this->user->id, ['role' => 'owner', 'is_active' => true]);
    $this->actingAs($this->user)->withSession(['active_erp_company_id' => $this->company->id]);
    $this->withoutExceptionHandling();
    Currency::query()->firstOrCreate(['code' => 'USD'], ['name' => 'US Dollar', 'symbol' => '$']);
});

function odooFile(string $name, array $rows): UploadedFile
{
    $spreadsheet = new Spreadsheet;
    $spreadsheet->getActiveSheet()->fromArray($rows, null, 'A1', true);
    $path = tempnam(sys_get_temp_dir(), 'odoo').'.xlsx';
    (new Xlsx($spreadsheet))->save($path);

    return new UploadedFile($path, $name, null, null, true);
}

function odooProducts(): UploadedFile
{
    return odooFile('Product (product.template).xlsx', [
        ['Name', 'Internal Reference', 'Product Category', 'Unit', 'Product Type', 'Sales Price', 'Cost', 'Quantity On Hand', 'Vendors/Vendor', 'Vendors/Price', 'Last Updated on'],
        ['O Ring 164-3903', 'EP0008', 'All / Mining / Spares', 'Units', 'Goods', '5.50', '3', 10, 'Acme Supplies', 3, '2026-01-01'],
        [null, null, null, null, null, null, null, null, 'Beta Traders', 2.5, null],
        ['Diesel', null, 'All / Mining / Consumables', 'L', 'Goods', 1.2, null, 100, null, null, null],
        ['Diesel', null, 'All / Mining / Consumables', 'Unit', 'Goods', 1.2, null, -3, null, null, null],
        ['Bolt box', null, null, '124 Box', 'Goods', 0, null, 0, null, null, null],
        ['Site consulting', null, null, 'Units', 'Service', 50, null, 0, null, null, null],
    ]);
}

function onHand(InventoryProduct $product): float
{
    app(CompanyContext::class)->setActiveCompany($product->company);
    $location = StockLocation::query()->where('usage', 'internal')->firstOrFail();

    return (float) app(InventoryStockService::class)->quantityOnHand($product->company, $product->id, $location->id, null);
}

test('the import page loads', function () {
    $response = $this->get(route('erp.data-import.index'))->assertOk();
    expect(resource_path('js/pages/'.$response->viewData('page')['component'].'.tsx'))->toBeFile();
});

test('an Odoo product file is previewed without saving, then imported with everything it needs', function () {
    $this->post(route('erp.data-import.store'), ['file' => odooProducts()])->assertRedirect();

    $import = DataImport::query()->withoutGlobalScopes()->sole();
    expect($import->model)->toBe('product.template')
        ->and($import->status)->toBe(DataImport::PREVIEWED)
        ->and($import->total_rows)->toBe(6)
        ->and($import->summary['actions'])->toMatchArray(['created' => 5, 'merged' => 1])
        ->and($import->summary['created']['vendors'])->toBe(['Acme Supplies', 'Beta Traders'])
        ->and($import->columns['kept_only'])->toContain('Last Updated on');

    // The preview changed nothing.
    expect(InventoryProduct::query()->withoutGlobalScopes()->count())->toBe(0)
        ->and(PurchaseVendor::query()->withoutGlobalScopes()->count())->toBe(0)
        ->and(InventoryCategory::query()->withoutGlobalScopes()->count())->toBe(0)
        ->and(ExternalId::query()->withoutGlobalScopes()->count())->toBe(0);

    $page = $this->get(route('erp.data-import.show', $import))->assertOk();
    expect(resource_path('js/pages/'.$page->viewData('page')['component'].'.tsx'))->toBeFile();
    $this->get(route('erp.data-import.show', [$import, 'action' => 'created', 'search' => 'Diesel']))->assertOk();

    $this->post(route('erp.data-import.commit', $import))->assertRedirect(route('erp.data-import.show', $import));
    expect($import->refresh()->status)->toBe(DataImport::IMPORTED);

    $products = InventoryProduct::query()->withoutGlobalScopes()->orderBy('id')->get();
    expect($products)->toHaveCount(5);

    $ring = $products[0];
    expect($ring->name)->toBe('O Ring 164-3903')
        ->and($ring->internal_reference)->toBe('EP0008')
        ->and($ring->sku)->toStartWith('OD-')
        ->and((float) $ring->sale_price)->toBe(5.5)
        ->and((float) $ring->cost_price)->toBe(3.0)
        ->and($ring->type)->toBe('storable')
        ->and($ring->metadata['odoo']['Last Updated on'])->toBe('2026-01-01')
        ->and($ring->metadata['odoo']['_extra_rows'][0]['Vendors/Vendor'])->toBe('Beta Traders');

    // Categories keep Odoo's tree, without its root "All".
    $spares = InventoryCategory::query()->withoutGlobalScopes()->findOrFail($ring->category_id);
    expect($spares->name)->toBe('Spares')
        ->and(InventoryCategory::query()->withoutGlobalScopes()->find($spares->parent_id)->name)->toBe('Mining')
        ->and(InventoryCategory::query()->withoutGlobalScopes()->count())->toBe(3);

    // "Units" and "Unit" are one unit; unknown units are created.
    expect(InventoryUnit::query()->withoutGlobalScopes()->pluck('name')->sort()->values()->all())->toBe(['124 Box', 'L', 'Units'])
        ->and($products[2]->unit_id)->toBe($ring->unit_id);

    expect(PurchaseVendor::query()->withoutGlobalScopes()->pluck('name')->all())->toBe(['Acme Supplies', 'Beta Traders'])
        ->and(PurchaseVendorPriceList::query()->withoutGlobalScopes()->where('product_id', $ring->id)->pluck('price')->map(fn ($p) => (float) $p)->sort()->values()->all())->toBe([2.5, 3.0]);

    expect($products[4]->type)->toBe('service')
        ->and(onHand($ring))->toBe(10.0)
        ->and(onHand($products[1]))->toBe(100.0)
        ->and(onHand($products[2]))->toBe(0.0);

    $diesel = $import->rows()->where('row_number', 5)->first();
    expect(implode(' ', $diesel->messages))->toContain('Same name as row 4')->toContain('Negative stock');
});

test('importing the same file again updates instead of duplicating', function () {
    $this->post(route('erp.data-import.store'), ['file' => odooProducts()]);
    $this->post(route('erp.data-import.commit', DataImport::query()->withoutGlobalScopes()->latest('id')->first()));

    $this->post(route('erp.data-import.store'), ['file' => odooProducts()]);
    $second = DataImport::query()->withoutGlobalScopes()->latest('id')->first();
    expect($second->summary['actions'])->not->toHaveKey('created');
    $this->post(route('erp.data-import.commit', $second));

    expect(InventoryProduct::query()->withoutGlobalScopes()->count())->toBe(5)
        ->and(PurchaseVendor::query()->withoutGlobalScopes()->count())->toBe(2)
        ->and(PurchaseVendorPriceList::query()->withoutGlobalScopes()->count())->toBe(2)
        ->and(onHand(InventoryProduct::query()->withoutGlobalScopes()->orderBy('id')->first()))->toBe(10.0);
});

test('an Odoo contacts file fills in the vendors the products created and adds customers', function () {
    $this->post(route('erp.data-import.store'), ['file' => odooProducts()]);
    $this->post(route('erp.data-import.commit', DataImport::query()->withoutGlobalScopes()->latest('id')->first()));

    $this->post(route('erp.data-import.store'), ['file' => odooFile('Contact (res.partner).xlsx', [
        ['id', 'name', 'parent_id', 'is_company', 'email', 'phone', 'street', 'city', 'country_id', 'vat', 'supplier_rank', 'customer_rank'],
        ['__export__.res_partner_7', 'Acme Supplies', null, 'True', 'sales@acme.test', '+263 77 000', '1 Main Rd', 'Harare', 'Zimbabwe', 'BP123', 3, 0],
        ['__export__.res_partner_8', 'Big Mine Ltd', null, 'True', 'not-an-email', null, null, 'Kwekwe', 'Zimbabwe', null, 0, 5],
        ['__export__.res_partner_9', 'Jane Buyer', 'Big Mine Ltd', 'False', 'jane@bigmine.test', null, null, null, null, null, 0, 1],
        ['__export__.res_partner_10', 'Dormant Partner', null, 'True', null, null, null, null, null, null, 0, 0],
    ])])->assertRedirect();

    $import = DataImport::query()->withoutGlobalScopes()->latest('id')->first();
    expect($import->model)->toBe('res.partner')
        ->and($import->summary['actions'])->toMatchArray(['updated' => 1, 'created' => 1, 'skipped' => 2]);
    $this->post(route('erp.data-import.commit', $import));

    $acme = PurchaseVendor::query()->withoutGlobalScopes()->where('name', 'Acme Supplies')->sole();
    expect(PurchaseVendor::query()->withoutGlobalScopes()->count())->toBe(2)
        ->and($acme->email)->toBe('sales@acme.test')
        ->and($acme->tax_no)->toBe('BP123')
        ->and($acme->address)->toBe("1 Main Rd\nHarare\nZimbabwe");

    $customer = Customer::query()->withoutGlobalScopes()->sole();
    expect($customer->name)->toBe('Big Mine Ltd')
        ->and($customer->email)->toBeNull()
        ->and($customer->code)->toBe('C-0001')
        ->and($customer->currency_code)->toBe('USD');
});

test('a contacts list export becomes vendors without contact persons or placeholder emails', function () {
    $this->company->update(['email' => 'info@samplemining.example.test', 'website' => 'www.sample-mining.example.test']);

    $this->post(route('erp.data-import.store'), ['file' => odooFile('Contact (res.partner).xlsx', [
        ['Complete Name', 'Tax ID', 'Email', 'Phone', 'Street', 'City', 'Country'],
        ['Acme Drilling', '2000111', 'Accounts@Acme.example.test', '+263 77 000 0001', '1 Main Rd', 'Harare', 'Zimbabwe'],
        ['Acme Drilling, Jane Moyo', null, 'jane@acme.example.test', null, null, null, null],
        ['Beta Fuel', null, 'buyer@samplemining.example.test', null, null, 'Kwekwe', 'Zimbabwe'],
        ['Gamma Tools', null, 'sales@sample-mining.example.test', null, null, null, null],
        ['Delta One', null, 'shared@agent.example.test', null, null, null, null],
        ['Delta Two', null, 'shared@agent.example.test', null, null, null, null],
        ['Delta Three', null, 'shared@agent.example.test', null, null, null, null],
        ['Delta Four', null, 'shared@agent.example.test', null, null, null, null],
        ['Echo Hardware', null, 'echo@mail,com', null, null, null, null],
        ['Foxtrot Supplies', null, 'a@foxtrot.example.test; b@foxtrot.example.test', null, null, null, null],
        ['Lonely Ltd, Sam Ncube', null, null, null, null, null, null],
    ])])->assertRedirect();

    $import = DataImport::query()->withoutGlobalScopes()->latest('id')->first();
    expect($import->summary['actions'])->toMatchArray(['created' => 10, 'skipped' => 1]);
    $this->post(route('erp.data-import.commit', $import));

    $vendors = PurchaseVendor::query()->withoutGlobalScopes()->get()->keyBy('name');
    expect($vendors)->toHaveCount(10)
        ->and($vendors->has('Acme Drilling, Jane Moyo'))->toBeFalse()
        ->and($vendors['Lonely Ltd, Sam Ncube'])->not->toBeNull()
        ->and($vendors['Acme Drilling']->email)->toBe('accounts@acme.example.test')
        ->and($vendors['Acme Drilling']->tax_no)->toBe('2000111')
        ->and($vendors['Beta Fuel']->email)->toBeNull()
        ->and($vendors['Gamma Tools']->email)->toBeNull()
        ->and($vendors['Delta One']->email)->toBeNull()
        ->and($vendors['Echo Hardware']->email)->toBeNull()
        ->and($vendors['Foxtrot Supplies']->email)->toBe('a@foxtrot.example.test')
        ->and($vendors->every->is_active)->toBeTrue();
});

test('a file that is not an Odoo export is refused and not kept', function () {
    $this->withExceptionHandling();
    $this->post(route('erp.data-import.store'), ['file' => odooFile('random.xlsx', [['Foo', 'Bar'], [1, 2]])])
        ->assertSessionHasErrors('model');

    expect(DataImport::query()->withoutGlobalScopes()->count())->toBe(0)
        ->and(Storage::disk('local')->allFiles())->toBe([]);
});

function importProducts(): DataImport
{
    test()->post(route('erp.data-import.store'), ['file' => odooProducts()]);
    $import = DataImport::query()->withoutGlobalScopes()->latest('id')->first();
    test()->post(route('erp.data-import.commit', $import));

    return $import->refresh();
}

test('an import in the wrong company can be undone completely', function (bool $recordedIds) {
    // Something that existed before the import must survive the undo.
    app(CompanyContext::class)->setActiveCompany($this->company);
    $ownCategory = InventoryCategory::query()->create(['name' => 'Office', 'is_active' => true]);

    $import = importProducts();
    if (! $recordedIds) {
        // Imports made before created ids were recorded only list names.
        $summary = $import->summary;
        unset($summary['created_ids']);
        $import->forceFill(['summary' => $summary])->save();
    }

    $this->post(route('erp.data-import.undo', $import))->assertRedirect(route('erp.data-import.show', $import));

    expect($import->refresh()->status)->toBe('undone')
        ->and($import->summary['undone']['removed']['products'])->toBe(5)
        ->and(InventoryProduct::query()->withoutGlobalScopes()->count())->toBe(0)
        ->and(InventoryUnit::query()->withoutGlobalScopes()->count())->toBe(0)
        ->and(InventoryCategory::query()->withoutGlobalScopes()->pluck('id')->all())->toBe([$ownCategory->id])
        ->and(PurchaseVendor::query()->withoutGlobalScopes()->count())->toBe(0)
        ->and(PurchaseVendorPriceList::query()->withoutGlobalScopes()->count())->toBe(0)
        ->and(StockLocation::query()->withoutGlobalScopes()->count())->toBe(0)
        ->and(\App\Modules\Inventory\Models\StockMove::query()->withoutGlobalScopes()->count())->toBe(0)
        ->and(ExternalId::query()->withoutGlobalScopes()->count())->toBe(0);

    $this->get(route('erp.data-import.show', $import))->assertOk();

    // The same file can then be imported again from scratch.
    importProducts();
    expect(InventoryProduct::query()->withoutGlobalScopes()->count())->toBe(5);
})->with(['ids recorded' => true, 'older import, names only' => false]);

test('an import is not undone once its products have been used', function () {
    $import = importProducts();
    $ring = InventoryProduct::query()->withoutGlobalScopes()->orderBy('id')->first();
    app(CompanyContext::class)->setActiveCompany($this->company);
    $stock = StockLocation::query()->where('usage', 'internal')->first();
    $scrap = StockLocation::query()->create(['warehouse_id' => $stock->warehouse_id, 'code' => 'SCRAP', 'name' => 'Scrap', 'usage' => 'scrap', 'is_active' => true]);
    app(InventoryStockService::class)->postMovement($this->company, $this->user, [
        'operation' => 'scrap', 'product_id' => $ring->id, 'from_location_id' => $stock->id, 'to_location_id' => $scrap->id, 'quantity' => '1',
    ]);

    $this->withExceptionHandling();
    $this->post(route('erp.data-import.undo', $import))->assertSessionHasErrors('import');

    expect($import->refresh()->status)->toBe(DataImport::IMPORTED)
        ->and(InventoryProduct::query()->withoutGlobalScopes()->count())->toBe(5)
        ->and(onHand($ring))->toBe(9.0);
});

test('a product variants file updates prices and stock without blanking what the products file set', function () {
    importProducts();

    $this->post(route('erp.data-import.store'), ['file' => odooFile('Product Variant (product.product).xlsx', [
        ['Favorite', 'Internal Reference', 'Name', 'Variant Values', 'Sales Price', 'Cost', 'Quantity On Hand', 'Forecasted Quantity', 'Unit'],
        [false, 'EP0008', 'O Ring 164-3903', null, 6, 3.2, 12, 12, 'Units'],
        [false, null, 'Overall', 'Size: L', 25, 15, 4, 4, 'Units'],
        [false, null, 'Overall', 'Size: XL', 25, 15, 2, 2, 'Units'],
    ])]);
    $import = DataImport::query()->withoutGlobalScopes()->latest('id')->first();
    expect($import->model)->toBe('product.template');
    $this->post(route('erp.data-import.commit', $import));

    $ring = InventoryProduct::query()->withoutGlobalScopes()->where('name', 'O Ring 164-3903')->sole();
    expect($import->refresh()->status)->toBe(DataImport::IMPORTED)
        ->and((float) $ring->sale_price)->toBe(6.0)
        ->and((float) $ring->cost_price)->toBe(3.2)
        ->and($ring->category?->name)->toBe('Spares')
        ->and(onHand($ring))->toBe(12.0)
        ->and(InventoryProduct::query()->withoutGlobalScopes()->where('name', 'like', 'Overall (%')->orderBy('name')->pluck('name')->all())
        ->toBe(['Overall (Size: L)', 'Overall (Size: XL)']);
});
