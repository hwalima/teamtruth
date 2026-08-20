import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SettingsSection } from '@/components/settings-section';
import { router } from '@inertiajs/react';
import { Plus, Save, Trash2, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import axios from 'axios';

interface IctSettings {
    subsidiaries: string[];
    departments: string[];
    categories: Record<string, string>;
    sla_response_hours: number;
    sla_resolution_hours: number;
}

const DEFAULTS: IctSettings = {
    subsidiaries: [
        'Trukumb Holdings Head Office', 'Epoch Mines & Resources',
        'Talen Vision Enterprises', 'Talen Vision Engineering', 'Talen Vision Construction',
        'Talen Vision Brick Moulding', 'Talen Vision Food Court', 'Trukumb Health Center',
        'Ivinar Park Academy', 'Travelite PVT LTD', 'Talen Vision FC', 'Trukumb Microfinance', 'Other',
    ],
    departments: [
        'Executive / Management', 'Information Technology', 'Human Resources',
        'Finance & Accounts', 'Operations', 'Engineering', 'Construction & Infrastructure',
        'Mining Operations', 'Sales & Marketing', 'Administration', 'Transport & Logistics',
        'Education & Training', 'Healthcare Services', 'Food Services', 'Legal & Compliance',
        'Procurement & Supply Chain', 'Safety, Health & Environment', 'Sports & Recreation', 'Other',
    ],
    categories: {
        hardware: 'Hardware', software: 'Software / Applications',
        network: 'Network & Connectivity', access_security: 'Access & Security',
        recruitment: 'Recruitment', payroll: 'Payroll',
        expense_claim: 'Expense Claim', building: 'Building Maintenance',
        vehicle: 'Vehicle / Fleet Issue', safety_incident: 'Safety Incident',
        breakdown: 'Vehicle Breakdown', equipment_failure: 'Equipment Failure',
        student_affairs: 'Student Affairs', general: 'General Enquiry', other: 'Other',
    },
    sla_response_hours: 4,
    sla_resolution_hours: 24,
};

function TagList({ items, onRemove }: { items: string[]; onRemove: (i: string) => void }) {
    return (
        <div className="flex flex-wrap gap-1.5 min-h-[2rem]">
            {items.map(item => (
                <Badge key={item} variant="secondary" className="gap-1 pr-1">
                    {item}
                    <button type="button" onClick={() => onRemove(item)} className="ml-0.5 rounded hover:bg-destructive/20 hover:text-destructive p-0.5">
                        <X className="w-2.5 h-2.5" />
                    </button>
                </Badge>
            ))}
            {items.length === 0 && <p className="text-xs text-muted-foreground italic">No items — add one below</p>}
        </div>
    );
}

function AddInput({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => void }) {
    const [value, setValue] = useState('');
    const submit = () => { const v = value.trim(); if (v) { onAdd(v); setValue(''); } };
    return (
        <div className="flex gap-2">
            <Input value={value} onChange={e => setValue(e.target.value)} placeholder={placeholder} className="h-8 text-sm"
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), submit())} />
            <Button type="button" size="sm" variant="outline" className="h-8 px-2 shrink-0" onClick={submit}>
                <Plus className="w-3.5 h-3.5" />
            </Button>
        </div>
    );
}

export default function IctTicketSettings() {
    const { t } = useTranslation();
    const [settings, setSettings] = useState<IctSettings>(DEFAULTS);
    const [saving, setSaving] = useState(false);
    const [newCatKey, setNewCatKey] = useState('');
    const [newCatLabel, setNewCatLabel] = useState('');

    useEffect(() => {
        axios.get(route('settings.ict-tickets.get'))
            .then(r => setSettings({ ...DEFAULTS, ...r.data }))
            .catch(() => { /* use defaults silently */ });
    }, []);

    const removeItem = (field: 'subsidiaries' | 'departments', value: string) =>
        setSettings(p => ({ ...p, [field]: p[field].filter(i => i !== value) }));

    const addItem = (field: 'subsidiaries' | 'departments', value: string) => {
        if (!settings[field].includes(value))
            setSettings(p => ({ ...p, [field]: [...p[field], value] }));
    };

    const removeCategory = (key: string) => {
        const cats = { ...settings.categories };
        delete cats[key];
        setSettings(p => ({ ...p, categories: cats }));
    };

    const addCategory = () => {
        const key = newCatKey.trim().toLowerCase().replace(/\s+/g, '_');
        const label = newCatLabel.trim();
        if (!key || !label || settings.categories[key]) return;
        setSettings(p => ({ ...p, categories: { ...p.categories, [key]: label } }));
        setNewCatKey('');
        setNewCatLabel('');
    };

    const save = () => {
        setSaving(true);
        router.post(route('settings.ict-tickets.update'), settings as any, {
            preserveScroll: true,
            onSuccess: () => toast.success(t('ICT ticket settings saved')),
            onError: () => toast.error(t('Failed to save settings')),
            onFinish: () => setSaving(false),
        });
    };

    return (
        <SettingsSection
            title={t('Group Issue Reporting Settings')}
            description={t('Configure subsidiaries, departments, categories and SLA targets for the Trukumb Holdings group-wide issue reporting system')}
            action={
                <Button size="sm" onClick={save} disabled={saving} style={{ background: '#E3B448', color: '#001a4d' }}>
                    <Save className="h-4 w-4 mr-2" />{saving ? t('Saving...') : t('Save Changes')}
                </Button>
            }
        >
            <Card>
                <CardContent className="pt-6 space-y-6">

                    {/* SLA */}
                    <div>
                        <h3 className="text-sm font-semibold mb-3">{t('SLA Targets')}</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-xs">{t('First Response (hours)')}</Label>
                                <Input type="number" min={1} value={settings.sla_response_hours}
                                    onChange={e => setSettings(p => ({ ...p, sla_response_hours: +e.target.value }))}
                                    className="h-8 text-sm w-32" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">{t('Resolution Target (hours)')}</Label>
                                <Input type="number" min={1} value={settings.sla_resolution_hours}
                                    onChange={e => setSettings(p => ({ ...p, sla_resolution_hours: +e.target.value }))}
                                    className="h-8 text-sm w-32" />
                            </div>
                        </div>
                    </div>

                    <hr />

                    {/* Subsidiaries */}
                    <div>
                        <h3 className="text-sm font-semibold mb-2">{t('Subsidiaries')}</h3>
                        <TagList items={settings.subsidiaries} onRemove={v => removeItem('subsidiaries', v)} />
                        <div className="mt-2">
                            <AddInput placeholder={t('Add subsidiary name...')} onAdd={v => addItem('subsidiaries', v)} />
                        </div>
                    </div>

                    <hr />

                    {/* Departments */}
                    <div>
                        <h3 className="text-sm font-semibold mb-2">{t('Departments')}</h3>
                        <TagList items={settings.departments} onRemove={v => removeItem('departments', v)} />
                        <div className="mt-2">
                            <AddInput placeholder={t('Add department name...')} onAdd={v => addItem('departments', v)} />
                        </div>
                    </div>

                    <hr />

                    {/* Categories */}
                    <div>
                        <h3 className="text-sm font-semibold mb-2">{t('Issue Categories')}</h3>
                        <div className="flex flex-wrap gap-1.5 min-h-[2rem] mb-2">
                            {Object.entries(settings.categories).map(([k, label]) => (
                                <Badge key={k} variant="secondary" className="gap-1 pr-1">
                                    {label}
                                    <button type="button" onClick={() => removeCategory(k)} className="ml-0.5 rounded hover:bg-destructive/20 hover:text-destructive p-0.5">
                                        <X className="w-2.5 h-2.5" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <Input value={newCatKey} onChange={e => setNewCatKey(e.target.value)} placeholder={t('Key (e.g. printers)')} className="h-8 text-sm" />
                            <Input value={newCatLabel} onChange={e => setNewCatLabel(e.target.value)} placeholder={t('Label (e.g. Printers)')} className="h-8 text-sm"
                                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCategory())} />
                            <Button type="button" size="sm" variant="outline" className="h-8 px-2 shrink-0" onClick={addCategory}>
                                <Plus className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </div>

                </CardContent>
            </Card>
        </SettingsSection>
    );
}
