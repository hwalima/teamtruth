<?php

namespace App\Modules\Banking\Services;

use App\Modules\Banking\Models\Money;
use Carbon\CarbonImmutable;
use DateTimeInterface;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use RuntimeException;
use Throwable;

/**
 * Reads a statement workbook, one account per sheet:
 *
 *   Bank name
 *   Account Name: X                 Account No: N
 *   Statement Period: ...
 *   Date | Txn Type | Description | Ref No. | Debit | Credit | Balance
 *   <opening balance line>, then one line per transaction, then a totals row.
 *
 * Nothing is changed: amounts, types and descriptions are kept as written. The
 * running balance is worked out from the opening balance and the amounts, and
 * every line where the sheet printed a different balance is reported.
 */
class StatementReader
{
    private const HEADERS = [
        'date' => ['date', 'txn date', 'transaction date', 'value date'],
        'type' => ['txn type', 'type', 'transaction type'],
        'description' => ['description', 'details', 'narrative', 'particulars'],
        'reference' => ['ref no.', 'ref no', 'ref', 'reference', 'ref. no.'],
        'debit' => ['debit', 'debits', 'withdrawal', 'withdrawals', 'dr'],
        'credit' => ['credit', 'credits', 'deposit', 'deposits', 'cr'],
        'balance' => ['balance', 'running balance'],
    ];

    /** @return list<array<string, mixed>> one entry per sheet that holds a statement */
    public function read(string $path): array
    {
        try {
            $book = IOFactory::load($path);
        } catch (Throwable $exception) {
            throw new RuntimeException('This file could not be opened as a spreadsheet: '.$exception->getMessage());
        }

        $sheets = [];
        foreach ($book->getWorksheetIterator() as $index => $sheet) {
            $parsed = $this->sheet($sheet, $index);
            if ($parsed !== null) {
                $sheets[] = $parsed;
            }
        }

        if ($sheets === []) {
            throw new RuntimeException('No statement was found. Each sheet needs a header row with Date, Debit, Credit and Balance columns.');
        }

        return $sheets;
    }

    /** @return array<string, mixed>|null */
    private function sheet(Worksheet $sheet, int $index): ?array
    {
        [$headerRow, $columns] = $this->findHeader($sheet);
        if ($headerRow === null) {
            return null;
        }

        $info = $this->headerInfo($sheet, $headerRow);
        $notes = [];
        $lines = [];
        $opening = null;
        $fileTotals = null;
        $lastRow = $sheet->getHighestDataRow();
        $usedColumns = array_values($columns);

        for ($row = $headerRow + 1; $row <= $lastRow; $row++) {
            $raw = $this->rowValues($sheet, $row, $columns);
            $hasAmounts = $raw['debit'] !== null || $raw['credit'] !== null;
            $hasText = $raw['type'] !== '' || $raw['description'] !== '' || $raw['reference'] !== '';
            $notes = [...$notes, ...$this->strayCells($sheet, $row, $usedColumns)];

            if ($raw['date'] === null) {
                if ($hasAmounts && ! $hasText) {
                    $fileTotals ??= ['row' => $row, 'debit' => Money::cents($raw['debit']), 'credit' => Money::cents($raw['credit'])];
                } elseif ($hasText) {
                    $notes[] = "Row {$row} has no date, so it was left out: “".trim($raw['type'].' '.$raw['description']).'”.';
                }

                continue;
            }

            if ($raw['date'] === false) {
                $notes[] = "Row {$row} has a date that could not be read (“{$raw['date_text']}”), so it was left out.";

                continue;
            }

            if ($opening === null && preg_match('/opening\s+balance|balance\s+b\/?f|brought\s+forward/i', $raw['description'].' '.$raw['type']) === 1) {
                $opening = [
                    'row' => $row,
                    'date' => $raw['date'],
                    'debit' => Money::cents($raw['debit']),
                    'credit' => Money::cents($raw['credit']),
                    'balance' => $raw['balance'] === null
                        ? Money::cents($raw['credit']) - Money::cents($raw['debit'])
                        : Money::cents($raw['balance']),
                ];

                continue;
            }

            if (! $hasAmounts && ! $hasText) {
                continue;
            }

            $lines[] = [
                'row' => $row,
                'date' => $raw['date'],
                'type' => $raw['type'],
                'description' => $raw['description'],
                'reference' => $raw['reference'],
                'debit' => Money::cents($raw['debit']),
                'credit' => Money::cents($raw['credit']),
                'stated_balance' => $raw['balance'] === null ? null : Money::cents($raw['balance']),
            ];
        }

        if ($opening === null) {
            $notes[] = 'No “Opening balance” line was found, so the account opens at 0.00.';
            $opening = ['row' => null, 'date' => $lines[0]['date'] ?? null, 'debit' => 0, 'credit' => 0, 'balance' => 0];
        }

        return $this->summarise($sheet->getTitle(), $index, $info, $opening, $lines, $fileTotals, $notes);
    }

    /** @return array<string, mixed> */
    private function summarise(string $title, int $index, array $info, array $opening, array $lines, ?array $fileTotals, array $notes): array
    {
        $balance = $opening['balance'];
        $debits = 0;
        $credits = 0;
        $differences = [];
        $types = [];

        foreach ($lines as $i => $line) {
            $balance += $line['credit'] - $line['debit'];
            $debits += $line['debit'];
            $credits += $line['credit'];
            $lines[$i]['balance'] = $balance;
            $types[$line['type']] = ($types[$line['type']] ?? 0) + 1;

            if ($line['stated_balance'] !== null && $line['stated_balance'] !== $balance) {
                $differences[] = [
                    'row' => $line['row'],
                    'date' => $line['date'],
                    'description' => $line['description'],
                    'stated_balance' => $line['stated_balance'],
                    'balance' => $balance,
                    'difference' => $line['stated_balance'] - $balance,
                ];
            }
            if ($line['debit'] !== 0 && $line['credit'] !== 0) {
                $notes[] = "Row {$line['row']} has both a debit and a credit; both were kept.";
            }
        }

        $last = $lines === [] ? null : $lines[array_key_last($lines)];
        $fileClosing = $last['stated_balance'] ?? $opening['balance'];

        if ($opening['credit'] !== 0 || $opening['debit'] !== 0) {
            $notes[] = 'The opening balance of '.Money::format($opening['balance']).' is entered as '
                .($opening['credit'] !== 0 ? 'a credit' : 'a debit').' on the opening line. It is the account’s opening balance, not a transaction.';
        }

        if ($fileTotals !== null) {
            $withOpeningDebit = $debits + $opening['debit'];
            $withOpeningCredit = $credits + $opening['credit'];
            $matches = ($fileTotals['debit'] === $debits && $fileTotals['credit'] === $credits)
                || ($fileTotals['debit'] === $withOpeningDebit && $fileTotals['credit'] === $withOpeningCredit);
            $fileTotals['matches'] = $matches;
            if (! $matches) {
                $notes[] = 'The totals row (row '.$fileTotals['row'].') shows debits '.Money::format($fileTotals['debit'])
                    .' and credits '.Money::format($fileTotals['credit']).', but the lines add up to debits '
                    .Money::format($debits).' and credits '.Money::format($credits).'. The statement uses the lines.';
            }
        }

        foreach ($types as $type => $count) {
            foreach ($types as $other => $otherCount) {
                if ($type !== '' && $otherCount > $count && levenshtein(mb_strtolower((string) $type), mb_strtolower((string) $other)) === 1) {
                    $notes[] = "The type “{$type}” ({$count} line(s)) looks like a misspelling of “{$other}”. It was kept as written.";
                    break;
                }
            }
        }

        if ($differences !== []) {
            $notes[] = count($differences).' line(s) show a balance that does not follow from the amounts. The statement shows the correct running balance; each one is listed under Balance differences.';
        }

        $firstDate = $lines[0]['date'] ?? null;
        if ($opening['date'] !== null && $firstDate !== null) {
            $gap = CarbonImmutable::parse($opening['date'])->diffInDays(CarbonImmutable::parse($firstDate));
            if ($gap > 45) {
                $notes[] = 'The opening balance is dated '.CarbonImmutable::parse($opening['date'])->format('j M Y')
                    .', '.(int) $gap.' days before the first transaction ('.CarbonImmutable::parse($firstDate)->format('j M Y').'). It was kept as written.';
            }
        }

        if ($info['period'] !== null && $firstDate !== null && ! $this->periodCovers($info['period'], $opening['date'] ?? $firstDate, $last['date'])) {
            $notes[] = 'The sheet’s heading says “'.$info['period'].'”; its lines run from '
                .CarbonImmutable::parse($opening['date'] ?? $firstDate)->format('j M Y').' to '.CarbonImmutable::parse($last['date'])->format('j M Y').'.';
        }

        return [
            'index' => $index,
            'sheet' => $title,
            'bank' => $info['bank'],
            'account_name' => $info['account_name'] ?? trim($title),
            'account_number' => $info['account_number'],
            'period' => $info['period'],
            'opening' => $opening,
            'lines' => $lines,
            'line_count' => count($lines),
            'first_date' => $firstDate,
            'last_date' => $last['date'] ?? null,
            'debits' => $debits,
            'credits' => $credits,
            'closing' => $balance,
            'file_closing' => $fileClosing,
            'file_totals' => $fileTotals,
            'differences' => $differences,
            'types' => $types,
            'notes' => array_values(array_unique($notes)),
        ];
    }

    /** Whether a heading like "01/10/26 - 31/10/26" spans the dates the lines actually carry. */
    private function periodCovers(string $period, string $from, string $to): bool
    {
        preg_match_all('#(\d{1,2})/(\d{1,2})/(\d{2,4})#', $period, $matches, PREG_SET_ORDER);
        if ($matches === []) {
            return false;
        }
        $dates = array_map(function (array $m): string {
            $year = strlen($m[3]) === 2 ? '20'.$m[3] : $m[3];

            return sprintf('%04d-%02d-%02d', $year, $m[2], $m[1]);
        }, array_slice($matches, 0, 2));

        // "01/2/2026 -" has no end date: only the start can be checked.
        return $dates[0] <= $from && (! isset($dates[1]) || $dates[1] >= $to);
    }

    /** @return array{0: int|null, 1: array<string, string>} */
    private function findHeader(Worksheet $sheet): array
    {
        $maxColumn = min(Coordinate::columnIndexFromString($sheet->getHighestDataColumn()), 30);
        for ($row = 1; $row <= min(25, $sheet->getHighestDataRow()); $row++) {
            $columns = [];
            for ($c = 1; $c <= $maxColumn; $c++) {
                $text = mb_strtolower(trim((string) $sheet->getCell([$c, $row])->getValue()));
                foreach (self::HEADERS as $key => $names) {
                    if (! isset($columns[$key]) && in_array($text, $names, true)) {
                        $columns[$key] = Coordinate::stringFromColumnIndex($c);
                    }
                }
            }
            if (isset($columns['date'], $columns['debit'], $columns['credit'], $columns['balance'])) {
                return [$row, $columns];
            }
        }

        return [null, []];
    }

    /** @return array{bank: string|null, account_name: string|null, account_number: string|null, period: string|null} */
    private function headerInfo(Worksheet $sheet, int $headerRow): array
    {
        $info = ['bank' => null, 'account_name' => null, 'account_number' => null, 'period' => null];
        $maxColumn = min(Coordinate::columnIndexFromString($sheet->getHighestDataColumn()), 30);
        $loose = [];

        for ($row = 1; $row < $headerRow; $row++) {
            for ($c = 1; $c <= $maxColumn; $c++) {
                $text = trim(preg_replace('/\s+/u', ' ', (string) $sheet->getCell([$c, $row])->getValue()));
                if ($text === '') {
                    continue;
                }
                if (preg_match('/^account\s*no\.?\s*:?\s*(.*)$/i', $text, $m) === 1) {
                    $info['account_number'] = trim($m[1]) !== '' ? trim($m[1]) : null;
                } elseif (preg_match('/^account\s*name\s*:?\s*(.*)$/i', $text, $m) === 1) {
                    $info['account_name'] = trim($m[1]) !== '' ? trim($m[1]) : null;
                } elseif (preg_match('/^statement\s*period\s*:?\s*(.*)$/i', $text, $m) === 1) {
                    $info['period'] = trim($m[1], " -\t") !== '' ? trim($m[1]) : null;
                } else {
                    $loose[] = $text;
                }
            }
        }

        $info['bank'] = $loose[0] ?? null;
        if ($info['account_name'] === null) {
            // "Sample Holdings Account" on its own line.
            foreach (array_slice($loose, 1) as $text) {
                if (preg_match('/^(.+?)\s+account$/i', $text, $m) === 1) {
                    $info['account_name'] = trim($m[1]);
                    break;
                }
            }
        }

        return $info;
    }

    /** @return array<string, mixed> */
    private function rowValues(Worksheet $sheet, int $row, array $columns): array
    {
        $cell = fn (string $key) => isset($columns[$key]) ? $sheet->getCell($columns[$key].$row) : null;
        $text = fn (string $key) => trim((string) ($cell($key)?->getCalculatedValue() ?? ''));
        $number = function (string $key) use ($cell) {
            $value = $cell($key)?->getCalculatedValue();
            if ($value === null || (is_string($value) && trim($value) === '')) {
                return null;
            }

            return is_numeric(str_replace([',', ' '], '', (string) $value)) ? $value : null;
        };

        $dateCell = $cell('date');
        $dateValue = $dateCell?->getCalculatedValue();
        $date = null;
        if ($dateValue !== null && $dateValue !== '') {
            $date = $this->date($dateValue);
        }

        return [
            'date' => $date,
            'date_text' => (string) $dateValue,
            'type' => $text('type'),
            'description' => $text('description'),
            'reference' => $text('reference'),
            'debit' => $number('debit'),
            'credit' => $number('credit'),
            'balance' => $number('balance'),
        ];
    }

    private function date(mixed $value): string|false
    {
        try {
            if ($value instanceof DateTimeInterface) {
                return CarbonImmutable::instance($value)->toDateString();
            }
            if (is_numeric($value)) {
                return CarbonImmutable::instance(ExcelDate::excelToDateTimeObject((float) $value))->toDateString();
            }
            $text = trim((string) $value);
            foreach (['d/m/Y', 'd/m/y', 'Y-m-d', 'd-m-Y', 'd.m.Y', 'j M Y', 'd M Y'] as $format) {
                $parsed = CarbonImmutable::createFromFormat('!'.$format, $text);
                if ($parsed !== false && $parsed->format($format) === $text) {
                    return $parsed->toDateString();
                }
            }
        } catch (Throwable) {
            return false;
        }

        return false;
    }

    /** Cells filled in beside the statement table, reported so nothing goes unseen. */
    private function strayCells(Worksheet $sheet, int $row, array $usedColumns): array
    {
        $notes = [];
        $maxColumn = min(Coordinate::columnIndexFromString($sheet->getHighestDataColumn()), 30);
        $used = array_map(fn ($c) => Coordinate::columnIndexFromString($c), $usedColumns);
        for ($c = 1; $c <= $maxColumn; $c++) {
            if (in_array($c, $used, true)) {
                continue;
            }
            $value = $sheet->getCell([$c, $row])->getValue();
            if ($value !== null && trim((string) $value) !== '') {
                $notes[] = 'Cell '.Coordinate::stringFromColumnIndex($c).$row.' holds “'.trim((string) $value).'” outside the statement columns; it was not imported.';
            }
        }

        return $notes;
    }
}
