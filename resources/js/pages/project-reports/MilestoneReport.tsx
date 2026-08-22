import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FileText, Calendar, Target, FolderOpen, TrendingUp, Clock, CheckCircle2, ListTodo } from 'lucide-react';
import { PageTemplate } from '@/components/page-template';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip as ChartTooltip, ResponsiveContainer, LabelList
} from 'recharts';

interface Milestone {
    id: number;
    title: string;
    due_date: string | null;
    status: string;
    progress: number;
}

interface Project {
    id: number;
    title: string;
    milestones: Milestone[];
}

interface MilestoneStats {
    total_tasks: number;
    completed_tasks: number;
    in_progress_tasks: number;
    pending_tasks: number;
    total_logged_hours: number;
    completion_percentage: number;
    priority_stats: Record<string, number>;
    status_stats: Record<string, number>;
    hours_data: Array<{ task_name: string; logged_hours: number }>;
}

interface Props {
    projects: Project[];
    filters: {
        project_id?: string;
        milestone_id?: string;
        date_from?: string;
        date_to?: string;
    };
}

const PRIORITY_COLORS: Record<string, string> = { low: '#22c55e', medium: '#eab308', high: '#f97316', critical: '#ef4444' };
const STATUS_COLORS = ['#94a3b8', '#3b82f6', '#8b5cf6', '#22c55e', '#ef4444', '#f59e0b', '#06b6d4'];

export default function MilestoneReport({ projects, filters }: Props) {
    const { t } = useTranslation();

    const [selectedProjectId, setSelectedProjectId] = useState<string>(filters.project_id || '');
    const [selectedMilestoneId, setSelectedMilestoneId] = useState<string>(filters.milestone_id || '');
    const [dateFrom, setDateFrom] = useState<string>(filters.date_from || '');
    const [dateTo, setDateTo] = useState<string>(filters.date_to || '');
    const [isGenerating, setIsGenerating] = useState(false);
    const [stats, setStats] = useState<MilestoneStats | null>(null);
    const [loadingStats, setLoadingStats] = useState(false);

    const selectedProject = projects.find(p => String(p.id) === selectedProjectId);
    const milestones = selectedProject?.milestones || [];
    const selectedMilestone = milestones.find(m => String(m.id) === selectedMilestoneId);

    const handleProjectChange = (value: string) => {
        setSelectedProjectId(value);
        setSelectedMilestoneId('');
        setStats(null);
    };

    useEffect(() => {
        if (!selectedMilestoneId) {
            setStats(null);
            return;
        }
        setLoadingStats(true);
        const params = new URLSearchParams();
        if (dateFrom) params.append('date_from', dateFrom);
        if (dateTo) params.append('date_to', dateTo);

        fetch(route('project-reports.milestone.stats', selectedMilestoneId) + (params.toString() ? '?' + params.toString() : ''))
            .then(r => r.json())
            .then(data => { setStats(data); setLoadingStats(false); })
            .catch(() => setLoadingStats(false));
    }, [selectedMilestoneId, dateFrom, dateTo]);

    const handleExport = () => {
        if (!selectedMilestoneId) return;
        setIsGenerating(true);
        const params = new URLSearchParams();
        if (dateFrom) params.append('date_from', dateFrom);
        if (dateTo) params.append('date_to', dateTo);
        const url = route('project-reports.milestone.export', selectedMilestoneId) + (params.toString() ? '?' + params.toString() : '');
        window.open(url, '_blank');
        setTimeout(() => setIsGenerating(false), 2000);
    };

    const priorityData = stats ? Object.entries(stats.priority_stats).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
        fill: PRIORITY_COLORS[name] || '#6b7280'
    })) : [];

    const statusData = stats ? Object.entries(stats.status_stats).map(([name, value], i) => ({
        name,
        value,
        fill: STATUS_COLORS[i % STATUS_COLORS.length]
    })) : [];

    const hoursData = stats ? stats.hours_data.filter(d => d.logged_hours > 0).slice(0, 8).map(d => ({
        name: d.task_name.length > 18 ? d.task_name.slice(0, 16) + '..' : d.task_name,
        hours: d.logged_hours
    })) : [];

    const breadcrumbs = [
        { title: t('Project Reports'), href: route('project-reports.index') },
        { title: t('Milestone Report') },
    ];

    return (
        <PageTemplate
            title={t('Milestone Report')}
            breadcrumbs={breadcrumbs}
            description={t('Generate detailed PDF reports for project milestones')}
        >
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Report Configuration */}
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                                <FileText className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold">{t('Configure Report')}</h3>
                                <p className="text-sm text-muted-foreground">{t('Select a project and milestone to generate the report')}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Project Selection */}
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                                    {t('Project')}
                                </Label>
                                <Select value={selectedProjectId} onValueChange={handleProjectChange}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={t('Select a project')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {projects.map(project => (
                                            <SelectItem key={project.id} value={String(project.id)}>
                                                {project.title}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Milestone Selection */}
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Target className="h-4 w-4 text-muted-foreground" />
                                    {t('Milestone')}
                                </Label>
                                <Select
                                    value={selectedMilestoneId}
                                    onValueChange={setSelectedMilestoneId}
                                    disabled={!selectedProjectId}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={selectedProjectId ? t('Select a milestone') : t('Select a project first')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {milestones.map(milestone => (
                                            <SelectItem key={milestone.id} value={String(milestone.id)}>
                                                {milestone.title}
                                                {milestone.status === 'completed' && ' ✓'}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Date From */}
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    {t('Date From')}
                                </Label>
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                />
                            </div>

                            {/* Date To */}
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    {t('Date To')}
                                </Label>
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    min={dateFrom || undefined}
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                />
                            </div>
                        </div>

                        {/* Generate Button */}
                        <div className="mt-5 flex items-center gap-3">
                            <Button
                                onClick={handleExport}
                                disabled={!selectedMilestoneId || isGenerating}
                                size="lg"
                            >
                                <Download className="h-4 w-4 mr-2" />
                                {isGenerating ? t('Generating...') : t('Download PDF Report')}
                            </Button>
                            {dateFrom || dateTo ? (
                                <span className="text-xs text-muted-foreground">
                                    {t('Filtering')}: {dateFrom || '...'} → {dateTo || '...'}
                                </span>
                            ) : (
                                <span className="text-xs text-muted-foreground">{t('All tasks (no date filter)')}</span>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Milestone Preview & Stats */}
                {selectedMilestone && stats && (
                    <>
                        {/* KPI Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <Card className="border shadow-sm">
                                <CardContent className="p-4 flex items-center gap-3">
                                    <div className="rounded-lg bg-blue-100 dark:bg-blue-900/30 p-2.5">
                                        <ListTodo className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">{stats.total_tasks}</p>
                                        <p className="text-xs text-muted-foreground">{t('Total Tasks')}</p>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="border shadow-sm">
                                <CardContent className="p-4 flex items-center gap-3">
                                    <div className="rounded-lg bg-green-100 dark:bg-green-900/30 p-2.5">
                                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">{stats.completed_tasks}</p>
                                        <p className="text-xs text-muted-foreground">{t('Completed')}</p>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="border shadow-sm">
                                <CardContent className="p-4 flex items-center gap-3">
                                    <div className="rounded-lg bg-amber-100 dark:bg-amber-900/30 p-2.5">
                                        <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">{stats.total_logged_hours}h</p>
                                        <p className="text-xs text-muted-foreground">{t('Hours Logged')}</p>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="border shadow-sm">
                                <CardContent className="p-4 flex items-center gap-3">
                                    <div className="rounded-lg bg-purple-100 dark:bg-purple-900/30 p-2.5">
                                        <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">{stats.completion_percentage}%</p>
                                        <p className="text-xs text-muted-foreground">{t('Progress')}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Progress Bar */}
                        <Card>
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between mb-2">
                                    <div>
                                        <h3 className="text-base font-semibold">{selectedMilestone.title}</h3>
                                        <p className="text-sm text-muted-foreground">
                                            {selectedProject?.title}
                                            {selectedMilestone.due_date && (
                                                <> &middot; Due: {new Date(selectedMilestone.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>
                                            )}
                                        </p>
                                    </div>
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                        selectedMilestone.status === 'completed'
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                            : selectedMilestone.status === 'in_progress'
                                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                                    }`}>
                                        {selectedMilestone.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                    </span>
                                </div>
                                <Progress value={stats.completion_percentage} className="h-2.5" />
                            </CardContent>
                        </Card>

                        {/* Charts Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Task Status Donut */}
                            {statusData.length > 0 && (
                                <Card className="border shadow-sm overflow-hidden">
                                    <CardHeader className="pb-2 pt-5 px-5 border-b">
                                        <CardTitle className="text-base font-semibold">{t('Task Status')}</CardTitle>
                                        <p className="text-xs text-muted-foreground">{t('Distribution across stages')}</p>
                                    </CardHeader>
                                    <CardContent className="p-4">
                                        <ResponsiveContainer width="100%" height={200}>
                                            <PieChart>
                                                <Pie
                                                    data={statusData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={50}
                                                    outerRadius={75}
                                                    dataKey="value"
                                                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                                                    labelLine={false}
                                                    fontSize={10}
                                                >
                                                    {statusData.map((entry, i) => (
                                                        <Cell key={i} fill={entry.fill} />
                                                    ))}
                                                </Pie>
                                                <ChartTooltip
                                                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))' }}
                                                    formatter={(v: any, name: any) => [`${v} tasks`, name]}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="flex flex-wrap items-center justify-center gap-3 mt-1">
                                            {statusData.map((s) => (
                                                <span key={s.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: s.fill }} />
                                                    {s.name} ({s.value})
                                                </span>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Priority Bar Chart */}
                            {priorityData.length > 0 && (
                                <Card className="border shadow-sm overflow-hidden">
                                    <CardHeader className="pb-2 pt-5 px-5 border-b">
                                        <CardTitle className="text-base font-semibold">{t('Task Priority')}</CardTitle>
                                        <p className="text-xs text-muted-foreground">{t('Tasks by priority level')}</p>
                                    </CardHeader>
                                    <CardContent className="p-4">
                                        <ResponsiveContainer width="100%" height={200}>
                                            <BarChart data={priorityData} margin={{ top: 15, right: 5, bottom: 5, left: -20 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'currentColor' }} axisLine={false} tickLine={false} />
                                                <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                                <ChartTooltip
                                                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))' }}
                                                    formatter={(v: any) => [`${v} tasks`]}
                                                />
                                                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={40}>
                                                    {priorityData.map((entry, i) => (
                                                        <Cell key={i} fill={entry.fill} />
                                                    ))}
                                                    <LabelList dataKey="value" position="top" style={{ fontSize: 10, fontWeight: 600, fill: 'currentColor' }} formatter={(v: number) => v > 0 ? v : ''} />
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Hours Logged Bar Chart */}
                            {hoursData.length > 0 && (
                                <Card className="border shadow-sm overflow-hidden">
                                    <CardHeader className="pb-2 pt-5 px-5 border-b">
                                        <CardTitle className="text-base font-semibold">{t('Hours Logged')}</CardTitle>
                                        <p className="text-xs text-muted-foreground">{t('Time spent per task')}</p>
                                    </CardHeader>
                                    <CardContent className="p-4">
                                        <ResponsiveContainer width="100%" height={200}>
                                            <BarChart data={hoursData} margin={{ top: 15, right: 5, bottom: 40, left: -20 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                                                <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'currentColor' }} axisLine={false} tickLine={false} angle={-30} textAnchor="end" interval={0} />
                                                <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} axisLine={false} tickLine={false} />
                                                <ChartTooltip
                                                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))' }}
                                                    formatter={(v: any) => [`${v}h`]}
                                                />
                                                <Bar dataKey="hours" radius={[6, 6, 0, 0]} maxBarSize={35} fill="hsl(var(--primary))">
                                                    <LabelList dataKey="hours" position="top" style={{ fontSize: 9, fontWeight: 600, fill: 'currentColor' }} formatter={(v: number) => v > 0 ? `${v}h` : ''} />
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </>
                )}

                {/* Loading state */}
                {selectedMilestoneId && loadingStats && (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    </div>
                )}

                {/* Info Card */}
                <Card className="border-dashed">
                    <CardContent className="p-6">
                        <h4 className="font-medium mb-3">{t('Report Contents')}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                {t('Company branding (logo & name)')}
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                {t('Milestone overview & progress')}
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                {t('Task priority & status charts')}
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                {t('Hours logged per task')}
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                {t('Complete task listing with descriptions')}
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                {t('Team performance breakdown')}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </PageTemplate>
    );
}
