<?php

namespace App\Console\Commands;

use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Invoicing\Models\Invoice;
use App\Notifications\InvoicePaymentReminderNotification;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class SendInvoicePaymentReminders extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'invoicing:send-payment-reminders
                            {--company= : Specific company ID to process (default: all)}
                            {--dry-run : Show what would be sent without sending}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Send payment reminders for overdue invoices based on configured follow-up levels';

    /**
     * Default reminder schedule: days overdue => reminder level
     */
    private const REMINDER_SCHEDULE = [
        7  => 1,   // First reminder at 7 days overdue
        14 => 2,   // Second reminder at 14 days overdue
        30 => 3,   // Final reminder at 30 days overdue
    ];

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $companyId = $this->option('company');
        $dryRun = $this->option('dry-run');

        $companies = $companyId
            ? Company::where('id', $companyId)->get()
            : Company::where('is_active', true)->get();

        $totalSent = 0;
        $totalSkipped = 0;

        foreach ($companies as $company) {
            $this->info("Processing company: {$company->name} ({$company->code})");

            app(CompanyContext::class)->setActiveCompany($company);

            $sent = $this->processCompanyReminders($company, $dryRun);
            $totalSent += $sent;
            $totalSkipped += $sent > 0 ? 0 : 1; // Simplified
        }

        $this->newLine();
        $this->info("Completed. Total reminders sent: {$totalSent}");

        return Command::SUCCESS;
    }

    /**
     * Process reminders for a specific company.
     */
    private function processCompanyReminders(Company $company, bool $dryRun): int
    {
        $sent = 0;

        foreach (self::REMINDER_SCHEDULE as $daysOverdue => $reminderLevel) {
            $targetDate = now()->subDays($daysOverdue)->toDateString();

            // Find invoices that are overdue by exactly this many days
            // and haven't had this reminder level sent yet
            $invoices = Invoice::query()
                ->where('company_id', $company->id)
                ->whereIn('status', ['sent', 'partial_paid', 'overdue'])
                ->whereDate('due_date', $targetDate)
                ->where('balance_due', '>', 0)
                ->whereDoesntHave('notifications', function ($query) use ($reminderLevel) {
                    $query->where('type', 'App\Notifications\InvoicePaymentReminderNotification')
                        ->whereJsonContains('data->reminder_level', $reminderLevel);
                })
                ->with('customer')
                ->get();

            if ($invoices->isEmpty()) {
                continue;
            }

            $this->info("  Found {$invoices->count()} invoice(s) for reminder level {$reminderLevel} ({$daysOverdue} days overdue)");

            foreach ($invoices as $invoice) {
                if ($dryRun) {
                    $this->line("    [DRY RUN] Would send reminder level {$reminderLevel} for {$invoice->document_number} to {$invoice->customer->email}");
                    continue;
                }

                try {
                    $this->sendReminder($invoice, $reminderLevel);
                    $sent++;
                    $this->line("    Sent reminder level {$reminderLevel} for {$invoice->document_number}");
                } catch (\Throwable $e) {
                    Log::error('Failed to send payment reminder', [
                        'invoice_id' => $invoice->id,
                        'reminder_level' => $reminderLevel,
                        'error' => $e->getMessage(),
                    ]);
                    $this->error("    Failed to send reminder for {$invoice->document_number}: {$e->getMessage()}");
                }
            }
        }

        return $sent;
    }

    /**
     * Send a payment reminder for a specific invoice.
     */
    private function sendReminder(Invoice $invoice, int $reminderLevel): void
    {
        $customer = $invoice->customer;

        if (! $customer->email) {
            $this->warn("    Customer {$customer->name} has no email address, skipping");
            return;
        }

        // Send notification
        $customer->notify(new InvoicePaymentReminderNotification($invoice, $reminderLevel));
    }
}