<?php

namespace App\Notifications;

use App\Models\Task;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class TaskAssignedNotification extends Notification
{
    use Queueable;

    public function __construct(
        private Task $task,
        private User $assignedBy
    ) {}

    public function via($notifiable): array
    {
        return ['database'];
    }

    public function toArray($notifiable): array
    {
        return [
            'type' => 'task_assigned',
            'title' => 'Task assigned to you',
            'content' => "{$this->assignedBy->name} assigned you to \"{$this->task->title}\"",
            'task_id' => $this->task->id,
            'project_id' => $this->task->project_id,
            'project_title' => $this->task->project?->title,
            'sender_id' => $this->assignedBy->id,
            'sender_name' => $this->assignedBy->name,
            'link' => "/projects/{$this->task->project_id}/tasks/{$this->task->id}",
        ];
    }
}
