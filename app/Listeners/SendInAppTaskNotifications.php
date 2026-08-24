<?php

namespace App\Listeners;

use App\Events\TaskAssigned;
use App\Events\TaskCommentAdded;
use App\Events\TaskStageUpdated;
use App\Notifications\TaskAssignedNotification;
use App\Notifications\TaskCommentNotification;
use App\Notifications\TaskStatusChangedNotification;

class SendInAppTaskNotifications
{
    public function handleTaskAssigned(TaskAssigned $event): void
    {
        if ($event->assignedUser->id === $event->assignedBy->id) {
            return;
        }

        $event->assignedUser->notify(
            new TaskAssignedNotification($event->task, $event->assignedBy)
        );
    }

    public function handleTaskCommentAdded(TaskCommentAdded $event): void
    {
        $comment = $event->taskComment;
        $task = $comment->task;
        $commenter = $comment->user;

        $usersToNotify = collect();

        if ($task->assigned_to && $task->assigned_to !== $commenter->id) {
            $usersToNotify->push($task->assignedTo);
        }

        if ($task->created_by && $task->created_by !== $commenter->id && $task->created_by !== $task->assigned_to) {
            $usersToNotify->push($task->creator);
        }

        $preview = strip_tags($comment->comment ?? $comment->content ?? '');

        $usersToNotify->filter()->each(function ($user) use ($task, $commenter, $preview) {
            $user->notify(new TaskCommentNotification($task, $commenter, $preview));
        });
    }

    public function handleTaskStageUpdated(TaskStageUpdated $event): void
    {
        $task = $event->task;

        $usersToNotify = collect();

        if ($task->assigned_to && $task->assigned_to !== auth()->id()) {
            $usersToNotify->push($task->assignedTo);
        }

        if ($task->created_by && $task->created_by !== auth()->id() && $task->created_by !== $task->assigned_to) {
            $usersToNotify->push($task->creator);
        }

        $usersToNotify->filter()->each(function ($user) use ($task, $event) {
            $user->notify(
                new TaskStatusChangedNotification(
                    $task,
                    $event->oldStage,
                    $event->newStage,
                    auth()->user()
                )
            );
        });
    }
}
