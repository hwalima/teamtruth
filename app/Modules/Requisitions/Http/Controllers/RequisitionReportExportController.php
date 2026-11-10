<?php

namespace App\Modules\Requisitions\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\DocumentRenderer;
use App\Modules\Requisitions\Services\RequisitionReportService;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class RequisitionReportExportController extends Controller
{
    public function __invoke(
        Request $request,
        string $report,
        string $format,
        RequisitionReportService $reports,
        DocumentRenderer $renderer,
    ): StreamedResponse|Response {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $validated = match ($report) {
            'pending-by-approver' => $request->validate([
                'from' => ['nullable', 'date_format:Y-m-d'],
                'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            ]),
            'ageing' => $request->validate([
                'from' => ['nullable', 'date_format:Y-m-d'],
                'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            ]),
            'spend-by-department' => $request->validate([
                'from' => ['nullable', 'date_format:Y-m-d'],
                'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            ]),
            'turnaround-time' => $request->validate([
                'from' => ['nullable', 'date_format:Y-m-d'],
                'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
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

        $pdf = $renderer->renderForCompany($company, 'pdf.documents.requisition-report', [
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
    private function reportRows(Company $company, string $report, array $filters, RequisitionReportService $reports): array
    {
        $from = $filters['from'] ?? null;
        $to = $filters['to'] ?? null;
        $period = $from && $to ? $from.' to '.$to : 'All time';

        if ($report === 'pending-by-approver') {
            $data = $reports->pendingByApprover($company, $from, $to);
            $rows = [];
            foreach ($data as $approverData) {
                foreach ($approverData['requisitions'] as $req) {
                    $rows[] = [
                        $approverData['approver'],
                        $req['document_number'],
                        $req['type_label'],
                        $req['requester'],
                        $req['department'] ?? 'N/A',
                        $req['currency_code'].' '.$req['estimated_total'],
                        $req['submitted_at'] ?? 'N/A',
                        $req['days_pending'].' days',
                        $req['current_step'],
                    ];
                }
            }
            $rows[] = ['', '', '', '', '', 'Total: '.$data->sum('total_estimated'), '', '', ''];

            return [
                'Requisitions pending by approver',
                $period,
                ['Approver', 'Document #', 'Type', 'Requester', 'Department', 'Amount', 'Submitted', 'Days Pending', 'Current Step'],
                $rows,
            ];
        }

        if ($report === 'ageing') {
            $data = $reports->ageing($company, $from, $to);
            $rows = [];
            foreach ($data['details'] as $req) {
                $rows[] = [
                    $req['document_number'],
                    $req['type_label'],
                    $req['status'],
                    $req['requester'],
                    $req['department'] ?? 'N/A',
                    $req['currency_code'].' '.$req['estimated_total'],
                    $req['submitted_at'],
                    $req['days_pending'].' days',
                    $req['ageing_bucket'],
                ];
            }
            // Summary rows
            $rows[] = ['', '', '', '', '', '', '', '', ''];
            foreach ($data['summary'] as $bucket => $count) {
                $rows[] = ['', '', '', '', '', '', '', '', $bucket.': '.$count];
            }

            return [
                'Requisition ageing analysis',
                $period,
                ['Document #', 'Type', 'Status', 'Requester', 'Department', 'Amount', 'Submitted', 'Days Pending', 'Ageing Bucket'],
                $rows,
            ];
        }

        if ($report === 'spend-by-department') {
            $data = $reports->spendByDepartment($company, $from, $to);
            $rows = [];
            foreach ($data as $deptData) {
                foreach ($deptData['requisitions'] as $req) {
                    $rows[] = [
                        $deptData['department'],
                        $req['document_number'],
                        $req['type_label'],
                        $req['status'],
                        $req['requester'],
                        $req['currency_code'].' '.$req['estimated_total'],
                        $req['submitted_at'] ?? 'N/A',
                    ];
                }
                // Subtotal row
                $rows[] = ['', '', '', '', 'Subtotal: '.$deptData['total_count'].' requisitions', $deptData['total_estimated'], ''];
            }
            // Grand total
            $rows[] = ['', '', '', '', 'Grand Total', $data->sum('total_estimated'), ''];

            return [
                'Requisition spend by department',
                $period,
                ['Department', 'Document #', 'Type', 'Status', 'Requester', 'Amount', 'Submitted'],
                $rows,
            ];
        }

        // turnaround-time
        $data = $reports->turnaroundTime($company, $from, $to);
        $rows = [];
        foreach ($data['details'] as $req) {
            $rows[] = [
                $req['document_number'],
                $req['type_label'],
                $req['status'],
                $req['requester'],
                $req['department'] ?? 'N/A',
                $req['currency_code'].' '.$req['estimated_total'],
                $req['submitted_at'],
                $req['completed_at'],
                $req['turnaround_days'].' days',
            ];
        }
        // Summary rows
        $rows[] = ['', '', '', '', '', '', '', '', ''];
        $rows[] = ['', '', '', '', 'Average turnaround', $data['summary']['average_days'].' days', '', '', ''];
        $rows[] = ['', '', '', '', 'Min turnaround', $data['summary']['min_days'].' days', '', '', ''];
        $rows[] = ['', '', '', '', 'Max turnaround', $data['summary']['max_days'].' days', '', '', ''];
        $rows[] = ['', '', '', '', 'Total completed', $data['summary']['count'], '', '', ''];

        return [
            'Requisition turnaround time analysis',
            $period,
            ['Document #', 'Type', 'Status', 'Requester', 'Department', 'Amount', 'Submitted', 'Completed', 'Turnaround (days)'],
            $rows,
        ];
    }
}