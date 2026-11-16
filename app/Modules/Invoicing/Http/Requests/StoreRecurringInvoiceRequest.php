<?php

namespace App\Modules\Invoicing\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreRecurringInvoiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('erp.invoicing.manage');
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'customer_id' => ['required', 'exists:inv_customers,id'],
            'payment_term_id' => ['nullable', 'exists:inv_payment_terms,id'],
            'currency_code' => ['required', 'string', 'size:3', 'exists:currencies,code'],
            'frequency' => ['required', Rule::in(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'])],
            'interval' => ['nullable', 'integer', 'min:1'],
            'start_date' => ['required', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'max_occurrences' => ['nullable', 'integer', 'min:1'],
            'template_data' => ['required', 'array'],
            'template_data.lines' => ['required', 'array', 'min:1'],
            'template_data.lines.*.product_id' => ['nullable', 'exists:inventory_products,id'],
            'template_data.lines.*.account_id' => ['nullable', 'exists:accounting_accounts,id'],
            'template_data.lines.*.name' => ['required', 'string', 'max:255'],
            'template_data.lines.*.description' => ['nullable', 'string'],
            'template_data.lines.*.quantity' => ['required', 'numeric', 'min:0'],
            'template_data.lines.*.unit' => ['nullable', 'string', 'max:20'],
            'template_data.lines.*.unit_price' => ['required', 'numeric', 'min:0'],
            'template_data.lines.*.discount_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'template_data.lines.*.tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'notes' => ['nullable', 'string'],
            'terms' => ['nullable', 'string'],
        ];
    }
}