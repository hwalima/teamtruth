<?php

use App\Models\Currency;
use App\Models\Permission;
use App\Models\User;
use App\Modules\Core\Enums\ApprovalActionType;
use App\Modules\Core\Enums\ApprovalStatus;
use App\Modules\Core\Models\ApprovalWorkflow;
use App\Modules\Core\Models\ApprovalWorkflowStep;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Modules\Core\Models\Concerns\HasApprovals;
use App\Modules\Core\Services\ApprovalWorkflowService;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\ExchangeRateService;
use App\Modules\Core\Services\SequenceService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

test('a user can create a company and becomes its owner', function () {
    $user = User::factory()->create();
    $user->givePermissionTo(
        Permission::create(['name' => 'erp.company.create', 'guard_name' => 'web', 'module' => 'erp_core']),
        Permission::create(['name' => 'erp.company.access', 'guard_name' => 'web', 'module' => 'erp_core']),
        Permission::create(['name' => 'erp.company.view', 'guard_name' => 'web', 'module' => 'erp_core']),
    );

    $this->actingAs($user)
        ->post(route('erp.companies.store'), [
            'code' => 'tvf',
            'name' => 'Talen Vision Foods',
            'legal_name' => 'Talen Vision Foods (Private) Limited',
        ])
        ->assertRedirect(route('erp.companies.index'));

    $company = Company::query()->where('code', 'TVF')->firstOrFail();

    $this->assertDatabaseHas('company_user', [
        'company_id' => $company->id,
        'user_id' => $user->id,
        'role' => 'owner',
        'is_active' => true,
    ]);
    $this->assertDatabaseHas('audit_events', [
        'company_id' => $company->id,
        'actor_id' => $user->id,
        'event' => 'company.created',
        'subject_type' => Company::class,
        'subject_id' => (string) $company->id,
    ]);

    $this->assertEquals($company->id, session('active_erp_company_id'));

    $this->get('/erp')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Erp/Dashboard/Index')
            ->where('company.id', $company->id));
});

test('a user cannot enter a company they do not belong to', function () {
    $owner = User::factory()->create();
    $company = Company::create([
        'code' => 'TVF',
        'name' => 'Talen Vision Foods',
    ]);
    $company->users()->attach($owner->id, [
        'role' => 'owner',
        'is_active' => true,
    ]);

    $this->actingAs(User::factory()->create())
        ->withSession(['active_erp_company_id' => $company->id])
        ->get('/erp')
        ->assertForbidden();
});

test('inactive company memberships cannot access the ERP', function () {
    $user = User::factory()->create();
    $company = Company::create([
        'code' => 'TVF',
        'name' => 'Talen Vision Foods',
    ]);
    $company->users()->attach($user->id, [
        'role' => 'owner',
        'is_active' => false,
    ]);

    $this->actingAs($user)
        ->withSession(['active_erp_company_id' => $company->id])
        ->get('/erp')
        ->assertForbidden();
});

test('a company switch requires an active membership', function () {
    $member = User::factory()->create();
    $company = Company::create([
        'code' => 'TVF',
        'name' => 'Talen Vision Foods',
    ]);
    $company->users()->attach($member->id, [
        'role' => 'owner',
        'is_active' => true,
    ]);
    $member->givePermissionTo(
        Permission::create(['name' => 'erp.company.switch', 'guard_name' => 'web', 'module' => 'erp_core']),
    );

    $this->actingAs($member)
        ->post(route('erp.companies.switch', $company))
        ->assertRedirect();

    $this->assertEquals($company->id, session('active_erp_company_id'));

    $otherCompany = Company::create([
        'code' => 'OTHER',
        'name' => 'Other Company',
    ]);

    $this->post(route('erp.companies.switch', $otherCompany))
        ->assertForbidden();
});

test('company branding and signatories are associated with their company', function () {
    $company = Company::create([
        'code' => 'TVF',
        'name' => 'Talen Vision Foods',
    ]);

    $company->branding()->create([
        'primary_color' => '#123456',
        'bank_details' => ['bank' => 'Example Bank'],
    ]);
    $company->signatories()->create([
        'name' => 'Finance Director',
        'title' => 'Finance Director',
        'applies_to_document_type' => 'purchase_order',
    ]);

    $this->assertSame('#123456', $company->fresh()->branding->primary_color);
    $this->assertSame('Example Bank', $company->fresh()->branding->bank_details['bank']);
    $this->assertSame('Finance Director', $company->fresh()->signatories->first()->name);
});

test('company owners can update company document branding', function () {
    $user = User::factory()->create();
    $company = Company::create([
        'code' => 'TVF',
        'name' => 'Talen Vision Foods',
    ]);
    $company->users()->attach($user->id, [
        'role' => 'owner',
        'is_active' => true,
    ]);
    Currency::create(['name' => 'US Dollar', 'code' => 'USD', 'symbol' => '$']);

    $this->actingAs($user)
        ->withSession(['active_erp_company_id' => $company->id])
        ->patch(route('erp.settings.branding.update'), [
            'name' => 'Talen Vision Foods',
            'legal_name' => 'Talen Vision Foods (Private) Limited',
            'default_currency' => 'USD',
            'primary_color' => '#123456',
            'secondary_color' => '#234567',
            'accent_color' => '#345678',
            'letterhead_footer_text' => 'Harare, Zimbabwe',
        ])
        ->assertRedirect();

    $this->assertSame('#123456', $company->fresh()->branding->primary_color);
    $this->assertSame('#345678', $company->fresh()->branding->accent_color);
    $this->assertSame('Talen Vision Foods (Private) Limited', $company->fresh()->legal_name);
    $this->assertDatabaseHas('audit_events', [
        'company_id' => $company->id,
        'actor_id' => $user->id,
        'event' => 'company.settings.updated',
    ]);
});

test('company owners can manage document signatories', function () {
    Storage::fake('public');
    $user = User::factory()->create();
    $company = Company::create(['code' => 'TVF', 'name' => 'Talen Vision Foods']);
    $company->users()->attach($user->id, ['role' => 'owner', 'is_active' => true]);
    $signature = UploadedFile::fake()->image('signature.png');

    $this->actingAs($user)
        ->withSession(['active_erp_company_id' => $company->id])
        ->post(route('erp.settings.signatories.store'), [
            'user_id' => $user->id,
            'name' => 'Finance Manager',
            'title' => 'Finance Manager',
            'applies_to_document_type' => 'purchase_order',
            'approval_level' => 'Level 1',
            'is_active' => true,
            'sort_order' => 1,
            'signature' => $signature,
        ])
        ->assertRedirect();

    $signatory = $company->signatories()->firstOrFail();
    Storage::disk('public')->assertExists($signatory->signature_image_path);
    $this->assertSame('purchase_order', $signatory->applies_to_document_type);

    $this->patch(route('erp.settings.signatories.update', $signatory->id), [
        'user_id' => $user->id,
        'name' => 'Finance Director',
        'title' => 'Director',
        'applies_to_document_type' => '',
        'approval_level' => '',
        'is_active' => false,
        'sort_order' => 2,
    ])->assertRedirect();

    $this->assertSame('Finance Director', $signatory->fresh()->name);
    $this->assertSame($signatory->signature_image_path, $signatory->fresh()->signature_image_path);
    $this->assertDatabaseHas('audit_events', [
        'company_id' => $company->id,
        'actor_id' => $user->id,
        'event' => 'company.signatory.updated',
    ]);
});

test('company owners can configure approval workflows for active members', function () {
    $owner = User::factory()->create();
    $approver = User::factory()->create();
    $company = Company::create(['code' => 'TVF', 'name' => 'Talen Vision Foods']);
    $company->users()->attach($owner->id, ['role' => 'owner', 'is_active' => true]);
    $company->users()->attach($approver->id, ['role' => 'finance', 'is_active' => true]);
    Currency::create(['name' => 'US Dollar', 'code' => 'USD', 'symbol' => '$']);
    $workflowData = [
        'name' => 'Purchase approval',
        'approvable_type' => 'App\\Modules\\Purchase\\Models\\PurchaseOrder',
        'currency_code' => 'USD',
        'is_active' => true,
        'steps' => [[
            'approver_type' => 'role',
            'approver_id' => 'finance',
            'min_amount' => '100.0000',
            'max_amount' => null,
            'condition_json' => ['department' => 'finance'],
            'require_all' => false,
            'sla_hours' => 24,
        ]],
    ];

    $this->actingAs($owner)
        ->withSession(['active_erp_company_id' => $company->id])
        ->post(route('erp.approvals.workflows.store'), $workflowData)
        ->assertRedirect();

    $workflow = ApprovalWorkflow::query()->firstOrFail();
    $this->assertSame('finance', $workflow->steps->first()->approver_id);
    $this->assertSame('USD', $workflow->currency_code);

    $this->post(route('erp.approvals.workflows.store'), [
        ...$workflowData,
        'name' => 'Replacement purchase approval',
    ])->assertRedirect();

    $this->assertFalse($workflow->fresh()->is_active);
    $this->assertTrue(ApprovalWorkflow::query()->where('name', 'Replacement purchase approval')->firstOrFail()->is_active);
});

test('company-scoped models isolate records and prevent reassignment', function () {
    Schema::create('erp_company_scope_test_records', function (Blueprint $table) {
        $table->id();
        $table->foreignId('company_id')->constrained();
        $table->string('name');
        $table->timestamps();
    });

    $companyA = Company::create(['code' => 'A', 'name' => 'Company A']);
    $companyB = Company::create(['code' => 'B', 'name' => 'Company B']);
    $recordModel = new class extends Model
    {
        use BelongsToCompany;

        protected $table = 'erp_company_scope_test_records';

        protected $fillable = ['company_id', 'name'];
    };
    $modelClass = get_class($recordModel);
    $context = app(CompanyContext::class);
    $context->setActiveCompany($companyA);

    $record = $modelClass::create(['name' => 'Company A record']);

    $this->assertEquals($companyA->id, $record->company_id);

    $context->setActiveCompany($companyB);
    $this->assertSame(0, $modelClass::query()->count());

    expect(fn () => $record->forceFill(['company_id' => $companyB->id])->save())
        ->toThrow(AuthorizationException::class);
});

test('exchange rates are company-specific and resolve using the effective date', function () {
    $companyA = Company::create(['code' => 'A', 'name' => 'Company A']);
    $companyB = Company::create(['code' => 'B', 'name' => 'Company B']);
    Currency::create(['name' => 'US Dollar', 'code' => 'USD', 'symbol' => '$']);
    Currency::create(['name' => 'Zimbabwe Gold', 'code' => 'ZWG', 'symbol' => 'ZiG']);
    $context = app(CompanyContext::class);
    $service = app(ExchangeRateService::class);

    $context->setActiveCompany($companyA);
    $service->record('USD', 'ZWG', '25.0000000000', now()->subDay(), source: 'Finance');
    $service->record('USD', 'ZWG', '26.5000000000', now(), source: 'Finance');
    $selected = $service->rateFor('USD', 'ZWG', now());

    expect($selected?->rate)->toBe('26.5000000000');

    $context->setActiveCompany($companyB);
    expect($service->rateFor('USD', 'ZWG', now()))->toBeNull();
    $service->record('USD', 'ZWG', '27.0000000000', now(), source: 'Finance');

    expect($service->rateFor('USD', 'ZWG', now())?->rate)->toBe('27.0000000000');
    $this->assertDatabaseCount('exchange_rates', 3);
});

test('company owners can record exchange rates through the ERP', function () {
    $user = User::factory()->create();
    $company = Company::create(['code' => 'TVF', 'name' => 'Talen Vision Foods']);
    $company->users()->attach($user->id, ['role' => 'owner', 'is_active' => true]);
    Currency::create(['name' => 'US Dollar', 'code' => 'USD', 'symbol' => '$']);
    Currency::create(['name' => 'Zimbabwe Gold', 'code' => 'ZWG', 'symbol' => 'ZiG']);

    $this->actingAs($user)
        ->withSession(['active_erp_company_id' => $company->id])
        ->post(route('erp.settings.exchange-rates.store'), [
            'from_currency' => 'USD',
            'to_currency' => 'ZWG',
            'rate' => '25.5000000000',
            'effective_at' => now()->format('Y-m-d\TH:i'),
            'source' => 'Finance department',
        ])
        ->assertRedirect();

    $this->assertDatabaseHas('exchange_rates', [
        'company_id' => $company->id,
        'rate' => '25.5000000000',
        'source' => 'Finance department',
    ]);
    $this->assertDatabaseHas('audit_events', [
        'company_id' => $company->id,
        'actor_id' => $user->id,
        'event' => 'exchange_rate.created',
    ]);
});

test('document sequences increment independently for each company and year', function () {
    $companyA = Company::create(['code' => 'A', 'name' => 'Company A']);
    $companyB = Company::create(['code' => 'B', 'name' => 'Company B']);
    $context = app(CompanyContext::class);
    $service = app(SequenceService::class);

    $context->setActiveCompany($companyA);
    expect($service->next($companyA, 'invoice', fiscalYear: 2026))->toBe('A/INV/2026/00001');
    expect($service->next($companyA, 'invoice', fiscalYear: 2026))->toBe('A/INV/2026/00002');
    expect($service->next($companyA, 'invoice', fiscalYear: 2027))->toBe('A/INV/2027/00001');

    $context->setActiveCompany($companyB);
    expect($service->next($companyB, 'invoice', fiscalYear: 2026))->toBe('B/INV/2026/00001');

    expect(fn () => $service->next($companyA, 'invoice', fiscalYear: 2026))
        ->toThrow(AuthorizationException::class);
});

test('approval requests progress through steps and retain immutable signature snapshots', function () {
    Schema::create('erp_approval_test_documents', function (Blueprint $table) {
        $table->id();
        $table->foreignId('company_id')->constrained();
        $table->string('title');
        $table->timestamps();
    });

    $company = Company::create(['code' => 'TVF', 'name' => 'Talen Vision Foods']);
    $requester = User::factory()->create();
    $financeApprover = User::factory()->create();
    $directorApprover = User::factory()->create();

    $company->users()->attach($requester->id, ['role' => 'member', 'is_active' => true]);
    $company->users()->attach($financeApprover->id, ['role' => 'finance', 'is_active' => true]);
    $company->users()->attach($directorApprover->id, ['role' => 'director', 'is_active' => true]);

    $documentModel = new class extends Model
    {
        use BelongsToCompany;
        use HasApprovals;

        protected $table = 'erp_approval_test_documents';

        protected $fillable = ['company_id', 'title'];
    };
    $documentClass = get_class($documentModel);
    $context = app(CompanyContext::class);
    $context->setActiveCompany($company);
    $document = $documentClass::create(['title' => 'Purchase request']);

    $workflow = ApprovalWorkflow::create([
        'name' => 'Purchase workflow',
        'approvable_type' => $documentClass,
        'currency_code' => 'USD',
        'is_active' => true,
    ]);
    $firstStep = ApprovalWorkflowStep::create([
        'workflow_id' => $workflow->id,
        'step_order' => 1,
        'approver_type' => 'role',
        'approver_id' => 'finance',
        'min_amount' => '100.0000',
        'condition_json' => ['department_id' => 7],
    ]);
    ApprovalWorkflowStep::create([
        'workflow_id' => $workflow->id,
        'step_order' => 2,
        'approver_type' => 'user',
        'approver_id' => (string) $directorApprover->id,
    ]);
    $company->signatories()->create([
        'user_id' => $financeApprover->id,
        'name' => 'Finance Manager',
        'title' => 'Finance Manager',
        'signature_image_path' => 'signatures/finance.png',
    ]);

    $service = app(ApprovalWorkflowService::class);
    $approval = $service->submit($document, $requester, '150.0000', 'USD', ['department_id' => 7]);

    expect($approval->current_step)->toBe(1);
    expect($service->canAct($approval, $financeApprover))->toBeTrue();
    expect($service->canAct($approval, $requester))->toBeFalse();
    expect(fn () => $document->update(['title' => 'Changed while pending']))
        ->toThrow(ValidationException::class);

    $approval = $service->act($approval, $financeApprover, ApprovalActionType::Approve);
    expect($approval->current_step)->toBe(2);
    expect($approval->actions()->first()->signature_snapshot['name'])->toBe('Finance Manager');
    expect($approval->actions()->first()->signature_snapshot['signature_image_path'])->toBe('signatures/finance.png');

    $approval = $service->act($approval, $directorApprover, ApprovalActionType::Approve);
    expect($approval->status)->toBe(ApprovalStatus::Approved);
    expect($approval->completed_at)->not->toBeNull();

    $this->assertSame(2, $approval->actions()->count());
    $this->assertSame(1, $firstStep->step_order);
});

test('the branded PDF sample uses the active company branding', function () {
    $user = User::factory()->create();
    $company = Company::create([
        'code' => 'TVF',
        'name' => 'Talen Vision Foods',
        'legal_name' => 'Talen Vision Foods (Private) Limited',
    ]);
    $company->users()->attach($user->id, ['role' => 'owner', 'is_active' => true]);
    $user->givePermissionTo(
        Permission::create(['name' => 'erp.document.download', 'guard_name' => 'web', 'module' => 'erp_core']),
    );
    $company->branding()->create([
        'primary_color' => '#123456',
        'secondary_color' => '#234567',
        'accent_color' => '#345678',
        'letterhead_footer_text' => 'Company-specific footer',
    ]);

    $this->actingAs($user)
        ->withSession(['active_erp_company_id' => $company->id])
        ->get(route('erp.documents.sample'))
        ->assertOk()
        ->assertHeader('content-type', 'application/pdf');
});
