<?php

namespace App\Modules\Core\Models\Scopes;

use App\Modules\Core\Services\CompanyContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

class CompanyScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        $companyId = app(CompanyContext::class)->requireActiveCompany()->getKey();

        $builder->where($model->qualifyColumn('company_id'), $companyId);
    }
}
