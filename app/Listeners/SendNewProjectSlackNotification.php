<?php

namespace App\Listeners;

use App\Events\ProjectCreated;
use App\Services\SlackService;

class SendNewProjectSlackNotification
{
    public function handle(ProjectCreated $event): void
    {        
        $project = $event->project;
        $userId = $project->created_by ?? auth()->id();
        $workspaceId = $project->workspace_id;
        
        if (!$userId) {
            return;
        }

        if (isNotificationTemplateEnabled('New Project', $userId, 'slack')) {
            $data = [
                '{project_name}' => $project->title,
                '{created_by}' => $project->creator->name ?? 'Unknown User',
                '{start_date}' => $project->start_date ?? 'Not set',
                '{end_date}' => $project->deadline ?? 'Not set',
            ];
            SlackService::send('New Project', $data, $userId, $workspaceId);
        }
    }
}