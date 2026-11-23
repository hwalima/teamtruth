<?php

use App\Models\Currency;
use App\Models\User;
use App\Modules\Core\Models\AuditEvent;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Invoicing\Models\Customer;
use App\Modules\Sales\Models\Lead;
use App\Modules\Sales\Models\Opportunity;
use App\Modules\Sales\Models\Quotation;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->user = User::factory()->create(['name' => 'Sam Seller', 'email' => 'seller@example.test']);
    $this->company = Company::create(['code' => 'SMP', 'name' => 'Sample Mining', 'default_currency' => 'USD']);
    $this->company->users()->attach($this->user->id, ['role' => 'owner', 'is_active' => true]);
    Currency::firstOrCreate(['code' => 'USD'], ['name' => 'US Dollar', 'symbol' => '$']);
    $this->actingAs($this->user)->withSession(['active_erp_company_id' => $this->company->id]);
    app(CompanyContext::class)->setActiveCompany($this->company);
    $this->customer = Customer::create(['code' => 'C-1', 'name' => 'Beta Construction', 'currency_code' => 'USD', 'is_active' => true]);
});

test('the lead list filters by status and searches contacts', function () {
    Lead::create(['name' => 'Acme Quarries', 'contact_person' => 'Pat Example', 'email' => 'pat@acme.example.test', 'status' => 'new']);
    Lead::create(['name' => 'Delta Haulage', 'phone' => '555-0101', 'status' => 'qualified']);
    Lead::create(['name' => 'Gamma Tools', 'status' => 'lost']);

    $this->get(route('erp.sales.leads.index'))->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('Erp/Sales/Leads/Index')
        ->has('leads.data', 3)
        ->where('counts.new', 1)->where('counts.qualified', 1)->where('counts.lost', 1)->where('counts.converted', 0)
        ->has('members', 1)->has('customers', 1));

    $this->get(route('erp.sales.leads.index', ['search' => 'pat@acme']))->assertInertia(fn (Assert $page) => $page
        ->has('leads.data', 1)->where('leads.data.0.name', 'Acme Quarries'));
    $this->get(route('erp.sales.leads.index', ['status' => 'qualified']))->assertInertia(fn (Assert $page) => $page
        ->has('leads.data', 1)->where('leads.data.0.name', 'Delta Haulage'));
});

test('a lead can be edited, qualified, lost, reopened and deleted', function () {
    $this->post(route('erp.sales.leads.store'), ['name' => 'Acme Quarries', 'source' => 'Referral'])->assertSessionHasNoErrors();
    $lead = Lead::query()->sole();

    $this->put(route('erp.sales.leads.update', $lead), ['name' => 'Acme Quarries Ltd', 'contact_person' => 'Pat Example', 'assigned_to' => $this->user->id])
        ->assertSessionHasNoErrors();
    expect($lead->fresh())->name->toBe('Acme Quarries Ltd')->contact_person->toBe('Pat Example')->assigned_to->toBe($this->user->id);

    $this->post(route('erp.sales.leads.status', $lead), ['status' => 'qualified'])->assertSessionHasNoErrors();
    expect($lead->fresh()->status)->toBe('qualified');
    $this->post(route('erp.sales.leads.status', $lead), ['status' => 'lost']);
    expect($lead->fresh()->status)->toBe('lost');
    $this->post(route('erp.sales.leads.status', $lead), ['status' => 'new']);
    expect($lead->fresh()->status)->toBe('new');
    $this->post(route('erp.sales.leads.status', $lead), ['status' => 'converted'])->assertSessionHasErrors('status');

    $outsider = User::factory()->create();
    $this->put(route('erp.sales.leads.update', $lead), ['name' => 'Acme', 'assigned_to' => $outsider->id])->assertSessionHasErrors('assigned_to');

    $this->delete(route('erp.sales.leads.destroy', $lead))->assertSessionHasNoErrors();
    expect(Lead::query()->count())->toBe(0)
        ->and(AuditEvent::query()->where('event', 'sales.lead.deleted')->exists())->toBeTrue();
});

test('converting a lead makes an opportunity and locks the lead', function () {
    $lead = Lead::create(['name' => 'Acme Quarries', 'status' => 'qualified']);

    $this->post(route('erp.sales.leads.convert', $lead), [
        'title' => 'Acme drilling contract', 'customer_id' => $this->customer->id, 'expected_value' => '12000', 'probability' => 60, 'close_date' => '2026-12-15',
    ])->assertRedirect(route('erp.sales.opportunities.index'));

    $opportunity = Opportunity::query()->sole();
    expect($opportunity)->lead_id->toBe($lead->id)->customer_id->toBe($this->customer->id)->probability->toBe(60)
        ->and($lead->fresh()->status)->toBe('converted');

    $this->put(route('erp.sales.leads.update', $lead), ['name' => 'Changed'])->assertSessionHasErrors('lead');
    $this->post(route('erp.sales.leads.status', $lead), ['status' => 'lost'])->assertSessionHasErrors('lead');
    $this->delete(route('erp.sales.leads.destroy', $lead))->assertSessionHasErrors('lead');
    expect($lead->fresh())->name->toBe('Acme Quarries')->status->toBe('converted');
});

test('the opportunity list shows open deals first with pipeline totals', function () {
    Opportunity::create(['title' => 'Drilling contract', 'customer_id' => $this->customer->id, 'expected_value' => '10000', 'probability' => 50, 'status' => 'open']);
    Opportunity::create(['title' => 'Haulage deal', 'expected_value' => '4000', 'probability' => 25, 'status' => 'open']);
    Opportunity::create(['title' => 'Old tender', 'expected_value' => '3000', 'probability' => 100, 'status' => 'won']);

    $this->get(route('erp.sales.opportunities.index'))->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('Erp/Sales/Opportunities/Index')
        ->where('filters.status', 'open')
        ->has('opportunities.data', 2)
        ->where('counts.open', 2)->where('counts.won', 1)->where('counts.lost', 0)
        ->where('pipeline.open_value', fn ($value) => (float) $value === 14000.0)
        ->where('pipeline.weighted_value', fn ($value) => (float) $value === 6000.0)
        ->where('pipeline.won_value', fn ($value) => (float) $value === 3000.0));

    $this->get(route('erp.sales.opportunities.index', ['status' => 'all', 'search' => 'Beta']))->assertInertia(fn (Assert $page) => $page
        ->has('opportunities.data', 1)->where('opportunities.data.0.title', 'Drilling contract'));
});

test('an opportunity can be added, edited, won, reopened, lost and deleted', function () {
    $this->post(route('erp.sales.opportunities.store'), ['title' => 'Drilling contract', 'expected_value' => '10000', 'probability' => 40])
        ->assertSessionHasNoErrors();
    $opportunity = Opportunity::query()->sole();

    $this->put(route('erp.sales.opportunities.update', $opportunity), [
        'title' => 'Drilling contract phase 1', 'customer_id' => $this->customer->id, 'expected_value' => '8000', 'probability' => 70, 'close_date' => '2026-12-20',
    ])->assertSessionHasNoErrors();
    expect($opportunity->fresh())->title->toBe('Drilling contract phase 1')->customer_id->toBe($this->customer->id)->probability->toBe(70);

    $this->post(route('erp.sales.opportunities.status', $opportunity), ['status' => 'won'])->assertSessionHasNoErrors();
    expect($opportunity->fresh())->status->toBe('won')->probability->toBe(100);
    $this->put(route('erp.sales.opportunities.update', $opportunity), ['title' => 'Too late'])->assertSessionHasErrors('opportunity');

    $this->post(route('erp.sales.opportunities.status', $opportunity), ['status' => 'open']);
    $this->post(route('erp.sales.opportunities.status', $opportunity), ['status' => 'lost']);
    expect($opportunity->fresh())->status->toBe('lost')->probability->toBe(0);

    $this->delete(route('erp.sales.opportunities.destroy', $opportunity))->assertSessionHasNoErrors();
    expect(Opportunity::query()->count())->toBe(0);
});

test('an opportunity with a quotation is kept', function () {
    $opportunity = Opportunity::create(['title' => 'Drilling contract', 'customer_id' => $this->customer->id, 'expected_value' => '10000', 'status' => 'open']);
    Quotation::create([
        'customer_id' => $this->customer->id, 'opportunity_id' => $opportunity->id, 'document_number' => 'SMP/SQ/0001', 'status' => 'draft',
        'currency_code' => 'USD', 'subtotal' => '0', 'total' => '0', 'created_by' => $this->user->id,
    ]);

    $this->delete(route('erp.sales.opportunities.destroy', $opportunity))->assertSessionHasErrors('opportunity');
    expect(Opportunity::query()->count())->toBe(1);
});

test('the sales overview counts each step', function () {
    Lead::create(['name' => 'Acme Quarries', 'status' => 'new']);
    Lead::create(['name' => 'Gamma Tools', 'status' => 'lost']);
    Opportunity::create(['title' => 'Drilling contract', 'expected_value' => '10000', 'status' => 'open']);

    $this->get(route('erp.sales.index'))->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('Erp/Sales/Index')
        ->where('stats.leads_open', 1)
        ->where('stats.opportunities_open', 1)
        ->where('stats.pipeline_value', fn ($value) => (float) $value === 10000.0));
});

test('members without sales rights cannot change leads or opportunities', function () {
    $lead = Lead::create(['name' => 'Acme Quarries', 'status' => 'new']);
    $opportunity = Opportunity::create(['title' => 'Drilling contract', 'expected_value' => '10000', 'status' => 'open']);
    $member = User::factory()->create();
    $this->company->users()->attach($member->id, ['role' => 'member', 'is_active' => true]);
    $this->actingAs($member);

    $this->get(route('erp.sales.leads.index'))->assertForbidden();
    $this->put(route('erp.sales.leads.update', $lead), ['name' => 'Changed'])->assertForbidden();
    $this->post(route('erp.sales.leads.status', $lead), ['status' => 'lost'])->assertForbidden();
    $this->delete(route('erp.sales.leads.destroy', $lead))->assertForbidden();
    $this->put(route('erp.sales.opportunities.update', $opportunity), ['title' => 'Changed'])->assertForbidden();
    $this->post(route('erp.sales.opportunities.status', $opportunity), ['status' => 'won'])->assertForbidden();
    $this->delete(route('erp.sales.opportunities.destroy', $opportunity))->assertForbidden();
});

test('leads and opportunities from another company cannot be touched', function () {
    $lead = Lead::create(['name' => 'Acme Quarries', 'status' => 'new']);
    $opportunity = Opportunity::create(['title' => 'Drilling contract', 'expected_value' => '10000', 'status' => 'open']);
    $other = Company::create(['code' => 'OTH', 'name' => 'Other Co', 'default_currency' => 'USD']);
    $other->users()->attach($this->user->id, ['role' => 'owner', 'is_active' => true]);
    $this->withSession(['active_erp_company_id' => $other->id]);

    $this->put(route('erp.sales.leads.update', $lead), ['name' => 'Changed'])->assertNotFound();
    $this->delete(route('erp.sales.opportunities.destroy', $opportunity))->assertNotFound();
    expect($lead->fresh()->name)->toBe('Acme Quarries')->and(Opportunity::query()->withoutGlobalScopes()->count())->toBe(1);
});
