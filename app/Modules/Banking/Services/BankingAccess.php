<?php

namespace App\Modules\Banking\Services;

use App\Models\User;
use App\Modules\Banking\Models\BankAccount;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\ErpRoleService;
use Illuminate\Support\Collection;

/**
 * Banking spans the group: a user sees the accounts of every company where
 * they hold the banking permission, not only the active company.
 */
class BankingAccess
{
    /** @var array<string, Collection<int, Company>> */
    private array $cache = [];

    public function __construct(private ErpRoleService $roles) {}

    /** @return Collection<int, Company> */
    public function companies(User $user, string $permission = 'erp.banking.view'): Collection
    {
        return $this->cache[$user->id.'|'.$permission] ??= $user->companies()
            ->wherePivot('is_active', true)
            ->orderBy('name')
            ->get()
            ->filter(fn (Company $company) => $this->roles->allows($company, $user, $permission))
            ->values();
    }

    /** @return list<int> */
    public function companyIds(User $user, string $permission = 'erp.banking.view'): array
    {
        return $this->companies($user, $permission)->pluck('id')->map(fn ($id) => (int) $id)->all();
    }

    public function can(User $user, BankAccount $account, string $permission = 'erp.banking.view'): bool
    {
        return in_array((int) $account->company_id, $this->companyIds($user, $permission), true);
    }

    public function authorize(User $user, BankAccount $account, string $permission = 'erp.banking.view'): void
    {
        abort_unless($this->can($user, $account, $permission), 403, 'You do not have banking access for '.($account->company?->name ?? 'this company').'.');
    }
}
