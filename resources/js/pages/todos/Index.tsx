import React, { useState, useEffect } from 'react';
import { router, usePage } from '@inertiajs/react';
import { toast } from '@/components/custom-toast';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { SearchAndFilterBar } from '@/components/ui/search-and-filter-bar';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Plus, CheckSquare, Edit, Trash2, Eye, LayoutGrid, List, AlertTriangle, Send, MessageSquare, Paperclip, Download, Calendar } from 'lucide-react';
import { PageTemplate } from '@/components/page-template';
import { CrudTable } from '@/components/CrudTable';
import { useTranslation } from 'react-i18next';
import TodoFormModal from './TodoFormModal';
import TodoView from './TodoView';
import { CrudDeleteModal } from '@/components/CrudDeleteModal';
import { hasPermission } from '@/utils/authorization';
import axios from 'axios';
import { useForm } from '@inertiajs/react';

interface Todo {
    id: number;
    title: string;
    description: string | null;
    priority: 'low' | 'medium' | 'high';
    status: 'pending' | 'in_progress' | 'completed' | 'overdue';
    due_date: string | null;
    completed_at: string | null;
    created_at: string;
    creator: {
        id: number;
        name: string;
    };
    members: Array<{
        id: number;
        name: string;
        email: string;
        avatar: string | null;
    }>;
}

export default function TodosIndex() {
    const { t } = useTranslation();
    const { todos, workspaceMembers, flash, auth, filters: pageFilters = {} } = usePage().props as any;
    const permissions = auth?.permissions || [];

    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [currentTodo, setCurrentTodo] = useState<Todo | null>(null);
    const [todoData, setTodoData] = useState<any>(null);
    const [activeTab, setActiveTab] = useState('details');
    const [editingComment, setEditingComment] = useState<number | null>(null);
    const [editCommentText, setEditCommentText] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
    const [activeView, setActiveView] = useState(pageFilters.view || 'grid');
    const [searchTerm, setSearchTerm] = useState(pageFilters.search || '');
    const [selectedStatus, setSelectedStatus] = useState(pageFilters.status || 'all');
    const [selectedPriority, setSelectedPriority] = useState(pageFilters.priority || 'all');
    const [showFilters, setShowFilters] = useState(false);
    const [pageInitialState, setPageInitialState] = useState(true);

    useEffect(() => {
        if (!pageInitialState) {
            router.get(route('todos.index'), buildParams({ page: 1 }), { preserveState: false, preserveScroll: false });
        }
        setPageInitialState(false);
    }, [selectedStatus, selectedPriority]);

    const { data: commentData, setData: setCommentData, post: postComment, reset: resetComment } = useForm({
        comment: ''
    });

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
        if (flash?.error) {
            toast.error(flash.error);
        }
        if (flash?.warning) {
            toast.warning(flash.warning);
        }
    }, [flash]);

    const getPriorityColor = (priority: string) => {
        const colors = {
            high: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20',
            medium: 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20',
            low: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20'
        };
        return colors[priority as keyof typeof colors] || 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20';
    };

    const getStatusColor = (status: string) => {
        const colors = {
            pending: 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20',
            in_progress: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20',
            completed: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20',
            overdue: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20'
        };
        return colors[status as keyof typeof colors] || 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20';
    };

    const renderStatusBadge = (status: string) => {
        return (
            <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${getStatusColor(status)}`}>
                {/* {status === 'overdue' && <AlertTriangle className="h-3 w-3 mr-1" />} */}
                {capitalizeFirst(status)}
            </span>
        );
    };

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const getAvatarColor = (name: string) => {
        const colors = {
            'owner': 'bg-purple-500',
            'manager': 'bg-blue-500', 
            'member': 'bg-green-500',
            'client': 'bg-orange-500'
        };
        // Simple hash based on first character
        const firstChar = name.charAt(0).toUpperCase();
        const colorKeys = Object.keys(colors);
        const index = firstChar.charCodeAt(0) % colorKeys.length;
        return colors[colorKeys[index] as keyof typeof colors] || 'bg-gray-500';
    };

    const capitalizeFirst = (str: string) => {
        return str.charAt(0).toUpperCase() + str.slice(1).replace('_', ' ');
    };

    const handleAddNew = () => {
        setCurrentTodo(null);
        setIsFormModalOpen(true);
    };

    const handleView = (todo: Todo) => {
        setCurrentTodo(todo);
        setActiveTab('details');
        if (todo.id) {
            axios.get(route('todos.show', todo.id))
                .then(response => {
                    setTodoData(response.data.todo);
                })
                .catch(console.error);
        }
        setIsViewModalOpen(true);
    };

    const handleEdit = (todo: Todo) => {
        setCurrentTodo(todo);
        setIsFormModalOpen(true);
    };

    const handleDelete = (todo: Todo) => {
        setCurrentTodo(todo);
        setIsDeleteModalOpen(true);
    };

    const handleDeleteConfirm = () => {
        if (currentTodo) {
            router.delete(route('todos.destroy', currentTodo.id), {
                onSuccess: () => {
                    setIsDeleteModalOpen(false);
                    setCurrentTodo(null);
                },
                onError: () => {
                    toast.error(t('Failed to delete todo'));
                }
            });
        }
    };

    const handleComment = (e: React.FormEvent) => {
        e.preventDefault();
        if (todoData?.id) {
            postComment(route('todo-comments.store', todoData.id), {
                onSuccess: () => {
                    resetComment();
                    axios.get(route('todos.show', todoData.id))
                        .then(response => {
                            setTodoData(response.data.todo);
                        })
                        .catch(console.error);
                }
            });
        }
    };

    const handleFileUpload = (e: React.FormEvent) => {
        e.preventDefault();
        if (todoData?.id && selectedFiles) {
            const formData = new FormData();
            Array.from(selectedFiles).forEach((file) => {
                formData.append('files[]', file);
            });

            router.post(route('todo-attachments.store', todoData.id), formData, {
                onSuccess: () => {
                    setSelectedFiles(null);
                    axios.get(route('todos.show', todoData.id))
                        .then(response => setTodoData(response.data.todo))
                        .catch(console.error);
                }
            });
        }
    };

    const handleDeleteAttachment = (attachmentId: number) => {
        if (todoData?.id) {
            router.delete(route('todo-attachments.destroy', attachmentId), {
                onSuccess: () => {
                    axios.get(route('todos.show', todoData.id))
                        .then(response => setTodoData(response.data.todo))
                        .catch(console.error);
                }
            });
        }
    };

    const hasActiveFilters = () => {
        return searchTerm !== '' || selectedStatus !== 'all' || selectedPriority !== 'all';
    };

    const activeFilterCount = () => {
        return (searchTerm ? 1 : 0) + (selectedStatus !== 'all' ? 1 : 0) + (selectedPriority !== 'all' ? 1 : 0);
    };

    // Central param builder
    const buildParams = (
        overrides: Record<string, any> = {},
        stateOverrides: { search?: string; status?: string; priority?: string; view?: string } = {}
    ) => {
        const view     = stateOverrides.view     !== undefined ? stateOverrides.view     : activeView;
        const search   = stateOverrides.search   !== undefined ? stateOverrides.search   : searchTerm;
        const status   = stateOverrides.status   !== undefined ? stateOverrides.status   : selectedStatus;
        const priority = stateOverrides.priority !== undefined ? stateOverrides.priority : selectedPriority;

        const params: any = { page: 1, view };
        if (search) params.search = search;
        if (status !== 'all') params.status = status;
        if (priority !== 'all') params.priority = priority;
        if (pageFilters.per_page) params.per_page = pageFilters.per_page;
        if (pageFilters.sort_by) params.sort_by = pageFilters.sort_by;
        if (pageFilters.sort_order) params.sort_order = pageFilters.sort_order;
        return { ...params, ...overrides };
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        router.get(route('todos.index'), buildParams({ page: 1 }), { preserveState: false, preserveScroll: false });
    };

    const handleResetFilters = () => {
        setSearchTerm('');
        setSelectedStatus('all');
        setSelectedPriority('all');
        const params: any = { page: 1, view: activeView };
        if (pageFilters.per_page) params.per_page = pageFilters.per_page;
        router.get(route('todos.index'), params, { preserveState: false, preserveScroll: false });
    };

    const handleSort = (field: string) => {
        const direction = pageFilters.sort_by === field && pageFilters.sort_order === 'asc' ? 'desc' : 'asc';
        router.get(route('todos.index'), buildParams({ sort_by: field, sort_order: direction, page: 1 }), { preserveState: false, preserveScroll: false });
    };

    const todosData = todos?.data || [];

    // Handle actions for CrudTable
    const handleAction = (action: string, todo: Todo) => {
        switch (action) {
            case 'view':
                handleView(todo);
                break;
            case 'edit':
                handleEdit(todo);
                break;
            case 'delete':
                handleDelete(todo);
                break;
        }
    };

    // CrudTable configuration
    const columns = [
        {
            key: 'title',
            label: t('Title'),
            sortable: true,
            render: (value: string, row: Todo) => (
                <div>
                    <div 
                        className="text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                        onClick={() => handleView(row)}
                    >
                        {value}
                    </div>
                </div>
            )
        },
        {
                    key: 'created_by',
                    label: t('Created By'),
                    sortable: true,
                    render: (value: string, row: Todo) => (
                        <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 rounded-full object-cover">
                                <AvatarImage src={row.creator?.avatar ?? undefined} className="object-cover" />
                                <AvatarFallback className="text-xs"><img src="/images/avatar/avatar.png" className="h-full w-full object-cover rounded-full" /></AvatarFallback>
                            </Avatar>
                            <div>
                                <div className="text-sm font-medium text-gray-900">{row.creator.name}</div>
                                <div className="text-xs text-gray-500">{row.creator.email}</div>
                            </div>
                        </div>
                    )
                },
        {
            key: 'priority',
            label: t('Priority'),
            sortable: true,
            render: (value: string) => (
                <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${getPriorityColor(value)}`}>
                    {capitalizeFirst(value)}
                </span>
            )
        },
        {
            key: 'status',
            label: t('Status'),
            sortable: true,
            render: (value: string) => renderStatusBadge(value)
        },
        {
            key: 'due_date',
            label: t('Due Date'),
            sortable: true,
            render: (value: string) => (
                <div className="flex items-center gap-1.5 text-sm whitespace-nowrap text-gray-500">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                   <span className="text-sm"> {value ? window.appSettings.formatDateTime(new Date(value),false) : '-'}
                </span>
                </div>
            )
        },
        {
            key: 'members',
            label: t('Members'),
            render: (value: any[], row: Todo) => (
                row.members.length > 0 ? renderMemberAvatars(row.members) : '-'
            )
        }
    ];

    const actions = [
        {
            label: t('View'),
            icon: 'Eye',
            action: 'view',
            className: 'text-gray-500 hover:text-gray-700'
        },
        {
            label: t('Edit'),
            icon: 'Edit',
            action: 'edit',
            className: 'text-gray-500 hover:text-gray-700',
            condition: (row: Todo) => hasPermission(permissions, 'todo_update') && row.status !== 'completed'
        },
        {
            label: t('Delete'),
            icon: 'Trash2',
            action: 'delete',
            className: 'text-gray-500 hover:text-gray-700',
            condition: () => hasPermission(permissions, 'todo_delete')
        }
    ];

    const renderMemberAvatars = (members: any[]) => {
        if (!members || members.length === 0) return null;
        
        const displayMembers = members.slice(0, 3);
        const remainingCount = members.length - 3;

        return (
            <div className="flex -space-x-2">
                {displayMembers.map((member) => (
                    <Tooltip key={member.id}>
                        <TooltipTrigger asChild>
                            <Avatar className="h-6 w-6 border-2 border-white cursor-pointer">
                                <AvatarImage src={member.avatar} />
                                <AvatarFallback className={`text-[10px] font-semibold text-white ${getAvatarColor(member.name)}`}>
                                    {getInitials(member.name)}
                                </AvatarFallback>
                            </Avatar>
                        </TooltipTrigger>
                        <TooltipContent>{member.name}</TooltipContent>
                    </Tooltip>
                ))}
                {remainingCount > 0 && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="h-6 w-6 rounded-full border-2 border-white bg-gray-500 flex items-center justify-center text-white text-[10px] font-semibold cursor-pointer">
                                +{remainingCount}
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            {members.slice(3).map(m => m.name).join(', ')}
                        </TooltipContent>
                    </Tooltip>
                )}
            </div>
        );
    };

    const pageActions = hasPermission(permissions, 'todo_create') ? [
        {
            label: t('Create ToDo'),
            icon: <Plus className="h-4 w-4 mr-2" />,
            variant: 'default' as const,
            onClick: handleAddNew
        }
    ] : [];

    const breadcrumbs = [
        { title: t('Dashboard'), href: route('dashboard') },
        { title: t('ToDos') }
    ];

    return (
        <PageTemplate
            title={t('ToDos')}
            description={t('Manage your todos and their details.')}
            url="/todos"
            actions={pageActions}
            breadcrumbs={breadcrumbs}
            noPadding
        >

            <div className="bg-white dark:bg-gray-900 rounded-lg shadow mb-4 border">
                <SearchAndFilterBar
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    onSearch={handleSearch}
                    searchPlaceholder={t('Search todos...')}
                    filters={[
                        {
                            name: 'status',
                            label: t('Status'),
                            type: 'select',
                            value: selectedStatus,
                            onChange: (value) => setSelectedStatus(value),
                            options: [
                                { value: 'all', label: t('All Status') },
                                { value: 'pending', label: t('Pending') },
                                { value: 'in_progress', label: t('In Progress') },
                                { value: 'completed', label: t('Completed') },
                                { value: 'overdue', label: t('Overdue') },
                            ]
                        },
                        {
                            name: 'priority',
                            label: t('Priority'),
                            type: 'select',
                            value: selectedPriority,
                            onChange: (value) => setSelectedPriority(value),
                            options: [
                                { value: 'all', label: t('All Priority') },
                                { value: 'low', label: t('Low') },
                                { value: 'medium', label: t('Medium') },
                                { value: 'high', label: t('High') },
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
                        router.get(route('todos.index'), buildParams({ page: 1, view }, { view }), { preserveState: false, preserveScroll: false });
                    }}
                />
            </div>

            {activeView === 'grid' ? (
                    todosData.length === 0 ? (
                        <div className="bg-white rounded-lg shadow p-8 text-center">
                            <CheckSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                            <p className="text-gray-500 mb-4">{t('No todos found')}</p>
                            {hasPermission(permissions, 'todo_create') && (
                                <Button onClick={handleAddNew}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    {t('Create your first todo')}
                                </Button>
                            )}
                        </div>
                    ):(
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {todosData.map((todo: Todo) => (
                            <Card key={todo.id} className="hover:shadow-md transition-shadow">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <CardTitle 
                                            className="text-base line-clamp-1 cursor-pointer hover:text-blue-600 transition-colors"
                                            onClick={() => handleView(todo)}
                                        >
                                            {todo.title}
                                        </CardTitle>
                                        {renderStatusBadge(todo.status)}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {t('By')} {todo.creator.name}
                                    </div>
                                </CardHeader>

                                <CardContent className="py-2">
                                    {todo.description && (
                                        <p className="text-sm text-gray-500 line-clamp-2 mb-2">
                                            {todo.description}
                                        </p>
                                    )}
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1">
                                            <span className="text-xs text-gray-600 font-semibold">{t('Priority')}:</span>
                                            <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${getPriorityColor(todo.priority)}`}>
                                                {capitalizeFirst(todo.priority)}
                                            </span>
                                        </div>
                                        {todo.due_date && (
                                            <span className="text-xs text-gray-500">
                                                <span className="font-bold">Due:</span> {window.appSettings.formatDateTime(new Date(todo.due_date),false)}
                                            </span>
                                        )}
                                    </div>
                                </CardContent>

                                <CardFooter className="pt-0 pb-2 flex justify-between items-center">
                                    <div>
                                        {todo.members.length > 0 && renderMemberAvatars(todo.members)}
                                    </div>
                                    <div className="flex gap-1">
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleView(todo)}
                                                    className="h-8 w-8 text-gray-500 hover:text-gray-700"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>{t('View')}</TooltipContent>
                                        </Tooltip>
                                        {hasPermission(permissions, 'todo_update') && todo.status !== 'completed' && (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleEdit(todo)}
                                                        className="h-8 w-8 text-gray-500 hover:text-gray-700"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>{t('Edit')}</TooltipContent>
                                            </Tooltip>
                                        )}
                                        {hasPermission(permissions, 'todo_delete') && (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDelete(todo)}
                                                        className="h-8 w-8 text-gray-500 hover:text-gray-700"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>{t('Delete')}</TooltipContent>
                                            </Tooltip>
                                        )}
                                    </div>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                    )
                ) : (
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <CrudTable
                            columns={columns}
                            actions={actions}
                            data={todosData}
                            from={todos?.from || 1}
                            onAction={handleAction}
                            sortField={pageFilters.sort_by}
                            sortDirection={pageFilters.sort_order}
                            onSort={handleSort}
                            permissions={permissions}
                        />
                        {todos?.links && (
                            <Pagination
                                from={todos?.from || 0}
                                to={todos?.to || 0}
                                total={todos?.total || 0}
                                links={todos?.links}
                                entityName={t('todos')}
                                onPageChange={(url) => {
                                    const pageNum = new URL(url).searchParams.get('page');
                                    router.get(route('todos.index'), buildParams({ page: pageNum ? parseInt(pageNum) : 1 }), { preserveState: false, preserveScroll: false });
                                }}
                                currentPerPage={pageFilters.per_page?.toString() || '10'}
                                onPerPageChange={(value) => {
                                    router.get(route('todos.index'), buildParams({ page: 1, per_page: parseInt(value) }), { preserveState: false, preserveScroll: false });
                                }}
                            />
                        )}
                    </div>
                )}

            <TodoFormModal
                isOpen={isFormModalOpen}
                onClose={() => {
                    setIsFormModalOpen(false);
                    setCurrentTodo(null);
                }}
                todo={currentTodo}
                workspaceMembers={workspaceMembers || []}
            />

            <Dialog open={isViewModalOpen} onOpenChange={() => setIsViewModalOpen(false)}>
                {currentTodo && (
                    <TodoView
                        todo={currentTodo}
                        todoData={todoData}
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                    />
                )}
            </Dialog>

            {/* Pagination - grid view */}
            {activeView === 'grid' && todos?.links && (
                <div className="mt-4 bg-white dark:bg-gray-800 border rounded-lg shadow overflow-hidden">
                    <Pagination
                        from={todos?.from || 0}
                        to={todos?.to || 0}
                        total={todos?.total || 0}
                        links={todos?.links}
                        entityName={t('todos')}
                        onPageChange={(url) => {
                            const pageNum = new URL(url).searchParams.get('page');
                            router.get(route('todos.index'), buildParams({ page: pageNum ? parseInt(pageNum) : 1 }), { preserveState: false, preserveScroll: false });
                        }}
                        currentPerPage={pageFilters.per_page?.toString() || '10'}
                        onPerPageChange={(value) => {
                            router.get(route('todos.index'), buildParams({ page: 1, per_page: parseInt(value) }), { preserveState: false, preserveScroll: false });
                        }}
                    />
                </div>
            )}

            <CrudDeleteModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDeleteConfirm}
                itemName={currentTodo?.title || ''}
                entityName="todo"
            />
        </PageTemplate>
    );
}
