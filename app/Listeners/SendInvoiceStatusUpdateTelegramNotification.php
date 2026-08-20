<?php

namespace App\Listeners;

use App\Events\InvoiceStatusUpdated;
use App\Services\TelegramService;

class SendInvoiceStatusUpdateTelegramNotification
{
    public function handle(InvoiceStatusUpdated $event): void
    {
        $invoice = $event->invoice;
        $userId = $invoice->created_by ?? auth()->id();
        $workspaceId = $invoice->workspace_id ?? null;

        if (!$userId)
            return;
        if (isNotificationTemplateEnabled('Invoice Status Updated', $userId, 'telegram')) {
            $data = [
                '{invoice_number}' => $invoice->invoice_number,
                '{status}'         => $event->newStatus,
                '{updated_by}'     => auth()->user()->name ?? 'Unknown',
            ];

            TelegramService::send('Invoice Status Updated', $data, $userId, $workspaceId);
        }
    }
}