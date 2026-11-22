<?php

use App\Models\Currency;
use App\Models\User;
use App\Modules\Core\Models\AuditEvent;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Inventory\Models\InventoryProduct;
use App\Modules\Inventory\Models\InventoryUnit;
use App\Modules\Invoicing\Models\Customer;
use App\Modules\Sales\Mail\QuotationMail;
use App\Modules\Sales\Models\Lead;
use App\Modules\Sales\Models\Quotation;
use Illuminate\Mail\Attachment;
use Illuminate\Support\Facades\Mail;

beforeEach(function () {
    $this->user = User::factory()->create(['name' => 'Sam Seller', 'email' => 'seller@example.test']);
    $this->company = Company::create(['code' => 'SMP', 'name' => 'Sample Mining', 'default_currency' => 'USD']);
    $this->company->users()->attach($this->user->id, ['role' => 'owner', 'is_active' => true]);
    Currency::firstOrCreate(['code' => 'USD'], ['name' => 'US Dollar', 'symbol' => '$']);
    $this->actingAs($this->user)->withSession(['active_erp_company_id' => $this->company->id]);
    app(CompanyContext::class)->setActiveCompany($this->company);

    $unit = InventoryUnit::create(['name' => 'Each', 'abbreviation' => 'ea', 'category' => 'quantity', 'factor_to_base' => '1', 'is_base' => true, 'is_active' => true]);
    $this->product = InventoryProduct::create(['unit_id' => $unit->id, 'sku' => 'DRL-1', 'name' => 'Drill bit', 'type' => 'storable', 'costing_method' => 'average', 'tracking' => 'none', 'sale_price' => '80.0000', 'is_active' => true]);
    $this->customer = Customer::create(['code' => 'C-1', 'name' => 'Beta Construction', 'email' => 'buying@beta.example.test', 'currency_code' => 'USD', 'is_active' => true]);
});

function quotationPayload(array $overrides = []): array
{
    return array_merge([
        'customer_id' => test()->customer->id,
        'currency_code' => 'USD',
        'valid_until' => '2026-12-31',
        'notes' => 'Prices include delivery to site.',
        'terms' => '50% deposit with order.',
        'lines' => [
            ['product_id' => test()->product->id, 'description' => 'Drill bit', 'quantity' => '10', 'unit_price' => '80', 'discount' => '5', 'tax_rate' => '15', 'sort_order' => 1],
            ['product_id' => null, 'description' => 'Site installation', 'quantity' => '1', 'unit_price' => '200', 'discount' => '0', 'tax_rate' => '0', 'sort_order' => 2],
        ],
    ], $overrides);
}

function approvedQuotation(): Quotation
{
    $quotation = Quotation::create([
        'customer_id' => test()->customer->id, 'document_number' => 'SMP/QT/0001', 'status' => 'approved',
        'currency_code' => 'USD', 'subtotal' => '160.0000', 'total' => '160.0000', 'created_by' => test()->user->id,
        'approved_at' => now(), 'valid_until' => '2026-12-31',
    ]);
    $quotation->lines()->create([
        'product_id' => test()->product->id, 'description' => 'Drill bit', 'quantity' => '2', 'unit_price' => '80',
        'discount' => '0', 'tax_rate' => '0', 'total' => '160.0000', 'sort_order' => 1,
    ]);

    return $quotation;
}

test('a quotation with several lines is saved as a draft and opens on its own page', function () {
    $response = $this->post(route('erp.sales.quotations.store'), quotationPayload());

    $quotation = Quotation::query()->with('lines')->sole();
    $response->assertRedirect(route('erp.sales.quotations.show', $quotation));

    // 10 × 80 = 800, less 5% = 760, plus 15% tax = 874; the second line adds 200.
    expect($quotation->status)->toBe('draft')
        ->and($quotation->lines)->toHaveCount(2)
        ->and($quotation->lines->pluck('description')->all())->toBe(['Drill bit', 'Site installation'])
        ->and($quotation->discount_total)->toBe('40.0000')
        ->and($quotation->subtotal)->toBe('960.0000')
        ->and($quotation->tax_total)->toBe('114.0000')
        ->and($quotation->total)->toBe('1074.0000')
        ->and($quotation->notes)->toBe('Prices include delivery to site.')
        ->and($quotation->terms)->toBe('50% deposit with order.')
        ->and(AuditEvent::query()->where('event', 'sales.quotation.created')->count())->toBe(1);

    $this->get(route('erp.sales.quotations.show', $quotation))->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Erp/Sales/Quotations/Show')
            ->where('quotation.document_number', $quotation->document_number)
            ->where('quotation.customer.name', 'Beta Construction')
            ->has('quotation.lines', 2)
            ->where('canSend', false));
});

test('a quotation needs at least one line with a positive quantity', function () {
    $this->post(route('erp.sales.quotations.store'), quotationPayload(['lines' => []]))
        ->assertSessionHasErrors('lines');
    $this->post(route('erp.sales.quotations.store'), quotationPayload(['lines' => [
        ['description' => 'Nothing', 'quantity' => '0', 'unit_price' => '10'],
    ]]))->assertSessionHasErrors('lines.0.quantity');

    expect(Quotation::query()->count())->toBe(0);
});

test('the quotation list searches by number or customer and filters by status', function () {
    approvedQuotation();
    $this->post(route('erp.sales.quotations.store'), quotationPayload());
    $other = Customer::create(['code' => 'C-2', 'name' => 'Delta Holdings', 'currency_code' => 'USD', 'is_active' => true]);
    $this->post(route('erp.sales.quotations.store'), quotationPayload(['customer_id' => $other->id]));

    $this->get(route('erp.sales.quotations.index'))->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Erp/Sales/Quotations/Index')
            ->has('quotations.data', 3)
            ->where('counts.draft', 2)
            ->where('counts.approved', 1));

    $this->get(route('erp.sales.quotations.index', ['search' => 'Delta']))
        ->assertInertia(fn ($page) => $page->has('quotations.data', 1)->where('quotations.data.0.customer.name', 'Delta Holdings'));

    $this->get(route('erp.sales.quotations.index', ['search' => 'QT/0001']))
        ->assertInertia(fn ($page) => $page->has('quotations.data', 1)->where('quotations.data.0.document_number', 'SMP/QT/0001'));

    $this->get(route('erp.sales.quotations.index', ['status' => 'approved']))
        ->assertInertia(fn ($page) => $page->has('quotations.data', 1)->where('filters.status', 'approved'));

    $this->get(route('erp.sales.quotations.create'))->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Erp/Sales/Quotations/Create')
            ->where('products.0.sku', 'DRL-1')
            ->where('customers.0.name', 'Beta Construction'));
});

test('submitting without an approval workflow explains why and leaves the draft alone', function () {
    $this->post(route('erp.sales.quotations.store'), quotationPayload());
    $quotation = Quotation::query()->sole();

    $this->post(route('erp.sales.quotations.submit', $quotation))->assertSessionHasErrors('approval');

    expect($quotation->fresh()->status)->toBe('draft');
});

test('the quotation downloads as a branded PDF', function () {
    $quotation = approvedQuotation();

    $response = $this->get(route('erp.sales.quotations.pdf', $quotation))->assertOk()
        ->assertHeader('Content-Type', 'application/pdf');

    expect($response->headers->get('Content-Disposition'))->toContain('quotation-SMP-QT-0001.pdf')
        ->and(substr($response->getContent(), 0, 4))->toBe('%PDF');
});

test('an approved quotation is emailed to the customer with the PDF, and the send is recorded', function () {
    Mail::fake();
    $quotation = approvedQuotation();

    $this->post(route('erp.sales.quotations.send', $quotation), ['email' => 'buying@beta.example.test', 'message' => 'Happy to discuss volumes.'])
        ->assertSessionHasNoErrors()
        ->assertSessionHas('success');

    Mail::assertSent(QuotationMail::class, function (QuotationMail $mail) {
        expect($mail->hasTo('buying@beta.example.test'))->toBeTrue()
            ->and($mail->hasReplyTo('seller@example.test'))->toBeTrue()
            ->and(array_map(fn (Attachment $file) => [$file->as, $file->mime], $mail->attachments()))->toBe([['quotation-SMP-QT-0001.pdf', 'application/pdf']])
            ->and(substr($mail->pdf, 0, 4))->toBe('%PDF')
            ->and($mail->render())->toContain('Happy to discuss volumes.');

        return true;
    });
    $quotation->refresh();
    expect($quotation->sent_to)->toBe('buying@beta.example.test')
        ->and($quotation->sent_at)->not->toBeNull()
        ->and(AuditEvent::query()->where('event', 'sales.quotation.sent')->count())->toBe(1);

    $this->get(route('erp.sales.quotations.show', $quotation))
        ->assertInertia(fn ($page) => $page->where('canSend', true)->where('quotation.sent_to', 'buying@beta.example.test'));
});

test('draft quotations cannot be sent, and sending needs sales management rights', function () {
    Mail::fake();
    $quotation = approvedQuotation();
    $quotation->update(['status' => 'draft']);
    $this->post(route('erp.sales.quotations.send', $quotation), ['email' => 'buying@beta.example.test'])
        ->assertSessionHasErrors('email');
    $this->post(route('erp.sales.quotations.send', $quotation), ['email' => 'not-an-email'])
        ->assertSessionHasErrors('email');

    $quotation->update(['status' => 'approved']);
    $member = User::factory()->create();
    $this->company->users()->attach($member->id, ['role' => 'member', 'is_active' => true]);
    $this->actingAs($member)->post(route('erp.sales.quotations.send', $quotation), ['email' => 'buying@beta.example.test'])
        ->assertForbidden();

    Mail::assertNothingSent();
});

test('an approved quotation becomes a sales order from its page', function () {
    $quotation = approvedQuotation();

    $this->post(route('erp.sales.quotations.orders.store', $quotation))->assertSessionHas('success');

    expect($quotation->fresh()->status)->toBe('converted')
        ->and($quotation->salesOrders()->count())->toBe(1)
        ->and($quotation->salesOrders()->first()->lines()->count())->toBe(1);
});

test('a quotation from another company cannot be opened', function () {
    $quotation = approvedQuotation();
    $other = Company::create(['code' => 'OTH', 'name' => 'Other Co', 'default_currency' => 'USD']);
    $other->users()->attach($this->user->id, ['role' => 'owner', 'is_active' => true]);

    $this->withSession(['active_erp_company_id' => $other->id])->get(route('erp.sales.quotations.show', $quotation))->assertNotFound();
    $this->withSession(['active_erp_company_id' => $other->id])->get(route('erp.sales.quotations.pdf', $quotation))->assertNotFound();
});

test('sales managers can add leads from the sales page, members cannot', function () {
    $this->post(route('erp.sales.leads.store'), ['name' => 'Acme Prospect'])->assertSessionHasNoErrors()->assertSessionHas('success');

    $member = User::factory()->create();
    $this->company->users()->attach($member->id, ['role' => 'member', 'is_active' => true]);
    $this->actingAs($member)->post(route('erp.sales.leads.store'), ['name' => 'Beta Prospect'])->assertForbidden();

    expect(Lead::query()->pluck('name')->all())->toBe(['Acme Prospect']);
});

test('a draft quotation can be edited, and its lines and totals are replaced', function () {
    $this->post(route('erp.sales.quotations.store'), quotationPayload());
    $quotation = Quotation::query()->sole();

    $this->get(route('erp.sales.quotations.edit', $quotation))->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Erp/Sales/Quotations/Create')
            ->where('quotation.id', $quotation->id)
            ->has('quotation.lines', 2));

    $this->put(route('erp.sales.quotations.update', $quotation), quotationPayload([
        'notes' => 'Revised offer.',
        'lines' => [['product_id' => null, 'description' => 'Survey', 'quantity' => '2', 'unit_price' => '150', 'discount' => '0', 'tax_rate' => '10']],
    ]))->assertRedirect(route('erp.sales.quotations.show', $quotation));

    $quotation->refresh()->load('lines');
    expect($quotation->lines)->toHaveCount(1)
        ->and($quotation->lines->first()->description)->toBe('Survey')
        ->and($quotation->total)->toBe('330.0000')
        ->and($quotation->notes)->toBe('Revised offer.')
        ->and($quotation->document_number)->toContain('SALES_QUOTATION')
        ->and(AuditEvent::query()->where('event', 'sales.quotation.updated')->count())->toBe(1);
});

test('only drafts can be edited', function () {
    $quotation = approvedQuotation();

    $this->get(route('erp.sales.quotations.edit', $quotation))
        ->assertRedirect(route('erp.sales.quotations.show', $quotation))
        ->assertSessionHasErrors('quotation');
    $this->put(route('erp.sales.quotations.update', $quotation), quotationPayload())
        ->assertSessionHasErrors('quotation');

    expect($quotation->fresh()->total)->toBe('160.0000');
});

test('a draft quotation can be deleted, one with an order is kept', function () {
    $this->post(route('erp.sales.quotations.store'), quotationPayload());
    $draft = Quotation::query()->sole();

    $this->delete(route('erp.sales.quotations.destroy', $draft))
        ->assertRedirect(route('erp.sales.quotations.index'))
        ->assertSessionHas('success');
    expect(Quotation::query()->count())->toBe(0)
        ->and(\App\Modules\Sales\Models\QuotationLine::query()->count())->toBe(0)
        ->and(AuditEvent::query()->where('event', 'sales.quotation.deleted')->count())->toBe(1);

    $ordered = approvedQuotation();
    $this->post(route('erp.sales.quotations.orders.store', $ordered));
    $this->delete(route('erp.sales.quotations.destroy', $ordered))->assertSessionHasErrors('quotation');
    expect($ordered->fresh())->not->toBeNull();
});

test('cancelling a quotation waiting for approval withdraws the approval', function () {
    $quotation = approvedQuotation();
    $quotation->forceFill(['status' => 'pending_approval'])->saveQuietly();
    $workflow = \App\Modules\Core\Models\ApprovalWorkflow::create(['name' => 'Quotation approvals', 'approvable_type' => Quotation::class, 'is_active' => true]);
    $request = \App\Modules\Core\Models\ApprovalRequest::create([
        'company_id' => $this->company->id, 'approvable_type' => $quotation->getMorphClass(), 'approvable_id' => $quotation->id,
        'workflow_id' => $workflow->id, 'status' => 'pending', 'current_step' => 1, 'amount' => '160', 'currency_code' => 'USD',
        'requested_by' => $this->user->id, 'submitted_at' => now(),
    ]);

    $this->get(route('erp.sales.quotations.index'))->assertInertia(fn ($page) => $page
        ->where('quotations.data.0.can_cancel', true)
        ->where('quotations.data.0.can_delete', false)
        ->where('quotations.data.0.can_edit', false));

    $this->post(route('erp.sales.quotations.cancel', $quotation))->assertSessionHasNoErrors()->assertSessionHas('success');

    expect($quotation->fresh()->status)->toBe('cancelled')
        ->and($request->fresh()->status)->toBe(\App\Modules\Core\Enums\ApprovalStatus::Cancelled)
        ->and(AuditEvent::query()->where('event', 'sales.quotation.cancelled')->count())->toBe(1);

    // It has approval history, so it is kept rather than deleted, and it cannot be cancelled twice.
    $this->delete(route('erp.sales.quotations.destroy', $quotation))->assertSessionHasErrors('quotation');
    $this->post(route('erp.sales.quotations.cancel', $quotation))->assertSessionHasErrors('quotation');
});

test('duplicating a quotation makes a new draft with the same lines', function () {
    $quotation = approvedQuotation();

    $response = $this->post(route('erp.sales.quotations.duplicate', $quotation));

    $copy = Quotation::query()->whereKeyNot($quotation->id)->with('lines')->sole();
    $response->assertRedirect(route('erp.sales.quotations.show', $copy));
    expect($copy->status)->toBe('draft')
        ->and($copy->document_number)->not->toBe($quotation->document_number)
        ->and($copy->customer_id)->toBe($quotation->customer_id)
        ->and($copy->lines)->toHaveCount(1)
        ->and($copy->total)->toBe('160.0000');
});

test('members cannot edit, cancel, duplicate or delete quotations', function () {
    $this->post(route('erp.sales.quotations.store'), quotationPayload());
    $quotation = Quotation::query()->sole();
    $member = User::factory()->create();
    $this->company->users()->attach($member->id, ['role' => 'member', 'is_active' => true]);
    $this->actingAs($member);

    $this->get(route('erp.sales.quotations.edit', $quotation))->assertForbidden();
    $this->put(route('erp.sales.quotations.update', $quotation), quotationPayload())->assertForbidden();
    $this->post(route('erp.sales.quotations.cancel', $quotation))->assertForbidden();
    $this->post(route('erp.sales.quotations.duplicate', $quotation))->assertForbidden();
    $this->delete(route('erp.sales.quotations.destroy', $quotation))->assertForbidden();

    expect(Quotation::query()->count())->toBe(1)->and($quotation->fresh()->status)->toBe('draft');
});
