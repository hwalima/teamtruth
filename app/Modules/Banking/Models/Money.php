<?php

namespace App\Modules\Banking\Models;

/**
 * Amounts are handled as whole cents so adding up a statement never drifts the
 * way floats do. The database keeps decimal(18,2).
 */
final class Money
{
    public static function cents(mixed $value): int
    {
        if ($value === null || $value === '') {
            return 0;
        }
        if (is_int($value)) {
            return $value * 100;
        }
        if (is_float($value)) {
            return (int) round($value * 100);
        }

        $value = str_replace([',', ' '], '', (string) $value);
        if (! is_numeric($value)) {
            return 0;
        }
        if (stripos($value, 'e') !== false) {
            // Scientific notation (SQLite sums can come back like this).
            return (int) round((float) $value * 100);
        }

        return (int) bcmul($value, '100', 0) + self::roundingCorrection($value);
    }

    /** "12.345" truncates to 1234 with bcmul; round half away from zero instead. */
    private static function roundingCorrection(string $value): int
    {
        $fraction = explode('.', $value)[1] ?? '';
        if (strlen($fraction) <= 2 || (int) $fraction[2] < 5) {
            return 0;
        }

        return str_starts_with($value, '-') ? -1 : 1;
    }

    /** Cents back to the decimal string stored in the database. */
    public static function decimal(int $cents): string
    {
        $sign = $cents < 0 ? '-' : '';
        $cents = abs($cents);

        return $sign.intdiv($cents, 100).'.'.str_pad((string) ($cents % 100), 2, '0', STR_PAD_LEFT);
    }

    public static function format(int $cents): string
    {
        $text = number_format(abs($cents) / 100, 2);

        return $cents < 0 ? '-'.$text : $text;
    }
}
