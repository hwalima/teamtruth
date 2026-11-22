<?php

namespace App\Modules\Accounting\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Accounting\Services\FinancialStatementService;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\DocumentRenderer;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Balance sheet, aged receivables and aged payables: on screen, as CSV and as a branded PDF.
 */
class FinancialReportController extends Controller
{
    public const REPORTS = [
        'balance-sheet' => 'Balance sheet',
        'aged-receivables' => 'Aged receivables',
        'aged-payables' => 'Aged payables',
    ];

    public function index(Request $request, FinancialStatementService $statements): Response
    {
        $this->authorizeErpPermission('erp.accounting.view');
        $company = app(CompanyContext::class)->requireActiveCompany();
        [$report, $asOf] = $this->filters($request);

        return Inertia::render('Erp/Accounting/Reports', [
            'company' => $company->only(['id', 'code', 'name', 'default_currency']),
            'report' => $report,
            'asOf' => $asOf,
            'data' => $this->data($statements, $company, $report, $asOf),
        ]);
    }

    public function export(Request $request, string $report, string $format, FinancialStatementService $statements, DocumentRenderer $renderer): StreamedResponse|HttpResponse
    {
        $this->authorizeErpPermission('erp.accounting.view');
        abort_unless(isset(self::REPORTS[$report]) && in_array($format, ['csv', 'pdf'], true), 404);
        $company = app(CompanyContext::class)->requireActiveCompany();
        $request->merge(['report' => $report]);
        [, $asOf] = $this->filters($request);
        $data = $this->data($statements, $company, $report, $asOf);
        $filename = Str::slug($report.'-'.$company->code.'-'.$asOf).'.'.$format;

        if ($format === 'csv') {
            $rows = $report === 'balance-sheet' ? $this->balanceSheetRows($data) : $this->agedRows($data);

            return response()->streamDownload(function () use ($rows): void {
                $stream = fopen('php://output', 'w');
                fwrite($stream, "\xEF\xBB\xBF");
                foreach ($rows as $row) {
                    fputcsv($stream, $row, ',', '"', '');
                }
                fclose($stream);
            }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
        }

        $view = $report === 'balance-sheet' ? 'pdf.documents.balance-sheet' : 'pdf.documents.aged-balances';
        $pdf = $renderer->renderForCompany($company, $view, [
            'data' => $data,
            'reportTitle' => self::REPORTS[$report],
            'partnerLabel' => $report === 'aged-payables' ? 'Vendor' : 'Customer',
            'currency' => $company->default_currency,
            'asOfText' => 'As at '.CarbonImmutable::parse($asOf)->format('j F Y'),
        ]);

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }

    /** @return array{0: string, 1: string} */
    private function filters(Request $request): array
    {
        $validated = $request->validate([
            'report' => ['nullable', Rule::in(array_keys(self::REPORTS))],
            'as_of' => ['nullable', 'date_format:Y-m-d'],
        ]);

        return [$validated['report'] ?? 'balance-sheet', $validated['as_of'] ?? today()->toDateString()];
    }

    private function data(FinancialStatementService $statements, $company, string $report, string $asOf): array
    {
        return match ($report) {
            'balance-sheet' => $statements->balanceSheet($company, $asOf),
            'aged-receivables' => $statements->agedReceivables($company, $asOf),
            'aged-payables' => $statements->agedPayables($company, $asOf),
        };
    }

    /** @return list<list<string>> */
    private function balanceSheetRows(array $data): array
    {
        $rows = [['Section', 'Account code', 'Account name', 'Amount']];
        foreach (['assets' => ['Assets', 'totalAssets'], 'liabilities' => ['Liabilities', 'totalLiabilities'], 'equity' => ['Equity', 'totalEquity']] as $key => [$label, $total]) {
            foreach ($data[$key] as $line) {
                $rows[] = [$label, $line['code'], $line['name'], $line['amount']];
            }
            $rows[] = [$label, '', 'Total '.strtolower($label), $data[$total]];
        }
        $rows[] = ['', '', 'Total liabilities and equity', $data['totalLiabilitiesAndEquity']];

        return $rows;
    }

    /** @return list<list<string>> */
    private function agedRows(array $data): array
    {
        $rows = [['Name', 'Currency', ...array_values($data['buckets']), 'Unused credits', 'Total']];
        foreach ($data['partners'] as $partner) {
            $rows[] = [$partner['partner'], $partner['currency'], ...array_map(fn ($key) => $partner[$key], array_keys($data['buckets'])), $partner['credits'], $partner['total']];
        }
        foreach ($data['totals'] as $total) {
            $rows[] = ['Total', $total['currency'], ...array_map(fn ($key) => $total[$key], array_keys($data['buckets'])), $total['credits'], $total['total']];
        }

        return $rows;
    }
}
