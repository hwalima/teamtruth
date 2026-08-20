import { useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowLeft, Edit, Plus, Pin, PinOff, Trash2, Users, Calendar, DollarSign, Clock, User, Eye, Receipt, CheckSquare, Timer, CheckCircle, AlertTriangle, BarChart3, CreditCard, Columns, Paperclip, Download, Upload, Search, Bug, Link, Settings, Shield, FileText, FileSpreadsheet, FileArchive, FileCode, File } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageTemplate } from '@/components/page-template';
import { CrudFormModal } from '@/components/CrudFormModal';
import { CrudDeleteModal } from '@/components/CrudDeleteModal';
import { toast } from '@/components/custom-toast';
import { hasPermission } from '@/utils/authorization';
import { useTranslation } from 'react-i18next';
import { getTimesheetLabel, formatHoursDisplay, isTimesheetOverdue, getDaysOverdue } from '@/utils/timesheetUtils';
import { SearchAndFilterBar } from '@/components/ui/search-and-filter-bar';
import { Pagination } from '@/components/ui/pagination';
import { formatCurrency } from '@/utils/currency';
import MediaPicker from '@/components/MediaPicker';
import TimesheetFormModal from '@/components/timesheets/TimesheetFormModal';
import SharedProjectSettingsModal from '@/components/projects/SharedProjectSettingsModal';
import { getImagePath } from '@/utils/helpers';


export default function ProjectShow() {
    const { t } = useTranslation();
    const { auth, project, budget = null, members, managers, clients, projectTasks = [], projectBugs = [], projectTimesheets = [], canDeleteProject, canViewBudget, canManageSharedSettings, attachmentFilters = {}, activityFilters = {} } = usePage().props as any;
    const permissions = auth?.permissions || [];

    // Get expenses from project relationship
    const projectExpenses = project?.expenses || [];

    const formatText = (text: string) => {
        if (!text) return '';
        return text.replace(/_/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
    };

    // Permission-based access control
    const canEditProject = hasPermission(permissions, 'project_update');
    const canManageProject = hasPermission(permissions, 'project_assign_members') || hasPermission(permissions, 'project_assign_clients') || hasPermission(permissions, 'project_manage_notes');
    const canManageBudget = hasPermission(permissions, 'project_manage_budget');
    const canViewBudgetPermission = hasPermission(permissions, 'budget_view') || hasPermission(permissions, 'budget_view_any');
    const canCreateBudget = hasPermission(permissions, 'budget_create');
    const canManageAttachments = hasPermission(permissions, 'project_manage_attachments');
    const canManageNotes = hasPermission(permissions, 'project_manage_notes');
    const canTrackProgress = hasPermission(permissions, 'project_track_progress');

    // Only use permission-based check for budget access
    const hasViewBudgetAccess = canViewBudgetPermission;

    const [activeTab, setActiveTab] = useState('overview');
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState<any>(null);
    const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
    const [modalType, setModalType] = useState<'milestone' | 'note' | 'client' | 'member' | 'manager' | 'project' | 'attachment'>('milestone');
    const [isTimesheetModalOpen, setIsTimesheetModalOpen] = useState(false);
    const [selectedAttachments, setSelectedAttachments] = useState('');
    const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
    const [isSharedSettingsModalOpen, setIsSharedSettingsModalOpen] = useState(false);
    const [viewNote, setViewNote] = useState<any>(null);


    // Pagination states
    const [milestonesPage, setMilestonesPage] = useState(1);

    const [attachmentSearch, setAttachmentSearch] = useState(attachmentFilters?.attachment_search || '');
    const [attachmentsPerPage, setAttachmentsPerPage] = useState(attachmentFilters?.attachments_per_page || 12);

    const itemsPerPage = 6;

    // Reset pagination when switching tabs
    const handleTabChange = (value: string) => {
        setActiveTab(value);
        if (value === 'milestones') setMilestonesPage(1);

    };

    const handleAttachmentSearch = () => {
        const params: any = { attachments_page: 1 };
        if (attachmentSearch) params.attachment_search = attachmentSearch;
        if (attachmentsPerPage !== 12) params.attachments_per_page = attachmentsPerPage;

        router.get(route('projects.show', project.id), params, {
            preserveState: true,
            preserveScroll: true,
            only: ['project', 'attachmentFilters']
        });
    };

    const handleAttachmentPerPageChange = (value: string) => {
        const newPerPage = parseInt(value);
        setAttachmentsPerPage(newPerPage);

        const params: any = { attachments_page: 1, attachments_per_page: newPerPage };
        if (attachmentSearch) params.attachment_search = attachmentSearch;

        router.get(route('projects.show', project.id), params, {
            preserveState: true,
            preserveScroll: true,
            only: ['project', 'attachmentFilters']
        });
    };

    const getStatusColor = (status: string) => {
        const colors = {
            planning: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20',
            active: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20',
            on_hold: 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20',
            completed: 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20',
            cancelled: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20'
        };
        return colors[status as keyof typeof colors] || 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20';
    };

    const getMilestoneStatusColor = (status: string) => {
        const colors = {
            pending: 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20',
            in_progress: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20',
            completed: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20',
            cancelled: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20',
            on_hold: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20'
        };
        return colors[status as keyof typeof colors] || 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20';
    };

    const getPriorityColor = (priority: string) => {
        const colors = {
            low: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20',
            medium: 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20',
            high: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20',
            urgent: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20'
        };
        return colors[priority as keyof typeof colors] || 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20';
    };

    const handleAction = (action: string, item: any = null, type: string = '') => {
        setCurrentItem(item);

        switch (action) {
            case 'add-milestone':
                setModalType('milestone');
                setFormMode('create');
                setIsFormModalOpen(true);
                break;
            case 'edit-milestone':
                setModalType('milestone');
                setFormMode('edit');
                setIsFormModalOpen(true);
                break;
            case 'delete-milestone':
                setIsDeleteModalOpen(true);
                break;
            case 'add-note':
                setModalType('note');
                setFormMode('create');
                setIsFormModalOpen(true);
                break;
            case 'edit-note':
                setModalType('note');
                setFormMode('edit');
                setIsFormModalOpen(true);
                break;
            case 'delete-note':
                setIsDeleteModalOpen(true);
                break;
            case 'invite-client':
                setModalType('client');
                setFormMode('create');
                setIsFormModalOpen(true);
                break;
            case 'invite-member':
                setModalType('member');
                setFormMode('create');
                setIsFormModalOpen(true);
                break;
            case 'invite-manager':
                setModalType('manager');
                setFormMode('create');
                setIsFormModalOpen(true);
                break;
            case 'toggle-pin':
                router.put(route('project-notes.toggle-pin', [project.id, item.id]));
                break;
            case 'add-attachment':
                setCurrentItem({ media_ids: [] });
                setModalType('attachment');
                setFormMode('create');
                setIsFormModalOpen(true);
                break;
            case 'delete-attachment':
                setIsDeleteModalOpen(true);
                break;
        }
    };

    const handleFormSubmit = (formData: any) => {
        let routeName = '';
        let routeParams: any[] = [];

        switch (modalType) {
            case 'milestone':
                routeName = formMode === 'create' ? 'project-milestones.store' : 'project-milestones.update';
                routeParams = formMode === 'create' ? [project.id] : [project.id, currentItem.id];
                break;
            case 'note':
                routeName = formMode === 'create' ? 'project-notes.store' : 'project-notes.update';
                routeParams = formMode === 'create' ? [project.id] : [project.id, currentItem.id];
                break;
            case 'client':
                routeName = 'projects.assign-clients';
                routeParams = [project.id];
                break;
            case 'member':
                routeName = 'projects.assign-members';
                routeParams = [project.id];
                break;
            case 'manager':
                routeName = 'projects.assign-managers';
                routeParams = [project.id];
                break;
            case 'project':
                routeName = 'projects.update';
                routeParams = [project.id];
                break;
            case 'budget':
                routeName = 'projects.create-budget';
                routeParams = [project.id];
                break;
            case 'attachment':
                // Handle attachment upload - check both formData and currentItem for media_ids
                const mediaIds = formData.media_ids || currentItem?.media_ids || [];
                // Debug: Check available media IDs

                if (mediaIds && mediaIds.length > 0) {
                    setIsUploadingAttachment(true);
                    router.post(route('project-attachments.store', project.id), {
                        media_ids: mediaIds
                    }, {
                        onSuccess: () => {
                            setIsFormModalOpen(false);
                            setSelectedAttachments('');
                            setCurrentItem(null);
                            setIsUploadingAttachment(false);
                            toast.success('Attachments uploaded successfully');
                        },
                        onError: (errors) => {
                            setIsUploadingAttachment(false);
                            toast.error(`Failed: ${Object.values(errors).join(', ')}`);
                        }
                    });
                    return;
                }

                // Also check if selectedAttachments has URLs that we can extract media IDs from
                if (selectedAttachments) {
                    // Try to extract media IDs from URLs
                    const urlMediaIds = selectedAttachments.split(',').map(url => {
                        const match = url.trim().match(/\/media\/(\d+)/);
                        return match ? parseInt(match[1]) : null;
                    }).filter(Boolean);

                    if (urlMediaIds.length > 0) {
                        setIsUploadingAttachment(true);
                        router.post(route('project-attachments.store', project.id), {
                            media_ids: urlMediaIds
                        }, {
                            onSuccess: () => {
                                setIsFormModalOpen(false);
                                setSelectedAttachments('');
                                setCurrentItem(null);
                                setIsUploadingAttachment(false);
                                toast.success('Attachments uploaded successfully');
                            },
                            onError: (errors) => {
                                setIsUploadingAttachment(false);
                                toast.error(`Failed: ${Object.values(errors).join(', ')}`);
                            }
                        });
                        return;
                    }
                }

                toast.error('Please select attachments to upload');
                return;
        }

        // For attachment uploads, handle differently
        if (modalType === 'attachment') {
            // This is handled in the attachment case above
            return;
        }

        const method = formMode === 'create' ? 'post' : 'put';
        toast.loading(`${formMode === 'create' ? 'Creating' : 'Updating'}...`);

        const routeUrl = routeParams.length === 2 ?
            route(routeName, modalType === 'milestone' ?
                { project: routeParams[0], milestone: routeParams[1] } :
                { project: routeParams[0], note: routeParams[1] }
            ) :
            route(routeName, routeParams[0]);

        router[method](routeUrl, formData, {
            onSuccess: () => {
                setIsFormModalOpen(false);
                toast.dismiss();
                toast.success(`${modalType} ${formMode === 'create' ? 'created' : 'updated'} successfully`);
            },
            onError: (errors) => {
                toast.dismiss();
                toast.error(`Failed: ${Object.values(errors).join(', ')}`);
            }
        });
    };

    const handleDeleteConfirm = () => {
        let routeName = '';
        let routeParams: any[] = [];

        switch (modalType) {
            case 'milestone':
                routeName = 'project-milestones.destroy';
                routeParams = [project.id, currentItem.id];
                break;
            case 'note':
                routeName = 'project-notes.destroy';
                routeParams = [project.id, currentItem.id];
                break;
            case 'attachment':
                routeName = 'project-attachments.destroy';
                routeParams = [currentItem.id];
                break;
            case 'member':
                routeName = 'projects.remove-member';
                routeParams = [project.id, currentItem.user?.id || currentItem.id];
                break;
            case 'client':
                routeName = 'projects.remove-client';
                routeParams = [project.id, currentItem.id];
                break;
            default:
                return;
        }

        toast.loading('Removing...');

        router.delete(route(routeName, routeParams), {
            onSuccess: () => {
                setIsDeleteModalOpen(false);
                toast.dismiss();
                toast.success(`${modalType === 'member' ? 'Team member' : modalType} removed successfully`);
            },
            onError: (errors) => {
                toast.dismiss();
                toast.error(`Failed to remove: ${Object.values(errors).join(', ')}`);
            }
        });
    };

    const getFormConfig = () => {
        switch (modalType) {
            case 'milestone':
                return {
                    fields: [
                        { name: 'title', label: t('Title'), type: 'text', required: true, placeholder: t('Enter milestone title') },
                        { name: 'description', label: t('Description'), type: 'textarea', placeholder: t('Enter milestone description') },
                        { name: 'due_date', label: t('Due Date'), type: 'date', placeholder: t('Select due date'), required: true },
                        {
                            name: 'status',
                            label: t('Status'),
                            type: 'select',
                            required: true,
                            placeholder: t('Select status'),
                            options: [
                                { value: 'pending', label: t('Pending') },
                                { value: 'in_progress', label: t('In Progress') },
                                { value: 'completed', label: t('Completed') },
                                { value: 'overdue', label: t('Overdue') }
                            ]
                        }
                    ],
                    modalSize: 'lg'
                };
            case 'note':
                return {
                    fields: [
                        { name: 'title', label: t('Title'), type: 'text', required: true, placeholder: t('Enter note title') },
                        { name: 'content', label: t('Content'), type: 'textarea', required: true, placeholder: t('Enter note content') },
                        { name: 'is_pinned', label: t('Pin this note'), type: 'checkbox' }
                    ],
                    modalSize: 'lg'
                };
            case 'client':
                const availableClients = clients ? clients.filter((client: any) =>
                    !project.clients?.some((pc: any) => pc.id === client.id)
                ) : [];
                return {
                    fields: [
                        {
                            name: 'client_ids',
                            label: 'Add Clients',
                            type: 'multi-select',
                            options: availableClients.map((client: any) => ({
                                value: client.id.toString(),
                                label: `${client.name} (${client.email})`
                            })),
                            placeholder: 'Select clients...',
                            required: true
                        }
                    ],
                    modalSize: 'xl'
                };
            case 'member':
                const availableMembers = members ? members.filter((member: any) => {
                    const isProjectMember = project.members?.some((pm: any) => pm.user?.id === member.id);
                    const isProjectClient = project.clients?.some((pc: any) => pc.id === member.id);
                    return !isProjectMember && !isProjectClient;
                }) : [];
                return {
                    fields: [
                        {
                            name: 'member_ids',
                            label: 'Add Members',
                            type: 'multi-select',
                            options: availableMembers.map((member: any) => ({
                                value: member.id.toString(),
                                label: `${member.name} (${member.email})`
                            })),
                            placeholder: 'Select members...',
                            required: true
                        }
                    ],
                    modalSize: 'xl'
                };
            case 'manager':
                const availableManagers = managers ? managers.filter((manager: any) => {
                    const isProjectMember = project.members?.some((pm: any) => pm.user?.id === manager.id);
                    const isProjectClient = project.clients?.some((pc: any) => pc.id === manager.id);
                    return !isProjectMember && !isProjectClient;
                }) : [];

                return {
                    fields: [
                        {
                            name: 'manager_ids',
                            label: 'Add Managers',
                            type: 'multi-select',
                            options: availableManagers.map((manager: any) => ({
                                value: manager.id.toString(),
                                label: `${manager.name} (${manager.email})`
                            })),
                            placeholder: 'Select managers...',
                            required: true
                        }
                    ],
                    modalSize: 'xl'
                };
            case 'project':
                return {
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
                        { name: 'start_date', label: t('Start Date'), type: 'date', placeholder: t('Select start date') },
                        { name: 'deadline', label: t('Deadline'), type: 'date', placeholder: t('Select deadline') },
                        { name: 'estimated_hours', label: t('Estimated Hours'), type: 'number', min: 0, placeholder: t('Enter estimated hours') },
                        { name: 'is_public', label: t('Make project public'), type: 'checkbox' }
                    ],
                    modalSize: 'xl'
                };
            case 'budget':
                return {
                    fields: [
                        { name: 'total_budget', label: 'Total Budget', type: 'number', required: true, min: 0 },
                        {
                            name: 'currency',
                            label: 'Currency',
                            type: 'select',
                            options: [
                                { value: 'USD', label: 'USD' },
                                { value: 'EUR', label: 'EUR' },
                                { value: 'GBP', label: 'GBP' }
                            ],
                            required: true
                        },
                        {
                            name: 'period_type',
                            label: 'Period Type',
                            type: 'select',
                            options: [
                                { value: 'project', label: 'Project Duration' },
                                { value: 'monthly', label: 'Monthly' },
                                { value: 'quarterly', label: 'Quarterly' }
                            ],
                            required: true
                        },
                        { name: 'start_date', label: 'Start Date', type: 'date', required: true },
                        { name: 'end_date', label: 'End Date', type: 'date' },
                        { name: 'description', label: 'Description', type: 'textarea' },
                        {
                            name: 'categories',
                            label: 'Budget Categories',
                            type: 'dynamic-list',
                            fields: [
                                { name: 'name', label: 'Category Name', type: 'text', required: true },
                                { name: 'allocated_amount', label: 'Allocated Amount', type: 'number', required: true, min: 0 },
                                { name: 'color', label: 'Color', type: 'color', defaultValue: '#3B82F6' },
                                { name: 'description', label: 'Description', type: 'text' }
                            ],
                            required: true,
                            minItems: 1
                        }
                    ],
                    modalSize: 'xl'
                };
            case 'attachment':
                return {
                    fields: [
                        {
                            name: 'media_ids',
                            type: 'custom',
                            component: (
                                <MediaPicker
                                    label="Select Files"
                                    value={selectedAttachments}
                                    onChange={(value, mediaIds) => {
                                        // Store selected attachments
                                        setSelectedAttachments(value);
                                        // Store media IDs for form submission
                                        if (mediaIds && mediaIds.length > 0) {
                                            setCurrentItem(prev => ({ ...prev, media_ids: mediaIds }));
                                        }
                                    }}
                                    multiple={true}
                                    placeholder={t('Select files to upload...')}
                                    showPreview={true}
                                />
                            ),
                            required: true
                        }
                    ],
                    modalSize: 'lg'
                };
            default:
                return { fields: [], modalSize: 'md' };
        }
    };

    const pageActions = [
        ...(hasPermission(permissions, 'task_view_any') ? [{
            label: t('Tasks'),
            icon: <CheckSquare className="h-4 w-4 mr-2" />,
            variant: 'outline',
            onClick: () => router.get(route('tasks.index', { project_id: project.id, project_name: project.title, view: 'kanban' }))
        }] : []),
        ...(hasPermission(permissions, 'project_view') ? [{
            label: t('Gantt Chart'),
            icon: <BarChart3 className="h-4 w-4 mr-2" />,
            variant: 'outline',
            onClick: () => router.get(route('projects.gantt', { project: project.id }))
        }] : []),
        ...(hasPermission(permissions, 'bug_view_any') ? [{
            label: t('Bugs'),
            icon: <Bug className="h-4 w-4 mr-2" />,
            variant: 'outline',
            onClick: () => router.get(route('bugs.index', { project_id: project.id, project_name: project.title }))
        }] : []),
        ...(hasPermission(permissions, 'expense_view_any') ? [{
            label: t('Expenses'),
            icon: <Receipt className="h-4 w-4 mr-2" />,
            variant: 'outline',
            onClick: () => router.get(route('expenses.index', { project_id: project.id, project_name: project.title }))
        }] : []),
        ...(hasViewBudgetAccess ? [{
            label: t('Budget'),
            icon: <DollarSign className="h-4 w-4 mr-2" />,
            variant: 'outline',
            onClick: () => {
                if (budget) {
                    router.get(route('budgets.show', budget.id));
                } else {
                    router.get(route('budgets.index'));
                }
            }
        }] : [])
    ];

    if (canManageSharedSettings && hasPermission(permissions, 'project_manage_shared_settings')) {
        pageActions.push({
            label: t('Shared Project'),
            icon: <Settings className="h-4 w-4 mr-2" />,
            variant: 'outline',
            onClick: () => setIsSharedSettingsModalOpen(true)
        });
    }

    pageActions.push({
        label: t('Back'),
        icon: <ArrowLeft className="h-4 w-4 mr-2" />,
        variant: 'outline',
        onClick: () => { router.get(route('projects.index')) }
    });

    const breadcrumbs = [
        { title: t('Dashboard'), href: route('dashboard') },
        { title: t('Projects'), href: route('projects.index') },
        { title: t('Project Details') }
    ];

    return (
        <PageTemplate
            title={project.title}
            url={`/projects/${project.id}`}
            description={t('View and manage your project details.')}
            actions={pageActions}
            breadcrumbs={breadcrumbs}
            noPadding
        >
            {/* Project Header */}
            <div className="bg-white rounded-lg shadow mb-4">
                <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <div className="flex gap-2">
                                <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${getStatusColor(project.status)}`}>
                                    {formatText(project.status)}
                                </span>
                                <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${getPriorityColor(project.priority)}`}>
                                    {formatText(project.priority)}
                                </span>
                                {project.is_public ? (
                                    <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20">
                                        {t('Public Project')}
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20">
                                        {t('Private Project')}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Project Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <div className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-shadow duration-200 p-4">
                            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center shrink-0">
                                <Users className="h-5 w-5 text-blue-600 dark:text-blue-100" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs text-gray-500 dark:text-gray-400">{t('Team Members')}</p>
                                <p className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{(project.members?.length || 0) + (project.clients?.length || 0)}</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500">{t('Members & Clients')}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-shadow duration-200 p-4">
                            <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center shrink-0">
                                <Calendar className="h-5 w-5 text-emerald-600 dark:text-emerald-100" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs text-gray-500 dark:text-gray-400">{t('Deadline')}</p>
                                <p className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{window.appSettings.formatDateTime(new Date(project.deadline),false)}</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500">{t('Due Date')}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-shadow duration-200 p-4">
                            <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900 flex items-center justify-center shrink-0">
                                <DollarSign className="h-5 w-5 text-amber-600 dark:text-amber-100" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs text-gray-500 dark:text-gray-400">{t('Budget')}</p>
                                <p className="text-xl font-bold text-gray-900 dark:text-white leading-tight font-mono">{hasViewBudgetAccess ? formatCurrency(budget?.total_budget || 0) : 'N/A'}</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500">{t('Total Allocated')}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-shadow duration-200 p-4">
                            <div className="h-10 w-10 rounded-lg bg-violet-100 dark:bg-violet-900 flex items-center justify-center shrink-0">
                                <Clock className="h-5 w-5 text-violet-600 dark:text-violet-100" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs text-gray-500 dark:text-gray-400">{t('Est. Hours')}</p>
                                <p className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{project.estimated_hours}h</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500">{t('Estimated Time')}</p>
                            </div>
                        </div>
                    </div>


                    {/* Progress */}
                    <Card>
                        <CardContent className="p-4">
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="font-medium">{t('Project Progress')}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold">{project.progress}%</span>
                                        {hasPermission(permissions, 'project_track_progress') && (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => {
                                                            toast.loading('Recalculating progress...');
                                                            router.post(route('projects.recalculate-progress', project.id), {}, {
                                                                onSuccess: () => {
                                                                    toast.dismiss();
                                                                    toast.success('Progress recalculated successfully');
                                                                },
                                                                onError: () => {
                                                                    toast.dismiss();
                                                                    toast.error('Failed to recalculate progress');
                                                                }
                                                            });
                                                        }}
                                                        className="h-6 px-2 text-xs"
                                                    >
                                                        <BarChart3 className="h-3 w-3" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>{t('Recalculate Progress')}</TooltipContent>
                                            </Tooltip>
                                        )}
                                    </div>
                                </div>
                                <Progress value={project.progress} className="h-2" />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Tabs Content */}
            <div className="bg-white rounded-lg shadow">
                <Tabs value={activeTab} onValueChange={handleTabChange} className="relative">
                    <div className="border-b bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 dark:border-gray-700 relative z-10">
                        <TabsList className="h-12 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-0 rounded-none p-0 shadow-none relative z-20 flex-wrap w-full justify-center">
                            {hasPermission(permissions, 'project_view') && (
                                <TabsTrigger value="overview" className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:scale-105 hover:bg-primary/10 hover:text-primary dark:text-gray-400 dark:hover:text-primary dark:data-[state=active]:text-white">
                                    <User className="h-4 w-4 mr-2" />
                                    {t('Overview')}
                                </TabsTrigger>
                            )}
                            {hasPermission(permissions, 'project_assign_members') && (
                                <TabsTrigger value="team" className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:scale-105 hover:bg-primary/10 hover:text-primary dark:text-gray-400 dark:hover:text-primary dark:data-[state=active]:text-white">
                                    <Users className="h-4 w-4 mr-2" />
                                    {t('Team')}
                                </TabsTrigger>
                            )}
                            {hasPermission(permissions, 'project_manage_milestones') && (
                                <TabsTrigger value="milestones" className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:scale-105 hover:bg-primary/10 hover:text-primary dark:text-gray-400 dark:hover:text-primary dark:data-[state=active]:text-white">
                                    <Calendar className="h-4 w-4 mr-2" />
                                    {t('Milestones')}
                                </TabsTrigger>
                            )}
                            {hasPermission(permissions, 'project_manage_notes') && (
                                <TabsTrigger value="notes" className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:scale-105 hover:bg-primary/10 hover:text-primary dark:text-gray-400 dark:hover:text-primary dark:data-[state=active]:text-white">
                                    <Pin className="h-4 w-4 mr-2" />
                                    {t('Notes')}
                                </TabsTrigger>
                            )}
                            {hasViewBudgetAccess && (
                                <TabsTrigger value="budget" className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:scale-105 hover:bg-primary/10 hover:text-primary dark:text-gray-400 dark:hover:text-primary dark:data-[state=active]:text-white">
                                    <DollarSign className="h-4 w-4 mr-2" />
                                    {t('Budget')}
                                </TabsTrigger>
                            )}
                            {hasPermission(permissions, 'expense_view_any') && (
                                <TabsTrigger value="expense" className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:scale-105 hover:bg-primary/10 hover:text-primary dark:text-gray-400 dark:hover:text-primary dark:data-[state=active]:text-white">
                                    <CreditCard className="h-4 w-4 mr-2" />
                                    {t('Expense')}
                                </TabsTrigger>
                            )}
                            {hasPermission(permissions, 'task_view_any') && (
                                <TabsTrigger value="tasks" className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:scale-105 hover:bg-primary/10 hover:text-primary dark:text-gray-400 dark:hover:text-primary dark:data-[state=active]:text-white">
                                    <CheckSquare className="h-4 w-4 mr-2" />
                                    {t('Tasks')}
                                </TabsTrigger>
                            )}
                            {hasPermission(permissions, 'bug_view_any') && (
                                <TabsTrigger value="bugs" className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:scale-105 hover:bg-primary/10 hover:text-primary dark:text-gray-400 dark:hover:text-primary dark:data-[state=active]:text-white">
                                    <Bug className="h-4 w-4 mr-2" />
                                    {t('Bugs')}
                                </TabsTrigger>
                            )}
                            {hasPermission(permissions, 'timesheet_view_any') && (
                                <TabsTrigger value="timesheet" className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:scale-105 hover:bg-primary/10 hover:text-primary dark:text-gray-400 dark:hover:text-primary dark:data-[state=active]:text-white">
                                    <Timer className="h-4 w-4 mr-2" />
                                    {t('Timesheet')}
                                </TabsTrigger>
                            )}
                            {hasPermission(permissions, 'project_manage_attachments') && (
                                <TabsTrigger value="attachments" className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:scale-105 hover:bg-primary/10 hover:text-primary dark:text-gray-400 dark:hover:text-primary dark:data-[state=active]:text-white">
                                    <Paperclip className="h-4 w-4 mr-2" />
                                    {t('Attachments')}
                                </TabsTrigger>
                            )}
                            {hasPermission(permissions, 'project_view') && (
                                <TabsTrigger value="activity" className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:scale-105 hover:bg-primary/10 hover:text-primary dark:text-gray-400 dark:hover:text-primary dark:data-[state=active]:text-white">
                                    <Clock className="h-4 w-4 mr-2" />
                                    {t('Activity')}
                                </TabsTrigger>
                            )}
                        </TabsList>
                    </div>

                    <div className="p-4 relative overflow-visible z-0">
                        <TabsContent value="overview" className="space-y-6 mt-0">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">{t('Project Description')}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{project.description || t('No description provided.')}</p>
                                </CardContent>
                            </Card>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <Calendar className="h-5 w-5 text-blue-500" />
                                            {t('Project Timeline')}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-600">{t('Start Date')}:</span>
                                            <span className="font-medium">{project.start_date ? window.appSettings.formatDateTime(new Date(project.start_date),false) : t('Not set')}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-600">{t('Deadline')}:</span>
                                            <span className="font-medium">{project.deadline ? window.appSettings.formatDateTime(new Date(project.deadline),false) : t('Not set')}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-600">{t('Estimated Hours')}:</span>
                                            <span className="font-medium">{project.estimated_hours || 0}h</span>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <Users className="h-5 w-5 text-green-500" />
                                            {t('Team Summary')}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-600">{t('Managers')}:</span>
                                            <span className="font-medium">{project.members?.filter((member: any) => member.role === 'manager').length || 0}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-600">{t('Team Members')}:</span>
                                            <span className="font-medium">{project.members?.filter((member: any) => member.role === 'member').length || 0}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-600">{t('Clients')}:</span>
                                            <span className="font-medium">{project.clients?.length || 0}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Project Reports */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <Timer className="h-5 w-5 text-blue-500" />
                                            {t('Time Tracking Summary')}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-600">{t('Total Hours Logged')}:</span>
                                                <span className="font-semibold">
                                                    {projectTimesheets ?
                                                        projectTimesheets.reduce((total: number, ts: any) => total + parseFloat(ts.total_hours || 0), 0).toFixed(1)
                                                        : '0.0'
                                                    }h
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-600">{t('Billable Hours')}:</span>
                                                <span className="font-semibold text-green-600">
                                                    {projectTimesheets ?
                                                        projectTimesheets.reduce((total: number, ts: any) => total + parseFloat(ts.billable_hours || 0), 0).toFixed(1)
                                                        : '0.0'
                                                    }h
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-600">{t('Team Members Active')}:</span>
                                                <span className="font-semibold">
                                                    {projectTimesheets ?
                                                        new Set(projectTimesheets.map((ts: any) => ts.user?.id)).size
                                                        : 0
                                                    }
                                                </span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <BarChart3 className="h-5 w-5 text-purple-500" />
                                            {t('Project Reports')}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-600">{t('Total Milestones')}:</span>
                                                <span className="font-semibold">{project.milestones?.length || 0}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-600">{t('Notes Created')}:</span>
                                                <span className="font-semibold text-blue-600">
                                                    {project.notes?.total || 0}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-600">{t('Attachments')}:</span>
                                                <span className="font-semibold text-green-600">
                                                    {project.attachments?.total || 0}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-600">{t('Activities')}:</span>
                                                <span className="font-semibold text-orange-600">
                                                    {project.activities?.total || 0}
                                                </span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {hasViewBudgetAccess && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-lg flex items-center gap-2">
                                                <DollarSign className="h-5 w-5 text-yellow-500" />
                                                {t('Budget Utilization')}
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm text-gray-600">{t('Total Budget')}:</span>
                                                    <span className="font-semibold font-mono">{formatCurrency(budget?.total_budget || 0)}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm text-gray-600">{t('Amount Spent')}:</span>
                                                    <span className="font-semibold text-red-600 font-mono">{formatCurrency(budget?.total_spent || 0)}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm text-gray-600">{t('Remaining')}:</span>
                                                    <span className="font-semibold text-green-600 font-mono">{formatCurrency(budget?.remaining_budget || 0)}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm text-gray-600">{t('Utilization')}:</span>
                                                    <span className="font-semibold">{budget?.utilization_percentage?.toFixed(1) || '0.0'}%</span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <Users className="h-5 w-5 text-purple-500" />
                                            {t('Team Performance')}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-600">{t('Team Size')}:</span>
                                                <span className="font-semibold">{project.members?.length || 0}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-600">{t('Active Members')}:</span>
                                                <span className="font-semibold text-green-600">
                                                    {projectTimesheets ?
                                                        new Set(projectTimesheets.map((ts: any) => ts.user?.id)).size
                                                        : 0
                                                    }
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-600">{t('Avg Hours/Member')}:</span>
                                                <span className="font-semibold">
                                                    {projectTimesheets && project.members?.length ?
                                                        (projectTimesheets.reduce((total: number, ts: any) => total + parseFloat(ts.total_hours || 0), 0) / project.members.length).toFixed(1)
                                                        : '0.0'
                                                    }h
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-600">{t('Project Progress')}:</span>
                                                <span className="font-semibold">{project.progress || 0}%</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        <TabsContent value="team" className="mt-0">
                            {/* Header */}
                            <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('Team & Clients')}</h3>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {(project.members?.length || 0) + (project.clients?.length || 0)} {t('people assigned')}
                                    </p>
                                </div>
                            </div>

                            {/* Custom Scrollbar Styles */}
                            <style>{`
                                .panel-scrollbar {
                                    scrollbar-width: thin;
                                    scrollbar-color: #cbd5e1 transparent;
                                }
                                .dark .panel-scrollbar {
                                    scrollbar-color: #475569 transparent;
                                }
                                .panel-scrollbar::-webkit-scrollbar {
                                    width: 6px;
                                }
                                .panel-scrollbar::-webkit-scrollbar-track {
                                    background: transparent;
                                }
                                .panel-scrollbar::-webkit-scrollbar-thumb {
                                    background: #cbd5e1;
                                    border-radius: 10px;
                                }
                                .panel-scrollbar::-webkit-scrollbar-thumb:hover {
                                    background: #94a3b8;
                                }
                                .dark .panel-scrollbar::-webkit-scrollbar-thumb {
                                    background: #475569;
                                }
                                .dark .panel-scrollbar::-webkit-scrollbar-thumb:hover {
                                    background: #64748b;
                                }
                            `}</style>

                            {/* 3-Column Vertical Panels */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                                {/* ── Managers Panel ── */}
                                <div className="flex flex-col rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
                                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-700 shrink-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-sm text-gray-700 dark:text-gray-200">{t('Managers')}</span>
                                            <span className="text-xs font-semibold bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300 rounded-full px-2 py-0.5">
                                                {project.members?.filter((m: any) => m.role === 'manager').length || 0}
                                            </span>
                                        </div>
                                        {hasPermission(permissions, 'project_assign_members') && (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button size="sm" variant="ghost" onClick={() => handleAction('invite-manager')} className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-200 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700">
                                                        <Plus className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>{t('Add')}</TooltipContent>
                                            </Tooltip>
                                        )}
                                    </div>
                                    <div className="overflow-y-auto panel-scrollbar p-3 space-y-2" style={{ height: '360px' }}>
                                        {project.members?.filter((member: any) => member.role === 'manager').length > 0 ? (
                                            project.members.filter((member: any) => member.role === 'manager').map((member: any) => (
                                                <div key={member.user.id} className="group flex items-center gap-2.5 p-2.5 rounded-xl border dark:border-gray-700 bg-gray-50/50 dark:bg-gray-950/40 hover:bg-white dark:hover:bg-gray-700 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-500 transition-all duration-200">
                                                    <div className="relative shrink-0">
                                                        <Avatar className="h-10 w-10 ring-2 ring-gray-300 dark:ring-gray-600">
                                                            <AvatarImage src={member.user.avatar} />
                                                            <AvatarFallback className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold text-sm">{member.user.name.charAt(0).toUpperCase()}</AvatarFallback>
                                                        </Avatar>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{member.user.name}</p>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{member.user.email}</p>
                                                        <span className="mt-1.5 inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-600/20">{formatText(member.role)}</span>
                                                    </div>
                                                    {canManageProject && (
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button variant="ghost" size="icon" onClick={() => { setCurrentItem({ ...member, type: 'manager' }); setModalType('member'); setIsDeleteModalOpen(true); }} className="h-7 w-7 shrink-0 text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-950">
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>{t('Remove')}</TooltipContent>
                                                        </Tooltip>
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-full text-center">
                                                <User className="h-8 w-8 text-gray-300 dark:text-gray-600 mb-2" />
                                                <p className="text-xs text-gray-400 dark:text-gray-500">{t('No managers yet')}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* ── Team Members Panel ── */}
                                <div className="flex flex-col rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
                                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-950 border-b border-gray-100 dark:border-gray-900 shrink-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-sm text-gray-700 dark:text-gray-300">{t('Team Members')}</span>
                                            <span className="text-xs font-semibold bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300 rounded-full px-2 py-0.5">
                                                {project.members?.filter((m: any) => m.role === 'member').length || 0}
                                            </span>
                                        </div>
                                        {hasPermission(permissions, 'project_assign_members') && (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button size="sm" variant="ghost" onClick={() => handleAction('invite-member')} className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-900">
                                                        <Plus className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>{t('Add')}</TooltipContent>
                                            </Tooltip>
                                        )}
                                    </div>
                                    <div className="overflow-y-auto panel-scrollbar p-3 space-y-2" style={{ height: '360px' }}>
                                        {project.members?.filter((member: any) => member.role === 'member').length > 0 ? (
                                            project.members.filter((member: any) => member.role === 'member').map((member: any) => (
                                                <div key={member.user.id} className="group flex items-center gap-2.5 p-2.5 rounded-xl border dark:border-gray-700 bg-gray-50/50 dark:bg-gray-950/40 hover:bg-white dark:hover:bg-gray-700 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-500 transition-all duration-200">
                                                    <div className="relative shrink-0">
                                                        <Avatar className="h-10 w-10 ring-2 ring-gray-300 dark:ring-gray-600">
                                                            <AvatarImage src={member.user.avatar} />
                                                            <AvatarFallback className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold text-sm">{member.user.name.charAt(0).toUpperCase()}</AvatarFallback>
                                                        </Avatar>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{member.user.name}</p>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{member.user.email}</p>
                                                        <span className="mt-1.5 inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20">{formatText(member.role)}</span>
                                                    </div>
                                                    {canManageProject && (
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button variant="ghost" size="icon" onClick={() => { setCurrentItem({ ...member, type: 'member' }); setModalType('member'); setIsDeleteModalOpen(true); }} className="h-7 w-7 shrink-0 text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-950">
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>{t('Remove')}</TooltipContent>
                                                        </Tooltip>
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-full text-center">
                                                <Users className="h-8 w-8 text-blue-200 dark:text-blue-900 mb-2" />
                                                <p className="text-xs text-gray-400 dark:text-gray-500">{t('No members yet')}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* ── Clients Panel ── */}
                                <div className="flex flex-col rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
                                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-950 border-b border-gray-100 dark:border-gray-900 shrink-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-sm text-gray-700 dark:text-gray-300">{t('Clients')}</span>
                                            <span className="text-xs font-semibold bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300 rounded-full px-2 py-0.5">
                                                {project.clients?.length || 0}
                                            </span>
                                        </div>
                                        {hasPermission(permissions, 'project_assign_clients') && (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button size="sm" variant="ghost" onClick={() => handleAction('invite-client')} className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-900">
                                                        <Plus className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>{t('Add')}</TooltipContent>
                                            </Tooltip>
                                        )}
                                    </div>
                                    <div className="overflow-y-auto panel-scrollbar p-3 space-y-2" style={{ height: '360px' }}>
                                        {project.clients?.length > 0 ? (
                                            project.clients.map((client: any) => (
                                                <div key={client.id} className="group flex items-center gap-2.5 p-2.5 rounded-xl border dark:border-gray-700 bg-gray-50/50 dark:bg-gray-950/40 hover:bg-white dark:hover:bg-gray-700 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-500 transition-all duration-200">
                                                    <div className="relative shrink-0">
                                                        <Avatar className="h-10 w-10 ring-2 ring-gray-300 dark:ring-gray-600">
                                                            <AvatarImage src={client.avatar} />
                                                            <AvatarFallback className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold text-sm">{client.name.charAt(0).toUpperCase()}</AvatarFallback>
                                                        </Avatar>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{client.name}</p>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{client.email}</p>
                                                        <span className="mt-1.5 inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20">{formatText('client')}</span>
                                                    </div>
                                                    {canManageProject && (
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button variant="ghost" size="icon" onClick={() => { setCurrentItem({ ...client, type: 'client' }); setModalType('client'); setIsDeleteModalOpen(true); }} className="h-7 w-7 shrink-0 text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-950">
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>{t('Remove')}</TooltipContent>
                                                        </Tooltip>
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-full text-center">
                                                <User className="h-8 w-8 text-green-200 dark:text-green-900 mb-2" />
                                                <p className="text-xs text-gray-400 dark:text-gray-500">{t('No clients yet')}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                            </div>
                        </TabsContent>

                        <TabsContent value="milestones" className="space-y-6 mt-0">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-semibold">{t('Milestones')}</h3>
                                {hasPermission(permissions, 'project_manage_milestones') && (
                                    <Button size="sm" onClick={() => handleAction('add-milestone')}>
                                        <Plus className="h-4 w-4 mr-2" />
                                        {t('Add Milestone')}
                                    </Button>
                                )}
                            </div>

                            {project.milestones && project.milestones.length > 0 ? (
                                <div className="grid grid-cols-2 gap-4">
                                    {project.milestones.slice((milestonesPage - 1) * itemsPerPage, milestonesPage * itemsPerPage).map((milestone: any) => (
                                        <Card key={milestone.id}>
                                            <CardContent className="p-4">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1">
                                                        <h4 className="font-medium">{milestone.title}</h4>
                                                        <p className="text-sm text-gray-600 mt-1 line-clamp-1">{milestone.description}</p>
                                                        <div className="flex items-center gap-4 mt-2">
                                                            <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${getMilestoneStatusColor(milestone.status)}`}>{formatText(milestone.status)}</span>
                                                            <span className="text-sm text-gray-500">
                                                                {t('Due')}: {window.appSettings.formatDateTime(new Date(milestone.due_date),false)}
                                                            </span>
                                                        </div>
                                                        <div className="mt-2">
                                                            <Progress value={milestone.progress} className="h-1" />
                                                        </div>
                                                    </div>
                                                    {canManageProject && (
                                                        <div className="flex gap-1">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => handleAction('edit-milestone', milestone)}
                                                                        className="text-gray-500 hover:text-gray-700 h-8 w-8"
                                                                    >
                                                                        <Edit className="h-4 w-4" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>{t('Edit')}</TooltipContent>
                                                            </Tooltip>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => {
                                                                            setModalType('milestone');
                                                                            handleAction('delete-milestone', milestone);
                                                                        }}
                                                                        className="text-gray-500 hover:text-gray-700 h-8 w-8"
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>{t('Delete')}</TooltipContent>
                                                            </Tooltip>
                                                        </div>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500">
                                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p>{t('No milestones created yet.')}</p>
                                    {canManageProject && (
                                        <Button className="mt-4" onClick={() => handleAction('add-milestone')}>
                                            <Plus className="h-4 w-4 mr-2" />
                                            {t('Add First Milestone')}
                                        </Button>
                                    )}
                                </div>
                            )}

                            {project.milestones && project.milestones.length > itemsPerPage && (
                                <div className="flex items-center justify-between">
                                    <div className="text-sm text-gray-500">
                                        {t('Showing')} {(milestonesPage - 1) * itemsPerPage + 1} {t('to')} {Math.min(milestonesPage * itemsPerPage, project.milestones.length)} {t('of')} {project.milestones.length} {t('milestones')}
                                    </div>
                                    <div className="flex gap-1">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="px-3"
                                            disabled={milestonesPage === 1}
                                            onClick={() => setMilestonesPage(p => p - 1)}
                                        >
                                            {t('Previous')}
                                        </Button>
                                        {Array.from({ length: Math.ceil(project.milestones.length / itemsPerPage) }, (_, i) => i + 1).map(page => (
                                            <Button
                                                key={page}
                                                variant={milestonesPage === page ? 'default' : 'outline'}
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => setMilestonesPage(page)}
                                            >
                                                {page}
                                            </Button>
                                        ))}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="px-3"
                                            disabled={milestonesPage === Math.ceil(project.milestones.length / itemsPerPage)}
                                            onClick={() => setMilestonesPage(p => p + 1)}
                                        >
                                            {t('Next')}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="notes" className="space-y-6 mt-0">
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-semibold">{t('Notes')}</h3>
                                    {hasPermission(permissions, 'project_manage_notes') && (
                                        <Button size="sm" onClick={() => handleAction('add-note')}>
                                            <Plus className="h-4 w-4 mr-2" />
                                            {t('Add Note')}
                                        </Button>
                                    )}
                                </div>

                            </div>

                            {project.notes && project.notes.length > 0 ? (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        {[...project.notes].sort((a: any, b: any) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0)).map((note: any) => (
                                            <Card key={note.id}>
                                                <CardContent className="p-4">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="font-medium">{note.title}</h4>
                                                                {note.is_pinned && <Pin className="h-4 w-4 text-yellow-500" />}
                                                            </div>
                                                            <p className="text-sm text-gray-600 mt-2 line-clamp-1">{note.content}</p>
                                                            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                                                                <span>{t('By')} {note.creator.name}</span>
                                                                <span>•</span>
                                                                <span>{window.appSettings.formatDateTime(new Date(note.created_at),false)}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-1">
                                                            {canManageProject && (
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            onClick={() => handleAction('toggle-pin', note)}
                                                                            className="text-gray-500 hover:text-gray-700 h-8 w-8"
                                                                        >
                                                                            {note.is_pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>{note.is_pinned ? t('Unpin') : t('Pin')}</TooltipContent>
                                                                </Tooltip>
                                                            )}
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => setViewNote(note)}
                                                                        className="text-gray-500 hover:text-gray-700 h-8 w-8"
                                                                    >
                                                                        <Eye className="h-4 w-4" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>{t('View')}</TooltipContent>
                                                            </Tooltip>
                                                            {canManageProject && (
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            onClick={() => handleAction('edit-note', note)}
                                                                            className="text-gray-500 hover:text-gray-700 h-8 w-8"
                                                                        >
                                                                            <Edit className="h-4 w-4" />
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>{t('Edit')}</TooltipContent>
                                                                </Tooltip>
                                                            )}
                                                            {canManageProject && (
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            onClick={() => {
                                                                                setModalType('note');
                                                                                handleAction('delete-note', note);
                                                                            }}
                                                                            className="text-gray-500 hover:text-gray-700 h-8 w-8"
                                                                        >
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>{t('Delete')}</TooltipContent>
                                                                </Tooltip>
                                                            )}
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>


                                </>
                            ) : (
                                <div className="text-center py-8 text-gray-500">
                                    <Pin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                        {t('No notes created yet')}
                                    </h3>
                                    <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                                        {t('Create notes to keep track of important information.')}
                                    </p>
                                    {canManageProject && (
                                        <Button className="mt-4" onClick={() => handleAction('add-note')}>
                                            <Plus className="h-4 w-4 mr-2" />
                                            {t('Add First Note')}
                                        </Button>
                                    )}
                                </div>
                            )}
                        </TabsContent>

                        {hasViewBudgetAccess && (
                            <TabsContent value="budget" className="space-y-6 mt-0">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-semibold">{t('Budget Management')}</h3>
                                    {budget && hasViewBudgetAccess && (
                                        <Button size="sm" onClick={() => router.get(route('budgets.show', budget.id))}>
                                            <Eye className="h-4 w-4 mr-2" />
                                            {t('Show Budget')}
                                        </Button>
                                    )}
                                </div>

                                {budget ? (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <Card>
                                                <CardContent className="p-4">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <DollarSign className="h-4 w-4 text-green-500" />
                                                        <span className="text-sm font-medium">{t('Total Budget')}</span>
                                                    </div>
                                                    <p className="text-lg font-bold font-mono">{formatCurrency(budget.total_budget || 0)}</p>
                                                </CardContent>
                                            </Card>
                                            <Card>
                                                <CardContent className="p-4">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Receipt className="h-4 w-4 text-blue-500" />
                                                        <span className="text-sm font-medium">{t('Total Spent')}</span>
                                                    </div>
                                                    <p className="text-lg font-bold font-mono">{formatCurrency(budget.total_spent || 0)}</p>
                                                </CardContent>
                                            </Card>
                                            <Card>
                                                <CardContent className="p-4">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Clock className="h-4 w-4 text-orange-500" />
                                                        <span className="text-sm font-medium">{t('Remaining')}</span>
                                                    </div>
                                                    <p className="text-lg font-bold font-mono">{formatCurrency(budget.remaining_budget || 0)}</p>
                                                </CardContent>
                                            </Card>
                                        </div>

                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-lg">{t('Budget Progress')}</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between">
                                                        <span>{t('Utilization')}</span>
                                                        <span>{budget.utilization_percentage?.toFixed(1) || 0}%</span>
                                                    </div>
                                                    <Progress value={budget.utilization_percentage || 0} className="h-2" />
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-lg">{t('Recent Expenses')}</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                {budget.expenses?.length > 0 ? (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        {budget.expenses.slice(0, 4).map((expense: any) => (
                                                            <div key={expense.id} className="flex border justify-between items-center p-3 bg-gray-50 rounded hover:bg-gray-100 transition-colors">
                                                                <div>
                                                                    <p className="font-medium">{expense.title}</p>
                                                                    <p className="text-sm text-gray-500">{expense.submitter?.name}</p>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="font-bold font-mono">{formatCurrency(expense.amount)}</p>
                                                                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                                                                        expense.status === 'approved' ? 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20' :
                                                                        expense.status === 'pending' ? 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20' :
                                                                        expense.status === 'rejected' ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20' :
                                                                        'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20'
                                                                    }`}>{formatText(expense.status)}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-gray-500 text-center py-4">{t('No expenses recorded yet')}</p>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </div>
                                ) : (
                                    <Card>
                                        <CardContent className="p-8 text-center">
                                            <DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                                            <h3 className="text-lg font-semibold mb-2">{t('No Budget Set')}</h3>
                                            <p className="text-gray-500 mb-4">{t('Create a budget to track project expenses and spending.')}</p>
                                            {canCreateBudget && (
                                                <Button onClick={() => router.get(route('budgets.index'))}>
                                                    <Plus className="h-4 w-4 mr-2" />
                                                    {t('Create Budget')}
                                                </Button>
                                            )}
                                        </CardContent>
                                    </Card>
                                )}
                            </TabsContent>
                        )}

                        <TabsContent value="expense" className="space-y-6 mt-0">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-semibold">{t('Project Expenses')}</h3>
                                <Button size="sm" onClick={() => router.get(route('expenses.index', { project_id: project.id, project_name: project.title }))}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    {t('Manage Expenses')}
                                </Button>
                            </div>

                            {projectExpenses && projectExpenses.length > 0 ? (
                                <div className="space-y-4">
                                    {/* Expense Stats */}
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <Card>
                                            <CardContent className="p-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <CreditCard className="h-4 w-4 text-blue-500" />
                                                    <span className="text-sm font-medium">{t('Total Expenses')}</span>
                                                </div>
                                                <p className="text-lg font-bold">{projectExpenses.length}</p>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="p-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                                    <span className="text-sm font-medium">{t('Approved')}</span>
                                                </div>
                                                <p className="text-lg font-bold">
                                                    {projectExpenses.filter((expense: any) => expense.status === 'approved').length}
                                                </p>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="p-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Clock className="h-4 w-4 text-yellow-500" />
                                                    <span className="text-sm font-medium">{t('Pending')}</span>
                                                </div>
                                                <p className="text-lg font-bold">
                                                    {projectExpenses.filter((expense: any) => expense.status === 'pending').length}
                                                </p>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="p-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <DollarSign className="h-4 w-4 text-purple-500" />
                                                    <span className="text-sm font-medium">{t('Total Amount')}</span>
                                                </div>
                                                <p className="text-lg font-bold font-mono">
                                                    {formatCurrency(projectExpenses.reduce((total: number, expense: any) => total + parseFloat(expense.amount || 0), 0))}
                                                </p>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    {/* Recent Expenses */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-lg">{t('Recent Expenses')}</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {projectExpenses.slice(0, 6).map((expense: any) => (
                                                    <div key={expense.id} className="flex items-center justify-between p-3 bg-gray-50 border rounded-lg hover:bg-gray-100 transition-colors">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-3">
                                                                <div className="flex-1">
                                                                    <h4 className="font-medium text-sm">{expense.title}</h4>
                                                                    <p className="text-xs text-gray-500 mt-1">
                                                                        <span className="line-clamp-1">{expense.description || t('No description')}</span>
                                                                    </p>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <span className="text-xs text-gray-400">{t('By')} {expense.submitter?.name}</span>
                                                                        <span className="text-xs text-gray-400">•</span>
                                                                        <span className="text-xs text-gray-400">{window.appSettings.formatDateTime(new Date(expense.created_at),false)}</span>
                                                                        {expense.category && (
                                                                            <>
                                                                                <span className="text-xs text-gray-400">•</span>
                                                                                <Badge variant="outline" className="text-xs">{expense.category}</Badge>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="text-lg font-bold font-mono">{formatCurrency(expense.amount)}</p>
                                                                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                                                                        expense.status === 'approved' ? 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20' :
                                                                        expense.status === 'pending' ? 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20' :
                                                                        expense.status === 'rejected' ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20' :
                                                                        'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20'
                                                                    }`}>
                                                                        {formatText(expense.status)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            {projectExpenses.length > 6 && (
                                                <div className="mt-4 text-center">
                                                    <Button variant="outline" size="sm" onClick={() => router.get(route('expenses.index', { project_id: project.id }))}>
                                                        {t('View All')} {t('Expenses')}
                                                    </Button>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>
                            ) : (
                                <Card>
                                    <CardContent className="p-8 text-center">
                                        <CreditCard className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                                        <h3 className="text-lg font-semibold mb-2">{t('No Expenses Recorded')}</h3>
                                        <p className="text-gray-500 mb-4">{t('Track project expenses and spending for better budget management.')}</p>
                                        <Button onClick={() => router.get(route('expenses.index', { project_id: project.id }))}>
                                            <Plus className="h-4 w-4 mr-2" />
                                            {t('Create Expenses')}
                                        </Button>
                                    </CardContent>
                                </Card>
                            )}
                        </TabsContent>



                        <TabsContent value="tasks" className="space-y-6 mt-0">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-semibold">{t('Project Tasks')}</h3>
                                <div className="flex gap-2">
                                    <Button size="sm" onClick={() => router.get(route('tasks.index', { project_id: project.id, project_name: project.title }))}>
                                        <Eye className="h-4 w-4 mr-2" />
                                        {t('Manage Tasks')}
                                    </Button>
                                </div>
                            </div>

                            {projectTasks && projectTasks.length > 0 ? (
                                <div className="space-y-6">
                                    {/* Task Stats - Always 4 Cards */}
                                    {(() => {
                                        const tasksByStage = projectTasks.reduce((acc: any, task: any) => {
                                            const stageName = task.task_stage?.name || 'No Stage';
                                            acc[stageName] = (acc[stageName] || 0) + 1;
                                            return acc;
                                        }, {});

                                        const totalTasks = projectTasks.length;
                                        const completedTasks = projectTasks.filter((task: any) => task.task_stage?.name === 'Completed' || task.task_stage?.name === 'Done').length;
                                        const inProgressTasks = projectTasks.filter((task: any) => task.task_stage?.name === 'In Progress' || task.task_stage?.name === 'Working').length;
                                        const pendingTasks = totalTasks - completedTasks - inProgressTasks;

                                        return (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                                {/* Total Tasks Card */}
                                                <Card>
                                                    <CardContent className="p-4">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <CheckSquare className="h-4 w-4 text-blue-500" />
                                                            <span className="text-sm font-medium">{t('Total Tasks')}</span>
                                                        </div>
                                                        <p className="text-lg font-bold">{totalTasks}</p>
                                                    </CardContent>
                                                </Card>

                                                {/* Completed Tasks Card */}
                                                <Card>
                                                    <CardContent className="p-4">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <CheckSquare className="h-4 w-4 text-green-500" />
                                                            <span className="text-sm font-medium">{t('Completed')}</span>
                                                        </div>
                                                        <p className="text-lg font-bold">{completedTasks}</p>
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            {totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0}% {t('of total')}
                                                        </p>
                                                    </CardContent>
                                                </Card>

                                                {/* In Progress Tasks Card */}
                                                <Card>
                                                    <CardContent className="p-4">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <CheckSquare className="h-4 w-4 text-orange-500" />
                                                            <span className="text-sm font-medium">{t('In Progress')}</span>
                                                        </div>
                                                        <p className="text-lg font-bold">{inProgressTasks}</p>
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            {totalTasks > 0 ? ((inProgressTasks / totalTasks) * 100).toFixed(1) : 0}% {t('of total')}
                                                        </p>
                                                    </CardContent>
                                                </Card>

                                                {/* Pending Tasks Card */}
                                                <Card>
                                                    <CardContent className="p-4">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <CheckSquare className="h-4 w-4 text-purple-500" />
                                                            <span className="text-sm font-medium">{t('Pending')}</span>
                                                        </div>
                                                        <p className="text-lg font-bold">{pendingTasks}</p>
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            {totalTasks > 0 ? ((pendingTasks / totalTasks) * 100).toFixed(1) : 0}% {t('of total')}
                                                        </p>
                                                    </CardContent>
                                                </Card>
                                            </div>
                                        );
                                    })()}

                                    {/* Recent Tasks - Premium Grid Redesign */}
                                    <Card className="">
                                        <CardHeader className="pb-5 pt-6 px-6 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800/40">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-primary/10 dark:bg-primary/20 rounded-xl border border-primary/20 shadow-[0_0_15px_rgba(16,183,127,0.15)]">
                                                        <CheckSquare className="h-4 w-4 text-primary" />
                                                    </div>
                                                    <div>
                                                        <CardTitle className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                                                            {t('Recent Tasks')}
                                                        </CardTitle>
                                                    </div>
                                                </div>
                                                <Badge className="bg-primary/10 text-primary border-primary/20 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide transition-colors">
                                                    {projectTasks.length} {t('Active')}
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-5">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {projectTasks.slice(0, 6).map((task: any) => (
                                                    <div
                                                        key={task.id}
                                                        className="group relative flex items-center gap-4 p-4 bg-white/90 dark:bg-slate-900/80 border dark:border-slate-800 rounded-xl hover:bg-white"
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate pr-1">
                                                                    {task.title}
                                                                </h4>
                                                                <div className="flex items-center gap-1.5 shrink-0">
                                                                    <span
                                                                        className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                                                                            task.priority === 'critical' ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20' :
                                                                            task.priority === 'high' ? 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20' :
                                                                            task.priority === 'medium' ? 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20' :
                                                                            'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20'
                                                                        }`}
                                                                    >
                                                                        {formatText(task.priority)}
                                                                    </span>
                                                                    <span
                                                                        className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium"
                                                                        style={{
                                                                            backgroundColor: (task.task_stage?.color || '#cbd5e1') + '20',
                                                                            outline: `1px solid ${(task.task_stage?.color || '#cbd5e1')}40`,
                                                                            color: task.task_stage?.color || '#64748b'
                                                                        }}
                                                                    >
                                                                        {formatText(task.task_stage?.name)}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-4">
                                                                {task.assigned_to ? (
                                                                    <div className="flex items-center gap-2">
                                                                        <Avatar className="h-6 w-6 ring-1 ring-slate-100 dark:ring-slate-800">
                                                                            <AvatarImage src={task.assigned_to.avatar} />
                                                                            <AvatarFallback className="text-[8px] font-bold bg-primary text-white">
                                                                                {task.assigned_to.name?.charAt(0)}
                                                                            </AvatarFallback>
                                                                        </Avatar>
                                                                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 truncate max-w-[80px]">
                                                                            {task.assigned_to.name}
                                                                        </span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center gap-2">
                                                                        <Avatar className="h-6 w-6 opacity-50 grayscale transition-all group-hover:grayscale-0 group-hover:opacity-100">
                                                                            <AvatarFallback className="text-[9px] bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-600 font-bold">U</AvatarFallback>
                                                                        </Avatar>
                                                                        <span className="text-[11px] text-slate-400 italic font-medium">{t('Unassigned')}</span>
                                                                    </div>
                                                                )}

                                                                <div className="flex items-center gap-1.5 py-0.5 px-2 rounded-lg bg-slate-50 dark:bg-slate-800/30 text-slate-500 dark:text-slate-400 text-[10px] font-medium">
                                                                    <Calendar className="h-3 w-3" />
                                                                    <span>
                                                                        {task.end_date ? window.appSettings.formatDateTime(new Date(task.end_date),false) : '-'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-col items-center justify-center min-w-[50px] shrink-0">
                                                            <div className="relative flex items-center justify-center p-1">
                                                                <svg className="w-10 h-10 -rotate-90 transition-transform">
                                                                    <circle
                                                                        cx="20" cy="20" r="17" fill="transparent"
                                                                        stroke="currentColor" strokeWidth="3"
                                                                        className="text-slate-100 dark:text-slate-800"
                                                                    />
                                                                    <circle
                                                                        cx="20" cy="20" r="17" fill="transparent"
                                                                        stroke="currentColor" strokeWidth="3"
                                                                        strokeDasharray={106.8}
                                                                        strokeDashoffset={106.8 - (106.8 * (task.progress || 0)) / 100}
                                                                        strokeLinecap="round"
                                                                        className={`transition-all duration-1000 ${task.progress >= 100 ? 'text-emerald-500' :
                                                                                task.progress >= 50 ? 'text-primary' : 'text-orange-500'
                                                                            }`}
                                                                    />
                                                                </svg>
                                                                <div className="absolute inset-0 flex items-center justify-center">
                                                                    <span className="text-[9px] font-black text-slate-900 dark:text-white">{task.progress || 0}%</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            {projectTasks.length > 6 && (
                                                <div className="mt-4 text-center">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => router.get(route('tasks.index', { project_id: project.id, project_name: project.title }))}
                                                    >
                                                        {t('View All')} {t('Tasks')}
                                                    </Button>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>
                            ) : (
                                <Card>
                                    <CardContent className="p-8 text-center">
                                        <CheckSquare className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                                        <h3 className="text-lg font-semibold mb-2">{t('No Tasks Yet')}</h3>
                                        <p className="text-gray-500 mb-4">{t('Create tasks to track progress and assign work for this project.')}</p>
                                        {canManageProject && (
                                            <Button onClick={() => router.get(route('tasks.index', { project_id: project.id, project_name: project.title }))}>
                                                <Plus className="h-4 w-4 mr-2" />
                                                {t('Create First Task')}
                                            </Button>
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                        </TabsContent>

                        <TabsContent value="bugs" className="space-y-6 mt-0">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-semibold">{t('Project Bugs')}</h3>
                                <div className="flex gap-2">
                                    <Button size="sm" onClick={() => router.get(route('bugs.index', { project_id: project.id, project_name: project.title }))}>
                                        <Eye className="h-4 w-4 mr-2" />
                                        {t('Manage Bugs')}
                                    </Button>
                                </div>
                            </div>

                            {projectBugs && projectBugs.length > 0 ? (
                                <div className="space-y-4">
                                    {/* Bug Stats */}
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <Card>
                                            <CardContent className="p-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Bug className="h-4 w-4 text-red-500" />
                                                    <span className="text-sm font-medium">{t('Total Bugs')}</span>
                                                </div>
                                                <p className="text-lg font-bold">{projectBugs.length}</p>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="p-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                                    <span className="text-sm font-medium">{t('Open Issues')}</span>
                                                </div>
                                                <p className="text-lg font-bold">
                                                    {projectBugs.filter((bug: any) => !['Resolved', 'Closed'].includes(bug.bug_status?.name)).length}
                                                </p>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="p-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                                                    <span className="text-sm font-medium">{t('Critical')}</span>
                                                </div>
                                                <p className="text-lg font-bold">
                                                    {projectBugs.filter((bug: any) => bug.priority === 'critical').length}
                                                </p>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="p-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <User className="h-4 w-4 text-purple-500" />
                                                    <span className="text-sm font-medium">{t('Unassigned')}</span>
                                                </div>
                                                <p className="text-lg font-bold">
                                                    {projectBugs.filter((bug: any) => !bug.assigned_to).length}
                                                </p>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    {/* Recent Bugs */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-lg">{t('Recent Bugs')}</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {projectBugs.slice(0, 6).map((bug: any) => (
                                                    <div key={bug.id} className="flex items-center border justify-between p-3 rounded-lg transition-colors">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-3">
                                                                <div className="flex-1">
                                                                    <h4 className="font-medium text-sm">{bug.title}</h4>
                                                                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">{bug.description || t('No description')}</p>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span
                                                                        className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                                                                            bug.priority === 'critical' ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20' :
                                                                            bug.priority === 'high' ? 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20' :
                                                                            bug.priority === 'medium' ? 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20' :
                                                                            'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20'
                                                                        }`}
                                                                    >
                                                                        {formatText(bug.priority)}
                                                                    </span>
                                                                    <span
                                                                        className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                                                                            bug.severity === 'blocker' ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20' :
                                                                            bug.severity === 'critical' ? 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20' :
                                                                            bug.severity === 'major' ? 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20' :
                                                                            'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20'
                                                                        }`}
                                                                    >
                                                                        {formatText(bug.severity)}
                                                                    </span>
                                                                    <span
                                                                        className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium"
                                                                        style={{
                                                                            backgroundColor: bug.bug_status?.color + '1a',
                                                                            boxShadow: `inset 0 0 0 1px ${bug.bug_status?.color}33`,
                                                                            color: bug.bug_status?.color
                                                                        }}
                                                                    >
                                                                        {formatText(bug.bug_status?.name)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center justify-between mt-2">
                                                                <div className="flex items-center gap-2">
                                                                    {bug.assigned_to ? (
                                                                        <div className="flex items-center gap-1">
                                                                            <Avatar className="h-5 w-5">
                                                                                <AvatarImage src={bug.assigned_to.avatar} />
                                                                                <AvatarFallback className="text-xs">
                                                                                    {bug.assigned_to.name?.charAt(0)}
                                                                                </AvatarFallback>
                                                                            </Avatar>
                                                                            <span className="text-xs text-gray-600">{bug.assigned_to.name}</span>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-xs text-gray-400">{t('Unassigned')}</span>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs text-gray-500">
                                                                        {t('Reported by')} {bug.reported_by?.name}
                                                                    </span>
                                                                    <span className="text-xs text-gray-500">
                                                                        {bug.end_date ? window.appSettings.formatDateTime(new Date(bug.end_date),false) : t('No due date')}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            {projectBugs.length > 6 && (
                                                <div className="mt-4 text-center">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => router.get(route('bugs.index', { project_id: project.id, project_name: project.title }))}
                                                    >
                                                        {t('View All')} {t('Bugs')}
                                                    </Button>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>
                            ) : (
                                <Card>
                                    <CardContent className="p-8 text-center">
                                        <Bug className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                                        <h3 className="text-lg font-semibold mb-2">{t('No Bugs Reported')}</h3>
                                        <p className="text-gray-500 mb-4">{t('Track and manage bugs for better project quality.')}</p>
                                        {canManageProject && (
                                            <Button onClick={() => router.get(route('bugs.index', { project_id: project.id, project_name: project.title }))}>
                                                <Plus className="h-4 w-4 mr-2" />
                                                {t('Report First Bug')}
                                            </Button>
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                        </TabsContent>

                        <TabsContent value="timesheet" className="space-y-6 mt-0">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-semibold">{t('Time Tracking')}</h3>
                                <div className="flex gap-2">
                                    <Button size="sm" onClick={() => router.get(route('timesheets.index', { project_id: project.id }))}>
                                        <Eye className="h-4 w-4 mr-2" />
                                        {t('Manage Timesheets')}
                                    </Button>
                                </div>
                            </div>

                            {projectTimesheets && projectTimesheets.length > 0 ? (
                                <div className="space-y-4">
                                    {/* Timesheet Stats */}
                                    {(() => {
                                        const totalHours = projectTimesheets.reduce((total: number, timesheet: any) => total + parseFloat(timesheet.total_hours || 0), 0);
                                        const billableHours = projectTimesheets.reduce((total: number, timesheet: any) => total + parseFloat(timesheet.billable_hours || 0), 0);
                                        const hoursDisplay = formatHoursDisplay(totalHours, billableHours);
                                        const overdueCount = projectTimesheets.filter((timesheet: any) => isTimesheetOverdue(timesheet.end_date, timesheet.status)).length;

                                        return (
                                            <>
                                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                    <Card>
                                                        <CardContent className="p-4">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <Timer className="h-4 w-4 text-blue-500" />
                                                                <span className="text-lg font-medium">{t('Total Hours')}</span>
                                                                {hoursDisplay.match && totalHours > 0 && (
                                                                    <CheckCircle className="h-4 w-4 text-green-500" title={t('Hours match')} />
                                                                )}
                                                            </div>
                                                            <p className="text-xl font-bold">{project.total_project_hours?.toFixed(1) || '0.0'}h</p>
                                                        </CardContent>
                                                    </Card>
                                                    <Card>
                                                        <CardContent className="p-4">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <Clock className="h-4 w-4 text-green-500" />
                                                                <span className="text-lg font-medium">{t('Billable Hours')}</span>
                                                            </div>
                                                            <p className="text-xl font-bold text-green-600">
                                                                {project.total_billable_hours?.toFixed(1) || '0.0'}h
                                                            </p>
                                                            <p className="text-xs text-gray-500 mt-1">{project.submitted_timesheets_percentage || 0}% {t('of total hours')}</p>
                                                        </CardContent>
                                                    </Card>
                                                    <Card>
                                                        <CardContent className="p-4">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <Users className="h-4 w-4 text-purple-500" />
                                                                <span className="text-lg font-medium">{t('Team Members')}</span>
                                                            </div>
                                                            <p className="text-xl font-bold">
                                                                {new Set(projectTimesheets.map((timesheet: any) => timesheet.user?.id)).size}
                                                            </p>
                                                        </CardContent>
                                                    </Card>
                                                    <Card>
                                                        <CardContent className="p-4">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <CheckSquare className="h-4 w-4 text-orange-500" />
                                                                <span className="text-lg font-medium">{t('Approved')}</span>
                                                            </div>
                                                            <p className="text-xl font-bold">
                                                                {projectTimesheets.filter((timesheet: any) => timesheet.status === 'approved').length}
                                                            </p>
                                                        </CardContent>
                                                    </Card>
                                                </div>

                                                {/* Hours Status Summary */}
                                                <div className="bg-card border rounded-lg p-4">
                                                    <div className="space-y-4">
                                                        <div className="flex items-center justify-between">
                                                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('Hours Status')}</h4>
                                                            <div className="flex items-center gap-2">
                                                                {hoursDisplay.match && totalHours > 0 ? (
                                                                    <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-green-50 dark:bg-green-900/40 text-green-700 dark:text-green-400 ring-1 ring-inset ring-green-600/20 dark:ring-green-500/30">
                                                                        {t('All Hours Billable')}
                                                                    </span>
                                                                ) : totalHours > 0 ? (
                                                                    <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-yellow-50 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 ring-1 ring-inset ring-yellow-600/20 dark:ring-yellow-500/30">
                                                                        {t('Partial Billable')}
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-400 ring-1 ring-inset ring-gray-600/20 dark:ring-gray-500/30">{t('No Hours Logged')}</span>
                                                                )}
                                                                {overdueCount > 0 && (
                                                                    <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-400 ring-1 ring-inset ring-red-600/20 dark:ring-red-500/30">
                                                                        {overdueCount} {t('Overdue')}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {totalHours > 0 && (
                                                            <div className="bg-white dark:bg-gray-800/60 rounded-md p-3 border border-gray-200 dark:border-gray-700">
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('Billable Rate')}</span>
                                                                    <span className="text-lg font-bold text-gray-900 dark:text-white">{project.submitted_timesheets_percentage}%</span>
                                                                </div>
                                                                <div className="relative">
                                                                    <Progress value={project.submitted_timesheets_percentage} className="w-full h-2 bg-gray-200 dark:bg-gray-700" />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </>
                                        );
                                    })()}

                                    {/* Recent Timesheets */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-lg">{t('Recent Timesheets')}</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {projectTimesheets.slice(0, 6).map((timesheet: any) => {
                                                    const hoursDisplay = formatHoursDisplay(timesheet.total_hours || 0, timesheet.billable_hours || 0);
                                                    const label = getTimesheetLabel({
                                                        total_hours: timesheet.total_hours || 0,
                                                        billable_hours: timesheet.billable_hours || 0,
                                                        end_date: timesheet.end_date,
                                                        status: timesheet.status
                                                    });
                                                    const isOverdue = isTimesheetOverdue(timesheet.end_date, timesheet.status);

                                                    return (
                                                        <div key={timesheet.id} className="flex flex-col gap-2 p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-sm transition-shadow">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="flex-1">
                                                                        <div className="flex items-center gap-2">
                                                                            <h4 className="font-medium text-sm">
                                                                                {t('Week of')} {window.appSettings.formatDateTime(new Date(timesheet.start_date),false)}
                                                                            </h4>
                                                                            {hoursDisplay.match && timesheet.total_hours > 0 && (
                                                                                <CheckCircle className="h-3 w-3 text-green-500" title={t('Hours match')} />
                                                                            )}
                                                                            {isOverdue && (
                                                                                <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20">
                                                                                    {getDaysOverdue(timesheet.end_date)}{t('d overdue')}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <p className="text-xs text-gray-500 mt-1">
                                                                            {window.appSettings.formatDateTime(new Date(timesheet.start_date),false)} - {window.appSettings.formatDateTime(new Date(timesheet.end_date),false)}
                                                                        </p>
                                                                        {label && (
                                                                            <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium mt-1 ${label.className}`}>
                                                                                {label.label}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span
                                                                            className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                                                                                timesheet.status === 'approved' ? 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20' :
                                                                                timesheet.status === 'submitted' ? 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20' :
                                                                                timesheet.status === 'rejected' ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20' :
                                                                                isOverdue ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20' :
                                                                                'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20'
                                                                            }`}
                                                                        >
                                                                            {isOverdue ? formatText('overdue') : formatText(timesheet.status)}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center justify-between mt-2">
                                                                    <div className="flex items-center gap-2">
                                                                        {timesheet.user ? (
                                                                            <div className="flex items-center gap-1">
                                                                                <Avatar className="h-5 w-5">
                                                                                    <AvatarImage src={timesheet.user.avatar} />
                                                                                    <AvatarFallback className="text-xs">
                                                                                        {timesheet.user.name?.charAt(0)}
                                                                                    </AvatarFallback>
                                                                                </Avatar>
                                                                                <span className="text-xs text-gray-600">{timesheet.user.name}</span>
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-xs text-gray-400">{t('Unknown User')}</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center gap-4">
                                                                        <div className="flex items-center gap-1">
                                                                            <Timer className="h-3 w-3 text-blue-500" />
                                                                            <span className="text-xs text-gray-600">{hoursDisplay.total}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-1">
                                                                            <DollarSign className="h-3 w-3 text-green-500" />
                                                                            <span className="text-xs text-green-600">
                                                                                {hoursDisplay.billable} ({hoursDisplay.percentage}%)
                                                                            </span>
                                                                        </div>
                                                                        <span className="text-xs text-gray-500">
                                                                            {timesheet.entries?.length || 0} {t('entries')}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {projectTimesheets.length > 6 && (
                                                <div className="mt-4 text-center">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => router.get(route('timesheets.index', { project_id: project.id }))}
                                                    >
                                                        {t('View All')} {t('timesheets')}
                                                    </Button>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>
                            ) : (
                                <Card>
                                    <CardContent className="p-8 text-center">
                                        <Timer className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                                        <h3 className="text-lg font-semibold mb-2">{t('No Timesheets Yet')}</h3>
                                        <p className="text-gray-500 mb-4">{t('Start tracking time on project tasks to see timesheet data here.')}</p>
                                        {canManageProject && (
                                            <Button onClick={() => router.get(route('timesheets.index', { project_id: project.id }))}>
                                                <Plus className="h-4 w-4 mr-2" />
                                                {t('Create First Timesheet')}
                                            </Button>
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                        </TabsContent>

                        <TabsContent value="attachments" className="space-y-6 mt-0">
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-semibold">{t('Project Attachments')}</h3>
                                    {hasPermission(permissions, 'project_manage_attachments') && (
                                        <Button size="sm" onClick={() => handleAction('add-attachment')}>
                                            <Upload className="h-4 w-4 mr-2" />
                                            {t('Upload Files')}
                                        </Button>
                                    )}
                                </div>

            <div className="bg-white dark:bg-gray-900 rounded-lg shadow mb-4 border">
                                {/* Search and Filter Bar */}
                                <SearchAndFilterBar
                                    searchTerm={attachmentSearch}
                                    onSearchChange={setAttachmentSearch}
                                    onSearch={(e) => { e.preventDefault(); handleAttachmentSearch(); }}
                                    searchPlaceholder={t('Search by filename or uploader...')}
                                    filters={[]}
                                    hasActiveFilters={() => false}
                                    activeFilterCount={() => 0}
                                    onResetFilters={() => {
                                        setAttachmentSearch('');
                                        router.get(route('projects.show', project.id), {}, {
                                            preserveState: true,
                                            preserveScroll: true,
                                            only: ['project', 'attachmentFilters']
                                        });
                                    }}
                                />
                            </div>
</div>
                            {project.attachments && project.attachments.data?.length > 0 ? (
                                <>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                                        {project.attachments.data.map((attachment: any) => (
                                            <Card key={attachment.id} className="group hover:shadow-lg transition-all duration-200 border-0 shadow-md hover:scale-[1.02] bg-gradient-to-br from-white to-gray-50">
                                                <CardContent className="p-0">
                                                    {/* Image Preview */}
                                                    <div className="relative overflow-hidden rounded-t-lg">
                                                        {attachment.media_item?.url ? (
                                                            <div className="relative">
                                                                {(() => {
                                                                    const name = attachment.media_item.name || '';
                                                                    const ext = name.split('.').pop()?.toLowerCase() || '';
                                                                    const isImage = attachment.media_item.mime_type?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext);
                                                                    if (isImage) {
                                                                        return (
                                                                            <>
                                                                            <img
                                                                                src={attachment.media_item.url}
                                                                                alt={name}
                                                                                className="w-full h-24 object-cover transition-transform duration-200 group-hover:scale-105"
                                                                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                                            />
                                                                            {/* Overlay */}
                                                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer flex items-center justify-center"
                                                                                onClick={() => window.open(attachment.media_item.url, '_blank')}>
                                                                                <div className="bg-white/25 border border-white/40 rounded-full p-1.5"><Eye className="h-3.5 w-3.5 text-white" /></div>
                                                                            </div>
                                                                            {/* Action Buttons */}
                                                                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200" onClick={(e) => e.stopPropagation()}>
                                                                                <Button variant="secondary" size="icon" className="h-8 w-8 bg-white/90 hover:bg-white shadow-md dark:bg-gray-900/90 dark:hover:bg-gray-900"
                                                                                    onClick={() => { if (attachment.media_item?.url) { window.open(route('project-attachments.download', attachment.id), '_blank'); } }}>
                                                                                    <Download className="h-4 w-4 text-gray-700" />
                                                                                </Button>
                                                                                {canManageProject && (
                                                                                    <Button variant="secondary" size="icon" className="h-8 w-8 bg-red-500/90 hover:bg-red-600 shadow-md"
                                                                                        onClick={() => { setModalType('attachment'); handleAction('delete-attachment', attachment); }}>
                                                                                        <Trash2 className="h-4 w-4 text-white" />
                                                                                    </Button>
                                                                                )}
                                                                            </div>
                                                                            </>
                                                                        );
                                                                    }
                                                                    const fileConfig: Record<string, { icon: React.ReactNode; bg: string; color: string }> = {
                                                                        pdf: { icon: <FileText className="h-8 w-8" />, bg: 'bg-red-50', color: 'text-red-500' },
                                                                        doc: { icon: <FileText className="h-8 w-8" />, bg: 'bg-blue-50', color: 'text-blue-500' },
                                                                        docx: { icon: <FileText className="h-8 w-8" />, bg: 'bg-blue-50', color: 'text-blue-500' },
                                                                        xls: { icon: <FileSpreadsheet className="h-8 w-8" />, bg: 'bg-green-50', color: 'text-green-500' },
                                                                        xlsx: { icon: <FileSpreadsheet className="h-8 w-8" />, bg: 'bg-green-50', color: 'text-green-500' },
                                                                        csv: { icon: <FileSpreadsheet className="h-8 w-8" />, bg: 'bg-green-50', color: 'text-green-500' },
                                                                        zip: { icon: <FileArchive className="h-8 w-8" />, bg: 'bg-yellow-50', color: 'text-yellow-500' },
                                                                        rar: { icon: <FileArchive className="h-8 w-8" />, bg: 'bg-yellow-50', color: 'text-yellow-500' },
                                                                        js: { icon: <FileCode className="h-8 w-8" />, bg: 'bg-purple-50', color: 'text-purple-500' },
                                                                        ts: { icon: <FileCode className="h-8 w-8" />, bg: 'bg-purple-50', color: 'text-purple-500' },
                                                                        html: { icon: <FileCode className="h-8 w-8" />, bg: 'bg-orange-50', color: 'text-orange-500' },
                                                                    };
                                                                    const config = fileConfig[ext] || { icon: <File className="h-8 w-8" />, bg: 'bg-gray-100', color: 'text-gray-400' };
                                                                    return (
                                                                        <div className={`relative w-full h-24 ${config.bg} flex flex-col items-center justify-center gap-1`}>
                                                                            <span className={config.color}>{config.icon}</span>
                                                                            <span className="text-xs font-semibold text-gray-500 uppercase">{ext}</span>
                                                                            {/* Overlay */}
                                                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer flex items-center justify-center"
                                                                                onClick={() => window.open(attachment.media_item.url, '_blank')}>
                                                                                <div className="bg-white/25 border border-white/40 rounded-full p-1.5"><Eye className="h-3.5 w-3.5 text-white" /></div>
                                                                            </div>
                                                                            {/* Action Buttons */}
                                                                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200" onClick={(e) => e.stopPropagation()}>
                                                                                <Button variant="secondary" size="icon" className="h-8 w-8 bg-white/90 hover:bg-white shadow-md dark:bg-gray-900/90 dark:hover:bg-gray-900"
                                                                                    onClick={() => { if (attachment.media_item?.url) { window.open(route('project-attachments.download', attachment.id), '_blank'); } }}>
                                                                                    <Download className="h-4 w-4 text-gray-700" />
                                                                                </Button>
                                                                                {canManageProject && (
                                                                                    <Button variant="secondary" size="icon" className="h-8 w-8 bg-red-500/90 hover:bg-red-600 shadow-md"
                                                                                        onClick={() => { setModalType('attachment'); handleAction('delete-attachment', attachment); }}>
                                                                                        <Trash2 className="h-4 w-4 text-white" />
                                                                                    </Button>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </div>
                                                        ) : (
                                                            <div className="w-full h-24 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                                                                <Paperclip className="h-6 w-6 text-gray-400" />
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Content */}
                                                    <div className="p-2 dark:bg-gray-900 rounded-b-lg">
                                                        <h4 className="font-medium text-xs text-gray-900 truncate mb-1" title={attachment.media_item?.name}>
                                                            {attachment.media_item?.name || t('Unnamed file')}
                                                        </h4>
                                                        <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                                                            <Avatar className="h-3 w-3">
                                                                <AvatarImage src={attachment.uploaded_by?.avatar} />
                                                                <AvatarFallback className="text-xs bg-blue-100 text-blue-600">
                                                                    {attachment.uploaded_by?.name?.charAt(0)}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <span className="truncate">{attachment.uploaded_by?.name}</span>
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {window.appSettings.formatDateTime(new Date(attachment.created_at),false)}
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>

                                    {/* Pagination */}
                                    {project.attachments.last_page > 1 && (
                                        <Pagination
                                            from={project.attachments.from || 0}
                                            to={project.attachments.to || 0}
                                            total={project.attachments.total || 0}
                                            links={project.attachments.links}
                                            currentPerPage={attachmentsPerPage.toString()}
                                            onPerPageChange={handleAttachmentPerPageChange}
                                            perPageOptions={[6, 12, 24, 48]}
                                            onPageChange={(url) => {
                                                const params: any = {};
                                                new URL(url, window.location.origin).searchParams.forEach((value, key) => {
                                                    params[key] = value;
                                                });
                                                if (attachmentSearch) params.attachment_search = attachmentSearch;
                                                router.get(route('projects.show', project.id), params, {
                                                    preserveState: true,
                                                    preserveScroll: true,
                                                    only: ['project', 'attachmentFilters']
                                                });
                                            }}
                                        />
                                    )}
                                </>
                            ) : (
                                <div className="text-center py-16">
                                    <div className="mx-auto w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                                        <Paperclip className="h-10 w-10 text-primary" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                        {attachmentSearch ? t('No attachments found') : t('No attachments yet')}
                                    </h3>
                                    <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                                        {attachmentSearch ? t('Try adjusting your search terms or') + ' ' : t('Upload files to share documents, images, and other resources with your team.')}
                                        {attachmentSearch && (
                                            <Button variant="link" className="p-0 h-auto" onClick={() => {
                                                setAttachmentSearch('');
                                                router.get(route('projects.show', project.id), {}, {
                                                    preserveState: true,
                                                    preserveScroll: true,
                                                    only: ['project', 'attachmentFilters']
                                                });
                                            }}>
                                                {t('Clear search')}
                                            </Button>
                                        )}
                                    </p>
                                    {!attachmentSearch && canManageProject && (
                                        <Button onClick={() => handleAction('add-attachment')}>
                                            <Upload className="h-4 w-4 mr-2" />
                                            {t('Upload First Attachment')}
                                        </Button>
                                    )}
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="activity" className="mt-0">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold">{t('Project Activity')}</h3>
                            </div>

                            {project.activities && project.activities.data?.length > 0 ? (
                                <div className="overflow-y-auto panel-scrollbar" style={{ maxHeight: '520px' }}>
                                    <div className="relative">
                                        {/* Vertical center line */}
                                        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-200 -translate-x-1/2" />

                                        {project.activities.data.map((activity: any, index: number) => {
                                            const isLeft = index % 2 === 0;
                                            return (
                                                <div key={activity.id} className={`relative flex items-start mb-2 ${isLeft ? 'flex-row' : 'flex-row-reverse'}`}>
                                                    {/* Content side */}
                                                    <div className={`w-[calc(50%-20px)] ${isLeft ? 'pr-1' : 'pl-1'}`}>
                                                        <div className={`w-fit max-w-full bg-white border rounded-lg p-4 shadow-sm ${isLeft ? 'text-right ml-auto' : 'text-left'}`}>
                                                            {/* <p className="text-sm text-gray-800">{activity.description}</p> */}
                                                            <div className={`flex items-center gap-3 mt-1.5 text-xs text-gray-500 ${isLeft ? 'flex-row-reverse' : 'flex-row'}`}>
                                                                <Avatar className="h-9 w-9">
                                                                    <AvatarImage src={activity.user.avatar} />
                                                                    <AvatarFallback className="text-sm">{activity.user.name.charAt(0)}</AvatarFallback>
                                                                </Avatar>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-semibold text-gray-900">{activity.user.name}</p>
                                                                    <p className="text-xs text-gray-500">{window.appSettings.formatDateTime(new Date(activity.created_at),false)}</p>
                                                                </div>
                                                            </div>
                                                            <p className="text-sm text-gray-700 mt-3 break-words">{activity.description}</p>
                                                        </div>
                                                    </div>

                                                    {/* Center dot */}
                                                    <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary border-2 border-white shadow z-10" />

                                                    {/* Empty opposite side */}
                                                    <div className="w-[calc(50%-20px)]" />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500">
                                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                        {t('No activity recorded yet')}
                                    </h3>
                                    <p className="text-gray-500">{t('Project activities will appear here as they happen.')}</p>
                                </div>
                            )}
                        </TabsContent>
                    </div>
                </Tabs>
            </div>

            {/* View Note Modal */}
            <Dialog open={!!viewNote} onOpenChange={() => setViewNote(null)}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
                    <DialogHeader className="px-6 pt-6 pb-4 border-b">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <Eye className="h-5 w-5 text-primary" />
                            </div>
                            <DialogTitle className="text-xl font-semibold">{t('Note Details')}</DialogTitle>
                        </div>
                    </DialogHeader>
                    <div className="px-6 py-4 pb-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                                    <Edit className="h-4 w-4" />
                                    {t('Title')}
                                </label>
                                <p className="mt-1 text-sm font-medium text-gray-900">{viewNote?.title || '-'}</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                                    <Pin className="h-4 w-4" />
                                    {t('Pinned')}
                                </label>
                                <p className="mt-1">
                                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${viewNote?.is_pinned ? 'bg-yellow-50 text-yellow-700 ring-yellow-600/20' : 'bg-gray-50 text-gray-700 ring-gray-600/20'}`}>
                                        {viewNote?.is_pinned ? t('Pinned') : t('Not Pinned')}
                                    </span>
                                </p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    {t('Created By')}
                                </label>
                                <p className="mt-1 text-sm font-medium text-gray-900">{viewNote?.creator?.name || '-'}</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                                    <Calendar className="h-4 w-4" />
                                    {t('Created At')}
                                </label>
                                <p className="mt-1 text-sm font-medium text-gray-900">
                                    {viewNote?.created_at ? window.appSettings.formatDateTime(new Date(viewNote.created_at),false) : '-'}
                                </p>
                            </div>
                        </div>
                        {viewNote?.content && (
                            <div>
                                <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                                    <Clock className="h-4 w-4" />
                                    {t('Content')}
                                </label>
                                <p className="mt-1 text-sm font-medium text-gray-900 whitespace-pre-wrap">{viewNote.content}</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Form Modal */}
            <CrudFormModal
                isOpen={isFormModalOpen}
                onClose={() => setIsFormModalOpen(false)}
                onSubmit={handleFormSubmit}
                formConfig={getFormConfig()}
                initialData={currentItem || (modalType === 'milestone' ? { status: 'pending' } : modalType === 'member' ? { role: 'member' } : modalType === 'project' ? { status: 'planning', priority: 'medium', is_public: false } : {})}
                title={modalType === 'project' ? t('Edit Project') : `${formMode === 'create' ? t('Add') : t('Edit')} ${modalType.charAt(0).toUpperCase() + modalType.slice(1)}`}
                mode={formMode}
            />

            {/* Delete Modal */}
            <CrudDeleteModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDeleteConfirm}
                itemName={currentItem?.title || currentItem?.name || currentItem?.user?.name || currentItem?.media_item?.name || ''}
                entityName={modalType === 'member' ? t('team member') : modalType}
                warningMessage={
                    modalType === 'member' ? `${t('This will remove')} ${currentItem?.user?.name || t('this member')} ${t('from the project team.')}` :
                        modalType === 'client' ? `${t('This will remove')} ${currentItem?.name || t('this client')} ${t('from the project.')}` :
                            modalType === 'attachment' ? `${t('This file will be permanently deleted from the project.')}` :
                                `${t('This action cannot be undone.')}`
                }
                additionalInfo={
                    modalType === 'member' ? [
                        t('Access to project resources will be revoked'),
                        t('Task assignments may need to be reassigned'),
                        t('Time tracking history will be preserved')
                    ] :
                        modalType === 'client' ? [
                            t('Client access to project will be removed'),
                            t('Project visibility for this client will be revoked')
                        ] :
                            modalType === 'attachment' ? [
                                t('File will be removed from all project references'),
                                t('Download history will be preserved')
                            ] : []
                }
            />

            {/* Timesheet Modal */}
            <TimesheetFormModal
                isOpen={isTimesheetModalOpen}
                onClose={() => setIsTimesheetModalOpen(false)}
                projects={[project]}
            />

            {/* Shared Project Settings Modal */}
            <SharedProjectSettingsModal
                isOpen={isSharedSettingsModalOpen}
                onClose={() => setIsSharedSettingsModalOpen(false)}
                project={project}
            />
        </PageTemplate>
    );
}
