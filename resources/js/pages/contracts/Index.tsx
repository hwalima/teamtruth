import { useState, useEffect } from 'react';
import { router, usePage } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { SearchAndFilterBar } from '@/components/ui/search-and-filter-bar';
import { Pagination } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Eye, Edit, Trash2, LayoutGrid, List, Copy, Send, Download, CheckSquare, Calendar, AlertTriangle } from 'lucide-react';
import { PageTemplate } from '@/components/page-template';
import { CrudFormModal } from '@/components/CrudFormModal';
import { CrudDeleteModal } from '@/components/CrudDeleteModal';
import { CrudTable } from '@/components/CrudTable';
import { toast } from '@/components/custom-toast';
import { hasPermission } from '@/utils/authorization';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Contract {
    id: number;
    contract_id: string;
    subject: string;
    contract_value: number;
    currency: string;
    start_date: string;
    end_date: string;
    status: string;
    contract_type: {
        id: number;
        name: string;
        color: string;
    };
    client: {
        id: number;
        name: string;
        email: string;
        avatar: string;
    };
    creator: {
        id: number;
        name: string;
    };
    notes_count: number;
    comments_count: number;
    attachments_count: number;
    created_at: string;
}

const statusOptions = [
    { value: 'pending', label: 'Pending', color: '#ffc107' },
    { value: 'sent', label: 'Sent', color: '#007bff' },
    { value: 'accept', label: 'Accept', color: '#28a745' },
    { value: 'decline', label: 'Decline', color: '#dc3545' },
    { value: 'expired', label: 'Expired', color: '#fd7e14' },
];

export default function ContractsIndex() {
    const { t } = useTranslation();
    const { auth, contracts, contractTypes, clients, projects, filters: pageFilters = {}, errors, flash } = usePage().props as any;
    const permissions = auth?.permissions || [];
    
    const [activeView, setActiveView] = useState(pageFilters.view_mode || 'grid');
    const [searchTerm, setSearchTerm] = useState(pageFilters.search || '');
    const [selectedStatus, setSelectedStatus] = useState(pageFilters.status || 'all');
    const [selectedType, setSelectedType] = useState(pageFilters.contract_type_id || 'all');
    const [selectedClient, setSelectedClient] = useState(pageFilters.client_id || 'all');
    const [selectedProject, setSelectedProject] = useState(pageFilters.project_id || 'all');
    const [filteredProjects, setFilteredProjects] = useState([]);
    const [showFilters, setShowFilters] = useState(false);
    const [pageInitialState, setPageInitialState] = useState(true);
    useEffect(() => {
        if (!pageInitialState) applyFilters();
        setPageInitialState(false);
    }, [selectedStatus, selectedType, selectedClient, selectedProject]);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState<any>(null);
    const [formMode, setFormMode] = useState<'create' | 'edit' | 'view'>('create');
    const [formClientId, setFormClientId] = useState<string | null>(null);
    const [formProjects, setFormProjects] = useState([]);
    const [modalKey, setModalKey] = useState(0);

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
        if (flash?.error) {
            toast.error(flash.error);
        }
    }, [flash]);

    useEffect(() => {
        if (selectedClient !== 'all') {
            const clientProjects = projects?.filter((project: any) => {
                if (!project.clients || !Array.isArray(project.clients) || project.clients.length === 0) {
                    return false;
                }
                return project.clients.some((client: any) => client.id?.toString() === selectedClient);
            }) || [];
            setFilteredProjects(clientProjects);
            if (selectedProject !== 'all' && !clientProjects.find((p: any) => p.id.toString() === selectedProject)) {
                setSelectedProject('all');
            }
        } else {
            setFilteredProjects([]);
        }
    }, [selectedClient, projects]);

    const buildParams = (
        overrides: Record<string, any> = {},
        stateOverrides: { search?: string; status?: string; type?: string; client?: string; project?: string; view?: string } = {}
    ) => {
        const view    = stateOverrides.view    !== undefined ? stateOverrides.view    : activeView;
        const search  = stateOverrides.search  !== undefined ? stateOverrides.search  : searchTerm;
        const status  = stateOverrides.status  !== undefined ? stateOverrides.status  : selectedStatus;
        const type    = stateOverrides.type    !== undefined ? stateOverrides.type    : selectedType;
        const client  = stateOverrides.client  !== undefined ? stateOverrides.client  : selectedClient;
        const project = stateOverrides.project !== undefined ? stateOverrides.project : selectedProject;

        const params: any = { page: 1, view_mode: view };
        if (search) params.search = search;
        if (status !== 'all') params.status = status;
        if (type !== 'all') params.contract_type_id = type;
        if (client !== 'all') params.client_id = client;
        if (project !== 'all') params.project_id = project;
        if (pageFilters.per_page) params.per_page = pageFilters.per_page;
        if (pageFilters.sort_field) params.sort_field = pageFilters.sort_field;
        if (pageFilters.sort_direction) params.sort_direction = pageFilters.sort_direction;
        return { ...params, ...overrides };
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        router.get(route('contracts.index'), buildParams({ page: 1 }), { preserveState: false, preserveScroll: false });
    };

    const applyFilters = () => {
        router.get(route('contracts.index'), buildParams({ page: 1 }), { preserveState: false, preserveScroll: false });
    };

    const handleSort = (field: string) => {
        const direction = pageFilters.sort_field === field && pageFilters.sort_direction === 'asc' ? 'desc' : 'asc';
        router.get(route('contracts.index'), buildParams({ sort_field: field, sort_direction: direction, page: 1 }), { preserveState: false, preserveScroll: false });
    };

    const handleStatusFilter = (value: string) => {
        setSelectedStatus(value);
        router.get(route('contracts.index'), buildParams({ page: 1 }, { status: value }), { preserveState: false, preserveScroll: false });
    };

    const handleResetFilters = () => {
        setSearchTerm('');
        setSelectedStatus('all');
        setSelectedType('all');
        setSelectedClient('all');
        setSelectedProject('all');
        const params: any = { page: 1, view_mode: activeView };
        if (pageFilters.per_page) params.per_page = pageFilters.per_page;
        router.get(route('contracts.index'), params, { preserveState: false, preserveScroll: false });
    };

    const handleAction = (action: string, item: any) => {
        setCurrentItem(item);
        switch (action) {
            case 'view':
                router.get(route('contracts.show', item.id));
                break;
            case 'edit':
                setFormMode('edit');
                const clientId = item.client_id?.toString() || null;
                setFormClientId(clientId);
                if (clientId) {
                    const clientProjects = projects?.filter((project: any) => 
                        project.clients?.some((client: any) => client.id?.toString() === clientId)
                    ) || [];
                    setFormProjects(clientProjects);
                } else {
                    setFormProjects([]);
                }
                setModalKey(prev => prev + 1);
                setIsFormModalOpen(true);
                break;
            case 'delete':
                setIsDeleteModalOpen(true);
                break;
            case 'duplicate':
                toast.loading(t('Duplicating contract...'));
                router.post(route('contracts.duplicate', item.id), {}, {
                    onSuccess: () => {
                        toast.dismiss();
                        router.reload();
                    },
                    onError: () => {
                        toast.dismiss();
                        toast.error(t('Failed to duplicate contract'));
                    }
                });
                break;
            case 'send':
                router.post(route('contracts.send-contract-email', item.id));
                break;
        }
    };
    
    const handleAddNew = () => {
        setCurrentItem(null);
        setFormMode('create');
        setFormClientId(null);
        setFormProjects([]);
        setModalKey(prev => prev + 1);
        setIsFormModalOpen(true);
    };
    
    const handleFormSubmit = (formData: any) => {
        if (formMode === 'create') {
            toast.loading(t('Creating contract...'));
            router.post(route('contracts.store'), formData, {
                onSuccess: () => {
                    setIsFormModalOpen(false);
                    toast.dismiss();
                },
                onError: (errors) => {
                    toast.dismiss();
                    toast.error(t('Failed to create contract'));
                }
            });
        } else if (formMode === 'edit') {
            toast.loading(t('Updating contract...'));
            router.put(route('contracts.update', currentItem.id), formData, {
                onSuccess: () => {
                    setIsFormModalOpen(false);
                    toast.dismiss();
                },
                onError: (errors) => {
                    toast.dismiss();
                    toast.error(t('Failed to update contract'));
                }
            });
        }
    };
    
    const handleDeleteConfirm = () => {
        toast.loading(t('Deleting contract...'));
        router.delete(route('contracts.destroy', currentItem.id), {
            onSuccess: () => {
                setIsDeleteModalOpen(false);
                toast.dismiss();
            },
            onError: (errors) => {
                toast.dismiss();
                toast.error(t('Failed to delete contract'));
            }
        });
    };
    
    const hasActiveFilters = () => {
        return selectedStatus !== 'all' || selectedType !== 'all' || selectedClient !== 'all' || selectedProject !== 'all' || searchTerm !== '';
    };
    
    const activeFilterCount = () => {
        return (selectedStatus !== 'all' ? 1 : 0) + (selectedType !== 'all' ? 1 : 0) + (selectedClient !== 'all' ? 1 : 0) + (selectedProject !== 'all' ? 1 : 0) + (searchTerm ? 1 : 0);
    };

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            pending: 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20',
            sent: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20',
            accept: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20',
            decline: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20',
            expired: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20',
        };
        return colors[status] || 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20';
    };

    const getStatusBadge = (status: string) => {
        const statusOption = statusOptions.find(s => s.value === status);
        const label = statusOption?.label || status.charAt(0).toUpperCase() + status.slice(1);
        return (
            <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${getStatusColor(status)}`}>
                {label}
            </span>
        );
    };

    const pageActions = [];
    
    if (hasPermission(permissions, 'contract_create')) {
        pageActions.push({
            label: t('Add Contract'),
            icon: <Plus className="h-4 w-4 mr-2" />,
            variant: 'default',
            onClick: handleAddNew
        });
    }
    
    const breadcrumbs = [
        { title: t('Dashboard'), href: route('dashboard') },
        { title: t('Contracts') }
    ];
    
    return (
        <PageTemplate 
            title={t('Contracts')}
            description={t('Manage and track your client contracts.')} 
            url="/contracts"
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
                    searchPlaceholder={t('Search contracts...')}
                    filters={[
                        {
                            name: 'status',
                            label: t('Status'),
                            type: 'select',
                            value: selectedStatus,
                            onChange: handleStatusFilter,
                            options: [
                                { value: 'all', label: t('All Status') },
                                ...statusOptions.map(s => ({ value: s.value, label: s.label }))
                            ]
                        },
                        {
                            name: 'contract_type_id',
                            label: t('Type'),
                            type: 'select',
                            value: selectedType,
                            onChange: (value: string) => {
                                setSelectedType(value);
                                router.get(route('contracts.index'), buildParams({ page: 1 }, { type: value }), { preserveState: false, preserveScroll: false });
                            },
                            options: [
                                { value: 'all', label: t('All Types') },
                                ...(contractTypes?.map((type: any) => ({ value: type.id.toString(), label: type.name })) || [])
                            ]
                        },
                        {
                            name: 'client_id',
                            label: t('Client'),
                            type: 'select',
                            searchable: true,
                            value: selectedClient,
                            onChange: (value: string) => {
                                setSelectedClient(value);
                                router.get(route('contracts.index'), buildParams({ page: 1 }, { client: value }), { preserveState: false, preserveScroll: false });
                            },
                            options: [
                                { value: 'all', label: t('All Clients') },
                                ...(clients?.map((client: any) => ({ value: client.id.toString(), label: client.name })) || [])
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
                                router.get(route('contracts.index'), buildParams({ page: 1 }, { project: value }), { preserveState: false, preserveScroll: false });
                            },
                            options: [
                                { value: 'all', label: t('All Projects') },
                                ...(filteredProjects?.map((project: any) => ({ value: project.id.toString(), label: project.title })) || [])
                            ]
                        },
                    ]}
                    hasActiveFilters={hasActiveFilters}
                    activeFilterCount={activeFilterCount}
                    onResetFilters={handleResetFilters}
                    showViewToggle={false}
                    activeView={activeView}
                    onViewChange={(view) => {
                        setActiveView(view);
                        router.get(route('contracts.index'), buildParams({ page: 1, view_mode: view }, { view }), { preserveState: false, preserveScroll: false });
                    }}
                    // viewOptions={[
                    //     // { value: 'list', label: t('List'), icon: 'List' },
                    //     // { value: 'grid', label: t('Grid'), icon: 'Grid3X3' },
                    // ]}
                />
            </div>

            {/* Contracts Content */}
            {/* {(activeView === 'grid' || !activeView) ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {contracts?.data?.map((contract: any) => (
                    <Card key={contract.id} className="overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                        <CardHeader className="pb-1">
                            <div className="flex justify-between items-start gap-2">
                                <CardTitle 
                                    className="text-base line-clamp-2 cursor-pointer hover:text-blue-600 transition-colors flex items-center gap-2 flex-1 font-bold"
                                    onClick={() => router.get(route('contracts.show', contract.id))}
                                >
                                    <span>{contract.subject}</span>
                                </CardTitle>
                                <div className="flex-shrink-0">
                                    {getStatusBadge(contract.status)}
                                </div>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                                {t('By')} {contract.creator?.name} • {window.appSettings.formatDateTime(new Date(contract.created_at),false)}
                            </div>
                        </CardHeader>
                        
                        <CardContent className="py-2 flex-grow">
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium"
                                        style={{
                                            backgroundColor: contract.contract_type?.color + '20',
                                            color: contract.contract_type?.color,
                                            boxShadow: `inset 0 0 0 1px ${contract.contract_type?.color}33`,
                                        }}
                                    >
                                        {contract.contract_type?.name}
                                    </span>
                                    <span className="text-muted-foreground text-xs">
                                        {window.appSettings.formatDateTime(new Date(contract.end_date),false)}
                                    </span>
                                </div>
                                
                                <div>
                                    <span className="font-bold text-base">
                                        {window.appSettings.formatCurrency(contract.contract_value?.toLocaleString())}
                                    </span>
                                </div>
                                
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    <span>{contract.notes_count} {t('notes')}</span>
                                    <span>{contract.comments_count} {t('comments')}</span>
                                    <span>{contract.attachments_count} {t('files')}</span>
                                </div>
                            </div>
                        </CardContent>
                        
                        <CardFooter className="flex justify-end gap-1 pt-1 pb-1 mt-auto">
                            {hasPermission(permissions, 'contract_create') && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => handleAction('duplicate', contract)}
                                            className="text-gray-500 hover:text-gray-700 h-8 w-8"
                                        >
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>{t('Duplicate')}</TooltipContent>
                                </Tooltip>
                            )}
                            {hasPermission(permissions, 'contract_view') && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => handleAction('view', contract)}
                                            className="text-gray-500 hover:text-gray-700 h-8 w-8"
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>{t('View')}</TooltipContent>
                                </Tooltip>
                            )}
                            {hasPermission(permissions, 'contract_update') && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => handleAction('edit', contract)}
                                            className="text-gray-500 hover:text-gray-700 h-8 w-8"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>{t('Edit')}</TooltipContent>
                                </Tooltip>
                            )}
                            {hasPermission(permissions, 'contract_delete') && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button 
                                            variant="ghost" 
                                            size="icon"
                                            className="text-gray-500 hover:text-gray-700 h-8 w-8"
                                            onClick={() => handleAction('delete', contract)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>{t('Delete')}</TooltipContent>
                                </Tooltip>
                            )}
                        </CardFooter>
                    </Card>
                ))}
                {contracts?.data?.length === 0 && (
                    <div className="bg-white rounded-lg shadow p-8 text-center col-span-full">
                        <CheckSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p className="text-gray-500 mb-4">{t('No contracts found')}</p>
                        {hasPermission(permissions, 'contract_create') && (
                            <Button onClick={handleAddNew}>
                                <Plus className="h-4 w-4 mr-2" />
                                {t('Create your first contract')}
                            </Button>
                        )}
                    </div>
                )}
                </div>
                
            ) : ( */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <CrudTable
                        columns={[
                            {
                                key: 'subject',
                                label: t('Contract'),
                                sortable: true,
                                render: (value: string, row: any) => (
                                    <div className="flex items-center gap-2">
                                        <div>
                                            <div 
                                                className="text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                                                onClick={() => router.get(route('contracts.show', row.id))}
                                            >
                                                {value}
                                            </div>
                                            <div className="text-sm text-gray-500">{row.contract_id}</div>
                                        </div>
                                    </div>
                                )
                            },
                            {
                                key: 'client.name',
                                label: t('Client'),
                                sortable: false,
                                render: (value: string, row: any) => (
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10 rounded-full object-cover">
                                                <AvatarImage src={row.client?.avatar} />
                                                <AvatarFallback>{row.client?.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                        <div className="flex flex-col">
                                            <div className="text-sm font-medium text-gray-900">{row.client?.name}</div>
                                            <div className="text-sm text-gray-500">{row.client?.email}</div>
                                        </div>
                                    </div>
                                )
                            },
                            {
                                key: 'contract_type.name',
                                label: t('Type'),
                                sortable: true,
                                render: (value: string, row: any) => (
                                    <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium"
                                        style={{
                                            backgroundColor: row.contract_type?.color + '20',
                                            color: row.contract_type?.color,
                                            boxShadow: `inset 0 0 0 1px ${row.contract_type?.color}33`,
                                        }}
                                    >
                                        {row.contract_type?.name}
                                    </span>
                                )
                            },
                            {
                                key: 'contract_value',
                                label: t('Value'),
                                sortable: true,
                                render: (value: number) => (
                                    <span className="text-sm font-medium font-mono">
                                        {window.appSettings.formatCurrency(value?.toLocaleString())}
                                    </span>
                                )
                            },
                            {
                                key: 'status',
                                label: t('Status'),
                                sortable: true,
                                render: (value: string) => getStatusBadge(value)
                            },
                            {
                                key: 'end_date',
                                label: t('End Date'),
                                sortable: true,
                                render: (value: string) => (
                                    <div>
                                        <div className={`flex items-center gap-1.5 text-sm whitespace-nowrap ${new Date(value) < new Date() ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                                            <Calendar className="h-3.5 w-3.5 shrink-0" />
                                            <span>{window.appSettings.formatDateTime(new Date(value), false)}</span>
                                        </div>
                                    </div>
                                )
                            }
                        ]}
                        actions={[
                            {
                                label: t('Duplicate'),
                                icon: 'Copy',
                                action: 'duplicate',
                                className: 'text-gray-500 hover:text-gray-700',
                                condition: () => hasPermission(permissions, 'contract_create')
                            },
                            {
                                label: t('View'),
                                icon: 'Eye',
                                action: 'view',
                                className: 'text-gray-500 hover:text-gray-700',
                                condition: () => hasPermission(permissions, 'contract_view')
                            },
                            {
                                label: t('Edit'),
                                icon: 'Edit',
                                action: 'edit',
                                className: 'text-gray-500 hover:text-gray-700',
                                condition: () => hasPermission(permissions, 'contract_update')
                            },
                            {
                                label: t('Delete'),
                                icon: 'Trash2',
                                action: 'delete',
                                className: 'text-gray-500 hover:text-gray-700',
                                condition: () => hasPermission(permissions, 'contract_delete')
                            }
                        ]}
                        data={contracts?.data || []}
                        from={contracts?.from || 1}
                        onAction={handleAction}
                        sortField={pageFilters.sort_field}
                        sortDirection={pageFilters.sort_direction}
                        onSort={handleSort}
                        permissions={permissions}
                    />
                    
                    {/* Pagination for list view */}
                    {contracts?.links && (
                        <Pagination
                            from={contracts?.from || 0}
                            to={contracts?.to || 0}
                            total={contracts?.total || 0}
                            links={contracts?.links}
                            entityName={t('contracts')}
                            currentPerPage={pageFilters.per_page?.toString() || '10'}
                            onPerPageChange={(value) => router.get(route('contracts.index'), buildParams({ page: 1, per_page: parseInt(value) }), { preserveState: false, preserveScroll: false })}
                            onPageChange={(url) => {
                                const pageNum = new URL(url).searchParams.get('page');
                                router.get(route('contracts.index'), buildParams({ page: pageNum ? parseInt(pageNum) : 1 }), { preserveState: false, preserveScroll: false });
                            }}
                        />
                    )}
                </div>
            {/* )} */}
            
            {/* Pagination for grid view */}
            {/* {activeView === 'grid' && contracts?.links && (
            <div className="mt-4 bg-white dark:bg-gray-800 border rounded-lg shadow overflow-hidden">
                    <Pagination
                        from={contracts?.from || 0}
                        to={contracts?.to || 0}
                        total={contracts?.total || 0}
                        links={contracts?.links}
                        entityName={t('contracts')}
                        currentPerPage={pageFilters.per_page?.toString() || '10'}
                        onPerPageChange={(value) => router.get(route('contracts.index'), buildParams({ page: 1, per_page: parseInt(value) }), { preserveState: false, preserveScroll: false })}
                        onPageChange={(url) => {
                            const pageNum = new URL(url).searchParams.get('page');
                            router.get(route('contracts.index'), buildParams({ page: pageNum ? parseInt(pageNum) : 1 }), { preserveState: false, preserveScroll: false });
                        }}
                    />
                </div>
            )} */}
            
            {/* Form Modal */}
            <CrudFormModal
                key={modalKey}
                isOpen={isFormModalOpen}
                onClose={() => {
                    setIsFormModalOpen(false);
                    setFormClientId(null);
                    setFormProjects([]);
                }}
                onSubmit={handleFormSubmit}
                submitButtonText={formMode === 'create' ? t('Create') : t('Update')}
                formConfig={{
                    fields: [
                        { name: 'subject', label: t('Subject'), type: 'text', required: true, placeholder: t('Enter contract subject') },
                        { name: 'description', label: t('Description'), type: 'textarea', placeholder: t('Enter contract description') },
                        { 
                            name: 'contract_type_id', 
                            label: t('Contract Type'), 
                            type: 'select',
                            required: true,
                            placeholder: t('Select contract type'),
                            options: contractTypes?.map((type: any) => ({ value: type.id, label: type.name })) || []
                        },
                        { name: 'contract_value', label: t('Contract Value'), type: 'number', min: 0, required: true, placeholder: t('Enter contract value') },
                        { name: 'start_date', label: t('Start Date'), type: 'date', required: true, placeholder: t('Select start date') },
                        { name: 'end_date', label: t('End Date'), type: 'date', required: true, placeholder: t('Select end date') },
                        { 
                            name: 'client_id', 
                            label: t('Client'), 
                            type: 'select',
                            required: true,
                            placeholder: t('Select client'),
                            options: clients?.map((client: any) => ({ value: client.id, label: client.name })) || []
                        },
                        { 
                            name: 'project_id', 
                            label: t('Project'), 
                            type: 'select',
                            options: [],
                            placeholder: t('Select project'),
                            conditional: (mode: string, formData: any) => {
                                if (formData.client_id) {
                                    return true;
                                }
                                return false;
                            },
                            render: (field: any, formData: any, handleChange: any) => {
                                const clientId = formData.client_id;
                                const filteredProjects = clientId ? projects?.filter((project: any) => 
                                    project.clients?.some((client: any) => client.id?.toString() === clientId.toString())
                                ) || [] : [];
                                
                                const projectOptions = filteredProjects.map((project: any) => ({ 
                                    value: project.id, 
                                    label: project.title 
                                }));
                                
                                return (
                                    <Select
                                        value={formData[field.name] ? String(formData[field.name]) : ''}
                                        onValueChange={(value) => handleChange(field.name, value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={t('Select project')} />
                                        </SelectTrigger>
                                        <SelectContent searchable className="z-[60000]">
                                            {projectOptions.map((option: any) => (
                                                <SelectItem key={option.value} value={String(option.value)}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                );
                            }
                        }
                    ],
                    modalSize: 'xl'
                }}
                initialData={currentItem || {
                    status: 'pending'
                }}
                title={
                    formMode === 'create' 
                        ? t('Add Contract') 
                        : formMode === 'edit' 
                            ? t('Edit Contract') 
                            : t('View Contract')
                }
                mode={formMode}
            />

            {/* Delete Modal */}
            <CrudDeleteModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDeleteConfirm}
                itemName={currentItem?.subject || ''}
                entityName={t('contract')}
                warningMessage={t('All contract data including notes, comments, and attachments will be permanently lost.')}
                additionalInfo={[
                    t('Contract notes and comments'),
                    t('File attachments'),
                    t('Contract history'),
                    t('Related activities')
                ]}
            />
        </PageTemplate>
    );
}