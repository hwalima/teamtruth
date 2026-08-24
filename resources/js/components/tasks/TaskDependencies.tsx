import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { usePage } from '@inertiajs/react';
import { AlertTriangle, ArrowRight, Link2, Loader2, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/components/custom-toast';

interface Dependency {
    id: number;
    title: string;
    status: string;
    progress: number;
    type: string;
    is_completed?: boolean;
}

interface TaskDependenciesProps {
    taskId: number;
    projectTasks?: Array<{ id: number; title: string }>;
    isBlocked?: boolean;
}

export function TaskDependencies({ taskId, projectTasks = [], isBlocked }: TaskDependenciesProps) {
    const { t } = useTranslation();
    const { csrf_token } = usePage().props as any;
    const [dependencies, setDependencies] = useState<Dependency[]>([]);
    const [dependents, setDependents] = useState<Dependency[]>([]);
    const [blocked, setBlocked] = useState(isBlocked ?? false);
    const [loading, setLoading] = useState(true);
    const [selectedTaskId, setSelectedTaskId] = useState<number | ''>('');
    const [saving, setSaving] = useState(false);

    const headers = { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf_token, 'Accept': 'application/json' };

    const fetchDependencies = async () => {
        try {
            const res = await fetch(route('tasks.dependencies.index', { task: taskId }), { headers: { Accept: 'application/json' } });
            const data = await res.json();
            if (data.success) {
                setDependencies(data.dependencies);
                setDependents(data.dependents);
                setBlocked(data.is_blocked);
            }
        } catch { /* silent */ }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchDependencies(); }, [taskId]);

    const addDependency = async () => {
        if (!selectedTaskId) return;
        setSaving(true);
        try {
            const res = await fetch(route('tasks.dependencies.store', { task: taskId }), {
                method: 'POST', headers,
                body: JSON.stringify({ depends_on_id: selectedTaskId, type: 'finish_to_start' }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message);
                setBlocked(data.is_blocked);
                setSelectedTaskId('');
                fetchDependencies();
            } else {
                toast.error(data.message);
            }
        } catch { toast.error('Failed to add dependency'); }
        finally { setSaving(false); }
    };

    const removeDependency = async (depId: number) => {
        try {
            const res = await fetch(route('tasks.dependencies.destroy', { task: taskId, dependsOnId: depId }), {
                method: 'DELETE', headers,
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message);
                setBlocked(data.is_blocked);
                fetchDependencies();
            }
        } catch { toast.error('Failed to remove dependency'); }
    };

    const availableTasks = projectTasks.filter(t => t.id !== taskId && !dependencies.find(d => d.id === t.id));

    if (loading) {
        return (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t('Loading...')}</span>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {blocked && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 text-xs font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{t('This task is blocked by incomplete dependencies')}</span>
                </div>
            )}

            {/* Add dependency */}
            {availableTasks.length > 0 && (
                <div className="relative">
                    <select
                        value={selectedTaskId}
                        onChange={e => setSelectedTaskId(Number(e.target.value) || '')}
                        className="w-full h-9 text-sm rounded-md border border-gray-300 dark:border-gray-600 pl-3 pr-12 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                        <option value="">{t('Select a task...')}</option>
                        {availableTasks.map(t => (
                            <option key={t.id} value={t.id}>{t.title}</option>
                        ))}
                    </select>
                    <button
                        type="button"
                        onClick={addDependency}
                        disabled={!selectedTaskId || saving}
                        className="absolute right-1 top-1 h-7 w-7 flex items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-4 h-4" />}
                    </button>
                </div>
            )}

            {/* Dependencies list */}
            {dependencies.length > 0 && (
                <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('Depends on')}</p>
                    <div className="space-y-1">
                        {dependencies.map(dep => (
                            <div key={dep.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-md border text-sm ${
                                dep.is_completed
                                    ? 'bg-green-50 dark:bg-green-950/10 border-green-200 dark:border-green-800/40'
                                    : 'bg-amber-50 dark:bg-amber-950/10 border-amber-200 dark:border-amber-800/40'
                            }`}>
                                <span className={`w-2 h-2 rounded-full shrink-0 ${dep.is_completed ? 'bg-green-500' : 'bg-amber-500'}`} />
                                <span className="flex-1 truncate font-medium text-gray-700 dark:text-gray-300">{dep.title}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                    dep.is_completed ? 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30' : 'text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30'
                                }`}>{dep.progress}%</span>
                                <button type="button" onClick={() => removeDependency(dep.id)} className="p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950/20 text-gray-400 hover:text-red-500 transition-colors">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Dependents list */}
            {dependents.length > 0 && (
                <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <ArrowRight className="w-3 h-3" />
                        {t('Blocking')}
                    </p>
                    <div className="space-y-1">
                        {dependents.map(dep => (
                            <div key={dep.id} className="flex items-center gap-2.5 px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-sm">
                                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                                <span className="flex-1 truncate font-medium text-gray-700 dark:text-gray-300">{dep.title}</span>
                                <span className="text-xs text-muted-foreground">{dep.status}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {dependencies.length === 0 && dependents.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">{t('No dependencies configured')}</p>
            )}
        </div>
    );
}
