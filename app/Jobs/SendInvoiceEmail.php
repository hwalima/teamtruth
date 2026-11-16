<?php

namespace App\Jobs;

use App\Modules\Core\Services\DocumentRenderer;
use App\Modules\Invoicing\Models\Invoice;
use App\Notifications\InvoiceCreatedNotification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class SendInvoiceEmail implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private int $invoiceId,
        private ?string $customMessage = null,
    ) {}

    public function handle(DocumentRenderer $renderer): void
    {
        $invoice = Invoice::query()
            ->with(['customer', 'company.branding'])
            ->find($this->invoiceId);

        if (! $invoice) {
            Log::error('Invoice not found for email job', ['invoice_id' => $this->invoiceId]);
            return;
        }

        if (! $invoice->customer->email) {
            Log::warning('Cannot send invoice email: customer has no email address', [
                'invoice_id' => $invoice->id,
                'customer_id' => $invoice->customer_id,
            ]);
            return;
        }

        try {
            // Generate PDF
            $pdf = $renderer->render($invoice, 'pdf.documents.invoice', [
                'company' => $invoice->company->load('branding', 'signatories'),
            ]);

            // Store PDF temporarily for attachment
            $pdfPath = 'temp/invoice-' . $invoice->document_number . '.pdf';
            Storage::disk('local')->put($pdfPath, $pdf);

            // Send notification with PDF attachment
            $invoice->customer->notify(new InvoiceCreatedNotification(
                $invoice,
                $this->customMessage,
                $pdfPath
            ));

            // Clean up temp file
            Storage::disk('local')->delete($pdfPath);

            Log::info('Invoice email sent successfully', [
                'invoice_id' => $invoice->id,
                'customer_email' => $invoice->customer->email,
            ]);
        } catch (\Throwable $e) {
            Log::error('Failed to send invoice email', [
                'invoice_id' => $invoice->id,
                'error' => $e->getMessage(),
            ]);
            throw $e; // Re-throw to trigger queue retry
        }
    }

    public function tags(): array
    {
        return ['invoice-email', 'invoice-' . $this->invoiceId];
    }
}