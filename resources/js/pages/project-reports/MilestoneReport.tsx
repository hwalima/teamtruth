import { useState } from 'react';
import { usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { Download, FileText, Calendar, Target, FolderOpen } from 'lucide-react';
import { PageTemplate } from '@/components/page-template';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';

interface Milestone {
    id: number;
    title: string;
    due_date: string | null;
    status: string;
    progress: number;
}

interface Project {
    id: number;
    title: string;
    milestones: Milestone[];
}

interface Props {
    projects: Project[];
    filters: {
        project_id?: string;
        milestone_id?: string;
        date_from?: string;
        date_to?: string;
    };
}

export default function MilestoneReport({ projects, filters }: Props) {
    const { t } = useTranslation();

    const [selectedProjectId, setSelectedProjectId] = useState<string>(filters.project_id || '');
    const [selectedMilestoneId, setSelectedMilestoneId] = useState<string>(filters.milestone_id || '');
    const [dateFrom, setDateFrom] = useState<string>(filters.date_from || '');
    const [dateTo, setDateTo] = useState<string>(filters.date_to || '');
    const [isGenerating, setIsGenerating] = useState(false);

    const selectedProject = projects.find(p => String(p.id) === selectedProjectId);
    const milestones = selectedProject?.milestones || [];
    const selectedMilestone = milestones.find(m => String(m.id) === selectedMilestoneId);

    const handleProjectChange = (value: string) => {
        setSelectedProjectId(value);
        setSelectedMilestoneId('');
    };

    const handleExport = () => {
        if (!selectedMilestoneId) return;

        setIsGenerating(true);
        const params = new URLSearchParams();
        if (dateFrom) params.append('date_from', dateFrom);
        if (dateTo) params.append('date_to', dateTo);

        const url = route('project-reports.milestone.export', selectedMilestoneId) + (params.toString() ? '?' + params.toString() : '');
        window.open(url, '_blank');

        setTimeout(() => setIsGenerating(false), 2000);
    };

    const breadcrumbs = [
        { title: t('Project Reports'), href: route('project-reports.index') },
        { title: t('Milestone Report') },
    ];

    return (
        <PageTemplate
            title={t('Milestone Report')}
            breadcrumbs={breadcrumbs}
            description={t('Generate detailed PDF reports for project milestones')}
        >
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Report Configuration */}
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                                <FileText className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold">{t('Configure Report')}</h3>
                                <p className="text-sm text-muted-foreground">{t('Select a project and milestone to generate the report')}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Project Selection */}
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                                    {t('Project')}
                                </Label>
                                <Select value={selectedProjectId} onValueChange={handleProjectChange}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={t('Select a project')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {projects.map(project => (
                                            <SelectItem key={project.id} value={String(project.id)}>
                                                {project.title}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Milestone Selection */}
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Target className="h-4 w-4 text-muted-foreground" />
                                    {t('Milestone')}
                                </Label>
                                <Select
                                    value={selectedMilestoneId}
                                    onValueChange={setSelectedMilestoneId}
                                    disabled={!selectedProjectId}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={selectedProjectId ? t('Select a milestone') : t('Select a project first')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {milestones.map(milestone => (
                                            <SelectItem key={milestone.id} value={String(milestone.id)}>
                                                {milestone.title}
                                                {milestone.status === 'completed' && ' ✓'}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Date From */}
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    {t('Date From')}
                                    <span className="text-xs text-muted-foreground">({t('optional')})</span>
                                </Label>
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                />
                            </div>

                            {/* Date To */}
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    {t('Date To')}
                                    <span className="text-xs text-muted-foreground">({t('optional')})</span>
                                </Label>
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    min={dateFrom || undefined}
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                />
                                <p className="text-xs text-muted-foreground">
                                    {t('Filter tasks within this date range. Leave empty for all tasks.')}
                                </p>
                            </div>
                        </div>

                        {/* Generate Button */}
                        <div className="mt-6">
                            <Button
                                onClick={handleExport}
                                disabled={!selectedMilestoneId || isGenerating}
                                className="w-full sm:w-auto"
                                size="lg"
                            >
                                <Download className="h-4 w-4 mr-2" />
                                {isGenerating ? t('Generating...') : t('Download PDF Report')}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Milestone Preview */}
                {selectedMilestone && (
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                                    <Target className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold">{selectedMilestone.title}</h3>
                                    <p className="text-sm text-muted-foreground">
                                        {selectedProject?.title}
                                        {selectedMilestone.due_date && (
                                            <> &middot; Due: {new Date(selectedMilestone.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>
                                        )}
                                    </p>
                                </div>
                                <div className="ml-auto">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                        selectedMilestone.status === 'completed'
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                            : selectedMilestone.status === 'in_progress'
                                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                                    }`}>
                                        {selectedMilestone.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">{t('Progress')}</span>
                                    <span className="font-medium">{selectedMilestone.progress}%</span>
                                </div>
                                <Progress value={selectedMilestone.progress} className="h-2" />
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Info Card */}
                <Card className="border-dashed">
                    <CardContent className="p-6">
                        <h4 className="font-medium mb-3">{t('Report Contents')}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                {t('Company branding (logo & name)')}
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                {t('Milestone overview & progress')}
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                {t('Task priority & status charts')}
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                {t('Hours logged per task')}
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                {t('Complete task listing with descriptions')}
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                {t('Team performance breakdown')}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </PageTemplate>
    );
}
