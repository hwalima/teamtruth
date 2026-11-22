<?php

use App\Models\User;
use App\Modules\Core\Models\Company;
use App\Modules\Hrm\Models\DisciplinaryCase;
use App\Modules\Hrm\Models\Employee;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->company = Company::create(['code' => 'DIS', 'name' => 'Disc Company', 'default_currency' => 'USD']);
    $this->company->users()->attach($this->user->id, ['role' => 'owner', 'is_active' => true]);
    $this->actingAs($this->user)->withSession(['active_erp_company_id' => $this->company->id]);
    $this->withoutExceptionHandling();

    $this->staff = User::factory()->create();
    $this->company->users()->attach($this->staff->id, ['role' => 'member', 'is_active' => true]);
    $this->post(route('erp.hrm.employees.store'), ['first_name' => 'Tapiwa', 'last_name' => 'Gumbo', 'status' => 'active', 'hire_date' => '2025-01-06', 'user_id' => $this->staff->id]);
    $this->employee = Employee::query()->firstOrFail();
});

function disciplinaryPage($response): string
{
    $component = $response->viewData('page')['component'];
    expect(resource_path("js/pages/{$component}.tsx"))->toBeFile();

    return $component;
}

test('a case runs from report to hearing, outcome, appeal and closure', function () {
    Storage::fake('local');
    expect(disciplinaryPage($this->get(route('erp.hrm.disciplinary.create'))->assertOk()))->toBe('Erp/Hrm/Disciplinary/Create');

    $this->post(route('erp.hrm.disciplinary.store'), [
        'employee_id' => $this->employee->id,
        'incident_date' => now()->subDays(3)->toDateString(),
        'incident_description' => 'Left the site unattended.',
        'witnesses' => "J. Banda\nK. Phiri",
    ])->assertRedirect();

    $case = DisciplinaryCase::query()->firstOrFail();
    expect($case->case_number)->toBe('DC-'.now()->year.'-0001')
        ->and($case->witnesses)->toBe(['J. Banda', 'K. Phiri']);

    expect(disciplinaryPage($this->get(route('erp.hrm.disciplinary.show', $case))->assertOk()))->toBe('Erp/Hrm/Disciplinary/Show');
    $this->put(route('erp.hrm.disciplinary.update', $case), ['incident_date' => now()->subDays(3)->toDateString(), 'incident_description' => 'Left the site unattended for two hours.'])->assertRedirect();

    $this->post(route('erp.hrm.disciplinary.investigate', $case), ['notes' => 'HR officer assigned'])->assertRedirect();
    $this->post(route('erp.hrm.disciplinary.investigation.complete', $case), ['findings' => 'CCTV confirms.', 'proceed' => '1'])->assertRedirect();
    expect($case->fresh()->status->value)->toBe('notice_issued');

    $this->post(route('erp.hrm.disciplinary.hearing.schedule', $case), ['hearing_at' => now()->addDays(5)->format('Y-m-d\TH:i'), 'hearing_location' => 'Boardroom'])->assertRedirect();
    $this->post(route('erp.hrm.disciplinary.hearing.complete', $case), ['notes' => 'Employee admitted.'])->assertRedirect();
    $this->post(route('erp.hrm.disciplinary.outcome.record', $case), ['outcome' => 'written_warning', 'outcome_details' => 'Second offence.'])->assertRedirect();

    $case->refresh();
    expect($case->status->value)->toBe('outcome_decided')
        ->and($case->expiry_date->toDateString())->toBe(today()->addMonths(12)->toDateString());

    $this->post(route('erp.hrm.disciplinary.documents.store', $case), ['document_type' => 'outcome_letter', 'file' => UploadedFile::fake()->create('letter.pdf', 10, 'application/pdf')])->assertRedirect();
    $document = $case->documents()->firstOrFail();
    $this->get(route('erp.hrm.disciplinary.documents.download', [$case, $document]))->assertOk();

    // HR cannot appeal on the employee's behalf.
    $this->withExceptionHandling();
    $this->post(route('erp.hrm.disciplinary.appeal.submit', $case), ['appeal_details' => 'x'])->assertForbidden();
    $this->withoutExceptionHandling();

    // The employee sees only their own case and appeals it.
    $this->actingAs($this->staff);
    $index = $this->get(route('erp.hrm.disciplinary.index'))->assertOk();
    expect($index->viewData('page')['props']['cases']['total'])->toBe(1);
    $this->get(route('erp.hrm.disciplinary.show', $case))->assertOk();
    $this->post(route('erp.hrm.disciplinary.appeal.submit', $case), ['appeal_details' => 'I was told to go to the store.'])->assertRedirect();
    expect($case->fresh()->status->value)->toBe('appealed');

    $this->actingAs($this->user);
    $this->withExceptionHandling();
    $this->post(route('erp.hrm.disciplinary.appeal.decide', $case), ['appeal_decision' => 'reduced', 'new_outcome' => 'final_warning'])->assertSessionHasErrors('new_outcome');
    $this->withoutExceptionHandling();
    $this->post(route('erp.hrm.disciplinary.appeal.decide', $case), ['appeal_decision' => 'reduced', 'new_outcome' => 'verbal_warning'])->assertRedirect();

    $case->refresh();
    expect($case->status->value)->toBe('closed')
        ->and($case->outcome->value)->toBe('verbal_warning')
        ->and(count($case->timeline))->toBeGreaterThanOrEqual(9);

    expect(disciplinaryPage($this->get(route('erp.hrm.disciplinary.index'))->assertOk()))->toBe('Erp/Hrm/Disciplinary/Index');
});

test('other staff cannot see a case and an investigation can end with no action', function () {
    $this->post(route('erp.hrm.disciplinary.store'), ['employee_id' => $this->employee->id, 'incident_date' => today()->toDateString(), 'incident_description' => 'Late.']);
    $case = DisciplinaryCase::query()->firstOrFail();

    $other = User::factory()->create();
    $this->company->users()->attach($other->id, ['role' => 'member', 'is_active' => true]);
    $this->actingAs($other)->withExceptionHandling();
    $this->get(route('erp.hrm.disciplinary.show', $case))->assertForbidden();
    expect($this->get(route('erp.hrm.disciplinary.index'))->viewData('page')['props']['cases']['total'])->toBe(0);

    $this->actingAs($this->user)->withoutExceptionHandling();
    $this->post(route('erp.hrm.disciplinary.investigate', $case));
    $this->post(route('erp.hrm.disciplinary.investigation.complete', $case), ['findings' => 'Traffic accident, excused.', 'proceed' => '0']);
    expect($case->fresh()->status->value)->toBe('closed')->and($case->fresh()->outcome->value)->toBe('no_action');
});
