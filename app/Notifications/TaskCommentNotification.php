<?php

namespace App\Notifications;

use App\Models\Task;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class TaskCommentNotification extends Notification
{
    use Queueable;

    public function __construct(
        private Task $task,
        private User $commenter,
        private string $commentPreview
    ) {}

    public function via($notifiable): array
    {
        return ['database'];
    }

    public function toArray($notifiable): array
    {
        return [
            'type' => 'task_comment',
            'title' => 'New comment on task',
            'content' => "{$this->commenter->name} commented on \"{$this->task->title}\": " . mb_substr($this->commentPreview, 0, 80),
            'task_id' => $this->task->id,
            'project_id' => $this->task->project_id,
            'project_title' => $this->task->project?->title,
            'sender_id' => $this->commenter->id,
            'sender_name' => $this->commenter->name,
            'link' => "/projects/{$this->task->project_id}/tasks/{$this->task->id}",
        ];
    }
}
