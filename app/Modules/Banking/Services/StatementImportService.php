<?php

namespace App\Modules\Banking\Services;

use App\Models\User;
use App\Modules\Banking\Models\Bank;
use App\Modules\Banking\Models\BankAccount;
use App\Modules\Banking\Models\BankTransaction;
use App\Modules\Banking\Models\Money;
use App\Modules\Banking\Models\StatementImport;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\CompanyService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;

/**
 * Statement workbook → accounts and lines. Upload makes a preview (nothing is
 * saved); commit creates any missing companies and accounts and stores every
 * line exactly as the sheet has it; undo removes what the import added.
 */
class StatementImportService
{
    /** Numbers given to new accounts start after this when nothing is numbered yet. */
    private const FIRST_ACCOUNT_NUMBER = 100101;

    public function __construct(
        private StatementReader $reader,
        private BankingAccess $access,
        private CompanyContext $context,
    ) {}

    public function upload(Company $company, User $user, UploadedFile $file): StatementImport
    {
        $hash = hash_file('sha256', $file->getRealPath());
        $earlier = StatementImport::query()->where('file_hash', $hash)->where('status', StatementImport::IMPORTED)->first();
        if ($earlier) {
            throw ValidationException::withMessages([
                'file' => 'This exact file was already imported on '.$earlier->imported_at?->format('j M Y H:i').'. Undo that import first if you want to bring it in again.',
            ]);
        }

        try {
            $sheets = $this->reader->read($file->getRealPath());
        } catch (RuntimeException $exception) {
            throw ValidationException::withMessages(['file' => $exception->getMessage()]);
        }

        $path = $file->storeAs('banking-imports', Str::uuid().'.'.strtolower($file->getClientOriginalExtension() ?: 'xlsx'), 'local');

        return StatementImport::query()->create([
            'company_id' => $company->id,
            'filename' => $file->getClientOriginalName(),
            'file_path' => $path,
            'file_hash' => $hash,
            'status' => StatementImport::PREVIEW,
            'summary' => ['sheets' => array_map(fn (array $sheet) => $this->withoutLines($sheet), $sheets)],
            'created_by' => $user->id,
        ]);
    }

    /**
     * What commit would do with each sheet: which company, which account and
     * number, and whether the sheet is brought in.
     *
     * @param  array<int|string, array{include?: bool|string|int, company?: string|int|null}>  $choices
     * @return list<array<string, mixed>>
     */
    public function plan(StatementImport $import, User $user, array $choices = []): array
    {
        $companies = $this->access->companies($user, 'erp.banking.manage');
        $sheets = $import->summary['sheets'] ?? [];
        $claimed = BankAccount::query()->pluck('account_number')->map(fn ($n) => (string) $n)->all();
        $plans = [];
        $newCompanies = [];

        foreach ($sheets as $sheet) {
            $index = (int) $sheet['index'];
            $choice = $choices[$index] ?? $choices[(string) $index] ?? [];
            $match = $this->matchCompany($companies, $sheet['account_name']);
            $companyChoice = $choice['company'] ?? ($match?->id ?? 'new');
            $company = $companyChoice === 'new' ? null : $companies->firstWhere('id', (int) $companyChoice);
            if ($companyChoice !== 'new' && $company === null) {
                throw ValidationException::withMessages(["choices.{$index}.company" => 'Choose a company you manage banking for.']);
            }

            $newKey = $company ? null : $this->normalise($sheet['account_name']);
            $account = $company ? $this->matchAccount($company, $sheet) : null;
            $overlap = $account ? $account->transactions()
                ->whereBetween('transaction_date', [$sheet['first_date'] ?? $sheet['opening']['date'], $sheet['last_date'] ?? $sheet['opening']['date']])
                ->count() : 0;
            $include = array_key_exists('include', $choice) ? filter_var($choice['include'], FILTER_VALIDATE_BOOLEAN) : $overlap === 0;

            $warnings = [];
            if ($overlap > 0) {
                $warnings[] = "{$account->account_number} already has {$overlap} line(s) in these dates. Bringing this sheet in again would repeat them, so it is left out unless you tick it.";
            }
            if ($account && $include) {
                $current = $account->balanceCents();
                if ($current !== $sheet['opening']['balance']) {
                    $warnings[] = 'The account’s balance today is '.Money::format($current).' but this sheet opens at '.Money::format($sheet['opening']['balance']).'. The lines are added after the existing ones.';
                }
            }

            $plans[$index] = [
                'index' => $index,
                'include' => $include,
                'company_id' => $company?->id,
                'company_name' => $company?->name ?? $sheet['account_name'],
                'company_choice' => $company ? (string) $company->id : 'new',
                'matched_company_id' => $match?->id,
                'new_company_key' => $newKey,
                'new_company_code' => null,
                'account_id' => $account?->id,
                'account_number' => $account?->account_number,
                'file_account_number' => $sheet['account_number'],
                'warnings' => $warnings,
            ];

            if ($include && $newKey !== null) {
                $newCompanies[$newKey] ??= $sheet['account_name'];
            }
        }

        // New companies get a code now so the preview shows it.
        $codes = $this->companyCodes(array_values($newCompanies));
        foreach ($plans as $i => $plan) {
            if ($plan['new_company_key'] !== null) {
                $plans[$i]['new_company_code'] = $codes[$newCompanies[$plan['new_company_key']] ?? ''] ?? null;
            }
        }

        // Account numbers: the file's own number when it is still free, then the next free numbers.
        foreach ($plans as $i => $plan) {
            $number = $plan['file_account_number'];
            if ($plan['include'] && $plan['account_id'] === null && $number !== null && $number !== '' && ! in_array($number, $claimed, true)) {
                $plans[$i]['account_number'] = $number;
                $claimed[] = $number;
            }
        }
        $next = max([self::FIRST_ACCOUNT_NUMBER - 1, ...array_map('intval', array_filter($claimed, 'ctype_digit'))]) + 1;
        foreach ($plans as $i => $plan) {
            if ($plan['include'] && $plan['account_number'] === null) {
                while (in_array((string) $next, $claimed, true)) {
                    $next++;
                }
                $plans[$i]['account_number'] = (string) $next;
                $claimed[] = (string) $next;
            }
            if ($plan['include'] && $plan['account_id'] === null && filled($plan['file_account_number']) && $plans[$i]['account_number'] !== $plan['file_account_number']) {
                $plans[$i]['warnings'][] = 'The sheet gives account number '.$plan['file_account_number'].', which is already used, so this account becomes '.$plans[$i]['account_number'].'. The sheet’s number is kept on the account for reference.';
            }
        }

        return array_values($plans);
    }

    /** @param  array<int|string, array<string, mixed>>  $choices */
    public function commit(StatementImport $import, User $user, array $choices): StatementImport
    {
        if ($import->status !== StatementImport::PREVIEW) {
            throw ValidationException::withMessages(['import' => 'This import has already been '.$import->status.'.']);
        }
        if (! Storage::disk('local')->exists($import->file_path)) {
            throw ValidationException::withMessages(['import' => 'The uploaded file is no longer on the server. Upload it again.']);
        }

        $plans = $this->plan($import, $user, $choices);
        if (! collect($plans)->contains('include', true)) {
            throw ValidationException::withMessages(['choices' => 'Choose at least one sheet to import.']);
        }

        $sheets = collect($this->reader->read(Storage::disk('local')->path($import->file_path)))->keyBy('index');
        $previous = $this->context->activeCompany();

        try {
            $result = DB::transaction(function () use ($import, $user, $plans, $sheets) {
                $createdCompanies = [];
                $result = ['sheets' => [], 'companies_created' => [], 'accounts_created' => []];

                foreach ($plans as $plan) {
                    $sheet = $sheets->get($plan['index']);
                    if (! $plan['include'] || $sheet === null) {
                        continue;
                    }

                    $company = $plan['company_id']
                        ? Company::query()->findOrFail($plan['company_id'])
                        : ($createdCompanies[$plan['new_company_key']] ??= $this->createCompany($user, $sheet['account_name'], $plan['new_company_code']));
                    if (! $plan['company_id'] && ! in_array($company->id, $result['companies_created'], true)) {
                        $result['companies_created'][] = $company->id;
                    }

                    $bank = Bank::query()->firstOrCreate(['name' => $sheet['bank'] ?: 'Bank']);
                    $account = $plan['account_id'] ? BankAccount::query()->findOrFail($plan['account_id']) : null;
                    if ($account === null) {
                        $account = BankAccount::query()->create([
                            'bank_id' => $bank->id,
                            'company_id' => $company->id,
                            'account_number' => $plan['account_number'],
                            'source_account_number' => $sheet['account_number'],
                            'account_name' => $sheet['account_name'],
                            'currency' => $company->default_currency ?: 'USD',
                            'opening_balance' => Money::decimal($sheet['opening']['balance']),
                            'opening_date' => $sheet['opening']['date'],
                            'status' => 'active',
                            'import_id' => $import->id,
                            'created_by' => $user->id,
                        ]);
                        $result['accounts_created'][] = $account->id;
                    }

                    $sequence = $account->nextSequence();
                    $now = now();
                    $rows = array_map(fn (array $line) => [
                        'account_id' => $account->id,
                        'transaction_date' => $line['date'],
                        'sequence' => $sequence++,
                        'type' => $line['type'] !== '' ? Str::limit($line['type'], 64, '') : null,
                        'description' => $line['description'] !== '' ? $line['description'] : null,
                        'reference' => $line['reference'] !== '' ? Str::limit($line['reference'], 64, '') : null,
                        'debit' => Money::decimal($line['debit']),
                        'credit' => Money::decimal($line['credit']),
                        'stated_balance' => $line['stated_balance'] === null ? null : Money::decimal($line['stated_balance']),
                        'source_sheet' => $sheet['sheet'],
                        'source_row' => $line['row'],
                        'import_id' => $import->id,
                        'created_by' => $user->id,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ], $sheet['lines']);
                    foreach (array_chunk($rows, 500) as $chunk) {
                        BankTransaction::query()->insert($chunk);
                    }

                    $result['sheets'][] = [
                        'index' => $plan['index'],
                        'sheet' => $sheet['sheet'],
                        'company_id' => $company->id,
                        'company_name' => $company->name,
                        'account_id' => $account->id,
                        'account_number' => $account->account_number,
                        'lines' => count($rows),
                        'debits' => $sheet['debits'],
                        'credits' => $sheet['credits'],
                        'closing' => $sheet['closing'],
                    ];
                }

                $import->update([
                    'status' => StatementImport::IMPORTED,
                    'result' => $result,
                    'imported_by' => $user->id,
                    'imported_at' => now(),
                ]);

                return $result;
            });
        } finally {
            $this->context->setActiveCompany($previous);
        }

        return $import->refresh();
    }

    /**
     * Removes the lines this import added, and the accounts it opened while
     * nothing else has been posted to them. Companies it created are kept.
     */
    public function undo(StatementImport $import, User $user): StatementImport
    {
        if ($import->status !== StatementImport::IMPORTED) {
            throw ValidationException::withMessages(['import' => 'Only an imported statement can be undone.']);
        }

        $accountIds = BankAccount::query()->where('import_id', $import->id)->pluck('id');
        foreach ($accountIds as $id) {
            $account = BankAccount::query()->find($id);
            if ($account && $account->transactions()->where(fn ($q) => $q->whereNull('import_id')->orWhere('import_id', '!=', $import->id))->exists()) {
                throw ValidationException::withMessages([
                    'import' => "Account {$account->account_number} has transactions or transfers added after this import. Delete those first, then undo.",
                ]);
            }
        }

        DB::transaction(function () use ($import, $user, $accountIds): void {
            BankTransaction::query()->where('import_id', $import->id)->delete();
            BankAccount::query()->whereIn('id', $accountIds)->delete();
            $import->update([
                'status' => StatementImport::UNDONE,
                'result' => [...($import->result ?? []), 'undone_by' => $user->id, 'undone_at' => now()->toIso8601String()],
            ]);
        });

        return $import->refresh();
    }

    private function createCompany(User $user, string $name, ?string $code): Company
    {
        $active = $this->context->activeCompany();
        $company = app(CompanyService::class)->createForUser($user, [
            'code' => $code ?? $this->companyCodes([$name])[$name],
            'name' => $name,
            'default_currency' => $active?->default_currency ?: 'USD',
            'status' => 'active',
        ]);
        $this->context->setActiveCompany($active);

        return $company;
    }

    /**
     * Short unique codes from initials: "Sample Bakery Group" → SBG.
     *
     * @param  list<string>  $names
     * @return array<string, string>
     */
    private function companyCodes(array $names): array
    {
        $taken = Company::query()->pluck('code')->map(fn ($c) => strtoupper((string) $c))->all();
        $codes = [];
        foreach ($names as $name) {
            $words = preg_split('/[^A-Za-z0-9]+/', $name, -1, PREG_SPLIT_NO_EMPTY) ?: ['CO'];
            $base = strtoupper(implode('', array_map(fn ($w) => $w[0], $words)));
            if (strlen($base) < 2) {
                $base = strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $name) ?: 'CO', 0, 3));
            }
            $base = substr($base, 0, 10);
            $code = $base;
            for ($n = 2; in_array($code, $taken, true); $n++) {
                $code = $base.$n;
            }
            $taken[] = $code;
            $codes[$name] = $code;
        }

        return $codes;
    }

    private function matchCompany(Collection $companies, string $name): ?Company
    {
        $key = $this->normalise($name);

        return $companies->first(fn (Company $company) => $this->normalise($company->name) === $key
            || ($company->legal_name && $this->normalise($company->legal_name) === $key));
    }

    private function matchAccount(Company $company, array $sheet): ?BankAccount
    {
        $key = $this->normalise($sheet['account_name']);

        return BankAccount::query()
            ->where('company_id', $company->id)
            ->whereHas('bank', fn ($q) => $q->where('name', $sheet['bank'] ?: 'Bank'))
            ->get()
            ->first(fn (BankAccount $account) => $this->normalise($account->account_name) === $key);
    }

    /** "Sample Holdings (Pvt) Ltd" and "sample holdings" are the same company. */
    private function normalise(string $name): string
    {
        $name = mb_strtolower(str_replace('&', ' and ', $name));
        $name = preg_replace('/\b(private|pvt|limited|ltd|inc|plc|llc|t\/a|account)\b\.?/u', ' ', $name);

        return preg_replace('/[^a-z0-9]/u', '', $name);
    }

    private function withoutLines(array $sheet): array
    {
        unset($sheet['lines']);

        return $sheet;
    }
}
