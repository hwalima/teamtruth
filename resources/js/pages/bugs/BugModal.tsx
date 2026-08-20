import React, { useState, useEffect } from 'react';
import { useForm } from '@inertiajs/react';
import axios from 'axios';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from 'react-i18next';

interface BugModalProps {
    bug?: any;
    projects: Array<{ id: number; title: string; milestones?: any[] }>;
    statuses: Array<{ id: number; name: string; color: string }>;
    members: Array<{ id: number; name: string }>;
    onClose: () => void;
    permissions?: any;
}

export function BugModal({ bug, projects, statuses, members, onClose, permissions }: BugModalProps) {
    const { t } = useTranslation();
    const [bugPermissions, setBugPermissions] = useState(permissions);
    const [projectMembers, setProjectMembers] = useState<Array<{ id: number; name: string; email: string }>>([]);
    const [projectMilestones, setProjectMilestones] = useState<Array<{ id: number; title: string; status: string }>>([]);
    const [loadingProjectData, setLoadingProjectData] = useState(false);
    const [localErrors, setLocalErrors] = useState<Record<string, string>>({});

    const formatText = (text: string) => {
        if (!text) return '';
        return text.replace(/_/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
    };

    const { data, setData, post, put, processing, errors } = useForm({
        project_id: bug?.project_id?.toString() || '',
        milestone_id: bug?.milestone_id?.toString() || '',
        title: bug?.title || '',
        description: bug?.description || '',
        priority: bug?.priority || 'medium',
        severity: bug?.severity || 'major',
        steps_to_reproduce: bug?.steps_to_reproduce || '',
        expected_behavior: bug?.expected_behavior || '',
        actual_behavior: bug?.actual_behavior || '',
        environment: bug?.environment || '',
        assigned_to: bug?.assigned_to?.id?.toString() || 'none',
        start_date: bug?.start_date || '',
        end_date: bug?.end_date || '',
        resolution_notes: bug?.resolution_notes || '',
    });

    // Fetch project members + milestones when project changes
    useEffect(() => {
        if (data.project_id) {
            setLoadingProjectData(true);
            axios.get(route('api.bugs.project-data') + `?project_id=${data.project_id}`)
                .then(response => {
                    if (response.data.success) {
                        setProjectMembers(response.data.members || []);
                        setProjectMilestones(response.data.milestones || []);
                    }
                })
                .catch(() => {
                    setProjectMembers([]);
                    setProjectMilestones([]);
                })
                .finally(() => setLoadingProjectData(false));
        } else {
            setProjectMembers([]);
            setProjectMilestones([]);
        }
    }, [data.project_id]);

    // Reset assigned_to when project changes on create
    useEffect(() => {
        if (data.project_id && !bug) {
            setData('assigned_to', 'none');
        }
    }, [data.project_id]);

    // On edit, fetch fresh permissions
    useEffect(() => {
        if (bug?.id) {
            axios.get(route('bugs.show', bug.id))
                .then(response => setBugPermissions(response.data.permissions))
                .catch(() => {});
        }
    }, [bug]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Frontend validation
        const newErrors: Record<string, string> = {};
        if (projectMilestones.length === 0 && data.project_id) {
            // if project has no milestones
            newErrors.milestone_id = t('This project has no milestones...');
            // if milestone not selected
            } else if (!data.milestone_id) {
                newErrors.milestone_id = t('Milestone is required.');
            }

        if (Object.keys(newErrors).length > 0) {
            setLocalErrors(newErrors);
            return;
        }
        setLocalErrors({});
        if (bug) {
            put(route('bugs.update', bug.id), {
                onSuccess: () => onClose(),
                onError: (errs) => {
                    if (errs.milestone_id) {
                        setLocalErrors(prev => ({ ...prev, milestone_id: t('Milestone is required.') }));
                    }
                    console.error('Update error:', errs);
                },
            });
        } else {
            post(route('bugs.store'), {
                onSuccess: () => onClose(),
                onError: (errs) => {
                    if (errs.milestone_id) {
                        setLocalErrors(prev => ({ ...prev, milestone_id: t('Milestone is required.') }));
                    }
                    console.error('Create error:', errs);
                },
            });
        }
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl h-[95vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>
                        {bug ? t('Edit Bug') : t('Create New Bug')}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 p-2">

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>{t('Project')} <span className="text-red-500">*</span></Label>
                            <Select value={data.project_id} onValueChange={(value) => setData('project_id', value)}>
                                <SelectTrigger className={errors.project_id ? 'border-red-500' : ''}>
                                    <SelectValue placeholder={t('Select project')} />
                                </SelectTrigger>
                                <SelectContent searchable className="z-[9999]">
                                    {projects.map(project => (
                                        <SelectItem key={project.id} value={project.id.toString()}>
                                            {project.title}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.project_id && <p className="text-red-500 text-sm mt-1">{errors.project_id}</p>}
                        </div>

                        <div>
                            <Label>{t('Milestone')}</Label>
                            <Select value={data.milestone_id} onValueChange={(value) => setData('milestone_id', value)}>
                                <SelectTrigger>
                                    <SelectValue placeholder={loadingProjectData ? t('Loading...') : t('Select milestone')} />
                                </SelectTrigger>
                                <SelectContent searchable className="z-[9999]">
                                    {projectMilestones.map(milestone => (
                                        <SelectItem key={milestone.id} value={milestone.id.toString()}>
                                            {milestone.title}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {(errors.milestone_id || localErrors.milestone_id) && <p className="text-red-500 text-sm mt-1">{localErrors.milestone_id || errors.milestone_id}</p>}
                        </div>
                    </div>

                    <div>
                        <Label>{t('Bug Title')} <span className="text-red-500">*</span></Label>
                        <Input
                            value={data.title}
                            onChange={(e) => setData('title', e.target.value)}
                            placeholder={t('Brief description of the bug')}
                            className={errors.title ? 'border-red-500' : ''}
                        />
                        {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
                    </div>

                    <div>
                        <Label>{t('Description')}</Label>
                        <Textarea
                            value={data.description}
                            onChange={(e) => setData('description', e.target.value)}
                            placeholder={t('Detailed description of the bug')}
                            rows={3}
                        />
                        {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>{t('Priority')} <span className="text-red-500">*</span></Label>
                            <Select value={data.priority} onValueChange={(value) => setData('priority', value)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="z-[9999]">
                                    <SelectItem value="low">{formatText('low')}</SelectItem>
                                    <SelectItem value="medium">{formatText('medium')}</SelectItem>
                                    <SelectItem value="high">{formatText('high')}</SelectItem>
                                    <SelectItem value="critical">{formatText('critical')}</SelectItem>
                                </SelectContent>
                            </Select>
                            {errors.priority && <p className="text-red-500 text-sm mt-1">{errors.priority}</p>}
                        </div>

                        <div>
                            <Label>{t('Severity')} <span className="text-red-500">*</span></Label>
                            <Select value={data.severity} onValueChange={(value) => setData('severity', value)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="z-[9999]">
                                    <SelectItem value="minor">{formatText('minor')}</SelectItem>
                                    <SelectItem value="major">{formatText('major')}</SelectItem>
                                    <SelectItem value="critical">{formatText('critical')}</SelectItem>
                                    <SelectItem value="blocker">{formatText('blocker')}</SelectItem>
                                </SelectContent>
                            </Select>
                            {errors.severity && <p className="text-red-500 text-sm mt-1">{errors.severity}</p>}
                        </div>
                    </div>

                    <div>
                        <Label>{t('Steps to Reproduce')}</Label>
                        <Textarea
                            value={data.steps_to_reproduce}
                            onChange={(e) => setData('steps_to_reproduce', e.target.value)}
                            placeholder={"1. Step one\n2. Step two\n3. Step three"}
                            rows={4}
                        />
                        {errors.steps_to_reproduce && <p className="text-red-500 text-sm mt-1">{errors.steps_to_reproduce}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>{t('Expected Behavior')}</Label>
                            <Textarea
                                value={data.expected_behavior}
                                onChange={(e) => setData('expected_behavior', e.target.value)}
                                placeholder={t('What should happen')}
                                rows={3}
                            />
                            {errors.expected_behavior && <p className="text-red-500 text-sm mt-1">{errors.expected_behavior}</p>}
                        </div>

                        <div>
                            <Label>{t('Actual Behavior')}</Label>
                            <Textarea
                                value={data.actual_behavior}
                                onChange={(e) => setData('actual_behavior', e.target.value)}
                                placeholder={t('What actually happens')}
                                rows={3}
                            />
                            {errors.actual_behavior && <p className="text-red-500 text-sm mt-1">{errors.actual_behavior}</p>}
                        </div>
                    </div>

                    <div>
                        <Label>{t('Environment')}</Label>
                        <Input
                            value={data.environment}
                            onChange={(e) => setData('environment', e.target.value)}
                            placeholder={t('Browser, OS, device details')}
                        />
                        {errors.environment && <p className="text-red-500 text-sm mt-1">{errors.environment}</p>}
                    </div>

                    {bugPermissions?.assign_users && (
                        <div>
                            <Label>{t('Assign To')}</Label>
                            <Select
                                value={data.assigned_to}
                                onValueChange={(value) => setData('assigned_to', value)}
                                disabled={!data.project_id || loadingProjectData}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={
                                        !data.project_id ? t('Select project first') :
                                        loadingProjectData ? t('Loading...') :
                                        t('Select assignee')
                                    } />
                                </SelectTrigger>
                                <SelectContent searchable className="z-[9999]">
                                    <SelectItem value="none">{t('Unassigned')}</SelectItem>
                                    {projectMembers.map(member => (
                                        <SelectItem key={member.id} value={member.id.toString()}>
                                            {member.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.assigned_to && <p className="text-red-500 text-sm mt-1">{errors.assigned_to}</p>}
                            {!data.project_id && !errors.assigned_to && (
                                <p className="text-sm text-gray-500 mt-1">{t('Please select a project first to see available assignees')}</p>
                            )}
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-4 pb-2">
                        <Button type="button" variant="outline" onClick={onClose}>
                            {t('Cancel')}
                        </Button>
                        {(bug ? bugPermissions?.update : bugPermissions?.create) && (
                            <Button type="submit" disabled={processing || !data.project_id || !data.title}>
                                {bug ? t('Update') : t('Create')}
                            </Button>
                        )}
                    </div>

                </form>
            </DialogContent>
        </Dialog>
    );
}
