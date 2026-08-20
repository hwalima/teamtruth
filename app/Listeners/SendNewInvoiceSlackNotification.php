<?php

namespace App\Listeners;

use App\Events\InvoiceCreated;
use App\Services\SlackService;

class SendNewInvoiceSlackNotification
{
    public function handle(InvoiceCreated $event): void
    {
        $invoice = $event->invoice;
        $userId = $invoice->created_by ?? auth()->id();
        $workspaceId = $invoice->project->workspace_id ?? null;
        
        if (!$userId) return;

        if (isNotificationTemplateEnabled('New Invoice', $userId, 'slack')) {
            $data = [
                '{invoice_number}' => $invoice->invoice_number,
                '{client_name}' => $invoice->client->name ?? 'Unknown Client',
                '{amount}' => $invoice->total_amount,
                '{due_date}' => $invoice->due_date ? \Carbon\Carbon::parse($invoice->due_date)->format('M d, Y') : 'No due date',
            ];

            SlackService::send('New Invoice', $data, $userId, $workspaceId);
        }
    }
}