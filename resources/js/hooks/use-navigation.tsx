import { useMemo } from 'react';
import { usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { route } from 'ziggy-js';
import { hasPermission } from '@/utils/authorization';
import { type NavItem } from '@/types';
import {
    Activity,
    BarChart,
    Bell,
    Bot,
    Boxes,
    Building2,
    Calendar,
    CheckSquare,
    ClipboardList,
    Clock,
    CreditCard,
    DollarSign,
    FileIcon,
    FileText,
    FolderOpen,
    Gift,
    Globe,
    HelpCircle,
    Home,
    Image,
    Landmark,
    LayoutGrid,
    ListTodo,
    Mail,
    Receipt,
    Search,
    Settings,
    ShieldCheck,
    ShoppingCart,
    Ticket,
    TrendingUp,
    Users,
    Video,
} from 'lucide-react';

export function useNavigation() {
    const { t, i18n } = useTranslation();
    const { auth, isSaasMode, globalSettings, erpContext } = usePage().props as any;
    const permissions = auth?.permissions || [];
    const erpPermissions: string[] = erpContext?.permissions || [];
    const canUseErp = (permission: string) => erpPermissions.includes('*') || erpPermissions.includes(permission);
    const isSuperAdmin = auth?.user?.type === 'superadmin';

    // Check if current language is RTL
    const currentLang = i18n.language;
    const isRTL = ['ar', 'he'].includes(currentLang);

    const navItems = useMemo((): NavItem[] => {
        // ─── SaaS Super Admin ────────────────────────────────────────────────────
        const getSuperAdminNavItems = (): NavItem[] => {
            const items: NavItem[] = [];

            // Overview
            if (hasPermission(permissions, 'dashboard_view')) {
                items.push({ title: t('Dashboard'), href: route('dashboard'), icon: LayoutGrid, group: t('Overview') });
            }

            // Management
            if (hasPermission(permissions, 'company_view_any')) {
                items.push({ title: t('Companies'), href: route('companies.index'), icon: Building2, group: t('Management') });
            }
            if (hasPermission(permissions, 'media_view_any')) {
                items.push({ title: t('Media Library'), href: route('media-library'), icon: Image, group: t('Management') });
            }
            if (
                hasPermission(permissions, 'plan_view_any') ||
                hasPermission(permissions, 'plan_manage_requests') ||
                hasPermission(permissions, 'plan_manage_orders')
            ) {
                const planChildren = [];
                if (hasPermission(permissions, 'plan_view_any')) planChildren.push({ title: t('Plan'), href: route('plans.index') });
                if (hasPermission(permissions, 'plan_manage_requests'))
                    planChildren.push({ title: t('Plan Requests'), href: route('plan-requests.index') });
                if (hasPermission(permissions, 'plan_manage_orders')) planChildren.push({ title: t('Plan Orders'), href: route('plan-orders.index') });
                items.push({ title: t('Plans'), icon: CreditCard, group: t('Management'), children: planChildren });
            }
            if (hasPermission(permissions, 'coupon_view_any')) {
                items.push({ title: t('Coupons'), href: route('coupons.index'), icon: Ticket, group: t('Management') });
            }
            if (hasPermission(permissions, 'currency_view_any')) {
                items.push({ title: t('Currency'), href: route('currencies.index'), icon: DollarSign, group: t('Management') });
            }
            if (hasPermission(permissions, 'referral_view_any')) {
                items.push({ title: t('Referral Program'), href: route('referral.index'), icon: Gift, group: t('Management') });
            }
            const landingChildren = [];
            if (hasPermission(permissions, 'landing_page_manage')) landingChildren.push({ title: t('Landing Page'), href: route('landing-page') });
            if (hasPermission(permissions, 'custom_page_view_any'))
                landingChildren.push({ title: t('Custom Pages'), href: route('landing-page.custom-pages.index') });
            if (hasPermission(permissions, 'contact_view_any')) landingChildren.push({ title: t('Contact Inquiries'), href: route('contacts.index') });
            if (hasPermission(permissions, 'newsletter_view_any')) landingChildren.push({ title: t('Newsletter'), href: route('newsletters.index') });
            if (landingChildren.length > 0) {
                items.push({ title: t('Landing Page'), icon: Globe, group: t('Management'), children: landingChildren });
            }

            // System Control
            if (hasPermission(permissions, 'settings_view')) {
                items.push({ title: t('Settings'), href: route('settings'), icon: Settings, group: t('System Control') });
            }

            return items;
        };

        // ─── Common items (SaaS + Non-SaaS) ──────────────────────────────────────
        const buildCommonNavItems = (): NavItem[] => {
            const items: NavItem[] = [];

            if (erpContext?.companies?.length > 0 || hasPermission(permissions, 'erp.company.access')) {
                const active = Boolean(erpContext?.activeCompany);
                items.push({
                    title: t('ERP'),
                    href: active ? route('erp.dashboard') : route('erp.companies.index'),
                    icon: Building2,
                    group: t('Overview'),
                });
            }

            // Overview
            if (hasPermission(permissions, 'dashboard_view')) {
                items.push({ title: t('Dashboard'), href: route('dashboard'), icon: LayoutGrid, group: t('Overview') });
            }
            if (hasPermission(permissions, 'task_calendar_view')) {
                items.push({ title: t('Calendar'), href: route('task-calendar.index'), icon: Calendar, group: t('Overview') });
            }

            // Project Management
            if (hasPermission(permissions, 'workspace_view_any')) {
                items.push({ title: t('Workspaces'), href: route('workspaces.index'), icon: Building2, group: t('Project Management') });
            }
            if (hasPermission(permissions, 'project_view_any')) {
                items.push({ title: t('Projects'), href: route('projects.index'), icon: FolderOpen, group: t('Project Management') });
            }
            if (hasPermission(permissions, 'task_view_any')) {
                const taskChildren = [{ title: t('All Tasks'), href: route('tasks.index') }];
                if (hasPermission(permissions, 'task_manage_stages')) taskChildren.push({ title: t('Task Stages'), href: route('task-stages.index') });
                items.push({ title: t('Tasks'), icon: CheckSquare, group: t('Project Management'), children: taskChildren });
            }

            if (hasPermission(permissions, 'todo_view_any')) {
                items.push({ title: t('ToDos'), href: route('todos.index'), icon: ListTodo, group: t('Project Management') });
            }

            if (hasPermission(permissions, 'project_report_view_any')) {
                items.push({ title: t('Project Reports'), href: route('project-reports.index'), icon: TrendingUp, group: t('Project Management') });
                items.push({ title: t('Milestone Report'), href: route('project-reports.milestone'), icon: BarChart, group: t('Project Management') });
            }

            if (hasPermission(permissions, 'task_view_any')) {
                items.push({ title: t('Team Workload'), href: route('workload.index'), icon: Activity, group: t('Project Management') });
            }

            // Time Tracking
            if (hasPermission(permissions, 'timesheet_view_any')) {
                const timesheetChildren = [
                    { title: t('My Timesheets'), href: route('timesheets.index') },
                    { title: t('Calendar View'), href: route('timesheets.calendar-view') },
                    { title: t('Daily View'), href: route('timesheets.daily-view') },
                    { title: t('Weekly View'), href: route('timesheets.weekly-view') },
                    { title: t('Monthly View'), href: route('timesheets.monthly-view') },
                ];
                if (hasPermission(permissions, 'timesheet_approve'))
                    timesheetChildren.push({ title: t('Approvals'), href: route('timesheet-approvals.index') });
                if (hasPermission(permissions, 'timesheet_generate_reports'))
                    timesheetChildren.push({ title: t('Reports'), href: route('timesheet-reports.index') });
                items.push({ title: t('Timesheets'), icon: Clock, group: t('Time Tracking'), children: timesheetChildren });
            }

            // Finance
            if (hasPermission(permissions, 'invoice_view_any')) {
                items.push({ title: t('Invoices'), href: route('invoices.index'), icon: FileText, group: t('Finance') });
            }
            if (hasPermission(permissions, 'budget_view_any') || hasPermission(permissions, 'expense_view_any')) {
                const budgetChildren = [];
                if (hasPermission(permissions, 'budget_dashboard_view'))
                    budgetChildren.push({ title: t('Budget Dashboard'), href: route('budgets.dashboard') });
                if (hasPermission(permissions, 'budget_view_any')) budgetChildren.push({ title: t('Budgets'), href: route('budgets.index') });
                if (hasPermission(permissions, 'expense_view_any')) budgetChildren.push({ title: t('Expenses'), href: route('expenses.index') });
                if (hasPermission(permissions, 'expense_approval_approve'))
                    budgetChildren.push({ title: t('Expense Approvals'), href: route('expense-approvals.index') });
                items.push({
                    title: t('Budget & Expenses'),
                    icon: Receipt,
                    group: t('Finance'),
                    children: budgetChildren.length > 0 ? budgetChildren : undefined,
                });
            }

            // Communications & Content
            if (hasPermission(permissions, 'note_view_any')) {
                items.push({ title: t('Notes'), href: route('notes.index'), icon: FileIcon, group: t('Communications & Content') });
            }
            if (hasPermission(permissions, 'zoom_meeting_view_any') && globalSettings?.is_zoom_meeting_test === '1') {
                items.push({ title: t('Zoom Meetings'), href: route('zoom-meetings.index'), icon: Video, group: t('Communications & Content') });
            }
            if (hasPermission(permissions, 'google_meeting_view_any') && globalSettings?.is_google_meeting_test === '1') {
                items.push({ title: t('Google Meetings'), href: route('google-meetings.index'), icon: Video, group: t('Communications & Content') });
            }
            if (hasPermission(permissions, 'contract_view_any') || hasPermission(permissions, 'contract_type_view_any')) {
                const contractChildren = [];
                if (hasPermission(permissions, 'contract_view_any')) contractChildren.push({ title: t('Contracts'), href: route('contracts.index') });
                if (hasPermission(permissions, 'contract_type_view_any'))
                    contractChildren.push({ title: t('Contract Types'), href: route('contract-types.index') });
                items.push({
                    title: t('Contracts'),
                    icon: FileText,
                    group: t('Communications & Content'),
                    children: contractChildren.length > 1 ? contractChildren : undefined,
                    href: contractChildren.length === 1 ? contractChildren[0].href : undefined,
                });
            }
            if (hasPermission(permissions, 'media_view_any')) {
                items.push({ title: t('Media Library'), href: route('media-library'), icon: Image, group: t('Communications & Content') });
            }
            // Mzitshwa AI assistant — always visible for logged-in users
            items.push({ title: t('Mzitshwa AI'), href: '#mzitshwa', icon: Bot, group: t('Communications & Content') });

            // ICT Ticketing System
            items.push({ title: t('Group Issue Reporting'), href: route('ict-tickets.index'), icon: HelpCircle, group: t('ICT Support') });

            return items;
        };

        // ─── SaaS Company User ───────────────────────────────────────────────────
        const getSaasNavItems = (): NavItem[] => {
            const items = buildCommonNavItems();

            // Subscription & Billing
            const planChildren = [];
            if (hasPermission(permissions, 'plan_view_any')) planChildren.push({ title: t('Plans'), href: route('plans.index') });
            if (hasPermission(permissions, 'plan_view_my_requests'))
                planChildren.push({ title: t('My Plan Requests'), href: route('my-plan-requests.index') });
            if (hasPermission(permissions, 'plan_view_my_orders')) planChildren.push({ title: t('My Plan Orders'), href: route('my-plan-orders.index') });
            if (planChildren.length > 0) {
                items.push({
                    title: t('Plans'),
                    icon: CreditCard,
                    group: t('Subscription & Billing'),
                    children: planChildren.length > 1 ? planChildren : undefined,
                    href: planChildren.length === 1 ? planChildren[0].href : undefined,
                });
            }

            // Growth
            if (hasPermission(permissions, 'referral_view_any')) {
                items.push({ title: t('Referral Program'), href: route('referral.index'), icon: Gift, group: t('Growth') });
            }

            // System Control
            if (hasPermission(permissions, 'notification_template_view_any')) {
                items.push({ title: t('Notification Templates'), href: route('notification-templates.index'), icon: Bell, group: t('System Control') });
            }
            if (hasPermission(permissions, 'settings_view')) {
                items.push({ title: t('Settings'), href: route('settings'), icon: Settings, group: t('System Control') });
            }

            return items;
        };

        // ─── Non-SaaS ────────────────────────────────────────────────────────────
        const getNonSaasNavItems = (): NavItem[] => {
            const items = buildCommonNavItems();

            // Website & Marketing
            const landingChildren = [];
            if (hasPermission(permissions, 'landing_page_manage')) landingChildren.push({ title: t('Landing Page'), href: route('landing-page') });
            if (hasPermission(permissions, 'custom_page_view_any'))
                landingChildren.push({ title: t('Custom Pages'), href: route('landing-page.custom-pages.index') });
            if (hasPermission(permissions, 'newsletter_view_any')) landingChildren.push({ title: t('Newsletters'), href: route('newsletters.index') });
            if (hasPermission(permissions, 'contact_view_any')) landingChildren.push({ title: t('Contact Inquiries'), href: route('contacts.index') });
            if (landingChildren.length > 0) {
                items.push({ title: t('Landing Page'), icon: Globe, group: t('Website & Marketing'), children: landingChildren });
            }

            // System Control
            if (hasPermission(permissions, 'currency_view_any')) {
                items.push({ title: t('Currency'), href: route('currencies.index'), icon: DollarSign, group: t('System Control') });
            }
            if (hasPermission(permissions, 'email_template_view_any')) {
                items.push({ title: t('Email Templates'), href: route('email-templates.index'), icon: Mail, group: t('System Control') });
            }
            if (hasPermission(permissions, 'notification_template_view_any')) {
                items.push({ title: t('Notification Templates'), href: route('notification-templates.index'), icon: Bell, group: t('System Control') });
            }
            if (hasPermission(permissions, 'settings_view')) {
                items.push({ title: t('Settings'), href: route('settings'), icon: Settings, group: t('System Control') });
            }

            return items;
        };

        // ─── ERP ─────────────────────────────────────────────────────────────────
        const getErpNavItems = (): NavItem[] => {
            const items: NavItem[] = [];
            if (canUseErp('erp.dashboard.view')) {
                items.push({ title: t('ERP Home'), href: route('erp.dashboard'), icon: Home, group: t('Overview') });
            }

            if (canUseErp('erp.project_management.view')) {
                const projectItems: NavItem[] = [];
                if (hasPermission(permissions, 'dashboard_view')) {
                    projectItems.push({ title: t('Project Dashboard'), href: route('dashboard') });
                }
                if (hasPermission(permissions, 'workspace_view_any')) {
                    projectItems.push({ title: t('Workspaces'), href: route('workspaces.index') });
                }
                if (hasPermission(permissions, 'project_view_any')) {
                    projectItems.push({ title: t('Projects'), href: route('projects.index') });
                }
                if (hasPermission(permissions, 'task_view_any')) {
                    projectItems.push({ title: t('Tasks'), href: route('tasks.index') });
                }
                if (hasPermission(permissions, 'task_calendar_view')) {
                    projectItems.push({ title: t('Calendar'), href: route('task-calendar.index') });
                }
                if (hasPermission(permissions, 'todo_view_any')) {
                    projectItems.push({ title: t('ToDos'), href: route('todos.index') });
                }
                if (hasPermission(permissions, 'project_report_view_any')) {
                    projectItems.push({ title: t('Project Reports'), href: route('project-reports.index') });
                    projectItems.push({ title: t('Milestone Report'), href: route('project-reports.milestone') });
                }
                if (hasPermission(permissions, 'task_view_any')) {
                    projectItems.push({ title: t('Team Workload'), href: route('workload.index') });
                }
                if (hasPermission(permissions, 'timesheet_view_any')) {
                    projectItems.push({ title: t('Timesheets'), href: route('timesheets.index') });
                }
                if (projectItems.length > 0) {
                    items.push({ title: t('Project Management'), icon: FolderOpen, group: t('Modules'), children: projectItems });
                }
            }

            if (canUseErp('erp.requisitions.view')) {
                items.push({ title: t('Requisitions & Approvals'), href: route('erp.requisitions.index'), icon: ClipboardList, group: t('Modules') });
            }
            if (canUseErp('erp.inventory.view')) {
                items.push({
                    title: t('Inventory'),
                    icon: Boxes,
                    group: t('Modules'),
                    children: [
                        { title: t('Products & Locations'), href: route('erp.inventory.setup') },
                        { title: t('Stock on Hand & Movements'), href: route('erp.inventory.stock.index') },
                    ],
                });
            }
            if (canUseErp('erp.purchase.view')) {
                items.push({ title: t('Procurement'), href: route('erp.purchase.index'), icon: ShoppingCart, group: t('Modules') });
            }
            if (canUseErp('erp.accounting.view')) {
                items.push({ title: t('Finance & Accounting'), href: route('erp.accounting.index'), icon: Landmark, group: t('Modules') });
            }
            if (canUseErp('erp.approvals.view')) {
                items.push({ title: t('My Approvals'), href: route('erp.approvals.index'), icon: ShieldCheck, group: t('Modules') });
            }

            if (canUseErp('erp.companies.manage')) {
                items.push({ title: t('Company'), href: route('erp.companies.index'), icon: Building2, group: t('Company Settings') });
            }
            if (canUseErp('erp.members.manage')) {
                items.push({ title: t('Members'), href: route('erp.companies.members.index'), icon: Users, group: t('Company Settings') });
            }
            if (canUseErp('erp.roles.manage')) {
                items.push({ title: t('Roles & Permissions'), href: route('erp.settings.roles.index'), icon: ShieldCheck, group: t('Company Settings') });
            }
            if (canUseErp('erp.settings.view')) {
                const settings = [
                    { title: t('Company Branding'), href: route('erp.settings.branding.edit') },
                    { title: t('Exchange Rates'), href: route('erp.settings.exchange-rates.index') },
                    { title: t('Signatories'), href: route('erp.settings.signatories.index') },
                ];
                if (canUseErp('erp.approvals.manage')) {
                    settings.push({ title: t('Approval Workflows'), href: route('erp.approvals.workflows.index') });
                }
                items.push({ title: t('Settings'), icon: Settings, group: t('Company Settings'), children: settings });
            }
            return items;
        };

        // Determine which nav items to return based on context
        if (erpContext?.activeCompany) return getErpNavItems();
        if (isSaasMode && isSuperAdmin) return getSuperAdminNavItems();
        if (isSaasMode) return getSaasNavItems();
        return getNonSaasNavItems();
    }, [auth, isSaasMode, globalSettings, erpContext, permissions, t, i18n.language]);

    return { navItems, isRTL };
}