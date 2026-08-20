<?php

namespace App\Listeners;

use App\Events\BudgetCreated;
use App\Services\SlackService;

class SendNewBudgetSlackNotification
{
    public function handle(BudgetCreated $event): void
    {
        $budget = $event->budget;
        $userId = $budget->created_by ?? auth()->id();
        $workspaceId = $budget->project->workspace_id ?? null;
        
        if (!$userId) return;

        if (isNotificationTemplateEnabled('New Budget', $userId, 'slack')) {
            $data = [
                '{project_name}' => $budget->project->title ?? 'Unknown Project',
                '{total_budget}' => $budget->total_budget ?? 0,
                '{period_type}' => $budget->period_type ?? 'N/A',
            ];

            SlackService::send('New Budget', $data, $userId, $workspaceId);
        }
    }
}