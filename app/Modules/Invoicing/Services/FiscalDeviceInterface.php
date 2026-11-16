<?php

namespace App\Modules\Invoicing\Services;

use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Invoicing\Models\CreditNote;

interface FiscalDeviceInterface
{
    /**
     * Fiscalise an invoice
     */
    public function fiscaliseInvoice(Invoice $invoice): array;

    /**
     * Fiscalise a credit note
     */
    public function fiscaliseCreditNote(CreditNote $creditNote): array;

    /**
     * Void a previously fiscalised document
     */
    public function voidDocument(string $fiscalInvoiceNumber, string $reason): array;

    /**
     * Check device status
     */
    public function checkStatus(): array;

    /**
     * Get device info
     */
    public function getDeviceInfo(): array;
}