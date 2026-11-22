<?php

namespace App\Modules\DataImport\Services\Odoo;

use Illuminate\Validation\ValidationException;
use PhpOffice\PhpSpreadsheet\IOFactory;

/**
 * Reads an Odoo export (xlsx or csv). The first row holds the column names,
 * which are labels ("Sales Price") or, for import-compatible exports,
 * technical names ("list_price").
 */
class OdooSheet
{
    /** @param  list<string>  $headers @param  list<array{row_number: int, data: array<string, mixed>}>  $rows */
    public function __construct(public readonly array $headers, public readonly array $rows) {}

    public static function read(string $path): self
    {
        try {
            $sheet = IOFactory::load($path)->getActiveSheet();
        } catch (\Throwable $e) {
            throw ValidationException::withMessages(['file' => 'This file could not be read as a spreadsheet: '.$e->getMessage()]);
        }

        $table = $sheet->toArray(null, true, false, false);
        $headerRow = array_shift($table) ?? [];
        $headers = [];
        foreach ($headerRow as $index => $header) {
            $header = trim((string) $header);
            if ($header === '') {
                continue;
            }
            $name = $header;
            for ($n = 2; in_array($name, $headers, true); $n++) {
                $name = "{$header} ({$n})";
            }
            $headers[$index] = $name;
        }

        if ($headers === []) {
            throw ValidationException::withMessages(['file' => 'The first row of the file must hold the column names.']);
        }

        $rows = [];
        foreach ($table as $offset => $cells) {
            $data = [];
            foreach ($headers as $index => $header) {
                $value = $cells[$index] ?? null;
                if (is_string($value)) {
                    $value = trim($value);
                    $value = $value === '' ? null : $value;
                }
                $data[$header] = $value;
            }
            if (array_filter($data, fn ($v) => $v !== null && $v !== false) === []) {
                continue;
            }
            $rows[] = ['row_number' => $offset + 2, 'data' => $data];
        }

        return new self(array_values($headers), $rows);
    }

    /**
     * Find the column for each field from its possible names.
     *
     * @param  array<string, list<string>>  $aliases
     * @return array<string, string> field => header
     */
    public static function mapColumns(array $headers, array $aliases): array
    {
        $byKey = [];
        foreach ($headers as $header) {
            $byKey[self::key($header)] ??= $header;
        }

        $map = [];
        foreach ($aliases as $field => $names) {
            foreach ($names as $name) {
                if (isset($byKey[self::key($name)])) {
                    $map[$field] = $byKey[self::key($name)];
                    break;
                }
            }
        }

        return $map;
    }

    public static function key(string $text): string
    {
        return mb_strtolower(preg_replace('/\s+/u', ' ', trim($text)));
    }
}
