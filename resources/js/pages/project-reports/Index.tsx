import { useState, useEffect } from 'react';
import { router, usePage } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { SearchAndFilterBar } from '@/components/ui/search-and-filter-bar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Eye, Edit, FolderOpen, CheckCircle, PauseCircle, Zap, BarChart2, Calendar } from 'lucide-react';
import { PageTemplate } from '@/components/page-template';
import { CrudFormModal } from '@/components/CrudFormModal';
import { CrudTable } from '@/components/CrudTable';
import { hasPermission } from '@/utils/authorization';
import { useTranslation } from 'react-i18next';

export default function ProjectReportsIndex() {
    const { t } = useTranslation();
    const { auth, projects, users, filters: pageFilters = {} } = usePage().props as any;
    const permissions = auth?.permissions || [];
    
    const formatText = (text: string) => {
        return text.replace(/_/g, ' ').split(' ').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
    };
    
    const [searchTerm, setSearchTerm] = useState(pageFilters.search || '');
    const [selectedStatus, setSelectedStatus] = useState(pageFilters.status || 'all');
    const [selectedUser, setSelectedUser] = useState(pageFilters.user_id || 'all');
    const [deadlineFrom, setDeadlineFrom] = useState(pageFilters.deadline_from || '');
    const [deadlineTo, setDeadlineTo] = useState(pageFilters.deadline_to || '');
    const [startFrom, setStartFrom] = useState(pageFilters.start_from || '');
    const [startTo, setStartTo] = useState(pageFilters.start_to || '');
    const [milestoneSearch, setMilestoneSearch] = useState(pageFilters.milestone_search || '');
    const [showDateFilters, setShowDateFilters] = useState(!!(pageFilters.deadline_from || pageFilters.deadline_to || pageFilters.start_from || pageFilters.start_to));
    const [showFilters, setShowFilters] = useState(false);
    const [pageInitialState, setPageInitialState] = useState(true);

    useEffect(() => {
        if (!pageInitialState) applyFilters();
        setPageInitialState(false);
    }, [selectedStatus, selectedUser]);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [currentProject, setCurrentProject] = useState<any>(null);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        router.get(route('project-reports.index'), buildParams(), { preserveState: false, preserveScroll: false });
    };
    
    const buildParams = (overrides: Record<string, any> = {}) => {
        const params: any = { page: 1 };
        if (searchTerm) params.search = searchTerm;
        if (selectedStatus !== 'all') params.status = selectedStatus;
        if (selectedUser !== 'all') params.user_id = selectedUser;
        if (deadlineFrom) params.deadline_from = deadlineFrom;
        if (deadlineTo) params.deadline_to = deadlineTo;
        if (startFrom) params.start_from = startFrom;
        if (startTo) params.start_to = startTo;
        if (milestoneSearch) params.milestone_search = milestoneSearch;
        if (pageFilters.per_page) params.per_page = pageFilters.per_page;
        if (pageFilters.sort_by) params.sort_by = pageFilters.sort_by;
        if (pageFilters.sort_order) params.sort_order = pageFilters.sort_order;
        return { ...params, ...overrides };
    };

    const applyFilters = () => {
        router.get(route('project-reports.index'), buildParams(), { preserveState: false, preserveScroll: false });
    };
    
    const handleSort = (field: string) => {
        const direction = pageFilters.sort_by === field && pageFilters.sort_order === 'asc' ? 'desc' : 'asc';
        router.get(route('project-reports.index'), buildParams({ sort_by: field, sort_order: direction, page: 1 }), { preserveState: true, preserveScroll: true });
    };
    
    const handleStatusFilter = (value: string) => {
        setSelectedStatus(value);
        router.get(route('project-reports.index'), buildParams({ status: value !== 'all' ? value : undefined, page: 1 }), { preserveState: false, preserveScroll: false });
    };
    
    const handleUserFilter = (value: string) => {
        setSelectedUser(value);
        router.get(route('project-reports.index'), buildParams({ user_id: value !== 'all' ? value : undefined, page: 1 }), { preserveState: false, preserveScroll: false });
    };
    
    const hasActiveFilters = () => {
        return selectedStatus !== 'all' || selectedUser !== 'all' || searchTerm !== '';
    };
    
    const activeFilterCount = () => {
        return (selectedStatus !== 'all' ? 1 : 0) + (selectedUser !== 'all' ? 1 : 0) + (searchTerm ? 1 : 0)
            + (deadlineFrom ? 1 : 0) + (deadlineTo ? 1 : 0) + (startFrom ? 1 : 0) + (startTo ? 1 : 0) + (milestoneSearch ? 1 : 0);
    };
    
    const handleResetFilters = () => {
        setSelectedStatus('all');
        setSelectedUser('all');
        setSearchTerm('');
        setDeadlineFrom('');
        setDeadlineTo('');
        setStartFrom('');
        setStartTo('');
        setMilestoneSearch('');
        router.get(route('project-reports.index'), { page: 1 }, { preserveState: false, preserveScroll: false });
    };
    
    // Handle actions for CrudTable
    const handleAction = (action: string, project: any) => {
        switch (action) {
            case 'view':
                router.get(route('project-reports.show', project.id));
                break;
            case 'edit':
                handleEditProject(project);
                break;
        }
    };
    
    const handleEditProject = (project: any) => {
        setCurrentProject(project);
        setIsEditModalOpen(true);
    };
    
    const handleFormSubmit = (formData: any) => {
        router.put(route('projects.update', currentProject.id), formData, {
            onSuccess: () => {
                setIsEditModalOpen(false);
                router.reload();
            }
        });
    };

    const getStatusColor = (status: string) => {
        const colors = {
            'active': 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20',
            'planning': 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20',
            'on_hold': 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20',
            'completed': 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20',
            'cancelled': 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20'
        };
        return colors[status as keyof typeof colors] || 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20';
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? '-' : window.appSettings.formatDateTime(new Date(date),false);
    };
    
    const getRoleColor = (role: string) => {
        const colors = {
            'owner': 'bg-purple-500',
            'manager': 'bg-blue-500', 
            'member': 'bg-green-500',
            'client': 'bg-orange-500'
        };
        return colors[role as keyof typeof colors] || 'bg-gray-500';
    };
    
    // CrudTable configuration
    const columns = [
        {
            key: 'title',
            label: t('Project'),
            sortable: true,
            render: (value: string, row: any) => (
                <div>
                    <div className="text-sm font-medium text-gray-900">
                        {value || row.name}
                    </div>
                    <div className="text-sm text-gray-500 truncate max-w-xs">{row.description}</div>
                </div>
            )
        },
        {
            key: 'start_date',
            label: t('Start Date'),
            sortable: true,
            render: (value: string) => (
                <div className="flex items-center gap-1.5 text-sm whitespace-nowrap text-gray-500">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-sm">{value ? formatDate(value) : '-'}</span>
                </div>
            )
        },
        {
            key: 'deadline',
            label: t('Due Date'),
            sortable: true,
            render: (value: string, row: any) => (
                <div className="flex items-center gap-1.5 text-sm whitespace-nowrap text-gray-500">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-sm">{formatDate(row.deadline || row.end_date) || '-'}</span>
                </div>
            )
        },

        {
            key: 'members',
            label: t('Members'),
            render: (value: any[], row: any) => {
                const allMembers = [...row.members || [], ...row.clients || []];
                if (allMembers.length === 0) return <span className="text-sm text-gray-500">-</span>;
                
                return (
                    <div className="flex -space-x-1">
                        {allMembers.slice(0, 3).map((member: any, index: number) => {
                            const isClient = row.clients?.some((c: any) => c.id === member.id);
                            const role = isClient ? 'client' : (member.role || 'member');
                            const name = isClient ? (member.name || '?') : (member.user?.name || '?');
                            const avatar = isClient ? member.avatar : member.user?.avatar;
                            return (
                                <Tooltip key={index}>
                                    <TooltipTrigger asChild>
                                        <Avatar className="h-6 w-6 border-2 border-white cursor-pointer">
                                            <AvatarImage src={avatar} />
                                            <AvatarFallback className={`text-[10px] font-semibold text-white ${getRoleColor(role)}`}>
                                                {name.charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <div className="text-center">
                                            <div>{name}</div>
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            );
                        })}
                        {allMembers.length > 3 && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="h-6 w-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs cursor-pointer">
                                        +{allMembers.length - 3}
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    {allMembers.slice(3).map((m: any) => {
                                            const isCl = row.clients?.some((c: any) => c.id === m.id);
                                            return isCl ? m.name : m.user?.name;
                                        }).join(', ')}
                                </TooltipContent>
                            </Tooltip>
                        )}
                    </div>
                );
            }
        },
        {
            key: 'progress',
            label: t('Progress'),
            render: (value: number, row: any) => {
                const progress = value || row.progress_percentage || 0;
                return (
                    <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-1.5 mr-2">
                            <div className={`h-1.5 rounded-full bg-primary`} style={{width: `${progress}%`}}></div>
                        </div>
                        <span className="text-sm text-gray-900">{progress}%</span>
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
        }
    ];

    const actions = [
        {
            label: t('View'),
            icon: 'Eye',
            action: 'view',
            className: 'text-gray-500 hover:text-gray-700',
            condition: () => hasPermission(permissions, 'project_report_view')
        },
        {
            label: t('Edit'),
            icon: 'Edit',
            action: 'edit',
            className: 'text-gray-500 hover:text-gray-700',
            condition: () => hasPermission(permissions, 'project_update')
        }
    ];
    
    const breadcrumbs = [
        { title: t('Dashboard'), href: route('dashboard') },
        { title: t('Project Reports') }
    ];

    return (
        <PageTemplate 
            title={t('Project Reports')} 
            description={t('Manage your project reports and their details.')}
            url="/project-reports"
            actions={[]}
            breadcrumbs={breadcrumbs}
            noPadding
        >
            {/* Search and filters section */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow mb-4 border">
                <SearchAndFilterBar
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    onSearch={handleSearch}
                    searchPlaceholder={t('Search projects...')}
                    filters={[
                        {
                            name: 'status',
                            label: t('Status'),
                            type: 'select',
                            value: selectedStatus,
                            onChange: handleStatusFilter,
                            options: [
                                { value: 'all', label: t('All Status') },
                                { value: 'planning', label: t('Planning') },
                                { value: 'active', label: t('Active') },
                                { value: 'on_hold', label: t('On Hold') },
                                { value: 'completed', label: t('Completed') },
                                { value: 'cancelled', label: t('Cancelled') },
                            ]
                        },
                        {
                            name: 'user_id',
                            label: t('User'),
                            type: 'select',
                            searchable: true,
                            value: selectedUser,
                            onChange: handleUserFilter,
                            options: [
                                { value: 'all', label: t('All Users') },
                                ...(users?.map((user: any) => ({ value: user.id.toString(), label: user.name })) || [])
                            ]
                        },
                    ]}
                    hasActiveFilters={hasActiveFilters}
                    activeFilterCount={activeFilterCount}
                    onResetFilters={handleResetFilters}
                />
                {/* Date range & milestone filters */}
                <div className="px-4 pb-3 border-t pt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-muted-foreground">{t('Start From')}</span>
                        <input type="date" value={startFrom} onChange={e => setStartFrom(e.target.value)}
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-muted-foreground">{t('Start To')}</span>
                        <input type="date" value={startTo} onChange={e => setStartTo(e.target.value)}
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-muted-foreground">{t('Deadline From')}</span>
                        <input type="date" value={deadlineFrom} onChange={e => setDeadlineFrom(e.target.value)}
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-muted-foreground">{t('Deadline To')}</span>
                        <input type="date" value={deadlineTo} onChange={e => setDeadlineTo(e.target.value)}
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-muted-foreground">{t('Milestone Contains')}</span>
                        <input type="text" value={milestoneSearch} onChange={e => setMilestoneSearch(e.target.value)}
                            placeholder={t('e.g. Phase 1')}
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs" />
                    </div>
                    <button onClick={() => router.get(route('project-reports.index'), buildParams(), { preserveState: false })}
                        className="self-end h-8 px-3 rounded-md text-xs font-medium text-white col-span-full sm:col-span-1"
                        style={{ background: '#E3B448', color: '#001a4d' }}>
                        {t('Apply Date Filters')}
                    </button>
                </div>
            </div>

            {/* Projects Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <CrudTable
                    columns={columns}
                    actions={actions}
                    data={projects?.data || []}
                    from={projects?.from || 1}
                    onAction={handleAction}
                    sortField={pageFilters.sort_by}
                    sortDirection={pageFilters.sort_order}
                    onSort={handleSort}
                    permissions={permissions}
                />
                {projects?.links && (
                    <Pagination
                        from={projects?.from || 0}
                        to={projects?.to || 0}
                        total={projects?.total || 0}
                        links={projects?.links}
                        entityName={t('projects')}
                        onPageChange={(url) => {
                            const pageNum = new URL(url).searchParams.get('page');
                            router.get(route('project-reports.index'), buildParams({ page: pageNum ? parseInt(pageNum) : 1 }), { preserveState: false, preserveScroll: false });
                        }}
                        currentPerPage={projects?.per_page?.toString() || pageFilters.per_page?.toString() || '10'}
                        onPerPageChange={(value) => {
                            router.get(route('project-reports.index'), buildParams({ page: 1, per_page: parseInt(value) }), { preserveState: false, preserveScroll: false });
                        }}
                    />
                )}
            </div>
            
            {/* Edit Project Modal */}
            <CrudFormModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSubmit={handleFormSubmit}
                formConfig={{
                    fields: [
                        { name: 'title', label: t('Project Title'), type: 'text', required: true, placeholder: t('Enter project title') },
                        { name: 'description', label: t('Description'), type: 'textarea', placeholder: t('Enter project description') },
                        { 
                            name: 'status', 
                            label: t('Status'), 
                            type: 'select',
                            required: true,
                            placeholder: t('Select status'),
                            options: [
                                { value: 'planning', label: t('Planning') },
                                { value: 'active', label: t('Active') },
                                { value: 'on_hold', label: t('On Hold') },
                                { value: 'completed', label: t('Completed') },
                                { value: 'cancelled', label: t('Cancelled') }
                            ]
                        },
                        { 
                            name: 'priority', 
                            label: t('Priority'), 
                            type: 'select',
                            required: true,
                            placeholder: t('Select priority'),
                            options: [
                                { value: 'low', label: t('Low') },
                                { value: 'medium', label: t('Medium') },
                                { value: 'high', label: t('High') },
                                { value: 'urgent', label: t('Urgent') }
                            ]
                        },
                        { name: 'start_date', label: t('Start Date'), type: 'date', required:true, placeholder: t('Select start date') },
                        { name: 'deadline', label: t('Deadline'), type: 'date', required:true, placeholder: t('Select deadline') },
                        { name: 'estimated_hours', label: t('Estimated Hours'), type: 'number', min: 0, placeholder: t('Enter estimated hours') },
                        { name: 'is_public', label: t('Make project public'), type: 'checkbox' }
                    ],
                    modalSize: 'xl'
                }}
                initialData={currentProject}
                title={t('Edit Project')}
                mode="edit"
            />
        </PageTemplate>
    );
}