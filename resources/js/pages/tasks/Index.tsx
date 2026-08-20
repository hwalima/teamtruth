import React, { useState, useEffect } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { Pagination } from '@/components/ui/pagination';
import TaskModal from './TaskModal';
import TaskView from './TaskView';
import { Dialog } from '@/components/ui/dialog';
import TaskFormModal from '@/components/tasks/TaskFormModal';
import TaskPriority from '@/components/tasks/TaskPriority';
import TaskStageChanger from '@/components/tasks/TaskStageChanger';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, MoreHorizontal, Eye, Edit, Copy, Trash2, LayoutGrid, List, User as UserIcon, CheckSquare, Columns, AlertTriangle, Clock, UserCheck, UserMinus, ListTodo, Flame, Calendar } from 'lucide-react';
import { SearchAndFilterBar } from '@/components/ui/search-and-filter-bar';
import { PageTemplate } from '@/components/page-template';
import { CrudDeleteModal } from '@/components/CrudDeleteModal';
import { Task, Project, TaskStage, User, PaginatedData } from '@/types';
import { toast } from '@/components/custom-toast';
import { CrudTable } from '@/components/CrudTable';
import { useTranslation } from 'react-i18next';

interface Props {
    tasks: PaginatedData<Task>;
    projects: Project[];
    stages: TaskStage[];
    members: User[];
    filters: {
        project_id?: string;
        stage_id?: string;
        priority?: string;
        assigned_to?: string;
        search?: string;
        view?: 'kanban' | 'grid' | 'list';
        sort_field?: string;
        sort_direction?: 'asc' | 'desc';
    };
    project_name?: string;
    userWorkspaceRole?: string;
    permissions?: any;
    googleCalendarEnabled?: boolean;
}

export default function TasksIndex({ tasks, projects, stages, members, filters, project_name, userWorkspaceRole, permissions, googleCalendarEnabled }: Props) {
    const { t } = useTranslation();
    const { flash, permissions: pagePermissions } = usePage().props as any;
    const taskPermissions = permissions || pagePermissions;
    const [searchTerm, setSearchTerm] = useState(filters.search || '');
    const [selectedProject, setSelectedProject] = useState(filters.project_id || 'all');
    const [selectedStage, setSelectedStage] = useState(filters.stage_id || 'all');
    const [selectedPriority, setSelectedPriority] = useState(filters.priority || 'all');
    const [selectedAssignee, setSelectedAssignee] = useState(filters.assigned_to || 'all');

    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [selectedTaskWorkspaceRole, setSelectedTaskWorkspaceRole] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [viewActiveTab, setViewActiveTab] = useState('details');
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    // Map API view values (grid, list) to local UI state values (card, table)
    const initialViewMode = () => {
        if (filters.view === 'grid') return 'card';
        if (filters.view === 'list') return 'table';
        return filters.view || 'kanban';
    };
    
    const [viewMode, setViewMode] = useState<'card' | 'table' | 'kanban'>(initialViewMode);
    
    // Helper to map UI state back to API-expected view values
    const getApiView = (mode: 'card' | 'table' | 'kanban' = viewMode) => {
        if (mode === 'card') return 'grid';
        if (mode === 'table') return 'list';
        return mode;
    };
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

    // Show flash messages
    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
        if (flash?.error) {
            toast.error(flash.error);
        }
    }, [flash]);

    // Central param builder — reads per_page/sort from server `filters` prop (source of truth)
    // Pass overrides to replace specific values (e.g. new page, new sort, new view)
    // Pass stateOverrides to replace filter state values before they update via setState
    const buildParams = (
        overrides: Record<string, any> = {},
        stateOverrides: { project?: string; stage?: string; priority?: string; assignee?: string; search?: string; apiView?: string } = {}
    ) => {
        const search   = stateOverrides.search   !== undefined ? stateOverrides.search   : searchTerm;
        const project  = stateOverrides.project  !== undefined ? stateOverrides.project  : selectedProject;
        const stage    = stateOverrides.stage    !== undefined ? stateOverrides.stage    : selectedStage;
        const priority = stateOverrides.priority !== undefined ? stateOverrides.priority : selectedPriority;
        const assignee = stateOverrides.assignee !== undefined ? stateOverrides.assignee : selectedAssignee;
        const apiView  = stateOverrides.apiView  !== undefined ? stateOverrides.apiView  : getApiView();

        const params: any = { page: 1, view: apiView };
        if (search) params.search = search;
        if (project !== 'all') params.project_id = project;
        if (stage !== 'all') params.stage_id = stage;
        if (priority !== 'all') params.priority = priority;
        if (assignee !== 'all') params.assigned_to = assignee;
        if (filters.per_page) params.per_page = filters.per_page;
        if (filters.sort_field) params.sort_field = filters.sort_field;
        if (filters.sort_direction) params.sort_direction = filters.sort_direction;
        if (project_name) params.project_name = project_name;
        return { ...params, ...overrides };
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        router.get(route('tasks.index'), buildParams({ page: 1 }), { preserveState: true, preserveScroll: true });
    };

    const applyFilters = () => {
        router.get(route('tasks.index'), buildParams({ page: 1 }), { preserveState: true, preserveScroll: true });
    };

    const handleFilter = (key: string, value: string) => {
        if (key === 'project_id') setSelectedProject(value);
        if (key === 'stage_id') setSelectedStage(value);
        if (key === 'priority') setSelectedPriority(value);
        if (key === 'assigned_to') setSelectedAssignee(value);

        // Pass new value directly via stateOverrides — don't rely on setState having updated yet
        router.get(route('tasks.index'), buildParams({ page: 1 }, {
            project:  key === 'project_id'  ? value : undefined,
            stage:    key === 'stage_id'    ? value : undefined,
            priority: key === 'priority'    ? value : undefined,
            assignee: key === 'assigned_to' ? value : undefined,
        }), { preserveState: true, preserveScroll: true });
    };

    const handleAction = (action: string, taskOrId: Task | number) => {
        let taskId: number;

        if (typeof taskOrId === 'number') {
            // Called with task ID
            taskId = taskOrId;
        } else {
            // Called with task object from CrudTable
            taskId = taskOrId.id;
        }

        switch (action) {
            case 'view':
                handleViewTask(taskId);
                break;
            case 'edit':
                handleEditTask(taskId);
                break;
            case 'duplicate':
                toast.loading('Duplicating task...');
                router.post(route('tasks.duplicate', taskId), {}, {
                    onSuccess: () => {
                        toast.dismiss();
                    },
                    onError: () => {
                        toast.dismiss();
                        toast.error('Failed to duplicate task');
                    }
                });
                break;
            case 'delete':
                const task = (Array.isArray(tasks) ? tasks : tasks?.data || []).find(t => t.id === taskId);
                if (task) {
                    setTaskToDelete(task);
                    setIsDeleteModalOpen(true);
                }
                break;
        }
    };

    const handleViewTask = async (taskId: number) => {
        router.visit(route('tasks.show', taskId));
    };

    const handleEditTask = async (taskId: number) => {
        try {
            const response = await fetch(route('tasks.show', taskId), {
                headers: { 'Accept': 'application/json' }
            });
            const data = await response.json();

            const taskWithProject = {
                ...data.task,
                project: projects.find(p => p.id === data.task.project_id) || data.task.project
            };

            setEditingTask(taskWithProject);
            setIsFormModalOpen(true);
        } catch (error) {
            console.error('Failed to load task:', error);
        }
    };

    const hasActiveFilters = () => {
        return selectedProject !== 'all' || selectedStage !== 'all' || selectedPriority !== 'all' || selectedAssignee !== 'all' || searchTerm !== '';
    };

    const activeFilterCount = () => {
        return (selectedProject !== 'all' ? 1 : 0) + (selectedStage !== 'all' ? 1 : 0) + (selectedPriority !== 'all' ? 1 : 0) + (selectedAssignee !== 'all' ? 1 : 0) + (searchTerm ? 1 : 0);
    };

    const handleResetFilters = () => {
        setSelectedProject('all');
        setSelectedStage('all');
        setSelectedPriority('all');
        setSelectedAssignee('all');
        setSearchTerm('');
        const params: any = { page: 1, view: getApiView() };
        if (filters.per_page) params.per_page = filters.per_page;
        if (project_name) params.project_name = project_name;
        router.get(route('tasks.index'), params, { preserveState: true, preserveScroll: true });
    };

    const handleDeleteConfirm = () => {
        if (taskToDelete) {
            toast.loading('Deleting task...');
            router.delete(route('tasks.destroy', taskToDelete.id), {
                onSuccess: () => {
                    toast.dismiss();
                    setIsDeleteModalOpen(false);
                    setTaskToDelete(null);
                },
                onError: () => {
                    toast.dismiss();
                    toast.error('Failed to delete task');
                    setIsDeleteModalOpen(false);
                    setTaskToDelete(null);
                }
            });
        }
    };

    const isTaskOverdue = (endDate: string | null | undefined, progress: number) => {
        if (!endDate || progress >= 100) return false;
        return new Date(endDate) < new Date();
    };

    const getPriorityColor = (priority: string) => {
        const colors = {
            low: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20',
            medium: 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20',
            high: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20',
            critical: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20'
        };
        return colors[priority as keyof typeof colors] || 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20';
    };

    const pageActions = [];

    // Only show Create Task button for non-clients
    if (userWorkspaceRole !== 'client') {
        pageActions.push({
            label: t('Create Task'),
            icon: <Plus className="h-4 w-4 mr-2" />,
            variant: 'default',
            onClick: () => {
                setEditingTask(null);
                setIsFormModalOpen(true);
            }
        });
    }

    const breadcrumbs = [
        { title: t('Dashboard'), href: route('dashboard') },
        ...(project_name ? [{ title: t('Projects'), href: route('projects.index') }] : []),
        { title: project_name ? `${project_name} - ${t('Tasks')}` : t('Tasks') }
    ];

    // Add sorting functionality
    const handleSort = (field: string) => {
        const direction = filters.sort_field === field && filters.sort_direction === 'asc' ? 'desc' : 'asc';
        router.get(route('tasks.index'), buildParams({ sort_field: field, sort_direction: direction, page: 1 }), { preserveState: true, preserveScroll: true });
    };

    // CrudTable configuration
    const columns = [
        {
            key: 'title',
            label: t('Task'),
            sortable: true,
            render: (value: string, row: any) => (
                <div>
                    <div
                        className="text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                        onClick={() => handleAction('view', row.id)}
                    >
                        {value}
                    </div>
                    <div className="text-sm text-gray-500">{row.project?.title}</div>
                </div>
            )
        },
                {
            key: 'assigned_to',
            label: t('Assignee'),
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
                    '-'
                )
            )
        },
        // ...(project_name ? [] : [{
        //     key: 'project.title',
        //     label: t('Project'),
        //     render: (value: string) => value || '-'
        // }]),
        {
            key: 'task_stage.name',
            label: t('Stage'),
            render: (value: string, row: any) => (
                <span
                    className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset"
                    style={{
                        backgroundColor: row.task_stage?.color + '20',
                        color: row.task_stage?.color,
                        boxShadow: `inset 0 0 0 1px ${row.task_stage?.color}33`,
                    }}
                >
                    {row.task_stage?.name}
                </span>
            )
        },
        {
            key: 'priority',
            label: t('Priority'),
            sortable: true,
            render: (value: string) => (
                <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium capitalize ${getPriorityColor(value)}`}>
                    {value}
                </span>
            )
        },
        {
            key: 'progress',
            label: t('Progress'),
            render: (value: number) => (
                <div className="flex items-center">
                    <div className="w-16 bg-gray-200 rounded-full h-1.5 mr-2">
                        <div className="bg-blue-600 h-1.5 rounded-full bg-primary" style={{width: `${value}%`}}></div>
                    </div>
                    <span className="text-sm text-gray-900">{value}%</span>
                </div>
            )
        },
        {
            key: 'end_date',
            label: t('Due Date'),
            sortable: true,
            render: (value: string, row: any) => (
                <div className="flex items-center gap-1.5 text-sm whitespace-nowrap text-gray-500">
                    <Calendar className={`h-3.5 w-3.5 shrink-0 ${isTaskOverdue(value, row.progress) ? 'text-red-500' : 'text-gray-500'}`} />
                    <span className={`text-sm ${isTaskOverdue(value, row.progress) ? 'text-red-500' : 'text-gray-500'}`}>
                        {value ? window.appSettings.formatDateTime(new Date(value), false) : '-'}
                    </span>
                </div>
            )
        }
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
            condition: () => userWorkspaceRole !== 'client'
        },
        {
            label: t('Duplicate'),
            icon: 'Copy',
            action: 'duplicate',
            className: 'text-gray-500 hover:text-gray-700',
            condition: () => userWorkspaceRole !== 'client'
        },
        {
            label: t('Delete'),
            icon: 'Trash2',
            action: 'delete',
            className: 'text-gray-500 hover:text-gray-700',
            condition: () => userWorkspaceRole !== 'client'
        }
    ];

    return (
        <PageTemplate
            title={project_name ? `${project_name} - ${t('Tasks')}` : t('Tasks')}
            description={t('Manage your tasks and their details.')}
            url="/tasks"
            actions={pageActions}
            breadcrumbs={breadcrumbs}
            noPadding
        >
            <Head title={t('Tasks')} />

            {/* Overview Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                {/* Total Tasks */}
                <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-bl-full" />
                    <CardContent className="relative p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Total Tasks')}</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {Array.isArray(tasks) ? tasks.length : (tasks?.total || 0)}
                                </p>
                            </div>
                            <div className="relative z-10 p-2.5 bg-blue-50 dark:bg-blue-900/30 rounded-xl mt-0.5">
                                <ListTodo className="h-5 w-5 text-blue-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Unassigned */}
                <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-yellow-50 dark:bg-yellow-900/30 rounded-bl-full" />
                    <CardContent className="relative p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Unassigned')}</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {(Array.isArray(tasks) ? tasks : tasks?.data || []).filter(task => !task.assigned_to).length}
                                </p>
                            </div>
                            <div className="relative z-10 p-2.5 bg-yellow-50 dark:bg-yellow-900/30 rounded-xl mt-0.5">
                                <UserMinus className="h-5 w-5 text-yellow-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Assigned */}
                <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-green-50 dark:bg-green-900/30 rounded-bl-full" />
                    <CardContent className="relative p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Assigned')}</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {(Array.isArray(tasks) ? tasks : tasks?.data || []).filter(task => task.assigned_to).length}
                                </p>
                            </div>
                            <div className="relative z-10 p-2.5 bg-green-50 dark:bg-green-900/30 rounded-xl mt-0.5">
                                <UserCheck className="h-5 w-5 text-green-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Overdue */}
                <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-red-50 dark:bg-red-900/30 rounded-bl-full" />
                    <CardContent className="relative p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Overdue')}</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {(Array.isArray(tasks) ? tasks : tasks?.data || []).filter(task => task.end_date && isTaskOverdue(task.end_date, task.progress)).length}
                                </p>
                            </div>
                            <div className="relative z-10 p-2.5 bg-red-50 dark:bg-red-900/30 rounded-xl mt-0.5">
                                <Clock className="h-5 w-5 text-red-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* High Priority */}
                <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-orange-50 dark:bg-orange-900/30 rounded-bl-full" />
                    <CardContent className="relative p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('High Priority')}</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {(Array.isArray(tasks) ? tasks : tasks?.data || []).filter(task => task.priority === 'high' || task.priority === 'critical').length}
                                </p>
                            </div>
                            <div className="relative z-10 p-2.5 bg-orange-50 dark:bg-orange-900/30 rounded-xl mt-0.5">
                                <Flame className="h-5 w-5 text-orange-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters Row */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow mb-4 border">
                <SearchAndFilterBar
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    onSearch={handleSearch}
                    searchPlaceholder={t('Search tasks...')}
                    filters={[
                        {
                            name: 'project_id',
                            label: t('Project'),
                            type: 'select',
                            searchable: true,
                            value: selectedProject,
                            onChange: (value) => handleFilter('project_id', value),
                            options: [
                                { value: 'all', label: t('All Projects') },
                                ...projects.map((p) => ({ value: p.id.toString(), label: p.title }))
                            ]
                        },
                        {
                            name: 'stage_id',
                            label: t('Status'),
                            type: 'select',
                            value: selectedStage,
                            onChange: (value) => handleFilter('stage_id', value),
                            options: [
                                { value: 'all', label: t('All Stages') },
                                ...stages.map((s) => ({ value: s.id.toString(), label: s.name }))
                            ]
                        },
                        {
                            name: 'priority',
                            label: t('Priority'),
                            type: 'select',
                            value: selectedPriority,
                            onChange: (value) => handleFilter('priority', value),
                            options: [
                                { value: 'all', label: t('All Priority') },
                                { value: 'low', label: t('Low') },
                                { value: 'medium', label: t('Medium') },
                                { value: 'high', label: t('High') },
                                { value: 'critical', label: t('Critical') },
                            ]
                        },
                        {
                            name: 'assigned_to',
                            label: t('Assignee'),
                            type: 'select',
                            searchable: true,
                            value: selectedAssignee,
                            onChange: (value) => handleFilter('assigned_to', value),
                            options: [
                                { value: 'all', label: t('All Assignees') },
                                ...members.map((m) => ({ value: m.id.toString(), label: m.name }))
                            ]
                        },
                    ]}
                    hasActiveFilters={hasActiveFilters}
                    activeFilterCount={activeFilterCount}
                    onResetFilters={handleResetFilters}
                    showViewToggle={true}
                    activeView={viewMode === 'card' ? 'grid' : viewMode === 'table' ? 'list' : 'kanban'}
                    onViewChange={(view) => {
                        if (view === 'kanban') {
                            setViewMode('kanban');
                            router.get(route('tasks.index'), buildParams({ view: 'kanban' }, { apiView: 'kanban' }), { preserveState: true, preserveScroll: true });
                        // grid view disabled
                        } else {
                            setViewMode('table');
                            router.get(route('tasks.index'), buildParams({ page: 1, view: 'list' }, { apiView: 'list' }), { preserveState: true, preserveScroll: true });
                        }
                    }}
                    viewOptions={[
                        { value: 'kanban', label: t('Kanban'), icon: 'Columns' },
                        // { value: 'grid', label: t('Grid'), icon: 'Grid3X3' }, // Grid view disabled
                        { value: 'list', label: t('List'), icon: 'List' },
                    ]}
                />
            </div>


            <div>
                {viewMode === 'kanban' ? (
                    <div className="bg-slate-50 dark:bg-gray-900 rounded-lg" style={{ height: 'calc(100vh - 220px)', overflow: 'hidden' }}>
                        <style>{`
                            .kanban-scroll::-webkit-scrollbar {
                                height: 6px;
                            }
                            .kanban-scroll::-webkit-scrollbar-track {
                                background: #f1f5f9;
                                border-radius: 4px;
                            }
                            .kanban-scroll::-webkit-scrollbar-thumb {
                                background: #cbd5e1;
                                border-radius: 4px;
                            }
                            .kanban-scroll::-webkit-scrollbar-thumb:hover {
                                background: #94a3b8;
                            }
                            .column-scroll::-webkit-scrollbar {
                                width: 4px;
                            }
                            .column-scroll::-webkit-scrollbar-track {
                                background: transparent;
                            }
                            .column-scroll::-webkit-scrollbar-thumb {
                                background: #cbd5e1;
                                border-radius: 3px;
                            }
                            .column-scroll::-webkit-scrollbar-thumb:hover {
                                background: #94a3b8;
                            }
                            main {
                                overflow: hidden;
                            }
                            .dark .kanban-column {
                                background-color: rgb(17 24 39 / 0.95) !important;
                                border-color: rgb(55 65 81) !important;
                            }
                            .dark .kanban-column-header {
                                border-bottom-color: rgb(55 65 81) !important;
                            }
                            .dark .kanban-card {
                                background-color: #000000 !important;
                                border-color: rgb(55 65 81) !important;
                            }
                        `}</style>
                        <div className="flex gap-4 overflow-x-auto pb-4 kanban-scroll" style={{ height: '100%' }}>
                            {stages.map((stage) => {
                                const stageTasks = (Array.isArray(tasks) ? tasks : tasks?.data || []).filter(task => task.task_stage?.id === stage.id);
                                return (
                                    <div
                                        key={stage.id}
                                        className="flex-shrink-0"
                                        style={{ minWidth: '300px', width: 'calc(20% - 13px)' }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            e.currentTarget.classList.remove('bg-blue-50');
                                            const taskId = e.dataTransfer.getData('taskId');
                                            if (taskId) {
                                                toast.loading('Updating task stage...');
                                                router.put(route('tasks.change-stage', taskId), {
                                                    task_stage_id: stage.id
                                                }, {
                                                    onSuccess: () => {
                                                        toast.dismiss();
                                                    },
                                                    onError: () => {
                                                        toast.dismiss();
                                                        toast.error('Failed to update task stage');
                                                    }
                                                });
                                            }
                                        }}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            e.currentTarget.classList.add('bg-blue-50');
                                        }}
                                        onDragLeave={(e) => {
                                            e.currentTarget.classList.remove('bg-blue-50');
                                        }}
                                    >
                                        <div className="kanban-column rounded-xl h-full flex flex-col border" style={{ backgroundColor: stage.color + '12', borderColor: stage.color + '30' }}>
                                            <div className="kanban-column-header px-4 py-3 rounded-t-xl border-b" style={{ borderBottomColor: stage.color + '30' }}>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                                                        <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-100">{stage.name}</h3>
                                                        <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: stage.color + '25', color: stage.color }}>
                                                            {stageTasks.length}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="p-2 space-y-2 overflow-y-auto flex-1 column-scroll" style={{ backgroundColor: 'transparent' }}>
                                                {stageTasks.map((task) => (
                                                    <div
                                                        key={task.id}
                                                        draggable
                                                        onDragStart={(e) => {
                                                            e.dataTransfer.setData('taskId', task.id.toString());
                                                            e.currentTarget.classList.add('opacity-50', 'scale-95');
                                                        }}
                                                        onDragEnd={(e) => {
                                                            e.currentTarget.classList.remove('opacity-50', 'scale-95');
                                                        }}
                                                        className="cursor-move transition-all duration-200"
                                                    >
                                                        <Card className="kanban-card hover:shadow-md transition-all duration-200 shadow-sm bg-white dark:bg-[#1a1f2e] border-gray-200 dark:border-gray-700">
                                                            <CardContent className="p-3">
                                                                <div className="space-y-2">
                                                                    {/* Top row: title + 3 dots */}
                                                                    <div className="flex items-start justify-between gap-1">
                                                                        <h4
                                                                            className="font-semibold text-sm line-clamp-2 hover:text-blue-600 transition-colors cursor-pointer leading-snug flex-1"
                                                                            onClick={() => handleAction('view', task.id)}
                                                                        >
                                                                            {task.title}
                                                                        </h4>
                                                                        <DropdownMenu>
                                                                            <DropdownMenuTrigger asChild>
                                                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-gray-600 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                                                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                                                                </Button>
                                                                            </DropdownMenuTrigger>
                                                                            <DropdownMenuContent align="end" className="w-36">
                                                                                <DropdownMenuItem onClick={() => handleAction('view', task.id)}>
                                                                                    <Eye className="h-3.5 w-3.5 mr-2" />{t('View')}
                                                                                </DropdownMenuItem>
                                                                                {userWorkspaceRole !== 'client' && (
                                                                                    <>
                                                                                        <DropdownMenuItem onClick={() => handleAction('edit', task.id)}>
                                                                                            <Edit className="h-3.5 w-3.5 mr-2" />{t('Edit')}
                                                                                        </DropdownMenuItem>
                                                                                        <DropdownMenuSeparator />
                                                                                        <DropdownMenuItem onClick={() => handleAction('delete', task.id)} className="text-red-600">
                                                                                            <Trash2 className="h-3.5 w-3.5 mr-2" />{t('Delete')}
                                                                                        </DropdownMenuItem>
                                                                                    </>
                                                                                )}
                                                                            </DropdownMenuContent>
                                                                        </DropdownMenu>
                                                                    </div>

                                                                    {/* Priority + milestone aligned to dates */}
                                                                    <div className="flex items-center justify-between">
                                                                        <TaskPriority priority={task.priority} />
                                                                        {(task as any).milestone?.title && (
                                                                            <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20"><span className="truncate max-w-[100px] block">{(task as any).milestone.title}</span></span>
                                                                        )}
                                                                    </div>

                                                                    {/* Dates */}
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="flex items-center gap-1 text-xs">
                                                                            <Calendar className="h-3 w-3 shrink-0 text-gray-400" />
                                                                            <span className="text-gray-500 dark:text-gray-400">{task.start_date ? window.appSettings.formatDateTime(new Date(task.start_date), false) : '-'}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-1 text-xs">
                                                                            <Calendar className={`h-3 w-3 shrink-0 ${isTaskOverdue(task.end_date, task.progress) ? 'text-red-500' : 'text-gray-400'}`} />
                                                                            <span className={isTaskOverdue(task.end_date, task.progress) ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}>{task.end_date ? window.appSettings.formatDateTime(new Date(task.end_date), false) : '-'}</span>
                                                                        </div>
                                                                    </div>

                                                                    {/* Progress */}
                                                                    <div className="space-y-1">
                                                                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                                                                            <span>{t('Progress')}</span>
                                                                            <span>{task.progress}%</span>
                                                                        </div>
                                                                        <div className="relative h-1 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                                                                            <div
                                                                                className="h-full rounded-full transition-all bg-primary"
                                                                                style={{
                                                                                    width: `${task.progress}%`,
                                                                                }}
                                                                            />
                                                                        </div>
                                                                    </div>

                                                                    {/* Footer: project left + assignee avatar bottom-right */}
                                                                    <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-700">
                                                                        {!project_name && task.project?.title ? (
                                                                            <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/20"><span>{task.project.title}</span></span>
                                                                        ) : <span />}
                                                                        {task.assigned_to && (
                                                                            <Tooltip>
                                                                                <TooltipTrigger asChild>
                                                                                    <Avatar className="h-8 w-8 cursor-pointer">
                                                                                        <AvatarImage src={task.assigned_to.avatar} />
                                                                                        <AvatarFallback className="text-xs">{task.assigned_to.name?.charAt(0)}</AvatarFallback>
                                                                                    </Avatar>
                                                                                </TooltipTrigger>
                                                                                <TooltipContent>{task.assigned_to.name}</TooltipContent>
                                                                            </Tooltip>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    </div>
                                                ))}
                                                {stageTasks.length === 0 && (
                                                    <div className="flex flex-col items-center pt-10">
                                                        <div className="w-14 h-14 rounded-full border-2 border-dashed border-gray-200 flex items-center justify-center mb-3">
                                                            <UserIcon className="h-7 w-7 text-gray-200" />
                                                        </div>
                                                        <p className="text-xs text-gray-400">{t('Drop tasks here')}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (/* grid view disabled */ viewMode === 'card' ? null :  (
                <div className="bg-white rounded-lg shadow overflow-hidden">

                    <CrudTable
                        columns={columns}
                        actions={actions}
                        data={tasks?.data || []}
                        from={tasks?.from || 1}
                        onAction={handleAction}
                        sortField={filters.sort_field}
                        sortDirection={filters.sort_direction}
                        onSort={handleSort}
                        permissions={[]}
                    />
                    {tasks?.links && (
                        <Pagination
                            from={tasks?.from || 0}
                            to={tasks?.to || 0}
                            total={tasks?.total || 0}
                            links={tasks?.links}
                            entityName={t('tasks')}
                            onPageChange={(url) => {
                                const pageNum = new URL(url).searchParams.get('page');
                                router.get(route('tasks.index'), buildParams({ page: pageNum ? parseInt(pageNum) : 1 }), { preserveState: true, preserveScroll: true });
                            }}
                            currentPerPage={tasks?.per_page?.toString() || '10'}
                            onPerPageChange={(value) => {
                                router.get(route('tasks.index'), buildParams({ page: 1, per_page: parseInt(value) }), { preserveState: true, preserveScroll: true });
                            }}
                        />
                    )}
                </div>
                ))}
            </div>

            {/* Pagination - card view */}
            {tasks?.links && viewMode !== 'kanban' && viewMode !== 'table' && !Array.isArray(tasks) && (
                <div className="mt-4 bg-white dark:bg-gray-800 border rounded-lg shadow overflow-hidden">
                    <Pagination
                        from={tasks?.from || 0}
                        to={tasks?.to || 0}
                        total={tasks?.total || 0}
                        links={tasks?.links}
                        entityName={t('tasks')}
                        onPageChange={(url) => {
                            const pageNum = new URL(url).searchParams.get('page');
                            router.get(route('tasks.index'), buildParams({ page: pageNum ? parseInt(pageNum) : 1 }), { preserveState: true, preserveScroll: true });
                        }}
                        currentPerPage={tasks?.per_page?.toString() || '10'}
                        onPerPageChange={(value) => {
                            router.get(route('tasks.index'), buildParams({ page: 1, per_page: parseInt(value) }), { preserveState: true, preserveScroll: true });
                        }}
                    />
                </div>
            )}

            {/* Modals */}
            {/* View Modal */}
            <Dialog open={isViewModalOpen} onOpenChange={(open) => { setIsViewModalOpen(open); if (!open) setSelectedTask(null); }}>
                {selectedTask && (
                    <TaskView
                        task={selectedTask}
                        activeTab={viewActiveTab}
                        onTabChange={setViewActiveTab}
                        members={members}
                        workspaceRole={selectedTaskWorkspaceRole}
                        onUpdate={async () => {
                            const response = await fetch(route('tasks.show', selectedTask.id));
                            const data = await response.json();
                            setSelectedTask(data.task);
                        }}
                    />
                )}
            </Dialog>

            {/* Edit Modal */}
            {selectedTask && (
                <TaskModal
                    task={selectedTask}
                    isOpen={isModalOpen}
                    onClose={() => {
                        setIsModalOpen(false);
                        setSelectedTask(null);
                    }}
                    members={members}
                    stages={stages}
                    milestones={selectedTask.project?.milestones || []}
                    permissions={taskPermissions}
                    workspaceRole={selectedTaskWorkspaceRole}
                    mode="view"
                />
            )}

            <TaskFormModal
                isOpen={isFormModalOpen}
                onClose={() => {
                    setIsFormModalOpen(false);
                    setEditingTask(null);
                }}
                task={editingTask || undefined}
                projects={projects}
                members={members}
                milestones={editingTask?.project?.milestones || []}
                googleCalendarEnabled={googleCalendarEnabled}
            />

            {/* Delete Modal */}
            <CrudDeleteModal
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    setIsDeleteModalOpen(false);
                    setTaskToDelete(null);
                }}
                onConfirm={handleDeleteConfirm}
                itemName={taskToDelete?.title || ''}
                entityName={t('task')}
            />
        </PageTemplate>
    );
}
