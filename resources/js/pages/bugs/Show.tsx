import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { PageTemplate } from '@/components/page-template';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import { Button } from '@/components/ui/button';
import {
    Flag, Layers, Folder, Edit, ArrowLeft, Milestone,
    AlertTriangle, Zap, Bug, MessageSquare, Paperclip, Send,
    Trash2, Edit2, MoreHorizontal, Download, Eye,
    File, Image, FileText, FileSpreadsheet, FileArchive, FileCode, Plus, Calendar
} from 'lucide-react';
import { BugModal } from './BugModal';
import { CrudDeleteModal } from '@/components/CrudDeleteModal';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import MediaLibraryModal from '@/components/MediaLibraryModal';


interface Props {
    bug: any;
    members: any[];
    statuses: any[];
    milestones: any[];
    permissions: any;
}

export default function BugShow({ bug, members, statuses, milestones, permissions }: Props) {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('details');
    const [bugData, setBugData] = useState(bug);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // comment state
    const [newComment, setNewComment] = useState('');
    const [editingComment, setEditingComment] = useState<number | null>(null);
    const [editCommentText, setEditCommentText] = useState('');
    const [deleteCommentModal, setDeleteCommentModal] = useState<{ open: boolean; id: number | null }>({ open: false, id: null });

    // attachment state
    const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
    const [deleteAttachmentModal, setDeleteAttachmentModal] = useState<{ open: boolean; attachment: any | null }>({ open: false, attachment: null });

    const handleRefresh = async () => {
        const res = await fetch(route('bugs.show', bugData.id), { headers: { Accept: 'application/json' } });
        const data = await res.json();
        setBugData(data.bug);
    };

    const capitalizeFirst = (str: string) =>
        str ? str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ') : '-';

    const getPriorityColor = (priority: string) => {
        const colors: Record<string, string> = {
            critical: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20',
            high: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20',
            medium: 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20',
            low: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20',
        };
        return colors[priority] || 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20';
    };

    const getSeverityColor = (severity: string) => {
        const colors: Record<string, string> = {
            blocker: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20',
            critical: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20',
            major: 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20',
            minor: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20',
        };
        return colors[severity] || 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20';
    };

    const breadcrumbs = [
        { title: t('Dashboard'), href: route('dashboard') },
        { title: t('Bugs'), href: route('bugs.index') },
        { title: bugData.title },
    ];

    const pageActions: any[] = [];
    if (permissions?.update) {
        pageActions.push({
            label: t('Edit Bug'),
            icon: <Edit className="h-4 w-4 mr-2" />,
            variant: 'default' as const,
            onClick: () => setIsEditModalOpen(true),
        });
    }
    pageActions.push({
        label: t('Back'),
        icon: <ArrowLeft className="h-4 w-4 mr-2" />,
        variant: 'outline' as const,
        onClick: () => router.visit(route('bugs.index')),
    });

    return (
        <PageTemplate
            title={bugData.title}
            description={t('View and manage bug details.')}
            url="/bugs"
            actions={pageActions}
            breadcrumbs={breadcrumbs}
        >
            <Head title={bugData.title} />

            {/* ── Stat Cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">

                {/* Status */}
                <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-full" style={{ backgroundColor: (bugData.bug_status?.color || '#6366f1') + '20' }} />
                    <CardContent className="relative p-5">
                        <div className="flex items-start justify-between">
                            <div className="min-w-0 pr-2">
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Status')}</p>
                                <p className="text-lg font-bold text-gray-900 dark:text-white truncate">
                                    {bugData.bug_status?.name || '-'}
                                </p>
                            </div>
                            <div className="relative z-10 p-2.5 rounded-xl mt-0.5 shrink-0" style={{ backgroundColor: (bugData.bug_status?.color || '#6366f1') + '20' }}>
                                <Bug className="h-5 w-5" style={{ color: bugData.bug_status?.color || '#6366f1' }} />
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
                                    {capitalizeFirst(bugData.priority) || '-'}
                                </p>
                            </div>
                            <div className="relative z-10 p-2.5 bg-orange-50 dark:bg-orange-900/30 rounded-xl mt-0.5 shrink-0">
                                <Flag className="h-5 w-5 text-orange-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Severity */}
                <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-red-50 dark:bg-red-900/30 rounded-bl-full" />
                    <CardContent className="relative p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Severity')}</p>
                                <p className="text-lg font-bold text-gray-900 dark:text-white">
                                    {capitalizeFirst(bugData.severity) || '-'}
                                </p>
                            </div>
                            <div className="relative z-10 p-2.5 bg-red-50 dark:bg-red-900/30 rounded-xl mt-0.5 shrink-0">
                                <AlertTriangle className="h-5 w-5 text-red-500" />
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
                                    {bugData.project?.title || '-'}
                                </p>
                            </div>
                            <div className="relative z-10 p-2.5 bg-blue-50 dark:bg-blue-900/30 rounded-xl mt-0.5 shrink-0">
                                <Folder className="h-5 w-5 text-blue-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
            {/* ── END Stat Cards ── */}

            {/* ── Tabs ── */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="mb-6">
                    <TabsList className="w-full">
                        <TabsTrigger value="details" className="flex-1 cursor-pointer">{t('Details')}</TabsTrigger>
                        <TabsTrigger value="comments" className="flex-1 cursor-pointer">
                            {t('Comments')}{bugData.comments?.length ? ` (${bugData.comments.length})` : ''}
                        </TabsTrigger>
                        <TabsTrigger value="attachments" className="flex-1 cursor-pointer">
                            {t('Attachments')}{bugData.attachments?.length ? ` (${bugData.attachments.length})` : ''}
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* ── Details Tab ── */}
                <TabsContent value="details" className="mt-0 space-y-4">

                    {/* Description */}
                    <Card>
                        <CardContent className="p-5">
                            <div className="flex items-start gap-4">
                                <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950 shrink-0">
                                    <Bug className="h-5 w-5 text-indigo-500" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">{t('Bug Description')}</h3>
                                    {bugData.description ? (
                                        <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-17 overflow-y-auto pr-1">
                                            {bugData.description}
                                        </p>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">{t('No description provided.')}</p>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Reproduction Details + Bug Information side by side */}
                    <div className="grid gap-4 lg:grid-cols-2">

                        {/* Reproduction Details — Steps / Expected / Actual */}
                        <Card>
                            <CardContent className="p-5">
                                <div className="flex items-center gap-3 pb-5 border-b mb-5 -mx-5 px-5">
                                    <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950 shrink-0">
                                        <AlertTriangle className="h-5 w-5 text-red-500" />
                                    </div>
                                    <h3 className="text-base font-bold text-gray-900 dark:text-white">{t('Reproduction Details')}</h3>
                                </div>
                                <div className="space-y-5">
                                    {bugData.steps_to_reproduce ? (
                                        <div className='p-3'>
                                            <p className="text-xs font-semibold text-muted-foreground tracking-wide mb-2">{t('Steps to Reproduce')}</p>
                                            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed max-h-24 overflow-y-auto pr-1">{bugData.steps_to_reproduce}</p>
                                        </div>
                                    ) : null}
                                    {bugData.expected_behavior ? (
                                        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-100 dark:border-green-900">
                                            <p className="text-xs font-semibold text-green-700 dark:text-green-400 tracking-wide mb-2">{t('Expected Behavior')}</p>
                                            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap max-h-24 overflow-y-auto pr-1">{bugData.expected_behavior}</p>
                                        </div>
                                    ) : null}
                                    {bugData.actual_behavior ? (
                                        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900">
                                            <p className="text-xs font-semibold text-red-700 dark:text-red-400 tracking-wide mb-2">{t('Actual Behavior')}</p>
                                            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap max-h-24 overflow-y-auto pr-1">{bugData.actual_behavior}</p>
                                        </div>
                                    ) : null}
                                    {!bugData.steps_to_reproduce && !bugData.expected_behavior && !bugData.actual_behavior && (
                                        <p className="text-sm text-muted-foreground">{t('No reproduction details provided.')}</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Bug Information */}
                        <Card>
                            <CardContent className="p-5">
                                <div className="flex items-center gap-3 pb-5 border-b mb-5 -mx-5 px-5">
                                    <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950 shrink-0">
                                        <Layers className="h-5 w-5 text-indigo-500" />
                                    </div>
                                    <h3 className="text-base font-bold text-gray-900 dark:text-white">{t('Bug Information')}</h3>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between py-3">
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Bug className="h-4 w-4" />
                                            <span className="text-sm">{t('Status')}</span>
                                        </div>
                                        <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset"
                                            style={{ backgroundColor: (bugData.bug_status?.color || '#6366f1') + '18', color: bugData.bug_status?.color || '#6366f1', '--tw-ring-color': (bugData.bug_status?.color || '#6366f1') + '33' } as React.CSSProperties}>
                                            {bugData.bug_status?.name || '-'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between py-3">
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Flag className="h-4 w-4" />
                                            <span className="text-sm">{t('Priority')}</span>
                                        </div>
                                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${getPriorityColor(bugData.priority)}`}>
                                            {capitalizeFirst(bugData.priority)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between py-3">
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <AlertTriangle className="h-4 w-4" />
                                            <span className="text-sm">{t('Severity')}</span>
                                        </div>
                                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${getSeverityColor(bugData.severity)}`}>
                                            {capitalizeFirst(bugData.severity)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between py-3">
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Folder className="h-4 w-4" />
                                            <span className="text-sm">{t('Project')}</span>
                                        </div>
                                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{bugData.project?.title || '-'}</span>
                                    </div>
                                    <div className="flex items-center justify-between py-3 border-gray-100 dark:border-gray-700">
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Milestone className="h-4 w-4" />
                                            <span className="text-sm">{t('Milestone')}</span>
                                        </div>
                                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{bugData.milestone?.title || '-'}</span>
                                    </div>
                                    <div className="flex items-center justify-between py-3">
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Zap className="h-4 w-4" />
                                            <span className="text-sm">{t('Environment')}</span>
                                        </div>
                                        <span className="text-sm font-semibold text-gray-900 dark:text-white max-w-[180px] text-right">{bugData.environment || '-'}</span>
                                    </div>
                                </div>

                                {/* Assigned To / Reported By */}
                                <div className="grid grid-cols-2 gap-4 pt-4 border-t mt-1">
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-3">{t('Assigned To')}</p>
                                        {bugData.assigned_to ? (
                                            <div className="flex items-center gap-2.5">
                                                <Avatar className="h-9 w-9 shrink-0">
                                                    <AvatarImage src={bugData.assigned_to.avatar} />
                                                    <AvatarFallback>{bugData.assigned_to.name?.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold truncate">{bugData.assigned_to.name}</p>
                                                    <p className="text-xs text-muted-foreground truncate">{bugData.assigned_to.email || '-'}</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">{t('Unassigned')}</p>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-3">{t('Reported By')}</p>
                                        {bugData.reported_by ? (
                                            <div className="flex items-center gap-2.5">
                                                <Avatar className="h-9 w-9 shrink-0">
                                                    <AvatarImage src={bugData.reported_by?.avatar} />
                                                    <AvatarFallback>{bugData.reported_by?.name?.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold truncate">{bugData.reported_by?.name}</p>
                                                    <p className="text-xs text-muted-foreground truncate">{bugData.reported_by?.email || '-'}</p>
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
                {/* ── END Details Tab ── */}

                {/* ── Comments Tab ── */}
                <TabsContent value="comments" className="min-h-[300px]">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">{t('Bug Comments')}</CardTitle>
                        </CardHeader>
                        <CardContent className="border-t p-0">
                            <div className="p-6">
                                {/* Comment list */}
                <div className="overflow-y-auto pr-2 space-y-4 mb-4 max-h-[600px]">
                                    {bugData.comments?.length > 0 ? (
                                        bugData.comments.map((comment: any) => (
                                            <div key={comment.id} className="flex space-x-3 p-4 border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all">
                                                <div className="flex-1">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center space-x-2">
                                                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold uppercase overflow-hidden">
                                                                {comment.user?.avatar ? (
                                                                    <img src={comment.user.avatar} alt={comment.user.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    comment.user?.name?.substring(0, 2)
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-semibold text-gray-900 leading-none">{comment.user?.name}</p>
                                                                <p className="text-[10px] text-gray-500 mt-1">
                                                                    <div className="flex items-center gap-1 text-[10px] text-gray-500 mt-1">
                                                                    <Calendar className='w-3 h-3 shrink-0'/>
                                                                    {window.appSettings.formatDateTime(new Date(comment.created_at))}
                                                                    </div>
                                                                </p>
                                                            </div>
                                                        </div>
                                                        {(comment.can_update || comment.can_delete) && (
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                                        <MoreHorizontal className="h-4 w-4 text-gray-400" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    {comment.can_update && (
                                                                        <DropdownMenuItem onClick={() => { setEditingComment(comment.id); setEditCommentText(comment.comment); }}>
                                                                            <Edit2 className="h-4 w-4 mr-2" />{t('Edit')}
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                    {comment.can_delete && (
                                                                        <DropdownMenuItem onClick={() => setDeleteCommentModal({ open: true, id: comment.id })} className="text-red-600">
                                                                            <Trash2 className="h-4 w-4 mr-2" />{t('Delete')}
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        )}
                                                    </div>
                                                    {editingComment === comment.id ? (
                                                        <div className="space-y-2 mt-2">
                                                            <Textarea value={editCommentText} onChange={(e) => setEditCommentText(e.target.value)} rows={2} className="resize-none" />
                                                            <div className="flex gap-2">
                                                                <Button size="sm" onClick={() => {
                                                                    router.put(route('bug-comments.update', comment.id), { comment: editCommentText }, {
                                                                        onSuccess: () => { setEditingComment(null); handleRefresh(); }
                                                                    });
                                                                }}>{t('Save')}</Button>
                                                                <Button size="sm" variant="outline" onClick={() => setEditingComment(null)}>{t('Cancel')}</Button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{comment.comment}</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                                            <div className="bg-gray-50 p-4 rounded-full mb-4">
                                                <MessageSquare className="h-8 w-8 text-gray-300" />
                                            </div>
                                            <p className="text-sm font-medium">{t('No comments yet')}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Add comment form */}
                                <div className="border-t pt-4">
                                    <form onSubmit={(e) => {
                                        e.preventDefault();
                                        if (!newComment.trim()) return;
                                        router.post(route('bug-comments.store', bugData.id), { comment: newComment }, {
                                            onSuccess: () => { setNewComment(''); handleRefresh(); }
                                        });
                                    }} className="relative">
                                        <Textarea
                                            value={newComment}
                                            onChange={(e) => setNewComment(e.target.value)}
                                            placeholder={t('Write your comment here...')}
                                            rows={3}
                                            className="pr-12 py-3 resize-none border-gray-200 focus-visible:ring-primary focus-visible:border-primary rounded-xl"
                                        />
                                        <div className="absolute bottom-2 right-2">
                                            <Button type="submit" size="icon" disabled={!newComment.trim()} className="h-8 w-8 rounded-lg">
                                                <Send className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                {/* ── END Comments Tab ── */}

                {/* ── Attachments Tab ── */}
                <TabsContent value="attachments" className="min-h-[300px]">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-lg">{t('Bug Attachments')}</CardTitle>
                            {permissions?.update && (
                                <Button size="sm" onClick={() => setIsMediaModalOpen(true)}>
                                    <Plus className="h-4 w-4" />
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent className="border-t" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                            <div className="pt-4">
                                {bugData.attachments?.length > 0 ? (
                                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3 mb-4">
                                        {bugData.attachments.map((attachment: any) => {
                                            const mime = attachment.media_item?.mime_type || '';
                                            const name = attachment.media_item?.name || '';
                                            const ext = name.split('.').pop()?.toLowerCase() || '';
                                            const isImage = mime.startsWith('image/') || ['jpg','jpeg','png','gif','webp','svg'].includes(ext);
                                            const imageUrl = attachment.media_item?.url || (attachment.media_item?.path ? `/storage/${attachment.media_item.path}` : null);

                                            const getFileConfig = () => {
                                                if (isImage) return { icon: Image, bg: 'bg-blue-50', color: 'text-blue-400' };
                                                if (mime.includes('pdf')) return { icon: FileText, bg: 'bg-red-50', color: 'text-red-500' };
                                                if (mime.includes('word') || ext === 'doc' || ext === 'docx') return { icon: FileText, bg: 'bg-blue-50', color: 'text-blue-500' };
                                                if (mime.includes('sheet') || ext === 'xls' || ext === 'xlsx' || ext === 'csv') return { icon: FileSpreadsheet, bg: 'bg-green-50', color: 'text-green-500' };
                                                if (mime.includes('zip') || ext === 'zip' || ext === 'rar') return { icon: FileArchive, bg: 'bg-yellow-50', color: 'text-yellow-500' };
                                                if (mime.includes('javascript') || mime.includes('html') || mime.includes('css')) return { icon: FileCode, bg: 'bg-purple-50', color: 'text-purple-500' };
                                                return { icon: File, bg: 'bg-gray-50', color: 'text-gray-400' };
                                            };
                                            const { icon: FileIcon, bg, color } = getFileConfig();

                                            return (
                                                <div key={attachment.id} className="group relative border border-gray-300 rounded-xl overflow-hidden hover:shadow-md transition-all bg-white">
                                                    <div className="relative aspect-square flex items-center justify-center">
                                                        {isImage && imageUrl ? (
                                                            <div className="relative w-full h-full">
                                                                <img src={imageUrl} alt={name} className="w-full h-full object-contain group-hover:opacity-70 transition-opacity" />
                                                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                                                                    onClick={() => window.open(imageUrl, '_blank')}>
                                                                    <div className="bg-white/25 border border-white/40 rounded-full p-1.5"><Eye className="h-3.5 w-3.5 text-white" /></div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className={`relative w-full aspect-square ${bg} flex flex-col items-center justify-center gap-1`}>
                                                                <FileIcon className={`h-10 w-10 ${color}`} />
                                                                <span className="text-[10px] font-semibold text-gray-500 uppercase">{ext}</span>
                                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center"
                                                                    onClick={() => window.open(imageUrl || '', '_blank')}>
                                                                    <div className="bg-white/25 border border-white/40 rounded-full p-1.5"><Eye className="h-3.5 w-3.5 text-white" /></div>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {permissions?.update && (
                                                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <Button variant="secondary" size="sm" className="h-7 w-7 p-0 bg-white/90 shadow-sm">
                                                                            <MoreHorizontal className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end">
                                                                        <DropdownMenuItem onClick={() => window.open(route('bug-attachments.download', attachment.id), '_blank')}>
                                                                            <Download className="h-4 w-4 mr-2" />{t('Download')}
                                                                        </DropdownMenuItem>
                                                                        {attachment.can_delete && (
                                                                            <DropdownMenuItem onClick={() => setDeleteAttachmentModal({ open: true, attachment })} className="text-red-600">
                                                                                <Trash2 className="h-4 w-4 mr-2" />{t('Delete')}
                                                                            </DropdownMenuItem>
                                                                        )}
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                                        <div className="bg-gray-50 p-4 rounded-full mb-4">
                                            <Paperclip className="h-8 w-8 text-gray-300" />
                                        </div>
                                        <p className="text-sm font-medium">{t('No attachments yet')}</p>
                                    </div>
                                )}

                                <MediaLibraryModal
                                    isOpen={isMediaModalOpen}
                                    onClose={() => setIsMediaModalOpen(false)}
                                    onSelect={async (url: string, mediaIds?: number[]) => {
                                        if (mediaIds && mediaIds.length > 0) {
                                            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
                                            await fetch(route('bug-attachments.store', bugData.id), {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': csrfToken },
                                                body: JSON.stringify({ media_item_ids: mediaIds })
                                            });
                                            setIsMediaModalOpen(false);
                                            await handleRefresh();
                                        }
                                    }}
                                    multiple={true}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                {/* ── END Attachments Tab ── */}

            </Tabs>

            {/* ── Modals ── */}
            {isEditModalOpen && (
                <BugModal
                    bug={bugData}
                    projects={bugData.project ? [bugData.project] : []}
                    statuses={statuses}
                    members={members}
                    milestones={milestones}
                    onClose={() => { setIsEditModalOpen(false); handleRefresh(); }}
                    permissions={permissions}
                />
            )}

            <CrudDeleteModal
                isOpen={deleteCommentModal.open}
                onClose={() => setDeleteCommentModal({ open: false, id: null })}
                onConfirm={() => {
                    if (deleteCommentModal.id) {
                        router.delete(route('bug-comments.destroy', deleteCommentModal.id), {
                            onSuccess: () => { setDeleteCommentModal({ open: false, id: null }); handleRefresh(); }
                        });
                    }
                }}
                itemName="comment"
                entityName="comment"
            />

            <CrudDeleteModal
                isOpen={deleteAttachmentModal.open}
                onClose={() => setDeleteAttachmentModal({ open: false, attachment: null })}
                onConfirm={() => {
                    if (deleteAttachmentModal.attachment) {
                        router.delete(route('bug-attachments.destroy', deleteAttachmentModal.attachment.id), {
                            onSuccess: () => { setDeleteAttachmentModal({ open: false, attachment: null }); handleRefresh(); }
                        });
                    }
                }}
                itemName={deleteAttachmentModal.attachment?.media_item?.name || 'attachment'}
                entityName="attachment"
            />

        </PageTemplate>
    );
}
