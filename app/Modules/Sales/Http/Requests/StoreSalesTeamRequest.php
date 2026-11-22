<?php

namespace App\Modules\Sales\Http\Requests;

use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\ErpRoleService;
use Illuminate\Foundation\Http\FormRequest;

class StoreSalesTeamRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:100'],
            'manager_id' => ['nullable', 'exists:users,id'],
            'member_ids' => ['nullable', 'array'],
            'member_ids.*' => ['exists:users,id'],
        ];
    }
}
