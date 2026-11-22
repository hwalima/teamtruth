<?php

namespace App\Modules\Inventory\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\AuditLogService;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\ErpRoleService;
use App\Modules\Inventory\Models\InventoryCategory;
use App\Modules\Inventory\Models\InventoryProduct;
use App\Modules\Inventory\Models\InventoryUnit;
use App\Modules\Inventory\Models\InventoryWarehouse;
use App\Modules\Inventory\Models\StockLocation;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
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

        $productsPerUnit = InventoryProduct::query()->selectRaw('unit_id, count(*) as total')->groupBy('unit_id')->pluck('total', 'unit_id');
        $productsPerCategory = InventoryProduct::query()->whereNotNull('category_id')->selectRaw('category_id, count(*) as total')->groupBy('category_id')->pluck('total', 'category_id');

        return Inertia::render('Erp/Inventory/Setup', [
            'company' => $company->only(['id', 'code', 'name']),
            'units' => InventoryUnit::query()->orderByDesc('is_active')->orderBy('category')->orderBy('name')->get()
                ->map(fn (InventoryUnit $unit) => [...$unit->only(['id', 'name', 'abbreviation', 'category', 'factor_to_base', 'is_base', 'is_active']), 'products_count' => (int) ($productsPerUnit[$unit->id] ?? 0)]),
            'categories' => InventoryCategory::query()->orderByDesc('is_active')->orderBy('name')->get()
                ->map(fn (InventoryCategory $category) => [...$category->only(['id', 'name', 'description', 'parent_id', 'is_active']), 'products_count' => (int) ($productsPerCategory[$category->id] ?? 0)]),
            'productCount' => InventoryProduct::query()->count(),
            'warehouses' => InventoryWarehouse::query()
                ->with(['locations' => fn ($query) => $query->orderByDesc('is_active')->orderBy('code')])
                ->orderByDesc('is_active')
                ->orderBy('name')
                ->get()
                ->map(fn (InventoryWarehouse $warehouse) => [
                    ...$warehouse->only(['id', 'code', 'name', 'address', 'is_active']),
                    'locations' => $warehouse->locations->map(fn (StockLocation $location) => $location->only(['id', 'warehouse_id', 'parent_id', 'code', 'name', 'usage', 'is_active']))->values(),
                ]),
            'canManage' => app(ErpRoleService::class)->allows($company, request()->user(), 'erp.inventory.manage'),
        ]);
    }

    public function updateUnit(Request $request, InventoryUnit $unit): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'abbreviation' => ['required', 'string', 'max:20', 'regex:/^[A-Za-z0-9._-]+$/', Rule::unique('inventory_units', 'abbreviation')->where('company_id', $company->id)->ignore($unit->id)],
            'is_active' => ['required', 'boolean'],
        ]);
        $before = $unit->only(array_keys($validated));
        $unit->update($validated);
        $this->auditChange($company, $request, 'inventory.unit.updated', $unit, $before, $validated);

        return back()->with('success', __('Unit of measure updated.'));
    }

    public function destroyUnit(Request $request, InventoryUnit $unit): RedirectResponse
    {
        return $this->remove($request, $unit, 'inventory.unit.deleted', fn () => $unit->delete(),
            __(':name is used by products or documents, so it cannot be deleted. Mark it inactive instead.', ['name' => $unit->name]),
            __('Unit of measure deleted.'));
    }

    public function updateCategory(Request $request, InventoryCategory $category): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120', Rule::unique('inventory_categories', 'name')->where('company_id', $company->id)->ignore($category->id)],
            'description' => ['nullable', 'string', 'max:1000'],
            'parent_id' => ['nullable', 'integer', Rule::exists('inventory_categories', 'id')->where('company_id', $company->id)],
            'is_active' => ['required', 'boolean'],
        ]);
        if (! empty($validated['parent_id']) && $this->isSelfOrDescendant($category, (int) $validated['parent_id'])) {
            throw ValidationException::withMessages(['parent_id' => __('A category cannot sit inside itself or one of its own sub-categories.')]);
        }
        $before = $category->only(array_keys($validated));
        $category->update($validated);
        $this->auditChange($company, $request, 'inventory.category.updated', $category, $before, $validated);

        return back()->with('success', __('Product category updated.'));
    }

    public function destroyCategory(Request $request, InventoryCategory $category): RedirectResponse
    {
        return $this->remove($request, $category, 'inventory.category.deleted', fn () => $category->delete(),
            __(':name still has products or sub-categories. Move them first, or mark it inactive instead.', ['name' => $category->name]),
            __('Product category deleted.'));
    }

    public function updateWarehouse(Request $request, InventoryWarehouse $warehouse): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:40', 'regex:/^[A-Za-z0-9_-]+$/', Rule::unique('inventory_warehouses', 'code')->where('company_id', $company->id)->ignore($warehouse->id)],
            'name' => ['required', 'string', 'max:160'],
            'address' => ['nullable', 'string', 'max:1000'],
            'is_active' => ['required', 'boolean'],
        ]);
        $before = $warehouse->only(array_keys($validated));
        $warehouse->update($validated);
        $this->auditChange($company, $request, 'inventory.warehouse.updated', $warehouse, $before, $validated);

        return back()->with('success', __('Warehouse updated.'));
    }

    public function destroyWarehouse(Request $request, InventoryWarehouse $warehouse): RedirectResponse
    {
        return $this->remove($request, $warehouse, 'inventory.warehouse.deleted', function () use ($warehouse): void {
            // Child locations first, so nested ones go before their parents.
            $locations = StockLocation::query()->where('warehouse_id', $warehouse->id)->get();
            while ($locations->isNotEmpty()) {
                $parents = $locations->pluck('parent_id')->filter()->all();
                $leaves = $locations->reject(fn ($location) => in_array($location->id, $parents, true));
                if ($leaves->isEmpty()) {
                    $leaves = $locations;
                }
                $leaves->each->delete();
                $locations = $locations->diff($leaves);
            }
            $warehouse->delete();
        },
            __(':name has stock movements or documents, so it cannot be deleted. Mark it inactive instead.', ['name' => $warehouse->name]),
            __('Warehouse and its locations deleted.'));
    }

    public function updateLocation(Request $request, StockLocation $location): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:40', 'regex:/^[A-Za-z0-9_-]+$/'],
            'name' => ['required', 'string', 'max:160'],
            'usage' => ['required', Rule::in(['internal', 'supplier', 'customer', 'department', 'production', 'scrap', 'adjustment'])],
            'is_active' => ['required', 'boolean'],
        ]);
        $codeTaken = StockLocation::query()->where('warehouse_id', $location->warehouse_id)->where('code', $validated['code'])->whereKeyNot($location->id)->exists();
        if ($codeTaken) {
            throw ValidationException::withMessages(['code' => __('This location code is already used in the selected warehouse.')]);
        }
        $hasMovements = DB::table('stock_move_lines')->where('from_location_id', $location->id)->orWhere('to_location_id', $location->id)->exists();
        if ($hasMovements && $validated['usage'] !== $location->usage) {
            throw ValidationException::withMessages(['usage' => __('Stock has already moved through this location, so its type cannot change.')]);
        }
        $before = $location->only(array_keys($validated));
        $location->update($validated);
        $this->auditChange($company, $request, 'inventory.location.updated', $location, $before, $validated);

        return back()->with('success', __('Stock location updated.'));
    }

    public function destroyLocation(Request $request, StockLocation $location): RedirectResponse
    {
        return $this->remove($request, $location, 'inventory.location.deleted', fn () => $location->delete(),
            __(':name has stock movements, documents or sub-locations, so it cannot be deleted. Mark it inactive instead.', ['name' => $location->name]),
            __('Stock location deleted.'));
    }

    /** Delete inside a transaction; anything still pointing at the record blocks it. */
    private function remove(Request $request, Model $record, string $event, callable $delete, string $inUse, string $done): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);
        $values = $record->only(['code', 'name', 'abbreviation']);

        try {
            DB::transaction(function () use ($company, $request, $record, $event, $delete, $values): void {
                $delete();
                app(AuditLogService::class)->record($company, $event, $record, changes: ['before' => $values], actor: $request->user());
            });
        } catch (QueryException) {
            return back()->with('error', $inUse);
        }

        return back()->with('success', $done);
    }

    private function isSelfOrDescendant(InventoryCategory $category, int $candidateId): bool
    {
        $parents = InventoryCategory::query()->pluck('parent_id', 'id');
        $seen = [];
        for ($id = $candidateId; $id && ! isset($seen[$id]); $id = $parents[$id] ?? null) {
            if ($id === $category->id) {
                return true;
            }
            $seen[$id] = true;
        }

        return false;
    }

    private function auditChange(Company $company, Request $request, string $event, Model $record, array $before, array $after): void
    {
        app(AuditLogService::class)->record($company, $event, $record, changes: ['before' => $before, 'after' => $after], actor: $request->user());
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
        app(ErpRoleService::class)->authorize($company, $request->user(), 'erp.inventory.manage');
    }
}
