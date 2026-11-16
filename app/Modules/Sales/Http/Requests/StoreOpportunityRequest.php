<?php

namespace App\Modules\Sales\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreOpportunityRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('erp.sales.manage');
    }

    public function rules(): array
    {
        return [
            'lead_id' => ['nullable', 'exists:sal_leads,id'],
            'customer_id' => ['nullable', 'exists:inv_customers,id'],
            'title' => ['required', 'string', 'max:255'],
            'expected_value' => ['nullable', 'numeric', 'min:0'],
            'probability' => ['nullable', 'integer', 'min:0', 'max:100'],
            'close_date' => ['nullable', 'date'],
            'assigned_to' => ['nullable', 'exists:users,id'],
        ];
    }
}
