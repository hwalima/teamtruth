<?php

namespace App\Modules\Banking\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Banking\Models\BankAccount;
use App\Modules\Banking\Services\BankingAccess;
use App\Modules\Banking\Services\StatementService;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\DocumentRenderer;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Str;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** The bank statement for a period as a branded PDF or an Excel workbook. */
class StatementExportController extends Controller
{
    private const MONEY = '#,##0.00;-#,##0.00';

    /** Header fill for the workbook: the account holder's primary colour. */
    private string $headerColor = '1E293B';

    public function __invoke(
        Request $request,
        BankAccount $account,
        string $format,
        BankingAccess $access,
        StatementService $statements,
        DocumentRenderer $renderer,
    ): StreamedResponse|Response {
        abort_unless(in_array($format, ['pdf', 'xlsx'], true), 404);
        $access->authorize($request->user(), $account);
        $filters = $request->validate(['from' => ['nullable', 'date'], 'to' => ['nullable', 'date']]);
        $account->load(['bank:id,name', 'company']);
        $statement = $statements->statement($account, $filters['from'] ?? null, $filters['to'] ?? null);
        $filename = Str::slug('statement-'.$account->account_number.'-'.$statement['from'].'-to-'.$statement['to']).'.'.$format;

        return $format === 'pdf'
            ? $this->pdf($account, $statement, $renderer, $filename)
            : $this->xlsx($account, $statement, $filename);
    }

    private function pdf(BankAccount $account, array $statement, DocumentRenderer $renderer, string $filename): Response
    {
        // The statement carries the account holder's own branding, not the
        // company the user happens to be working in. Access to the account was
        // checked already, so the holder becomes the render company briefly.
        $context = app(CompanyContext::class);
        $previous = $context->activeCompany();
        $holder = $account->company;
        try {
            $context->setActiveCompany($holder);
            $pdf = $renderer->renderForCompany($holder, 'pdf.documents.bank-statement', [
                'account' => $account,
                'statement' => $statement,
                'period' => $this->period($statement),
            ]);
        } finally {
            $context->setActiveCompany($previous);
        }

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }

    private function xlsx(BankAccount $account, array $statement, string $filename): StreamedResponse
    {
        $account->company->loadMissing('branding');
        $color = $account->company->branding?->primary_color;
        $this->headerColor = $color && preg_match('/^#[0-9a-fA-F]{6}$/', $color) ? strtoupper(substr($color, 1)) : '1E293B';
        $book = new Spreadsheet;
        $book->getProperties()->setCreator($account->bank->name)->setTitle('Bank statement '.$account->account_number);
        $sheet = $book->getActiveSheet()->setTitle('Statement');

        $sheet->setCellValue('A1', $account->bank->name)->getStyle('A1')->getFont()->setBold(true)->setSize(14);
        $info = [
            ['Account name', $account->account_name],
            ['Account holder', $account->company->name],
            ['Account no.', $account->account_number],
            ['Currency', $account->currency],
            ['Statement period', $this->period($statement)],
        ];
        if ($account->source_account_number && $account->source_account_number !== $account->account_number) {
            $info[] = ['Number on source statement', $account->source_account_number];
        }
        $row = 3;
        foreach ($info as [$label, $value]) {
            $sheet->setCellValue("A{$row}", $label)->getStyle("A{$row}")->getFont()->setBold(true);
            $sheet->getCell("C{$row}")->setValueExplicit((string) $value, DataType::TYPE_STRING);
            $row++;
        }

        $header = $row + 1;
        $sheet->fromArray(['Date', 'Txn Type', 'Description', 'Ref No.', 'Debit', 'Credit', 'Balance'], null, "A{$header}");
        $this->headerStyle($sheet, "A{$header}:G{$header}");

        $r = $header + 1;
        $sheet->setCellValue("A{$r}", ExcelDate::PHPToExcel(CarbonImmutable::parse($statement['from'])));
        $sheet->setCellValue("C{$r}", 'Balance brought forward');
        $sheet->setCellValue("G{$r}", $statement['opening'] / 100);
        $sheet->getStyle("A{$r}:G{$r}")->getFont()->setItalic(true);
        $r++;
        foreach ($statement['lines'] as $line) {
            $sheet->setCellValue("A{$r}", ExcelDate::PHPToExcel(CarbonImmutable::parse($line['date'])));
            $sheet->getCell("B{$r}")->setValueExplicit((string) $line['type'], DataType::TYPE_STRING);
            $sheet->getCell("C{$r}")->setValueExplicit((string) $line['description'], DataType::TYPE_STRING);
            $sheet->getCell("D{$r}")->setValueExplicit((string) $line['reference'], DataType::TYPE_STRING);
            if ($line['debit'] !== 0) {
                $sheet->setCellValue("E{$r}", $line['debit'] / 100);
            }
            if ($line['credit'] !== 0) {
                $sheet->setCellValue("F{$r}", $line['credit'] / 100);
            }
            $sheet->setCellValue("G{$r}", $line['balance'] / 100);
            $r++;
        }
        $sheet->setCellValue("C{$r}", 'Totals / closing balance');
        $sheet->setCellValue("E{$r}", $statement['debits'] / 100);
        $sheet->setCellValue("F{$r}", $statement['credits'] / 100);
        $sheet->setCellValue("G{$r}", $statement['closing'] / 100);
        $sheet->getStyle("A{$r}:G{$r}")->getFont()->setBold(true);

        $sheet->getStyle('A'.($header + 1).":A{$r}")->getNumberFormat()->setFormatCode('dd/mm/yyyy');
        $sheet->getStyle('E'.($header + 1).":G{$r}")->getNumberFormat()->setFormatCode(self::MONEY);
        $sheet->freezePane('A'.($header + 1));
        foreach (['A' => 12, 'B' => 14, 'C' => 46, 'D' => 14, 'E' => 14, 'F' => 14, 'G' => 15] as $column => $width) {
            $sheet->getColumnDimension($column)->setWidth($width);
        }

        if ($statement['differences'] !== []) {
            $notes = $book->createSheet()->setTitle('Balance differences');
            $notes->setCellValue('A1', 'Lines where the source statement printed a different balance. The statement shows the balance worked out from the amounts.');
            $notes->fromArray(['Date', 'Description', 'Source', 'Balance on source', 'Correct balance', 'Difference'], null, 'A3');
            $this->headerStyle($notes, 'A3:F3');
            $n = 4;
            foreach ($statement['differences'] as $difference) {
                $notes->setCellValue("A{$n}", ExcelDate::PHPToExcel(CarbonImmutable::parse($difference['date'])));
                $notes->getCell("B{$n}")->setValueExplicit((string) $difference['description'], DataType::TYPE_STRING);
                $notes->getCell("C{$n}")->setValueExplicit((string) $difference['source'], DataType::TYPE_STRING);
                $notes->setCellValue("D{$n}", $difference['stated_balance'] / 100);
                $notes->setCellValue("E{$n}", $difference['balance'] / 100);
                $notes->setCellValue("F{$n}", $difference['difference'] / 100);
                $n++;
            }
            $notes->getStyle("A4:A{$n}")->getNumberFormat()->setFormatCode('dd/mm/yyyy');
            $notes->getStyle("D4:F{$n}")->getNumberFormat()->setFormatCode(self::MONEY);
            foreach (['A' => 12, 'B' => 40, 'C' => 24, 'D' => 18, 'E' => 18, 'F' => 14] as $column => $width) {
                $notes->getColumnDimension($column)->setWidth($width);
            }
        }
        $book->setActiveSheetIndex(0);

        return response()->streamDownload(function () use ($book): void {
            (new Xlsx($book))->save('php://output');
        }, $filename, ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
    }

    private function headerStyle(Worksheet $sheet, string $range): void
    {
        $style = $sheet->getStyle($range);
        $style->getFont()->setBold(true)->getColor()->setRGB('FFFFFF');
        $style->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB($this->headerColor);
    }

    private function period(array $statement): string
    {
        return CarbonImmutable::parse($statement['from'])->format('j M Y').' – '.CarbonImmutable::parse($statement['to'])->format('j M Y');
    }
}
