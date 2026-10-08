<?php

namespace App\Http\Controllers;

use App\Models\Task;
use App\Models\CalendarEvent;
use App\Models\ZoomMeeting;
use App\Models\GoogleMeeting;
use App\Models\Project;
use App\Models\User;
use App\Traits\HasPermissionChecks;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Carbon\Carbon;

class CalendarController extends Controller
{
    use HasPermissionChecks;

    public function index(Request $request)
    {
        $this->authorizePermission('task_calendar_view');

        $user = auth()->user();
        $workspace = $user->currentWorkspace;

        if (!$workspace) {
            abort(404, __('No workspace found. Please select a workspace.'));
        }

        $events = collect();
        $userWorkspaceRole = $workspace->getMemberRole($user);

        // Get tasks
        try {
            $tasksQuery = Task::with(['project', 'assignedTo', 'taskStage'])
                ->whereHas('project', function ($q) use ($workspace) {
                    $q->where('workspace_id', $workspace->id);
                })
                ->whereNotNull('end_date');

            // Access control based on workspace role
            if ($userWorkspaceRole !== 'owner') {
                $tasksQuery->whereHas('project', function ($projectQuery) use ($user) {
                    $projectQuery->where(function ($q) use ($user) {
                        $q->whereHas('members', function ($memberQuery) use ($user) {
                            $memberQuery->where('user_id', $user->id);
                        })
                        ->orWhereHas('clients', function ($clientQuery) use ($user) {
                            $clientQuery->where('user_id', $user->id);
                        })
                        ->orWhere('created_by', $user->id);
                    });
                });

                // Filter tasks by assignment for members only (not clients)
                if ($userWorkspaceRole === 'member') {
                    $tasksQuery->where(function($taskQuery) use ($user) {
                        $taskQuery->where('assigned_to', $user->id)
                            ->orWhere('created_by', $user->id);
                    });
                }
            }

            $tasks = $tasksQuery->get()->map(function ($task) {
                return [
                    'id' => 'task-' . $task->id,
                    'title' => $task->title,
                    'start' => $task->start_date ?: $task->end_date,
                    'end' => $task->end_date,
                    'type' => 'task',
                    'backgroundColor' => '#f59e0b',
                    'borderColor' => '#d97706',
                    'task_id' => $task->id,
                    'description' => $task->description,
                    'stage' => $task->taskStage?->name ?? 'To Do',
                    'priority' => $task->priority,
                    'start_date' => $task->start_date,
                    'due_date' => $task->end_date,
                    'progress' => $task->progress ?? 0,
                    'parent_name' => $task->project?->title,
                    'project_name' => $task->project?->title,
                    'is_googlecalendar_sync' => $task->is_googlecalendar_sync ?? false
                ];
            });
            $events = $events->merge($tasks);
        } catch (\Exception $e) {
            // Skip if Task model doesn't exist
        }

        // Get zoom meetings
        try {
            $meetingsQuery = ZoomMeeting::with(['project', 'user'])
                ->forWorkspace($workspace->id);

            // Access control based on workspace role
            if ($userWorkspaceRole !== 'owner') {
                $meetingsQuery->whereHas('members', function($memberQuery) use ($user) {
                    $memberQuery->where('user_id', $user->id);
                });
            }

            $meetings = $meetingsQuery->get()->map(function ($meeting) {
                return [
                    'id' => 'meeting-' . $meeting->id,
                    'title' => $meeting->title,
                    'start' => $meeting->start_time,
                    'end' => $meeting->end_time,
                    'type' => 'meeting',
                    'backgroundColor' => '#3b82f6',
                    'borderColor' => '#2563eb',
                    'meeting_id' => $meeting->id,
                    'description' => $meeting->description,
                    'status' => $meeting->status,
                    'start_time' => $meeting->start_time,
                    'duration' => $meeting->duration,
                    'parent_name' => $meeting->project?->title,
                    'join_url' => $meeting->join_url,
                    'start_url' => $meeting->start_url,
                    'is_googlecalendar_sync' => $meeting->is_googlecalendar_sync ?? false
                ];
            });
            $events = $events->merge($meetings);
        } catch (\Exception $e) {
            // Skip if ZoomMeeting model doesn't exist
        }

        // Get google meetings
        try {
            $googleMeetingsQuery = GoogleMeeting::with(['project', 'user'])
                ->forWorkspace($workspace->id);

            // Access control based on workspace role
            if ($userWorkspaceRole !== 'owner') {
                $googleMeetingsQuery->whereHas('members', function($memberQuery) use ($user) {
                    $memberQuery->where('user_id', $user->id);
                });
            }

            $googleMeetings = $googleMeetingsQuery->get()->map(function ($meeting) {
                return [
                    'id' => 'google-meeting-' . $meeting->id,
                    'title' => $meeting->title,
                    'start' => $meeting->start_time,
                    'end' => $meeting->end_time,
                    'type' => 'google_meeting',
                    'backgroundColor' => '#10B77F',
                    'borderColor' => '#059652ff',
                    'meeting_id' => $meeting->id,
                    'description' => $meeting->description,
                    'status' => $meeting->status,
                    'start_time' => $meeting->start_time,
                    'duration' => $meeting->duration,
                    'parent_name' => $meeting->project?->title,
                    'is_googlecalendar_sync' => $meeting->is_googlecalendar_sync ?? false
                ];
            });
            $events = $events->merge($googleMeetings);
        } catch (\Exception $e) {
            // Skip if GoogleMeeting model doesn't exist
        }

        $calendarEvents = CalendarEvent::where('workspace_id', $workspace->id)
            ->get()
            ->map(function (CalendarEvent $event) {
                return [
                    'id' => 'calendar-event-' . $event->id,
                    'title' => $event->title,
                    'start' => $event->start_at,
                    'end' => $event->end_at,
                    'type' => 'calendar_event',
                    'backgroundColor' => '#8b5cf6',
                    'borderColor' => '#7c3aed',
                    'description' => $event->description,
                ];
            });
        $events = $events->merge($calendarEvents);

        // Get Google Calendar sync settings from company owner
        $companyOwner = $workspace->owner; // Get the company owner
        $googleCalendarEnabled = getSetting('is_googlecalendar_sync', '0', $companyOwner->id, $workspace->id) === '1';

        $canCreateGoogleMeet = $userWorkspaceRole === 'member'
            || $this->checkPermission('google_meeting_create');

        return Inertia::render('calendar/index', [
            'events' => $events->values()->toArray(),
            'googleCalendarEnabled' => $googleCalendarEnabled,
            'canManageEvents' => $this->canManageEvents($userWorkspaceRole),
            'canCreateGoogleMeet' => $canCreateGoogleMeet,
            'projects' => $canCreateGoogleMeet
                ? Project::forWorkspace($workspace->id)->get(['id', 'title'])
                : [],
            'members' => $canCreateGoogleMeet
                ? User::whereHas('workspaces', function ($query) use ($workspace) {
                    $query->where('workspace_id', $workspace->id)
                        ->where('status', 'active');
                })->get(['id', 'name', 'email'])
                : [],
        ]);
    }

    public function storeEvent(Request $request)
    {
        $user = auth()->user();
        $workspace = $user->currentWorkspace;

        if (!$workspace) {
            abort(404, __('No workspace found. Please select a workspace.'));
        }

        $workspaceRole = $workspace->getMemberRole($user);
        if (!$this->canManageEvents($workspaceRole)) {
            abort(403, 'You do not have permission to add calendar events.');
        }

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'start_at' => ['required', 'date'],
            'end_at' => ['required', 'date', 'after_or_equal:start_at'],
        ]);

        CalendarEvent::create([
            ...$validated,
            'workspace_id' => $workspace->id,
            'user_id' => $user->id,
        ]);

        return redirect()->route('task-calendar.index')->with('success', __('Calendar event added.'));
    }

    private function canManageEvents(?string $workspaceRole): bool
    {
        return strtolower(trim((string) $workspaceRole)) === 'member'
            || $this->checkPermission('task_calendar_manage_events');
    }

    public function getTask(Task $task)
    {
        $this->authorizePermission('task_view');

        $user = auth()->user();
        $workspace = $user->currentWorkspace;

        if (!$workspace || $task->project->workspace_id != $workspace->id) {
            abort(403, 'Task not found in current workspace.');
        }

        $task->load([
            'project',
            'taskStage',
            'assignedTo',
            'creator'
        ]);

        return response()->json([
            'task' => $task
        ]);
    }
}