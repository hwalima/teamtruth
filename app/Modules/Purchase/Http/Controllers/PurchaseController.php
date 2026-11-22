<?php

namespace App\Modules\Purchase\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Currency;
use App\Modules\Accounting\Models\AccountingAccount;
use App\Modules\Accounting\Models\AccountingJournal;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\AuditLogService;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\ErpRoleService;
use App\Modules\Inventory\Models\InventoryProduct;
use App\Modules\Inventory\Models\StockLocation;
use App\Modules\Purchase\Models\PurchaseBill;
use App\Modules\Purchase\Models\PurchaseBillLine;
use App\Modules\Purchase\Models\PurchaseBlanketOrder;
use App\Modules\Purchase\Models\PurchaseLandedCost;
use App\Modules\Purchase\Models\PurchaseReturn;
use App\Modules\Purchase\Models\PurchaseVendorEvaluation;
use App\Modules\Purchase\Models\PurchaseVendorPriceList;
use App\Modules\Purchase\Models\PurchaseOrder;
use App\Modules\Purchase\Models\PurchaseOrderLine;
use App\Modules\Purchase\Models\PurchasePayment;
use App\Modules\Purchase\Models\PurchaseQuotation;
use App\Modules\Purchase\Models\PurchaseReceipt;
use App\Modules\Purchase\Models\PurchaseRFQ;
use App\Modules\Purchase\Models\PurchaseVendor;
use App\Modules\Purchase\Services\PurchaseService;
use App\Modules\Requisitions\Enums\RequisitionStatus;
use App\Modules\Requisitions\Models\Requisition;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class PurchaseController extends Controller
{
    public function index(Request $request): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeAccess($request, $company);

        return Inertia::render('Erp/Purchase/Index', [
            'company' => $company->only(['id', 'code', 'name', 'default_currency']),
            'vendors' => PurchaseVendor::query()->where('is_active', true)->orderBy('name')->get(),
            'nextVendorCode' => PurchaseVendor::nextCode(),
            'products' => InventoryProduct::query()
                ->with('unit:id,name,abbreviation')
                ->where('is_active', true)
                ->whereIn('type', ['storable', 'consumable'])
                ->orderBy('name')
                ->get(['id', 'sku', 'name', 'type', 'tracking', 'unit_id']),
            'currencies' => Currency::query()->orderBy('code')->get(['code', 'name']),
            'supplierLocations' => StockLocation::query()
                ->with('warehouse:id,code,name')
                ->where('is_active', true)
                ->where('usage', 'supplier')
                ->orderBy('warehouse_id')
                ->orderBy('name')
                ->get(),
            'internalLocations' => StockLocation::query()
                ->with('warehouse:id,code,name')
                ->where('is_active', true)
                ->where('usage', 'internal')
                ->orderBy('warehouse_id')
                ->orderBy('name')
                ->get(),
            'departmentLocations' => StockLocation::query()
                ->with('warehouse:id,code,name')
                ->where('is_active', true)
                ->where('usage', 'department')
                ->orderBy('warehouse_id')
                ->orderBy('name')
                ->get(),
            'rfqs' => PurchaseRFQ::query()
                ->with([
                    'sourceRequisition:id,document_number',
                    'lines.product:id,sku,name,unit_id',
                    'lines.product.unit:id,abbreviation',
                    'quotations.vendor:id,name,code',
                ])
                ->latest()
                ->limit(100)
                ->get(),
            'approvedRequisitions' => Requisition::query()
                ->with('lines:id,requisition_id,item,description,quantity,unit')
                ->where('requisition_type', 'purchase')
                ->where('status', RequisitionStatus::Approved->value)
                ->whereNotExists(function ($query) {
                    $query->selectRaw('1')
                        ->from('purchase_rfqs')
                        ->whereColumn('purchase_rfqs.source_requisition_id', 'requisitions.id')
                        ->whereColumn('purchase_rfqs.company_id', 'requisitions.company_id');
                })
                ->latest()
                ->limit(100)
                ->get(['id', 'document_number', 'department', 'currency_code', 'estimated_total'])
                ->map(fn (Requisition $requisition): array => [
                    ...$requisition->only(['id', 'document_number', 'department', 'currency_code', 'estimated_total']),
                    'lines' => $requisition->lines->map(fn ($line): array => $line->only([
                        'id', 'item', 'description', 'quantity', 'unit',
                    ])),
                ]),
            'approvedStoreIssueRequisitions' => Requisition::query()
                ->with('lines:id,requisition_id,item,description,quantity,unit')
                ->where('requisition_type', 'store_issue')
                ->where('status', RequisitionStatus::Approved->value)
                ->latest()
                ->limit(100)
                ->get(['id', 'document_number', 'department'])
                ->map(fn (Requisition $requisition): array => [
                    ...$requisition->only(['id', 'document_number', 'department']),
                    'lines' => $requisition->lines->map(fn ($line): array => $line->only([
                        'id', 'item', 'description', 'quantity', 'unit',
                    ])),
                ]),
            'orders' => PurchaseOrder::query()
                ->with([
                    'vendor:id,name,code',
                    'sourceRequisition:id,document_number',
                    'lines.product:id,sku,name,unit_id,tracking',
                    'lines.product.unit:id,abbreviation',
                    'receipts.lines.purchaseOrderLine',
                ])
                ->latest()
                ->limit(100)
                ->get(),
            'bills' => PurchaseBill::query()
                ->with(['vendor:id,name,code', 'purchaseOrder:id,document_number', 'lines'])
                ->where('company_id', $company->id)
                ->latest()
                ->limit(100)
                ->get(),
            'payments' => PurchasePayment::query()
                ->with(['vendor:id,name,code', 'allocations.purchaseBill:id,document_number'])
                ->where('company_id', $company->id)
                ->latest()
                ->limit(100)
                ->get(),
            'blanketOrders' => PurchaseBlanketOrder::query()->with(['vendor:id,name,code', 'lines.product:id,sku,name,unit_id', 'lines.product.unit:id,abbreviation'])->latest()->limit(100)->get(),
            'landedCosts' => PurchaseLandedCost::query()->with(['vendor:id,name,code', 'purchaseReceipt:id,document_number', 'lines'])->latest()->limit(100)->get(),
            'returns' => PurchaseReturn::query()->with(['purchaseReceipt:id,document_number', 'lines.purchaseReceiptLine'])->latest()->limit(100)->get(),
            'vendorEvaluations' => PurchaseVendorEvaluation::query()->with('vendor:id,name,code')->latest('period_year')->latest('period_month')->limit(100)->get(),
            'vendorPriceLists' => PurchaseVendorPriceList::query()->with(['vendor:id,name,code', 'product:id,sku,name,unit_id', 'product.unit:id,abbreviation'])->orderByDesc('valid_from')->limit(200)->get(),
            'receipts' => PurchaseReceipt::query()->with(['purchaseOrder:id,vendor_id', 'lines.purchaseOrderLine.product.unit', 'lines.stockMove.lines'])->latest('received_at')->limit(100)->get(),
            'locations' => StockLocation::query()->where('is_active', true)->whereIn('usage', ['internal', 'supplier'])->orderBy('name')->get(),
        ]);
    }

    public function convertRequisitionToRfq(
        Request $request,
        Requisition $requisition,
        PurchaseService $service,
    ): RedirectResponse {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);
        $validated = $request->validate([
            'lines' => ['required', 'array', 'min:1', 'max:50'],
            'lines.*.requisition_line_id' => [
                'required',
                'integer',
                Rule::exists('requisition_lines', 'id')
                    ->where('company_id', $company->id)
                    ->where('requisition_id', $requisition->id),
            ],
            'lines.*.product_id' => [
                'required',
                'integer',
                Rule::exists('inventory_products', 'id')
                    ->where('company_id', $company->id)
                    ->where('is_active', true)
                    ->whereIn('type', ['storable', 'consumable']),
            ],
        ]);
        if (collect($validated['lines'])->pluck('requisition_line_id')->unique()->count() !== count($validated['lines'])) {
            return back()->withErrors(['lines' => __('Each requisition line can only be mapped once.')]);
        }

        $rfq = $service->createRfqFromApprovedRequisition($requisition, $request->user(), $validated['lines']);

        return back()->with('success', __('Requisition converted to request for quotation :number.', [
            'number' => $rfq->document_number,
        ]));
    }

    public function issueStoreRequisition(
        Request $request,
        Requisition $requisition,
        PurchaseService $service,
    ): RedirectResponse {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);
        $validated = $request->validate([
            'source_location_id' => [
                'required',
                'integer',
                Rule::exists('stock_locations', 'id')
                    ->where('company_id', $company->id)
                    ->where('usage', 'internal')
                    ->where('is_active', true),
            ],
            'destination_location_id' => [
                'required',
                'integer',
                Rule::exists('stock_locations', 'id')
                    ->where('company_id', $company->id)
                    ->where('usage', 'department')
                    ->where('is_active', true),
            ],
            'lines' => ['required', 'array', 'min:1', 'max:50'],
            'lines.*.requisition_line_id' => [
                'required',
                'integer',
                Rule::exists('requisition_lines', 'id')
                    ->where('company_id', $company->id)
                    ->where('requisition_id', $requisition->id),
            ],
            'lines.*.product_id' => [
                'required',
                'integer',
                Rule::exists('inventory_products', 'id')
                    ->where('company_id', $company->id)
                    ->where('is_active', true)
                    ->whereIn('type', ['storable', 'consumable']),
            ],
            'lines.*.lot_code' => ['nullable', 'string', 'max:120'],
            'lines.*.serial_codes' => ['nullable', 'string', 'max:6000'],
        ]);
        if (collect($validated['lines'])->pluck('requisition_line_id')->unique()->count() !== count($validated['lines'])) {
            return back()->withErrors(['lines' => __('Each requisition line can only be mapped once.')]);
        }
        $validated['lines'] = array_map(
            fn (array $line): array => [
                ...$line,
                'serial_codes' => array_values(array_filter(
                    array_map('trim', explode(',', (string) ($line['serial_codes'] ?? ''))),
                    fn (string $serial): bool => $serial !== '',
                )),
            ],
            $validated['lines'],
        );

        $service->issueApprovedStoreRequisition(
            $requisition,
            $request->user(),
            $validated['lines'],
            (int) $validated['source_location_id'],
            (int) $validated['destination_location_id'],
        );

        return back()->with('success', __('Approved requisition :number issued to the selected department.', [
            'number' => $requisition->document_number,
        ]));
    }

    public function storeRfq(Request $request, PurchaseService $service): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);
        $validated = $request->validate([
            'currency_code' => ['required', 'string', 'size:3', Rule::exists('currencies', 'code')],
            'reference' => ['nullable', 'string', 'max:255'],
            'lines' => ['required', 'array', 'min:1', 'max:50'],
            'lines.*.product_id' => [
                'required',
                'integer',
                Rule::exists('inventory_products', 'id')
                    ->where('company_id', $company->id)
                    ->where('is_active', true)
                    ->whereIn('type', ['storable', 'consumable']),
            ],
            'lines.*.quantity' => ['required', 'numeric', 'gt:0', 'decimal:0,4', 'max:9999999999999999'],
        ]);

        $service->createRfq($request->user(), $validated, $validated['lines']);

        return back()->with('success', __('Request for quotation created.'));
    }

    public function storeQuotation(Request $request, PurchaseRFQ $rfq, PurchaseService $service): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);
        $validated = $request->validate([
            'vendor_id' => [
                'required',
                'integer',
                Rule::exists('purchase_vendors', 'id')->where('company_id', $company->id)->where('is_active', true),
            ],
            'vendor_reference' => ['nullable', 'string', 'max:120'],
            'lines' => ['required', 'array', 'min:1', 'max:50'],
            'lines.*.rfq_line_id' => [
                'required',
                'integer',
                Rule::exists('purchase_rfq_lines', 'id')
                    ->where('company_id', $company->id)
                    ->where('purchase_rfq_id', $rfq->id),
            ],
            'lines.*.unit_price' => ['required', 'numeric', 'min:0', 'decimal:0,4', 'max:9999999999999999'],
        ]);
        if (collect($validated['lines'])->pluck('rfq_line_id')->unique()->count() !== count($validated['lines'])) {
            return back()->withErrors(['lines' => __('Each RFQ line can only be priced once.')]);
        }
        $vendor = PurchaseVendor::query()->findOrFail($validated['vendor_id']);

        $service->createQuotation($rfq, $vendor, $request->user(), $validated, $validated['lines']);

        return back()->with('success', __('Vendor quotation recorded.'));
    }

    public function createOrder(PurchaseQuotation $quotation, Request $request, PurchaseService $service): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);
        $order = $service->createOrderFromQuotation($quotation, $request->user());

        return back()->with('success', __('Purchase order :number submitted for approval.', ['number' => $order->document_number]));
    }

    public function receive(
        Request $request,
        PurchaseOrder $order,
        PurchaseOrderLine $line,
        PurchaseService $service,
    ): RedirectResponse {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);
        abort_unless((int) $line->purchase_order_id === (int) $order->id, 404);
        $validated = $request->validate([
            'quantity' => ['required', 'numeric', 'gt:0', 'decimal:0,4', 'max:9999999999999999'],
            'source_location_id' => [
                'required',
                'integer',
                Rule::exists('stock_locations', 'id')->where('company_id', $company->id)->where('usage', 'supplier')->where('is_active', true),
            ],
            'destination_location_id' => [
                'required',
                'integer',
                Rule::exists('stock_locations', 'id')->where('company_id', $company->id)->where('usage', 'internal')->where('is_active', true),
            ],
            'lot_code' => ['nullable', 'string', 'max:120'],
        ]);

        $service->receiveOrderLine(
            $order,
            $line,
            $request->user(),
            (string) $validated['quantity'],
            (int) $validated['source_location_id'],
            (int) $validated['destination_location_id'],
            $validated['lot_code'] ?? null,
        );

        return back()->with('success', __('Goods received and stock recorded.'));
    }

    public function createBill(PurchaseOrder $order, PurchaseReceipt $receipt, Request $request): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);
        abort_unless((int) $receipt->purchase_order_id === (int) $order->id, 404);
        abort_unless((int) $order->company_id === (int) $company->id, 404);
        abort_unless((int) $receipt->company_id === (int) $company->id, 404);

        $order->load(['lines.product.unit', 'vendor']);
        $receipt->load('lines.purchaseOrderLine');

        return Inertia::render('Erp/Purchase/CreateBill', [
            'company' => $company->only(['id', 'code', 'name', 'default_currency']),
            'order' => $order,
            'receipt' => $receipt,
            'currencies' => Currency::query()->orderBy('code')->get(['code', 'name']),
            'journals' => AccountingJournal::query()
                ->where('company_id', $company->id)
                ->where('is_active', true)
                ->where('type', 'purchase')
                ->get(['id', 'code', 'name']),
            'accounts' => AccountingAccount::query()
                ->where('company_id', $company->id)
                ->where('is_active', true)
                ->where('is_group', false)
                ->get(['id', 'code', 'name', 'currency_code']),
        ]);
    }

    public function storeBill(Request $request, PurchaseOrder $order, PurchaseReceipt $receipt, PurchaseService $service): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);
        abort_unless((int) $receipt->purchase_order_id === (int) $order->id, 404);

        $validated = $request->validate([
            'currency_code' => ['required', 'string', 'size:3', Rule::exists('currencies', 'code')],
            'vendor_reference' => ['nullable', 'string', 'max:120'],
            'bill_date' => ['required', 'date'],
            'due_date' => ['nullable', 'date'],
            'journal_id' => ['nullable', 'integer', Rule::exists('accounting_journals', 'id')->where('company_id', $company->id)],
            'account_id' => ['nullable', 'integer', Rule::exists('accounting_accounts', 'id')->where('company_id', $company->id)],
            'lines' => ['required', 'array', 'min:1', 'max:100'],
            'lines.*.purchase_order_line_id' => [
                'required',
                'integer',
                Rule::exists('purchase_order_lines', 'id')->where('company_id', $company->id)->where('purchase_order_id', $order->id),
            ],
            'lines.*.product_id' => ['nullable', 'integer', Rule::exists('inventory_products', 'id')->where('company_id', $company->id)],
            'lines.*.name' => ['required', 'string', 'max:500'],
            'lines.*.account_code' => ['nullable', 'string', 'max:40'],
            'lines.*.quantity' => ['required', 'numeric', 'gt:0', 'decimal:0,4', 'max:9999999999999999'],
            'lines.*.unit_price' => ['required', 'numeric', 'min:0', 'decimal:0,4', 'max:9999999999999999'],
            'lines.*.tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100', 'decimal:0,2'],
        ]);

        $service->createBillFromOrderAndReceipt($order, $receipt, $request->user(), $validated, $validated['lines']);

        return back()->with('success', __('Vendor bill created from receipt.'));
    }

    public function submitBill(PurchaseBill $bill, Request $request, PurchaseService $service): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);
        abort_unless((int) $bill->company_id === (int) $company->id, 404);

        $service->submitBillForApproval($bill, $request->user());

        return back()->with('success', __('Vendor bill submitted for approval.'));
    }

    public function postBill(PurchaseBill $bill, Request $request, PurchaseService $service): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);
        abort_unless((int) $bill->company_id === (int) $company->id, 404);

        $service->postBill($bill, $request->user());

        return back()->with('success', __('Vendor bill posted to accounting.'));
    }

    public function storeBlanketOrder(Request $request, PurchaseService $service): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany(); $this->authorizeManagement($request, $company);
        $data = $request->validate([
            'vendor_id' => ['required', 'integer', Rule::exists('purchase_vendors', 'id')->where('company_id', $company->id)],
            'currency_code' => ['required', 'string', 'size:3', Rule::exists('currencies', 'code')],
            'max_amount' => ['required', 'numeric', 'gt:0', 'decimal:0,4'],
            'starts_on' => ['required', 'date'], 'ends_on' => ['required', 'date', 'after_or_equal:starts_on'],
            'lines' => ['required', 'array', 'min:1', 'max:50'],
            'lines.*.product_id' => ['required', 'integer', Rule::exists('inventory_products', 'id')->where('company_id', $company->id)->whereIn('type', ['storable', 'consumable'])],
            'lines.*.quantity' => ['required', 'numeric', 'gt:0', 'decimal:0,4'], 'lines.*.unit_price' => ['required', 'numeric', 'min:0', 'decimal:0,4'],
        ]);
        $service->createBlanketOrder($request->user(), $data, $data['lines']);
        return back()->with('success', __('Blanket order created.'));
    }

    public function createOrderFromBlanket(Request $request, PurchaseBlanketOrder $blanketOrder, PurchaseService $service): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany(); $this->authorizeManagement($request, $company);
        abort_unless((int) $blanketOrder->company_id === (int) $company->id, 404);
        $data = $request->validate([
            'lines' => ['required', 'array', 'min:1', 'max:50'],
            'lines.*.blanket_order_line_id' => ['required', 'integer', Rule::exists('purchase_blanket_order_lines', 'id')->where('company_id', $company->id)->where('purchase_blanket_order_id', $blanketOrder->id)],
            'lines.*.quantity' => ['required', 'numeric', 'gt:0', 'decimal:0,4'],
        ]);
        $service->createOrderFromBlanket($blanketOrder, $request->user(), $data['lines']);
        return back()->with('success', __('Purchase order submitted for approval.'));
    }

    public function storeLandedCost(Request $request, PurchaseService $service): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany(); $this->authorizeManagement($request, $company);
        $data = $request->validate([
            'purchase_receipt_id' => ['required', 'integer', Rule::exists('purchase_receipts', 'id')->where('company_id', $company->id)],
            'vendor_id' => ['nullable', 'integer', Rule::exists('purchase_vendors', 'id')->where('company_id', $company->id)],
            'currency_code' => ['required', 'string', 'size:3', Rule::exists('currencies', 'code')],
            'lines' => ['required', 'array', 'min:1', 'max:50'],
            'lines.*.product_id' => ['nullable', 'integer', Rule::exists('inventory_products', 'id')->where('company_id', $company->id)],
            'lines.*.account_id' => ['required', 'integer', Rule::exists('accounting_accounts', 'id')->where('company_id', $company->id)->where('is_active', true)->where('is_group', false)],
            'lines.*.name' => ['required', 'string', 'max:255'], 'lines.*.amount' => ['required', 'numeric', 'gt:0', 'decimal:0,4'],
            'lines.*.split_method' => ['required', Rule::in(['by_quantity', 'by_value', 'equally'])],
        ]);
        $service->createLandedCost($request->user(), $data, $data['lines']);
        return back()->with('success', __('Landed costs allocated across receipt lines.'));
    }

    public function storeReturn(Request $request, PurchaseService $service): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany(); $this->authorizeManagement($request, $company);
        $request->merge(['lines' => collect($request->input('lines', []))->filter(fn ($line) => isset($line['quantity']) && $line['quantity'] !== '')->values()->all()]);
        $data = $request->validate([
            'purchase_receipt_id' => ['required', 'integer', Rule::exists('purchase_receipts', 'id')->where('company_id', $company->id)],
            'source_location_id' => ['required', 'integer', Rule::exists('stock_locations', 'id')->where('company_id', $company->id)->where('usage', 'internal')->where('is_active', true)],
            'destination_location_id' => ['required', 'integer', Rule::exists('stock_locations', 'id')->where('company_id', $company->id)->where('usage', 'supplier')->where('is_active', true)],
            'return_date' => ['required', 'date'], 'reason' => ['required', 'string', 'max:2000'],
            'lines' => ['required', 'array', 'min:1', 'max:100'],
            'lines.*.purchase_receipt_line_id' => ['required', 'integer', Rule::exists('purchase_receipt_lines', 'id')->where('company_id', $company->id)],
            'lines.*.quantity' => ['required', 'numeric', 'gt:0', 'decimal:0,4'],
        ]);
        if (collect($data['lines'])->pluck('purchase_receipt_line_id')->unique()->count() !== count($data['lines'])) return back()->withErrors(['lines' => __('Each receipt line may appear only once.')]);
        $service->createPurchaseReturn($request->user(), $data, $data['lines']);
        return back()->with('success', __('Purchase return posted to inventory.'));
    }

    public function refreshVendorEvaluation(Request $request, PurchaseService $service): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany(); $this->authorizeManagement($request, $company);
        $data = $request->validate([
            'vendor_id' => ['required', 'integer', Rule::exists('purchase_vendors', 'id')->where('company_id', $company->id)],
            'year' => ['required', 'integer', 'min:2000', 'max:2100'], 'month' => ['required', 'integer', 'between:1,12'],
        ]);
        $service->refreshVendorEvaluation((int) $data['vendor_id'], (int) $data['year'], (int) $data['month'], $request->user());
        return back()->with('success', __('Vendor evaluation refreshed.'));
    }

    public function storeVendorPriceList(Request $request, PurchaseService $service): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany(); $this->authorizeManagement($request, $company);
        $data = $request->validate([
            'vendor_id' => ['required', 'integer', Rule::exists('purchase_vendors', 'id')->where('company_id', $company->id)],
            'product_id' => ['required', 'integer', Rule::exists('inventory_products', 'id')->where('company_id', $company->id)],
            'min_quantity' => ['required', 'numeric', 'gt:0', 'decimal:0,4'], 'price' => ['required', 'numeric', 'min:0', 'decimal:0,4'],
            'currency_code' => ['required', 'string', 'size:3', Rule::exists('currencies', 'code')],
            'valid_from' => ['required', 'date'], 'valid_to' => ['nullable', 'date', 'after_or_equal:valid_from'],
        ]);
        $service->saveVendorPriceList($request->user(), $data);
        return back()->with('success', __('Vendor price list saved.'));
    }

    public function createPayment(Request $request): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);

        return Inertia::render('Erp/Purchase/CreatePayment', [
            'company' => $company->only(['id', 'code', 'name', 'default_currency']),
            'vendors' => PurchaseVendor::query()->where('company_id', $company->id)->where('is_active', true)->orderBy('name')->get(),
            'bills' => PurchaseBill::query()
                ->where('company_id', $company->id)
                ->whereIn('status', ['approved', 'partially_paid'])
                ->where('amount_residual', '>', '0.0000')
                ->with('vendor:id,name,code')
                ->orderBy('due_date')
                ->limit(200)
                ->get(),
            'currencies' => Currency::query()->orderBy('code')->get(['code', 'name']),
            'journals' => AccountingJournal::query()
                ->where('company_id', $company->id)
                ->where('is_active', true)
                ->whereIn('type', ['bank', 'cash', 'purchase'])
                ->get(['id', 'code', 'name']),
        ]);
    }

    public function storePayment(Request $request, PurchaseService $service): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);

        $validated = $request->validate([
            'vendor_id' => ['required', 'integer', Rule::exists('purchase_vendors', 'id')->where('company_id', $company->id)->where('is_active', true)],
            'journal_id' => ['required', 'integer', Rule::exists('accounting_journals', 'id')->where('company_id', $company->id)],
            'payment_method' => ['required', 'string', 'max:40'],
            'currency_code' => ['required', 'string', 'size:3', Rule::exists('currencies', 'code')],
            'amount' => ['required', 'numeric', 'gt:0', 'decimal:0,4', 'max:9999999999999999'],
            'payment_date' => ['required', 'date'],
            'reference' => ['nullable', 'string', 'max:255'],
            'allocations' => ['required', 'array', 'min:1'],
            'allocations.*.purchase_bill_id' => [
                'required',
                'integer',
                Rule::exists('purchase_bills', 'id')->where('company_id', $company->id)->whereIn('status', ['approved', 'partially_paid']),
            ],
            'allocations.*.amount' => ['required', 'numeric', 'gt:0', 'decimal:0,4', 'max:9999999999999999'],
            'allocations.*.exchange_rate_gain_loss' => ['nullable', 'numeric', 'decimal:0,4'],
        ]);

        $service->createPayment($request->user(), $validated, $validated['allocations']);

        return back()->with('success', __('Vendor payment created.'));
    }

    public function postPayment(PurchasePayment $payment, Request $request, PurchaseService $service): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);
        abort_unless((int) $payment->company_id === (int) $company->id, 404);

        $service->postPayment($payment, $request->user());

        return back()->with('success', __('Vendor payment posted to accounting.'));
    }

    private function authorizeAccess(Request $request, Company $company): void
    {
        app(ErpRoleService::class)->authorize($company, $request->user(), 'erp.purchase.view');
    }

    private function authorizeManagement(Request $request, Company $company): void
    {
        app(ErpRoleService::class)->authorize($company, $request->user(), 'erp.purchase.manage');
    }
}
