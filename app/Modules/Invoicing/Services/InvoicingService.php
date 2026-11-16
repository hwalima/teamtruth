<?php

namespace App\Modules\Invoicing\Services;

use App\Models\Currency;
use App\Models\User;
use App\Modules\Accounting\Models\FiscalPeriod;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\ExchangeRateService;
use App\Modules\Core\Services\SequenceService;
use App\Modules\Invoicing\Events\CreditNoteIssued;
use App\Modules\Invoicing\Events\InvoicePaymentRecorded;
use App\Modules\Invoicing\Events\InvoicePosted;
use App\Modules\Invoicing\Models\CreditNote;
use App\Modules\Invoicing\Models\CreditNoteLine;
use App\Modules\Invoicing\Models\Customer;
use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Invoicing\Models\InvoiceLine;
use App\Modules\Invoicing\Models\InvoicePayment;
use App\Modules\Invoicing\Models\RecurringInvoice;
use App\Modules\Invoicing\Models\FiscalDocument;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InvoicingService
{
    public function __construct(
        private SequenceService $sequenceService,
        private ExchangeRateService $exchangeRateService,
        private FiscalDeviceInterface $fiscalDevice,
    ) {}

    /**
     * Create a new invoice
     */
    public function createInvoice(User $actor, array $data, array $lines): Invoice
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        return DB::transaction(function () use ($company, $actor, $data, $lines) {
            // Validate customer
            $customer = Customer::query()
                ->where('company_id', $company->id)
                ->where('id', $data['customer_id'])
                ->firstOrFail();

            if (! $customer->is_active) {
                throw ValidationException::withMessages(['customer_id' => 'The selected customer is not active.']);
            }

            // Get payment term and calculate due date
            $paymentTerm = $customer->paymentTerm;
            $dueDate = $data['due_date'] ?? ($paymentTerm?->calculateDueDate($data['invoice_date']) ?? $data['invoice_date']);

            // Get currency and exchange rate
            $currencyCode = strtoupper($data['currency_code'] ?? $customer->currency_code ?? $company->default_currency);
            $currency = Currency::where('code', $currencyCode)->firstOrFail();
            $exchangeRate = $this->getExchangeRate($currencyCode, $company->default_currency, $data['invoice_date']);

            // Generate document number
            $documentNumber = $this->sequenceService->next($company, 'invoice');

            // Create invoice
            $invoice = Invoice::query()->create([
                'company_id' => $company->id,
                'document_number' => $documentNumber,
                'customer_id' => $customer->id,
                'status' => $data['status'] ?? 'draft',
                'type' => $data['type'] ?? 'invoice',
                'invoice_date' => $data['invoice_date'],
                'due_date' => $dueDate,
                'currency_code' => $currencyCode,
                'exchange_rate' => $exchangeRate,
                'notes' => $data['notes'] ?? null,
                'terms' => $data['terms'] ?? null,
                'footer_notes' => $data['footer_notes'] ?? null,
                'journal_id' => $data['journal_id'] ?? null,
                'created_by' => $actor->id,
            ]);

            // Create lines
            foreach ($lines as $index => $line) {
                $invoiceLine = InvoiceLine::query()->create([
                    'company_id' => $company->id,
                    'invoice_id' => $invoice->id,
                    'product_id' => $line['product_id'] ?? null,
                    'account_id' => $line['account_id'] ?? null,
                    'name' => $line['name'],
                    'description' => $line['description'] ?? null,
                    'quantity' => $line['quantity'] ?? 1,
                    'unit' => $line['unit'] ?? null,
                    'unit_price' => $line['unit_price'] ?? 0,
                    'discount_percent' => $line['discount_percent'] ?? 0,
                    'tax_rate' => $line['tax_rate'] ?? 0,
                    'sort_order' => $index + 1,
                    'metadata' => $line['metadata'] ?? null,
                ]);

                $invoiceLine->recalculate()->save();
            }

            // Recalculate totals
            $invoice->load('lines')->recalculateTotals()->save();

            return $invoice->load(['customer', 'lines.product', 'lines.account']);
        });
    }

    /**
     * Send invoice (change status from draft to sent)
     */
    public function sendInvoice(User $actor, Invoice $invoice): Invoice
    {
        if (! $invoice->canBeSent()) {
            throw ValidationException::withMessages(['invoice' => 'This invoice cannot be sent.']);
        }

        $invoice->update([
            'status' => 'sent',
            'sent_at' => now(),
            'updated_by' => $actor->id,
        ]);

        return $invoice->fresh();
    }

    /**
     * Post invoice to the accounting ledger.
     *
     * The ledger entry itself is created by the Accounting module's listener on the
     * InvoicePosted event, so this module never touches the ledger tables directly.
     */
    public function postInvoice(User $actor, Invoice $invoice): Invoice
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        if ((int) $invoice->company_id !== (int) $company->id) {
            throw new AuthorizationException('An invoice can only be posted for the active company.');
        }

        if (! $invoice->canBePosted()) {
            throw ValidationException::withMessages(['invoice' => 'This invoice cannot be posted.']);
        }

        return DB::transaction(function () use ($company, $actor, $invoice): Invoice {
            $invoice = Invoice::query()->lockForUpdate()->findOrFail($invoice->id);

            if (! $invoice->canBePosted()) {
                throw ValidationException::withMessages(['invoice' => 'This invoice cannot be posted.']);
            }

            // Guard: the invoice date must fall in an open accounting period.
            $period = FiscalPeriod::query()
                ->whereDate('starts_on', '<=', $invoice->invoice_date)
                ->whereDate('ends_on', '>=', $invoice->invoice_date)
                ->where('company_id', $company->id)
                ->where('status', 'open')
                ->lockForUpdate()
                ->first();
            if (! $period) {
                throw ValidationException::withMessages([
                    'invoice' => 'The invoice date must fall within an open accounting period.',
                ]);
            }

            $invoice->update([
                'fiscal_period_id' => $period->id,
                'updated_by' => $actor->id,
            ]);

            // The Accounting module listener creates the journal entry (idempotently).
            InvoicePosted::dispatch($invoice->fresh(['customer', 'lines.account', 'journal']), $actor);

            // Fiscalise
            $this->fiscaliseInvoice($actor, $invoice->fresh());

            return $invoice->fresh();
        });
    }

    /**
     * Create a credit note
     */
    public function createCreditNote(User $actor, array $data, array $lines): CreditNote
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        return DB::transaction(function () use ($company, $actor, $data, $lines) {
            $customer = Customer::query()
                ->where('company_id', $company->id)
                ->where('id', $data['customer_id'])
                ->firstOrFail();

            $originalInvoice = null;
            if (! empty($data['original_invoice_id'])) {
                $originalInvoice = Invoice::query()
                    ->where('company_id', $company->id)
                    ->where('id', $data['original_invoice_id'])
                    ->firstOrFail();
            }

            $currencyCode = strtoupper($data['currency_code'] ?? $customer->currency_code ?? $company->default_currency);
            $exchangeRate = $this->getExchangeRate($currencyCode, $company->default_currency, $data['credit_note_date']);

            $documentNumber = $this->sequenceService->next($company, 'credit_note');

            $creditNote = CreditNote::query()->create([
                'company_id' => $company->id,
                'document_number' => $documentNumber,
                'customer_id' => $customer->id,
                'original_invoice_id' => $originalInvoice?->id,
                'status' => $data['status'] ?? 'draft',
                'credit_note_date' => $data['credit_note_date'],
                'currency_code' => $currencyCode,
                'exchange_rate' => $exchangeRate,
                'reason' => $data['reason'] ?? null,
                'notes' => $data['notes'] ?? null,
                'journal_id' => $data['journal_id'] ?? null,
                'created_by' => $actor->id,
            ]);

            foreach ($lines as $index => $line) {
                $cnLine = CreditNoteLine::query()->create([
                    'company_id' => $company->id,
                    'credit_note_id' => $creditNote->id,
                    'invoice_line_id' => $line['invoice_line_id'] ?? null,
                    'product_id' => $line['product_id'] ?? null,
                    'account_id' => $line['account_id'] ?? null,
                    'name' => $line['name'],
                    'description' => $line['description'] ?? null,
                    'quantity' => $line['quantity'] ?? 1,
                    'unit' => $line['unit'] ?? null,
                    'unit_price' => $line['unit_price'] ?? 0,
                    'discount_percent' => $line['discount_percent'] ?? 0,
                    'tax_rate' => $line['tax_rate'] ?? 0,
                    'sort_order' => $index + 1,
                    'metadata' => $line['metadata'] ?? null,
                ]);

                $cnLine->recalculate()->save();
            }

            $creditNote->load('lines')->recalculateTotals()->save();

            return $creditNote->load(['customer', 'originalInvoice', 'lines.product', 'lines.account']);
        });
    }

    /**
     * Issue credit note. The ledger entry is created by the Accounting module's
     * listener on the CreditNoteIssued event.
     */
    public function issueCreditNote(User $actor, CreditNote $creditNote): CreditNote
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        if ((int) $creditNote->company_id !== (int) $company->id) {
            throw new AuthorizationException('A credit note can only be issued for the active company.');
        }

        if (! $creditNote->canBeIssued()) {
            throw ValidationException::withMessages(['credit_note' => 'This credit note cannot be issued.']);
        }

        return DB::transaction(function () use ($actor, $creditNote): CreditNote {
            $creditNote = CreditNote::query()->lockForUpdate()->findOrFail($creditNote->id);

            if (! $creditNote->canBeIssued()) {
                throw ValidationException::withMessages(['credit_note' => 'This credit note cannot be issued.']);
            }

            $creditNote->update([
                'status' => 'issued',
                'issued_at' => now(),
                'updated_by' => $actor->id,
            ]);

            CreditNoteIssued::dispatch($creditNote->fresh(['customer', 'lines.account', 'journal', 'originalInvoice']), $actor);

            return $creditNote->fresh();
        });
    }

    /**
     * Record payment for invoice
     */
    public function recordPayment(User $actor, Invoice $invoice, array $data): InvoicePayment
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        return DB::transaction(function () use ($company, $actor, $invoice, $data) {
            $currencyCode = strtoupper($data['currency_code'] ?? $invoice->currency_code);
            $exchangeRate = $this->getExchangeRate($currencyCode, $company->default_currency, $data['payment_date']);

            $baseAmount = bcmul(
                (string) $data['amount'],
                (string) $exchangeRate,
                4
            );

            $payment = InvoicePayment::query()->create([
                'company_id' => $company->id,
                'invoice_id' => $invoice->id,
                'payment_date' => $data['payment_date'],
                'currency_code' => $currencyCode,
                'exchange_rate' => $exchangeRate,
                'amount' => $data['amount'],
                'base_amount' => $baseAmount,
                'payment_method' => $data['payment_method'] ?? null,
                'reference' => $data['reference'] ?? null,
                'notes' => $data['notes'] ?? null,
                'created_by' => $actor->id,
            ]);

            // Update invoice paid amount
            $newPaidAmount = bcadd($invoice->paid_amount, $baseAmount, 4);
            $newBalanceDue = bcsub($invoice->total_amount, $newPaidAmount, 4);

            $newStatus = $invoice->status;
            if (bccomp($newBalanceDue, '0.0000', 4) <= 0) {
                $newStatus = 'paid';
            } elseif (bccomp($newPaidAmount, '0.0000', 4) > 0) {
                $newStatus = 'partial_paid';
            }

            $invoice->update([
                'paid_amount' => $newPaidAmount,
                'balance_due' => max('0.0000', $newBalanceDue),
                'status' => $newStatus,
                'paid_at' => $newStatus === 'paid' ? now() : $invoice->paid_at,
                'updated_by' => $actor->id,
            ]);

            // The Accounting module listener posts the cash/bank vs receivable entry.
            InvoicePaymentRecorded::dispatch($payment, $actor);

            return $payment;
        });
    }

    /**
     * Apply credit note to invoice
     */
    public function applyCreditNote(User $actor, CreditNote $creditNote, Invoice $invoice, string $amount): void
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        DB::transaction(function () use ($company, $actor, $creditNote, $invoice, $amount) {
            $exchangeRate = $this->getExchangeRate(
                $creditNote->currency_code,
                $company->default_currency,
                now()->toDateString()
            );

            $baseAmount = bcmul($amount, (string) $exchangeRate, 4);

            // Create payment record linking credit note
            $payment = InvoicePayment::query()->create([
                'company_id' => $company->id,
                'invoice_id' => $invoice->id,
                'credit_note_id' => $creditNote->id,
                'payment_date' => now()->toDateString(),
                'currency_code' => $creditNote->currency_code,
                'exchange_rate' => $exchangeRate,
                'amount' => $amount,
                'base_amount' => $baseAmount,
                'payment_method' => 'credit_note',
                'reference' => 'CN: ' . $creditNote->document_number,
                'notes' => 'Credit note application',
                'created_by' => $actor->id,
            ]);

            // Update invoice
            $newPaidAmount = bcadd($invoice->paid_amount, $baseAmount, 4);
            $newBalanceDue = bcsub($invoice->total_amount, $newPaidAmount, 4);

            $newStatus = $invoice->status;
            if (bccomp($newBalanceDue, '0.0000', 4) <= 0) {
                $newStatus = 'paid';
            } elseif (bccomp($newPaidAmount, '0.0000', 4) > 0) {
                $newStatus = 'partial_paid';
            }

            $invoice->update([
                'paid_amount' => $newPaidAmount,
                'balance_due' => max('0.0000', $newBalanceDue),
                'status' => $newStatus,
                'paid_at' => $newStatus === 'paid' ? now() : $invoice->paid_at,
                'updated_by' => $actor->id,
            ]);

            // Update credit note
            $newAppliedAmount = bcadd($creditNote->applied_amount, $baseAmount, 4);
            $newBalanceDue = bcsub($creditNote->total_amount, $newAppliedAmount, 4);

            $creditNote->update([
                'applied_amount' => $newAppliedAmount,
                'balance_due' => max('0.0000', $newBalanceDue),
                'status' => bccomp($newBalanceDue, '0.0000', 4) <= 0 ? 'applied' : 'issued',
                'updated_by' => $actor->id,
            ]);

            // Allocation only: the listener skips the ledger entry for credit-note payments.
            InvoicePaymentRecorded::dispatch($payment, $actor);
        });
    }

    /**
     * Generate recurring invoices
     */
    public function generateRecurringInvoices(): int
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        $dueRecurring = RecurringInvoice::query()
            ->where('company_id', $company->id)
            ->where('status', 'active')
            ->whereDate('next_run_date', '<=', now())
            ->get();

        $generated = 0;

        foreach ($dueRecurring as $recurring) {
            try {
                $template = $recurring->getTemplateInvoice();
                $lines = $template['lines'] ?? [];

                $this->createInvoice(
                    app(User::class), // system user
                    [
                        'customer_id' => $recurring->customer_id,
                        'currency_code' => $recurring->currency_code,
                        'invoice_date' => now()->toDateString(),
                        'due_date' => $recurring->paymentTerm
                            ? $recurring->paymentTerm->calculateDueDate(now()->toDateString())
                            : now()->toDateString(),
                        'status' => 'draft',
                        'notes' => $recurring->notes,
                        'terms' => $recurring->terms,
                    ],
                    $lines
                );

                $recurring->incrementOccurrence();
                $generated++;
            } catch (\Throwable $e) {
                \Log::error('Failed to generate recurring invoice', [
                    'recurring_id' => $recurring->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $generated;
    }

    /**
     * Fiscalise an invoice
     */
    public function fiscaliseInvoice(User $actor, Invoice $invoice): FiscalDocument
    {
        $fiscalDoc = FiscalDocument::query()->firstOrCreate(
            [
                'company_id' => $invoice->company_id,
                'document_type' => Invoice::class,
                'document_id' => $invoice->id,
            ],
            [
                'status' => 'pending',
                'created_by' => $actor->id,
            ]
        );

        if ($fiscalDoc->isSuccess()) {
            return $fiscalDoc;
        }

        $result = $this->fiscalDevice->fiscaliseInvoice($invoice);

        if ($result['success']) {
            $fiscalDoc->markAsSuccess($result);
        } else {
            $fiscalDoc->markAsFailed($result['message'] ?? 'Fiscalisation failed');
        }

        return $fiscalDoc->fresh();
    }

    /**
     * Fiscalise a credit note
     */
    public function fiscaliseCreditNote(User $actor, CreditNote $creditNote): FiscalDocument
    {
        $fiscalDoc = FiscalDocument::query()->firstOrCreate(
            [
                'company_id' => $creditNote->company_id,
                'document_type' => CreditNote::class,
                'document_id' => $creditNote->id,
            ],
            [
                'status' => 'pending',
                'created_by' => $actor->id,
            ]
        );

        if ($fiscalDoc->isSuccess()) {
            return $fiscalDoc;
        }

        $result = $this->fiscalDevice->fiscaliseCreditNote($creditNote);

        if ($result['success']) {
            $fiscalDoc->markAsSuccess($result);
        } else {
            $fiscalDoc->markAsFailed($result['message'] ?? 'Fiscalisation failed');
        }

        return $fiscalDoc->fresh();
    }

    private function getExchangeRate(string $fromCurrency, string $toCurrency, string $date): string
    {
        if (strtoupper($fromCurrency) === strtoupper($toCurrency)) {
            return '1.0000000000';
        }

        $rate = $this->exchangeRateService->rateFor($fromCurrency, $toCurrency, CarbonImmutable::parse($date))?->rate;

        if (! $rate) {
            throw ValidationException::withMessages([
                'currency_code' => "No exchange rate found for {$fromCurrency} to {$toCurrency} on {$date}.",
            ]);
        }

        return $rate;
    }
}