<?php

namespace App\Http\Controllers;

use App\Models\NotificationTemplate;
use Illuminate\Http\Request;
use Inertia\Inertia;

class NotificationTemplateController extends Controller
{
    public function index(Request $request)
    {
        $query = NotificationTemplate::with(['notificationTemplateLangs' => function ($query) {
            $query->where('created_by', createdBy());
        }])->whereHas('notificationTemplateLangs', function ($query) {
            $query->where('created_by', createdBy());
        });
        
        // Filter by type (slack/telegram) — default to 'slack' if not provided
        $type = $request->get('type', 'slack');
        $query->where('type', $type);
        
        if ($request->filled('search')) {
            $query->where('name', 'like', '%' . $request->search . '%');
        }
        
        $sortField = $request->get('sort_field', 'created_at');
        $sortDirection = $request->get('sort_direction', 'desc');
        $query->orderBy($sortField, $sortDirection);
        
        $perPage = $request->get('per_page', 10);
        $templates = $query->paginate($perPage);
        
        return Inertia::render('notification-templates/index', [
            'templates' => $templates,
            'filters' => array_merge(
                $request->only(['search', 'sort_field', 'sort_direction', 'per_page']),
                ['type' => $type]
            )
        ]);
    }

    public function show(NotificationTemplate $notificationTemplate)
    {
        // Load company-specific content
        $template = $notificationTemplate->load(['notificationTemplateLangs' => function ($query) {
            $query->where('created_by', createdBy());
        }]);
        $languages = json_decode(file_get_contents(resource_path('lang/language.json')), true);
        
        $variables = $this->getVariablesByNameAndType($template->name, $template->type);

        return Inertia::render('notification-templates/show', [
            'template' => $template,
            'languages' => $languages,
            'variables' => $variables
        ]);
    }

    public function updateSettings(NotificationTemplate $notificationTemplate, Request $request)
    {
        try {
            $request->validate([
                'type' => 'required|string|max:255'
            ]);

            $notificationTemplate->update([
                'type' => $request->type
            ]);
            
            return redirect()->back()->with('success', __('Template settings updated successfully.'));
        } catch (\Exception $e) {
            return redirect()->back()->with('error', __('Failed to update template settings: :error', ['error' => $e->getMessage()]));
        }
    }

    public function updateContent(NotificationTemplate $notificationTemplate, Request $request)
    {
        try {
            $request->validate([
                'lang' => 'required|string|max:10',
                'title' => 'required|string|max:255',
                'content' => 'required|string'
            ]);

            $notificationTemplate->notificationTemplateLangs()
                ->where('lang', $request->lang)
                ->where('created_by', createdBy())
                ->update([
                    'title' => $request->title,
                    'content' => $request->content
                ]);
            
            return redirect()->back()->with('success', __('Notification content updated successfully.'));
        } catch (\Exception $e) {
            return redirect()->back()->with('error', __('Failed to update notification content: :error', ['error' => $e->getMessage()]));
        }
    }

    private function getVariablesByNameAndType($name, $type)
    {
        $allVariables = [
            'New Task' => [
                '{task_title}'   => 'Task Title',
                '{priority}'     => 'Task Priority',
                '{due_date}'     => 'Due Date',
                '{assigned_by}'  => 'Assigned By User',
            ],
            'New Project' => [
                '{project_name}' => 'Project Name',
                '{created_by}'   => 'Created By User',
                '{start_date}'   => 'Start Date',
                '{end_date}'     => 'End Date',
            ],
            'New Milestone' => [
                '{milestone_title}' => 'Milestone Title',
                '{project_name}'    => 'Project Name',
                '{due_date}'        => 'Due Date',
            ],
            'Milestone Status Updated' => [
                '{milestone_title}' => 'Milestone Title',
                '{status}'          => 'New Status',
                '{updated_by}'      => 'Updated By User',
            ],
            'New Task Comment' => [
                '{task_title}'     => 'Task Title',
                '{commenter_name}' => 'Commenter Name',
                '{comment_text}'   => 'Comment Text',
            ],
            'Task Stage Updated' => [
                '{task_title}'  => 'Task Title',
                '{old_stage}'   => 'Old Stage',
                '{new_stage}'   => 'New Stage',
                '{updated_by}'  => 'Updated By User',
            ],
            'New Invoice' => [
                '{invoice_number}' => 'Invoice Number',
                '{client_name}'    => 'Client Name',
                '{amount}'         => 'Invoice Amount',
                '{due_date}'       => 'Due Date',
            ],
            'Invoice Status Updated' => [
                '{invoice_number}' => 'Invoice Number',
                '{status}'         => 'New Status',
                '{updated_by}'     => 'Updated By User',
            ],
            'Expense Approval' => [
                '{expense_title}'  => 'Expense Title',
                '{submitted_by}'   => 'Submitted By User',
                '{expense_amount}' => 'Expense Amount',
                '{project_name}'   => 'Project Name',
            ],
            'New Budget' => [
                '{project_name}' => 'Project Name',
                '{total_budget}' => 'Total Budget',
                '{period_type}'  => 'Period Type',
            ],
        ];

        return $allVariables[$name] ?? [];
    }
}