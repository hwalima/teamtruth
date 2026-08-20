<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Project Report – {{ $project->title ?? $project->name }}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: DejaVu Sans, Arial, sans-serif;
            font-size: 12px;
            color: #1f2937;
            background: #fff;
        }

        .container { padding: 24px 28px 32px; }

        /* ── Report title ── */
        .report-heading {
            margin-bottom: 22px;
            padding-bottom: 14px;
            border-bottom: 2px solid {{ $primaryColor }};
        }
        .report-heading .project-title {
            font-size: 20px;
            font-weight: bold;
            color: #0f172a;
            margin-bottom: 4px;
        }
        .report-heading .report-meta {
            font-size: 10px;
            color: #6b7280;
        }

        /* ── Section title ── */
        .section-title {
            font-size: 12px;
            font-weight: bold;
            color: #0f172a;
            border-left: 3px solid {{ $primaryColor }};
            padding-left: 8px;
            margin-bottom: 12px;
        }

        /* ── Card ── */
        .card {
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 16px 18px;
            margin-bottom: 18px;
        }

        /* ── Info grid ── */
        .info-grid { width: 100%; border-collapse: collapse; }
        .info-grid td { padding: 5px 10px 5px 0; vertical-align: top; width: 50%; }
        .info-label { font-size: 9px; color: #6b7280;  letter-spacing: 0.5px; margin-bottom: 2px; }
        .info-value { font-size: 11px; font-weight: 600; color: #1f2937; }

        /* ── Stat boxes ── */
        .stat-boxes { width: 100%; border-collapse: collapse; margin-top: 12px; }
        .stat-boxes td { width: 25%; padding: 3px; }
        .stat-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 10px 8px;
            text-align: center;
        }
        .stat-box .stat-num { font-size: 18px; font-weight: bold; color: {{ $primaryColor }}; }
        .stat-box .stat-lbl { font-size: 8px; color: #6b7280;  letter-spacing: 0.5px; margin-top: 2px; }

        /* ── Charts row ── */
        .charts-table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
        .charts-table td { vertical-align: top; padding: 0 6px; }
        .charts-table td:first-child { padding-left: 0; }
        .charts-table td:last-child { padding-right: 0; }

        /* ── Data tables ── */
        .data-table { width: 100%; border-collapse: collapse; }
        .data-table thead tr { background: #f8fafc; }
        .data-table th {
            padding: 8px 10px;
            text-align: left;
            font-size: 9px;
            font-weight: 700;
            color: #475569;
            letter-spacing: 0.5px;
            border-bottom: 2px solid #e2e8f0;
        }
        .data-table td {
            padding: 8px 10px;
            font-size: 11px;
            color: #374151;
            border-bottom: 1px solid #f1f5f9;
        }
        .data-table tbody tr:last-child td { border-bottom: none; }
        .data-table tbody tr:nth-child(even) td { background: #fafafa; }

        /* ── Badges — matching app UI exactly ── */
        .badge {
            display: inline-block;
            padding: 2px 7px;
            border-radius: 5px;
            font-size: 9px;
            font-weight: 600;
        }

        /* Project status */
        .badge-planning    { background: #eff6ff; color: #1d4ed8; border: 1px solid rgba(37,99,235,0.2); }
        .badge-active      { background: #f0fdf4; color: #15803d; border: 1px solid rgba(22,163,74,0.2); }
        .badge-in_progress { background: #fff7ed; color: #c2410c; border: 1px solid rgba(234,88,12,0.2); }
        .badge-completed   { background: #faf5ff; color: #7e22ce; border: 1px solid rgba(126,34,206,0.2); }
        .badge-on_hold     { background: #fefce8; color: #a16207; border: 1px solid rgba(202,138,4,0.2); }
        .badge-cancelled   { background: #fef2f2; color: #dc2626; border: 1px solid rgba(220,38,38,0.2); }

        /* Priority */
        .badge-low      { background: #f0fdf4; color: #15803d; border: 1px solid rgba(22,163,74,0.2); }
        .badge-medium   { background: #fefce8; color: #a16207; border: 1px solid rgba(202,138,4,0.2); }
        .badge-high     { background: #fff7ed; color: #c2410c; border: 1px solid rgba(234,88,12,0.2); }
        .badge-critical { background: #fef2f2; color: #dc2626; border: 1px solid rgba(220,38,38,0.2); }

        /* Milestone status */
        .badge-pending  { background: #fff7ed; color: #c2410c; border: 1px solid rgba(234,88,12,0.2); }

        /* ── Progress bar ── */
        .progress-wrap {
            background: #e5e7eb;
            border-radius: 4px;
            height: 6px;
            width: 70px;
            display: inline-block;
            vertical-align: middle;
            margin-right: 5px;
        }
        .progress-fill {
            background: {{ $primaryColor }};
            border-radius: 4px;
            height: 6px;
        }

        /* ── Footer ── */
        .page-footer {
            margin-top: 24px;
            padding-top: 10px;
            border-top: 1px solid #e2e8f0;
            text-align: center;
            font-size: 9px;
            color: #9ca3af;
        }
    </style>
</head>
<body>
<div class="container">

    {{-- REPORT HEADING --}}
    <div class="report-heading">
        <div class="project-title">{{ $project->title ?? $project->name }}</div>
        <div class="report-meta">
            Project Report &nbsp;·&nbsp; Generated on {{ date('F j, Y') }} at {{ date('H:i') }}
            &nbsp;·&nbsp; Status: <strong>{{ $projectStatusText }}</strong>
        </div>
    </div>

    {{-- OVERVIEW --}}
    <div class="card">
        <div class="section-title">Project Overview</div>
        <table style="width:100%;border-collapse:collapse;">
            <tr>
                <td style="width:58%;vertical-align:top;padding-right:18px;">
                    <table class="info-grid">
                        <tr>
                            <td>
                                <div class="info-label">Project Name</div>
                                <div class="info-value">{{ $project->title ?? $project->name }}</div>
                            </td>
                            <td>
                                <div class="info-label">Status</div>
                                <div class="info-value">
                                    <span class="badge badge-{{ $project->status }}">{{ $projectStatusText }}</span>
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <div class="info-label">Start Date</div>
                                <div class="info-value">
                                    {{ $project->start_date ? \Carbon\Carbon::parse($project->start_date)->format('M j, Y') : '—' }}
                                </div>
                            </td>
                            <td>
                                <div class="info-label">Due Date</div>
                                <div class="info-value">
                                    {{ ($project->deadline ?? $project->end_date) ? \Carbon\Carbon::parse($project->deadline ?? $project->end_date)->format('M j, Y') : '—' }}
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <div class="info-label">Total Members</div>
                                <div class="info-value">{{ $project->members->count() + $project->clients->count() }}</div>
                            </td>
                            <td>
                                <div class="info-label">Overall Completion</div>
                                <div class="info-value" style="color:{{ $primaryColor }};">{{ $stats['completion_percentage'] }}%</div>
                            </td>
                        </tr>
                    </table>

                    <table class="stat-boxes">
                        <tr>
                            <td>
                                <div class="stat-box">
                                    <div class="stat-num">{{ $stats['total_tasks'] }}</div>
                                    <div class="stat-lbl">Total Tasks</div>
                                </div>
                            </td>
                            <td>
                                <div class="stat-box">
                                    <div class="stat-num">{{ $stats['completed_tasks'] }}</div>
                                    <div class="stat-lbl">Completed</div>
                                </div>
                            </td>
                            <td>
                                <div class="stat-box">
                                    <div class="stat-num">{{ $stats['total_milestones'] }}</div>
                                    <div class="stat-lbl">Milestones</div>
                                </div>
                            </td>
                            <td>
                                <div class="stat-box">
                                    <div class="stat-num">{{ $stats['total_logged_hours'] }}h</div>
                                    <div class="stat-lbl">Logged Hours</div>
                                </div>
                            </td>
                        </tr>
                    </table>
                </td>
                <td style="width:42%;text-align:center;vertical-align:middle;">
                    <img src="data:image/png;base64,{{ $base64Image }}" style="width:150px;height:150px;" alt="Progress"/>
                    <div style="font-size:9px;color:#6b7280;margin-top:5px;">Overall Progress</div>
                </td>
            </tr>
        </table>
    </div>

    {{-- CHARTS ROW --}}
    <table class="charts-table">
        <tr>
            <td style="width:33%;">
                <div class="card" style="text-align:center;">
                    <div class="section-title" style="text-align:left;">Milestone Progress</div>
                    <img src="data:image/png;base64,{{ $base64ArcImage }}" style="width:200px;height:auto;" alt="Milestone"/>
                    <div style="font-size:10px;font-weight:bold;color:{{ $primaryColor }};margin-top:4px;">
                        {{ $stats['completed_milestones'] }} / {{ $stats['total_milestones'] }} completed
                    </div>
                </div>
            </td>
            <td style="width:33%;">
                <div class="card" style="text-align:center;">
                    <div class="section-title" style="text-align:left;">Task Priority</div>
                    <img src="data:image/png;base64,{{ $base64PriorityImage }}" style="width:240px;height:auto;" alt="Priority"/>
                </div>
            </td>
            <td style="width:34%;">
                <div class="card" style="text-align:center;">
                    <div class="section-title" style="text-align:left;">Task Status</div>
                    <img src="data:image/png;base64,{{ $base64StatusImage }}" style="width:240px;height:auto;" alt="Status"/>
                </div>
            </td>
        </tr>
    </table>

    {{-- HOURS CHART --}}
    <div class="card">
        <div class="section-title">Logged Hours per Task</div>
        <img src="data:image/png;base64,{{ $base64HoursImage }}" style="width:100%;height:auto;display:block;" alt="Hours"/>
    </div>

    {{-- TEAM MEMBERS --}}
    @if($userStats && count($userStats) > 0)
    <div class="card">
        <div class="section-title">Team Members</div>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Assigned Tasks</th>
                    <th>Completed Tasks</th>
                    <th>Completion Rate</th>
                </tr>
            </thead>
            <tbody>
                @foreach($userStats as $userStat)
                @php $rate = $userStat['assigned_tasks'] > 0 ? round(($userStat['done_tasks'] / $userStat['assigned_tasks']) * 100) : 0; @endphp
                <tr>
                    <td><strong>{{ $userStat['name'] }}</strong></td>
                    <td>{{ $userStat['assigned_tasks'] }}</td>
                    <td>{{ $userStat['done_tasks'] }}</td>
                    <td>
                        <span class="progress-wrap"><span class="progress-fill" style="width:{{ $rate }}%;"></span></span>
                        {{ $rate }}%
                    </td>
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>
    @endif

    {{-- MILESTONES --}}
    @if($project->milestones && $project->milestones->count() > 0)
    <div class="card">
        <div class="section-title">Milestones</div>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Progress</th>
                    <th>Status</th>
                    <th>Due Date</th>
                </tr>
            </thead>
            <tbody>
                @foreach($project->milestones as $milestone)
                <tr>
                    <td><strong>{{ $milestone->title }}</strong></td>
                    <td>
                        <span class="progress-wrap">
                            <span class="progress-fill" style="width:{{ $milestone->progress ?? 0 }}%;"></span>
                        </span>
                        {{ $milestone->progress ?? 0 }}%
                    </td>
                    <td>
                        <span class="badge badge-pending">
                            {{ ucfirst(str_replace('_', ' ', $milestone->status ?? 'pending')) }}
                        </span>
                    </td>
                    <td>{{ $milestone->due_date ? \Carbon\Carbon::parse($milestone->due_date)->format('M j, Y') : '—' }}</td>
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>
    @endif

    {{-- TASKS --}}
    <div class="card">
        <div class="section-title">Tasks</div>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Task Name</th>
                    <th>Milestone</th>
                    <th>Start Date</th>
                    <th>Due Date</th>
                    <th>Assigned To</th>
                    <th>Logged Hrs</th>
                    <th>Priority</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                @foreach($tasks as $task)
                @php
                    $loggedHours = \App\Models\TimesheetEntry::where('task_id', $task->id)->sum('hours');
                    $assignedUsers = collect();
                    if ($task->assignedUser) $assignedUsers->push($task->assignedUser);
                    if ($task->members) $assignedUsers = $assignedUsers->merge($task->members->pluck('user')->filter());
                    $assignedUsers = $assignedUsers->unique('id');
                    $priority = $task->priority ?? 'medium';
                    $stageColor = $task->taskStage->color ?? '#6b7280';
                    $statusName = $task->taskStage ? $task->taskStage->name : 'To Do';
                    // Convert hex to RGB for 20% opacity background
                    $hex = ltrim($stageColor, '#');
                    $r = hexdec(substr($hex,0,2)); $g = hexdec(substr($hex,2,2)); $b = hexdec(substr($hex,4,2));
                @endphp
                <tr>
                    <td><strong>{{ $task->title }}</strong></td>
                    <td>{{ $task->milestone ? $task->milestone->title : '—' }}</td>
                    <td>{{ $task->start_date ? \Carbon\Carbon::parse($task->start_date)->format('M j, Y') : '—' }}</td>
                    <td>{{ ($task->due_date ?? $task->end_date) ? \Carbon\Carbon::parse($task->due_date ?? $task->end_date)->format('M j, Y') : '—' }}</td>
                    <td>{{ $assignedUsers->pluck('name')->join(', ') ?: '—' }}</td>
                    <td>{{ round($loggedHours, 2) }}h</td>
                    <td><span class="badge badge-{{ $priority }}">{{ ucfirst($priority) }}</span></td>
                    <td>
                        <span class="badge" style="background:rgba({{ $r }},{{ $g }},{{ $b }},0.12);color:{{ $stageColor }};border:1px solid rgba({{ $r }},{{ $g }},{{ $b }},0.25);">
                            {{ $statusName }}
                        </span>
                    </td>
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>

    <div class="page-footer">
        {{ $project->title ?? $project->name }} &nbsp;·&nbsp; Project Report &nbsp;·&nbsp; {{ date('F j, Y') }}
    </div>

</div>
</body>
</html>
