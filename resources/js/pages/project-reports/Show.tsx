import React, { useState, useEffect, useRef } from 'react';
import { router, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { Download, ArrowLeft, Calendar } from 'lucide-react';
import { usePdfDownload } from '@/hooks/usePdfDownload';
import { PageTemplate } from '@/components/page-template';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { SearchAndFilterBar } from '@/components/ui/search-and-filter-bar';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer } from 'recharts';

interface Project {
    id: number;
    name: string;
    title: string;
    start_date: string;
    end_date: string;
    status: string;
    description?: string;
    members: Array<{
        id: number;
        name: string;
        avatar?: string;
    }>;
    clients: Array<{
        id: number;
        name: string;
        avatar?: string;
    }>;
    milestones: Array<{
        id: number;
        title: string;
        status: string;
        progress: number;
        cost: number;
        start_date: string;
        end_date: string;
    }>;
}

interface Stats {
    total_tasks: number;
    completed_tasks: number;
    completion_percentage: number;
    total_milestones: number;
    completed_milestones: number;
    milestone_completion_percentage: number;
    total_logged_hours: number;
    estimated_hours: number;
    priority_stats: Record<string, number>;
    status_stats: Record<string, number>;
    days_left: number | null;
}

interface Props {
    project: Project;
    stats: Stats;
    userStats: any[];
    users: any[];
    stages: any[];
    workspace: any;
    tasks?: any;
    filters?: any;
}

export default function Show({ project, stats, userStats, users, stages, workspace, tasks: initialTasks, filters: pageFilters = {} }: Props) {
    const { t } = useTranslation();
    const reportRef = useRef<HTMLDivElement>(null);
    const { downloadPDF, isGeneratingPDF } = usePdfDownload();

    const formatText = (text: string) => {
        return text.replace(/_/g, ' ').split(' ').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
    };
    const [tasks, setTasks] = useState<any[]>(initialTasks?.data || []);
    const [pagination, setPagination] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState(pageFilters.search || '');
    const [selectedUser, setSelectedUser] = useState(pageFilters.user_id || 'all');
    const [selectedMilestone, setSelectedMilestone] = useState(pageFilters.milestone_id || 'all');
    const [selectedStatus, setSelectedStatus] = useState(pageFilters.status || 'all');
    const [selectedPriority, setSelectedPriority] = useState(pageFilters.priority || 'all');
    const [dateFrom, setDateFrom] = useState(pageFilters.date_from || '');
    const [dateTo, setDateTo] = useState(pageFilters.date_to || '');
    const [perPage, setPerPage] = useState(pageFilters.per_page || 10);
    const [currentPage, setCurrentPage] = useState(1);
    const { csrf_token } = usePage().props as any;

    useEffect(() => {
        if (initialTasks?.data && initialTasks.data.length > 0) {
            setTasks(initialTasks.data);
        } else {
            fetchTasks();
        }
    }, []);

    // Debounced search effect
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (searchTerm || selectedUser !== 'all' || selectedMilestone !== 'all' || selectedStatus !== 'all' || selectedPriority !== 'all') {
                fetchTasks();
            }
        }, 300); // 300ms debounce

        return () => clearTimeout(timeoutId);
    }, [searchTerm]);

    // Immediate effect for filters (no debounce needed)
    useEffect(() => {
        setCurrentPage(1);
        fetchTasks();
    }, [selectedUser, selectedMilestone, selectedStatus, selectedPriority, perPage, dateFrom, dateTo]);

    const fetchTasks = async () => {
        try {
            setLoading(true);
            setError(null);

            const params = {
                search: searchTerm || undefined,
                user_id: selectedUser !== 'all' ? selectedUser : undefined,
                milestone_id: selectedMilestone !== 'all' ? selectedMilestone : undefined,
                status: selectedStatus !== 'all' ? selectedStatus : undefined,
                priority: selectedPriority !== 'all' ? selectedPriority : undefined,
                date_from: dateFrom || undefined,
                date_to: dateTo || undefined,
                per_page: perPage,
                page: currentPage
            };

            // Filter out undefined values
            const filteredParams = Object.fromEntries(
                Object.entries(params).filter(([_, value]) => value !== undefined)
            );

            const response = await fetch(route('project-reports.tasks', project.id), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrf_token
                },
                body: JSON.stringify(filteredParams),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            setTasks(data.data || []);
            setPagination(data.pagination || null);
        } catch (error) {
            console.error('Error fetching tasks:', error);
            setError('Failed to load tasks. Please try again.');
            setTasks([]);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        window.open(route('project-reports.export', project.id), '_blank');
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '-';
        return window.appSettings.formatDateTime(new Date(dateString),false);
    };

    const getStatusColor = (status: string) => {
        const colors = {
            'active': 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20',
            'planning': 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20',
            'on_hold': 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20',
            'completed': 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20',
            'cancelled': 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20',
            'to do': 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20',
            'todo': 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20',
            'in progress': 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20',
            'inprogress': 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20',
            'review': 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20',
            'done': 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20',
            'blocked': 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20',
            'testing': 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20'
        };
        return colors[status?.toLowerCase() as keyof typeof colors] || 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20';
    };

    const getPriorityColor = (priority: string) => {
        const colors = {
            low: '#10B77F',
            medium: '#f59e0b',
            high: '#f97316',
            critical: '#ef4444'
        };
        return colors[priority as keyof typeof colors] || '#6b7280';
    };

    const getPriorityBadgeColor = (priority: string) => {
        const colors = {
            low: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20',
            medium: 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20',
            high: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20',
            critical: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20'
        };
        return colors[priority as keyof typeof colors] || 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20';
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchTasks();
    };

    const hasActiveFilters = () => {
        return selectedUser !== 'all' || selectedMilestone !== 'all' || selectedStatus !== 'all' || selectedPriority !== 'all' || searchTerm !== '';
    };

    const activeFilterCount = () => {
        return (selectedUser !== 'all' ? 1 : 0) +
               (selectedMilestone !== 'all' ? 1 : 0) +
               (selectedStatus !== 'all' ? 1 : 0) +
               (selectedPriority !== 'all' ? 1 : 0) +
               (searchTerm ? 1 : 0);
    };

    const handleResetFilters = () => {
        setSelectedUser('all');
        setSelectedMilestone('all');
        setSelectedStatus('all');
        setSelectedPriority('all');
        setSearchTerm('');
        setCurrentPage(1);
    };

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        fetchTasksForPage(page);
    };

    const fetchTasksForPage = async (page: number) => {
        try {
            setLoading(true);
            setError(null);

            const params = {
                search: searchTerm || undefined,
                user_id: selectedUser !== 'all' ? selectedUser : undefined,
                milestone_id: selectedMilestone !== 'all' ? selectedMilestone : undefined,
                status: selectedStatus !== 'all' ? selectedStatus : undefined,
                priority: selectedPriority !== 'all' ? selectedPriority : undefined,
                per_page: perPage,
                page: page
            };

            const filteredParams = Object.fromEntries(
                Object.entries(params).filter(([_, value]) => value !== undefined)
            );

            const response = await fetch(route('project-reports.tasks', project.id), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify(filteredParams),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            setTasks(data.data || []);
            setPagination(data.pagination || null);
        } catch (error) {
            console.error('Error fetching tasks:', error);
            setError('Failed to load tasks. Please try again.');
            setTasks([]);
        } finally {
            setLoading(false);
        }
    };

    const breadcrumbs = [
        { title: t('Dashboard'), href: route('dashboard') },
        { title: t('Project Report'), href: route('project-reports.index') },
        { title: project.title || project.name }
    ];

    const pageActions = [
        {
            label: t('Download PDF'),
            icon: <Download className="h-4 w-4 mr-2" />,
            variant: 'default' as const,
            onClick: handleExport
        },
        {
            label: t('Back'),
            icon: <ArrowLeft className="h-4 w-4 mr-2" />,
            variant: 'outline',
            onClick: () => router.get(route('project-reports.index'))
        }
    ];

    // Prepare chart data
    const priorityOrder = ['critical', 'high', 'medium', 'low'];
    const priorityData = priorityOrder.map(priority => ({
        name: priority,
        value: stats.priority_stats?.[priority] || 0,
        fill: getPriorityColor(priority)
    }));

    const statusData = Object.entries(stats.status_stats || {}).map(([key, value]) => ({
        name: key,
        value: value,
        fill: key.includes('Progress') ? '#3b82f6' : key.includes('Done') ? '#10B77F' : key.includes('Review') ? '#8b5cf6' : key.includes('Blocked') ? '#ef4444' : '#6b7280'
    }));

    return (
        <PageTemplate
            title={t('Project Detail')}
            description={t('View project details, progress, and statistics.')}
            url="/project-reports"
            actions={pageActions}
            breadcrumbs={breadcrumbs}
            noPadding
        >
            {/* ── Modern hero header ── */}
            <div className="mb-6 rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #001a4d 0%, #002d80 60%, #001435 100%)' }}>
                <div className="px-8 py-6">
                    <div className="flex items-start justify-between flex-wrap gap-4">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <span className="text-xs font-semibold tracking-widest uppercase opacity-60 text-white">Project Report</span>
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusColor(project.status)}`}>
                                    {formatText(project.status || '')}
                                </span>
                            </div>
                            <h1 className="text-3xl font-bold text-white">{project.title || project.name}</h1>
                            {project.description && <p className="text-white/50 text-sm mt-1 max-w-xl line-clamp-2">{project.description}</p>}
                            <div className="flex gap-6 mt-4 text-sm text-white/70">
                                <span>📅 {t('Start')}: <strong className="text-white">{formatDate(project.start_date) || '—'}</strong></span>
                                <span>⏰ {t('Due')}: <strong className="text-white">{formatDate(project.deadline || project.end_date) || '—'}</strong></span>
                                <span>👥 {t('Members')}: <strong className="text-white">{(project.members?.length || 0) + (project.clients?.length || 0)}</strong></span>
                            </div>
                        </div>
                        {/* Big progress circle */}
                        <div className="relative w-28 h-28 shrink-0">
                            <svg className="w-28 h-28 -rotate-90">
                                <circle cx="56" cy="56" r="46" stroke="rgba(255,255,255,0.15)" strokeWidth="10" fill="none" />
                                <circle cx="56" cy="56" r="46" stroke="#E3B448" strokeWidth="10" fill="none"
                                    strokeDasharray={`${2 * Math.PI * 46}`}
                                    strokeDashoffset={`${2 * Math.PI * 46 * (1 - (stats.completion_percentage || 0) / 100)}`}
                                    strokeLinecap="round" />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-2xl font-bold text-white leading-none">{stats.completion_percentage || 0}%</span>
                                <span className="text-[10px] text-white/60 mt-0.5">{t('Complete')}</span>
                            </div>
                        </div>
                    </div>

                    {/* Stat bar */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/10">
                        {[
                            { label: t('Total Tasks'), value: stats.total_tasks || 0, icon: '📋' },
                            { label: t('Completed'), value: stats.completed_tasks || 0, icon: '✅' },
                            { label: t('Milestones'), value: `${stats.completed_milestones || 0}/${stats.total_milestones || 0}`, icon: '🏁' },
                            { label: t('Logged Hours'), value: `${stats.total_logged_hours || 0}h`, icon: '⏱️' },
                        ].map(s => (
                            <div key={s.label} className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.07)' }}>
                                <div className="text-lg mb-0.5">{s.icon}</div>
                                <div className="text-xl font-bold text-white leading-none">{s.value}</div>
                                <div className="text-xs text-white/50 mt-0.5">{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Charts row ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                {/* Milestone progress */}
                <Card className="rounded-2xl border shadow-sm">
                    <CardContent className="p-5">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
                            <span className="w-1 h-4 rounded-full inline-block" style={{ background: '#E3B448' }} />
                            {t('Milestone Progress')}
                        </h3>
                        <div className="flex flex-col items-center">
                            <div className="relative w-56 h-36">
                                <svg className="w-56 h-36" viewBox="0 0 224 144">
                                    <path d="M 32 136 A 80 80 0 0 1 192 136" stroke="#e5e7eb" strokeWidth="16" fill="none" />
                                    <path d="M 32 136 A 80 80 0 0 1 192 136" stroke="#E3B448" strokeWidth="16" fill="none"
                                        strokeDasharray={`${((stats.milestone_completion_percentage || 0) / 100) * 251} 251`}
                                        strokeLinecap="round" />
                                </svg>
                                <div className="absolute inset-x-0 bottom-0 flex flex-col items-center pb-2">
                                    <span className="text-2xl font-bold">{stats.milestone_completion_percentage || 0}%</span>
                                    <span className="text-xs text-muted-foreground">{stats.completed_milestones || 0}/{stats.total_milestones || 0} {t('completed')}</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Task Priority */}
                <Card className="rounded-2xl border shadow-sm">
                    <CardContent className="p-5">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
                            <span className="w-1 h-4 rounded-full inline-block" style={{ background: '#E3B448' }} />
                            {t('Task Priority')}
                        </h3>
                        <ResponsiveContainer width="100%" height={140}>
                            <BarChart data={priorityData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                <ChartTooltip formatter={(v: any) => [`${v} tasks`]} />
                                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                    {priorityData.map((entry, i) => (
                                        <Cell key={i} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Task Status */}
                <Card className="rounded-2xl border shadow-sm">
                    <CardContent className="p-5">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
                            <span className="w-1 h-4 rounded-full inline-block" style={{ background: '#E3B448' }} />
                            {t('Task Status')}
                        </h3>
                        {statusData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={140}>
                                <PieChart>
                                    <Pie data={statusData} cx="50%" cy="50%" outerRadius={55} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={9}>
                                        {statusData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                                    </Pie>
                                    <ChartTooltip formatter={(v: any, n: any) => [`${v} tasks`, n]} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-36 flex items-center justify-center text-sm text-muted-foreground">{t('No tasks yet')}</div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ── Hours Estimation ── */}
            <Card className="rounded-2xl border shadow-sm mb-6">
                <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                            <span className="w-1 h-4 rounded-full inline-block" style={{ background: '#E3B448' }} />
                            {t('Hours Estimation')}
                        </h3>
                        <span className="text-sm font-semibold" style={{ color: '#E3B448' }}>{t('Logged')}: {stats.total_logged_hours || 0}h</span>
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={stats.task_hours_data || []} margin={{ top: 5, right: 10, left: -20, bottom: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="task_name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" axisLine={false} tickLine={false} interval={0} />
                            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                            <ChartTooltip formatter={(v: any) => [`${v}h`]} />
                            <Bar dataKey="logged_hours" name={t('Logged Hours')} radius={[4, 4, 0, 0]} fill="#E3B448" />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* ── Users & Milestones ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                <Card className="rounded-2xl border shadow-sm">
                    <CardContent className="p-5">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
                            <span className="w-1 h-4 rounded-full inline-block" style={{ background: '#E3B448' }} />
                            {t('Team Members')}
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-xs text-muted-foreground">
                                        <th className="text-left pb-2 font-medium">{t('Name')}</th>
                                        <th className="text-center pb-2 font-medium">{t('Assigned')}</th>
                                        <th className="text-center pb-2 font-medium">{t('Done')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {userStats?.length ? userStats.map((user, i) => (
                                        <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                            <td className="py-2.5 font-medium">{user.name}</td>
                                            <td className="py-2.5 text-center">{user.assigned_tasks}</td>
                                            <td className="py-2.5 text-center">
                                                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: '#E3B44820', color: '#b8892a' }}>{user.done_tasks}</span>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={3} className="py-8 text-center text-muted-foreground">{t('No users found')}</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl border shadow-sm">
                    <CardContent className="p-5">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
                            <span className="w-1 h-4 rounded-full inline-block" style={{ background: '#001a4d' }} />
                            {t('Milestones')}
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-xs text-muted-foreground">
                                        <th className="text-left pb-2 font-medium">{t('Name')}</th>
                                        <th className="text-left pb-2 font-medium">{t('Progress')}</th>
                                        <th className="text-left pb-2 font-medium">{t('Status')}</th>
                                        <th className="text-left pb-2 font-medium">{t('Due')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {project.milestones?.length ? project.milestones.map((milestone) => (
                                        <tr key={milestone.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                            <td className="py-2.5 font-medium max-w-[120px] truncate">{milestone.title}</td>
                                            <td className="py-2.5">
                                                <div className="flex items-center gap-2">
                                                    <Progress value={milestone.progress} className="w-14 h-1.5" />
                                                    <span className="text-xs">{milestone.progress}%</span>
                                                </div>
                                            </td>
                                            <td className="py-2.5">
                                                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-orange-50 text-orange-700">{formatText(milestone.status)}</span>
                                            </td>
                                            <td className="py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                                                {formatDate(milestone.due_date) || '—'}
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">{t('No milestones found')}</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ── Tasks Table ── */}
            <div className="rounded-2xl border shadow-sm overflow-hidden">
                {/* Search and filters section */}
                <div className="border-b" style={{ background: 'linear-gradient(90deg, #001a4d08, transparent)' }}>
                    <SearchAndFilterBar
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        onSearch={handleSearch}
                        searchPlaceholder={t('Search tasks...')}
                        filters={[
                            {
                                name: 'user_id',
                                label: t('User'),
                                type: 'select',
                                searchable: true,
                                value: selectedUser,
                                onChange: setSelectedUser,
                                options: [
                                    { value: 'all', label: t('All Users') },
                                    ...(users?.map((user: any) => ({ value: (user.user?.id || user.id).toString(), label: user.user?.name || user.name })) || [])
                                ]
                            },
                            {
                                name: 'milestone_id',
                                label: t('Milestone'),
                                type: 'select',
                                value: selectedMilestone,
                                onChange: setSelectedMilestone,
                                options: [
                                    { value: 'all', label: t('All Milestones') },
                                    ...(project.milestones?.map((m: any) => ({ value: m.id.toString(), label: m.title })) || [])
                                ]
                            },
                            {
                                name: 'status',
                                label: t('Status'),
                                type: 'select',
                                value: selectedStatus,
                                onChange: setSelectedStatus,
                                options: [
                                    { value: 'all', label: t('All Status') },
                                    ...(stages?.map((stage: any) => ({ value: stage.name, label: stage.name })) || [])
                                ]
                            },
                            {
                                name: 'priority',
                                label: t('Priority'),
                                type: 'select',
                                value: selectedPriority,
                                onChange: setSelectedPriority,
                                options: [
                                    { value: 'all', label: t('All Priority') },
                                    { value: 'low', label: t('Low') },
                                    { value: 'medium', label: t('Medium') },
                                    { value: 'high', label: t('High') },
                                    { value: 'critical', label: t('Critical') },
                                ]
                            },
                        ]}
                        hasActiveFilters={hasActiveFilters}
                        activeFilterCount={activeFilterCount}
                        onResetFilters={handleResetFilters}
                    />
                    {/* Date range filter row */}
                    <div className="px-4 pb-3 border-t pt-3 flex flex-wrap gap-3 items-end">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-xs text-muted-foreground">{t('Task Date From')}</span>
                            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                                className="h-8 rounded-md border border-input bg-background px-2 text-xs w-36" />
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <span className="text-xs text-muted-foreground">{t('Task Date To')}</span>
                            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                                className="h-8 rounded-md border border-input bg-background px-2 text-xs w-36" />
                        </div>
                        {(dateFrom || dateTo) && (
                            <button onClick={() => { setDateFrom(''); setDateTo(''); }}
                                className="h-8 px-2 text-xs rounded-md border text-muted-foreground hover:text-foreground">
                                ✕ {t('Clear Dates')}
                            </button>
                        )}
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-[#F0F0F1] dark:bg-gray-800 border-b">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">{t('Task Name')}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">{t('Milestone')}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">{t('Start Date')}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">{t('Due Date')}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">{t('Assigned To')}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">{t('Total Logged Hours')}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">{t('Priority')}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">{t('Status')}</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center">
                                        <div className="text-gray-500">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                                            <p>{t('Loading tasks...')}</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center">
                                        <div className="text-red-500">
                                            <p className="text-lg mb-2">{error}</p>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => fetchTasks()}
                                                className="mt-2"
                                            >
                                                {t('Retry')}
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ) : tasks && tasks.length > 0 ? tasks.map((task, index) => (
                                <tr key={task.id || index} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">
                                            {task.title || task.name}
                                        </div>
                                        {task.description && (
                                            <div className="text-sm text-gray-500 truncate max-w-xs">
                                                {task.description}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {task.milestone?.title || task.milestone_title || '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-1.5 text-sm whitespace-nowrap text-gray-500">
                                            <Calendar className="h-3.5 w-3.5 shrink-0" />
                                            <span className="text-sm">{formatDate(task.start_date) || '-'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-1.5 text-sm whitespace-nowrap text-gray-500">
                                            <Calendar className="h-3.5 w-3.5 shrink-0" />
                                            <span className="text-sm">{formatDate(task.due_date || task.end_date) || '-'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {task.assigned_users && task.assigned_users.length > 0 ? (
                                            <div className="flex -space-x-1">
                                                {task.assigned_users.slice(0, 3).map((user: any, userIndex: number) => (
                                                    <Tooltip key={userIndex}>
                                                        <TooltipTrigger asChild>
                                                            <Avatar className="h-6 w-6 border-2 border-white cursor-pointer">
                                                                <AvatarImage src={user.avatar} />
                                                                <AvatarFallback className="bg-blue-500 text-white text-[10px] font-medium">
                                                                    {(user.name || user.user?.name)?.charAt(0)?.toUpperCase() || '?'}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>{user.name || user.user?.name || 'Unknown'}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                ))}
                                                {task.assigned_users.length > 3 && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className="h-6 w-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs cursor-pointer">
                                                                +{task.assigned_users.length - 3}
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <div className="space-y-1">
                                                                {task.assigned_users.slice(3).map((user: any, idx: number) => (
                                                                    <p key={idx}>{user.name || user.user?.name || 'Unknown'}</p>
                                                                ))}
                                                            </div>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-sm text-gray-500">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {task.logged_hours || task.total_logged_hours || 0}h
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${getPriorityBadgeColor(task.priority || 'medium')}`}>
                                            {formatText(task.priority || 'medium')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span
                                            className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset"
                                            style={{
                                                backgroundColor: (task.task_stage?.color || '#6b7280') + '20',
                                                color: task.task_stage?.color || '#6b7280',
                                                boxShadow: `inset 0 0 0 1px ${task.task_stage?.color}33`,
                                            }}
                                        >
                                            {formatText(task.status || task.stage || 'To Do')}
                                        </span>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center">
                                        <div className="text-gray-500">
                                            <p className="text-lg mb-2">{t('No tasks found matching your criteria.')}</p>
                                            <p className="text-sm">{t('Try adjusting your search or filter criteria.')}</p>
                                            {!hasActiveFilters() && (
                                                <p className="text-sm mt-2">{t('This project may not have any tasks yet.')}</p>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {pagination && (
                        <Pagination
                            from={pagination.from || 0}
                            to={pagination.to || 0}
                            total={pagination.total || 0}
                            entityName={t('tasks')}
                            currentPerPage={perPage.toString()}
                            onPerPageChange={(value) => setPerPage(parseInt(value))}
                            links={[
                                { label: '&laquo; Previous', url: currentPage > 1 ? `?page=${currentPage - 1}` : null, active: false },
                                ...Array.from({ length: pagination.last_page }, (_, i) => ({
                                    label: String(i + 1),
                                    url: `?page=${i + 1}`,
                                    active: i + 1 === currentPage
                                })),
                                { label: 'Next &raquo;', url: currentPage < pagination.last_page ? `?page=${currentPage + 1}` : null, active: false }
                            ]}
                            onPageChange={(url) => {
                                const page = new URL(url, window.location.href).searchParams.get('page');
                                if (page) handlePageChange(parseInt(page));
                            }}
                        />
                )}
            </div>
        </PageTemplate>
    );
}