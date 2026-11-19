<?php

namespace App\Modules\Hrm\Services;

use App\Models\User;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Hrm\Models\Department;
use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Models\Grade;
use App\Modules\Hrm\Models\Position;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PositionService
{
    public function __construct(
        private CompanyContext $companyContext,
    ) {}

    /**
     * Create a new position
     */
    public function createPosition(User $actor, array $data): Position
    {
        $company = $this->companyContext->requireActiveCompany();

        return DB::transaction(function () use ($company, $actor, $data) {
            // Validate department
            $department = Department::where('company_id', $company->id)
                ->where('id', $data['department_id'])
                ->firstOrFail();

            // Validate grade
            $grade = Grade::where('company_id', $company->id)
                ->where('id', $data['grade_id'])
                ->firstOrFail();

            // Validate reports_to_position if provided
            if (! empty($data['reports_to_position_id'])) {
                $reportsTo = Position::where('company_id', $company->id)
                    ->where('id', $data['reports_to_position_id'])
                    ->firstOrFail();

                // Prevent circular reporting
                if ($this->wouldCreateCircularReporting(null, $data['reports_to_position_id'], $data['reports_to_position_id'])) {
                    throw ValidationException::withMessages(['reports_to_position_id' => 'This would create a circular reporting structure.']);
                }
            }

            // Generate position code if not provided
            $code = $data['code'] ?? $this->generatePositionCode($company, $data['name']);

            $position = Position::query()->create([
                'company_id' => $company->id,
                'department_id' => $department->id,
                'name' => $data['name'],
                'code' => $code,
                'description' => $data['description'] ?? null,
                'grade_id' => $grade->id,
                'reports_to_position_id' => $data['reports_to_position_id'] ?? null,
                'headcount_planned' => $data['headcount_planned'] ?? 1,
                'headcount_current' => 0,
                'is_active' => $data['is_active'] ?? true,
                'sort_order' => $data['sort_order'] ?? 0,
                'metadata' => $data['metadata'] ?? null,
                'created_by' => $actor->id,
                'updated_by' => $actor->id,
            ]);

            return $position->load(['department', 'grade', 'reportsTo']);
        });
    }

    /**
     * Update a position
     */
    public function updatePosition(User $actor, Position $position, array $data): Position
    {
        $company = $this->companyContext->requireActiveCompany();

        if ((int) $position->company_id !== (int) $company->id) {
            throw new AuthorizationException('Position belongs to a different company.');
        }

        return DB::transaction(function () use ($company, $actor, $position, $data) {
            // Validate department
            if (isset($data['department_id'])) {
                Department::where('company_id', $company->id)
                    ->where('id', $data['department_id'])
                    ->firstOrFail();
            }

            // Validate grade
            if (isset($data['grade_id'])) {
                Grade::where('company_id', $company->id)
                    ->where('id', $data['grade_id'])
                    ->firstOrFail();
            }

            // Validate reports_to_position
            if (isset($data['reports_to_position_id'])) {
                if ($data['reports_to_position_id']) {
                    $reportsTo = Position::where('company_id', $company->id)
                        ->where('id', $data['reports_to_position_id'])
                        ->firstOrFail();

                    // Prevent circular reporting
                    if ($this->wouldCreateCircularReporting($position->id, $data['reports_to_position_id'], $data['reports_to_position_id'])) {
                        throw ValidationException::withMessages(['reports_to_position_id' => 'This would create a circular reporting structure.']);
                    }
                }
            }

            $position->update(array_merge($data, ['updated_by' => $actor->id]));

            return $position->fresh()->load(['department', 'grade', 'reportsTo']);
        });
    }

    /**
     * Delete a position
     */
    public function deletePosition(User $actor, Position $position): void
    {
        $company = $this->companyContext->requireActiveCompany();

        if ((int) $position->company_id !== (int) $company->id) {
            throw new AuthorizationException('Position belongs to a different company.');
        }

        // Check for employees
        $employees = Employee::where('position_id', $position->id)->count();
        if ($employees > 0) {
            throw ValidationException::withMessages(['position' => 'Cannot delete position with assigned employees. Reassign them first.']);
        }

        // Check for child positions
        $children = Position::where('reports_to_position_id', $position->id)->count();
        if ($children > 0) {
            throw ValidationException::withMessages(['position' => 'Cannot delete position with subordinate positions. Reassign or delete them first.']);
        }

        $position->delete();
    }

    /**
     * Get position hierarchy tree
     */
    public function getPositionTree(): \Illuminate\Database\Eloquent\Collection
    {
        $company = $this->companyContext->requireActiveCompany();

        return Position::where('company_id', $company->id)
            ->where('is_active', true)
            ->whereNull('reports_to_position_id')
            ->with(['children' => fn ($q) => $q->where('is_active', true)->orderBy('sort_order')->orderBy('name')])
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();
    }

    /**
     * Search positions
     */
    public function searchPositions(array $filters, int $perPage = 15)
    {
        $company = $this->companyContext->requireActiveCompany();

        $query = Position::where('company_id', $company->id)
            ->with(['department', 'grade', 'reportsTo']);

        if (! empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        if (! empty($filters['department_id'])) {
            $query->where('department_id', $filters['department_id']);
        }

        if (! empty($filters['grade_id'])) {
            $query->where('grade_id', $filters['grade_id']);
        }

        if (! empty($filters['is_active'])) {
            $query->where('is_active', $filters['is_active']);
        }

        if (! empty($filters['reports_to_position_id'])) {
            $query->where('reports_to_position_id', $filters['reports_to_position_id']);
        } elseif (isset($filters['reports_to_position_id']) && $filters['reports_to_position_id'] === 'null') {
            $query->whereNull('reports_to_position_id');
        }

        if (! empty($filters['has_vacancy'])) {
            $query->whereRaw('headcount_current < headcount_planned');
        }

        return $query->orderBy('sort_order')->orderBy('name')->paginate($perPage);
    }

    /**
     * Get position with all subordinates
     */
    public function getPositionWithSubordinates(int $positionId): \Illuminate\Support\Collection
    {
        $company = $this->companyContext->requireActiveCompany();

        $position = Position::where('company_id', $company->id)->findOrFail($positionId);

        $subordinates = collect([$position]);
        $this->loadSubordinates($position, $subordinates);

        return $subordinates;
    }

    private function loadSubordinates(Position $position, \Illuminate\Support\Collection &$collection): void
    {
        $children = Position::where('reports_to_position_id', $position->id)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        foreach ($children as $child) {
            $collection->push($child);
            $this->loadSubordinates($child, $collection);
        }
    }

    /**
     * Get vacant positions
     */
    public function getVacantPositions(): \Illuminate\Database\Eloquent\Collection
    {
        $company = $this->companyContext->requireActiveCompany();

        return Position::where('company_id', $company->id)
            ->where('is_active', true)
            ->whereRaw('headcount_current < headcount_planned')
            ->with(['department', 'grade'])
            ->orderBy('department_id')
            ->orderBy('sort_order')
            ->get();
    }

    /**
     * Get position statistics
     */
    public function getPositionStatistics(int $positionId): array
    {
        $company = $this->companyContext->requireActiveCompany();

        $position = Position::where('company_id', $company->id)->findOrFail($positionId);

        $employees = Employee::where('position_id', $positionId)
            ->where('employment_status', 'active')
            ->with(['user', 'department'])
            ->get();

        $subordinatePositions = $this->getPositionWithSubordinates($positionId)
            ->where('id', '!=', $positionId)
            ->pluck('id');

        $subordinateEmployees = Employee::whereIn('position_id', $subordinatePositions)
            ->where('employment_status', 'active')
            ->count();

        return [
            'position' => $position,
            'headcount_planned' => $position->headcount_planned,
            'headcount_current' => $position->headcount_current,
            'vacancies' => $position->headcount_planned - $position->headcount_current,
            'incumbents' => $employees,
            'subordinate_positions_count' => $subordinatePositions->count(),
            'subordinate_employees_count' => $subordinateEmployees,
            'is_vacant' => $position->headcount_current < $position->headcount_planned,
        ];
    }

    /**
     * Assign employee to position
     */
    public function assignEmployee(User $actor, Position $position, int $employeeId): Employee
    {
        $company = $this->companyContext->requireActiveCompany();

        if ((int) $position->company_id !== (int) $company->id) {
            throw new AuthorizationException('Position belongs to a different company.');
        }

        if ($position->headcount_current >= $position->headcount_planned) {
            throw ValidationException::withMessages(['position' => 'Position is at full capacity.']);
        }

        $employee = Employee::where('company_id', $company->id)->findOrFail($employeeId);

        return DB::transaction(function () use ($actor, $position, $employee) {
            // Remove from old position
            if ($employee->position_id) {
                Position::where('id', $employee->position_id)->decrement('headcount_current');
            }

            // Assign to new position
            $employee->update([
                'position_id' => $position->id,
                'department_id' => $position->department_id,
                'grade_id' => $position->grade_id,
                'updated_by' => $actor->id,
            ]);

            $position->increment('headcount_current');

            return $employee->fresh()->load(['department', 'position', 'grade']);
        });
    }

    /**
     * Remove employee from position
     */
    public function removeEmployee(User $actor, Position $position, int $employeeId): Employee
    {
        $company = $this->companyContext->requireActiveCompany();

        if ((int) $position->company_id !== (int) $company->id) {
            throw new AuthorizationException('Position belongs to a different company.');
        }

        $employee = Employee::where('company_id', $company->id)
            ->where('id', $employeeId)
            ->where('position_id', $position->id)
            ->firstOrFail();

        return DB::transaction(function () use ($actor, $position, $employee) {
            $employee->update([
                'position_id' => null,
                'department_id' => null,
                'grade_id' => null,
                'updated_by' => $actor->id,
            ]);

            $position->decrement('headcount_current');

            return $employee->fresh();
        });
    }

    /**
     * Generate position code
     */
    private function generatePositionCode(\App\Modules\Core\Models\Company $company, string $name): string
    {
        $baseCode = strtoupper(preg_replace('/[^A-Z0-9]/', '', substr($name, 0, 4)));
        $baseCode = $baseCode ?: 'POS';

        $lastCode = Position::where('company_id', $company->id)
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
     * Check for circular reporting
     */
    private function wouldCreateCircularReporting(?int $positionId, int $reportsToId, int $currentId): bool
    {
        $visited = [];
        $checkId = $currentId;

        while ($checkId) {
            if ($positionId && $checkId === $positionId) {
                return true;
            }

            if (in_array($checkId, $visited)) {
                return true;
            }

            $visited[] = $checkId;

            $parent = Position::where('id', $checkId)->value('reports_to_position_id');
            $checkId = $parent ?? 0;
        }

        return false;
    }
}