import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Bell, MessageSquare, CheckCircle2, Clock, Briefcase, FileText,
    Calendar, CheckCheck, AlertTriangle, Link2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePage } from '@inertiajs/react';

interface Notification {
    id: string;
    type: string;
    title: string;
    content: string;
    link: string | null;
    sender_name: string | null;
    is_read: boolean;
    created_at: string;
}

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

export function NotificationDropdown() {
    const { t } = useTranslation();
    const { csrf_token } = usePage().props as any;
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);

    const headers = { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf_token, 'Accept': 'application/json' };

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await fetch(route('notifications.recent'), { headers: { Accept: 'application/json' } });
            if (!res.ok) return;
            const data = await res.json();
            if (data.success) {
                setNotifications(data.notifications);
                setUnreadCount(data.unread_count);
            }
        } catch { /* silent */ }
    }, []);

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    useEffect(() => {
        if (open) fetchNotifications();
    }, [open, fetchNotifications]);

    const markAsRead = async (id: string) => {
        await fetch(route('notifications.markAsRead', { id }), { method: 'POST', headers });
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
    };

    const markAllAsRead = async () => {
        await fetch(route('notifications.markAllAsRead'), { method: 'POST', headers });
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
    };

    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) return t('just now');
        if (diffInSeconds < 3600) return t('{{count}} min ago', { count: Math.floor(diffInSeconds / 60) });
        if (diffInSeconds < 86400) return t('{{count}} hours ago', { count: Math.floor(diffInSeconds / 3600) });
        return t('{{count}} days ago', { count: Math.floor(diffInSeconds / 86400) });
    };

    const handleClick = (notification: Notification) => {
        if (!notification.is_read) markAsRead(notification.id);
        if (notification.link) window.location.href = notification.link;
        setOpen(false);
    };

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <Badge
                            className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs"
                            variant="destructive"
                        >
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
                <div className="flex items-center justify-between p-4">
                    <h3 className="font-medium">{t('Notifications')}</h3>
                    {unreadCount > 0 && (
                        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={markAllAsRead}>
                            <CheckCheck className="h-3.5 w-3.5 mr-1" />
                            {t('Mark all as read')}
                        </Button>
                    )}
                </div>

                <ScrollArea className="h-80">
                    {notifications.length > 0 ? (
                        <div className="divide-y dark:divide-border">
                            {notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`p-3 flex items-start gap-3 cursor-pointer hover:bg-muted/50 transition-colors ${!notification.is_read ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}
                                    onClick={() => handleClick(notification)}
                                >
                                    <div className={`rounded-full p-2 shrink-0 ${typeColors[notification.type] || typeColors.general}`}>
                                        {typeIcons[notification.type] || typeIcons.general}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-medium truncate">{notification.title}</h4>
                                        <p className="text-xs text-muted-foreground line-clamp-2">{notification.content}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] text-muted-foreground">{formatTimeAgo(notification.created_at)}</span>
                                            {notification.sender_name && (
                                                <span className="text-[10px] text-muted-foreground">· {notification.sender_name}</span>
                                            )}
                                        </div>
                                    </div>

                                    {!notification.is_read && (
                                        <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-2" />
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center">
                            <Bell className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                            <p className="text-sm text-muted-foreground">{t('No notifications yet')}</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">{t("You'll see task updates here")}</p>
                        </div>
                    )}
                </ScrollArea>

                <DropdownMenuSeparator />
                <div
                    className="cursor-pointer p-3 flex items-center justify-center hover:bg-muted/50 transition-colors"
                    onClick={() => { window.location.href = route('notifications.index'); setOpen(false); }}
                >
                    <span className="text-sm font-medium text-primary">{t('View all notifications')}</span>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
