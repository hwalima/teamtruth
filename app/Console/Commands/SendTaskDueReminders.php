<?php

namespace App\Console\Commands;

use App\Models\Task;
use App\Notifications\TaskDueSoonNotification;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class SendTaskDueReminders extends Command
{
    protected $signature = 'tasks:send-due-reminders';
    protected $description = 'Send notifications for tasks due soon or overdue';

    public function handle(): int
    {
        $today = Carbon::today();

        $tasks = Task::with(['assignedTo', 'project'])
            ->whereNotNull('assigned_to')
            ->whereNotNull('end_date')
            ->where('progress', '<', 100)
            ->whereBetween('end_date', [$today->copy()->subDay(), $today->copy()->addDays(3)])
            ->get();

        $sent = 0;
        foreach ($tasks as $task) {
            $daysLeft = $today->diffInDays($task->end_date, false);

            $alreadyNotified = $task->assignedTo->notifications()
                ->where('type', TaskDueSoonNotification::class)
                ->whereDate('created_at', $today)
                ->whereJsonContains('data->task_id', $task->id)
                ->exists();

            if ($alreadyNotified) continue;

            $task->assignedTo->notify(new TaskDueSoonNotification($task, $daysLeft));
            $sent++;
        }

        $this->info("Sent {$sent} due-date reminders.");
        return Command::SUCCESS;
    }
}
