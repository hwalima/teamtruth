<?php

namespace App\Modules\DataImport\Services\Odoo;

use App\Modules\DataImport\Services\ImportContext;
use App\Modules\Inventory\Models\InventoryCategory;
use App\Modules\Inventory\Models\InventoryProduct;
use App\Modules\Inventory\Models\InventoryUnit;
use App\Modules\Inventory\Models\InventoryWarehouse;
use App\Modules\Inventory\Models\StockLocation;
use App\Modules\Inventory\Services\InventoryStockService;
use App\Modules\Purchase\Models\PurchaseVendorPriceList;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Odoo products (product.template / product.product).
 *
 * Creates whatever the products need: categories (the full "All / Mining / Spares"
 * path), units, vendors and their prices, and the stock location for the opening
 * stock. Every column, used or not, is kept on the product under metadata.odoo.
 */
class ProductImporter extends OdooImporter
{
    /** Odoo's names for "one item". They all become one unit here. */
    private const EACH = ['units', 'unit', 'unit(s)', 'pcs', 'pc', 'piece', 'pieces', 'each', 'ea'];

    private const UNIT_KINDS = [
        'weight' => ['kg', 'g', 'gram', 'grams', 'ton', 'tons', 't', 'tonne', 'lb', 'lbs', 'oz', 'mg'],
        'volume' => ['l', 'litre', 'liter', 'litres', 'liters', 'ml', 'm3', 'gal', 'gallon', 'gallons'],
        'length' => ['m', 'mm', 'cm', 'km', 'meter', 'metre', 'meters', 'metres', 'ft', 'in', 'inch', 'yd'],
        'time' => ['hour', 'hours', 'h', 'day', 'days', 'minute', 'minutes'],
    ];

    private ?array $stockLocations = null;

    private array $units = [];

    private array $categories = [];

    private int $skuCounter = 0;

    public function __construct(private InventoryStockService $stock, private Partners $partners) {}

    public function model(): string
    {
        return 'product.template';
    }

    public function fileModels(): array
    {
        return ['product.template', 'product.product'];
    }

    public function label(): string
    {
        return 'Products';
    }

    public function permissions(): array
    {
        return ['erp.inventory.manage'];
    }

    public function permissionsFor(array $options): array
    {
        return ($options['import_stock'] ?? true) ? ['erp.inventory.manage', 'erp.stock.manage'] : ['erp.inventory.manage'];
    }

    public function aliases(): array
    {
        return [
            'id' => ['id', 'External ID', 'ID'],
            'name' => ['name', 'Name', 'Product Name', 'Product'],
            'default_code' => ['default_code', 'Internal Reference', 'Reference'],
            'barcode' => ['barcode', 'Barcode'],
            'category' => ['categ_id', 'Product Category', 'Category'],
            'unit' => ['uom_id', 'Unit', 'Unit of Measure', 'UoM', 'Units of Measure'],
            'purchase_unit' => ['uom_po_id', 'Purchase Unit', 'Purchase UoM', 'Purchase Unit of Measure'],
            'sale_price' => ['list_price', 'Sales Price', 'Sale Price', 'Price'],
            'cost' => ['standard_price', 'Cost'],
            'type' => ['detailed_type', 'type', 'Product Type'],
            'is_storable' => ['is_storable', 'Track Inventory'],
            'tracking' => ['tracking', 'Tracking', 'Track By'],
            'quantity' => ['qty_available', 'Quantity On Hand', 'On Hand', 'Quantity'],
            'active' => ['active', 'Active'],
            'description' => ['description', 'Description', 'Internal Notes'],
            'description_sale' => ['description_sale', 'Sales Description'],
            'image' => ['image_1920', 'Image', 'Image 1920', 'image_1024', 'Image 1024', 'image_512', 'Image 512', 'image_256', 'Image 256', 'image_128', 'Image 128'],
            'vendor' => ['seller_ids/partner_id', 'seller_ids/name', 'Vendors/Vendor', 'Vendor Pricelist/Vendor', 'Vendors', 'Vendor'],
            'vendor_price' => ['seller_ids/price', 'Vendors/Price', 'Vendor Pricelist/Price', 'Vendor Price'],
            'vendor_min_qty' => ['seller_ids/min_qty', 'Vendors/Quantity', 'Vendors/Minimal Quantity', 'Vendor Pricelist/Quantity'],
            'vendor_currency' => ['seller_ids/currency_id', 'Vendors/Currency', 'Vendor Pricelist/Currency'],
            'vendor_code' => ['seller_ids/product_code', 'Vendors/Vendor Product Code', 'Vendor Pricelist/Vendor Product Code'],
            'currency' => ['currency_id', 'Currency'],
        ];
    }

    public function run(ImportContext $context, array $rows, array $columns): void
    {
        $products = $this->group($rows, $columns);
        $this->warnAboutDuplicates($context, $products, $columns);

        $seen = [];
        foreach ($products as $product) {
            $name = $this->text($product['data'], $columns, 'name', 255);
            $key = $this->nameKey($name);
            $seen[$key] = ($seen[$key] ?? 0) + 1;
            $nameKey = $seen[$key] > 1 ? "{$key}#{$seen[$key]}" : $key;

            try {
                $this->importProduct($context, $product, $columns, $name, $nameKey);
            } catch (ValidationException $e) {
                $context->row($product['row_number'], 'error', collect($e->errors())->flatten()->all());
            }
        }
    }

    /**
     * An Odoo export lists one-to-many values (several vendors) on extra rows
     * under the product, with the product's own columns left empty.
     */
    private function group(array $rows, array $columns): array
    {
        $products = [];
        foreach ($rows as $row) {
            $isMain = $this->text($row['data'], $columns, 'name') !== null || $this->text($row['data'], $columns, 'id') !== null;
            if ($isMain) {
                $products[] = ['row_number' => $row['row_number'], 'data' => $row['data'], 'extra' => []];
            } elseif ($products !== []) {
                $products[count($products) - 1]['extra'][] = $row;
            }
        }

        return $products;
    }

    private function warnAboutDuplicates(ImportContext $context, array $products, array $columns): void
    {
        $byName = [];
        foreach ($products as $product) {
            $name = $this->text($product['data'], $columns, 'name');
            if ($name !== null) {
                $byName[OdooSheet::key($name)][] = $product['row_number'];
            }
        }
        foreach ($byName as $rowNumbers) {
            if (count($rowNumbers) > 1) {
                foreach ($rowNumbers as $rowNumber) {
                    $others = implode(', ', array_diff($rowNumbers, [$rowNumber]));
                    $context->row($rowNumber, 'pending', ["Same name as row {$others}. Both are imported; merge them later if they are the same item."]);
                }
                $context->add('possible_duplicates', count($rowNumbers));
            }
        }
    }

    private function importProduct(ImportContext $context, array $product, array $columns, ?string $name, string $nameKey): void
    {
        $rowNumber = $product['row_number'];
        $data = $product['data'];
        if ($name === null) {
            $context->row($rowNumber, 'error', ['The product has no name.']);

            return;
        }

        $odooId = $this->text($data, $columns, 'id');
        $existing = $context->find($this->model(), $odooId) ?? $context->find($this->model(), $nameKey);
        $barcode = $this->text($data, $columns, 'barcode', 120);
        if (! $existing && $barcode !== null) {
            $existing = InventoryProduct::query()->where('barcode', $barcode)->first();
        }

        if ($existing && ! $context->option('update_existing', true)) {
            $context->row($rowNumber, 'skipped', ['Already imported; updating existing products is switched off.'], $existing);

            return;
        }

        $reference = $this->text($data, $columns, 'default_code', 120);
        $metadata = $this->metadata($existing, $product, $columns);
        $attributes = [
            'name' => $name,
            'barcode' => $barcode,
            'internal_reference' => $reference,
            'category_id' => $this->category($context, $this->text($data, $columns, 'category'))?->id,
            'unit_id' => $this->unit($context, $this->text($data, $columns, 'unit') ?? 'Units')->id,
            'description' => $this->text($data, $columns, 'description') ?? $this->text($data, $columns, 'description_sale'),
            'type' => $this->type($data, $columns),
            'tracking' => $this->tracking($data, $columns),
            'is_active' => $this->flag($data, $columns, 'active', true),
            'sale_price' => $this->number($data, $columns, 'sale_price'),
            'cost_price' => $this->number($data, $columns, 'cost'),
            'metadata' => $metadata,
        ];

        if ($barcode !== null && InventoryProduct::query()->where('barcode', $barcode)->when($existing, fn ($q) => $q->whereKeyNot($existing->id))->exists()) {
            $attributes['barcode'] = null;
            $context->row($rowNumber, 'pending', ["Barcode {$barcode} is already used by another product, so it was left off."]);
        }

        if ($existing) {
            $existing->fill($attributes);
            $action = $existing->isDirty() ? 'updated' : 'unchanged';
            $existing->save();
            $record = $existing;
        } else {
            $record = InventoryProduct::query()->create([
                ...$attributes,
                'sku' => $this->sku($context, $reference),
                'costing_method' => 'average',
            ]);
            $action = 'created';
        }

        $context->remember($this->model(), $odooId, $record);
        $context->remember($this->model(), $nameKey, $record);
        $context->row($rowNumber, $action, [], $record);
        foreach ($product['extra'] as $extra) {
            $context->row($extra['row_number'], 'merged', ["More of row {$rowNumber} ({$name})."], $record);
        }

        $this->image($context, $rowNumber, $record, $this->text($data, $columns, 'image'));
        $this->vendors($context, $rowNumber, $record, [$product, ...$product['extra']], $columns);
        $this->openingStock($context, $rowNumber, $record, $this->number($data, $columns, 'quantity'));
    }

    /** Every column of the Odoo row (pictures aside), so nothing on the sheet is lost. */
    private function metadata(?InventoryProduct $existing, array $product, array $columns): array
    {
        $imageColumn = $columns['image'] ?? null;
        $odoo = array_filter($product['data'], fn ($value, $header) => $header !== $imageColumn && $value !== null, ARRAY_FILTER_USE_BOTH);
        foreach ($product['extra'] as $extra) {
            $odoo['_extra_rows'][] = array_filter($extra['data'], fn ($value) => $value !== null);
        }

        return [...($existing?->metadata ?? []), 'odoo' => $odoo];
    }

    private function type(array $data, array $columns): string
    {
        $type = OdooSheet::key((string) $this->text($data, $columns, 'type'));
        $storable = $this->flag($data, $columns, 'is_storable');

        return match (true) {
            $type === 'service' => 'service',
            in_array($type, ['product', 'storable product', 'storable'], true) => 'storable',
            in_array($type, ['consu', 'consumable', 'goods', 'combo'], true) => $storable === false || ($storable === null && $type === 'consumable') ? 'consumable' : 'storable',
            default => $storable === false ? 'consumable' : 'storable',
        };
    }

    private function tracking(array $data, array $columns): string
    {
        $tracking = OdooSheet::key((string) $this->text($data, $columns, 'tracking'));

        return match (true) {
            str_contains($tracking, 'serial') => 'serial',
            str_contains($tracking, 'lot') => 'lot',
            default => 'none',
        };
    }

    private function sku(ImportContext $context, ?string $reference): string
    {
        if ($context->option('reference_as_sku') && $reference !== null && ! InventoryProduct::query()->where('sku', $reference)->exists()) {
            return $reference;
        }

        do {
            $this->skuCounter = $this->skuCounter ?: (int) InventoryProduct::query()->where('sku', 'like', 'OD-%')->count();
            $sku = sprintf('OD-%05d', ++$this->skuCounter);
        } while (InventoryProduct::query()->where('sku', $sku)->exists());

        return $sku;
    }

    /** "All / Mining / Spares" becomes Mining > Spares. Odoo's root "All" is left out. */
    private function category(ImportContext $context, ?string $path): ?InventoryCategory
    {
        if ($path === null) {
            return null;
        }

        $parts = array_values(array_filter(array_map('trim', explode('/', $path)), fn ($part) => $part !== ''));
        if (count($parts) > 1 && OdooSheet::key($parts[0]) === 'all') {
            array_shift($parts);
        }

        $parent = null;
        foreach ($parts as $part) {
            $part = mb_substr($part, 0, 120);
            $key = OdooSheet::key($part);
            $category = $this->categories[$key] ??= InventoryCategory::query()->whereRaw('lower(name) = ?', [$key])->first();
            if (! $category) {
                $category = InventoryCategory::query()->create(['name' => $part, 'parent_id' => $parent?->id, 'is_active' => true]);
                $this->categories[$key] = $category;
                $context->created('categories', $parent ? "{$parent->name} / {$part}" : $part, $category);
            }
            $parent = $category;
        }

        return $parent;
    }

    private function unit(ImportContext $context, string $odooName): InventoryUnit
    {
        $key = OdooSheet::key($odooName);
        $isEach = in_array($key, self::EACH, true);
        $cacheKey = $isEach ? 'each' : $key;
        if (isset($this->units[$cacheKey])) {
            return $this->units[$cacheKey];
        }

        $names = $isEach ? self::EACH : [$key];
        $marks = implode(',', array_fill(0, count($names), '?'));
        $unit = InventoryUnit::query()
            ->where(fn ($q) => $q->whereRaw("lower(name) in ({$marks})", $names)->orWhereRaw("lower(abbreviation) in ({$marks})", $names))
            ->orderByDesc('is_active')
            ->first();

        if (! $unit) {
            $kind = 'quantity';
            foreach (self::UNIT_KINDS as $candidate => $names) {
                if (in_array($key, $names, true)) {
                    $kind = $candidate;
                }
            }
            $label = $isEach ? 'Units' : mb_substr($odooName, 0, 100);
            $abbreviation = $isEach ? 'Unit' : (trim(mb_substr(preg_replace('/[^A-Za-z0-9._-]+/', '-', $odooName), 0, 20), '-') ?: 'U');
            $base = $abbreviation;
            for ($n = 2; InventoryUnit::query()->where('abbreviation', $abbreviation)->exists(); $n++) {
                $abbreviation = mb_substr($base, 0, 17).'-'.$n;
            }
            $unit = InventoryUnit::query()->create([
                'name' => $label,
                'abbreviation' => $abbreviation,
                'category' => $kind,
                'factor_to_base' => 1,
                'is_base' => ! InventoryUnit::query()->where('category', $kind)->where('is_base', true)->exists(),
                'is_active' => true,
            ]);
            $context->created('units', $label, $unit);
            if (! $isEach && ! in_array($key, array_merge(...array_values(self::UNIT_KINDS)), true)) {
                $context->warn("Unit \"{$odooName}\" is not a standard unit. Check it under Inventory setup.");
            }
        }

        return $this->units[$cacheKey] = $unit;
    }

    private function image(ImportContext $context, int $rowNumber, InventoryProduct $product, ?string $encoded): void
    {
        if ($encoded === null) {
            return;
        }
        if (str_starts_with($encoded, 'The content of this cell is too long')) {
            $context->row($rowNumber, $context->rows[$rowNumber]['action'], ['The picture was too large for an Excel export. Export as CSV to bring pictures across.']);

            return;
        }

        $binary = base64_decode($encoded, true);
        $extension = $binary === false ? null : match (true) {
            str_starts_with($binary, "\x89PNG") => 'png',
            str_starts_with($binary, "\xFF\xD8") => 'jpg',
            str_starts_with($binary, 'GIF8') => 'gif',
            str_starts_with($binary, 'RIFF') && substr($binary, 8, 4) === 'WEBP' => 'webp',
            default => null,
        };
        if ($extension === null) {
            $context->row($rowNumber, $context->rows[$rowNumber]['action'], ['The picture could not be read and was skipped.']);

            return;
        }

        $context->add('pictures');
        if (! $context->commit) {
            return;
        }

        $path = sprintf('products/%d/%d-%s.%s', $product->company_id, $product->id, substr(sha1($binary), 0, 10), $extension);
        Storage::disk('public')->put($path, $binary);
        if ($product->image_path && $product->image_path !== $path) {
            Storage::disk('public')->delete($product->image_path);
        }
        $product->forceFill(['image_path' => $path])->save();
    }

    private function vendors(ImportContext $context, int $rowNumber, InventoryProduct $product, array $rows, array $columns): void
    {
        foreach ($rows as $row) {
            $vendorName = $this->text($row['data'], $columns, 'vendor', 255);
            if ($vendorName === null) {
                continue;
            }

            $vendor = $this->partners->vendor($context, $vendorName);
            $price = $this->number($row['data'], $columns, 'vendor_price');
            if ($price === null) {
                continue;
            }

            $minQuantity = $this->number($row['data'], $columns, 'vendor_min_qty') ?: 1;
            PurchaseVendorPriceList::query()->updateOrCreate(
                ['vendor_id' => $vendor->id, 'product_id' => $product->id, 'min_quantity' => $minQuantity],
                [
                    'price' => $price,
                    'currency_code' => strtoupper(substr($this->text($row['data'], $columns, 'vendor_currency') ?? $this->text($row['data'], $columns, 'currency') ?? $context->company->default_currency ?? 'USD', 0, 3)),
                    'valid_from' => now()->toDateString(),
                ],
            );
            $context->add('vendor_prices');
        }
    }

    /**
     * Brings the stock at the import location to Odoo's quantity on hand with an
     * adjustment, so importing the same file again does not double the stock.
     */
    private function openingStock(ImportContext $context, int $rowNumber, InventoryProduct $product, ?float $quantity): void
    {
        if (! $context->option('import_stock', true) || $quantity === null) {
            return;
        }
        $action = $context->rows[$rowNumber]['action'];

        if ($quantity < 0) {
            $context->row($rowNumber, $action, ["Odoo shows {$quantity} on hand. Negative stock is not brought across; count it and adjust by hand."]);
            $context->add('negative_stock');

            return;
        }
        if ($product->type === 'service') {
            return;
        }
        if ($product->tracking !== 'none') {
            $context->row($rowNumber, $action, ["{$quantity} on hand not brought across: this product is tracked by lot or serial, so enter its stock with the numbers."]);

            return;
        }

        [$location, $adjustment] = $this->stockLocations($context);
        $current = (float) $this->stock->quantityOnHand($context->company, $product->id, $location->id, null);
        $difference = round($quantity - $current, 4);
        if (abs($difference) < 0.00005) {
            return;
        }

        $this->stock->postMovement($context->company, $context->user, [
            'operation' => 'adjustment',
            'product_id' => $product->id,
            'from_location_id' => $difference > 0 ? $adjustment->id : $location->id,
            'to_location_id' => $difference > 0 ? $location->id : $adjustment->id,
            'quantity' => number_format(abs($difference), 4, '.', ''),
            'reference' => "Odoo opening stock (import #{$context->import->id})",
        ]);
        $context->add('stock_lines');
        $context->add('stock_quantity', $difference);
    }

    /** @return array{0: StockLocation, 1: StockLocation} the stock location and its adjustment location */
    private function stockLocations(ImportContext $context): array
    {
        if ($this->stockLocations) {
            return $this->stockLocations;
        }

        $location = $context->option('location_id')
            ? StockLocation::query()->where('usage', 'internal')->findOrFail($context->option('location_id'))
            : null;

        if (! $location) {
            $warehouse = InventoryWarehouse::query()->where('code', 'MAIN')->first()
                ?? InventoryWarehouse::query()->create(['code' => 'MAIN', 'name' => 'Main Warehouse', 'is_active' => true]);
            if ($warehouse->wasRecentlyCreated) {
                $context->created('warehouses', $warehouse->name, $warehouse);
            }
            $location = StockLocation::query()->where('warehouse_id', $warehouse->id)->where('usage', 'internal')->orderBy('id')->first()
                ?? StockLocation::query()->create(['warehouse_id' => $warehouse->id, 'code' => 'STOCK', 'name' => 'Stock', 'usage' => 'internal', 'is_active' => true]);
            if ($location->wasRecentlyCreated) {
                $context->created('locations', "{$warehouse->name} / {$location->name}", $location);
            }
        }

        $adjustment = StockLocation::query()->where('warehouse_id', $location->warehouse_id)->where('usage', 'adjustment')->orderBy('id')->first();
        if (! $adjustment) {
            $code = 'ADJ';
            for ($n = 2; StockLocation::query()->where('warehouse_id', $location->warehouse_id)->where('code', $code)->exists(); $n++) {
                $code = "ADJ{$n}";
            }
            $adjustment = StockLocation::query()->create([
                'warehouse_id' => $location->warehouse_id, 'code' => $code, 'name' => 'Inventory adjustments', 'usage' => 'adjustment', 'is_active' => true,
            ]);
            $context->created('locations', $location->warehouse->name.' / Inventory adjustments', $adjustment);
        }

        return $this->stockLocations = [$location, $adjustment];
    }
}
