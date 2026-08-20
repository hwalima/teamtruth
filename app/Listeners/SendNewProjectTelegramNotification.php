<?php

namespace App\Listeners;

use App\Events\ProjectCreated;
use App\Services\TelegramService;

class SendNewProjectTelegramNotification
{
    public function handle(ProjectCreated $event): void
    {
        $project = $event->project;
        $userId = $project->created_by ?? auth()->id();
        $workspaceId = $project->workspace_id ?? null;
        
        if (!$userId) return;

        if (isNotificationTemplateEnabled('New Project', $userId, 'telegram')) {
            $data = [
                '{project_name}' => $project->title,
                '{created_by}'   => $project->creator->name ?? 'Unknown User',
                '{start_date}'   => $project->start_date ?? 'Not set',
                '{end_date}'     => $project->deadline ?? 'Not set',
            ];

            TelegramService::send('New Project', $data, $userId, $workspaceId);
        }
    }
}