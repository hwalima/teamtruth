<?php

use App\Models\User;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Invoicing\Models\Customer;
use App\Modules\Sales\Models\Lead;
use App\Modules\Sales\Models\Quotation;
use App\Modules\Sales\Models\SalesOrder;
use App\Modules\Sales\Services\SalesService;
use Illuminate\Auth\Access\AuthorizationException;

function salesFixture(string $code): array
{
    $user = User::factory()->create();
    $company = Company::create(['code' => $code, 'name' => $code.' Sales Co', 'default_currency' => 'USD']);
    $company->users()->attach($user->id, ['role' => 'owner', 'is_active' => true]);
    app(CompanyContext::class)->setActiveCompany($company);
    \App\Models\Currency::firstOrCreate(['code' => 'USD'], ['name' => 'US Dollar', 'symbol' => '$']);
    $customer = Customer::create([
        'code' => 'CUST-1', 'name' => 'Sales Customer', 'currency_code' => 'USD', 'is_active' => true,
    ]);
    return [$user, $company, $customer];
}

test('sales lead converts once and quotation totals include discount and tax', function () {
    [$user, $company, $customer] = salesFixture('SALESTEST');
    $service = app(SalesService::class);
    $lead = $service->createLead(['name' => 'Acme Prospect']);
    $opportunity = $service->convertLeadToOpportunity($lead, [
        'title' => 'Acme annual supply', 'customer_id' => $customer->id, 'expected_value' => '200.0000', 'probability' => 50,
    ]);
    $quotation = $service->createQuotation([
        'customer_id' => $customer->id,
        'opportunity_id' => $opportunity->id,
        'currency_code' => 'USD',
        'lines' => [[
            'description' => 'Goods', 'quantity' => '2', 'unit_price' => '100', 'discount' => '10', 'tax_rate' => '15',
        ]],
    ], $user);

    expect($lead->fresh()->status)->toBe('converted')
        ->and($quotation->subtotal)->toBe('180.0000')
        ->and($quotation->discount_total)->toBe('20.0000')
        ->and($quotation->tax_total)->toBe('27.0000')
        ->and($quotation->total)->toBe('207.0000')
        ->and($quotation->lines)->toHaveCount(1)
        ->and($quotation->document_number)->toContain('SALESTEST/SALES_QUOTATION/');
});

test('approved sales orders invoice their service lines once, with matching line totals', function () {
    [$user, $company, $customer] = salesFixture('SALESINV');
    $order = SalesOrder::create([
        'document_number' => 'SO-1', 'customer_id' => $customer->id, 'status' => 'approved',
        'currency_code' => 'USD', 'subtotal' => '90.0000', 'discount_total' => '10.0000',
        'tax_total' => '13.5000', 'total' => '103.5000', 'created_by' => $user->id,
    ]);
    $order->lines()->create([
        'description' => 'Service', 'quantity' => '1', 'unit_price' => '100.0000',
        'discount' => '10.0000', 'tax_rate' => '15.0000', 'total' => '103.5000',
    ]);

    $invoice = app(SalesService::class)->createInvoiceFromSalesOrder($order, $user);

    // A second run has nothing left to bill, so no duplicate invoice is made.
    expect(fn () => app(SalesService::class)->createInvoiceFromSalesOrder($order->fresh(), $user))
        ->toThrow(\Illuminate\Validation\ValidationException::class)
        ->and(\App\Modules\Invoicing\Models\Invoice::query()->count())->toBe(1)
        ->and($invoice->subtotal)->toBe('90.0000')
        ->and($invoice->tax_amount)->toBe('13.5000')
        ->and($invoice->total_amount)->toBe('103.5000')
        ->and($order->fresh()->invoice_id)->toBe($invoice->id);
});

test('sales records are scoped to their company and cross-company conversions are rejected', function () {
    [$user, $companyA] = salesFixture('SALESA');
    $leadA = app(SalesService::class)->createLead(['name' => 'Company A lead']);
    app(CompanyContext::class)->setActiveCompany(null);
    $companyB = Company::create(['code' => 'SALESB', 'name' => 'Company B', 'default_currency' => 'USD']);
    $companyB->users()->attach($user->id, ['role' => 'owner', 'is_active' => true]);
    app(CompanyContext::class)->setActiveCompany($companyB);
    $leadB = Lead::create(['company_id' => $companyB->id, 'name' => 'Company B lead']);

    expect(Lead::query()->find($leadA->id))->toBeNull()
        ->and(fn () => app(SalesService::class)->convertLeadToOpportunity($leadA, ['title' => 'Wrong company']))
        ->toThrow(AuthorizationException::class)
        ->and(Quotation::query()->count())->toBe(0)
        ->and(SalesOrder::query()->count())->toBe(0)
        ->and($leadB->company_id)->toBe($companyB->id);
});
