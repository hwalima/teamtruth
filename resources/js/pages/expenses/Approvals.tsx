import React, { useState, useEffect } from 'react';
import { PageTemplate } from '@/components/page-template';
import { Button } from '@/components/ui/button';
import { SearchAndFilterBar } from '@/components/ui/search-and-filter-bar';
import { Pagination } from '@/components/ui/pagination';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Check, X, AlertCircle, Clock, Receipt, CheckCircle, XCircle, DollarSign, Calendar } from 'lucide-react';
import { router, usePage } from '@inertiajs/react';
import { formatCurrency } from '@/utils/currency';
import { toast } from '@/components/custom-toast';
import { useTranslation } from 'react-i18next';
import { CrudTable } from '@/components/CrudTable';
import { hasPermission } from '@/utils/authorization';
import { Avatar, AvatarFallback, AvatarImage, AvatarImage } from '@/components/ui/avatar';

interface Props {
    expenses: any;
    stats: any;
    projects: any[];
    filters: any;
    permissions?: any;
}

export default function Approvals({ expenses, stats, projects, filters, permissions }: Props) {
    const { t } = useTranslation();
    const { flash, permissions: pagePermissions } = usePage().props as any;
    const approvalPermissions = permissions || pagePermissions;
    const [searchTerm, setSearchTerm] = useState(filters?.search || '');
    const [selectedStatus, setSelectedStatus] = useState(filters?.status || 'all');
    const [selectedProject, setSelectedProject] = useState(filters?.project_id || 'all');
    const [viewMode, setViewMode] = useState(filters?.view || 'cards');
    const activeFilterCount = () => (searchTerm ? 1 : 0) + (selectedStatus !== 'all' ? 1 : 0) + (selectedProject !== 'all' ? 1 : 0);
    
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
    
    // Central param builder
    const buildParams = (
        overrides: Record<string, any> = {},
        stateOverrides: { search?: string; status?: string; project?: string; view?: string } = {}
    ) => {
        const view    = stateOverrides.view    !== undefined ? stateOverrides.view    : viewMode;
        const search  = stateOverrides.search  !== undefined ? stateOverrides.search  : searchTerm;
        const status  = stateOverrides.status  !== undefined ? stateOverrides.status  : selectedStatus;
        const project = stateOverrides.project !== undefined ? stateOverrides.project : selectedProject;

        const params: any = { page: 1, view };
        if (search) params.search = search;
        if (status !== 'all') params.status = status;
        if (project !== 'all') params.project_id = project;
        if (filters?.per_page) params.per_page = filters.per_page;
        if (filters?.sort_by) params.sort_by = filters.sort_by;
        if (filters?.sort_order) params.sort_order = filters.sort_order;
        return { ...params, ...overrides };
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        router.get(route('expense-approvals.index'), buildParams({ page: 1 }), { preserveState: false });
    };
    
    const applyFilters = () => {
        router.get(route('expense-approvals.index'), buildParams({ page: 1 }), { preserveState: false });
    };
    
    // Add sorting functionality
    const handleSort = (field: string) => {
        const direction = filters?.sort_by === field && filters?.sort_order === 'asc' ? 'desc' : 'asc';
        router.get(route('expense-approvals.index'), buildParams({ sort_by: field, sort_order: direction, page: 1 }), { preserveState: false });
    };
    
    const resetFilters = () => {
        setSearchTerm('');
        setSelectedStatus('all');
        setSelectedProject('all');
        const params: any = { page: 1, view: viewMode };
        if (filters?.per_page) params.per_page = filters.per_page;
        router.get(route('expense-approvals.index'), params, { preserveState: false });
    };
    
    const hasActiveFilters = () => {
        return searchTerm || selectedStatus !== 'all' || selectedProject !== 'all';
    };
    // Handle actions for CrudTable
    const handleAction = (action: string, expenseId: number) => {
        processApproval(expenseId, action);
    };
    
    const processApproval = (expenseId: number, action: string) => {
        const actionText = action === 'approve' ? 'Approving' : action === 'reject' ? 'Rejecting' : 'Processing';
        toast.loading(`${actionText} expense...`);
        
        const routeName = action === 'approve' ? 'expense-approvals.approve' : 
                         action === 'reject' ? 'expense-approvals.reject' : 
                         'expense-approvals.request-info';
        
        const data: any = {};
        
        // For rejection, we can provide a default note or leave it empty
        if (action === 'reject') {
            data.notes = 'Expense rejected by approver';
        } else if (action === 'request_info') {
            data.notes = 'Additional information required';
        } else {
            data.notes = '';
        }
        
        router.post(route(routeName, expenseId), data, {
            onSuccess: () => {
                toast.dismiss();
            },
            onError: (errors) => {
                toast.dismiss();
                console.error('Expense approval error:', errors);
                
                // Show specific error message if available
                const errorMessage = errors?.message || `Failed to ${action} expense`;
                toast.error(errorMessage);
            }
        });
    };



    const breadcrumbs = [
        { title: 'Dashboard', href: route('dashboard') },
        { title: t('Budget & Expenses') },
        { title: 'Expense Approvals' }
    ];

    return (
        <PageTemplate title={t('Expense Approvals')} description={t('Review and manage expense approvals.')} breadcrumbs={breadcrumbs} noPadding>
            <div className="space-y-6">
                {/* Overview Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-yellow-50 dark:bg-yellow-900/30 rounded-bl-full" />
                        <CardContent className="relative p-5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Pending Approval</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.pending_count}</p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Awaiting Review</p>
                                </div>
                                <div className="relative z-10 p-2.5 bg-yellow-50 dark:bg-yellow-900/30 rounded-xl mt-0.5">
                                    <Clock className="h-5 w-5 text-yellow-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-bl-full" />
                        <CardContent className="relative p-5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Requires Info</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.requires_info_count}</p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Needs Attention</p>
                                </div>
                                <div className="relative z-10 p-2.5 bg-blue-50 dark:bg-blue-900/30 rounded-xl mt-0.5">
                                    <AlertCircle className="h-5 w-5 text-blue-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-green-50 dark:bg-green-900/30 rounded-bl-full" />
                        <CardContent className="relative p-5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Approved Today</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.approved_today}</p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Processed</p>
                                </div>
                                <div className="relative z-10 p-2.5 bg-green-50 dark:bg-green-900/30 rounded-xl mt-0.5">
                                    <CheckCircle className="h-5 w-5 text-green-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 rounded-bl-full" />
                        <CardContent className="relative p-5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Pending Amount</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white font-mono">{formatCurrency(stats.pending_amount || 0)}</p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Total Value</p>
                                </div>
                                <div className="relative z-10 p-2.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl mt-0.5">
                                    <DollarSign className="h-5 w-5 text-indigo-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters Row */}
                <div className="bg-white dark:bg-gray-900 rounded-lg border shadow">
                    <SearchAndFilterBar
                        searchTerm={searchTerm}
                        onSearchChange={(value) => {
                            setSearchTerm(value);
                            clearTimeout(window.searchTimeout);
                            window.searchTimeout = setTimeout(() => {
                                router.get(route('expense-approvals.index'), buildParams({ page: 1 }, { search: value }), { preserveState: false });
                            }, 500);
                        }}
                        onSearch={handleSearch}
                        searchPlaceholder={t('Search expenses...')}
                        filters={[
                            {
                                name: 'status',
                                label: t('Status'),
                                type: 'select',
                                value: selectedStatus,
                                onChange: (value: string) => {
                                    setSelectedStatus(value);
                                    router.get(route('expense-approvals.index'), buildParams({ page: 1 }, { status: value }), { preserveState: false });
                                },
                                options: [
                                    { value: 'all', label: t('All') },
                                    { value: 'pending', label: t('Pending') },
                                    { value: 'approved', label: t('Approved') },
                                    { value: 'rejected', label: t('Rejected') },
                                    { value: 'requires_info', label: t('Requires Info') },
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
                                    router.get(route('expense-approvals.index'), buildParams({ page: 1 }, { project: value }), { preserveState: false });
                                },
                                options: [
                                    { value: 'all', label: t('All Projects') },
                                    ...(projects?.map((p: any) => ({ value: p.id.toString(), label: p.title })) || []),
                                ],
                            },
                        ]}
                        hasActiveFilters={hasActiveFilters}
                        activeFilterCount={activeFilterCount}
                        onResetFilters={resetFilters}
                        showViewToggle
                        activeView={viewMode}
                        onViewChange={(view) => {
                            setViewMode(view);
                            router.get(route('expense-approvals.index'), buildParams({ page: 1, view }, { view }), { preserveState: false });
                        }}
                        viewOptions={[
                            { value: 'cards', label: t('Cards View'), icon: 'Grid3X3' },
                            { value: 'table', label: t('Table View'), icon: 'List' },
                        ]}
                    />
                </div>
                
                {expenses && expenses.data && expenses.data.length > 0 ? (
                    viewMode === 'cards' ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {expenses.data.map((expense: any) => (
                                    <Card key={expense.id} className="hover:shadow-lg transition-shadow flex flex-col">
                                        <CardHeader className="pb-4">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <CardTitle className="text-lg mb-2">
                                                        {expense.title}
                                                    </CardTitle>
                                                    <div className="text-sm text-gray-500 mb-2">
                                                        <span className="font-medium">{expense.project?.title}</span>
                                                    </div>
                                                    <div className="text-xs text-gray-400">
                                                        Submitted by {expense.submitter?.name} • {window.appSettings.formatDateTime(new Date(expense.expense_date),false)}
                                                    </div>
                                                </div>
                                                <div className="text-right ml-4">
                                                    <div className="text-lg font-bold text-gray-900 mb-2 font-mono">
                                                        {formatCurrency(expense.amount)}
                                                    </div>
                                                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                                                        expense.status === 'requires_info' ? 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20' : 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20'
                                                    }`}>
                                                        {formatText(expense.status)}
                                                    </span>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        
                                        <CardContent className="pt-0 space-y-4 flex-1 flex flex-col">
                                            <div className="flex-1">
                                                {expense.description && (
                                                    <div>
                                                        <p className="text-sm text-gray-500 line-clamp-2">{expense.description}</p>
                                                    </div>
                                                )}
                                                
                                                {expense.budget_category && (
                                                    <div className="mt-2">
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                            {expense.budget_category.name}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex gap-1 mt-auto">
                                                {approvalPermissions?.approve && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                onClick={() => processApproval(expense.id, 'approve')}
                                                                className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                                                            >
                                                                <Check className="h-4 w-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Approve</TooltipContent>
                                                    </Tooltip>
                                                )}
                                                {approvalPermissions?.reject && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                onClick={() => processApproval(expense.id, 'reject')}
                                                                className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Reject</TooltipContent>
                                                    </Tooltip>
                                                )}
                                                {approvalPermissions?.request_info && expense.status === 'pending' && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                onClick={() => processApproval(expense.id, 'request_info')}
                                                                className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                                                            >
                                                                <AlertCircle className="h-4 w-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Request additional information</TooltipContent>
                                                    </Tooltip>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                            
                            {/* Pagination for cards */}
                            <div className="mt-4 bg-white dark:bg-gray-800 border rounded-lg shadow overflow-hidden">
                               <Pagination
                                    from={expenses.from || 0}
                                    to={expenses.to || 0}
                                    total={expenses.total || 0}
                                    links={expenses.links}
                                    entityName={t('expenses')}
                                    currentPerPage={expenses.per_page?.toString() || filters?.per_page?.toString() || '10'}
                                    perPageOptions={[10, 25, 50, 100]}
                                    onPerPageChange={(value) => router.get(route('expense-approvals.index'), buildParams({ page: 1, per_page: parseInt(value) }), { preserveState: false })}
                                    onPageChange={(url) => {
                                        const pageNum = new URL(url).searchParams.get('page');
                                        router.get(route('expense-approvals.index'), buildParams({ page: pageNum ? parseInt(pageNum) : 1 }), { preserveState: false });
                                    }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-lg shadow overflow-hidden">
                            <CrudTable
                            columns={[
                                {
                                    key: 'title',
                                    label: t('Expense'),
                                    sortable: true,
                                    render: (value: string, row: any) => (
                                        <div>
                                            <div className="text-sm font-medium text-gray-900">{value}</div>
                                        </div>
                                    )
                                },
                                {
                                key: 'submitter.name',
                                label: t('Submitter'),
                                sortable: true,
                                render: (value: string, row: any) => (
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10 rounded-full object-cover">
                                            <AvatarImage src={row.submitter.avatar} />
                                            <AvatarFallback className="text-xs">
                                                {row.submitter.name?.charAt(0)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <div className="text-sm font-medium text-gray-900">{row.submitter.name}</div>
                                            <div className="text-xs text-gray-500">{row.submitter.email || ''}</div>
                                        </div>
                                    </div>
                                )
                            },
                                {
                                    key: 'project.title',
                                    label: t('Project & Category'),
                                    sortable: true,
                                    render: (value: string, row: any) => (
                                        <div>
                                            <div className="text-sm font-medium text-gray-900">{value}</div>
                                            {row.budget_category && (
                                                <div className="flex items-center gap-1 mt-1">
                                                    <span className="text-xs text-gray-500">{row.budget_category.name}</span>
                                                </div>
                                            )}
                                        </div>
                                    )
                                },
                                {
                                    key: 'amount',
                                    label: t('Amount'),
                                    sortable: true,
                                    render: (value: number) => (
                                        <span className="text-sm font-medium text-gray-900 font-mono">
                                            {formatCurrency(value)}
                                        </span>
                                    )
                                },
                                {
                                    key: 'status',
                                    label: t('Status'),
                                    sortable: true,
                                    render: (value: string) => (
                                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                                            value === 'requires_info' ? 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20' : 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20'
                                        }`}>
                                            {formatText(value)}
                                        </span>
                                    )
                                },
                                {
                                    key: 'expense_date',
                                    label: t('Date'),
                                    sortable: true,
                                    render: (value: string) => (
                                        <div className="flex items-center gap-1.5 text-sm whitespace-nowrap text-gray-500">
                                            <Calendar className="h-3.5 w-3.5 shrink-0" />
                                            <span className="text-sm">
                                                {window.appSettings.formatDateTime(new Date(value), false)}
                                            </span>
                                        </div>

                                    )
                                }
                            ]}
                            actions={[
                                {
                                    label: t('Approve'),
                                    icon: 'Check',
                                    action: 'approve',
                                    className: 'text-gray-500 hover:text-gray-700',
                                    condition: () => approvalPermissions?.approve
                                },
                                {
                                    label: t('Reject'),
                                    icon: 'X',
                                    action: 'reject',
                                    className: 'text-gray-500 hover:text-gray-700',
                                    condition: () => approvalPermissions?.reject
                                },
                                {
                                    label: t('Request Info'),
                                    icon: 'AlertCircle',
                                    action: 'request_info',
                                    className: 'text-gray-500 hover:text-gray-700',
                                    condition: (row: any) => approvalPermissions?.request_info && row.status === 'pending'
                                }
                            ]}
                            data={expenses.data || []}
                            from={expenses.from || 1}
                            onAction={handleAction}
                            sortField={filters?.sort_by}
                            sortDirection={filters?.sort_order}
                            onSort={handleSort}
                            permissions={[]}
                        />
                        {expenses?.links && expenses.data?.length > 0 && (
                                <Pagination
                                    from={expenses.from || 0}
                                    to={expenses.to || 0}
                                    total={expenses.total || 0}
                                    links={expenses.links}
                                    entityName={t('expenses')}
                                    currentPerPage={expenses.per_page?.toString() || filters?.per_page?.toString() || '10'}
                                    perPageOptions={[10, 25, 50, 100]}
                                    onPerPageChange={(value) => router.get(route('expense-approvals.index'), buildParams({ page: 1, per_page: parseInt(value) }), { preserveState: false })}
                                    onPageChange={(url) => {
                                        const pageNum = new URL(url).searchParams.get('page');
                                        router.get(route('expense-approvals.index'), buildParams({ page: pageNum ? parseInt(pageNum) : 1 }), { preserveState: false });
                                    }}
                                />
                        )}
                        </div>
                    )
                ) : (
                    <div className="bg-white rounded-lg shadow p-8 text-center">
                        <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p className="text-gray-500 mb-4">No pending approvals</p>
                        <p className="text-sm text-gray-400">All expenses have been processed</p>
                    </div>
                )}
            </div>
        </PageTemplate>
    );
}