<?php

use App\Modules\Core\Models\Company;
use App\Modules\Core\Models\CompanyErpRole;
use App\Modules\Core\Services\ErpRoleService;
use Illuminate\Database\Migrations\Migration;

/**
 * Vendor bills and payments, and terminating or deleting employees, get their own
 * permissions so junior roles can be given buying or HR admin without them. Roles
 * that had the broader permission keep exactly what they could do. Every company
 * also gets the ready-made job roles (HR Manager, HR Officer, Stores Manager,
 * Procurement Officer, Finance Clerk).
 */
return new class extends Migration
{
    private const SPLITS = [
        'erp.purchase.manage' => 'erp.purchase.bills',
        'erp.hrm.employee.manage' => 'erp.hrm.employee.terminate',
    ];

    public function up(): void
    {
        CompanyErpRole::query()->each(function (CompanyErpRole $role): void {
            $permissions = $role->permissions ?? [];
            if (in_array('*', $permissions, true)) {
                return;
            }

            $added = [];
            foreach (self::SPLITS as $broad => $split) {
                if (in_array($broad, $permissions, true)) {
                    $added[] = $split;
                }
            }
            // Finance has always been the department that pays vendors.
            if ($role->slug === 'finance' && $role->is_system) {
                $added[] = 'erp.purchase.bills';
            }

            $updated = array_values(array_unique([...$permissions, ...$added]));
            if ($updated !== $permissions) {
                $role->update(['permissions' => $updated]);
            }
        });

        Company::query()->each(fn (Company $company) => app(ErpRoleService::class)->createDefaultRoles($company));
    }

    public function down(): void
    {
        // Kept: removing permissions or roles that people may already be using would lock them out.
    }
};
