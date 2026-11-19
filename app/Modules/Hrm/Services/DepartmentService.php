<?php

namespace App\Modules\Hrm\Services;

use App\Models\User;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Hrm\Models\Department;
use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Models\Position;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class DepartmentService
{
    public function __construct(
        private CompanyContext $companyContext,
    ) {}

    /**
     * Create a new department
     */
    public function createDepartment(User $actor, array $data): Department
    {
        $company = $this->companyContext->requireActiveCompany();

        return DB::transaction(function () use ($company, $actor, $data) {
            // Validate parent department if provided
            if (! empty($data['parent_id'])) {
                $parent = Department::where('company_id', $company->id)
                    ->where('id', $data['parent_id'])
                    ->firstOrFail();
            }

            // Validate manager if provided
            if (! empty($data['manager_id'])) {
                $manager = Employee::where('company_id', $company->id)
                    ->where('id', $data['manager_id'])
                    ->firstOrFail();
            }

            // Validate cost center if provided
            if (! empty($data['cost_center_id'])) {
                \App\Modules\Hrm\Models\CostCenter::where('company_id', $company->id)
                    ->where('id', $data['cost_center_id'])
                    ->firstOrFail();
            }

            // Generate department code if not provided
            $code = $data['code'] ?? $this->generateDepartmentCode($company, $data['name']);

            $department = Department::query()->create([
                'company_id' => $company->id,
                'parent_id' => $data['parent_id'] ?? null,
                'name' => $data['name'],
                'code' => $code,
                'description' => $data['description'] ?? null,
                'manager_id' => $data['manager_id'] ?? null,
                'cost_center_id' => $data['cost_center_id'] ?? null,
                'is_active' => $data['is_active'] ?? true,
                'sort_order' => $data['sort_order'] ?? 0,
                'metadata' => $data['metadata'] ?? null,
                'created_by' => $actor->id,
                'updated_by' => $actor->id,
            ]);

            return $department->load(['parent', 'manager.user', 'costCenter']);
        });
    }

    /**
     * Update a department
     */
    public function updateDepartment(User $actor, Department $department, array $data): Department
    {
        $company = $this->companyContext->requireActiveCompany();

        if ((int) $department->company_id !== (int) $company->id) {
            throw new AuthorizationException('Department belongs to a different company.');
        }

        return DB::transaction(function () use ($company, $actor, $department, $data) {
            // Validate parent department
            if (isset($data['parent_id'])) {
                if ($data['parent_id']) {
                    $parent = Department::where('company_id', $company->id)
                        ->where('id', $data['parent_id'])
                        ->firstOrFail();

                    // Prevent circular reference
                    if ($parent->id === $department->id || $this->wouldCreateCircularReference($department->id, $parent->id)) {
                        throw ValidationException::withMessages(['parent_id' => 'This would create a circular department hierarchy.']);
                    }
                }
            }

            // Validate manager
            if (isset($data['manager_id']) && $data['manager_id']) {
                Employee::where('company_id', $company->id)
                    ->where('id', $data['manager_id'])
                    ->firstOrFail();
            }

            // Validate cost center
            if (isset($data['cost_center_id']) && $data['cost_center_id']) {
                \App\Modules\Hrm\Models\CostCenter::where('company_id', $company->id)
                    ->where('id', $data['cost_center_id'])
                    ->firstOrFail();
            }

            $department->update(array_merge($data, ['updated_by' => $actor->id]));

            return $department->fresh()->load(['parent', 'manager.user', 'costCenter']);
        });
    }

    /**
     * Delete a department
     */
    public function deleteDepartment(User $actor, Department $department): void
    {
        $company = $this->companyContext->requireActiveCompany();

        if ((int) $department->company_id !== (int) $company->id) {
            throw new AuthorizationException('Department belongs to a different company.');
        }

        // Check for sub-departments
        $subDepartments = Department::where('parent_id', $department->id)->count();
        if ($subDepartments > 0) {
            throw ValidationException::withMessages(['department' => 'Cannot delete department with sub-departments. Reassign or delete them first.']);
        }

        // Check for employees
        $employees = Employee::where('department_id', $department->id)->count();
        if ($employees > 0) {
            throw ValidationException::withMessages(['department' => 'Cannot delete department with assigned employees. Reassign them first.']);
        }

        // Check for positions
        $positions = Position::where('department_id', $department->id)->count();
        if ($positions > 0) {
            throw ValidationException::withMessages(['department' => 'Cannot delete department with positions. Reassign or delete them first.']);
        }

        $department->delete();
    }

    /**
     * Get department tree
     */
    public function getDepartmentTree(): \Illuminate\Database\Eloquent\Collection
    {
        $company = $this->companyContext->requireActiveCompany();

        $departments = Department::where('company_id', $company->id)
            ->where('is_active', true)
            ->with(['children' => fn ($q) => $q->where('is_active', true)->orderBy('sort_order')->orderBy('name')])
            ->whereNull('parent_id')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return $departments;
    }

    /**
     * Get department with all sub-departments (flat)
     */
    public function getDepartmentWithDescendants(int $departmentId): \Illuminate\Support\Collection
    {
        $company = $this->companyContext->requireActiveCompany();

        $department = Department::where('company_id', $company->id)->findOrFail($departmentId);

        $descendants = collect([$department]);
        $this->loadDescendants($department, $descendants);

        return $descendants;
    }

    private function loadDescendants(Department $department, \Illuminate\Support\Collection &$collection): void
    {
        $children = Department::where('parent_id', $department->id)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        foreach ($children as $child) {
            $collection->push($child);
            $this->loadDescendants($child, $collection);
        }
    }

    /**
     * Search departments
     */
    public function searchDepartments(array $filters, int $perPage = 15)
    {
        $company = $this->companyContext->requireActiveCompany();

        $query = Department::where('company_id', $company->id)
            ->with(['parent', 'manager.user', 'costCenter']);

        if (! empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        if (! empty($filters['parent_id'])) {
            $query->where('parent_id', $filters['parent_id']);
        } elseif (isset($filters['parent_id']) && $filters['parent_id'] === 'null') {
            $query->whereNull('parent_id');
        }

        if (! empty($filters['is_active'])) {
            $query->where('is_active', $filters['is_active']);
        }

        if (! empty($filters['manager_id'])) {
            $query->where('manager_id', $filters['manager_id']);
        }

        return $query->orderBy('sort_order')->orderBy('name')->paginate($perPage);
    }

    /**
     * Get department statistics
     */
    public function getDepartmentStatistics(int $departmentId): array
    {
        $company = $this->companyContext->requireActiveCompany();

        $department = Department::where('company_id', $company->id)->findOrFail($departmentId);

        $allDepartments = $this->getDepartmentWithDescendants($departmentId)->pluck('id');

        $employeeCount = Employee::whereIn('department_id', $allDepartments)
            ->where('employment_status', 'active')
            ->count();

        $positionCount = Position::whereIn('department_id', $allDepartments)
            ->where('is_active', true)
            ->count();

        $vacantPositions = Position::whereIn('department_id', $allDepartments)
            ->where('is_active', true)
            ->where('headcount_current', '<', 'headcount_planned')
            ->count();

        $totalHeadcountPlanned = Position::whereIn('department_id', $allDepartments)
            ->where('is_active', true)
            ->sum('headcount_planned');

        $totalHeadcountCurrent = Position::whereIn('department_id', $allDepartments)
            ->where('is_active', true)
            ->sum('headcount_current');

        return [
            'department' => $department,
            'employee_count' => $employeeCount,
            'position_count' => $positionCount,
            'vacant_positions' => $vacantPositions,
            'headcount_planned' => $totalHeadcountPlanned,
            'headcount_current' => $totalHeadcountCurrent,
            'headcount_vacancy_rate' => $totalHeadcountPlanned > 0
                ? round(($totalHeadcountPlanned - $totalHeadcountCurrent) / $totalHeadcountPlanned * 100, 2)
                : 0,
        ];
    }

    /**
     * Move department to new parent
     */
    public function moveDepartment(User $actor, Department $department, ?int $newParentId): Department
    {
        $company = $this->companyContext->requireActiveCompany();

        if ((int) $department->company_id !== (int) $company->id) {
            throw new AuthorizationException('Department belongs to a different company.');
        }

        if ($newParentId) {
            $newParent = Department::where('company_id', $company->id)->findOrFail($newParentId);

            if ($newParent->id === $department->id || $this->wouldCreateCircularReference($department->id, $newParent->id)) {
                throw ValidationException::withMessages(['parent_id' => 'This would create a circular department hierarchy.']);
            }
        }

        $department->update([
            'parent_id' => $newParentId,
            'updated_by' => $actor->id,
        ]);

        return $department->fresh()->load(['parent', 'manager.user', 'costCenter']);
    }

    /**
     * Generate department code
     */
    private function generateDepartmentCode(\App\Modules\Core\Models\Company $company, string $name): string
    {
        $baseCode = strtoupper(preg_replace('/[^A-Z0-9]/', '', substr($name, 0, 4)));
        $baseCode = $baseCode ?: 'DEPT';

        $lastCode = Department::where('company_id', $company->id)
            ->where('code', 'like', $baseCode . '%')
            ->latest('code')
            ->value('code');

        if ($lastCode) {
            $num = (int) substr($lastCode, strlen($baseCode)) + 1;
        } else {
            $num = 1;
        }

        return $baseCode . sprintf('%02d', $num);
    }

    /**
     * Check for circular reference
     */
    private function wouldCreateCircularReference(int $departmentId, int $newParentId): bool
    {
        $visited = [];
        $currentId = $newParentId;

        while ($currentId) {
            if ($currentId === $departmentId) {
                return true;
            }

            if (in_array($currentId, $visited)) {
                return true;
            }

            $visited[] = $currentId;

            $parent = Department::where('id', $currentId)->value('parent_id');
            $currentId = $parent ?? 0;
        }

        return false;
    }
}