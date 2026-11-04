<?php

namespace App\Modules\Core\Models\Concerns;

use App\Modules\Core\Models\Company;
use App\Modules\Core\Models\Scopes\CompanyScope;
use App\Modules\Core\Services\CompanyContext;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

trait BelongsToCompany
{
    protected static function bootBelongsToCompany(): void
    {
        static::addGlobalScope(new CompanyScope);

        static::creating(function ($model): void {
            $companyId = app(CompanyContext::class)->requireActiveCompany()->getKey();
            $providedCompanyId = $model->getAttribute('company_id');

            if ($providedCompanyId !== null && (int) $providedCompanyId !== (int) $companyId) {
                throw new AuthorizationException('A record cannot be created for a different active company.');
            }

            $model->setAttribute('company_id', $companyId);
        });

        static::updating(function ($model): void {
            $companyId = app(CompanyContext::class)->requireActiveCompany()->getKey();

            if ((int) $model->getOriginal('company_id') !== (int) $companyId || $model->isDirty('company_id')) {
                throw new AuthorizationException('A company-scoped record cannot be moved between companies.');
            }
        });
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}
