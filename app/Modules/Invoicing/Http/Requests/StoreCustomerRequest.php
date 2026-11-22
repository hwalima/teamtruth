<?php

namespace App\Modules\Invoicing\Http\Requests;

use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\ErpRoleService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCustomerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return app(ErpRoleService::class)->allows(
            app(CompanyContext::class)->requireActiveCompany(),
            $this->user(),
            'erp.invoicing.manage',
        );
    }

    public function rules(): array
    {
        return [
            'code' => ['required', 'string', 'max:50', Rule::unique('inv_customers')
                ->where('company_id', app(CompanyContext::class)->requireActiveCompany()->id)
                ->whereNull('deleted_at')
                ->ignore($this->route('customer'))],
            'name' => ['required', 'string', 'max:255'],
            'tax_no' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'billing_address' => ['nullable', 'string'],
            'shipping_address' => ['nullable', 'string'],
            'payment_term_id' => ['nullable', 'exists:inv_payment_terms,id'],
            'currency_code' => ['required', 'string', 'size:3', 'exists:currencies,code'],
            'credit_limit' => ['nullable', 'numeric', 'min:0'],
            'is_active' => ['boolean'],
            'metadata' => ['nullable', 'array'],
        ];
    }
}