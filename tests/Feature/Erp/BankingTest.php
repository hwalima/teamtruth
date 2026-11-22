<?php

use App\Models\User;
use App\Modules\Banking\Models\BankAccount;
use App\Modules\Banking\Models\BankTransaction;
use App\Modules\Banking\Models\BankTransfer;
use App\Modules\Banking\Models\StatementImport;
use App\Modules\Banking\Services\StatementImportService;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\CompanyContext;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

beforeEach(function () {
    Storage::fake('local');
    $this->user = User::factory()->create();
    $this->company = Company::create(['code' => 'SMP', 'name' => 'Sample Mining']);
    $this->company->users()->attach($this->user->id, ['role' => 'owner', 'is_active' => true]);
    $this->actingAs($this->user)->withSession(['active_erp_company_id' => $this->company->id]);
    app(CompanyContext::class)->setActiveCompany($this->company);
});

/** A statement sheet laid out like the agency's workbook: header block, formulas for the balance, a totals row. */
function statementSheet(Worksheet $sheet, string $title, string $holderLine, string $numberLine, array $opening, array $lines, array $typedBalances = []): void
{
    $sheet->setTitle($title);
    $sheet->setCellValue('A1', 'Sample Banking Agency');
    $sheet->setCellValue('A2', $holderLine);
    $sheet->setCellValue('F2', $numberLine);
    $sheet->setCellValue('A3', 'Statement Period: 01/10/26 - 31/10/26');
    $sheet->fromArray(['Date', 'Txn Type', 'Description', 'Ref No.', 'Debit', 'Credit', 'Balance'], null, 'A5');

    [$date, $credit, $balance] = $opening;
    $sheet->fromArray([$date, 'Cash Dep', 'Opening balance', null, 0, $credit], null, 'A7', true);
    $sheet->setCellValue('G7', $balance ?? '=G6+F7-E7');

    $row = 8;
    foreach ($lines as [$day, $type, $description, $debit, $credit]) {
        $sheet->fromArray([$day, $type, $description, null, $debit, $credit], null, "A{$row}", true);
        $sheet->setCellValue("G{$row}", $typedBalances[$row] ?? '=G'.($row - 1)."+F{$row}-E{$row}");
        $row++;
    }
    $sheet->setCellValue('E'.($row + 2), '=SUM(E7:E'.($row - 1).')');
    $sheet->setCellValue('F'.($row + 2), '=SUM(F7:F'.($row - 1).')');
    // Formula-only rows below the table, as in the real workbook.
    $sheet->setCellValue('G'.($row + 4), '=G'.($row + 3).'+F'.($row + 4).'-E'.($row + 4));
}

function statementWorkbook(): UploadedFile
{
    $book = new Spreadsheet;
    // 46296 = 1 Oct 2026.
    statementSheet($book->getActiveSheet(), 'Alpha ', 'Sample Holdings Account', 'Account No: 200201', [46296, 100, null], [
        [46296, 'Cash Dep', 'Takings', null, 250.5],
        [46297, 'Cash Wdl', 'Fuel', 80.25, null],
        [46298, 'Cash Wdl', 'Wages', 300, null],
    ]);
    statementSheet($book->createSheet(), 'Beta', 'Account Name: Sample Bakery', 'Account No: 200201', [46296, 0, 50], [
        [46297, 'Cash Dep', 'Bread sales', null, 40],
        [46298, 'Cah Dep', 'Cake sales', null, 10],
        [46299, 'Cash Wdl', 'Flour', 30, null],
        [46300, 'Cash Dep', 'Bread sales', null, 5],
    ], [9 => 95, 10 => 999]);
    $book->getSheet(1)->setCellValue('J9', 'n');
    statementSheet($book->createSheet(), 'Gamma', 'Account Name: Sample Mining', 'Account No: ', [45931, 0, 1000], [
        [46300, 'Cash Wdl', 'Drill bits', 1500, null],
    ]);

    $path = tempnam(sys_get_temp_dir(), 'stmt').'.xlsx';
    (new Xlsx($book))->save($path);

    return new UploadedFile($path, 'Statements.xlsx', null, null, true);
}

function previewStatements(): StatementImport
{
    test()->post(route('erp.banking.imports.store'), ['file' => statementWorkbook()])->assertSessionHasNoErrors();

    return StatementImport::query()->latest('id')->firstOrFail();
}

function importStatements(): StatementImport
{
    $import = previewStatements();
    $choices = collect([0, 1, 2])->mapWithKeys(fn ($i) => [$i => ['include' => true, 'company' => $i === 2 ? (string) test()->company->id : 'new']])->all();
    test()->post(route('erp.banking.imports.commit', $import), ['choices' => $choices])->assertSessionHasNoErrors();

    return $import->refresh();
}

test('a statement workbook previews without saving and plans companies and account numbers', function () {
    $import = previewStatements();
    $this->get(route('erp.banking.imports.show', $import))->assertOk();

    $sheets = collect($import->summary['sheets'])->keyBy('index');
    expect(BankAccount::query()->count())->toBe(0)
        ->and(Company::query()->count())->toBe(1)
        ->and($sheets[0]['account_name'])->toBe('Sample Holdings')
        ->and($sheets[0]['opening']['balance'])->toBe(10000)
        ->and($sheets[0]['credits'])->toBe(25050)
        ->and($sheets[0]['debits'])->toBe(38025)
        ->and($sheets[0]['closing'])->toBe(-2975)
        ->and($sheets[0]['file_totals']['matches'])->toBeTrue()
        ->and($sheets[1]['differences'])->toHaveCount(3)
        ->and($sheets[1]['closing'])->toBe(7500)
        ->and($sheets[1]['notes'])->toContain('Cell J9 holds “n” outside the statement columns; it was not imported.')
        ->and(collect($sheets[1]['notes'])->contains(fn ($n) => str_contains($n, '“Cah Dep”')))->toBeTrue()
        ->and(collect($sheets[2]['notes'])->contains(fn ($n) => str_contains($n, 'days before the first transaction')))->toBeTrue();

    $plan = collect(app(StatementImportService::class)->plan($import, $this->user))->keyBy('index');
    expect($plan[0]['account_number'])->toBe('200201')
        ->and($plan[1]['account_number'])->toBe('200202')
        ->and($plan[2]['account_number'])->toBe('200203')
        ->and($plan[0]['company_choice'])->toBe('new')
        ->and($plan[0]['new_company_code'])->toBe('SH')
        ->and($plan[2]['company_id'])->toBe($this->company->id);
});

test('importing creates the missing companies and keeps every line as written', function () {
    $import = importStatements();
    expect($import->status)->toBe(StatementImport::IMPORTED);

    $holdings = Company::query()->where('name', 'Sample Holdings')->sole();
    expect(Company::query()->count())->toBe(3)
        ->and($holdings->users()->whereKey($this->user->id)->first()->pivot->role)->toBe('owner')
        ->and(app(CompanyContext::class)->activeCompany()->id)->toBe($this->company->id);

    $alpha = BankAccount::query()->where('account_number', '200201')->sole();
    $beta = BankAccount::query()->where('account_number', '200202')->sole();
    $gamma = BankAccount::query()->where('account_number', '200203')->sole();
    expect($alpha->company_id)->toBe($holdings->id)
        ->and($alpha->opening_balance)->toBe('100.00')
        ->and($beta->source_account_number)->toBe('200201')
        ->and($gamma->company_id)->toBe($this->company->id)
        ->and($gamma->opening_date->toDateString())->toBe('2025-10-01')
        ->and(BankTransaction::query()->count())->toBe(8)
        ->and($alpha->transactions()->orderBy('sequence')->pluck('credit')->all())->toBe(['250.50', '0.00', '0.00'])
        ->and($beta->transactions()->where('source_row', 9)->value('type'))->toBe('Cah Dep')
        ->and($beta->transactions()->where('source_row', 10)->value('stated_balance'))->toBe('999.00');

    $statement = $this->get(route('erp.banking.accounts.show', $beta))->assertOk()->viewData('page')['props']['statement'];
    expect($statement['opening'])->toBe(5000)
        ->and($statement['credits'])->toBe(5500)
        ->and($statement['debits'])->toBe(3000)
        ->and($statement['closing'])->toBe(7500)
        ->and(array_column($statement['lines'], 'balance'))->toBe([9000, 10000, 7000, 7500])
        ->and(count($statement['differences']))->toBe(3);

    $this->get(route('erp.banking.index'))->assertOk();
});

test('the same workbook cannot be imported twice, and an import can be undone', function () {
    $import = importStatements();
    $this->post(route('erp.banking.imports.store'), ['file' => statementWorkbook()])->assertSessionHasErrors('file');

    $this->post(route('erp.banking.imports.undo', $import))->assertSessionHasNoErrors();
    expect($import->refresh()->status)->toBe(StatementImport::UNDONE)
        ->and(BankAccount::query()->count())->toBe(0)
        ->and(BankTransaction::query()->count())->toBe(0)
        ->and(Company::query()->count())->toBe(3);

    $this->post(route('erp.banking.imports.store'), ['file' => statementWorkbook()])->assertSessionHasNoErrors();
});

test('statements download as PDF and Excel for a period', function () {
    importStatements();
    $alpha = BankAccount::query()->where('account_number', '200201')->sole();

    $pdf = $this->get(route('erp.banking.accounts.statement', ['account' => $alpha, 'format' => 'pdf']));
    $pdf->assertOk()->assertHeader('Content-Type', 'application/pdf');
    expect(substr($pdf->getContent(), 0, 4))->toBe('%PDF');

    $xlsx = $this->get(route('erp.banking.accounts.statement', ['account' => $alpha, 'format' => 'xlsx', 'from' => '2026-10-02', 'to' => '2026-10-03']));
    $xlsx->assertOk();
    $path = tempnam(sys_get_temp_dir(), 'st').'.xlsx';
    file_put_contents($path, $xlsx->streamedContent());
    $rows = IOFactory::load($path)->getActiveSheet()->toArray(null, true, false);
    $flat = collect($rows)->flatten()->filter(fn ($v) => $v !== null)->values()->all();
    expect($flat)->toContain('200201', 'Balance brought forward', 'Fuel', 'Wages')
        ->not->toContain('Takings')
        ->and(collect($rows)->firstWhere(2, 'Balance brought forward')[6])->toBe(350.5)
        ->and(collect($rows)->firstWhere(2, 'Totals / closing balance')[6])->toBe(-29.75);
});

test('money moves between companies by transfer, and hand-entered lines can be removed', function () {
    importStatements();
    $alpha = BankAccount::query()->where('account_number', '200201')->sole();
    $gamma = BankAccount::query()->where('account_number', '200203')->sole();

    $this->post(route('erp.banking.transfers.store'), [
        'from_account_id' => $gamma->id, 'to_account_id' => $alpha->id, 'transfer_date' => '2026-10-20', 'amount' => '120.40', 'description' => 'Float',
    ])->assertSessionHasNoErrors();

    expect($gamma->balanceCents())->toBe(-50000 - 12040)
        ->and($alpha->balanceCents())->toBe(-2975 + 12040)
        ->and($alpha->transactions()->whereNotNull('transfer_id')->value('description'))->toContain('Transfer from Sample Mining (200203)');

    $this->post(route('erp.banking.transactions.store', $alpha), [
        'direction' => 'debit', 'transaction_date' => '2026-10-21', 'amount' => '9.75', 'description' => 'Bank charge',
    ])->assertSessionHasNoErrors();
    $manual = $alpha->transactions()->where('description', 'Bank charge')->sole();
    expect($manual->type)->toBe('Cash Wdl');

    $imported = $alpha->transactions()->whereNotNull('import_id')->first();
    $this->delete(route('erp.banking.transactions.destroy', $imported))->assertSessionHas('error');
    $this->delete(route('erp.banking.transactions.destroy', $manual))->assertSessionHas('success');

    $this->delete(route('erp.banking.transfers.destroy', BankTransfer::query()->sole()))->assertSessionHasNoErrors();
    expect(BankTransfer::query()->count())->toBe(0)
        ->and($alpha->balanceCents())->toBe(-2975)
        ->and($gamma->balanceCents())->toBe(-50000);
});

test('accounts of companies without banking access stay hidden', function () {
    importStatements();
    $gamma = BankAccount::query()->where('account_number', '200203')->sole();
    $other = User::factory()->create();
    $this->company->users()->attach($other->id, ['role' => 'member', 'is_active' => true]);

    $this->actingAs($other)->get(route('erp.banking.accounts.show', $gamma))->assertForbidden();
});
