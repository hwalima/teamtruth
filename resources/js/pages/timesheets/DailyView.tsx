import React, { useState, useEffect } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { toast } from '@/components/custom-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Plus, Clock, Calendar, BarChart3, ListTodo } from 'lucide-react';
import { PageTemplate } from '@/components/page-template';
import TimeEntryForm from '@/components/timesheets/TimeEntryForm';
import TimeEntryList from '@/components/timesheets/TimeEntryList';
import { hasPermission } from '@/utils/authorization';
import { useTranslation } from 'react-i18next';

interface TimeEntry {
    id: number;
    project: { title: string };
    task?: { title: string };
    date: string;
    start_time?: string;
    end_time?: string;
    hours: number;
    description?: string;
    is_billable: boolean;
}

interface Project {
    id: number;
    title: string;
    tasks?: any[];
}

interface Props {
    entries: TimeEntry[] | { data: TimeEntry[], links?: any[], from?: number, to?: number, total?: number };
    projects: Project[];
    selectedDate: string;
    timesheetId: number;
    filters?: { search?: string, per_page?: number, project?: string, billable?: string };
    permissions?: any;
}

export default function DailyView({ entries, projects, selectedDate, timesheetId, filters = {}, permissions }: Props) {
    const { t } = useTranslation();
    const { flash, auth } = usePage().props as any;
    const userPermissions = auth?.permissions || [];
    const [currentDate, setCurrentDate] = useState(new Date(selectedDate));
    const [isFormOpen, setIsFormOpen] = useState(false);

    // Show flash messages
    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
        if (flash?.error) {
            toast.error(flash.error);
        }
    }, [flash]);

    const navigateDate = (direction: 'prev' | 'next') => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
        setCurrentDate(newDate);
        
        const dateStr = newDate.toISOString().split('T')[0];
        router.get(route('timesheets.daily-view'), { date: dateStr }, { preserveState: true });
    };

    const goToToday = () => {
        const today = new Date();
        setCurrentDate(today);
        const dateStr = today.toISOString().split('T')[0];
        router.get(route('timesheets.daily-view'), { date: dateStr }, { preserveState: true });
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDate = new Date(e.target.value);
        setCurrentDate(newDate);
        router.get(route('timesheets.daily-view'), { date: e.target.value }, { preserveState: true });
    };

    // Handle both array and paginated data formats
    const entriesData = Array.isArray(entries) ? entries : entries.data || [];
    
    const getDayTotal = () => entriesData.reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0);
    const getBillableTotal = () => entriesData.filter(e => e.is_billable).reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0);

    const formatDate = (date: Date) => {
        return window.appSettings.formatDateTime(date, false);
    };

    const isToday = currentDate.toDateString() === new Date().toDateString();
    const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;

    const pageActions = [];
    
    if (hasPermission(userPermissions, 'timesheet_update') && entriesData.length > 0) {
        pageActions.push(
            {
                label: 'Mark Billable',
                variant: 'outline' as const,
                onClick: () => {
                    toast.loading('Marking entries as billable...');
                    router.post(route('timesheet-entries.bulk-update'), {
                        entry_ids: entriesData.map(e => e.id),
                        is_billable: true
                    }, {
                        onSuccess: () => {
                            toast.dismiss();
                        },
                        onError: () => {
                            toast.dismiss();
                            toast.error('Failed to update entries');
                        }
                    });
                }
            },
            {
                label: 'Mark Non-Billable',
                variant: 'outline' as const,
                onClick: () => {
                    toast.loading('Marking entries as non-billable...');
                    router.post(route('timesheet-entries.bulk-update'), {
                        entry_ids: entriesData.map(e => e.id),
                        is_billable: false
                    }, {
                        onSuccess: () => {
                            toast.dismiss();
                        },
                        onError: () => {
                            toast.dismiss();
                            toast.error('Failed to update entries');
                        }
                    });
                }
            }
        );
    }

    const breadcrumbs = [
        { title: 'Dashboard', href: route('dashboard') },
        { title: 'Timesheets', href: route('timesheets.index') },
        { title: 'Daily View' }
    ];

    return (
        <PageTemplate 
            title="Daily View"
            description="View your timesheets for the selected day." 
            actions={pageActions}
            breadcrumbs={breadcrumbs}
        >
            <Head title={`Daily View - ${formatDate(currentDate)}`} />
            
            {/* Date Navigation */}
            <Card className="mb-6">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => navigateDate('prev')}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            
                            <div className="text-center">
                                <CardTitle className="text-lg">
                                    {formatDate(currentDate)}
                                    {isToday && <span className="ml-2 inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20">Today</span>}
                                    {isWeekend && <span className="ml-2 inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20">Weekend</span>}
                                </CardTitle>
                            </div>
                            
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => navigateDate('next')}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <Input
                                type="date"
                                value={currentDate.toISOString().split('T')[0]}
                                onChange={handleDateChange}
                                className="w-auto"
                            />
                            {!isToday && (
                                <Button variant="outline" onClick={goToToday}>
                                    Today
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Day Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-bl-full" />
                    <CardContent className="relative p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Total Hours</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{(getDayTotal() || 0).toFixed(2)}h</p>
                            </div>
                            <div className="relative z-10 p-2.5 bg-blue-50 dark:bg-blue-900/30 rounded-xl mt-0.5">
                                <Clock className="h-5 w-5 text-blue-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-green-50 dark:bg-green-900/30 rounded-bl-full" />
                    <CardContent className="relative p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Billable Hours</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{(getBillableTotal() || 0).toFixed(2)}h</p>
                            </div>
                            <div className="relative z-10 p-2.5 bg-green-50 dark:bg-green-900/30 rounded-xl mt-0.5">
                                <Calendar className="h-5 w-5 text-green-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-purple-50 dark:bg-purple-900/30 rounded-bl-full" />
                    <CardContent className="relative p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Entries</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{entriesData.length}</p>
                            </div>
                            <div className="relative z-10 p-2.5 bg-purple-50 dark:bg-purple-900/30 rounded-xl mt-0.5">
                                <ListTodo className="h-5 w-5 text-purple-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-orange-50 dark:bg-orange-900/30 rounded-bl-full" />
                    <CardContent className="relative p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Utilization</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{(((getDayTotal() || 0) / 8) * 100).toFixed(0)}%</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Based on 8h day</p>
                            </div>
                            <div className="relative z-10 p-2.5 bg-orange-50 dark:bg-orange-900/30 rounded-xl mt-0.5">
                                <BarChart3 className="h-5 w-5 text-orange-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Time Entries */}
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle className='text-xl'>Time Entries</CardTitle>
                        {hasPermission(userPermissions, 'timesheet_create') && (
                            <Button onClick={() => setIsFormOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Entry
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <TimeEntryList
                        entries={entries}
                        timesheetId={timesheetId}
                        projects={projects}
                        filters={filters}
                        onRefresh={() => router.get(route('timesheets.daily-view'), { date: currentDate.toISOString().split('T')[0] }, { preserveState: true })}
                    />
                </CardContent>
            </Card>

            {/* Quick Actions */}
            {entriesData.length === 0 && (
                <Card className="mt-6">
                    <CardContent className="p-8 text-center">
                        <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No time entries for this day</h3>
                        <p className="text-gray-500 mb-4">Start tracking your time by adding your first entry</p>
                        {hasPermission(userPermissions, 'timesheet_create') && (
                            <Button onClick={() => setIsFormOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Time Entry
                            </Button>
                        )}
                    </CardContent>
                </Card>
            )}

            <TimeEntryForm
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                timesheetId={timesheetId}
                projects={projects}
            />
        </PageTemplate>
    );
}