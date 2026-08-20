import React, { useState } from 'react';
import { usePage, router } from '@inertiajs/react';
import { toast } from '@/components/custom-toast';
import { PageTemplate } from '@/components/page-template';
import BudgetProgress from '@/components/budgets/BudgetProgress';
import BudgetFormModal from '@/components/budgets/BudgetFormModal';
import { CrudTable } from '@/components/CrudTable';
import { CrudDeleteModal } from '@/components/CrudDeleteModal';
import ExpenseFormModal from '@/components/expenses/ExpenseFormModal';
import ExpenseViewModal from '@/components/expenses/ExpenseViewModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Edit, Plus, Receipt, Calendar, DollarSign, TrendingUp, AlertTriangle, ArrowLeft, Eye, Wallet, BarChart3, User, Tag, Clock, FolderOpen, Activity, Trash2, FileText } from 'lucide-react';
import { formatCurrency } from '@/utils/currency';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Pagination } from '@/components/ui/pagination';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function BudgetShow() {
    const { t } = useTranslation();
    const { budget, projects = [], permissions } = usePage().props as any;
    const { auth } = usePage().props as any;
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [viewingExpense, setViewingExpense] = useState<any>(null);
    const [editingExpense, setEditingExpense] = useState<any>(null);
    const [deleteExpense, setDeleteExpense] = useState<any>(null);

    const processApproval = (expenseId: number, action: string) => {
        const actionText = action === 'approve' ? 'Approving' : 'Rejecting';
        toast.loading(`${actionText} expense...`);
        const routeName = action === 'approve' ? 'expense-approvals.approve' : 'expense-approvals.reject';
        const data: any = action === 'reject' ? { notes: 'Expense rejected by approver' } : { notes: '' };
        router.put(route(routeName, expenseId), data, {
            onSuccess: () => toast.dismiss(),
            onError: (errors) => {
                toast.dismiss();
                toast.error(errors?.message || `Failed to ${action} expense`);
            }
        });
    };
    const firstCategoryId = budget.categories?.length > 0 ? budget.categories[0].id : null;
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(firstCategoryId);
    const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
    const [expensePage, setExpensePage] = useState(1);
    const perPage = 10;

    const selectedCategory = selectedCategoryId
        ? budget.categories?.find((c: any) => c.id === selectedCategoryId)
        : null;

    const categoryExpenses = selectedCategoryId
        ? (budget.expenses || []).filter((e: any) => e.budget_category_id === selectedCategoryId)
        : [];

    const filteredExpenses = activeTab === 'all'
        ? categoryExpenses
        : categoryExpenses.filter((e: any) => e.status === activeTab);

    const paginatedExpenses = filteredExpenses.slice((expensePage - 1) * perPage, expensePage * perPage);
    const totalPages = Math.ceil(filteredExpenses.length / perPage);

    const pendingCount = categoryExpenses.filter((e: any) => e.status === 'pending').length;
    const approvedCount = categoryExpenses.filter((e: any) => e.status === 'approved').length;
    const rejectedCount = categoryExpenses.filter((e: any) => e.status === 'rejected').length;
    const remainingBudget = selectedCategory ? (parseFloat(selectedCategory.allocated_amount || 0) - parseFloat(selectedCategory.total_spent || 0)) : 0;

    const formatText = (text: string) => {
        return text.replace(/_/g, ' ').split(' ').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
    };

    const getStatusColor = (status: string) => {
        const colors = {
            active: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20',
            completed: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20',
            cancelled: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20'
        };
        return colors[status as keyof typeof colors] || 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20';
    };

    const utilization = budget.utilization_percentage || 0;
    const utilizationColor = utilization >= 90 ? 'text-red-600' : utilization >= 75 ? 'text-yellow-600' : 'text-green-600';
    const pageActions = [
        {
            label: t('View Project'),
            icon: <Eye className="h-4 w-4 mr-2" />,
            variant: 'outline',
            onClick: () => router.get(route('projects.show', budget.project.id))
        },
    ];

    if (permissions?.create) {
        pageActions.push({
            label: t('Add Expense'),
            icon: <Plus className="h-4 w-4 mr-2" />,
            variant: 'default',
            onClick: () => setIsExpenseModalOpen(true)
        });
    }

    if (auth?.permissions?.includes('budget_dashboard_view')) {
        pageActions.push({
            label: t('View Expenses'),
            icon: <Receipt className="h-4 w-4 mr-2" />,
            variant: 'outline',
            onClick: () => router.get(route('expenses.index', { project_id: budget.project_id, budget_id: budget.id }))
        });
    }

    if (permissions?.update) {
        pageActions.push({
            label: t('Edit Budget'),
            icon: <Edit className="h-4 w-4 mr-2" />,
            variant: 'outline',
            onClick: () => router.get(route('budgets.edit', budget.id))
        });
    }

    pageActions.push({
        label: t('Back'),
        icon: <ArrowLeft className="h-4 w-4 mr-2" />,
        variant: 'outline',
        onClick: () => router.get(route('budgets.index'))
    });

    const breadcrumbs = [
        { title: t('Dashboard'), href: route('dashboard') },
        { title: t('Budget & Expenses'), href: route('budgets.dashboard') },
        { title: t('Budgets'), href: route('budgets.index') },
        { title: t('Budget Details') }
    ];

    return (
        <PageTemplate
            title={budget.project.title}
            description={t('View the details of this budget and track its utilization.')}
            actions={pageActions}
            breadcrumbs={breadcrumbs}
            noPadding
        >
            <div className="space-y-6">

                {/* Budget Info Header */}
                <Card className="shadow-sm border border-gray-200 dark:border-gray-700">
                    {/* Top identity strip */}
                    <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-4 border-b border-gray-200 dark:border-gray-800">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <FolderOpen className="h-4 w-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{budget.project.title}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{budget.description || t('Project Budget Overview')}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-600/20">
                                {formatText(budget.period_type)} {t('Budget')}
                            </span>
                            <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ${getStatusColor(budget.status)}`}>
                                {formatText(budget.status)}
                            </span>
                        </div>
                    </div>

                    <CardContent className="p-6">
                        {/* Stat Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                            <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                                <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-bl-full" />
                                <CardContent className="relative p-5">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Total Budget')}</p>
                                            <p className="text-2xl font-bold text-gray-900 dark:text-white truncate font-mono">{formatCurrency(budget.total_budget || 0)}</p>
                                        </div>
                                        <div className="relative z-10 p-2.5 bg-blue-50 dark:bg-blue-900/30 rounded-xl mt-0.5">
                                            <DollarSign className="h-5 w-5 text-blue-600" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                                <div className="absolute top-0 right-0 w-20 h-20 bg-orange-50 dark:bg-orange-900/30 rounded-bl-full" />
                                <CardContent className="relative p-5">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Total Spent')}</p>
                                            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 truncate font-mono">{formatCurrency(budget.total_spent || 0)}</p>
                                        </div>
                                        <div className="relative z-10 p-2.5 bg-orange-50 dark:bg-orange-900/30 rounded-xl mt-0.5">
                                            <TrendingUp className="h-5 w-5 text-orange-600" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                                <div className={`absolute top-0 right-0 w-20 h-20 rounded-bl-full ${ (budget.remaining_budget || 0) < 0 ? 'bg-red-50 dark:bg-red-900/30' : 'bg-green-50 dark:bg-green-900/30'}`} />
                                <CardContent className="relative p-5">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Remaining')}</p>
                                            <p className={`text-2xl font-bold truncate font-mono ${ (budget.remaining_budget || 0) < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                                {formatCurrency(budget.remaining_budget || 0)}
                                            </p>
                                        </div>
                                        <div className={`relative z-10 p-2.5 rounded-xl mt-0.5 ${ (budget.remaining_budget || 0) < 0 ? 'bg-red-50 dark:bg-red-900/30' : 'bg-green-50 dark:bg-green-900/30'}`}>
                                            <Wallet className={`h-5 w-5 ${ (budget.remaining_budget || 0) < 0 ? 'text-red-600' : 'text-green-600'}`} />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Overall Progress Bar */}
                        <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-4 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                                    {budget.start_date ? window.appSettings.formatDateTime(new Date(budget.start_date), false) : t('Not set')}
                                    <span className="w-px h-3 bg-gray-300 dark:bg-gray-600 inline-block mx-0.5" />
                                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                                    {budget.end_date ? window.appSettings.formatDateTime(new Date(budget.end_date), false) : t('Ongoing')}
                                </span>
                                <span className={`text-sm font-bold ${utilizationColor}`}>{utilization.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div
                                    className="h-2 rounded-full transition-all duration-500 bg-primary"
                                    style={{ width: `${Math.min(utilization, 100)}%`}}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Categories + Recent Expenses — 2 column layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                    {/* Left: Budget Categories */}
                    <div className="lg:col-span-3">
                        <BudgetProgress
                            budget={budget}
                            selectedCategoryId={selectedCategoryId}
                            onCategoryClick={(id) => {
                                setSelectedCategoryId(id);
                                setExpensePage(1);
                            }}
                            expensesByCategory={Object.fromEntries(
                                (budget.categories || []).map((c: any) => [
                                    c.id,
                                    {
                                        total: (budget.expenses || []).filter((e: any) => e.budget_category_id === c.id).length,
                                        pending: (budget.expenses || []).filter((e: any) => e.budget_category_id === c.id && e.status === 'pending').length,
                                    }
                                ])
                            )}
                        />
                    </div>

                    {/* Right: Expenses panel */}
                    <div className="lg:col-span-9 flex flex-col gap-4">

                        {/* Card 1: Header with category info + tabs */}
                        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div
                                className="flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: selectedCategory.color + '20', color: selectedCategory.color }}
                                
                            >
                                <Tag className="h-5 w-5" />
                            </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                                            {selectedCategory ? selectedCategory.name : t('Select a category')}
                                        </p>
                                        {selectedCategory ? (
                                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-mono">
                                                <span className="text-gray-600 dark:text-gray-300">{t('Total')}: {formatCurrency(parseFloat(selectedCategory.allocated_amount || 0))}</span>
                                                {' · '}
                                                <span className="text-orange-600 dark:text-orange-400">{t('Spent')}: {formatCurrency(parseFloat(selectedCategory.total_spent || 0))}</span>
                                                {' · '}
                                                <span className={remainingBudget < 0 ? 'text-red-600' : 'text-green-600'}>{t('Remaining')}: {formatCurrency(remainingBudget)}</span>
                                            </p>
                                        ) : (
                                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{t('Click a category on the left to view its expenses')}</p>
                                        )}
                                    </div>
                                </div>
                                <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as any); setExpensePage(1); }}>
                                    <TabsList className="h-9">
                                            <TabsTrigger value="pending" className="h-7 px-3 text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-white">
                                                {t('Pending')}
                                                <span className="inline-flex items-center justify-center min-w-[16px] h-4 rounded-full px-1 text-[10px] font-bold bg-yellow-100 dark:bg-yellow-900/40 ring-1 ring-inset ring-yellow-600/30 text-yellow-700 dark:text-yellow-400">
                                                    {pendingCount}
                                                </span>
                                            </TabsTrigger>
                                            <TabsTrigger value="approved" className="h-7 px-3 text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-white">
                                                {t('Approved')}
                                                <span className="inline-flex items-center justify-center min-w-[16px] h-4 rounded-full px-1 text-[10px] font-bold bg-green-100 dark:bg-green-900/40 ring-1 ring-inset ring-green-600/30 text-green-700 dark:text-green-400">
                                                    {approvedCount}
                                                </span>
                                            </TabsTrigger>
                                            <TabsTrigger value="rejected" className="h-7 px-3 text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-white">
                                                {t('Rejected')}
                                                <span className="inline-flex items-center justify-center min-w-[16px] h-4 rounded-full px-1 text-[10px] font-bold bg-red-100 dark:bg-red-900/40 ring-1 ring-inset ring-red-600/30 text-red-700 dark:text-red-400">
                                                    {rejectedCount}
                                                </span>
                                            </TabsTrigger>
                                        </TabsList>
                                    </Tabs>
                            </div>
                        </div>

                        {/* Card 2: Table */}
                        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
                            <CrudTable
                                columns={[
                                    {
                                        key: 'title',
                                        label: t('Expense'),
                                        render: (value: string, row: any) => (
                                            <div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{value}</div>
                                                {row.task?.title && (
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">{row.task.title}</div>
                                                )}
                                            </div>
                                        )
                                    },
                                    {
                                        key: 'submitter',
                                        label: t('Submitted By'),
                                        render: (_: any, row: any) => (
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-9 w-9 rounded-full">
                                                    <AvatarImage src={row.submitter?.avatar} />
                                                    <AvatarFallback className="text-xs">{row.submitter?.name?.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{row.submitter?.name}</div>
                                                    <div className="text-xs text-gray-500">{row.submitter?.email || ''}</div>
                                                </div>
                                            </div>
                                        )
                                    },
                                    {
                                        key: 'expense_date',
                                        label: t('Date'),
                                        render: (value: string) => (
                                            <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                <Calendar className="h-3.5 w-3.5 shrink-0" />
                                                <span>{window.appSettings.formatDateTime(new Date(value), false)}</span>
                                            </div>
                                        )
                                    },
                                    {
                                        key: 'amount',
                                        label: t('Amount'),
                                        render: (value: number, row: any) => (
                                            <div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 font-mono">{formatCurrency(value)}</div>
                                                {/* {row.vendor && <div className="text-xs text-gray-500">{row.vendor}</div>} */}
                                            </div>
                                        )
                                    },
                                    {
                                        key: 'status',
                                        label: t('Status'),
                                        render: (value: string) => (
                                            <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                                                value === 'approved' ? 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20' :
                                                value === 'rejected' ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20' :
                                                'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20'
                                            }`}>
                                                {formatText(value)}
                                            </span>
                                        )
                                    },
                                ]}
                                actions={[
                                    { label: t('Approve'), icon: 'CheckCircle', action: 'approve', className: 'text-gray-500 hover:text-gray-700', condition: (row: any) => permissions?.expense_approve && row?.status === 'pending' },
                                    { label: t('Reject'), icon: 'XCircle', action: 'reject', className: 'text-gray-500 hover:text-gray-600', condition: (row: any) => permissions?.expense_reject && row?.status === 'pending' },
                                    { label: t('View'), icon: 'Eye', action: 'view', className: 'text-gray-500 hover:text-gray-700', condition: () => true },
                                    { label: t('Edit'), icon: 'Edit', action: 'edit', className: 'text-gray-500 hover:text-gray-700', condition: (row: any) => permissions?.update && row?.status !== 'approved' },
                                    { label: t('Delete'), icon: 'Trash2', action: 'delete', className: 'text-gray-500 hover:text-gray-700', condition: () => permissions?.delete },
                                ]}
                                data={paginatedExpenses}
                                from={(expensePage - 1) * perPage + 1}
                                onAction={(action: string, expense: any) => {
                                    if (action === 'view') setViewingExpense(expense);
                                    if (action === 'edit') setEditingExpense(expense);
                                    if (action === 'delete') setDeleteExpense(expense);
                                    if (action === 'approve' || action === 'reject') processApproval(expense.id, action);
                                }}
                                permissions={[]}
                            />
                            {filteredExpenses.length > 0 && (
                                <Pagination
                                    from={Math.min((expensePage - 1) * perPage + 1, filteredExpenses.length)}
                                    to={Math.min(expensePage * perPage, filteredExpenses.length)}
                                    total={filteredExpenses.length}
                                    links={[
                                        { label: '&laquo; Previous', url: expensePage > 1 ? `?page=${expensePage - 1}` : null, active: false },
                                        ...Array.from({ length: totalPages }, (_, i) => ({
                                            label: String(i + 1),
                                            url: `?page=${i + 1}`,
                                            active: expensePage === i + 1,
                                        })),
                                        { label: 'Next &raquo;', url: expensePage < totalPages ? `?page=${expensePage + 1}` : null, active: false },
                                    ]}
                                    entityName={t('expenses')}
                                    hidePerPage
                                    onPageChange={(url) => {
                                        const page = new URLSearchParams(url.split('?')[1]).get('page');
                                        if (page) setExpensePage(parseInt(page));
                                    }}
                                />
                            )}
                        </div>

                    </div>

                </div>
            </div>

            <ExpenseViewModal
                isOpen={!!viewingExpense}
                onClose={() => setViewingExpense(null)}
                expense={viewingExpense}
            />

            <ExpenseFormModal
                isOpen={!!editingExpense}
                onClose={() => setEditingExpense(null)}
                expense={editingExpense}
                projects={projects}
                mode="edit"
                currentProject={{
                    ...budget.project,
                    budget: { categories: budget.categories || [] }
                }}
                redirectUrl={route('budgets.show', budget.id)}
            />

            <CrudDeleteModal
                isOpen={!!deleteExpense}
                onClose={() => setDeleteExpense(null)}
                onConfirm={() => {
                    if (deleteExpense) {
                        router.delete(route('expenses.destroy', deleteExpense.id), {
                            onSuccess: () => setDeleteExpense(null),
                            onError: () => setDeleteExpense(null),
                        });
                    }
                }}
                itemName={deleteExpense?.title || ''}
                entityName="expense"
            />

            <BudgetFormModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                budget={budget}
                mode="edit"
            />

            <ExpenseFormModal
                isOpen={isExpenseModalOpen}
                onClose={() => setIsExpenseModalOpen(false)}
                projects={projects}
                mode="create"
                currentProject={{
                    ...budget.project,
                    budget: { categories: budget.categories || [] }
                }}
                redirectUrl={route('budgets.show', budget.id)}
            />
        </PageTemplate>
    );
}
