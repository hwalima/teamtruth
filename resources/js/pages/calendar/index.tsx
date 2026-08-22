import { PageTemplate } from '@/components/page-template';
import { usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { useState, useMemo, useCallback, useRef } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Download, Calendar as CalendarIcon, List, Clock, Flag, FolderOpen, Layers } from 'lucide-react';
import CalendarEventView from './CalendarEventView';
import jsPDF from 'jspdf';

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  type: 'task' | 'meeting' | 'google_meeting';
  backgroundColor: string;
  borderColor: string;
  description?: string;
  stage?: string;
  priority?: string;
  status?: string;
  start_date?: string;
  due_date?: string;
  start_time?: string;
  duration?: number;
  progress?: number;
  parent_name?: string;
  project_name?: string;
  is_googlecalendar_sync?: boolean;
  task_id?: number;
  meeting_id?: number;
  join_url?: string;
  start_url?: string;
}

type ViewMode = 'month' | 'week' | 'day' | 'agenda';

export default function CalendarIndex() {
  const { t } = useTranslation();
  const { events, googleCalendarEnabled } = usePage().props as any;
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [calendarView, setCalendarView] = useState('local');
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const calendarRef = useRef<HTMLDivElement>(null);

  const filteredEvents: CalendarEvent[] = useMemo(() => {
    const evts = calendarView === 'google'
      ? events.filter((event: any) => event.is_googlecalendar_sync)
      : events;
    return evts;
  }, [events, calendarView]);

  const navigate = (direction: number) => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') newDate.setMonth(newDate.getMonth() + direction);
    else if (viewMode === 'week') newDate.setDate(newDate.getDate() + (direction * 7));
    else newDate.setDate(newDate.getDate() + direction);
    setCurrentDate(newDate);
  };

  const goToToday = () => setCurrentDate(new Date());

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const days: (Date | null)[] = [];
    for (let i = 0; i < startPad; i++) {
      const d = new Date(year, month, -startPad + i + 1);
      days.push(d);
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push(new Date(year, month + 1, i));
    }
    return days;
  };

  const getWeekDays = (date: Date) => {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay());
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    }
    return days;
  };

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const isToday = (date: Date) => isSameDay(date, new Date());
  const isCurrentMonth = (date: Date) => date.getMonth() === currentDate.getMonth();

  const getEventsForDate = useCallback((date: Date) => {
    return filteredEvents.filter((event: CalendarEvent) => {
      const start = new Date(event.start);
      const end = event.end ? new Date(event.end) : start;
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
      return start <= dayEnd && end >= dayStart;
    });
  }, [filteredEvents]);

  const getEventTypeConfig = (type: string) => {
    switch (type) {
      case 'task': return { color: 'bg-amber-500', lightBg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800', dot: 'bg-amber-400' };
      case 'meeting': return { color: 'bg-blue-500', lightBg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800', dot: 'bg-blue-400' };
      case 'google_meeting': return { color: 'bg-emerald-500', lightBg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800', dot: 'bg-emerald-400' };
      default: return { color: 'bg-gray-500', lightBg: 'bg-gray-50 dark:bg-gray-900', text: 'text-gray-700 dark:text-gray-300', border: 'border-gray-200 dark:border-gray-800', dot: 'bg-gray-400' };
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority?.toLowerCase()) {
      case 'high': case 'critical': return 'text-red-600 dark:text-red-400';
      case 'medium': return 'text-amber-600 dark:text-amber-400';
      case 'low': return 'text-green-600 dark:text-green-400';
      default: return 'text-gray-500';
    }
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setShowModal(true);
  };

  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const exportPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    let y = margin;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(0, 26, 77);
    doc.text('Team Truth - Calendar', margin, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text(monthName, margin, y);
    y += 4;

    const exportDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    doc.setFontSize(9);
    doc.text(`Exported: ${exportDate}`, margin, y);
    y += 10;

    doc.setDrawColor(0, 26, 77);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    const monthEvents = filteredEvents.filter((event: CalendarEvent) => {
      const eventDate = new Date(event.start);
      return eventDate.getMonth() === currentDate.getMonth() && eventDate.getFullYear() === currentDate.getFullYear();
    }).sort((a: CalendarEvent, b: CalendarEvent) => new Date(a.start).getTime() - new Date(b.start).getTime());

    if (monthEvents.length === 0) {
      doc.setFontSize(12);
      doc.setTextColor(150, 150, 150);
      doc.text('No events for this month.', margin, y);
    } else {
      let currentEventDate = '';
      monthEvents.forEach((event: CalendarEvent) => {
        if (y > 270) {
          doc.addPage();
          y = margin;
        }

        const eventDate = new Date(event.start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        if (eventDate !== currentEventDate) {
          currentEventDate = eventDate;
          y += 3;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          doc.setTextColor(0, 26, 77);
          doc.text(eventDate, margin, y);
          y += 1;
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.2);
          doc.line(margin, y, pageWidth - margin, y);
          y += 5;
        }

        const typeLabel = event.type === 'task' ? 'TASK' : event.type === 'meeting' ? 'ZOOM' : 'GMEET';
        const typeColors: Record<string, [number, number, number]> = {
          'TASK': [245, 158, 11],
          'ZOOM': [59, 130, 246],
          'GMEET': [16, 183, 127],
        };
        const [r, g, b] = typeColors[typeLabel] || [150, 150, 150];

        doc.setFillColor(r, g, b);
        doc.roundedRect(margin, y - 3.5, 14, 5, 1, 1, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(255, 255, 255);
        doc.text(typeLabel, margin + 1.5, y);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(30, 30, 30);
        doc.text(event.title, margin + 17, y);
        y += 5;

        const details: string[] = [];
        if (event.parent_name) details.push(`Project: ${event.parent_name}`);
        if (event.priority) details.push(`Priority: ${event.priority}`);
        if (event.stage) details.push(`Stage: ${event.stage}`);
        if (event.status) details.push(`Status: ${event.status}`);
        if (event.due_date) details.push(`Due: ${new Date(event.due_date).toLocaleDateString()}`);
        if (event.duration) details.push(`Duration: ${event.duration} min`);

        if (details.length > 0) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(100, 100, 100);
          doc.text(details.join('  |  '), margin + 17, y);
          y += 4;
        }

        if (event.description) {
          const desc = event.description.replace(/<[^>]*>/g, '').substring(0, 200);
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(8);
          doc.setTextColor(80, 80, 80);
          const lines = doc.splitTextToSize(desc, contentWidth - 17);
          const maxLines = Math.min(lines.length, 3);
          for (let i = 0; i < maxLines; i++) {
            if (y > 275) { doc.addPage(); y = margin; }
            doc.text(lines[i], margin + 17, y);
            y += 3.5;
          }
          if (lines.length > 3) {
            doc.text('...', margin + 17, y);
            y += 3.5;
          }
        }
        y += 4;
      });
    }

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 20, doc.internal.pageSize.getHeight() - 10);
      doc.text('Team Truth - Project Management', margin, doc.internal.pageSize.getHeight() - 10);
    }

    doc.save(`calendar-${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}.pdf`);
  };

  const renderMonthView = () => {
    const days = getDaysInMonth(currentDate);
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
      <div className="flex flex-col h-full">
        <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
          {weekDays.map(day => (
            <div key={day} className="py-2 sm:py-3 text-center text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <span className="hidden sm:inline">{day}</span>
              <span className="sm:hidden">{day.charAt(0)}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 flex-1 auto-rows-fr">
          {days.map((date, idx) => {
            if (!date) return <div key={idx} className="border-b border-r border-gray-100 dark:border-gray-800" />;
            const dayEvents = getEventsForDate(date);
            const dateKey = date.toISOString().split('T')[0];
            const isExpanded = expandedDay === dateKey;
            const maxVisible = 2;
            const hasMore = dayEvents.length > maxVisible;

            return (
              <div
                key={idx}
                className={`
                  relative border-b border-r border-gray-100 dark:border-gray-800 p-0.5 sm:p-1 min-h-[60px] sm:min-h-[90px] transition-colors duration-150
                  ${!isCurrentMonth(date) ? 'bg-gray-50/50 dark:bg-gray-900/30' : 'bg-white dark:bg-gray-950'}
                  ${isToday(date) ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}
                  hover:bg-gray-50 dark:hover:bg-gray-900/50 cursor-pointer
                `}
                onClick={() => {
                  if (dayEvents.length > 0) {
                    setExpandedDay(isExpanded ? null : dateKey);
                  }
                }}
              >
                <div className="flex items-center justify-between px-0.5 sm:px-1">
                  <span className={`
                    text-[10px] sm:text-xs font-medium inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full transition-all
                    ${isToday(date) ? 'bg-blue-600 text-white shadow-sm' : ''}
                    ${!isCurrentMonth(date) ? 'text-gray-300 dark:text-gray-600' : 'text-gray-700 dark:text-gray-300'}
                  `}>
                    {date.getDate()}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="text-[9px] sm:text-[10px] font-medium text-gray-400 dark:text-gray-500 tabular-nums">
                      {dayEvents.length}
                    </span>
                  )}
                </div>

                <div className="mt-0.5 space-y-0.5 overflow-hidden">
                  {(isExpanded ? dayEvents : dayEvents.slice(0, maxVisible)).map((event, eIdx) => {
                    const config = getEventTypeConfig(event.type);
                    return (
                      <div
                        key={eIdx}
                        className={`
                          group flex items-center gap-1 px-1 py-0.5 rounded text-[9px] sm:text-[10px] leading-tight truncate
                          ${config.lightBg} ${config.border} border
                          hover:shadow-sm transition-all duration-150 cursor-pointer
                        `}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEventClick(event);
                        }}
                        title={event.title}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${config.dot} shrink-0`} />
                        <span className={`truncate font-medium ${config.text}`}>{event.title}</span>
                      </div>
                    );
                  })}
                  {hasMore && !isExpanded && (
                    <button
                      className="text-[9px] sm:text-[10px] text-blue-600 dark:text-blue-400 font-medium px-1 hover:underline"
                      onClick={(e) => { e.stopPropagation(); setExpandedDay(dateKey); }}
                    >
                      +{dayEvents.length - maxVisible} more
                    </button>
                  )}
                  {isExpanded && hasMore && (
                    <button
                      className="text-[9px] sm:text-[10px] text-gray-500 font-medium px-1 hover:underline"
                      onClick={(e) => { e.stopPropagation(); setExpandedDay(null); }}
                    >
                      Show less
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const days = getWeekDays(currentDate);
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <div className="flex flex-col overflow-auto max-h-[600px] sm:max-h-[700px]">
        <div className="grid grid-cols-8 sticky top-0 z-10 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-700">
          <div className="py-2 px-1 text-center text-[10px] text-gray-400" />
          {days.map((day, idx) => (
            <div key={idx} className="py-2 px-1 text-center border-l border-gray-100 dark:border-gray-800">
              <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                {day.toLocaleString('default', { weekday: 'short' })}
              </div>
              <div className={`text-sm sm:text-base font-semibold mt-0.5 inline-flex items-center justify-center w-7 h-7 rounded-full ${isToday(day) ? 'bg-blue-600 text-white' : 'text-gray-900 dark:text-gray-100'}`}>
                {day.getDate()}
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-8">
          {hours.map(hour => (
            <div key={hour} className="contents">
              <div className="py-3 px-1 text-right text-[9px] sm:text-[10px] text-gray-400 border-b border-gray-50 dark:border-gray-900">
                {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
              </div>
              {days.map((day, dIdx) => {
                const dayEvents = getEventsForDate(day).filter(e => {
                  const eventHour = new Date(e.start).getHours();
                  return eventHour === hour;
                });
                return (
                  <div key={dIdx} className="relative py-1 px-0.5 border-l border-b border-gray-50 dark:border-gray-900 min-h-[40px]">
                    {dayEvents.map((event, eIdx) => {
                      const config = getEventTypeConfig(event.type);
                      return (
                        <div
                          key={eIdx}
                          className={`${config.lightBg} ${config.border} border rounded px-1 py-0.5 mb-0.5 cursor-pointer hover:shadow-sm transition-shadow text-[9px] sm:text-[10px] truncate`}
                          onClick={() => handleEventClick(event)}
                        >
                          <span className={`font-medium ${config.text}`}>{event.title}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const dayEvents = getEventsForDate(currentDate);
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <div className="flex flex-col overflow-auto max-h-[600px] sm:max-h-[700px]">
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-700 py-3 px-4">
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {currentDate.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          <div className="text-sm text-gray-500">{dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="divide-y divide-gray-50 dark:divide-gray-900">
          {hours.map(hour => {
            const hourEvents = dayEvents.filter(e => {
              const eventHour = new Date(e.start).getHours();
              return eventHour === hour;
            });
            return (
              <div key={hour} className="flex min-h-[48px]">
                <div className="w-16 sm:w-20 py-2 px-2 text-right text-[10px] sm:text-xs text-gray-400 shrink-0">
                  {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                </div>
                <div className="flex-1 py-1 px-2 space-y-1 border-l border-gray-100 dark:border-gray-800">
                  {hourEvents.map((event, eIdx) => {
                    const config = getEventTypeConfig(event.type);
                    return (
                      <div
                        key={eIdx}
                        className={`${config.lightBg} ${config.border} border rounded-lg px-3 py-2 cursor-pointer hover:shadow-md transition-all duration-200`}
                        onClick={() => handleEventClick(event)}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${config.dot}`} />
                          <span className={`font-medium text-sm ${config.text}`}>{event.title}</span>
                        </div>
                        {event.parent_name && (
                          <p className="text-xs text-gray-500 mt-0.5 ml-4">{event.parent_name}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderAgendaView = () => {
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    const agendaEvents = filteredEvents
      .filter((event: CalendarEvent) => {
        const eventDate = new Date(event.start);
        return eventDate >= monthStart && eventDate <= monthEnd;
      })
      .sort((a: CalendarEvent, b: CalendarEvent) => new Date(a.start).getTime() - new Date(b.start).getTime());

    const groupedByDate: Record<string, CalendarEvent[]> = {};
    agendaEvents.forEach((event: CalendarEvent) => {
      const dateKey = new Date(event.start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
      groupedByDate[dateKey].push(event);
    });

    return (
      <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[600px] sm:max-h-[700px] overflow-auto">
        {Object.keys(groupedByDate).length === 0 && (
          <div className="py-12 text-center text-gray-400">
            <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{t('No events this month')}</p>
          </div>
        )}
        {Object.entries(groupedByDate).map(([dateLabel, dateEvents]) => (
          <div key={dateLabel} className="py-3 first:pt-0">
            <div className="sticky top-0 bg-white dark:bg-gray-950 py-2 px-3 sm:px-4 z-[1]">
              <h3 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">{dateLabel}</h3>
            </div>
            <div className="space-y-2 px-3 sm:px-4">
              {dateEvents.map((event, idx) => {
                const config = getEventTypeConfig(event.type);
                return (
                  <div
                    key={idx}
                    className={`${config.lightBg} ${config.border} border rounded-xl p-3 sm:p-4 cursor-pointer hover:shadow-md transition-all duration-200 group`}
                    onClick={() => handleEventClick(event)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-1 self-stretch rounded-full ${config.color} shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className={`font-semibold text-sm sm:text-base truncate ${config.text} group-hover:underline`}>
                            {event.title}
                          </h4>
                          <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-medium ${config.color} text-white shrink-0`}>
                            {event.type === 'task' ? t('Task') : event.type === 'meeting' ? t('Zoom') : t('Google Meet')}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                          {event.parent_name && (
                            <span className="flex items-center gap-1">
                              <FolderOpen className="w-3 h-3" />
                              {event.parent_name}
                            </span>
                          )}
                          {event.priority && (
                            <span className={`flex items-center gap-1 ${getPriorityColor(event.priority)}`}>
                              <Flag className="w-3 h-3" />
                              {event.priority}
                            </span>
                          )}
                          {event.stage && (
                            <span className="flex items-center gap-1">
                              <Layers className="w-3 h-3" />
                              {event.stage}
                            </span>
                          )}
                          {event.start_time && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        {event.description && (
                          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                            {event.description.replace(/<[^>]*>/g, '')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const breadcrumbs = [
    { title: t('Dashboard'), href: route('dashboard') },
    { title: t('Calendar') }
  ];

  const pageActions = [];
  if (googleCalendarEnabled) {
    pageActions.push({
      label: '',
      icon: (
        <Select value={calendarView} onValueChange={setCalendarView}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="local">{t('Local Calendar')}</SelectItem>
            <SelectItem value="google">{t('Google Calendar')}</SelectItem>
          </SelectContent>
        </Select>
      ),
      variant: 'ghost' as const,
      onClick: () => {},
      className: 'hover:bg-transparent'
    });
  }

  return (
    <PageTemplate
      title={t('Calendar')}
      description={t('Manage your calendar and events.')}
      breadcrumbs={breadcrumbs}
      actions={pageActions}
    >
      <div ref={calendarRef} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm overflow-hidden">
        {/* Header Controls */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
          {/* Navigation */}
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <button
                onClick={() => navigate(-1)}
                className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
              <button
                onClick={() => navigate(1)}
                className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border-l border-gray-200 dark:border-gray-700"
              >
                <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            <button
              onClick={goToToday}
              className="px-2.5 py-1.5 text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors"
            >
              {t('Today')}
            </button>
            <h2 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-gray-100 ml-1 sm:ml-2">
              {monthName}
            </h2>
          </div>

          {/* View Toggles & Export */}
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900">
              {([
                { key: 'month', icon: CalendarIcon, label: 'Month' },
                { key: 'week', icon: CalendarIcon, label: 'Week' },
                { key: 'day', icon: Clock, label: 'Day' },
                { key: 'agenda', icon: List, label: 'List' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setViewMode(key)}
                  className={`px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs font-medium transition-all ${
                    viewMode === key
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {t(label)}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={exportPDF}
              className="gap-1.5 text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">PDF</span>
            </Button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 sm:gap-4 px-3 sm:px-4 py-2 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">{t('Tasks')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
            <span className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">{t('Zoom Meetings')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">{t('Google Meetings')}</span>
          </div>
          <div className="ml-auto text-[10px] sm:text-xs text-gray-400 tabular-nums">
            {filteredEvents.length} {t('events')}
          </div>
        </div>

        {/* Calendar Body */}
        <div className="min-h-[400px] sm:min-h-[500px]">
          {viewMode === 'month' && renderMonthView()}
          {viewMode === 'week' && renderWeekView()}
          {viewMode === 'day' && renderDayView()}
          {viewMode === 'agenda' && renderAgendaView()}
        </div>
      </div>

      {/* Event Details Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        {selectedEvent && <CalendarEventView event={selectedEvent} />}
      </Dialog>
    </PageTemplate>
  );
}
