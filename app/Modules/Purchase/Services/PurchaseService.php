<?php

namespace App\Modules\Purchase\Services;

use App\Models\User;
use App\Modules\Core\Models\ApprovalWorkflow;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\ApprovalWorkflowService;
use App\Modules\Core\Services\AuditLogService;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\SequenceService;
use App\Modules\Inventory\Models\InventoryProduct;
use App\Modules\Inventory\Models\StockLocation;
use App\Modules\Inventory\Services\InventoryStockService;
use App\Modules\Purchase\Models\PurchaseOrder;
use App\Modules\Purchase\Models\PurchaseOrderLine;
use App\Modules\Purchase\Models\PurchaseQuotation;
use App\Modules\Purchase\Models\PurchaseReceipt;
use App\Modules\Purchase\Models\PurchaseReceiptLine;
use App\Modules\Purchase\Models\PurchaseRFQ;
use App\Modules\Purchase\Models\PurchaseRFQLine;
use App\Modules\Purchase\Models\PurchaseVendor;
use App\Modules\Requisitions\Enums\RequisitionStatus;
use App\Modules\Requisitions\Models\Requisition;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use LogicException;
use RuntimeException;

class PurchaseService
{
    public function createRfq(User $actor, array $data, array $lines): PurchaseRFQ
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        return DB::transaction(function () use ($company, $actor, $data, $lines): PurchaseRFQ {
            $rfq = PurchaseRFQ::query()->create([
                'company_id' => $company->id,
                'document_number' => app(SequenceService::class)->next($company, 'purchase_rfq'),
                'source_requisition_id' => $data['source_requisition_id'] ?? null,
                'status' => 'open',
                'currency_code' => strtoupper($data['currency_code']),
                'reference' => $data['reference'] ?? null,
                'created_by' => $actor->id,
            ]);
            foreach (array_values($lines) as $index => $line) {
                PurchaseRFQLine::query()->create([
                    'company_id' => $company->id,
                    'purchase_rfq_id' => $rfq->id,
                    'product_id' => $line['product_id'],
                    'quantity' => $line['quantity'],
                    'sort_order' => $index + 1,
                ]);
            }
            app(AuditLogService::class)->record(
                $company,
                'purchase.rfq.created',
                $rfq,
                changes: ['after' => ['document_number' => $rfq->document_number, 'line_count' => count($lines)]],
                actor: $actor,
            );

            return $rfq->load('lines');
        });
    }

    public function createRfqFromApprovedRequisition(Requisition $requisition, User $actor, array $mappings): PurchaseRFQ
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        return DB::transaction(function () use ($company, $requisition, $actor, $mappings): PurchaseRFQ {
            $requisition = Requisition::query()->lockForUpdate()->with('lines')->findOrFail($requisition->id);
            if ($requisition->requisition_type !== 'purchase' || $requisition->status !== RequisitionStatus::Approved) {
                throw ValidationException::withMessages([
                    'requisition' => __('Only approved purchase requisitions can be converted to an RFQ.'),
                ]);
            }
            if (PurchaseRFQ::query()->where('source_requisition_id', $requisition->id)->exists()) {
                throw ValidationException::withMessages([
                    'requisition' => __('This requisition has already been converted to an RFQ.'),
                ]);
            }

            $mappedLines = $this->mapRequisitionLinesToProducts($requisition, $mappings);
            $rfqLines = array_map(
                fn (array $mappedLine): array => [
                    'product_id' => $mappedLine['product']->id,
                    'quantity' => $mappedLine['line']->quantity,
                ],
                $mappedLines,
            );

            $rfq = $this->createRfq($actor, [
                'currency_code' => $requisition->currency_code,
                'reference' => $requisition->document_number,
                'source_requisition_id' => $requisition->id,
            ], $rfqLines);
            $requisition->status = RequisitionStatus::Converted;
            $requisition->save();
            app(AuditLogService::class)->record(
                $company,
                'purchase.requisition.converted',
                $requisition,
                changes: ['after' => ['purchase_rfq_id' => $rfq->id, 'document_number' => $rfq->document_number]],
                actor: $actor,
            );

            return $rfq;
        });
    }

    public function issueApprovedStoreRequisition(
        Requisition $requisition,
        User $actor,
        array $mappings,
        int $sourceLocationId,
        int $destinationLocationId,
    ): Requisition {
        $company = app(CompanyContext::class)->requireActiveCompany();

        return DB::transaction(function () use (
            $company,
            $requisition,
            $actor,
            $mappings,
            $sourceLocationId,
            $destinationLocationId,
        ): Requisition {
            $requisition = Requisition::query()->lockForUpdate()->with('lines')->findOrFail($requisition->id);
            if ($requisition->requisition_type !== 'store_issue' || $requisition->status !== RequisitionStatus::Approved) {
                throw ValidationException::withMessages([
                    'requisition' => __('Only approved store-issue requisitions can be issued.'),
                ]);
            }

            $source = StockLocation::query()->findOrFail($sourceLocationId);
            $destination = StockLocation::query()->findOrFail($destinationLocationId);
            if (! $source->is_active || $source->usage !== 'internal') {
                throw ValidationException::withMessages(['source_location_id' => __('Select an active internal stock location.')]);
            }
            if (! $destination->is_active || $destination->usage !== 'department') {
                throw ValidationException::withMessages(['destination_location_id' => __('Select an active department location.')]);
            }

            $mappedLines = $this->mapRequisitionLinesToProducts($requisition, $mappings);
            $serialsUsed = [];
            foreach ($mappedLines as $index => $mappedLine) {
                $line = $mappedLine['line'];
                $product = $mappedLine['product'];
                $mapping = $mappedLine['mapping'];
                $lotCode = trim((string) ($mapping['lot_code'] ?? '')) ?: null;
                $serialCodes = array_values(array_filter(
                    array_map(fn ($serial): string => trim((string) $serial), $mapping['serial_codes'] ?? []),
                    fn (string $serial): bool => $serial !== '',
                ));

                if ($product->tracking === 'serial') {
                    $quantity = (string) $line->quantity;
                    if (! preg_match('/^\d+(?:\.0+)?$/', $quantity) || (int) $quantity < 1 || (int) $quantity > 50) {
                        throw ValidationException::withMessages([
                            "lines.{$index}.serial_codes" => __('Serial-tracked requisition lines must request a whole number from 1 to 50.'),
                        ]);
                    }
                    if ($lotCode !== null || count($serialCodes) !== (int) $quantity) {
                        throw ValidationException::withMessages([
                            "lines.{$index}.serial_codes" => __('Enter one serial number for each requested unit.'),
                        ]);
                    }
                    foreach ($serialCodes as $serialCode) {
                        $serialKey = $product->id.':'.$serialCode;
                        if (isset($serialsUsed[$serialKey])) {
                            throw ValidationException::withMessages([
                                "lines.{$index}.serial_codes" => __('Serial numbers must be unique for each product.'),
                            ]);
                        }
                        $serialsUsed[$serialKey] = true;
                        $this->postRequisitionIssueMovement(
                            $company,
                            $actor,
                            $product->id,
                            $source->id,
                            $destination->id,
                            '1.0000',
                            $serialCode,
                            $requisition->document_number,
                            $index,
                        );
                    }

                    continue;
                }

                if ($serialCodes !== []) {
                    throw ValidationException::withMessages([
                        "lines.{$index}.serial_codes" => __('Serial numbers are only accepted for serial-tracked products.'),
                    ]);
                }
                $this->postRequisitionIssueMovement(
                    $company,
                    $actor,
                    $product->id,
                    $source->id,
                    $destination->id,
                    (string) $line->quantity,
                    $lotCode,
                    $requisition->document_number,
                    $index,
                );
            }

            $requisition->status = RequisitionStatus::Issued;
            $requisition->save();
            app(AuditLogService::class)->record(
                $company,
                'inventory.requisition.issued',
                $requisition,
                changes: ['after' => [
                    'source_location_id' => $source->id,
                    'destination_location_id' => $destination->id,
                    'line_count' => count($mappedLines),
                ]],
                actor: $actor,
            );

            return $requisition;
        });
    }

    public function createQuotation(PurchaseRFQ $rfq, PurchaseVendor $vendor, User $actor, array $data, array $lines): PurchaseQuotation
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        return DB::transaction(function () use ($company, $rfq, $vendor, $actor, $data, $lines): PurchaseQuotation {
            $rfq = PurchaseRFQ::query()->lockForUpdate()->with('lines')->findOrFail($rfq->id);
            abort_unless((int) $vendor->company_id === (int) $company->id, 404);
            if ($rfq->status !== 'open') {
                throw ValidationException::withMessages(['rfq_id' => __('This RFQ is no longer open for quotations.')]);
            }
            if ($rfq->quotations()->where('vendor_id', $vendor->id)->exists()) {
                throw ValidationException::withMessages(['vendor_id' => __('This vendor already has a quotation for the selected RFQ.')]);
            }

            $linePrices = collect($lines)->keyBy('rfq_line_id');
            if ($linePrices->count() !== $rfq->lines->count()
                || $rfq->lines->contains(fn (PurchaseRFQLine $line): bool => ! $linePrices->has((string) $line->id)
                    && ! $linePrices->has($line->id))) {
                throw ValidationException::withMessages(['lines' => __('Enter one price for every RFQ line.')]);
            }

            $quotationLines = [];
            $total = '0.0000';
            foreach ($rfq->lines as $rfqLine) {
                $price = $linePrices->get($rfqLine->id) ?? $linePrices->get((string) $rfqLine->id);
                $unitPrice = (string) $price['unit_price'];
                $lineTotal = self::multiplyDecimals((string) $rfqLine->quantity, $unitPrice);
                $total = self::addDecimals($total, $lineTotal);
                $quotationLines[] = [
                    'company_id' => $company->id,
                    'purchase_rfq_line_id' => $rfqLine->id,
                    'quantity' => $rfqLine->quantity,
                    'unit_price' => $unitPrice,
                    'line_total' => $lineTotal,
                ];
            }
            $quotation = PurchaseQuotation::query()->create([
                'company_id' => $company->id,
                'purchase_rfq_id' => $rfq->id,
                'vendor_id' => $vendor->id,
                'vendor_reference' => $data['vendor_reference'] ?? null,
                'status' => 'received',
                'total' => $total,
            ]);
            $quotation->lines()->createMany($quotationLines);
            app(AuditLogService::class)->record(
                $company,
                'purchase.quotation.received',
                $quotation,
                changes: ['after' => ['vendor_id' => $vendor->id, 'total' => $total]],
                actor: $actor,
            );

            return $quotation->load('lines');
        });
    }

    public function createOrderFromQuotation(PurchaseQuotation $quotation, User $actor): PurchaseOrder
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        return DB::transaction(function () use ($company, $quotation, $actor): PurchaseOrder {
            $quotation = PurchaseQuotation::query()->lockForUpdate()
                ->with(['rfq.lines', 'lines.rfqLine'])
                ->findOrFail($quotation->id);
            $rfq = PurchaseRFQ::query()->lockForUpdate()->findOrFail($quotation->purchase_rfq_id);
            if ($quotation->status !== 'received') {
                throw ValidationException::withMessages(['quotation' => __('This quotation is no longer available for selection.')]);
            }
            if ($rfq->status !== 'open') {
                throw ValidationException::withMessages(['quotation' => __('This RFQ has already been awarded or closed.')]);
            }
            if (PurchaseOrder::query()->where('quotation_id', $quotation->id)->exists()) {
                throw ValidationException::withMessages(['quotation' => __('A purchase order has already been created from this quotation.')]);
            }
            if (! ApprovalWorkflow::query()->where('approvable_type', PurchaseOrder::class)->where('is_active', true)->exists()) {
                throw ValidationException::withMessages(['approval' => __('Configure an active purchase order approval workflow before creating an order.')]);
            }
            $rfq->status = 'awarded';
            $rfq->save();
            $quotation->status = 'selected';
            $quotation->save();
            $rfq->quotations()
                ->whereKeyNot($quotation->id)
                ->update(['status' => 'not_selected']);

            $order = PurchaseOrder::query()->create([
                'company_id' => $company->id,
                'document_number' => app(SequenceService::class)->next($company, 'purchase_order'),
                'vendor_id' => $quotation->vendor_id,
                'quotation_id' => $quotation->id,
                'source_requisition_id' => $quotation->rfq->source_requisition_id,
                'status' => 'pending_approval',
                'currency_code' => $quotation->rfq->currency_code,
                'total' => $quotation->total,
                'created_by' => $actor->id,
                'submitted_at' => now(),
            ]);
            foreach ($quotation->lines as $line) {
                PurchaseOrderLine::query()->create([
                    'company_id' => $company->id,
                    'purchase_order_id' => $order->id,
                    'product_id' => $line->rfqLine->product_id,
                    'quantity' => $line->quantity,
                    'received_quantity' => '0.0000',
                    'unit_price' => $line->unit_price,
                    'line_total' => $line->line_total,
                ]);
            }

            try {
                app(ApprovalWorkflowService::class)->submit(
                    $order,
                    $actor,
                    (string) $order->total,
                    $order->currency_code,
                    ['document_type' => 'purchase_order', 'vendor_id' => $order->vendor_id],
                );
            } catch (LogicException $exception) {
                throw ValidationException::withMessages(['approval' => __($exception->getMessage())]);
            }
            app(AuditLogService::class)->record(
                $company,
                'purchase.order.submitted',
                $order,
                changes: ['after' => ['document_number' => $order->document_number, 'quotation_id' => $quotation->id]],
                actor: $actor,
            );

            return $order->load('lines');
        });
    }

    public function receiveOrderLine(
        PurchaseOrder $order,
        PurchaseOrderLine $orderLine,
        User $actor,
        string $quantity,
        int $sourceLocationId,
        int $destinationLocationId,
        ?string $lotCode = null,
    ): PurchaseReceipt {
        $company = app(CompanyContext::class)->requireActiveCompany();

        return DB::transaction(function () use (
            $company,
            $order,
            $orderLine,
            $actor,
            $quantity,
            $sourceLocationId,
            $destinationLocationId,
            $lotCode,
        ): PurchaseReceipt {
            $order = PurchaseOrder::query()->lockForUpdate()->findOrFail($order->id);
            $orderLine = $order->lines()->lockForUpdate()->findOrFail($orderLine->id);
            if (! in_array($order->status, ['approved', 'partially_received'], true)) {
                throw ValidationException::withMessages(['purchase_order' => __('Only approved purchase orders can receive goods.')]);
            }

            $remaining = self::subtractDecimals((string) $orderLine->quantity, (string) $orderLine->received_quantity);
            if (self::compareDecimals($quantity, $remaining) > 0) {
                throw ValidationException::withMessages(['quantity' => __('The received quantity exceeds the remaining ordered quantity (:remaining).', [
                    'remaining' => $remaining,
                ])]);
            }

            $receipt = PurchaseReceipt::query()->create([
                'company_id' => $company->id,
                'document_number' => app(SequenceService::class)->next($company, 'purchase_receipt'),
                'purchase_order_id' => $order->id,
                'received_by' => $actor->id,
                'received_at' => now(),
            ]);
            $movement = app(InventoryStockService::class)->postMovement($company, $actor, [
                'operation' => 'receipt',
                'product_id' => $orderLine->product_id,
                'from_location_id' => $sourceLocationId,
                'to_location_id' => $destinationLocationId,
                'quantity' => $quantity,
                'lot_code' => $lotCode,
                'reference' => $order->document_number,
            ]);
            PurchaseReceiptLine::query()->create([
                'company_id' => $company->id,
                'purchase_receipt_id' => $receipt->id,
                'purchase_order_line_id' => $orderLine->id,
                'stock_move_id' => $movement->id,
                'quantity' => $quantity,
            ]);
            $orderLine->received_quantity = self::addDecimals((string) $orderLine->received_quantity, $quantity);
            $orderLine->save();
            $allReceived = $order->lines()->get()->every(
                fn (PurchaseOrderLine $line): bool => self::compareDecimals((string) $line->received_quantity, (string) $line->quantity) >= 0
            );
            $order->status = $allReceived ? 'received' : 'partially_received';
            $order->save();
            app(AuditLogService::class)->record(
                $company,
                'purchase.goods_received',
                $receipt,
                changes: ['after' => [
                    'purchase_order_id' => $order->id,
                    'purchase_order_line_id' => $orderLine->id,
                    'quantity' => $quantity,
                    'stock_move_id' => $movement->id,
                ]],
                actor: $actor,
            );

            return $receipt;
        });
    }

    private static function multiplyDecimals(string $left, string $right): string
    {
        $leftDigits = self::toScaledDigits($left);
        $rightDigits = self::toScaledDigits($right);
        $digits = array_fill(0, strlen($leftDigits) + strlen($rightDigits), 0);
        for ($i = strlen($leftDigits) - 1; $i >= 0; $i--) {
            for ($j = strlen($rightDigits) - 1; $j >= 0; $j--) {
                $digits[$i + $j + 1] += (int) $leftDigits[$i] * (int) $rightDigits[$j];
            }
        }
        for ($i = count($digits) - 1; $i > 0; $i--) {
            $digits[$i - 1] += intdiv($digits[$i], 10);
            $digits[$i] %= 10;
        }
        $product = str_pad(ltrim(implode('', $digits), '0') ?: '0', 5, '0', STR_PAD_LEFT);
        $scaled = substr($product, 0, -4);
        if ((int) substr($product, -4) >= 5000) {
            $scaled = self::incrementDigits($scaled);
        }

        return self::fromScaledDigits($scaled);
    }

    private static function addDecimals(string $left, string $right): string
    {
        $leftScaled = self::toScaledDigits($left);
        $rightScaled = self::toScaledDigits($right);
        $length = max(strlen($leftScaled), strlen($rightScaled));
        $leftDigits = str_split(str_pad($leftScaled, $length, '0', STR_PAD_LEFT));
        $rightDigits = str_split(str_pad($rightScaled, $length, '0', STR_PAD_LEFT));
        $result = '';
        $carry = 0;
        for ($index = $length - 1; $index >= 0; $index--) {
            $sum = (int) $leftDigits[$index] + (int) $rightDigits[$index] + $carry;
            $result = (string) ($sum % 10).$result;
            $carry = intdiv($sum, 10);
        }
        if ($carry > 0) {
            $result = (string) $carry.$result;
        }

        return self::fromScaledDigits($result);
    }

    private static function subtractDecimals(string $left, string $right): string
    {
        $leftDigits = self::toScaledDigits($left);
        $rightDigits = self::toScaledDigits($right);
        if (self::compareDecimals($left, $right) < 0) {
            throw new RuntimeException('Received quantity cannot exceed ordered quantity.');
        }
        $leftDigits = str_split($leftDigits);
        $rightDigits = str_split(str_pad($rightDigits, count($leftDigits), '0', STR_PAD_LEFT));
        $result = '';
        $borrow = 0;
        for ($index = count($leftDigits) - 1; $index >= 0; $index--) {
            $digit = (int) $leftDigits[$index] - (int) $rightDigits[$index] - $borrow;
            $borrow = $digit < 0 ? 1 : 0;
            if ($digit < 0) {
                $digit += 10;
            }
            $result = (string) $digit.$result;
        }

        return self::fromScaledDigits($result);
    }

    private static function compareDecimals(string $left, string $right): int
    {
        $leftDigits = self::toScaledDigits($left);
        $rightDigits = self::toScaledDigits($right);
        $length = max(strlen($leftDigits), strlen($rightDigits));
        $leftDigits = str_pad($leftDigits, $length, '0', STR_PAD_LEFT);
        $rightDigits = str_pad($rightDigits, $length, '0', STR_PAD_LEFT);

        return strcmp($leftDigits, $rightDigits) <=> 0;
    }

    private static function toScaledDigits(string $decimal): string
    {
        [$whole, $fraction] = array_pad(explode('.', $decimal, 2), 2, '');

        return ltrim($whole.str_pad(substr($fraction, 0, 4), 4, '0'), '0') ?: '0';
    }

    private static function fromScaledDigits(string $digits): string
    {
        $digits = ltrim($digits, '0') ?: '0';
        if (strlen($digits) > 20) {
            throw ValidationException::withMessages(['lines' => __('The quotation total exceeds the supported amount.')]);
        }
        $digits = str_pad($digits, 5, '0', STR_PAD_LEFT);

        return substr($digits, 0, -4).'.'.substr($digits, -4);
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

    private function mapRequisitionLinesToProducts(Requisition $requisition, array $mappings): array
    {
        $mappingsByLine = collect($mappings)->keyBy(fn (array $mapping): int => (int) $mapping['requisition_line_id']);
        if ($mappingsByLine->count() !== $requisition->lines->count()) {
            throw ValidationException::withMessages(['lines' => __('Map every requisition line to an inventory product.')]);
        }

        $products = InventoryProduct::query()
            ->with('unit:id,abbreviation')
            ->whereIn('id', $mappingsByLine->pluck('product_id')->map(fn ($id): int => (int) $id))
            ->where('is_active', true)
            ->whereIn('type', ['storable', 'consumable'])
            ->get()
            ->keyBy('id');
        $mappedLines = [];
        foreach ($requisition->lines as $index => $line) {
            $mapping = $mappingsByLine->get((int) $line->id);
            $product = $mapping ? $products->get((int) $mapping['product_id']) : null;
            if (! $product) {
                throw ValidationException::withMessages([
                    "lines.{$index}.product_id" => __('Select an active inventory product for this line.'),
                ]);
            }
            if (mb_strtolower(trim((string) $product->unit?->abbreviation)) !== mb_strtolower(trim($line->unit))) {
                throw ValidationException::withMessages([
                    "lines.{$index}.product_id" => __('The inventory product unit must match the requisition line unit.'),
                ]);
            }
            $mappedLines[] = ['line' => $line, 'product' => $product, 'mapping' => $mapping];
        }

        return $mappedLines;
    }

    private function postRequisitionIssueMovement(
        Company $company,
        User $actor,
        int $productId,
        int $sourceLocationId,
        int $destinationLocationId,
        string $quantity,
        ?string $lotCode,
        string $reference,
        int $lineIndex,
    ): void {
        try {
            app(InventoryStockService::class)->postMovement($company, $actor, [
                'operation' => 'issue',
                'product_id' => $productId,
                'from_location_id' => $sourceLocationId,
                'to_location_id' => $destinationLocationId,
                'quantity' => $quantity,
                'lot_code' => $lotCode,
                'reference' => $reference,
            ]);
        } catch (ValidationException $exception) {
            $errors = [];
            foreach ($exception->errors() as $key => $messages) {
                $field = $key === 'lot_code' ? 'lot_code' : 'quantity';
                $errors["lines.{$lineIndex}.{$field}"] = $messages;
            }
            throw ValidationException::withMessages($errors);
        }
    }
}
