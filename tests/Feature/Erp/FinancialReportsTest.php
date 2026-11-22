<?php

use App\Models\Currency;
use App\Models\User;
use App\Modules\Accounting\Models\AccountingAccount;
use App\Modules\Accounting\Models\AccountingJournal;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Invoicing\Models\CreditNote;
use App\Modules\Invoicing\Models\Customer;
use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Invoicing\Models\InvoicePayment;
use App\Modules\Purchase\Models\PurchaseBill;
use App\Modules\Purchase\Models\PurchasePayment;
use App\Modules\Purchase\Models\PurchasePaymentAllocation;
use App\Modules\Purchase\Models\PurchaseVendor;
use Inertia\Testing\AssertableInertia as Assert;

function financialReportsFixture(string $code = 'FRP'): array
{
    $user = User::factory()->create();
    $company = Company::create(['code' => $code, 'name' => 'Sample Mining', 'default_currency' => 'USD']);
    $company->users()->attach($user->id, ['role' => 'owner', 'is_active' => true]);
    Currency::firstOrCreate(['code' => 'USD'], ['name' => 'US Dollar', 'symbol' => '$']);
    Currency::firstOrCreate(['code' => 'ZWG'], ['name' => 'Zimbabwe Gold', 'symbol' => 'ZiG']);

    app(CompanyContext::class)->setActiveCompany($company);
    $accounts = [];
    foreach ([['1000', 'Cash', 'asset'], ['2000', 'Equipment loan', 'liability'], ['3000', 'Share capital', 'equity'], ['4000', 'Sales', 'income'], ['5000', 'Fuel', 'expense']] as [$number, $name, $type]) {
        $accounts[$type] = AccountingAccount::create(['code' => $number, 'name' => $name, 'account_type' => $type]);
    }
    $journal = AccountingJournal::create(['code' => 'GEN', 'name' => 'General journal', 'journal_type' => 'general', 'is_active' => true]);
    app(CompanyContext::class)->setActiveCompany(null);

    return [$user, $company, $accounts, $journal];
}

function postEntry($test, $journal, string $date, $debit, $credit, string $amount): void
{
    $test->post(route('erp.accounting.entries.store'), [
        'journal_id' => $journal->id, 'entry_date' => $date, 'currency_code' => 'USD', 'description' => 'Test entry',
        'lines' => [
            ['account_id' => $debit->id, 'debit' => $amount, 'credit' => '0'],
            ['account_id' => $credit->id, 'debit' => '0', 'credit' => $amount],
        ],
    ])->assertSessionHasNoErrors();
}

test('the balance sheet balances, with earlier and this year profit under equity', function () {
    [$user, $company, $a, $journal] = financialReportsFixture();
    $this->actingAs($user)->withSession(['active_erp_company_id' => $company->id]);
    foreach (['2025', '2026'] as $year) {
        $this->post(route('erp.accounting.fiscal-years.store'), ['name' => "FY $year", 'starts_on' => "$year-01-01", 'ends_on' => "$year-12-31"])->assertSessionHasNoErrors();
    }

    postEntry($this, $journal, '2025-02-01', $a['asset'], $a['equity'], '1000');   // capital paid in
    postEntry($this, $journal, '2025-05-01', $a['asset'], $a['income'], '300');    // last year's sales
    postEntry($this, $journal, '2026-03-01', $a['expense'], $a['asset'], '50');    // this year's fuel
    postEntry($this, $journal, '2026-04-01', $a['asset'], $a['liability'], '200'); // loan received
    postEntry($this, $journal, '2026-08-01', $a['asset'], $a['income'], '999');    // after the report date

    $this->get(route('erp.accounting.financial-reports.index', ['as_of' => '2026-06-30']))->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Erp/Accounting/Reports')
            ->where('report', 'balance-sheet')
            ->where('data.yearStart', '2026-01-01')
            ->where('data.assets.0.name', 'Cash')
            ->where('data.totalAssets', '1450.0000')
            ->where('data.totalLiabilities', '200.0000')
            ->where('data.equity.1.name', 'Retained earnings (earlier years)')
            ->where('data.equity.1.amount', '300.0000')
            ->where('data.equity.2.name', 'Loss for the year to date')
            ->where('data.equity.2.amount', '-50.0000')
            ->where('data.totalEquity', '1250.0000')
            ->where('data.difference', '0.0000'));

    $pdf = $this->get(route('erp.accounting.financial-reports.export', ['report' => 'balance-sheet', 'format' => 'pdf', 'as_of' => '2026-06-30']))->assertOk();
    expect($pdf->headers->get('Content-Type'))->toBe('application/pdf')
        ->and(substr($pdf->getContent(), 0, 4))->toBe('%PDF');

    $csv = $this->get(route('erp.accounting.financial-reports.export', ['report' => 'balance-sheet', 'format' => 'csv', 'as_of' => '2026-06-30']))->assertOk()->streamedContent();
    expect($csv)->toContain('"Total liabilities and equity",1450.0000');
});

test('aged receivables age open invoices by due date, net of payments and credits on or before the date', function () {
    [$user, $company] = financialReportsFixture();
    app(CompanyContext::class)->setActiveCompany($company);
    $acme = Customer::create(['code' => 'C-1', 'name' => 'Acme Stores', 'currency_code' => 'USD', 'is_active' => true]);
    $beta = Customer::create(['code' => 'C-2', 'name' => 'Beta Foods', 'currency_code' => 'ZWG', 'is_active' => true]);
    $invoice = fn ($customer, $number, $date, $due, $total, $currency = 'USD', $status = 'sent') => Invoice::create([
        'document_number' => $number, 'customer_id' => $customer->id, 'status' => $status, 'type' => 'invoice',
        'invoice_date' => $date, 'due_date' => $due, 'currency_code' => $currency, 'exchange_rate' => 1,
        'subtotal' => $total, 'total_amount' => $total, 'balance_due' => $total, 'created_by' => $user->id,
    ]);
    $current = $invoice($acme, 'INV-1', '2026-06-20', '2026-07-20', '100');           // not yet due
    $late = $invoice($acme, 'INV-2', '2026-04-01', '2026-05-01', '400', 'USD', 'partial_paid'); // 60 days late
    $invoice($acme, 'INV-3', '2026-01-01', '2026-01-31', '250');                      // 150 days late
    $invoice($acme, 'INV-4', '2026-06-01', '2026-06-15', '80', 'USD', 'draft');       // drafts are not debts
    $invoice($acme, 'INV-5', '2026-07-05', '2026-08-05', '500');                      // after the date
    $invoice($beta, 'INV-6', '2026-06-01', '2026-06-10', '1000', 'ZWG');              // 20 days late
    InvoicePayment::create(['invoice_id' => $late->id, 'payment_date' => '2026-06-01', 'currency_code' => 'USD', 'exchange_rate' => 1, 'amount' => '150', 'base_amount' => '150', 'payment_method' => 'bank', 'created_by' => $user->id]);
    InvoicePayment::create(['invoice_id' => $current->id, 'payment_date' => '2026-07-02', 'currency_code' => 'USD', 'exchange_rate' => 1, 'amount' => '100', 'base_amount' => '100', 'payment_method' => 'bank', 'created_by' => $user->id]);
    CreditNote::create(['document_number' => 'CN-1', 'customer_id' => $acme->id, 'status' => 'issued', 'credit_note_date' => '2026-06-05', 'currency_code' => 'USD', 'exchange_rate' => 1, 'subtotal' => '30', 'total_amount' => '30', 'applied_amount' => '0', 'created_by' => $user->id]);
    app(CompanyContext::class)->setActiveCompany(null);

    $this->actingAs($user)->withSession(['active_erp_company_id' => $company->id]);
    $this->get(route('erp.accounting.financial-reports.index', ['report' => 'aged-receivables', 'as_of' => '2026-06-30']))->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('report', 'aged-receivables')
            ->has('data.partners', 2)
            ->where('data.partners.0.partner', 'Acme Stores')
            ->where('data.partners.0.current', '100.0000')
            ->where('data.partners.0.days_31_60', '250.0000')
            ->where('data.partners.0.over_90', '250.0000')
            ->where('data.partners.0.credits', '-30.0000')
            ->where('data.partners.0.total', '570.0000')
            ->has('data.partners.0.documents', 3)
            ->where('data.partners.0.documents.0.number', 'INV-3')
            ->where('data.partners.0.documents.0.daysOverdue', 150)
            ->where('data.partners.1.currency', 'ZWG')
            ->where('data.partners.1.days_1_30', '1000.0000')
            ->where('data.totals.0.currency', 'USD')
            ->where('data.totals.0.total', '570.0000'));

    $csv = $this->get(route('erp.accounting.financial-reports.export', ['report' => 'aged-receivables', 'format' => 'csv', 'as_of' => '2026-06-30']))->assertOk()->streamedContent();
    expect($csv)->toContain('"Acme Stores",USD,100.0000,0.0000,250.0000,0.0000,250.0000,-30.0000,570.0000');
    $this->get(route('erp.accounting.financial-reports.export', ['report' => 'aged-receivables', 'format' => 'pdf', 'as_of' => '2026-06-30']))->assertOk();
});

test('aged payables count approved bills less posted payments, and stay within the company', function () {
    [$user, $company, , $journal] = financialReportsFixture('FRA');
    [$otherUser, $otherCompany] = financialReportsFixture('FRB');
    app(CompanyContext::class)->setActiveCompany($company);
    $vendor = PurchaseVendor::create(['code' => 'V-1', 'name' => 'Acme Drilling', 'payment_terms_days' => 30, 'is_active' => true]);
    $bill = fn ($number, $status, $date, $due, $total) => PurchaseBill::create([
        'document_number' => $number, 'vendor_id' => $vendor->id, 'status' => $status, 'currency_code' => 'USD',
        'total_amount' => $total, 'amount_residual' => $total, 'bill_date' => $date, 'due_date' => $due, 'created_by' => $user->id,
    ]);
    $open = $bill('BILL-1', 'approved', '2026-05-01', '2026-05-31', '600');
    $bill('BILL-2', 'draft', '2026-05-01', '2026-05-31', '900');
    $payment = PurchasePayment::create(['document_number' => 'PAY-1', 'vendor_id' => $vendor->id, 'journal_id' => $journal->id, 'payment_method' => 'bank', 'currency_code' => 'USD', 'amount' => '200', 'payment_date' => '2026-06-10', 'status' => 'posted', 'created_by' => $user->id]);
    PurchasePaymentAllocation::create(['purchase_payment_id' => $payment->id, 'purchase_bill_id' => $open->id, 'amount' => '200']);
    $draftPayment = PurchasePayment::create(['document_number' => 'PAY-2', 'vendor_id' => $vendor->id, 'journal_id' => $journal->id, 'payment_method' => 'bank', 'currency_code' => 'USD', 'amount' => '100', 'payment_date' => '2026-06-11', 'status' => 'draft', 'created_by' => $user->id]);
    PurchasePaymentAllocation::create(['purchase_payment_id' => $draftPayment->id, 'purchase_bill_id' => $open->id, 'amount' => '100']);
    app(CompanyContext::class)->setActiveCompany(null);

    $this->actingAs($user)->withSession(['active_erp_company_id' => $company->id])
        ->get(route('erp.accounting.financial-reports.index', ['report' => 'aged-payables', 'as_of' => '2026-06-30']))
        ->assertInertia(fn (Assert $page) => $page
            ->has('data.partners', 1)
            ->where('data.partners.0.partner', 'Acme Drilling')
            ->where('data.partners.0.days_1_30', '400.0000')
            ->where('data.partners.0.total', '400.0000'));

    $this->actingAs($otherUser)->withSession(['active_erp_company_id' => $otherCompany->id])
        ->get(route('erp.accounting.financial-reports.index', ['report' => 'aged-payables', 'as_of' => '2026-06-30']))
        ->assertInertia(fn (Assert $page) => $page->has('data.partners', 0));

    $this->get(route('erp.accounting.financial-reports.index', ['report' => 'nonsense']))->assertSessionHasErrors('report');
});
