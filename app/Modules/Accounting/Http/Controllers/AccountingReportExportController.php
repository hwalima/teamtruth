<?php

namespace App\Modules\Accounting\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Accounting\Services\AccountingReportService;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\DocumentRenderer;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AccountingReportExportController extends Controller
{
    public function __invoke(
        Request $request,
        string $report,
        string $format,
        AccountingReportService $reports,
        DocumentRenderer $renderer,
    ): StreamedResponse|Response {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $validated = match ($report) {
            'trial-balance' => $request->validate([
                'as_of' => ['required', 'date_format:Y-m-d'],
            ]),
            'general-ledger' => $request->validate([
                'from' => ['required', 'date_format:Y-m-d'],
                'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
                'account_id' => [
                    'nullable',
                    'integer',
                    Rule::exists('accounting_accounts', 'id')
                        ->where('company_id', $company->id)
                        ->where('is_group', false),
                ],
            ]),
            'profit-and-loss' => $request->validate([
                'from' => ['required', 'date_format:Y-m-d'],
                'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
            ]),
            default => abort(404),
        };
        abort_unless(in_array($format, ['csv', 'pdf'], true), 404);

        [$title, $period, $columns, $rows] = $this->reportRows($company, $report, $validated, $reports);
        $filename = Str::slug($report.'-'.$company->code.'-'.now()->format('Y-m-d')).'.'.$format;

        if ($format === 'csv') {
            return response()->streamDownload(function () use ($columns, $rows): void {
                $stream = fopen('php://output', 'w');
                if ($stream === false) {
                    throw new \RuntimeException('Unable to open the report export stream.');
                }

                fwrite($stream, "\xEF\xBB\xBF");
                fputcsv($stream, $columns, ',', '"', '');
                foreach ($rows as $row) {
                    fputcsv($stream, $row, ',', '"', '');
                }
                fclose($stream);
            }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
        }

        $pdf = $renderer->renderForCompany($company, 'pdf.documents.accounting-report', [
            'documentTitle' => $title,
            'reportTitle' => $title,
            'reportPeriod' => $period,
            'columns' => $columns,
            'rows' => $rows,
        ]);

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }

    /**
     * @return array{string, string, array<int, string>, array<int, array<int, string>>}
     */
    private function reportRows(Company $company, string $report, array $filters, AccountingReportService $reports): array
    {
        if ($report === 'trial-balance') {
            $asOf = CarbonImmutable::parse($filters['as_of'])->toDateString();
            $data = $reports->trialBalance($company, $asOf);
            $rows = array_map(fn (array $row): array => [
                $row['code'],
                $row['name'],
                ucfirst($row['accountType']),
                $row['debit'],
                $row['credit'],
            ], $data['rows']);
            $rows[] = ['', 'Total', '', $data['totalDebit'], $data['totalCredit']];

            return ['Trial balance', 'As of '.$asOf, ['Account code', 'Account name', 'Type', 'Debit', 'Credit'], $rows];
        }

        $from = CarbonImmutable::parse($filters['from'])->toDateString();
        $to = CarbonImmutable::parse($filters['to'])->toDateString();
        $period = $from.' to '.$to;

        if ($report === 'profit-and-loss') {
            $data = $reports->profitAndLoss($company, $from, $to);
            $rows = [['Income', '', '', '']];
            foreach ($data['income'] as $account) {
                $rows[] = [$account['code'], $account['name'], 'Income', $account['amount']];
            }
            $rows[] = ['', 'Total income', '', $data['incomeTotal']];
            $rows[] = ['Expenses', '', '', ''];
            foreach ($data['expenses'] as $account) {
                $rows[] = [$account['code'], $account['name'], 'Expense', $account['amount']];
            }
            $rows[] = ['', 'Total expenses', '', $data['expenseTotal']];
            $rows[] = ['', str_starts_with($data['netProfit'], '-') ? 'Net loss' : 'Net profit', '', $data['netProfit']];

            return [
                'Profit and loss',
                $period,
                ['Account code', 'Account name', 'Type', 'Amount'],
                $rows,
            ];
        }

        $data = $reports->generalLedger(
            $company,
            $from,
            $to,
            isset($filters['account_id']) ? (int) $filters['account_id'] : null,
        );
        $rows = [];
        foreach ($data['accounts'] as $account) {
            $rows[] = [$account['code'], $account['name'], $from, 'Opening balance', '', '', '', '', $account['openingBalance']];
            foreach ($account['lines'] as $line) {
                $rows[] = [
                    $account['code'],
                    $account['name'],
                    $line['date'],
                    $line['documentNumber'],
                    $line['journalCode'],
                    $line['description'].($line['reference'] ? ' · Ref '.$line['reference'] : ''),
                    $line['debit'],
                    $line['credit'],
                    $line['balance'],
                ];
            }
            $rows[] = [$account['code'], $account['name'], $to, 'Closing balance', '', '', $account['debitTotal'], $account['creditTotal'], $account['closingBalance']];
        }

        return [
            'General ledger',
            $period,
            ['Account code', 'Account name', 'Date', 'Document', 'Journal', 'Description', 'Debit', 'Credit', 'Balance'],
            $rows,
        ];
    }
}
