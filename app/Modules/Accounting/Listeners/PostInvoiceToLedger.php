<?php

namespace App\Modules\Accounting\Listeners;

use App\Modules\Accounting\Services\AccountingPostingService;
use App\Modules\Accounting\Services\LedgerAccountResolver;
use App\Modules\Core\Services\AuditLogService;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Invoicing\Events\InvoicePosted;

/**
 * Posts a customer invoice to the general ledger:
 *   Dr Accounts receivable (invoice total)
 *   Cr Revenue per line account (net of tax)
 *   Cr Tax payable (per line tax)
 */
class PostInvoiceToLedger
{
    public function __construct(
        private AccountingPostingService $postingService,
        private LedgerAccountResolver $resolver,
    ) {}

    public function handle(InvoicePosted $event): void
    {
        $invoice = $event->invoice->fresh(['customer', 'lines.account', 'journal']);
        if ($invoice === null) {
            return;
        }

        $company = app(CompanyContext::class)->requireActiveCompany();

        $journal = $invoice->journal ?? $this->resolver->salesJournal($company);
        $receivable = $this->resolver->receivableAccount($company);

        $lines = [
            [
                'account_id' => $receivable->id,
                'description' => 'Invoice '.$invoice->document_number,
                'debit' => (string) $invoice->total_amount,
                'credit' => '0.0000',
            ],
        ];

        $revenueByAccount = [];
        $taxByAccount = [];
        foreach ($invoice->lines as $line) {
            $net = bcsub((string) $line->line_total, (string) $line->tax_amount, 4);

            $account = $line->account ?? $this->resolver->revenueAccount($company);
            $revenueByAccount[$account->id] ??= [
                'account_id' => $account->id,
                'description' => 'Revenue from '.$invoice->document_number,
                'debit' => '0.0000',
                'credit' => '0.0000',
            ];
            $revenueByAccount[$account->id]['credit'] = bcadd($revenueByAccount[$account->id]['credit'], $net, 4);

            if (bccomp((string) $line->tax_amount, '0.0000', 4) > 0) {
                $taxAccount = $this->resolver->taxPayableAccount($company);
                $taxByAccount[$taxAccount->id] ??= [
                    'account_id' => $taxAccount->id,
                    'description' => 'Tax from '.$invoice->document_number,
                    'debit' => '0.0000',
                    'credit' => '0.0000',
                ];
                $taxByAccount[$taxAccount->id]['credit'] = bcadd($taxByAccount[$taxAccount->id]['credit'], (string) $line->tax_amount, 4);
            }
        }

        // A negative line (a deduction the customer takes off, e.g. a levy
        // withheld) leaves its account with a negative credit: post it as a
        // debit instead, and drop accounts that net to nothing.
        foreach ($revenueByAccount as $id => $line) {
            $credit = $line['credit'];
            if (bccomp($credit, '0.0000', 4) === 0) {
                unset($revenueByAccount[$id]);
            } elseif (bccomp($credit, '0.0000', 4) < 0) {
                $revenueByAccount[$id] = [...$line, 'description' => 'Deducted by customer on '.$invoice->document_number, 'debit' => bcmul($credit, '-1', 4), 'credit' => '0.0000'];
            }
        }

        $lines = array_merge($lines, array_values($revenueByAccount), array_values($taxByAccount));

        $entry = $this->postingService->postSourceEntry($event->actor, $invoice, [
            'journal_id' => $journal->id,
            'entry_date' => $invoice->invoice_date,
            'currency_code' => $invoice->currency_code,
            'description' => 'Invoice '.$invoice->document_number.' - '.$invoice->customer->name,
            'reference' => $invoice->document_number,
        ], $lines);

        app(AuditLogService::class)->record(
            $company,
            'invoicing.invoice.posted_to_ledger',
            $invoice,
            changes: ['after' => [
                'document_number' => $invoice->document_number,
                'journal_entry_id' => $entry->id,
                'journal_entry_number' => $entry->document_number,
            ]],
            actor: $event->actor,
        );
    }
}
