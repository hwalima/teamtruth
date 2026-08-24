<?php

namespace App\Notifications;

use App\Models\Task;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class TaskStatusChangedNotification extends Notification
{
    use Queueable;

    public function __construct(
        private Task $task,
        private string $oldStage,
        private string $newStage,
        private User $changedBy
    ) {}

    public function via($notifiable): array
    {
        return ['database'];
    }

    public function toArray($notifiable): array
    {
        return [
            'type' => 'task_status_changed',
            'title' => 'Task status updated',
            'content' => "\"{$this->task->title}\" moved from {$this->oldStage} to {$this->newStage}",
            'task_id' => $this->task->id,
            'project_id' => $this->task->project_id,
            'project_title' => $this->task->project?->title,
            'old_stage' => $this->oldStage,
            'new_stage' => $this->newStage,
            'sender_id' => $this->changedBy->id,
            'sender_name' => $this->changedBy->name,
            'link' => "/projects/{$this->task->project_id}/tasks/{$this->task->id}",
        ];
    }
}
