<?php

use App\Models\Currency;
use App\Models\User;
use App\Modules\Accounting\Models\AccountingAccount;
use App\Modules\Accounting\Models\AccountingJournal;
use App\Modules\Accounting\Models\FiscalPeriod;
use App\Modules\Accounting\Models\FiscalYear;
use App\Modules\Accounting\Models\JournalEntryLine;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\DataImport\Models\DataImport;
use App\Modules\Invoicing\Models\Customer;
use App\Modules\Invoicing\Models\FiscalDocument;
use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Invoicing\Models\InvoicePayment;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

beforeEach(function () {
    Storage::fake('local');
    $this->user = User::factory()->create();
    $this->company = Company::create(['code' => 'SMC', 'name' => 'Sample Mining', 'default_currency' => 'USD']);
    $this->company->users()->attach($this->user->id, ['role' => 'owner', 'is_active' => true]);
    Currency::query()->firstOrCreate(['code' => 'USD'], ['name' => 'US Dollar', 'symbol' => '$']);

    app(CompanyContext::class)->setActiveCompany($this->company);
    AccountingAccount::create(['code' => '1010', 'name' => 'Bank', 'account_type' => 'asset']);
    $this->ar = AccountingAccount::create(['code' => '1200', 'name' => 'Accounts receivable', 'account_type' => 'asset', 'allow_reconciliation' => true]);
    AccountingAccount::create(['code' => '2200', 'name' => 'VAT payable', 'account_type' => 'liability']);
    $this->revenue = AccountingAccount::create(['code' => '4000', 'name' => 'Gold sales', 'account_type' => 'income']);
    $this->deduction = AccountingAccount::create(['code' => '5100', 'name' => 'Deductions withheld', 'account_type' => 'expense']);
    AccountingJournal::create(['code' => 'SINV', 'name' => 'Sales journal', 'journal_type' => 'sales', 'is_active' => true]);
    AccountingJournal::create(['code' => 'BNK', 'name' => 'Bank journal', 'journal_type' => 'bank', 'is_active' => true]);
    $year = FiscalYear::create(['name' => 'FY 2026', 'starts_on' => '2026-01-01', 'ends_on' => '2026-12-31', 'status' => 'open']);
    FiscalPeriod::create(['fiscal_year_id' => $year->id, 'name' => 'FY 2026', 'starts_on' => '2026-01-01', 'ends_on' => '2026-12-31', 'status' => 'open']);
    app(CompanyContext::class)->setActiveCompany(null);

    $this->actingAs($this->user)->withSession(['active_erp_company_id' => $this->company->id]);
});

const ODOO_INVOICE_HEADER = ['Number', 'Invoice Partner Display Name', 'Invoice/Bill Date', 'Due Date', 'Untaxed Amount Signed Currency', 'Tax Signed', 'Total in Currency Signed', 'Amount Due Signed', 'Currency', 'Status In Payment', 'Fiscalised'];

function odooInvoices(array $rows): UploadedFile
{
    $spreadsheet = new Spreadsheet;
    $spreadsheet->getActiveSheet()->fromArray([ODOO_INVOICE_HEADER, ...$rows], null, 'A1', true);
    $path = tempnam(sys_get_temp_dir(), 'odoo').'.xlsx';
    (new Xlsx($spreadsheet))->save($path);

    return new UploadedFile($path, 'Journal Entry (account.move).xlsx', null, null, true);
}

function odooInvoiceRows(string $thirdStatus = 'Posted', float $thirdDue = 495): array
{
    return [
        ['INV/2026/00001', 'Acme Refinery', '2026-01-10', '2026-01-20', 1000, -20, 980, 0, 'USD', 'Paid', 'true'],
        // 46054 is 1 February 2026 as an Excel date.
        ['INV/2026/00002', 'Acme Refinery', 46054, 46063, 2000, -31, 1969, 969, 'USD', 'Partially Paid', 'true'],
        ['INV/2026/00003', 'Acme Refinery', '2026-03-01', '2026-03-11', 500, -5, 495, $thirdDue, 'USD', $thirdStatus, null],
        [null, 'Acme Refinery', '2026-03-05', null, 0, 0, 0, 0, 'USD', 'Draft', null],
        [null, 'Acme Refinery', '2026-03-06', '2026-03-16', 300, -3, 297, 297, 'USD', 'Cancelled', null],
    ];
}

function importOdooInvoices(array $rows, array $options = []): DataImport
{
    test()->post(route('erp.data-import.store'), ['file' => odooInvoices($rows), ...$options])->assertSessionHasNoErrors();
    $import = DataImport::query()->withoutGlobalScopes()->latest('id')->firstOrFail();
    test()->post(route('erp.data-import.commit', $import))->assertSessionHasNoErrors();

    return $import->fresh();
}

/** Net debit minus credit on an account, across every posted entry. */
function ledgerNet(AccountingAccount $account): float
{
    return round((float) JournalEntryLine::query()->withoutGlobalScopes()->where('account_id', $account->id)->sum('debit')
        - (float) JournalEntryLine::query()->withoutGlobalScopes()->where('account_id', $account->id)->sum('credit'), 2);
}

test('Odoo customer invoices are previewed, then imported, posted and paid', function () {
    $this->post(route('erp.data-import.store'), ['file' => odooInvoices(odooInvoiceRows()), 'deduction_account_id' => $this->deduction->id])
        ->assertSessionHasNoErrors();
    $import = DataImport::query()->withoutGlobalScopes()->sole();

    expect($import->model)->toBe('account.move')
        ->and($import->summary['actions'])->toMatchArray(['created' => 3, 'skipped' => 2])
        ->and(Invoice::query()->withoutGlobalScopes()->count())->toBe(0);

    $this->post(route('erp.data-import.commit', $import))->assertSessionHasNoErrors();

    $invoices = Invoice::query()->withoutGlobalScopes()->orderBy('document_number')->get()->keyBy('document_number');
    expect($invoices->keys()->all())->toBe(['INV/2026/00001', 'INV/2026/00002', 'INV/2026/00003'])
        ->and($invoices['INV/2026/00001']->status)->toBe('paid')
        ->and((float) $invoices['INV/2026/00001']->total_amount)->toBe(980.0)
        ->and($invoices['INV/2026/00002']->status)->toBe('partial_paid')
        ->and((float) $invoices['INV/2026/00002']->balance_due)->toBe(969.0)
        ->and($invoices['INV/2026/00002']->invoice_date->toDateString())->toBe('2026-02-01')
        ->and($invoices['INV/2026/00003']->status)->toBe('sent')
        ->and(Customer::query()->withoutGlobalScopes()->where('name', 'Acme Refinery')->count())->toBe(1);

    // Dr receivable 3,444 and deductions 56; Cr sales 3,500. Then 1,980 received.
    expect(ledgerNet($this->revenue))->toBe(-3500.0)
        ->and(ledgerNet($this->deduction))->toBe(56.0)
        ->and(ledgerNet($this->ar))->toBe(3444.0 - 1980.0)
        ->and((float) InvoicePayment::query()->withoutGlobalScopes()->sum('amount'))->toBe(1980.0);

    expect(FiscalDocument::query()->withoutGlobalScopes()->where('status', 'success')->count())->toBe(2);
});

test('re-importing records only the new payments, and undo takes it all back out', function () {
    $first = importOdooInvoices(odooInvoiceRows(), ['deduction_account_id' => $this->deduction->id]);
    $second = importOdooInvoices(odooInvoiceRows('Paid', 0), ['deduction_account_id' => $this->deduction->id]);

    expect($second->summary['actions'])->toMatchArray(['updated' => 1])
        ->and(Invoice::query()->withoutGlobalScopes()->count())->toBe(3)
        ->and(InvoicePayment::query()->withoutGlobalScopes()->count())->toBe(3)
        ->and(Invoice::query()->withoutGlobalScopes()->where('document_number', 'INV/2026/00003')->value('status'))->toBe('paid');

    $this->post(route('erp.data-import.undo', $second))->assertSessionHasNoErrors();
    expect(InvoicePayment::query()->withoutGlobalScopes()->count())->toBe(2)
        ->and(Invoice::query()->withoutGlobalScopes()->where('document_number', 'INV/2026/00003')->value('status'))->toBe('sent');

    $this->post(route('erp.data-import.undo', $first))->assertSessionHasNoErrors();
    expect(Invoice::query()->withoutGlobalScopes()->withTrashed()->count())->toBe(0)
        ->and(InvoicePayment::query()->withoutGlobalScopes()->count())->toBe(0)
        ->and(FiscalDocument::query()->withoutGlobalScopes()->count())->toBe(0)
        ->and(Customer::query()->withoutGlobalScopes()->count())->toBe(0)
        ->and(ledgerNet($this->ar))->toBe(0.0)
        ->and(ledgerNet($this->revenue))->toBe(0.0)
        ->and(ledgerNet($this->deduction))->toBe(0.0);
});

test('deductions need an account to go to', function () {
    AccountingAccount::query()->withoutGlobalScopes()->whereKey($this->deduction->id)->update(['name' => 'Other expenses']);

    $this->post(route('erp.data-import.store'), ['file' => odooInvoices(odooInvoiceRows())])
        ->assertSessionHasErrors('deduction_account_id');
});

test('a deduction account named for royalties is picked without being chosen', function () {
    AccountingAccount::query()->withoutGlobalScopes()->whereKey($this->deduction->id)->update(['name' => 'Royalties withheld']);

    importOdooInvoices(odooInvoiceRows());

    expect(ledgerNet($this->deduction))->toBe(56.0);
});
