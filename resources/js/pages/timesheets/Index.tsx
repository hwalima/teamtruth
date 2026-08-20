import React, { useState, useEffect } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { toast } from '@/components/custom-toast';
import TimesheetFormModal from '@/components/timesheets/TimesheetFormModal';
import { CrudTable } from '@/components/CrudTable';
import TimerWidget from '@/components/timesheets/TimerWidget';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { SearchAndFilterBar } from '@/components/ui/search-and-filter-bar';
import { Plus, Edit, Trash2, Clock, Calendar, List, LayoutGrid, CheckCircle, FileText, Send } from 'lucide-react';
import { PageTemplate } from '@/components/page-template';
import { CrudDeleteModal } from '@/components/CrudDeleteModal';
import { useTranslation } from 'react-i18next';
import { hasPermission } from '@/utils/authorization';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Timesheet {
    id: number;
    start_date: string;
    end_date: string;
    status: string;
    total_hours: number;
    billable_hours: number;
    user?: { name: string };
    entries?: any[];
}

interface User {
    id: number;
    name: string;
}

interface Props {
    timesheets: {
        data: Timesheet[];
        links?: any[];
        from?: number;
        to?: number;
        total?: number;
        current_page?: number;
        last_page?: number;
        per_page?: number;
    };
    members: User[];
    projects: any[];
    overviewStats: {
        total_timesheets: number;
        draft_count: number;
        submitted_count: number;
        approved_count: number;
        total_hours_this_week: number;
    };
    filters: {
        status?: string;
        user_id?: string;
        search?: string;
        project_id?: string;
        start_date?: string;
        end_date?: string;
        is_billable?: string;
        min_hours?: string;
        max_hours?: string;
        per_page?: string;
        view?: string;
        sort_field?: string;
        sort_direction?: 'asc' | 'desc';
    };
    permissions?: any;
}

export default function TimesheetsIndex({ timesheets, members, projects = [], overviewStats, filters, permissions }: Props) {
    const { t } = useTranslation();
    const { flash, auth } = usePage().props as any;
    const userPermissions = auth?.permissions || [];
    
    const formatText = (text: string) => {
        return text.replace(/_/g, ' ').split(' ').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
    };
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingTimesheet, setEditingTimesheet] = useState<Timesheet | null>(null);
    const [viewMode, setViewMode] = useState(filters.view || 'cards');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deletingTimesheet, setDeletingTimesheet] = useState<Timesheet | null>(null);
    const [searchTerm, setSearchTerm] = useState(filters.search || '');
    const [selectedStatus, setSelectedStatus] = useState(filters.status || 'all');
    const [selectedProject, setSelectedProject] = useState(filters.project_id || 'all');
    // Show flash messages
    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
        if (flash?.error) {
            toast.error(flash.error);
        }
    }, [flash]);

    const handleAction = (action: string, timesheetOrId: Timesheet | number) => {
        let timesheetId: number;
        
        if (typeof timesheetOrId === 'number') {
            // Called with timesheet ID
            timesheetId = timesheetOrId;
        } else {
            // Called with timesheet object from CrudTable
            timesheetId = timesheetOrId.id;
        }
        
        switch (action) {
            case 'edit':
                const timesheet = timesheets.data.find(t => t.id === timesheetId);
                if (timesheet) {
                    setEditingTimesheet(timesheet);
                    setIsFormModalOpen(true);
                }
                break;
            case 'submit':
                toast.loading(t('Submitting timesheet...'));
                router.put(route('timesheets.submit', timesheetId), {}, {
                    onSuccess: () => {
                        toast.dismiss();
                    },
                    onError: () => {
                        toast.dismiss();
                        toast.error(t('Failed to submit timesheet'));
                    }
                });
                break;
            case 'delete':
                const timesheetToDelete = timesheets.data.find(t => t.id === timesheetId);
                if (timesheetToDelete) {
                    setDeletingTimesheet(timesheetToDelete);
                    setIsDeleteModalOpen(true);
                }
                break;
        }
    };

    const getStatusColor = (status: string) => {
        const colors = {
            draft: 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20',
            submitted: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20',
            approved: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20',
            rejected: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20'
        };
        return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
    };



    const buildParams = (
        overrides: Record<string, any> = {},
        stateOverrides: { search?: string; status?: string; project?: string; view?: string } = {}
    ) => {
        const search  = stateOverrides.search  !== undefined ? stateOverrides.search  : searchTerm;
        const status  = stateOverrides.status  !== undefined ? stateOverrides.status  : selectedStatus;
        const project = stateOverrides.project !== undefined ? stateOverrides.project : selectedProject;
        const view    = stateOverrides.view    !== undefined ? stateOverrides.view    : viewMode;

        const params: any = { page: 1, view };
        if (search) params.search = search;
        if (status !== 'all') params.status = status;
        if (project !== 'all') params.project_id = project;
        if (filters.per_page) params.per_page = filters.per_page;
        if (filters.sort_field) params.sort_field = filters.sort_field;
        if (filters.sort_direction) params.sort_direction = filters.sort_direction;
        return { ...params, ...overrides };
    };

    const handleViewChange = (view: string) => {
        setViewMode(view);
        router.get(route('timesheets.index'), buildParams({}, { view }), { preserveState: true });
    };

    const handlePerPageChange = (perPage: string) => {
        router.get(route('timesheets.index'), buildParams({ per_page: perPage }), { preserveState: true });
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        applyFilters();
    };
    
    const applyFilters = () => {
        router.get(route('timesheets.index'), buildParams({ page: 1 }), { preserveState: false, preserveScroll: false });
    };
    
    const handleStatusFilter = (value: string) => {
        setSelectedStatus(value);
        router.get(route('timesheets.index'), buildParams({ page: 1 }, { status: value }), { preserveState: false, preserveScroll: false });
    };
    
    const handleProjectFilter = (value: string) => {
        setSelectedProject(value);
        router.get(route('timesheets.index'), buildParams({ page: 1 }, { project: value }), { preserveState: false, preserveScroll: false });
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
        router.get(route('timesheets.index'), buildParams({ page: 1 }, { search: '', status: 'all', project: 'all' }), { preserveState: false, preserveScroll: false });
    };

    const handleSort = (field: string) => {
        const direction = filters.sort_field === field && filters.sort_direction === 'asc' ? 'desc' : 'asc';
        router.get(route('timesheets.index'), buildParams({ sort_field: field, sort_direction: direction, page: 1 }), { preserveState: true, preserveScroll: true });
    };

    // CrudTable configuration
    const columns = [
        {
            key: 'user_id',
            label: t('User'),
            render: (value: string, row: any) => (
                <>
                    {/* left side show avatar then right side show name and name under show email */}
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 rounded-full object-cover">
                            <AvatarImage src={row.user?.avatar} />
                            <AvatarFallback>{row.user?.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                            <div className="font-medium">{row.user?.name}</div>
                            <div className="text-sm text-muted-foreground">{row.user?.email}</div>
                        </div>
                    </div>
                </>
            )
        },
        {
            key: 'start_date',
            label: t('Period'),
            sortable: true,
            render: (value: string, row: any) => (
                <div className="flex items-center gap-1.5 text-sm whitespace-nowrap text-gray-500">
                    <Calendar className="h-3.5 w-3.5 shrink-0 mt-1" />
                    <div>
                        <div className="font-medium">
                            {window.appSettings.formatDateTime(new Date(row.start_date), false)}
                        </div>
                        <div className="font-medium">
                            to {window.appSettings.formatDateTime(new Date(row.end_date), false)}
                        </div>
                    </div>
                </div>
            )
        },
        {
            key: 'entries',
            label: t('Entries'),
            render: (value: any, row: any) => row.entries?.length || 0
        },
        {
            key: 'total_hours',
            label: t('Total Hours'),
            sortable: true,
            render: (value: number) => (
                <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {value}h
                </div>
            )
        },
        {
            key: 'billable_hours',
            label: t('Billable Hours'),
            sortable: true,
            render: (value: number) => (
                <div className="flex items-center gap-1 text-green-600">
                    <Calendar className="h-4 w-4" />
                    {value}h
                </div>
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
    ];

    const actions = [
        {
            label: t('Edit'),
            icon: 'Edit',
            action: 'edit',
            className: 'text-gray-500 hover:text-gray-700',
            condition: () => hasPermission(userPermissions, 'timesheet_update')
        },
        {
            label: t('Submit'),
            icon: 'Send',
            action: 'submit',
            className: 'text-gray-500 hover:text-gray-700',
            condition: (row: any) => hasPermission(userPermissions, 'timesheet_submit') && row.status === 'draft'
        },
        {
            label: t('Delete'),
            icon: 'Trash2',
            action: 'delete',
            className: 'text-gray-500 hover:text-gray-700',
            condition: () => hasPermission(userPermissions, 'timesheet_delete')
        }
    ];

    const handleDeleteConfirm = () => {
        if (deletingTimesheet) {
            toast.loading('Deleting timesheet...');
            router.delete(route('timesheets.destroy', deletingTimesheet.id), {
                onSuccess: () => {
                    toast.dismiss();
                    setIsDeleteModalOpen(false);
                    setDeletingTimesheet(null);
                },
                onError: () => {
                    toast.dismiss();
                    toast.error('Failed to delete timesheet');
                    setIsDeleteModalOpen(false);
                    setDeletingTimesheet(null);
                }
            });
        }
    };

    const pageActions = [];
    
    if (hasPermission(userPermissions, 'timesheet_create')) {
        pageActions.push({
            label: t('New Timesheet'),
            icon: <Plus className="h-4 w-4 mr-2" />,
            variant: 'default' as const,
            onClick: () => setIsFormModalOpen(true)
        });
    }

    const breadcrumbs = [
        { title: t('Dashboard'), href: route('dashboard') },
        { title: t('Timesheets') }
    ];

    return (
        <PageTemplate 
            title={t('Timesheets')}
            description={t('Manage your timesheets and their details.')} 
            actions={pageActions}
            breadcrumbs={breadcrumbs}
        >
            <Head title={t('Timesheets')} />
            
            {/* Overview Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
                {/* Total Timesheets */}
                <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-bl-full" />
                    <CardContent className="relative p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Total Timesheets')}</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{overviewStats.total_timesheets}</p>
                            </div>
                            <div className="relative z-10 p-2.5 bg-blue-50 dark:bg-blue-900/30 rounded-xl mt-0.5">
                                <FileText className="h-5 w-5 text-blue-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Draft */}
                <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gray-50 dark:bg-gray-700/30 rounded-bl-full" />
                    <CardContent className="relative p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Draft')}</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{overviewStats.draft_count}</p>
                            </div>
                            <div className="relative z-10 p-2.5 bg-gray-50 dark:bg-gray-700/30 rounded-xl mt-0.5">
                                <FileText className="h-5 w-5 text-gray-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Submitted */}
                <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-yellow-50 dark:bg-yellow-900/30 rounded-bl-full" />
                    <CardContent className="relative p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Submitted')}</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{overviewStats.submitted_count}</p>
                            </div>
                            <div className="relative z-10 p-2.5 bg-yellow-50 dark:bg-yellow-900/30 rounded-xl mt-0.5">
                                <Send className="h-5 w-5 text-yellow-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Approved */}
                <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-green-50 dark:bg-green-900/30 rounded-bl-full" />
                    <CardContent className="relative p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Approved')}</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{overviewStats.approved_count}</p>
                            </div>
                            <div className="relative z-10 p-2.5 bg-green-50 dark:bg-green-900/30 rounded-xl mt-0.5">
                                <CheckCircle className="h-5 w-5 text-green-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* This Week Hours */}
                <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-purple-50 dark:bg-purple-900/30 rounded-bl-full" />
                    <CardContent className="relative p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('This Week')}</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{overviewStats.total_hours_this_week}h</p>
                            </div>
                            <div className="relative z-10 p-2.5 bg-purple-50 dark:bg-purple-900/30 rounded-xl mt-0.5">
                                <Clock className="h-5 w-5 text-purple-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
            
            {/* Timer Widget - Full Width */}
            <div className="mb-6">
                <TimerWidget projects={projects} permissions={userPermissions} />
            </div>
            
            {/* Search and filters section */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow mb-4 border">
                <SearchAndFilterBar
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    onSearch={handleSearch}
                    searchPlaceholder={t('Search timesheets...')}
                    filters={[
                        {
                            name: 'status',
                            label: t('Status'),
                            type: 'select',
                            value: selectedStatus,
                            onChange: handleStatusFilter,
                            options: [
                                { value: 'all', label: t('All Status') },
                                { value: 'draft', label: t('Draft') },
                                { value: 'submitted', label: t('Submitted') },
                                { value: 'approved', label: t('Approved') },
                                { value: 'rejected', label: t('Rejected') },
                            ]
                        },
                        {
                            name: 'project_id',
                            label: t('Project'),
                            type: 'select',
                            searchable: true,
                            value: selectedProject,
                            onChange: handleProjectFilter,
                            options: [
                                { value: 'all', label: t('All Projects') },
                                ...projects.map(p => ({ value: p.id.toString(), label: p.title }))
                            ]
                        },
                    ]}
                    hasActiveFilters={hasActiveFilters}
                    activeFilterCount={activeFilterCount}
                    onResetFilters={handleResetFilters}
                    showViewToggle
                    activeView={viewMode}
                    onViewChange={handleViewChange}
                    viewOptions={[
                        { value: 'table', label: t('Table View'), icon: 'List' },
                        { value: 'cards', label: t('Cards View'), icon: 'Grid3X3' },
                    ]}
                />
            </div>
            


            {/* Card View */}
            {viewMode === 'cards' && (
                timesheets?.data?.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                    <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 mb-4">{t('No timesheets found')}</p>
                    {hasPermission(userPermissions, 'timesheet_create') && (
                        <Button onClick={() => setIsFormModalOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            {t('Create your first timesheet')}
                        </Button>
                    )}
                </div>
            ):(
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {timesheets?.data?.map((timesheet: Timesheet) => (
                        <Card key={timesheet.id} className="hover:shadow-md transition-shadow">
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <CardTitle className="text-base">
                                        {t('Week of')} {window.appSettings.formatDateTime(new Date(timesheet.start_date),false)}
                                    </CardTitle>
                                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${getStatusColor(timesheet.status)}`}>
                                        {formatText(timesheet.status)}
                                    </span>
                                </div>
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                    <Avatar className='h-6 w-6'>
                                        <AvatarImage src={timesheet.user?.avatar} />
                                        <AvatarFallback>{timesheet.user?.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    {timesheet.user?.name}
                                </p>
                            </CardHeader>
                            
                            <CardContent>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="flex items-center gap-1">
                                            <Clock className="h-4 w-4" />
                                            {t('Total Hours')}
                                        </span>
                                        <span className="font-medium">{timesheet.total_hours}h</span>
                                    </div>
                                    
                                    <div className="flex justify-between text-sm">
                                        <span className="flex items-center gap-1">
                                            <Calendar className="h-4 w-4" />
                                            {t('Billable Hours')}
                                        </span>
                                        <span className="font-medium text-green-600">{timesheet.billable_hours}h</span>
                                    </div>
                                    
                                    <div className="flex justify-between text-sm">
                                        <span>{t('Period')}</span>
                                        <span>{window.appSettings.formatDateTime(new Date(timesheet.start_date),false)} - {window.appSettings.formatDateTime(new Date(timesheet.end_date),false)}</span>
                                    </div>
                                    
                                    <div className="flex justify-between text-sm">
                                        <span>{t('Entries')}</span>
                                        <span>{timesheet.entries?.length || 0}</span>
                                    </div>
                                </div>
                                
                                <div className="flex gap-1 mt-4">
                                    {hasPermission(userPermissions, 'timesheet_update') && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon"
                                                    onClick={() => handleAction('edit', timesheet.id)}
                                                    className="text-gray-500 hover:text-gray-700 h-8 w-8"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>{t('Edit')}</TooltipContent>
                                        </Tooltip>
                                    )}
                                    
                                    {hasPermission(userPermissions, 'timesheet_delete') && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon"
                                                    onClick={() => handleAction('delete', timesheet.id)}
                                                    className="text-gray-500 hover:text-gray-700 h-8 w-8"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>{t('Delete')}</TooltipContent>
                                        </Tooltip>
                                    )}
                                    
                                    {hasPermission(userPermissions, 'timesheet_submit') && timesheet.status === 'draft' && (
                                        <Button 
                                            size="sm"
                                            onClick={() => handleAction('submit', timesheet.id)}
                                            className="ml-2"
                                        >
                                            {t('Submit')}
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
                )
        )}
            {/* Table View */}
            {viewMode === 'table' && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                        <CrudTable
                            columns={columns}
                            actions={actions}
                            data={timesheets?.data || []}
                            from={timesheets?.from || 1}
                            onAction={handleAction}
                            sortField={filters.sort_field}
                            sortDirection={filters.sort_direction}
                            onSort={handleSort}
                            permissions={[]}
                        />
                        {timesheets?.links && (
                                <Pagination
                                    from={timesheets?.from || 0}
                                    to={timesheets?.to || 0}
                                    total={timesheets?.total || 0}
                                    links={timesheets?.links}
                                    entityName={t('timesheets')}
                                    currentPerPage={filters.per_page?.toString() || '10'}
                                    onPerPageChange={handlePerPageChange}
                                    onPageChange={(url) => {
                                        const pageNum = new URL(url).searchParams.get('page');
                                        router.get(route('timesheets.index'), buildParams({ page: pageNum ? parseInt(pageNum) : 1 }), { preserveState: true, preserveScroll: true });
                                    }}
                                />
                        )}
                    </div>
            )}

            {/* Pagination - Cards View */}
            {viewMode === 'cards' && timesheets?.links && (
                <div className="mt-4 bg-white dark:bg-gray-800 border rounded-lg shadow overflow-hidden">
                    <Pagination
                        from={timesheets?.from || 0}
                        to={timesheets?.to || 0}
                        total={timesheets?.total || 0}
                        links={timesheets?.links}
                        entityName={t('timesheets')}
                        currentPerPage={timesheets?.per_page?.toString() || filters.per_page?.toString() || '10'}
                        onPerPageChange={handlePerPageChange}
                        onPageChange={(url) => {
                            const pageNum = new URL(url).searchParams.get('page');
                            router.get(route('timesheets.index'), buildParams({ page: pageNum ? parseInt(pageNum) : 1 }), { preserveState: true, preserveScroll: true });
                        }}
                    />
                </div>
            )}

            <TimesheetFormModal
                isOpen={isFormModalOpen}
                onClose={() => {
                    setIsFormModalOpen(false);
                    setEditingTimesheet(null);
                }}
                timesheet={editingTimesheet || undefined}
                projects={projects}
            />

            {/* Delete Modal */}
            <CrudDeleteModal
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    setIsDeleteModalOpen(false);
                    setDeletingTimesheet(null);
                }}
                onConfirm={handleDeleteConfirm}
                itemName={deletingTimesheet ? `Week of ${window.appSettings.formatDateTime(new Date(deletingTimesheet.start_date),false)}` : ''}
                entityName="timesheet"
                warningMessage="All timesheet entries and time tracking data will be permanently lost."
                additionalInfo={[
                    "All time entries for this period",
                    "Project time allocations",
                    "Billable hours records",
                    "Associated notes and descriptions"
                ]}
            />
        </PageTemplate>
    );
}