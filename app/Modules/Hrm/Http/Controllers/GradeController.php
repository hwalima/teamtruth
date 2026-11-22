<?php

namespace App\Modules\Hrm\Http\Controllers;

use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Models\Grade;
use App\Modules\Hrm\Models\Position;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class GradeController extends OrganizationUnitController
{
    protected function model(): string
    {
        return Grade::class;
    }

    protected function page(): string
    {
        return 'Erp/Hrm/Organization/Grades/Index';
    }

    protected function indexRoute(): string
    {
        return 'erp.hrm.organization.grades.index';
    }

    protected function permission(): string
    {
        return 'erp.hrm.grade.manage';
    }

    protected function orderBy(Builder $query): Builder
    {
        return $query->orderBy('level')->orderBy('name');
    }

    protected function rules(?Model $record): array
    {
        return [
            'level' => 'required|integer|min:1|max:999',
            'min_salary' => 'numeric|min:0',
            'max_salary' => 'numeric|min:0',
            'currency_code' => 'required|string|size:3',
        ];
    }

    protected function validateBusinessRules(array $data, ?Model $record): void
    {
        if ((float) $data['max_salary'] > 0 && (float) $data['min_salary'] > (float) $data['max_salary']) {
            throw ValidationException::withMessages(['max_salary' => 'Maximum salary must be at least the minimum salary.']);
        }
    }

    protected function options(): array
    {
        return ['defaultCurrency' => $this->company()->default_currency ?? 'USD'];
    }

    protected function inUse(Model $record): ?string
    {
        return match (true) {
            Position::query()->where('grade_id', $record->getKey())->exists() => 'Positions use this grade.',
            Employee::query()->where('grade_id', $record->getKey())->exists() => 'Employees use this grade.',
            default => null,
        };
    }

    public function store(Request $request): RedirectResponse
    {
        return $this->storeRecord($this->withSalaryDefaults($request));
    }

    public function update(Request $request, Grade $grade): RedirectResponse
    {
        return $this->updateRecord($this->withSalaryDefaults($request), $grade);
    }

    public function destroy(Grade $grade): RedirectResponse
    {
        return $this->destroyRecord($grade);
    }

    private function withSalaryDefaults(Request $request): Request
    {
        $request->merge([
            'min_salary' => $request->input('min_salary') ?? 0,
            'max_salary' => $request->input('max_salary') ?? 0,
            'currency_code' => strtoupper((string) $request->input('currency_code')),
        ]);

        return $request;
    }
}
