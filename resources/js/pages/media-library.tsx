import { PageTemplate } from '@/components/page-template';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePage } from '@inertiajs/react';
import {
    ChevronRight, Download, Eye, File, FileText, Film, FolderOpen, FolderPlus, Grid3X3,
    Image, List, Lock, LockOpen, MoreHorizontal, Music, Plus, Search,
    Shield, Trash2, Upload, X, Folder as FolderIcon,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

// ── Types ────────────────────────────────────────────────────────────────────

interface MediaFolder {
    id: number;
    name: string;
    color: string;
    parent_id: number | null;
    is_locked: boolean;
    user_id: number;
    accesses: string[];
    items_count: number;
    created_at: string;
}

interface MediaFile {
    id: number;
    media_id: number;
    name: string;
    file_name: string;
    url: string;
    thumb_url: string;
    size: number;
    mime_type: string;
    folder_id: number | null;
    is_locked: boolean;
    created_at: string;
}

interface Breadcrumb { id: number | null; name: string }

// ── Constants ────────────────────────────────────────────────────────────────

const FOLDER_COLORS = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
    '#8B5CF6', '#F97316', '#EC4899', '#06B6D4',
    '#6B7280', '#84CC16',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function buildBreadcrumbs(folders: MediaFolder[], currentId: number | null): Breadcrumb[] {
    const crumbs: Breadcrumb[] = [{ id: null, name: 'Home' }];
    if (currentId === null) return crumbs;
    const chain: MediaFolder[] = [];
    let node = folders.find((f) => f.id === currentId);
    while (node) {
        chain.unshift(node);
        node = node.parent_id ? folders.find((f) => f.id === node!.parent_id) : undefined;
    }
    chain.forEach((f) => crumbs.push({ id: f.id, name: f.name }));
    return crumbs;
}

function FileIcon({ mimeType, className }: { mimeType: string; className?: string }) {
    if (mimeType?.startsWith('image/')) return <Image className={className} />;
    if (mimeType?.startsWith('video/')) return <Film className={className} />;
    if (mimeType?.startsWith('audio/')) return <Music className={className} />;
    if (mimeType === 'application/pdf') return <FileText className={className} />;
    return <File className={className} />;
}

// ── Folder tree sidebar ──────────────────────────────────────────────────────

function FolderTreeItem({
    folder, allFolders, currentId, depth, onNavigate,
}: {
    folder: MediaFolder; allFolders: MediaFolder[]; currentId: number | null; depth: number; onNavigate: (id: number | null) => void;
}) {
    const children = allFolders.filter((f) => f.parent_id === folder.id);
    const [open, setOpen] = useState(false);
    const isActive = currentId === folder.id;

    return (
        <div>
            <div
                className={`flex items-center gap-1.5 rounded px-2 py-1 cursor-pointer text-sm select-none hover:bg-muted/60 ${isActive ? 'bg-muted font-medium' : ''}`}
                style={{ paddingLeft: `${(depth + 1) * 12}px` }}
                onClick={() => onNavigate(folder.id)}
            >
                {children.length > 0 && (
                    <button
                        className="p-0 w-3 h-3 flex items-center justify-center"
                        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
                    >
                        <ChevronRight className={`w-3 h-3 transition-transform ${open ? 'rotate-90' : ''}`} />
                    </button>
                )}
                {children.length === 0 && <span className="w-3" />}
                <FolderIcon className="w-3.5 h-3.5 shrink-0" style={{ color: folder.color }} fill={folder.color} />
                <span className="truncate flex-1">{folder.name}</span>
                {folder.is_locked && <Lock className="w-3 h-3 text-muted-foreground shrink-0" />}
            </div>
            {open && children.map((c) => (
                <FolderTreeItem key={c.id} folder={c} allFolders={allFolders} currentId={currentId} depth={depth + 1} onNavigate={onNavigate} />
            ))}
        </div>
    );
}

// ── Lock / Access modal ──────────────────────────────────────────────────────

function LockAccessModal({
    open, onClose, type, item, csrfToken, onUpdated,
}: {
    open: boolean;
    onClose: () => void;
    type: 'folder' | 'file';
    item: MediaFolder | MediaFile | null;
    csrfToken: string;
    onUpdated: () => void;
}) {
    const { t } = useTranslation();
    const [accesses, setAccesses] = useState<{ id: number; email: string }[]>([]);
    const [emailInput, setEmailInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [isLocked, setIsLocked] = useState(false);

    const lockRoute = !item ? '#' : type === 'folder'
        ? route('api.media.folders.toggleLock', { id: item.id })
        : route('api.media.toggleLock', { id: item.id });
    const accessListRoute = !item ? '#' : type === 'folder'
        ? route('api.media.folders.accesses', { id: item.id })
        : route('api.media.accesses', { id: item.id });
    const storeAccessRoute = !item ? '#' : type === 'folder'
        ? route('api.media.folders.storeAccess', { id: item.id })
        : route('api.media.storeAccess', { id: item.id });
    const destroyAccessRoute = !item ? '#' : type === 'folder'
        ? route('api.media.folders.destroyAccess', { id: item.id })
        : route('api.media.destroyAccess', { id: item.id });

    useEffect(() => {
        if (!open || !item) return;
        setIsLocked((item as any).is_locked ?? false);
        fetch(accessListRoute, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
            .then((r) => r.json())
            .then(setAccesses)
            .catch(() => setAccesses([]));
    }, [open, item]);

    const toggleLock = async () => {
        setLoading(true);
        const res = await fetch(lockRoute, {
            method: 'POST', credentials: 'same-origin',
            headers: { 'X-CSRF-TOKEN': csrfToken, 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        setIsLocked(data.is_locked);
        toast.success(data.message);
        onUpdated();
        setLoading(false);
    };

    const addAccess = async () => {
        if (!emailInput.trim()) return;
        setLoading(true);
        const res = await fetch(storeAccessRoute, {
            method: 'POST', credentials: 'same-origin',
            headers: { 'X-CSRF-TOKEN': csrfToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailInput.trim() }),
        });
        const data = await res.json();
        if (res.ok) {
            toast.success(data.message);
            setEmailInput('');
            const list = await fetch(accessListRoute, { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then((r) => r.json());
            setAccesses(list);
        } else {
            toast.error(data.message ?? t('Failed'));
        }
        setLoading(false);
    };

    const removeAccess = async (email: string) => {
        setLoading(true);
        await fetch(destroyAccessRoute, {
            method: 'DELETE', credentials: 'same-origin',
            headers: { 'X-CSRF-TOKEN': csrfToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });
        setAccesses((prev) => prev.filter((a) => a.email !== email));
        setLoading(false);
    };

    if (!item) return null;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Shield className="w-4 h-4" /> {t('Lock & Access')} — {(item as any).name}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                            <p className="font-medium text-sm">{isLocked ? t('Locked') : t('Unlocked')}</p>
                            <p className="text-xs text-muted-foreground">
                                {isLocked ? t('Access restricted to authorised users') : t('Accessible to all workspace members')}
                            </p>
                        </div>
                        <Button size="sm" variant={isLocked ? 'destructive' : 'outline'} onClick={toggleLock} disabled={loading}>
                            {isLocked ? <Lock className="w-3.5 h-3.5 mr-1" /> : <LockOpen className="w-3.5 h-3.5 mr-1" />}
                            {isLocked ? t('Locked') : t('Unlocked')}
                        </Button>
                    </div>

                    {isLocked && (
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">{t('Grant access by email')}</Label>
                            <div className="flex gap-2">
                                <Input
                                    type="email"
                                    placeholder="user@example.com"
                                    value={emailInput}
                                    onChange={(e) => setEmailInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && addAccess()}
                                    className="flex-1"
                                />
                                <Button size="sm" onClick={addAccess} disabled={loading || !emailInput.trim()}>
                                    <Plus className="w-3.5 h-3.5" />
                                </Button>
                            </div>

                            <div className="max-h-40 overflow-y-auto space-y-1">
                                {accesses.length === 0 && (
                                    <p className="text-xs text-muted-foreground text-center py-2">{t('No users have been granted access')}</p>
                                )}
                                {accesses.map((a) => (
                                    <div key={a.id} className="flex items-center justify-between rounded bg-muted/50 px-3 py-1.5 text-sm">
                                        <span>{a.email}</span>
                                        <button onClick={() => removeAccess(a.email)} className="text-muted-foreground hover:text-destructive">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>{t('Close')}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ── Create / Edit Folder modal ───────────────────────────────────────────────

function FolderFormModal({
    open, onClose, editing, parentId, csrfToken, onSaved,
}: {
    open: boolean;
    onClose: () => void;
    editing: MediaFolder | null;
    parentId: number | null;
    csrfToken: string;
    onSaved: (folder: MediaFolder) => void;
}) {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [color, setColor] = useState('#3B82F6');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (editing) { setName(editing.name); setColor(editing.color); }
        else { setName(''); setColor('#3B82F6'); }
    }, [editing, open]);

    const save = async () => {
        if (!name.trim()) return;
        setSaving(true);
        const url = editing
            ? route('api.media.folders.update', { id: editing.id })
            : route('api.media.folders.store');
        const res = await fetch(url, {
            method: editing ? 'PUT' : 'POST',
            credentials: 'same-origin',
            headers: { 'X-CSRF-TOKEN': csrfToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name.trim(), color, parent_id: parentId }),
        });
        const data = await res.json();
        if (res.ok) {
            toast.success(data.message);
            onSaved(data.folder);
            onClose();
        } else {
            toast.error(data.message ?? t('Failed'));
        }
        setSaving(false);
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FolderPlus className="w-4 h-4" />
                        {editing ? t('Rename Folder') : t('New Folder')}
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-1">
                        <Label>{t('Folder name')}</Label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && save()}
                            placeholder={t('e.g. Project Assets')}
                            autoFocus
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>{t('Colour')}</Label>
                        <div className="flex flex-wrap gap-2">
                            {FOLDER_COLORS.map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setColor(c)}
                                    className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>{t('Cancel')}</Button>
                    <Button onClick={save} disabled={saving || !name.trim()}>{saving ? t('Saving...') : t('Save')}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ── Upload modal ─────────────────────────────────────────────────────────────

function UploadModal({
    open, onClose, folderId, csrfToken, allowedTypes, onUploaded,
}: {
    open: boolean;
    onClose: () => void;
    folderId: number | null;
    csrfToken: string;
    allowedTypes: string;
    onUploaded: (files: MediaFile[]) => void;
}) {
    const { t } = useTranslation();
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const upload = async (files: FileList) => {
        const allowed = allowedTypes.split(',').map((x) => x.trim().toLowerCase());
        const valid = Array.from(files).filter((f) => {
            const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
            if (!allowed.includes(ext)) { toast.error(`${f.name}: ${t('type not allowed')}`); return false; }
            return true;
        });
        if (!valid.length) return;
        setUploading(true);
        const form = new FormData();
        valid.forEach((f) => form.append('files[]', f));
        if (folderId) form.append('folder_id', String(folderId));
        const res = await fetch(route('api.media.batch'), {
            method: 'POST', credentials: 'same-origin',
            headers: { 'X-CSRF-TOKEN': csrfToken, 'X-Requested-With': 'XMLHttpRequest' },
            body: form,
        });
        const data = await res.json();
        if (res.ok) {
            toast.success(data.message);
            onUploaded(data.data ?? []);
            onClose();
        } else {
            (data.errors ?? [data.message]).forEach((e: string) => toast.error(e));
        }
        setUploading(false);
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle className="flex items-center gap-2"><Upload className="w-4 h-4" />{t('Upload Files')}</DialogTitle></DialogHeader>
                <div
                    className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'}`}
                    onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) upload(e.dataTransfer.files); }}
                    onClick={() => inputRef.current?.click()}
                >
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium">{t('Drop files here or click to browse')}</p>
                    <p className="text-xs text-muted-foreground mt-1">{allowedTypes}</p>
                    <input ref={inputRef} type="file" multiple hidden onChange={(e) => e.target.files && upload(e.target.files)} />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={uploading}>{t('Cancel')}</Button>
                    {uploading && <span className="text-sm text-muted-foreground self-center">{t('Uploading...')}</span>}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ── Move-to modal ─────────────────────────────────────────────────────────────

function MoveModal({
    open, onClose, file, folders, csrfToken, onMoved,
}: {
    open: boolean; onClose: () => void; file: MediaFile | null;
    folders: MediaFolder[]; csrfToken: string; onMoved: (fileId: number, folderId: number | null) => void;
}) {
    const { t } = useTranslation();
    const [target, setTarget] = useState<string>('root');
    const [saving, setSaving] = useState(false);

    useEffect(() => { setTarget(file?.folder_id ? String(file.folder_id) : 'root'); }, [file]);

    const save = async () => {
        if (!file) return;
        setSaving(true);
        const folderId = target === 'root' ? null : Number(target);
        const res = await fetch(route('api.media.moveTo', { id: file.id }), {
            method: 'PUT', credentials: 'same-origin',
            headers: { 'X-CSRF-TOKEN': csrfToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ folder_id: folderId }),
        });
        const data = await res.json();
        if (res.ok) { toast.success(data.message); onMoved(file.id, folderId); onClose(); }
        else toast.error(data.message ?? t('Failed'));
        setSaving(false);
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-sm">
                <DialogHeader><DialogTitle>{t('Move to Folder')}</DialogTitle></DialogHeader>
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" name="mv" value="root" checked={target === 'root'} onChange={() => setTarget('root')} />
                        <FolderIcon className="w-4 h-4" /> {t('Home (no folder)')}
                    </label>
                    {folders.map((f) => (
                        <label key={f.id} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="radio" name="mv" value={String(f.id)} checked={target === String(f.id)} onChange={() => setTarget(String(f.id))} />
                            <FolderIcon className="w-4 h-4" style={{ color: f.color }} fill={f.color} /> {f.name}
                        </label>
                    ))}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>{t('Cancel')}</Button>
                    <Button onClick={save} disabled={saving}>{t('Move')}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MediaLibrary() {
    const { t } = useTranslation();
    const { csrf_token, storageSettings } = usePage().props as any;
    const allowedTypes = storageSettings?.allowed_file_types ?? 'jpg,jpeg,png,webp,gif,pdf,doc,docx,zip';
    const acceptAttr = allowedTypes.split(',').map((x: string) => `.${x.trim()}`).join(',');

    const [folders, setFolders] = useState<MediaFolder[]>([]);
    const [files, setFiles] = useState<MediaFile[]>([]);
    const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);

    // Modal state
    const [folderModal, setFolderModal] = useState<{ open: boolean; editing: MediaFolder | null }>({ open: false, editing: null });
    const [uploadOpen, setUploadOpen] = useState(false);
    const [lockModal, setLockModal] = useState<{ open: boolean; type: 'folder' | 'file'; item: MediaFolder | MediaFile | null }>({ open: false, type: 'folder', item: null });
    const [moveModal, setMoveModal] = useState<{ open: boolean; file: MediaFile | null }>({ open: false, file: null });
    const [deleteTarget, setDeleteTarget] = useState<{ type: 'folder' | 'file'; id: number; name: string } | null>(null);

    // Derived
    const currentFolders = folders.filter((f) => f.parent_id === currentFolderId);
    const breadcrumbs = buildBreadcrumbs(folders, currentFolderId);
    const filteredFiles = files.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()) || f.file_name.toLowerCase().includes(search.toLowerCase()));

    // ── Data fetching ───────────────────────────────────────────────────────

    const fetchFolders = useCallback(async () => {
        const res = await fetch(route('api.media.folders.index'), { credentials: 'same-origin', headers: { Accept: 'application/json' } });
        if (res.ok) setFolders(await res.json());
    }, []);

    const fetchFiles = useCallback(async (folderId: number | null) => {
        setLoading(true);
        const url = folderId !== null
            ? `${route('api.media.index')}?folder_id=${folderId}`
            : `${route('api.media.index')}?folder_id=0`;
        const res = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
        if (res.ok) setFiles(await res.json());
        setLoading(false);
    }, []);

    useEffect(() => { fetchFolders(); }, [fetchFolders]);
    useEffect(() => { fetchFiles(currentFolderId); }, [currentFolderId, fetchFiles]);

    const navigate = (id: number | null) => { setCurrentFolderId(id); setSearch(''); };

    // ── Folder actions ──────────────────────────────────────────────────────

    const onFolderSaved = (folder: MediaFolder) => {
        setFolders((prev) => {
            const idx = prev.findIndex((f) => f.id === folder.id);
            return idx >= 0 ? prev.map((f) => (f.id === folder.id ? folder : f)) : [...prev, folder];
        });
    };

    const deleteFolder = async (id: number) => {
        const res = await fetch(route('api.media.folders.destroy', { id }), {
            method: 'DELETE', credentials: 'same-origin',
            headers: { 'X-CSRF-TOKEN': csrf_token, 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        if (res.ok) {
            toast.success(data.message);
            setFolders((prev) => prev.filter((f) => f.id !== id));
            if (currentFolderId === id) navigate(null);
        } else {
            toast.error(data.message);
        }
        setDeleteTarget(null);
    };

    // ── File actions ────────────────────────────────────────────────────────

    const deleteFile = async (id: number, mediaId: number) => {
        const res = await fetch(route('api.media.destroy', mediaId), {
            method: 'DELETE', credentials: 'same-origin',
            headers: { 'X-CSRF-TOKEN': csrf_token },
        });
        const data = await res.json();
        if (res.ok) {
            toast.success(data.message);
            setFiles((prev) => prev.filter((f) => f.id !== id));
        } else {
            toast.error(data.message);
        }
        setDeleteTarget(null);
    };

    const downloadFile = (file: MediaFile) => {
        window.open(route('api.media.download', file.media_id), '_blank');
    };

    const onFileMoved = (fileId: number, folderId: number | null) => {
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
    };

    const onLockUpdated = () => {
        fetchFolders();
        fetchFiles(currentFolderId);
    };

    // ── Render ──────────────────────────────────────────────────────────────

    return (
        <PageTemplate title={t('Media Library')} noPadding>
            <div className="flex h-[calc(100vh-8rem)] overflow-hidden">

                {/* ── Sidebar ── */}
                <aside className="w-56 shrink-0 border-r overflow-y-auto p-2 bg-muted/20">
                    <button
                        className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm w-full hover:bg-muted/60 ${currentFolderId === null ? 'bg-muted font-medium' : ''}`}
                        onClick={() => navigate(null)}
                    >
                        <FolderOpen className="w-4 h-4 text-primary" />
                        {t('All Files')}
                    </button>
                    <div className="mt-1">
                        {folders.filter((f) => f.parent_id === null).map((f) => (
                            <FolderTreeItem key={f.id} folder={f} allFolders={folders} currentId={currentFolderId} depth={0} onNavigate={navigate} />
                        ))}
                    </div>
                </aside>

                {/* ── Main area ── */}
                <div className="flex-1 flex flex-col overflow-hidden">

                    {/* Toolbar */}
                    <div className="flex items-center gap-2 border-b px-4 py-2 shrink-0">
                        {/* Breadcrumbs */}
                        <nav className="flex items-center gap-1 text-sm flex-1 min-w-0">
                            {breadcrumbs.map((crumb, i) => (
                                <React.Fragment key={String(crumb.id)}>
                                    {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                                    <button
                                        className={`truncate hover:text-primary ${i === breadcrumbs.length - 1 ? 'font-medium' : 'text-muted-foreground'}`}
                                        onClick={() => navigate(crumb.id)}
                                    >
                                        {crumb.name}
                                    </button>
                                </React.Fragment>
                            ))}
                        </nav>

                        <div className="flex items-center gap-1.5 shrink-0">
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                <Input className="pl-7 h-7 w-40 text-xs" placeholder={t('Search...')} value={search} onChange={(e) => setSearch(e.target.value)} />
                            </div>
                            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setFolderModal({ open: true, editing: null })}>
                                <FolderPlus className="w-3.5 h-3.5 mr-1" />{t('New Folder')}
                            </Button>
                            <Button size="sm" className="h-7 px-2" onClick={() => setUploadOpen(true)}>
                                <Upload className="w-3.5 h-3.5 mr-1" />{t('Upload')}
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}>
                                {viewMode === 'grid' ? <List className="w-3.5 h-3.5" /> : <Grid3X3 className="w-3.5 h-3.5" />}
                            </Button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-4">
                        {loading ? (
                            <div className="text-center py-20 text-muted-foreground text-sm">{t('Loading...')}</div>
                        ) : (
                            <>
                                {/* Folder grid */}
                                {currentFolders.length > 0 && (
                                    <div className={`mb-4 ${viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3' : 'space-y-1'}`}>
                                        {currentFolders.map((folder) => (
                                            <FolderCard
                                                key={folder.id}
                                                folder={folder}
                                                viewMode={viewMode}
                                                onOpen={() => navigate(folder.id)}
                                                onRename={() => setFolderModal({ open: true, editing: folder })}
                                                onLock={() => setLockModal({ open: true, type: 'folder', item: folder })}
                                                onDelete={() => setDeleteTarget({ type: 'folder', id: folder.id, name: folder.name })}
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* Separator */}
                                {currentFolders.length > 0 && filteredFiles.length > 0 && (
                                    <p className="text-xs text-muted-foreground mb-2 font-medium">{t('Files')}</p>
                                )}

                                {/* File grid */}
                                {filteredFiles.length > 0 ? (
                                    <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3' : 'space-y-1'}>
                                        {filteredFiles.map((file) => (
                                            <FileCard
                                                key={file.id}
                                                file={file}
                                                viewMode={viewMode}
                                                onView={() => window.open(file.url, '_blank')}
                                                onDownload={() => downloadFile(file)}
                                                onLock={() => setLockModal({ open: true, type: 'file', item: file })}
                                                onMove={() => setMoveModal({ open: true, file })}
                                                onDelete={() => setDeleteTarget({ type: 'file', id: file.id, name: file.name })}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    currentFolders.length === 0 && (
                                        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-2">
                                            <FolderOpen className="w-12 h-12 opacity-30" />
                                            <p className="text-sm">{search ? t('No results for "{{q}}"', { q: search }) : t('This folder is empty')}</p>
                                            <Button size="sm" variant="outline" onClick={() => setUploadOpen(true)}><Upload className="w-3.5 h-3.5 mr-1" />{t('Upload Files')}</Button>
                                        </div>
                                    )
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Modals ── */}
            <FolderFormModal
                open={folderModal.open}
                editing={folderModal.editing}
                parentId={currentFolderId}
                csrfToken={csrf_token}
                onClose={() => setFolderModal({ open: false, editing: null })}
                onSaved={onFolderSaved}
            />
            <UploadModal
                open={uploadOpen}
                folderId={currentFolderId}
                csrfToken={csrf_token}
                allowedTypes={allowedTypes}
                onClose={() => setUploadOpen(false)}
                onUploaded={(newFiles) => setFiles((prev) => [...newFiles, ...prev])}
            />
            <LockAccessModal
                open={lockModal.open}
                type={lockModal.type}
                item={lockModal.item}
                csrfToken={csrf_token}
                onClose={() => setLockModal({ ...lockModal, open: false })}
                onUpdated={onLockUpdated}
            />
            <MoveModal
                open={moveModal.open}
                file={moveModal.file}
                folders={folders}
                csrfToken={csrf_token}
                onClose={() => setMoveModal({ open: false, file: null })}
                onMoved={onFileMoved}
            />

            {/* Delete confirmation */}
            <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>{t('Delete')} {deleteTarget?.name}?</DialogTitle></DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        {deleteTarget?.type === 'folder' ? t('The folder will be deleted. Files inside will be moved to the root.') : t('This file will be permanently deleted.')}
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>{t('Cancel')}</Button>
                        <Button variant="destructive" onClick={() => {
                            if (!deleteTarget) return;
                            if (deleteTarget.type === 'folder') deleteFolder(deleteTarget.id);
                            else {
                                const f = files.find((x) => x.id === deleteTarget.id);
                                if (f) deleteFile(f.id, f.media_id);
                            }
                        }}>{t('Delete')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </PageTemplate>
    );
}

// ── Folder card ───────────────────────────────────────────────────────────────

function FolderCard({ folder, viewMode, onOpen, onRename, onLock, onDelete }: {
    folder: MediaFolder; viewMode: 'grid' | 'list';
    onOpen: () => void; onRename: () => void; onLock: () => void; onDelete: () => void;
}) {
    const { t } = useTranslation();
    const menu = (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button className="p-0.5 rounded hover:bg-muted" onClick={(e) => e.stopPropagation()}>
                    <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename(); }}>{t('Rename')}</DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onLock(); }}>
                    {folder.is_locked ? <><LockOpen className="w-3.5 h-3.5 mr-2" />{t('Lock & Access')}</> : <><Lock className="w-3.5 h-3.5 mr-2" />{t('Lock & Access')}</>}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }}><Trash2 className="w-3.5 h-3.5 mr-2" />{t('Delete')}</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );

    if (viewMode === 'list') {
        return (
            <div className="flex items-center gap-3 px-3 py-2 rounded hover:bg-muted/50 cursor-pointer group" onDoubleClick={onOpen} onClick={onOpen}>
                <FolderIcon className="w-5 h-5 shrink-0" style={{ color: folder.color }} fill={folder.color} />
                <span className="flex-1 text-sm truncate">{folder.name}</span>
                <span className="text-xs text-muted-foreground">{folder.items_count} {t('items')}</span>
                {folder.is_locked && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
                <span className="opacity-0 group-hover:opacity-100">{menu}</span>
            </div>
        );
    }

    return (
        <div className="group relative flex flex-col items-center gap-1.5 rounded-lg border p-3 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors" onDoubleClick={onOpen} onClick={onOpen}>
            <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
                {folder.is_locked && <Lock className="w-3 h-3 text-amber-500" />}
                {menu}
            </div>
            <FolderIcon className="w-10 h-10" style={{ color: folder.color }} fill={folder.color} />
            <p className="text-xs font-medium text-center truncate w-full">{folder.name}</p>
            <p className="text-xs text-muted-foreground">{folder.items_count} {t('items')}</p>
        </div>
    );
}

// ── File card ─────────────────────────────────────────────────────────────────

function FileCard({ file, viewMode, onView, onDownload, onLock, onMove, onDelete }: {
    file: MediaFile; viewMode: 'grid' | 'list';
    onView: () => void; onDownload: () => void; onLock: () => void; onMove: () => void; onDelete: () => void;
}) {
    const { t } = useTranslation();
    const isImage = file.mime_type?.startsWith('image/');
    const hasThumb = !!file.thumb_url;

    const menu = (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button className="p-0.5 rounded hover:bg-muted" onClick={(e) => e.stopPropagation()}>
                    <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(); }}><Eye className="w-3.5 h-3.5 mr-2" />{t('View')}</DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDownload(); }}><Download className="w-3.5 h-3.5 mr-2" />{t('Download')}</DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onLock(); }}>
                    <Lock className="w-3.5 h-3.5 mr-2" />{t('Lock & Access')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMove(); }}>
                    <FolderIcon className="w-3.5 h-3.5 mr-2" />{t('Move to...')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }}><Trash2 className="w-3.5 h-3.5 mr-2" />{t('Delete')}</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );

    if (viewMode === 'list') {
        return (
            <div className="flex items-center gap-3 px-3 py-2 rounded hover:bg-muted/50 group cursor-pointer" onClick={onView}>
                <FileIcon mimeType={file.mime_type} className="w-4 h-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 text-sm truncate">{file.name}</span>
                <span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
                {file.is_locked && <Lock className="w-3.5 h-3.5 text-amber-500" />}
                <span className="opacity-0 group-hover:opacity-100">{menu}</span>
            </div>
        );
    }

    return (
        <div className="group relative flex flex-col rounded-lg border overflow-hidden hover:border-primary/50 transition-colors cursor-pointer" onClick={onView}>
            <div className="relative bg-muted h-24 flex items-center justify-center overflow-hidden">
                {hasThumb ? (
                    <img src={file.thumb_url} alt={file.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                    <FileIcon mimeType={file.mime_type} className="w-10 h-10 text-muted-foreground/50" />
                )}
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex gap-0.5">
                    {file.is_locked && <Lock className="w-3 h-3 text-amber-500" />}
                    {menu}
                </div>
            </div>
            <div className="p-2">
                <p className="text-xs font-medium truncate" title={file.name}>{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
            </div>
        </div>
    );
}
