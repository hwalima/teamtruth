<?php

namespace App\Modules\Inventory\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\DocumentRenderer;
use App\Modules\Inventory\Models\InventoryProduct;
use App\Modules\Inventory\Models\StockLocation;
use App\Modules\Inventory\Models\StockMove;
use App\Modules\Inventory\Services\InventoryStockService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Str;
use RuntimeException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class StockReportExportController extends Controller
{
    public function __invoke(
        Request $request,
        string $report,
        string $format,
        InventoryStockService $stockService,
        DocumentRenderer $renderer,
    ): StreamedResponse|Response {
        abort_unless(in_array($report, ['on-hand', 'movements'], true), 404);
        abort_unless(in_array($format, ['csv', 'pdf'], true), 404);

        $company = app(CompanyContext::class)->requireActiveCompany();
        [$title, $columns, $rows] = $this->reportRows($company, $report, $stockService);
        $filename = Str::slug($report.'-'.$company->code.'-'.now()->format('Y-m-d')).'.'.$format;

        if ($format === 'csv') {
            return response()->streamDownload(function () use ($columns, $rows): void {
                $stream = fopen('php://output', 'w');
                if ($stream === false) {
                    throw new RuntimeException('Unable to open the report export stream.');
                }

                fwrite($stream, "\xEF\xBB\xBF");
                fputcsv($stream, $columns, ',', '"', '');
                foreach ($rows as $row) {
                    fputcsv($stream, array_map(self::escapeSpreadsheetFormula(...), $row), ',', '"', '');
                }
                fclose($stream);
            }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
        }

        $pdf = $renderer->renderForCompany($company, 'pdf.documents.inventory-report', [
            'documentTitle' => $title,
            'reportTitle' => $title,
            'columns' => $columns,
            'rows' => $rows,
        ]);

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }

    /**
     * @return array{string, array<int, string>, array<int, array<int, string>>}
     */
    private function reportRows(Company $company, string $report, InventoryStockService $stockService): array
    {
        if ($report === 'on-hand') {
            $products = InventoryProduct::query()
                ->with('unit:id,abbreviation')
                ->where('company_id', $company->id)
                ->get()
                ->keyBy('id');
            $locations = StockLocation::query()
                ->with('warehouse:id,code')
                ->where('company_id', $company->id)
                ->get()
                ->keyBy('id');
            $rows = [];
            foreach ($stockService->balances($company) as $balance) {
                $product = $products->get($balance->product_id);
                $location = $locations->get($balance->location_id);
                $rows[] = [
                    $product?->sku ?? '',
                    $product?->name ?? '',
                    trim(($location?->warehouse?->code ?? '').' / '.($location?->name ?? ''), ' /'),
                    $balance->lot_code ?? '',
                    $balance->quantity,
                    $product?->unit?->abbreviation ?? '',
                ];
            }

            return [
                'Stock on hand',
                ['SKU', 'Product', 'Warehouse / location', 'Lot / serial', 'Quantity', 'Unit'],
                $rows,
            ];
        }

        $movements = StockMove::query()
            ->where('company_id', $company->id)
            ->with([
                'creator:id,name',
                'lines.product:id,sku,name,unit_id',
                'lines.product.unit:id,abbreviation',
                'lines.sourceLocation:id,warehouse_id,code,name',
                'lines.sourceLocation.warehouse:id,code',
                'lines.destinationLocation:id,warehouse_id,code,name',
                'lines.destinationLocation.warehouse:id,code',
            ])
            ->latest('moved_at')
            ->limit(100)
            ->get();
        $rows = [];
        foreach ($movements as $movement) {
            foreach ($movement->lines as $line) {
                $source = $line->sourceLocation;
                $destination = $line->destinationLocation;
                $rows[] = [
                    $movement->document_number,
                    Str::headline($movement->operation),
                    $movement->moved_at?->format('Y-m-d H:i:s') ?? '',
                    $line->product?->sku ?? '',
                    $line->product?->name ?? '',
                    $line->quantity,
                    $line->product?->unit?->abbreviation ?? '',
                    $source ? trim(($source->warehouse?->code ?? '').' / '.$source->code, ' /') : 'External',
                    $destination ? trim(($destination->warehouse?->code ?? '').' / '.$destination->code, ' /') : 'External',
                    $line->lot_code ?? '',
                    $movement->reference ?? '',
                    $movement->creator?->name ?? '',
                ];
            }
        }

        return [
            'Recent stock movements (latest 100)',
            ['Document', 'Type', 'Date', 'SKU', 'Product', 'Quantity', 'Unit', 'From', 'To', 'Lot / serial', 'Reference', 'Created by'],
            $rows,
        ];
    }

    private static function escapeSpreadsheetFormula(string $value): string
    {
        if (preg_match('/^[-+]?\d+(?:\.\d+)?$/', $value) === 1) {
            return $value;
        }

        return preg_match('/^\s*[=+\-@]/', $value) === 1 ? "'".$value : $value;
    }
}
