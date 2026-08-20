<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Services\PlanLimitService;
use App\Traits\HasPermissionChecks;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Inertia\Response;

class ProjectController extends Controller
{
    use HasPermissionChecks;
    public function __construct(private PlanLimitService $planLimitService)
    {
    }
    public function index(Request $request): Response
    {
        $this->authorizePermission('project_view_any');

        $user = auth()->user();
        $workspace = $user->currentWorkspace;

        if (!$workspace) {
            abort(404, __('No workspace found. Please select a workspace.'));
        }

        $userWorkspaceRole = $workspace->getMemberRole($user);

        $query = Project::with(['workspace', 'clients', 'creator', 'members.user'])
            ->forWorkspace($user->current_workspace_id);

        // Access control based on workspace role
        if ($userWorkspaceRole === 'owner') {
            // Owner: Full access to all projects
        } else if ($userWorkspaceRole === 'manager') {
            // Manager: Assigned projects + self-created projects + public projects
            $query->where(function ($q) use ($user) {
                $q->whereHas('members', function ($memberQuery) use ($user) {
                    $memberQuery->where('user_id', $user->id);
                })
                    ->orWhereHas('clients', function ($clientQuery) use ($user) {
                        $clientQuery->where('user_id', $user->id);
                    })
                    ->orWhere('created_by', $user->id)
                    ->orWhere('is_public', true);
            });
        } else {
            // Non-owners: Only assigned projects + public projects
            $query->where(function ($q) use ($user, $userWorkspaceRole) {
                $q->whereHas('members', function ($memberQuery) use ($user) {
                    $memberQuery->where('user_id', $user->id);
                })
                    ->orWhereHas('clients', function ($clientQuery) use ($user) {
                        $clientQuery->where('user_id', $user->id);
                    })
                    ->orWhere('is_public', true);

                // Client/Member: Only self-created projects
                if (in_array($userWorkspaceRole, ['client', 'member'])) {
                    $q->orWhere('created_by', $user->id);
                }
            });
        }

        if ($request->search)
            $query->search($request->search);
        if ($request->status)
            $query->byStatus($request->status);
        if ($request->priority)
            $query->byPriority($request->priority);

        // Apply sorting with field validation
        $allowedSortFields = ['title', 'priority', 'deadline', 'status', 'created_at'];
        $sortField = $request->input('sort_field', 'created_at');
        $sortDirection = $request->input('sort_direction', 'desc');
        
        // Validate sort field
        if (!in_array($sortField, $allowedSortFields)) {
            $sortField = 'created_at';
        }
        
        // Validate sort direction
        if (!in_array($sortDirection, ['asc', 'desc'])) {
            $sortDirection = 'desc';
        }
        
        // Apply sorting
        if ($sortField === 'created_at') {
            $query->latest();
        } else {
            $query->orderBy($sortField, $sortDirection);
        }

        $perPage = in_array($request->get('per_page', 10), [10, 25, 50, 100]) ? $request->get('per_page', 10) : 10;
        $projects = $query->paginate($perPage);

        $projects->getCollection()->each(function ($project) {
            $project->members->each(function ($member) {
                if ($member->user) {
                    $member->user->avatar = check_file($member->user->avatar)
                        ? get_file($member->user->avatar)
                        : get_file('avatars/avatar.png');
                }
            });
        });
        $members = User::whereHas('workspaces', function ($q) use ($workspace) {
            $q->where('workspace_id', $workspace->id)->where('status', 'active')->where('role', 'member');
        })->get();

        $managers = User::whereHas('workspaces', function ($q) use ($workspace) {
            $q->where('workspace_id', $workspace->id)->where('status', 'active')->where('role', 'manager');
        })->get();

        $clients = User::whereHas('workspaces', function ($q) use ($workspace) {
            $q->where('workspace_id', $workspace->id)->where('status', 'active')->where('role', 'client');
        })->get();

        return Inertia::render('projects/Index', [
            'projects' => $projects,
            'members' => $members,
            'managers' => $managers,
            'clients' => $clients,
            'filters' => $request->only(['search', 'status', 'priority', 'sort_field', 'sort_direction', 'per_page', 'view']),
            'userWorkspaceRole' => $userWorkspaceRole,
            'permissions' => $this->getModuleCrudPermissions('project')
        ]);
    }



    public function store(Request $request)
    {
        $this->authorizePermission('project_create');

        $user = auth()->user();
        $workspace = $user->currentWorkspace;

        if (!$workspace) {
            return back()->withErrors(['error' => __('No workspace found. Please select a workspace.')]);
        }

        // Check plan limits before creating project
        $limitCheck = $this->planLimitService->canCreateProject($workspace);
        if (!$limitCheck['allowed']) {
            return back()->withErrors(['error' => $limitCheck['message']])->withInput();
        }

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'client_ids' => 'array',
            'client_ids.*' => 'exists:users,id',
            'status' => 'required|in:planning,active,on_hold,completed,cancelled',
            'priority' => 'required|in:low,medium,high,urgent',
            'start_date' => 'nullable|date',
            'deadline' => 'nullable|date|after:start_date',
            'estimated_hours' => 'nullable|integer|min:1',
            'budget' => 'nullable|numeric|min:0',
            'is_public' => 'boolean',
            'member_ids' => 'array',
            'member_ids.*' => 'exists:users,id'
        ]);

        $clientIds = $validated['client_ids'] ?? [];
        unset($validated['client_ids']);

        $project = Project::create([
            ...$validated,
            'workspace_id' => auth()->user()->current_workspace_id,
            'created_by' => auth()->id(),
            'budget' => $validated['budget'] ?? 0,
            'estimated_hours' => $validated['estimated_hours'] ?? 0
        ]);

        // Assign clients
        foreach ($clientIds as $clientId) {
            \App\Models\ProjectClient::create([
                'project_id' => $project->id,
                'user_id' => $clientId,
                'assigned_by' => auth()->id()
            ]);
        }

        // Assign members
        if (!empty($validated['member_ids'])) {
            foreach ($validated['member_ids'] as $userId) {
                ProjectMember::create([
                    'project_id' => $project->id,
                    'user_id' => $userId,
                    'role' => 'member',
                    'assigned_by' => auth()->id()
                ]);
            }
        }

        $project->logActivity('created', "Project '{$project->title}' was created");
        // Fire event for Slack notification
        if (!config('app.is_demo', true)) {
            event(new \App\Events\ProjectCreated($project));
        }

        return redirect()->route('projects.show', $project);
    }

    public function show(Request $request, Project $project): Response
    {
        $this->authorizePermission('project_view');

        $user = auth()->user();
        $workspace = $user->currentWorkspace;

        if (!$workspace) {
            abort(404, 'No workspace found. Please select a workspace.');
        }

        // Ensure project belongs to current workspace
        if ($project->workspace_id != $workspace->id) {
            abort(403, 'Project not found in current workspace.');
        }

        $userWorkspaceRole = $workspace->getMemberRole($user);

        if (!$userWorkspaceRole) {
            abort(403, 'You are not a member of this workspace.');
        }

        // Access control
        if ($userWorkspaceRole !== 'owner') {
            $hasAccess = $project->members()->where('user_id', $user->id)->exists() ||
                $project->clients()->where('user_id', $user->id)->exists();

            // Client/Member: Can also see self-created projects
            if (in_array($userWorkspaceRole, ['client', 'member'])) {
                $hasAccess = $hasAccess || $project->created_by === $user->id;
            }

            // if (!$hasAccess)
            //     abort(403);
        }

        $project->load([
            'workspace',
            'clients',
            'creator',
            'members.user',
            'milestones',
            'expenses' => function ($query) {
                $query->with(['budgetCategory', 'submitter'])->get();
            }
        ]);

        // Handle attachments with pagination and search
        $attachmentsQuery = $project->attachments()->with(['mediaItem', 'uploadedBy']);

        if ($request->attachment_search) {
            $attachmentsQuery->where(function ($query) use ($request) {
                $query->whereHas('mediaItem', function ($q) use ($request) {
                    $q->where('name', 'like', '%' . $request->attachment_search . '%');
                })
                    ->orWhereHas('uploadedBy', function ($q) use ($request) {
                        $q->where('name', 'like', '%' . $request->attachment_search . '%');
                    });
            });
        }

        $attachmentsPerPage = in_array($request->attachments_per_page, [6, 12, 24, 48]) ? $request->attachments_per_page : 12;
        $attachments = $attachmentsQuery->latest()->paginate($attachmentsPerPage, ['*'], 'attachments_page');

        $project->setRelation('attachments', $attachments);

        // Load all notes without pagination or search
        $notes = $project->notes()->with('creator')->latest()->get();
        $project->setRelation('notes', $notes);

        // Handle activities with pagination and search
        $activitiesQuery = $project->activities()->with('user');

        if ($request->activity_search) {
            $activitiesQuery->where('description', 'like', '%' . $request->activity_search . '%');
        }

        $activityPerPage = in_array($request->activity_per_page, [5, 10, 20, 50]) ? $request->activity_per_page : 10;
        $activities = $activitiesQuery->latest()->paginate($activityPerPage, ['*'], 'activity_page');

        $project->setRelation('activities', $activities);

        // Load project tasks with related data
        $projectTasks = \App\Models\Task::with(['taskStage', 'assignedTo', 'creator'])
            ->where('project_id', $project->id)
            ->latest()
            ->get();

        $projectTasks->each(function ($task) {
            foreach (['assignedTo', 'creator'] as $relation) {
                if ($task->$relation) {
                    $task->$relation->avatar = check_file($task->$relation->avatar)
                        ? get_file($task->$relation->avatar)
                        : get_file('avatars/avatar.png');
                }
            }
        });
        // Load project bugs with related data
        $projectBugs = \App\Models\Bug::with(['bugStatus', 'assignedTo', 'reportedBy'])
            ->where('project_id', $project->id)
            ->latest()
            ->get();
        
        $projectBugs->each(function ($bug) {
            foreach (['assignedTo','reportedBy'] as $relation) {
                if ($bug->$relation) {
                    $bug->$relation->avatar = check_file($bug->$relation->avatar)
                        ? get_file($bug->$relation->avatar)
                        : get_file('avatars/avatar.png');
                }
            }
        });

        // Load project timesheets with related data
        $projectTimesheets = \App\Models\Timesheet::with([
            'user',
            'entries' => function ($query) use ($project) {
                $query->whereHas('task', function ($taskQuery) use ($project) {
                    $taskQuery->where('project_id', $project->id);
                });
            }
        ])
            ->whereHas('entries.task', function ($query) use ($project) {
                $query->where('project_id', $project->id);
            })
            ->latest()
            ->get()
            ->map(function ($timesheet) {
                $timesheet->total_hours = $timesheet->entries->sum('hours');
                $timesheet->billable_hours = $timesheet->entries->where('is_billable', true)->sum('hours');
                $timesheet->billable_percentage = $timesheet->total_hours > 0
                    ? round(($timesheet->billable_hours / $timesheet->total_hours) * 100)
                    : 0;
                $timesheet->entries_count = $timesheet->entries->count();
                // user.avatar
                if ($timesheet->user) {
                    $timesheet->user->avatar = check_file($timesheet->user->avatar)
                        ? get_file($timesheet->user->avatar)
                        : get_file('avatars/avatar.png');
                }
                return $timesheet;
            });

        // Calculate project totals (only submitted timesheets)
        $submittedTimesheets = $projectTimesheets->whereIn('status', ['submitted', 'approved']);
        $project->total_project_hours = $submittedTimesheets->sum('total_hours');
        $project->total_billable_hours = $submittedTimesheets->sum('billable_hours');
        $project->billable_rate_percentage = $project->total_project_hours > 0
            ? round(($project->total_billable_hours / $project->total_project_hours) * 100)
            : 0;
        $project->total_team_members = $projectTimesheets->pluck('user.id')->unique()->count();
        $project->approved_timesheets_count = $projectTimesheets->where('status', 'approved')->count();
        $project->submitted_timesheets_percentage = $projectTimesheets->count() > 0
            ? round(($submittedTimesheets->count() / $projectTimesheets->count()) * 100)
            : 0;

        // project members with avatar URLs
        $project->members->each(function ($member) {
            if ($member->user) {
                $member->user->avatar = check_file($member->user->avatar)
                    ? get_file($member->user->avatar)
                    : get_file('avatars/avatar.png');
            }
        });
        $project->clients->each(function ($client) {
            if ($client) {
                $client->avatar = check_file($client->avatar)
                    ? get_file($client->avatar)
                    : get_file('avatars/avatar.png');
            }
        });
        $project->attachments->getCollection()->each(function ($attachment) {
            if ($attachment->uploadedBy) {
                $attachment->uploadedBy->avatar = check_file($attachment->uploadedBy->avatar)
                    ? get_file($attachment->uploadedBy->avatar)
                    : get_file('avatars/avatar.png');
            }
        });
        $project->activities->getCollection()->each(function ($activity) {
            if ($activity->user) {
                $activity->user->avatar = check_file($activity->user->avatar)
                    ? get_file($activity->user->avatar)
                    : get_file('avatars/avatar.png');
            }
        });

        // Load single budget for this project
        $budget = \App\Models\ProjectBudget::with(['categories', 'creator'])
            ->where('project_id', $project->id)
            ->first();

        // Add computed attributes to budget
        if ($budget) {
            $budget->total_spent = $budget->total_spent;
            $budget->remaining_budget = $budget->remaining_budget;
            $budget->utilization_percentage = $budget->utilization_percentage;

            // Load recent expenses for this budget
            $budget->expenses = \App\Models\ProjectExpense::with('submitter')
                ->where('project_id', $project->id)
                ->latest()
                ->limit(4)
                ->get();
        }

        // Get workspace members (users with member role in workspace)
        $members = User::whereHas('workspaces', function ($q) use ($workspace) {
            $q->where('workspace_id', $workspace->id)
                ->where('status', 'active')
                ->where('role', 'member');
        })->get();

        // Get workspace managers (users with manager role in workspace)
        $managers = User::whereHas('workspaces', function ($q) use ($workspace) {
            $q->where('workspace_id', $workspace->id)
                ->where('status', 'active')
                ->where('role', 'manager');
        })->get();

        // Get clients (users with client role in workspace)
        $clients = User::whereHas('workspaces', function ($q) use ($workspace) {
            $q->where('workspace_id', $workspace->id)
                ->where('status', 'active')
                ->where('role', 'client');
        })->get();

        return Inertia::render('projects/Show', [
            'project' => $project,
            'budget' => $budget,
            'members' => $members,
            'managers' => $managers,
            'clients' => $clients,
            'projectTasks' => $projectTasks,
            'projectBugs' => $projectBugs,
            'projectTimesheets' => $projectTimesheets,
            'userWorkspaceRole' => $userWorkspaceRole,
            'canManageBudget' => $this->checkPermission('project_manage_budget'),
            'canDeleteProject' => $this->checkPermission('project_delete'),
            'canViewBudget' => $this->checkPermission('project_manage_budget'),
            'canManageMembers' => $this->checkPermission('project_assign_members'),
            'canManageClients' => $this->checkPermission('project_assign_clients'),
            'canManageAttachments' => $this->checkPermission('project_manage_attachments'),
            'canManageNotes' => $this->checkPermission('project_manage_notes'),
            'canTrackProgress' => $this->checkPermission('project_track_progress'),
            'canManageSharedSettings' => $this->checkPermission('project_manage_shared_settings'),
            'attachmentFilters' => $request->only(['attachment_search', 'attachments_per_page']),

            'activityFilters' => $request->only(['activity_search', 'activity_per_page'])
        ]);
    }



    public function update(Request $request, Project $project)
    {
        $this->authorizePermission('project_update');

        $user = auth()->user();
        $workspace = $user->currentWorkspace;

        if (!$workspace || $project->workspace_id != $workspace->id) {
            abort(403, 'Project not found in current workspace.');
        }
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'status' => 'required|in:planning,active,on_hold,completed,cancelled',
            'priority' => 'required|in:low,medium,high,urgent',
            'start_date' => 'nullable|date',
            'deadline' => 'nullable|date|after:start_date',
            'estimated_hours' => 'nullable|integer|min:1',
            'budget' => 'nullable|numeric|min:0',
            'is_public' => 'boolean'
        ]);

        $project->update([
            ...$validated,
            'updated_by' => auth()->id()
        ]);

        $project->logActivity('updated', "Project '{$project->title}' was updated");

        return redirect()->route('projects.show', $project);
    }

    public function destroy(Project $project)
    {
        $this->authorizePermission('project_delete');

        $user = auth()->user();
        $workspace = $user->currentWorkspace;

        if (!$workspace || $project->workspace_id != $workspace->id) {
            abort(403, 'Project not found in current workspace.');
        }

        $userWorkspaceRole = $workspace->getMemberRole($user);

        // Check if user is workspace owner (override role if needed)
        if ($user->id === $workspace->owner_id) {
            $userWorkspaceRole = 'owner';
        }

        if (!$userWorkspaceRole) {
            abort(403, 'You are not a member of this workspace.');
        }

        // Only owner and managers can delete projects
        if (!in_array($userWorkspaceRole, ['owner', 'manager'])) {
            abort(403);
        }

        $projectTitle = $project->title;
        $project->logActivity('deleted', "Project '{$projectTitle}' deleted");
        $project->delete();

        return redirect()->route('projects.index');
    }

    public function createBudget(Request $request, Project $project)
    {
        $this->authorizePermission('project_manage_budget');

        $user = auth()->user();
        $workspace = $user->currentWorkspace;

        if (!$workspace || $project->workspace_id != $workspace->id) {
            abort(403, 'Project not found in current workspace.');
        }

        $userWorkspaceRole = $workspace->getMemberRole($user);

        if (!$userWorkspaceRole) {
            abort(403, 'You are not a member of this workspace.');
        }

        // Only owner and managers can create/manage budgets
        if (!in_array($userWorkspaceRole, ['owner', 'manager'])) {
            abort(403);
        }

        $validated = $request->validate([
            'total_budget' => 'required|numeric|min:0',
            'currency' => 'required|string|size:3',
            'period_type' => 'required|in:monthly,quarterly,yearly',
            'start_date' => 'required|date',
            'end_date' => 'nullable|date|after:start_date',
            'description' => 'nullable|string',
            'categories' => 'required|array|min:1',
            'categories.*.name' => 'required|string',
            'categories.*.allocated_amount' => 'required|numeric|min:0',
            'categories.*.color' => 'nullable|string',
            'categories.*.description' => 'nullable|string'
        ]);

        if ($project->budget)
            return back()->withErrors(['budget' => 'Budget exists']);

        $budget = $project->budget()->create([
            'workspace_id' => $project->workspace_id,
            'total_budget' => $validated['total_budget'],
            'currency' => $validated['currency'],
            'period_type' => $validated['period_type'],
            'start_date' => $validated['start_date'],
            'end_date' => $validated['end_date'],
            'description' => $validated['description'],
            'created_by' => $user->id
        ]);

        foreach ($validated['categories'] as $index => $category) {
            $budget->categories()->create([
                'name' => $category['name'],
                'allocated_amount' => $category['allocated_amount'],
                'color' => $category['color'] ?? '#3B82F6',
                'description' => $category['description'],
                'sort_order' => $index + 1
            ]);
        }

        return back();
    }

    public function assignMember(Request $request, Project $project)
    {
        $this->authorizePermission('project_assign_members');

        $user = auth()->user();
        $workspace = $user->currentWorkspace;

        if (!$workspace || $project->workspace_id != $workspace->id) {
            abort(403, 'Project not found in current workspace.');
        }
        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'role' => 'required|in:owner,manager,member,client'
        ]);

        ProjectMember::updateOrCreate(
            ['project_id' => $project->id, 'user_id' => $validated['user_id']],
            ['role' => $validated['role'], 'assigned_by' => auth()->id()]
        );

        $user = User::find($validated['user_id']);
        $project->logActivity('member_assigned', "User '{$user->name}' was assigned to project");

        return back();
    }

    public function removeMember(Project $project, User $user)
    {
        $this->authorizePermission('project_assign_members');

        $currentUser = auth()->user();
        $workspace = $currentUser->currentWorkspace;

        if (!$workspace || $project->workspace_id != $workspace->id) {
            abort(403, 'Project not found in current workspace.');
        }
        $project->members()->where('user_id', $user->id)->delete();
        $project->logActivity('member_removed', "User '{$user->name}' was removed from project");

        return back();
    }

    public function updateProgress(Request $request, Project $project)
    {
        $this->authorizePermission('project_track_progress');

        $user = auth()->user();
        $workspace = $user->currentWorkspace;

        if (!$workspace || $project->workspace_id != $workspace->id) {
            abort(403, 'Project not found in current workspace.');
        }
        $validated = $request->validate([
            'progress' => 'required|integer|min:0|max:100'
        ]);

        $project->update($validated);
        $project->logActivity('progress_updated', "Project progress updated to {$validated['progress']}%");

        return back();
    }

    public function assignClient(Request $request, Project $project)
    {
        $this->authorizePermission('project_assign_clients');

        $user = auth()->user();
        $workspace = $user->currentWorkspace;

        if (!$workspace || $project->workspace_id != $workspace->id) {
            abort(403, 'Project not found in current workspace.');
        }
        $validated = $request->validate([
            'user_id' => 'required|exists:users,id'
        ]);

        \App\Models\ProjectClient::updateOrCreate(
            ['project_id' => $project->id, 'user_id' => $validated['user_id']],
            ['assigned_by' => auth()->id()]
        );

        $user = User::find($validated['user_id']);
        $project->logActivity('client_assigned', "Client '{$user->name}' was assigned to project");

        return back();
    }

    public function removeClient(Project $project, User $user)
    {
        $this->authorizePermission('project_assign_clients');

        $currentUser = auth()->user();
        $workspace = $currentUser->currentWorkspace;

        if (!$workspace || $project->workspace_id != $workspace->id) {
            abort(403, 'Project not found in current workspace.');
        }
        \App\Models\ProjectClient::where('project_id', $project->id)
            ->where('user_id', $user->id)
            ->delete();

        $project->logActivity('client_removed', "Client '{$user->name}' was removed from project");

        return back();
    }

    public function assignClients(Request $request, Project $project)
    {
        $this->authorizePermission('project_assign_clients');

        $user = auth()->user();
        $workspace = $user->currentWorkspace;

        if (!$workspace || $project->workspace_id != $workspace->id) {
            abort(403, 'Project not found in current workspace.');
        }
        $validated = $request->validate([
            'client_ids' => 'required|array',
            'client_ids.*' => 'exists:users,id'
        ]);

        foreach ($validated['client_ids'] as $clientId) {
            \App\Models\ProjectClient::updateOrCreate(
                ['project_id' => $project->id, 'user_id' => $clientId],
                ['assigned_by' => auth()->id()]
            );

            // Fire event for email notification
            $assignedUser = User::find($clientId);

            if (!config('app.is_demo', true)) {
                event(new \App\Events\ProjectMemberAssigned($project, $assignedUser, auth()->user(), 'client'));
            }
        }

        $clientNames = User::whereIn('id', $validated['client_ids'])->pluck('name')->toArray();
        $project->logActivity('clients_assigned', "Clients '" . implode(', ', $clientNames) . "' were assigned to project");

        return back();
    }

    public function assignMembers(Request $request, Project $project)
    {
        $this->authorizePermission('project_assign_members');

        $user = auth()->user();
        $workspace = $user->currentWorkspace;

        if (!$workspace || $project->workspace_id != $workspace->id) {
            abort(403, 'Project not found in current workspace.');
        }
        $validated = $request->validate([
            'member_ids' => 'required|array',
            'member_ids.*' => 'exists:users,id'
        ]);

        foreach ($validated['member_ids'] as $memberId) {
            ProjectMember::updateOrCreate(
                ['project_id' => $project->id, 'user_id' => $memberId],
                ['role' => 'member', 'assigned_by' => auth()->id()]
            );

            // Fire event for email notification
            $assignedUser = User::find($memberId);
            if (!config('app.is_demo', true)) {
                event(new \App\Events\ProjectMemberAssigned($project, $assignedUser, auth()->user(), 'member'));
            }
        }

        $memberNames = User::whereIn('id', $validated['member_ids'])->pluck('name')->toArray();
        $project->logActivity('members_assigned', "Members '" . implode(', ', $memberNames) . "' were assigned to project");

        return back();
    }

    public function assignManagers(Request $request, Project $project)
    {
        $this->authorizePermission('project_assign_members');

        $user = auth()->user();
        $workspace = $user->currentWorkspace;

        if (!$workspace || $project->workspace_id != $workspace->id) {
            abort(403, 'Project not found in current workspace.');
        }
        $validated = $request->validate([
            'manager_ids' => 'required|array',
            'manager_ids.*' => 'exists:users,id'
        ]);

        foreach ($validated['manager_ids'] as $managerId) {
            ProjectMember::updateOrCreate(
                ['project_id' => $project->id, 'user_id' => $managerId],
                ['role' => 'manager', 'assigned_by' => auth()->id()]
            );

            // Fire event for email notification
            $assignedUser = User::find($managerId);
            if (!config('app.is_demo', true)) {
                event(new \App\Events\ProjectMemberAssigned($project, $assignedUser, auth()->user(), 'manager'));
            }
        }

        $managerNames = User::whereIn('id', $validated['manager_ids'])->pluck('name')->toArray();
        $project->logActivity('managers_assigned', "Managers '" . implode(', ', $managerNames) . "' were assigned to project");

        return back();
    }

    public function recalculateProgress(Project $project)
    {
        $this->authorizePermission('project_track_progress');

        $user = auth()->user();
        $workspace = $user->currentWorkspace;

        if (!$workspace || $project->workspace_id != $workspace->id) {
            abort(403, 'Project not found in current workspace.');
        }
        $project->updateProgressFromMilestones();
        $project->logActivity('progress_recalculated', "Project progress was recalculated to {$project->fresh()->progress}%");

        return back()->with('success', 'Project progress has been recalculated.');
    }

    public function getMembers(Project $project)
    {

        $this->authorizePermission('project_view');

        $user = auth()->user();
        $workspace = $user->currentWorkspace;

        if (!$workspace || $project->workspace_id != $workspace->id) {
            abort(403, 'Project not found in current workspace.');
        }

        // Get all project members (assigned users)
        $members = $project->members()->with('user')->get()->map(function ($member) {
            return [
                'id' => $member->user->id,
                'name' => $member->user->name,
                'email' => $member->user->email,
                'role' => $member->role
            ];
        });

        return response()->json($members);
    }
    public function updateSharedSettings(Request $request, Project $project)
    {
        $this->authorizePermission('project_manage_shared_settings');

        $user = auth()->user();
        $workspace = $user->currentWorkspace;

        if (!$workspace || $project->workspace_id != $workspace->id) {
            abort(403, 'Project not found in current workspace.');
        }

        $validated = $request->validate([
            'shared_settings' => 'required|array',
            'shared_settings.overview' => 'boolean',
            'shared_settings.member' => 'boolean',
            'shared_settings.client' => 'boolean',
            'shared_settings.milestone' => 'boolean',
            'shared_settings.notes' => 'boolean',
            'shared_settings.budget' => 'boolean',
            'shared_settings.expenses' => 'boolean',
            'shared_settings.task' => 'boolean',
            'shared_settings.recent_bugs' => 'boolean',
            'shared_settings.timesheet' => 'boolean',
            'shared_settings.files' => 'boolean',
            'shared_settings.activity' => 'boolean',

            'password' => 'nullable|string'
        ]);

        $project->update([
            'shared_settings' => $validated['shared_settings'],
            'password' => $validated['password'] ? Hash::make($validated['password']) : null,
            'updated_by' => auth()->id()
        ]);

        $project->logActivity('shared_settings_updated', "Project shared settings were updated");

        return back()->with('success', 'Shared settings updated successfully.');
    }

    public function generateShareLink(Project $project)
    {
        $this->authorizePermission('project_manage_shared_settings');

        $user = auth()->user();
        $workspace = $user->currentWorkspace;

        if (!$workspace || $project->workspace_id != $workspace->id) {
            abort(403, 'Project not found in current workspace.');
        }

        // Create encrypted project ID with timestamp for security
        $encryptedId = encrypt($project->id . ':' . $project->created_at->timestamp);

        $shareUrl = route('projects.public-view', [
            'encryptedId' => $encryptedId
        ]);

        return response()->json([
            'share_url' => $shareUrl
        ]);
    }

    public function gantt(Project $project, $duration = 'Week')
    {
        $objUser = auth()->user();
        $currentWorkspace = $objUser->currentWorkspace;

        if (!$currentWorkspace) {
            abort(404, 'Workspace not found.');
        }

        // Ensure project belongs to current workspace
        if ($project->workspace_id != $currentWorkspace->id) {
            abort(403, 'Project not found in current workspace.');
        }

        $userWorkspaceRole = $currentWorkspace->getMemberRole($objUser);

        // Access control
        if ($userWorkspaceRole !== 'owner') {
            $hasAccess = $project->members()->where('user_id', $objUser->id)->exists() ||
                $project->clients()->where('user_id', $objUser->id)->exists();

            // if (!$hasAccess) {
            //     abort(403, 'Access denied.');
            // }
        }

        $project->load(['tasks.taskStage']);

        $tasks = [];



        foreach ($project->tasks as $task) {
            $tasks[] = [
                'id' => 'task_' . $task->id,
                'name' => $task->title,
                'start' => $task->start_date,
                'end' => $task->end_date,
                'custom_class' => strtolower($task->priority),
                'progress' => $task->progress ?? 0,
                'extra' => [
                    'priority' => ucfirst($task->priority),
                    'comments' => $task->comments()->count(),
                    'duration' => $task->start_date && $task->end_date ?
                        \Carbon\Carbon::parse($task->start_date)->format('M d, Y') . ' - ' .
                        \Carbon\Carbon::parse($task->end_date)->format('M d, Y') : 'No dates set',
                ],
            ];
        }

        return Inertia::render('projects/Gantt', [
            'project' => $project,
            'tasks' => $tasks,
            'duration' => $duration,
            'permissions' => $this->getModuleCrudPermissions('project')
        ]);
    }

    public function ganttUpdate(Request $request, Project $project)
    {
        $objUser = auth()->user();
        $currentWorkspace = $objUser->currentWorkspace;

        if (!$currentWorkspace) {
            return response()->json(['is_success' => false, 'message' => 'Workspace not found'], 404);
        }

        // Ensure project belongs to current workspace
        if ($project->workspace_id != $currentWorkspace->id) {
            return response()->json(['is_success' => false, 'message' => 'Project not found in current workspace'], 403);
        }

        $userWorkspaceRole = $currentWorkspace->getMemberRole($objUser);

        // Access control
        if ($userWorkspaceRole !== 'owner') {
            $hasAccess = $project->members()->where('user_id', $objUser->id)->exists();

            if (!$hasAccess) {
                return response()->json(['is_success' => false, 'message' => 'Access denied'], 403);
            }
        }

        $taskId = str_replace('task_', '', $request->task_id);
        $task = \App\Models\Task::where('id', $taskId)
            ->where('project_id', $project->id)
            ->first();

        if (!$task) {
            return response()->json(['is_success' => false, 'message' => 'Task not found'], 404);
        }

        // Only allow owners or assigned users to update
        if ($userWorkspaceRole !== 'owner') {
            $assignedUsers = explode(',', $task->assign_to ?? '');
            if (!in_array($objUser->id, $assignedUsers)) {
                return response()->json(['is_success' => false, 'message' => 'Not authorized to update this task'], 403);
            }
        }

        $task->start_date = $request->start;
        $task->end_date = $request->end;
        $task->save();

        $task->logActivity('updated', ['description' => "Task '{$task->title}' dates updated via Gantt chart"]);

        return response()->json([
            'is_success' => true,
            'message' => 'Task dates updated successfully'
        ]);
    }

    public function publicView(Request $request, $encryptedId)
    {
        try {
            // Decrypt the encrypted ID
            $decrypted = decrypt($encryptedId);

            $parts = explode(':', $decrypted);

            if (count($parts) !== 2) {
                return redirect()->route('home')->with('error', 'Invalid share link');
            }

            $projectId = $parts[0];
            $timestamp = $parts[1];

        } catch (\Exception $e) {
            // Try to get project ID from session
            $projectId = session('last_project_id');

            // If we have a project ID in session, redirect to copylink
            if ($projectId && $project = Project::find($projectId)) {
                $newEncryptedId = encrypt($project->id . ':' . $project->created_at->timestamp);
                return redirect()->route('projects.public-view', $newEncryptedId)
                    ->with('error', 'Share link was corrupted. Redirected to valid link.');
            }

            // Fallback: redirect to home
            return redirect()->route('home')->with('error', 'Invalid share link. Please generate a new one.');
        }

        $project = Project::with([
            'workspace',
            'clients',
            'creator',
            'members.user',
            'milestones',
            'notes.creator',
            'activities.user',
            'attachments.mediaItem',
            'attachments.uploadedBy',
            'expenses.submitter'
        ])->findOrFail($projectId);

        // Load budget with computed attributes
        $budget = \App\Models\ProjectBudget::with(['categories', 'creator'])
            ->where('project_id', $project->id)
            ->first();

        if ($budget) {
            $budget->total_spent = $budget->total_spent;
            $budget->remaining_budget = $budget->remaining_budget;
            $budget->utilization_percentage = $budget->utilization_percentage;
        }

        $project->setRelation('budget', $budget);

        // Load all expenses for this project
        $expenses = \App\Models\ProjectExpense::with(['submitter', 'budgetCategory'])
            ->where('project_id', $project->id)
            ->latest()
            ->get();

        // Calculate approved expenses total
        $project->approved_expenses_total = $expenses->where('status', 'approved')->sum('amount');

        $project->setRelation('expenses', $expenses);

        // Load project tasks
        $project->tasks = \App\Models\Task::with(['taskStage', 'assignedTo', 'creator'])
            ->where('project_id', $project->id)
            ->latest()
            ->get();

        // Load project bugs
        $project->bugs = \App\Models\Bug::with(['bugStatus', 'assignedTo', 'reportedBy'])
            ->where('project_id', $project->id)
            ->latest()
            ->get();

        // Load project timesheets with detailed entries
        $timesheets = \App\Models\Timesheet::with([
            'user',
            'entries' => function ($query) use ($project) {
                $query->whereHas('task', function ($taskQuery) use ($project) {
                    $taskQuery->where('project_id', $project->id);
                });
            }
        ])
            ->whereHas('entries.task', function ($query) use ($project) {
                $query->where('project_id', $project->id);
            })
            ->latest()
            ->get()
            ->map(function ($timesheet) {
                $timesheet->total_hours = $timesheet->entries->sum('hours');
                $timesheet->billable_hours = $timesheet->entries->where('is_billable', true)->sum('hours');
                $timesheet->billable_percentage = $timesheet->total_hours > 0
                    ? round(($timesheet->billable_hours / $timesheet->total_hours) * 100)
                    : 0;
                $timesheet->entries_count = $timesheet->entries->count();
                return $timesheet;
            });

        // Calculate project totals (only submitted timesheets)
        $submittedTimesheets = $timesheets->whereIn('status', ['submitted', 'approved']);
        $project->total_project_hours = $submittedTimesheets->sum('total_hours');
        $project->total_billable_hours = $submittedTimesheets->sum('billable_hours');
        $project->billable_rate_percentage = $project->total_project_hours > 0
            ? round(($project->total_billable_hours / $project->total_project_hours) * 100)
            : 0;
        $project->total_team_members = $timesheets->pluck('user.id')->unique()->count();
        $project->approved_timesheets_count = $timesheets->where('status', 'approved')->count();
        $project->submitted_timesheets_percentage = $timesheets->count() > 0
            ? round(($submittedTimesheets->count() / $timesheets->count()) * 100)
            : 0;

        $project->setRelation('timesheets', $timesheets);

        // Process all avatars
        $project->members->each(function ($member) {
            if ($member->user) {
                $member->user->avatar = check_file($member->user->avatar)
                    ? get_file($member->user->avatar)
                    : get_file('avatars/avatar.png');
            }
        });
        $project->clients->each(function ($client) {
            if ($client) {
                $client->avatar = check_file($client->avatar)
                    ? get_file($client->avatar)
                    : get_file('avatars/avatar.png');
            }
        });
        $project->notes->each(function ($note) {
            if ($note->creator) {
                $note->creator->avatar = check_file($note->creator->avatar)
                    ? get_file($note->creator->avatar)
                    : get_file('avatars/avatar.png');
            }
        });
        $project->expenses->each(function ($expense) {
            if ($expense->submitter) {
                $expense->submitter->avatar = check_file($expense->submitter->avatar)
                    ? get_file($expense->submitter->avatar)
                    : get_file('avatars/avatar.png');
            }
        });
        $project->tasks->each(function ($task) {
            foreach (['assignedTo', 'creator'] as $relation) {
                if ($task->$relation) {
                    $task->$relation->avatar = check_file($task->$relation->avatar)
                        ? get_file($task->$relation->avatar)
                        : get_file('avatars/avatar.png');
                }
            }
        });
        $project->bugs->each(function ($bug) {
            foreach (['assignedTo', 'reportedBy'] as $relation) {
                if ($bug->$relation) {
                    $bug->$relation->avatar = check_file($bug->$relation->avatar)
                        ? get_file($bug->$relation->avatar)
                        : get_file('avatars/avatar.png');
                }
            }
        });
        $project->timesheets->each(function ($timesheet) {
            if ($timesheet->user) {
                $timesheet->user->avatar = check_file($timesheet->user->avatar)
                    ? get_file($timesheet->user->avatar)
                    : get_file('avatars/avatar.png');
            }
        });
        $project->attachments->each(function ($attachment) {
            if ($attachment->uploadedBy) {
                $attachment->uploadedBy->avatar = check_file($attachment->uploadedBy->avatar)
                    ? get_file($attachment->uploadedBy->avatar)
                    : get_file('avatars/avatar.png');
            }
        });
        $project->activities->each(function ($activity) {
            if ($activity->user) {
                $activity->user->avatar = check_file($activity->user->avatar)
                    ? get_file($activity->user->avatar)
                    : get_file('avatars/avatar.png');
            }
        });

        // Validate token timestamp matches project creation
        if ($timestamp != $project->created_at->timestamp) {
            abort(404, 'Invalid share link');
        }

        // Check if project has shared settings
        if (!$project->shared_settings) {
            abort(404, 'Project sharing is not enabled');
        }

        // Handle password protection
        if ($project->password) {
            if ($request->isMethod('post')) {
                $password = $request->input('password');
                if (!$password || !Hash::check($password, $project->password)) {
                    return back()->withErrors(['password' => 'Invalid password']);
                }
                // Store in session that password is verified
                session(['project_' . $project->id . '_verified' => true]);
            } else {
                // Check if already verified
                if (!session('project_' . $project->id . '_verified')) {
                    return Inertia::render('projects/PublicPasswordPrompt', [
                        'project' => $project,
                        'encryptedId' => $encryptedId
                    ]);
                }
            }
        }

        // Get workspace settings for theme colors
        $workspace = $project->workspace;
        $workspaceSettings = [];

        if ($workspace && $workspace->owner_id) {
            try {
                $workspaceSettings = settings($workspace->owner_id, $workspace->id);
            } catch (\Exception $e) {
                $workspaceSettings = settings();
            }
        } else {
            $workspaceSettings = settings();
        }

        // Get available languages for language switcher
        $languagesFile = resource_path('lang/language.json');
        $availableLanguages = [];
        if (file_exists($languagesFile)) {
            $availableLanguages = json_decode(file_get_contents($languagesFile), true) ?? [];
        }
        $workspaceSettings['availableLanguages'] = $availableLanguages;

        return Inertia::render('projects/copylink_setting', [
            'project' => $project,
            'encryptedId' => $encryptedId,
            'globalSettings' => $workspaceSettings
        ]);
    }




}
