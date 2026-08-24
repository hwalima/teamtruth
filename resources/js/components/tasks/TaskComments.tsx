import React, { useState, useRef, useEffect, useCallback } from 'react';
import { router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MessageSquare, MoreHorizontal, Edit, Trash2, Send, AtSign } from 'lucide-react';
import { Task, TaskComment, User } from '@/types';
import { CrudDeleteModal } from '@/components/CrudDeleteModal';
import { useTranslation } from 'react-i18next';

interface Props {
    task: Task;
    comments: TaskComment[];
    currentUser: User;
    members?: Array<{ id: number; name: string; avatar?: string }>;
    onUpdate?: () => void;
    canAddComments?: boolean;
}

function MentionText({ text }: { text: string }) {
    const parts = text.split(/(@\w[\w\s]*?\b)/g);
    return (
        <span>
            {parts.map((part, i) =>
                part.startsWith('@') ? (
                    <span key={i} className="inline-flex items-center gap-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1 py-0.5 rounded text-xs font-medium">
                        <AtSign className="w-3 h-3" />{part.slice(1)}
                    </span>
                ) : (
                    <span key={i}>{part}</span>
                )
            )}
        </span>
    );
}

export default function TaskComments({ task, comments, currentUser, members = [], onUpdate, canAddComments = true }: Props) {
    const { t } = useTranslation();
    const [newComment, setNewComment] = useState('');
    const [editingComment, setEditingComment] = useState<number | null>(null);
    const [editText, setEditText] = useState('');
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; commentId: number | null }>({ isOpen: false, commentId: null });
    const [showMentions, setShowMentions] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionIndex, setMentionIndex] = useState(0);
    const [cursorPosition, setCursorPosition] = useState(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const mentionRef = useRef<HTMLDivElement>(null);
    const commentsEndRef = useRef<HTMLDivElement>(null);

    const filteredMembers = members.filter(m =>
        m.name.toLowerCase().includes(mentionQuery.toLowerCase()) && m.id !== currentUser?.id
    ).slice(0, 6);

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        const pos = e.target.selectionStart || 0;
        setNewComment(value);
        setCursorPosition(pos);

        const textBeforeCursor = value.slice(0, pos);
        const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

        if (mentionMatch) {
            setMentionQuery(mentionMatch[1]);
            setShowMentions(true);
            setMentionIndex(0);
        } else {
            setShowMentions(false);
        }
    };

    const insertMention = useCallback((member: { id: number; name: string }) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const textBeforeCursor = newComment.slice(0, cursorPosition);
        const textAfterCursor = newComment.slice(cursorPosition);
        const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

        if (mentionMatch) {
            const beforeMention = textBeforeCursor.slice(0, mentionMatch.index);
            const newText = `${beforeMention}@${member.name} ${textAfterCursor}`;
            setNewComment(newText);
            setShowMentions(false);

            setTimeout(() => {
                const newPos = beforeMention.length + member.name.length + 2;
                textarea.focus();
                textarea.setSelectionRange(newPos, newPos);
            }, 0);
        }
    }, [newComment, cursorPosition]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (!showMentions || filteredMembers.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setMentionIndex(i => (i + 1) % filteredMembers.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setMentionIndex(i => (i - 1 + filteredMembers.length) % filteredMembers.length);
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            insertMention(filteredMembers[mentionIndex]);
        } else if (e.key === 'Escape') {
            setShowMentions(false);
        }
    };

    const extractMentions = (text: string): number[] => {
        const mentionedNames = [...text.matchAll(/@([\w\s]+?)(?=\s@|\s[^@]|$)/g)].map(m => m[1].trim());
        return members
            .filter(m => mentionedNames.some(name => m.name.toLowerCase() === name.toLowerCase()))
            .map(m => m.id);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        const mentionIds = extractMentions(newComment);

        router.post(route('task-comments.store', task.id), {
            comment: newComment,
            mentions: mentionIds
        }, {
            onSuccess: () => {
                setNewComment('');
                onUpdate?.();
            }
        });
    };

    const handleEdit = (comment: TaskComment) => {
        setEditingComment(comment.id);
        setEditText(comment.comment);
    };

    const handleUpdate = (commentId: number) => {
        const mentionIds = extractMentions(editText);
        router.put(route('task-comments.update', commentId), {
            comment: editText,
            mentions: mentionIds
        }, {
            onSuccess: () => {
                setEditingComment(null);
                setEditText('');
                onUpdate?.();
            }
        });
    };

    const handleDelete = (commentId: number) => {
        setDeleteModal({ isOpen: true, commentId });
    };

    const confirmDelete = () => {
        if (deleteModal.commentId) {
            router.delete(route('task-comments.destroy', deleteModal.commentId), {
                onSuccess: () => {
                    setDeleteModal({ isOpen: false, commentId: null });
                    onUpdate?.();
                }
            });
        }
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return t('just now');
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString('en', { month: 'short', day: 'numeric' });
    };

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (mentionRef.current && !mentionRef.current.contains(e.target as Node)) {
                setShowMentions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <>
            <CrudDeleteModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, commentId: null })}
                onConfirm={confirmDelete}
                itemName="this comment"
                entityName="comment"
            />
            <div className="flex flex-col h-full">
                {/* Comments List */}
                <div className="flex-1 overflow-y-auto space-y-3 mb-4 max-h-[500px] pr-1">
                    {comments.map((comment) => (
                        <div key={comment.id} className="group flex gap-3 py-3 px-3 rounded-lg hover:bg-muted/40 transition-colors">
                            <div className="shrink-0">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold uppercase overflow-hidden">
                                    {comment.user?.avatar ? (
                                        <img
                                            src={comment.user.avatar}
                                            alt={comment.user.name}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                                e.currentTarget.parentElement!.innerText = comment.user?.name?.substring(0, 2) || '';
                                            }}
                                        />
                                    ) : (
                                        comment.user?.name?.substring(0, 2)
                                    )}
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-semibold text-foreground">{comment.user?.name}</span>
                                    <span className="text-[10px] text-muted-foreground">{formatTime(comment.created_at)}</span>
                                    {(comment.can_update || comment.can_delete) && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="z-[9999]">
                                                {comment.can_update && (
                                                    <DropdownMenuItem onClick={() => handleEdit(comment)}>
                                                        <Edit className="h-3.5 w-3.5 mr-2" />{t('Edit')}
                                                    </DropdownMenuItem>
                                                )}
                                                {comment.can_delete && (
                                                    <DropdownMenuItem onClick={() => handleDelete(comment.id)} className="text-red-600">
                                                        <Trash2 className="h-3.5 w-3.5 mr-2" />{t('Delete')}
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </div>

                                {editingComment === comment.id ? (
                                    <div className="space-y-2">
                                        <textarea
                                            value={editText}
                                            onChange={(e) => setEditText(e.target.value)}
                                            rows={2}
                                            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                        />
                                        <div className="flex gap-2">
                                            <Button size="sm" className="h-7 text-xs" onClick={() => handleUpdate(comment.id)}>{t('Save')}</Button>
                                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingComment(null)}>{t('Cancel')}</Button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap break-words">
                                        <MentionText text={comment.comment} />
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}

                    {comments.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                                <MessageSquare className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <p className="text-sm font-medium text-muted-foreground">{t('No comments yet')}</p>
                            <p className="text-xs text-muted-foreground/60 mt-0.5">{t('Start the conversation')}</p>
                        </div>
                    )}
                    <div ref={commentsEndRef} />
                </div>

                {/* Add Comment Form */}
                {canAddComments && (
                    <div className="shrink-0 border-t pt-3 relative">
                        {/* Mention dropdown */}
                        {showMentions && filteredMembers.length > 0 && (
                            <div ref={mentionRef} className="absolute bottom-full mb-1 left-0 right-0 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                                <div className="p-1 max-h-[180px] overflow-y-auto">
                                    {filteredMembers.map((member, idx) => (
                                        <button
                                            key={member.id}
                                            type="button"
                                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${idx === mentionIndex ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'}`}
                                            onMouseDown={(e) => { e.preventDefault(); insertMention(member); }}
                                            onMouseEnter={() => setMentionIndex(idx)}
                                        >
                                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                                                {member.name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <span className="truncate font-medium">{member.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="flex items-end gap-2">
                            <div className="flex-1 relative">
                                <textarea
                                    ref={textareaRef}
                                    value={newComment}
                                    onChange={handleTextChange}
                                    onKeyDown={handleKeyDown}
                                    placeholder={t('Write a comment... Use @ to mention')}
                                    rows={2}
                                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-muted-foreground/50"
                                />
                            </div>
                            <Button
                                type="submit"
                                size="icon"
                                disabled={!newComment.trim()}
                                className="h-9 w-9 rounded-lg shrink-0 disabled:opacity-40"
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </form>
                        <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                            <AtSign className="w-3 h-3" /> {t('Type @ to mention team members')}
                        </p>
                    </div>
                )}
            </div>
        </>
    );
}
