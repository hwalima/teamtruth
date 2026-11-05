<?php

namespace App\Modules\Purchase\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Currency;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\AuditLogService;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\ErpRoleService;
use App\Modules\Inventory\Models\InventoryProduct;
use App\Modules\Inventory\Models\StockLocation;
use App\Modules\Purchase\Models\PurchaseOrder;
use App\Modules\Purchase\Models\PurchaseOrderLine;
use App\Modules\Purchase\Models\PurchaseQuotation;
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
                ])
                ->latest()
                ->limit(100)
                ->get(),
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

    public function storeVendor(Request $request): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);
        $validated = $request->validate([
            'code' => [
                'required',
                'string',
                'max:40',
                'regex:/^[A-Za-z0-9_-]+$/',
                Rule::unique('purchase_vendors', 'code')->where('company_id', $company->id),
            ],
            'name' => ['required', 'string', 'max:255'],
            'tax_no' => ['nullable', 'string', 'max:100'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string', 'max:5000'],
            'payment_terms_days' => ['required', 'integer', 'min:0', 'max:3650'],
            'currency_code' => ['nullable', 'string', 'size:3', Rule::exists('currencies', 'code')],
        ]);

        $vendor = PurchaseVendor::query()->create([...$validated, 'company_id' => $company->id]);
        app(AuditLogService::class)->record(
            $company,
            'purchase.vendor.created',
            $vendor,
            changes: ['after' => $vendor->only(['code', 'name', 'tax_no', 'email', 'phone', 'payment_terms_days', 'currency_code'])],
            actor: $request->user(),
        );

        return back()->with('success', __('Vendor created.'));
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

    private function authorizeAccess(Request $request, Company $company): void
    {
        app(ErpRoleService::class)->authorize($company, $request->user(), 'erp.purchase.view');
    }

    private function authorizeManagement(Request $request, Company $company): void
    {
        app(ErpRoleService::class)->authorize($company, $request->user(), 'erp.purchase.manage');
    }
}
