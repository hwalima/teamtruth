<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Project Report – {{ $project->title ?? $project->name }}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: DejaVu Sans, Arial, sans-serif;
            font-size: 13px;
            color: #1e293b;
            background: #fff;
        }

        .container { padding: 0; }

        /* ── Modern header band ── */
        .report-header {
            background: #0f172a;
            color: #fff;
            padding: 28px 32px 24px;
            margin-bottom: 24px;
        }
        .report-header .project-title {
            font-size: 28px;
            font-weight: bold;
            color: #ffffff;
            margin-bottom: 6px;
            letter-spacing: -0.5px;
        }
        .report-header .report-meta {
            font-size: 11px;
            color: #94a3b8;
            letter-spacing: 0.3px;
        }
        .report-header .report-meta strong {
            color: #e2e8f0;
        }

        .content { padding: 0 28px 32px; }

        /* ── Section title ── */
        .section-title {
            font-size: 13px;
            font-weight: bold;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            padding-bottom: 8px;
            margin-bottom: 14px;
            border-bottom: 2px solid {{ $primaryColor }};
        }

        /* ── Card ── */
        .card {
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 18px 20px;
            margin-bottom: 20px;
        }

        /* ── Overview section ── */
        .overview-grid { width: 100%; border-collapse: collapse; }
        .overview-grid td { padding: 5px 10px 5px 0; vertical-align: top; }
        .info-label { font-size: 10px; color: #94a3b8; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 3px; }
        .info-value { font-size: 14px; font-weight: 700; color: #1e293b; }

        /* ── Stat boxes ── */
        .stat-boxes { width: 100%; border-collapse: collapse; margin-top: 14px; }
        .stat-boxes td { width: 25%; padding: 4px; }
        .stat-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px 8px;
            text-align: center;
        }
        .stat-box .stat-num { font-size: 24px; font-weight: 800; color: #0f172a; }
        .stat-box .stat-lbl { font-size: 10px; color: #64748b; letter-spacing: 0.3px; margin-top: 3px; text-transform: uppercase; }

        /* ── Charts row ── */
        .charts-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .charts-table td { vertical-align: top; padding: 0 6px; }
        .charts-table td:first-child { padding-left: 0; }
        .charts-table td:last-child { padding-right: 0; }

        /* ── Data tables ── */
        .data-table { width: 100%; border-collapse: collapse; }
        .data-table thead tr { background: #f1f5f9; }
        .data-table th {
            padding: 10px 12px;
            text-align: left;
            font-size: 10px;
            font-weight: 700;
            color: #475569;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            border-bottom: 2px solid #e2e8f0;
        }
        .data-table td {
            padding: 9px 12px;
            font-size: 12px;
            color: #334155;
            border-bottom: 1px solid #f1f5f9;
        }
        .data-table tbody tr:last-child td { border-bottom: none; }

        /* ── Badges ── */
        .badge {
            display: inline-block;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.3px;
        }

        /* Project status */
        .badge-planning    { background: #dbeafe; color: #1e40af; }
        .badge-active      { background: #dcfce7; color: #15803d; }
        .badge-in_progress { background: #fed7aa; color: #c2410c; }
        .badge-completed   { background: #f3e8ff; color: #7e22ce; }
        .badge-on_hold     { background: #fef3c7; color: #92400e; }
        .badge-cancelled   { background: #fecaca; color: #dc2626; }

        /* Priority */
        .badge-low      { background: #dcfce7; color: #15803d; }
        .badge-medium   { background: #fef3c7; color: #a16207; }
        .badge-high     { background: #ffedd5; color: #c2410c; }
        .badge-critical { background: #fecaca; color: #dc2626; }

        /* Milestone status */
        .badge-pending  { background: #ffedd5; color: #c2410c; }

        /* ── Progress bar ── */
        .progress-wrap {
            background: #e2e8f0;
            border-radius: 10px;
            height: 8px;
            width: 80px;
            display: inline-block;
            vertical-align: middle;
            margin-right: 6px;
        }
        .progress-fill {
            background: {{ $primaryColor }};
            border-radius: 10px;
            height: 8px;
        }

        /* ── Footer ── */
        .page-footer {
            margin-top: 28px;
            padding-top: 12px;
            border-top: 1px solid #e2e8f0;
            text-align: center;
            font-size: 10px;
            color: #94a3b8;
        }

        /* ── Chart card ── */
        .chart-card {
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 14px 16px;
            text-align: center;
        }
        .chart-card .chart-title {
            font-size: 11px;
            font-weight: 700;
            color: #475569;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            text-align: left;
            margin-bottom: 10px;
            padding-bottom: 6px;
            border-bottom: 1px solid #f1f5f9;
        }
    </style>
</head>
<body>
<div class="container">

    {{-- MODERN HEADER --}}
    <div class="report-header">
        <div class="project-title">{{ $project->title ?? $project->name }}</div>
        <div class="report-meta">
            Project Report &nbsp;&middot;&nbsp; Generated on <strong>{{ date('F j, Y') }}</strong> at <strong>{{ date('H:i') }}</strong>
            &nbsp;&middot;&nbsp; Status: <span class="badge badge-{{ $project->status }}" style="font-size:10px;">{{ $projectStatusText }}</span>
        </div>
    </div>

    <div class="content">

    {{-- OVERVIEW --}}
    <div class="card">
        <div class="section-title">Project Overview</div>
        <table style="width:100%;border-collapse:collapse;">
            <tr>
                <td style="width:60%;vertical-align:top;padding-right:20px;">
                    <table class="overview-grid">
                        <tr>
                            <td style="width:50%;">
                                <div class="info-label">Project Name</div>
                                <div class="info-value">{{ $project->title ?? $project->name }}</div>
                            </td>
                            <td style="width:50%;">
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
                                <div class="info-value" style="color:{{ $primaryColor }};font-size:18px;">{{ $stats['completion_percentage'] }}%</div>
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
                <td style="width:40%;text-align:center;vertical-align:middle;">
                    <img src="data:image/png;base64,{{ $base64Image }}" style="width:160px;height:160px;" alt="Progress"/>
                    <div style="font-size:10px;color:#64748b;margin-top:6px;font-weight:600;">Overall Progress</div>
                </td>
            </tr>
        </table>
    </div>

    {{-- CHARTS ROW --}}
    <table class="charts-table">
        <tr>
            <td style="width:33%;">
                <div class="chart-card">
                    <div class="chart-title">Milestone Progress</div>
                    <img src="data:image/png;base64,{{ $base64ArcImage }}" style="width:200px;height:auto;" alt="Milestone"/>
                    <div style="font-size:11px;font-weight:700;color:{{ $primaryColor }};margin-top:6px;">
                        {{ $stats['completed_milestones'] }} / {{ $stats['total_milestones'] }} completed
                    </div>
                </div>
            </td>
            <td style="width:33%;">
                <div class="chart-card">
                    <div class="chart-title">Task Priority</div>
                    <img src="data:image/png;base64,{{ $base64PriorityImage }}" style="width:100%;max-width:280px;height:auto;" alt="Priority"/>
                </div>
            </td>
            <td style="width:34%;">
                <div class="chart-card">
                    <div class="chart-title">Task Status</div>
                    <img src="data:image/png;base64,{{ $base64StatusImage }}" style="width:100%;max-width:280px;height:auto;" alt="Status"/>
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
                        <strong>{{ $rate }}%</strong>
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
                        <strong>{{ $milestone->progress ?? 0 }}%</strong>
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
                        <span class="badge" style="background:rgba({{ $r }},{{ $g }},{{ $b }},0.12);color:{{ $stageColor }};">
                            {{ $statusName }}
                        </span>
                    </td>
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>

    <div class="page-footer">
        {{ $project->title ?? $project->name }} &nbsp;&middot;&nbsp; Project Report &nbsp;&middot;&nbsp; {{ date('F j, Y') }}
    </div>

    </div>
</div>
</body>
</html>
