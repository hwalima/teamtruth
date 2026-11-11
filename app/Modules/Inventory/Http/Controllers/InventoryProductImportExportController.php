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
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Maatwebsite\Excel\Facades\Excel;
use RuntimeException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class InventoryProductImportExportController extends Controller
{
    public function export(Request $request): BinaryFileResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        app(ErpRoleService::class)->authorize($company, $request->user(), 'erp.inventory.view');

        $products = InventoryProduct::query()
            ->with(['category:id,name', 'unit:id,name,abbreviation'])
            ->where('company_id', $company->id)
            ->orderBy('name')
            ->get();

        $filename = 'products-' . $company->code . '-' . now()->format('Y-m-d') . '.xlsx';

        return Excel::download(new \App\Exports\InventoryProductExport($products, $company), $filename);
    }

    public function downloadTemplate(Request $request): BinaryFileResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        app(ErpRoleService::class)->authorize($company, $request->user(), 'erp.inventory.view');

        $filename = 'product_import_template_' . $company->code . '.xlsx';

        return Excel::download(new \App\Exports\InventoryProductTemplateExport($company), $filename);
    }

    public function previewImport(Request $request): JsonResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        app(ErpRoleService::class)->authorize($company, $request->user(), 'erp.inventory.manage');

        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:10240'],
        ]);

        try {
            $data = Excel::toArray([], $validated['file'])[0];
            if (empty($data)) {
                return response()->json(['error' => 'The file is empty.'], 422);
            }

            $headers = array_shift($data);
            $previewRows = array_slice($data, 0, 10);

            return response()->json([
                'headers' => $headers,
                'rows' => $previewRows,
                'total_rows' => count($data),
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Error reading file: ' . $e->getMessage()], 422);
        }
    }

    public function import(Request $request): JsonResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        app(ErpRoleService::class)->authorize($company, $request->user(), 'erp.inventory.manage');

        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:10240'],
            'mapping' => ['required', 'array'],
            'mapping.sku' => ['required', 'integer'],
            'mapping.name' => ['required', 'integer'],
            'mapping.category' => ['nullable', 'integer'],
            'mapping.unit' => ['required', 'integer'],
            'mapping.type' => ['nullable', 'integer'],
            'mapping.costing_method' => ['nullable', 'integer'],
            'mapping.tracking' => ['nullable', 'integer'],
            'mapping.barcode' => ['nullable', 'integer'],
            'mapping.description' => ['nullable', 'integer'],
            'mapping.sales_price' => ['nullable', 'integer'],
            'mapping.internal_reference' => ['nullable', 'integer'],
            'update_existing' => ['boolean'],
            'skip_errors' => ['boolean'],
        ]);

        try {
            $data = Excel::toArray([], $validated['file'])[0];
            if (empty($data)) {
                return response()->json(['error' => 'The file is empty.'], 422);
            }

            $headers = array_shift($data);
            $mapping = $validated['mapping'];
            $updateExisting = $validated['update_existing'] ?? false;
            $skipErrors = $validated['skip_errors'] ?? false;

            $results = [
                'imported' => 0,
                'updated' => 0,
                'skipped' => 0,
                'errors' => [],
            ];

            // Build unit lookup: keyed by both abbreviation and name for flexible matching
            $units = InventoryUnit::query()
                ->where('company_id', $company->id)
                ->where('is_active', true)
                ->get();

            $unitsByAbbr = $units->keyBy('abbreviation');
            $unitsByName = $units->keyBy('name');

            // Manually combine to preserve string keys (merge() can re-index to numeric)
            $unitsCollection = $unitsByAbbr;
            foreach ($unitsByName as $key => $value) {
                $unitsCollection->put($key, $value);
            }

            $categories = InventoryCategory::query()
                ->where('company_id', $company->id)
                ->where('is_active', true)
                ->get()
                ->keyBy('name');

            foreach ($data as $rowIndex => $row) {
                try {
                    $rowNum = $rowIndex + 2;

                    $sku = $this->getCellValue($row, $mapping['sku']);
                    $name = $this->getCellValue($row, $mapping['name']);

                    if (empty($sku) || empty($name)) {
                        throw new \Exception('SKU and Name are required');
                    }

                    $unitAbbr = $this->getCellValue($row, $mapping['unit']);
                    // Try exact match first, then case-insensitive
                    $unit = $unitsCollection->get($unitAbbr);
                    if (!$unit) {
                        $unit = $unitsCollection->get(strtolower($unitAbbr));
                    }
                    if (!$unit) {
                        throw new \Exception("Unit not found: {$unitAbbr}");
                    }

                    $category = null;
                    if (isset($mapping['category'])) {
                        $categoryName = $this->getCellValue($row, $mapping['category']);
                        if ($categoryName) {
                            $category = $categories->get($categoryName);
                            if (!$category) {
                                $category = InventoryCategory::query()->create([
                                    'company_id' => $company->id,
                                    'name' => $categoryName,
                                    'is_active' => true,
                                ]);
                                $categories[$categoryName] = $category;
                            }
                        }
                    }

                    $type = $this->getCellValue($row, $mapping['type'] ?? -1) ?? 'storable';
                    if (!in_array($type, ['storable', 'consumable', 'service'])) {
                        $type = 'storable';
                    }

                    $costingMethod = $this->getCellValue($row, $mapping['costing_method'] ?? -1) ?? 'average';
                    if (!in_array($costingMethod, ['average', 'fifo'])) {
                        $costingMethod = 'average';
                    }

                    $tracking = $this->getCellValue($row, $mapping['tracking'] ?? -1) ?? 'none';
                    if (!in_array($tracking, ['none', 'lot', 'serial'])) {
                        $tracking = 'none';
                    }

                    if ($type === 'service' && $tracking !== 'none') {
                        $tracking = 'none';
                    }

                    $barcode = $this->getCellValue($row, $mapping['barcode'] ?? -1);
                    $description = $this->getCellValue($row, $mapping['description'] ?? -1);

                    $existingProduct = InventoryProduct::query()
                        ->where('company_id', $company->id)
                        ->where('sku', $sku)
                        ->first();

                    if ($existingProduct) {
                        if ($updateExisting) {
                            $existingProduct->update([
                                'name' => $name,
                                'barcode' => $barcode,
                                'description' => $description,
                                'category_id' => $category?->id,
                                'unit_id' => $unit->id,
                                'type' => $type,
                                'costing_method' => $costingMethod,
                                'tracking' => $tracking,
                                'is_active' => true,
                            ]);
                            $results['updated']++;
                            app(AuditLogService::class)->record(
                                $company,
                                'inventory.product.updated',
                                $existingProduct,
                                changes: ['after' => $existingProduct->only(['sku', 'name', 'type', 'category_id', 'unit_id', 'costing_method', 'tracking'])],
                                actor: $request->user(),
                            );
                        } else {
                            $results['skipped']++;
                        }
                    } else {
                        $product = InventoryProduct::query()->create([
                            'company_id' => $company->id,
                            'sku' => $sku,
                            'name' => $name,
                            'barcode' => $barcode,
                            'description' => $description,
                            'category_id' => $category?->id,
                            'unit_id' => $unit->id,
                            'type' => $type,
                            'costing_method' => $costingMethod,
                            'tracking' => $tracking,
                            'is_active' => true,
                        ]);
                        $results['imported']++;
                        app(AuditLogService::class)->record(
                            $company,
                            'inventory.product.created',
                            $product,
                            changes: ['after' => $product->only(['sku', 'name', 'type', 'category_id', 'unit_id', 'costing_method', 'tracking'])],
                            actor: $request->user(),
                        );
                    }
                } catch (\Exception $e) {
                    $rowNum = $rowIndex + 2;
                    $errorMsg = "Row {$rowNum}: " . $e->getMessage();
                    $results['errors'][] = $errorMsg;
                    if (!$skipErrors) {
                        break;
                    }
                }
            }

            \Log::info('Import completed', $results);

            return response()->json([
                'success' => true,
                'message' => "Import completed. {$results['imported']} imported, {$results['updated']} updated, {$results['skipped']} skipped.",
                'results' => $results,
            ]);
        } catch (\Maatwebsite\Excel\Validators\ValidationException $e) {
            $failures = $e->failures();
            $errors = [];
            foreach ($failures as $failure) {
                $errors[] = 'Row ' . $failure->row() . ': ' . implode(', ', $failure->errors());
            }
            return response()->json(['success' => false, 'error' => 'Validation failed: ' . implode('; ', $errors)], 422);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'error' => 'Import failed: ' . $e->getMessage()], 500);
        }
    }

    private function getCellValue(array $row, int $colIndex): ?string
    {
        if ($colIndex < 0 || $colIndex >= count($row)) {
            return null;
        }
        $value = $row[$colIndex];
        if ($value === null || $value === '') {
            return null;
        }
        return trim((string) $value);
    }
}