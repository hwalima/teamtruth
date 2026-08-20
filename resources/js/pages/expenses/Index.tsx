import React, { useState, useEffect } from 'react';
import { router, usePage } from '@inertiajs/react';
import { toast } from '@/components/custom-toast';
import { Button } from '@/components/ui/button';
import { SearchAndFilterBar } from '@/components/ui/search-and-filter-bar';
import { Pagination } from '@/components/ui/pagination';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Eye, Edit, Copy, Trash2, Receipt, Calendar, User as UserIcon, CheckCircle, XCircle, Clock, AlertCircle, Zap, FolderOpen, X, Tag } from 'lucide-react';
import { PageTemplate } from '@/components/page-template';
import { CrudTable } from '@/components/CrudTable';
import { hasPermission } from '@/utils/authorization';
import ExpenseFormModal from '@/components/expenses/ExpenseFormModal';
import ExpenseViewModal from '@/components/expenses/ExpenseViewModal';
import { CrudDeleteModal } from '@/components/CrudDeleteModal';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from 'react-i18next';



interface Expense {
    id: number;
    project: {
        id: number;
        title: string;
    };
    budget_category?: {
        id: number;
        name: string;
        color: string;
    };
    submitter: {
        id: number;
        name: string;
        email?: string;
        avatar?: string;
    };
    amount: number;
    currency: string;
    expense_date: string;
    title: string;
    description?: string;
    vendor?: string;
    status: 'pending' | 'approved' | 'rejected' | 'requires_info';
    created_at: string;
    can_edit?: boolean;
    can_delete?: boolean;
}

export default function ExpenseIndex() {
    const { t } = useTranslation();
    const { expenses, projects, categories, filters, auth, project_name, userWorkspaceRole, workspace, budget_id, flash, permissions: pagePermissions, project_expenses: projectExpenses, all_project_expenses: allProjectExpenses } = usePage().props as any;
    const expensePermissions = pagePermissions;
    
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
    }, [flash]);

    // Get project name from projects array if not directly provided
    const currentProjectName = project_name || (filters?.project_id ?
        projects?.find((p: any) => p.id.toString() === filters.project_id.toString())?.title
        : null);

    const [searchTerm, setSearchTerm] = useState(filters?.search || '');
    const [selectedProject, setSelectedProject] = useState(filters?.project_id || 'all');
    const [selectedCategory, setSelectedCategory] = useState(filters?.category_id || 'all');
    const [selectedStatus, setSelectedStatus] = useState(filters?.status || 'all');
    const hasActiveFilters = () => selectedStatus !== 'all' || selectedProject !== 'all' || selectedCategory !== 'all' || searchTerm !== '';
    const activeFilterCount = () => (selectedStatus !== 'all' ? 1 : 0) + (selectedProject !== 'all' ? 1 : 0) + (selectedCategory !== 'all' ? 1 : 0) + (searchTerm ? 1 : 0);
    const handleResetFilters = () => {
        setSelectedProject('all');
        setSelectedCategory('all');
        setSelectedStatus('all');
        setSearchTerm('');
        const params: any = {};
        if (filters?.per_page) params.per_page = filters.per_page;
        router.get(route('expenses.index'), params, { preserveState: false, preserveScroll: false });
    };
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [currentExpense, setCurrentExpense] = useState<Expense | null>(null);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [deleteExpense, setDeleteExpense] = useState<Expense | null>(null);
    const [visibleProjectCount, setVisibleProjectCount] = useState(filters?.visible_projects ? parseInt(filters.visible_projects) : 10);
    const [selectedProjectObj, setSelectedProjectObj] = useState<any>(() => {
        if (filters?.selected_project) {
            return projects?.find((p: any) => p.id.toString() === filters.selected_project.toString()) || null;
        }
        return null;
    });
    const [selectedCategoryObj, setSelectedCategoryObj] = useState<any>(() => {
        if (filters?.selected_project && filters?.selected_category) {
            const proj = projects?.find((p: any) => p.id.toString() === filters.selected_project.toString());
            return proj?.budget?.categories?.find((c: any) => c.id.toString() === filters.selected_category.toString()) || null;
        }
        return null;
    });
    const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
    const [categoryPage, setCategoryPage] = useState(1);
    const categoryPerPage = 10;



    // Central param builder — reads per_page/sort/view from server `filters` prop (source of truth)
    // stateOverrides lets us pass new values before setState updates the closure
    const buildParams = (
        overrides: Record<string, any> = {},
        stateOverrides: { search?: string; project?: string; category?: string; status?: string; view?: string } = {}
    ) => {
        const view     = 'grid';
        const search   = stateOverrides.search   !== undefined ? stateOverrides.search   : searchTerm;
        const project  = stateOverrides.project  !== undefined ? stateOverrides.project  : selectedProject;
        const category = stateOverrides.category !== undefined ? stateOverrides.category : selectedCategory;
        const status   = stateOverrides.status   !== undefined ? stateOverrides.status   : selectedStatus;

        const params: any = {};
        if (search) params.search = search;
        if (project !== 'all') params.project_id = project;
        if (category !== 'all') params.category_id = category;
        if (status !== 'all') params.status = status;
        if (filters?.per_page) params.per_page = filters.per_page;
        if (filters?.sort_by) params.sort_by = filters.sort_by;
        if (filters?.sort_order) params.sort_order = filters.sort_order;
        // Preserve panel state across filter changes
        if (selectedProjectObj?.id) params.selected_project = selectedProjectObj.id;
        if (selectedCategoryObj?.id) params.selected_category = selectedCategoryObj.id;
        return { ...params, ...overrides };
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        router.get(route('expenses.index'), buildParams({ page: 1 }), { preserveState: true, preserveScroll: true });
    };
    // Filter projects client-side using searchTerm when no project panel is open
    const filteredProjects = projects?.filter((p: any) =>
        (selectedProject === 'all' || p.id.toString() === selectedProject) &&
        (!selectedProjectObj && searchTerm ? p.title.toLowerCase().includes(searchTerm.toLowerCase()) : true)
    ) || [];

    const applyFilters = () => {
        router.get(route('expenses.index'), buildParams({ page: 1 }), { preserveState: false, preserveScroll: false });
    };

    // Add sorting functionality
    const handleSort = (field: string) => {
        const direction = filters?.sort_by === field && filters?.sort_order === 'asc' ? 'desc' : 'asc';
        router.get(route('expenses.index'), buildParams({ sort_by: field, sort_order: direction, page: 1 }), { preserveState: false, preserveScroll: false });
    };

    const processApproval = (expenseId: number, action: string) => {
        const actionText = action === 'approve' ? 'Approving' : 'Rejecting';
        toast.loading(`${actionText} expense...`);
        const routeName = action === 'approve' ? 'expense-approvals.approve' : 'expense-approvals.reject';
        const data: any = action === 'reject' ? { notes: 'Expense rejected by approver' } : { notes: '' };
        router.put(route(routeName, expenseId), data, {
            onSuccess: () => toast.dismiss(),
            onError: (errors: any) => {
                toast.dismiss();
                toast.error(errors?.message || `Failed to ${action} expense`);
            }
        });
    };

    const handleAction = (action: string, expenseOrId: Expense | number) => {
        let expense: Expense;
        
        if (typeof expenseOrId === 'number') {
            // Called from CrudTable with ID
            expense = expenses?.data?.find((e: Expense) => e.id === expenseOrId);
            if (!expense) return;
        } else {
            // Called from grid view with expense object
            expense = expenseOrId;
        }
        
        switch (action) {
            case 'approve' :
                processApproval(expense.id, 'approve');
                break;
            case 'reject' :
                processApproval(expense.id, 'reject');
                break;
            case 'view':
                setCurrentExpense(expense);
                setIsViewModalOpen(true);
                break;
            case 'edit':
                setCurrentExpense(expense);
                setModalMode('edit');
                setIsModalOpen(true);
                break;
            case 'duplicate':
                toast.loading(t('Duplicating expense...'));
                router.post(route('expenses.duplicate', expense.id), {}, {
                    onSuccess: () => {
                        toast.dismiss();
                    },
                    onError: () => {
                        toast.dismiss();
                        toast.error(t('Failed to duplicate expense'));
                    }
                });
                break;
            case 'delete':
                setDeleteExpense(expense);
                break;
        }
    };

    const handleAddNew = () => {
        setCurrentExpense(null);
        setModalMode('create');
        setIsModalOpen(true);
    };

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            pending: 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20',
            approved: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20',
            rejected: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20',
            requires_info: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20',
        };
        return colors[status] || 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/2s0';
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'approved': return <CheckCircle className="h-4 w-4 text-green-600" />;
            case 'rejected': return <XCircle className="h-4 w-4 text-red-600" />;
            case 'requires_info': return <AlertCircle className="h-4 w-4 text-blue-600" />;
            default: return <Clock className="h-4 w-4 text-yellow-600" />;
        }
    };

    const formatCurrency = (amount: string | number) => {
        if (typeof window !== 'undefined' && window.appSettings?.formatCurrency) {
            const numericAmount = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
            return window.appSettings.formatCurrency(numericAmount, { showSymbol: true });
        }
        return amount || 0;
    };

    const pageActions = [];

    if (expensePermissions?.create) {
        pageActions.push({
            label: t('Add Expense'),
            icon: <Plus className="h-4 w-4 mr-2" />,
            variant: 'default',
            onClick: handleAddNew
        });
    }

    const breadcrumbs = [
    { title: t('Dashboard'), href: route('dashboard') },
    { title: t('Budget & Expenses') },
    { title: t('Expenses') }
];

    return (
        <PageTemplate
            title={t('Expenses')}
            description={t('Manage and track your project expenses.')}
            url="/expenses"
            actions={pageActions}
            breadcrumbs={breadcrumbs}
            noPadding
        >
            {/* Overview Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-bl-full" />
                    <CardContent className="relative p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Total Expenses')}</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{allProjectExpenses?.length || 0}</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('Total Records')}</p>
                            </div>
                            <div className="relative z-10 p-2.5 bg-blue-50 dark:bg-blue-900/30 rounded-xl mt-0.5">
                                <Receipt className="h-5 w-5 text-blue-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-yellow-50 dark:bg-yellow-900/30 rounded-bl-full" />
                    <CardContent className="relative p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Pending')}</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{allProjectExpenses?.filter((exp: any) => exp.status === 'pending').length || 0}</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('Awaiting Approval')}</p>
                            </div>
                            <div className="relative z-10 p-2.5 bg-yellow-50 dark:bg-yellow-900/30 rounded-xl mt-0.5">
                                <Clock className="h-5 w-5 text-yellow-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-green-50 dark:bg-green-900/30 rounded-bl-full" />
                    <CardContent className="relative p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Approved')}</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{allProjectExpenses?.filter((exp: any) => exp.status === 'approved').length || 0}</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('Finalized')}</p>
                            </div>
                            <div className="relative z-10 p-2.5 bg-green-50 dark:bg-green-900/30 rounded-xl mt-0.5">
                                <CheckCircle className="h-5 w-5 text-green-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-red-50 dark:bg-red-900/30 rounded-bl-full" />
                    <CardContent className="relative p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Rejected')}</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{allProjectExpenses?.filter((exp: any) => exp.status === 'rejected').length || 0}</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('Declined')}</p>
                            </div>
                            <div className="relative z-10 p-2.5 bg-red-50 dark:bg-red-900/30 rounded-xl mt-0.5">
                                <XCircle className="h-5 w-5 text-red-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 rounded-bl-full" />
                    <CardContent className="relative p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Total Amount')}</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white font-mono">
                                    {(() => {
                                        if (!allProjectExpenses || allProjectExpenses.length === 0) return formatCurrency(0);
                                        const total = Math.round(allProjectExpenses.reduce((sum: number, exp: any) => sum + (parseFloat(exp.amount?.toString()) || 0), 0));
                                        return formatCurrency(total);
                                    })()}
                                </p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('Total Cost')}</p>
                            </div>
                            <div className="relative z-10 p-2.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl mt-0.5">
                                <Zap className="h-5 w-5 text-indigo-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters Row */}
            <div className="bg-white dark:bg-gray-900 rounded-lg border shadow mb-4">
                <SearchAndFilterBar
                    searchTerm={searchTerm}
                    onSearchChange={(value) => {
                        if (selectedProjectObj) {
                            setSelectedProjectObj(null);
                            setSelectedCategoryObj(null);
                            setSearchTerm('');
                            return;
                        }
                        setSearchTerm(value);
                        clearTimeout(window.searchTimeout);
                        window.searchTimeout = setTimeout(() => {
                            router.get(route('expenses.index'), buildParams({ page: 1 }, { search: value }), { preserveState: true, preserveScroll: true });
                        }, 500);
                    }}
                    onSearch={handleSearch}
                    searchPlaceholder={t('Search expenses...')}
                    filters={[
                        {
                            name: 'project_id',
                            label: t('Project'),
                            type: 'select',
                            searchable: true,
                            value: selectedProject,
                            onChange: (value: string) => {
                                setSelectedProject(value);
                                router.get(route('expenses.index'), buildParams({ page: 1 }, { project: value }), { preserveState: false, preserveScroll: false });
                            },
                            options: [
                                { value: 'all', label: t('All Projects') },
                                ...(projects?.map((p: any) => ({ value: p.id.toString(), label: p.title })) || []),
                            ],
                        },
                    ]}
                    hasActiveFilters={hasActiveFilters}
                    activeFilterCount={activeFilterCount}
                    onResetFilters={handleResetFilters}
                />
            </div>

            {/* Project Panel + Expense Content */}
            <div className="flex gap-6">

                {/* Left: Project list panel — BudgetProgress style */}
                <div className="w-72 shrink-0 relative overflow-hidden lg:sticky lg:top-4 min-h-[400px]">


                    {/* Project list card — slides out to left when project selected */}
                    <div className={selectedProjectObj ? 'hidden' : ''}>
                        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
                        {/* Header */}
                        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{t('Projects')}</p>
                                <span className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-600/20">
                                    {projects?.length || 0} {t('projects')}
                                </span>
                            </div>
                        </div>
                        {/* List */}
                        <div className={`divide-y divide-gray-100 dark:divide-gray-800 ${filteredProjects.length > 8 ? 'max-h-[480px] overflow-y-auto' : ''}`}>
                            {/* Individual project rows */}
                            {filteredProjects.slice(0, visibleProjectCount).map((project: any) => {

                                const isSelected = selectedProjectObj?.id === project.id;
                                const projectExpenseCount = project.expense_count || 0;
                                const categoriesCount = project.budget?.categories?.length || 0;
                                return (
                                    <button
                                        key={project.id}
                                        onClick={() => {
                                            setSelectedProjectObj(project);
                                            const firstCat = project.budget?.categories?.[0] || null;
                                            setSelectedCategoryObj(firstCat);
                                            setCategoryPage(1);
                                            setActiveTab('pending');
                                            router.get(route('expenses.index'), { selected_project: project.id, selected_category: firstCat?.id, search: '' }, { preserveState: false, preserveScroll: true, replace: true });
                                        }}
                                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer ${
                                            isSelected
                                                ? 'bg-primary/5 dark:bg-primary/10 border-r-2 border-r-primary'
                                                : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                                        }`}
                                    >
                                        <div
                                            className="flex-shrink-0 h-9 w-9 rounded-lg flex items-center justify-center"
                                            style={{ backgroundColor: '#6366f120', color: '#6366f1' }}
                                        >
                                            <FolderOpen className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-semibold truncate leading-tight ${
                                                isSelected ? 'text-primary' : 'text-gray-900 dark:text-gray-100'
                                            }`}>{project.title}</p>
                                        </div>
                                        <span className={`shrink-0 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
                                            isSelected
                                                ? 'bg-primary/10 text-primary'
                                                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                                        }`}>
                                            {categoriesCount}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        {/* Load more / Show less */}
                        {filteredProjects.length > 8 && (
                            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800">
                                {visibleProjectCount < projects.length ? (
                                <button
                                    onClick={() => {
                                        const next = visibleProjectCount + 10;
                                        setVisibleProjectCount(next);
                                        router.get(route('expenses.index'), { ...buildParams(), visible_projects: next }, { preserveState: true, preserveScroll: true, replace: true });
                                    }}
                                        className="w-full text-xs font-medium text-primary hover:text-primary/80 transition-colors text-center cursor-pointer"
                                    >
                                        {t('Load More')} ({filteredProjects.length - visibleProjectCount} {t('remaining')})
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => {
                                            setVisibleProjectCount(10);
                                            router.get(route('expenses.index'), { ...buildParams(), visible_projects: 10 }, { preserveState: true, preserveScroll: true, replace: true });
                                        }}
                                        className="w-full text-xs font-medium text-primary hover:text-primary/80 transition-colors text-center cursor-pointer"
                                    >
                                        {t('Show Less')}
                                    </button>
                                )}
                            </div>
                        )}
                        </div>
                    </div>

                    {/* Category panel — slides in from left on top of project panel */}
                    <div className={`transition-transform duration-300 ease-in-out ${
                        selectedProjectObj ? 'translate-x-0' : 'hidden'
                    }`}>
                        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden h-full">
                            {/* Header with close button top-left */}
                            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            setSelectedProjectObj(null);
                                            setSelectedCategoryObj(null);
                                            setSearchTerm('');
                                            router.get(route('expenses.index'), {}, { preserveState: false, preserveScroll: true, replace: true });
                                        }}
                                        className="shrink-0 h-6 w-6 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{selectedProjectObj?.title}</p>
                                        <p className="text-[11px] text-gray-400 dark:text-gray-500">{t('Categories')}</p>
                                    </div>
                                </div>
                            </div>
                            {/* Category list */}
                                <div className="divide-y divide-gray-100 dark:divide-gray-800 overflow-y-auto max-h-[490px] scrollbar-none">
                                {selectedProjectObj?.budget?.categories?.length > 0 ? (
                                   selectedProjectObj.budget.categories.map((cat: any) => {
                                        const isSelectedCat = selectedCategoryObj?.id === cat.id;
                                        // Use allProjectExpenses for progress bar so search doesn't affect it
                                        const catSpent = (allProjectExpenses || []).filter((e: any) => e.budget_category_id === cat.id && e.status === 'approved').reduce((sum: number, e: any) => sum + (parseFloat(e.amount) || 0), 0);
                                        const pct = Math.min((catSpent / (cat.allocated_amount || 1)) * 100, 100);
                                        const catExpenses = {
                                            pending: (allProjectExpenses || []).filter(
                                                (e: any) =>
                                                    e.budget_category_id === cat.id &&
                                                    e.status === 'pending'
                                            ).length,
                                        };
                                        return (
                                            <button
                                                key={cat.id}
                                                onClick={() => { setSelectedCategoryObj(cat); setCategoryPage(1); setActiveTab('pending'); setCategorySearch('');  router.get(route('expenses.index'), { selected_project: selectedProjectObj?.id, selected_category: cat.id }, { preserveState: true, preserveScroll: true, replace: true });}}
                                                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer ${
                                                    isSelectedCat
                                                        ? 'bg-primary/5 dark:bg-primary/10 border-r-2 border-r-primary'
                                                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                                                }`}
                                            >
                                                <div
                                                    className="flex-shrink-0 h-9 w-9 rounded-lg flex items-center justify-center"
                                                    style={{ backgroundColor: (cat.color || '#6B7280') + '20', color: cat.color || '#6B7280' }}
                                                >
                                                    <Tag className="h-4 w-4" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-semibold truncate leading-tight ${
                                                        isSelectedCat ? 'text-primary' : 'text-gray-900 dark:text-gray-100'
                                                    }`}>{cat.name}</p>
                                                    <div className="flex items-center gap-1 mt-0.5 whitespace-nowrap">
                                                        <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">
                                                            <span className="font-mono">{formatCurrency(catSpent)}</span> {t('spent')}
                                                        </span>

                                                        <span className="text-[10px] text-gray-300 dark:text-gray-600">•</span>

                                                        <span className={`text-[11px] tabular-nums ${
                                                            ((cat.allocated_amount || 0) - catSpent) < 0
                                                                ? 'text-red-600 dark:text-red-400'
                                                                : 'text-gray-400 dark:text-gray-500'
                                                        }`}>
                                                            <span className="font-mono">{formatCurrency((cat.allocated_amount || 0) - catSpent)}</span> {t('left')}
                                                        </span>

                                                        {catExpenses.pending > 0 && (
                                                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                                                                <Clock className="h-2.5 w-2.5" />
                                                                {catExpenses.pending}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1 mt-1">
                                                        <div
                                                            className="h-1 rounded-full transition-all duration-500 bg-primary"
                                                            style={{ width: `${pct}%`}}
                                                        />
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                                        <Tag className="h-6 w-6 text-gray-300 mb-2" />
                                        <p className="text-xs text-gray-400 dark:text-gray-500">{t('No categories found')}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                </div>

                {/* Right: Expense Content */}
                <div className="flex-1 min-w-0">

                    {/* No project selected — instruction card */}
                    {!selectedProjectObj && (
                        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col items-center justify-center py-20 px-6 text-center">
                            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                                <FolderOpen className="h-7 w-7 text-primary" />
                            </div>
                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{t('Select a Project')}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs">{t('Click a project on the left to view its categories and expenses')}</p>
                        </div>
                    )}

                    {/* Project selected but no category — instruction card */}
                    {selectedProjectObj && !selectedCategoryObj && (
                        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col items-center justify-center py-20 px-6 text-center">
                            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                                <Tag className="h-7 w-7 text-primary" />
                            </div>
                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{t('Select a Category')}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs">{t('Click a category on the left to view its expenses')}</p>
                        </div>
                    )}

                    {/* Category selected — show expenses table with tabs */}
                    {selectedProjectObj && selectedCategoryObj && (() => {
                        const liveProject = projects?.find((p: any) => p.id === selectedProjectObj.id);
                        const liveCat = liveProject?.budget?.categories?.find((c: any) => c.id === selectedCategoryObj.id);
                        // Filter flat project_expenses by project_id then budget_category_id (mirrors Budget Show)
                        const expensesSource = projectExpenses || [];
                        const allCatExpenses = expensesSource.filter(
                            (e: any) => e.project_id === selectedProjectObj.id && e.budget_category_id === selectedCategoryObj.id
                        );
                        const filteredExpenses = allCatExpenses.filter((e: any) => e.status === activeTab);
                        const paginated = filteredExpenses.slice((categoryPage - 1) * categoryPerPage, categoryPage * categoryPerPage);
                        const totalPages = Math.ceil(filteredExpenses.length / categoryPerPage);
                        const staticCatExpenses = (allProjectExpenses || []).filter(
                            (e: any) => e.project_id === selectedProjectObj.id && e.budget_category_id === selectedCategoryObj.id
                        );
                        const pendingCount = staticCatExpenses.filter((e: any) => e.status === 'pending').length;
                        const approvedCount = staticCatExpenses.filter((e: any) => e.status === 'approved').length;
                        const rejectedCount = staticCatExpenses.filter((e: any) => e.status === 'rejected').length;

                        return (
                            <div className="flex flex-col gap-4">
                                {/* Category header + tabs */}
                                <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div
                                                className="flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center"
                                                style={{ backgroundColor: (liveCat?.color || '#6B7280') + '20', color: liveCat?.color || '#6B7280' }}
                                            >
                                                <Tag className="h-5 w-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{liveCat?.name}</p>
                                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                                    <span className="text-gray-600 dark:text-gray-300 font-mono">{t('Allocated')}: {formatCurrency(liveCat?.allocated_amount || 0)}</span>
                                                    {' · '}
                                                    <span className="text-orange-600 font-mono">{t('Spent')}: {formatCurrency((projectExpenses || []).filter((e: any) => e.budget_category_id === selectedCategoryObj.id && e.status === 'approved').reduce((sum: number, e: any) => sum + (parseFloat(e.amount) || 0), 0))}</span>
                                                    {' · '}
                                                    {(() => {
                                                        const spent = (projectExpenses || []).filter((e: any) => e.budget_category_id === selectedCategoryObj.id && e.status === 'approved').reduce((sum: number, e: any) => sum + (parseFloat(e.amount) || 0), 0);
                                                        const remaining = (liveCat?.allocated_amount || 0) - spent;
                                                        return <span className={remaining < 0 ? 'text-red-600' : 'text-green-600'}>{t('Remaining')}: <span className="font-mono">{formatCurrency(remaining)}</span></span>;
                                                    })()}
                                                </p>
                                            </div>
                                        </div>
                                        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as any); setCategoryPage(1); }}>
                                            <TabsList className="h-9">
                                                <TabsTrigger value="pending" className="h-7 px-3 text-xs data-[state=active]:bg-primary data-[state=active]:text-white cursor-pointer">
                                                    {t('Pending')}
                                                    <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 rounded-full px-1 text-[10px] ring-1 ring-inset ring-yellow-600/30 font-bold bg-yellow-100 text-yellow-700">{pendingCount}</span>
                                                </TabsTrigger>
                                                <TabsTrigger value="approved" className="h-7 px-3 text-xs data-[state=active]:bg-primary data-[state=active]:text-white cursor-pointer">
                                                    {t('Approved')}
                                                    <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 rounded-full px-1 text-[10px] ring-1 ring-inset ring-green-600/30 font-bold bg-green-100 text-green-700">{approvedCount}</span>
                                                </TabsTrigger>
                                                <TabsTrigger value="rejected" className="h-7 px-3 text-xs data-[state=active]:bg-primary data-[state=active]:text-white cursor-pointer">
                                                    {t('Rejected')}
                                                    <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 rounded-full px-1 text-[10px] ring-1 ring-inset ring-red-600/30 font-bold bg-red-100 text-red-700">{rejectedCount}</span>
                                                </TabsTrigger>
                                            </TabsList>
                                        </Tabs>
                                    </div>
                                </div>

                                {/* Expenses table */}
                                <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
                                    <CrudTable
                                        columns={[
                                            {
                                                key: 'title',
                                                label: t('Expense'),
                                                render: (value: string, row: any) => (
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{value}</div>
                                                        {row.task?.title && <div className="text-xs text-gray-500 truncate max-w-xs">{row.task.title}</div>}
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
                                                    <div className="flex items-center gap-1.5 text-sm text-gray-500 whitespace-nowrap">
                                                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                                                        <span>{window.appSettings.formatDateTime(new Date(value), false)}</span>
                                                    </div>
                                                )
                                            },
                                            {
                                                key: 'amount',
                                                label: t('Amount'),
                                                render: (value: number) => (
                                                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 font-mono">{formatCurrency(value)}</span>
                                                )
                                            },
                                            {
                                                key: 'status',
                                                label: t('Status'),
                                                render: (value: string) => (
                                                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${getStatusColor(value)}`}>
                                                        {formatText(value)}
                                                    </span>
                                                )
                                            },
                                        ]}
                                        actions={[
                                            { label: t('Approve'), icon: 'CheckCircle', action: 'approve', className: 'text-gray-500 hover:text-gray-700', condition: (row: any) => expensePermissions?.expense_approve && row?.status === 'pending' },
                                            { label: t('Reject'), icon: 'XCircle', action: 'reject', className: 'text-gray-500 hover:text-gray-600', condition: (row: any) => expensePermissions?.expense_reject && row?.status === 'pending' },
                                            { label: t('View'), icon: 'Eye', action: 'view', className: 'text-gray-500 hover:text-gray-700', condition: () => true },
                                            { label: t('Edit'), icon: 'Edit', action: 'edit', className: 'text-gray-500 hover:text-gray-700', condition: (row: any) => expensePermissions?.update && row?.status !== 'approved' },
                                            { label: t('Delete'), icon: 'Trash2', action: 'delete', className: 'text-gray-500 hover:text-gray-700', condition: () => expensePermissions?.delete },
                                        ]}
                                        data={paginated}
                                        from={(categoryPage - 1) * categoryPerPage + 1}
                                        onAction={handleAction}
                                        permissions={auth?.permissions || []}
                                    />
                                    {filteredExpenses.length > 0 && (
                                        <Pagination
                                            from={Math.min((categoryPage - 1) * categoryPerPage + 1, filteredExpenses.length)}
                                            to={Math.min(categoryPage * categoryPerPage, filteredExpenses.length)}
                                            total={filteredExpenses.length}
                                            links={[
                                                { label: '&laquo; Previous', url: categoryPage > 1 ? `?page=${categoryPage - 1}` : null, active: false },
                                                ...Array.from({ length: totalPages }, (_, i) => ({ label: String(i + 1), url: `?page=${i + 1}`, active: categoryPage === i + 1 })),
                                                { label: 'Next &raquo;', url: categoryPage < totalPages ? `?page=${categoryPage + 1}` : null, active: false },
                                            ]}
                                            entityName={t('expenses')}
                                            hidePerPage
                                            onPageChange={(url) => {
                                                const page = new URLSearchParams(url.split('?')[1]).get('page');
                                                if (page) setCategoryPage(parseInt(page));
                                            }}
                                        />
                                    )}
                                </div>
                            </div>
                        );
                    })()}

                </div>
            </div> {/* end flex gap-6 wrapper */}
            <ExpenseFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                expense={currentExpense}
                projects={projects}
                mode={modalMode}
                redirectUrl={selectedProjectObj && selectedCategoryObj
                    ? route('expenses.index', { selected_project: selectedProjectObj.id, selected_category: selectedCategoryObj.id })
                    : route('expenses.index')}
            />

            <ExpenseViewModal
                isOpen={isViewModalOpen}
                onClose={() => setIsViewModalOpen(false)}
                expense={currentExpense}
            />

            <CrudDeleteModal
                isOpen={!!deleteExpense}
                onClose={() => setDeleteExpense(null)}
                onConfirm={() => {
                    if (deleteExpense) {
                        toast.loading(t('Deleting expense...'));
                        router.delete(route('expenses.destroy', deleteExpense.id), {
                            onSuccess: () => {
                                toast.dismiss();
                                setDeleteExpense(null);
                            },
                            onError: () => {
                                toast.dismiss();
                                toast.error(t('Failed to delete expense'));
                                setDeleteExpense(null);
                            }
                        });
                    }
                }}
                itemName={deleteExpense?.title || ''}
                entityName={t('Expense')}
                additionalInfo={[
                    `${t('Amount')}: ${deleteExpense ? formatCurrency(deleteExpense.amount) : ''}`,
                    `${t('Project')}: ${deleteExpense?.project.title || ''}`,
                    `${t('Date')}: ${deleteExpense ? window.appSettings.formatDateTime(new Date(deleteExpense.expense_date),false) : ''}`
                ]}
            />

        </PageTemplate>
    );
}