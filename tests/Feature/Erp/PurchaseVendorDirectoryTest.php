<?php

use App\Models\Currency;
use App\Models\User;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Purchase\Models\PurchaseBill;
use App\Modules\Purchase\Models\PurchaseVendor;
use Inertia\Testing\AssertableInertia as Assert;

function vendorDirectoryFixture(string $code = 'VDR'): array
{
    $user = User::factory()->create();
    $company = Company::create(['code' => $code, 'name' => 'Sample Mining', 'default_currency' => 'USD']);
    $company->users()->attach($user->id, ['role' => 'owner', 'is_active' => true]);
    Currency::firstOrCreate(['code' => 'USD'], ['name' => 'US Dollar', 'symbol' => '$']);

    app(CompanyContext::class)->setActiveCompany($company);
    $acme = PurchaseVendor::create(['code' => 'V-0001', 'name' => 'Acme Drilling', 'email' => 'accounts@acme.example.test', 'payment_terms_days' => 30, 'is_active' => true]);
    $beta = PurchaseVendor::create(['code' => 'V-0002', 'name' => 'Beta Fuel Supplies', 'tax_no' => '2000111', 'payment_terms_days' => 14, 'is_active' => true]);
    $old = PurchaseVendor::create(['code' => 'V-0003', 'name' => 'Old Hardware', 'payment_terms_days' => 0, 'is_active' => false]);
    PurchaseBill::create([
        'document_number' => 'BILL-1', 'vendor_id' => $acme->id, 'status' => 'partially_paid', 'currency_code' => 'USD',
        'total_amount' => '500', 'amount_paid' => '200', 'amount_residual' => '300', 'bill_date' => '2026-10-01', 'due_date' => '2026-10-31',
        'created_by' => $user->id,
    ]);
    PurchaseBill::create([
        'document_number' => 'BILL-2', 'vendor_id' => $acme->id, 'status' => 'draft', 'currency_code' => 'USD',
        'total_amount' => '900', 'amount_residual' => '900', 'bill_date' => '2026-11-01', 'created_by' => $user->id,
    ]);
    app(CompanyContext::class)->setActiveCompany(null);

    return [$user, $company, $acme, $beta, $old];
}

test('the vendor directory lists, searches and filters vendors with what is owed', function () {
    [$user, $company, $acme] = vendorDirectoryFixture();
    $this->actingAs($user)->withSession(['active_erp_company_id' => $company->id]);

    $this->get(route('erp.purchase.vendors.index'))->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('Erp/Purchase/Vendors/Index')
        ->has('vendors.data', 2)
        ->where('vendors.data.0.name', 'Acme Drilling')
        ->where('vendors.data.0.owed.USD', fn ($amount) => (float) $amount === 300.0)
        ->where('counts', ['active' => 2, 'inactive' => 1])
        ->where('nextCode', 'V-0004'));

    $this->get(route('erp.purchase.vendors.index', ['search' => '2000111']))->assertInertia(fn (Assert $page) => $page
        ->has('vendors.data', 1)->where('vendors.data.0.name', 'Beta Fuel Supplies'));

    $this->get(route('erp.purchase.vendors.index', ['status' => 'inactive']))->assertInertia(fn (Assert $page) => $page
        ->has('vendors.data', 1)->where('vendors.data.0.name', 'Old Hardware'));

    $this->get(route('erp.purchase.vendors.show', $acme))->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('Erp/Purchase/Vendors/Show')
        ->where('vendor.name', 'Acme Drilling')
        ->where('stats.bills', 2)
        ->where('stats.owed.USD', fn ($amount) => (float) $amount === 300.0)
        ->has('bills', 2)
        ->where('canDelete', false));
});

test('vendors can be added, edited, deactivated and reactivated', function () {
    [$user, $company, $acme, $beta] = vendorDirectoryFixture();
    $this->actingAs($user)->withSession(['active_erp_company_id' => $company->id]);

    $this->post(route('erp.purchase.vendors.store'), [
        'code' => 'V-0004', 'name' => 'Gamma Explosives', 'email' => ' sales@gamma.example.test ', 'payment_terms_days' => 7, 'currency_code' => 'USD',
    ])->assertRedirect()->assertSessionHas('success');
    $gamma = PurchaseVendor::query()->withoutGlobalScopes()->where('code', 'V-0004')->firstOrFail();
    expect($gamma->email)->toBe('sales@gamma.example.test')->and($gamma->is_active)->toBeTrue();

    $this->post(route('erp.purchase.vendors.store'), ['code' => 'V-0001', 'name' => 'Duplicate', 'payment_terms_days' => 0])
        ->assertSessionHasErrors('code');

    $this->put(route('erp.purchase.vendors.update', $beta), [
        'code' => 'V-0002', 'name' => 'Beta Fuel', 'tax_no' => '2000111', 'phone' => '+263 77 000 0000', 'payment_terms_days' => 45,
    ])->assertRedirect()->assertSessionHas('success');
    expect($beta->fresh())->name->toBe('Beta Fuel')->payment_terms_days->toBe(45)->phone->toBe('+263 77 000 0000');

    $this->put(route('erp.purchase.vendors.update', $beta), ['code' => 'V-0001', 'name' => 'Beta Fuel', 'payment_terms_days' => 45])
        ->assertSessionHasErrors('code');

    $this->post(route('erp.purchase.vendors.toggle', $acme))->assertSessionHas('success');
    expect($acme->fresh()->is_active)->toBeFalse();
    $this->post(route('erp.purchase.vendors.toggle', $acme));
    expect($acme->fresh()->is_active)->toBeTrue();
});

test('only vendors with no history can be deleted', function () {
    [$user, $company, $acme, $beta] = vendorDirectoryFixture();
    $this->actingAs($user)->withSession(['active_erp_company_id' => $company->id]);

    $this->delete(route('erp.purchase.vendors.destroy', $acme))->assertRedirect()->assertSessionHas('error');
    expect(PurchaseVendor::query()->withoutGlobalScopes()->whereKey($acme->id)->exists())->toBeTrue();

    $this->delete(route('erp.purchase.vendors.destroy', $beta))->assertRedirect(route('erp.purchase.vendors.index'));
    expect(PurchaseVendor::query()->withoutGlobalScopes()->whereKey($beta->id)->exists())->toBeFalse();
});

test('another company cannot open or change a vendor', function () {
    [, , $acme] = vendorDirectoryFixture('VDA');
    [$otherUser, $otherCompany] = vendorDirectoryFixture('VDB');
    $this->actingAs($otherUser)->withSession(['active_erp_company_id' => $otherCompany->id]);

    $this->get(route('erp.purchase.vendors.show', $acme))->assertNotFound();
    $this->post(route('erp.purchase.vendors.toggle', $acme))->assertNotFound();
    expect($acme->fresh()->is_active)->toBeTrue();
});

test('the vendor list exports to PDF with the same filters as the screen', function () {
    [$user, $company] = vendorDirectoryFixture();
    $this->actingAs($user)->withSession(['active_erp_company_id' => $company->id]);

    $response = $this->get(route('erp.purchase.vendors.pdf', ['search' => 'acme']))->assertOk();
    expect($response->headers->get('Content-Type'))->toBe('application/pdf')
        ->and($response->headers->get('Content-Disposition'))->toContain('vendors-vdr-')
        ->and(substr($response->getContent(), 0, 4))->toBe('%PDF');

    $this->get(route('erp.purchase.vendors.pdf', ['status' => 'all']))->assertOk();
    $this->get(route('erp.purchase.vendors.pdf', ['status' => 'nonsense']))->assertSessionHasErrors('status');
});
