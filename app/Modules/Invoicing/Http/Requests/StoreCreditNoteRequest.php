<?php

namespace App\Modules\Invoicing\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCreditNoteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('erp.invoicing.manage');
    }

    public function rules(): array
    {
        return [
            'customer_id' => ['required', 'exists:inv_customers,id'],
            'original_invoice_id' => ['nullable', 'exists:inv_invoices,id'],
            'credit_note_date' => ['required', 'date'],
            'currency_code' => ['required', 'string', 'size:3', 'exists:currencies,code'],
            'journal_id' => ['nullable', 'exists:accounting_journals,id'],
            'reason' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.invoice_line_id' => ['nullable', 'exists:inv_invoice_lines,id'],
            'lines.*.product_id' => ['nullable', 'exists:inventory_products,id'],
            'lines.*.account_id' => ['nullable', 'exists:accounting_accounts,id'],
            'lines.*.name' => ['required', 'string', 'max:255'],
            'lines.*.description' => ['nullable', 'string'],
            'lines.*.quantity' => ['required', 'numeric', 'min:0'],
            'lines.*.unit' => ['nullable', 'string', 'max:20'],
            'lines.*.unit_price' => ['required', 'numeric', 'min:0'],
            'lines.*.discount_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'lines.*.tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'lines.*.sort_order' => ['nullable', 'integer', 'min:0'],
        ];
    }

    public function messages(): array
    {
        return [
            'lines.required' => 'At least one credit note line is required.',
            'lines.min' => 'At least one credit note line is required.',
        ];
    }
}