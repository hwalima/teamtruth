<?php

namespace App\Modules\Purchase\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Currency;
use App\Modules\Core\Services\AuditLogService;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\DocumentRenderer;
use App\Modules\Purchase\Models\PurchaseBill;
use App\Modules\Purchase\Models\PurchaseOrder;
use App\Modules\Purchase\Models\PurchasePayment;
use App\Modules\Purchase\Models\PurchaseVendor;
use App\Modules\Purchase\Models\PurchaseVendorPriceList;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The vendor directory: find, add, edit, deactivate and remove vendors, and
 * see what was ordered from and is owed to each.
 */
class VendorController extends Controller
{
    /** Bills still to be paid. */
    private const OPEN_BILLS = ['approved', 'partially_paid'];

    public function index(Request $request): Response
    {
        $this->authorizeErpPermission('erp.purchase.view');
        $company = app(CompanyContext::class)->requireActiveCompany();
        [$search, $status] = $this->filters($request);

        $vendors = $this->filtered($search, $status)
            ->paginate(25)
            ->withQueryString();

        $owed = $this->owed($vendors->getCollection()->modelKeys());
        $vendors->through(fn (PurchaseVendor $vendor) => [
            ...$vendor->only(['id', 'code', 'name', 'tax_no', 'email', 'phone', 'address', 'payment_terms_days', 'currency_code', 'is_active', 'orders_count']),
            'owed' => $owed[$vendor->id] ?? [],
        ]);

        return Inertia::render('Erp/Purchase/Vendors/Index', [
            'company' => $company->only(['id', 'code', 'name', 'default_currency']),
            'vendors' => $vendors,
            'filters' => ['search' => $search, 'status' => $status],
            'counts' => [
                'active' => PurchaseVendor::query()->where('is_active', true)->count(),
                'inactive' => PurchaseVendor::query()->where('is_active', false)->count(),
            ],
            'currencies' => Currency::query()->orderBy('code')->get(['code', 'name']),
            'nextCode' => PurchaseVendor::nextCode(),
        ]);
    }

    /** The vendor list as a PDF, with the same search and status as the screen. */
    public function pdf(Request $request, DocumentRenderer $renderer): HttpResponse
    {
        $this->authorizeErpPermission('erp.purchase.view');
        $company = app(CompanyContext::class)->requireActiveCompany();
        [$search, $status] = $this->filters($request);

        $vendors = $this->filtered($search, $status)->limit(5000)->get();
        $owed = $this->owed($vendors->modelKeys());
        $totals = [];
        foreach ($owed as $amounts) {
            foreach ($amounts as $currency => $amount) {
                $totals[$currency] = ($totals[$currency] ?? 0) + (float) $amount;
            }
        }
        ksort($totals);

        $pdf = $renderer->renderForCompany($company, 'pdf.documents.vendor-list', [
            'vendors' => $vendors,
            'owed' => $owed,
            'owedTotals' => $totals,
            'filterText' => implode(' · ', array_filter([
                ['active' => 'Active vendors', 'inactive' => 'Inactive vendors', 'all' => 'All vendors'][$status],
                $search !== '' ? 'matching "'.$search.'"' : null,
            ])),
        ]);

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.Str::slug('vendors-'.$company->code.'-'.now()->format('Y-m-d')).'.pdf"',
        ]);
    }

    public function show(PurchaseVendor $vendor): Response
    {
        $this->authorizeErpPermission('erp.purchase.view');
        $company = app(CompanyContext::class)->requireActiveCompany();

        $orders = PurchaseOrder::query()->where('vendor_id', $vendor->id);
        $bills = PurchaseBill::query()->where('vendor_id', $vendor->id);

        return Inertia::render('Erp/Purchase/Vendors/Show', [
            'company' => $company->only(['id', 'code', 'name', 'default_currency']),
            'vendor' => $vendor->only(['id', 'code', 'name', 'tax_no', 'email', 'phone', 'address', 'payment_terms_days', 'currency_code', 'is_active', 'created_at']),
            'stats' => [
                'orders' => (clone $orders)->count(),
                'ordered' => (clone $orders)->whereNotIn('status', ['cancelled', 'rejected'])
                    ->selectRaw('currency_code, sum(total) as amount')->groupBy('currency_code')->pluck('amount', 'currency_code'),
                'bills' => (clone $bills)->count(),
                'owed' => $this->owed([$vendor->id])[$vendor->id] ?? [],
                'paid' => PurchasePayment::query()->where('vendor_id', $vendor->id)->where('status', 'posted')
                    ->selectRaw('currency_code, sum(amount) as amount')->groupBy('currency_code')->pluck('amount', 'currency_code'),
            ],
            'orders' => (clone $orders)->latest('id')->limit(15)
                ->get(['id', 'document_number', 'status', 'currency_code', 'total', 'expected_delivery_date', 'created_at']),
            'bills' => (clone $bills)->latest('bill_date')->latest('id')->limit(15)
                ->get(['id', 'document_number', 'vendor_reference', 'status', 'currency_code', 'total_amount', 'amount_residual', 'bill_date', 'due_date']),
            'priceLists' => PurchaseVendorPriceList::query()->where('vendor_id', $vendor->id)
                ->with('product:id,sku,name')->latest('id')->limit(50)
                ->get(['id', 'product_id', 'min_quantity', 'price', 'currency_code', 'valid_from', 'valid_to']),
            'currencies' => Currency::query()->orderBy('code')->get(['code', 'name']),
            'canDelete' => ! $this->inUse($vendor),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->authorizeErpPermission('erp.purchase.manage');
        $company = app(CompanyContext::class)->requireActiveCompany();
        $validated = $this->validated($request, $company->id);

        $vendor = PurchaseVendor::query()->create([...$validated, 'company_id' => $company->id, 'is_active' => true]);
        $this->audit('purchase.vendor.created', $vendor, ['after' => $this->auditable($vendor)]);

        return back()->with('success', __('Vendor :name added.', ['name' => $vendor->name]));
    }

    public function update(Request $request, PurchaseVendor $vendor): RedirectResponse
    {
        $this->authorizeErpPermission('erp.purchase.manage');
        $before = $this->auditable($vendor);
        $vendor->update($this->validated($request, $vendor->company_id, $vendor));
        $this->audit('purchase.vendor.updated', $vendor, ['before' => $before, 'after' => $this->auditable($vendor)]);

        return back()->with('success', __('Vendor updated.'));
    }

    /** Deactivated vendors keep their history but are no longer offered on new documents. */
    public function toggle(PurchaseVendor $vendor): RedirectResponse
    {
        $this->authorizeErpPermission('erp.purchase.manage');
        $vendor->update(['is_active' => ! $vendor->is_active]);
        $this->audit($vendor->is_active ? 'purchase.vendor.activated' : 'purchase.vendor.deactivated', $vendor);

        return back()->with('success', $vendor->is_active ? __('Vendor reactivated.') : __('Vendor deactivated. Its history is kept.'));
    }

    public function destroy(PurchaseVendor $vendor): RedirectResponse
    {
        $this->authorizeErpPermission('erp.purchase.manage');
        if ($this->inUse($vendor)) {
            return back()->with('error', __('This vendor has orders, bills or other records, so it cannot be deleted. Deactivate it instead.'));
        }

        try {
            DB::transaction(function () use ($vendor) {
                PurchaseVendorPriceList::query()->where('vendor_id', $vendor->id)->delete();
                $vendor->delete();
            });
        } catch (QueryException) {
            return back()->with('error', __('This vendor is still used elsewhere, so it cannot be deleted. Deactivate it instead.'));
        }
        $this->audit('purchase.vendor.deleted', $vendor, ['before' => $this->auditable($vendor)]);

        return redirect()->route('erp.purchase.vendors.index')->with('success', __('Vendor deleted.'));
    }

    /** @return array{0: string, 1: string} the search text and active / inactive / all */
    private function filters(Request $request): array
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(['active', 'inactive', 'all'])],
        ]);

        return [trim($filters['search'] ?? ''), $filters['status'] ?? 'active'];
    }

    private function filtered(string $search, string $status): Builder
    {
        return PurchaseVendor::query()
            ->when($status !== 'all', fn ($query) => $query->where('is_active', $status === 'active'))
            ->when($search !== '', function ($query) use ($search) {
                $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $search).'%';
                $query->where(fn ($inner) => $inner->where('name', 'like', $like)
                    ->orWhere('code', 'like', $like)
                    ->orWhere('tax_no', 'like', $like)
                    ->orWhere('email', 'like', $like)
                    ->orWhere('phone', 'like', $like));
            })
            ->withCount('orders')
            ->orderBy('name');
    }

    private function validated(Request $request, int $companyId, ?PurchaseVendor $vendor = null): array
    {
        $request->merge(['email' => $request->filled('email') ? trim((string) $request->input('email')) : null]);

        return $request->validate([
            'code' => [
                'required', 'string', 'max:40', 'regex:/^[A-Za-z0-9_\/.-]+$/',
                Rule::unique('purchase_vendors', 'code')->where('company_id', $companyId)->ignore($vendor?->id),
            ],
            'name' => ['required', 'string', 'max:255'],
            'tax_no' => ['nullable', 'string', 'max:100'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string', 'max:5000'],
            'payment_terms_days' => ['required', 'integer', 'min:0', 'max:3650'],
            'currency_code' => ['nullable', 'string', 'size:3', Rule::exists('currencies', 'code')],
        ]);
    }

    /**
     * What is still owed to each vendor on approved bills, per currency.
     *
     * @param  list<int>  $vendorIds
     * @return array<int, array<string, string>>
     */
    private function owed(array $vendorIds): array
    {
        if ($vendorIds === []) {
            return [];
        }

        $owed = [];
        PurchaseBill::query()
            ->whereIn('vendor_id', $vendorIds)
            ->whereIn('status', self::OPEN_BILLS)
            ->where('amount_residual', '>', 0)
            ->selectRaw('vendor_id, currency_code, sum(amount_residual) as amount')
            ->groupBy('vendor_id', 'currency_code')
            ->get()
            ->each(function ($row) use (&$owed) {
                $owed[(int) $row->vendor_id][$row->currency_code] = (string) $row->amount;
            });

        return $owed;
    }

    /** Anything that refers to the vendor, other than its own price list. */
    private function inUse(PurchaseVendor $vendor): bool
    {
        foreach (['purchase_quotations', 'purchase_orders', 'purchase_bills', 'purchase_payments', 'purchase_returns', 'purchase_blanket_orders', 'purchase_landed_costs'] as $table) {
            if (DB::getSchemaBuilder()->hasTable($table) && DB::table($table)->where('vendor_id', $vendor->id)->exists()) {
                return true;
            }
        }

        return false;
    }

    private function auditable(PurchaseVendor $vendor): array
    {
        return $vendor->only(['code', 'name', 'tax_no', 'email', 'phone', 'address', 'payment_terms_days', 'currency_code', 'is_active']);
    }

    private function audit(string $event, PurchaseVendor $vendor, array $changes = []): void
    {
        app(AuditLogService::class)->record(
            app(CompanyContext::class)->requireActiveCompany(),
            $event,
            $vendor,
            changes: $changes,
            actor: request()->user(),
        );
    }
}
