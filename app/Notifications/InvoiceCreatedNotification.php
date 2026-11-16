<?php

namespace App\Notifications;

use App\Modules\Invoicing\Models\Invoice;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Storage;

class InvoiceCreatedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private Invoice $invoice,
        private ?string $customMessage = null,
        private ?string $pdfPath = null,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $company = $this->invoice->company;
        $customer = $this->invoice->customer;

        $mail = (new MailMessage)
            ->subject($company->name . ' - Invoice ' . $this->invoice->document_number)
            ->greeting('Dear ' . $customer->name . ',')
            ->line($this->customMessage ?? 'Please find attached your invoice ' . $this->invoice->document_number . ' for ' . $this->invoice->currency_code . ' ' . number_format($this->invoice->total_amount, 2) . '.')
            ->line('Invoice Date: ' . $this->invoice->invoice_date->format('Y-m-d'))
            ->line('Due Date: ' . $this->invoice->due_date->format('Y-m-d'))
            ->line('Total Amount: ' . $this->invoice->currency_code . ' ' . number_format($this->invoice->total_amount, 2))
            ->line('Balance Due: ' . $this->invoice->currency_code . ' ' . number_format($this->invoice->balance_due, 2));

        // Add payment link if available
        $paymentLink = $this->getPaymentLink();
        if ($paymentLink) {
            $mail->action('Pay Invoice', $paymentLink);
        }

        $mail->line('Thank you for your business!')
            ->salutation('Regards,' . PHP_EOL . $company->name);

        // Attach PDF if available
        if ($this->pdfPath && Storage::disk('local')->exists($this->pdfPath)) {
            $mail->attach(
                Storage::disk('local')->path($this->pdfPath),
                [
                    'as' => 'invoice-' . $this->invoice->document_number . '.pdf',
                    'mime' => 'application/pdf',
                ]
            );
        }

        return $mail;
    }

    public function toArray(object $notifiable): array
    {
        return [
            'invoice_id' => $this->invoice->id,
            'document_number' => $this->invoice->document_number,
            'total_amount' => $this->invoice->total_amount,
            'currency_code' => $this->invoice->currency_code,
            'due_date' => $this->invoice->due_date?->toDateString(),
            'message' => 'Invoice ' . $this->invoice->document_number . ' sent',
        ];
    }

    private function getPaymentLink(): ?string
    {
        // Generate public payment link for the invoice
        // This uses the existing invoice payment route
        return route('invoices.payment', ['token' => $this->invoice->getPaymentToken()], absolute: true);
    }
}