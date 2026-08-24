import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { usePage } from '@inertiajs/react';
import { AlertTriangle, ArrowRight, Link2, Loader2, Plus, Trash2, X } from 'lucide-react';
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
    const [adding, setAdding] = useState(false);
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
                setAdding(false);
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
        return <div className="flex items-center gap-2 text-sm text-muted-foreground py-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading dependencies...</div>;
    }

    return (
        <div className="space-y-3">
            {/* Blocked warning */}
            {blocked && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400 text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{t('This task is blocked by incomplete dependencies')}</span>
                </div>
            )}

            {/* Dependencies (this task depends on) */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium flex items-center gap-1.5">
                        <Link2 className="w-3.5 h-3.5" />
                        {t('Depends on')} ({dependencies.length})
                    </h4>
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAdding(!adding)}>
                        {adding ? <X className="w-3 h-3 mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
                        {adding ? t('Cancel') : t('Add')}
                    </Button>
                </div>

                {adding && (
                    <div className="flex gap-2 mb-2">
                        <select
                            value={selectedTaskId}
                            onChange={e => setSelectedTaskId(Number(e.target.value) || '')}
                            className="flex-1 text-sm rounded-lg border px-2 py-1.5 bg-background"
                        >
                            <option value="">{t('Select a task...')}</option>
                            {availableTasks.map(t => (
                                <option key={t.id} value={t.id}>{t.title}</option>
                            ))}
                        </select>
                        <Button type="button" size="sm" onClick={addDependency} disabled={!selectedTaskId || saving} className="h-8">
                            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : t('Add')}
                        </Button>
                    </div>
                )}

                {dependencies.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t('No dependencies')}</p>
                ) : (
                    <div className="space-y-1">
                        {dependencies.map(dep => (
                            <div key={dep.id} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-sm ${
                                dep.is_completed ? 'bg-green-50/50 dark:bg-green-950/10 border-green-200/50 dark:border-green-800/30' : 'bg-amber-50/50 dark:bg-amber-950/10 border-amber-200/50 dark:border-amber-800/30'
                            }`}>
                                <span className={`w-2 h-2 rounded-full shrink-0 ${dep.is_completed ? 'bg-green-500' : 'bg-amber-500'}`} />
                                <span className="flex-1 truncate">{dep.title}</span>
                                <span className="text-xs text-muted-foreground">{dep.progress}%</span>
                                <button onClick={() => removeDependency(dep.id)} className="p-0.5 rounded hover:bg-muted">
                                    <Trash2 className="w-3 h-3 text-muted-foreground" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Dependents (tasks that depend on this) */}
            {dependents.length > 0 && (
                <div>
                    <h4 className="text-sm font-medium flex items-center gap-1.5 mb-2">
                        <ArrowRight className="w-3.5 h-3.5" />
                        {t('Blocking')} ({dependents.length})
                    </h4>
                    <div className="space-y-1">
                        {dependents.map(dep => (
                            <div key={dep.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-sm">
                                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                                <span className="flex-1 truncate">{dep.title}</span>
                                <span className="text-xs text-muted-foreground">{dep.status}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
