import { useTranslation } from 'react-i18next';
import { ArrowRight, GitCommit, MessageSquare, User, Flag, Layers } from 'lucide-react';

interface Activity {
    id: number;
    type: string;
    field?: string;
    old_value?: string;
    new_value?: string;
    description?: string;
    created_at: string;
    user?: { id: number; name: string; avatar?: string };
}

interface Props {
    activities: Activity[];
}

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
    stage_changed: <Layers className="w-3 h-3" />,
    priority_changed: <Flag className="w-3 h-3" />,
    assigned_to_changed: <User className="w-3 h-3" />,
    title_changed: <GitCommit className="w-3 h-3" />,
    comment_added: <MessageSquare className="w-3 h-3" />,
};

export default function TaskActivityFeed({ activities }: Props) {
    const { t } = useTranslation();

    if (activities.length === 0) return null;

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return t('just now');
        if (diffMins < 60) return `${diffMins}m`;
        if (diffHours < 24) return `${diffHours}h`;
        if (diffDays < 7) return `${diffDays}d`;
        return date.toLocaleDateString('en', { month: 'short', day: 'numeric' });
    };

    const getActivityText = (activity: Activity): string => {
        switch (activity.type) {
            case 'stage_changed':
                return `moved task from "${activity.old_value}" to "${activity.new_value}"`;
            case 'priority_changed':
                return `changed priority from ${activity.old_value} to ${activity.new_value}`;
            case 'assigned_to_changed':
                return `reassigned the task`;
            case 'title_changed':
                return `renamed the task`;
            case 'comment_added':
                return `added a comment`;
            default:
                return `updated the task`;
        }
    };

    return (
        <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <GitCommit className="w-3.5 h-3.5" />
                {t('Activity')}
            </p>
            <div className="space-y-0.5">
                {activities.slice(0, 10).map((activity) => (
                    <div key={activity.id} className="flex items-start gap-2 py-1.5 px-2 rounded text-xs text-muted-foreground hover:bg-muted/30 transition-colors">
                        <span className="mt-0.5 text-muted-foreground/60">
                            {ACTIVITY_ICONS[activity.type] || <GitCommit className="w-3 h-3" />}
                        </span>
                        <span className="flex-1 leading-relaxed">
                            <span className="font-medium text-foreground/70">{activity.user?.name}</span>
                            {' '}{getActivityText(activity)}
                        </span>
                        <span className="text-[10px] text-muted-foreground/50 shrink-0">{formatTime(activity.created_at)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
