import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bell,
  MessageSquare,
  CheckCircle2,
  Clock,
  Briefcase,
  FileText,
  Calendar,
  CheckCheck,
  Settings
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Dummy notification data
const dummyNotifications = [
  {
    id: 1,
    title: 'New comment on task',
    content: 'Mike Johnson commented on "Homepage redesign"',
    type: 'comment',
    related_to: 'Task: Homepage redesign',
    related_link: '/tasks/5',
    created_at: '2024-02-15T10:30:00',
    is_read: false,
    sender: { id: 2, name: 'Mike Johnson', avatar: null }
  },
  {
    id: 2,
    title: 'Task assigned to you',
    content: 'Sarah Wilson assigned you to "API Integration"',
    type: 'task',
    related_to: 'Task: API Integration',
    related_link: '/tasks/8',
    created_at: '2024-02-15T09:45:00',
    is_read: false,
    sender: { id: 3, name: 'Sarah Wilson', avatar: null }
  },
  {
    id: 3,
    title: 'Meeting reminder',
    content: 'Team meeting starts in 15 minutes',
    type: 'reminder',
    related_to: 'Meeting: Team Sync',
    related_link: '/calendar/event/1',
    created_at: '2024-02-15T09:15:00',
    is_read: false,
    sender: null
  },
  {
    id: 4,
    title: 'Project status update',
    content: 'E-commerce Website project is now 75% complete',
    type: 'project',
    related_to: 'Project: E-commerce Website',
    related_link: '/projects/1',
    created_at: '2024-02-14T16:20:00',
    is_read: true,
    sender: null
  },
  {
    id: 5,
    title: 'Invoice paid',
    content: 'TechCorp Inc. paid invoice INV-2024-001',
    type: 'invoice',
    related_to: 'Invoice: INV-2024-001',
    related_link: '/invoices/1',
    created_at: '2024-02-14T14:10:00',
    is_read: true,
    sender: null
  }
];

const notificationTypeIcons = {
  comment: <MessageSquare className="h-4 w-4" />,
  task: <CheckCircle2 className="h-4 w-4" />,
  reminder: <Clock className="h-4 w-4" />,
  project: <Briefcase className="h-4 w-4" />,
  invoice: <FileText className="h-4 w-4" />,
  message: <MessageSquare className="h-4 w-4" />,
  deadline: <Calendar className="h-4 w-4" />,
  file: <FileText className="h-4 w-4" />
};

const notificationTypeColors = {
  comment: 'bg-blue-100 text-blue-800',
  task: 'bg-green-100 text-green-800',
  reminder: 'bg-yellow-100 text-yellow-800',
  project: 'bg-purple-100 text-purple-800',
  invoice: 'bg-green-100 text-green-800',
  message: 'bg-blue-100 text-blue-800',
  deadline: 'bg-red-100 text-red-800',
  file: 'bg-gray-100 text-gray-800'
};

export function NotificationDropdown() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const getInitials = (name: string) => {
    return name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : 'SYS';
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return t('just now');
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return t('{{count}} min ago', { count: minutes });
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return t('{{count}} hours ago', { count: hours });
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return t('{{count}} days ago', { count: days });
    }
  };

  const unreadCount = dummyNotifications.filter(n => !n.is_read).length;

  const markAllAsRead = () => {
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
              {unreadCount}
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
          {dummyNotifications.length > 0 ? (
            <div className="divide-y">
              {dummyNotifications.map((notification) => (
                <div 
                  key={notification.id} 
                  className={`p-3 flex items-start gap-3 cursor-pointer hover:bg-gray-50 ${notification.is_read ? '' : 'bg-blue-50'}`}
                  onClick={() => {
                    window.location.href = notification.related_link;
                    setOpen(false);
                  }}
                >
                  <div className={`rounded-full p-2 ${notificationTypeColors[notification.type as keyof typeof notificationTypeColors]}`}>
                    {notificationTypeIcons[notification.type as keyof typeof notificationTypeIcons]}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-medium">{notification.title}</h4>
                        <p className="text-xs text-muted-foreground">{notification.content}</p>
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatTimeAgo(notification.created_at)}
                        </div>
                      </div>
                    </div>
                    
                    {notification.sender && (
                      <div className="flex items-center gap-2 mt-2">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-[10px]">
                            {getInitials(notification.sender.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs">{notification.sender.name}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center">
              <Bell className="h-8 w-8 mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-muted-foreground">{t('No notifications')}</p>
            </div>
          )}
        </ScrollArea>
        
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          className="cursor-pointer p-3 flex items-center justify-center"
          onClick={() => {
            window.location.href = route('notifications.index');
            setOpen(false);
          }}
        >
          <span className="text-sm font-medium">{t('View all notifications')}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          className="cursor-pointer p-3"
          onClick={() => {
            window.location.href = route('notifications.settings');
            setOpen(false);
          }}
        >
          <Settings className="h-4 w-4 mr-2" />
          <span className="text-sm">{t('Notification settings')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}