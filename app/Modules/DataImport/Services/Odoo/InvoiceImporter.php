<?php

namespace App\Modules\DataImport\Services\Odoo;

use App\Models\Currency;
use App\Modules\Accounting\Models\AccountingAccount;
use App\Modules\Accounting\Models\FiscalPeriod;
use App\Modules\Accounting\Services\LedgerAccountResolver;
use App\Modules\Core\Services\ExchangeRateService;
use App\Modules\DataImport\Services\ImportContext;
use App\Modules\Invoicing\Events\InvoicePosted;
use App\Modules\Invoicing\Models\FiscalDocument;
use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Invoicing\Models\InvoiceLine;
use App\Modules\Invoicing\Services\InvoicingService;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;

/**
 * Odoo customer invoices (account.move, the Invoices list exported) become
 * invoices here, keeping Odoo's number, dates and status.
 *
 * The export holds totals only, so each invoice gets one sales line for the
 * untaxed amount and one line for Odoo's tax. A negative tax is a deduction the
 * customer takes off (a levy or withholding) and goes to the account chosen for
 * it; a positive tax goes to tax payable. Confirmed invoices are posted to the
 * ledger, and what has been paid (total less amount due) is recorded as a
 * payment. Invoices already fiscalised in Odoo are marked fiscalised, so they
 * are never sent to the fiscal device again.
 */
class InvoiceImporter extends OdooImporter
{
    public const MODEL = 'account.move';

    private ?AccountingAccount $deductionAccount = null;

    private ?AccountingAccount $taxAccount = null;

    public function __construct(
        private Partners $partners,
        private LedgerAccountResolver $resolver,
        private InvoicingService $invoicing,
    ) {}

    public function model(): string
    {
        return self::MODEL;
    }

    public function label(): string
    {
        return 'Customer invoices';
    }

    public function permissions(): array
    {
        return ['erp.invoicing.manage'];
    }

    public function requiredFields(): array
    {
        return ['number', 'partner', 'total'];
    }

    public function aliases(): array
    {
        return [
            'number' => ['name', 'Number'],
            'partner' => ['partner_id', 'Invoice Partner Display Name', 'Partner', 'Customer'],
            'date' => ['invoice_date', 'Invoice/Bill Date', 'Invoice Date'],
            'due_date' => ['invoice_date_due', 'Due Date'],
            'untaxed' => ['amount_untaxed_signed', 'amount_untaxed_in_currency_signed', 'Untaxed Amount Signed Currency', 'Untaxed Amount Signed', 'Untaxed Amount', 'Tax Excluded'],
            'tax' => ['amount_tax_signed', 'Tax Signed', 'Tax', 'amount_tax'],
            'total' => ['amount_total_in_currency_signed', 'amount_total_signed', 'Total in Currency Signed', 'Total Signed', 'Total', 'amount_total'],
            'amount_due' => ['amount_residual_signed', 'Amount Due Signed', 'Amount Due', 'amount_residual'],
            'currency' => ['currency_id', 'Currency'],
            'status' => ['status_in_payment', 'Status In Payment', 'payment_state', 'Payment Status', 'Payment', 'state', 'Status'],
            'fiscalised' => ['Fiscalised', 'Fiscalized', 'x_fiscalised', 'x_fiscalized', 'x_studio_fiscalised'],
            'reference' => ['ref', 'Reference', 'Customer Reference', 'payment_reference', 'Payment Reference'],
            'move_type' => ['move_type', 'Type'],
        ];
    }

    public function run(ImportContext $context, array $rows, array $columns): void
    {
        $this->deductionAccount = $this->deductionAccount($context, $rows, $columns);

        foreach ($rows as $row) {
            $rowNumber = $row['row_number'];
            $data = $row['data'];

            try {
                DB::transaction(fn () => $this->importRow($context, $rowNumber, $data, $columns));
            } catch (ValidationException $e) {
                $context->row($rowNumber, 'error', collect($e->errors())->flatten()->all());
            }
        }
    }

    private function importRow(ImportContext $context, int $rowNumber, array $data, array $columns): void
    {
        $number = $this->text($data, $columns, 'number', 100);
        $state = $this->state($this->text($data, $columns, 'status'));
        if ($number === null || $number === '/') {
            $context->row($rowNumber, 'skipped', [$state === 'cancelled' ? 'Cancelled in Odoo before it was given a number.' : 'A draft in Odoo with no number yet.']);

            return;
        }

        $total = $this->number($data, $columns, 'total') ?? 0.0;
        $moveType = mb_strtolower((string) $this->text($data, $columns, 'move_type'));
        if (str_contains($moveType, 'refund') || str_contains($moveType, 'credit') || str_contains($moveType, 'bill') || str_contains($moveType, 'vendor') || $total < 0) {
            $context->row($rowNumber, 'skipped', ['Only customer invoices are imported; credit notes and vendor bills are not yet.']);

            return;
        }

        $untaxed = $this->number($data, $columns, 'untaxed') ?? $total;
        $tax = $this->number($data, $columns, 'tax') ?? round($total - $untaxed, 2);
        if (abs(round($untaxed + $tax - $total, 2)) > 0.01) {
            $context->row($rowNumber, 'error', ["The untaxed amount ({$untaxed}) and tax ({$tax}) do not add up to the total ({$total})."]);

            return;
        }

        $amountDue = $this->number($data, $columns, 'amount_due');
        if ($amountDue === null) {
            if ($state === 'partial') {
                $context->row($rowNumber, 'error', ['Partly paid in Odoo, but the file has no Amount Due column, so what is still owed is unknown. Export it with Amount Due.']);

                return;
            }
            $amountDue = $state === 'paid' ? 0.0 : $total;
        }
        $paid = round(max(0, $total - $amountDue), 2);

        $existing = $context->find(self::MODEL, $number) ?? Invoice::query()->where('document_number', $number)->first();
        if ($existing instanceof Invoice) {
            $this->update($context, $rowNumber, $existing, $state, $paid, $data, $columns);

            return;
        }

        $date = $this->date($this->value($data, $columns, 'date'));
        $dueDate = $this->date($this->value($data, $columns, 'due_date')) ?? $date;
        if ($date === null) {
            $context->row($rowNumber, 'error', ['No invoice date.']);

            return;
        }

        $currency = strtoupper($this->text($data, $columns, 'currency') ?? (string) $context->company->default_currency);
        if (! Currency::query()->where('code', $currency)->exists()) {
            $context->row($rowNumber, 'error', ["Currency {$currency} is not set up."]);

            return;
        }

        $customerName = $this->text($data, $columns, 'partner', 255);
        $customer = $this->partners->customer($context, $customerName);

        $invoice = Invoice::query()->create([
            'company_id' => $context->company->id,
            'document_number' => $number,
            'customer_id' => $customer->id,
            'status' => $state === 'draft' ? 'draft' : ($state === 'cancelled' ? 'cancelled' : 'sent'),
            'type' => 'invoice',
            'invoice_date' => $date->toDateString(),
            'due_date' => ($dueDate ?? $date)->toDateString(),
            'currency_code' => $currency,
            'exchange_rate' => $this->rate($context, $currency, $date),
            'notes' => 'Imported from Odoo'.($this->text($data, $columns, 'reference') ? ' · reference '.$this->text($data, $columns, 'reference', 200) : '').'.',
            'sent_at' => $state === 'draft' ? null : $date,
            'created_by' => $context->user->id,
        ]);

        $lines = [['name' => "Sales as per Odoo invoice {$number}", 'unit_price' => $untaxed, 'account_id' => null]];
        if (round($tax, 2) != 0.0) {
            $percent = $untaxed != 0.0 ? rtrim(rtrim(number_format(abs($tax) / abs($untaxed) * 100, 2, '.', ''), '0'), '.') : null;
            $lines[] = $tax < 0
                ? ['name' => 'Deducted by the customer'.($percent ? " ({$percent}%)" : ''), 'unit_price' => $tax, 'account_id' => $this->deductionAccount?->id]
                : ['name' => 'Tax'.($percent ? " ({$percent}%)" : ''), 'unit_price' => $tax, 'account_id' => $this->taxAccount($context)->id];
        }
        foreach ($lines as $index => $line) {
            InvoiceLine::query()->create([
                'company_id' => $context->company->id,
                'invoice_id' => $invoice->id,
                'account_id' => $line['account_id'],
                'name' => $line['name'],
                'quantity' => 1,
                'unit_price' => $line['unit_price'],
                'discount_percent' => 0,
                'tax_rate' => 0,
                'sort_order' => $index + 1,
            ])->recalculate()->save();
        }
        $invoice->load('lines')->recalculateTotals()->save();

        $messages = [];
        if ($state === 'cancelled' || $state === 'draft') {
            $messages[] = $state === 'cancelled' ? 'Cancelled in Odoo: kept for the record, not posted.' : 'A draft in Odoo: kept as a draft, not posted.';
        } else {
            $this->post($context, $invoice, $date);
            $messages[] = 'Posted to the ledger on '.$date->toDateString().'.';
            if ($this->flag($data, $columns, 'fiscalised') === true) {
                $this->markFiscalised($context, $invoice, $date);
                $messages[] = 'Fiscalised in Odoo.';
            } elseif (isset($columns['fiscalised'])) {
                $messages[] = 'Not fiscalised in Odoo.';
            }
            if ($paid > 0) {
                $this->pay($context, $invoice, $paid, $date, $dueDate);
                $messages[] = 'Payment of '.number_format($paid, 2).' recorded'.($amountDue > 0 ? ', '.number_format($amountDue, 2).' still owed.' : ' in full.');
            }
        }

        $context->remember(self::MODEL, $number, $invoice);
        $context->created('invoices', $number, $invoice);
        $context->add('invoiced', round($total, 2));
        $context->add('paid', $paid);
        $context->row($rowNumber, 'created', $messages, $invoice);
    }

    /** Imported before: bring across payments made since, nothing else. */
    private function update(ImportContext $context, int $rowNumber, Invoice $invoice, string $state, float $paid, array $data, array $columns): void
    {
        $already = round((float) $invoice->paid_amount, 2);
        if (in_array($invoice->status, ['draft', 'cancelled'], true) || $state === 'cancelled') {
            $context->row($rowNumber, 'skipped', [$state === 'cancelled' && $invoice->status !== 'cancelled'
                ? 'Already imported; it has since been cancelled in Odoo. Cancel it here with a credit note if that is right.'
                : 'Already imported; nothing to bring across.'], $invoice);

            return;
        }
        if ($paid <= $already) {
            $context->row($rowNumber, 'skipped', ['Already imported; nothing has changed.'], $invoice);

            return;
        }

        $date = CarbonImmutable::parse($invoice->invoice_date);
        $dueDate = $this->date($this->value($data, $columns, 'due_date')) ?? CarbonImmutable::parse($invoice->due_date);
        $payment = $this->pay($context, $invoice, round($paid - $already, 2), $date, $dueDate, max(CarbonImmutable::today(), $date));
        $context->created('payments', $invoice->document_number, $payment);
        $context->add('paid', round($paid - $already, 2));
        $context->row($rowNumber, 'updated', ['Already imported; a further payment of '.number_format($paid - $already, 2).' was recorded.'], $invoice);
    }

    /** The checks posting does, without fiscalising: these were fiscalised (or not) in Odoo. */
    private function post(ImportContext $context, Invoice $invoice, CarbonImmutable $date): void
    {
        $period = FiscalPeriod::query()
            ->whereDate('starts_on', '<=', $date->toDateString())
            ->whereDate('ends_on', '>=', $date->toDateString())
            ->where('status', 'open')
            ->first();
        if (! $period) {
            throw ValidationException::withMessages(['invoice' => 'No open accounting period covers '.$date->toDateString().'. Open it under Accounting before importing.']);
        }

        $invoice->update(['fiscal_period_id' => $period->id]);
        InvoicePosted::dispatch($invoice->fresh(['customer', 'lines.account', 'journal']), $context->user);
    }

    private function markFiscalised(ImportContext $context, Invoice $invoice, CarbonImmutable $date): void
    {
        FiscalDocument::query()->create([
            'company_id' => $context->company->id,
            'document_type' => Invoice::class,
            'document_id' => $invoice->id,
            'status' => 'success',
            'fiscal_invoice_number' => $invoice->document_number,
            'fiscalized_at' => $date,
            'response_payload' => ['source' => 'odoo', 'note' => 'Fiscalised in Odoo before the import.'],
            'created_by' => $context->user->id,
        ]);
    }

    /** Odoo's export has no payment dates: a payment is dated on the due date (not before the invoice, not in the future). */
    private function pay(ImportContext $context, Invoice $invoice, float $amount, CarbonImmutable $date, ?CarbonImmutable $dueDate, ?CarbonImmutable $on = null)
    {
        $on ??= collect([$dueDate ?? $date, CarbonImmutable::today()])->min()->max($date);

        return $this->invoicing->recordPayment($context->user, $invoice->fresh(), [
            'payment_date' => $on->toDateString(),
            'amount' => number_format($amount, 2, '.', ''),
            'payment_method' => 'bank_transfer',
            'reference' => 'Odoo '.$invoice->document_number,
            'notes' => 'Paid as per Odoo; brought across by the import.',
        ]);
    }

    /** Odoo's payment state, from the label or the technical value. */
    private function state(?string $status): string
    {
        $status = mb_strtolower(trim((string) $status));

        return match (true) {
            str_contains($status, 'partial') => 'partial',
            str_contains($status, 'cancel') => 'cancelled',
            str_contains($status, 'draft') => 'draft',
            in_array($status, ['paid', 'in payment', 'in_payment', 'reversed'], true) => 'paid',
            default => 'posted',
        };
    }

    private function date(mixed $value): ?CarbonImmutable
    {
        if ($value === null || $value === '' || is_bool($value)) {
            return null;
        }
        try {
            return is_numeric($value)
                ? CarbonImmutable::instance(ExcelDate::excelToDateTimeObject((float) $value))->startOfDay()
                : CarbonImmutable::parse((string) $value)->startOfDay();
        } catch (\Throwable) {
            return null;
        }
    }

    private function rate(ImportContext $context, string $currency, CarbonImmutable $date): string
    {
        if ($currency === strtoupper((string) $context->company->default_currency)) {
            return '1.0000000000';
        }
        $rate = app(ExchangeRateService::class)->rateFor($currency, $context->company->default_currency, $date)?->rate;
        if ($rate === null) {
            throw ValidationException::withMessages(['currency' => "No exchange rate for {$currency} on {$date->toDateString()}. Add it under Settings → Exchange Rates."]);
        }

        return (string) $rate;
    }

    private function taxAccount(ImportContext $context): AccountingAccount
    {
        return $this->taxAccount ??= $this->resolver->taxPayableAccount($context->company);
    }

    /**
     * Where the customer's deductions (negative tax) go: the account chosen
     * for the import, else one named for a royalty, levy or withholding.
     */
    private function deductionAccount(ImportContext $context, array $rows, array $columns): ?AccountingAccount
    {
        $needed = collect($rows)->contains(fn ($row) => ($this->number($row['data'], $columns, 'tax') ?? 0) < 0);
        if (! $needed) {
            return null;
        }

        $chosen = $context->option('deduction_account_id');
        $query = AccountingAccount::query()->where('is_active', true)->where('is_group', false);
        $account = $chosen
            ? (clone $query)->whereKey($chosen)->first()
            : (clone $query)->where(fn ($q) => $q->where('name', 'like', '%royalt%')->orWhere('name', 'like', '%levy%')->orWhere('name', 'like', '%withh%'))->orderBy('code')->first();

        return $account ?? throw ValidationException::withMessages([
            'deduction_account_id' => 'The customer took deductions off these invoices (negative tax in Odoo). Choose the account they go to.',
        ]);
    }
}
