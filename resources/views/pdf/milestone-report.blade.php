<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Milestone Report – {{ $milestone->title }}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }

        @page {
            margin: 20mm 15mm 18mm 15mm;
        }

        body {
            font-family: DejaVu Sans, Arial, sans-serif;
            font-size: 13px;
            color: #1f2937;
            background: #fff;
            line-height: 1.5;
        }

        .container { padding: 0; }

        /* ── Company Header ── */
        .company-header {
            margin-bottom: 20px;
            padding-bottom: 16px;
            border-bottom: 3px solid {{ $primaryColor }};
        }
        .company-header table { width: 100%; border-collapse: collapse; }
        .company-logo { width: 60px; height: 60px; border-radius: 6px; }
        .company-name {
            font-size: 22px;
            font-weight: bold;
            color: #0f172a;
            margin-bottom: 2px;
        }
        .company-subtitle {
            font-size: 11px;
            color: #6b7280;
        }
        .report-badge {
            display: inline-block;
            background: {{ $primaryColor }};
            color: #fff;
            padding: 5px 14px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.5px;
        }

        /* ── Report Title ── */
        .report-title {
            margin-bottom: 20px;
        }
        .report-title h1 {
            font-size: 20px;
            font-weight: bold;
            color: #0f172a;
            margin-bottom: 4px;
        }
        .report-title .meta {
            font-size: 11px;
            color: #6b7280;
        }

        /* ── Section Title ── */
        .section-title {
            font-size: 14px;
            font-weight: bold;
            color: #0f172a;
            border-left: 4px solid {{ $primaryColor }};
            padding-left: 10px;
            margin-bottom: 12px;
            margin-top: 6px;
        }

        /* ── Card ── */
        .card {
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 16px 18px;
            margin-bottom: 18px;
        }

        /* ── Info Grid ── */
        .info-grid { width: 100%; border-collapse: collapse; }
        .info-grid td { padding: 6px 12px 6px 0; vertical-align: top; }
        .info-label { font-size: 10px; color: #6b7280; letter-spacing: 0.4px; text-transform: uppercase; margin-bottom: 2px; }
        .info-value { font-size: 13px; font-weight: 600; color: #1f2937; }

        /* ── Stat Boxes ── */
        .stat-boxes { width: 100%; border-collapse: collapse; margin-top: 14px; }
        .stat-boxes td { padding: 4px; }
        .stat-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 12px 10px;
            text-align: center;
        }
        .stat-box .stat-num { font-size: 24px; font-weight: bold; color: {{ $primaryColor }}; }
        .stat-box .stat-lbl { font-size: 10px; color: #6b7280; letter-spacing: 0.3px; margin-top: 3px; }

        /* ── Charts ── */
        .charts-table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
        .charts-table td { vertical-align: top; padding: 0 8px; }
        .charts-table td:first-child { padding-left: 0; }
        .charts-table td:last-child { padding-right: 0; }

        /* ── Data Tables ── */
        .data-table { width: 100%; border-collapse: collapse; }
        .data-table thead tr { background: #f8fafc; }
        .data-table th {
            padding: 10px 12px;
            text-align: left;
            font-size: 10px;
            font-weight: 700;
            color: #475569;
            letter-spacing: 0.4px;
            text-transform: uppercase;
            border-bottom: 2px solid #e2e8f0;
        }
        .data-table td {
            padding: 9px 12px;
            font-size: 12px;
            color: #374151;
            border-bottom: 1px solid #f1f5f9;
        }
        .data-table tbody tr:last-child td { border-bottom: none; }
        .data-table tbody tr:nth-child(even) td { background: #fafbfc; }

        /* ── Badges ── */
        .badge {
            display: inline-block;
            padding: 3px 9px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 600;
        }
        .badge-completed  { background: #dcfce7; color: #166534; border: 1px solid rgba(22,163,74,0.2); }
        .badge-pending    { background: #fff7ed; color: #c2410c; border: 1px solid rgba(234,88,12,0.2); }
        .badge-in_progress { background: #dbeafe; color: #1d4ed8; border: 1px solid rgba(37,99,235,0.2); }
        .badge-overdue    { background: #fef2f2; color: #dc2626; border: 1px solid rgba(220,38,38,0.2); }

        .badge-low      { background: #f0fdf4; color: #15803d; border: 1px solid rgba(22,163,74,0.2); }
        .badge-medium   { background: #fefce8; color: #a16207; border: 1px solid rgba(202,138,4,0.2); }
        .badge-high     { background: #fff7ed; color: #c2410c; border: 1px solid rgba(234,88,12,0.2); }
        .badge-critical { background: #fef2f2; color: #dc2626; border: 1px solid rgba(220,38,38,0.2); }

        /* ── Progress Bar ── */
        .progress-wrap {
            background: #e5e7eb;
            border-radius: 4px;
            height: 8px;
            width: 100px;
            display: inline-block;
            vertical-align: middle;
            margin-right: 6px;
        }
        .progress-fill {
            background: {{ $primaryColor }};
            border-radius: 4px;
            height: 8px;
        }

        /* ── Footer ── */
        .page-footer {
            margin-top: 28px;
            padding-top: 12px;
            border-top: 1px solid #e2e8f0;
            font-size: 10px;
            color: #9ca3af;
        }
        .page-footer table { width: 100%; border-collapse: collapse; }
        .page-footer .left { text-align: left; }
        .page-footer .right { text-align: right; }

        /* ── Summary Row ── */
        .summary-row {
            background: linear-gradient(135deg, {{ $primaryColor }}10, {{ $primaryColor }}05);
            border: 1px solid {{ $primaryColor }}30;
            border-radius: 6px;
            padding: 12px 16px;
            margin-bottom: 18px;
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
                <td style="width: 70px; vertical-align: middle;">
                    @if($companyLogo)
                        <img src="{{ $companyLogo }}" class="company-logo" alt="Logo"/>
                    @else
                        <div style="width:50px;height:50px;background:{{ $primaryColor }};border-radius:6px;text-align:center;line-height:50px;color:#fff;font-size:20px;font-weight:bold;">
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
                    <div style="font-size:10px;color:#6b7280;margin-top:6px;">
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
            @if($reportDate)
                &nbsp;·&nbsp; Report Date: <strong>{{ \Carbon\Carbon::parse($reportDate)->format('F j, Y') }}</strong>
            @endif
            &nbsp;·&nbsp; Status: <span class="badge badge-{{ $milestone->status ?? 'pending' }}">{{ ucfirst(str_replace('_', ' ', $milestone->status ?? 'pending')) }}</span>
        </div>
    </div>

    {{-- MILESTONE OVERVIEW --}}
    <div class="card">
        <div class="section-title">Milestone Overview</div>
        <table style="width:100%;border-collapse:collapse;">
            <tr>
                <td style="width:60%;vertical-align:top;padding-right:20px;">
                    <table class="info-grid">
                        <tr>
                            <td style="width:50%;">
                                <div class="info-label">Milestone Title</div>
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
                <td style="width:40%;text-align:center;vertical-align:middle;">
                    <img src="data:image/png;base64,{{ $progressChartImage }}" style="width:150px;height:150px;" alt="Progress"/>
                    <div style="font-size:10px;color:#6b7280;margin-top:6px;">Milestone Progress</div>
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
                    <img src="data:image/png;base64,{{ $priorityChartImage }}" style="width:100%;max-width:320px;height:auto;" alt="Priority"/>
                </div>
            </td>
            <td style="width:50%;">
                <div class="card" style="text-align:center;">
                    <div class="section-title" style="text-align:left;">Task Status Breakdown</div>
                    <img src="data:image/png;base64,{{ $statusChartImage }}" style="width:100%;max-width:320px;height:auto;" alt="Status"/>
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
                    <th style="width:5%;">#</th>
                    <th style="width:28%;">Task</th>
                    <th style="width:12%;">Start Date</th>
                    <th style="width:12%;">Due Date</th>
                    <th style="width:16%;">Assigned To</th>
                    <th style="width:8%;">Hours</th>
                    <th style="width:9%;">Priority</th>
                    <th style="width:10%;">Status</th>
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
                    $stageColor = $task->taskStage->color ?? '#6b7280';
                    $statusName = $task->taskStage ? $task->taskStage->name : 'To Do';
                    $hex = ltrim($stageColor, '#');
                    $r = hexdec(substr($hex,0,2)); $g = hexdec(substr($hex,2,2)); $b = hexdec(substr($hex,4,2));
                @endphp
                <tr>
                    <td style="color:#9ca3af;">{{ $index + 1 }}</td>
                    <td><strong>{{ $task->title }}</strong></td>
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
        @else
        <div style="text-align:center;padding:20px;color:#9ca3af;font-size:12px;">
            No tasks found for this milestone{{ $reportDate ? ' on the selected date' : '' }}.
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
        <div class="section-title">Description</div>
        <div style="font-size:12px;color:#374151;line-height:1.6;">
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
