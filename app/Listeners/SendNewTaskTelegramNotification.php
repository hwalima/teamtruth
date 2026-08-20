<?php

namespace App\Listeners;

use App\Events\TaskCreated;
use App\Services\TelegramService;

class SendNewTaskTelegramNotification
{
    public function handle(TaskCreated $event): void
    {
        $task = $event->task;
        $userId = $task->created_by ?? auth()->id();
        $workspaceId = $task->project->workspace_id ?? null;
        
        if (!$userId) return;

        if (isNotificationTemplateEnabled('New Task', $userId, 'telegram')) {
            $data = [
                '{task_title}'  => $task->title,
                '{priority}'    => $task->priority ?? 'Normal',
                '{due_date}'    => $task->due_date ? \Carbon\Carbon::parse($task->due_date)->format('M d, Y') : 'No due date',
                '{assigned_by}' => auth()->user()->name ?? 'Unknown',
            ];

            TelegramService::send('New Task', $data, $userId, $workspaceId);
        }
    }
}