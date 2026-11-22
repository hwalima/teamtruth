<?php

use App\Models\User;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\DataImport\Models\DataImport;
use App\Modules\Hrm\Database\Factories\ContractFactory;
use App\Modules\Hrm\Models\Department;
use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Models\Position;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

beforeEach(function () {
    Storage::fake('local');
    $this->user = User::factory()->create();
    $this->company = Company::create(['code' => 'SMP', 'name' => 'Sample Mining']);
    $this->company->users()->attach($this->user->id, ['role' => 'owner', 'is_active' => true]);
    $this->actingAs($this->user)->withSession(['active_erp_company_id' => $this->company->id]);
    app(CompanyContext::class)->setActiveCompany($this->company);
});

function odooEmployees(array $extra = []): UploadedFile
{
    $spreadsheet = new Spreadsheet;
    $spreadsheet->getActiveSheet()->fromArray([
        ['Employee Name', 'Job Title', 'Work Email', 'Work Phone', 'Contract Start Date', 'Public Date of Birth', 'Manager', 'Image 128'],
        ['Doe Alex', 'Plant Operator', 'office@example.test', null, 46023, 'hidden', 'Banda Sam Lee', 'PD94bWwg'],
        ['Smith Jordan', 'Stores Clerk', 'office@example.test', '0771234567', null, 'hidden', null, 'PD94bWwg'],
        ['Banda Sam Lee', 'Plant Operator', 'office@example.test', null, null, 'hidden', null, null],
        ...$extra,
    ], null, 'A1', true);
    $path = tempnam(sys_get_temp_dir(), 'odoo').'.xlsx';
    (new Xlsx($spreadsheet))->save($path);

    return new UploadedFile($path, 'Employee (hr.employee).xlsx', null, null, true);
}

function importEmployees(array $options = []): DataImport
{
    test()->post(route('erp.data-import.store'), ['file' => odooEmployees(), ...$options])->assertSessionHasNoErrors();
    $import = DataImport::query()->withoutGlobalScopes()->latest('id')->first();
    test()->post(route('erp.data-import.commit', $import))->assertSessionHasNoErrors();

    return $import->refresh();
}

test('an Odoo employee file becomes employees with positions and managers', function () {
    $this->post(route('erp.data-import.store'), ['file' => odooEmployees()])->assertRedirect();
    $preview = DataImport::query()->withoutGlobalScopes()->sole();
    expect($preview->model)->toBe('hr.employee')
        ->and($preview->summary['actions'])->toBe(['created' => 3])
        ->and(Employee::query()->count())->toBe(0);

    $import = importEmployees();
    expect($import->status)->toBe(DataImport::IMPORTED);

    $alex = Employee::query()->where('first_name', 'Alex')->sole();
    $manager = Employee::query()->where('first_name', 'Sam')->sole();
    expect($alex->last_name)->toBe('Doe')
        ->and($alex->hire_date->toDateString())->toBe('2026-01-01')
        ->and($alex->date_of_birth)->toBeNull()
        ->and($alex->personal_email)->toBeNull()
        ->and($alex->employee_number)->toBe('SMP-0001')
        ->and($alex->line_manager_id)->toBe($manager->id)
        ->and($manager->middle_name)->toBe('Lee')
        ->and($manager->last_name)->toBe('Banda')
        ->and(Employee::query()->where('first_name', 'Jordan')->value('personal_phone'))->toBe('0771234567');

    $operator = Position::query()->where('name', 'Plant Operator')->sole();
    expect($operator->headcount_current)->toBe(2)
        ->and($operator->department->name)->toBe('General')
        ->and(Position::query()->count())->toBe(2)
        ->and(Department::query()->count())->toBe(1)
        ->and($import->summary['warnings'])->toContain('Every employee shares the work email office@example.test, so it was not stored on them.');
});

test('importing the employee file again updates the same employees', function () {
    importEmployees();
    $second = importEmployees();

    expect(Employee::query()->count())->toBe(3)
        ->and($second->summary['actions'])->toBe(['updated' => 3])
        ->and(Position::query()->where('name', 'Plant Operator')->value('headcount_current'))->toBe(2);
});

test('names can be read first name first', function () {
    importEmployees(['name_order' => 'first_last']);

    expect(Employee::query()->where('first_name', 'Doe')->value('last_name'))->toBe('Alex');
});

test('an employee import can be undone', function () {
    $own = Department::query()->create(['name' => 'Engineering', 'code' => 'ENG', 'is_active' => true]);
    $import = importEmployees();

    $this->post(route('erp.data-import.undo', $import))->assertSessionHasNoErrors();

    expect($import->refresh()->status)->toBe('undone')
        ->and(Employee::withTrashed()->count())->toBe(0)
        ->and(Position::query()->count())->toBe(0)
        ->and(Department::query()->pluck('id')->all())->toBe([$own->id]);
});

test('employees are deleted unless they have HR history', function () {
    importEmployees();
    $manager = Employee::query()->where('first_name', 'Sam')->sole();
    $jordan = Employee::query()->where('first_name', 'Jordan')->sole();

    $this->get(route('erp.hrm.employees.index'))->assertOk();
    $this->delete(route('erp.hrm.employees.destroy', $manager))->assertRedirect(route('erp.hrm.employees.index'));

    expect(Employee::query()->find($manager->id))->toBeNull()
        ->and(Employee::query()->where('first_name', 'Alex')->value('line_manager_id'))->toBeNull()
        ->and(Position::query()->where('name', 'Plant Operator')->value('headcount_current'))->toBe(1);

    ContractFactory::new()->create(['employee_id' => $jordan->id]);
    $this->delete(route('erp.hrm.employees.destroy', $jordan))->assertSessionHas('error');
    expect(Employee::query()->find($jordan->id))->not->toBeNull();
});
