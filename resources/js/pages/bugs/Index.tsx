import React, { useState, useEffect } from 'react';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { toast } from '@/components/custom-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Bug, LayoutGrid, List, AlertTriangle, Zap, Eye, Edit, Trash2, Columns3, User, GripVertical, MessageSquare, Paperclip, Copy, Columns, CheckCircle2, Flame, Calendar, MoreHorizontal, User as UserIcon, FolderOpen } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SearchAndFilterBar } from '@/components/ui/search-and-filter-bar';
import { PageTemplate } from '@/components/page-template';
import { BugModal } from './BugModal';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { hasPermission } from '@/utils/authorization';
import { CrudDeleteModal } from '@/components/CrudDeleteModal';
import { CrudTable } from '@/components/CrudTable';
import { useTranslation } from 'react-i18next';
import { Pagination } from '@/components/ui/pagination';

interface Bug {
    id: number;
    title: string;
    description?: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    severity: 'minor' | 'major' | 'critical' | 'blocker';
    project: { id: number; name: string };
    bug_status: { id: number; name: string; color: string };
    assigned_to?: { id: number; name: string };
    reported_by: { id: number; name: string };
    created_at: string;
}

interface Props {
    bugs: { data: Bug[]; total: number; from: number; to: number; links: any[] } | Bug[];
    projects: Array<{ id: number; name: string }>;
    statuses: Array<{ id: number; name: string; color: string }>;
    members: Array<{ id: number; name: string }>;
    filters: {
        project_id?: string;
        status_id?: string;
        priority?: string;
        severity?: string;
        assigned_to?: string;
        search?: string;
        per_page?: number;
        view?: string;
        sort_field?: string;
        sort_direction?: 'asc' | 'desc';
    };
    userWorkspaceRole: string;
    project_name?: string;
    permissions?: any;
}

export default function Index({ bugs, projects, statuses, members, filters, userWorkspaceRole, project_name, permissions }: Props) {
    const { t } = useTranslation();
    const { flash, permissions: pagePermissions } = usePage().props as any;
    const bugPermissions = permissions || pagePermissions;
    
    const formatText = (text: string) => {
        if (!text) return '';
        return text.replace(/_/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
    };

    // State declarations first
    const [activeView, setActiveView] = useState(filters.view || 'kanban');
    const [searchTerm, setSearchTerm] = useState(filters.search || '');
    const [selectedProject, setSelectedProject] = useState(filters.project_id || 'all');
    const [selectedStatus, setSelectedStatus] = useState(filters.status_id || 'all');
    const [selectedPriority, setSelectedPriority] = useState(filters.priority || 'all');
    const [selectedSeverity, setSelectedSeverity] = useState(filters.severity || 'all');

    const [showBugModal, setShowBugModal] = useState(false);
    const [selectedBug, setSelectedBug] = useState<Bug | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [bugToDelete, setBugToDelete] = useState<Bug | null>(null);

    // Show flash messages
    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
        if (flash?.error) {
            toast.error(flash.error);
        }
    }, [flash]);

    const bugsData = Array.isArray(bugs) ? bugs : bugs.data;

    // Central param builder — reads per_page/sort from server `filters` prop (source of truth)
    // stateOverrides lets us pass new values before setState updates the closure
    const buildParams = (
        overrides: Record<string, any> = {},
        stateOverrides: { project?: string; status?: string; priority?: string; severity?: string; search?: string; view?: string } = {}
    ) => {
        const view     = stateOverrides.view     !== undefined ? stateOverrides.view     : activeView;
        const search   = stateOverrides.search   !== undefined ? stateOverrides.search   : searchTerm;
        const project  = stateOverrides.project  !== undefined ? stateOverrides.project  : selectedProject;
        const status   = stateOverrides.status   !== undefined ? stateOverrides.status   : selectedStatus;
        const priority = stateOverrides.priority !== undefined ? stateOverrides.priority : selectedPriority;
        const severity = stateOverrides.severity !== undefined ? stateOverrides.severity : selectedSeverity;

        const params: any = { page: 1, view };
        if (search) params.search = search;
        if (project !== 'all') params.project_id = project;
        if (status !== 'all') params.status_id = status;
        if (priority !== 'all') params.priority = priority;
        if (severity !== 'all') params.severity = severity;
        if (view !== 'kanban' && filters.per_page) params.per_page = filters.per_page;
        if (filters.sort_field) params.sort_field = filters.sort_field;
        if (filters.sort_direction) params.sort_direction = filters.sort_direction;
        if (project_name) params.project_name = project_name;
        return { ...params, ...overrides };
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        router.get(route('bugs.index'), buildParams({ page: 1 }), { preserveState: false, preserveScroll: false });
    };

    const applyFilters = () => {
        router.get(route('bugs.index'), buildParams({ page: 1 }), { preserveState: false, preserveScroll: false });
    };
    
    const hasActiveFilters = () => {
        return selectedProject !== 'all' || selectedStatus !== 'all' || selectedPriority !== 'all' || selectedSeverity !== 'all' || searchTerm !== '';
    };
    
    const activeFilterCount = () => {
        return (selectedProject !== 'all' ? 1 : 0) + (selectedStatus !== 'all' ? 1 : 0) + (selectedPriority !== 'all' ? 1 : 0) + (selectedSeverity !== 'all' ? 1 : 0) + (searchTerm ? 1 : 0);
    };
    
    const handleResetFilters = () => {
        setSelectedProject('all');
        setSelectedStatus('all');
        setSelectedPriority('all');
        setSelectedSeverity('all');
        setSearchTerm('');
        const params: any = { page: 1, view: activeView };
        if (activeView !== 'kanban' && filters.per_page) params.per_page = filters.per_page;
        if (project_name) params.project_name = project_name;
        router.get(route('bugs.index'), params, { preserveState: false, preserveScroll: false });
    };

    const getPriorityColor = (priority: string) => {
        const colors = {
            low: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20',
            medium: 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20',
            high: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20',
            critical: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20'
        };
        return colors[priority as keyof typeof colors] || colors.medium;
    };

    const getSeverityColor = (severity: string) => {
        const colors = {
            minor: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20',
            major: 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20',
            critical: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20',
            blocker: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20'
        };
        return colors[severity as keyof typeof colors] || colors.major;
    };

    const openBugModal = (bug?: Bug) => {
        setSelectedBug(bug || null);
        setShowBugModal(true);
    };

    const handleDeleteBug = (bug: Bug) => {
        setBugToDelete(bug);
        setIsDeleteModalOpen(true);
    };

    const handleDeleteConfirm = () => {
        if (bugToDelete) {
            toast.loading('Deleting bug...');
            router.delete(route('bugs.destroy', bugToDelete.id), {
                onSuccess: () => {
                    toast.dismiss();
                    setIsDeleteModalOpen(false);
                    setBugToDelete(null);
                },
                onError: () => {
                    toast.dismiss();
                    toast.error('Failed to delete bug');
                    setIsDeleteModalOpen(false);
                    setBugToDelete(null);
                }
            });
        }
    };

    const handleAssignBug = (bugId: number, assigneeId: string) => {
        const assignedUserId = assigneeId === 'unassigned' ? null : parseInt(assigneeId);
        const bug = bugsData?.find((b: any) => b.id === bugId);
        if (bug) {
            router.put(route('bugs.update', bugId), {
                title: bug.title,
                description: bug.description || '',
                priority: bug.priority,
                severity: bug.severity,
                assigned_to: assignedUserId
            });
        }
    };

    const handleStatusChange = (bugId: number, statusId: number) => {
        toast.loading('Updating bug status...');
        router.put(route('bugs.change-status', bugId), {
            bug_status_id: statusId
        }, {
            onSuccess: () => {
                toast.dismiss();
            },
            onError: () => {
                toast.dismiss();
                toast.error('Failed to update bug status');
            }
        });
    };

    const pageActions = [];
    
    if (bugPermissions?.create) {
        pageActions.push({
            label: t('Report Bug'),
            icon: <Plus className="h-4 w-4 mr-2" />,
            variant: 'default' as const,
            onClick: () => openBugModal()
        });
    }

    const breadcrumbs = project_name ? [
        { title: t('Dashboard'), href: route('dashboard') },
        { title: t('Projects'), href: route('projects.index') },
        { title: project_name },
        { title: t('Bugs') }
    ] : [
        { title: t('Dashboard'), href: route('dashboard') },
        { title: t('Bugs') }
    ];

    const handleProjectFilter = (value: string) => {
        setSelectedProject(value);
        router.get(route('bugs.index'), buildParams({ page: 1 }, { project: value }), { preserveState: false, preserveScroll: false });
    };
    
    const handleStatusFilter = (value: string) => {
        setSelectedStatus(value);
        router.get(route('bugs.index'), buildParams({ page: 1 }, { status: value }), { preserveState: false, preserveScroll: false });
    };
    
    const handlePriorityFilter = (value: string) => {
        setSelectedPriority(value);
        router.get(route('bugs.index'), buildParams({ page: 1 }, { priority: value }), { preserveState: false, preserveScroll: false });
    };
    
    const handleSeverityFilter = (value: string) => {
        setSelectedSeverity(value);
        router.get(route('bugs.index'), buildParams({ page: 1 }, { severity: value }), { preserveState: false, preserveScroll: false });
    };

    const handleSort = (field: string) => {
        const direction = filters.sort_field === field && filters.sort_direction === 'asc' ? 'desc' : 'asc';
        router.get(route('bugs.index'), buildParams({ sort_field: field, sort_direction: direction, page: 1 }), { preserveState: false, preserveScroll: false });
    };

    // Handle actions for CrudTable
    const handleAction = (action: string, bugOrId: Bug | number) => {
        let bug: Bug;
        
        if (typeof bugOrId === 'number') {
            // Called with bug ID
            bug = bugsData?.find((b: any) => b.id === bugOrId);
            if (!bug) return;
        } else {
            // Called with bug object from CrudTable
            bug = bugOrId;
        }

        switch (action) {
            case 'view':
                router.visit(route('bugs.show', bug.id));
                break;
            case 'edit':
                openBugModal(bug);
                break;
            case 'delete':
                handleDeleteBug(bug);
                break;
        }
    };

    // CrudTable configuration
    const columns = [
        {
            key: 'title',
            label: t('Bug'),
            sortable: true,
            render: (value: string, row: any) => (
                <div className="flex items-center">
                    <div>
                        <div 
                            className="text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                            onClick={() => router.visit(route('bugs.show', row.id))}
                        >
                            {value}
                        </div>
                        <div className="text-sm text-gray-500 truncate max-w-xs">{row.project?.title}</div>
                    </div>
                </div>
            )
        },
        {
            key: 'assigned_to',
            label: t('Assigned To'),
            render: (value: any) => (
                value ? (
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 rounded-full object-cover">
                            <AvatarImage src={value.avatar} />
                            <AvatarFallback className="text-xs">
                                {value.name?.charAt(0)}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <div className="font-medium">{value.name || '-'}</div>
                            <div className="text-xs text-gray-500">{value.email || ''}</div>
                        </div>
                    </div>
                ) : (
                    <span className="text-sm text-gray-500">{t('Unassigned')}</span>
                )
            )
        },
        {
            key: 'bug_status.name',
            label: t('Status'),
            render: (value: string, row: any) => (
                <span
                    className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset"
                    style={{
                        backgroundColor: row.bug_status?.color + '20',
                        color: row.bug_status?.color,
                        boxShadow: `inset 0 0 0 1px ${row.bug_status?.color}33`,
                    }}
                >
                    {formatText(value)}
                </span>
            )
        },
        {
            key: 'priority',
            label: t('Priority'),
            sortable: true,
            render: (value: string) => (
                <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${getPriorityColor(value)}`}>
                    {formatText(value)}
                </span>
            )
        },
        {
            key: 'severity',
            label: t('Severity'),
            sortable: true,
            render: (value: string) => (
                <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${getSeverityColor(value)}`}>
                    {formatText(value)}
                </span>
            )
        },
    ];

    const actions = [
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
            condition: () => bugPermissions?.update
        },
        {
            label: t('Delete'),
            icon: 'Trash2',
            action: 'delete',
            className: 'text-gray-500 hover:text-gray-700',
            condition: () => bugPermissions?.delete
        }
    ];
    
    return (
        <PageTemplate 
            title={project_name ? `${project_name} - ${t('Bugs')}` : t('Bugs')}
            description={t('Manage your bugs and their details.')} 
            url="/bugs"
            actions={pageActions}
            breadcrumbs={breadcrumbs}
            noPadding
        >
            <Head title={t('Bugs')} />
            
            {/* Overview Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                {/* Total Bugs */}
                <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-red-50 dark:bg-red-900/30 rounded-bl-full" />
                    <CardContent className="relative p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Total Bugs')}</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {Array.isArray(bugs) ? bugs.length : bugs?.total || 0}
                                </p>
                            </div>
                            <div className="relative z-10 p-2.5 bg-red-50 dark:bg-red-900/30 rounded-xl mt-0.5">
                                <Bug className="h-5 w-5 text-red-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Status Cards */}
                {statuses.slice(0, 3).map((status, index) => {
                    const iconColors = ['text-orange-600', 'text-blue-600', 'text-green-600'];
                    const bgColors = ['bg-orange-50 dark:bg-orange-900/30', 'bg-blue-50 dark:bg-blue-900/30', 'bg-green-50 dark:bg-green-900/30'];
                    const Icons = [AlertTriangle, Zap, CheckCircle2];
                    const Icon = Icons[index] || Bug;
                    return (
                        <Card key={status.id} className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                            <div className={`absolute top-0 right-0 w-20 h-20 ${bgColors[index] || 'bg-gray-50'} rounded-bl-full`} />
                            <CardContent className="relative p-5">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{status.name}</p>
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                            {bugsData?.filter((bug: any) => bug.bug_status?.id === status.id).length || 0}
                                        </p>
                                    </div>
                                    <div className={`relative z-10 p-2.5 ${bgColors[index] || 'bg-gray-50'} rounded-xl mt-0.5`}>
                                        <Icon className={`h-5 w-5 ${iconColors[index] || 'text-gray-600'}`} />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}

                {/* Critical Bugs */}
                <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-bl-full" />
                    <CardContent className="relative p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Critical')}</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {bugsData?.filter((bug: any) => bug.priority === 'critical' || bug.severity === 'blocker').length || 0}
                                </p>
                            </div>
                            <div className="relative z-10 p-2.5 bg-red-100 dark:bg-red-900/30 rounded-xl mt-0.5">
                                <Flame className="h-5 w-5 text-red-900" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Search and filters section */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow mb-4 border">
                <SearchAndFilterBar
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    onSearch={handleSearch}
                    searchPlaceholder={t('Search bugs...')}
                    filters={[
                        {
                            name: 'project_id',
                            label: t('Project'),
                            type: 'select',
                            searchable: true,
                            value: selectedProject,
                            onChange: handleProjectFilter,
                            options: [
                                { value: 'all', label: t('All Projects') },
                                ...projects.map((p) => ({ value: p.id.toString(), label: p.title }))
                            ]
                        },
                        {
                            name: 'status_id',
                            label: t('Status'),
                            type: 'select',
                            value: selectedStatus,
                            onChange: handleStatusFilter,
                            options: [
                                { value: 'all', label: t('All Statuses') },
                                ...statuses.map((s) => ({ value: s.id.toString(), label: s.name }))
                            ]
                        },
                        {
                            name: 'priority',
                            label: t('Priority'),
                            type: 'select',
                            value: selectedPriority,
                            onChange: handlePriorityFilter,
                            options: [
                                { value: 'all', label: t('All Priorities') },
                                { value: 'low', label: t('Low') },
                                { value: 'medium', label: t('Medium') },
                                { value: 'high', label: t('High') },
                                { value: 'critical', label: t('Critical') },
                            ]
                        },
                        {
                            name: 'severity',
                            label: t('Severity'),
                            type: 'select',
                            value: selectedSeverity,
                            onChange: handleSeverityFilter,
                            options: [
                                { value: 'all', label: t('All Severities') },
                                { value: 'minor', label: t('Minor') },
                                { value: 'major', label: t('Major') },
                                { value: 'critical', label: t('Critical') },
                                { value: 'blocker', label: t('Blocker') },
                            ]
                        },
                    ]}
                    hasActiveFilters={hasActiveFilters}
                    activeFilterCount={activeFilterCount}
                    onResetFilters={handleResetFilters}
                    showViewToggle={true}
                    activeView={activeView}
                    onViewChange={(view) => {
                        setActiveView(view);
                        router.get(route('bugs.index'), buildParams({ page: 1, view }, { view }), { preserveState: false, preserveScroll: false });
                    }}
                    viewOptions={[
                        { value: 'kanban', label: t('Kanban'), icon: 'Columns' },
                        // { value: 'grid', label: t('Grid'), icon: 'Grid3X3' }, // Grid view disabled
                        { value: 'list', label: t('List'), icon: 'List' },
                    ]}
                />
            </div>
            
            {/* Bug Content */}
            {activeView === 'kanban' ? (
                <div className="bg-slate-50 dark:bg-gray-900 rounded-lg" style={{ height: 'calc(100vh - 280px)', overflow: 'hidden' }}>
                    <style>{`
                        .kanban-scroll::-webkit-scrollbar {
                                height: 6px;
                            }
                        .kanban-scroll::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
                        .kanban-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
                        .kanban-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
                        .bug-column-scroll::-webkit-scrollbar { width: 4px; }
                        .bug-column-scroll::-webkit-scrollbar-track { background: transparent; }
                        .bug-column-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
                        .bug-column-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
                        main { overflow: hidden; }
                        .dark .bug-kanban-column {
                            background-color: rgb(17 24 39 / 0.95) !important;
                            border-color: rgb(55 65 81) !important;
                        }
                        .dark .bug-kanban-column-header {
                            border-bottom-color: rgb(55 65 81) !important;
                        }
                        .dark .bug-kanban-card {
                            background-color: #000000 !important;
                            border-color: rgb(55 65 81) !important;
                        }
                    `}</style>
                    <div className="flex gap-4 overflow-x-auto pb-4 kanban-scroll" style={{ height: '100%' }}>
                        {statuses.map((status) => {
                            const statusBugs = bugsData?.filter((bug: any) => bug.bug_status?.id === status.id) || [];
                            return (
                                <div 
                                    key={status.id} 
                                    className="flex-shrink-0"
                                    style={{ minWidth: '300px', width: 'calc(20% - 13px)' }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        e.currentTarget.classList.remove('bg-blue-50', 'border-blue-300');
                                        const bugId = e.dataTransfer.getData('bugId');
                                        const currentStatusId = e.dataTransfer.getData('currentStatusId');
                                        if (bugId && currentStatusId !== status.id.toString()) {
                                            handleStatusChange(parseInt(bugId), status.id);
                                        }
                                    }}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        e.currentTarget.classList.add('bg-blue-50', 'border-blue-300');
                                    }}
                                    onDragLeave={(e) => {
                                        e.currentTarget.classList.remove('bg-blue-50', 'border-blue-300');
                                    }}
                                >
                                    <div className="bug-kanban-column rounded-xl h-full flex flex-col border" style={{ backgroundColor: status.color + '12', borderColor: status.color + '30' }}>
                                        <div className="bug-kanban-column-header px-4 py-3 rounded-t-xl border-b" style={{ borderBottomColor: status.color + '30' }}>
                                            <div className="flex items-center gap-2">
                                                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: status.color }} />
                                                <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-100">{status.name}</h3>
                                                <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: status.color + '25', color: status.color }}>
                                                    {statusBugs.length}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="p-2 space-y-2 overflow-y-auto flex-1 bug-column-scroll">
                                            {statusBugs.map((bug: any) => (
                                                <div
                                                    key={bug.id}
                                                    draggable
                                                    onDragStart={(e) => {
                                                        e.dataTransfer.setData('bugId', bug.id.toString());
                                                        e.dataTransfer.setData('currentStatusId', status.id.toString());
                                                        e.currentTarget.classList.add('opacity-50', 'scale-95');
                                                    }}
                                                    onDragEnd={(e) => {
                                                        e.currentTarget.classList.remove('opacity-50', 'scale-95');
                                                    }}
                                                    className="cursor-move transition-all duration-200"
                                                >
                                                    <Card className="bug-kanban-card hover:shadow-md transition-all duration-200 shadow-sm bg-white dark:bg-[#1a1f2e] border-gray-200 dark:border-gray-700">
                                                        <CardContent className="p-3">
                                                            <div className="space-y-2">
                                                                {/* Title + dropdown */}
                                                                <div className="flex items-start justify-between gap-1">
                                                                    <h4
                                                                        className="font-semibold text-sm hover:text-blue-600 transition-colors cursor-pointer leading-snug flex-1"
                                                                        onClick={(e) => { e.stopPropagation(); router.visit(route('bugs.show', bug.id)); }}
                                                                    >
                                                                        {bug.title}
                                                                    </h4>
                                                                    <DropdownMenu>
                                                                        <DropdownMenuTrigger asChild>
                                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-gray-600 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                                                                <MoreHorizontal className="h-3.5 w-3.5" />
                                                                            </Button>
                                                                        </DropdownMenuTrigger>
                                                                        <DropdownMenuContent align="end" className="w-36">
                                                                            <DropdownMenuItem onClick={() => router.visit(route('bugs.show', bug.id))}>
                                                                                <Eye className="h-3.5 w-3.5 mr-2" />{t('View')}
                                                                            </DropdownMenuItem>
                                                                            <DropdownMenuItem onClick={() => openBugModal(bug)}>
                                                                                <Edit className="h-3.5 w-3.5 mr-2" />{t('Edit')}
                                                                            </DropdownMenuItem>
                                                                            {bugPermissions?.delete && (
                                                                                <>
                                                                                    <DropdownMenuSeparator />
                                                                                    <DropdownMenuItem onClick={() => handleDeleteBug(bug)} className="text-red-600">
                                                                                        <Trash2 className="h-3.5 w-3.5 mr-2" />{t('Delete')}
                                                                                    </DropdownMenuItem>
                                                                                </>
                                                                            )}
                                                                        </DropdownMenuContent>
                                                                    </DropdownMenu>
                                                                </div>

                                                                <div className="flex items-center justify-between">
                                                                {/* Project title */}
                                                                {bug.project?.title && (
                                                                <div className="flex items-center gap-1">
                                                                    <FolderOpen className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                                                                    <p className="text-xs text-gray-500 dark:text-gray-400">{bug.project.title}</p>
                                                                    </div>
                                                                )}

                                                                {bug.created_at && (
                                                                <div className="flex items-center gap-1">
                                                                    <Calendar className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                                                                    <span className="text-xs text-gray-500 dark:text-gray-400">{bug.created_at ? window.appSettings.formatDateTime(new Date(bug.created_at), false) : '-'}</span>
                                                                    </div>
                                                                )}
                                                                </div>
                                                                {/* Priority + Severity */}
                                                                <div className="flex items-center justify-between">
                                                                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${getPriorityColor(bug.priority)}`}>
                                                                        {formatText(bug.priority)}
                                                                    </span>
                                                                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${getSeverityColor(bug.severity)}`}>
                                                                        {formatText(bug.severity)}
                                                                    </span>
                                                                </div>

                                                                {/* Footer: assignee right + comments/attachments left */}
                                                                <div className="flex items-center justify-between pt-3 pb-0 border-t border-gray-100 dark:border-gray-700">
                                                                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                                                                        {bug.comments_count > 0 && (
                                                                            <div className="flex items-center gap-1">
                                                                                <MessageSquare className="h-3 w-3" />
                                                                                <span>{bug.comments_count}</span>
                                                                            </div>
                                                                        )}
                                                                        {bug.attachments_count > 0 && (
                                                                            <div className="flex items-center gap-1">
                                                                                <Paperclip className="h-3 w-3" />
                                                                                <span>{bug.attachments_count}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                        {bug.assigned_to ? (
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <Avatar className="h-8 w-8 cursor-pointer">
                                                                                    <AvatarImage src={bug.assigned_to.avatar} />
                                                                                    <AvatarFallback className="text-xs">{bug.assigned_to.name?.charAt(0)}</AvatarFallback>
                                                                                </Avatar>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent>{bug.assigned_to.name}</TooltipContent>
                                                                        </Tooltip>
                                                                    ) : (
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                                                                                    <UserIcon className="h-3.5 w-3.5 text-gray-400" />
                                                                                </div>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent>{t('Unassigned')}</TooltipContent>
                                                                        </Tooltip>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                </div>
                                            ))}
                                            {statusBugs.length === 0 && (
                                                <div className="flex flex-col items-center pt-10">
                                                    <div className="w-14 h-14 rounded-full border-2 border-dashed border-gray-200 flex items-center justify-center mb-3">
                                                        <UserIcon className="h-7 w-7 text-gray-200" />
                                                    </div>
                                                    <p className="text-xs text-gray-400">{t('Drop bugs here')}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (/* grid view disabled */ activeView === 'grid' ? null : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <CrudTable
                        columns={columns}
                        actions={actions}
                        data={bugsData || []}
                        from={Array.isArray(bugs) ? 1 : bugs?.from || 1}
                        onAction={handleAction}
                        sortField={filters.sort_field}
                        sortDirection={filters.sort_direction}
                        onSort={handleSort}
                        permissions={[]}
                    />
                    {!Array.isArray(bugs) && bugs?.links && (
                                <Pagination
                                    from={bugs?.from || 0}
                                    to={bugs?.to || 0}
                                    total={bugs?.total || 0}
                                    links={bugs?.links}
                                    entityName={t('bugs')}
                                    onPageChange={(url) => {
                                        const pageNum = new URL(url).searchParams.get('page');
                                        router.get(route('bugs.index'), buildParams({ page: pageNum ? parseInt(pageNum) : 1 }), { preserveState: true, preserveScroll: true });
                                    }}
                                    currentPerPage={bugs?.per_page?.toString() || '10'}
                                    onPerPageChange={(value) => {
                                        router.get(route('bugs.index'), buildParams({ page: 1, per_page: parseInt(value) }), { preserveState: true, preserveScroll: true });
                                    }}
                                />
                            )}
                </div>
                ))}            
            {/* Pagination - For grid view - disabled */}
            {/* {activeView === 'grid' && !Array.isArray(bugs) && bugs?.links && (
                <div className="mt-4 bg-white dark:bg-gray-800 border rounded-lg shadow overflow-hidden">
                    <Pagination
                        from={bugs?.from || 0}
                        to={bugs?.to || 0}
                        total={bugs?.total || 0}
                        links={bugs?.links}
                        entityName={t('bugs')}
                        onPageChange={(url) => {
                            const pageNum = new URL(url).searchParams.get('page');
                            router.get(route('bugs.index'), buildParams({ page: pageNum ? parseInt(pageNum) : 1 }), { preserveState: true, preserveScroll: true });
                        }}
                        currentPerPage={bugs?.per_page?.toString() || '10'}
                        onPerPageChange={(value) => {
                            router.get(route('bugs.index'), buildParams({ page: 1, per_page: parseInt(value) }), { preserveState: true, preserveScroll: true });
                        }}
                    />
                </div>
            )} */}

            {/* Bug Modal */}
            {showBugModal && (
                <BugModal
                    bug={selectedBug}
                    projects={projects}
                    statuses={statuses}
                    members={members}
                    onClose={() => setShowBugModal(false)}
                    permissions={bugPermissions}
                />
            )}

            {/* Delete Modal */}
            <CrudDeleteModal
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    setIsDeleteModalOpen(false);
                    setBugToDelete(null);
                }}
                onConfirm={handleDeleteConfirm}
                itemName={bugToDelete?.title || ''}
                entityName="bug"
            />
        </PageTemplate>
    );
}