<?php

namespace App\Modules\Invoicing\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Invoicing\Models\Customer;
use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Invoicing\Models\CreditNote;
use App\Modules\Invoicing\Models\InvoicePayment;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CustomerStatementController extends Controller
{
    public function index(Request $request): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        $query = Customer::query()
            ->where('company_id', $company->id)
            ->where('is_active', true)
            ->withCount([
                'invoices as invoices_count' => function ($q) {
                    $q->whereNotIn('status', ['draft', 'cancelled']);
                },
                'creditNotes as credit_notes_count' => function ($q) {
                    $q->where('status', 'issued');
                },
            ])
            ->orderBy('name');

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%");
            });
        }

        $customers = $query->paginate(20)->withQueryString();

        // Add outstanding balance to each customer
        $customers->getCollection()->transform(function ($customer) {
            $customer->outstanding_balance = $customer->getOutstandingBalance();
            return $customer;
        });

        return Inertia::render('Erp/Invoicing/CustomerStatements/Index', [
            'company' => $company,
            'customers' => $customers,
            'filters' => $request->only(['search']),
        ]);
    }

    public function show(Customer $customer, Request $request): Response
    {
        $this->authorizeErpPermission('erp.invoicing.view');

        $company = app(CompanyContext::class)->requireActiveCompany();

        $customer->load([
            'invoices' => function ($q) use ($request) {
                $q->whereNotIn('status', ['draft', 'cancelled'])
                    ->with(['payments', 'creditNotes'])
                    ->orderBy('invoice_date');
            },
            'creditNotes' => function ($q) use ($request) {
                $q->where('status', 'issued')
                    ->orderBy('credit_note_date');
            },
            'paymentTerm',
        ]);

        // Filter by date range if provided
        $dateFrom = $request->get('date_from') ? CarbonImmutable::parse($request->get('date_from')) : null;
        $dateTo = $request->get('date_to') ? CarbonImmutable::parse($request->get('date_to')) : CarbonImmutable::now();

        $invoices = $customer->invoices->filter(function ($inv) use ($dateFrom, $dateTo) {
            $invDate = CarbonImmutable::parse($inv->invoice_date);
            if ($dateFrom && $invDate->lt($dateFrom)) {
                return false;
            }
            return $invDate->lte($dateTo);
        })->values();

        $creditNotes = $customer->creditNotes->filter(function ($cn) use ($dateFrom, $dateTo) {
            $cnDate = CarbonImmutable::parse($cn->credit_note_date);
            if ($dateFrom && $cnDate->lt($dateFrom)) {
                return false;
            }
            return $cnDate->lte($dateTo);
        })->values();

        $payments = InvoicePayment::query()
            ->where('company_id', $company->id)
            ->where('invoice_id', $invoices->pluck('id'))
            ->with('invoice')
            ->orderBy('payment_date')
            ->get();

        // Build statement lines
        $statementLines = $this->buildStatementLines($invoices, $creditNotes, $payments, $customer);

        // Calculate totals
        $totalInvoiced = $invoices->sum('total_amount');
        $totalCredited = $creditNotes->sum('total_amount');
        $totalPaid = $payments->sum('base_amount');
        $balance = $customer->getOutstandingBalance();

        return Inertia::render('Erp/Invoicing/CustomerStatements/Show', [
            'company' => $company,
            'customer' => $customer,
            'statementLines' => $statementLines,
            'totals' => [
                'total_invoiced' => $totalInvoiced,
                'total_credited' => $totalCredited,
                'total_paid' => $totalPaid,
                'balance' => $balance,
                'currency_code' => $customer->currency_code,
            ],
            'dateFrom' => $dateFrom?->toDateString(),
            'dateTo' => $dateTo->toDateString(),
        ]);
    }

    public function downloadPdf(Customer $customer, Request $request)
    {
        $this->authorizeErpPermission('erp.invoicing.view');

        $company = app(CompanyContext::class)->requireActiveCompany();

        // Reuse the show logic to get data
        $response = $this->show($customer, $request);

        // Get the data from the response
        $data = $response->getData();

        $renderer = app(\App\Modules\Core\Services\DocumentRenderer::class);
        $pdf = $renderer->renderForCompany($company, 'pdf.documents.customer_statement', [
            'customer' => $data['customer'],
            'statementLines' => $data['statementLines'],
            'totals' => $data['totals'],
            'dateFrom' => $data['dateFrom'],
            'dateTo' => $data['dateTo'],
        ]);

        return response($pdf)
            ->header('Content-Type', 'application/pdf')
            ->header('Content-Disposition', 'inline; filename="statement-' . $customer->code . '-' . now()->format('Y-m-d') . '.pdf"');
    }

    /**
     * Build chronological statement lines from invoices, credit notes, and payments.
     */
    private function buildStatementLines($invoices, $creditNotes, $payments, Customer $customer): array
    {
        $lines = [];

        // Add opening balance (if date_from is set, calculate balance before that date)
        // For now, we'll start with the earliest transaction

        foreach ($invoices as $invoice) {
            $lines[] = [
                'date' => $invoice->invoice_date,
                'type' => 'invoice',
                'reference' => $invoice->document_number,
                'description' => 'Invoice',
                'debit' => $invoice->total_amount,
                'credit' => '0.0000',
                'balance' => '0.0000', // Will be calculated
                'currency_code' => $invoice->currency_code,
                'status' => $invoice->status,
            ];
        }

        foreach ($creditNotes as $cn) {
            $lines[] = [
                'date' => $cn->credit_note_date,
                'type' => 'credit_note',
                'reference' => $cn->document_number,
                'description' => 'Credit Note',
                'debit' => '0.0000',
                'credit' => $cn->total_amount,
                'balance' => '0.0000',
                'currency_code' => $cn->currency_code,
                'status' => $cn->status,
            ];
        }

        foreach ($payments as $payment) {
            $lines[] = [
                'date' => $payment->payment_date,
                'type' => 'payment',
                'reference' => $payment->reference ?? 'Payment',
                'description' => 'Payment (' . $payment->payment_method . ')',
                'debit' => '0.0000',
                'credit' => $payment->base_amount,
                'balance' => '0.0000',
                'currency_code' => $payment->currency_code,
                'status' => 'completed',
            ];
        }

        // Sort by date
        usort($lines, function ($a, $b) {
            return CarbonImmutable::parse($a['date'])->compareTo(CarbonImmutable::parse($b['date']));
        });

        // Calculate running balance
        $runningBalance = '0.0000';
        foreach ($lines as &$line) {
            $runningBalance = bcadd($runningBalance, $line['debit'], 4);
            $runningBalance = bcsub($runningBalance, $line['credit'], 4);
            $line['balance'] = $runningBalance;
        }

        return $lines;
    }
}