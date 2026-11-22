<?php

namespace App\Modules\Sales\Http\Requests;

use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\ErpRoleService;
use Illuminate\Foundation\Http\FormRequest;

class StoreQuotationRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Sales rights come from the user's ERP role in the active company.
        $company = app(CompanyContext::class)->activeCompany();

        return $company !== null && app(ErpRoleService::class)->allows($company, $this->user(), 'erp.sales.manage');
    }

    public function rules(): array
    {
        return [
            'customer_id' => ['required', 'exists:inv_customers,id'],
            'opportunity_id' => ['nullable', 'exists:sal_opportunities,id'],
            'currency_code' => ['required', 'string', 'size:3', 'exists:currencies,code'],
            'valid_until' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'terms' => ['nullable', 'string', 'max:5000'],
            'lines' => ['required', 'array', 'min:1', 'max:200'],
            'lines.*.product_id' => ['nullable', 'exists:inventory_products,id'],
            'lines.*.description' => ['required', 'string', 'max:255'],
            'lines.*.quantity' => ['required', 'numeric', 'gt:0'],
            'lines.*.unit_price' => ['required', 'numeric', 'min:0'],
            'lines.*.discount' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'lines.*.tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'lines.*.notes' => ['nullable', 'string', 'max:2000'],
            'lines.*.sort_order' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
