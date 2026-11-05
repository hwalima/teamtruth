<?php

namespace App\Modules\Core\Services;

use App\Models\User;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Models\CompanyErpRole;
use Illuminate\Auth\Access\AuthorizationException;

class ErpRoleService
{
    private const ADMIN_ONLY_PERMISSIONS = [
        'erp.companies.manage',
        'erp.members.manage',
        'erp.roles.manage',
    ];

    public static function permissionCatalog(): array
    {
        return [
            'ERP' => [
                'erp.dashboard.view' => 'View ERP home',
                'erp.companies.manage' => 'Manage company details',
                'erp.members.manage' => 'Manage company members',
                'erp.roles.manage' => 'Manage roles and permissions',
            ],
            'Project Management' => [
                'erp.project_management.view' => 'Access project management module',
            ],
            'Requisitions' => [
                'erp.requisitions.view' => 'View requisitions',
                'erp.requisitions.create' => 'Create and submit requisitions',
                'erp.requisitions.manage' => 'Manage requisitions',
            ],
            'Procurement' => [
                'erp.purchase.view' => 'View purchasing',
                'erp.purchase.manage' => 'Manage vendors, quotations, purchase orders and receipts',
            ],
            'Inventory' => [
                'erp.inventory.view' => 'View inventory and stock',
                'erp.inventory.manage' => 'Manage inventory setup',
                'erp.stock.manage' => 'Post stock movements',
            ],
            'Finance' => [
                'erp.accounting.view' => 'View accounting ledger',
                'erp.accounting.manage' => 'Manage accounts, periods and journal entries',
            ],
            'Approvals' => [
                'erp.approvals.view' => 'View assigned approvals',
                'erp.approvals.act' => 'Act on assigned approvals',
                'erp.approvals.manage' => 'Configure approval workflows',
            ],
            'Company Settings' => [
                'erp.settings.view' => 'View company settings',
                'erp.settings.manage' => 'Manage company branding, exchange rates and signatories',
            ],
            'Human Resources' => [
                'erp.hrm.view' => 'Access HRM module',
                'erp.hrm.manage' => 'Manage HRM records',
            ],
        ];
    }

    public static function allPermissionKeys(): array
    {
        $keys = [];
        foreach (self::permissionCatalog() as $permissions) {
            $keys = [...$keys, ...array_keys($permissions)];
        }

        return $keys;
    }

    public static function assignablePermissionKeys(bool $canManageAccess): array
    {
        return $canManageAccess
            ? self::allPermissionKeys()
            : array_values(array_diff(self::allPermissionKeys(), self::ADMIN_ONLY_PERMISSIONS));
    }

    public static function defaultPermissions(string $role): array
    {
        $all = self::allPermissionKeys();

        return match ($role) {
            'owner', 'admin' => $all,
            'finance' => [
                'erp.dashboard.view',
                'erp.requisitions.view',
                'erp.purchase.view',
                'erp.accounting.view',
                'erp.accounting.manage',
                'erp.approvals.view',
                'erp.approvals.act',
                'erp.settings.view',
            ],
            'manager' => [
                'erp.dashboard.view',
                'erp.project_management.view',
                'erp.requisitions.view',
                'erp.requisitions.create',
                'erp.requisitions.manage',
                'erp.purchase.view',
                'erp.purchase.manage',
                'erp.inventory.view',
                'erp.inventory.manage',
                'erp.stock.manage',
                'erp.approvals.view',
                'erp.approvals.act',
            ],
            default => [
                'erp.dashboard.view',
                'erp.project_management.view',
                'erp.requisitions.view',
                'erp.requisitions.create',
                'erp.approvals.view',
                'erp.approvals.act',
            ],
        };
    }

    public function permissionsFor(Company $company, User $user): array
    {
        $membership = $company->users()
            ->whereKey($user->getKey())
            ->wherePivot('is_active', true)
            ->first();

        if (! $membership) {
            return [];
        }

        if ($membership->pivot->role === 'owner') {
            return ['*'];
        }

        $role = CompanyErpRole::query()
            ->where('company_id', $company->id)
            ->find($membership->pivot->erp_role_id);

        $permissions = $role?->permissions ?? [];
        if (! in_array($membership->pivot->role, ['admin', 'owner'], true)) {
            $permissions = array_values(array_diff($permissions, self::ADMIN_ONLY_PERMISSIONS));
        }

        return $permissions;
    }

    public function allows(Company $company, User $user, string $permission): bool
    {
        $permissions = $this->permissionsFor($company, $user);

        return in_array('*', $permissions, true) || in_array($permission, $permissions, true);
    }

    public function authorize(Company $company, User $user, string $permission): void
    {
        if (! $this->allows($company, $user, $permission)) {
            throw new AuthorizationException(__('You do not have permission to perform this action in the active company.'));
        }
    }

    public function createDefaultRoles(Company $company): void
    {
        foreach (['owner', 'admin', 'finance', 'manager', 'member'] as $slug) {
            CompanyErpRole::query()->firstOrCreate(
                ['company_id' => $company->id, 'slug' => $slug],
                [
                    'name' => ucfirst($slug),
                    'permissions' => $slug === 'owner' ? ['*'] : self::defaultPermissions($slug),
                    'is_system' => true,
                ],
            );
        }
    }
}
