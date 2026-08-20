<?php

namespace App\Http\Controllers;

use App\Services\PermissionService;
use App\Traits\HasPermissionChecks;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DashboardController extends Controller
{
    use HasPermissionChecks;
    
    public function __construct(private PermissionService $permissionService)
    {
    }
    public function index()
    {
        $user = auth()->user();
        
        // Super admin gets their own dashboard
        if ($user->type === 'superadmin' || $user->type === 'super admin') {
            return $this->renderSuperAdminDashboard();
        }
        
        // Check if user has dashboard permission or is a company user
        if ($this->checkPermission('dashboard_view') || $user->type === 'company') {
            return $this->renderDashboard();
        }
        
        // Redirect to first available page
        return $this->redirectToFirstAvailablePage();
    }
    
    public function redirectToFirstAvailablePage()
    {
        $user = auth()->user();
        
        // Define available routes with their permissions
        $routes = [
            ['route' => 'projects.index', 'permission' => 'project_view_any'],
            ['route' => 'tasks.index', 'permission' => 'task_view_any'],
            ['route' => 'timesheets.index', 'permission' => 'timesheet_view_any'],
            ['route' => 'expenses.index', 'permission' => 'expense_view_any'],
            ['route' => 'budgets.index', 'permission' => 'budget_view_any'],
            ['route' => 'invoices.index', 'permission' => 'invoice_view_any'],
            ['route' => 'bugs.index', 'permission' => 'bug_view_any'],
            ['route' => 'workspaces.index', 'permission' => 'workspace_view_any'],
            ['route' => 'plans.index', 'permission' => 'plan_view_any'],
            ['route' => 'companies.index', 'permission' => 'company_view_any'],
            ['route' => 'users.index', 'permission' => 'user_view_any'],
        ];
        
        // Find first available route
        foreach ($routes as $routeData) {
            if ($this->checkPermission($routeData['permission'])) {
                return redirect()->route($routeData['route']);
            }
        }
        
        // If no permissions found, logout user
        auth()->logout();
        return redirect()->route('login')->with('error', __('No access permissions found.'));
    }
    
    private function renderDashboard()
    {
        try {
            $user = auth()->user();
            $workspace = $this->getCurrentWorkspace($user);
            $role = $this->getUserWorkspaceRole($user, $workspace);
            
            // Build cards based on workspace role and permissions
            $cards = [];
            
            // Only show user count for company workspace role (owner)
            if ($role === 'company' && $this->checkPermission('user_view_any')) {
                $cards[] = [
                    'title' => __('Total Users'),
                    'value' => $this->getTotalUsers($user, $workspace, $role),
                    'icon' => 'Users',
                ];
            }
            
            // Show projects if user has permission
            if ($this->checkPermission('project_view_any')) {
                $cards[] = [
                    'title' => __('Active Projects'),
                    'value' => $this->getActiveProjects($workspace, $user, $role),
                    'icon' => 'Activity',
                ];
            }
            
            // Show tasks if user has permission
            if ($this->checkPermission('task_view_any')) {
                $cards[] = [
                    'title' => __('Tasks Completed'),
                    'value' => $this->getCompletedTasks($workspace, $user, $role),
                    'icon' => 'UserPlus',
                ];
            }
            
            // Show revenue only for company workspace role with invoice permission
            if ($role === 'company' && $this->checkPermission('invoice_view_any')) {
                $cards[] = [
                    'title' => __('Total Received'),
                    'value' => $this->getRevenue($user, $workspace, $role),
                    'format' => 'currency',
                    'icon' => 'DollarSign',
                ];
            }
            
            $chartYear = (int) request('chartYear', now()->year);

            $dashboardData = [
                'cards' => $cards,
                'projects' => $this->checkPermission('project_view_any') ? $this->getProjectStats($workspace, $user, $role) : null,
                'tasks' => $this->checkPermission('task_view_any') ? $this->getTaskStats($workspace, $user, $role) : null,
                'taskStages' => $this->checkPermission('task_view_any') ? $this->getTaskStages($workspace, $user, $role) : null,
                'timesheets' => $this->checkPermission('timesheet_view_any') ? $this->getTimesheetStats($workspace, $user, $role) : null,
                'budgets' => $this->checkPermission('budget_view_any') ? $this->getBudgetStats($workspace, $user, $role) : null,
                'expenses' => $this->checkPermission('expense_view_any') ? $this->getExpenseStats($workspace, $user, $role) : null,
                'invoices' => (($role === 'company' || $role === 'client') && $this->checkPermission('invoice_view_any')) ? $this->getInvoiceStats($workspace, $user, $role) : null,
                'bugs' => $this->checkPermission('bug_view_any') ? $this->getBugStats($workspace, $user, $role) : null,
                'recentActivities' => $this->getRecentActivities($workspace, $user, $role),
                'currentWorkspace' => $workspace,
                'monthlyTimesheetHours' => $this->checkPermission('timesheet_view_any') ? $this->getMonthlyTimesheetHours($workspace, $user, $role, $chartYear) : null,
                'monthlyTaskCompletion' => $this->checkPermission('task_view_any') ? $this->getMonthlyTaskCompletion($workspace, $user, $role, $chartYear) : null,
                'monthlyInvoiceRevenue' => (($role === 'company' || $role === 'client') && $this->checkPermission('invoice_view_any')) ? $this->getMonthlyInvoiceRevenue($workspace, $user, $role, $chartYear) : null,
                'chartYear' => $chartYear,
                'availableYears' => range(now()->year + 1, now()->year - 4),
                'pendingTimesheets' => $this->checkPermission('timesheet_view_any') ? $this->getPendingTimesheets($workspace, $user, $role) : null,
                'recentBugs' => $this->checkPermission('bug_view_any') ? $this->getRecentBugs($workspace, $user, $role) : null,
                'pendingInvoices' => (($role === 'company' || $role === 'client') && $this->checkPermission('invoice_view_any')) ? $this->getPendingInvoices($workspace, $user, $role) : null,
                'ongoingProjects' => $this->checkPermission('project_view_any') ? $this->getOngoingProjects($workspace, $user, $role) : null,
                'recentTasks' => $this->checkPermission('task_view_any') ? $this->getRecentTasks($workspace, $user, $role) : null,
                'pendingExpenses' => $this->checkPermission('expense_view_any') ? $this->getPendingExpenses($workspace, $user, $role) : null,
            ];

            return Inertia::render('dashboard', [
                'dashboardData' => $dashboardData,
                'userWorkspaceRole' => $role,
                'permissions' => []
            ]);
        } catch (\Exception $e) {
            // Log the error and return a basic response
            \Log::error('Dashboard Error: ' . $e->getMessage());
            
            return Inertia::render('dashboard', [
                'dashboardData' => [
                    'cards' => [],
                    'error' => 'Dashboard loading error'
                ],
                'permissions' => []
            ]);
        }
    }
    
    private function getCurrentWorkspace($user)
    {
        try {
            // Try to get current workspace from session or user preference
            if (session('current_workspace_id')) {
                $workspace = \App\Models\Workspace::find(session('current_workspace_id'));
                if ($workspace && $user->workspaces()->where('workspace_id', $workspace->id)->exists()) {
                    return $workspace;
                }
            }
            
            // Try user's currentWorkspace relationship if it exists
            if (method_exists($user, 'currentWorkspace') && $user->currentWorkspace) {
                return $user->currentWorkspace;
            }
            
            // Get first workspace user belongs to
            return $user->workspaces()->first();
        } catch (\Exception $e) {
            return null;
        }
    }
    
    private function getUserWorkspaceRole($user, $workspace)
    {
        try {
            if (!$workspace) return 'member';
            
            // Check if user is workspace owner
            if ($workspace->owner_id === $user->id) {
                return 'company';
            }
            
            $member = \App\Models\WorkspaceMember::where('user_id', $user->id)
                ->where('workspace_id', $workspace->id)
                ->first();
                
            return $member ? $member->role : 'member';
        } catch (\Exception $e) {
            return 'member';
        }
    }
    
    private function getTotalUsers($user, $workspace, $role)
    {
        try {
            // Only company workspace role sees user count
            if ($role !== 'company' || !$workspace) {
                return 0;
            }
            
            if (class_exists('\App\Models\WorkspaceMember')) {
                return \App\Models\WorkspaceMember::where('workspace_id', $workspace->id)
                    ->where('status', 'active')
                    ->count();
            }
            
            return 0;
        } catch (\Exception $e) {
            return 0;
        }
    }
    
    private function getActiveProjects($workspace, $user, $role)
    {
        try {
            if (!class_exists('\App\Models\Project') || !$workspace) {
                return 0;
            }
            
            $query = \App\Models\Project::where('workspace_id', $workspace->id)
                ->where('status', 'active');
            
            // Client role sees projects from project_clients table
            if ($role === 'client') {
                $query->whereHas('clients', function($q) use ($user) {
                    $q->where('user_id', $user->id);
                });
            }
            // Other non-company roles see projects from project_members table
            elseif ($role !== 'company') {
                $query->whereHas('members', function($q) use ($user) {
                    $q->where('user_id', $user->id);
                });
            }
            
            return $query->count();
        } catch (\Exception $e) {
            return 0;
        }
    }
    
    private function getCompletedTasks($workspace, $user, $role)
    {
        try {
            if (!class_exists('\App\Models\Task') || !class_exists('\App\Models\TaskStage') || !$workspace) {
                return 0;
            }
            
            $completedStages = \App\Models\TaskStage::where('workspace_id', $workspace->id)
                ->where(function($q) {
                    $q->where('name', 'like', '%done%')
                      ->orWhere('name', 'like', '%completed%')
                      ->orWhere('name', 'like', '%finished%');
                })->pluck('id');
            
            $query = \App\Models\Task::whereHas('project', function($q) use ($workspace) {
                $q->where('workspace_id', $workspace->id);
            })->whereIn('task_stage_id', $completedStages);
            
            // Non-company workspace roles only see their own tasks or tasks in their projects
            if ($role === 'client') {
                $query->where(function($q) use ($user) {
                    $q->where('assigned_to', $user->id)
                      ->orWhereHas('project.clients', function($pm) use ($user) {
                          $pm->where('user_id', $user->id);
                      });
                });
            } elseif ($role !== 'company') {
                $query->where(function($q) use ($user) {
                    $q->where('assigned_to', $user->id)
                      ->orWhereHas('project.members', function($pm) use ($user) {
                          $pm->where('user_id', $user->id);
                      });
                });
            }
            
            return $query->count();
        } catch (\Exception $e) {
            return 0;
        }
    }
    

    
    private function getRevenue($user, $workspace, $role)
    {
        try {
            if ($role !== 'company' || !$workspace) {
                return 0;
            }
            
            if (class_exists('\App\Models\Invoice')) {
                return \App\Models\Invoice::whereHas('project', function($q) use ($workspace) {
                    $q->where('workspace_id', $workspace->id);
                })->where('status', 'paid')
                ->sum('total_amount') ?? 0;
            }
            
            return 0;
        } catch (\Exception $e) {
            \Log::error('getRevenue error: ' . $e->getMessage());
            return 0;
        }
    }
    
    private function getProjectStats($workspace, $user, $role)
    {
        try {
            if (!class_exists('\App\Models\Project') || !$workspace) {
                return ['total' => 0, 'active' => 0, 'completed' => 0, 'overdue' => 0];
            }
            
            $baseQuery = \App\Models\Project::where('workspace_id', $workspace->id);
            
            // Client role sees projects from project_clients table
            if ($role === 'client') {
                $baseQuery->whereHas('clients', function($q) use ($user) {
                    $q->where('user_id', $user->id);
                });
            }
            // Other non-company roles see projects from project_members table
            elseif ($role !== 'company') {
                $baseQuery->whereHas('members', function($q) use ($user) {
                    $q->where('user_id', $user->id);
                });
            }
            
            $total = (clone $baseQuery)->count();
            $active = (clone $baseQuery)->where('status', 'active')->count();
            $completed = (clone $baseQuery)->where('status', 'completed')->count();
            $overdue = (clone $baseQuery)->where('deadline', '<', now()->toDateString())
                ->whereNotIn('status', ['completed', 'cancelled'])
                ->count();
                
            return [
                'total' => $total,
                'active' => $active,
                'completed' => $completed,
                'overdue' => $overdue
            ];
        } catch (\Exception $e) {
            return ['total' => 0, 'active' => 0, 'completed' => 0, 'overdue' => 0];
        }
    }
    
    private function getTaskStats($workspace, $user, $role)
    {
        try {
            if (!class_exists('\App\Models\Task') || !$workspace) {
                return ['total' => 0, 'pending' => 0, 'inProgress' => 0, 'completed' => 0];
            }
            
            $taskQuery = \App\Models\Task::whereHas('project', function($q) use ($workspace) {
                $q->where('workspace_id', $workspace->id);
            });
            
            // Non-company workspace roles only see their own tasks or tasks in their projects
            if ($role === 'client') {
                $taskQuery->where(function($q) use ($user) {
                    $q->where('assigned_to', $user->id)
                      ->orWhereHas('project.clients', function($pm) use ($user) {
                          $pm->where('user_id', $user->id);
                      });
                });
            } elseif ($role !== 'company') {
                $taskQuery->where(function($q) use ($user) {
                    $q->where('assigned_to', $user->id)
                      ->orWhereHas('project.members', function($pm) use ($user) {
                          $pm->where('user_id', $user->id);
                      });
                });
            }
            
            $total = (clone $taskQuery)->count();
            
            $stages = \App\Models\TaskStage::where('workspace_id', $workspace->id)
                ->withCount(['tasks' => function($q) use ($workspace, $user, $role) {
                    $q->whereHas('project', function($pq) use ($workspace) {
                        $pq->where('workspace_id', $workspace->id);
                    });
                    if ($role === 'client') {
                        $q->where(function($tq) use ($user) {
                            $tq->where('assigned_to', $user->id)
                               ->orWhereHas('project.clients', function($pm) use ($user) {
                                   $pm->where('user_id', $user->id);
                               });
                        });
                    } elseif ($role !== 'company') {
                        $q->where(function($tq) use ($user) {
                            $tq->where('assigned_to', $user->id)
                               ->orWhereHas('project.members', function($pm) use ($user) {
                                   $pm->where('user_id', $user->id);
                               });
                        });
                    }
                }])->get();
            
            $pending = $stages->first() ? $stages->first()->tasks_count : 0;
            $inProgress = $stages->skip(1)->first() ? $stages->skip(1)->first()->tasks_count : 0;
            $completed = $stages->skip(2)->first() ? $stages->skip(2)->first()->tasks_count : 0;
            
            return [
                'total' => $total,
                'pending' => $pending,
                'inProgress' => $inProgress,
                'completed' => $completed
            ];
        } catch (\Exception $e) {
            return ['total' => 0, 'pending' => 0, 'inProgress' => 0, 'completed' => 0];
        }
    }
    
    private function getTaskStages($workspace, $user, $role)
    {
        try {
            if (!class_exists('\App\Models\TaskStage') || !$workspace) {
                return [];
            }
            
            $stages = \App\Models\TaskStage::where('workspace_id', $workspace->id)
                ->withCount(['tasks' => function($q) use ($workspace, $user, $role) {
                    $q->whereHas('project', function($pq) use ($workspace) {
                        $pq->where('workspace_id', $workspace->id);
                    });
                    if ($role !== 'company') {
                        $q->where('assigned_to', $user->id);
                    }
                }])->get();
            
            return $stages->map(function($stage) {
                return [
                    'name' => $stage->name,
                    'count' => $stage->tasks_count
                ];
            })->toArray();
        } catch (\Exception $e) {
            return [];
        }
    }
    
    private function getTimesheetStats($workspace, $user, $role)
    {
        try {
            if (!class_exists('\App\Models\TimesheetEntry') || !class_exists('\App\Models\Timesheet') || !$workspace) {
                return ['totalHours' => 0, 'thisWeek' => 0, 'pendingApprovals' => 0];
            }
            
            $entryQuery = \App\Models\TimesheetEntry::whereHas('timesheet.user', function($q) use ($workspace) {
                $q->whereHas('workspaces', function($wq) use ($workspace) {
                    $wq->where('workspace_id', $workspace->id);
                });
            });
            
            $timesheetQuery = \App\Models\Timesheet::whereHas('user', function($q) use ($workspace) {
                $q->whereHas('workspaces', function($wq) use ($workspace) {
                    $wq->where('workspace_id', $workspace->id);
                });
            });
            
            // Non-company workspace roles only see their own timesheet data
            if ($role !== 'company') {
                $entryQuery->whereHas('timesheet', function($q) use ($user) {
                    $q->where('user_id', $user->id);
                });
                $timesheetQuery->where('user_id', $user->id);
            }
            
            $totalHours = (clone $entryQuery)->sum('hours') ?? 0;
            $thisWeek = (clone $entryQuery)->whereBetween('date', [now()->startOfWeek(), now()->endOfWeek()])
                ->sum('hours') ?? 0;
            $pendingApprovals = (clone $timesheetQuery)->where('status', 'submitted')->count();
            
            return [
                'totalHours' => (int)$totalHours,
                'thisWeek' => (int)$thisWeek,
                'pendingApprovals' => $pendingApprovals
            ];
        } catch (\Exception $e) {
            return ['totalHours' => 0, 'thisWeek' => 0, 'pendingApprovals' => 0];
        }
    }
    
    private function getBudgetStats($workspace, $user, $role)
    {
        try {
            if (!class_exists('\App\Models\ProjectBudget') || !class_exists('\App\Models\ProjectExpense') || !$workspace) {
                return ['totalBudget' => 0, 'spent' => 0, 'remaining' => 0, 'utilization' => 0];
            }
            
            $budgetQuery = \App\Models\ProjectBudget::whereHas('project', function($q) use ($workspace, $user, $role) {
                $q->where('workspace_id', $workspace->id);
                if ($role === 'client') {
                    $q->whereHas('clients', function($m) use ($user) {
                        $m->where('user_id', $user->id);
                    });
                } elseif ($role !== 'company') {
                    $q->whereHas('members', function($m) use ($user) {
                        $m->where('user_id', $user->id);
                    });
                }
            });
            
            $expenseQuery = \App\Models\ProjectExpense::whereHas('project', function($q) use ($workspace, $user, $role) {
                $q->where('workspace_id', $workspace->id);
                if ($role === 'client') {
                    $q->whereHas('clients', function($m) use ($user) {
                        $m->where('user_id', $user->id);
                    });
                } elseif ($role !== 'company') {
                    $q->whereHas('members', function($m) use ($user) {
                        $m->where('user_id', $user->id);
                    });
                }
            })->where('status', 'approved');
            
            $totalBudget = $budgetQuery->sum('total_budget') ?? 0;
            $spent = $expenseQuery->sum('amount') ?? 0;
            $remaining = $totalBudget - $spent;
            $utilization = $totalBudget > 0 ? ($spent / $totalBudget) * 100 : 0;
            
            return [
                'totalBudget' => (int)$totalBudget,
                'spent' => (int)$spent,
                'remaining' => (int)$remaining,
                'utilization' => round($utilization, 1)
            ];
        } catch (\Exception $e) {
            return ['totalBudget' => 0, 'spent' => 0, 'remaining' => 0, 'utilization' => 0];
        }
    }
    
    private function getInvoiceStats($workspace, $user, $role)
    {
        try {
            if (!class_exists('\App\Models\Invoice') || !$workspace) {
                return ['total' => 0, 'paid' => 0, 'pending' => 0, 'overdue' => 0];
            }
            
            $baseQuery = \App\Models\Invoice::whereHas('project', function($q) use ($workspace, $user, $role) {
                $q->where('workspace_id', $workspace->id);
                if ($role === 'client') {
                    $q->whereHas('clients', function($m) use ($user) {
                        $m->where('user_id', $user->id);
                    });
                } elseif ($role !== 'company') {
                    $q->whereHas('members', function($m) use ($user) {
                        $m->where('user_id', $user->id);
                    });
                }
            });
            
            $total = (clone $baseQuery)->count();
            $paid = (clone $baseQuery)->where('status', 'paid')->count();
            $pending = (clone $baseQuery)->whereIn('status', ['draft', 'sent', 'viewed'])->count();
            $overdue = (clone $baseQuery)->where('due_date', '<', now())
                ->where('status', '!=', 'paid')->count();
            
            return [
                'total' => $total,
                'paid' => $paid,
                'pending' => $pending,
                'overdue' => $overdue
            ];
        } catch (\Exception $e) {
            return ['total' => 0, 'paid' => 0, 'pending' => 0, 'overdue' => 0];
        }
    }
    
    private function getBugStats($workspace, $user, $role)
    {
        try {
            if (!class_exists('\App\Models\Bug') || !class_exists('\App\Models\BugStatus') || !$workspace) {
                return [];
            }
            
            $statuses = \App\Models\BugStatus::where('workspace_id', $workspace->id)
                ->withCount(['bugs' => function($q) use ($workspace, $user, $role) {
                    $q->whereHas('project', function($pq) use ($workspace, $user, $role) {
                        $pq->where('workspace_id', $workspace->id);
                        if ($role === 'client') {
                            $pq->whereHas('clients', function($m) use ($user) {
                                $m->where('user_id', $user->id);
                            });
                        } elseif ($role !== 'company') {
                            $pq->whereHas('members', function($m) use ($user) {
                                $m->where('user_id', $user->id);
                            });
                        }
                    });
                }])
                ->take(6)
                ->get();
            
            return $statuses->map(function($status) {
                return [
                    'name' => $status->name,
                    'count' => $status->bugs_count
                ];
            })->toArray();
        } catch (\Exception $e) {
            return [];
        }
    }
    
    private function getExpenseStats($workspace, $user, $role)
    {
        try {
            if (!class_exists('\App\Models\ProjectExpense') || !$workspace) {
                return ['pending' => 0, 'approved' => 0, 'total' => 0];
            }
            
            $baseQuery = \App\Models\ProjectExpense::whereHas('project', function($q) use ($workspace, $user, $role) {
                $q->where('workspace_id', $workspace->id);
                if ($role === 'client') {
                    $q->whereHas('clients', function($m) use ($user) {
                        $m->where('user_id', $user->id);
                    });
                } elseif ($role !== 'company') {
                    $q->whereHas('members', function($m) use ($user) {
                        $m->where('user_id', $user->id);
                    });
                }
            });
            
            $total = (clone $baseQuery)->count();
            $pending = (clone $baseQuery)->where('status', 'pending')->count();
            $approved = (clone $baseQuery)->where('status', 'approved')->count();
            
            return [
                'total' => $total,
                'pending' => $pending,
                'approved' => $approved
            ];
        } catch (\Exception $e) {
            return ['pending' => 0, 'approved' => 0, 'total' => 0];
        }
    }
    
    private function getRecentActivities($workspace, $user, $role)
    {
        try {
            if (!$workspace) {
                return config('app.demo_mode', false) ? $this->getDefaultActivities() : [];
            }
            
            $query = \App\Models\ProjectActivity::whereHas('project', function($q) use ($workspace, $user, $role) {
                $q->where('workspace_id', $workspace->id);
                // Non-company workspace roles only see activities from their projects
                if ($role === 'client') {
                    $q->whereHas('clients', function($m) use ($user) {
                        $m->where('user_id', $user->id);
                    });
                } elseif ($role !== 'company') {
                    $q->whereHas('members', function($m) use ($user) {
                        $m->where('user_id', $user->id);
                    });
                }
            });
            
            // Non-company workspace roles only see their own activities
            if ($role !== 'company') {
                $query->where('user_id', $user->id);
            }
            
            $activities = $query->with('user')
                ->orderBy('created_at', 'desc')
                ->limit(10)
                ->get()
                ->map(function($activity) {
                    return [
                        'id' => $activity->id,
                        'type' => $activity->type ?? 'activity',
                        'description' => $activity->description,
                        'user' => $activity->user->name ?? 'Unknown User',
                        'time' => $activity->created_at->diffForHumans(),
                        'avatar' => check_file($activity->user->avatar) ? get_file($activity->user->avatar) : get_file('avatars/avatar.png'),

                    ];
                });
            
            // If no activities found, return default activities only in demo mode
            if ($activities->isEmpty()) {
                return config('app.demo_mode', false) ? $this->getDefaultActivities() : [];
            }
            
            return $activities->toArray();
        } catch (\Exception $e) {
            return config('app.demo_mode', false) ? $this->getDefaultActivities() : [];
        }
    }
    
    private function getDefaultActivities()
    {
        return [
            [
                'id' => 1, 
                'type' => 'task', 
                'description' => 'Task "API Integration for Payment Gateway" completed successfully', 
                'user' => 'John Doe', 
                'time' => '2 hours ago'
            ],
            [
                'id' => 2, 
                'type' => 'project', 
                'description' => 'New project "E-commerce Mobile App" created with initial setup', 
                'user' => 'Jane Smith', 
                'time' => '3 hours ago'
            ],
            [
                'id' => 3, 
                'type' => 'expense', 
                'description' => 'Travel expense of $450 approved for client meeting', 
                'user' => 'Mike Johnson', 
                'time' => '4 hours ago'
            ],
            [
                'id' => 4, 
                'type' => 'bug', 
                'description' => 'Critical security bug fixed in user authentication system', 
                'user' => 'Sarah Wilson', 
                'time' => '5 hours ago'
            ],
            [
                'id' => 5, 
                'type' => 'invoice', 
                'description' => 'Invoice #INV-2024-001 sent to client for $2,500', 
                'user' => 'David Brown', 
                'time' => '6 hours ago'
            ],
            [
                'id' => 6, 
                'type' => 'timesheet', 
                'description' => 'Weekly timesheet submitted for approval (40 hours)', 
                'user' => 'Emily Davis', 
                'time' => '8 hours ago'
            ],
            [
                'id' => 7, 
                'type' => 'project', 
                'description' => 'Project "Website Redesign" milestone completed ahead of schedule', 
                'user' => 'Alex Chen', 
                'time' => '10 hours ago'
            ],
            [
                'id' => 8, 
                'type' => 'task', 
                'description' => 'Database optimization task assigned to development team', 
                'user' => 'Lisa Wang', 
                'time' => '12 hours ago'
            ],
            [
                'id' => 9, 
                'type' => 'expense', 
                'description' => 'Software license renewal expense of $199 submitted', 
                'user' => 'Tom Anderson', 
                'time' => '1 day ago'
            ],
            [
                'id' => 10, 
                'type' => 'bug', 
                'description' => 'UI responsiveness issue reported on mobile devices', 
                'user' => 'Rachel Green', 
                'time' => '1 day ago'
            ]
        ];
    }
    
    private function getTimesheetStatusChart($workspace, $user, $role)
    {
        try {
            $colors = [
                'approved'  => '#10b981',
                'submitted' => '#f59e0b',
                'draft'     => '#6366f1',
                'rejected'  => '#ef4444',
            ];
            if (isDemo()) {
                return [
                    ['status' => 'Approved',  'count' => 652, 'color' => $colors['approved']],
                    ['status' => 'Submitted', 'count' => 320, 'color' => $colors['submitted']],
                    ['status' => 'Draft',     'count' => 488, 'color' => $colors['draft']],
                ];
            }
            if (!class_exists('\App\Models\Timesheet') || !$workspace) return null;
            $query = \App\Models\Timesheet::where('workspace_id', $workspace->id);
            if ($role !== 'company') {
                $query->where('user_id', $user->id);
            }
            $results = $query->selectRaw('status, COUNT(*) as count')
                ->groupBy('status')
                ->get();
            return $results->map(function ($row) use ($colors) {
                return [
                    'status' => ucfirst($row->status),
                    'count'  => (int) $row->count,
                    'color'  => $colors[$row->status] ?? '#94a3b8',
                ];
            })->toArray();
        } catch (\Exception $e) { return null; }
    }

    private function getPendingTimesheets($workspace, $user, $role)
    {
        try {
            if (!class_exists('\App\Models\Timesheet') || !$workspace) return [];
            $query = \App\Models\Timesheet::where('workspace_id', $workspace->id)
                ->where('status', 'submitted')
                ->with('user')
                ->orderBy('submitted_at', 'desc');
            if ($role === 'client') {
                $projectIds = \App\Models\ProjectClient::where('user_id', $user->id)->pluck('project_id');
                $memberUserIds = \App\Models\ProjectMember::whereIn('project_id', $projectIds)->pluck('user_id');
                $query->whereIn('user_id', $memberUserIds);
            } elseif ($role !== 'company') {
                $query->where('user_id', $user->id);
            }
            return $query->get()->map(function ($ts) {
                return [
                    'id'          => $ts->id,
                    'user'        => $ts->user->name ?? 'Unknown',
                    'avatar'      => $ts->user && check_file($ts->user->avatar) ? get_file($ts->user->avatar) : null,
                    'period'      => formatDateTime($ts->start_date, false) . ' - ' . formatDateTime($ts->end_date, false),
                    'total_hours' => (float) $ts->total_hours,
                    'submitted_at' => $ts->submitted_at ? \Carbon\Carbon::parse($ts->submitted_at)->diffForHumans() : '-',
                ];
            })->toArray();
        } catch (\Exception $e) { return []; }
    }

    private function getRecentBugs($workspace, $user, $role)
    {
        try {
            if (!class_exists('\App\Models\Bug') || !$workspace) return [];
            $query = \App\Models\Bug::whereHas('project', function ($q) use ($workspace, $user, $role) {
                $q->where('workspace_id', $workspace->id);
                if ($role === 'client') {
                    $q->whereHas('clients', function ($m) use ($user) { $m->where('user_id', $user->id); });
                } elseif ($role !== 'company') {
                    $q->whereHas('members', function ($m) use ($user) { $m->where('user_id', $user->id); });
                }
            })->with(['project', 'bugStatus'])
              ->orderBy('created_at', 'desc')
              ->limit(5);
            return $query->get()->map(function ($bug) {
                return [
                    'id'          => $bug->id,
                    'title'       => $bug->title,
                    'priority'    => $bug->priority,
                    'status'      => $bug->bugStatus->name ?? 'Unknown',
                    'project'     => $bug->project->title ?? '-',
                    'reported_at' => $bug->created_at->diffForHumans(),
                ];
            })->toArray();
        } catch (\Exception $e) { return []; }
    }

    private function getPendingInvoices($workspace, $user, $role)
    {
        try {
            if (!class_exists('\App\Models\Invoice') || !$workspace) return [];
            $query = \App\Models\Invoice::where('workspace_id', $workspace->id)
                ->whereIn('status', ['draft', 'sent', 'viewed', 'overdue'])
                ->with('project')
                ->orderBy('due_date', 'asc')
                ->limit(5);
            if ($role === 'client') {
                $query->where('client_id', $user->id);
            }
            return $query->get()->map(function ($inv) {
                return [
                    'id'             => $inv->id,
                    'invoice_number' => $inv->invoice_number,
                    'title'          => $inv->title,
                    'total_amount'   => (float) $inv->total_amount,
                    'due_date'       => $inv->due_date,
                    'status'         => $inv->status,
                    'project'        => $inv->project->title ?? '-',
                ];
            })->toArray();
        } catch (\Exception $e) { return []; }
    }

    private function getOngoingProjects($workspace, $user, $role)
    {
        try {
            if (!class_exists('\App\Models\Project') || !$workspace) return [];
            $query = \App\Models\Project::where('workspace_id', $workspace->id)
                ->where('status', 'active')
                ->withCount('members')
                ->orderBy('deadline', 'asc');
            if ($role === 'client') {
                $query->whereHas('clients', function ($q) use ($user) { $q->where('user_id', $user->id); });
            } elseif ($role !== 'company') {
                $query->whereHas('members', function ($q) use ($user) { $q->where('user_id', $user->id); });
            }
            return $query->get()->map(function ($proj) {
                return [
                    'id'       => $proj->id,
                    'title'    => $proj->title,
                    'priority' => $proj->priority,
                    'progress' => $proj->progress ?? 0,
                    'deadline' => $proj->deadline ? formatDateTime($proj->deadline, false) : '-',
                    'members'  => $proj->members_count ?? 0,
                ];
            })->toArray();
        } catch (\Exception $e) { return []; }
    }

    private function getRecentTasks($workspace, $user, $role)
    {
        try {
            if (!class_exists('\App\Models\Task') || !$workspace) return [];
            $query = \App\Models\Task::whereHas('project', function ($q) use ($workspace) {
                $q->where('workspace_id', $workspace->id);
            })->with(['project', 'taskStage'])
              ->orderBy('created_at', 'desc')
              ->limit(5);
            if ($role === 'client') {
                $query->where(function ($q) use ($user) {
                    $q->where('assigned_to', $user->id)
                      ->orWhereHas('project.clients', function ($pm) use ($user) { $pm->where('user_id', $user->id); });
                });
            } elseif ($role !== 'company') {
                $query->where('assigned_to', $user->id);
            }
            return $query->get()->map(function ($task) {
                return [
                    'id'         => $task->id,
                    'title'      => $task->title,
                    'priority'   => $task->priority,
                    'stage'      => $task->taskStage->name ?? '-',
                    'project'    => $task->project->title ?? '-',
                    'due_date'   => $task->end_date,
                    'updated_at' => $task->updated_at->diffForHumans(),
                ];
            })->toArray();
        } catch (\Exception $e) { return []; }
    }

    private function getPendingExpenses($workspace, $user, $role)
    {
        try {
            if (!class_exists('\App\Models\ProjectExpense') || !$workspace) return [];
            $query = \App\Models\ProjectExpense::whereHas('project', function ($q) use ($workspace, $user, $role) {
                $q->where('workspace_id', $workspace->id);
                if ($role === 'client') {
                    $q->whereHas('clients', function ($m) use ($user) { $m->where('user_id', $user->id); });
                } elseif ($role !== 'company') {
                    $q->whereHas('members', function ($m) use ($user) { $m->where('user_id', $user->id); });
                }
            })->where('status', 'pending')
              ->with(['project', 'submitter'])
              ->orderBy('created_at', 'desc');
            return $query->get()->map(function ($exp) {
                return [
                    'id'           => $exp->id,
                    'title'        => $exp->title,
                    'amount'       => (float) $exp->amount,
                    'submitted_by' => $exp->submitter->name ?? '-',
                    'project'      => $exp->project->title ?? '-',
                    'expense_date' => $exp->expense_date,
                    'submitted_at' => $exp->created_at->diffForHumans(),
                ];
            })->toArray();
        } catch (\Exception $e) { return []; }
    }

    private function getMonthlyTimesheetHours($workspace, $user, $role, $year)
    {
        try {
            if (isDemo()) {
                $demoHours = [42, 38, 55, 61, 48, 72, 65, 80, 58, 74, 69, 88];
                $data = [];
                for ($i = 1; $i <= 12; $i++) {
                    $data[] = [
                        'month' => date('F Y', mktime(0, 0, 0, $i, 1, $year)),
                        'short' => date('M', mktime(0, 0, 0, $i, 1, $year)),
                        'hours' => $demoHours[$i - 1],
                    ];
                }
                return $data;
            }

            if (!class_exists('\App\Models\TimesheetEntry') || !$workspace) {
                return null;
            }

            $data = [];
            for ($i = 1; $i <= 12; $i++) {
                $query = \App\Models\TimesheetEntry::whereHas('timesheet.user', function ($q) use ($workspace) {
                    $q->whereHas('workspaces', function ($wq) use ($workspace) {
                        $wq->where('workspace_id', $workspace->id);
                    });
                })->whereYear('date', $year)->whereMonth('date', $i);

                if ($role !== 'company') {
                    $query->where('user_id', $user->id);
                }

                $hours = (float) $query->sum('hours');
                $data[] = [
                    'month' => date('F Y', mktime(0, 0, 0, $i, 1, $year)),
                    'short' => date('M', mktime(0, 0, 0, $i, 1, $year)),
                    'hours' => round($hours, 1),
                ];
            }
            return $data;
        } catch (\Exception $e) {
            return null;
        }
    }

    private function getMonthlyTaskCompletion($workspace, $user, $role, $year)
    {
        try {
            if (isDemo()) {
                $demoCreated   = [8, 12, 10, 15, 11, 18, 14, 20, 16, 22, 19, 25];
                $demoCompleted = [5,  9,  7, 11,  8, 14, 11, 17, 13, 18, 15, 21];
                $data = [];
                for ($i = 1; $i <= 12; $i++) {
                    $data[] = [
                        'month'     => date('F Y', mktime(0, 0, 0, $i, 1, $year)),
                        'short'     => date('M', mktime(0, 0, 0, $i, 1, $year)),
                        'created'   => $demoCreated[$i - 1],
                        'completed' => $demoCompleted[$i - 1],
                    ];
                }
                return $data;
            }

            if (!class_exists('\App\Models\Task') || !class_exists('\App\Models\TaskStage') || !$workspace) {
                return null;
            }

            $completedStageIds = \App\Models\TaskStage::where('workspace_id', $workspace->id)
                ->where(function ($q) {
                    $q->where('name', 'like', '%done%')
                      ->orWhere('name', 'like', '%completed%')
                      ->orWhere('name', 'like', '%finished%');
                })->pluck('id');

            $data = [];
            for ($i = 1; $i <= 12; $i++) {
                $baseQuery = \App\Models\Task::whereHas('project', function ($q) use ($workspace) {
                    $q->where('workspace_id', $workspace->id);
                })->whereYear('created_at', $year)->whereMonth('created_at', $i);

                if ($role === 'client') {
                    $baseQuery->where(function ($q) use ($user) {
                        $q->where('assigned_to', $user->id)
                          ->orWhereHas('project.clients', function ($pm) use ($user) {
                              $pm->where('user_id', $user->id);
                          });
                    });
                } elseif ($role !== 'company') {
                    $baseQuery->where(function ($q) use ($user) {
                        $q->where('assigned_to', $user->id)
                          ->orWhereHas('project.members', function ($pm) use ($user) {
                              $pm->where('user_id', $user->id);
                          });
                    });
                }

                $created   = (clone $baseQuery)->count();
                $completed = (clone $baseQuery)->whereIn('task_stage_id', $completedStageIds)->count();

                $data[] = [
                    'month'     => date('F Y', mktime(0, 0, 0, $i, 1, $year)),
                    'short'     => date('M', mktime(0, 0, 0, $i, 1, $year)),
                    'created'   => $created,
                    'completed' => $completed,
                ];
            }
            return $data;
        } catch (\Exception $e) {
            return null;
        }
    }

    private function getMonthlyInvoiceRevenue($workspace, $user, $role, $year)
    {
        try {
            if (isDemo()) {
                $demoRevenue = [1200, 2400, 1800, 3200, 2800, 4100, 3600, 5200, 4400, 6100, 5500, 7800];
                $data = [];
                for ($i = 1; $i <= 12; $i++) {
                    $data[] = [
                        'month'   => date('F Y', mktime(0, 0, 0, $i, 1, $year)),
                        'short'   => date('M', mktime(0, 0, 0, $i, 1, $year)),
                        'revenue' => (float) $demoRevenue[$i - 1],
                    ];
                }
                return $data;
            }

            if (!class_exists('\App\Models\Invoice') || !$workspace) {
                return null;
            }

            $data = [];
            for ($i = 1; $i <= 12; $i++) {
                $query = \App\Models\Invoice::whereHas('project', function ($q) use ($workspace, $user, $role) {
                    $q->where('workspace_id', $workspace->id);
                    if ($role === 'client') {
                        $q->whereHas('clients', function ($m) use ($user) {
                            $m->where('user_id', $user->id);
                        });
                    }
                })->where('status', 'paid')
                  ->whereYear('updated_at', $year)
                  ->whereMonth('updated_at', $i);

                $data[] = [
                    'month'   => date('F Y', mktime(0, 0, 0, $i, 1, $year)),
                    'short'   => date('M', mktime(0, 0, 0, $i, 1, $year)),
                    'revenue' => (float) $query->sum('total_amount'),
                ];
            }
            return $data;
        } catch (\Exception $e) {
            return null;
        }
    }

    private function renderSuperAdminDashboard()
    {
        try {
            $revenueYear = (int) request('revenueYear', now()->year);
            $companiesYear = (int) request('companiesYear', now()->year);

            // Get actual data for super admin
            $totalCompanies = $this->getTotalCompanies();
            $totalPlans = $this->getTotalPlans();
            $totalOrders = $this->getTotalOrders();
            $totalRevenue = $this->getTotalRevenue();
            
            $companies = $this->getCompanyStats();
            $plans = $this->getPlanStats();
            $planOrders = $this->getPlanOrderStats();
            $planRequests = $this->getPlanRequestStats();
            $coupons = $this->getCouponStats();
            $revenue = $this->getRevenueStats();
            $mostBoughtPlan = $this->getMostBoughtPlan();
            $mostUsedCoupon = $this->getMostUsedCoupon();
            $recentActivities = $this->getSuperAdminRecentActivities();

            // stats object (reference style)
            $totalActivePlanCompanies = 0;
            try {
                $totalActivePlanCompanies = \App\Models\User::where('type', 'company')
                    ->where('plan_is_active', '1')
                    ->whereHas('ownedWorkspaces')
                    ->count();
            } catch (\Exception $e) {}

            $totalUsers = 0;
            try {
                $totalUsers = \App\Models\User::whereNotIn('type', ['superadmin', 'super admin'])->count();
            } catch (\Exception $e) {}

            $pendingRequests = $planRequests['pending'] ?? 0;
            $activeCoupons = $coupons['active'] ?? 0;

            // Monthly growth
            $monthlyGrowth = 0;
            try {
                if (isDemo()) {
                    $monthlyGrowth = 55;
                } else {
                    $currentMonth = \App\Models\User::where('type', 'company')
                        ->whereMonth('created_at', now()->month)->whereYear('created_at', now()->year)->count();
                    $prevMonth = \App\Models\User::where('type', 'company')
                        ->whereMonth('created_at', now()->subMonth()->month)->whereYear('created_at', now()->subMonth()->year)->count();
                    $monthlyGrowth = $prevMonth > 0 ? round((($currentMonth - $prevMonth) / $prevMonth) * 100, 1) : ($currentMonth > 0 ? 100 : 0);
                }
            } catch (\Exception $e) {}

            // Monthly revenue (12 months)
            $monthlyRevenue = [];
            try {
                if (isDemo()) {
                    $demoRevenue = [4200, 5800, 3900, 7100, 6400, 8900, 7600, 9200, 8100, 10500, 9800, 12400];
                    for ($i = 1; $i <= 12; $i++) {
                        $monthlyRevenue[] = [
                            'month' => date('F Y', mktime(0, 0, 0, $i, 1, $revenueYear)),
                            'short' => date('M', mktime(0, 0, 0, $i, 1, $revenueYear)),
                            'revenue' => (float) $demoRevenue[$i - 1],
                        ];
                    }
                } else {
                    for ($i = 1; $i <= 12; $i++) {
                        $rev = class_exists('\App\Models\PlanOrder')
                            ? \App\Models\PlanOrder::whereIn('status', ['approved', 'completed', 'paid'])
                                ->whereMonth('created_at', $i)->whereYear('created_at', $revenueYear)->sum('final_price') ?? 0
                            : 0;
                        $monthlyRevenue[] = [
                            'month' => date('F Y', mktime(0, 0, 0, $i, 1, $revenueYear)),
                            'short' => date('M', mktime(0, 0, 0, $i, 1, $revenueYear)),
                            'revenue' => (float) $rev,
                        ];
                    }
                }
            } catch (\Exception $e) {
                for ($i = 1; $i <= 12; $i++) {
                    $monthlyRevenue[] = ['month' => date('F Y', mktime(0,0,0,$i,1,$revenueYear)), 'short' => date('M', mktime(0,0,0,$i,1,$revenueYear)), 'revenue' => 0];
                }
            }

            // Monthly companies (12 months)
            $monthlyCompanies = [];
            try {
                if (isDemo()) {
                    $demoCompanies = [3, 5, 4, 7, 6, 9, 8, 11, 7, 13, 10, 15];
                    for ($i = 1; $i <= 12; $i++) {
                        $monthlyCompanies[] = [
                            'month' => date('F Y', mktime(0, 0, 0, $i, 1, $companiesYear)),
                            'short' => date('M', mktime(0, 0, 0, $i, 1, $companiesYear)),
                            'count' => $demoCompanies[$i - 1],
                        ];
                    }
                } else {
                    for ($i = 1; $i <= 12; $i++) {
                        $count = \App\Models\User::where('type', 'company')
                            ->whereMonth('created_at', $i)->whereYear('created_at', $companiesYear)->count();
                        $monthlyCompanies[] = [
                            'month' => date('F Y', mktime(0, 0, 0, $i, 1, $companiesYear)),
                            'short' => date('M', mktime(0, 0, 0, $i, 1, $companiesYear)),
                            'count' => $count,
                        ];
                    }
                }
            } catch (\Exception $e) {
                for ($i = 1; $i <= 12; $i++) {
                    $monthlyCompanies[] = ['month' => date('F Y', mktime(0,0,0,$i,1,$companiesYear)), 'short' => date('M', mktime(0,0,0,$i,1,$companiesYear)), 'count' => 0];
                }
            }

            // Available years
            $availableYears = range(now()->year + 1, now()->year - 4);

            // Top plans
            $topPlans = [];
            try {
                if (class_exists('\App\Models\Plan')) {
                    $topPlans = \App\Models\Plan::withCount(['users' => function($q) {
                            $q->whereHas('ownedWorkspaces');
                        }])
                        ->orderBy('users_count', 'desc')->take(3)->get()
                        ->map(function($plan) {
                            return [
                                'name' => $plan->name,
                                'subscribers' => $plan->users_count,
                                'revenue' => $plan->users_count * ($plan->price ?? 0),
                            ];
                        })->toArray();
                }
            } catch (\Exception $e) {}

            // Recent activity (companies)
            $recentActivity = [];
            try {
                $recentActivity = \App\Models\User::where('type', 'company')
                    ->orderBy('created_at', 'desc')->take(5)
                    ->get(['id', 'name', 'email', 'avatar', 'created_at'])
                    ->map(function($company) {
                        return [
                            'id' => $company->id,
                            'name' => $company->name,
                            'email' => $company->email,
                            'avatar' => check_file($company->avatar) ? get_file($company->avatar) : get_file('avatars/avatar.png'),
                            'registered_at' => $company->created_at->diffForHumans(),
                            'status' => 'active',
                        ];
                    })->toArray();
            } catch (\Exception $e) {}
            
            $dashboardData = [
                'cards' => [
                    [
                        'title' => __('Total Companies'),
                        'value' => $companies['total'] ?? $totalCompanies,
                        'icon' => 'Building2',
                    ],
                    [
                        'title' => __('Total Plans'),
                        'value' => $plans['total'] ?? $totalPlans,
                        'icon' => 'Package',
                    ],
                    [
                        'title' => __('Total Orders'),
                        'value' => $planOrders['total'] ?? $totalOrders,
                        'icon' => 'ShoppingCart',
                    ],
                    [
                        'title' => __('Total Revenue'),
                        'value' => $totalRevenue,
                        'format' => 'currency',
                        'icon' => 'DollarSign',
                    ]
                ],
                'stats' => [
                    'totalCompanies'           => $totalCompanies,
                    'totalActivePlanCompanies' => $totalActivePlanCompanies,
                    'totalUsers'               => $totalUsers,
                    'totalRevenue'             => $totalRevenue,
                    'activePlans'              => $plans['active'] ?? 0,
                    'pendingRequests'          => $pendingRequests,
                    'monthlyGrowth'            => $monthlyGrowth,
                    'activeCoupons'            => $activeCoupons,
                ],
                'companies' => $companies,
                'plans' => $plans,
                'planOrders' => $planOrders,
                'planRequests' => $planRequests,
                'coupons' => $coupons,
                'revenue' => $revenue,
                'mostBoughtPlan' => $mostBoughtPlan,
                'mostUsedCoupon' => $mostUsedCoupon,
                'recentActivities' => $recentActivities,
                'recentCompanies' => $this->getRecentCompanies(),
                'recentActivity' => $recentActivity,
                'topPlans' => $topPlans,
                'monthlyRevenue' => $monthlyRevenue,
                'monthlyCompanies' => $monthlyCompanies,
                'revenueYear' => $revenueYear,
                'companiesYear' => $companiesYear,
                'availableYears' => $availableYears,
            ];

            return Inertia::render('dashboard', [
                'dashboardData' => $dashboardData,
                'isSuperAdmin' => true,
                'permissions' => []
            ]);
        } catch (\Exception $e) {
            \Log::error('Super Admin Dashboard Error: ' . $e->getMessage());
            return Inertia::render('dashboard', [
                'dashboardData' => ['cards' => [], 'error' => 'Dashboard loading error'],
                'isSuperAdmin' => true,
                'permissions' => []
            ]);
        }
    }
    
    private function getTotalCompanies()
    {
        try {
            return \App\Models\User::where('type', 'company')
                ->whereHas('ownedWorkspaces')
                ->count();
        } catch (\Exception $e) {
            return 0;
        }
    }
    
    private function getTotalPlans()
    {
        try {
            if (class_exists('\App\Models\Plan')) {
                return \App\Models\Plan::count();
            }
            return 0;
        } catch (\Exception $e) {
            return 0;
        }
    }
    
    private function getTotalOrders()
    {
        try {
            if (class_exists('\App\Models\PlanOrder')) {
                return \App\Models\PlanOrder::count();
            }
            return 0;
        } catch (\Exception $e) {
            return 0;
        }
    }
    
    private function getTotalRevenue()
    {
        try {
            if (class_exists('\App\Models\PlanOrder')) {
                return \App\Models\PlanOrder::whereIn('status', ['approved', 'completed', 'paid'])
                    ->sum('final_price') ?? 0;
            }
            return 0;
        } catch (\Exception $e) {
            return 0;
        }
    }
    
    private function getCompanyStats()
    {
        try {
            $total = \App\Models\User::where('type', 'company')->count();
            $active = \App\Models\User::where('type', 'company')
                ->where('status', 'active')
                ->orWhereNull('status')
                ->count();
            $inactive = $total - $active;
            
            return [
                'total' => $total,
                'active' => $active,
                'inactive' => $inactive
            ];
        } catch (\Exception $e) {
            return ['total' => 0, 'active' => 0, 'inactive' => 0];
        }
    }
    
    private function getPlanStats()
    {
        try {
            if (class_exists('\App\Models\Plan')) {
                $total = \App\Models\Plan::count();
                $active = \App\Models\Plan::where('is_plan_enable', 'on')->count();
                $inactive = $total - $active;
                
                return [
                    'total' => $total,
                    'active' => $active,
                    'inactive' => $inactive
                ];
            }
            return ['total' => 0, 'active' => 0, 'inactive' => 0];
        } catch (\Exception $e) {
            return ['total' => 0, 'active' => 0, 'inactive' => 0];
        }
    }
    
    private function getPlanOrderStats()
    {
        try {
            if (class_exists('\App\Models\PlanOrder')) {
                $total = \App\Models\PlanOrder::count();
                $pending = \App\Models\PlanOrder::where('status', 'pending')->count();
                $approved = \App\Models\PlanOrder::where('status', 'approved')->count();
                $rejected = \App\Models\PlanOrder::where('status', 'rejected')->count();
                
                return [
                    'total' => $total,
                    'pending' => $pending,
                    'approved' => $approved,
                    'rejected' => $rejected
                ];
            }
            return ['total' => 0, 'pending' => 0, 'approved' => 0, 'rejected' => 0];
        } catch (\Exception $e) {
            return ['total' => 0, 'pending' => 0, 'approved' => 0, 'rejected' => 0];
        }
    }
    
    private function getPlanRequestStats()
    {
        try {
            if (class_exists('\App\Models\PlanRequest')) {
                $total = \App\Models\PlanRequest::count();
                $pending = \App\Models\PlanRequest::where('status', 'pending')->count();
                $approved = \App\Models\PlanRequest::where('status', 'approved')->count();
                $rejected = \App\Models\PlanRequest::where('status', 'rejected')->count();
                
                return [
                    'total' => $total,
                    'pending' => $pending,
                    'approved' => $approved,
                    'rejected' => $rejected
                ];
            }
            return ['total' => 0, 'pending' => 0, 'approved' => 0, 'rejected' => 0];
        } catch (\Exception $e) {
            return ['total' => 0, 'pending' => 0, 'approved' => 0, 'rejected' => 0];
        }
    }
    
    private function getCouponStats()
    {
        try {
            if (class_exists('\App\Models\Coupon')) {
                $total = \App\Models\Coupon::count();
                $active = \App\Models\Coupon::where('status', true)->count();
                $expired = $total - $active;
                
                return [
                    'total' => $total,
                    'active' => $active,
                    'expired' => $expired
                ];
            }
            return ['total' => 0, 'active' => 0, 'expired' => 0];
        } catch (\Exception $e) {
            return ['total' => 0, 'active' => 0, 'expired' => 0];
        }
    }
    
    private function getRevenueStats()
    {
        try {
            if (class_exists('\App\Models\PlanOrder')) {
                $total = \App\Models\PlanOrder::whereIn('status', ['approved', 'completed', 'paid'])
                    ->sum('final_price') ?? 0;
                $monthly = \App\Models\PlanOrder::whereIn('status', ['approved', 'completed', 'paid'])
                    ->whereMonth('created_at', now()->month)
                    ->whereYear('created_at', now()->year)
                    ->sum('final_price') ?? 0;
                
                return [
                    'total' => $total,
                    'monthly' => $monthly
                ];
            }
            return ['total' => 0, 'monthly' => 0];
        } catch (\Exception $e) {
            return ['total' => 0, 'monthly' => 0];
        }
    }
    

    
    private function getSuperAdminRecentActivities()
    {
        try {
            $activities = collect();
            
            // Get recent plan orders
            if (class_exists('\App\Models\PlanOrder')) {
                $planOrders = \App\Models\PlanOrder::with('user', 'plan')->latest()->take(5)->get();
                foreach ($planOrders as $order) {
                    $activities->push([
                        'id' => $order->id,
                        'type' => 'plan_order',
                        'description' => "Plan order for {$order->plan->name}",
                        'user' => $order->user->name,
                        'avatar' => check_file($order->user->avatar) ? get_file($order->user->avatar) : get_file('avatars/avatar.png'),
                        'time' => $order->created_at->diffForHumans(),
                        'status' => $order->status
                    ]);
                }
            }
            
            // Get recent plan requests
            if (class_exists('\App\Models\PlanRequest')) {
                $planRequests = \App\Models\PlanRequest::with('user', 'plan')->latest()->take(5)->get();
                foreach ($planRequests as $request) {
                    $activities->push([
                        'id' => $request->id,
                        'type' => 'plan_request',
                        'description' => "Plan request for {$request->plan->name}",
                        'user' => $request->user->name,
                        'avatar' => check_file($request->user->avatar) ? get_file($request->user->avatar) : get_file('avatars/avatar.png'),
                        'time' => $request->created_at->diffForHumans(),
                        'status' => $request->status
                    ]);
                }
            }
            
            // Get recent company registrations
            $companies = \App\Models\User::where('type', 'company')->latest()->take(3)->get();
            foreach ($companies as $user) {
                $activities->push([
                    'id' => $user->id,
                    'type' => 'company_registration',
                    'description' => "New company registered",
                    'user' => $user->name,
                    'avatar' => check_file($user->avatar) ? get_file($user->avatar) : get_file('avatars/avatar.png'),
                    'time' => $user->created_at->diffForHumans(),
                    'status' => 'active'
                ]);
            }
            
            return $activities->sortByDesc('time')->take(10)->values()->toArray();
        } catch (\Exception $e) {
            return config('app.demo_mode', false) ? $this->getDefaultActivities() : [];
        }
    }
    
    private function getMostBoughtPlan()
    {
        try {
            if (!class_exists('\App\Models\PlanOrder') || !class_exists('\App\Models\Plan')) {
                return null;
            }
            
            $planOrder = \App\Models\PlanOrder::select('plan_id', \DB::raw('COUNT(*) as order_count'))
                ->where('status', 'approved')
                ->groupBy('plan_id')
                ->orderBy('order_count', 'desc')
                ->with('plan')
                ->first();
                
            return $planOrder ? [
                'name' => $planOrder->plan->name ?? 'Unknown Plan',
                'count' => $planOrder->order_count
            ] : null;
        } catch (\Exception $e) {
            return null;
        }
    }
    
    private function getMostUsedCoupon()
    {
        try {
            if (!class_exists('\App\Models\PlanOrder') || !class_exists('\App\Models\Coupon')) {
                return null;
            }
            
            $couponOrder = \App\Models\PlanOrder::select('coupon_id', \DB::raw('COUNT(*) as usage_count'))
                ->whereNotNull('coupon_id')
                ->groupBy('coupon_id')
                ->orderBy('usage_count', 'desc')
                ->with('coupon')
                ->first();
                
            return $couponOrder ? [
                'name' => $couponOrder->coupon->name ?? 'Unknown Coupon',
                'code' => $couponOrder->coupon->code ?? '',
                'count' => $couponOrder->usage_count
            ] : null;
        } catch (\Exception $e) {
            return null;
        }
    }
    
    private function getRecentCompanies()
    {
        try {
            $companies = \App\Models\User::where('type', 'company')
                ->latest()
                ->take(5)
                ->get()
                ->map(function($company) {
                    $plan = null;
                    if (class_exists('\App\Models\PlanOrder')) {
                        $latestOrder = \App\Models\PlanOrder::where('user_id', $company->id)
                            ->where('status', 'approved')
                            ->with('plan')
                            ->latest()
                            ->first();
                        $plan = $latestOrder ? $latestOrder->plan->name : null;
                    }
                    
                    return [
                        'id' => $company->id,
                        'name' => $company->name,
                        'email' => $company->email,
                        'plan' => $plan,
                        'registered_at' => $company->created_at->isFuture()
                            ? $company->created_at->diffForHumans(now()->addYears(10))
                            : $company->created_at->diffForHumans()
                    ];
                });
            
            return $companies->toArray();
        } catch (\Exception $e) {
            return [];
        }
    }
}