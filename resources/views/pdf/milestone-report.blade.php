<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Milestone Report – {{ $milestone->title }}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }

        @page {
            margin: 18mm 14mm 16mm 14mm;
        }

        body {
            font-family: DejaVu Sans, Arial, sans-serif;
            font-size: 12px;
            color: #1e293b;
            background: #fff;
            line-height: 1.5;
        }

        .container { padding: 0; }

        /* ── Company Header ── */
        .company-header {
            margin-bottom: 18px;
            padding-bottom: 14px;
            border-bottom: 3px solid {{ $primaryColor }};
        }
        .company-header table { width: 100%; border-collapse: collapse; }
        .company-logo { width: 52px; height: 52px; border-radius: 8px; object-fit: contain; }
        .company-name {
            font-size: 20px;
            font-weight: bold;
            color: #0f172a;
            margin-bottom: 1px;
        }
        .company-subtitle {
            font-size: 10px;
            color: #64748b;
            letter-spacing: 0.3px;
        }
        .report-badge {
            display: inline-block;
            background: {{ $primaryColor }};
            color: #fff;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.6px;
        }

        /* ── Report Title ── */
        .report-title {
            margin-bottom: 16px;
        }
        .report-title h1 {
            font-size: 18px;
            font-weight: bold;
            color: #0f172a;
            margin-bottom: 4px;
        }
        .report-title .meta {
            font-size: 11px;
            color: #64748b;
        }

        /* ── Section Title ── */
        .section-title {
            font-size: 13px;
            font-weight: bold;
            color: #0f172a;
            border-left: 4px solid {{ $primaryColor }};
            padding-left: 10px;
            margin-bottom: 10px;
            margin-top: 4px;
        }

        /* ── Card ── */
        .card {
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 14px 16px;
            margin-bottom: 14px;
        }

        /* ── Info Grid ── */
        .info-grid { width: 100%; border-collapse: collapse; }
        .info-grid td { padding: 5px 10px 5px 0; vertical-align: top; }
        .info-label { font-size: 9px; color: #64748b; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 2px; }
        .info-value { font-size: 12px; font-weight: 600; color: #1e293b; }

        /* ── Stat Boxes ── */
        .stat-boxes { width: 100%; border-collapse: collapse; margin-top: 12px; }
        .stat-boxes td { padding: 3px; }
        .stat-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 10px 8px;
            text-align: center;
        }
        .stat-box .stat-num { font-size: 20px; font-weight: bold; color: {{ $primaryColor }}; }
        .stat-box .stat-lbl { font-size: 9px; color: #64748b; letter-spacing: 0.3px; margin-top: 2px; }

        /* ── Charts ── */
        .charts-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
        .charts-table td { vertical-align: top; padding: 0 6px; }
        .charts-table td:first-child { padding-left: 0; }
        .charts-table td:last-child { padding-right: 0; }

        /* ── Data Tables ── */
        .data-table { width: 100%; border-collapse: collapse; }
        .data-table thead tr { background: #f1f5f9; }
        .data-table th {
            padding: 8px 8px;
            text-align: left;
            font-size: 9px;
            font-weight: 700;
            color: #475569;
            letter-spacing: 0.4px;
            text-transform: uppercase;
            border-bottom: 2px solid #e2e8f0;
        }
        .data-table td {
            padding: 7px 8px;
            font-size: 11px;
            color: #334155;
            border-bottom: 1px solid #f1f5f9;
            vertical-align: top;
        }
        .data-table tbody tr:last-child td { border-bottom: none; }
        .data-table tbody tr:nth-child(even) td { background: #fafbfc; }

        /* ── Badges ── */
        .badge {
            display: inline-block;
            padding: 2px 7px;
            border-radius: 4px;
            font-size: 9px;
            font-weight: 600;
        }
        .badge-completed   { background: #dcfce7; color: #166534; border: 1px solid rgba(22,163,74,0.2); }
        .badge-pending     { background: #fff7ed; color: #c2410c; border: 1px solid rgba(234,88,12,0.2); }
        .badge-in_progress { background: #dbeafe; color: #1d4ed8; border: 1px solid rgba(37,99,235,0.2); }
        .badge-overdue     { background: #fef2f2; color: #dc2626; border: 1px solid rgba(220,38,38,0.2); }

        .badge-low      { background: #f0fdf4; color: #15803d; border: 1px solid rgba(22,163,74,0.2); }
        .badge-medium   { background: #fefce8; color: #a16207; border: 1px solid rgba(202,138,4,0.2); }
        .badge-high     { background: #fff7ed; color: #c2410c; border: 1px solid rgba(234,88,12,0.2); }
        .badge-critical { background: #fef2f2; color: #dc2626; border: 1px solid rgba(220,38,38,0.2); }

        /* ── Progress Bar ── */
        .progress-wrap {
            background: #e2e8f0;
            border-radius: 4px;
            height: 7px;
            width: 90px;
            display: inline-block;
            vertical-align: middle;
            margin-right: 5px;
        }
        .progress-fill {
            background: {{ $primaryColor }};
            border-radius: 4px;
            height: 7px;
        }

        /* ── Footer ── */
        .page-footer {
            margin-top: 22px;
            padding-top: 10px;
            border-top: 1px solid #e2e8f0;
            font-size: 9px;
            color: #94a3b8;
        }
        .page-footer table { width: 100%; border-collapse: collapse; }
        .page-footer .left { text-align: left; }
        .page-footer .right { text-align: right; }

        /* Task description */
        .task-desc {
            font-size: 10px;
            color: #64748b;
            margin-top: 3px;
            line-height: 1.4;
        }

        /* Page break helper */
        .page-break { page-break-before: always; }
    </style>
</head>
<body>
<div class="container">

    {{-- COMPANY HEADER --}}
    <div class="company-header">
        <table>
            <tr>
                <td style="width: 62px; vertical-align: middle;">
                    @if($companyLogo)
                        <img src="{{ $companyLogo }}" class="company-logo" alt="Logo"/>
                    @else
                        <div style="width:48px;height:48px;background:{{ $primaryColor }};border-radius:8px;text-align:center;line-height:48px;color:#fff;font-size:18px;font-weight:bold;">
                            {{ strtoupper(substr($companyName, 0, 1)) }}
                        </div>
                    @endif
                </td>
                <td style="vertical-align: middle;">
                    <div class="company-name">{{ $companyName }}</div>
                    <div class="company-subtitle">{{ $workspaceName }}</div>
                </td>
                <td style="text-align: right; vertical-align: middle;">
                    <span class="report-badge">MILESTONE REPORT</span>
                    <div style="font-size:9px;color:#94a3b8;margin-top:5px;">
                        Generated: {{ date('F j, Y') }} at {{ date('H:i') }}
                    </div>
                </td>
            </tr>
        </table>
    </div>

    {{-- REPORT TITLE --}}
    <div class="report-title">
        <h1>{{ $milestone->title }}</h1>
        <div class="meta">
            Project: <strong>{{ $project->title ?? $project->name }}</strong>
            @if($dateFrom || $dateTo)
                &nbsp;·&nbsp; Period:
                <strong>
                    {{ $dateFrom ? \Carbon\Carbon::parse($dateFrom)->format('M j, Y') : 'Start' }}
                    &ndash;
                    {{ $dateTo ? \Carbon\Carbon::parse($dateTo)->format('M j, Y') : 'Present' }}
                </strong>
            @endif
            &nbsp;·&nbsp; Status: <span class="badge badge-{{ $milestone->status ?? 'pending' }}">{{ ucfirst(str_replace('_', ' ', $milestone->status ?? 'pending')) }}</span>
        </div>
    </div>

    {{-- MILESTONE OVERVIEW --}}
    <div class="card">
        <div class="section-title">Milestone Overview</div>
        <table style="width:100%;border-collapse:collapse;">
            <tr>
                <td style="width:58%;vertical-align:top;padding-right:16px;">
                    <table class="info-grid">
                        <tr>
                            <td style="width:50%;">
                                <div class="info-label">Milestone</div>
                                <div class="info-value">{{ $milestone->title }}</div>
                            </td>
                            <td style="width:50%;">
                                <div class="info-label">Status</div>
                                <div class="info-value">
                                    <span class="badge badge-{{ $milestone->status ?? 'pending' }}">{{ ucfirst(str_replace('_', ' ', $milestone->status ?? 'pending')) }}</span>
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <div class="info-label">Due Date</div>
                                <div class="info-value">{{ $milestone->due_date ? \Carbon\Carbon::parse($milestone->due_date)->format('M j, Y') : '—' }}</div>
                            </td>
                            <td>
                                <div class="info-label">Progress</div>
                                <div class="info-value" style="color:{{ $primaryColor }};">{{ $milestone->progress ?? 0 }}%</div>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <div class="info-label">Project</div>
                                <div class="info-value">{{ $project->title ?? $project->name }}</div>
                            </td>
                            <td>
                                <div class="info-label">Created By</div>
                                <div class="info-value">{{ $milestone->creator ? $milestone->creator->name : '—' }}</div>
                            </td>
                        </tr>
                    </table>

                    <table class="stat-boxes">
                        <tr>
                            <td style="width:25%;">
                                <div class="stat-box">
                                    <div class="stat-num">{{ $stats['total_tasks'] }}</div>
                                    <div class="stat-lbl">Total Tasks</div>
                                </div>
                            </td>
                            <td style="width:25%;">
                                <div class="stat-box">
                                    <div class="stat-num">{{ $stats['completed_tasks'] }}</div>
                                    <div class="stat-lbl">Completed</div>
                                </div>
                            </td>
                            <td style="width:25%;">
                                <div class="stat-box">
                                    <div class="stat-num">{{ $stats['in_progress_tasks'] }}</div>
                                    <div class="stat-lbl">In Progress</div>
                                </div>
                            </td>
                            <td style="width:25%;">
                                <div class="stat-box">
                                    <div class="stat-num">{{ $stats['total_logged_hours'] }}h</div>
                                    <div class="stat-lbl">Hours Logged</div>
                                </div>
                            </td>
                        </tr>
                    </table>
                </td>
                <td style="width:42%;text-align:center;vertical-align:middle;">
                    <img src="data:image/png;base64,{{ $progressChartImage }}" style="width:140px;height:140px;" alt="Progress"/>
                    <div style="font-size:9px;color:#64748b;margin-top:4px;">Milestone Progress</div>
                </td>
            </tr>
        </table>
    </div>

    {{-- CHARTS ROW --}}
    <table class="charts-table">
        <tr>
            <td style="width:50%;">
                <div class="card" style="text-align:center;">
                    <div class="section-title" style="text-align:left;">Task Priority Distribution</div>
                    <img src="data:image/png;base64,{{ $priorityChartImage }}" style="width:100%;max-width:300px;height:auto;" alt="Priority"/>
                </div>
            </td>
            <td style="width:50%;">
                <div class="card" style="text-align:center;">
                    <div class="section-title" style="text-align:left;">Task Status Breakdown</div>
                    <img src="data:image/png;base64,{{ $statusChartImage }}" style="width:100%;max-width:300px;height:auto;" alt="Status"/>
                </div>
            </td>
        </tr>
    </table>

    {{-- HOURS CHART --}}
    @if($stats['total_logged_hours'] > 0)
    <div class="card">
        <div class="section-title">Hours Logged per Task</div>
        <img src="data:image/png;base64,{{ $hoursChartImage }}" style="width:100%;height:auto;display:block;" alt="Hours"/>
    </div>
    @endif

    {{-- TASKS TABLE --}}
    <div class="card">
        <div class="section-title">Tasks ({{ $stats['total_tasks'] }})</div>
        @if(count($tasks) > 0)
        <table class="data-table">
            <thead>
                <tr>
                    <th style="width:4%;">#</th>
                    <th style="width:30%;">Task</th>
                    <th style="width:11%;">Start</th>
                    <th style="width:11%;">Due</th>
                    <th style="width:13%;">Assigned To</th>
                    <th style="width:7%;">Hrs</th>
                    <th style="width:9%;">Priority</th>
                    <th style="width:9%;">Status</th>
                </tr>
            </thead>
            <tbody>
                @foreach($tasks as $index => $task)
                @php
                    $loggedHours = \App\Models\TimesheetEntry::where('task_id', $task->id)->sum('hours');
                    $assignedUsers = collect();
                    if ($task->assignedUser) $assignedUsers->push($task->assignedUser);
                    if ($task->members) $assignedUsers = $assignedUsers->merge($task->members->pluck('user')->filter());
                    $assignedUsers = $assignedUsers->unique('id');
                    $priority = $task->priority ?? 'medium';
                    $stageColor = $task->taskStage?->color ?? '#64748b';
                    $statusName = $task->taskStage ? $task->taskStage->name : 'To Do';
                    $hex = ltrim($stageColor, '#');
                    if (strlen($hex) < 6) $hex = '64748b';
                    $r = hexdec(substr($hex,0,2)); $g = hexdec(substr($hex,2,2)); $b = hexdec(substr($hex,4,2));
                @endphp
                <tr>
                    <td style="color:#94a3b8;font-size:10px;">{{ $index + 1 }}</td>
                    <td>
                        <strong>{{ $task->title }}</strong>
                        @if($task->description)
                            <div class="task-desc">{{ \Illuminate\Support\Str::limit(strip_tags($task->description), 120) }}</div>
                        @endif
                    </td>
                    <td>{{ $task->start_date ? \Carbon\Carbon::parse($task->start_date)->format('M j, Y') : '—' }}</td>
                    <td>{{ ($task->due_date ?? $task->end_date) ? \Carbon\Carbon::parse($task->due_date ?? $task->end_date)->format('M j, Y') : '—' }}</td>
                    <td>{{ $assignedUsers->pluck('name')->join(', ') ?: '—' }}</td>
                    <td>{{ round($loggedHours, 1) }}h</td>
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
        @else
        <div style="text-align:center;padding:18px;color:#94a3b8;font-size:11px;">
            No tasks found for this milestone{{ ($dateFrom || $dateTo) ? ' in the selected date range' : '' }}.
        </div>
        @endif
    </div>

    {{-- TEAM PERFORMANCE --}}
    @if(count($teamStats) > 0)
    <div class="card">
        <div class="section-title">Team Performance</div>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Team Member</th>
                    <th>Assigned</th>
                    <th>Completed</th>
                    <th>Hours Logged</th>
                    <th>Completion Rate</th>
                </tr>
            </thead>
            <tbody>
                @foreach($teamStats as $member)
                @php $rate = $member['assigned'] > 0 ? round(($member['completed'] / $member['assigned']) * 100) : 0; @endphp
                <tr>
                    <td><strong>{{ $member['name'] }}</strong></td>
                    <td>{{ $member['assigned'] }}</td>
                    <td>{{ $member['completed'] }}</td>
                    <td>{{ $member['hours'] }}h</td>
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

    {{-- DESCRIPTION --}}
    @if($milestone->description)
    <div class="card">
        <div class="section-title">Milestone Description</div>
        <div style="font-size:11px;color:#334155;line-height:1.6;">
            {!! nl2br(e($milestone->description)) !!}
        </div>
    </div>
    @endif

    {{-- FOOTER --}}
    <div class="page-footer">
        <table>
            <tr>
                <td class="left">{{ $companyName }} &nbsp;·&nbsp; {{ $workspaceName }}</td>
                <td class="right">{{ $milestone->title }} — Milestone Report &nbsp;·&nbsp; {{ date('F j, Y') }}</td>
            </tr>
        </table>
    </div>

</div>
</body>
</html>
