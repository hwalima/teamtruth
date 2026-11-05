<?php

namespace App\Modules\Inventory\Services;

use App\Models\User;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\AuditLogService;
use App\Modules\Core\Services\SequenceService;
use App\Modules\Inventory\Models\InventoryProduct;
use App\Modules\Inventory\Models\StockLocation;
use App\Modules\Inventory\Models\StockMove;
use App\Modules\Inventory\Models\StockMoveLine;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class InventoryStockService
{
    public function postMovement(Company $company, User $actor, array $data): StockMove
    {
        return DB::transaction(function () use ($company, $actor, $data): StockMove {
            $product = InventoryProduct::query()->lockForUpdate()->findOrFail($data['product_id']);
            if (! $product->is_active || $product->type === 'service') {
                throw ValidationException::withMessages([
                    'product_id' => __('Only active stockable or consumable products can be moved.'),
                ]);
            }

            $source = isset($data['from_location_id'])
                ? StockLocation::query()->lockForUpdate()->findOrFail($data['from_location_id'])
                : null;
            $destination = isset($data['to_location_id'])
                ? StockLocation::query()->lockForUpdate()->findOrFail($data['to_location_id'])
                : null;

            $this->validateLocations($data['operation'], $source, $destination);
            $lotCode = $data['lot_code'] ?? null;
            $quantity = (string) $data['quantity'];
            $this->validateTracking($product, $quantity, $lotCode);
            if ($product->tracking === 'serial' && $data['operation'] === 'receipt'
                && StockMoveLine::query()->where('product_id', $product->id)
                    ->where('lot_code', $lotCode)
                    ->whereHas('stockMove', fn ($query) => $query->where('operation', 'receipt'))
                    ->exists()) {
                throw ValidationException::withMessages([
                    'lot_code' => __('This serial number has already been received for this product.'),
                ]);
            }

            if ($source?->usage === 'internal') {
                $available = $this->quantityOnHand($company, $product->id, $source->id, $lotCode);
                if (self::compareDecimals($available, $quantity) < 0) {
                    throw ValidationException::withMessages([
                        'quantity' => __('Insufficient stock at the selected source location. Available: :available', [
                            'available' => $available,
                        ]),
                    ]);
                }
            }

            $documentNumber = app(SequenceService::class)->next(
                $company,
                'stock_move',
                sprintf('%s/SM/%s/', $company->code, now()->format('Y')),
            );
            $movement = StockMove::query()->create([
                'company_id' => $company->id,
                'document_number' => $documentNumber,
                'operation' => $data['operation'],
                'status' => 'posted',
                'reference' => $data['reference'] ?? null,
                'moved_at' => $data['moved_at'] ?? now(),
                'created_by' => $actor->id,
            ]);
            $line = $movement->lines()->create([
                'company_id' => $company->id,
                'product_id' => $product->id,
                'from_location_id' => $source?->id,
                'to_location_id' => $destination?->id,
                'quantity' => $quantity,
                'lot_code' => $lotCode,
            ]);

            app(AuditLogService::class)->record(
                $company,
                'inventory.stock_movement.posted',
                $movement,
                changes: [
                    'after' => [
                        'document_number' => $documentNumber,
                        'operation' => $data['operation'],
                        'product_id' => $product->id,
                        'from_location_id' => $source?->id,
                        'to_location_id' => $destination?->id,
                        'quantity' => $quantity,
                        'lot_code' => $lotCode,
                    ],
                ],
                actor: $actor,
            );

            return $movement->setRelation('lines', collect([$line]));
        });
    }

    public function balances(Company $company): array
    {
        $increases = DB::table('stock_move_lines')
            ->join('stock_moves', 'stock_moves.id', '=', 'stock_move_lines.stock_move_id')
            ->where('stock_moves.company_id', $company->id)
            ->where('stock_moves.status', 'posted')
            ->whereNotNull('stock_move_lines.to_location_id')
            ->selectRaw('stock_move_lines.product_id, stock_move_lines.to_location_id AS location_id, stock_move_lines.lot_code, stock_move_lines.quantity AS quantity_delta');

        $decreases = DB::table('stock_move_lines')
            ->join('stock_moves', 'stock_moves.id', '=', 'stock_move_lines.stock_move_id')
            ->where('stock_moves.company_id', $company->id)
            ->where('stock_moves.status', 'posted')
            ->whereNotNull('stock_move_lines.from_location_id')
            ->selectRaw('stock_move_lines.product_id, stock_move_lines.from_location_id AS location_id, stock_move_lines.lot_code, -stock_move_lines.quantity AS quantity_delta');

        return DB::query()
            ->fromSub($increases->unionAll($decreases), 'stock_deltas')
            ->join('inventory_products', 'inventory_products.id', '=', 'stock_deltas.product_id')
            ->join('stock_locations', 'stock_locations.id', '=', 'stock_deltas.location_id')
            ->where('inventory_products.company_id', $company->id)
            ->where('stock_locations.company_id', $company->id)
            ->where('stock_locations.usage', 'internal')
            ->selectRaw('stock_deltas.product_id, stock_deltas.location_id, stock_deltas.lot_code, SUM(stock_deltas.quantity_delta) AS quantity')
            ->groupBy('stock_deltas.product_id', 'stock_deltas.location_id', 'stock_deltas.lot_code')
            ->havingRaw('SUM(stock_deltas.quantity_delta) > 0')
            ->orderBy('stock_deltas.product_id')
            ->orderBy('stock_deltas.location_id')
            ->get()
            ->map(function (object $balance): object {
                $balance->quantity = self::normalizeDecimal((string) $balance->quantity);

                return $balance;
            })
            ->all();
    }

    private function quantityOnHand(Company $company, int $productId, int $locationId, ?string $lotCode): string
    {
        $query = DB::table('stock_move_lines')
            ->join('stock_moves', 'stock_moves.id', '=', 'stock_move_lines.stock_move_id')
            ->where('stock_moves.company_id', $company->id)
            ->where('stock_moves.status', 'posted')
            ->where('stock_move_lines.company_id', $company->id)
            ->where('stock_move_lines.product_id', $productId)
            ->where(function ($query) use ($locationId): void {
                $query->where('stock_move_lines.from_location_id', $locationId)
                    ->orWhere('stock_move_lines.to_location_id', $locationId);
            });

        if ($lotCode === null) {
            $query->whereNull('stock_move_lines.lot_code');
        } else {
            $query->where('stock_move_lines.lot_code', $lotCode);
        }

        $result = $query->selectRaw(
            'COALESCE(SUM(CASE WHEN stock_move_lines.to_location_id = ? THEN stock_move_lines.quantity WHEN stock_move_lines.from_location_id = ? THEN -stock_move_lines.quantity ELSE 0 END), 0) AS quantity',
            [$locationId, $locationId],
        )->value('quantity');

        return self::normalizeDecimal((string) ($result ?? '0'));
    }

    private function validateLocations(string $operation, ?StockLocation $source, ?StockLocation $destination): void
    {
        $valid = match ($operation) {
            'receipt' => $source?->usage === 'supplier' && $destination?->usage === 'internal',
            'issue' => $source?->usage === 'internal' && in_array($destination?->usage, ['customer', 'department'], true),
            'transfer' => $source?->usage === 'internal'
                && $destination?->usage === 'internal'
                && $source->id !== $destination->id,
            'adjustment' => ($source?->usage === 'adjustment' && $destination?->usage === 'internal')
                || ($source?->usage === 'internal' && $destination?->usage === 'adjustment'),
            'scrap' => $source?->usage === 'internal' && $destination?->usage === 'scrap',
            default => false,
        };

        if (! $valid) {
            throw ValidationException::withMessages([
                'operation' => __('The source and destination locations do not match this movement type.'),
            ]);
        }
    }

    private function validateTracking(InventoryProduct $product, string $quantity, ?string $lotCode): void
    {
        if ($product->tracking === 'none' && $lotCode !== null) {
            throw ValidationException::withMessages(['lot_code' => __('This product does not use lot or serial tracking.')]);
        }
        if ($product->tracking !== 'none' && blank($lotCode)) {
            throw ValidationException::withMessages(['lot_code' => __('Enter a lot or serial number for this tracked product.')]);
        }
        if ($product->tracking === 'serial' && self::compareDecimals($quantity, '1') !== 0) {
            throw ValidationException::withMessages(['quantity' => __('Serial-tracked products must be moved one unit at a time.')]);
        }
    }

    private static function compareDecimals(string $left, string $right): int
    {
        [$leftWhole, $leftFraction] = explode('.', self::normalizeDecimal($left), 2);
        [$rightWhole, $rightFraction] = explode('.', self::normalizeDecimal($right), 2);

        if (strlen($leftWhole) !== strlen($rightWhole)) {
            return strlen($leftWhole) <=> strlen($rightWhole);
        }

        $wholeComparison = strcmp($leftWhole, $rightWhole);
        if ($wholeComparison !== 0) {
            return $wholeComparison <=> 0;
        }

        return strcmp($leftFraction, $rightFraction) <=> 0;
    }

    private static function normalizeDecimal(string $value): string
    {
        if (! preg_match('/^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/', trim($value), $matches)) {
            throw new RuntimeException('The stock quantity returned by the database is not a valid decimal.');
        }

        $sign = $matches[1];
        $whole = $matches[2] !== '' ? $matches[2] : '0';
        $fraction = $matches[3] ?? '';
        $digits = $whole.$fraction;
        $decimalPoint = strlen($whole) + (int) ($matches[4] ?? 0);

        if ($decimalPoint <= 0) {
            $whole = '0';
            $fraction = str_repeat('0', -$decimalPoint).$digits;
        } elseif ($decimalPoint >= strlen($digits)) {
            $whole = $digits.str_repeat('0', $decimalPoint - strlen($digits));
            $fraction = '';
        } else {
            $whole = substr($digits, 0, $decimalPoint);
            $fraction = substr($digits, $decimalPoint);
        }

        $whole = ltrim($whole, '0') ?: '0';
        $fraction = str_pad($fraction, 5, '0');
        $scaled = $whole.str_pad(substr($fraction, 0, 4), 4, '0');
        if ((int) $fraction[4] >= 5) {
            $scaled = self::incrementDigits($scaled);
        }
        $scaled = str_pad($scaled, 5, '0', STR_PAD_LEFT);
        $normalizedWhole = ltrim(substr($scaled, 0, -4), '0') ?: '0';
        $normalizedFraction = substr($scaled, -4);
        $normalized = $normalizedWhole.'.'.$normalizedFraction;

        return $sign === '-' && $normalized !== '0.0000' ? '-'.$normalized : $normalized;
    }

    private static function incrementDigits(string $digits): string
    {
        $digits = str_split($digits);
        for ($index = count($digits) - 1; $index >= 0; $index--) {
            if ($digits[$index] !== '9') {
                $digits[$index] = (string) ((int) $digits[$index] + 1);

                return implode('', $digits);
            }
            $digits[$index] = '0';
        }

        return '1'.implode('', $digits);
    }
}
