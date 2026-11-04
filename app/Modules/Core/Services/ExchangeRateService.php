<?php

namespace App\Modules\Core\Services;

use App\Models\Currency;
use App\Modules\Core\Models\ExchangeRate;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use InvalidArgumentException;

class ExchangeRateService
{
    public function record(
        string $fromCode,
        string $toCode,
        string $rate,
        CarbonInterface $effectiveAt,
        ?int $createdBy = null,
        ?string $source = null,
    ): ExchangeRate {
        $fromCode = strtoupper(trim($fromCode));
        $toCode = strtoupper(trim($toCode));

        if ($fromCode === $toCode) {
            throw new InvalidArgumentException('An exchange rate must use two different currencies.');
        }

        if (! preg_match('/^\d{1,10}(?:\.\d{1,10})?$/', $rate) || ! preg_match('/[1-9]/', $rate)) {
            throw new InvalidArgumentException('The exchange rate must be a positive decimal with at most 10 decimal places.');
        }

        $fromCurrency = Currency::query()->where('code', $fromCode)->first();
        $toCurrency = Currency::query()->where('code', $toCode)->first();

        if (! $fromCurrency || ! $toCurrency) {
            throw (new ModelNotFoundException)->setModel(Currency::class);
        }

        return ExchangeRate::query()->updateOrCreate(
            [
                'from_currency_id' => $fromCurrency->id,
                'to_currency_id' => $toCurrency->id,
                'effective_at' => $effectiveAt,
            ],
            [
                'rate' => $rate,
                'created_by' => $createdBy,
                'source' => $source,
            ],
        );
    }

    public function rateFor(
        string $fromCode,
        string $toCode,
        CarbonInterface $at,
    ): ?ExchangeRate {
        return ExchangeRate::query()
            ->whereHas('fromCurrency', fn ($query) => $query->where('code', strtoupper(trim($fromCode))))
            ->whereHas('toCurrency', fn ($query) => $query->where('code', strtoupper(trim($toCode))))
            ->where('effective_at', '<=', $at)
            ->orderByDesc('effective_at')
            ->first();
    }
}
