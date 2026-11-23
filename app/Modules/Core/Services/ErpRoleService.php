<?php

namespace App\Modules\Core\Services;

use App\Models\User;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Models\CompanyErpRole;
use Illuminate\Auth\Access\AuthorizationException;

class ErpRoleService
{
    /**
     * HRM actions on a person's own record. Every active company member gets
     * them; the HRM policies make sure they only ever touch their own data.
     */
    public const PERSONAL_HRM_PERMISSIONS = [
        'erp.hrm.leave.view',
        'erp.hrm.leave.request',
        'erp.hrm.contract.sign',
        'erp.hrm.self_service.view',
        'erp.hrm.self_service.request',
        'erp.hrm.disciplinary.appeal',
    ];

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
                'erp.purchase.bills' => 'Record and post vendor bills and payments',
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
            'Banking' => [
                'erp.banking.view' => 'View bank accounts and statements',
                'erp.banking.manage' => 'Import statements, record bank transactions and request transfers between companies',
                'erp.banking.approve' => 'Approve fund requests that pay out of this company',
            ],
            'Invoicing' => [
                'erp.invoicing.view' => 'View invoices, credit notes and customers',
                'erp.invoicing.manage' => 'Create and manage invoices, credit notes, recurring invoices and customers',
            ],
            'Sales' => [
                'erp.sales.view' => 'View leads, opportunities, quotations and sales orders',
                'erp.sales.manage' => 'Create and manage leads, opportunities, quotations, sales orders and sales teams',
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
                'erp.hrm.view' => 'Access HRM module (view everything in HRM)',
                'erp.hrm.manage' => 'Manage HRM records (full HRM access)',
                'erp.hrm.employee.view' => 'View employees',
                'erp.hrm.employee.view_salary' => 'View employee salaries',
                'erp.hrm.employee.manage' => 'Add and update employees and their documents',
                'erp.hrm.employee.terminate' => 'Terminate, rehire and delete employees',
                'erp.hrm.leave.view' => 'View leave requests and balances',
                'erp.hrm.leave.request' => 'Request leave',
                'erp.hrm.leave.approve' => 'Approve or reject leave',
                'erp.hrm.leave.manage' => 'Manage leave types, balances and holidays',
                'erp.hrm.contract.view' => 'View contracts',
                'erp.hrm.contract.sign' => 'Sign contracts',
                'erp.hrm.contract.manage' => 'Manage contracts and templates',
                'erp.hrm.organization.view' => 'View organization structure',
                'erp.hrm.department.view' => 'View departments',
                'erp.hrm.department.manage' => 'Manage departments',
                'erp.hrm.position.view' => 'View positions',
                'erp.hrm.position.manage' => 'Manage positions',
                'erp.hrm.grade.view' => 'View grades',
                'erp.hrm.grade.manage' => 'Manage grades',
                'erp.hrm.cost_center.view' => 'View cost centers',
                'erp.hrm.cost_center.manage' => 'Manage cost centers',
                'erp.hrm.disciplinary.view' => 'View disciplinary cases',
                'erp.hrm.disciplinary.appeal' => 'Submit disciplinary appeals',
                'erp.hrm.disciplinary.manage' => 'Manage disciplinary cases',
                'erp.hrm.self_service.view' => 'View self-service requests',
                'erp.hrm.self_service.request' => 'Submit self-service requests',
                'erp.hrm.self_service.manage' => 'Process self-service requests',
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

    /**
     * The roles every company starts with: slug => display name. The job roles
     * below admin are ready-made starting points that companies can adjust.
     */
    public const DEFAULT_ROLES = [
        'owner' => 'Owner',
        'admin' => 'Admin',
        'finance' => 'Finance',
        'manager' => 'Manager',
        'member' => 'Member',
        'hr-manager' => 'HR Manager',
        'hr-officer' => 'HR Officer',
        'stores-manager' => 'Stores Manager',
        'procurement-officer' => 'Procurement Officer',
        'finance-clerk' => 'Finance Clerk',
    ];

    /** What every staff member can do: the ERP home, raising requisitions and acting on approvals assigned to them. */
    private const BASELINE_PERMISSIONS = [
        'erp.dashboard.view',
        'erp.requisitions.view',
        'erp.requisitions.create',
        'erp.approvals.view',
        'erp.approvals.act',
    ];

    public static function defaultPermissions(string $role): array
    {
        $all = self::allPermissionKeys();

        return match ($role) {
            'owner', 'admin' => $all,
            // Everything in HR, including salaries and terminations.
            'hr-manager' => [...self::BASELINE_PERMISSIONS, 'erp.hrm.manage'],
            // Day-to-day HR administration: employee records and self-service requests.
            // No salaries, terminations, disciplinary cases, leave approval or HR setup.
            'hr-officer' => [
                ...self::BASELINE_PERMISSIONS,
                'erp.hrm.employee.view',
                'erp.hrm.employee.manage',
                'erp.hrm.leave.view',
                'erp.hrm.contract.view',
                'erp.hrm.organization.view',
                'erp.hrm.department.view',
                'erp.hrm.position.view',
                'erp.hrm.grade.view',
                'erp.hrm.cost_center.view',
                'erp.hrm.self_service.view',
                'erp.hrm.self_service.manage',
            ],
            // Runs procurement and the stores: buying, stock setup and movements, and requisitions.
            'stores-manager' => [
                ...self::BASELINE_PERMISSIONS,
                'erp.requisitions.manage',
                'erp.purchase.view',
                'erp.purchase.manage',
                'erp.inventory.view',
                'erp.inventory.manage',
                'erp.stock.manage',
            ],
            // Day-to-day buying: vendors, quotations, purchase orders and receipts. Paying
            // suppliers and changing stock setup stay with finance and the stores manager.
            'procurement-officer' => [
                ...self::BASELINE_PERMISSIONS,
                'erp.purchase.view',
                'erp.purchase.manage',
                'erp.inventory.view',
            ],
            // Daily transactions: invoices, customer payments, vendor bills and payments, bank
            // lines. No ledger setup, journals, period locks, reports or approving fund requests.
            'finance-clerk' => [
                ...self::BASELINE_PERMISSIONS,
                'erp.purchase.view',
                'erp.purchase.bills',
                'erp.invoicing.view',
                'erp.invoicing.manage',
                'erp.banking.view',
                'erp.banking.manage',
            ],
            'finance' => [
                'erp.dashboard.view',
                'erp.requisitions.view',
                'erp.purchase.view',
                'erp.purchase.bills',
                'erp.sales.view',
                'erp.sales.manage',
                'erp.accounting.view',
                'erp.accounting.manage',
                'erp.banking.view',
                'erp.banking.manage',
                'erp.invoicing.view',
                'erp.invoicing.manage',
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
                'erp.purchase.bills',
                'erp.sales.view',
                'erp.sales.manage',
                'erp.inventory.view',
                'erp.inventory.manage',
                'erp.stock.manage',
                'erp.banking.approve',
                'erp.approvals.view',
                'erp.approvals.act',
            ],
            default => [...self::BASELINE_PERMISSIONS, 'erp.project_management.view'],
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

        return self::expandImpliedPermissions([...$permissions, ...self::PERSONAL_HRM_PERMISSIONS]);
    }

    /**
     * erp.hrm.manage grants every HRM permission; erp.hrm.view grants every
     * HRM view permission. Roles created before the detailed HRM permissions
     * existed keep working.
     */
    public static function expandImpliedPermissions(array $permissions): array
    {
        $hrm = array_keys(self::permissionCatalog()['Human Resources']);

        if (in_array('erp.hrm.manage', $permissions, true)) {
            $permissions = [...$permissions, ...$hrm];
        } elseif (in_array('erp.hrm.view', $permissions, true)) {
            $permissions = [...$permissions, ...array_filter($hrm, fn (string $key) => str_ends_with($key, '.view'))];
        }

        if (in_array('erp.banking.manage', $permissions, true) || in_array('erp.banking.approve', $permissions, true)) {
            $permissions[] = 'erp.banking.view';
        }

        return array_values(array_unique($permissions));
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
        foreach (self::DEFAULT_ROLES as $slug => $name) {
            if (CompanyErpRole::query()->where('company_id', $company->id)->where('slug', '!=', $slug)->where('name', $name)->exists()) {
                continue; // The company already made its own role with this name.
            }
            CompanyErpRole::query()->firstOrCreate(
                ['company_id' => $company->id, 'slug' => $slug],
                [
                    'name' => $name,
                    'permissions' => $slug === 'owner' ? ['*'] : self::defaultPermissions($slug),
                    'is_system' => true,
                ],
            );
        }
    }
}
