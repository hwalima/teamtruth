import React, { useState, useEffect } from 'react';
import { PageTemplate } from '@/components/page-template';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, Eye, DollarSign, CheckCircle, Wallet, BarChart3, Clock, Tag, User, FolderOpen, Calendar, AlertTriangle, TrendingDown, Activity, ArrowUpRight, ShieldAlert, Zap, ArrowRight } from 'lucide-react';
import { Link, router } from '@inertiajs/react';
import { formatCurrency } from '@/utils/currency';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface BudgetDashboardProps {
    initialData?: any;
}

export default function BudgetDashboard({ initialData }: BudgetDashboardProps) {
    const { t } = useTranslation();
    const [dashboardData, setDashboardData] = useState<any>(initialData || null);
    const [loading, setLoading] = useState(!initialData);
    const [hoveredCategory, setHoveredCategory] = useState<number | null>(null);

    const formatText = (text: string) => {
        return text.replace(/_/g, ' ').split(' ').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
    };

    useEffect(() => {
        if (!initialData) loadDashboardData();
    }, [initialData]);

    const loadDashboardData = async () => {
        try {
            const response = await fetch(route('budget-dashboard.overview'));
            const data = await response.json();
            setDashboardData(data);
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const breadcrumbs = [
        { title: t('Dashboard'), href: route('dashboard') },
        { title: t('Budget & Expenses') },
        { title: t('Budget Dashboard') }
    ];

    const summary = dashboardData?.summary;

    const statCards = [
        {
            title: t('Total Budget'),
            value: formatCurrency(summary?.total_budget || 0),
            icon: DollarSign,
            iconBg: 'bg-blue-100 dark:bg-blue-900',
            iconColor: 'text-blue-600 dark:text-blue-300',
            valueColor: 'text-blue-600 dark:text-blue-400',
        },
        {
            title: t('Total Spent'),
            value: formatCurrency(summary?.total_spent || 0),
            icon: TrendingUp,
            iconBg: 'bg-orange-100 dark:bg-orange-900',
            iconColor: 'text-orange-600 dark:text-orange-300',
            valueColor: 'text-orange-600 dark:text-orange-400',
        },
        {
            title: t('Remaining'),
            value: formatCurrency(summary?.remaining_budget || 0),
            icon: Wallet,
            iconBg: (summary?.remaining_budget || 0) < 0 ? 'bg-red-100 dark:bg-red-900' : 'bg-green-100 dark:bg-green-900',
            iconColor: (summary?.remaining_budget || 0) < 0 ? 'text-red-600 dark:text-red-300' : 'text-green-600 dark:text-green-300',
            valueColor: (summary?.remaining_budget || 0) < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400',
        },
        {
            title: t('Avg Utilization'),
            value: `${(summary?.average_utilization || 0).toFixed(1)}%`,
            icon: BarChart3,
            iconBg: (summary?.average_utilization || 0) >= 90 ? 'bg-red-100 dark:bg-red-900' : (summary?.average_utilization || 0) >= 75 ? 'bg-yellow-100 dark:bg-yellow-900' : 'bg-purple-100 dark:bg-purple-900',
            iconColor: (summary?.average_utilization || 0) >= 90 ? 'text-red-600 dark:text-red-300' : (summary?.average_utilization || 0) >= 75 ? 'text-yellow-600 dark:text-yellow-300' : 'text-purple-600 dark:text-purple-300',
            valueColor: (summary?.average_utilization || 0) >= 90 ? 'text-red-600 dark:text-red-400' : (summary?.average_utilization || 0) >= 75 ? 'text-yellow-600 dark:text-yellow-400' : 'text-purple-600 dark:text-purple-400',
        },
        {
            title: t('Active Budgets'),
            value: summary?.active_budgets || 0,
            icon: CheckCircle,
            iconBg: 'bg-teal-100 dark:bg-teal-900',
            iconColor: 'text-teal-600 dark:text-teal-300',
            valueColor: 'text-teal-600 dark:text-teal-400',
        },
        {
            title: t('Pending Approvals'),
            value: summary?.pending_approvals || 0,
            icon: Clock,
            iconBg: (summary?.pending_approvals || 0) > 0 ? 'bg-yellow-100 dark:bg-yellow-900' : 'bg-gray-100 dark:bg-gray-800',
            iconColor: (summary?.pending_approvals || 0) > 0 ? 'text-yellow-600 dark:text-yellow-300' : 'text-gray-400',
            valueColor: (summary?.pending_approvals || 0) > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-500 dark:text-gray-400',
        },
    ];

    const allExpenses = dashboardData?.recent_expenses || [];

    if (loading) {
        return (
            <PageTemplate
                title={t('Budget Dashboard')}
                description={t('Overview of budget performance and expense tracking')}
                url="/budgets-dashboard"
                breadcrumbs={breadcrumbs}
            >
                <div className="flex items-center justify-center h-64">
                    <div className="text-gray-500">{t('Loading dashboard...')}</div>
                </div>
            </PageTemplate>
        );
    }

    return (
        <PageTemplate
            title={t('Budget Dashboard')}
            description={t('Overview of budget performance and expense tracking')}
            url="/budgets-dashboard"
            breadcrumbs={breadcrumbs}
            noPadding
        >
            <div className="space-y-6">

                {/* Stat Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
                    {/* Total Budget */}
                    <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-bl-full" />
                        <CardContent className="relative p-5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Total Budget')}</p>
                                    <p className="text-xl font-bold text-gray-900 dark:text-white font-mono">{formatCurrency(summary?.total_budget || 0)}</p>
                                </div>
                                <div className="relative z-10 p-2.5 bg-blue-50 dark:bg-blue-900/30 rounded-xl mt-0.5">
                                    <DollarSign className="h-5 w-5 text-blue-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    {/* Total Spent */}
                    <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-orange-50 dark:bg-orange-900/30 rounded-bl-full" />
                        <CardContent className="relative p-5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Total Spent')}</p>
                                    <p className="text-xl font-bold text-gray-900 dark:text-white font-mono">{formatCurrency(summary?.total_spent || 0)}</p>
                                </div>
                                <div className="relative z-10 p-2.5 bg-orange-50 dark:bg-orange-900/30 rounded-xl mt-0.5">
                                    <TrendingUp className="h-5 w-5 text-orange-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    {/* Remaining */}
                    {(() => {
                        const isNeg = (summary?.remaining_budget || 0) < 0;
                        return (
                            <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                                <div className={`absolute top-0 right-0 w-20 h-20 rounded-bl-full ${isNeg ? 'bg-red-50 dark:bg-red-900/30' : 'bg-green-50 dark:bg-green-900/30'}`} />
                                <CardContent className="relative p-5">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Remaining')}</p>
                                            <p className="text-xl font-bold text-gray-900 dark:text-white font-mono">{formatCurrency(summary?.remaining_budget || 0)}</p>
                                        </div>
                                        <div className={`relative z-10 p-2.5 rounded-xl mt-0.5 ${isNeg ? 'bg-red-50 dark:bg-red-900/30' : 'bg-green-50 dark:bg-green-900/30'}`}>
                                            <Wallet className={`h-5 w-5 ${isNeg ? 'text-red-600' : 'text-green-600'}`} />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })()}
                    {/* Avg Utilization */}
                    {(() => {
                        const util = summary?.average_utilization || 0;
                        const color = util >= 90 ? 'red' : util >= 75 ? 'yellow' : 'purple';
                        const bgMap: Record<string, string> = { red: 'bg-red-50 dark:bg-red-900/30', yellow: 'bg-yellow-50 dark:bg-yellow-900/30', purple: 'bg-purple-50 dark:bg-purple-900/30' };
                        const iconMap: Record<string, string> = { red: 'text-red-600', yellow: 'text-yellow-600', purple: 'text-purple-600' };
                        return (
                            <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                                <div className={`absolute top-0 right-0 w-20 h-20 rounded-bl-full ${bgMap[color]}`} />
                                <CardContent className="relative p-5">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Avg Utilization')}</p>
                                            <p className="text-xl font-bold text-gray-900 dark:text-white">{util.toFixed(1)}%</p>
                                        </div>
                                        <div className={`relative z-10 p-2.5 rounded-xl mt-0.5 ${bgMap[color]}`}>
                                            <BarChart3 className={`h-5 w-5 ${iconMap[color]}`} />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })()}
                    {/* Active Budgets */}
                    <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-teal-50 dark:bg-teal-900/30 rounded-bl-full" />
                        <CardContent className="relative p-5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Active Budgets')}</p>
                                    <p className="text-xl font-bold text-gray-900 dark:text-white">{summary?.active_budgets || 0}</p>
                                </div>
                                <div className="relative z-10 p-2.5 bg-teal-50 dark:bg-teal-900/30 rounded-xl mt-0.5">
                                    <CheckCircle className="h-5 w-5 text-teal-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    {/* Pending Approvals */}
                    {(() => {
                        const hasPending = (summary?.pending_approvals || 0) > 0;
                        return (
                            <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                                <div className={`absolute top-0 right-0 w-20 h-20 rounded-bl-full ${hasPending ? 'bg-yellow-50 dark:bg-yellow-900/30' : 'bg-gray-50 dark:bg-gray-700/30'}`} />
                                <CardContent className="relative p-5">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Pending Approvals')}</p>
                                            <p className="text-xl font-bold text-gray-900 dark:text-white">{summary?.pending_approvals || 0}</p>
                                        </div>
                                        <div className={`relative z-10 p-2.5 rounded-xl mt-0.5 ${hasPending ? 'bg-yellow-50 dark:bg-yellow-900/30' : 'bg-gray-50 dark:bg-gray-700/30'}`}>
                                            <Clock className={`h-5 w-5 ${hasPending ? 'text-yellow-600' : 'text-gray-400'}`} />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })()}
                </div>

                {/* Budget Health Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Spend vs Budget Progress */}
                    <div className="lg:col-span-2">
                        <Card className="border border-gray-200 dark:border-gray-700 shadow-sm h-full">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                                        <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div>
                                        <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('Budget Health Overview')}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('Spend vs allocated across all budgets')}</p>
                                    </div>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => router.get(route('budgets.index'))}>
                                    {t('All Budgets')}
                                </Button>
                            </div>
                            <CardContent className="p-5">
                                {/* Overall spend bar */}
                                <div className="mb-5 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('Overall Budget Utilization')}</span>
                                        <span className={`text-sm font-bold ${
                                            (summary?.average_utilization || 0) >= 90 ? 'text-red-600 dark:text-red-400' :
                                            (summary?.average_utilization || 0) >= 75 ? 'text-yellow-600 dark:text-yellow-400' :
                                            'text-green-600 dark:text-green-400'
                                        }`}>{(summary?.average_utilization || 0).toFixed(1)}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                                        <div
                                            className={`h-1.5 rounded-full transition-all duration-700 ${
                                                (summary?.average_utilization || 0) >= 90 ? 'bg-red-500' :
                                                (summary?.average_utilization || 0) >= 75 ? 'bg-yellow-500' :
                                                'bg-green-500'
                                            }`}
                                            style={{ width: `${Math.min(summary?.average_utilization || 0, 100)}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between mt-2">
                                        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{formatCurrency(summary?.total_spent || 0)} {t('spent')}</span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{formatCurrency(summary?.total_budget || 0)} {t('total')}</span>
                                    </div>
                                </div>
                                {/* Key metrics row */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="text-center p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30">
                                        <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">{t('Active Budgets')}</p>
                                        <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{summary?.active_budgets || 0}</p>
                                    </div>
                                    <div className="text-center p-3 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/30">
                                        <p className="text-xs text-orange-600 dark:text-orange-400 font-medium mb-1">{t('Total Spent')}</p>
                                        <p className="text-lg font-bold text-orange-700 dark:text-orange-300 truncate font-mono">{formatCurrency(summary?.total_spent || 0)}</p>
                                    </div>
                                    <div className="text-center p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30">
                                        <p className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">{t('Remaining')}</p>
                                        <p className={`text-lg font-bold truncate font-mono ${
                                            (summary?.remaining_budget || 0) < 0 ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'
                                        }`}>{formatCurrency(summary?.remaining_budget || 0)}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Budget Alerts */}
                    <div>
                        <Card className="border border-gray-200 dark:border-gray-700 shadow-sm h-full flex flex-col">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                                        (dashboardData?.budget_alerts?.length || 0) > 0 ? 'bg-red-50 dark:bg-red-900/30' : 'bg-gray-50 dark:bg-gray-800'
                                    }`}>
                                        <ShieldAlert className={`h-4 w-4 ${
                                            (dashboardData?.budget_alerts?.length || 0) > 0 ? 'text-red-500' : 'text-gray-400'
                                        }`} />
                                    </div>
                                    <div>
                                        <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('Budget Alerts')}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('Budgets over 75% utilized')}</p>
                                    </div>
                                </div>
                                {(dashboardData?.budget_alerts?.length || 0) > 0 && (
                                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 ring-1 ring-inset ring-red-600/20">
                                        {dashboardData.budget_alerts.length}
                                    </span>
                                )}
                            </div>
                            <CardContent className="p-0 flex-1 overflow-y-auto">
                                {dashboardData?.budget_alerts && dashboardData.budget_alerts.length > 0 ? (
                                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {dashboardData.budget_alerts.map((alert: any, i: number) => {
                                            const isCritical = alert.utilization >= 90;
                                            return (
                                                <div key={i} className="px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <div className={`shrink-0 h-8 w-8 rounded-lg flex items-center justify-center ${
                                                                isCritical ? 'bg-red-50 dark:bg-red-900/30' : 'bg-yellow-50 dark:bg-yellow-900/30'
                                                            }`}>
                                                                <AlertTriangle className={`h-4 w-4 ${
                                                                    isCritical ? 'text-red-500' : 'text-yellow-500'
                                                                }`} />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{alert.project}</p>
                                                                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{formatCurrency(alert.remaining)} {t('remaining')}</p>
                                                            </div>
                                                        </div>
                                                        <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                                                            isCritical 
                                                                ? 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-900/40 dark:text-red-300' 
                                                                : 'bg-yellow-50 text-yellow-700 ring-yellow-600/20 dark:bg-yellow-900/40 dark:text-yellow-300'
                                                        }`}>{alert.utilization}%</span>
                                                    </div>
                                                    <div className="mt-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                                                        <div
                                                            className={`h-1.5 rounded-full transition-all duration-500 ${
                                                                isCritical ? 'bg-red-500' : 'bg-yellow-500'
                                                            }`}
                                                            style={{ width: `${Math.min(alert.utilization, 100)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-12">
                                        <div className="h-12 w-12 rounded-2xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center mb-3">
                                            <CheckCircle className="h-6 w-6 text-green-500" />
                                        </div>
                                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('All budgets healthy')}</p>
                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('No budgets over 75% utilized')}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                </div>

                {/* Recent Expenses + Top Categories */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">

                    {/* Recent Expenses */}
                    <div className="lg:col-span-2">
                        <Card className="shadow-sm border border-gray-200 dark:border-gray-700 h-full flex flex-col">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                        <TrendingUp className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('Recent Expenses')}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('Latest submitted expenses')}</p>
                                    </div>
                                </div>
                                <Link href={route('expenses.index')} className="block">
                                    <div className="group/link flex items-center gap-1.5 text-xs font-bold text-primary mt-4 hover:text-primary/80 transition-colors">{t('View All')} <ArrowRight className="h-3.5 w-3.5" /></div>
                                </Link>

                            </div>
                            <CardContent className="p-0 flex-1 overflow-y-auto">
                                {allExpenses.length > 0 ? (
                                    <Table className="w-full text-sm">
                                        <TableHeader>
                                            <TableRow className="bg-[#F0F0F1] dark:bg-gray-800 border-b hover:bg-[#F0F0F1] dark:hover:bg-gray-800">
                                                <TableHead>{t('Expense')}</TableHead>
                                                <TableHead>{t('Project')}</TableHead>
                                                <TableHead>{t('Date')}</TableHead>
                                                <TableHead>{t('Amount')}</TableHead>
                                                <TableHead>{t('Status')}</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                                            {allExpenses.map((expense: any) => (
                                                <TableRow
                                                    key={expense.id || Math.random()}
                                                >
                                                    <TableCell>
                                                        <div className="flex items-center gap-2.5">
                                                            <Avatar className="h-7 w-7 shrink-0">
                                                                <AvatarImage src={expense.submitter?.avatar || undefined} alt={expense.submitter?.name} />
                                                                <AvatarFallback className="text-xs">{expense.submitter?.name ? expense.submitter.name.charAt(0) : '?'}</AvatarFallback>
                                                            </Avatar>
                                                            <div className="min-w-0">
                                                                <p className="font-semibold text-gray-900 dark:text-gray-100 ">{expense.title || t('Untitled Expense')}</p>
                                                                <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{expense.submitter?.name || t('Unknown')}{expense.budgetCategory?.name ? ` · ${expense.budgetCategory.name}` : ''}</p>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell >
                                                        <span className="inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/20">
                                                            <span>{expense.project?.title || t('No Project')}</span>
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        {expense.expense_date ? (
                                    <div className="flex items-center gap-1.5 text-sm whitespace-nowrap text-gray-500">
                                                                <Calendar className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                                                                <span className="text-sm text-gray-500">{window.appSettings.formatDateTime(new Date(expense.expense_date), false)}</span>
                                                            </div>
                                                        ) : <span className="text-xs text-gray-300 dark:text-gray-600">—</span>}
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap font-mono">{formatCurrency(expense.amount || 0)}</span>
                                                    </TableCell>
                                                    <TableCell className="font-medium py-2.5">
                                                        <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold ${
                                                            expense.status === 'approved' ? 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/20 dark:text-green-400' :
                                                            expense.status === 'rejected' ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-900/20 dark:text-red-400' :
                                                            'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20 dark:bg-yellow-900/20 dark:text-yellow-400'
                                                        }`}>
                                                            {formatText(expense.status || 'pending')}
                                                        </span>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-16">
                                        <div className="h-14 w-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                                            <TrendingUp className="h-7 w-7 text-gray-400" />
                                        </div>
                                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('No recent expenses')}</p>
                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('Expenses will appear here once submitted')}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Top Categories */}
                    <div>
                        <Card className="shadow-sm border border-gray-200 dark:border-gray-700 h-full flex flex-col">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                        <Tag className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('Top Categories')}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('By approved spend')}</p>
                                    </div>
                                </div>
                                {dashboardData?.top_categories?.length > 0 && (
                                    <span className="inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-600/20">
                                        {dashboardData.top_categories.length} {t('categories')}
                                    </span>
                                )}
                            </div>
                            <CardContent className="p-0 flex-1 overflow-y-auto">
                                {dashboardData?.top_categories && dashboardData.top_categories.length > 0 ? (
                                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {dashboardData.top_categories.slice(0, 5).map((category: any, index: number) => {
                                            const pct = Math.min(((category.total_spent || 0) / (category.allocated_amount || 1)) * 100, 100);
                                            const isOver = pct >= 90;
                                            const isWarn = pct >= 75 && pct < 90;
                                            const arcColor = isOver ? '#ef4444' : isWarn ? '#f59e0b' : (category.color || '#6B7280');
                                            // SVG donut arc params
                                            const r = 16;
                                            const cx = 20;
                                            const cy = 20;
                                            const circumference = 2 * Math.PI * r;
                                            const dash = (pct / 100) * circumference;
                                            const gap = circumference - dash;
                                            return (
                                                <div
                                                    key={index}
                                                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                                                    onMouseEnter={() => setHoveredCategory(index)}
                                                    onMouseLeave={() => setHoveredCategory(null)}
                                                >
                                                    {/* Donut arc SVG */}
                                                    <div className="relative shrink-0 h-10 w-10">
                                                        <svg width="40" height="40" viewBox="0 0 40 40" className="-rotate-90">
                                                            <circle
                                                                cx={cx} cy={cy} r={r}
                                                                fill="none"
                                                                stroke="currentColor"
                                                                strokeWidth="4"
                                                                className="text-gray-100 dark:text-gray-700"
                                                            />
                                                            <circle
                                                                cx={cx} cy={cy} r={r}
                                                                fill="none"
                                                                stroke={arcColor}
                                                                strokeWidth="4"
                                                                strokeLinecap="round"
                                                                strokeDasharray={`${dash} ${gap}`}
                                                                style={{ transition: 'stroke-dasharray 0.6s ease' }}
                                                            />
                                                        </svg>
                                                        <span
                                                            className="absolute inset-0 flex items-center justify-center text-[9px] font-bold"
                                                            style={{ color: arcColor }}
                                                        >
                                                            {Math.round(pct)}%
                                                        </span>
                                                    </div>
                                                    {/* Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between gap-1">
                                                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{category.name || t('Unknown')}</p>
                                                            {(isOver || isWarn) && (
                                                                <AlertTriangle className={`h-3 w-3 mt-0.5 ${isOver ? 'text-red-500' : 'text-yellow-500'}`} />
                                                            )}
                                                        </div>
                                                        <div className="flex items-center justify-between mt-0.5">
                                                            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                                                                {formatCurrency(category.total_spent || 0)}
                                                                {category.allocated_amount > 0 && (
                                                                    <span className="text-gray-400 dark:text-gray-600 font-mono"> / {formatCurrency(category.allocated_amount)}</span>
                                                                )}
                                                            </span>
                                                            {/* <span className={`text-xs font-bold ${
                                                                isOver ? 'text-red-600 dark:text-red-400' :
                                                                isWarn ? 'text-yellow-600 dark:text-yellow-400' :
                                                                'text-green-600 dark:text-green-400'
                                                            }`}>
                                                                {isOver ? t('Over budget') : isWarn ? t('Near limit') : t('On track')}
                                                            </span> */}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                                        <div className="relative mb-4">
                                            <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
                                                <circle cx="28" cy="28" r="22" fill="none" stroke="currentColor" strokeWidth="5" className="text-gray-100 dark:text-gray-700" />
                                                <circle cx="28" cy="28" r="22" fill="none" stroke="#d1d5db" strokeWidth="5" strokeLinecap="round" strokeDasharray="30 108" />
                                            </svg>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <Tag className="h-5 w-5 text-gray-400" />
                                            </div>
                                        </div>
                                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('No categories')}</p>
                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('Categories will appear here')}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                </div>
            </div>
        </PageTemplate>
    );
}
