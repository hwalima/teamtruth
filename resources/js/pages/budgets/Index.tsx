import React, { useState, useEffect } from 'react';
import { router, usePage } from '@inertiajs/react';
import { toast } from '@/components/custom-toast';
import { Button } from '@/components/ui/button';
import { SearchAndFilterBar } from '@/components/ui/search-and-filter-bar';
import { Pagination } from '@/components/ui/pagination';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Eye, Edit, Trash2, DollarSign, AlertTriangle, Wallet, TrendingUp, CheckCircle, BarChart3, Calendar } from 'lucide-react';
import { PageTemplate } from '@/components/page-template';
import { CrudTable } from '@/components/CrudTable';
import { hasPermission } from '@/utils/authorization';
import BudgetFormModal from '@/components/budgets/BudgetFormModal';
import { CrudDeleteModal } from '@/components/CrudDeleteModal';
import { useTranslation } from 'react-i18next';

interface Budget {
    id: number;
    project: {
        id: number;
        title: string;
    };
    total_budget: number;
    currency: string;
    period_type: string;
    status: string;
    total_spent: number;
    remaining_budget: number;
    utilization_percentage: number;
    start_date: string;
    end_date: string;
    categories: Array<{
        id: number;
        name: string;
        allocated_amount: number;
        color: string;
        total_spent: number;
        utilization_percentage: number;
    }>;
    created_at: string;
}

export default function BudgetIndex() {
    const { t } = useTranslation();
    const { budgets, auth, userWorkspaceRole, flash, permissions: pagePermissions, allProjects, filters: pageFilters = {} } = usePage().props as any;
    const budgetPermissions = pagePermissions;
    
    const formatText = (text: string) => {
        return text.replace(/_/g, ' ').split(' ').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
    };

    // Show flash messages
    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
        if (flash?.error) {
            toast.error(flash.error);
        }
        if (flash?.info) {
            toast.info(flash.info);
        }
    }, [flash]);

    const [activeView, setActiveView] = useState(pageFilters.view || 'grid');
    const [searchTerm, setSearchTerm] = useState(pageFilters.search || '');
    const [selectedStatus, setSelectedStatus] = useState(pageFilters.status || 'all');
    const [selectedProject, setSelectedProject] = useState(pageFilters.project_id || 'all');
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [currentBudget, setCurrentBudget] = useState<Budget | null>(null);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');

    const buildParams = (
        overrides: Record<string, any> = {},
        stateOverrides: { search?: string; status?: string; project?: string; view?: string } = {}
    ) => {
        const view    = stateOverrides.view    !== undefined ? stateOverrides.view    : activeView;
        const search  = stateOverrides.search  !== undefined ? stateOverrides.search  : searchTerm;
        const status  = stateOverrides.status  !== undefined ? stateOverrides.status  : selectedStatus;
        const project = stateOverrides.project !== undefined ? stateOverrides.project : selectedProject;

        const params: any = { page: 1, view };
        if (search) params.search = search;
        if (status !== 'all') params.status = status;
        if (project !== 'all') params.project_id = project;
        if (pageFilters.per_page) params.per_page = pageFilters.per_page;
        if (pageFilters.sort_by) params.sort_by = pageFilters.sort_by;
        if (pageFilters.sort_order) params.sort_order = pageFilters.sort_order;
        return { ...params, ...overrides };
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        router.get(route('budgets.index'), buildParams({ page: 1 }), { preserveState: false, preserveScroll: false });
    };

    const applyFilters = () => {
        router.get(route('budgets.index'), buildParams({ page: 1 }), { preserveState: false, preserveScroll: false });
    };

    const hasActiveFilters = () => {
        return selectedStatus !== 'all' || selectedProject !== 'all' || searchTerm !== '';
    };

    const activeFilterCount = () => {
        return (selectedStatus !== 'all' ? 1 : 0) + (selectedProject !== 'all' ? 1 : 0) + (searchTerm ? 1 : 0);
    };

    const handleResetFilters = () => {
        setSelectedStatus('all');
        setSelectedProject('all');
        setSearchTerm('');
        const params: any = { page: 1, view: activeView };
        if (pageFilters.per_page) params.per_page = pageFilters.per_page;
        router.get(route('budgets.index'), params, { preserveState: false, preserveScroll: false });
    };

    const handleSort = (field: string) => {
        const direction = pageFilters.sort_by === field && pageFilters.sort_order === 'asc' ? 'desc' : 'asc';
        router.get(route('budgets.index'), buildParams({ sort_by: field, sort_order: direction, page: 1 }), { preserveState: false, preserveScroll: false });
    };

    const handleAction = (action: string, budgetOrId: Budget | number) => {
        let budget: Budget;
        
        if (typeof budgetOrId === 'number') {
            // Called from CrudTable with ID
            budget = budgets?.data?.find((b: Budget) => b.id === budgetOrId);
            if (!budget) return;
        } else {
            // Called from grid view with budget object
            budget = budgetOrId;
        }
        
        setCurrentBudget(budget);
        switch (action) {
            case 'view':
                router.get(route('budgets.show', budget.id));
                break;
            case 'edit':
                router.get(route('budgets.edit', budget.id));
                break;
            case 'delete':
                setIsDeleteModalOpen(true);
                break;
        }
    };

    const handleAddNew = () => {
        router.get(route('budgets.create'));
    };

    const handleDeleteConfirm = () => {
        if (currentBudget) {
            toast.loading(t('Deleting budget...'));
            router.delete(route('budgets.destroy', currentBudget.id), {
                onSuccess: () => {
                    toast.dismiss();
                    setIsDeleteModalOpen(false);
                },
                onError: () => {
                    toast.dismiss();
                    toast.error(t('Failed to delete budget'));
                    setIsDeleteModalOpen(false);
                }
            });
        }
    };

    const getStatusColor = (status: string) => {
        const colors = {
            active: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20',
            completed: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20',
            cancelled: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20'
        };
        return colors[status as keyof typeof colors] || 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20';
    };

    const getUtilizationColor = (percentage: number) => {
        if (percentage >= 90) return 'text-red-600';
        if (percentage >= 75) return 'text-yellow-600';
        return 'text-green-600';
    };

    const formatCurrency = (amount: string | number) => {
        if (typeof window !== 'undefined' && window.appSettings?.formatCurrency) {
            const numericAmount = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
            return window.appSettings.formatCurrency(numericAmount);
        }
        return amount || 0;
    };

    const pageActions = [];

    if (budgetPermissions?.create) {
        pageActions.push({
            label: t('Create Budget'),
            icon: <Plus className="h-4 w-4 mr-2" />,
            variant: 'default',
            onClick: handleAddNew
        });
    }

    const breadcrumbs = [
        { title: t('Dashboard'), href: route('dashboard') }, 
        { title: t('Budget & Expenses') },
        { title: t('Budgets') }
    ];

    return (
        <PageTemplate
            title={t('Budgets')}
            description={t('Manage your project budgets and track expenses.')}
            url="/budgets"
            actions={pageActions}
            breadcrumbs={breadcrumbs}
            noPadding
        >
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-3 gap-4 mb-4">
                <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-bl-full" />
                    <CardContent className="relative p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Total Budgets')}</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{budgets?.total || 0}</p>
                            </div>
                            <div className="relative z-10 p-2.5 bg-blue-50 dark:bg-blue-900/30 rounded-xl mt-0.5">
                                <DollarSign className="h-5 w-5 text-blue-600" />
                            </div>
                        </div>
                        <div className="mt-3 flex items-center text-xs">
                            <span className="text-gray-400 dark:text-gray-500">{t('Projects budgeted')}</span>
                        </div>
                    </CardContent>
                </Card>
                <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300 h-full">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-green-50 dark:bg-green-900/30 rounded-bl-full" />
                    <CardContent className="relative p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Active')}</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{budgets?.data?.filter((b: Budget) => b.status === 'active').length || 0}</p>
                            </div>
                            <div className="relative z-10 p-2.5 bg-pr-50 dark:bg-green-900/30 rounded-xl mt-0.5">
                                <CheckCircle className="h-5 w-5 text-green-600" />
                            </div>
                        </div>
                        <div className="mt-3 flex items-center text-xs">
                            <span className="text-gray-400 dark:text-gray-500">{t('Actively tracked')}</span>
                        </div>
                    </CardContent>
                </Card>
                <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300 col-span-2 sm:col-span-1">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-orange-50 dark:bg-orange-900/30 rounded-bl-full" />
                    <CardContent className="relative p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Total Budget')}</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white font-mono">{formatCurrency(budgets?.data?.reduce((sum: number, b: Budget) => sum + (parseFloat(b.total_budget as any) || 0), 0) || 0)}</p>
                            </div>
                            <div className="relative z-10 p-2.5 bg-orange-50 dark:bg-orange-900/30 rounded-xl mt-0.5">
                                <TrendingUp className="h-5 w-5 text-orange-600" />
                            </div>
                        </div>
                        {(() => {
                            const totalBudget = budgets?.data?.reduce((sum: number, b: Budget) => sum + (parseFloat(b.total_budget as any) || 0), 0) || 0;
                            const totalSpent = budgets?.data?.reduce((sum: number, b: Budget) => sum + (parseFloat(b.total_spent as any) || 0), 0) || 0;
                            const totalRemaining = totalBudget - totalSpent;
                            const spentPct = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;
                            return (
                                <div className="mt-2 space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-400 dark:text-gray-500 font-mono">{t('Spent')}: {formatCurrency(totalSpent)}</span>
                                        <span className="text-gray-400 dark:text-gray-500 font-mono">{t('Left')}: {formatCurrency(totalRemaining)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                                            <div className="h-1.5 rounded-full transition-all duration-500 bg-primary" style={{ width: `${spentPct}%`}} />
                                        </div>
                                        <span className="text-xs text-green-600 font-semibold shrink-0" >{spentPct.toFixed(1)}%</span>
                                    </div>
                                </div>
                            );
                        })()}
                    </CardContent>
                </Card>
            </div>

            {/* Search and filters */}
            <div className="bg-white dark:bg-gray-900 rounded-lg border shadow mb-4">
                <SearchAndFilterBar
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    onSearch={handleSearch}
                    searchPlaceholder={t('Search budgets...')}
                    filters={[
                        {
                            name: 'status',
                            label: t('Status'),
                            type: 'select',
                            value: selectedStatus,
                            onChange: (value: string) => {
                                setSelectedStatus(value);
                                router.get(route('budgets.index'), buildParams({ page: 1 }, { status: value }), { preserveState: false, preserveScroll: false });
                            },
                            options: [
                                { value: 'all', label: t('All Status') },
                                { value: 'active', label: t('Active') },
                                { value: 'completed', label: t('Completed') },
                                { value: 'cancelled', label: t('Cancelled') },
                            ],
                        },
                        {
                            name: 'project_id',
                            label: t('Project'),
                            type: 'select',
                            searchable: true,
                            value: selectedProject,
                            onChange: (value: string) => {
                                setSelectedProject(value);
                                router.get(route('budgets.index'), buildParams({ page: 1 }, { project: value }), { preserveState: false, preserveScroll: false });
                            },
                            options: [
                                { value: 'all', label: t('All Projects') },
                                ...(allProjects?.map((p: any) => ({ value: p.id.toString(), label: p.title })) || []),
                            ],
                        },
                    ]}
                    hasActiveFilters={hasActiveFilters}
                    activeFilterCount={activeFilterCount}
                    onResetFilters={handleResetFilters}
                    showViewToggle
                    activeView={activeView}
                    onViewChange={(view) => {
                        setActiveView(view);
                        router.get(route('budgets.index'), buildParams({ page: 1, view }, { view }), { preserveState: false, preserveScroll: false });
                    }}
                    viewOptions={[
                        { value: 'list', label: t('List View'), icon: 'List' },
                        { value: 'grid', label: t('Grid View'), icon: 'Grid3X3' },
                    ]}
                />
            </div>

            {/* Budget Content */}
            {activeView === 'grid' ? (
                budgets?.data?.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                    <DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-500 mb-4">{t('No budgets found')}</p>
                    {budgetPermissions?.create && (
                        <Button onClick={handleAddNew}>
                            <Plus className="h-4 w-4 mr-2" />
                            {t('Create your first budget')}
                        </Button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {budgets?.data?.map((budget: Budget) => {
                        const utilPct = parseFloat(budget.utilization_percentage as any) || 0;
                        const barColor = 'hsl(var(--primary))';
                        return (
                        <Card key={budget.id} className="overflow-hidden hover:shadow-lg transition-all duration-200 flex flex-col">
                            {/* Header */}
                            <CardHeader className="pb-3 pt-4 px-4">
                                <div className="flex justify-between items-start gap-2">
                                    <CardTitle
                                        className="text-sm font-semibold line-clamp-1 cursor-pointer hover:text-blue-600 transition-colors leading-snug"
                                        onClick={() => handleAction('view', budget)}
                                    >
                                        {budget.project?.title}
                                    </CardTitle>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/20">
                                            {formatText(budget.period_type)}
                                        </span>
                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(budget.status)}`}>
                                            {formatText(budget.status)}
                                        </span>
                                    </div>
                                </div>
                                <div className="-mx-4 my-3 border-b border-gray-200 dark:border-gray-800" />
                                <div className="flex items-center gap-1.5 mt-1.5">
                                    {utilPct >= 90 && (
                                        <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                                            <AlertTriangle className="h-3 w-3" />{t('Critical')}
                                        </span>
                                    )}
                                    {utilPct >= 75 && utilPct < 90 && (
                                        <span className="flex items-center gap-1 text-xs text-yellow-600 font-medium">
                                            <AlertTriangle className="h-3 w-3" />{t('High')}
                                        </span>
                                    )}
                                </div>
                            </CardHeader>

                            <CardContent className="px-4 pb-3 flex-1">
                                <div className="space-y-3">
                                    {/* Total Budget prominent */}
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-0.5">{t('Total Budget')}</p>
                                        <p className="text-lg font-bold text-gray-900 dark:text-white font-mono">{formatCurrency(budget.total_budget)}</p>
                                    </div>

                                    {/* Spent / Remaining */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-2">
                                            <p className="text-xs text-muted-foreground">{t('Spent')}</p>
                                            <p className="text-sm font-semibold text-orange-600 truncate font-mono">{formatCurrency(budget.total_spent)}</p>
                                        </div>
                                        <div className={`rounded-lg p-2 border ${ (budget.remaining_budget || 0) < 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'}`}>
                                            <p className="text-xs text-muted-foreground">{t('Remaining')}</p>
                                            <p className={`text-sm font-semibold truncate font-mono ${ (budget.remaining_budget || 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {formatCurrency(budget.remaining_budget)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Utilization bar */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground">{t('Utilization')}</span>
                                            <span className="font-semibold text-semibold">{utilPct.toFixed(1)}%</span>
                                        </div>
                                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                                            <div className="h-1.5 rounded-full transition-all duration-500 bg-primary" style={{ width: `${Math.min(utilPct, 100)}%` }} />
                                        </div>
                                    </div>
                                </div>
                            </CardContent>

                            <CardFooter className="flex justify-between items-center px-4 py-2.5 border-t dark:bg-gray-800/50">
                            <div className="flex items-center gap-1.5 text-sm whitespace-nowrap text-gray-500">
                                        <Calendar className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                                         <span className="text-xs text-gray-500">
                                    {window.appSettings.formatDateTime(new Date(budget.created_at), false)}</span>

                                    </div>
                                <div className="flex gap-0.5">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" onClick={() => handleAction('view', budget)} className="text-gray-400 hover:text-gray h-7 w-7">
                                                <Eye className="h-3.5 w-3.5" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>{t('View')}</TooltipContent>
                                    </Tooltip>
                                    {budgetPermissions?.update && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="ghost" size="icon" onClick={() => handleAction('edit', budget)} className="text-gray-400 hover:text-gray h-7 w-7">
                                                    <Edit className="h-3.5 w-3.5" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>{t('Edit')}</TooltipContent>
                                        </Tooltip>
                                    )}
                                    {budgetPermissions?.delete && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="ghost" size="icon" onClick={() => handleAction('delete', budget)} className="text-gray-400 hover:text-gray-500 h-7 w-7">
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>{t('Delete')}</TooltipContent>
                                        </Tooltip>
                                    )}
                                </div>
                            </CardFooter>
                        </Card>
                        );
                    })}
                </div>
                )
            ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <CrudTable
                        columns={[
                            {
                                key: 'project.title',
                                label: t('Project'),
                                sortable: true,
                                render: (value: string, row: any) => (
                                    <div>
                                        <div 
                                            className="text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                                            onClick={() => router.get(route('budgets.show', row.id))}
                                        >
                                            {value}
                                        </div>
                                        <div className="text-sm text-gray-500 capitalize">{row.period_type} {t('budget')}</div>
                                    </div>
                                )
                            },
                           
                            {
                                key: 'start_date',
                                label: t('Start Date'),
                                sortable: true,
                                render: (value: string) => (
                                    <div className="flex items-center gap-1.5 text-sm whitespace-nowrap text-gray-500">
                                        {value ? <>
                                            <Calendar className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                                            <span className="text-sm text-gray-500">{window.appSettings.formatDateTime(new Date(value), false)}</span>
                                        </> : <span>-</span>}
                                    </div>
                                )
                            },
                            {
                                key: 'end_date',
                                label: t('End Date'),
                                sortable: true,
                                render: (value: string) => {
                                    const isOverdue = value && new Date(value) < new Date();
                                    return (
                                        <div className="flex items-center gap-1.5 text-sm whitespace-nowrap text-gray-500">
                                            {value ? <>
                                                <Calendar className={`h-3.5 w-3.5 shrink-0 ${isOverdue ? 'text-red-500' : 'text-gray-500'}`} />
                                                <span className={`text-sm ${isOverdue ? 'text-red-500' : 'text-gray-500'}`}>{window.appSettings.formatDateTime(new Date(value), false)}</span>
                                            </> : <span>-</span>}
                                        </div>
                                    );
                                }
                            },
                            {
                                key: 'status',
                                label: t('Status'),
                                sortable: true,
                                render: (value: string) => (
                                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${getStatusColor(value)}`}>
                                        {formatText(value)}
                                    </span>
                                )
                            },
                            {
                                key: 'utilization_percentage',
                                label: t('Utilization'),
                                className :'text-center',
                                render: (value: number, row: any) => {
                                    const raw = parseFloat(value as any) || 0;
                                    const pct = Math.min(raw, 100);
                                    const rounded = Math.round(pct);
                                    const barColor = 'bg-primary';
                                    return (
                                        <div className="space-y-1 w-60 mx-auto">
                                            {/* Total budget - top center */}
                                            <div className="text-center">
                                                <p className="text-[10px] text-muted-foreground">{t('Total')}</p>
                                                <p className="text-[11px] font-semibold text-gray-900 dark:text-white truncate font-mono">{formatCurrency(row.total_budget)}</p>
                                            </div>
                                            {/* spent | progressbar+% | remaining */}
                                            <div className="grid grid-cols-[auto_1fr_auto] gap-1">
                                                <div className="text-center">
                                                    <p className="text-[10px] text-muted-foreground">{t('Spent')}</p>
                                                    <p className="text-[11px] font-semibold text-orange-600 font-mono">{formatCurrency(row.total_spent)}</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className={`text-[10px] font-bold ${getUtilizationColor(raw)}`}>{rounded}%</p>
                                                    <div className="relative bg-gray-200 rounded-full h-1.5 mt-[3px]">
                                                        <div className={`${barColor} h-1.5 rounded-full`} style={{width: `${pct}%`}} />
                                                    </div>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-[10px] text-muted-foreground">{t('Left')}</p>
                                                    <p className={`text-[11px] font-semibold font-mono ${(row.remaining_budget || 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(row.remaining_budget)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                            },
                        ]}
                        actions={[
                            {
                                label: t('View'),
                                icon: 'Eye',
                                action: 'view',
                                className: 'text-gray-500 hover:text-gray-700',
                                condition: () => true
                            },
                            {
                                label: t('Edit'),
                                icon: 'Edit',
                                action: 'edit',
                                className: 'text-gray-500 hover:text-gray-700',
                                condition: () => budgetPermissions?.update
                            },
                            {
                                label: t('Delete'),
                                icon: 'Trash2',
                                action: 'delete',
                                className: 'text-gray-500 hover:text-gray-700',
                                condition: () => budgetPermissions?.delete
                            }
                        ]}
                        data={budgets?.data || []}
                        from={budgets?.from || 1}
                        onAction={handleAction}
                        sortField={pageFilters.sort_by}
                        sortDirection={pageFilters.sort_order}
                        onSort={handleSort}
                        permissions={auth?.permissions || []}
                    />
                    
                    {/* Pagination for list view */}
                    {budgets?.links && (
                            <Pagination
                                from={budgets?.from || 0}
                                to={budgets?.to || 0}
                                total={budgets?.total || 0}
                                links={budgets?.links}
                                entityName={t('budgets')}
                                currentPerPage={budgets?.per_page?.toString() || pageFilters.per_page?.toString() || '10'}
                                perPageOptions={[12, 24, 48, 100]}
                                onPerPageChange={(value) => router.get(route('budgets.index'), buildParams({ page: 1, per_page: parseInt(value) }), { preserveState: false, preserveScroll: false })}
                                onPageChange={(url) => {
                                    const pageNum = new URL(url).searchParams.get('page');
                                    router.get(route('budgets.index'), buildParams({ page: pageNum ? parseInt(pageNum) : 1 }), { preserveState: false, preserveScroll: false });
                                }}
                            />
                    )}
                </div>
            )}

            {/* Pagination for grid view */}
            {activeView === 'grid' && budgets?.links && (
                <div className="mt-4 bg-white dark:bg-gray-800 border rounded-lg shadow overflow-hidden">
                    <Pagination
                        from={budgets?.from || 0}
                        to={budgets?.to || 0}
                        total={budgets?.total || 0}
                        links={budgets?.links}
                        entityName={t('budgets')}
                        currentPerPage={budgets?.per_page?.toString() || pageFilters.per_page?.toString() || '10'}
                        perPageOptions={[12, 24, 48, 100]}
                        onPerPageChange={(value) => router.get(route('budgets.index'), buildParams({ page: 1, per_page: parseInt(value) }), { preserveState: false, preserveScroll: false })}
                        onPageChange={(url) => {
                            const pageNum = new URL(url).searchParams.get('page');
                            router.get(route('budgets.index'), buildParams({ page: pageNum ? parseInt(pageNum) : 1 }), { preserveState: false, preserveScroll: false });
                        }}
                    />
                </div>
            )}

            {/* Modals */}
            <BudgetFormModal
                isOpen={isFormModalOpen}
                onClose={() => {
                    setIsFormModalOpen(false);
                    setCurrentBudget(null);
                }}
                budget={currentBudget}
                mode={modalMode}
            />

            <CrudDeleteModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDeleteConfirm}
                itemName={currentBudget?.project?.title || ''}
                entityName="budget"
            />
        </PageTemplate>
    );
}