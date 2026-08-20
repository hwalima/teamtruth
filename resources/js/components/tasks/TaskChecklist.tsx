import React, { useState } from 'react';
import { router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CheckSquare, Square, Plus, MoreHorizontal, Edit, Trash2, Calendar, User, Send } from 'lucide-react';
import { Task, TaskChecklist as ChecklistItem, User as UserType } from '@/types';
import { CrudDeleteModal } from '@/components/CrudDeleteModal';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast as sonnerToast } from 'sonner';

const isDemoMode = (): boolean => (window as any).isDemo || false;
const demoModeMessage = 'This action is disabled in demo mode. You can only create new data, not modify existing demo data.';

interface Props {
    task: Task;
    checklist: ChecklistItem[];
    members: UserType[];
    onUpdate?: () => void;
    canManageChecklists?: boolean;
}

export default function TaskChecklist({ task, checklist, members, onUpdate, canManageChecklists = true }: Props) {
    const [newItem, setNewItem] = useState('');
    const [editingItem, setEditingItem] = useState<number | null>(null);
    const [editData, setEditData] = useState({
        title: '',
        assigned_to: '',
        due_date: ''
    });
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; itemId: number | null }>({ isOpen: false, itemId: null });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItem.trim()) return;

        router.post(route('task-checklists.store', task.id), {
            title: newItem,
            assigned_to: '',
            due_date: ''
        }, {
            onSuccess: () => {
                setNewItem('');
                onUpdate?.();
            }
        });
    };

    const handleToggle = (itemId: number) => {
        if (isDemoMode()) {
            sonnerToast.error(demoModeMessage);
            return;
        }
        router.post(route('task-checklists.toggle', itemId), {}, {
            onSuccess: () => {
                onUpdate?.();
            }
        });
    };

    const handleEdit = (item: ChecklistItem) => {
        setEditingItem(item.id);
        setEditData({
            title: item.title,
            assigned_to: item.assigned_to?.id?.toString() || '',
            due_date: item.due_date || ''
        });
    };

    const handleUpdate = (itemId: number) => {
        router.put(route('task-checklists.update', itemId), editData, {
            onSuccess: () => {
                setEditingItem(null);
                setEditData({ title: '', assigned_to: '', due_date: '' });
                onUpdate?.();
            }
        });
    };

    const handleDelete = (itemId: number) => {
        setDeleteModal({ isOpen: true, itemId });
    };

    const confirmDelete = () => {
        if (deleteModal.itemId) {
            router.delete(route('task-checklists.destroy', deleteModal.itemId), {
                onSuccess: () => {
                    setDeleteModal({ isOpen: false, itemId: null });
                    onUpdate?.();
                }
            });
        }
    };

    const completedCount = checklist.filter(item => item.is_completed).length;
    const progressPercentage = checklist.length > 0 ? (completedCount / checklist.length) * 100 : 0;

    const getProgressColor = (percentage: number) => {
    if (percentage === 100) return 'bg-emerald-500';
    if (percentage >= 75) return 'bg-green-500';
    if (percentage >= 50) return 'bg-yellow-500';
    if (percentage >= 25) return 'bg-orange-500';
    return 'bg-red-500';
};

    return (
        <>
            <CrudDeleteModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, itemId: null })}
                onConfirm={confirmDelete}
                itemName="this checklist item"
                entityName="checklist item"
            />
            <div className="flex flex-col h-full overflow-hidden">
                {/* Progress Bar */}
                {checklist.length > 0 && (
                    <div className="shrink-0 space-y-2 mb-4 px-1 pb-3 border-b">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600 font-medium">Progress</span>
                            <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20">{completedCount}/{checklist.length} completed</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div
                                className={`h-2 rounded-full transition-all duration-500 ${getProgressColor(progressPercentage)}`}
                                style={{ width: `${progressPercentage}%` }}
                            />
                        </div>
                        </div>
                    </div>
                )}

                {/* Checklist Items */}
                <div className="flex-1 overflow-y-auto pr-1 space-y-2 mb-4">
                    {checklist.map((item) => (
                        <div key={item.id} className={`flex items-start space-x-3 p-3 rounded-xl border transition-all group ${
                            item.is_completed
                                ? 'bg-gray-50 border-gray-100 dark:text-gray-500'
                                : 'bg-white border-gray-200 hover:border-primary/30 hover:shadow-sm dark:text-gray-100'
                        }`}>
                            {canManageChecklists && (
                                <button
                                    onClick={() => handleToggle(item.id)}
                                    className="mt-0.5 cursor-pointer text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    {item.is_completed ? (
                                        <CheckSquare className="h-5 w-5 text-green-500 fill-green-50" />
                                    ) : (
                                        <Square className="h-5 w-5" />
                                    )}
                                </button>
                            )}

                            <div className="flex-1 min-w-0">
                                {editingItem === item.id ? (
                                    <div className="space-y-3 p-1">
                                        <Input
                                            value={editData.title}
                                            onChange={(e) => setEditData({...editData, title: e.target.value})}
                                            placeholder="Checklist item title"
                                            className="focus-visible:ring-blue-500"
                                        />
                                        <div className="grid grid-cols-2 gap-2">
                                            <Select 
                                                value={editData.assigned_to || 'unassigned'} 
                                                onValueChange={(value) => setEditData({...editData, assigned_to: value === 'unassigned' ? '' : value})}
                                            >
                                                <SelectTrigger className="h-9">
                                                    <SelectValue placeholder="Assign to" />
                                                </SelectTrigger>
                                                <SelectContent className="z-[9999]">
                                                    <SelectItem value="unassigned">Unassigned</SelectItem>
                                                    {members.map((member) => (
                                                        <SelectItem key={member.id} value={member.id.toString()}>
                                                            {member.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Input
                                                type="date"
                                                value={editData.due_date}
                                                onChange={(e) => setEditData({...editData, due_date: e.target.value})}
                                                className="h-9"
                                            />
                                        </div>
                                        <div className="flex space-x-2">
                                            <Button size="sm" onClick={() => handleUpdate(item.id)}>
                                                Save
                                            </Button>
                                            <Button 
                                                size="sm" 
                                                variant="outline" 
                                                onClick={() => setEditingItem(null)}
                                            >
                                                Cancel
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                       <div
                                            className={`text-sm font-medium ${
                                                item.is_completed
                                                    ? 'line-through text-gray-400 dark:text-gray-500'
                                                    : 'text-gray-800 dark:text-gray-100'
                                            }`}
                                        >
                                            {item.title}
                                        </div>
                                        {(item.assigned_to || item.due_date) && (
                                            <div className="flex items-center space-x-4 mt-2 text-[10px] text-gray-500">
                                                {item.assigned_to && (
                                                    <div className="flex items-center space-x-1 bg-gray-50 px-2 py-0.5 rounded">
                                                        <Avatar className="h-5 w-5">
                                                            <AvatarImage src={(item.assigned_to as any).avatar} />
                                                            <AvatarFallback className="text-xs">{item.assigned_to.name?.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                        <span>{item.assigned_to.name}</span>
                                                    </div>
                                                )}
                                                {item.due_date && (
                                                    <div className="flex items-center space-x-1 bg-gray-50 px-2 py-0.5 rounded">
                                                        <Calendar className="h-3 w-3" />
                                                        <span>{window.appSettings.formatDateTime(new Date(item.due_date))}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {(item.can_update || item.can_delete) && (
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                <MoreHorizontal className="h-4 w-4 text-gray-400" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="z-[9999]">
                                            {item.can_update && (
                                                <DropdownMenuItem onClick={() => handleEdit(item)}>
                                                    <Edit className="h-4 w-4 mr-2" />
                                                    Edit
                                                </DropdownMenuItem>
                                            )}
                                            {item.can_delete && (
                                                <DropdownMenuItem 
                                                    onClick={() => handleDelete(item.id)}
                                                    className="text-red-600"
                                                >
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Delete
                                                </DropdownMenuItem>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            )}
                        </div>
                    ))}

                    {checklist.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-center py-10 text-gray-400">
                            <div className="bg-gray-50 p-4 rounded-full mb-4">
                                <CheckSquare className="h-8 w-8 text-gray-300" />
                            </div>
                            <p className="text-sm font-medium">No checklist items yet</p>
                            <p className="text-xs">Add your first item to stay organized!</p>
                        </div>
                    )}
                </div>

                {/* Add Item */}
                {canManageChecklists && (
                    <div className="shrink-0 border-t pt-4 bg-white">
                        <form onSubmit={handleSubmit} className="flex space-x-2">
                            <Input
                                value={newItem}
                                onChange={(e) => setNewItem(e.target.value)}
                                placeholder="Add checklist item..."
                                className="flex-1 focus-visible:ring-blue-500 rounded-xl"
                            />
                            <Button type="submit" size="sm" disabled={!newItem.trim()}>
                                                                    <Send className="h-4 w-4" />

                            </Button>
                        </form>
                    </div>
                )}
            </div>
        </>
    );
}