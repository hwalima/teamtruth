<?php

namespace App\Listeners;

use App\Events\BudgetCreated;
use App\Services\TelegramService;

class SendNewBudgetTelegramNotification
{
    public function handle(BudgetCreated $event): void
    {
        $budget = $event->budget;
        $userId = $budget->created_by ?? auth()->id();
        $workspaceId = $budget->workspace_id ?? null;
        
        if (!$userId) return;

        if (isNotificationTemplateEnabled('New Budget', $userId, 'telegram')) {
            $data = [
                '{project_name}' => $budget->project->title ?? 'Unknown Project',
                '{total_budget}' => $budget->total_amount ?? $budget->total_budget,
                '{period_type}'  => $budget->period_type ?? 'N/A',
            ];

            TelegramService::send('New Budget', $data, $userId, $workspaceId);
        }
    }
}