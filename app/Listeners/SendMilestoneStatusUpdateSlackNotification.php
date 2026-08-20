<?php

namespace App\Listeners;

use App\Events\MilestoneStatusUpdated;
use App\Services\SlackService;

class SendMilestoneStatusUpdateSlackNotification
{
    public function handle(MilestoneStatusUpdated $event): void
    {
        $milestone = $event->milestone;
        $userId = $milestone->created_by ?? auth()->id();
        $workspaceId = $milestone->project->workspace_id ?? null;

        if (!$userId)
            return;
        if (isNotificationTemplateEnabled('Milestone Status Updated', $userId, 'slack')) {
            $data = [
                '{milestone_title}' => $milestone->title,
                '{status}' => $event->newStatus,
                '{updated_by}' => auth()->user()->name ?? 'Unknown',
            ];

            SlackService::send('Milestone Status Updated', $data, $userId, $workspaceId);
        }
    }
}