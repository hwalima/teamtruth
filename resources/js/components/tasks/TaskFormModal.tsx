import React, { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Task, Project, ProjectMilestone, User } from '@/types';
import { toast } from '@/components/custom-toast';
import { useTranslation } from 'react-i18next';
import { Label } from '../ui/label';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    task?: Task;
    projects: Project[];
    members: User[];
    milestones?: ProjectMilestone[];
    googleCalendarEnabled?: boolean;
}

export default function TaskFormModal({ isOpen, onClose, task, projects, members, milestones = [], googleCalendarEnabled = false }: Props) {
    const { t } = useTranslation();
    const isEditing = !!task;
    const [formData, setFormData] = useState({
        project_id: task?.project_id?.toString() || '',
        milestone_id: task?.milestone_id?.toString() || '',
        title: task?.title || '',
        description: task?.description || '',
        priority: task?.priority || 'medium',
        start_date: task?.start_date || '',
        end_date: task?.end_date || '',
        assigned_to: task?.assigned_to?.id?.toString() || 'none',
        is_googlecalendar_sync: task?.is_googlecalendar_sync || false
    });

    const [currentMilestones, setCurrentMilestones] = useState<ProjectMilestone[]>([]);
    const [currentMembers, setCurrentMembers] = useState<User[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset form when modal opens/closes or task changes
    useEffect(() => {
        if (!isOpen) return;
        if (task) {
            // Editing mode - populate with task data
            const project = projects.find(p => p.id === task.project_id);
            setCurrentMilestones(project?.milestones || []);
            const projectMembers = project?.members?.filter(member => member.user?.type !== 'client').map(member => member.user) || [];
            setCurrentMembers(projectMembers.length > 0 ? projectMembers : members);

            setFormData({
                project_id: task.project_id?.toString() || '',
                milestone_id: task.milestone_id?.toString() || '',
                title: task.title,
                description: task.description || '',
                priority: task.priority,
                start_date: task.start_date?.split('T')[0] || '',
                end_date: task.end_date?.split('T')[0] || '',
                assigned_to: task.assigned_to?.id?.toString() || 'none',
                is_googlecalendar_sync: task.is_googlecalendar_sync || false
            });
        } else {
            // Create mode - reset to defaults
            setFormData({
                project_id: '',
                milestone_id: '',
                title: '',
                description: '',
                priority: 'medium',
                start_date: '',
                end_date: '',
                assigned_to: 'none',
                is_googlecalendar_sync: false
            });
            setCurrentMilestones([]);
            setCurrentMembers([]);
        }
    }, [isOpen, task, projects, members]);

    const handleProjectChange = (projectId: string) => {
        setFormData(prev => ({
            ...prev,
            project_id: projectId,
            milestone_id: '',
            assigned_to: 'none'
        }));

        const project = projects.find(p => p.id.toString() === projectId);

        // Load project milestones
        const milestones = project?.milestones || [];
        setCurrentMilestones(milestones);

        // Load project members (not clients)
        const projectMembers = project?.members?.filter(member => member.user?.type !== 'client').map(member => member.user) || [];
        setCurrentMembers(projectMembers.length > 0 ? projectMembers : members);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (isSubmitting) return;

        setIsSubmitting(true);

        // Validate milestone
        const newErrors: Record<string, string> = {};
        if (currentMilestones.length === 0) {
            newErrors.milestone_id = t('This project has no milestones. Please create a milestone first before adding a task.');
        } else if (!formData.milestone_id) {
            newErrors.milestone_id = t('Milestone is required.');
        }
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            setIsSubmitting(false);
            return;
        }

        setErrors({});

        const submitData = {
            ...formData,
            milestone_id: formData.milestone_id,
            assigned_to: formData.assigned_to === 'none' ? '' : formData.assigned_to
        };

        if (isEditing) {
            router.put(route('tasks.update', task.id), submitData, {
                onSuccess: () => {
                    setIsSubmitting(false);
                    onClose();
                },
                onError: (errors) => {
                    setIsSubmitting(false);
                    setErrors(errors);
                }
            });
        } else {
            router.post(route('tasks.store'), submitData, {
                onSuccess: () => {
                    setIsSubmitting(false);
                    onClose();
                },
                onError: (errors) => {
                    setIsSubmitting(false);
                    setErrors(errors);
                }
            });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{isEditing ? t('Edit Task') : t('Create Task')}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {!isEditing && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                {t('Project')} <span className="text-red-500">*</span> <span className="text-xs text-gray-500">({t('Select to load milestones & team members')})</span>
                            </label>
                            <Select value={formData.project_id || ''} onValueChange={handleProjectChange}>
                                <SelectTrigger className={errors.project_id ? 'border-red-500' : ''}>
                                    <SelectValue placeholder={t('Select a project')} />
                                </SelectTrigger>
                                <SelectContent searchable className="z-[9999]">
                                    {projects.map((project) => (
                                        <SelectItem key={project.id} value={project.id.toString()}>
                                            {project.title}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.project_id && <p className="text-sm text-red-600 mt-1">{errors.project_id}</p>}
                        </div>
                    )}

                    {formData.project_id && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                {t('Milestone')} <span className="text-red-500">*</span>
                            </label>
                            <Select
                                value={formData.milestone_id}
                                onValueChange={(value) => setFormData({...formData, milestone_id: value})}
                                disabled={currentMilestones.length === 0}
                            >
                                <SelectTrigger className={errors.milestone_id ? 'border-red-500' : ''}>
                                    <SelectValue placeholder={currentMilestones.length > 0 ? t('Select a milestone') : t('No milestones available')} />
                                </SelectTrigger>
                                <SelectContent searchable className="z-[9999]">
                                    {currentMilestones.map((milestone) => (
                                        <SelectItem key={milestone.id} value={milestone.id.toString()}>
                                            {milestone.title}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.milestone_id && <p className="text-sm text-red-600 mt-1">{errors.milestone_id}</p>}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('Title')} <span className="text-red-500">*</span>
                        </label>
                        <Input
                            value={formData.title}
                            onChange={(e) => setFormData({...formData, title: e.target.value})}
                            placeholder={t('Enter task title')}
                            className={errors.title ? 'border-red-500' : ''}
                        />
                        {errors.title && <p className="text-sm text-red-600 mt-1">{errors.title}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('Description')}
                        </label>
                        <Textarea
                            value={formData.description}
                            onChange={(e) => setFormData({...formData, description: e.target.value})}
                            placeholder={t('Describe the task...')}
                            rows={3}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                {t('Priority')}
                            </label>
                            <Select value={formData.priority} onValueChange={(value) => setFormData({...formData, priority: value})}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="z-[9999]">
                                    <SelectItem value="low">{t('Low')}</SelectItem>
                                    <SelectItem value="medium">{t('Medium')}</SelectItem>
                                    <SelectItem value="high">{t('High')}</SelectItem>
                                    <SelectItem value="critical">{t('Critical')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                {t('Assign to')}
                            </label>
                            <Select
                                value={formData.assigned_to}
                                onValueChange={(value) => setFormData({...formData, assigned_to: value})}
                                disabled={!formData.project_id}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={!formData.project_id ? t('Select project first') : currentMembers.length > 0 ? t('Select assignee') : t('No team members available')} />
                                </SelectTrigger>
                                <SelectContent className="z-[9999]">
                                    <SelectItem value="none">{t('Unassigned')}</SelectItem>
                                    {currentMembers.map((member) => (
                                        <SelectItem key={member.id} value={member.id.toString()}>
                                            {member.name} {member.type !== 'client' ? t('(Team)') : t('(Client)')}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label required className="block text-sm font-medium text-gray-700 mb-2">
                                {t('Start Date')}
                            </Label>
                            <Input
                                type="date"
                                value={formData.start_date}
                                required
                                onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                            />
                        </div>

                        <div>
                            <Label required className="block text-sm font-medium text-gray-700 mb-2">
                                {t('Due Date')}
                            </Label>
                            <Input
                                type="date"
                                required
                                value={formData.end_date}
                                min={formData.start_date}
                                onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                            />
                        </div>
                    </div>

                    {googleCalendarEnabled && !isEditing && (
                        <div className="flex items-center space-x-2">
                            <Switch
                                id="google-calendar-sync"
                                checked={formData.is_googlecalendar_sync}
                                onCheckedChange={(checked) => setFormData({...formData, is_googlecalendar_sync: checked})}
                            />
                            <label htmlFor="google-calendar-sync" className="text-sm font-medium text-gray-700">
                                {t('Sync with Google Calendar')}
                            </label>
                        </div>
                    )}

                    <div className="flex justify-end space-x-2 pt-4">
                        <Button type="button" variant="outline" onClick={onClose}>
                            {t('Cancel')}
                        </Button>
                        <Button type="submit" >
                            {(isEditing ? t('Update') : t('Create'))}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
