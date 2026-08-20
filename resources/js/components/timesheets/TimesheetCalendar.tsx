import React, { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import TimeEntryForm from './TimeEntryForm';
import CalendarDayView from './CalendarDayView';
import { usePage } from '@inertiajs/react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

interface TimeEntry {
    id: number;
    project: { title: string };
    task?: { title: string };
    hours: number;
    is_billable: boolean;
    user?: { name: string };
}

interface CalendarDay {
    date: string;
    entries: TimeEntry[];
    totalHours: number;
    isCurrentMonth: boolean;
    isToday: boolean;
}

interface Props {
    calendarData: CalendarDay[];
    currentMonth: string;
    projects: any[];
    timesheetId: number;
    onMonthChange: (month: string) => void;
    permissions?: {
        canAccessAllData: boolean;
        canManageTimesheets: boolean;
        isReadOnly: boolean;
        userRole: string;
    };
}

export default function TimesheetCalendar({ 
    calendarData, 
    currentMonth, 
    projects, 
    timesheetId, 
    onMonthChange,
    permissions 
}: Props) {
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDayViewOpen, setIsDayViewOpen] = useState(false);
    const calendarRef = useRef<any>(null);

    const { auth } = usePage().props as any;
    const canCreate = auth?.permissions?.includes('timesheet_create');

    // Convert calendarData to FullCalendar events
    const events = calendarData.flatMap(day =>
        day.entries.map(entry => ({
            title: entry.project?.title,
            date: day.date,
            backgroundColor: 'transparent',
            borderColor: 'transparent',
            extendedProps: { entry, day },
        }))
    );

    const handleDateClick = (info: any) => {
        if (!canCreate) return;
        const day = calendarData.find(d => d.date === info.dateStr);
        if (day && day.entries.length > 0) {
            setSelectedDate(info.dateStr);
            setIsDayViewOpen(true);
        } else {
            setSelectedDate(info.dateStr);
            setIsFormOpen(true);
        }
    };

    const handleEventClick = (info: any) => {
        info.jsEvent.preventDefault();
        const day = info.event.extendedProps.day as CalendarDay;
        setSelectedDate(day.date);
        setIsDayViewOpen(true);
    };

    const handleDatesSet = (info: any) => {
        // Get the month of the current view's start (middle of visible range)
        const mid = new Date((info.start.getTime() + info.end.getTime()) / 2);
        const newMonth = mid.toISOString().slice(0, 7);
        if (newMonth !== currentMonth) {
            onMonthChange(newMonth);
        }
    };

    return (
        <Card>
            <CardContent  className="pt-4">
                <FullCalendar
                    ref={calendarRef}
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    initialDate={currentMonth + '-01'}
                    headerToolbar={{
                        left: 'prev,next today',
                        center: 'title',
                        right: 'dayGridMonth,timeGridWeek,timeGridDay'
                    }}
                    events={events}
                    dateClick={handleDateClick}
                    eventClick={handleEventClick}
                    datesSet={handleDatesSet}
                    height="auto"
                    aspectRatio={1.8}
                    eventDisplay="block"
                    dayMaxEvents={2}
                    moreLinkClick="popover"
                    eventContent={(eventInfo) => {
                        const entry = eventInfo.event.extendedProps.entry as TimeEntry;
                        return (
                            <div className={`px-1 py-0.5 rounded text-xs cursor-pointer w-full truncate ${entry.is_billable ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                                <div className="font-medium truncate">{eventInfo.event.title}</div>
                                {permissions?.canAccessAllData && entry.user && (
                                    <div className="truncate opacity-75">{entry.user.name}</div>
                                )}
                            </div>
                        );
                    }}
                />
            </CardContent>

            <TimeEntryForm
                isOpen={isFormOpen}
                onClose={() => {
                    setIsFormOpen(false);
                    setSelectedDate('');
                }}
                timesheetId={timesheetId}
                projects={projects}
            />

            <CalendarDayView
                date={selectedDate}
                entries={calendarData.find(d => d.date === selectedDate)?.entries || []}
                projects={projects}
                timesheetId={timesheetId}
                isOpen={isDayViewOpen}
                onClose={() => {
                    setIsDayViewOpen(false);
                    setSelectedDate('');
                }}
                onEntryUpdate={() => window.location.reload()}
                permissions={permissions}
            />
        </Card>
    );
}