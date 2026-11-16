<?php

namespace App\Modules\Sales\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreSalesOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('erp.sales.manage');
    }

    public function rules(): array
    {
        return [
            'customer_id' => ['required', 'exists:inv_customers,id'],
            'quotation_id' => ['nullable', 'exists:sal_quotations,id'],
            'currency_code' => ['required', 'string', 'size:3', 'exists:currencies,code'],
            'expected_delivery_date' => ['nullable', 'date'],
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
