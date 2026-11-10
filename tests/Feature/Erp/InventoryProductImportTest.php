<?php

use App\Models\Currency;
use App\Models\User;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Inventory\Models\InventoryCategory;
use App\Modules\Inventory\Models\InventoryProduct;
use App\Modules\Inventory\Models\InventoryUnit;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

function importTestFixture(): array
{
    $user = User::factory()->create();
    $company = Company::create(["code" => "IMP", "name" => "Import Test Company"]);
    $company->users()->attach($user->id, ["role" => "owner", "is_active" => true]);
    app(CompanyContext::class)->setActiveCompany($company);

    // Create required units
    $unitEach = InventoryUnit::create([
        "company_id" => $company->id,
        "name" => "Each",
        "abbreviation" => "Units",
        "category" => "quantity",
        "factor_to_base" => 1,
        "is_base" => true,
        "is_active" => true,
    ]);
    $unitMeter = InventoryUnit::create([
        "company_id" => $company->id,
        "name" => "Meter",
        "abbreviation" => "Meters",
        "category" => "length",
        "factor_to_base" => 1,
        "is_base" => true,
        "is_active" => true,
    ]);
    $unitUnit = InventoryUnit::create([
        "company_id" => $company->id,
        "name" => "Unit",
        "abbreviation" => "Unit",
        "category" => "quantity",
        "factor_to_base" => 1,
        "is_base" => true,
        "is_active" => true,
    ]);
    $unitKg = InventoryUnit::create([
        "company_id" => $company->id,
        "name" => "Kilogram",
        "abbreviation" => "kg",
        "category" => "weight",
        "factor_to_base" => 1,
        "is_base" => true,
        "is_active" => true,
    ]);
    $unitLiter = InventoryUnit::create([
        "company_id" => $company->id,
        "name" => "Liter",
        "abbreviation" => "L",
        "category" => "volume",
        "factor_to_base" => 1,
        "is_base" => true,
        "is_active" => true,
    ]);

    return [$user, $company, $unitEach];
}

test("can import products from odoo format excel", function () {
    [$user, $company, $unitEach] = importTestFixture();

    // Copy test file to storage
    $sourceFile = storage_path("app/test_odoo_products.xlsx");
    $destFile = storage_path("app/import_test.xlsx");
    copy($sourceFile, $destFile);
    $file = new UploadedFile($destFile, "import_test.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", null, true);

    $response = $this->actingAs($user)
        ->withSession(["active_erp_company_id" => $company->id])
        ->post(route("erp.inventory.products.import.preview"), [
            "file" => $file,
        ]);

    $response->assertOk();
    $data = $response->json();
    expect($data)->toHaveKeys(["headers", "rows", "total_rows"]);
    expect($data["total_rows"])->toBeGreaterThan(0);

    // Check headers match Odoo format (actual file headers)
    $headers = $data["headers"];
    expect($headers)->toContain("Currency");
    expect($headers)->toContain("Internal Reference");
    expect($headers)->toContain("Name");
    expect($headers)->toContain("Unit");
    expect($headers)->toContain("Product Category");
    expect($headers)->toContain("Quantity On Hand");

    // Now test actual import with mapping - use the actual column indices from the test file
    // Headers: Currency, Activity State, Product Category, Favorite, Name, Internal Reference, # Product Variants, Sales Price, Quantity On Hand, Unit, Image 128, Last Updated on, Show On Hand Qty Status Button
    $mapping = [
        "sku" => 5,           // Internal Reference
        "name" => 4,          // Name
        "category" => 2,      // Product Category
        "unit" => 9,          // Unit
        "sales_price" => 7,   // Sales Price
        "internal_reference" => 5, // Internal Reference (same as sku)
        "type" => -1,         // Not in file, will use default
        "costing_method" => -1, // Not in file, will use default
        "tracking" => -1,     // Not in file, will use default
        "barcode" => -1,      // Not in file
        "description" => -1,  // Not in file
    ];

    $file2 = new UploadedFile($destFile, "import_test.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", null, true);
    $response2 = $this->actingAs($user)
        ->withSession(["active_erp_company_id" => $company->id])
        ->post(route("erp.inventory.products.import"), [
            "file" => $file2,
            "mapping" => $mapping,
            "update_existing" => false,
            "skip_errors" => true,
        ]);

    $response2->assertOk();
    $data2 = $response2->json();
    expect($data2["success"])->toBeTrue();
    expect($data2)->toHaveKey("results");
    expect($data2["results"]["imported"])->toBeGreaterThan(0);
    // The test file contains variant rows without SKU/Name and some unknown units
    // We expect some errors but should have successfully imported products
    expect($data2["results"]["errors"])->toBeArray();

    // Verify products were created
    $this->assertDatabaseCount("inventory_products", $data2["results"]["imported"]);
});

test("can download odoo template", function () {
    $user = User::factory()->create();
    $company = Company::create(["code" => "TMP", "name" => "Template Test Company"]);
    $company->users()->attach($user->id, ["role" => "owner", "is_active" => true]);
    app(CompanyContext::class)->setActiveCompany($company);

    $response = $this->actingAs($user)
        ->withSession(["active_erp_company_id" => $company->id])
        ->get(route("erp.inventory.products.template"));

    $response->assertOk();
    $response->assertHeader("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
});

test("can export products", function () {
    $user = User::factory()->create();
    $company = Company::create(["code" => "EXP", "name" => "Export Test Company"]);
    $company->users()->attach($user->id, ["role" => "owner", "is_active" => true]);
    app(CompanyContext::class)->setActiveCompany($company);

    // Create a unit and product
    $unit = InventoryUnit::create([
        "company_id" => $company->id,
        "name" => "Each",
        "abbreviation" => "Units",
        "category" => "quantity",
        "factor_to_base" => 1,
        "is_base" => true,
        "is_active" => true,
    ]);
    InventoryProduct::create([
        "company_id" => $company->id,
        "unit_id" => $unit->id,
        "sku" => "TEST-001",
        "name" => "Test Product",
        "type" => "storable",
        "costing_method" => "average",
        "tracking" => "none",
        "is_active" => true,
    ]);

    $response = $this->actingAs($user)
        ->withSession(["active_erp_company_id" => $company->id])
        ->get(route("erp.inventory.products.export"));

    $response->assertOk();
    $response->assertHeader("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
});
