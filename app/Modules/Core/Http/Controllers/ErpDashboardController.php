<?php

namespace App\Modules\Core\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Accounting\Models\AccountingAccount;
use App\Modules\Accounting\Models\JournalEntry;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\ErpRoleService;
use App\Modules\Inventory\Models\InventoryProduct;
use App\Modules\Purchase\Models\PurchaseVendor;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ErpDashboardController extends Controller
{
    public function index(Request $request): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $permissions = app(ErpRoleService::class)->permissionsFor($company, $request->user());
        $allows = fn (string $permission): bool => in_array('*', $permissions, true)
            || in_array($permission, $permissions, true);
        $modules = [
            [
                'key' => 'project_management',
                'name' => __('Project Management'),
                'description' => __('Projects, tasks, team planning and time tracking.'),
                'href' => route('dashboard'),
                'permission' => 'erp.project_management.view',
                'available' => $request->user()->can('dashboard_view'),
                'status' => 'available',
            ],
            [
                'key' => 'requisitions',
                'name' => __('Requisitions & Approvals'),
                'description' => __('Request goods and services, then track approvals.'),
                'href' => route('erp.requisitions.index'),
                'permission' => 'erp.requisitions.view',
                'available' => true,
                'status' => 'available',
            ],
            [
                'key' => 'inventory',
                'name' => __('Inventory'),
                'description' => __('Manage products, locations, stock and movements.'),
                'href' => route('erp.inventory.setup'),
                'permission' => 'erp.inventory.view',
                'available' => true,
                'status' => 'available',
            ],
            [
                'key' => 'procurement',
                'name' => __('Procurement'),
                'description' => __('Vendors, RFQs, quotations, purchase orders and receiving.'),
                'href' => route('erp.purchase.index'),
                'permission' => 'erp.purchase.view',
                'available' => true,
                'status' => 'available',
            ],
            [
                'key' => 'finance',
                'name' => __('Finance & Accounting'),
                'description' => __('Company chart of accounts, fiscal periods and journal ledger.'),
                'href' => route('erp.accounting.index'),
                'permission' => 'erp.accounting.view',
                'available' => true,
                'status' => 'available',
            ],
            [
                'key' => 'hrm',
                'name' => __('Human Resources'),
                'description' => __('Employee records, leave and HR workflows.'),
                'href' => null,
                'permission' => 'erp.hrm.view',
                'available' => false,
                'status' => 'planned',
            ],
        ];
        $modules = collect($modules)
            ->filter(fn (array $module): bool => $allows($module['permission']))
            ->map(fn (array $module): array => [...$module, 'available' => $module['available'] && $allows($module['permission'])])
            ->values();

        return Inertia::render('Erp/Dashboard/Index', [
            'company' => $company->only(['id', 'code', 'name', 'default_currency']),
            'modules' => $modules,
            'canManageRoles' => $allows('erp.roles.manage'),
            'canManageMembers' => $allows('erp.members.manage'),
            'summary' => [
                'members' => $company->activeUsers()->count(),
                'products' => $allows('erp.inventory.view') ? InventoryProduct::query()->count() : null,
                'vendors' => $allows('erp.purchase.view') ? PurchaseVendor::query()->count() : null,
                'accounts' => $allows('erp.accounting.view') ? AccountingAccount::query()->count() : null,
                'journalEntries' => $allows('erp.accounting.view') ? JournalEntry::query()->count() : null,
            ],
        ]);
    }
}
