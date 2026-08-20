import React, { useState, useEffect } from 'react';
import { router, usePage } from '@inertiajs/react';
import { toast } from '@/components/custom-toast';
import { Button } from '@/components/ui/button';
import { SearchAndFilterBar } from '@/components/ui/search-and-filter-bar';
import { Pagination } from '@/components/ui/pagination';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Eye, Edit, Trash2, StickyNote, Users, User, Calendar, Share2, FileText, MoreHorizontal } from 'lucide-react';
import { PageTemplate } from '@/components/page-template';
import { CrudDeleteModal } from '@/components/CrudDeleteModal';
import { CrudTable } from '@/components/CrudTable';
import { useTranslation } from 'react-i18next';
import NoteFormModal from '@/components/notes/NoteFormModal';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog } from '@/components/ui/dialog';
import NoteView from './NoteView';

interface Note {
    id: number;
    title: string;
    text: string;
    color: string;
    type: 'personal' | 'shared';
    assign_to: string | null;
    workspace: number;
    created_by: number;
    created_at: string;
    creator: {
        id: number;
        name: string;
        email: string;
        avatar: string | null;
    };
    assigned_users?: Array<{
        id: number;
        name: string;
        email: string;
    }>;
}

interface User {
    id: number;
    name: string;
    email: string;
    role: string;
}

export default function NotesIndex() {
    const { t } = useTranslation();
    const { personal_notes, shared_notes, combined_notes, users, auth, flash, permissions: pagePermissions, filters: pageFilters = {}, total_personal_notes = 0, total_shared_notes = 0 } = usePage().props as any;
    const notePermissions = pagePermissions;

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

    const [activeView, setActiveView] = useState(pageFilters.view_mode || 'kanban');
    const [searchTerm, setSearchTerm] = useState(pageFilters.search || '');
    const [selectedType, setSelectedType] = useState(pageFilters.type || 'all');
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [currentNote, setCurrentNote] = useState<Note | null>(null);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [lastGridPage, setLastGridPage] = useState(pageFilters.notes_page || 1);

    const getTypeColor = (type: string) => {
        const colors: Record<string, string> = {
            personal: 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20',
            shared: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20',
        };
        return colors[type] || 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20';
    };

    const hasActiveFilters = () => {
        return searchTerm !== '' || selectedType !== 'all';
    };

    const activeFilterCount = () => {
        return (searchTerm ? 1 : 0) + (selectedType !== 'all' ? 1 : 0);
    };

    const buildParams = (
        overrides: Record<string, any> = {},
        stateOverrides: { search?: string; type?: string; view?: string } = {}
    ) => {
        const view   = stateOverrides.view   !== undefined ? stateOverrides.view   : activeView;
        const search = stateOverrides.search !== undefined ? stateOverrides.search : searchTerm;
        const type   = stateOverrides.type   !== undefined ? stateOverrides.type   : selectedType;

        const params: any = { notes_page: 1, view_mode: view };
        if (search) params.search = search;
        if (type !== 'all') params.type = type;
        if (pageFilters.per_page) params.per_page = pageFilters.per_page;
        if (pageFilters.sort_field) params.sort_field = pageFilters.sort_field;
        if (pageFilters.sort_direction) params.sort_direction = pageFilters.sort_direction;
        return { ...params, ...overrides };
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        router.get(route('notes.index'), buildParams({ notes_page: 1 }), { preserveState: false, preserveScroll: false });
    };

    const applyFilters = () => {
        router.get(route('notes.index'), buildParams({ notes_page: 1 }), { preserveState: false, preserveScroll: false });
    };

    const handleSort = (field: string) => {
        const direction = pageFilters.sort_field === field && pageFilters.sort_direction === 'asc' ? 'desc' : 'asc';
        router.get(route('notes.index'), buildParams({ sort_field: field, sort_direction: direction, notes_page: 1 }), { preserveState: false, preserveScroll: false });
    };

    const handleResetFilters = () => {
        setSearchTerm('');
        setSelectedType('all');
        const params: any = { notes_page: 1, view_mode: activeView };
        if (pageFilters.per_page) params.per_page = pageFilters.per_page;
        router.get(route('notes.index'), params, { preserveState: false, preserveScroll: false });
    };

    const handleAction = (action: string, noteOrId: Note | number) => {
        let note: Note;
        
        if (typeof noteOrId === 'number') {
            // Called from CrudTable with ID
            note = (combined_notes?.data || [...(personal_notes?.data || []), ...(shared_notes?.data || [])]).find((n: Note) => n.id === noteOrId);
            if (!note) return;
        } else {
            // Called from grid view with note object
            note = noteOrId;
        }
        
        setCurrentNote(note);
        switch (action) {
            case 'view':
                setIsViewModalOpen(true);
                break;
            case 'edit':
                setModalMode('edit');
                setIsFormModalOpen(true);
                break;
            case 'delete':
                setIsDeleteModalOpen(true);
                break;
        }
    };

    const handleAddNew = () => {
        setCurrentNote(null);
        setModalMode('create');
        setIsFormModalOpen(true);
    };

    const handleDeleteConfirm = () => {
        if (currentNote) {
            toast.loading(t('Deleting note...'));
            router.delete(route('notes.destroy', currentNote.id), {
                onSuccess: () => {
                    toast.dismiss();
                    setIsDeleteModalOpen(false);
                },
                onError: () => {
                    toast.dismiss();
                    toast.error(t('Failed to delete note'));
                    setIsDeleteModalOpen(false);
                }
            });
        }
    };

    // CrudTable configuration
    const columns = [
        {
            key: 'title',
            label: t('Title'),
            sortable: true,
            render: (value: string) => (
                <span className="text-sm font-medium text-gray-900">{value}</span>
            )
        },
        {
            key: 'created_by',
            label: t('Created By'),
            sortable: true,
            render: (value: string, row: Note) => (
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
            key: 'type',
            label: t('Type'),
            sortable: true,
            render: (value: string) => (
                <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${getTypeColor(value)}`}>
                    {value === 'shared' ? t('Shared') : t('Personal')}
                </span>
            )
        },
        {
            key: 'created_at',
            label: t('Created At'),
            sortable: true,
            render: (value: string, row: Note) => (
                        <div className="flex items-center gap-1.5 text-sm whitespace-nowrap text-gray-500">
                            <Calendar className="h-3.5 w-3.5 shrink-0" />
                            <span>{window.appSettings.formatDateTime(new Date(value),false)}</span>
                        </div>
            )
        },
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
            condition: () => notePermissions?.update
        },
        {
            label: t('Delete'),
            icon: 'Trash2',
            action: 'delete',
            className: 'text-gray-500 hover:text-gray-700',
            condition: () => notePermissions?.delete
        }
    ];

    const renderNoteCard = (note: Note) => (
        <Card key={note.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{note.title}</h3>
                    </div>
                    {note.type === 'shared' ? (
                        <Share2 className="h-4 w-4 text-primary flex-shrink-0 ml-2" />
                    ) : (
                        <User className="h-4 w-4 text-primary flex-shrink-0 ml-2" />
                    )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2">
                    <span>{t('By')} {note.creator.name}</span>
                    {/* {note.created_at ? (
                        <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-gray-400" />
                            {window.appSettings.formatDateTime(new Date(note.created_at), false)}
                        </span>
                    ) : <span>-</span>} */}
                </p>
               <div className="border-t border-gray-200 dark:border-gray-800 mt-2 pt-2 mb-2">
    <div
        className="text-sm text-gray-600 dark:text-gray-400 line-clamp-4 h-[80px] overflow-hidden"
        dangerouslySetInnerHTML={{ __html: note.text || t('No content') }}
    />
</div>
                <div className="flex justify-between items-center border-t border-gray-200 dark:border-gray-800 pt-3 ">
                    <div className="flex items-center">
                        {note.type === 'shared' && note.assigned_users && note.assigned_users.length > 0 && (() => {
                            const visible = note.assigned_users.slice(0, 3);
                            const extra = note.assigned_users.length - 3;
                            return (
                                <div className="flex -space-x-2">
                                    {visible.map((u: any) => (
                                        <Tooltip key={u.id}>
                                            <TooltipTrigger asChild>
                                                <Avatar className="h-6 w-6 border-2 border-white dark:border-gray-900">
                                                    <AvatarImage src={u.avatar} className="object-cover" />
                                                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{u.name.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                            </TooltipTrigger>
                                            <TooltipContent>{u.name}</TooltipContent>
                                        </Tooltip>
                                    ))}
                                    {extra > 0 && (
                                        <div className="h-6 w-6 rounded-full border-2 border-white dark:border-gray-900 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-[10px] font-medium text-gray-600 dark:text-gray-300">
                                            +{extra}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                    <div className="flex gap-1">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => handleAction('view', note)} className="h-8 w-8">
                                    <Eye className="h-4 w-4 text-gray-500" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('View')}</TooltipContent>
                        </Tooltip>
                        {notePermissions?.update && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" onClick={() => handleAction('edit', note)} className="h-8 w-8">
                                        <Edit className="h-4 w-4 text-gray-500" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>{t('Edit')}</TooltipContent>
                            </Tooltip>
                        )}
                        {notePermissions?.delete && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" onClick={() => handleAction('delete', note)} className="h-8 w-8">
                                        <Trash2 className="h-4 w-4 text-gray-500" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>{t('Delete')}</TooltipContent>
                            </Tooltip>
                        )}
                    </div>
                </div>
            </div>
        </Card>
    );

    const pageActions = [];

    if (notePermissions?.create) {
        pageActions.push({
            label: t('Create Note'),
            icon: <Plus className="h-4 w-4 mr-2" />,
            variant: 'default',
            onClick: handleAddNew
        });
    }

    const breadcrumbs = [
        { title: t('Dashboard'), href: route('dashboard') },
        { title: t('Notes') }
    ];

    return (
        <PageTemplate
            title={t('Notes')}
            description={t('Manage and organize your notes and reminders.')}
            url="/notes"
            actions={pageActions}
            breadcrumbs={breadcrumbs}
            noPadding
        >
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-bl-full" />
                    <CardContent className="relative p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Total Notes')}</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{total_personal_notes + total_shared_notes}</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('All Notes')}</p>
                            </div>
                            <div className="relative z-10 p-2.5 bg-blue-50 dark:bg-blue-900/30 rounded-xl mt-0.5">
                                <FileText className="h-5 w-5 text-blue-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-green-50 dark:bg-green-900/30 rounded-bl-full" />
                    <CardContent className="relative p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Personal Notes')}</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{total_personal_notes}</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('My Notes')}</p>
                            </div>
                            <div className="relative z-10 p-2.5 bg-green-50 dark:bg-green-900/30 rounded-xl mt-0.5">
                                <User className="h-5 w-5 text-green-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-violet-50 dark:bg-violet-900/30 rounded-bl-full" />
                    <CardContent className="relative p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Shared Notes')}</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{total_shared_notes}</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('Shared with others')}</p>
                            </div>
                            <div className="relative z-10 p-2.5 bg-violet-50 dark:bg-violet-900/30 rounded-xl mt-0.5">
                                <Share2 className="h-5 w-5 text-violet-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Search and filters */}
            <div className="bg-white dark:bg-gray-900 rounded-lg border shadow mb-4">
                <SearchAndFilterBar
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    onSearch={handleSearch}
                    searchPlaceholder={t('Search notes...')}
                    filters={[
                        {
                            name: 'type',
                            label: t('Type'),
                            type: 'select',
                            value: selectedType,
                            onChange: (value: string) => {
                                setSelectedType(value);
                                router.get(route('notes.index'), buildParams({ notes_page: 1 }, { type: value }), { preserveState: false, preserveScroll: false });
                            },
                            options: [
                                { value: 'all', label: t('All Types') },
                                { value: 'personal', label: t('Personal') },
                                { value: 'shared', label: t('Shared') },
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
                        router.get(route('notes.index'), { ...pageFilters, view_mode: view }, { preserveState: false, preserveScroll: false });
                    }}
                    viewOptions={[
                        { value: 'grid', label: t('Grid View'), icon: 'Grid3X3' },
                        { value: 'kanban', label: t('Kanban View'), icon: 'Columns' },
                    ]}
                />
            </div>

            {/* Notes Content */}
            {activeView === 'kanban' ? (
                <div className="h-[calc(100vh-380px)] md:h-[calc(100vh-320px)]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                        {/* Personal Notes Column */}
                        <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-3 md:p-4 flex flex-col h-full overflow-hidden">
                            <h3 className="font-semibold mb-3 md:mb-4 flex items-center gap-2 flex-shrink-0 text-sm md:text-base">
                                <Users className="h-4 w-4 md:h-5 md:w-5" />
                                {t('Personal Notes')} ({personal_notes?.data?.length || 0})
                            </h3>
                            <div className="space-y-2 overflow-y-auto flex-1 pr-1 md:pr-2">
                                {(personal_notes?.data || []).map((note: Note) => (
                                    <Card key={note.id} className="p-3 md:p-4 hover:shadow-md bg-white dark:bg-gray-800">
                                        <div className="flex items-start justify-between mb-2">
                                            <h4 className="font-medium flex-1 truncate text-sm md:text-base">{note.title}</h4>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleAction('view', note)}>
                                                        <Eye className="h-4 w-4 mr-2" />{t('View')}
                                                    </DropdownMenuItem>
                                                    {notePermissions?.update && (
                                                        <DropdownMenuItem onClick={() => handleAction('edit', note)}>
                                                            <Edit className="h-4 w-4 mr-2" />{t('Edit')}
                                                        </DropdownMenuItem>
                                                    )}
                                                    {notePermissions?.delete && (
                                                        <>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem onClick={() => handleAction('delete', note)} className="text-red-600">
                                                                <Trash2 className="h-4 w-4 mr-2" />{t('Delete')}
                                                            </DropdownMenuItem>
                                                        </>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                        <div className="text-sm line-clamp-2 md:line-clamp-3 cursor-pointer h-[40px] md:h-[60px] overflow-hidden" dangerouslySetInnerHTML={{ __html: note.text || t('No content')}} />
                                    </Card>
                                ))}
                                {(personal_notes?.data?.length || 0) === 0 && (
                                    <p className="text-center text-gray-400 py-8 text-sm">{t('No personal notes found')}</p>
                                )}
                            </div>
                        </div>

                        {/* Shared Notes Column */}
                        <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-3 md:p-4 flex flex-col h-full overflow-hidden">
                            <h3 className="font-semibold mb-3 md:mb-4 flex items-center gap-2 flex-shrink-0 text-sm md:text-base">
                                <Share2 className="h-4 w-4 md:h-5 md:w-5" />
                                {t('Shared Notes')} ({shared_notes?.data?.length || 0})
                            </h3>
                            <div className="space-y-2 overflow-y-auto flex-1 pr-1 md:pr-2">
                                {(shared_notes?.data || []).map((note: Note) => (
                                    <Card key={note.id} className="p-3 md:p-4 hover:shadow-md bg-white dark:bg-gray-800">
                                        <div className="flex items-start justify-between mb-2">
                                            <h4 className="font-medium flex-1 truncate text-sm md:text-base">{note.title}</h4>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleAction('view', note)}>
                                                        <Eye className="h-4 w-4 mr-2" />{t('View')}
                                                    </DropdownMenuItem>
                                                    {notePermissions?.update && (
                                                        <DropdownMenuItem onClick={() => handleAction('edit', note)}>
                                                            <Edit className="h-4 w-4 mr-2" />{t('Edit')}
                                                        </DropdownMenuItem>
                                                    )}
                                                    {notePermissions?.delete && (
                                                        <>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem onClick={() => handleAction('delete', note)} className="text-red-600">
                                                                <Trash2 className="h-4 w-4 mr-2" />{t('Delete')}
                                                            </DropdownMenuItem>
                                                        </>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                        <div className="text-sm line-clamp-2 md:line-clamp-3 cursor-pointer h-[40px] md:h-[60px] overflow-hidden" dangerouslySetInnerHTML={{ __html: note.text || t('No content') }} />
                                        <div className="flex items-center justify-between mt-2">
                                            <div className="flex items-center gap-1 text-xs text-gray-400">
                                                <Users className="h-3 w-3" />
                                                <span>{t('By')} {note.creator?.name}</span>
                                            </div>
                                            {note.assigned_users && note.assigned_users.length > 0 && (() => {
                                                const visible = note.assigned_users.slice(0, 3);
                                                const extra = note.assigned_users.length - 3;
                                                return (
                                                    <div className="flex -space-x-2">
                                                        {visible.map((u: any) => (
                                                            <Tooltip key={u.id}>
                                                                <TooltipTrigger asChild>
                                                                    <Avatar className="h-6 w-6 border-2 border-white dark:border-gray-800">
                                                                        <AvatarImage src={u.avatar} className="object-cover" />
                                                                        <AvatarFallback className="text-[9px] bg-primary/10 text-primary">{u.name.charAt(0)}</AvatarFallback>
                                                                    </Avatar>
                                                                </TooltipTrigger>
                                                                <TooltipContent>{u.name}</TooltipContent>
                                                            </Tooltip>
                                                        ))}
                                                        {extra > 0 && (
                                                            <div className="h-6 w-6 rounded-full border-2 border-white dark:border-gray-800 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-[9px] font-medium text-gray-600">
                                                                +{extra}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </Card>
                                ))}
                                {(shared_notes?.data?.length || 0) === 0 && (
                                    <p className="text-center text-gray-400 py-8 text-sm">{t('No shared notes found')}</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div>
                    {/* Personal Notes Section */}
                    {(selectedType === 'all' || selectedType === 'personal') && (
                        <div className="mb-6">
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <Users className="h-5 w-5 text-dark" />
                                {t('Personal Notes')} <span className="text-gray-500">({personal_notes?.data?.length || 0})</span>
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
                                {(personal_notes?.data || []).map((note: Note) => renderNoteCard(note))}
                            </div>
                            {(personal_notes?.data?.length || 0) === 0 && (
                                <div className="bg-white dark:bg-gray-900 rounded-lg border p-8 text-center">
                                    <StickyNote className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                                    <p className="text-sm text-gray-500">{t('No personal notes found')}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Shared Notes Section */}
                    {(selectedType === 'all' || selectedType === 'shared') && (
                        <div className="mb-6">
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <Share2 className="h-5 w-5 text-dark" />
                                {t('Shared Notes')} <span className="text-gray-500">({shared_notes?.data?.length || 0})</span>
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
                                {(shared_notes?.data || []).map((note: Note) => renderNoteCard(note))}
                            </div>
                            {(shared_notes?.data?.length || 0) === 0 && (
                                <div className="bg-white dark:bg-gray-900 rounded-lg border p-8 text-center">
                                    <StickyNote className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                                    <p className="text-sm text-gray-500">{t('No shared notes found')}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
            
            {/* Pagination - for grid view */}
            {activeView === 'grid' && personal_notes?.links && (() => {
                const currentPage = parseInt(pageFilters.notes_page || '1');
                const perPage = parseInt(pageFilters.per_page || '10');
                const totalRecords = total_personal_notes + total_shared_notes;
                const from = (currentPage - 1) * perPage + 1;
                const to = Math.min(currentPage * perPage, totalRecords);
                return (
                    <div className="mt-4 bg-white dark:bg-gray-800 border rounded-lg shadow overflow-hidden">
                        <Pagination
                            from={from}
                            to={to}
                            total={totalRecords}
                            links={personal_notes.links}
                            entityName={t('notes')}
                            currentPerPage={pageFilters.per_page?.toString() || '10'}
                            perPageOptions={[10, 25, 50, 100]}
                            onPerPageChange={(value) => { setLastGridPage(1); router.get(route('notes.index'), buildParams({ notes_page: 1, per_page: parseInt(value) }), { preserveState: false, preserveScroll: false }); }}
                            onPageChange={(url) => { const p = new URL(url, window.location.origin).searchParams.get('notes_page'); if (p) setLastGridPage(parseInt(p)); router.get(url, {}, { preserveState: true, preserveScroll: true }); }}
                        />
                    </div>
                );
            })()}

            {/* Modals */}
            <NoteFormModal
                isOpen={isFormModalOpen}
                onClose={() => {
                    setIsFormModalOpen(false);
                    setCurrentNote(null);
                }}
                note={currentNote}
                mode={modalMode}
                users={users}
            />

            {/* View Modal */}
            <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
                {currentNote && <NoteView record={currentNote} users={users} />}
            </Dialog>

            <CrudDeleteModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDeleteConfirm}
                itemName={currentNote?.title || ''}
                entityName="note"
            />
        </PageTemplate>
    );
}