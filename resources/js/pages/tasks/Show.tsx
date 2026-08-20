import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { PageTemplate } from '@/components/page-template';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    CheckSquare, Flag, Layers, Calendar, User, FolderOpen, Edit, ArrowLeft, Milestone,
    Folder,
    MessageSquare,
    CircleUser,
    Plus
} from 'lucide-react';
import TaskComments from '@/components/tasks/TaskComments';
import TaskAttachments from '@/components/tasks/TaskAttachments';
import TaskChecklist from '@/components/tasks/TaskChecklist';
import TaskFormModal from '@/components/tasks/TaskFormModal';
import MediaLibraryModal from '@/components/MediaLibraryModal';

interface Props {
    task: any;
    members: any[];
    stages: any[];
    milestones: any[];
    workspace_role: string | null;
    permissions: any;
}

export default function TaskShow({ task, members, stages, milestones, workspace_role, permissions }: Props) {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('details');
    const [taskData, setTaskData] = useState(task);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);

    const handleAttachmentSelect = async (url: string, mediaIds?: number[]) => {
        if (mediaIds && mediaIds.length > 0) {
            try {
                const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
                await fetch(route('task-attachments.store', taskData.id), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-CSRF-TOKEN': csrfToken,
                    },
                    body: JSON.stringify({ media_item_ids: mediaIds })
                });
                setIsMediaModalOpen(false);
                await handleUpdate();
            } catch (error) {
                console.error('Failed to add attachment:', error);
            }
        }
    };

    const getPriorityColor = (priority: string) => {
        const colors: Record<string, string> = {
            critical: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20',
            high: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20',
            medium: 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20',
            low: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20',
        };
        return colors[priority] || 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20';
    };

    const capitalizeFirst = (str: string) =>
        str ? str.charAt(0).toUpperCase() + str.slice(1).replace('_', ' ') : '-';

    const handleUpdate = async () => {
        const response = await fetch(route('tasks.show', taskData.id), {
            headers: { 'Accept': 'application/json' }
        });
        const data = await response.json();
        setTaskData(data.task);
    };

    const breadcrumbs = [
        { title: t('Dashboard'), href: route('dashboard') },
        { title: t('Tasks'), href: route('tasks.index') },
        { title: taskData.title }
    ];

    const pageActions = [];
    if (workspace_role !== 'client' && permissions?.update) {
        pageActions.push({
            label: t('Edit Task'),
            icon: <Edit className="h-4 w-4 mr-2" />,
            variant: 'default' as const,
            onClick: () => setIsEditModalOpen(true)
        });
        pageActions.push({
            label: t('Back'),
            icon: <ArrowLeft className="h-4 w-4 mr-2" />,
            variant: 'outline' as const,
            onClick: () => router.visit(route('tasks.index'))
        });
    }

    return (
        <PageTemplate
            title={taskData.title}
            description={t('View and manage task details.')}
            url="/tasks"
            actions={pageActions}
            breadcrumbs={breadcrumbs}
        >
            <Head title={taskData.title} />           

            {/* Info stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {/* Stage */}
                <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 rounded-bl-full" />
                    <CardContent className="relative p-5">
                        <div className="flex items-start justify-between">
                            <div className="min-w-0 pr-2">
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Stage')}</p>
                                <p className="text-lg font-bold text-gray-900 dark:text-white truncate">
                                    {taskData.task_stage?.name || '-'}
                                </p>
                            </div>
                            <div className="relative z-10 p-2.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl mt-0.5 shrink-0">
                                <Layers className="h-5 w-5 text-indigo-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Priority */}
                <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-orange-50 dark:bg-orange-900/30 rounded-bl-full" />
                    <CardContent className="relative p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Priority')}</p>
                                <p className="text-lg font-bold text-gray-900 dark:text-white">
                                    {capitalizeFirst(taskData.priority) || '-'}
                                </p>
                            </div>
                            <div className="relative z-10 p-2.5 bg-orange-50 dark:bg-orange-900/30 rounded-xl mt-0.5 shrink-0">
                                <Flag className="h-5 w-5 text-orange-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Project */}
                <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-bl-full" />
                    <CardContent className="relative p-5">
                        <div className="flex items-start justify-between">
                            <div className="min-w-0 pr-2">
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Project')}</p>
                                <p className="text-lg font-bold text-gray-900 dark:text-white truncate">
                                    {taskData.project?.title || '-'}
                                </p>
                            </div>
                            <div className="relative z-10 p-2.5 bg-blue-50 dark:bg-blue-900/30 rounded-xl mt-0.5 shrink-0">
                                <Folder className="h-5 w-5 text-blue-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Milestone */}
                <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-purple-50 dark:bg-purple-900/30 rounded-bl-full" />
                    <CardContent className="relative p-5">
                        <div className="flex items-start justify-between">
                            <div className="min-w-0 pr-2">
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Milestone')}</p>
                                <p className="text-lg font-bold text-gray-900 dark:text-white truncate">
                                    {taskData.milestone?.title || '-'}
                                </p>
                            </div>
                            <div className="relative z-10 p-2.5 bg-purple-50 dark:bg-purple-900/30 rounded-xl mt-0.5 shrink-0">
                                <Milestone className="h-5 w-5 text-purple-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Progress bar */}
            <Card className="mb-6">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">{t('Progress')}</span>
                        <span className="text-sm font-semibold text-gray-900">{taskData.progress || 0}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                            className="h-2 rounded-full transition-all"
                            style={{
                                width: `${taskData.progress || 0}%`,
                                backgroundColor: (taskData.progress || 0) >= 100 ? '#22c55e' : (taskData.progress || 0) >= 50 ? '#f59e0b' : '#3b82f6'
                            }}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Tabs */}
            <div className="flex flex-col">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="relative">
                    <div className="mb-6 ">
                        <TabsList className="w-full">
                            <TabsTrigger value="details" className="flex-1 cursor-pointer">
                                {t('Details')}
                            </TabsTrigger>
                            <TabsTrigger value="comments" className="flex-1 cursor-pointer">
                                {t('Comments')}{taskData.comments?.length ? ` (${taskData.comments.length})` : ''}
                            </TabsTrigger>
                            <TabsTrigger value="checklist" className="flex-1 cursor-pointer">
                                {t('Checklist')}{taskData.checklists?.length ? ` (${taskData.checklists.length})` : ''}
                            </TabsTrigger>
                            <TabsTrigger value="attachments" className="flex-1 cursor-pointer">
                                {t('Attachments')}{taskData.attachments?.length ? ` (${taskData.attachments.length})` : ''}
                            </TabsTrigger>
                        </TabsList>
                    </div>
                    <div className="p-0 relative overflow-visible z-0">

                    {/* Details Tab */}
                        <TabsContent value="details" className="mt-0 space-y-4">

                            {/* Description Card - full width */}
                            <Card>
                                <CardContent className="p-5">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-4">
                                            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950 shrink-0">
                                                <CheckSquare className="h-5 w-5 text-indigo-500" />
                                            </div>
                                            <div>
                                                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">{t("Task Description")}</h3>
                                                {taskData.description ? (
                                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-17 overflow-y-auto pr-1">
                                                        {taskData.description}
                                                    </p>
                                                ) : (
                                                    <p className="text-sm text-muted-foreground">{t("No description provided.")}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Timeline + Task Information */}
                            <div className="grid gap-4 lg:grid-cols-2">

                                {/* Timeline Card */}
                                <Card>
                                    <CardContent className="p-5">
                                        <div className="flex items-center gap-3 pb-5 border-b mb-5 -mx-5 px-5">
                                            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950 shrink-0">
                                                <Calendar className="h-5 w-5 text-indigo-500" />
                                            </div>
                                            <h3 className="text-base font-bold text-gray-900 dark:text-white">{t("Timeline")}</h3>
                                        </div>

                                        <div>
                                            {/* Created */}
                                            <div className="flex gap-4">
                                                <div className="flex flex-col items-center shrink-0">
                                                    <div className="w-9 h-9 rounded-full bg-purple-50 border-2 border-purple-200 flex items-center justify-center">
                                                        <div className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                                                    </div>
                                                    <div className="w-px flex-1 bg-gray-200 my-1" />
                                                </div>
                                                <div className="flex-1 flex items-center justify-between h-9 mb-6">
                                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-24 shrink-0">{t("Created")}</span>
                                                    <div className="flex items-center gap-1.5 text-gray-500 whitespace-nowrap">
                                                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                                                        <span className="text-sm">{taskData.created_at ? window.appSettings.formatDateTime(new Date(taskData.created_at), false) : "-"}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Start Date */}
                                            <div className="flex gap-4">
                                                <div className="flex flex-col items-center shrink-0">
                                                    <div className="w-9 h-9 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center">
                                                        <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                                                    </div>
                                                    <div className="w-px flex-1 bg-gray-200 my-1" />
                                                </div>
                                                <div className="flex-1 flex items-center justify-between h-9 mb-6">
                                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-24 shrink-0">{t("Start Date")}</span>
                                                    <div className="flex items-center gap-1.5 text-gray-500 whitespace-nowrap">
                                                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                                                        <span className="text-sm">{taskData.start_date ? window.appSettings.formatDateTime(new Date(taskData.start_date), false) : t("Not set")}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Deadline */}
                                            <div className="flex gap-4">
                                                <div className="flex flex-col items-center shrink-0">
                                                    <div className="w-9 h-9 rounded-full bg-indigo-50 border-2 border-indigo-200 flex items-center justify-center">
                                                        <Flag className="h-4 w-4 text-indigo-400" />
                                                    </div>
                                                </div>
                                                <div className="flex-1 flex items-center justify-between h-9">
                                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-24 shrink-0">{t("Deadline")}</span>
                                                    <div className="flex items-center gap-1.5 text-gray-500 whitespace-nowrap">
                                                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                                                        <span className="text-sm">{taskData.end_date ? window.appSettings.formatDateTime(new Date(taskData.end_date), false) : t("Not set")}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Task Information Card */}
                                <Card>
                                    <CardContent className="p-5">
                                        <div className="flex items-center gap-3 pb-5 border-b mb-5 -mx-5 px-5">
                                            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950 shrink-0">
                                                <Layers className="h-5 w-5 text-indigo-500" />
                                            </div>
                                            <h3 className="text-base font-bold text-gray-900 dark:text-white">{t("Task Information")}</h3>
                                        </div>

                                        <div>
                                            <div className="flex items-center justify-between py-3">
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <Layers className="h-4 w-4" />
                                                    <span className="text-sm">{t("Stage")}</span>
                                                </div>
                                                <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset" style={{ backgroundColor: (taskData.task_stage?.color || '#6366f1') + '18', color: taskData.task_stage?.color || '#6366f1', '--tw-ring-color': (taskData.task_stage?.color || '#6366f1') + '33' } as React.CSSProperties}>
                                                    {taskData.task_stage?.name || "-"}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between py-3">
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <Flag className="h-4 w-4" />
                                                    <span className="text-sm">{t("Priority")}</span>
                                                </div>
                                                <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${getPriorityColor(taskData.priority)}`}>
                                                    {capitalizeFirst(taskData.priority)}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between py-3">
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <Folder className="h-4 w-4" />
                                                    <span className="text-sm">{t("Project")}</span>
                                                </div>
                                                <span className="text-sm font-semibold text-gray-900 dark:text-white">{taskData.project?.title || "-"}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-3">
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <Milestone className="h-4 w-4" />
                                                    <span className="text-sm">{t("Milestone")}</span>
                                                </div>
                                                <span className="text-sm font-semibold text-gray-900 dark:text-white">{taskData.milestone?.title || "-"}</span>
                                            </div>
                                        </div>

                                        {/* Assigned To + Created By */}
                                        <div className="grid grid-cols-2 gap-4 pt-4 border-t mt-1">
                                            <div>
                                                <p className="text-xs text-muted-foreground mb-3">{t("Assigned To")}</p>
                                                {taskData.assigned_to ? (
                                                    <div className="flex items-center gap-2.5">
                                                        <Avatar className="h-9 w-9 shrink-0">
                                                            <AvatarImage src={taskData.assigned_to.avatar} />
                                                            <AvatarFallback>{taskData.assigned_to.name?.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-semibold truncate">{taskData.assigned_to.name}</p>
                                                            <p className="text-xs text-muted-foreground truncate">{taskData.assigned_to.email || "-"}</p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-muted-foreground">{t("Unassigned")}</p>
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground mb-3">{t("Created By")}</p>
                                                {taskData.creator ? (
                                                    <div className="flex items-center gap-2.5">
                                                        <Avatar className="h-9 w-9 shrink-0">
                                                            <AvatarImage src={taskData.creator.avatar} />
                                                            <AvatarFallback>{taskData.creator.name?.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-semibold truncate">{taskData.creator.name}</p>
                                                            <p className="text-xs text-muted-foreground truncate">{taskData.creator.email || "-"}</p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-muted-foreground">-</p>
                                                )}
                                            </div>
                                        </div>

                                    </CardContent>
                                </Card>

                            </div>
                        </TabsContent>
                    {/* Comments Tab */}
                    <TabsContent value="comments" className="min-h-[300px]">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    {t('Task Comments')}
                                </CardTitle>
                            </CardHeader>
<CardContent className='border-t p-0'>
    <div className="h-full p-6">
                            <TaskComments
                            task={taskData}
                            comments={taskData.comments || []}
                            currentUser={members[0]}
                            onUpdate={handleUpdate}
                            canAddComments={workspace_role !== 'client'}
                        />
                        </div>
                        </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Checklist Tab */}
                    <TabsContent value="checklist" className="min-h-[300px]">
                         <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    {t('Task Lists')}
                                </CardTitle>
                            </CardHeader>
<CardContent className='border-t p-0' style={{ height: '500px' }}>
        <div className="h-full p-6">

                        <TaskChecklist
                            task={taskData}
                            checklist={taskData.checklists || []}
                            members={taskData.project?.members?.filter((m: any) => m.user?.type !== 'client').map((m: any) => m.user) || members}
                            onUpdate={handleUpdate}
                            canManageChecklists={workspace_role !== 'client' && workspace_role !== 'member'}
                        />
                        </div>
                        </CardContent>
                        </Card>
                    </TabsContent>
                    {/* Attachments Tab */}
                    <TabsContent value="attachments" className="min-h-[300px]">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    {t('Task Attachments')}
                                </CardTitle>
                                {workspace_role !== 'client' && workspace_role !== 'member' && (
                                    <Button size="sm" onClick={() => setIsMediaModalOpen(true)}>
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                )}
                            </CardHeader>
                            <CardContent className='border-t' style={{ maxHeight: '500px', overflowY: 'auto' }}>
                                <TaskAttachments
                                    task={taskData}
                                    attachments={taskData.attachments || []}
                                    availableMedia={taskData.project?.workspace?.media || []}
                                    onUpdate={handleUpdate}
                                    canAddAttachments={false}
                                    canManageAttachments={workspace_role !== 'client' && workspace_role !== 'member'}
                                />
                            </CardContent>
                        </Card>
                        <MediaLibraryModal
                            isOpen={isMediaModalOpen}
                            onClose={() => setIsMediaModalOpen(false)}
                            onSelect={handleAttachmentSelect}
                            multiple={true}
                        />
                    </TabsContent>
                    </div>
                </Tabs>
            </div>
            {/* Edit Modal */}
            <TaskFormModal
                isOpen={isEditModalOpen}
                onClose={() => { setIsEditModalOpen(false); handleUpdate(); }}
                task={taskData}
                projects={taskData.project ? [taskData.project] : []}
                members={members}
                milestones={milestones}
            />
        </PageTemplate>
    );
}
