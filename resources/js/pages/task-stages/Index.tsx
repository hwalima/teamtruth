import React, { useState, useEffect } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Edit, Trash2, GripVertical, Settings, Layers, ListTodo, Star, BarChart3 } from 'lucide-react';
import { PageTemplate } from '@/components/page-template';
import { CrudDeleteModal } from '@/components/CrudDeleteModal';
import { TaskStage } from '@/types';
import { toast } from '@/components/custom-toast';
import { useTranslation } from 'react-i18next';

interface Props {
    stages: TaskStage[];
    permissions?: any;
}

export default function TaskStagesIndex({ stages, permissions }: Props) {
    const { t } = useTranslation();
    const { flash, permissions: pagePermissions } = usePage().props as any;
    const stagePermissions = permissions || pagePermissions;
    
    const formatText = (text: string) => {
        if (!text) return '';
        return text.replace(/_/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
    };
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingStage, setEditingStage] = useState<TaskStage | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [stageToDelete, setStageToDelete] = useState<TaskStage | null>(null);
    const [stagesList, setStagesList] = useState(stages);
    const [formData, setFormData] = useState({
        name: '',
        color: '#3b82f6'
    });
    const [formErrors, setFormErrors] = useState<{name?: string}>({});

    // Show flash messages
    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
        if (flash?.error) {
            toast.error(flash.error);
        }
    }, [flash]);

    const resetForm = () => {
        setFormData({ name: '', color: '#3b82f6' });
        setFormErrors({});
        setEditingStage(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setFormErrors({});

        // Client-side validation
        if (!formData.name.trim()) {
            setFormErrors({ name: t('Stage name is required') });
            return;
        }

        if (editingStage) {
            toast.loading(t('Updating stage...'));
            router.put(route('task-stages.update', editingStage.id), formData, {
                onSuccess: (page) => {
                    toast.dismiss();
                    setStagesList(page.props.stages);
                    resetForm();
                },
                onError: () => {
                    toast.dismiss();
                    toast.error(t('Failed to update stage'));
                },
                preserveState: true,
                preserveScroll: true
            });
        } else {
            toast.loading(t('Creating stage...'));
            router.post(route('task-stages.store'), formData, {
                onSuccess: (page) => {
                    toast.dismiss();
                    setStagesList(page.props.stages);
                    setIsCreateOpen(false);
                    resetForm();
                },
                onError: () => {
                    toast.dismiss();
                    toast.error(t('Failed to create stage'));
                },
                preserveState: true,
                preserveScroll: true
            });
        }
    };

    const handleEdit = (stage: TaskStage) => {
        resetForm();
        setEditingStage(stage);
        setFormData({ name: stage.name, color: stage.color });
    };

    const handleCreateNew = () => {
        resetForm();
        setIsCreateOpen(true);
    };

    const handleDelete = (stage: TaskStage) => {
        setStageToDelete(stage);
        setIsDeleteModalOpen(true);
    };

    const handleDeleteConfirm = () => {
        if (stageToDelete) {
            toast.loading(t('Deleting stage...'));
            router.delete(route('task-stages.destroy', stageToDelete.id), {
                onSuccess: (page) => {
                    toast.dismiss();
                    setStagesList(page.props.stages);
                    setIsDeleteModalOpen(false);
                    setStageToDelete(null);
                },
                onError: () => {
                    toast.dismiss();
                    setIsDeleteModalOpen(false);
                    setStageToDelete(null);
                },
                preserveState: true,
                preserveScroll: true
            });
        }
    };

    const handleSetDefault = (stageId: number) => {
        toast.loading(t('Setting default stage...'));
        router.put(route('task-stages.set-default', stageId), {}, {
            onSuccess: (page) => {
                toast.dismiss();
                setStagesList(page.props.stages);
            },
            onError: () => {
                toast.dismiss();
                toast.error(t('Failed to set default stage'));
            },
            preserveState: true,
            preserveScroll: true
        });
    };

    const handleDragEnd = (result: DropResult) => {
        if (!result.destination) return;

        const items = Array.from(stagesList);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        // Update order values
        const updatedItems = items.map((item, index) => ({
            ...item,
            order: index + 1
        }));

        // Send reorder request to backend
        const reorderData = updatedItems.map((stage, index) => ({
            id: stage.id,
            order: index + 1
        }));

        toast.loading(t('Reordering stages...'));
        router.put(route('task-stages.reorder'), {
            stages: reorderData
        }, {
            onSuccess: (page) => {
                toast.dismiss();
                setStagesList(page.props.stages);
            },
            onError: () => {
                toast.dismiss();
                toast.error(t('Failed to reorder stages'));
                setStagesList(stages);
            },
            preserveState: true,
            preserveScroll: true
        });
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'critical': return 'bg-red-100 text-red-800';
            case 'high': return 'bg-orange-100 text-orange-800';
            case 'medium': return 'bg-yellow-100 text-yellow-800';
            case 'low': return 'bg-green-100 text-green-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const pageActions = [];
    
    if (stagePermissions?.create) {
        pageActions.push({
            label: t('Add Stage'),
            icon: <Plus className="h-4 w-4 mr-2" />,
            variant: 'default' as const,
            onClick: handleCreateNew
        });
    }

    const breadcrumbs = [
        { title: t('Dashboard'), href: route('dashboard') },
        { title: t('Tasks'), href: route('tasks.index') },
        { title: t('Task Stages') }
    ];

    return (
        <PageTemplate 
            title={t('Task Stages')}
            description={t('Manage your task stages.')} 
            url="/task-stages"
            actions={pageActions}
            breadcrumbs={breadcrumbs}
        >
            <Head title={t('Task Stages')} />
            
            <div className="space-y-8">
                {/* Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-bl-full" />
                        <CardContent className="relative p-5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Total Stages')}</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stagesList.length}</p>
                                </div>
                                <div className="relative z-10 p-2.5 bg-blue-50 dark:bg-blue-900/30 rounded-xl mt-0.5">
                                    <Layers className="h-5 w-5 text-blue-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-green-50 dark:bg-green-900/30 rounded-bl-full" />
                        <CardContent className="relative p-5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Total Tasks')}</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stagesList.reduce((sum, stage) => sum + (stage.tasks_count || 0), 0)}</p>
                                </div>
                                <div className="relative z-10 p-2.5 bg-green-50 dark:bg-green-900/30 rounded-xl mt-0.5">
                                    <ListTodo className="h-5 w-5 text-green-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-purple-50 dark:bg-purple-900/30 rounded-bl-full" />
                        <CardContent className="relative p-5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Default Stage')}</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stagesList.find(s => s.is_default)?.name || t('None')}</p>
                                </div>
                                <div className="relative z-10 p-2.5 bg-purple-50 dark:bg-purple-900/30 rounded-xl mt-0.5">
                                    <Star className="h-5 w-5 text-purple-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-orange-50 dark:bg-orange-900/30 rounded-bl-full" />
                        <CardContent className="relative p-5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('Avg Tasks/Stage')}</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stagesList.length > 0 ? Math.round(stagesList.reduce((sum, stage) => sum + (stage.tasks_count || 0), 0) / stagesList.length) : 0}</p>
                                </div>
                                <div className="relative z-10 p-2.5 bg-orange-50 dark:bg-orange-900/30 rounded-xl mt-0.5">
                                    <BarChart3 className="h-5 w-5 text-orange-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Stages Management */}
                <div>
                    <div className="flex items-center mb-4">
                        <h2 className="text-lg font-semibold">{t('Workflow Stages')}</h2>
                        <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 ml-2">
                            {t('Drag to reorder')}
                        </span>
                    </div>
                        <DragDropContext onDragEnd={handleDragEnd}>
                            <Droppable droppableId="stages">
                                {(provided) => (
                                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                                        {stagesList.map((stage, index) => (
                                            <Draggable key={stage.id} draggableId={stage.id.toString()} index={index}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        className={`bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow ${
                                                            snapshot.isDragging ? 'shadow-lg ring-2 ring-blue-500' : ''
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center space-x-3">
                                                                <div
                                                                    {...provided.dragHandleProps}
                                                                    className="cursor-move p-1 hover:bg-gray-100 rounded"
                                                                >
                                                                    <GripVertical className="h-5 w-5 text-gray-400" />
                                                                </div>
                                                                <div className="text-sm font-medium text-gray-500 min-w-[60px]">{t('Order')}: {stage.order}</div>
                                                                <div 
                                                                    className="w-4 h-4 rounded-full border-2 border-white shadow-sm" 
                                                                    style={{ backgroundColor: stage.color }}
                                                                />
                                                                <div className="flex items-center space-x-2">
                                                                    <h3 className="font-semibold text-gray-900">{stage.name}</h3>
                                                                    {stage.is_default && (
                                                                        <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20">
                                                                            {t('Default')}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="flex items-center">
                                                                <div className="text-center min-w-[60px]">
                                                                    <p className="text-xl font-bold text-gray-900">
                                                                        {stage.tasks_count || 0}
                                                                    </p>
                                                                    <p className="text-xs text-gray-500">{t('tasks')}</p>
                                                                </div>
                                                                
                                                                <TooltipProvider>
                                                                    <div className="flex items-center space-x-1">
                                                                        {stagePermissions?.update && (
                                                                            <Tooltip>
                                                                                <TooltipTrigger asChild>
                                                                                    <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700 h-8 w-8 p-0" onClick={() => handleEdit(stage)}>
                                                                                        <Edit className="h-4 w-4" />
                                                                                    </Button>
                                                                                </TooltipTrigger>
                                                                                <TooltipContent>{t('Edit')}</TooltipContent>
                                                                            </Tooltip>
                                                                        )}
                                                                        {stagePermissions?.delete && (
                                                                            <Tooltip>
                                                                                <TooltipTrigger asChild>
                                                                                    <Button 
                                                                                        variant="ghost" 
                                                                                        size="sm" 
                                                                                        className="text-gray-500 hover:text-gray-700 h-8 w-8 p-0" 
                                                                                        onClick={() => handleDelete(stage)}
                                                                                        disabled={stage.tasks_count > 0}
                                                                                    >
                                                                                        <Trash2 className="h-4 w-4" />
                                                                                    </Button>
                                                                                </TooltipTrigger>
                                                                                <TooltipContent>{t('Delete')}</TooltipContent>
                                                                            </Tooltip>
                                                                        )}
                                                                    </div>
                                                                </TooltipProvider>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </DragDropContext>
                        
                        {stagesList.length === 0 && (
                            <div className="text-center py-12">
                                <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">{t('No stages yet')}</h3>
                                <p className="text-gray-500 mb-4">{t('Create your first task stage to get started')}</p>
                                {stagePermissions?.create && (
                                    <Button onClick={handleCreateNew} className="bg-blue-600 hover:bg-blue-700">
                                        <Plus className="h-4 w-4 mr-2" />
                                        {t('Add Your First Stage')}
                                    </Button>
                                )}
                            </div>
                        )}
                </div>
                </div>

            {/* Create Stage Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={(open) => {
                setIsCreateOpen(open);
                if (!open) resetForm();
            }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('Create New Stage')}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                {t('Stage Name')} <span className="text-red-500">*</span>
                            </label>
                            <Input
                                value={formData.name}
                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                                placeholder={t('Enter stage name')}
                                className={formErrors.name ? 'border-red-500' : ''}
                            />
                            {formErrors.name && <p className="text-red-600 text-sm mt-1">{formErrors.name}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                {t('Color')}
                            </label>
                            <div className="flex items-center space-x-3">
                                <input
                                    type="color"
                                    value={formData.color}
                                    onChange={(e) => setFormData({...formData, color: e.target.value})}
                                    className="w-12 h-10 rounded-md border border-gray-300 cursor-pointer"
                                />
                                <Input
                                    value={formData.color}
                                    onChange={(e) => setFormData({...formData, color: e.target.value})}
                                    placeholder="#3b82f6"
                                    className="flex-1"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end space-x-2 pt-4">
                            <Button type="button" variant="outline" onClick={() => {
                                setIsCreateOpen(false);
                                resetForm();
                            }}>
                                {t('Cancel')}
                            </Button>
                            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                                {t('Create')}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Edit Stage Dialog */}
            <Dialog open={!!editingStage} onOpenChange={(open) => {
                if (!open) resetForm();
            }}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>{t('Edit Stage')}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    {t('Stage Name')} <span className="text-red-500">*</span>
                                </label>
                                <Input
                                    value={formData.name}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                    placeholder={t('Enter stage name')}
                                    className={formErrors.name ? 'border-red-500' : ''}
                                />
                                {formErrors.name && <p className="text-red-600 text-sm mt-1">{formErrors.name}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    {t('Color')}
                                </label>
                                <div className="flex items-center space-x-3">
                                    <input
                                        type="color"
                                        value={formData.color}
                                        onChange={(e) => setFormData({...formData, color: e.target.value})}
                                        className="w-12 h-10 rounded-md border border-gray-300 cursor-pointer"
                                    />
                                    <Input
                                        value={formData.color}
                                        onChange={(e) => setFormData({...formData, color: e.target.value})}
                                        placeholder="#3b82f6"
                                        className="flex-1"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end space-x-2 pt-4">
                                <Button type="button" variant="outline" onClick={() => resetForm()}>
                                    {t('Cancel')}
                                </Button>
                                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                                    {t('Update')}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>

            {/* Delete Modal */}
            <CrudDeleteModal
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    setIsDeleteModalOpen(false);
                    setStageToDelete(null);
                }}
                onConfirm={handleDeleteConfirm}
                itemName={stageToDelete?.name || ''}
                entityName={t('task stage')}
                warningMessage={stageToDelete?.tasks_count > 0 
                    ? t('This stage contains {{count}} task{{s}}. Please move or delete these tasks first.', { count: stageToDelete.tasks_count, s: stageToDelete.tasks_count > 1 ? 's' : '' })
                    : t('This action cannot be undone.')
                }
                additionalInfo={stageToDelete?.tasks_count > 0 ? [
                    t('{{count}} task{{s}} will need to be reassigned', { count: stageToDelete.tasks_count, s: stageToDelete.tasks_count > 1 ? 's' : '' }),
                    t('Stage order will be automatically adjusted')
                ] : [
                    t('Stage order will be automatically adjusted')
                ]}
            />
        </PageTemplate>
    );
}