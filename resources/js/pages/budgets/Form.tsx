import React, { useState, useEffect, useMemo } from 'react';
import { router, usePage } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Palette, ArrowLeft } from 'lucide-react';
import { PageTemplate } from '@/components/page-template';
import { useTranslation } from 'react-i18next';

interface Project { id: number; title: string; }
interface Category {
    id?: number;
    name: string;
    allocated_amount: number;
    color: string;
    description: string;
}
interface Budget {
    id: number;
    project_id: number;
    project?: Project;
    total_budget: number;
    currency: string;
    period_type: string;
    start_date: string;
    end_date?: string;
    description?: string;
    status: string;
    categories: Array<{ id: number; name: string; allocated_amount: number; color: string; description?: string; }>;
}

const colorOptions = [
    '#3B82F6','#EF4444','#10B77F','#F59E0B','#8B5CF6','#EC4899',
    '#6B7280','#84CC16','#F97316','#06B6D4','#DC2626','#059669',
    '#7C3AED','#DB2777','#4F46E5','#0891B2'
];

export default function BudgetForm() {
    const { t } = useTranslation();
    const { mode, budget, projects = [], allProjects = [] } = usePage().props as any;

    const availableProjects = mode === 'edit' ? allProjects : projects;

    const [formData, setFormData] = useState(() => {
        if (mode === 'edit' && budget) {
            return {
                project_id: budget.project_id?.toString() || '',
                total_budget: budget.total_budget?.toString() || '',
                period_type: budget.period_type || 'monthly',
                start_date: budget.start_date || '',
                end_date: budget.end_date || '',
                description: budget.description || '',
                status: budget.status || 'active'
            };
        }
        return {
            project_id: '',
            total_budget: '',
            period_type: 'monthly',
            start_date: '',
            end_date: '',
            description: '',
            status: 'active'
        };
    });

    const [categories, setCategories] = useState<Category[]>(() => {
        if (mode === 'edit' && budget?.categories) {
            return budget.categories.map(cat => ({
                id: cat.id,
                name: cat.name,
                allocated_amount: parseFloat(cat.allocated_amount as any) || 0,
                color: cat.color,
                description: cat.description || ''
            }));
        }
        return [];
    });
    const [defaultCategories, setDefaultCategories] = useState<Category[]>([]);
    const [errors, setErrors] = useState<any>({});
    const [isLoadingDefaults, setIsLoadingDefaults] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [projectSearch, setProjectSearch] = useState('');

    const filteredProjects = useMemo(() => {
        if (!projectSearch) return availableProjects.slice(0, 50);
        return availableProjects.filter(p =>
            p.title.toLowerCase().includes(projectSearch.toLowerCase())
        ).slice(0, 50);
    }, [availableProjects, projectSearch]);

    useEffect(() => {
        if (mode === 'create') {
            loadDefaultCategories();
        }
    }, []);

    const loadDefaultCategories = async () => {
        try {
            setIsLoadingDefaults(true);
            const response = await fetch(route('budgets.default-categories'));
            if (!response.ok) { setDefaultCategories([]); return; }
            const data = await response.json();
            setDefaultCategories(data.categories || []);
        } catch { setDefaultCategories([]); }
        finally { setIsLoadingDefaults(false); }
    };

    const addCategory = () => {
        if (mode === 'create' && !formData.project_id) {
            setErrors({ project_id: 'Please select a project first' }); return;
        }
        if (!formData.total_budget || parseFloat(formData.total_budget) <= 0) {
            setErrors({ total_budget: 'Please enter total budget amount first' }); return;
        }
        setCategories([...categories, { name: '', allocated_amount: 0, color: '#3B82F6', description: '' }]);
    };

    const updateCategory = (index: number, field: keyof Category, value: any) => {
        const updated = [...categories];
        updated[index] = { ...updated[index], [field]: value };
        setCategories(updated);
    };

    const removeCategory = (index: number) => setCategories(categories.filter((_, i) => i !== index));

    const getTotalAllocated = () =>
        categories.reduce((sum, cat) => sum + (parseFloat(cat.allocated_amount.toString()) || 0), 0);

    const formatCurrency = (amount: number) => {
        if (typeof window !== 'undefined' && window.appSettings?.formatCurrency) {
            return window.appSettings.formatCurrency(amount, { showSymbol: true });
        }
        return amount.toFixed(2);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});
        const newErrors: any = {};

        if (!formData.project_id) newErrors.project_id = 'Please select a project';
        if (!formData.total_budget || parseFloat(formData.total_budget) <= 0) newErrors.total_budget = 'Please enter a valid budget amount';
        if (parseFloat(formData.total_budget) > 999999999.99) newErrors.total_budget = 'Budget amount cannot exceed 999,999,999.99';
        if (formData.end_date && formData.start_date && formData.end_date <= formData.start_date) newErrors.end_date = 'End date must be after start date';
        if (categories.length === 0) newErrors.categories = 'Please add at least one budget category';
        if (categories.some(cat => !cat.name.trim())) newErrors.categories = 'All categories must have a name';
        if (getTotalAllocated() > parseFloat(formData.total_budget)) newErrors.categories = 'Total allocated amount cannot exceed budget';

        if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

        const submitData = {
            ...formData,
            total_budget: parseFloat(formData.total_budget),
            categories: categories.map((cat, index) => ({
                ...cat,
                allocated_amount: parseFloat(cat.allocated_amount.toString()) || 0,
                sort_order: index + 1
            }))
        };

        setIsSubmitting(true);
        const url = mode === 'create' ? route('budgets.store') : route('budgets.update', budget?.id);
        const method = mode === 'create' ? 'post' : 'put';

        router[method](url, submitData, {
            onError: (errs) => { setErrors(errs); setIsSubmitting(false); },
            onFinish: () => setIsSubmitting(false)
        });
    };

    const actions = [
        {
            label: t('Back'),
            icon: <ArrowLeft className="h-4 w-4 mr-2" />,
            variant: 'outline',
            onClick: () => router.get(route('budgets.index'))
        }
    ];

    const breadcrumbs = [
        { title: t('Dashboard'), href: route('dashboard') },
        { title: t('Budget & Expenses') },
        { title: t('Budgets'), href: route('budgets.index') },
        { title: mode === 'create' ? t('Create Budget') : t('Edit Budget') }
    ];

    return (
        <PageTemplate
            title={mode === 'create' ? t('Create Budget') : t('Edit Budget')}
            description={mode === 'create' ? t('Create a new project budget') : t('Update budget details')}
            url={mode === 'create' ? '/budgets/create' : `/budgets/${budget?.id}/edit`}
            actions={actions}
            breadcrumbs={breadcrumbs}
            noPadding
        >
            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Left: Main form */}
                    <div className="lg:col-span-3 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">{t('Budget Details')}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Label>{t('Project')} <span className="text-red-500">*</span></Label>
                                        <Select
                                            value={formData.project_id}
                                            onValueChange={(value) => setFormData({ ...formData, project_id: value })}
                                            disabled={mode === 'edit'}
                                        >
                                            <SelectTrigger className={errors.project_id ? 'border-red-500' : ''}>
                                                <SelectValue placeholder={t('Select project')}>
                                                    {formData.project_id && availableProjects.find(p => p.id.toString() === formData.project_id)?.title}
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent searchable>
                                                {filteredProjects.map((project) => (
                                                    <SelectItem key={project.id} value={project.id.toString()}>
                                                        {project.title}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {errors.project_id && <p className="text-red-500 text-sm mt-1">{errors.project_id}</p>}
                                    </div>

                                    <div>
                                        <Label>{t('Total Budget')} <span className="text-red-500">*</span></Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            max="999999999.99"
                                            value={formData.total_budget}
                                            onChange={(e) => setFormData({ ...formData, total_budget: e.target.value })}
                                            placeholder="0.00"
                                            className={errors.total_budget ? 'border-red-500' : ''}
                                        />
                                        {errors.total_budget && <p className="text-red-500 text-sm mt-1">{errors.total_budget}</p>}
                                    </div>

                                    <div>
                                        <Label>{t('Period Type')} <span className="text-red-500">*</span></Label>
                                        <Select value={formData.period_type} onValueChange={(value) => setFormData({ ...formData, period_type: value })}>
                                            <SelectTrigger>
                                                <SelectValue placeholder={t('Select period type')} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="monthly">{t('Monthly Budget')}</SelectItem>
                                                <SelectItem value="quarterly">{t('Quarterly Budget')}</SelectItem>
                                                <SelectItem value="yearly">{t('Yearly Budget')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <Label>{t('Start Date')} <span className="text-red-500">*</span></Label>
                                        <Input
                                            type={mode === 'edit' ? 'text' : 'date'}
                                            value={mode === 'edit' ? (formData.start_date ? new Date(formData.start_date).toLocaleDateString() : 'Not set') : formData.start_date}
                                            onChange={mode === 'edit' ? undefined : (e) => setFormData({ ...formData, start_date: e.target.value })}
                                            disabled={mode === 'edit'}
                                            className={mode === 'edit' ? 'bg-gray-50' : ''}
                                            required={mode === 'create'}
                                        />
                                    </div>

                                    <div>
                                        <Label>{t('End Date')}</Label>
                                        <Input
                                            type={mode === 'edit' ? 'text' : 'date'}
                                            value={mode === 'edit' ? (formData.end_date ? new Date(formData.end_date).toLocaleDateString() : 'Ongoing') : formData.end_date}
                                            onChange={mode === 'edit' ? undefined : (e) => setFormData({ ...formData, end_date: e.target.value })}
                                            disabled={mode === 'edit'}
                                            className={mode === 'edit' ? 'bg-gray-50' : ''}
                                        />
                                        {errors.end_date && <p className="text-red-500 text-sm mt-1">{errors.end_date}</p>}
                                    </div>

                                    {mode === 'edit' && (
                                        <div>
                                            <Label>{t('Status')} <span className="text-red-500">*</span></Label>
                                            <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="active">{t('Active')}</SelectItem>
                                                    <SelectItem value="completed">{t('Completed')}</SelectItem>
                                                    <SelectItem value="cancelled">{t('Cancelled')}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <Label>{t('Description')}</Label>
                                    <Textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        placeholder={t('Budget description...')}
                                        rows={3}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Categories */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base">{t('Budget Categories')} <span className="text-red-500">*</span></CardTitle>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={addCategory}
                                        disabled={(mode === 'create' && !formData.project_id) || !formData.total_budget || parseFloat(formData.total_budget) <= 0}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        {t('Add Category')}
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {categories.length === 0 ? (
                                    <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                                        <Palette className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                                        <p className="text-gray-500 font-medium">{t('No categories added yet')}</p>
                                        <p className="text-sm text-gray-400">{t('Add categories to organize your budget allocation')}</p>
                                    </div>
                                ) : (
                                <div className="max-h-[340px] overflow-y-auto pr-1">
                                    <div className="space-y-4">
                                        {categories.map((category, index) => (
                                            <div key={index} className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
                                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                    <div>
                                                        <Label>{t('Category Name')} <span className="text-red-500">*</span></Label>
                                                        <Input
                                                            value={category.name}
                                                            onChange={(e) => updateCategory(index, 'name', e.target.value)}
                                                            placeholder={t('e.g., Development')}
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label>{t('Allocated Amount')} <span className="text-red-500">*</span></Label>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            value={category.allocated_amount}
                                                            onChange={(e) => updateCategory(index, 'allocated_amount', parseFloat(e.target.value) || 0)}
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label>{t('Color')}</Label>
                                                        <div className="flex gap-2 items-center">
                                                            <div className="w-8 h-8 rounded border-2 border-gray-300" style={{ backgroundColor: category.color }} />
                                                            <input
                                                                type="color"
                                                                value={category.color}
                                                                onChange={(e) => updateCategory(index, 'color', e.target.value)}
                                                                className="w-12 h-8 rounded border cursor-pointer"
                                                            />
                                                            <div className="grid grid-cols-4 gap-1">
                                                                {colorOptions.slice(0, 8).map((color) => (
                                                                    <button
                                                                        key={color}
                                                                        type="button"
                                                                        className="w-4 h-4 cursor-pointer rounded border hover:scale-110 transition-transform"
                                                                        style={{ backgroundColor: color }}
                                                                        onClick={() => updateCategory(index, 'color', color)}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-end">
                                                        <Button type="button" variant="outline" size="sm" onClick={() => removeCategory(index)} className="text-gray-500 hover:text-red-500">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="mt-2">
                                                    <Label>{t('Description')}</Label>
                                                    <Input
                                                        value={category.description}
                                                        onChange={(e) => updateCategory(index, 'description', e.target.value)}
                                                        placeholder={t('Category description...')}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                )}
                                {/* {errors.categories && <p className="text-red-500 text-sm mt-2">{errors.categories}</p>} */}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right: Summary + Actions */}
                    <div className="space-y-6">
                        {/* {categories.length > 0 && ( */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">{t('Budget Summary')}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">{t('Total Budget')}</span>
                                        <span className="font-medium font-mono">{formatCurrency(parseFloat(formData.total_budget) || 0)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">{t('Total Allocated')}</span>
                                        <span className={`font-medium font-mono ${getTotalAllocated() > parseFloat(formData.total_budget) ? 'text-red-600' : 'text-green-600'}`}>
                                            {formatCurrency(getTotalAllocated())}
                                        </span>
                                    </div>
                                    <div className="border-t pt-2 flex justify-between text-sm font-semibold">
                                        <span>{t('Remaining')}</span>
                                        <span className={`font-mono ${(parseFloat(formData.total_budget) || 0) - getTotalAllocated() < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            {formatCurrency((parseFloat(formData.total_budget) || 0) - getTotalAllocated())}
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 mt-1">
                                        <div
                                            className="h-2 rounded-full transition-all duration-500"
                                            style={{
                                                width: `${Math.min((getTotalAllocated() / (parseFloat(formData.total_budget) || 1)) * 100, 100)}%`,
                                                backgroundColor: getTotalAllocated() > parseFloat(formData.total_budget) ? '#ef4444' : 'hsl(var(--primary))'
                                            }}
                                        />
                                    </div>
                                    {errors.categories && <p className="text-red-500 text-sm mt-2">{errors.categories}</p>}

                                </CardContent>
                            </Card>
                        {/* )} */}

                        <Card>
                            <CardContent className="pt-6 space-y-3">
                                <Button
                                    type="submit"
                                    className="w-full text-white dark:text-white"
                                    disabled={isSubmitting || categories.length === 0 || !formData.project_id || !formData.total_budget}
                                >
                                    {isSubmitting ? t('Saving...') : mode === 'create' ? t('Create Budget') : t('Update Budget')}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => router.get(route('budgets.index'))}
                                >
                                    {t('Cancel')}
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </form>
        </PageTemplate>
    );
}
