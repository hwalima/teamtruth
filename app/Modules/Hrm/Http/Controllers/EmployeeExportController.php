<?php

namespace App\Modules\Hrm\Http\Controllers;

use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\DocumentRenderer;
use App\Modules\Hrm\Enums\EmployeeStatus;
use App\Modules\Hrm\Models\Department;
use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Models\Position;
use App\Modules\Hrm\Services\EmployeeService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use RuntimeException;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The employee list as Excel, CSV or a branded PDF, with the filters shown on
 * the page. Excel and CSV carry every detail; bank and tax details only for
 * users who manage employees. The PDF is the printable staff list.
 */
class EmployeeExportController extends HrmController
{
    public function __invoke(Request $request, string $format, EmployeeService $employees, DocumentRenderer $renderer): StreamedResponse|Response
    {
        abort_unless(in_array($format, ['xlsx', 'csv', 'pdf'], true), 404);

        $company = $this->company();
        $filters = array_filter($request->only(['search', 'department_id', 'position_id', 'status']), fn ($value) => filled($value));
        $list = $employees->filteredEmployees($filters)->with('costCenter:id,name')->get();
        $filename = Str::slug('employees-'.$company->code.'-'.now()->format('Y-m-d')).'.'.$format;

        if ($format === 'pdf') {
            return $this->pdf($company, $list, $filters, $renderer, $filename);
        }

        [$columns, $rows] = $this->table($list, $this->allowsErpPermission('erp.hrm.employee.manage'));

        return $format === 'csv' ? $this->csv($columns, $rows, $filename) : $this->xlsx($company, $columns, $rows, $filename);
    }

    /** @return array{list<string>, list<list<string>>} */
    private function table(Collection $list, bool $withPrivate): array
    {
        $statuses = EmployeeStatus::options();
        $columns = [
            'Employee no.', 'First name', 'Middle name', 'Surname', 'Gender', 'Date of birth', 'National ID', 'Passport no.',
            'Nationality', 'Marital status', 'Email', 'Phone', 'Department', 'Position', 'Grade', 'Cost centre', 'Line manager',
            'Hire date', 'Status', 'Termination date', 'Emergency contact', 'Emergency phone', 'Relationship',
        ];
        if ($withPrivate) {
            array_push($columns, 'Tax number', 'NSSA number', 'Bank', 'Account name', 'Account number', 'Branch');
        }

        $rows = $list->map(function (Employee $employee) use ($statuses, $withPrivate) {
            $status = $employee->status instanceof EmployeeStatus ? $employee->status->value : (string) $employee->status;
            $row = [
                $employee->employee_number,
                $employee->first_name,
                $employee->middle_name ?? '',
                $employee->last_name,
                $employee->gender ? Str::headline((string) $employee->gender) : '',
                $employee->date_of_birth?->format('Y-m-d') ?? '',
                $employee->national_id ?? '',
                $employee->passport_number ?? '',
                $employee->nationality ?? '',
                $employee->marital_status ? Str::headline($employee->marital_status) : '',
                $employee->personal_email ?? '',
                $employee->personal_phone ?? '',
                $employee->department?->name ?? '',
                $employee->position?->name ?? '',
                $employee->grade?->name ?? '',
                $employee->costCenter?->name ?? '',
                $employee->lineManager?->full_name ?? '',
                $employee->hire_date?->format('Y-m-d') ?? '',
                $statuses[$status] ?? Str::headline($status),
                $employee->termination_date?->format('Y-m-d') ?? '',
                $employee->emergency_contact_name ?? '',
                $employee->emergency_contact_phone ?? '',
                $employee->emergency_contact_relation ?? '',
            ];
            if ($withPrivate) {
                array_push($row, $employee->tax_number ?? '', $employee->nssa_number ?? '', $employee->bank_name ?? '',
                    $employee->bank_account_name ?? '', $employee->bank_account_number ?? '', $employee->bank_branch ?? '');
            }

            return array_map(fn ($value) => (string) $value, $row);
        })->all();

        return [$columns, $rows];
    }

    private function xlsx(Company $company, array $columns, array $rows, string $filename): StreamedResponse
    {
        $spreadsheet = new Spreadsheet;
        $spreadsheet->getProperties()->setCreator($company->name)->setTitle('Employees');
        $sheet = $spreadsheet->getActiveSheet()->setTitle('Employees');

        foreach ([$columns, ...$rows] as $r => $row) {
            foreach (array_values($row) as $c => $value) {
                // Everything as text: phone numbers and IDs keep their leading zeros.
                $sheet->getCell([$c + 1, $r + 1])->setValueExplicit(self::safe($value), DataType::TYPE_STRING);
            }
        }

        $last = $sheet->getHighestColumn();
        $color = ltrim($this->primaryColor($company), '#');
        $header = $sheet->getStyle("A1:{$last}1");
        $header->getFont()->setBold(true)->getColor()->setRGB($this->readableOn($color));
        $header->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB($color);
        $sheet->freezePane('E2');
        $sheet->setAutoFilter("A1:{$last}".max(1, count($rows) + 1));
        foreach (range(1, count($columns)) as $c) {
            $sheet->getColumnDimensionByColumn($c)->setAutoSize(true);
        }

        return response()->streamDownload(function () use ($spreadsheet): void {
            (new Xlsx($spreadsheet))->save('php://output');
        }, $filename, ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
    }

    private function csv(array $columns, array $rows, string $filename): StreamedResponse
    {
        return response()->streamDownload(function () use ($columns, $rows): void {
            $stream = fopen('php://output', 'w');
            if ($stream === false) {
                throw new RuntimeException('Unable to open the export stream.');
            }
            fwrite($stream, "\xEF\xBB\xBF");
            fputcsv($stream, $columns, ',', '"', '');
            foreach ($rows as $row) {
                fputcsv($stream, array_map(self::safe(...), $row), ',', '"', '');
            }
            fclose($stream);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    private function pdf(Company $company, Collection $list, array $filters, DocumentRenderer $renderer, string $filename): Response
    {
        $statuses = EmployeeStatus::options();
        $rows = $list->map(function (Employee $employee) use ($statuses) {
            $status = $employee->status instanceof EmployeeStatus ? $employee->status->value : (string) $employee->status;

            return [
                $employee->employee_number,
                $employee->full_name,
                $employee->department?->name ?? '',
                $employee->position?->name ?? '',
                $employee->lineManager?->full_name ?? '',
                $employee->personal_phone ?? '',
                $employee->hire_date?->format('d M Y') ?? '',
                $statuses[$status] ?? Str::headline($status),
            ];
        })->all();

        $applied = array_filter([
            isset($filters['search']) ? 'Search: “'.$filters['search'].'”' : null,
            isset($filters['status']) ? 'Status: '.($statuses[$filters['status']] ?? $filters['status']) : null,
            isset($filters['department_id']) ? 'Department: '.Department::query()->whereKey($filters['department_id'])->value('name') : null,
            isset($filters['position_id']) ? 'Position: '.Position::query()->whereKey($filters['position_id'])->value('name') : null,
        ]);

        $pdf = $renderer->renderForCompany($company, 'pdf.documents.inventory-report', [
            'documentTitle' => 'Staff list',
            'reportTitle' => 'Staff list',
            'reportSubtitle' => $applied ? implode(' · ', $applied) : 'All employees',
            'columns' => ['No.', 'Employee', 'Department', 'Position', 'Line manager', 'Phone', 'Hired', 'Status'],
            'numericColumns' => [],
            'rows' => $rows,
            'stats' => [
                'Employees' => number_format(count($rows)),
                'Active' => number_format($list->filter(fn (Employee $e) => $e->status === EmployeeStatus::Active)->count()),
                'Departments' => number_format($list->pluck('department_id')->filter()->unique()->count()),
                'Positions' => number_format($list->pluck('position_id')->filter()->unique()->count()),
            ],
            'emptyMessage' => 'No employees match these filters.',
        ]);

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }

    private function primaryColor(Company $company): string
    {
        $color = (string) ($company->branding?->primary_color ?? '');

        return preg_match('/^#[0-9a-fA-F]{6}$/', $color) ? $color : '#1e293b';
    }

    /** White or black text, whichever reads better on the colour. */
    private function readableOn(string $hex): string
    {
        [$r, $g, $b] = array_map('hexdec', str_split($hex, 2));

        return (0.299 * $r + 0.587 * $g + 0.114 * $b) > 160 ? '000000' : 'FFFFFF';
    }

    /** Cells starting with = + - @ would run as formulas in Excel. */
    private static function safe(string $value): string
    {
        if (preg_match('/^[-+]?\d+(?:\.\d+)?$/', $value) === 1) {
            return $value;
        }

        return preg_match('/^\s*[=+\-@]/', $value) === 1 ? "'".$value : $value;
    }
}
