<?php

namespace App\Modules\DataImport\Services\Odoo;

use App\Modules\DataImport\Services\ImportContext;

/** Imports one kind of Odoo export (one Odoo model). */
abstract class OdooImporter
{
    /** Odoo model name, e.g. product.template. */
    abstract public function model(): string;

    /** Shown to users, e.g. "Products". */
    abstract public function label(): string;

    /** ERP permissions needed to run this import. @return list<string> */
    abstract public function permissions(): array;

    /** Possible column names for each field, labels and technical names. @return array<string, list<string>> */
    abstract public function aliases(): array;

    /** Odoo models whose exports this importer reads, matched against the file name, e.g. "(product.template)". @return list<string> */
    public function fileModels(): array
    {
        return [$this->model()];
    }

    /** Permissions for a run with these options. @return list<string> */
    public function permissionsFor(array $options): array
    {
        return $this->permissions();
    }

    /** Fields that must have a column for the file to be accepted. @return list<string> */
    public function requiredFields(): array
    {
        return ['name'];
    }

    /**
     * Import (or preview) the rows.
     *
     * @param  list<array{row_number: int, data: array<string, mixed>}>  $rows
     * @param  array<string, string>  $columns  field => header
     */
    abstract public function run(ImportContext $context, array $rows, array $columns): void;

    protected function value(array $data, array $columns, string $field): mixed
    {
        $header = $columns[$field] ?? null;

        return $header === null ? null : ($data[$header] ?? null);
    }

    protected function text(array $data, array $columns, string $field, ?int $max = null): ?string
    {
        $value = $this->value($data, $columns, $field);
        if ($value === null || is_bool($value)) {
            return null;
        }
        $value = trim((string) $value);
        if ($value === '') {
            return null;
        }

        return $max ? mb_substr($value, 0, $max) : $value;
    }

    protected function number(array $data, array $columns, string $field): ?float
    {
        $value = $this->value($data, $columns, $field);
        if ($value === null || $value === '' || is_bool($value)) {
            return null;
        }
        if (is_numeric($value)) {
            return (float) $value;
        }
        $clean = preg_replace('/[^0-9.\-]/', '', str_replace(',', '', (string) $value));

        return is_numeric($clean) ? (float) $clean : null;
    }

    /** Odoo writes booleans as true/false, "True"/"False", 1/0 or "Yes"/"No". */
    protected function flag(array $data, array $columns, string $field, ?bool $default = null): ?bool
    {
        $value = $this->value($data, $columns, $field);
        if ($value === null) {
            return $default;
        }
        if (is_bool($value)) {
            return $value;
        }

        return ! in_array(mb_strtolower(trim((string) $value)), ['0', 'false', 'no', 'n', 'off', ''], true);
    }

    /** Used to match records by name when the file has no Odoo ID. */
    protected function nameKey(string $name): string
    {
        return 'name:'.OdooSheet::key($name);
    }
}
