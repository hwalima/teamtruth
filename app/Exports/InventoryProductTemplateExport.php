<?php

namespace App\Exports;

use App\Modules\Core\Models\Company;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\Exportable;

class InventoryProductTemplateExport implements FromArray, WithHeadings
{
    use Exportable;

    protected $company;

    public function __construct(Company $company)
    {
        $this->company = $company;
    }

    public function array(): array
    {
        return [
            [
                "USD",
                "Active",
                "All / Mining / Spares",
                "FALSE",
                "\"O\" Rings 164-3903",
                "ORING-164-3903",
                "1",
                "0",
                "0",
                "Units",
                "",
                "2026-01-15 10:30:00",
                "TRUE",
                "Storable",
                "Average",
                "None",
                "",
                "High quality O-ring for hydraulic systems",
            ],
            [
                "USD",
                "Active",
                "All / Mining / Electricals",
                "FALSE",
                "0-150 Ammeter",
                "AMMETER-0-150",
                "1",
                "0",
                "0",
                "Units",
                "",
                "2026-01-15 10:30:00",
                "FALSE",
                "Storable",
                "Average",
                "None",
                "",
                "Analog ammeter 0-150A",
            ],
            [
                "USD",
                "Active",
                "",
                "FALSE",
                "Steel Pipe 1/2 inch",
                "PIPE-STEEL-0.5",
                "1",
                "0",
                "0",
                "Meters",
                "",
                "2026-01-15 10:30:00",
                "FALSE",
                "Storable",
                "FIFO",
                "Lot",
                "BARCODE12345",
                "Galvanized steel pipe",
            ],
        ];
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
}

