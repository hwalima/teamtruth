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

function getHeatColor(hours: number): string {
    if (hours === 0) return 'bg-gray-100 dark:bg-gray-800';
    if (hours <= 2) return 'bg-green-100 dark:bg-green-900/30';
    if (hours <= 4) return 'bg-green-200 dark:bg-green-800/40';
    if (hours <= 6) return 'bg-amber-100 dark:bg-amber-900/30';
    if (hours <= 8) return 'bg-amber-200 dark:bg-amber-800/40';
    if (hours <= 10) return 'bg-orange-200 dark:bg-orange-800/40';
    return 'bg-red-300 dark:bg-red-800/50';
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
                            <table className="w-full min-w-[700px]">
                                <thead>
                                    <tr className="border-b bg-muted/30">
                                        <th className="text-left text-xs font-medium text-muted-foreground p-3 w-[200px] sticky left-0 bg-background z-10">{t('Member')}</th>
                                        {days.map(day => {
                                            const { day: d, weekday, isWeekend } = formatDay(day);
                                            return (
                                                <th key={day} className={`text-center p-1.5 min-w-[44px] ${isWeekend ? 'opacity-50' : ''}`}>
                                                    <div className="text-[10px] text-muted-foreground">{weekday}</div>
                                                    <div className="text-xs font-medium">{d}</div>
                                                </th>
                                            );
                                        })}
                                        <th className="text-center text-xs font-medium text-muted-foreground p-3 w-[100px]">{t('Load')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {workload.map(member => {
                                        const cfg = STATUS_CONFIG[member.status];
                                        const expanded = expandedMember === member.id;
                                        return (
                                            <>
                                                <tr key={member.id} className={`border-b hover:bg-muted/20 cursor-pointer transition-colors ${expanded ? 'bg-muted/10' : ''}`} onClick={() => setExpandedMember(expanded ? null : member.id)}>
                                                    <td className="p-3 sticky left-0 bg-background z-10">
                                                        <div className="flex items-center gap-2.5">
                                                            <Avatar className="h-8 w-8">
                                                                <AvatarImage src={member.avatar} />
                                                                <AvatarFallback className="text-xs">{member.name.split(' ').map(n => n[0]).join('').toUpperCase()}</AvatarFallback>
                                                            </Avatar>
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-medium truncate">{member.name}</p>
                                                                <p className="text-[10px] text-muted-foreground">{member.task_count} tasks</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    {member.daily_load.map((dl, i) => {
                                                        const { isWeekend } = formatDay(dl.date);
                                                        return (
                                                            <td key={i} className={`p-1 ${isWeekend ? 'opacity-40' : ''}`}>
                                                                <div
                                                                    className={`w-full aspect-square rounded-md flex items-center justify-center text-[10px] font-medium ${getHeatColor(dl.estimated_hours)} ${dl.estimated_hours > 8 ? 'text-red-800 dark:text-red-200' : dl.estimated_hours > 0 ? 'text-foreground/70' : 'text-muted-foreground/40'}`}
                                                                    title={`${dl.date}: ${dl.estimated_hours}h est, ${dl.logged_hours}h logged, ${dl.tasks} tasks`}
                                                                >
                                                                    {dl.estimated_hours > 0 ? dl.estimated_hours : ''}
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="p-3 text-center">
                                                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
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
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span className="font-medium">{t('Hours/day')}:</span>
                    {[
                        { label: '0', cls: 'bg-gray-100 dark:bg-gray-800' },
                        { label: '1-2', cls: 'bg-green-100 dark:bg-green-900/30' },
                        { label: '3-4', cls: 'bg-green-200 dark:bg-green-800/40' },
                        { label: '5-6', cls: 'bg-amber-100 dark:bg-amber-900/30' },
                        { label: '7-8', cls: 'bg-amber-200 dark:bg-amber-800/40' },
                        { label: '9-10', cls: 'bg-orange-200 dark:bg-orange-800/40' },
                        { label: '10+', cls: 'bg-red-300 dark:bg-red-800/50' },
                    ].map(l => (
                        <div key={l.label} className="flex items-center gap-1.5">
                            <span className={`w-4 h-4 rounded ${l.cls}`} />
                            <span>{l.label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </PageTemplate>
    );
}
