<?php

use App\Models\Currency;
use App\Models\User;
use App\Modules\Accounting\Models\AccountingAccount;
use App\Modules\Accounting\Models\AccountingJournal;
use App\Modules\Accounting\Models\FiscalPeriod;
use App\Modules\Accounting\Models\FiscalYear;
use App\Modules\Accounting\Models\JournalEntry;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\ExchangeRateService;
use Carbon\CarbonImmutable;

function accountingLedgerFixture(string $code): array
{
    $user = User::factory()->create();
    $company = Company::create([
        'code' => $code,
        'name' => "{$code} Accounting Company",
        'default_currency' => 'USD',
    ]);
    $company->users()->attach($user->id, ['role' => 'owner', 'is_active' => true]);
    app(CompanyContext::class)->setActiveCompany($company);
    Currency::create(['name' => 'US Dollar', 'code' => 'USD', 'symbol' => '$']);
    Currency::create(['name' => 'Zimbabwe Gold', 'code' => 'ZWG', 'symbol' => 'ZiG']);
    $cash = AccountingAccount::create([
        'code' => '1000',
        'name' => 'Cash',
        'account_type' => 'asset',
    ]);
    $equity = AccountingAccount::create([
        'code' => '3000',
        'name' => 'Opening equity',
        'account_type' => 'equity',
    ]);
    $journal = AccountingJournal::create([
        'code' => 'GEN',
        'name' => 'General journal',
        'journal_type' => 'general',
        'is_active' => true,
    ]);
    app(CompanyContext::class)->setActiveCompany(null);

    return [$user, $company, $cash, $equity, $journal];
}

test('manual journal entries post atomically when balanced in base currency', function () {
    [$user, $company, $cash, $equity, $journal] = accountingLedgerFixture('ACC');

    $this->actingAs($user)->withSession(['active_erp_company_id' => $company->id])
        ->post(route('erp.accounting.fiscal-years.store'), [
            'name' => 'FY 2026',
            'starts_on' => '2026-01-01',
            'ends_on' => '2026-12-31',
        ])
        ->assertRedirect();
    expect(FiscalPeriod::query()->count())->toBe(12);

    $this->post(route('erp.accounting.entries.store'), [
        'journal_id' => $journal->id,
        'entry_date' => '2026-06-15',
        'currency_code' => 'USD',
        'description' => 'Opening cash balance',
        'reference' => 'OPEN-001',
        'lines' => [
            ['account_id' => $cash->id, 'description' => 'Cash', 'debit' => '100.0000', 'credit' => '0'],
            ['account_id' => $equity->id, 'description' => 'Opening balance', 'debit' => '0', 'credit' => '100.0000'],
        ],
    ])->assertRedirect()->assertSessionHas('success');

    $entry = JournalEntry::query()->with('lines')->firstOrFail();
    expect($entry->status)->toBe('posted')
        ->and($entry->currency_code)->toBe('USD')
        ->and($entry->debit_total)->toBe('100.0000')
        ->and($entry->credit_total)->toBe('100.0000')
        ->and($entry->lines)->toHaveCount(2)
        ->and($entry->lines[0]->debit)->toBe('100.0000')
        ->and($entry->lines[1]->credit)->toBe('100.0000');

    expect(fn () => $entry->forceFill(['description' => 'Changed after posting'])->save())
        ->toThrow('LogicException', 'Posted journal entries are immutable');
    expect(fn () => $entry->lines[0]->delete())
        ->toThrow('LogicException', 'Lines on posted journal entries cannot be deleted');
});

test('journal entries reject imbalanced amounts and locked accounting periods', function () {
    [$user, $company, $cash, $equity, $journal] = accountingLedgerFixture('ACL');
    app(CompanyContext::class)->setActiveCompany($company);
    $period = FiscalPeriod::create([
        'fiscal_year_id' => FiscalYear::create([
            'name' => 'FY 2026',
            'starts_on' => '2026-01-01',
            'ends_on' => '2026-12-31',
            'status' => 'open',
        ])->id,
        'name' => 'FY 2026 01',
        'starts_on' => '2026-01-01',
        'ends_on' => '2026-01-31',
        'status' => 'locked',
        'locked_by' => $user->id,
        'locked_at' => now(),
    ]);
    app(CompanyContext::class)->setActiveCompany(null);
    $this->actingAs($user)->withSession(['active_erp_company_id' => $company->id]);

    $this->post(route('erp.accounting.entries.store'), [
        'journal_id' => $journal->id,
        'entry_date' => '2026-01-15',
        'currency_code' => 'USD',
        'description' => 'Should be rejected',
        'lines' => [
            ['account_id' => $cash->id, 'debit' => '100', 'credit' => '0'],
            ['account_id' => $equity->id, 'debit' => '0', 'credit' => '100'],
        ],
    ])->assertSessionHasErrors('entry_date');

    app(CompanyContext::class)->setActiveCompany($company);
    $period->forceFill(['status' => 'open', 'locked_by' => null, 'locked_at' => null])->save();
    app(CompanyContext::class)->setActiveCompany(null);
    $this->post(route('erp.accounting.entries.store'), [
        'journal_id' => $journal->id,
        'entry_date' => '2026-01-15',
        'currency_code' => 'USD',
        'description' => 'Should be rejected',
        'lines' => [
            ['account_id' => $cash->id, 'debit' => '100', 'credit' => '0'],
            ['account_id' => $equity->id, 'debit' => '0', 'credit' => '90'],
        ],
    ])->assertSessionHasErrors('lines');
    expect(JournalEntry::query()->count())->toBe(0);
});

test('posted journal entries can be reversed once with debit and credit amounts swapped', function () {
    [$user, $company, $cash, $equity, $journal] = accountingLedgerFixture('ACR');
    $this->actingAs($user)->withSession(['active_erp_company_id' => $company->id])
        ->post(route('erp.accounting.fiscal-years.store'), [
            'name' => 'FY 2026',
            'starts_on' => '2026-01-01',
            'ends_on' => '2026-12-31',
        ])->assertRedirect();

    $this->post(route('erp.accounting.entries.store'), [
        'journal_id' => $journal->id,
        'entry_date' => '2026-06-15',
        'currency_code' => 'USD',
        'description' => 'Opening cash balance',
        'lines' => [
            ['account_id' => $cash->id, 'description' => 'Cash', 'debit' => '100', 'credit' => '0'],
            ['account_id' => $equity->id, 'description' => 'Opening balance', 'debit' => '0', 'credit' => '100'],
        ],
    ])->assertRedirect()->assertSessionHas('success');

    $entry = JournalEntry::query()->with('lines')->firstOrFail();
    $this->post(route('erp.accounting.entries.reverse', $entry), [
        'reversal_date' => '2026-07-01',
    ])->assertRedirect()->assertSessionHas('success');

    $reversal = JournalEntry::query()->where('reversal_of_id', $entry->id)->with('lines')->firstOrFail();
    expect($reversal->status)->toBe('posted')
        ->and($reversal->currency_code)->toBe('USD')
        ->and($reversal->debit_total)->toBe($entry->credit_total)
        ->and($reversal->credit_total)->toBe($entry->debit_total)
        ->and($reversal->lines[0]->debit)->toBe($entry->lines[0]->credit)
        ->and($reversal->lines[0]->credit)->toBe($entry->lines[0]->debit)
        ->and($reversal->lines[0]->currency_debit)->toBe($entry->lines[0]->currency_credit)
        ->and($reversal->lines[0]->currency_credit)->toBe($entry->lines[0]->currency_debit);

    $this->post(route('erp.accounting.entries.reverse', $entry), [
        'reversal_date' => '2026-07-01',
    ])->assertSessionHasErrors('entry');
    expect(JournalEntry::query()->count())->toBe(2);
});

test('trial balance reports posted account balances as of the selected date', function () {
    [$user, $company, $cash, $equity, $journal] = accountingLedgerFixture('ACT');
    $this->actingAs($user)->withSession(['active_erp_company_id' => $company->id])
        ->post(route('erp.accounting.fiscal-years.store'), [
            'name' => 'FY 2026',
            'starts_on' => '2026-01-01',
            'ends_on' => '2026-12-31',
        ])->assertRedirect();

    foreach ([
        ['date' => '2026-06-15', 'amount' => '100'],
        ['date' => '2026-07-15', 'amount' => '25'],
    ] as $transaction) {
        $this->post(route('erp.accounting.entries.store'), [
            'journal_id' => $journal->id,
            'entry_date' => $transaction['date'],
            'currency_code' => 'USD',
            'description' => 'Cash balance',
            'lines' => [
                ['account_id' => $cash->id, 'debit' => $transaction['amount'], 'credit' => '0'],
                ['account_id' => $equity->id, 'debit' => '0', 'credit' => $transaction['amount']],
            ],
        ])->assertRedirect()->assertSessionHas('success');
    }

    $this->get(route('erp.accounting.index', ['as_of' => '2026-06-30']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Erp/Accounting/Index')
            ->where('trialBalance.asOf', '2026-06-30')
            ->where('trialBalance.rows.0.code', '1000')
            ->where('trialBalance.rows.0.debit', '100.0000')
            ->where('trialBalance.rows.0.credit', '0.0000')
            ->where('trialBalance.rows.1.code', '3000')
            ->where('trialBalance.rows.1.debit', '0.0000')
            ->where('trialBalance.rows.1.credit', '100.0000')
            ->where('trialBalance.totalDebit', '100.0000')
            ->where('trialBalance.totalCredit', '100.0000'));
});

test('foreign-currency journal entries use the recorded rate for company-currency totals', function () {
    [$user, $company, $cash, $equity, $journal] = accountingLedgerFixture('ACF');
    app(CompanyContext::class)->setActiveCompany($company);
    app(ExchangeRateService::class)->record(
        'ZWG',
        'USD',
        '0.00005',
        CarbonImmutable::parse('2026-01-01'),
        $user->id,
        'test',
    );
    app(CompanyContext::class)->setActiveCompany(null);
    $this->actingAs($user)->withSession(['active_erp_company_id' => $company->id])
        ->post(route('erp.accounting.fiscal-years.store'), [
            'name' => 'FY 2026',
            'starts_on' => '2026-01-01',
            'ends_on' => '2026-12-31',
        ])->assertRedirect();

    $this->post(route('erp.accounting.entries.store'), [
        'journal_id' => $journal->id,
        'entry_date' => '2026-06-15',
        'currency_code' => 'ZWG',
        'description' => 'Foreign currency cash receipt',
        'lines' => [
            ['account_id' => $cash->id, 'debit' => '20000', 'credit' => '0'],
            ['account_id' => $equity->id, 'debit' => '0', 'credit' => '20000'],
        ],
    ])->assertRedirect()->assertSessionHas('success');

    $entry = JournalEntry::query()->with('lines')->firstOrFail();
    expect($entry->currency_code)->toBe('ZWG')
        ->and($entry->exchange_rate)->toBe('0.0000500000')
        ->and($entry->debit_total)->toBe('1.0000')
        ->and($entry->credit_total)->toBe('1.0000')
        ->and($entry->lines[0]->currency_debit)->toBe('20000.0000')
        ->and($entry->lines[0]->debit)->toBe('1.0000');
});
