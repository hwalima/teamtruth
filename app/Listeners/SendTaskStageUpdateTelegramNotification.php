<?php

namespace App\Listeners;

use App\Events\TaskStageUpdated;
use App\Services\TelegramService;

class SendTaskStageUpdateTelegramNotification
{
    public function handle(TaskStageUpdated $event): void
    {
        $task = $event->task;
        $userId = auth()->id();
        $workspaceId = $task->project->workspace_id ?? null;
        
        if (!$userId) return;

        if (isNotificationTemplateEnabled('Task Stage Updated', $userId, 'telegram')) {
            $data = [
                '{task_title}'  => $task->title,
                '{old_stage}'   => $event->oldStage,
                '{new_stage}'   => $event->newStage,
                '{updated_by}'  => auth()->user()->name ?? 'Unknown',
            ];
            TelegramService::send('Task Stage Updated', $data, $userId, $workspaceId);
        }
    }
}