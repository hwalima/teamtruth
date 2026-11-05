<?php

namespace App\Modules\Inventory\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Inventory\Models\InventoryProduct;
use App\Modules\Inventory\Models\StockLocation;
use App\Modules\Inventory\Models\StockMove;
use App\Modules\Inventory\Services\InventoryStockService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class StockMovementController extends Controller
{
    public function index(Request $request, InventoryStockService $stockService): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeMovement($request, $company);
        $products = InventoryProduct::query()
            ->with('unit:id,name,abbreviation')
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'sku', 'name', 'type', 'tracking', 'unit_id']);
        $locations = StockLocation::query()
            ->with('warehouse:id,code,name')
            ->where('is_active', true)
            ->orderBy('warehouse_id')
            ->orderBy('code')
            ->get();
        $productById = $products->keyBy('id');
        $locationById = $locations->keyBy('id');
        $balances = collect($stockService->balances($company))
            ->map(function (object $balance) use ($productById, $locationById): array {
                $product = $productById->get($balance->product_id);
                $location = $locationById->get($balance->location_id);

                return [
                    'product_id' => $balance->product_id,
                    'sku' => $product?->sku,
                    'product_name' => $product?->name,
                    'unit' => $product?->unit?->abbreviation,
                    'location_id' => $balance->location_id,
                    'warehouse' => $location?->warehouse?->code,
                    'location' => $location?->name,
                    'lot_code' => $balance->lot_code,
                    'quantity' => $balance->quantity,
                ];
            })
            ->all();

        return Inertia::render('Erp/Inventory/Stock', [
            'company' => $company->only(['id', 'code', 'name']),
            'products' => $products,
            'locations' => $locations->map(fn (StockLocation $location): array => [
                'id' => $location->id,
                'warehouse_id' => $location->warehouse_id,
                'warehouse_code' => $location->warehouse?->code,
                'warehouse_name' => $location->warehouse?->name,
                'code' => $location->code,
                'name' => $location->name,
                'usage' => $location->usage,
            ]),
            'balances' => $balances,
            'movements' => StockMove::query()
                ->with([
                    'creator:id,name',
                    'lines.product:id,sku,name,unit_id',
                    'lines.product.unit:id,abbreviation',
                    'lines.sourceLocation:id,code,name',
                    'lines.destinationLocation:id,code,name',
                ])
                ->latest('moved_at')
                ->limit(100)
                ->get(),
        ]);
    }

    public function store(Request $request, InventoryStockService $stockService): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeMovement($request, $company);
        $validated = $request->validate([
            'operation' => ['required', Rule::in(['receipt', 'issue', 'transfer', 'adjustment', 'scrap'])],
            'product_id' => [
                'required',
                'integer',
                Rule::exists('inventory_products', 'id')->where('company_id', $company->id)->where('is_active', true),
            ],
            'from_location_id' => [
                'nullable',
                'integer',
                Rule::exists('stock_locations', 'id')->where('company_id', $company->id)->where('is_active', true),
            ],
            'to_location_id' => [
                'nullable',
                'integer',
                Rule::exists('stock_locations', 'id')->where('company_id', $company->id)->where('is_active', true),
            ],
            'quantity' => ['required', 'numeric', 'gt:0', 'decimal:0,4', 'max:9999999999999999'],
            'lot_code' => ['nullable', 'string', 'max:120'],
            'reference' => ['nullable', 'string', 'max:255'],
            'moved_at' => ['nullable', 'date'],
        ]);

        $stockService->postMovement($company, $request->user(), $validated);

        return back()->with('success', __('Stock movement posted.'));
    }

    private function authorizeMovement(Request $request, Company $company): void
    {
        abort_unless(
            $company->users()
                ->whereKey($request->user()->getKey())
                ->wherePivot('is_active', true)
                ->whereIn('company_user.role', ['owner', 'admin', 'manager'])
                ->exists(),
            403
        );
    }
}
