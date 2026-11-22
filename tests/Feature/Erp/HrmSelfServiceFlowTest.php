<?php

use App\Models\User;
use App\Modules\Core\Models\Company;
use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Models\SelfServiceRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('local');
    $this->user = User::factory()->create();
    $this->company = Company::create(['code' => 'SSV', 'name' => 'Self Service Company', 'default_currency' => 'USD']);
    $this->company->users()->attach($this->user->id, ['role' => 'owner', 'is_active' => true]);
    $this->actingAs($this->user)->withSession(['active_erp_company_id' => $this->company->id]);
    $this->withoutExceptionHandling();

    $this->staff = User::factory()->create();
    $this->company->users()->attach($this->staff->id, ['role' => 'member', 'is_active' => true]);
    $this->post(route('erp.hrm.employees.store'), ['first_name' => 'Rudo', 'last_name' => 'Moyo', 'status' => 'active', 'hire_date' => '2026-02-01', 'user_id' => $this->staff->id])->assertRedirect();
    $this->employee = Employee::query()->firstOrFail();
});

function selfServicePage($response): string
{
    $component = $response->viewData('page')['component'];
    expect(resource_path("js/pages/{$component}.tsx"))->toBeFile();

    return $component;
}

test('an employee asks for a profile change and HR completes it', function () {
    $this->actingAs($this->staff);
    expect(selfServicePage($this->get(route('erp.hrm.self-service.index'))->assertOk()))->toBe('Erp/Hrm/SelfService/Index');
    expect(selfServicePage($this->get(route('erp.hrm.self-service.create', ['type' => 'profile_update']))->assertOk()))->toBe('Erp/Hrm/SelfService/Create');

    $this->post(route('erp.hrm.self-service.store'), [
        'request_type' => 'profile_update',
        'changes' => ['personal_phone' => '+263771234567', 'bank_name' => 'CBZ'],
        'details' => 'New number and bank.',
    ])->assertRedirect();
    $request = SelfServiceRequest::query()->firstOrFail();
    expect($request->status->value)->toBe('pending');

    $show = $this->get(route('erp.hrm.self-service.show', $request))->assertOk();
    expect(selfServicePage($show))->toBe('Erp/Hrm/SelfService/Show')
        ->and($show->viewData('page')['props']['canEdit'])->toBeTrue()
        ->and($show->viewData('page')['props']['canProcess'])->toBeFalse()
        ->and($show->viewData('page')['props']['changes'])->toHaveCount(2);

    $this->put(route('erp.hrm.self-service.update', $request), ['changes' => ['personal_phone' => '+263779999999']])->assertRedirect();
    expect($request->fresh()->request_data['changes'])->toBe(['personal_phone' => '+263779999999']);

    // The employee cannot handle their own request.
    $this->withExceptionHandling();
    $this->post(route('erp.hrm.self-service.review', $request), ['decision' => 'complete'])->assertForbidden();

    // Someone else in the company cannot see it.
    $other = User::factory()->create();
    $this->company->users()->attach($other->id, ['role' => 'member', 'is_active' => true]);
    $this->actingAs($other)->get(route('erp.hrm.self-service.show', $request))->assertForbidden();
    $this->withoutExceptionHandling();

    $this->actingAs($this->user);
    $this->get(route('erp.hrm.self-service.index'))->assertOk();
    $this->post(route('erp.hrm.self-service.assign', $request))->assertRedirect();
    expect($request->fresh()->status->value)->toBe('in_progress');

    $this->post(route('erp.hrm.self-service.review', $request), ['decision' => 'complete', 'notes' => 'Updated.'])->assertRedirect();
    expect($request->fresh()->status->value)->toBe('completed')
        ->and($this->employee->fresh()->personal_phone)->toBe('+263779999999');
});

test('an employee sends a document, can download it and can withdraw a request', function () {
    $this->actingAs($this->staff);

    $this->post(route('erp.hrm.self-service.store'), [
        'request_type' => 'document_upload',
        'subject' => 'Degree certificate',
        'attachments' => [UploadedFile::fake()->create('degree.pdf', 100, 'application/pdf')],
    ])->assertRedirect();
    $request = SelfServiceRequest::query()->firstOrFail();
    expect($request->request_data['attachments'])->toHaveCount(1);

    $this->get(route('erp.hrm.self-service.documents.download', [$request, 0]))->assertOk();
    $this->post(route('erp.hrm.self-service.documents.store', $request), ['file' => UploadedFile::fake()->create('id.pdf', 50)])->assertRedirect();
    expect($request->fresh()->request_data['attachments'])->toHaveCount(2);

    $this->post(route('erp.hrm.self-service.cancel', $request))->assertRedirect(route('erp.hrm.self-service.index'));
    expect(SelfServiceRequest::query()->count())->toBe(0);

    // A payslip request needs the period; HR rejection needs notes.
    $this->withExceptionHandling();
    $this->post(route('erp.hrm.self-service.store'), ['request_type' => 'payslip_request'])->assertSessionHasErrors('period');
    $this->withoutExceptionHandling();

    $this->post(route('erp.hrm.self-service.store'), ['request_type' => 'payslip_request', 'period' => 'October 2026'])->assertRedirect();
    $payslip = SelfServiceRequest::query()->firstOrFail();

    $this->actingAs($this->user);
    $this->withExceptionHandling();
    $this->post(route('erp.hrm.self-service.review', $payslip), ['decision' => 'reject'])->assertSessionHasErrors('notes');
    $this->post(route('erp.hrm.self-service.review', $payslip), ['decision' => 'reject', 'notes' => 'Payroll is not yet run.'])->assertRedirect();
    expect($payslip->fresh()->status->value)->toBe('rejected');
});
