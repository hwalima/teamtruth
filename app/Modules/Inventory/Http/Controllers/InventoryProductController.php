<?php

namespace App\Modules\Inventory\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\AuditLogService;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\DocumentRenderer;
use App\Modules\Core\Services\ErpRoleService;
use App\Modules\Inventory\Models\InventoryCategory;
use App\Modules\Inventory\Models\InventoryProduct;
use App\Modules\Inventory\Models\InventoryUnit;
use App\Modules\Inventory\Models\StockMoveLine;
use App\Modules\Purchase\Models\PurchaseVendorPriceList;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/** The product catalogue: list, view, add, change, remove, and the PDF catalogue. */
class InventoryProductController extends Controller
{
    private const TYPES = ['storable' => 'Stocked item', 'consumable' => 'Consumable', 'service' => 'Service'];

    public function index(Request $request): Response
    {
        $company = $this->company();
        $filters = $this->filters($request);
        $products = $this->filteredQuery($filters)
            ->with(['category:id,name', 'unit:id,name,abbreviation'])
            ->orderBy('name')
            ->paginate(25)
            ->withQueryString();
        $onHand = $this->onHand($company, $products->pluck('id')->all());

        return Inertia::render('Erp/Inventory/Products/Index', [
            'company' => $company->only(['id', 'code', 'name']),
            'products' => $products->through(fn (InventoryProduct $product) => [
                ...$this->listItem($product),
                'on_hand' => $onHand[$product->id] ?? '0',
            ]),
            'filters' => $filters,
            'categories' => $this->categoryOptions(),
            'types' => self::TYPES,
            'counts' => [
                'all' => InventoryProduct::query()->count(),
                'active' => InventoryProduct::query()->where('is_active', true)->count(),
            ],
            'canManage' => $this->can($company, 'erp.inventory.manage'),
        ]);
    }

    public function create(): Response
    {
        $company = $this->company();
        $this->authorize($company);

        return Inertia::render('Erp/Inventory/Products/Form', [
            ...$this->formOptions(),
            'product' => null,
            'hasStock' => false,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $company = $this->company();
        $this->authorize($company);
        $validated = $this->validated($request, $company);

        $product = DB::transaction(function () use ($company, $request, $validated) {
            $product = InventoryProduct::query()->create([...$validated, 'company_id' => $company->id]);
            $this->storeImage($request, $product);
            $this->audit($company, $request, 'inventory.product.created', $product, ['after' => $product->only(['sku', 'name', 'type', 'category_id', 'unit_id'])]);

            return $product;
        });

        return redirect()->route('erp.inventory.products.show', $product)->with('success', __('Product created.'));
    }

    public function show(InventoryProduct $product): Response
    {
        $company = $this->company();
        $product->load(['category:id,name,parent_id', 'unit:id,name,abbreviation']);

        return Inertia::render('Erp/Inventory/Products/Show', [
            'product' => [
                ...$this->listItem($product),
                'description' => $product->description,
                'costing_method' => $product->costing_method,
                'tracking' => $product->tracking,
                'metadata' => $product->metadata ?? [],
                'created_at' => $product->created_at?->toDateTimeString(),
                'updated_at' => $product->updated_at?->toDateTimeString(),
            ],
            'stock' => $this->stockByLocation($company, $product),
            'movements' => StockMoveLine::query()
                ->where('product_id', $product->id)
                ->with(['stockMove:id,document_number,operation,reference,moved_at', 'sourceLocation:id,code,name', 'destinationLocation:id,code,name'])
                ->latest('id')
                ->limit(15)
                ->get()
                ->map(fn (StockMoveLine $line) => [
                    'id' => $line->id,
                    'document_number' => $line->stockMove?->document_number,
                    'operation' => $line->stockMove?->operation,
                    'reference' => $line->stockMove?->reference,
                    'moved_at' => $line->stockMove?->moved_at?->toDateTimeString(),
                    'from' => $line->sourceLocation?->name,
                    'to' => $line->destinationLocation?->name,
                    'quantity' => $line->quantity,
                    'lot_code' => $line->lot_code,
                ]),
            'vendorPrices' => PurchaseVendorPriceList::query()
                ->where('product_id', $product->id)
                ->with('vendor:id,code,name')
                ->orderBy('price')
                ->get()
                ->map(fn ($price) => [
                    'id' => $price->id,
                    'vendor' => $price->vendor?->name,
                    'min_quantity' => $price->min_quantity,
                    'price' => $price->price,
                    'currency_code' => $price->currency_code,
                    'valid_from' => $price->valid_from?->toDateString(),
                ]),
            'canManage' => $this->can($company, 'erp.inventory.manage'),
        ]);
    }

    public function edit(InventoryProduct $product): Response
    {
        $company = $this->company();
        $this->authorize($company);

        return Inertia::render('Erp/Inventory/Products/Form', [
            ...$this->formOptions(),
            'product' => [
                ...$product->only(['id', 'sku', 'barcode', 'name', 'description', 'category_id', 'unit_id', 'type', 'costing_method', 'tracking', 'is_active', 'internal_reference', 'sale_price', 'cost_price']),
                'image_url' => $this->imageUrl($product),
            ],
            'hasStock' => $this->hasMovements($product),
        ]);
    }

    public function update(Request $request, InventoryProduct $product): RedirectResponse
    {
        $company = $this->company();
        $this->authorize($company);
        $validated = $this->validated($request, $company, $product);

        if ($this->hasMovements($product)) {
            $locked = array_filter([
                'unit_id' => (int) $validated['unit_id'] !== (int) $product->unit_id,
                'tracking' => $validated['tracking'] !== $product->tracking,
                'type' => $validated['type'] !== $product->type && ($validated['type'] === 'service' || $product->type === 'service'),
            ]);
            if ($locked !== []) {
                throw ValidationException::withMessages(array_map(
                    fn () => __('This product already has stock movements, so this cannot change. Create a new product instead.'),
                    $locked,
                ));
            }
        }

        DB::transaction(function () use ($company, $request, $product, $validated): void {
            $before = $product->only(array_keys($validated));
            $product->fill($validated)->save();
            $this->storeImage($request, $product);
            $this->audit($company, $request, 'inventory.product.updated', $product, ['before' => $before, 'after' => $product->only(array_keys($validated))]);
        });

        return redirect()->route('erp.inventory.products.show', $product)->with('success', __('Product saved.'));
    }

    public function destroy(Request $request, InventoryProduct $product): RedirectResponse
    {
        $company = $this->company();
        $this->authorize($company);

        try {
            DB::transaction(function () use ($company, $request, $product): void {
                PurchaseVendorPriceList::query()->where('product_id', $product->id)->delete();
                $product->delete();
                $this->audit($company, $request, 'inventory.product.deleted', $product, ['before' => $product->only(['sku', 'name'])]);
            });
        } catch (QueryException) {
            return back()->with('error', __(':name has stock movements, orders or invoices, so it cannot be deleted. Mark it inactive instead (Edit → Active).', ['name' => $product->name]));
        }

        if ($product->image_path) {
            Storage::disk('public')->delete($product->image_path);
        }

        return redirect()->route('erp.inventory.products.index')->with('success', __('Product deleted.'));
    }

    /** The catalogue as a branded PDF, with the same filters as the list. */
    public function pdf(Request $request, DocumentRenderer $renderer): HttpResponse
    {
        $company = $this->company();
        $filters = $this->filters($request);
        $products = $this->filteredQuery($filters)
            ->with(['category:id,name', 'unit:id,abbreviation'])
            ->orderBy('name')
            ->get();
        $onHand = $this->onHand($company, $products->pluck('id')->all());

        $rows = $products->map(fn (InventoryProduct $product) => [
            $product->sku,
            $product->name,
            $product->internal_reference ?? '',
            $product->category?->name ?? '',
            self::TYPES[$product->type] ?? $product->type,
            $product->unit?->abbreviation ?? '',
            $this->number($onHand[$product->id] ?? '0'),
            $product->sale_price !== null ? $this->number($product->sale_price, 2) : '',
            $product->is_active ? 'Active' : 'Inactive',
        ])->all();

        $applied = array_filter([
            $filters['search'] ? 'Search: “'.$filters['search'].'”' : null,
            $filters['category_id'] ? 'Category: '.InventoryCategory::query()->whereKey($filters['category_id'])->value('name') : null,
            $filters['type'] ? 'Type: '.(self::TYPES[$filters['type']] ?? $filters['type']) : null,
            $filters['status'] ? 'Status: '.ucfirst($filters['status']) : null,
        ]);

        $pdf = $renderer->renderForCompany($company, 'pdf.documents.inventory-report', [
            'documentTitle' => 'Product catalogue',
            'reportTitle' => 'Product catalogue',
            'reportSubtitle' => $applied ? implode(' · ', $applied) : 'All products',
            'columns' => ['SKU', 'Product', 'Reference', 'Category', 'Type', 'Unit', 'On hand', 'Sales price', 'Status'],
            'numericColumns' => [6, 7],
            'rows' => $rows,
            'stats' => [
                'Products' => number_format(count($rows)),
                'Active' => number_format($products->where('is_active', true)->count()),
                'In stock' => number_format(collect($onHand)->filter(fn ($q) => (float) $q > 0)->count()),
                'Categories' => number_format($products->pluck('category_id')->filter()->unique()->count()),
            ],
        ]);

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.Str::slug('products-'.$company->code.'-'.now()->format('Y-m-d')).'.pdf"',
        ]);
    }

    private function filters(Request $request): array
    {
        return [
            'search' => trim((string) $request->input('search', '')),
            'category_id' => $request->integer('category_id') ?: null,
            'type' => in_array($request->input('type'), array_keys(self::TYPES), true) ? $request->input('type') : '',
            'status' => in_array($request->input('status'), ['active', 'inactive'], true) ? $request->input('status') : '',
        ];
    }

    private function filteredQuery(array $filters): Builder
    {
        return InventoryProduct::query()
            ->when($filters['search'] !== '', function (Builder $query) use ($filters) {
                $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $filters['search']).'%';
                $query->where(fn (Builder $q) => $q->where('name', 'like', $like)->orWhere('sku', 'like', $like)
                    ->orWhere('barcode', 'like', $like)->orWhere('internal_reference', 'like', $like));
            })
            ->when($filters['category_id'], fn (Builder $query, $id) => $query->where('category_id', $id))
            ->when($filters['type'] !== '', fn (Builder $query) => $query->where('type', $filters['type']))
            ->when($filters['status'] !== '', fn (Builder $query) => $query->where('is_active', $filters['status'] === 'active'));
    }

    /** @return array<int, string> product id => quantity in internal locations */
    private function onHand(Company $company, array $productIds): array
    {
        if ($productIds === []) {
            return [];
        }

        $in = DB::table('stock_move_lines as l')->join('stock_locations as s', 's.id', '=', 'l.to_location_id')
            ->where('l.company_id', $company->id)->where('s.usage', 'internal')->whereIn('l.product_id', $productIds)
            ->groupBy('l.product_id')->selectRaw('l.product_id, sum(l.quantity) as qty')->pluck('qty', 'product_id');
        $out = DB::table('stock_move_lines as l')->join('stock_locations as s', 's.id', '=', 'l.from_location_id')
            ->where('l.company_id', $company->id)->where('s.usage', 'internal')->whereIn('l.product_id', $productIds)
            ->groupBy('l.product_id')->selectRaw('l.product_id, sum(l.quantity) as qty')->pluck('qty', 'product_id');

        $totals = [];
        foreach ($productIds as $id) {
            $totals[$id] = $this->trim((float) ($in[$id] ?? 0) - (float) ($out[$id] ?? 0));
        }

        return $totals;
    }

    private function stockByLocation(Company $company, InventoryProduct $product): array
    {
        $in = DB::table('stock_move_lines')->where('company_id', $company->id)->where('product_id', $product->id)->whereNotNull('to_location_id')
            ->groupBy('to_location_id', 'lot_code')->selectRaw('to_location_id as location_id, lot_code, sum(quantity) as qty')->get();
        $out = DB::table('stock_move_lines')->where('company_id', $company->id)->where('product_id', $product->id)->whereNotNull('from_location_id')
            ->groupBy('from_location_id', 'lot_code')->selectRaw('from_location_id as location_id, lot_code, sum(quantity) as qty')->get();

        $balances = [];
        foreach ($in as $row) {
            $balances[$row->location_id.'|'.$row->lot_code] = ['location_id' => $row->location_id, 'lot_code' => $row->lot_code, 'qty' => (float) $row->qty];
        }
        foreach ($out as $row) {
            $key = $row->location_id.'|'.$row->lot_code;
            $balances[$key] ??= ['location_id' => $row->location_id, 'lot_code' => $row->lot_code, 'qty' => 0.0];
            $balances[$key]['qty'] -= (float) $row->qty;
        }

        $locations = DB::table('stock_locations as s')->leftJoin('inventory_warehouses as w', 'w.id', '=', 's.warehouse_id')
            ->whereIn('s.id', array_column($balances, 'location_id'))->where('s.usage', 'internal')
            ->get(['s.id', 's.name', 'w.name as warehouse'])->keyBy('id');

        return collect($balances)
            ->filter(fn ($b) => $locations->has($b['location_id']) && abs($b['qty']) > 0.00005)
            ->map(fn ($b) => [
                'location' => trim(($locations[$b['location_id']]->warehouse ?? '').' / '.$locations[$b['location_id']]->name, ' /'),
                'lot_code' => $b['lot_code'],
                'quantity' => $this->trim($b['qty']),
            ])
            ->values()
            ->all();
    }

    private function validated(Request $request, Company $company, ?InventoryProduct $product = null): array
    {
        $validated = $request->validate([
            'sku' => ['required', 'string', 'max:80', 'regex:/^[A-Za-z0-9._-]+$/', Rule::unique('inventory_products', 'sku')->where('company_id', $company->id)->ignore($product?->id)],
            'barcode' => ['nullable', 'string', 'max:120', Rule::unique('inventory_products', 'barcode')->where('company_id', $company->id)->ignore($product?->id)],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:10000'],
            'internal_reference' => ['nullable', 'string', 'max:120'],
            'category_id' => ['nullable', 'integer', Rule::exists('inventory_categories', 'id')->where('company_id', $company->id)],
            'unit_id' => ['required', 'integer', Rule::exists('inventory_units', 'id')->where('company_id', $company->id)],
            'type' => ['required', Rule::in(array_keys(self::TYPES))],
            'costing_method' => ['required', Rule::in(['average', 'fifo'])],
            'tracking' => ['required', Rule::in(['none', 'lot', 'serial'])],
            'sale_price' => ['nullable', 'numeric', 'min:0', 'max:9999999999999'],
            'cost_price' => ['nullable', 'numeric', 'min:0', 'max:9999999999999'],
            'is_active' => ['sometimes', 'boolean'],
            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,gif,webp', 'max:4096'],
            'remove_image' => ['sometimes', 'boolean'],
        ]);
        if ($validated['type'] === 'service' && $validated['tracking'] !== 'none') {
            throw ValidationException::withMessages(['tracking' => __('Service products cannot use lot or serial tracking.')]);
        }
        unset($validated['image'], $validated['remove_image']);
        $validated['is_active'] = $request->boolean('is_active', $product?->is_active ?? true);

        return $validated;
    }

    private function storeImage(Request $request, InventoryProduct $product): void
    {
        $old = $product->image_path;
        if ($request->hasFile('image')) {
            $path = $request->file('image')->store("products/{$product->company_id}", 'public');
            $product->forceFill(['image_path' => $path])->save();
        } elseif ($request->boolean('remove_image')) {
            $product->forceFill(['image_path' => null])->save();
        } else {
            return;
        }
        if ($old && $old !== $product->image_path) {
            DB::afterCommit(fn () => Storage::disk('public')->delete($old));
        }
    }

    private function hasMovements(InventoryProduct $product): bool
    {
        return StockMoveLine::query()->where('product_id', $product->id)->exists();
    }

    private function listItem(InventoryProduct $product): array
    {
        return [
            'id' => $product->id,
            'sku' => $product->sku,
            'barcode' => $product->barcode,
            'name' => $product->name,
            'internal_reference' => $product->internal_reference,
            'type' => $product->type,
            'type_label' => self::TYPES[$product->type] ?? $product->type,
            'is_active' => $product->is_active,
            'sale_price' => $product->sale_price,
            'cost_price' => $product->cost_price,
            'category' => $product->category?->only(['id', 'name']),
            'unit' => $product->unit?->only(['id', 'name', 'abbreviation']),
            'image_url' => $this->imageUrl($product),
        ];
    }

    private function formOptions(): array
    {
        return [
            'categories' => $this->categoryOptions(),
            'units' => InventoryUnit::query()->orderByDesc('is_active')->orderBy('name')->get(['id', 'name', 'abbreviation', 'is_active'])
                ->map(fn ($unit) => ['value' => $unit->id, 'label' => "{$unit->name} ({$unit->abbreviation})".($unit->is_active ? '' : ' — inactive')]),
            'types' => self::TYPES,
        ];
    }

    /** Categories with their parent path, e.g. "Mining / Spares". */
    private function categoryOptions(): array
    {
        $categories = InventoryCategory::query()->get(['id', 'name', 'parent_id'])->keyBy('id');
        $path = function ($category) use ($categories): string {
            $names = [$category->name];
            $seen = [$category->id => true];
            while ($category->parent_id && ($parent = $categories->get($category->parent_id)) && ! isset($seen[$parent->id])) {
                array_unshift($names, $parent->name);
                $seen[$parent->id] = true;
                $category = $parent;
            }

            return implode(' / ', $names);
        };

        return $categories->map(fn ($category) => ['value' => $category->id, 'label' => $path($category)])
            ->sortBy('label', SORT_NATURAL | SORT_FLAG_CASE)->values()->all();
    }

    private function imageUrl(InventoryProduct $product): ?string
    {
        return $product->image_path ? Storage::disk('public')->url($product->image_path) : null;
    }

    private function trim(float $value): string
    {
        return rtrim(rtrim(number_format($value, 4, '.', ''), '0'), '.') ?: '0';
    }

    private function number(string|float $value, int $decimals = -1): string
    {
        $value = (float) $value;
        if ($decimals >= 0) {
            return number_format($value, $decimals);
        }
        $trimmed = $this->trim($value);
        $places = str_contains($trimmed, '.') ? strlen(explode('.', $trimmed)[1]) : 0;

        return number_format($value, $places);
    }

    private function company(): Company
    {
        return app(CompanyContext::class)->requireActiveCompany();
    }

    private function can(Company $company, string $permission): bool
    {
        return app(ErpRoleService::class)->allows($company, request()->user(), $permission);
    }

    private function authorize(Company $company): void
    {
        app(ErpRoleService::class)->authorize($company, request()->user(), 'erp.inventory.manage');
    }

    private function audit(Company $company, Request $request, string $event, InventoryProduct $product, array $changes): void
    {
        app(AuditLogService::class)->record($company, $event, $product, changes: $changes, actor: $request->user());
    }
}
