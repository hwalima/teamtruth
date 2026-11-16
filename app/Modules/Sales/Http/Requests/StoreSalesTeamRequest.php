<?php

namespace App\Modules\Sales\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreSalesTeamRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('erp.sales.manage');
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
