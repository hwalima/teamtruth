<?php

namespace App\Modules\Core\Services;

use App\Modules\Core\Models\Company;
use LogicException;

class CompanyContext
{
    private ?Company $activeCompany = null;

    public function setActiveCompany(?Company $company): void
    {
        $this->activeCompany = $company;
    }

    public function activeCompany(): ?Company
    {
        return $this->activeCompany;
    }

    public function requireActiveCompany(): Company
    {
        return $this->activeCompany
            ?? throw new LogicException('No active company has been resolved for this request.');
    }
}
