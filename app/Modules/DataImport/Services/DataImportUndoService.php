<?php

namespace App\Modules\DataImport\Services;

use App\Models\User;
use App\Modules\DataImport\Models\DataImport;
use App\Modules\DataImport\Models\DataImportRow;
use App\Modules\DataImport\Models\ExternalId;
use App\Modules\DataImport\Services\Odoo\EmployeeImporter;
use App\Modules\Hrm\Enums\EmployeeStatus;
use App\Modules\Hrm\Models\Department;
use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Models\Position;
use App\Modules\Inventory\Models\InventoryCategory;
use App\Modules\Inventory\Models\InventoryProduct;
use App\Modules\Inventory\Models\InventoryUnit;
use App\Modules\Inventory\Models\InventoryWarehouse;
use App\Modules\Inventory\Models\StockLocation;
use App\Modules\Inventory\Models\StockMove;
use App\Modules\Invoicing\Models\Customer;
use App\Modules\Purchase\Models\PurchaseVendor;
use App\Modules\Purchase\Models\PurchaseVendorPriceList;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * Takes an import back out, e.g. when it went into the wrong company.
 *
 * Removes the records the import created and its opening stock. Records it
 * only updated are left as they are. Categories, units, locations and vendors
 * it created are removed only while nothing else uses them. If a created
 * product has been used since (sold, ordered, moved), nothing is undone.
 */
class DataImportUndoService
{
    public const UNDONE = 'undone';

    public function __construct(private DataImportService $imports) {}

    /** @return array<string, int> what was removed, by kind */
    public function undo(DataImport $import, User $user): array
    {
        if ($import->status !== DataImport::IMPORTED) {
            throw ValidationException::withMessages(['import' => 'Only a confirmed import can be undone.']);
        }

        $company = $import->company()->firstOrFail();
        $this->imports->authorize($company, $user, $this->imports->importer($import->model), $import->options ?? []);
        $summary = $import->summary ?? [];

        $removed = DB::transaction(function () use ($import, $summary): array {
            $removed = [];
            $created = $this->createdRecords($import);

            if ($import->model === 'product.template') {
                $productIds = $created[InventoryProduct::class] ?? [];

                $moves = StockMove::query()->where('reference', "Odoo opening stock (import #{$import->id})")->get();
                foreach ($moves as $move) {
                    $move->delete();
                }
                $removed['stock movements'] = $moves->count();

                $removed['vendor prices'] = PurchaseVendorPriceList::query()->whereIn('product_id', $productIds)->delete();

                $images = InventoryProduct::query()->whereIn('id', $productIds)->whereNotNull('image_path')->pluck('image_path')->all();
                try {
                    $removed['products'] = DB::transaction(fn () => InventoryProduct::query()->whereIn('id', $productIds)->delete());
                } catch (QueryException) {
                    throw ValidationException::withMessages([
                        'import' => 'Some of these products have been used since the import (stock moved, ordered or invoiced), so the import cannot be undone. Remove those uses first, or deactivate the products instead.',
                    ]);
                }
                DB::afterCommit(fn () => Storage::disk('public')->delete($images));
            }

            if ($import->model === EmployeeImporter::MODEL) {
                $removed = [...$removed, ...$this->undoEmployees($summary)];
            }

            ExternalId::query()->where('data_import_id', $import->id)->delete();

            $removed['customers'] = $this->removeUnused(Customer::class, $this->ids($summary, 'customers', Customer::class), forceDelete: true);
            $removed['vendors'] = $this->removeUnused(PurchaseVendor::class, $this->ids($summary, 'vendors', PurchaseVendor::class));
            // Children before parents: newest first.
            $removed['categories'] = $this->removeUnused(InventoryCategory::class, array_reverse($this->ids($summary, 'categories', InventoryCategory::class)));
            $removed['units'] = $this->removeUnused(InventoryUnit::class, $this->ids($summary, 'units', InventoryUnit::class));
            $removed['locations'] = $this->removeUnused(StockLocation::class, array_reverse($this->ids($summary, 'locations', StockLocation::class)));
            $removed['warehouses'] = $this->removeUnused(InventoryWarehouse::class, $this->ids($summary, 'warehouses', InventoryWarehouse::class));

            return array_filter($removed);
        });

        DataImportRow::query()->where('data_import_id', $import->id)->update(['record_type' => null, 'record_id' => null]);
        $import->forceFill([
            'status' => self::UNDONE,
            'summary' => [...$summary, 'undone' => ['by' => $user->name, 'at' => now()->toDateTimeString(), 'removed' => $removed]],
        ])->save();

        return $removed;
    }

    /** @return array<class-string, list<int>> records the import created, from its rows */
    private function createdRecords(DataImport $import): array
    {
        $records = [];
        DataImportRow::query()
            ->where('data_import_id', $import->id)
            ->where('action', 'created')
            ->whereNotNull('record_id')
            ->get(['record_type', 'record_id'])
            ->each(function (DataImportRow $row) use (&$records): void {
                $class = Model::getActualClassNameForMorph($row->record_type);
                $records[$class][] = (int) $row->record_id;
            });

        return array_map(fn ($ids) => array_values(array_unique($ids)), $records);
    }

    /**
     * Ids of what the import created. Imports made before ids were recorded
     * list only names, so those are looked up by name in the import's company.
     *
     * @return list<int>
     */
    private function ids(array $summary, string $kind, string $class): array
    {
        if (isset($summary['created_ids'][$kind])) {
            return $summary['created_ids'][$kind];
        }

        $ids = [];
        foreach ($summary['created'][$kind] ?? [] as $label) {
            $id = match ($class) {
                InventoryCategory::class => InventoryCategory::query()->where('name', trim((string) last(explode(' / ', $label))))->value('id'),
                StockLocation::class => $this->locationId($label),
                default => $class::query()->where('name', $label)->orderByDesc('id')->value('id'),
            };
            if ($id) {
                $ids[] = (int) $id;
            }
        }

        return $ids;
    }

    private function locationId(string $label): ?int
    {
        [$warehouse, $location] = array_pad(explode(' / ', $label, 2), 2, null);
        if ($location === null) {
            return null;
        }

        return StockLocation::query()
            ->where('name', $location)
            ->whereHas('warehouse', fn ($query) => $query->where('name', $warehouse))
            ->value('id');
    }

    /**
     * Employees the import added, then the positions and departments it
     * created while no one else uses them. Employees with HR history since
     * (contracts, leave, cases) stop the undo: that history would be lost.
     *
     * @return array<string, int>
     */
    private function undoEmployees(array $summary): array
    {
        $employees = Employee::withTrashed()->whereIn('id', $summary['created_ids']['employees'] ?? [])->get();
        foreach ($employees as $employee) {
            if ($employee->historyLabels() !== []) {
                throw ValidationException::withMessages([
                    'import' => "{$employee->full_name} has ".implode(', ', $employee->historyLabels()).' since the import, so it cannot be undone. Terminate the employees you no longer need instead.',
                ]);
            }
        }

        $ids = $employees->modelKeys();
        Employee::withTrashed()->whereIn('line_manager_id', $ids)->update(['line_manager_id' => null]);
        Department::query()->whereIn('head_id', $ids)->update(['head_id' => null]);
        foreach ($employees as $employee) {
            if ($employee->position_id && ! $employee->trashed() && $employee->status === EmployeeStatus::Active) {
                Position::query()->whereKey($employee->position_id)->where('headcount_current', '>', 0)->decrement('headcount_current');
            }
            $employee->forceDelete();
        }

        $positions = 0;
        foreach (array_reverse($summary['created_ids']['positions'] ?? []) as $id) {
            $position = Position::query()->find($id);
            if ($position && ! Employee::withTrashed()->where('position_id', $id)->exists() && ! Position::query()->where('reports_to_position_id', $id)->exists()) {
                $position->delete();
                $positions++;
            }
        }

        $departments = 0;
        foreach (array_reverse($summary['created_ids']['departments'] ?? []) as $id) {
            $department = Department::query()->find($id);
            $used = Employee::withTrashed()->where('department_id', $id)->exists()
                || Position::query()->where('department_id', $id)->exists()
                || Department::query()->where('parent_id', $id)->exists();
            if ($department && ! $used) {
                $department->delete();
                $departments++;
            }
        }

        return ['employees' => count($ids), 'positions' => $positions, 'departments' => $departments];
    }

    /** Delete each record unless something still points at it. */
    private function removeUnused(string $class, array $ids, bool $forceDelete = false): int
    {
        $count = 0;
        foreach ($ids as $id) {
            $record = $class::query()->find($id);
            if (! $record) {
                continue;
            }
            try {
                DB::transaction(fn () => $forceDelete && method_exists($record, 'forceDelete') ? $record->forceDelete() : $record->delete());
                $count++;
            } catch (QueryException) {
                // Still used by other records: keep it.
            }
        }

        return $count;
    }
}
