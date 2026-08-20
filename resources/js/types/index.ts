import { LucideIcon } from 'lucide-react';

export interface SharedData {
    auth: {
        user: {
            id: number;
            name: string;
            email: string;
        } | null;
    };
}

export interface NavItem {
    title: string;
    href?: string;
    icon?: LucideIcon;
    permission?: string;
    children?: NavItem[];
    target?: string;
    defaultOpen?: boolean;
    group?: string;
    badge?: {
        label: string;
        variant?: string;
    };
}

export interface BreadcrumbItem {
    title: string;
    href?: string;
}

export interface PageAction {
    label: string;
    icon: React.ReactNode;
    variant: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
    onClick: () => void;
}

export interface TaskStage {
    id: number;
    workspace_id: number;
    name: string;
    color: string;
    order: number;
    is_default: boolean;
    tasks_count: number;
    tasks?: Task[];
    created_at: string;
    updated_at: string;
}

export interface User {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    created_at: string;
    updated_at: string;
}

export interface Task {
    id: number;
    project_id: number;
    task_stage_id: number;
    milestone_id?: number;
    title: string;
    description?: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    start_date?: string;
    end_date?: string;
    assigned_to?: number;
    created_by: number;
    progress: number;
    is_googlecalendar_sync?: boolean;
    created_at: string;
    updated_at: string;
    project?: {
        workspace?: {
            owner_id: number;
        };
    };
}

export interface TaskComment {
    id: number;
    task_id: number;
    user_id: number;
    comment: string;
    mentions?: any[];
    created_at: string;
    updated_at: string;
    user?: User;
    can_update?: boolean;
    can_delete?: boolean;
}

export interface TaskChecklist {
    id: number;
    task_id: number;
    title: string;
    is_completed: boolean;
    order: number;
    assigned_to?: User;
    due_date?: string;
    created_at: string;
    updated_at: string;
    can_update?: boolean;
    can_delete?: boolean;
}

export interface Project {
    id: number;
    workspace_id: number;
    title: string;
    description?: string;
    status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    start_date?: string;
    deadline?: string;
    progress: number;
    created_by: number;
    created_at: string;
    updated_at: string;
}

export interface ZoomMeeting {
    id: number;
    zoom_meeting_id?: string;
    title: string;
    description?: string;
    start_time: string;
    end_time: string;
    timezone: string;
    duration: number;
    join_url?: string;
    start_url?: string;
    password?: string;
    attendees?: string[];
    status: 'scheduled' | 'started' | 'ended' | 'cancelled';
    type: 'instant' | 'scheduled' | 'recurring';
    user_id: number;
    workspace_id: number;
    project_id?: number;
    member_ids?: number[];
    zoom_settings?: any;
    sync_google_calendar?: boolean;
    created_at: string;
    updated_at: string;
    user?: User;
    project?: Project;
    workspace?: {
        id: number;
        name: string;
    };
    is_live?: boolean;
    members?: User[];
    is_googlecalendar_sync?: boolean;
}

export interface GoogleMeeting {
    id: number;
    google_meeting_id?: string;
    title: string;
    description?: string;
    start_time: string;
    end_time: string;
    timezone: string;
    duration: number;
    meet_url?: string;
    attendees?: string[];
    status: 'scheduled' | 'started' | 'ended' | 'cancelled';
    type: 'instant' | 'scheduled' | 'recurring';
    user_id: number;
    workspace_id: number;
    project_id?: number;
    member_ids?: number[];
    google_settings?: any;
    is_googlecalendar_sync?: boolean;
    google_calendar_event_id?: string;
    created_at: string;
    updated_at: string;
    user?: User;
    project?: Project;
    workspace?: {
        id: number;
        name: string;
    };
    members?: User[];
    is_live?: boolean;
}