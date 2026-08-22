<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Models\Task;
use App\Models\TaskStage;
use App\Models\User;
use App\Models\ProjectMilestone;
use App\Models\TimesheetEntry;
use App\Models\Workspace;
use App\Traits\HasPermissionChecks;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class ProjectReportController extends Controller
{
    use HasPermissionChecks;

    public function index(Request $request)
    {

        $user = Auth::user();
        $workspace = $user->currentWorkspace;

        if (!$workspace) {
            return redirect()->route('dashboard')->with('error', 'No workspace selected.');
        }

        $userWorkspaceRole = $workspace->getMemberRole($user);

        $query = Project::with(['workspace', 'clients', 'creator', 'members.user'])
            ->forWorkspace($user->current_workspace_id);

        // Access control based on workspace role
        if ($userWorkspaceRole === 'owner' || $user->type === 'company') {
            // Owner & company-type users: Full access to all workspace projects
        } else {
            // Non-owners: Only projects they're a member/client of or created
            $query->where(function ($q) use ($user) {
                $q->whereHas('members', function ($memberQuery) use ($user) {
                    $memberQuery->where('user_id', $user->id);
                })
                    ->orWhereHas('clients', function ($clientQuery) use ($user) {
                        $clientQuery->where('user_id', $user->id);
                    })
                    ->orWhere('created_by', $user->id);
            });
        }

        if ($request->search)
            $query->search($request->search);
        if ($request->status)
            $query->byStatus($request->status);
        if ($request->user_id)
            $query->where(function ($q) use ($request) {
                $q->whereHas('members', function ($memberQuery) use ($request) {
                    $memberQuery->where('user_id', $request->user_id);
                })
                    ->orWhereHas('clients', function ($clientQuery) use ($request) {
                        $clientQuery->where('user_id', $request->user_id);
                    });
            });

        // Date range filters
        if ($request->filled('start_from'))
            $query->where('start_date', '>=', $request->start_from);
        if ($request->filled('start_to'))
            $query->where('start_date', '<=', $request->start_to);
        if ($request->filled('deadline_from'))
            $query->where('deadline', '>=', $request->deadline_from);
        if ($request->filled('deadline_to'))
            $query->where('deadline', '<=', $request->deadline_to);
        // Filter projects that contain a specific milestone title
        if ($request->filled('milestone_search'))
            $query->whereHas('milestones', fn($q) => $q->where('title', 'like', '%' . $request->milestone_search . '%'));

        // Add sorting
        $sortBy = $request->get('sort_by', 'created_at');
        $sortOrder = $request->get('sort_order', 'desc');
        
        // Validate sort fields
        $allowedSortFields = ['title', 'name', 'status', 'created_at', 'start_date', 'deadline'];
        if (!in_array($sortBy, $allowedSortFields)) {
            $sortBy = 'created_at';
        }
        
        if (!in_array($sortOrder, ['asc', 'desc'])) {
            $sortOrder = 'desc';
        }

        $perPage = in_array($request->get('per_page', 10), [10, 25, 50, 100]) ? $request->get('per_page', 10) : 10;
        $projects = $query->orderBy($sortBy, $sortOrder)->paginate($perPage);

        // Transform member and client avatars
        $projects->getCollection()->transform(function ($project) {
            $project->members->transform(function ($member) {
                if ($member->user) {
                    $member->user->avatar = check_file($member->user->avatar)
                        ? get_file($member->user->avatar)
                        : get_file('avatars/avatar.png');
                }
                return $member;
            });
            $project->clients->transform(function ($client) {
                $client->avatar = check_file($client->avatar)
                    ? get_file($client->avatar)
                    : get_file('avatars/avatar.png');
                return $client;
            });
            return $project;
        });

        $users = User::whereHas('workspaces', function ($q) use ($workspace) {
            $q->where('workspace_id', $workspace->id)->where('status', 'active');
        })->get();

        return Inertia::render('project-reports/Index', [
            'projects' => $projects,
            'users' => $users,
            'filters' => $request->only(['search', 'status', 'user_id', 'per_page', 'sort_by', 'sort_order', 'start_from', 'start_to', 'deadline_from', 'deadline_to', 'milestone_search']),
            'userWorkspaceRole' => $userWorkspaceRole,
        ]);
    }

    public function show(Project $project)
    {
        $this->authorizePermission('project_report_view_any');

        $user = Auth::user();
        $workspace = $user->currentWorkspace;

        // Get project with relationships
        $project->load(['members', 'clients', 'milestones', 'tasks.taskStage', 'tasks.members']);

        // Calculate project statistics
        $stats = $this->calculateProjectStats($project);

        // Calculate user statistics
        $userStats = $this->calculateUserStats($project);

        // Get chart data
        $chartData = $this->getProjectChartData($project, $workspace);

        // Get workspace users and stages for filtering
        $users = $workspace->members()->with('user')->get();
        $stages = TaskStage::where('workspace_id', $workspace->id)->orderBy('order')->get();

        // Get initial tasks data
        $initialTasksQuery = Task::where('project_id', $project->id)
            ->with(['taskStage', 'members.user', 'milestone', 'assignedUser'])
            ->limit(10);

        $initialTasks = $initialTasksQuery->get()->map(function ($task) {
            $loggedHours = TimesheetEntry::where('task_id', $task->id)->sum('hours');

            // Get assigned users
            $assignedUsers = collect();
            if ($task->assignedUser) {
                $assignedUsers->push($task->assignedUser);
            }
            if ($task->members && $task->members->count() > 0) {
                $assignedUsers = $assignedUsers->merge($task->members->pluck('user')->filter());
            }
            $assignedUsers = $assignedUsers->unique('id');

            return [
                'id' => $task->id,
                'title' => $task->title,
                'name' => $task->title,
                'description' => $task->description,
                'start_date' => $task->start_date,
                'due_date' => $task->end_date,
                'end_date' => $task->end_date,
                'priority' => $task->priority ?: 'medium',
                'status' => $task->taskStage ? $task->taskStage->name : 'To Do',
                'stage' => $task->taskStage ? $task->taskStage->name : 'To Do',
                'task_stage' => $task->taskStage ? [
                    'id' => $task->taskStage->id,
                    'name' => $task->taskStage->name,
                    'color' => $task->taskStage->color
                ] : null,
                'milestone' => $task->milestone ? [
                    'id' => $task->milestone->id,
                    'title' => $task->milestone->title
                ] : null,
                'milestone_title' => $task->milestone ? $task->milestone->title : null,
                'assigned_users' => $assignedUsers->map(function ($user) {
                    return [
                        'id' => $user->id,
                        'name' => $user->name,
                        'avatar' => check_file($user->avatar) ? get_file($user->avatar) : get_file('avatars/avatar.png'),
                        'user' => ['name' => $user->name]
                    ];
                })->values(),
                'logged_hours' => round($loggedHours, 2),
                'total_logged_hours' => round($loggedHours, 2),
                'progress' => $task->progress ?: 0,
                'estimated_hours' => $task->estimated_hours ?: 0,
            ];
        });

        return Inertia::render('project-reports/Show', [
            'project' => $project,
            'stats' => $stats,
            'userStats' => $userStats,
            'chartData' => $chartData,
            'users' => $users,
            'stages' => $stages,
            'workspace' => $workspace,
            'tasks' => [
                'data' => $initialTasks,
                'total' => Task::where('project_id', $project->id)->count()
            ],
            'filters' => request()->only(['search', 'user_id', 'status', 'priority', 'milestone_id', 'per_page'])
        ]);
    }

    public function getTasksData(Request $request, Project $project)
    {
        $this->authorizePermission('project_report_view_any');

        $tasksQuery = Task::where('project_id', $project->id)
            ->with(['taskStage', 'members.user', 'milestone', 'assignedUser']);

        // Apply search filter
        if ($request->filled('search')) {
            $tasksQuery->where(function ($query) use ($request) {
                $query->where('title', 'like', '%' . $request->search . '%')
                    ->orWhere('description', 'like', '%' . $request->search . '%');
            });
        }

        // Apply filters
        if ($request->filled('user_id') && $request->user_id !== 'all') {
            $tasksQuery->where(function ($query) use ($request) {
                $query->where('assigned_to', $request->user_id)
                    ->orWhereHas('members', function ($memberQuery) use ($request) {
                        $memberQuery->where('user_id', $request->user_id);
                    });
            });
        }

        if ($request->filled('status') && $request->status !== 'all') {
            $tasksQuery->whereHas('taskStage', function ($query) use ($request) {
                $query->where('name', $request->status);
            });
        }

        if ($request->filled('priority') && $request->priority !== 'all') {
            $tasksQuery->where('priority', $request->priority);
        }

        if ($request->filled('milestone_id') && $request->milestone_id !== 'all') {
            $tasksQuery->where('milestone_id', $request->milestone_id);
        }

        // Date range filters on task start_date / end_date
        if ($request->filled('date_from'))
            $tasksQuery->where(fn($q) => $q->where('start_date', '>=', $request->date_from)->orWhere('end_date', '>=', $request->date_from));
        if ($request->filled('date_to'))
            $tasksQuery->where(fn($q) => $q->where('start_date', '<=', $request->date_to)->orWhere('end_date', '<=', $request->date_to));

        // Pagination
        $perPage = $request->get('per_page', 10);
        $tasks = $tasksQuery->paginate($perPage);

        // Transform tasks data
        $transformedTasks = $tasks->getCollection()->map(function ($task) {
            $loggedHours = TimesheetEntry::where('task_id', $task->id)->sum('hours');

            // Get assigned users
            $assignedUsers = collect();
            if ($task->assignedUser) {
                $assignedUsers->push($task->assignedUser);
            }
            if ($task->members && $task->members->count() > 0) {
                $assignedUsers = $assignedUsers->merge($task->members->pluck('user')->filter());
            }
            $assignedUsers = $assignedUsers->unique('id');

            return [
                'id' => $task->id,
                'title' => $task->title,
                'name' => $task->title, // Alias for compatibility
                'description' => $task->description,
                'start_date' => $task->start_date,
                'due_date' => $task->end_date,
                'end_date' => $task->end_date, // Alias for compatibility
                'priority' => $task->priority ?: 'medium',
                'status' => $task->taskStage ? $task->taskStage->name : 'To Do',
                'stage' => $task->taskStage ? $task->taskStage->name : 'To Do',
                'task_stage' => $task->taskStage ? [
                    'id' => $task->taskStage->id,
                    'name' => $task->taskStage->name,
                    'color' => $task->taskStage->color
                ] : null,
                'milestone' => $task->milestone ? [
                    'id' => $task->milestone->id,
                    'title' => $task->milestone->title
                ] : null,
                'milestone_title' => $task->milestone ? $task->milestone->title : null,
                'assigned_users' => $assignedUsers->map(function ($user) {
                    return [
                        'id' => $user->id,
                        'name' => $user->name,
                        'avatar' => check_file($user->avatar) ? get_file($user->avatar) : get_file('avatars/avatar.png'),
                        'user' => ['name' => $user->name] // For compatibility
                    ];
                })->values(),
                'assignees' => $assignedUsers->pluck('name')->join(', '),
                'logged_hours' => round($loggedHours, 2),
                'total_logged_hours' => round($loggedHours, 2),
                'is_completed' => $task->progress >= 100,
                'progress' => $task->progress ?: 0,
                'estimated_hours' => $task->estimated_hours ?: 0,
                'created_at' => $task->created_at,
                'updated_at' => $task->updated_at,
            ];
        });

        // Replace the collection in the paginator
        $tasks->setCollection($transformedTasks);

        return response()->json([
            'data' => $transformedTasks,
            'pagination' => [
                'current_page' => $tasks->currentPage(),
                'last_page' => $tasks->lastPage(),
                'per_page' => $tasks->perPage(),
                'total' => $tasks->total(),
                'from' => $tasks->firstItem(),
                'to' => $tasks->lastItem(),
            ]
        ]);
    }

    public function export(Project $project)
    {
        $this->authorizePermission('project_report_view_any');

        $project->load(['members', 'clients', 'milestones', 'tasks.taskStage', 'tasks.members']);
        $stats = $this->calculateProjectStats($project);
        $userStats = $this->calculateUserStats($project);
        $tasks = Task::where('project_id', $project->id)->with(['taskStage', 'members', 'milestone', 'assignedUser'])->get();

        $completionPercentage = $stats['completion_percentage'] ?? 0;

        // Generate high-quality circular progress chart
        $size = 600; // Larger = sharper in PDF at 200dpi
        $centerX = $size / 2;
        $centerY = $size / 2;
        $outerRadius = 160;
        $innerRadius = 140;

        $image = imagecreatetruecolor($size, $size);
        imageantialias($image, true);
        imagesavealpha($image, true);
        $transparent = imagecolorallocatealpha($image, 0, 0, 0, 127);
        imagefill($image, 0, 0, $transparent);

        // Resolve primary color early for GD charts
        $themeColorMap = [
            'blue'   => '#3b82f6',
            'green'  => '#10B77F',
            'purple' => '#8b5cf6',
            'orange' => '#f97316',
            'red'    => '#ef4444',
        ];
        $exportUser = Auth::user();
        $exportWorkspace = $exportUser->currentWorkspace;
        $exportOwnerId = $exportWorkspace->owner_id ?? $exportUser->id;
        $exportThemeColor  = \App\Models\Setting::where('user_id', $exportOwnerId)->where('workspace_id', $exportWorkspace->id)->where('key', 'themeColor')->value('value') ?? 'green';
        $exportCustomColor = \App\Models\Setting::where('user_id', $exportOwnerId)->where('workspace_id', $exportWorkspace->id)->where('key', 'customColor')->value('value') ?? '#10B77F';
        $primaryHex = $exportThemeColor === 'custom' ? $exportCustomColor : ($themeColorMap[$exportThemeColor] ?? '#10B77F');
        $primaryHex = ltrim($primaryHex, '#');
        $pr = hexdec(substr($primaryHex, 0, 2));
        $pg = hexdec(substr($primaryHex, 2, 2));
        $pb = hexdec(substr($primaryHex, 4, 2));

        $gray = imagecolorallocate($image, 229, 231, 235);
        $orange = imagecolorallocate($image, $pr, $pg, $pb);
        $black = imagecolorallocate($image, 31, 41, 55);
        $white = imagecolorallocate($image, 255, 255, 255);

        // Draw background donut (gray) - full circle
        imagefilledellipse($image, $centerX, $centerY, $outerRadius * 2, $outerRadius * 2, $gray);
        imagefilledellipse($image, $centerX, $centerY, $innerRadius * 2, $innerRadius * 2, $white);

        // Draw progress arc (orange) on top
        if ($completionPercentage > 0) {
            $endAngle = ($completionPercentage / 100) * 360;
            imagefilledarc($image, $centerX, $centerY, $outerRadius * 2, $outerRadius * 2, -90, -90 + $endAngle, $orange, IMG_ARC_PIE);
            imagefilledellipse($image, $centerX, $centerY, $innerRadius * 2, $innerRadius * 2, $white);

            // Add rounded caps at start and end of arc
            $capRadius = ($outerRadius - $innerRadius) / 2;
            $ringRadius = ($outerRadius + $innerRadius) / 2;

            // Start cap (top)
            $startX = $centerX;
            $startY = $centerY - $ringRadius;
            imagefilledellipse($image, $startX, $startY, $capRadius * 2, $capRadius * 2, $orange);

            // End cap
            $endAngleRad = deg2rad(-90 + $endAngle);
            $endX = $centerX + ($ringRadius * cos($endAngleRad));
            $endY = $centerY + ($ringRadius * sin($endAngleRad));
            imagefilledellipse($image, $endX, $endY, $capRadius * 2, $capRadius * 2, $orange);
        }

        // Add percentage text - draw directly at larger size
        $text = $completionPercentage . '%';

        // Try to use TrueType font if available
        $fontPath = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
        if (file_exists($fontPath)) {
            $fontSize = 48;
            $bbox = imagettfbbox($fontSize, 0, $fontPath, $text);
            $textWidth = $bbox[2] - $bbox[0];
            $textHeight = $bbox[1] - $bbox[7];
            $textX = $centerX - ($textWidth / 2);
            $textY = $centerY + ($textHeight / 2);
            imagettftext($image, $fontSize, 0, $textX, $textY, $black, $fontPath, $text);
        } else {
            // Fallback: draw larger with GD font
            $font = 5;
            $scale = 6;
            $charWidth = imagefontwidth($font);
            $charHeight = imagefontheight($font);

            foreach (str_split($text) as $i => $char) {
                $charImg = imagecreatetruecolor($charWidth, $charHeight);
                $bg = imagecolorallocate($charImg, 255, 255, 255);
                $fg = imagecolorallocate($charImg, 31, 41, 55);
                imagefill($charImg, 0, 0, $bg);
                imagechar($charImg, $font, 0, 0, $char, $fg);

                $scaledWidth = $charWidth * $scale;
                $scaledHeight = $charHeight * $scale;
                $totalWidth = strlen($text) * $scaledWidth;
                $startX = $centerX - ($totalWidth / 2);
                $charX = $startX + ($i * $scaledWidth);
                $charY = $centerY - ($scaledHeight / 2);

                imagecopyresampled($image, $charImg, $charX, $charY, 0, 0, $scaledWidth, $scaledHeight, $charWidth, $charHeight);
                imagedestroy($charImg);
            }
        }

        ob_start();
        imagepng($image);
        $imageData = ob_get_clean();
        imagedestroy($image);

        $base64Image = base64_encode($imageData);

        // Generate milestone arc chart (semicircle like overview)
        $milestonePercentage = $stats['milestone_completion_percentage'] ?? 0;
        $arcSize = 400;
        $arcHeight = 210;
        $arcImage = imagecreatetruecolor($arcSize, $arcHeight);
        imagesavealpha($arcImage, true);
        $arcTransparent = imagecolorallocatealpha($arcImage, 0, 0, 0, 127);
        imagefill($arcImage, 0, 0, $arcTransparent);

        $arcGray = imagecolorallocate($arcImage, 229, 231, 235);
        $arcGreen = imagecolorallocate($arcImage, $pr, $pg, $pb);
        $arcBlack = imagecolorallocate($arcImage, 31, 41, 55);
        $arcWhite = imagecolorallocate($arcImage, 255, 255, 255);

        $arcCenterX = $arcSize / 2;
        $arcCenterY = $arcHeight;
        $arcOuterRadius = 160;
        $arcInnerRadius = 140;

        // Draw gray background donut
        imagefilledellipse($arcImage, $arcCenterX, $arcCenterY, $arcOuterRadius * 2, $arcOuterRadius * 2, $arcGray);
        imagefilledellipse($arcImage, $arcCenterX, $arcCenterY, $arcInnerRadius * 2, $arcInnerRadius * 2, $arcWhite);

        // Draw green progress arc
        if ($milestonePercentage > 0) {
            $arcEndAngle = 180 + ($milestonePercentage / 100) * 180;
            imagefilledarc($arcImage, $arcCenterX, $arcCenterY, $arcOuterRadius * 2, $arcOuterRadius * 2, 180, $arcEndAngle, $arcGreen, IMG_ARC_PIE);
            imagefilledellipse($arcImage, $arcCenterX, $arcCenterY, $arcInnerRadius * 2, $arcInnerRadius * 2, $arcWhite);

            // Add rounded caps
            $capRadius = ($arcOuterRadius - $arcInnerRadius) / 2;
            $ringRadius = ($arcOuterRadius + $arcInnerRadius) / 2;

            imagefilledellipse($arcImage, $arcCenterX - $ringRadius, $arcCenterY, $capRadius * 2, $capRadius * 2, $arcGreen);

            $capRad = deg2rad($arcEndAngle);
            $capX = $arcCenterX + ($ringRadius * cos($capRad));
            $capY = $arcCenterY + ($ringRadius * sin($capRad));
            imagefilledellipse($arcImage, $capX, $capY, $capRadius * 2, $capRadius * 2, $arcGreen);
        }

        // Add text in center
        $fontPath = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
        if (file_exists($fontPath)) {
            // Percentage text
            $percentText = $milestonePercentage . '%';
            $bbox = imagettfbbox(32, 0, $fontPath, $percentText);
            $textWidth = $bbox[2] - $bbox[0];
            imagettftext($arcImage, 32, 0, $arcCenterX - ($textWidth / 2), $arcCenterY - 50, $arcBlack, $fontPath, $percentText);

            // Progress label
            $progressText = 'Progress';
            $bbox2 = imagettfbbox(18, 0, $fontPath, $progressText);
            $textWidth2 = $bbox2[2] - $bbox2[0];
            imagettftext($arcImage, 18, 0, $arcCenterX - ($textWidth2 / 2), $arcCenterY - 15, $arcGreen, $fontPath, $progressText);
        }

        ob_start();
        imagepng($arcImage);
        $arcImageData = ob_get_clean();
        imagedestroy($arcImage);

        $base64ArcImage = base64_encode($arcImageData);

        // Generate Task Priority bar chart
        $priorityStats = $stats['priority_stats'] ?? [];
        $priorityImage = imagecreatetruecolor(450, 180);
        imagesavealpha($priorityImage, true);
        $priorityTransparent = imagecolorallocatealpha($priorityImage, 0, 0, 0, 127);
        imagefill($priorityImage, 0, 0, $priorityTransparent);

        $priorityColors = [
            'critical' => imagecolorallocate($priorityImage, 220, 38, 38),
            'high' => imagecolorallocate($priorityImage, 234, 88, 12),
            'medium' => imagecolorallocate($priorityImage, 202, 138, 4),
            'low' => imagecolorallocate($priorityImage, $pr, $pg, $pb)
        ];
        $textColor = imagecolorallocate($priorityImage, 0, 0, 0);
        $axisColor = imagecolorallocate($priorityImage, 200, 200, 200);

        $maxValue = max(array_merge([1], array_values($priorityStats)));
        $barWidth = 50;
        $barSpacing = 25;
        $startX = 60;
        $chartHeight = 110;
        $baseY = 140;

        // Draw axis
        imageline($priorityImage, 45, $baseY, 300, $baseY, $axisColor);
        imageline($priorityImage, 45, 30, 45, $baseY, $axisColor);

        // Draw Y-axis labels
        if (file_exists($fontPath)) {
            for ($i = 0; $i <= $maxValue; $i++) {
                $y = $baseY - (($i / $maxValue) * $chartHeight);
                imagettftext($priorityImage, 10, 0, 25, $y + 4, $textColor, $fontPath, $i);
                imageline($priorityImage, 43, $y, 47, $y, $axisColor);
            }
        }

        $i = 0;
        foreach (['critical', 'high', 'medium', 'low'] as $priority) {
            $value = $priorityStats[$priority] ?? 0;
            $barHeight = $maxValue > 0 ? ($value / $maxValue) * $chartHeight : 0;
            $x = $startX + ($i * ($barWidth + $barSpacing));
            $y = $baseY - $barHeight;

            imagefilledrectangle($priorityImage, $x, $y, $x + $barWidth, $baseY, $priorityColors[$priority]);

            if (file_exists($fontPath)) {
                imagettftext($priorityImage, 12, 0, $x + 18, $y - 8, $textColor, $fontPath, $value);
            }
            $i++;
        }

        // Add legend on right side with space
        if (file_exists($fontPath)) {
            $legendX = 370;
            $legendY = 50;
            foreach (['critical', 'high', 'medium', 'low'] as $priority) {
                imagefilledrectangle($priorityImage, $legendX, $legendY, $legendX + 12, $legendY + 12, $priorityColors[$priority]);
                imagettftext($priorityImage, 11, 0, $legendX + 20, $legendY + 10, $textColor, $fontPath, ucfirst($priority));
                $legendY += 26;
            }
        }

        ob_start();
        imagepng($priorityImage);
        $priorityImageData = ob_get_clean();
        imagedestroy($priorityImage);
        $base64PriorityImage = base64_encode($priorityImageData);

        // Generate Task Status pie chart
        $statusStats = $stats['status_stats'] ?? [];
        $statusImage = imagecreatetruecolor(450, 220);
        imagesavealpha($statusImage, true);
        $statusTransparent = imagecolorallocatealpha($statusImage, 0, 0, 0, 127);
        imagefill($statusImage, 0, 0, $statusTransparent);

        $statusColorMap = [
            'To Do' => imagecolorallocate($statusImage, 107, 114, 128),
            'In Progress' => imagecolorallocate($statusImage, 59, 130, 246),
            'Review' => imagecolorallocate($statusImage, 168, 85, 247),
            'Done' => imagecolorallocate($statusImage, 34, 197, 94),
            'Blocked' => imagecolorallocate($statusImage, 239, 68, 68)
        ];
        $textColor = imagecolorallocate($statusImage, 0, 0, 0);
        $whiteColor = imagecolorallocate($statusImage, 255, 255, 255);

        $total = array_sum($statusStats);
        if ($total > 0) {
            $startAngle = 0;
            $centerX = 110;
            $centerY = 110;
            $radius = 85;

            foreach ($statusStats as $status => $count) {
                $angle = ($count / $total) * 360;
                $color = $statusColorMap[$status] ?? imagecolorallocate($statusImage, 150, 150, 150);
                imagefilledarc($statusImage, $centerX, $centerY, $radius * 2, $radius * 2, $startAngle, $startAngle + $angle, $color, IMG_ARC_PIE);

                // Add percentage on slice
                if ($angle > 10 && file_exists($fontPath)) {
                    $percentage = round(($count / $total) * 100);
                    $labelAngle = deg2rad($startAngle + ($angle / 2));
                    $labelX = $centerX + (cos($labelAngle) * $radius * 0.65);
                    $labelY = $centerY + (sin($labelAngle) * $radius * 0.65);
                    imagettftext($statusImage, 11, 0, $labelX - 12, $labelY + 5, $whiteColor, $fontPath, $percentage . '%');
                }

                $startAngle += $angle;
            }

            // Add legend on right side with space (status names only)
            if (file_exists($fontPath)) {
                $legendX = 250;
                $legendY = 40;
                foreach ($statusStats as $status => $count) {
                    $color = $statusColorMap[$status] ?? imagecolorallocate($statusImage, 150, 150, 150);

                    imagefilledellipse($statusImage, $legendX, $legendY, 12, 12, $color);
                    imagettftext($statusImage, 11, 0, $legendX + 20, $legendY + 5, $textColor, $fontPath, $status);
                    $legendY += 28;
                }
            }
        }

        ob_start();
        imagepng($statusImage);
        $statusImageData = ob_get_clean();
        imagedestroy($statusImage);
        $base64StatusImage = base64_encode($statusImageData);

        // Generate Hours Estimation bar chart
        $taskHoursData = $stats['task_hours_data'] ?? [];
        $totalLoggedHours = $stats['total_logged_hours'] ?? 0;

        // Canvas dimensions with generous left margin for Y-axis labels
        $imgW = 900;
        $imgH = 320;
        $marginLeft = 70;   // space for Y-axis labels
        $marginRight = 30;
        $marginTop = 30;
        $marginBottom = 90; // space for X-axis labels
        $chartW = $imgW - $marginLeft - $marginRight;
        $chartH = $imgH - $marginTop - $marginBottom;
        $baseY = $marginTop + $chartH;

        $hoursImage = imagecreatetruecolor($imgW, $imgH);
        // White background so the PNG renders correctly inside DomPDF
        $whiteColor   = imagecolorallocate($hoursImage, 255, 255, 255);
        imagefill($hoursImage, 0, 0, $whiteColor);

        $primaryColor = imagecolorallocate($hoursImage, $pr, $pg, $pb);
        $textColor    = imagecolorallocate($hoursImage, 55, 65, 81);
        $axisColor    = imagecolorallocate($hoursImage, 209, 213, 219);
        $gridColor    = imagecolorallocate($hoursImage, 229, 231, 235);

        $hasHoursData = count($taskHoursData) > 0 && max(array_column($taskHoursData, 'logged_hours')) > 0;

        if ($hasHoursData) {
            $displayTasks = array_slice($taskHoursData, 0, 6);
            $count = count($displayTasks);
            $maxHours = max(array_merge([1], array_column($displayTasks, 'logged_hours')));

            // Round maxHours up to a nice step
            $step = max(1, ceil($maxHours / 5));
            $maxHours = $step * ceil($maxHours / $step);

            // Draw horizontal grid lines + Y-axis labels
            if (file_exists($fontPath)) {
                for ($i = 0; $i <= $maxHours; $i += $step) {
                    $y = $baseY - (($i / $maxHours) * $chartH);
                    // Grid line
                    imageline($hoursImage, $marginLeft, (int)$y, $imgW - $marginRight, (int)$y, $i === 0 ? $axisColor : $gridColor);
                    // Label — right-aligned before the axis
                    $label = (string)$i;
                    $bbox = imagettfbbox(9, 0, $fontPath, $label);
                    $lw = $bbox[2] - $bbox[0];
                    imagettftext($hoursImage, 9, 0, $marginLeft - $lw - 6, (int)$y + 4, $textColor, $fontPath, $label);
                }
            }

            // Draw vertical axis line
            imageline($hoursImage, $marginLeft, $marginTop, $marginLeft, $baseY, $axisColor);

            // Bar layout
            $totalBarArea = $chartW / $count;
            $barWidth = (int)($totalBarArea * 0.55);
            $barGap = $totalBarArea - $barWidth;

            foreach ($displayTasks as $index => $taskData) {
                $hours = $taskData['logged_hours'];
                $barH = $maxHours > 0 ? ($hours / $maxHours) * $chartH : 0;
                $x = $marginLeft + ($index * $totalBarArea) + ($barGap / 2);
                $y = $baseY - $barH;

                // Bar with rounded top feel (draw a filled rect)
                imagefilledrectangle($hoursImage, (int)$x, (int)$y, (int)($x + $barWidth), $baseY, $primaryColor);

                // Value label above bar
                if (file_exists($fontPath) && $hours > 0) {
                    $valLabel = $hours . 'h';
                    $bbox = imagettfbbox(9, 0, $fontPath, $valLabel);
                    $lw = $bbox[2] - $bbox[0];
                    imagettftext($hoursImage, 9, 0, (int)($x + $barWidth / 2 - $lw / 2), (int)$y - 5, $textColor, $fontPath, $valLabel);
                }

                // X-axis task name (word-wrapped)
                if (file_exists($fontPath)) {
                    $taskName = $taskData['task_name'];
                    $words = explode(' ', $taskName);
                    $lines = [];
                    $currentLine = '';
                    foreach ($words as $word) {
                        $test = $currentLine === '' ? $word : $currentLine . ' ' . $word;
                        $bbox = imagettfbbox(8, 0, $fontPath, $test);
                        if (($bbox[2] - $bbox[0]) > $barWidth + 20 && $currentLine !== '') {
                            $lines[] = $currentLine;
                            $currentLine = $word;
                        } else {
                            $currentLine = $test;
                        }
                    }
                    if ($currentLine !== '') $lines[] = $currentLine;

                    $lineH = 13;
                    $startLabelY = $baseY + 14;
                    foreach ($lines as $li => $line) {
                        $bbox = imagettfbbox(8, 0, $fontPath, $line);
                        $lw = $bbox[2] - $bbox[0];
                        imagettftext($hoursImage, 8, 0, (int)($x + $barWidth / 2 - $lw / 2), $startLabelY + ($li * $lineH), $textColor, $fontPath, $line);
                    }
                }
            }

            // Legend + total
            if (file_exists($fontPath)) {
                $legendY = $imgH - 18;
                imagefilledrectangle($hoursImage, $marginLeft, $legendY - 8, $marginLeft + 12, $legendY, $primaryColor);
                imagettftext($hoursImage, 9, 0, $marginLeft + 18, $legendY, $textColor, $fontPath, 'Logged Hours');
                $totalLabel = 'Total: ' . $totalLoggedHours . 'h';
                $bbox = imagettfbbox(9, 0, $fontPath, $totalLabel);
                $lw = $bbox[2] - $bbox[0];
                imagettftext($hoursImage, 9, 0, $imgW - $marginRight - $lw, $legendY, $textColor, $fontPath, $totalLabel);
            }
        } else {
            // No hours data — render a simple "No hours logged" placeholder
            $grayColor = imagecolorallocate($hoursImage, 156, 163, 175);
            imageline($hoursImage, $marginLeft, $baseY, $imgW - $marginRight, $baseY, $axisColor);
            imageline($hoursImage, $marginLeft, $marginTop, $marginLeft, $baseY, $axisColor);
            if (file_exists($fontPath)) {
                $msg = 'No hours logged for this project yet.';
                $bbox = imagettfbbox(13, 0, $fontPath, $msg);
                $mx = (int)(($imgW - ($bbox[2] - $bbox[0])) / 2);
                $my = (int)($marginTop + $chartH / 2);
                imagettftext($hoursImage, 13, 0, $mx, $my, $grayColor, $fontPath, $msg);
            }
        }

        ob_start();
        imagepng($hoursImage);
        $hoursImageData = ob_get_clean();
        imagedestroy($hoursImage);
        $base64HoursImage = base64_encode($hoursImageData);

        $projectStatusColors = [
            'planning'    => ['bg' => '#dbeafe', 'color' => '#1e40af'],
            'on_hold'     => ['bg' => '#fef3c7', 'color' => '#92400e'],
            'in_progress' => ['bg' => '#fed7aa', 'color' => '#c2410c'],
            'completed'   => ['bg' => '#dcfce7', 'color' => '#166534'],
            'cancelled'   => ['bg' => '#fecaca', 'color' => '#dc2626'],
        ];
        $statusStyle = $projectStatusColors[$project->status] ?? ['bg' => '#f3f4f6', 'color' => '#374151'];
        $projectStatusText = ucfirst(str_replace('_', ' ', $project->status));

        // Resolve primary color from workspace settings
        $themeColorMap = [
            'blue'   => '#3b82f6',
            'green'  => '#10B77F',
            'purple' => '#8b5cf6',
            'orange' => '#f97316',
            'red'    => '#ef4444',
        ];
        $user = Auth::user();
        $workspace = $user->currentWorkspace;
        $ownerId = $workspace->owner_id ?? $user->id;
        $themeColor  = \App\Models\Setting::where('user_id', $ownerId)->where('workspace_id', $workspace->id)->where('key', 'themeColor')->value('value') ?? 'green';
        $customColor = \App\Models\Setting::where('user_id', $ownerId)->where('workspace_id', $workspace->id)->where('key', 'customColor')->value('value') ?? '#10B77F';
        $primaryColor = $themeColor === 'custom' ? $customColor : ($themeColorMap[$themeColor] ?? '#10B77F');

        $html = view('pdf.project-report', compact(
            'project',
            'stats',
            'userStats',
            'tasks',
            'base64Image',
            'base64ArcImage',
            'base64PriorityImage',
            'base64StatusImage',
            'base64HoursImage',
            'statusStyle',
            'projectStatusText',
            'primaryColor'
        ))->render();

        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadHTML($html)
            ->setPaper('a4', 'landscape')
            ->setOptions([
                'dpi'                    => 96,   // keep px→pt correct; chart PNG sizes handle crispness
                'defaultFont'            => 'DejaVu Sans',
                'isHtml5ParserEnabled'   => true,
                'isRemoteEnabled'        => false,
                'isFontSubsettingEnabled'=> true,
            ]);

        return $pdf->download('project_report_' . ($project->title ?: $project->name) . '_' . date('Y-m-d') . '.pdf');
    }

    private function calculateProjectStats($project)
    {
        $this->authorizePermission('project_report_view_any');

        $totalTasks = $project->tasks()->count();
        $completedTasks = $project->tasks()->where('progress', 100)->count();

        $totalMilestones = $project->milestones()->count();
        $completedMilestones = $project->milestones()->where('status', 'completed')->count();
        // Calculate logged hours from timesheet entries
        $totalLoggedHours = TimesheetEntry::whereIn('task_id', $project->tasks()->pluck('id'))->sum('hours');



        // Task priority distribution
        $priorityStats = $project->tasks()
            ->select('priority', DB::raw('count(*) as count'))
            ->groupBy('priority')
            ->pluck('count', 'priority')
            ->toArray();

        // Task status distribution
        $statusStats = $project->tasks()
            ->join('task_stages', 'tasks.task_stage_id', '=', 'task_stages.id')
            ->select('task_stages.name', DB::raw('count(*) as count'))
            ->groupBy('task_stages.name')
            ->pluck('count', 'name')
            ->toArray();

        // Get task-wise hours data for chart
        $taskHoursData = [];
        foreach ($project->tasks as $task) {
            $taskLogged = TimesheetEntry::where('task_id', $task->id)->sum('hours');

            $taskHoursData[] = [
                'task_name' => $task->title,
                'logged_hours' => round($taskLogged, 2)
            ];
        }

        $milestoneProgress = $totalMilestones > 0 ? ($completedMilestones / $totalMilestones) * 100 : 0;

        return [
            'total_tasks' => $totalTasks,
            'completed_tasks' => $completedTasks,
            'completion_percentage' => $project->progress ?? 0,
            'total_milestones' => $totalMilestones,
            'completed_milestones' => $completedMilestones,
            'milestone_completion_percentage' => round($milestoneProgress, 2),
            'total_logged_hours' => round($totalLoggedHours, 2),
            'priority_stats' => $priorityStats,
            'status_stats' => $statusStats,
            'task_hours_data' => $taskHoursData,
            'days_left' => $project->end_date ? \Carbon\Carbon::now()->diffInDays(\Carbon\Carbon::parse($project->end_date), false) : null,
        ];
    }

    private function getProjectChartData($project, $workspace)
    {
        $this->authorizePermission('project_report_view_any');

        // Get last 7 days of task updates
        $dates = collect();
        for ($i = 6; $i >= 0; $i--) {
            $dates->push(\Carbon\Carbon::now()->subDays($i)->format('Y-m-d'));
        }

        $stages = TaskStage::where('workspace_id', $workspace->id)->orderBy('order')->get();

        $chartData = [
            'labels' => $dates->map(function ($date) {
                return \Carbon\Carbon::parse($date)->format('M d');
            })->toArray(),
            'datasets' => [],
        ];

        foreach ($stages as $stage) {
            $data = $dates->map(function ($date) use ($project, $stage) {
                return Task::where('project_id', $project->id)
                    ->where('task_stage_id', $stage->id)
                    ->whereDate('updated_at', $date)
                    ->count();
            })->toArray();

            $chartData['datasets'][] = [
                'label' => $stage->name,
                'data' => $data,
                'backgroundColor' => $stage->color ?? '#3B82F6',
                'borderColor' => $stage->color ?? '#3B82F6',
            ];
        }

        return $chartData;
    }

    public function milestoneReport(Request $request)
    {
        $this->authorizePermission('project_report_view_any');

        $user = Auth::user();
        $workspace = $user->currentWorkspace;

        if (!$workspace) {
            return redirect()->route('dashboard')->with('error', 'No workspace selected.');
        }

        $projects = Project::where('workspace_id', $workspace->id)
            ->with(['milestones' => function ($q) {
                $q->orderBy('order');
            }])
            ->orderBy('title')
            ->get()
            ->map(function ($project) {
                return [
                    'id' => $project->id,
                    'title' => $project->title ?? $project->name,
                    'milestones' => $project->milestones->map(function ($m) {
                        return [
                            'id' => $m->id,
                            'title' => $m->title,
                            'due_date' => $m->due_date,
                            'status' => $m->status,
                            'progress' => $m->progress,
                        ];
                    }),
                ];
            });

        return Inertia::render('project-reports/MilestoneReport', [
            'projects' => $projects,
            'filters' => $request->only(['project_id', 'milestone_id', 'date_from', 'date_to']),
        ]);
    }

    public function exportMilestone(Request $request, ProjectMilestone $milestone)
    {
        $this->authorizePermission('project_report_view_any');

        $user = Auth::user();
        $workspace = $user->currentWorkspace;
        $ownerId = $workspace->owner_id ?? $user->id;

        $milestone->load(['project', 'creator']);
        $project = $milestone->project;

        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');

        // Load tasks for this milestone
        $tasksQuery = Task::where('milestone_id', $milestone->id)
            ->with(['taskStage', 'members.user', 'assignedUser']);

        if ($dateFrom) {
            $tasksQuery->where(function ($q) use ($dateFrom) {
                $q->whereDate('start_date', '>=', $dateFrom)
                  ->orWhereDate('due_date', '>=', $dateFrom)
                  ->orWhereDate('end_date', '>=', $dateFrom);
            });
        }
        if ($dateTo) {
            $tasksQuery->where(function ($q) use ($dateTo) {
                $q->whereDate('start_date', '<=', $dateTo);
            });
        }

        $tasks = $tasksQuery->get();

        // Calculate stats
        $totalTasks = $tasks->count();
        $completedTasks = $tasks->where('progress', 100)->count();
        $inProgressTasks = $tasks->where('progress', '>', 0)->where('progress', '<', 100)->count();
        $totalLoggedHours = round(TimesheetEntry::whereIn('task_id', $tasks->pluck('id'))->sum('hours'), 2);

        $priorityStats = $tasks->groupBy('priority')->map->count()->toArray();
        $statusStats = [];
        foreach ($tasks as $task) {
            $stageName = $task->taskStage ? $task->taskStage->name : 'To Do';
            $statusStats[$stageName] = ($statusStats[$stageName] ?? 0) + 1;
        }

        $stats = [
            'total_tasks' => $totalTasks,
            'completed_tasks' => $completedTasks,
            'in_progress_tasks' => $inProgressTasks,
            'total_logged_hours' => $totalLoggedHours,
            'completion_percentage' => $milestone->progress ?? 0,
        ];

        // Team stats
        $teamStats = [];
        $taskUsers = $tasks->whereNotNull('assigned_to')->groupBy('assigned_to');
        $doneStageId = DB::table('task_stages')
            ->where('workspace_id', $project->workspace_id)
            ->where('name', 'Done')
            ->value('id');

        foreach ($taskUsers as $userId => $userTasks) {
            $userName = $userTasks->first()->assignedUser?->name ?? 'Unknown';
            $assigned = $userTasks->count();
            $completed = $doneStageId ? $userTasks->where('task_stage_id', $doneStageId)->count() : 0;
            $hours = round(TimesheetEntry::whereIn('task_id', $userTasks->pluck('id'))->sum('hours'), 2);

            $teamStats[] = [
                'name' => $userName,
                'assigned' => $assigned,
                'completed' => $completed,
                'hours' => $hours,
            ];
        }

        // Resolve theme color
        $themeColorMap = [
            'blue'   => '#3b82f6',
            'green'  => '#10B77F',
            'purple' => '#8b5cf6',
            'orange' => '#f97316',
            'red'    => '#ef4444',
        ];
        $themeColor  = \App\Models\Setting::where('user_id', $ownerId)->where('workspace_id', $workspace->id)->where('key', 'themeColor')->value('value') ?? 'green';
        $customColor = \App\Models\Setting::where('user_id', $ownerId)->where('workspace_id', $workspace->id)->where('key', 'customColor')->value('value') ?? '#10B77F';
        $primaryColor = $themeColor === 'custom' ? $customColor : ($themeColorMap[$themeColor] ?? '#10B77F');
        $primaryHex = ltrim($primaryColor, '#');
        $pr = hexdec(substr($primaryHex, 0, 2));
        $pg = hexdec(substr($primaryHex, 2, 2));
        $pb = hexdec(substr($primaryHex, 4, 2));

        // Company info
        $companyName = \App\Models\Setting::where('user_id', $ownerId)->where('workspace_id', $workspace->id)->where('key', 'titleText')->value('value') ?? $workspace->name;
        $logoPath = \App\Models\Setting::where('user_id', $ownerId)->where('workspace_id', $workspace->id)->where('key', 'logoLight')->value('value');
        $companyLogo = null;
        if ($logoPath) {
            // Try multiple paths: direct storage, public storage, or absolute
            $possiblePaths = [
                storage_path('app/public/' . $logoPath),
                storage_path('app/public/' . ltrim($logoPath, '/')),
                public_path($logoPath),
                public_path(ltrim($logoPath, '/')),
                public_path('storage/' . ltrim($logoPath, '/')),
            ];
            // If path starts with /storage/, strip it for the file lookup
            if (str_starts_with($logoPath, '/storage/')) {
                $possiblePaths[] = storage_path('app/public/' . substr($logoPath, 9));
            }
            foreach ($possiblePaths as $fullPath) {
                if (file_exists($fullPath)) {
                    $ext = strtolower(pathinfo($fullPath, PATHINFO_EXTENSION));
                    $mime = match($ext) {
                        'svg' => 'image/svg+xml',
                        'png' => 'image/png',
                        'jpg', 'jpeg' => 'image/jpeg',
                        'gif' => 'image/gif',
                        'webp' => 'image/webp',
                        default => 'image/png',
                    };
                    $companyLogo = 'data:' . $mime . ';base64,' . base64_encode(file_get_contents($fullPath));
                    break;
                }
            }
        }
        $workspaceName = $workspace->name;

        // Generate progress donut chart
        $progressChartImage = $this->generateProgressDonut($stats['completion_percentage'], $pr, $pg, $pb);

        // Generate priority bar chart
        $priorityChartImage = $this->generatePriorityChart($priorityStats, $pr, $pg, $pb);

        // Generate status pie chart
        $statusChartImage = $this->generateStatusPieChart($statusStats);

        // Generate hours bar chart
        $hoursData = [];
        foreach ($tasks as $task) {
            $h = round(TimesheetEntry::where('task_id', $task->id)->sum('hours'), 2);
            if ($h > 0) {
                $hoursData[] = ['task_name' => $task->title, 'logged_hours' => $h];
            }
        }
        $hoursChartImage = $this->generateHoursChart($hoursData, $pr, $pg, $pb);

        $html = view('pdf.milestone-report', compact(
            'milestone',
            'project',
            'tasks',
            'stats',
            'teamStats',
            'dateFrom',
            'dateTo',
            'companyName',
            'companyLogo',
            'workspaceName',
            'primaryColor',
            'progressChartImage',
            'priorityChartImage',
            'statusChartImage',
            'hoursChartImage'
        ))->render();

        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadHTML($html)
            ->setPaper('a4', 'portrait')
            ->setOptions([
                'dpi'                    => 96,
                'defaultFont'            => 'DejaVu Sans',
                'isHtml5ParserEnabled'   => true,
                'isRemoteEnabled'        => true,
                'isFontSubsettingEnabled'=> true,
            ]);

        $filename = 'milestone_report_' . str_replace(' ', '_', $milestone->title) . '_' . date('Y-m-d') . '.pdf';
        return $pdf->download($filename);
    }

    private function generateProgressDonut($percentage, $pr, $pg, $pb)
    {
        $size = 400;
        $centerX = $size / 2;
        $centerY = $size / 2;
        $outerRadius = 140;
        $innerRadius = 105;

        $image = imagecreatetruecolor($size, $size);
        imageantialias($image, true);
        imagesavealpha($image, true);
        $transparent = imagecolorallocatealpha($image, 0, 0, 0, 127);
        imagefill($image, 0, 0, $transparent);

        $trackColor = imagecolorallocate($image, 241, 245, 249);
        $primary = imagecolorallocate($image, $pr, $pg, $pb);
        $darkText = imagecolorallocate($image, 15, 23, 42);
        $white = imagecolorallocate($image, 255, 255, 255);
        $subText = imagecolorallocate($image, 100, 116, 139);

        imagefilledellipse($image, $centerX, $centerY, $outerRadius * 2, $outerRadius * 2, $trackColor);
        imagefilledellipse($image, $centerX, $centerY, $innerRadius * 2, $innerRadius * 2, $white);

        if ($percentage > 0) {
            $endAngle = ($percentage / 100) * 360;
            imagefilledarc($image, $centerX, $centerY, $outerRadius * 2, $outerRadius * 2, -90, -90 + $endAngle, $primary, IMG_ARC_PIE);
            imagefilledellipse($image, $centerX, $centerY, $innerRadius * 2, $innerRadius * 2, $white);

            $capRadius = ($outerRadius - $innerRadius) / 2;
            $ringRadius = ($outerRadius + $innerRadius) / 2;
            imagefilledellipse($image, $centerX, (int)($centerY - $ringRadius), (int)($capRadius * 2), (int)($capRadius * 2), $primary);

            $endAngleRad = deg2rad(-90 + $endAngle);
            $endX = (int)($centerX + ($ringRadius * cos($endAngleRad)));
            $endY = (int)($centerY + ($ringRadius * sin($endAngleRad)));
            imagefilledellipse($image, $endX, $endY, (int)($capRadius * 2), (int)($capRadius * 2), $primary);
        }

        $fontPath = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
        $fontPathRegular = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
        $text = $percentage . '%';
        if (file_exists($fontPath)) {
            $bbox = imagettfbbox(40, 0, $fontPath, $text);
            $textWidth = $bbox[2] - $bbox[0];
            $textHeight = $bbox[1] - $bbox[7];
            imagettftext($image, 40, 0, (int)($centerX - ($textWidth / 2)), (int)($centerY + ($textHeight / 2) - 8), $darkText, $fontPath, $text);

            $label = 'Complete';
            $labelFont = file_exists($fontPathRegular) ? $fontPathRegular : $fontPath;
            $lbbox = imagettfbbox(12, 0, $labelFont, $label);
            $lw = $lbbox[2] - $lbbox[0];
            imagettftext($image, 12, 0, (int)($centerX - ($lw / 2)), (int)($centerY + $textHeight / 2 + 18), $subText, $labelFont, $label);
        } else {
            $font = 5;
            $tw = strlen($text) * imagefontwidth($font);
            imagestring($image, $font, (int)($centerX - ($tw / 2)), (int)($centerY - (imagefontheight($font) / 2)), $text, $darkText);
        }

        ob_start();
        imagepng($image);
        $data = ob_get_clean();
        imagedestroy($image);

        return base64_encode($data);
    }

    private function generatePriorityChart($priorityStats, $pr, $pg, $pb)
    {
        $imgW = 500;
        $imgH = 200;
        $image = imagecreatetruecolor($imgW, $imgH);
        $white = imagecolorallocate($image, 255, 255, 255);
        imagefill($image, 0, 0, $white);

        $priorityColors = [
            'critical' => imagecolorallocate($image, 239, 68, 68),
            'high'     => imagecolorallocate($image, 249, 115, 22),
            'medium'   => imagecolorallocate($image, 234, 179, 8),
            'low'      => imagecolorallocate($image, 34, 197, 94),
        ];
        $textColor = imagecolorallocate($image, 71, 85, 105);
        $darkText = imagecolorallocate($image, 15, 23, 42);
        $gridColor = imagecolorallocate($image, 241, 245, 249);
        $axisColor = imagecolorallocate($image, 226, 232, 240);

        $fontPath = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
        $fontPathRegular = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
        $labelFont = file_exists($fontPathRegular) ? $fontPathRegular : $fontPath;

        $maxValue = max(array_merge([1], array_values($priorityStats)));
        $step = max(1, ceil($maxValue / 4));
        $maxValue = $step * ceil($maxValue / $step);

        $marginLeft = 40;
        $marginRight = 120;
        $marginTop = 20;
        $marginBottom = 35;
        $chartW = $imgW - $marginLeft - $marginRight;
        $chartH = $imgH - $marginTop - $marginBottom;
        $baseY = $marginTop + $chartH;

        // Grid lines
        if (file_exists($fontPath)) {
            for ($i = 0; $i <= $maxValue; $i += $step) {
                $y = (int)($baseY - (($i / $maxValue) * $chartH));
                imageline($image, $marginLeft, $y, $marginLeft + $chartW, $y, $i === 0 ? $axisColor : $gridColor);
                $bbox = imagettfbbox(8, 0, $labelFont, (string)$i);
                $lw = $bbox[2] - $bbox[0];
                imagettftext($image, 8, 0, $marginLeft - $lw - 6, $y + 3, $textColor, $labelFont, (string)$i);
            }
        }

        $priorities = ['critical', 'high', 'medium', 'low'];
        $count = count($priorities);
        $totalBarArea = $chartW / $count;
        $barWidth = (int)($totalBarArea * 0.6);

        $idx = 0;
        foreach ($priorities as $priority) {
            $value = $priorityStats[$priority] ?? 0;
            $barH = $maxValue > 0 ? ($value / $maxValue) * $chartH : 0;
            $x = (int)($marginLeft + ($idx * $totalBarArea) + (($totalBarArea - $barWidth) / 2));
            $y = (int)($baseY - $barH);

            if ($barH > 0) {
                imagefilledrectangle($image, $x, $y, $x + $barWidth, $baseY, $priorityColors[$priority]);
                // Rounded top
                imagefilledellipse($image, (int)($x + $barWidth / 2), $y, $barWidth, 8, $priorityColors[$priority]);
            }

            if (file_exists($fontPath) && $value > 0) {
                $valStr = (string)$value;
                $bbox = imagettfbbox(9, 0, $fontPath, $valStr);
                $lw = $bbox[2] - $bbox[0];
                imagettftext($image, 9, 0, (int)($x + $barWidth / 2 - $lw / 2), $y - 6, $darkText, $fontPath, $valStr);
            }

            // Label below bar
            if (file_exists($labelFont)) {
                $lbl = ucfirst($priority);
                $bbox = imagettfbbox(8, 0, $labelFont, $lbl);
                $lw = $bbox[2] - $bbox[0];
                imagettftext($image, 8, 0, (int)($x + $barWidth / 2 - $lw / 2), $baseY + 16, $textColor, $labelFont, $lbl);
            }
            $idx++;
        }

        // Legend
        if (file_exists($labelFont)) {
            $legendX = $imgW - 105;
            $legendY = $marginTop + 10;
            foreach ($priorities as $priority) {
                imagefilledrectangle($image, $legendX, $legendY, $legendX + 10, $legendY + 10, $priorityColors[$priority]);
                imagettftext($image, 8, 0, $legendX + 15, $legendY + 9, $textColor, $labelFont, ucfirst($priority) . ' (' . ($priorityStats[$priority] ?? 0) . ')');
                $legendY += 22;
            }
        }

        ob_start();
        imagepng($image);
        $data = ob_get_clean();
        imagedestroy($image);

        return base64_encode($data);
    }

    private function generateStatusPieChart($statusStats)
    {
        $imgW = 500;
        $imgH = 240;
        $image = imagecreatetruecolor($imgW, $imgH);
        $white = imagecolorallocate($image, 255, 255, 255);
        imagefill($image, 0, 0, $white);

        $statusColorMap = [
            'To Do'       => imagecolorallocate($image, 148, 163, 184),
            'In Progress' => imagecolorallocate($image, 59, 130, 246),
            'Review'      => imagecolorallocate($image, 139, 92, 246),
            'Done'        => imagecolorallocate($image, 34, 197, 94),
            'Blocked'     => imagecolorallocate($image, 239, 68, 68),
        ];
        $textColor = imagecolorallocate($image, 71, 85, 105);
        $darkText = imagecolorallocate($image, 15, 23, 42);
        $whiteColor = imagecolorallocate($image, 255, 255, 255);
        $fontPath = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
        $fontPathRegular = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
        $labelFont = file_exists($fontPathRegular) ? $fontPathRegular : $fontPath;

        $total = array_sum($statusStats);
        if ($total > 0) {
            $startAngle = -90;
            $centerX = 120;
            $centerY = 120;
            $outerRadius = 95;
            $innerRadius = 55;

            // Draw donut (modern pie = donut)
            foreach ($statusStats as $status => $count) {
                $angle = ($count / $total) * 360;
                $color = $statusColorMap[$status] ?? imagecolorallocate($image, 180, 180, 180);
                imagefilledarc($image, $centerX, $centerY, $outerRadius * 2, $outerRadius * 2, (int)$startAngle, (int)($startAngle + $angle), $color, IMG_ARC_PIE);
                $startAngle += $angle;
            }
            // Cut out center for donut effect
            imagefilledellipse($image, $centerX, $centerY, $innerRadius * 2, $innerRadius * 2, $white);

            // Center total text
            if (file_exists($fontPath)) {
                $totalStr = (string)$total;
                $bbox = imagettfbbox(22, 0, $fontPath, $totalStr);
                $lw = $bbox[2] - $bbox[0];
                imagettftext($image, 22, 0, (int)($centerX - $lw / 2), $centerY + 4, $darkText, $fontPath, $totalStr);

                $sublabel = 'tasks';
                $bbox2 = imagettfbbox(9, 0, $labelFont, $sublabel);
                $lw2 = $bbox2[2] - $bbox2[0];
                imagettftext($image, 9, 0, (int)($centerX - $lw2 / 2), $centerY + 20, $textColor, $labelFont, $sublabel);
            }

            // Legend on right
            if (file_exists($labelFont)) {
                $legendX = 260;
                $legendY = 35;
                foreach ($statusStats as $status => $count) {
                    $color = $statusColorMap[$status] ?? imagecolorallocate($image, 180, 180, 180);
                    $pct = round(($count / $total) * 100);

                    imagefilledrectangle($image, $legendX, $legendY, $legendX + 12, $legendY + 12, $color);
                    imagettftext($image, 9, 0, $legendX + 18, $legendY + 10, $darkText, $labelFont, $status);
                    imagettftext($image, 9, 0, $legendX + 18, $legendY + 26, $textColor, $labelFont, $count . ' (' . $pct . '%)');
                    $legendY += 38;
                }
            }
        } else {
            if (file_exists($fontPath)) {
                $grayColor = imagecolorallocate($image, 156, 163, 175);
                imagettftext($image, 12, 0, 180, 120, $grayColor, $fontPath, 'No tasks');
            }
        }

        ob_start();
        imagepng($image);
        $data = ob_get_clean();
        imagedestroy($image);

        return base64_encode($data);
    }

    private function generateHoursChart($hoursData, $pr, $pg, $pb)
    {
        $imgW = 700;
        $imgH = 260;
        $marginLeft = 55;
        $marginRight = 20;
        $marginTop = 25;
        $marginBottom = 75;
        $chartW = $imgW - $marginLeft - $marginRight;
        $chartH = $imgH - $marginTop - $marginBottom;
        $baseY = $marginTop + $chartH;

        $image = imagecreatetruecolor($imgW, $imgH);
        $white = imagecolorallocate($image, 255, 255, 255);
        imagefill($image, 0, 0, $white);

        $primary = imagecolorallocate($image, $pr, $pg, $pb);
        $primaryLight = imagecolorallocate($image, (int)($pr + (255 - $pr) * 0.3), (int)($pg + (255 - $pg) * 0.3), (int)($pb + (255 - $pb) * 0.3));
        $textColor = imagecolorallocate($image, 71, 85, 105);
        $darkText = imagecolorallocate($image, 15, 23, 42);
        $axisColor = imagecolorallocate($image, 226, 232, 240);
        $gridColor = imagecolorallocate($image, 241, 245, 249);

        $fontPath = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
        $fontPathRegular = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
        $labelFont = file_exists($fontPathRegular) ? $fontPathRegular : $fontPath;

        if (count($hoursData) === 0 || max(array_column($hoursData, 'logged_hours')) == 0) {
            $grayColor = imagecolorallocate($image, 156, 163, 175);
            imageline($image, $marginLeft, $baseY, $imgW - $marginRight, $baseY, $axisColor);
            if (file_exists($fontPath)) {
                imagettftext($image, 11, 0, (int)($imgW / 2 - 60), (int)($imgH / 2), $grayColor, $labelFont, 'No hours logged');
            }
            ob_start();
            imagepng($image);
            $data = ob_get_clean();
            imagedestroy($image);
            return base64_encode($data);
        }

        $displayTasks = array_slice($hoursData, 0, 8);
        $count = count($displayTasks);
        $maxHours = max(array_column($displayTasks, 'logged_hours'));
        $step = max(1, ceil($maxHours / 5));
        $maxHours = $step * ceil($maxHours / $step);

        // Grid lines
        if (file_exists($labelFont)) {
            for ($i = 0; $i <= $maxHours; $i += $step) {
                $y = (int)($baseY - (($i / $maxHours) * $chartH));
                imageline($image, $marginLeft, $y, $imgW - $marginRight, $y, $i === 0 ? $axisColor : $gridColor);
                $label = $i . 'h';
                $bbox = imagettfbbox(8, 0, $labelFont, $label);
                $lw = $bbox[2] - $bbox[0];
                imagettftext($image, 8, 0, $marginLeft - $lw - 6, $y + 3, $textColor, $labelFont, $label);
            }
        }

        $totalBarArea = $chartW / $count;
        $barWidth = min(55, (int)($totalBarArea * 0.6));

        foreach ($displayTasks as $index => $taskData) {
            $hours = $taskData['logged_hours'];
            $barH = $maxHours > 0 ? ($hours / $maxHours) * $chartH : 0;
            $x = (int)($marginLeft + ($index * $totalBarArea) + (($totalBarArea - $barWidth) / 2));
            $y = (int)($baseY - $barH);

            if ($barH > 0) {
                imagefilledrectangle($image, $x, $y, $x + $barWidth, $baseY, $primary);
                imagefilledellipse($image, (int)($x + $barWidth / 2), $y, $barWidth, 8, $primary);
            }

            // Value above bar
            if (file_exists($fontPath) && $hours > 0) {
                $valLabel = $hours . 'h';
                $bbox = imagettfbbox(9, 0, $fontPath, $valLabel);
                $lw = $bbox[2] - $bbox[0];
                imagettftext($image, 9, 0, (int)($x + $barWidth / 2 - $lw / 2), $y - 7, $darkText, $fontPath, $valLabel);
            }

            // Task name below (angled for readability)
            if (file_exists($labelFont)) {
                $taskName = mb_strlen($taskData['task_name']) > 16 ? mb_substr($taskData['task_name'], 0, 14) . '..' : $taskData['task_name'];
                imagettftext($image, 7, 30, (int)($x + $barWidth / 2 - 2), $baseY + 16, $textColor, $labelFont, $taskName);
            }
        }

        // Total label at bottom-right
        if (file_exists($labelFont)) {
            $totalHours = array_sum(array_column($hoursData, 'logged_hours'));
            $totalLabel = 'Total: ' . round($totalHours, 1) . 'h';
            $bbox = imagettfbbox(9, 0, $fontPath, $totalLabel);
            $lw = $bbox[2] - $bbox[0];
            imagettftext($image, 9, 0, $imgW - $marginRight - $lw, $imgH - 10, $darkText, $fontPath, $totalLabel);
        }

        ob_start();
        imagepng($image);
        $data = ob_get_clean();
        imagedestroy($image);

        return base64_encode($data);
    }

    private function calculateUserStats($project)
    {
        $this->authorizePermission('project_report_view_any');

        $userStats = [];

        // Get all users who have tasks assigned in this project using assigned_to field
        $taskUsers = DB::table('tasks')
            ->join('users', 'tasks.assigned_to', '=', 'users.id')
            ->where('tasks.project_id', $project->id)
            ->whereNotNull('tasks.assigned_to')
            ->select('users.id', 'users.name')
            ->distinct()
            ->get();



        // Calculate stats for each user who has tasks assigned
        foreach ($taskUsers as $user) {
            $userId = $user->id;

            // Count assigned tasks
            $assignedTasks = DB::table('tasks')
                ->where('project_id', $project->id)
                ->where('assigned_to', $userId)
                ->count();

            // Count done tasks - check what stage ID is "Done"
            $doneStageId = DB::table('task_stages')
                ->where('workspace_id', $project->workspace_id)
                ->where('name', 'Done')
                ->value('id');

            $doneTasks = DB::table('tasks')
                ->where('project_id', $project->id)
                ->where('assigned_to', $userId)
                ->where('task_stage_id', $doneStageId)
                ->count();

            $userStats[] = [
                'name' => $user->name,
                'role' => 'member',
                'assigned_tasks' => $assignedTasks,
                'done_tasks' => $doneTasks
            ];
        }

        return $userStats;
    }
}