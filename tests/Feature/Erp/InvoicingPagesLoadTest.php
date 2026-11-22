<?php

use App\Models\Currency;
use App\Models\User;
use App\Modules\Core\Models\Company;
use App\Modules\Invoicing\Models\Customer;

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->company = Company::create(['code' => 'INV', 'name' => 'Invoicing Company', 'default_currency' => 'USD']);
    $this->company->users()->attach($this->user->id, ['role' => 'owner', 'is_active' => true]);
    $this->actingAs($this->user)->withSession(['active_erp_company_id' => $this->company->id]);
    $this->withoutExceptionHandling();
    Currency::query()->firstOrCreate(['code' => 'USD'], ['name' => 'US Dollar', 'symbol' => '$']);
});

function invoicingPage($response): string
{
    $component = $response->viewData('page')['component'];
    expect(resource_path("js/pages/{$component}.tsx"))->toBeFile();

    return $component;
}

/*
 * Every invoicing page without a record in its URL must render for a company owner.
 */
test('invoicing pages load for a company owner', function (string $routeName) {
    invoicingPage($this->get(route($routeName))->assertOk());
})->with([
    'erp.invoicing.index',
    'erp.invoicing.create',
    'erp.invoicing.credit-notes.index',
    'erp.invoicing.credit-notes.create',
    'erp.invoicing.customers.index',
    'erp.invoicing.customers.create',
    'erp.invoicing.payment-terms.index',
    'erp.invoicing.recurring.index',
    'erp.invoicing.recurring.create',
    'erp.invoicing.statements.index',
]);

test('a customer is created, viewed, edited, searched and deleted', function () {
    $this->post(route('erp.invoicing.customers.store'), [
        'code' => 'C001',
        'name' => 'Acme Mining',
        'email' => 'accounts@acme.test',
        'currency_code' => 'USD',
        'credit_limit' => 5000,
        'is_active' => true,
    ])->assertRedirect(route('erp.invoicing.customers.index'));

    $customer = Customer::query()->firstOrFail();
    expect($customer->company_id)->toBe($this->company->id);

    invoicingPage($this->get(route('erp.invoicing.customers.index', ['search' => 'Acme']))->assertOk()->assertSee('Acme Mining'));
    invoicingPage($this->get(route('erp.invoicing.customers.show', $customer))->assertOk());
    invoicingPage($this->get(route('erp.invoicing.customers.edit', $customer))->assertOk());

    // Saving with its own code must not trip the "code already used" rule.
    $this->put(route('erp.invoicing.customers.update', $customer), [
        'code' => 'C001',
        'name' => 'Acme Mining Ltd',
        'currency_code' => 'USD',
        'is_active' => true,
    ])->assertRedirect(route('erp.invoicing.customers.show', $customer));
    expect($customer->fresh()->name)->toBe('Acme Mining Ltd');

    // A second customer cannot reuse the code in the same company.
    $this->withExceptionHandling();
    $this->post(route('erp.invoicing.customers.store'), ['code' => 'C001', 'name' => 'Other', 'currency_code' => 'USD'])
        ->assertSessionHasErrors('code');
    $this->withoutExceptionHandling();

    // Another company may use the same code.
    $other = Company::create(['code' => 'OTH', 'name' => 'Other Company', 'default_currency' => 'USD']);
    $other->users()->attach($this->user->id, ['role' => 'owner', 'is_active' => true]);
    $this->withSession(['active_erp_company_id' => $other->id])
        ->post(route('erp.invoicing.customers.store'), ['code' => 'C001', 'name' => 'Other Acme', 'currency_code' => 'USD'])
        ->assertRedirect(route('erp.invoicing.customers.index'));
    expect(Customer::withoutGlobalScopes()->where('code', 'C001')->count())->toBe(2);
    $this->withSession(['active_erp_company_id' => $this->company->id]);

    $this->delete(route('erp.invoicing.customers.destroy', $customer))->assertRedirect(route('erp.invoicing.customers.index'));
    expect(Customer::query()->count())->toBe(0)
        ->and(Customer::withoutGlobalScopes()->whereNull('deleted_at')->count())->toBe(1);
});
