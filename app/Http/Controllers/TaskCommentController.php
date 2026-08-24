<?php

namespace App\Http\Controllers;

use App\Models\Task;
use App\Models\TaskComment;
use App\Models\User;
use App\Notifications\TaskCommentNotification;
use Illuminate\Http\Request;

class TaskCommentController extends Controller
{
    public function store(Request $request, Task $task)
    {
        $validated = $request->validate([
            'comment' => 'required|string',
            'mentions' => 'nullable|array'
        ]);

        $taskComment = TaskComment::create([
            'task_id' => $task->id,
            'user_id' => auth()->id(),
            'comment' => $validated['comment'],
            'mentions' => $validated['mentions'] ?? []
        ]);

        // Notify mentioned users
        $mentionedIds = $validated['mentions'] ?? [];
        if (!empty($mentionedIds)) {
            $mentionedUsers = User::whereIn('id', $mentionedIds)->get();
            foreach ($mentionedUsers as $user) {
                if ($user->id !== auth()->id()) {
                    $user->notify(new TaskCommentNotification($task, auth()->user(), $validated['comment']));
                }
            }
        }

        // Also notify task assignee if not already mentioned and not the commenter
        if ($task->assigned_to && $task->assigned_to !== auth()->id() && !in_array($task->assigned_to, $mentionedIds)) {
            $assignee = User::find($task->assigned_to);
            if ($assignee) {
                $assignee->notify(new TaskCommentNotification($task, auth()->user(), $validated['comment']));
            }
        }

        // Log activity
        \App\Models\TaskActivity::log($task, 'comment_added', null, null, null, mb_substr($validated['comment'], 0, 100));

        // Fire event for Slack notification
        if (!config('app.is_demo', true)) {
            event(new \App\Events\TaskCommentAdded($taskComment));
        }

        return back();
    }

    public function update(Request $request, TaskComment $taskComment)
    {
        if (!$taskComment->canBeUpdatedBy(auth()->user())) {
            abort(403);
        }

        $validated = $request->validate([
            'comment' => 'required|string',
            'mentions' => 'nullable|array'
        ]);

        $taskComment->update($validated);

        return back();
    }

    public function destroy(TaskComment $taskComment)
    {
        if (!$taskComment->canBeDeletedBy(auth()->user())) {
            abort(403);
        }

        $taskComment->delete();

        return back();
    }
}
