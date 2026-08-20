import { useState, useEffect } from 'react';
import { router, usePage } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { SearchAndFilterBar } from '@/components/ui/search-and-filter-bar';
import { Pagination } from '@/components/ui/pagination';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Eye, Edit, Trash2, Video, Calendar, Clock, Users, Copy, Play, ExternalLink } from 'lucide-react';
import { PageTemplate } from '@/components/page-template';
import { CrudDeleteModal } from '@/components/CrudDeleteModal';
import { CrudTable } from '@/components/CrudTable';
import { toast } from '@/components/custom-toast';
import { hasPermission } from '@/utils/authorization';
import { useTranslation } from 'react-i18next';
import ZoomMeetingModal from './ZoomMeetingModal';
import { formatDateTime } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export default function ZoomMeetingIndex() {
    const { t } = useTranslation();
    const { auth, meetings, projects, members, hasZoomConfig, filters: pageFilters = {}, permissions, flash, googleCalendarEnabled } = usePage().props as any;
    
    const formatText = (text: string) => {
        return text.replace(/_/g, ' ').split(' ').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
    };
    
    const [searchTerm, setSearchTerm] = useState(pageFilters.search || '');
    const [selectedStatus, setSelectedStatus] = useState(pageFilters.status || 'all');
    const [selectedProject, setSelectedProject] = useState(pageFilters.project_id || 'all');
    const [showFilters, setShowFilters] = useState(false);
    const [pageInitialState, setPageInitialState] = useState(true);

    useEffect(() => {
        if (!pageInitialState) {
            router.get(route('zoom-meetings.index'), buildParams({ page: 1 }), { preserveState: false, preserveScroll: false });
        }
        setPageInitialState(false);
    }, [selectedStatus, selectedProject]);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [currentMeeting, setCurrentMeeting] = useState<any>(null);

    // Handle flash messages
    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
        if (flash?.error) {
            toast.error(flash.error);
        }
    }, [flash]);

    const buildParams = (
        overrides: Record<string, any> = {},
        stateOverrides: { search?: string; status?: string; project?: string } = {}
    ) => {
        const search  = stateOverrides.search  !== undefined ? stateOverrides.search  : searchTerm;
        const status  = stateOverrides.status  !== undefined ? stateOverrides.status  : selectedStatus;
        const project = stateOverrides.project !== undefined ? stateOverrides.project : selectedProject;

        const params: any = { page: 1 };
        if (search) params.search = search;
        if (status !== 'all') params.status = status;
        if (project !== 'all') params.project_id = project;
        if (pageFilters.per_page) params.per_page = pageFilters.per_page;
        if (pageFilters.sort_field) params.sort_field = pageFilters.sort_field;
        if (pageFilters.sort_direction) params.sort_direction = pageFilters.sort_direction;
        return { ...params, ...overrides };
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        router.get(route('zoom-meetings.index'), buildParams({ page: 1 }), { preserveState: false, preserveScroll: false });
    };

    const applyFilters = () => {
        router.get(route('zoom-meetings.index'), buildParams({ page: 1 }), { preserveState: false, preserveScroll: false });
    };

    const handleSort = (field: string) => {
        const direction = pageFilters.sort_field === field && pageFilters.sort_direction === 'asc' ? 'desc' : 'asc';
        router.get(route('zoom-meetings.index'), buildParams({ sort_field: field, sort_direction: direction, page: 1 }), { preserveState: false, preserveScroll: false });
    };

    // Handle actions for CrudTable
    const handleAction = (action: string, meeting: any) => {
        if (!meeting) return;

        switch (action) {
            case 'view':
                router.get(route('zoom-meetings.show', meeting.id));
                break;
            case 'edit':
                handleEditMeeting(meeting);
                break;
            case 'delete':
                handleDeleteMeeting(meeting);
                break;
            case 'join':
                handleJoinMeeting(meeting);
                break;
            case 'start':
                handleStartMeeting(meeting);
                break;
        }
    };

    const handleJoinMeeting = (meeting: any) => {
        if (meeting.join_url) {
            window.open(meeting.join_url, '_blank');
        }
    };

    const handleStartMeeting = (meeting: any) => {
        if (meeting.start_url) {
            window.open(meeting.start_url, '_blank');
        }
    };

    const handleEditMeeting = (meeting: any) => {
        setCurrentMeeting(meeting);
        setIsEditModalOpen(true);
    };

    const handleDeleteMeeting = (meeting: any) => {
        setCurrentMeeting(meeting);
        setIsDeleteModalOpen(true);
    };

    const handleDeleteConfirm = () => {
        toast.loading('Deleting meeting...');
        router.delete(route('zoom-meetings.destroy', currentMeeting.id), {
            onSuccess: () => {
                setIsDeleteModalOpen(false);
                toast.dismiss();
                if (flash?.success) {
                    toast.success(flash.success);
                }
            },
            onError: (errors) => {
                toast.dismiss();
                if (flash?.error) {
                    toast.error(flash.error);
                } else {
                    toast.error(t('Failed to delete meeting'));
                }
            }
        });
    };

    const getStatusColor = (status: string) => {
        const colors = {
            scheduled: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20',
            started: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20',
            ended: 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20',
            cancelled: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20',
        };
        return colors[status as keyof typeof colors] || colors.scheduled;
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
        const params: any = { page: 1 };
        if (pageFilters.per_page) params.per_page = pageFilters.per_page;
        router.get(route('zoom-meetings.index'), params, { preserveState: false, preserveScroll: false });
    };

    // CrudTable configuration
    const columns = [
        {
            key: 'title',
            label: t('Meeting'),
            sortable: true,
            render: (value: string, row: any) => (
                <div>
                    <div className="text-sm font-medium text-gray-900">
                        {value}
                    </div>
                    {row.description && (
                        <div className="text-sm text-gray-500 truncate max-w-xs">
                            {row.description}
                        </div>
                    )}
                </div>
            )
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
            key: 'start_time',
            label: t('Date & Time'),
            sortable: true,
            render: (value: string) => (
                <div className="flex items-center gap-1.5 text-sm whitespace-nowrap text-gray-500">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                    <span className="text-sm text-gray-500">
                    {value ? window.appSettings.formatDateTime(new Date(value)) : ''}</span>
                </div>
            )
        },
        {
            key: 'duration',
            label: t('Duration'),
            sortable: true,
            render: (value: number) => `${value} ${t('minutes')}`
        },
        {
            key: 'project.title',
            label: t('Project'),
            render: (value: string, row: any) => row.project?.title || '-'
        },
        {
            key: 'meeting_urls',
            label: t('URL'),
            render: (value: any, row: any) => (
                <div className="flex gap-1">
                    {row.join_url && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        window.open(row.join_url, '_blank');
                                        // navigator.clipboard.writeText(row.join_url);
                                        // toast.success(t('Join URL copied to clipboard'));
                                    }}
                                    className="bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-200 w-8 h-8 p-0 flex items-center justify-center size-7"
                                >
                                    <ExternalLink className="h-2.5 w-2.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('Join')}</TooltipContent>
                        </Tooltip>
                    )}
                    {row.start_url && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        window.open(row.start_url, '_blank');
                                        // navigator.clipboard.writeText(row.start_url);
                                        // toast.success(t('Start URL copied to clipboard'));
                                    }}
                                    className="bg-green-100 text-green-700 border-green-300 hover:bg-green-200 w-8 h-8 p-0 flex items-center justify-center size-7"
                                >
                                    <Play className="h-2.5 w-2.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('Start')}</TooltipContent>
                        </Tooltip>
                    )}
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
            condition: () => hasPermission(auth?.permissions, 'zoom_meeting_view')
        },
        {
            label: t('Edit'),
            icon: 'Edit',
            action: 'edit',
            className: 'text-gray-500 hover:text-gray-700',
            condition: () => hasPermission(auth?.permissions, 'zoom_meeting_update')
        },
        {
            label: t('Delete'),
            icon: 'Trash2',
            action: 'delete',
            className: 'text-gray-500 hover:text-gray-700',
            condition: () => hasPermission(auth?.permissions, 'zoom_meeting_delete')
        }
    ];

    // Show configuration message when Zoom is not configured
    if (!hasZoomConfig) {
        const userRoles = auth?.user?.roles?.map(role => role.name) || [];
        const canConfigureZoom = userRoles.includes('company') || userRoles.includes('owner');
        
        return (
            <PageTemplate title={t('Zoom Meetings')} description={t('Manage and schedule Zoom meetings.')} url="/zoom-meetings">
                <Card>
                    <CardContent className="p-6 text-center">
                        <Video className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                            {t('Zoom Integration Not Configured')}
                        </h3>
                        <p className="text-gray-500 mb-4">
                            {canConfigureZoom 
                                ? t('Please configure your Zoom API credentials in settings to use this feature.')
                                : t('Zoom integration has not been configured for this workspace. Please contact your administrator to set up Zoom credentials.')
                            }
                        </p>
                        {canConfigureZoom && (
                            <Button onClick={() => router.get(route('settings'))}>
                                {t('Configure Zoom Settings')}
                            </Button>
                        )}
                    </CardContent>
                </Card>
            </PageTemplate>
        );
    }

    const pageActions = [];
    
    if (hasPermission(auth?.permissions, 'zoom_meeting_create')) {
        pageActions.push({
            label: t('Create Meeting'),
            icon: <Plus className="h-4 w-4 mr-2" />,
            variant: 'default',
            onClick: () => {
                setIsCreateModalOpen(true);
            }
        });
    }
    
    const breadcrumbs = [
        { title: t('Dashboard'), href: route('dashboard') },
        { title: t('Zoom Meetings') }
    ];

    return (
        <PageTemplate 
            title={t('Zoom Meetings')} 
            url="/zoom-meetings"
            actions={pageActions}
            breadcrumbs={breadcrumbs}
            noPadding
        >
            {/* Search and filters section */}
            <div className="bg-white dark:bg-gray-900 rounded-lg border shadow mb-4">
                <SearchAndFilterBar
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    onSearch={handleSearch}
                    searchPlaceholder={t('Search meetings...')}
                    filters={[
                        {
                            name: 'status',
                            label: t('Status'),
                            type: 'select',
                            value: selectedStatus,
                            onChange: (value: string) => {
                                setSelectedStatus(value);
                                router.get(route('zoom-meetings.index'), buildParams({ page: 1 }, { status: value }), { preserveState: false, preserveScroll: false });
                            },
                            options: [
                                { value: 'all', label: t('All Status') },
                                { value: 'scheduled', label: t('Scheduled') },
                                { value: 'started', label: t('Started') },
                                { value: 'ended', label: t('Ended') },
                                { value: 'cancelled', label: t('Cancelled') },
                            ]
                        },
                        {
                            name: 'project_id',
                            label: t('Project'),
                            type: 'select',
                            searchable: true,
                            value: selectedProject,
                            onChange: (value: string) => {
                                setSelectedProject(value);
                                router.get(route('zoom-meetings.index'), buildParams({ page: 1 }, { project: value }), { preserveState: false, preserveScroll: false });
                            },
                            options: [
                                { value: 'all', label: t('All Projects') },
                                ...(projects?.map((p: any) => ({ value: p.id.toString(), label: p.title })) || [])
                            ]
                        },
                    ]}
                    hasActiveFilters={hasActiveFilters}
                    activeFilterCount={activeFilterCount}
                    onResetFilters={handleResetFilters}
                />
            </div>

            {/* Meetings Content */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <CrudTable
                    columns={columns}
                    actions={actions}
                    data={meetings?.data || []}
                    from={meetings?.from || 1}
                    onAction={handleAction}
                    sortField={pageFilters.sort_field}
                    sortDirection={pageFilters.sort_direction}
                    onSort={handleSort}
                    permissions={auth?.permissions || []}
                />
                {meetings?.links && meetings.data.length > 0 && (
                    <Pagination
                        from={meetings?.from || 0}
                        to={meetings?.to || 0}
                        total={meetings?.total || 0}
                        links={meetings?.links}
                        entityName={t('meetings')}
                        currentPerPage={pageFilters.per_page?.toString() || '10'}
                        onPerPageChange={(value) => router.get(route('zoom-meetings.index'), buildParams({ page: 1, per_page: parseInt(value) }), { preserveState: false, preserveScroll: false })}
                        onPageChange={(url) => {
                            const pageNum = new URL(url).searchParams.get('page');
                            router.get(route('zoom-meetings.index'), buildParams({ page: pageNum ? parseInt(pageNum) : 1 }), { preserveState: false, preserveScroll: false });
                        }}
                    />
                )}
            </div>

            {/* Empty State */}
            {meetings?.data?.length === 0 && (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                    <Video className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {t('No meetings found')}
                    </h3>
                    <p className="text-gray-500 mb-4">
                        {t('Get started by creating your first Zoom meeting.')}
                    </p>
                    {hasPermission(auth?.permissions, 'zoom_meeting_create') && (
                        <Button onClick={() => setIsCreateModalOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            {t('Create Meeting')}
                        </Button>
                    )}
                </div>
            )}

            {/* Create Modal */}
            <ZoomMeetingModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                projects={projects || []}
                members={members || []}
                googleCalendarEnabled={googleCalendarEnabled}
            />

            {/* Edit Modal */}
            <ZoomMeetingModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                meeting={currentMeeting}
                projects={projects || []}
                members={members || []}
                googleCalendarEnabled={googleCalendarEnabled}
            />

            {/* Delete Modal */}
            <CrudDeleteModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDeleteConfirm}
                itemName={currentMeeting?.title || ''}
                entityName={t('meeting')}
                warningMessage={t('This meeting will be permanently deleted from Zoom as well.')}
            />
        </PageTemplate>
    );
}