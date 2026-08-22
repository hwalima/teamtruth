import { DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { Calendar, CheckSquare, Clock, Flag, Layers, FileText, Link, Copy, FolderOpen, TrendingUp, Video } from 'lucide-react';
import { toast } from '@/components/custom-toast';

interface CalendarEventViewProps {
    event: any;
}

export default function CalendarEventView({ event }: CalendarEventViewProps) {
    const { t } = useTranslation();

    const getTypeConfig = (type: string) => {
        switch (type) {
            case 'task': return { bg: 'bg-amber-500', light: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-300', label: 'Task', icon: CheckSquare };
            case 'meeting': return { bg: 'bg-blue-500', light: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-300', label: 'Zoom Meeting', icon: Video };
            case 'google_meeting': return { bg: 'bg-emerald-500', light: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-300', label: 'Google Meet', icon: Video };
            default: return { bg: 'bg-gray-500', light: 'bg-gray-50', text: 'text-gray-700', label: 'Event', icon: Calendar };
        }
    };

    const getPriorityConfig = (priority?: string) => {
        switch (priority?.toLowerCase()) {
            case 'high': case 'critical': return { bg: 'bg-red-100 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-300', ring: 'ring-red-200 dark:ring-red-800' };
            case 'medium': return { bg: 'bg-amber-100 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', ring: 'ring-amber-200 dark:ring-amber-800' };
            case 'low': return { bg: 'bg-green-100 dark:bg-green-950/40', text: 'text-green-700 dark:text-green-300', ring: 'ring-green-200 dark:ring-green-800' };
            default: return { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300', ring: 'ring-gray-200 dark:ring-gray-700' };
        }
    };

    const getStageConfig = (stage?: string) => {
        const s = stage?.toLowerCase();
        if (s?.includes('done') || s?.includes('complete')) return { bg: 'bg-green-100 dark:bg-green-950/40', text: 'text-green-700 dark:text-green-300' };
        if (s?.includes('progress') || s?.includes('doing')) return { bg: 'bg-blue-100 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-300' };
        if (s?.includes('review')) return { bg: 'bg-purple-100 dark:bg-purple-950/40', text: 'text-purple-700 dark:text-purple-300' };
        if (s?.includes('blocked')) return { bg: 'bg-red-100 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-300' };
        return { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300' };
    };

    const getStatusConfig = (status?: string) => {
        const s = status?.toLowerCase();
        if (s === 'held' || s === 'completed') return { bg: 'bg-green-100 dark:bg-green-950/40', text: 'text-green-700 dark:text-green-300' };
        if (s === 'not_held' || s === 'cancelled') return { bg: 'bg-red-100 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-300' };
        return { bg: 'bg-blue-100 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-300' };
    };

    const typeConfig = getTypeConfig(event.type);
    const TypeIcon = typeConfig.icon;
    const isMeeting = event.type === 'meeting' || event.type === 'google_meeting';
    const isTask = event.type === 'task';

    return (
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-0 gap-0 rounded-2xl" onOpenAutoFocus={(e) => e.preventDefault()}>
            {/* Colored Header Bar */}
            <div className={`${typeConfig.bg} px-5 py-4 sm:px-6 sm:py-5`}>
                <DialogHeader className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm shrink-0">
                                <TypeIcon className="h-5 w-5 text-white" />
                            </div>
                            <div className="min-w-0">
                                <DialogTitle className="text-base sm:text-lg font-bold text-white leading-tight break-words">
                                    {event.title}
                                </DialogTitle>
                                <p className="text-white/80 text-xs sm:text-sm mt-0.5">{t(typeConfig.label)}</p>
                            </div>
                        </div>
                    </div>
                </DialogHeader>
            </div>

            {/* Body */}
            <div className="px-5 py-4 sm:px-6 sm:py-5 space-y-4">
                {/* Quick Info Pills */}
                <div className="flex flex-wrap gap-2">
                    {event.priority && (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ring-inset ${getPriorityConfig(event.priority).bg} ${getPriorityConfig(event.priority).text} ${getPriorityConfig(event.priority).ring}`}>
                            <Flag className="w-3 h-3" />
                            {event.priority}
                        </span>
                    )}
                    {event.stage && (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${getStageConfig(event.stage).bg} ${getStageConfig(event.stage).text}`}>
                            <Layers className="w-3 h-3" />
                            {event.stage}
                        </span>
                    )}
                    {event.status && isMeeting && (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusConfig(event.status).bg} ${getStatusConfig(event.status).text}`}>
                            {event.status}
                        </span>
                    )}
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {event.parent_name && (
                        <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-900">
                            <FolderOpen className="w-4 h-4 text-gray-400 shrink-0" />
                            <div className="min-w-0">
                                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">{t('Project')}</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{event.parent_name}</p>
                            </div>
                        </div>
                    )}

                    {isTask && event.start_date && (
                        <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-900">
                            <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">{t('Start Date')}</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                    {new Date(event.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                            </div>
                        </div>
                    )}

                    {isTask && event.due_date && (
                        <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-900">
                            <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">{t('Due Date')}</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                    {new Date(event.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                            </div>
                        </div>
                    )}

                    {isMeeting && event.start_time && (
                        <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-900">
                            <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">{t('Time')}</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                    {new Date(event.start_time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                    )}

                    {isMeeting && event.duration && (
                        <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-900">
                            <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">{t('Duration')}</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{event.duration} {t('minutes')}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Progress Bar */}
                {isTask && event.progress !== undefined && (
                    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                                <TrendingUp className="w-3.5 h-3.5" />
                                {t('Progress')}
                            </span>
                            <span className="text-xs font-bold text-gray-900 dark:text-gray-100">{event.progress || 0}%</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
                                style={{ width: `${event.progress || 0}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Description */}
                {event.description && (
                    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium flex items-center gap-1.5 mb-1.5">
                            <FileText className="w-3.5 h-3.5" />
                            {t('Description')}
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                            {event.description.replace(/<[^>]*>/g, '')}
                        </p>
                    </div>
                )}

                {/* Meeting URLs */}
                {isMeeting && (event.join_url || event.start_url) && (
                    <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium flex items-center gap-1.5">
                            <Link className="w-3.5 h-3.5" />
                            {t('Meeting Links')}
                        </p>
                        {event.join_url && (
                            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">{t('Join URL')}</p>
                                    <p className="text-xs text-blue-800 dark:text-blue-300 font-mono truncate">{event.join_url}</p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        navigator.clipboard.writeText(event.join_url);
                                        toast.success(t('Copied to clipboard'));
                                    }}
                                    className="h-7 w-7 p-0 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 shrink-0"
                                >
                                    <Copy className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        )}
                        {event.start_url && (
                            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] text-green-600 dark:text-green-400 font-medium">{t('Host URL')}</p>
                                    <p className="text-xs text-green-800 dark:text-green-300 font-mono truncate">{event.start_url}</p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        navigator.clipboard.writeText(event.start_url);
                                        toast.success(t('Copied to clipboard'));
                                    }}
                                    className="h-7 w-7 p-0 text-green-600 hover:bg-green-100 dark:hover:bg-green-900 shrink-0"
                                >
                                    <Copy className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </DialogContent>
    );
}
