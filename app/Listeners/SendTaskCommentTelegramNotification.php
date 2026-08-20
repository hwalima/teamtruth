<?php

namespace App\Listeners;

use App\Events\TaskCommentAdded;
use App\Services\TelegramService;

class SendTaskCommentTelegramNotification
{
    public function handle(TaskCommentAdded $event): void
    {
        $comment = $event->taskComment;
        $task = $comment->task;
        $userId = $comment->user_id ?? auth()->id();
        $workspaceId = $task->project->workspace_id ?? null;
        
        if (!$userId) return;

        if (isNotificationTemplateEnabled('New Task Comment', $userId, 'telegram')) {
            $data = [
                '{task_title}'     => $task->title,
                '{commenter_name}' => $comment->user->name ?? 'Unknown User',
                '{comment_text}'   => $comment->comment ?? '',
            ];

            TelegramService::send('New Task Comment', $data, $userId, $workspaceId);
        }
    }
}