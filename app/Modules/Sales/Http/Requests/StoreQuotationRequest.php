<?php

namespace App\Modules\Sales\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreQuotationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('erp.sales.manage');
    }

    public function rules(): array
    {
        return [
            'customer_id' => ['required', 'exists:inv_customers,id'],
            'opportunity_id' => ['nullable', 'exists:sal_opportunities,id'],
            'currency_code' => ['required', 'string', 'size:3', 'exists:currencies,code'],
            'valid_until' => ['nullable', 'date'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.product_id' => ['nullable', 'exists:inventory_products,id'],
            'lines.*.description' => ['required', 'string', 'max:255'],
            'lines.*.quantity' => ['required', 'numeric', 'min:0'],
            'lines.*.unit_price' => ['required', 'numeric', 'min:0'],
            'lines.*.discount' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'lines.*.tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'lines.*.notes' => ['nullable', 'string'],
            'lines.*.sort_order' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
