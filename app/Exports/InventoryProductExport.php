<?php

namespace App\Exports;

use App\Modules\Core\Models\Company;
use App\Modules\Inventory\Models\InventoryProduct;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\Eloquent\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\Exportable;

class InventoryProductExport implements FromCollection, WithHeadings, WithMapping
{
    use Exportable;

    protected $products;
    protected $company;

    public function __construct(Collection $products, Company $company)
    {
        $this->products = $products;
        $this->company = $company;
    }

    public function collection(): Collection
    {
        return $this->products;
    }

    public function headings(): array
    {
        return [
            "Currency",
            "Activity State",
            "Product Category",
            "Favorite",
            "Name",
            "Internal Reference",
            "# Product Variants",
            "Sales Price",
            "Quantity On Hand",
            "Unit",
            "Image 128",
            "Last Updated on",
            "Show On Hand Qty Status Button",
            "Type",
            "Costing Method",
            "Tracking",
            "Barcode",
            "Description",
        ];
    }

    public function map($product): array
    {
        $quantityOnHand = 0;
        if ($product->type !== "service") {
            $quantities = \App\Modules\Inventory\Services\InventoryStockService::class;
            $service = app($quantities);
            $balances = $service->balances($this->company);
            foreach ($balances as $balance) {
                if ($balance->product_id === $product->id) {
                    $quantityOnHand += (float) $balance->quantity;
                }
            }
        }

        return [
            $this->company->default_currency ?? "USD",
            $product->is_active ? "Active" : "Archived",
            $product->category?->name ?? "",
            false,
            $product->name,
            $product->sku,
            1,
            0, // Sales price - not stored on product
            $quantityOnHand,
            $product->unit?->abbreviation ?? "Units",
            null, // Image
            $product->updated_at?->format("Y-m-d H:i:s") ?? "",
            true,
            ucfirst($product->type),
            ucfirst($product->costing_method),
            ucfirst($product->tracking),
            $product->barcode ?? "",
            $product->description ?? "",
        ];
    }
}

