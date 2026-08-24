<?php

namespace App\Notifications;

use App\Models\Task;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class TaskBlockedNotification extends Notification
{
    use Queueable;

    public function __construct(
        private Task $task,
        private Task $blockingTask
    ) {}

    public function via($notifiable): array
    {
        return ['database'];
    }

    public function toArray($notifiable): array
    {
        return [
            'type' => 'task_blocked',
            'title' => 'Task is blocked',
            'content' => "\"{$this->task->title}\" is blocked by \"{$this->blockingTask->title}\"",
            'task_id' => $this->task->id,
            'blocking_task_id' => $this->blockingTask->id,
            'project_id' => $this->task->project_id,
            'project_title' => $this->task->project?->title,
            'link' => "/projects/{$this->task->project_id}/tasks/{$this->task->id}",
        ];
    }
}
