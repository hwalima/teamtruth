<?php

namespace App\Modules\Accounting\Listeners;

use App\Modules\Accounting\Services\AccountingPostingService;
use App\Modules\Accounting\Services\LedgerAccountResolver;
use App\Modules\Core\Services\AuditLogService;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Invoicing\Events\CreditNoteIssued;

/**
 * Posts an issued credit note to the general ledger:
 *   Cr Accounts receivable (credit note total)
 *   Dr Revenue per line account (net of tax)
 *   Dr Tax payable (per line tax)
 */
class PostCreditNoteToLedger
{
    public function __construct(
        private AccountingPostingService $postingService,
        private LedgerAccountResolver $resolver,
    ) {}

    public function handle(CreditNoteIssued $event): void
    {
        $creditNote = $event->creditNote->fresh(['customer', 'lines.account', 'journal', 'originalInvoice']);
        if ($creditNote === null) {
            return;
        }

        $company = app(CompanyContext::class)->requireActiveCompany();

        $journal = $creditNote->journal
            ?? $creditNote->originalInvoice?->journal
            ?? $this->resolver->salesJournal($company);
        $receivable = $this->resolver->receivableAccount($company);

        $lines = [
            [
                'account_id' => $receivable->id,
                'description' => 'Credit note '.$creditNote->document_number,
                'debit' => '0.0000',
                'credit' => (string) $creditNote->total_amount,
            ],
        ];

        $revenueByAccount = [];
        $taxByAccount = [];
        foreach ($creditNote->lines as $line) {
            $net = bcsub((string) $line->line_total, (string) $line->tax_amount, 4);

            $account = $line->account ?? $this->resolver->revenueAccount($company);
            $revenueByAccount[$account->id] ??= [
                'account_id' => $account->id,
                'description' => 'Credit note '.$creditNote->document_number.': '.$line->name,
                'debit' => '0.0000',
                'credit' => '0.0000',
            ];
            $revenueByAccount[$account->id]['debit'] = bcadd($revenueByAccount[$account->id]['debit'], $net, 4);

            if (bccomp((string) $line->tax_amount, '0.0000', 4) > 0) {
                $taxAccount = $this->resolver->taxPayableAccount($company);
                $taxByAccount[$taxAccount->id] ??= [
                    'account_id' => $taxAccount->id,
                    'description' => 'Tax reversal from '.$creditNote->document_number,
                    'debit' => '0.0000',
                    'credit' => '0.0000',
                ];
                $taxByAccount[$taxAccount->id]['debit'] = bcadd($taxByAccount[$taxAccount->id]['debit'], (string) $line->tax_amount, 4);
            }
        }

        $lines = array_merge($lines, array_values($revenueByAccount), array_values($taxByAccount));

        $entry = $this->postingService->postSourceEntry($event->actor, $creditNote, [
            'journal_id' => $journal->id,
            'entry_date' => $creditNote->credit_note_date,
            'currency_code' => $creditNote->currency_code,
            'description' => 'Credit note '.$creditNote->document_number.' - '.$creditNote->customer->name,
            'reference' => $creditNote->document_number,
        ], $lines);

        app(AuditLogService::class)->record(
            $company,
            'invoicing.credit_note.posted_to_ledger',
            $creditNote,
            changes: ['after' => [
                'document_number' => $creditNote->document_number,
                'journal_entry_id' => $entry->id,
                'journal_entry_number' => $entry->document_number,
            ]],
            actor: $event->actor,
        );
    }
}
