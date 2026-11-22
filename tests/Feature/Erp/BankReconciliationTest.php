<?php

use App\Models\Currency;
use App\Models\User;
use App\Modules\Accounting\Models\AccountingJournal;
use App\Modules\Banking\Models\Bank;
use App\Modules\Banking\Models\BankAccount;
use App\Modules\Banking\Models\BankReconciliationMatch;
use App\Modules\Banking\Models\BankTransaction;
use App\Modules\Core\Models\AuditEvent;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Invoicing\Models\Customer;
use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Invoicing\Models\InvoicePayment;
use App\Modules\Purchase\Models\PurchasePayment;
use App\Modules\Purchase\Models\PurchaseVendor;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->company = Company::create(['code' => 'SMP', 'name' => 'Sample Mining', 'default_currency' => 'USD']);
    $this->company->users()->attach($this->user->id, ['role' => 'owner', 'is_active' => true]);
    Currency::firstOrCreate(['code' => 'USD'], ['name' => 'US Dollar', 'symbol' => '$']);
    $this->actingAs($this->user)->withSession(['active_erp_company_id' => $this->company->id]);

    app(CompanyContext::class)->setActiveCompany($this->company);
    $this->account = BankAccount::create([
        'bank_id' => Bank::create(['name' => 'Sample Bank'])->id, 'company_id' => $this->company->id,
        'account_number' => '300100', 'account_name' => 'Operating', 'currency' => 'USD', 'opening_balance' => 0, 'status' => 'active',
    ]);
    $this->acme = Customer::create(['code' => 'C-1', 'name' => 'Acme Stores', 'currency_code' => 'USD', 'is_active' => true]);
    $this->vendor = PurchaseVendor::create(['code' => 'V-1', 'name' => 'Beta Haulage', 'payment_terms_days' => 30, 'is_active' => true]);
    $this->journal = AccountingJournal::create(['code' => 'BNK', 'name' => 'Bank', 'journal_type' => 'bank', 'is_active' => true]);
});

function bankLine(BankAccount $account, string $date, string $description, ?string $credit = null, ?string $debit = null): BankTransaction
{
    return BankTransaction::create([
        'account_id' => $account->id, 'transaction_date' => $date, 'sequence' => $account->nextSequence(),
        'description' => $description, 'credit' => $credit ?? 0, 'debit' => $debit ?? 0,
    ]);
}

function receipt($test, string $number, string $date, string $amount, ?string $reference = null): InvoicePayment
{
    $invoice = Invoice::create([
        'document_number' => $number, 'customer_id' => $test->acme->id, 'status' => 'sent', 'type' => 'invoice',
        'invoice_date' => $date, 'due_date' => $date, 'currency_code' => 'USD', 'exchange_rate' => 1,
        'subtotal' => $amount, 'total_amount' => $amount, 'balance_due' => $amount, 'created_by' => $test->user->id,
    ]);

    return InvoicePayment::create(['invoice_id' => $invoice->id, 'payment_date' => $date, 'currency_code' => 'USD', 'exchange_rate' => 1, 'amount' => $amount, 'base_amount' => $amount, 'payment_method' => 'bank', 'reference' => $reference, 'created_by' => $test->user->id]);
}

function vendorPayment($test, string $number, string $date, string $amount, string $status = 'posted'): PurchasePayment
{
    return PurchasePayment::create(['document_number' => $number, 'vendor_id' => $test->vendor->id, 'journal_id' => $test->journal->id, 'payment_method' => 'bank', 'currency_code' => 'USD', 'amount' => $amount, 'payment_date' => $date, 'status' => $status, 'created_by' => $test->user->id]);
}

test('open lines get suggestions of the same amount within a week, best match first', function () {
    $line = bankLine($this->account, '2026-06-10', 'Deposit INV-102 Acme', credit: '500.00');
    receipt($this, 'INV-101', '2026-06-09', '500');        // a day apart, number not in the description
    receipt($this, 'INV-102', '2026-06-06', '500');        // further apart, but named on the statement
    receipt($this, 'INV-103', '2026-05-20', '500');        // too far away
    receipt($this, 'INV-104', '2026-06-10', '499.99');     // wrong amount
    vendorPayment($this, 'PAY-1', '2026-06-10', '500');    // money out, not a receipt

    $this->get(route('erp.banking.reconcile.show', $this->account))->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Erp/Banking/Reconcile')
            ->where('summary.open', 1)
            ->where('summary.unbanked_receipts', 4)
            ->where('lines.data.0.id', $line->id)
            ->where('lines.data.0.amount', 50000)
            ->has('lines.data.0.suggestions', 2)
            ->where('lines.data.0.suggestions.0.number', 'INV-102')
            ->where('lines.data.0.suggestions.1.number', 'INV-101'));
});

test('a line is matched to payments that add up to it exactly, and a payment is matched only once', function () {
    $line = bankLine($this->account, '2026-06-10', 'Supplier payments', debit: '300.00');
    $a = vendorPayment($this, 'PAY-1', '2026-06-09', '100');
    $b = vendorPayment($this, 'PAY-2', '2026-06-09', '200');
    $draft = vendorPayment($this, 'PAY-3', '2026-06-09', '300', 'draft');
    $receipt = receipt($this, 'INV-1', '2026-06-09', '300');

    $this->post(route('erp.banking.reconcile.match', $line), ['payments' => ['vendor_payment:'.$a->id]])
        ->assertSessionHasErrors(['payments' => 'The payments add up to 100.00, but the bank line is 300.00.']);
    $this->post(route('erp.banking.reconcile.match', $line), ['payments' => ['customer_payment:'.$receipt->id]])
        ->assertSessionHasErrors('payments');
    $this->post(route('erp.banking.reconcile.match', $line), ['payments' => ['vendor_payment:'.$draft->id]])
        ->assertSessionHasErrors('payments');

    $this->post(route('erp.banking.reconcile.match', $line), ['payments' => ['vendor_payment:'.$a->id, 'vendor_payment:'.$b->id]])
        ->assertSessionHasNoErrors();
    expect($line->fresh()->reconcile_kind)->toBe('matched')
        ->and(BankReconciliationMatch::query()->where('transaction_id', $line->id)->count())->toBe(2)
        ->and(AuditEvent::query()->where('event', 'banking.reconciliation.matched')->count())->toBe(1);

    $second = bankLine($this->account, '2026-06-11', 'Another', debit: '100.00');
    $this->post(route('erp.banking.reconcile.match', $second), ['payments' => ['vendor_payment:'.$a->id]])
        ->assertSessionHasErrors('payments');

    $this->get(route('erp.banking.reconcile.show', [$this->account, 'status' => 'reconciled']))
        ->assertInertia(fn (Assert $page) => $page
            ->has('lines.data', 1)
            ->where('lines.data.0.state', 'matched')
            ->has('lines.data.0.matched', 2));

    $this->delete(route('erp.banking.reconcile.undo', $line))->assertSessionHasNoErrors();
    expect($line->fresh()->reconciled_at)->toBeNull()
        ->and(BankReconciliationMatch::query()->count())->toBe(0);
});

test('auto-match applies only the certain one-to-one matches', function () {
    $sure = bankLine($this->account, '2026-06-10', 'Deposit', credit: '120.00');
    receipt($this, 'INV-1', '2026-06-09', '120');
    $twoChoices = bankLine($this->account, '2026-06-10', 'Deposit', credit: '80.00');
    receipt($this, 'INV-2', '2026-06-10', '80');
    receipt($this, 'INV-3', '2026-06-11', '80');
    $nothing = bankLine($this->account, '2026-06-10', 'Deposit', credit: '55.00');

    $this->post(route('erp.banking.reconcile.auto', $this->account))->assertSessionHas('success', '1 line matched automatically.');

    expect($sure->fresh()->reconcile_kind)->toBe('matched')
        ->and($twoChoices->fresh()->reconciled_at)->toBeNull()
        ->and($nothing->fresh()->reconciled_at)->toBeNull();
});

test('bank charges are explained with a note, and the find dialog searches unmatched payments', function () {
    $charge = bankLine($this->account, '2026-06-30', 'Monthly fee', debit: '12.50');
    $this->post(route('erp.banking.reconcile.explain', $charge), ['note' => ''])->assertSessionHasErrors('note');
    $this->post(route('erp.banking.reconcile.explain', $charge), ['note' => 'Bank charges'])->assertSessionHasNoErrors();
    expect($charge->fresh())->reconcile_kind->toBe('explained')->reconcile_note->toBe('Bank charges');
    $this->post(route('erp.banking.reconcile.explain', $charge), ['note' => 'Again'])->assertSessionHasErrors('line');

    $line = bankLine($this->account, '2026-06-10', 'Deposit', credit: '75.00');
    receipt($this, 'INV-7', '2026-03-01', '75', 'EFT-5531');
    $this->get(route('erp.banking.reconcile.show', [$this->account, 'find' => $line->id, 'q' => 'eft-55']))
        ->assertInertia(fn (Assert $page) => $page
            ->missing('search') // loaded only when the dialog asks for it
            ->reloadOnly('search', fn (Assert $reload) => $reload
                ->where('search.line_id', $line->id)
                ->has('search.results', 1)
                ->where('search.results.0.number', 'INV-7')
                ->where('search.results.0.partner', 'Acme Stores')));
});

test('reconciling needs banking access in the account company, and transfers count as reconciled', function () {
    $line = bankLine($this->account, '2026-06-10', 'Deposit', credit: '10.00');
    $member = User::factory()->create();
    $this->company->users()->attach($member->id, ['role' => 'member', 'is_active' => true]);
    $this->actingAs($member)->get(route('erp.banking.reconcile.show', $this->account))->assertForbidden();
    $this->actingAs($member)->post(route('erp.banking.reconcile.explain', $line), ['note' => 'x'])->assertForbidden();

    $this->actingAs($this->user)->get(route('erp.banking.reconcile.start'))
        ->assertRedirect(route('erp.banking.reconcile.show', $this->account));

    $other = BankAccount::create([
        'bank_id' => $this->account->bank_id, 'company_id' => $this->company->id,
        'account_number' => '300101', 'account_name' => 'Savings', 'currency' => 'USD', 'opening_balance' => 0, 'status' => 'active',
    ]);
    $this->post(route('erp.banking.transfers.store'), [
        'from_account_id' => $this->account->id, 'to_account_id' => $other->id, 'transfer_date' => '2026-06-12', 'amount' => '5', 'description' => 'Move',
    ])->assertSessionHasNoErrors();
    $this->get(route('erp.banking.reconcile.show', $other))
        ->assertInertia(fn (Assert $page) => $page->where('summary.lines', 1)->where('summary.open', 0)->where('summary.reconciled', 1));
});
