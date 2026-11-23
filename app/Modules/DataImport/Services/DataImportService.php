<?php

namespace App\Modules\DataImport\Services;

use App\Models\User;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\ErpRoleService;
use App\Modules\DataImport\Models\DataImport;
use App\Modules\DataImport\Models\DataImportRow;
use App\Modules\DataImport\Services\Odoo\ContactImporter;
use App\Modules\DataImport\Services\Odoo\EmployeeImporter;
use App\Modules\DataImport\Services\Odoo\InvoiceImporter;
use App\Modules\DataImport\Services\Odoo\OdooImporter;
use App\Modules\DataImport\Services\Odoo\OdooSheet;
use App\Modules\DataImport\Services\Odoo\ProductImporter;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Upload → preview → confirm.
 *
 * The preview runs the real import inside a transaction and rolls it back, so
 * what it shows is exactly what the import will do. The file and every row of
 * it are kept with the import.
 */
class DataImportService
{
    /** @var list<class-string<OdooImporter>> */
    public const IMPORTERS = [ProductImporter::class, ContactImporter::class, EmployeeImporter::class, InvoiceImporter::class];

    /** Longest cell kept in the stored rows; longer cells (pictures) stay in the uploaded file. */
    private const MAX_CELL = 60000;

    public function __construct(private ErpRoleService $roles) {}

    /** @return array<string, string> model => label */
    public function models(): array
    {
        $models = [];
        foreach (self::IMPORTERS as $class) {
            $importer = app($class);
            $models[$importer->model()] = $importer->label();
        }

        return $models;
    }

    /** A fresh importer per run: importers cache what they find. */
    public function importer(string $model): OdooImporter
    {
        foreach (self::IMPORTERS as $class) {
            $importer = app($class);
            if ($importer->model() === $model || in_array($model, $importer->fileModels(), true)) {
                return $importer;
            }
        }

        throw ValidationException::withMessages(['model' => "Files of type {$model} cannot be imported yet."]);
    }

    /** From the file name Odoo gives an export, "Product (product.template).xlsx", otherwise from its columns. */
    public function detectModel(string $fileName, array $headers): ?string
    {
        foreach (self::IMPORTERS as $class) {
            $importer = app($class);
            foreach ($importer->fileModels() as $model) {
                if (str_contains(mb_strtolower($fileName), "({$model})")) {
                    return $importer->model();
                }
            }
        }

        $best = null;
        $bestScore = 0;
        foreach (self::IMPORTERS as $class) {
            $importer = app($class);
            $mapped = OdooSheet::mapColumns($headers, $importer->aliases());
            if (array_diff($importer->requiredFields(), array_keys($mapped)) !== []) {
                continue;
            }
            $score = count($mapped) / max(count($importer->aliases()), 1);
            if ($score > $bestScore) {
                [$best, $bestScore] = [$importer->model(), $score];
            }
        }

        return $bestScore >= 0.15 ? $best : null;
    }

    public function authorize(Company $company, User $user, OdooImporter $importer, array $options): void
    {
        foreach ($importer->permissionsFor($options) as $permission) {
            $this->roles->authorize($company, $user, $permission);
        }
    }

    /** Whether the user may import at least one kind of file, so the import page is any use to them. */
    public function canImportAnything(Company $company, User $user): bool
    {
        foreach (self::IMPORTERS as $class) {
            $required = app($class)->permissions();
            if (array_filter($required, fn (string $permission) => ! $this->roles->allows($company, $user, $permission)) === []) {
                return true;
            }
        }

        return false;
    }

    /** Store the file and preview it. */
    public function upload(Company $company, User $user, UploadedFile $file, ?string $model, array $options = []): DataImport
    {
        $extension = strtolower($file->getClientOriginalExtension() ?: 'xlsx');
        $path = $file->storeAs("imports/{$company->id}", Str::uuid().'.'.$extension, 'local');

        return $this->create($company, $user, Storage::disk('local')->path($path), $path, $file->getClientOriginalName(), $model, $options);
    }

    /** Preview a file already on disk (the artisan command). */
    public function fromPath(Company $company, User $user, string $source, ?string $model, array $options = []): DataImport
    {
        $extension = strtolower(pathinfo($source, PATHINFO_EXTENSION) ?: 'xlsx');
        $path = "imports/{$company->id}/".Str::uuid().'.'.$extension;
        Storage::disk('local')->put($path, file_get_contents($source));

        return $this->create($company, $user, Storage::disk('local')->path($path), $path, basename($source), $model, $options);
    }

    private function create(Company $company, User $user, string $absolutePath, string $path, string $fileName, ?string $model, array $options): DataImport
    {
        try {
            $sheet = OdooSheet::read($absolutePath);
            $model = $model ?: $this->detectModel($fileName, $sheet->headers);
            if ($model === null) {
                throw ValidationException::withMessages(['model' => 'Could not tell what this file holds. Choose the type of data.']);
            }
            $importer = $this->importer($model);
            $this->authorize($company, $user, $importer, $options);

            $columns = OdooSheet::mapColumns($sheet->headers, $importer->aliases());
            $missing = array_diff($importer->requiredFields(), array_keys($columns));
            if ($missing !== []) {
                throw ValidationException::withMessages(['file' => 'The file has no '.implode(', ', $missing).' column. Is it the right file?']);
            }
        } catch (\Throwable $e) {
            Storage::disk('local')->delete($path);
            throw $e;
        }

        $import = DataImport::query()->create([
            'source' => 'odoo',
            'model' => $importer->model(),
            'file_name' => mb_substr($fileName, 0, 255),
            'file_path' => $path,
            'status' => DataImport::PREVIEWED,
            'options' => $options,
            'columns' => ['mapped' => $columns, 'kept_only' => array_values(array_diff($sheet->headers, $columns))],
            'total_rows' => count($sheet->rows),
            'created_by' => $user->id,
        ]);

        $this->storeRows($import, $sheet->rows);
        $this->run($import, $user, commit: false, sheet: $sheet);

        return $import->refresh();
    }

    public function preview(DataImport $import, User $user): DataImport
    {
        return $this->run($import, $user, commit: false);
    }

    public function commit(DataImport $import, User $user): DataImport
    {
        if ($import->status === DataImport::IMPORTED) {
            throw ValidationException::withMessages(['import' => 'This file has already been imported. Upload it again to bring in changes.']);
        }

        return $this->run($import, $user, commit: true);
    }

    private function run(DataImport $import, User $user, bool $commit, ?OdooSheet $sheet = null): DataImport
    {
        $company = $import->company()->firstOrFail();
        $importer = $this->importer($import->model);
        $options = $import->options ?? [];
        $this->authorize($company, $user, $importer, $options);

        $sheet ??= OdooSheet::read(Storage::disk('local')->path($import->file_path));
        $columns = OdooSheet::mapColumns($sheet->headers, $importer->aliases());
        $context = new ImportContext($company, $user, $import, $commit, $options);

        DB::beginTransaction();
        try {
            $importer->run($context, $sheet->rows, $columns);
            $commit ? DB::commit() : DB::rollBack();
        } catch (\Throwable $e) {
            DB::rollBack();
            if ($commit) {
                $import->forceFill(['summary' => [...($import->summary ?? []), 'error' => $e->getMessage()]])->save();
            }
            throw $e;
        }

        $this->saveResults($import, $context);
        $import->forceFill([
            'summary' => $context->summary(),
            ...($commit ? ['status' => DataImport::IMPORTED, 'imported_by' => $user->id, 'imported_at' => now()] : []),
        ])->save();

        return $import->refresh();
    }

    private function storeRows(DataImport $import, array $rows): void
    {
        $now = now();
        foreach (array_chunk($rows, 100) as $chunk) {
            DataImportRow::query()->insert(array_map(fn ($row) => [
                'data_import_id' => $import->id,
                'row_number' => $row['row_number'],
                'data' => json_encode(array_map(
                    fn ($value) => is_string($value) && strlen($value) > self::MAX_CELL ? '['.strlen($value).' characters, kept in the uploaded file]' : $value,
                    $row['data'],
                ), JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE),
                'created_at' => $now,
                'updated_at' => $now,
            ], $chunk));
        }
    }

    private function saveResults(DataImport $import, ImportContext $context): void
    {
        DataImportRow::query()->where('data_import_id', $import->id)->update(['action' => null, 'messages' => null, 'record_type' => null, 'record_id' => null]);

        $byAction = [];
        foreach ($context->rows as $rowNumber => $result) {
            if ($result['messages'] === [] && $result['record_id'] === null) {
                $byAction[$result['action']][] = $rowNumber;

                continue;
            }
            DataImportRow::query()->where('data_import_id', $import->id)->where('row_number', $rowNumber)->update([
                'action' => $result['action'],
                'messages' => $result['messages'] === [] ? null : json_encode($result['messages'], JSON_UNESCAPED_UNICODE),
                'record_type' => $context->commit ? $result['record_type'] : null,
                'record_id' => $context->commit ? $result['record_id'] : null,
            ]);
        }
        foreach ($byAction as $action => $rowNumbers) {
            foreach (array_chunk($rowNumbers, 500) as $chunk) {
                DataImportRow::query()->where('data_import_id', $import->id)->whereIn('row_number', $chunk)->update(['action' => $action]);
            }
        }

        DataImportRow::query()->where('data_import_id', $import->id)->whereNull('action')->update(['action' => 'skipped']);
    }
}
