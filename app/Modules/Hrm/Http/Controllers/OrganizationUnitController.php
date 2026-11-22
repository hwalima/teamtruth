<?php

namespace App\Modules\Hrm\Http\Controllers;

use App\Modules\Hrm\Models\Employee;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Shared list / create / update / delete for departments, positions, grades
 * and cost centers. Each is a simple company-scoped table with a unique code.
 */
abstract class OrganizationUnitController extends HrmController
{
    /** @return class-string<Model> */
    abstract protected function model(): string;

    abstract protected function page(): string;

    abstract protected function indexRoute(): string;

    abstract protected function permission(): string;

    abstract protected function rules(?Model $record): array;

    /** Relations to load on the list. */
    protected function with(): array
    {
        return [];
    }

    protected function orderBy(Builder $query): Builder
    {
        return $query->orderBy('name');
    }

    /** Extra props for the page (dropdown options). */
    protected function options(): array
    {
        return [];
    }

    /** Return a reason the record cannot be deleted, or null. */
    protected function inUse(Model $record): ?string
    {
        return null;
    }

    protected function validateBusinessRules(array $data, ?Model $record): void {}

    public function index(Request $request): Response
    {
        $search = (string) $request->query('search', '');

        $records = $this->orderBy($this->model()::query()->with($this->with()))
            ->when($search !== '', fn ($q) => $q->where(fn ($q) => $q
                ->where('name', 'like', "%{$search}%")
                ->orWhere('code', 'like', "%{$search}%")))
            ->paginate(50)
            ->withQueryString();

        return Inertia::render($this->page(), [
            'company' => $this->company(),
            'records' => $records,
            'filters' => ['search' => $search],
            'canManage' => $this->allowsErpPermission($this->permission()),
            ...$this->options(),
        ]);
    }

    protected function storeRecord(Request $request): RedirectResponse
    {
        $data = $this->validated($request, null);

        $this->model()::query()->create([
            ...$data,
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
        ]);

        return redirect()->route($this->indexRoute())->with('success', 'Saved.');
    }

    protected function updateRecord(Request $request, Model $record): RedirectResponse
    {
        $record->update([...$this->validated($request, $record), 'updated_by' => $request->user()->id]);

        return redirect()->route($this->indexRoute())->with('success', 'Saved.');
    }

    protected function destroyRecord(Model $record): RedirectResponse
    {
        if ($reason = $this->inUse($record)) {
            throw ValidationException::withMessages(['record' => $reason]);
        }

        $record->delete();

        return redirect()->route($this->indexRoute())->with('success', 'Deleted.');
    }

    private function validated(Request $request, ?Model $record): array
    {
        $table = (new ($this->model()))->getTable();
        $companyId = $this->company()->id;

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'code' => [
                'required', 'string', 'max:16',
                Rule::unique($table, 'code')->where('company_id', $companyId)->ignore($record?->getKey()),
            ],
            'description' => 'nullable|string|max:5000',
            'is_active' => 'boolean',
            ...$this->rules($record),
        ]);

        $data['is_active'] = $request->boolean('is_active', true);
        $this->validateBusinessRules($data, $record);

        return $data;
    }

    protected function existsInCompany(string $table): \Illuminate\Validation\Rules\Exists
    {
        return Rule::exists($table, 'id')->where('company_id', $this->company()->id);
    }

    protected function employeeOptions(): array
    {
        return Employee::query()
            ->where('status', '!=', 'terminated')
            ->orderBy('last_name')->orderBy('first_name')
            ->get(['id', 'employee_number', 'first_name', 'middle_name', 'last_name'])
            ->map(fn (Employee $e) => ['value' => $e->id, 'label' => "{$e->employee_number} — {$e->full_name}"])
            ->all();
    }

    /** id => "CODE — Name" options for a company-scoped model. */
    protected function unitOptions(string $model, ?callable $filter = null): array
    {
        return $model::query()
            ->when($filter, $filter)
            ->orderBy('name')
            ->get(['id', 'code', 'name'])
            ->map(fn (Model $m) => ['value' => $m->id, 'label' => "{$m->code} — {$m->name}"])
            ->all();
    }

    /** Walk parent_id upwards to stop a record becoming its own ancestor. */
    protected function assertNoCycle(?Model $record, mixed $parentId, string $column = 'parent_id'): void
    {
        if (! $record || ! $parentId) {
            return;
        }

        $seen = [];
        $current = (int) $parentId;
        while ($current) {
            if ($current === (int) $record->getKey() || in_array($current, $seen, true)) {
                throw ValidationException::withMessages([$column => 'This would create a circular hierarchy.']);
            }
            $seen[] = $current;
            $current = (int) $this->model()::query()->whereKey($current)->value($column);
        }
    }
}
