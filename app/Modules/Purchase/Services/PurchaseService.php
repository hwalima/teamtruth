<?php

namespace App\Modules\Purchase\Services;

use App\Models\Currency;
use App\Models\User;
use App\Modules\Accounting\Models\AccountingAccount;
use App\Modules\Accounting\Models\AccountingJournal;
use App\Modules\Accounting\Services\AccountingPostingService;
use App\Modules\Core\Models\ApprovalWorkflow;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\ApprovalWorkflowService;
use App\Modules\Core\Services\AuditLogService;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\ExchangeRateService;
use App\Modules\Core\Services\SequenceService;
use App\Modules\Inventory\Models\InventoryProduct;
use App\Modules\Inventory\Models\StockLocation;
use App\Modules\Inventory\Services\InventoryStockService;
use App\Modules\Purchase\Models\PurchaseBill;
use App\Modules\Purchase\Models\PurchaseBillLine;
use App\Modules\Purchase\Models\PurchaseBlanketOrder;
use App\Modules\Purchase\Models\PurchaseBlanketOrderLine;
use App\Modules\Purchase\Models\PurchaseLandedCost;
use App\Modules\Purchase\Models\PurchaseLandedCostLine;
use App\Modules\Purchase\Models\PurchaseOrder;
use App\Modules\Purchase\Models\PurchaseOrderLine;
use App\Modules\Purchase\Models\PurchasePayment;
use App\Modules\Purchase\Models\PurchasePaymentAllocation;
use App\Modules\Purchase\Models\PurchaseQuotation;
use App\Modules\Purchase\Models\PurchaseReceipt;
use App\Modules\Purchase\Models\PurchaseReceiptLine;
use App\Modules\Purchase\Models\PurchaseReturn;
use App\Modules\Purchase\Models\PurchaseReturnLine;
use App\Modules\Purchase\Models\PurchaseRFQ;
use App\Modules\Purchase\Models\PurchaseRFQLine;
use App\Modules\Purchase\Models\PurchaseVendor;
use App\Modules\Purchase\Models\PurchaseVendorEvaluation;
use App\Modules\Purchase\Models\PurchaseVendorPriceList;
use App\Modules\Requisitions\Enums\RequisitionStatus;
use App\Modules\Requisitions\Models\Requisition;
use Carbon\CarbonImmutable;
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

    /**
     * Create a vendor bill from a purchase order and its receipts.
     * Performs three-way match validation: PO quantities/prices vs Receipt vs Bill.
     */
    public function createBillFromOrderAndReceipt(
        PurchaseOrder $order,
        PurchaseReceipt $receipt,
        User $actor,
        array $data,
        array $lines,
    ): PurchaseBill {
        $company = app(CompanyContext::class)->requireActiveCompany();

        return DB::transaction(function () use ($company, $order, $receipt, $actor, $data, $lines): PurchaseBill {
            $order = PurchaseOrder::query()->lockForUpdate()->with('lines.product', 'vendor')->findOrFail($order->id);
            $receipt = PurchaseReceipt::query()->lockForUpdate()->with('lines.purchaseOrderLine')->findOrFail($receipt->id);

            abort_unless((int) $order->company_id === (int) $company->id, 404);
            abort_unless((int) $receipt->company_id === (int) $company->id, 404);
            abort_unless((int) $receipt->purchase_order_id === (int) $order->id, 404);

            if (! in_array($order->status, ['approved', 'partially_received', 'received'], true)) {
                throw ValidationException::withMessages(['purchase_order' => __('Only approved or received purchase orders can be billed.')]);
            }

            // Check if a bill already exists for this receipt
            if (PurchaseBill::query()->where('purchase_receipt_id', $receipt->id)->where('status', '!=', 'cancelled')->exists()) {
                throw ValidationException::withMessages(['purchase_receipt' => __('A bill already exists for this receipt.')]);
            }

            // Validate three-way match
            $this->validateThreeWayMatch($order, $receipt, $lines);

            $currencyCode = strtoupper($data['currency_code'] ?? $order->currency_code);
            $exchangeRate = $currencyCode === strtoupper($company->default_currency)
                ? '1.0000000000'
                : app(ExchangeRateService::class)
                    ->rateFor($currencyCode, $company->default_currency, $data['bill_date'] ?? now())
                    ?->rate;

            if ($exchangeRate === null && $currencyCode !== strtoupper($company->default_currency)) {
                throw ValidationException::withMessages([
                    'currency_code' => __('No exchange rate is recorded for :currency to :base on or before the bill date.', [
                        'currency' => $currencyCode,
                        'base' => $company->default_currency,
                    ]),
                ]);
            }

            // Calculate totals
            $untaxedTotal = '0.0000';
            $taxTotal = '0.0000';
            $billLines = [];

            foreach ($lines as $index => $line) {
                $quantity = (string) $line['quantity'];
                $unitPrice = (string) $line['unit_price'];
                $taxRate = (string) ($line['tax_rate'] ?? '0');
                $lineTotal = self::multiplyDecimals($quantity, $unitPrice);
                $taxAmount = self::multiplyDecimals($lineTotal, self::divideBy100($taxRate));
                $lineTotalWithTax = self::addDecimals($lineTotal, $taxAmount);

                $untaxedTotal = self::addDecimals($untaxedTotal, $lineTotal);
                $taxTotal = self::addDecimals($taxTotal, $taxAmount);

                $billLines[] = [
                    'company_id' => $company->id,
                    'purchase_order_line_id' => $line['purchase_order_line_id'],
                    'product_id' => $line['product_id'] ?? null,
                    'name' => $line['name'],
                    'account_code' => $line['account_code'] ?? null,
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                    'tax_rate' => $taxRate,
                    'tax_amount' => $taxAmount,
                    'line_total' => $lineTotalWithTax,
                    'sort_order' => $index + 1,
                ];
            }

            $totalAmount = self::addDecimals($untaxedTotal, $taxTotal);

            $bill = PurchaseBill::query()->create([
                'company_id' => $company->id,
                'document_number' => app(SequenceService::class)->next($company, 'purchase_bill'),
                'vendor_id' => $order->vendor_id,
                'purchase_order_id' => $order->id,
                'purchase_receipt_id' => $receipt->id,
                'vendor_reference' => $data['vendor_reference'] ?? null,
                'status' => 'draft',
                'currency_code' => $currencyCode,
                'exchange_rate' => $exchangeRate ?? '1.0000000000',
                'untaxed_amount' => $untaxedTotal,
                'tax_amount' => $taxTotal,
                'total_amount' => $totalAmount,
                'amount_paid' => '0.0000',
                'amount_residual' => $totalAmount,
                'bill_date' => $data['bill_date'] ?? now()->toDateString(),
                'due_date' => $data['due_date'] ?? null,
                'journal_id' => $data['journal_id'] ?? null,
                'account_id' => $data['account_id'] ?? null,
                'created_by' => $actor->id,
            ]);

            $bill->lines()->createMany($billLines);

            app(AuditLogService::class)->record(
                $company,
                'purchase.bill.created',
                $bill,
                changes: ['after' => [
                    'document_number' => $bill->document_number,
                    'purchase_order_id' => $order->id,
                    'purchase_receipt_id' => $receipt->id,
                    'total_amount' => $totalAmount,
                ]],
                actor: $actor,
            );

            return $bill->load('lines');
        });
    }

    /**
     * Validates three-way match between PO, Receipt, and Bill lines.
     */
    private function validateThreeWayMatch(
        PurchaseOrder $order,
        PurchaseReceipt $receipt,
        array $billLines,
    ): void {
        $orderLines = $order->lines->keyBy('id');
        $receiptLines = $receipt->lines->keyBy('purchase_order_line_id');

        foreach ($billLines as $index => $billLine) {
            $poLineId = $billLine['purchase_order_line_id'];
            $quantity = (string) $billLine['quantity'];
            $unitPrice = (string) $billLine['unit_price'];

            if (! $orderLines->has($poLineId)) {
                throw ValidationException::withMessages([
                    "lines.{$index}.purchase_order_line_id" => __('Selected purchase order line does not belong to this order.'),
                ]);
            }

            $orderLine = $orderLines->get($poLineId);
            $receiptLine = $receiptLines->get($poLineId);

            if (! $receiptLine) {
                throw ValidationException::withMessages([
                    "lines.{$index}.purchase_order_line_id" => __('This purchase order line has not been received yet.'),
                ]);
            }

            // Check quantity: billed ≤ received
            $receivedQty = (string) $receiptLine->quantity;
            if (self::compareDecimals($quantity, $receivedQty) > 0) {
                throw ValidationException::withMessages([
                    "lines.{$index}.quantity" => __('Billed quantity (:quantity) exceeds received quantity (:received).', [
                        'quantity' => $quantity,
                        'received' => $receivedQty,
                    ]),
                ]);
            }

            // Check price: bill unit price should match PO unit price (with tolerance)
            $poUnitPrice = (string) $orderLine->unit_price;
            $tolerance = $this->getPriceTolerance($order->company_id);
            if (! $this->isPriceWithinTolerance($unitPrice, $poUnitPrice, $tolerance)) {
                throw ValidationException::withMessages([
                    "lines.{$index}.unit_price" => __('Bill unit price (:bill) deviates from PO unit price (:po) by more than the allowed tolerance (:tolerance%).', [
                        'bill' => $unitPrice,
                        'po' => $poUnitPrice,
                        'tolerance' => $tolerance,
                    ]),
                ]);
            }
        }
    }

    /**
     * Get price tolerance percentage for a company (configurable, default 5%).
     */
    private function getPriceTolerance(int $companyId): float
    {
        // Could be stored in company settings; default to 5%
        return 5.0;
    }

    /**
     * Check if bill price is within tolerance of PO price.
     */
    private function isPriceWithinTolerance(string $billPrice, string $poPrice, float $tolerancePercent): bool
    {
        $bill = (float) $billPrice;
        $po = (float) $poPrice;

        if ($po === 0.0) {
            return $bill === 0.0;
        }

        $deviation = abs($bill - $po) / $po * 100;

        return $deviation <= $tolerancePercent;
    }

    /**
     * Submit a draft bill for approval via the approval workflow.
     */
    public function submitBillForApproval(PurchaseBill $bill, User $actor): PurchaseBill {
        $company = app(CompanyContext::class)->requireActiveCompany();

        return DB::transaction(function () use ($company, $bill, $actor): PurchaseBill {
            $bill = PurchaseBill::query()->lockForUpdate()->findOrFail($bill->id);
            abort_unless((int) $bill->company_id === (int) $company->id, 404);

            if ($bill->status !== 'draft') {
                throw ValidationException::withMessages(['bill' => __('Only draft bills can be submitted for approval.')]);
            }

            if (! ApprovalWorkflow::query()->where('approvable_type', PurchaseBill::class)->where('is_active', true)->exists()) {
                throw ValidationException::withMessages(['approval' => __('Configure an active vendor bill approval workflow before submitting.')]);
            }

            try {
                app(ApprovalWorkflowService::class)->submit(
                    $bill,
                    $actor,
                    (string) $bill->total_amount,
                    $bill->currency_code,
                    ['document_type' => 'vendor_bill', 'vendor_id' => $bill->vendor_id],
                );
            } catch (LogicException $exception) {
                throw ValidationException::withMessages(['approval' => __($exception->getMessage())]);
            }

            $bill->status = 'pending_approval';
            $bill->save();

            app(AuditLogService::class)->record(
                $company,
                'purchase.bill.submitted',
                $bill,
                changes: ['after' => ['document_number' => $bill->document_number, 'status' => 'pending_approval']],
                actor: $actor,
            );

            return $bill->fresh();
        });
    }

    /**
     * Post an approved bill to accounting (creates journal entry).
     */
    public function postBill(PurchaseBill $bill, User $actor): PurchaseBill {
        $company = app(CompanyContext::class)->requireActiveCompany();

        return DB::transaction(function () use ($company, $bill, $actor): PurchaseBill {
            $bill = PurchaseBill::query()->lockForUpdate()->with(['lines', 'vendor', 'purchaseOrder'])->findOrFail($bill->id);
            abort_unless((int) $bill->company_id === (int) $company->id, 404);

            if ($bill->status !== 'approved') {
                throw ValidationException::withMessages(['bill' => __('Only approved bills can be posted to accounting.')]);
            }

            if ($bill->posted_at !== null) {
                throw ValidationException::withMessages(['bill' => __('This bill has already been posted.')]);
            }

            // Determine the payable account (from vendor or company default)
            $payableAccount = $this->resolvePayableAccount($bill);
            $journal = $this->resolvePurchaseJournal($bill);

            // Create journal entry lines
            $entryLines = [];
            $sortOrder = 1;

            // Credit: Accounts Payable
            $entryLines[] = [
                'account_id' => $payableAccount->id,
                'description' => 'Vendor bill: ' . $bill->document_number . ' - ' . $bill->vendor->name,
                'currency_debit' => '0.0000',
                'currency_credit' => (string) $bill->total_amount,
                'sort_order' => $sortOrder++,
            ];

            // Debit: Expense/Inventory accounts per line
            foreach ($bill->lines as $line) {
                $expenseAccount = $this->resolveExpenseAccount($line, $bill->purchaseOrder);
                if (! $expenseAccount) {
                    throw ValidationException::withMessages([
                        'account' => __('No expense account configured for bill line: :name', ['name' => $line->name]),
                    ]);
                }

                $entryLines[] = [
                    'account_id' => $expenseAccount->id,
                    'description' => $line->name,
                    'currency_debit' => (string) $line->line_total,
                    'currency_credit' => '0.0000',
                    'sort_order' => $sortOrder++,
                ];
            }

            // Post the journal entry
            $entry = app(AccountingPostingService::class)->postManualEntry($actor, [
                'journal_id' => $journal->id,
                'entry_date' => $bill->bill_date,
                'currency_code' => $bill->currency_code,
                'description' => 'Vendor bill: ' . $bill->document_number,
                'reference' => $bill->document_number,
            ], $entryLines);

            // Update bill with posting info
            $bill->journal_id = $entry->journal_id;
            $bill->account_id = $payableAccount->id;
            $bill->posted_by = $actor->id;
            $bill->posted_at = now();
            $bill->save();

            app(AuditLogService::class)->record(
                $company,
                'purchase.bill.posted',
                $bill,
                changes: ['after' => [
                    'document_number' => $bill->document_number,
                    'journal_entry_id' => $entry->id,
                    'journal_entry_number' => $entry->document_number,
                ]],
                actor: $actor,
            );

            return $bill->fresh();
        });
    }

    /**
     * Resolve the accounts payable account for a bill.
     */
    private function resolvePayableAccount(PurchaseBill $bill): AccountingAccount
    {
        // Check vendor for specific payable account
        if ($bill->vendor->account_id) {
            return $bill->vendor->account;
        }

        // Fall back to company default payable account
        $account = AccountingAccount::query()
            ->where('company_id', $bill->company_id)
            ->where('code', 'LIKE', '2%') // Liabilities typically start with 2
            ->where('name', 'LIKE', '%payable%')
            ->where('is_active', true)
            ->where('is_group', false)
            ->first();

        if (! $account) {
            throw new RuntimeException('No accounts payable account configured for this company.');
        }

        return $account;
    }

    /**
     * Resolve the purchase journal for a bill.
     */
    private function resolvePurchaseJournal(PurchaseBill $bill): AccountingJournal
    {
        $journal = AccountingJournal::query()
            ->where('company_id', $bill->company_id)
            ->where('type', 'purchase')
            ->where('is_active', true)
            ->first();

        if (! $journal) {
            throw new RuntimeException('No active purchase journal configured for this company.');
        }

        return $journal;
    }

    /**
     * Resolve expense/inventory account for a bill line.
     */
    private function resolveExpenseAccount(PurchaseBillLine $line, ?PurchaseOrder $order): ?AccountingAccount
    {
        // If line has account_code, use that
        if ($line->account_code) {
            return AccountingAccount::query()
                ->where('company_id', $line->company_id)
                ->where('code', $line->account_code)
                ->where('is_active', true)
                ->where('is_group', false)
                ->first();
        }

        // If linked to PO line with product, use product's expense account
        if ($line->purchase_order_line_id && $order) {
            $poLine = $order->lines()->where('id', $line->purchase_order_line_id)->with('product')->first();
            if ($poLine && $poLine->product) {
                // Check product category for default expense account
                // This would need to be implemented based on your chart of accounts structure
            }
        }

        return null;
    }

    /**
     * Create a vendor payment.
     */
    public function createPayment(User $actor, array $data, array $allocations): PurchasePayment
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        return DB::transaction(function () use ($company, $actor, $data, $allocations): PurchasePayment {
            $currencyCode = strtoupper($data['currency_code']);
            $exchangeRate = $currencyCode === strtoupper($company->default_currency)
                ? '1.0000000000'
                : app(ExchangeRateService::class)
                    ->rateFor($currencyCode, $company->default_currency, $data['payment_date'])
                    ?->rate;

            if ($exchangeRate === null && $currencyCode !== strtoupper($company->default_currency)) {
                throw ValidationException::withMessages([
                    'currency_code' => __('No exchange rate for :currency on payment date.', ['currency' => $currencyCode]),
                ]);
            }

            $payment = PurchasePayment::query()->create([
                'company_id' => $company->id,
                'document_number' => app(SequenceService::class)->next($company, 'purchase_payment'),
                'vendor_id' => $data['vendor_id'],
                'journal_id' => $data['journal_id'],
                'payment_method' => $data['payment_method'],
                'currency_code' => $currencyCode,
                'exchange_rate' => $exchangeRate ?? '1.0000000000',
                'amount' => $data['amount'],
                'payment_date' => $data['payment_date'],
                'reference' => $data['reference'] ?? null,
                'status' => 'draft',
                'created_by' => $actor->id,
            ]);

            $totalAllocated = '0.0000';
            foreach ($allocations as $index => $allocation) {
                $amount = (string) $allocation['amount'];
                $totalAllocated = self::addDecimals($totalAllocated, $amount);

                PurchasePaymentAllocation::query()->create([
                    'company_id' => $company->id,
                    'purchase_payment_id' => $payment->id,
                    'purchase_bill_id' => $allocation['purchase_bill_id'],
                    'amount' => $amount,
                    'exchange_rate_gain_loss' => $allocation['exchange_rate_gain_loss'] ?? '0.0000',
                ]);
            }

            if (self::compareDecimals($totalAllocated, (string) $data['amount']) !== 0) {
                throw ValidationException::withMessages(['allocations' => __('Total allocated amount must equal payment amount.')]);
            }

            app(AuditLogService::class)->record(
                $company,
                'purchase.payment.created',
                $payment,
                changes: ['after' => ['document_number' => $payment->document_number, 'amount' => $data['amount']]],
                actor: $actor,
            );

            return $payment->load('allocations.purchaseBill');
        });
    }

    /**
     * Post a payment to accounting.
     */
    public function postPayment(PurchasePayment $payment, User $actor): PurchasePayment
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        return DB::transaction(function () use ($company, $payment, $actor): PurchasePayment {
            $payment = PurchasePayment::query()->lockForUpdate()->with(['allocations.purchaseBill', 'vendor'])->findOrFail($payment->id);
            abort_unless((int) $payment->company_id === (int) $company->id, 404);

            if ($payment->status !== 'draft') {
                throw ValidationException::withMessages(['payment' => __('Only draft payments can be posted.')]);
            }

            $journal = AccountingJournal::query()->findOrFail($payment->journal_id);
            $payableAccount = $this->resolvePayableAccountForVendor($payment->vendor, $company);
            $bankAccount = $this->resolveBankAccount($journal, $payment->currency_code);

            $entryLines = [];

            // Debit: Accounts Payable (reduce liability)
            $entryLines[] = [
                'account_id' => $payableAccount->id,
                'description' => 'Payment: ' . $payment->document_number . ' - ' . $payment->vendor->name,
                'currency_debit' => (string) $payment->amount,
                'currency_credit' => '0.0000',
                'sort_order' => 1,
            ];

            // Credit: Bank/Cash account
            $entryLines[] = [
                'account_id' => $bankAccount->id,
                'description' => 'Payment: ' . $payment->document_number,
                'currency_debit' => '0.0000',
                'currency_credit' => (string) $payment->amount,
                'sort_order' => 2,
            ];

            // Exchange rate gain/loss if applicable
            if ($payment->currency_code !== strtoupper($company->default_currency)) {
                $gainLoss = $payment->allocations->sum('exchange_rate_gain_loss');
                if (self::compareDecimals((string) $gainLoss, '0.0000') !== 0) {
                    $gainLossAccount = $this->resolveExchangeGainLossAccount($company, $gainLoss);
                    $entryLines[] = [
                        'account_id' => $gainLossAccount->id,
                        'description' => 'Exchange rate ' . ($gainLoss > 0 ? 'gain' : 'loss') . ' on payment ' . $payment->document_number,
                        'currency_debit' => $gainLoss > 0 ? '0.0000' : (string) abs($gainLoss),
                        'currency_credit' => $gainLoss > 0 ? (string) $gainLoss : '0.0000',
                        'sort_order' => 3,
                    ];
                }
            }

            $entry = app(AccountingPostingService::class)->postManualEntry($actor, [
                'journal_id' => $journal->id,
                'entry_date' => $payment->payment_date,
                'currency_code' => $payment->currency_code,
                'description' => 'Vendor payment: ' . $payment->document_number,
                'reference' => $payment->document_number,
            ], $entryLines);

            // Update bill residuals
            foreach ($payment->allocations as $allocation) {
                $bill = $allocation->purchaseBill;
                $bill->amount_paid = self::addDecimals((string) $bill->amount_paid, (string) $allocation->amount);
                $bill->amount_residual = self::subtractDecimals((string) $bill->total_amount, (string) $bill->amount_paid);
                $bill->save();
            }

            $payment->status = 'posted';
            $payment->posted_by = $actor->id;
            $payment->posted_at = now();
            $payment->save();

            app(AuditLogService::class)->record(
                $company,
                'purchase.payment.posted',
                $payment,
                changes: ['after' => [
                    'document_number' => $payment->document_number,
                    'journal_entry_id' => $entry->id,
                ]],
                actor: $actor,
            );

            return $payment->fresh();
        });
    }

    private function resolvePayableAccountForVendor(PurchaseVendor $vendor, Company $company): AccountingAccount
    {
        if ($vendor->account_id) {
            return $vendor->account;
        }

        return AccountingAccount::query()
            ->where('company_id', $company->id)
            ->where('code', 'LIKE', '2%')
            ->where('name', 'LIKE', '%payable%')
            ->where('is_active', true)
            ->where('is_group', false)
            ->firstOrFail();
    }

    private function resolveBankAccount(AccountingJournal $journal, string $currencyCode): AccountingAccount
    {
        // Try to find a bank account matching the journal and currency
        $account = AccountingAccount::query()
            ->where('company_id', $journal->company_id)
            ->where('journal_id', $journal->id)
            ->where('currency_code', $currencyCode)
            ->where('is_active', true)
            ->where('is_group', false)
            ->first();

        if ($account) {
            return $account;
        }

        // Fallback to any bank account in the journal
        return AccountingAccount::query()
            ->where('company_id', $journal->company_id)
            ->where('journal_id', $journal->id)
            ->where('is_active', true)
            ->where('is_group', false)
            ->firstOrFail();
    }

    private function resolveExchangeGainLossAccount(Company $company, float $gainLoss): AccountingAccount
    {
        $code = $gainLoss > 0 ? '7%' : '6%'; // Revenue for gain, expense for loss
        return AccountingAccount::query()
            ->where('company_id', $company->id)
            ->where('code', 'LIKE', $code)
            ->where('name', 'LIKE', '%exchange%')
            ->where('is_active', true)
            ->where('is_group', false)
            ->firstOrFail();
    }

    private static function divideBy100(string $value): string
    {
        // Simple division by 100 for tax rate (e.g., 15% -> 0.15)
        [$whole, $fraction] = array_pad(explode('.', $value, 2), 2, '');
        $digits = ltrim($whole . str_pad($fraction, 4, '0'), '0') ?: '0';
        $padded = str_pad($digits, 6, '0', STR_PAD_LEFT);
        return substr($padded, 0, -2) . '.' . substr($padded, -2);
    }
}
