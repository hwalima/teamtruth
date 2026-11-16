<?php

namespace App\Modules\Invoicing\Services;

use App\Modules\Invoicing\Models\CreditNote;
use App\Modules\Invoicing\Models\Invoice;

class NullFiscalDevice implements FiscalDeviceInterface
{
    public function fiscaliseInvoice(Invoice $invoice): array
    {
        return [
            'success' => true,
            'fiscal_invoice_number' => 'MOCK-' . $invoice->document_number,
            'fiscal_receipt_number' => 'MOCK-RCPT-' . $invoice->document_number,
            'fiscal_day_end_number' => 'MOCK-DE-' . now()->format('Ymd'),
            'fiscal_signature' => 'MOCK-SIGNATURE-' . hash('sha256', $invoice->document_number . now()->timestamp),
            'fiscal_qr_code' => 'MOCK-QR-' . $invoice->document_number,
            'message' => 'Fiscalisation simulated (NullFiscalDevice)',
        ];
    }

    public function fiscaliseCreditNote(CreditNote $creditNote): array
    {
        return [
            'success' => true,
            'fiscal_invoice_number' => 'MOCK-CN-' . $creditNote->document_number,
            'fiscal_receipt_number' => 'MOCK-CN-RCPT-' . $creditNote->document_number,
            'fiscal_day_end_number' => 'MOCK-DE-' . now()->format('Ymd'),
            'fiscal_signature' => 'MOCK-SIGNATURE-' . hash('sha256', $creditNote->document_number . now()->timestamp),
            'fiscal_qr_code' => 'MOCK-QR-CN-' . $creditNote->document_number,
            'message' => 'Credit note fiscalisation simulated (NullFiscalDevice)',
        ];
    }

    public function voidDocument(string $fiscalInvoiceNumber, string $reason): array
    {
        return [
            'success' => true,
            'message' => 'Void simulated for ' . $fiscalInvoiceNumber,
        ];
    }

    public function checkStatus(): array
    {
        return [
            'status' => 'ready',
            'message' => 'NullFiscalDevice is ready (simulation mode)',
        ];
    }

    public function getDeviceInfo(): array
    {
        return [
            'device_id' => 'NULL-DEVICE',
            'model' => 'NullFiscalDevice',
            'firmware' => '1.0.0',
            'mode' => 'simulation',
        ];
    }
}