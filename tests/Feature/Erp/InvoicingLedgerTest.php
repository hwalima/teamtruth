<?php

use App\Models\Currency;
use App\Models\Permission;
use App\Models\User;
use App\Modules\Accounting\Models\AccountingAccount;
use App\Modules\Accounting\Models\AccountingJournal;
use App\Modules\Accounting\Models\FiscalPeriod;
use App\Modules\Accounting\Models\FiscalYear;
use App\Modules\Accounting\Models\JournalEntry;
use App\Modules\Core\Models\AuditEvent;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Invoicing\Events\InvoicePosted;
use App\Modules\Invoicing\Models\CreditNote;
use App\Modules\Invoicing\Models\Customer;
use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Invoicing\Models\InvoicePayment;
use App\Modules\Invoicing\Services\InvoicingService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Validation\ValidationException;

function invoicingFixture(string $code): array
{
    $user = User::factory()->create();
    $company = Company::create([
        'code' => $code,
        'name' => "{$code} Invoicing Co",
        'default_currency' => 'USD',
    ]);
    $company->users()->attach($user->id, ['role' => 'owner', 'is_active' => true]);

    app(CompanyContext::class)->setActiveCompany($company);

    Currency::firstOrCreate(['code' => 'USD'], ['name' => 'US Dollar', 'symbol' => '$']);
    Currency::firstOrCreate(['code' => 'ZWG'], ['name' => 'Zimbabwe Gold', 'symbol' => 'ZiG']);

    $cash = AccountingAccount::create(['code' => '1000', 'name' => 'Cash', 'account_type' => 'asset']);
    $bank = AccountingAccount::create(['code' => '1010', 'name' => 'Bank', 'account_type' => 'asset']);
    $ar = AccountingAccount::create(['code' => '1200', 'name' => 'Accounts receivable', 'account_type' => 'asset', 'allow_reconciliation' => true]);
    $tax = AccountingAccount::create(['code' => '2200', 'name' => 'VAT payable', 'account_type' => 'liability']);
    $revenue = AccountingAccount::create(['code' => '4000', 'name' => 'Service revenue', 'account_type' => 'income']);
    AccountingAccount::create(['code' => '3000', 'name' => 'Opening equity', 'account_type' => 'equity']);

    $salesJournal = AccountingJournal::create(['code' => 'SINV', 'name' => 'Sales journal', 'journal_type' => 'sales', 'is_active' => true]);
    $bankJournal = AccountingJournal::create(['code' => 'BNK', 'name' => 'Bank journal', 'journal_type' => 'bank', 'is_active' => true]);
    AccountingJournal::create(['code' => 'CSH', 'name' => 'Cash journal', 'journal_type' => 'cash', 'is_active' => true]);

    $fiscalYear = FiscalYear::create(['name' => 'FY 2026', 'starts_on' => '2026-01-01', 'ends_on' => '2026-12-31', 'status' => 'open']);
    $period = FiscalPeriod::create([
        'fiscal_year_id' => $fiscalYear->id,
        'name' => 'FY 2026',
        'starts_on' => '2026-01-01',
        'ends_on' => '2026-12-31',
        'status' => 'open',
    ]);

    $customer = Customer::create([
        'code' => 'CUST-001',
        'name' => 'Acme Industries',
        'email' => 'billing@acme.test',
        'currency_code' => 'USD',
        'is_active' => true,
    ]);

    app(CompanyContext::class)->setActiveCompany(null);

    return [$user, $company, $customer, $revenue, $ar, $tax, $cash, $bank, $salesJournal, $bankJournal, $period];
}

function createSentInvoice(User $user, Customer $customer, AccountingAccount $revenue, string $date = '2026-06-15'): Invoice
{
    return app(InvoicingService::class)->createInvoice($user, [
        'customer_id' => $customer->id,
        'type' => 'invoice',
        'status' => 'sent',
        'invoice_date' => $date,
        'currency_code' => 'USD',
    ], [
        ['name' => 'Consulting', 'quantity' => 2, 'unit_price' => '100.00', 'tax_rate' => '15', 'account_id' => $revenue->id],
        ['name' => 'Hosting', 'quantity' => 1, 'unit_price' => '50.00', 'discount_percent' => '10', 'tax_rate' => '0', 'account_id' => $revenue->id],
    ]);
}

test('invoice totals are the net subtotal plus tax', function () {
    [$user, $company, $customer, $revenue] = invoicingFixture('INV');
    app(CompanyContext::class)->setActiveCompany($company);

    $invoice = createSentInvoice($user, $customer, $revenue);

    expect($invoice->subtotal)->toBe('245.0000')
        ->and($invoice->tax_amount)->toBe('30.0000')
        ->and($invoice->discount_amount)->toBe('5.0000')
        ->and($invoice->total_amount)->toBe('275.0000')
        ->and($invoice->balance_due)->toBe('275.0000');
});

test('posting a sent invoice emits an event that posts a balanced receivable entry to the ledger', function () {
    [$user, $company, $customer, $revenue, $ar, $tax] = invoicingFixture('INP');
    app(CompanyContext::class)->setActiveCompany($company);

    $invoice = createSentInvoice($user, $customer, $revenue);
    $posted = app(InvoicingService::class)->postInvoice($user, $invoice);

    $entry = JournalEntry::query()
        ->where('source_type', Invoice::class)
        ->where('source_id', $invoice->id)
        ->with('lines.account')
        ->first();

    expect($entry)->not->toBeNull()
        ->and($entry->status)->toBe('posted')
        ->and($entry->debit_total)->toBe('275.0000')
        ->and($entry->credit_total)->toBe('275.0000')
        ->and($entry->reference)->toBe($invoice->document_number)
        ->and($entry->journal->journal_type)->toBe('sales');

    $arLine = $entry->lines->firstWhere('account_id', $ar->id);
    $revenueLine = $entry->lines->firstWhere('account_id', $revenue->id);
    $taxLine = $entry->lines->firstWhere('account_id', $tax->id);

    expect($arLine->debit)->toBe('275.0000')
        ->and($arLine->credit)->toBe('0.0000')
        ->and($revenueLine->credit)->toBe('245.0000')
        ->and($revenueLine->debit)->toBe('0.0000')
        ->and($taxLine->credit)->toBe('30.0000');

    expect($posted->isPosted())->toBeTrue()
        ->and($posted->status)->toBe('sent')
        ->and($posted->fiscal_period_id)->not->toBeNull();

    expect(AuditEvent::query()->where('event', 'invoicing.invoice.posted_to_ledger')->exists())->toBeTrue();
});

test('re-dispatching the posted event never duplicates the ledger entry and the service refuses a second post', function () {
    [$user, $company, $customer, $revenue] = invoicingFixture('IND');
    app(CompanyContext::class)->setActiveCompany($company);

    $invoice = createSentInvoice($user, $customer, $revenue);
    app(InvoicingService::class)->postInvoice($user, $invoice);

    InvoicePosted::dispatch($invoice->fresh(), $user);
    InvoicePosted::dispatch($invoice->fresh(), $user);

    expect(JournalEntry::query()->where('source_type', Invoice::class)->where('source_id', $invoice->id)->count())->toBe(1);

    expect(fn () => app(InvoicingService::class)->postInvoice($user, $invoice->fresh()))
        ->toThrow(ValidationException::class);

    expect(JournalEntry::query()->count())->toBe(1);
});

test('a draft invoice cannot be posted', function () {
    [$user, $company, $customer, $revenue] = invoicingFixture('INDraft');
    app(CompanyContext::class)->setActiveCompany($company);

    $invoice = app(InvoicingService::class)->createInvoice($user, [
        'customer_id' => $customer->id,
        'type' => 'invoice',
        'invoice_date' => '2026-06-15',
        'currency_code' => 'USD',
    ], [
        ['name' => 'Consulting', 'quantity' => 1, 'unit_price' => '100.00', 'tax_rate' => '0', 'account_id' => $revenue->id],
    ]);

    expect(fn () => app(InvoicingService::class)->postInvoice($user, $invoice))
        ->toThrow(ValidationException::class);

    expect(JournalEntry::query()->count())->toBe(0);
});

test('posting fails when the invoice date falls outside an open accounting period', function () {
    [$user, $company, $customer, $revenue] = invoicingFixture('INP');
    app(CompanyContext::class)->setActiveCompany($company);

    $invoice = createSentInvoice($user, $customer, $revenue, '2027-01-10');

    expect(fn () => app(InvoicingService::class)->postInvoice($user, $invoice))
        ->toThrow(ValidationException::class);

    expect(JournalEntry::query()->count())->toBe(0)
        ->and($invoice->fresh()->isPosted())->toBeFalse();
});

test('recording a full payment posts bank against receivable and marks the invoice paid', function () {
    [$user, $company, $customer, $revenue, $ar, $tax, $cash, $bank] = invoicingFixture('PAY');
    app(CompanyContext::class)->setActiveCompany($company);

    $invoice = createSentInvoice($user, $customer, $revenue);
    app(InvoicingService::class)->postInvoice($user, $invoice);

    $payment = app(InvoicingService::class)->recordPayment($user, $invoice->fresh(), [
        'amount' => '275.00',
        'payment_date' => '2026-06-20',
        'currency_code' => 'USD',
        'payment_method' => 'bank',
        'reference' => 'TRX-001',
    ]);

    $entry = JournalEntry::query()
        ->where('source_type', InvoicePayment::class)
        ->where('source_id', $payment->id)
        ->with('lines.account')
        ->first();

    expect($entry)->not->toBeNull()
        ->and($entry->debit_total)->toBe('275.0000')
        ->and($entry->credit_total)->toBe('275.0000')
        ->and($entry->journal->journal_type)->toBe('bank');

    $bankLine = $entry->lines->firstWhere('account_id', $bank->id);
    $arLine = $entry->lines->firstWhere('account_id', $ar->id);
    expect($bankLine->debit)->toBe('275.0000')
        ->and($arLine->credit)->toBe('275.0000');

    $invoice = $invoice->fresh();
    expect($invoice->status)->toBe('paid')
        ->and($invoice->paid_amount)->toBe('275.0000')
        ->and($invoice->balance_due)->toBe('0.0000')
        ->and($invoice->paid_at)->not->toBeNull();

    expect(AuditEvent::query()->where('event', 'invoicing.payment.posted_to_ledger')->exists())->toBeTrue();
});

test('a partial payment marks the invoice partially paid and posts only the paid amount', function () {
    [$user, $company, $customer, $revenue, $ar, $tax, $cash, $bank] = invoicingFixture('PAR');
    app(CompanyContext::class)->setActiveCompany($company);

    $invoice = createSentInvoice($user, $customer, $revenue);
    app(InvoicingService::class)->postInvoice($user, $invoice);

    $payment = app(InvoicingService::class)->recordPayment($user, $invoice->fresh(), [
        'amount' => '100.00',
        'payment_date' => '2026-06-20',
        'currency_code' => 'USD',
        'payment_method' => 'cash',
    ]);

    $entry = JournalEntry::query()
        ->where('source_type', InvoicePayment::class)
        ->where('source_id', $payment->id)
        ->with('lines.account')
        ->first();

    $cashLine = $entry->lines->firstWhere('account_id', $cash->id);
    expect($cashLine->debit)->toBe('100.0000')
        ->and($entry->journal->journal_type)->toBe('cash');

    $invoice = $invoice->fresh();
    expect($invoice->status)->toBe('partial_paid')
        ->and($invoice->paid_amount)->toBe('100.0000')
        ->and($invoice->balance_due)->toBe('175.0000');
});

test('issuing a credit note posts a reversal entry against receivable, revenue and tax', function () {
    [$user, $company, $customer, $revenue, $ar, $tax] = invoicingFixture('CRN');
    app(CompanyContext::class)->setActiveCompany($company);

    $invoice = createSentInvoice($user, $customer, $revenue);
    app(InvoicingService::class)->postInvoice($user, $invoice);

    $service = app(InvoicingService::class);
    $creditNote = $service->createCreditNote($user, [
        'customer_id' => $customer->id,
        'original_invoice_id' => $invoice->id,
        'credit_note_date' => '2026-06-16',
        'currency_code' => 'USD',
        'reason' => 'Service outage credit',
    ], [
        ['name' => 'Consulting credit', 'quantity' => 1, 'unit_price' => '100.00', 'tax_rate' => '15', 'account_id' => $revenue->id],
    ]);

    $issued = $service->issueCreditNote($user, $creditNote);

    $entry = JournalEntry::query()
        ->where('source_type', CreditNote::class)
        ->where('source_id', $creditNote->id)
        ->with('lines.account')
        ->first();

    expect($entry)->not->toBeNull()
        ->and($entry->debit_total)->toBe('115.0000')
        ->and($entry->credit_total)->toBe('115.0000');

    $arLine = $entry->lines->firstWhere('account_id', $ar->id);
    $revenueLine = $entry->lines->firstWhere('account_id', $revenue->id);
    $taxLine = $entry->lines->firstWhere('account_id', $tax->id);
    expect($arLine->credit)->toBe('115.0000')
        ->and($revenueLine->debit)->toBe('100.0000')
        ->and($taxLine->debit)->toBe('15.0000');

    expect($issued->isPosted())->toBeTrue()
        ->and($issued->status)->toBe('issued');
});

test('applying a credit note allocates it to the invoice without creating another ledger entry', function () {
    [$user, $company, $customer, $revenue] = invoicingFixture('APL');
    app(CompanyContext::class)->setActiveCompany($company);

    $invoice = createSentInvoice($user, $customer, $revenue);
    $service = app(InvoicingService::class);
    $service->postInvoice($user, $invoice);

    $creditNote = $service->createCreditNote($user, [
        'customer_id' => $customer->id,
        'original_invoice_id' => $invoice->id,
        'credit_note_date' => '2026-06-16',
        'currency_code' => 'USD',
    ], [
        ['name' => 'Consulting credit', 'quantity' => 1, 'unit_price' => '100.00', 'tax_rate' => '15', 'account_id' => $revenue->id],
    ]);
    $service->issueCreditNote($user, $creditNote);

    $entriesBefore = JournalEntry::query()->count();

    $service->applyCreditNote($user, $creditNote->fresh(), $invoice->fresh(), '115.00');

    expect(JournalEntry::query()->count())->toBe($entriesBefore);

    $invoice = $invoice->fresh();
    expect($invoice->paid_amount)->toBe('115.0000')
        ->and($invoice->balance_due)->toBe('160.0000')
        ->and($invoice->status)->toBe('partial_paid');

    $creditNote = $creditNote->fresh();
    expect($creditNote->applied_amount)->toBe('115.0000')
        ->and($creditNote->status)->toBe('applied');

    expect(InvoicePayment::query()->where('credit_note_id', $creditNote->id)->count())->toBe(1);
});

test('an invoice from another company cannot be posted under the active company', function () {
    [$user, $companyA, $customer, $revenue] = invoicingFixture('CMPA');
    app(CompanyContext::class)->setActiveCompany($companyA);
    $invoice = createSentInvoice($user, $customer, $revenue);

    $companyB = Company::create(['code' => 'CMPB', 'name' => 'Company B', 'default_currency' => 'USD']);
    $companyB->users()->attach($user->id, ['role' => 'owner', 'is_active' => true]);
    app(CompanyContext::class)->setActiveCompany($companyB);

    expect(fn () => app(InvoicingService::class)->postInvoice($user, $invoice))
        ->toThrow(AuthorizationException::class);

    expect(JournalEntry::query()->count())->toBe(0);
});

test('the invoicing endpoints post to the ledger through the event listeners', function () {
    [$user, $company, $customer, $revenue] = invoicingFixture('HTTP');

    Permission::create(['name' => 'erp.invoicing.manage', 'guard_name' => 'web', 'module' => 'erp_invoicing']);
    $user->givePermissionTo('erp.invoicing.manage');

    app(CompanyContext::class)->setActiveCompany($company);
    $invoice = createSentInvoice($user, $customer, $revenue);
    app(CompanyContext::class)->setActiveCompany(null);

    $this->actingAs($user)->withSession(['active_erp_company_id' => $company->id])
        ->post(route('erp.invoicing.post', $invoice))
        ->assertRedirect()
        ->assertSessionHas('success');

    app(CompanyContext::class)->setActiveCompany($company);
    expect(JournalEntry::query()->where('source_type', Invoice::class)->where('source_id', $invoice->id)->count())->toBe(1);

    $this->actingAs($user)->withSession(['active_erp_company_id' => $company->id])
        ->post(route('erp.invoicing.payments.store', $invoice), [
            'amount' => '275.00',
            'payment_date' => '2026-06-20',
            'currency_code' => 'USD',
            'payment_method' => 'bank',
            'reference' => 'TRX-HTTP',
        ])
        ->assertRedirect()
        ->assertSessionHas('success');

    expect(JournalEntry::query()->where('source_type', InvoicePayment::class)->count())->toBe(1)
        ->and($invoice->fresh()->status)->toBe('paid');
});
