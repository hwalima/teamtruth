<?php

namespace App\Notifications;

use App\Modules\Invoicing\Models\Invoice;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class InvoicePaymentReminderNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private Invoice $invoice,
        private int $reminderLevel = 1,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $company = $this->invoice->company;
        $customer = $this->invoice->customer;

        $levelLabels = [
            1 => 'First Reminder',
            2 => 'Second Reminder',
            3 => 'Final Reminder',
        ];

        $levelLabel = $levelLabels[$this->reminderLevel] ?? 'Reminder #' . $this->reminderLevel;

        $mail = (new MailMessage)
            ->subject("$levelLabel: Invoice {$this->invoice->document_number} from {$company->name}")
            ->greeting("Dear {$customer->name},")
            ->line("This is a {$levelLabel.toLowerCase()} for invoice {$this->invoice->document_number} dated {$this->invoice->invoice_date->format('Y-m-d')}, which was due on {$this->invoice->due_date->format('Y-m-d')}.")
            ->line("Outstanding Amount: {$this->invoice->currency_code} " . number_format($this->invoice->balance_due, 2))
            ->line("Days Overdue: " . \Carbon\CarbonImmutable::parse($this->invoice->due_date)->diffInDays(now()));

        $paymentLink = $this->getPaymentLink();
        if ($paymentLink) {
            $mail->action('Pay Now', $paymentLink);
        }

        if ($this->reminderLevel >= 3) {
            $mail->line('This is a final reminder. Please settle this invoice immediately to avoid further action.');
        }

        $mail->line('If you have already made payment, please disregard this notice.')
            ->salutation('Regards,' . PHP_EOL . $company->name);

        return $mail;
    }

    public function toArray(object $notifiable): array
    {
        return [
            'invoice_id' => $this->invoice->id,
            'document_number' => $this->invoice->document_number,
            'balance_due' => $this->invoice->balance_due,
            'currency_code' => $this->invoice->currency_code,
            'reminder_level' => $this->reminderLevel,
            'days_overdue' => \Carbon\CarbonImmutable::parse($this->invoice->due_date)->diffInDays(now()),
            'message' => "Payment reminder #{$this->reminderLevel} for invoice {$this->invoice->document_number}",
        ];
    }

    private function getPaymentLink(): ?string
    {
        return route('invoices.payment', ['token' => $this->invoice->getPaymentToken()], absolute: true);
    }
}