<?php

namespace App\Modules\Inventory\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\AuditLogService;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Inventory\Models\InventoryCategory;
use App\Modules\Inventory\Models\InventoryProduct;
use App\Modules\Inventory\Models\InventoryUnit;
use App\Modules\Inventory\Models\InventoryWarehouse;
use App\Modules\Inventory\Models\StockLocation;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class InventorySetupController extends Controller
{
    public function index(): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        return Inertia::render('Erp/Inventory/Setup', [
            'company' => $company->only(['id', 'code', 'name']),
            'units' => InventoryUnit::query()->where('is_active', true)->orderBy('name')->get(),
            'categories' => InventoryCategory::query()->where('is_active', true)->orderBy('name')->get(),
            'products' => InventoryProduct::query()
                ->with(['category:id,name', 'unit:id,name,abbreviation'])
                ->orderBy('name')
                ->limit(300)
                ->get(),
            'warehouses' => InventoryWarehouse::query()
                ->with(['locations' => fn ($query) => $query->where('is_active', true)->orderBy('code')])
                ->where('is_active', true)
                ->orderBy('name')
                ->get(),
        ]);
    }

    public function storeUnit(Request $request): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'abbreviation' => [
                'required',
                'string',
                'max:20',
                'regex:/^[A-Za-z0-9._-]+$/',
                Rule::unique('inventory_units', 'abbreviation')->where('company_id', $company->id),
            ],
            'category' => ['required', Rule::in(['quantity', 'weight', 'length', 'volume', 'time', 'other'])],
            'factor_to_base' => ['required', 'numeric', 'gt:0', 'max:1000000000'],
            'is_base' => ['required', 'boolean'],
        ]);
        if ($validated['is_base'] && (float) $validated['factor_to_base'] !== 1.0) {
            return back()->withErrors(['factor_to_base' => __('A base unit must have a conversion factor of 1.')]);
        }
        DB::transaction(function () use ($company, $request, $validated): void {
            Company::query()->lockForUpdate()->findOrFail($company->id);
            if ($validated['is_base'] && InventoryUnit::query()
                ->where('category', $validated['category'])
                ->where('is_base', true)
                ->exists()) {
                throw ValidationException::withMessages(['is_base' => __('This unit category already has a base unit.')]);
            }
            $unit = InventoryUnit::query()->create([...$validated, 'company_id' => $company->id]);
            $this->audit($company, $request, 'inventory.unit.created', $unit, $unit->only([
                'name', 'abbreviation', 'category', 'factor_to_base', 'is_base',
            ]));
        });

        return back()->with('success', __('Unit of measure created.'));
    }

    public function storeCategory(Request $request): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:120',
                Rule::unique('inventory_categories', 'name')->where('company_id', $company->id),
            ],
            'description' => ['nullable', 'string', 'max:1000'],
            'parent_id' => [
                'nullable',
                'integer',
                Rule::exists('inventory_categories', 'id')->where('company_id', $company->id),
            ],
        ]);

        DB::transaction(function () use ($company, $request, $validated): void {
            $category = InventoryCategory::query()->create([...$validated, 'company_id' => $company->id]);
            $this->audit($company, $request, 'inventory.category.created', $category, $category->only(['name', 'parent_id']));
        });

        return back()->with('success', __('Product category created.'));
    }

    public function storeProduct(Request $request): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);
        $validated = $request->validate([
            'sku' => [
                'required',
                'string',
                'max:80',
                'regex:/^[A-Za-z0-9._-]+$/',
                Rule::unique('inventory_products', 'sku')->where('company_id', $company->id),
            ],
            'barcode' => [
                'nullable',
                'string',
                'max:120',
                Rule::unique('inventory_products', 'barcode')->where('company_id', $company->id),
            ],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:10000'],
            'category_id' => [
                'nullable',
                'integer',
                Rule::exists('inventory_categories', 'id')->where('company_id', $company->id),
            ],
            'unit_id' => [
                'required',
                'integer',
                Rule::exists('inventory_units', 'id')->where('company_id', $company->id)->where('is_active', true),
            ],
            'type' => ['required', Rule::in(['storable', 'consumable', 'service'])],
            'costing_method' => ['required', Rule::in(['average', 'fifo'])],
            'tracking' => ['required', Rule::in(['none', 'lot', 'serial'])],
        ]);
        if ($validated['type'] === 'service' && $validated['tracking'] !== 'none') {
            return back()->withErrors(['tracking' => __('Service products cannot use lot or serial tracking.')]);
        }

        DB::transaction(function () use ($company, $request, $validated): void {
            $product = InventoryProduct::query()->create([...$validated, 'company_id' => $company->id]);
            $this->audit($company, $request, 'inventory.product.created', $product, $product->only([
                'sku', 'barcode', 'name', 'type', 'category_id', 'unit_id', 'costing_method', 'tracking',
            ]));
        });

        return back()->with('success', __('Product created.'));
    }

    public function storeWarehouse(Request $request): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);
        $validated = $request->validate([
            'code' => [
                'required',
                'string',
                'max:40',
                'regex:/^[A-Za-z0-9_-]+$/',
                Rule::unique('inventory_warehouses', 'code')->where('company_id', $company->id),
            ],
            'name' => ['required', 'string', 'max:160'],
            'address' => ['nullable', 'string', 'max:1000'],
        ]);

        DB::transaction(function () use ($company, $request, $validated): void {
            $warehouse = InventoryWarehouse::query()->create([...$validated, 'company_id' => $company->id]);
            $location = $warehouse->locations()->create([
                'company_id' => $company->id,
                'code' => 'STOCK',
                'name' => __('Stock'),
                'usage' => 'internal',
            ]);
            $this->audit($company, $request, 'inventory.warehouse.created', $warehouse, [
                ...$warehouse->only(['code', 'name', 'address']),
                'default_location_id' => $location->id,
            ]);
        });

        return back()->with('success', __('Warehouse created with a default stock location.'));
    }

    public function storeLocation(Request $request): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);
        $validated = $request->validate([
            'warehouse_id' => [
                'required',
                'integer',
                Rule::exists('inventory_warehouses', 'id')->where('company_id', $company->id)->where('is_active', true),
            ],
            'parent_id' => ['nullable', 'integer', Rule::exists('stock_locations', 'id')->where('company_id', $company->id)],
            'code' => ['required', 'string', 'max:40', 'regex:/^[A-Za-z0-9_-]+$/'],
            'name' => ['required', 'string', 'max:160'],
            'usage' => ['required', Rule::in(['internal', 'supplier', 'customer', 'department', 'production', 'scrap', 'adjustment'])],
        ]);
        if (! empty($validated['parent_id'])) {
            $parentMatchesWarehouse = StockLocation::query()
                ->whereKey($validated['parent_id'])
                ->where('warehouse_id', $validated['warehouse_id'])
                ->exists();
            if (! $parentMatchesWarehouse) {
                return back()->withErrors(['parent_id' => __('The parent location must belong to the selected warehouse.')]);
            }
        }
        $codeExists = StockLocation::query()
            ->where('warehouse_id', $validated['warehouse_id'])
            ->where('code', $validated['code'])
            ->exists();
        if ($codeExists) {
            return back()->withErrors(['code' => __('This location code is already used in the selected warehouse.')]);
        }

        DB::transaction(function () use ($company, $request, $validated): void {
            $location = StockLocation::query()->create([...$validated, 'company_id' => $company->id]);
            $this->audit($company, $request, 'inventory.location.created', $location, $location->only([
                'warehouse_id', 'parent_id', 'code', 'name', 'usage',
            ]));
        });

        return back()->with('success', __('Stock location created.'));
    }

    private function audit(Company $company, Request $request, string $event, Model $record, array $values): void
    {
        app(AuditLogService::class)->record(
            $company,
            $event,
            $record,
            changes: ['after' => $values],
            actor: $request->user(),
        );
    }

    private function authorizeManagement(Request $request, Company $company): void
    {
        abort_unless(
            $company->users()
                ->whereKey($request->user()->getKey())
                ->wherePivot('is_active', true)
                ->whereIn('company_user.role', ['owner', 'admin'])
                ->exists(),
            403
        );
    }
}
