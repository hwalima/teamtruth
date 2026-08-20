<?php

namespace App\Listeners;

use App\Events\ExpenseApprovalRequested;
use App\Services\SlackService;

class SendExpenseApprovalSlackNotification
{
    public function handle(ExpenseApprovalRequested $event): void
    {
        $expense = $event->expense;
        $userId = $expense->created_by ?? auth()->id();
        $workspaceId = $expense->project->workspace_id ?? null;

        if (!$userId)
            return;
        if (isNotificationTemplateEnabled('Expense Approval', $userId, 'slack')) {

            $data = [
                '{expense_title}' => $expense->title,
                '{submitted_by}' => $expense->user->name ?? 'Unknown User',
                '{expense_amount}' => $expense->amount,
                '{project_name}' => $expense->project->title ?? 'Unknown Project',
            ];

            SlackService::send('Expense Approval', $data, $userId, $workspaceId);
        }
    }
}