<?php

namespace App\Http\Controllers;

use App\Models\Task;
use App\Models\TimesheetEntry;
use App\Models\User;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class WorkloadController extends Controller
{
    public function index(Request $request): Response
    {
        $user = auth()->user();
        $workspace = $user->currentWorkspace;

        $range = $request->get('range', 'week');
        $startDate = $this->getStartDate($range, $request->get('start'));
        $endDate = $this->getEndDate($range, $startDate);

        $members = User::whereHas('workspaces', fn($q) => $q->where('workspace_id', $workspace->id)->where('status', 'active'))
            ->where('type', '!=', 'client')
            ->get()
            ->each(function ($u) {
                $u->avatar = check_file($u->avatar) ? get_file($u->avatar) : get_file('avatars/avatar.png');
            });

        $days = collect(CarbonPeriod::create($startDate, $endDate))->map(fn($d) => $d->format('Y-m-d'))->toArray();

        $workloadData = $members->map(function ($member) use ($workspace, $startDate, $endDate, $days) {
            $tasks = Task::where('assigned_to', $member->id)
                ->whereHas('project', fn($q) => $q->where('workspace_id', $workspace->id))
                ->where('progress', '<', 100)
                ->where(function ($q) use ($startDate, $endDate) {
                    $q->whereBetween('start_date', [$startDate, $endDate])
                        ->orWhereBetween('end_date', [$startDate, $endDate])
                        ->orWhere(function ($q2) use ($startDate, $endDate) {
                            $q2->where('start_date', '<=', $startDate)->where('end_date', '>=', $endDate);
                        });
                })
                ->with('project:id,title')
                ->get();

            $loggedEntries = TimesheetEntry::where('user_id', $member->id)
                ->whereBetween('date', [$startDate, $endDate])
                ->whereHas('timesheet', fn($q) => $q->where('workspace_id', $workspace->id))
                ->get();

            $totalEstimated = $tasks->sum('estimated_hours') ?: 0;
            $totalLogged = $loggedEntries->sum('hours');
            $taskCount = $tasks->count();

            $dailyLoad = collect($days)->map(function ($day) use ($tasks, $loggedEntries) {
                $dayTasks = $tasks->filter(function ($t) use ($day) {
                    $start = $t->start_date ? $t->start_date->format('Y-m-d') : null;
                    $end = $t->end_date ? $t->end_date->format('Y-m-d') : null;
                    if (!$start || !$end) return false;
                    return $day >= $start && $day <= $end;
                });

                $logged = $loggedEntries->where('date', Carbon::parse($day))->sum('hours');

                $estimatedDaily = $dayTasks->sum(function ($t) {
                    $start = $t->start_date;
                    $end = $t->end_date;
                    $days = max(1, $start->diffInWeekdays($end) + 1);
                    return ($t->estimated_hours ?? 0) / $days;
                });

                return [
                    'date' => $day,
                    'tasks' => $dayTasks->count(),
                    'estimated_hours' => round($estimatedDaily, 1),
                    'logged_hours' => round($logged, 1),
                ];
            })->values()->toArray();

            $capacityHours = count($days) * 8;
            $effectiveHours = $totalEstimated > 0 ? $totalEstimated : $taskCount * 2;
            $utilization = $capacityHours > 0 ? round(($effectiveHours / $capacityHours) * 100) : 0;

            return [
                'id' => $member->id,
                'name' => $member->name,
                'avatar' => $member->avatar,
                'role' => $member->designation ?? $member->type ?? 'Member',
                'task_count' => $taskCount,
                'total_estimated' => round($totalEstimated, 1),
                'total_logged' => round($totalLogged, 1),
                'capacity_hours' => $capacityHours,
                'utilization' => min($utilization, 200),
                'status' => $this->getLoadStatus($utilization),
                'daily_load' => $dailyLoad,
                'tasks' => $tasks->map(fn($t) => [
                    'id' => $t->id,
                    'title' => $t->title,
                    'project' => $t->project?->title,
                    'priority' => $t->priority,
                    'progress' => $t->progress,
                    'estimated_hours' => $t->estimated_hours,
                    'start_date' => $t->start_date?->format('Y-m-d'),
                    'end_date' => $t->end_date?->format('Y-m-d'),
                ])->values()->toArray(),
            ];
        })->sortByDesc('utilization')->values()->toArray();

        return Inertia::render('workload/Index', [
            'workload' => $workloadData,
            'days' => $days,
            'range' => $range,
            'start_date' => $startDate->format('Y-m-d'),
            'end_date' => $endDate->format('Y-m-d'),
        ]);
    }

    private function getStartDate(string $range, ?string $start): Carbon
    {
        if ($start) return Carbon::parse($start)->startOfDay();

        return match ($range) {
            'week' => Carbon::now()->startOfWeek(),
            '2weeks' => Carbon::now()->startOfWeek(),
            'month' => Carbon::now()->startOfMonth(),
            default => Carbon::now()->startOfWeek(),
        };
    }

    private function getEndDate(string $range, Carbon $start): Carbon
    {
        return match ($range) {
            'week' => $start->copy()->endOfWeek(),
            '2weeks' => $start->copy()->addWeeks(2)->subDay(),
            'month' => $start->copy()->endOfMonth(),
            default => $start->copy()->endOfWeek(),
        };
    }

    private function getLoadStatus(int $utilization): string
    {
        if ($utilization >= 120) return 'overloaded';
        if ($utilization >= 80) return 'optimal';
        if ($utilization >= 40) return 'moderate';
        return 'underutilized';
    }
}
