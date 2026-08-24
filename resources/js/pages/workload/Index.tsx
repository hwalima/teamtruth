import { Head, router, usePage } from '@inertiajs/react';
import { PageTemplate } from '@/components/page-template';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    AlertTriangle, ArrowLeft, ArrowRight, Calendar, ChevronDown,
    Clock, Flame, Minus, Target, TrendingUp, Users, Zap
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface DailyLoad {
    date: string;
    tasks: number;
    estimated_hours: number;
    logged_hours: number;
}

interface MemberTask {
    id: number;
    title: string;
    project: string;
    priority: string;
    progress: number;
    estimated_hours: number;
    start_date: string;
    end_date: string;
}

interface MemberWorkload {
    id: number;
    name: string;
    avatar: string;
    role: string;
    task_count: number;
    total_estimated: number;
    total_logged: number;
    capacity_hours: number;
    utilization: number;
    status: 'overloaded' | 'optimal' | 'moderate' | 'underutilized';
    daily_load: DailyLoad[];
    tasks: MemberTask[];
}

interface Props {
    workload: MemberWorkload[];
    days: string[];
    range: string;
    start_date: string;
    end_date: string;
}

const STATUS_CONFIG = {
    overloaded: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/20', border: 'border-red-200 dark:border-red-800/40', icon: <Flame className="w-3.5 h-3.5" />, label: 'Overloaded' },
    optimal: { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/20', border: 'border-green-200 dark:border-green-800/40', icon: <Target className="w-3.5 h-3.5" />, label: 'Optimal' },
    moderate: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/20', border: 'border-amber-200 dark:border-amber-800/40', icon: <Minus className="w-3.5 h-3.5" />, label: 'Moderate' },
    underutilized: { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/20', border: 'border-blue-200 dark:border-blue-800/40', icon: <Zap className="w-3.5 h-3.5" />, label: 'Underutilized' },
};

function getHeatColor(tasks: number, hours: number): string {
    const intensity = hours > 0 ? hours : tasks * 2;
    if (intensity === 0) return 'bg-slate-50 dark:bg-slate-900/30';
    if (intensity <= 1) return 'bg-emerald-100 dark:bg-emerald-900/40';
    if (intensity <= 2) return 'bg-emerald-200 dark:bg-emerald-800/50';
    if (intensity <= 4) return 'bg-yellow-200 dark:bg-yellow-800/50';
    if (intensity <= 6) return 'bg-amber-300 dark:bg-amber-700/50';
    if (intensity <= 8) return 'bg-orange-300 dark:bg-orange-700/50';
    if (intensity <= 10) return 'bg-red-300 dark:bg-red-700/50';
    return 'bg-red-500 dark:bg-red-600/70';
}

function formatDay(dateStr: string): { day: string; weekday: string; isWeekend: boolean } {
    const d = new Date(dateStr + 'T00:00:00');
    const weekday = d.toLocaleDateString('en', { weekday: 'short' });
    const day = d.getDate().toString();
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    return { day, weekday, isWeekend };
}

export default function WorkloadIndex() {
    const { t } = useTranslation();
    const { workload, days, range, start_date, end_date } = usePage().props as unknown as Props;
    const [expandedMember, setExpandedMember] = useState<number | null>(null);
    const [activeRange, setActiveRange] = useState(range);

    const navigate = (direction: 'prev' | 'next') => {
        const start = new Date(start_date + 'T00:00:00');
        const offset = activeRange === 'month' ? 30 : activeRange === '2weeks' ? 14 : 7;
        direction === 'next' ? start.setDate(start.getDate() + offset) : start.setDate(start.getDate() - offset);
        router.get(route('workload.index'), { range: activeRange, start: start.toISOString().split('T')[0] }, { preserveState: true });
    };

    const changeRange = (newRange: string) => {
        setActiveRange(newRange);
        router.get(route('workload.index'), { range: newRange }, { preserveState: true });
    };

    const summaryStats = {
        total: workload.length,
        overloaded: workload.filter(m => m.status === 'overloaded').length,
        optimal: workload.filter(m => m.status === 'optimal').length,
        underutilized: workload.filter(m => m.status === 'underutilized').length,
    };

    const startFormatted = new Date(start_date + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' });
    const endFormatted = new Date(end_date + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });

    return (
        <PageTemplate title={t('Workload')}>
            <Head title={t('Team Workload')} />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Users className="w-6 h-6 text-primary" />
                            {t('Team Workload')}
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5">{t('Capacity heatmap — spot overload and gaps at a glance')}</p>
                    </div>

                    <div className="flex items-center gap-2">
                        {['week', '2weeks', 'month'].map(r => (
                            <Button key={r} size="sm" variant={activeRange === r ? 'default' : 'outline'} onClick={() => changeRange(r)}>
                                {r === 'week' ? '1W' : r === '2weeks' ? '2W' : '1M'}
                            </Button>
                        ))}
                        <div className="flex items-center border rounded-lg">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => navigate('prev')}><ArrowLeft className="w-4 h-4" /></Button>
                            <span className="text-xs font-medium px-2 whitespace-nowrap">{startFormatted} – {endFormatted}</span>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => navigate('next')}><ArrowRight className="w-4 h-4" /></Button>
                        </div>
                    </div>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Card className="border-0 shadow-sm">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Users className="w-5 h-5 text-primary" /></div>
                            <div><p className="text-2xl font-bold">{summaryStats.total}</p><p className="text-xs text-muted-foreground">{t('Team members')}</p></div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-sm">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/20 flex items-center justify-center"><Flame className="w-5 h-5 text-red-500" /></div>
                            <div><p className="text-2xl font-bold text-red-600">{summaryStats.overloaded}</p><p className="text-xs text-muted-foreground">{t('Overloaded')}</p></div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-sm">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/20 flex items-center justify-center"><Target className="w-5 h-5 text-green-500" /></div>
                            <div><p className="text-2xl font-bold text-green-600">{summaryStats.optimal}</p><p className="text-xs text-muted-foreground">{t('Optimal')}</p></div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-sm">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center"><Zap className="w-5 h-5 text-blue-500" /></div>
                            <div><p className="text-2xl font-bold text-blue-600">{summaryStats.underutilized}</p><p className="text-xs text-muted-foreground">{t('Available')}</p></div>
                        </CardContent>
                    </Card>
                </div>

                {/* Heatmap */}
                <Card className="overflow-hidden">
                    <CardHeader className="pb-2 border-b">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Calendar className="w-4 h-4" /> {t('Capacity Heatmap')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[600px]">
                                <thead>
                                    <tr className="border-b bg-muted/30">
                                        <th className="text-left text-[11px] font-medium text-muted-foreground px-3 py-2 w-[160px] sticky left-0 bg-background z-10">{t('Member')}</th>
                                        {days.map(day => {
                                            const { day: d, weekday, isWeekend } = formatDay(day);
                                            return (
                                                <th key={day} className={`text-center px-0.5 py-1.5 min-w-[32px] ${isWeekend ? 'opacity-40' : ''}`}>
                                                    <div className="text-[9px] text-muted-foreground leading-tight">{weekday}</div>
                                                    <div className="text-[10px] font-semibold leading-tight">{d}</div>
                                                </th>
                                            );
                                        })}
                                        <th className="text-center text-[11px] font-medium text-muted-foreground px-2 py-2 w-[70px]">{t('Load')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {workload.map(member => {
                                        const cfg = STATUS_CONFIG[member.status];
                                        const expanded = expandedMember === member.id;
                                        return (
                                            <>
                                                <tr key={member.id} className={`border-b hover:bg-muted/20 cursor-pointer transition-colors ${expanded ? 'bg-muted/10' : ''}`} onClick={() => setExpandedMember(expanded ? null : member.id)}>
                                                    <td className="px-3 py-1.5 sticky left-0 bg-background z-10">
                                                        <div className="flex items-center gap-2">
                                                            <Avatar className="h-6 w-6">
                                                                <AvatarImage src={member.avatar} />
                                                                <AvatarFallback className="text-[9px]">{member.name.split(' ').map(n => n[0]).join('').toUpperCase()}</AvatarFallback>
                                                            </Avatar>
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-medium truncate leading-tight">{member.name}</p>
                                                                <p className="text-[9px] text-muted-foreground leading-tight">{member.task_count} tasks</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    {member.daily_load.map((dl, i) => {
                                                        const { isWeekend } = formatDay(dl.date);
                                                        const intensity = dl.estimated_hours > 0 ? dl.estimated_hours : dl.tasks * 2;
                                                        return (
                                                            <td key={i} className={`px-0.5 py-1 ${isWeekend ? 'opacity-30' : ''}`}>
                                                                <div
                                                                    className={`w-full h-7 rounded flex items-center justify-center text-[9px] font-bold ${getHeatColor(dl.tasks, dl.estimated_hours)} ${intensity > 8 ? 'text-white dark:text-white' : intensity > 0 ? 'text-foreground/80' : ''}`}
                                                                    title={`${dl.date}: ${dl.tasks} tasks, ${dl.estimated_hours}h est, ${dl.logged_hours}h logged`}
                                                                >
                                                                    {dl.tasks > 0 ? dl.tasks : ''}
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="px-2 py-1.5 text-center">
                                                        <div className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                                                            {cfg.icon}
                                                            {member.utilization}%
                                                        </div>
                                                    </td>
                                                </tr>
                                                {expanded && (
                                                    <tr key={`${member.id}-detail`} className="border-b bg-muted/5">
                                                        <td colSpan={days.length + 2} className="p-4">
                                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
                                                                <div className="flex items-center gap-2 text-sm">
                                                                    <Clock className="w-4 h-4 text-muted-foreground" />
                                                                    <span className="text-muted-foreground">{t('Estimated')}:</span>
                                                                    <span className="font-semibold">{member.total_estimated}h</span>
                                                                    <span className="text-muted-foreground">/ {member.capacity_hours}h capacity</span>
                                                                </div>
                                                                <div className="flex items-center gap-2 text-sm">
                                                                    <TrendingUp className="w-4 h-4 text-muted-foreground" />
                                                                    <span className="text-muted-foreground">{t('Logged')}:</span>
                                                                    <span className="font-semibold">{member.total_logged}h</span>
                                                                </div>
                                                                <div className="flex items-center gap-2 text-sm">
                                                                    <Target className="w-4 h-4 text-muted-foreground" />
                                                                    <span className="text-muted-foreground">{t('Utilization')}:</span>
                                                                    <div className="flex-1 max-w-[120px] h-2 bg-muted rounded-full overflow-hidden">
                                                                        <div className={`h-full rounded-full transition-all ${member.utilization > 100 ? 'bg-red-500' : member.utilization > 70 ? 'bg-green-500' : 'bg-blue-400'}`} style={{ width: `${Math.min(member.utilization, 100)}%` }} />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            {member.tasks.length > 0 && (
                                                                <div className="space-y-1.5">
                                                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('Assigned tasks')}</p>
                                                                    {member.tasks.map(task => (
                                                                        <div key={task.id} className="flex items-center gap-3 text-sm px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => router.visit(route('tasks.show', task.id))}>
                                                                            <span className={`w-2 h-2 rounded-full shrink-0 ${task.priority === 'critical' ? 'bg-red-500' : task.priority === 'high' ? 'bg-orange-500' : task.priority === 'medium' ? 'bg-amber-400' : 'bg-green-400'}`} />
                                                                            <span className="flex-1 truncate">{task.title}</span>
                                                                            <span className="text-xs text-muted-foreground shrink-0">{task.project}</span>
                                                                            <span className="text-xs text-muted-foreground shrink-0">{task.estimated_hours || 0}h</span>
                                                                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden shrink-0">
                                                                                <div className="h-full bg-primary rounded-full" style={{ width: `${task.progress}%` }} />
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )}
                                            </>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {workload.length === 0 && (
                            <div className="text-center py-16">
                                <Users className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
                                <p className="text-lg font-medium text-muted-foreground">{t('No team members found')}</p>
                                <p className="text-sm text-muted-foreground/60">{t('Add members to your workspace to see workload data')}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="font-medium">{t('Tasks/day')}:</span>
                    {[
                        { label: '0', cls: 'bg-slate-50 dark:bg-slate-900/30' },
                        { label: '1', cls: 'bg-emerald-200 dark:bg-emerald-800/50' },
                        { label: '2', cls: 'bg-yellow-200 dark:bg-yellow-800/50' },
                        { label: '3', cls: 'bg-amber-300 dark:bg-amber-700/50' },
                        { label: '4', cls: 'bg-orange-300 dark:bg-orange-700/50' },
                        { label: '5+', cls: 'bg-red-500 dark:bg-red-600/70' },
                    ].map(l => (
                        <div key={l.label} className="flex items-center gap-1">
                            <span className={`w-3.5 h-3.5 rounded-sm ${l.cls} border border-black/5`} />
                            <span>{l.label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </PageTemplate>
    );
}
