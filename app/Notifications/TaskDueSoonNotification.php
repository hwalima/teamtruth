<?php

namespace App\Notifications;

use App\Models\Task;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class TaskDueSoonNotification extends Notification
{
    use Queueable;

    public function __construct(
        private Task $task,
        private int $daysLeft
    ) {}

    public function via($notifiable): array
    {
        return ['database'];
    }

    public function toArray($notifiable): array
    {
        $urgency = $this->daysLeft <= 0 ? 'overdue' : ($this->daysLeft === 1 ? 'due tomorrow' : "due in {$this->daysLeft} days");

        return [
            'type' => 'task_due_soon',
            'title' => "Task {$urgency}",
            'content' => "\"{$this->task->title}\" is {$urgency}",
            'task_id' => $this->task->id,
            'project_id' => $this->task->project_id,
            'project_title' => $this->task->project?->title,
            'days_left' => $this->daysLeft,
            'link' => "/projects/{$this->task->project_id}/tasks/{$this->task->id}",
        ];
    }
}
