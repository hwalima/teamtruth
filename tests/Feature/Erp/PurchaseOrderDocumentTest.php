<?php

use App\Models\Currency;
use App\Models\User;
use App\Modules\Core\Models\AuditEvent;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Inventory\Models\InventoryProduct;
use App\Modules\Inventory\Models\InventoryUnit;
use App\Modules\Purchase\Mail\PurchaseOrderMail;
use App\Modules\Purchase\Models\PurchaseOrder;
use App\Modules\Purchase\Models\PurchaseOrderLine;
use App\Modules\Purchase\Models\PurchaseVendor;
use Illuminate\Mail\Attachment;
use Illuminate\Support\Facades\Mail;

beforeEach(function () {
    $this->user = User::factory()->create(['name' => 'Sam Buyer', 'email' => 'buyer@example.test']);
    $this->company = Company::create(['code' => 'SMP', 'name' => 'Sample Mining', 'default_currency' => 'USD']);
    $this->company->users()->attach($this->user->id, ['role' => 'owner', 'is_active' => true]);
    Currency::firstOrCreate(['code' => 'USD'], ['name' => 'US Dollar', 'symbol' => '$']);
    $this->actingAs($this->user)->withSession(['active_erp_company_id' => $this->company->id]);
    app(CompanyContext::class)->setActiveCompany($this->company);

    $unit = InventoryUnit::create(['name' => 'Each', 'abbreviation' => 'ea', 'category' => 'quantity', 'factor_to_base' => '1', 'is_base' => true, 'is_active' => true]);
    $product = InventoryProduct::create(['unit_id' => $unit->id, 'sku' => 'DRL-1', 'name' => 'Drill bit', 'type' => 'storable', 'costing_method' => 'average', 'tracking' => 'none', 'is_active' => true]);
    $this->vendor = PurchaseVendor::create(['code' => 'V-1', 'name' => 'Acme Supplies', 'email' => 'orders@acme.example.test', 'payment_terms_days' => 30, 'currency_code' => 'USD', 'is_active' => true]);
    $this->order = PurchaseOrder::create(['document_number' => 'SMP/PO/0001', 'vendor_id' => $this->vendor->id, 'status' => 'approved', 'currency_code' => 'USD', 'total' => '250.0000', 'created_by' => $this->user->id, 'approved_at' => now()]);
    PurchaseOrderLine::create(['purchase_order_id' => $this->order->id, 'product_id' => $product->id, 'quantity' => '5.0000', 'received_quantity' => '0.0000', 'unit_price' => '50.0000', 'line_total' => '250.0000']);
});

test('the purchase order downloads as a branded PDF', function () {
    $response = $this->get(route('erp.purchase.orders.pdf', $this->order))->assertOk()
        ->assertHeader('Content-Type', 'application/pdf');

    expect($response->headers->get('Content-Disposition'))->toContain('purchase-order-SMP-PO-0001.pdf')
        ->and(substr($response->getContent(), 0, 4))->toBe('%PDF');
});

test('an approved order is emailed to the vendor with the PDF, and the send is recorded', function () {
    Mail::fake();

    $this->post(route('erp.purchase.orders.send', $this->order), ['email' => 'orders@acme.example.test', 'message' => 'Please deliver by Friday.'])
        ->assertSessionHasNoErrors()
        ->assertSessionHas('success');

    Mail::assertSent(PurchaseOrderMail::class, function (PurchaseOrderMail $mail) {
        expect($mail->hasTo('orders@acme.example.test'))->toBeTrue()
            ->and($mail->hasReplyTo('buyer@example.test'))->toBeTrue()
            ->and(array_map(fn (Attachment $file) => [$file->as, $file->mime], $mail->attachments()))->toBe([['purchase-order-SMP-PO-0001.pdf', 'application/pdf']])
            ->and(substr($mail->pdf, 0, 4))->toBe('%PDF')
            ->and($mail->render())->toContain('Please deliver by Friday.');

        return true;
    });
    $order = $this->order->fresh();
    expect($order->sent_to)->toBe('orders@acme.example.test')
        ->and($order->sent_at)->not->toBeNull()
        ->and(AuditEvent::query()->where('event', 'purchase.order.sent')->count())->toBe(1);
});

test('orders waiting for approval cannot be sent, and sending needs purchase management rights', function () {
    Mail::fake();
    $this->order->update(['status' => 'pending_approval']);
    $this->post(route('erp.purchase.orders.send', $this->order), ['email' => 'orders@acme.example.test'])
        ->assertSessionHasErrors('email');
    $this->post(route('erp.purchase.orders.send', $this->order), ['email' => 'not-an-email'])
        ->assertSessionHasErrors('email');

    $this->order->update(['status' => 'approved']);
    $member = User::factory()->create();
    $this->company->users()->attach($member->id, ['role' => 'member', 'is_active' => true]);
    $this->actingAs($member)->post(route('erp.purchase.orders.send', $this->order), ['email' => 'orders@acme.example.test'])
        ->assertForbidden();

    Mail::assertNothingSent();
});

test('an order from another company cannot be opened', function () {
    $other = Company::create(['code' => 'OTH', 'name' => 'Other Co', 'default_currency' => 'USD']);
    $other->users()->attach($this->user->id, ['role' => 'owner', 'is_active' => true]);

    $this->withSession(['active_erp_company_id' => $other->id])
        ->get(route('erp.purchase.orders.pdf', $this->order))
        ->assertNotFound();
});
