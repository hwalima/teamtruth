<?php

use App\Models\User;
use App\Modules\Core\Models\Company;
use App\Modules\Hrm\Models\Employee;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->company = Company::create(['code' => 'HRM', 'name' => 'HRM Company', 'default_currency' => 'USD']);
    $this->company->users()->attach($this->user->id, ['role' => 'owner', 'is_active' => true]);
    $this->actingAs($this->user)->withSession(['active_erp_company_id' => $this->company->id]);
    $this->withoutExceptionHandling();
});

function hrmPageComponent($response): string
{
    $component = $response->viewData('page')['component'];
    expect(resource_path("js/pages/{$component}.tsx"))->toBeFile();

    return $component;
}

test('an employee can be created, viewed, edited, terminated and rehired', function () {
    $this->post(route('erp.hrm.employees.store'), [
        'first_name' => 'Tendai',
        'last_name' => 'Moyo',
        'gender' => 'female',
        'status' => 'active',
        'hire_date' => '2026-01-05',
        'personal_phone' => '+263771000000',
        'marital_status' => 'single',
        'emergency_contact_relation' => 'Sister',
        'nssa_number' => 'N123',
    ])->assertRedirect();

    $employee = Employee::query()->firstOrFail();
    expect($employee->employee_number)->toBe('HRM-0001')
        ->and($employee->personal_phone)->toBe('+263771000000');

    expect(hrmPageComponent($this->get(route('erp.hrm.employees.show', $employee))->assertOk()))->toBe('Erp/Hrm/Employees/Show');
    expect(hrmPageComponent($this->get(route('erp.hrm.employees.edit', $employee))->assertOk()))->toBe('Erp/Hrm/Employees/Edit');
    $this->get(route('erp.hrm.employees.index', ['search' => 'Tendai']))->assertOk();

    $this->put(route('erp.hrm.employees.update', $employee), [
        'first_name' => 'Tendai',
        'last_name' => 'Ncube',
        'status' => 'probation',
        'hire_date' => '2026-01-05',
    ])->assertRedirect(route('erp.hrm.employees.show', $employee));
    expect($employee->fresh()->last_name)->toBe('Ncube');

    $this->post(route('erp.hrm.employees.terminate', $employee), ['termination_date' => '2026-06-30', 'termination_reason' => 'Resigned'])->assertRedirect();
    expect($employee->fresh()->status->value)->toBe('terminated');

    $this->post(route('erp.hrm.employees.rehire', $employee), ['rehire_date' => '2026-08-01'])->assertRedirect();
    expect($employee->fresh()->status->value)->toBe('active');

    $this->post(route('erp.hrm.employees.store'), ['first_name' => 'B', 'last_name' => 'C', 'status' => 'active', 'hire_date' => '2026-01-05'])->assertRedirect();
    expect(Employee::query()->latest('id')->value('employee_number'))->toBe('HRM-0002');
});

test('employee documents can be uploaded and deleted', function () {
    Storage::fake('local');

    $this->post(route('erp.hrm.employees.store'), ['first_name' => 'A', 'last_name' => 'B', 'status' => 'active', 'hire_date' => '2026-01-05']);
    $employee = Employee::query()->firstOrFail();

    $this->post(route('erp.hrm.employees.documents.store', $employee), [
        'document_type' => 'id_copy',
        'title' => 'National ID',
        'file' => UploadedFile::fake()->create('id.pdf', 20, 'application/pdf'),
    ])->assertRedirect();

    $document = $employee->documents()->firstOrFail();
    Storage::disk('local')->assertExists($document->file_path);

    $this->delete(route('erp.hrm.employees.documents.destroy', [$employee, $document]))->assertRedirect();
    expect($employee->documents()->count())->toBe(0);
});
