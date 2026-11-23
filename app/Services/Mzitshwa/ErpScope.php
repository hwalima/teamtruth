<?php

namespace App\Services\Mzitshwa;

use App\Models\User;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\ErpRoleService;

/**
 * Works out which ERP company Mzitshwa answers for (the one the user has open,
 * or their only company) and what the user's ERP role lets them see there.
 */
class ErpScope
{
    private ?Company $company = null;

    private array $permissions = [];

    private array $companyNames = [];

    public function __construct(private CompanyContext $context, private ErpRoleService $roles) {}

    public function resolve(User $user, ?int $selectedCompanyId): self
    {
        $companies = Company::query()
            ->where('status', 'active')
            ->whereHas('users', fn ($q) => $q->whereKey($user->getKey())->where('company_user.is_active', true))
            ->orderBy('name')
            ->get();

        $this->companyNames = $companies->pluck('name')->all();
        $this->company = $selectedCompanyId
            ? $companies->firstWhere('id', $selectedCompanyId)
            : ($companies->count() === 1 ? $companies->first() : null);

        if ($this->company) {
            $this->context->setActiveCompany($this->company);
            $this->permissions = $this->roles->permissionsFor($this->company, $user);
        }

        return $this;
    }

    public function company(): ?Company
    {
        return $this->company;
    }

    public function companyNames(): array
    {
        return $this->companyNames;
    }

    /** True when the user's ERP role grants any of the given permissions. */
    public function allows(string ...$permissions): bool
    {
        if (! $this->company) {
            return false;
        }
        if (in_array('*', $this->permissions, true)) {
            return true;
        }

        return array_intersect($permissions, $this->permissions) !== [];
    }
}
