import { Head, usePage } from '@inertiajs/react';
import { PageTemplate } from '@/components/page-template';
import { Button } from '@/components/ui/button';
import {
    Bell, MessageSquare, CheckCircle2, Clock, Briefcase,
    AlertTriangle, CheckCheck, Trash2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';

const typeIcons: Record<string, React.ReactNode> = {
    task_assigned: <CheckCircle2 className="h-4 w-4" />,
    task_status_changed: <Briefcase className="h-4 w-4" />,
    task_due_soon: <Clock className="h-4 w-4" />,
    task_comment: <MessageSquare className="h-4 w-4" />,
    task_blocked: <AlertTriangle className="h-4 w-4" />,
    general: <Bell className="h-4 w-4" />,
};

const typeColors: Record<string, string> = {
    task_assigned: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    task_status_changed: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    task_due_soon: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    task_comment: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    task_blocked: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    general: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

export default function NotificationsIndex() {
    const { t } = useTranslation();
    const { notifications: paginatedNotifications, unread_count, csrf_token } = usePage().props as any;
    const [notifications, setNotifications] = useState(paginatedNotifications?.data || []);
    const [unreadCount, setUnreadCount] = useState(unread_count || 0);

    const headers = { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf_token, 'Accept': 'application/json' };

    const markAsRead = async (id: string) => {
        await fetch(route('notifications.markAsRead', { id }), { method: 'POST', headers });
        setNotifications((prev: any[]) => prev.map((n: any) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
        setUnreadCount((prev: number) => Math.max(0, prev - 1));
    };

    const markAllAsRead = async () => {
        await fetch(route('notifications.markAllAsRead'), { method: 'POST', headers });
        setNotifications((prev: any[]) => prev.map((n: any) => ({ ...n, read_at: new Date().toISOString() })));
        setUnreadCount(0);
    };

    const deleteNotification = async (id: string) => {
        await fetch(route('notifications.destroy', { id }), { method: 'DELETE', headers });
        setNotifications((prev: any[]) => prev.filter((n: any) => n.id !== id));
    };

    const clearAll = async () => {
        await fetch(route('notifications.destroyAll'), { method: 'DELETE', headers });
        setNotifications([]);
        setUnreadCount(0);
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
        if (diff < 60) return t('just now');
        if (diff < 3600) return t('{{count}} min ago', { count: Math.floor(diff / 60) });
        if (diff < 86400) return t('{{count}} hours ago', { count: Math.floor(diff / 3600) });
        if (diff < 604800) return t('{{count}} days ago', { count: Math.floor(diff / 86400) });
        return date.toLocaleDateString();
    };

    return (
        <PageTemplate title={t('Notifications')}>
            <Head title={t('Notifications')} />

            <div className="max-w-3xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold">{t('Notifications')}</h1>
                        <p className="text-sm text-muted-foreground">
                            {unreadCount > 0 ? t('{{count}} unread', { count: unreadCount }) : t('All caught up!')}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {unreadCount > 0 && (
                            <Button variant="outline" size="sm" onClick={markAllAsRead}>
                                <CheckCheck className="h-4 w-4 mr-1" /> {t('Mark all read')}
                            </Button>
                        )}
                        {notifications.length > 0 && (
                            <Button variant="outline" size="sm" onClick={clearAll} className="text-red-600 hover:text-red-700">
                                <Trash2 className="h-4 w-4 mr-1" /> {t('Clear all')}
                            </Button>
                        )}
                    </div>
                </div>

                <div className="space-y-2">
                    {notifications.length === 0 ? (
                        <div className="text-center py-16 border rounded-xl">
                            <Bell className="h-12 w-12 mx-auto text-muted-foreground/20 mb-3" />
                            <p className="text-lg font-medium text-muted-foreground">{t('No notifications')}</p>
                            <p className="text-sm text-muted-foreground/60 mt-1">{t("When things happen in your workspace, you'll see them here.")}</p>
                        </div>
                    ) : (
                        notifications.map((notification: any) => {
                            const data = notification.data || {};
                            const type = data.type || 'general';
                            return (
                                <div
                                    key={notification.id}
                                    className={`flex items-start gap-4 p-4 rounded-xl border transition-colors cursor-pointer hover:bg-muted/50 ${
                                        !notification.read_at ? 'bg-blue-50/50 dark:bg-blue-950/10 border-blue-200/50 dark:border-blue-800/30' : ''
                                    }`}
                                    onClick={() => {
                                        if (!notification.read_at) markAsRead(notification.id);
                                        if (data.link) window.location.href = data.link;
                                    }}
                                >
                                    <div className={`rounded-full p-2.5 shrink-0 ${typeColors[type] || typeColors.general}`}>
                                        {typeIcons[type] || typeIcons.general}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm">{data.title}</p>
                                        <p className="text-sm text-muted-foreground mt-0.5">{data.content}</p>
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <span className="text-xs text-muted-foreground">{formatTime(notification.created_at)}</span>
                                            {data.sender_name && <span className="text-xs text-muted-foreground">· {data.sender_name}</span>}
                                            {data.project_title && <span className="text-xs px-1.5 py-0.5 rounded bg-muted">{data.project_title}</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {!notification.read_at && <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); deleteNotification(notification.id); }}
                                            className="p-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </PageTemplate>
    );
}
