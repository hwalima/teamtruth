import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { useLayout } from '@/contexts/LayoutContext';
import { useSidebarSettings } from '@/contexts/SidebarContext';
import { useBrand } from '@/contexts/BrandContext';
import { MzitshwaPanel } from '@/components/Mzitshwa';

import { type NavItem } from '@/types';
import { Link, usePage, router } from '@inertiajs/react';
import { BookOpen, Contact, Folder, LayoutGrid, ShoppingBag, Users, Tag, FileIcon, Settings, BarChart, Barcode, FileText, Briefcase, CheckSquare, Calendar, CreditCard, Nfc, Ticket, Gift, DollarSign, MessageSquare, CalendarDays, Palette, Image, Mail, Mail as VCard, ChevronDown, Building2, Globe, FolderOpen, Clock, Bug, Receipt, TrendingUp, Bot, Video, Bell, HelpCircle, Workflow, Activity, Archive, ListTodo, Search, X } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import AppLogo from './app-logo';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { hasPermission } from '@/utils/authorization';



export function AppSidebar() {
    const { t, i18n } = useTranslation();
    const { auth, isSaasMode, globalSettings } = usePage().props as any;
    const permissions = auth?.permissions || [];
    const [currentLang, setCurrentLang] = useState(i18n.language);
    const [forceUpdate, setForceUpdate] = useState(0);
    const [isDarkTheme, setIsDarkTheme] = useState(() => document.documentElement.classList.contains('dark'));
    const [mzitshwaOpen, setMzitshwaOpen] = useState(false);

    // Listen for language changes to force re-render
    useEffect(() => {
        const handleLanguageChange = (event: CustomEvent) => {
            setCurrentLang(event.detail.languageCode);
        };
        
        const handleLayoutDirectionChange = (event: CustomEvent) => {
            setForceUpdate(prev => prev + 1);
        };
        
        // Listen for theme changes
        const handleThemeChange = () => {
            setIsDarkTheme(document.documentElement.classList.contains('dark'));
        };
        
        // Create a MutationObserver to watch for class changes on html element
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    handleThemeChange();
                }
            });
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        window.addEventListener('languageChanged', handleLanguageChange as EventListener);
        window.addEventListener('layoutDirectionChanged', handleLayoutDirectionChange as EventListener);
        return () => {
            observer.disconnect();
            window.removeEventListener('languageChanged', handleLanguageChange as EventListener);
            window.removeEventListener('layoutDirectionChanged', handleLayoutDirectionChange as EventListener);
        };
    }, []);

    // Check if current language is RTL
    const isRTL = ['ar', 'he'].includes(currentLang);
    const isSuperAdmin = auth?.user?.type === 'superadmin';

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
        if (hasPermission(permissions, 'plan_view_any') || hasPermission(permissions, 'plan_manage_requests') || hasPermission(permissions, 'plan_manage_orders')) {
            const planChildren = [];
            if (hasPermission(permissions, 'plan_view_any')) planChildren.push({ title: t('Plan'), href: route('plans.index') });
            if (hasPermission(permissions, 'plan_manage_requests')) planChildren.push({ title: t('Plan Requests'), href: route('plan-requests.index') });
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
        if (hasPermission(permissions, 'custom_page_view_any')) landingChildren.push({ title: t('Custom Pages'), href: route('landing-page.custom-pages.index') });
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
            if (hasPermission(permissions, 'timesheet_approve')) timesheetChildren.push({ title: t('Approvals'), href: route('timesheet-approvals.index') });
            if (hasPermission(permissions, 'timesheet_generate_reports')) timesheetChildren.push({ title: t('Reports'), href: route('timesheet-reports.index') });
            items.push({ title: t('Timesheets'), icon: Clock, group: t('Time Tracking'), children: timesheetChildren });
        }

        // Finance
        if (hasPermission(permissions, 'invoice_view_any')) {
            items.push({ title: t('Invoices'), href: route('invoices.index'), icon: FileText, group: t('Finance') });
        }
        if (hasPermission(permissions, 'budget_view_any') || hasPermission(permissions, 'expense_view_any')) {
            const budgetChildren = [];
            if (hasPermission(permissions, 'budget_dashboard_view')) budgetChildren.push({ title: t('Budget Dashboard'), href: route('budgets.dashboard') });
            if (hasPermission(permissions, 'budget_view_any')) budgetChildren.push({ title: t('Budgets'), href: route('budgets.index') });
            if (hasPermission(permissions, 'expense_view_any')) budgetChildren.push({ title: t('Expenses'), href: route('expenses.index') });
            if (hasPermission(permissions, 'expense_approval_approve')) budgetChildren.push({ title: t('Expense Approvals'), href: route('expense-approvals.index') });
            items.push({
                title: t('Budget & Expenses'), icon: Receipt, group: t('Finance'),
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
            if (hasPermission(permissions, 'contract_type_view_any')) contractChildren.push({ title: t('Contract Types'), href: route('contract-types.index') });
            items.push({
                title: t('Contracts'), icon: FileText, group: t('Communications & Content'),
                children: contractChildren.length > 1 ? contractChildren : undefined,
                href: contractChildren.length === 1 ? contractChildren[0].href : undefined
            });
        }
        if (hasPermission(permissions, 'media_view_any')) {
            items.push({ title: t('Media Library'), href: route('media-library'), icon: Image, group: t('Communications & Content') });
        }
        // Mzitshwa AI assistant — always visible for logged-in users
        items.push({ title: t('Mzitshwa AI'), href: '#mzitshwa', icon: Bot, group: t('Communications & Content') });

        // ICT Ticketing System
        items.push({ title: t('ICT Tickets'), href: route('ict-tickets.index'), icon: HelpCircle, group: t('ICT Support') });

        return items;
    };

    // ─── SaaS Company User ───────────────────────────────────────────────────
    const getSaasNavItems = (): NavItem[] => {
        const items = buildCommonNavItems();

        // Subscription & Billing
        const planChildren = [];
        if (hasPermission(permissions, 'plan_view_any')) planChildren.push({ title: t('Plans'), href: route('plans.index') });
        if (hasPermission(permissions, 'plan_view_my_requests')) planChildren.push({ title: t('My Plan Requests'), href: route('my-plan-requests.index') });
        if (hasPermission(permissions, 'plan_view_my_orders')) planChildren.push({ title: t('My Plan Orders'), href: route('my-plan-orders.index') });
        if (planChildren.length > 0) {
            items.push({
                title: t('Plans'), icon: CreditCard, group: t('Subscription & Billing'),
                children: planChildren.length > 1 ? planChildren : undefined,
                href: planChildren.length === 1 ? planChildren[0].href : undefined
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
        if (hasPermission(permissions, 'custom_page_view_any')) landingChildren.push({ title: t('Custom Pages'), href: route('landing-page.custom-pages.index') });
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

    const getNavItems = (): NavItem[] => {
        if (isSaasMode && isSuperAdmin) return getSuperAdminNavItems();
        if (isSaasMode) return getSaasNavItems();
        return getNonSaasNavItems();
    };

    const mainNavItems = getNavItems();

    const { position, effectivePosition, isRtl } = useLayout();
    const { variant, collapsible, style } = useSidebarSettings();
    const { logoLight, logoDark, favicon, updateBrandSettings } = useBrand();
    const [sidebarStyle, setSidebarStyle] = useState({});
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {

        // Apply styles based on sidebar style
        if (style === 'colored') {
            setSidebarStyle({ backgroundColor: 'var(--primary)', color: 'white' });
        } else if (style === 'gradient') {
            setSidebarStyle({
                background: 'linear-gradient(to bottom, var(--primary), color-mix(in srgb, var(--primary), transparent 20%))',
                color: 'white'
            });
        } else {
            setSidebarStyle({});
        }
    }, [style]);

    const filterNavItems = (items: NavItem[], query: string): NavItem[] => {
        if (!query.trim()) return items;
        const q = query.toLowerCase();
        return items.reduce<NavItem[]>((acc, item) => {
            if (item.children) {
                const matched = filterNavItems(item.children, query);
                if (item.title.toLowerCase().includes(q)) {
                    acc.push(item);
                } else if (matched.length > 0) {
                    acc.push({ ...item, children: matched, defaultOpen: true });
                }
            } else if (item.title.toLowerCase().includes(q)) {
                acc.push(item);
            }
            return acc;
        }, []);
    };

    const filteredNavItems = filterNavItems(mainNavItems, searchQuery);

    // Get the first available menu item's href for logo link
    const getFirstAvailableHref = () => {
        if (filteredNavItems.length === 0) return route('dashboard');

        const firstItem = filteredNavItems[0];
        if (firstItem.href) {
            return firstItem.href;
        } else if (firstItem.children && firstItem.children.length > 0) {
            return firstItem.children[0].href || route('dashboard');
        }
        return route('dashboard');
    };

    return (
        <>
        <Sidebar
            // key={`sidebar-${effectivePosition}-${position}-${forceUpdate}-${isRTL ? 'rtl' : 'ltr'}`}
            side={effectivePosition}
            collapsible={collapsible}
            variant={variant}
            className={style !== 'plain' ? 'sidebar-custom-style' : ''}
        >
            <SidebarHeader className={style !== 'plain' ? 'sidebar-styled' : ''} style={sidebarStyle}>
                <div className="flex justify-center items-center p-2">
                    <Link href={getFirstAvailableHref()} prefetch className="flex items-center justify-center">
                        {/* Logo for expanded sidebar */}
                        <div className="group-data-[collapsible=icon]:hidden flex items-center">
                            {(() => {
                                const currentLogo = isDarkTheme ? logoLight : logoDark;
                                const displayUrl = currentLogo ? (
                                    currentLogo.startsWith('http') ? currentLogo :
                                        currentLogo.startsWith('/storage/') ? `${window.location.origin}${currentLogo}` :
                                            currentLogo.startsWith('/') ? `${window.location.origin}${currentLogo}` : currentLogo
                                ) : '';

                                return displayUrl ? (
                                    <img
                                        key={`${currentLogo}-${isDarkTheme}-${Date.now()}`}
                                        src={displayUrl}
                                        alt="Logo"
                                        className="w-auto transition-all duration-200"
                                        onError={() => updateBrandSettings({ [isDarkTheme ? 'logoLight' : 'logoDark']: '' })}
                                    />
                                ) : (
                                    <div className="h-8 text-inherit font-semibold flex items-center text-lg tracking-tight">
                                        WorkDo
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Icon for collapsed sidebar */}
                        <div className="h-8 w-8 hidden group-data-[collapsible=icon]:block">
                            {(() => {
                                const displayFavicon = favicon ? (
                                    favicon.startsWith('http') ? favicon :
                                        favicon.startsWith('/storage/') ? `${window.location.origin}${favicon}` :
                                            favicon.startsWith('/') ? `${window.location.origin}${favicon}` : favicon
                                ) : '';

                                return displayFavicon ? (
                                    <img
                                        key={`${favicon}-${Date.now()}`}
                                        src={displayFavicon}
                                        alt="Icon"
                                        className="h-8 w-8 transition-all duration-200"
                                        onError={() => updateBrandSettings({ favicon: '' })}
                                    />
                                ) : (
                                    <div className="h-8 w-8 bg-primary text-white rounded flex items-center justify-center font-bold shadow-sm">
                                        W
                                    </div>
                                );
                            })()}
                        </div>
                    </Link>
                </div>

                {/* Search Input */}
                <div className="group-data-[collapsible=icon]:hidden px-2 pb-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t('Search menu...')}
                            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 py-1.5 pl-8 pr-7 text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                </div>

            </SidebarHeader>

            <SidebarContent style={sidebarStyle} className={style !== 'plain' ? 'sidebar-styled' : ''}>
                {filteredNavItems.length === 0 && searchQuery ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                        <Search className="h-8 w-8 text-gray-300 mb-3" />
                        <p className="text-sm font-medium text-gray-500">{t('No menu found')}</p>
                        <p className="text-xs text-gray-400 mt-1">"{searchQuery}"</p>
                    </div>
                ) : (
                    <NavMain items={filteredNavItems} position={effectivePosition} sidebarStyle={style} />
                )}
            </SidebarContent>

            <SidebarFooter className="p-3">
                {/* <NavFooter items={footerNavItems} className="mt-auto" position={position} /> */}
                {/* Profile menu moved to header */}

                {/* Plan Active UI — SaaS + Company only */}
                {isSaasMode && auth.user?.workspace_role === 'owner' && (() => {
                    const user = auth.user;
                    const plan = user?.plan;
                    
                    const planName = plan?.name ?? t('No Plan');
                    const isActive = user?.plan_is_active === 1;
                    const isTrial = user?.is_trial;
                    
                    const expireDate = isTrial == 1 ? user?.trial_expire_date : (user?.plan_expire_date || globalSettings?.planExirationDate);

                    const daysLeft = expireDate
                        ? Math.ceil((new Date(expireDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                        : null;
                    const isExpired = daysLeft == null || daysLeft <= 0;
                    const isExpiringSoon = daysLeft !== null && daysLeft > 0 && daysLeft <= 7;

                     return (
                        <div className="group-data-[collapsible=icon]:hidden">
                            <div
                                className={`relative rounded-xl overflow-hidden ${isExpired ? 'rounded-lg border bg-card text-card-foreground shadow-sm bg-gradient-to-r from-red-500 to-red-400' : 'bg-primary border-t border-t-[color-mix(in_srgb,var(--primary),white_20%)]'}`}
                            >
                                {/* Decorative circles */}
                                <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
                                <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />

                                <div className="relative p-5">
                                    {/* Header row */}
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                                                <CreditCard className="h-4 w-4 text-white" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold leading-tight mb-1" style={{ color: 'rgba(255,255,255,0.9)' }}>{t('Current Plan')}</p>
                                                <p className="text-sm font-bold text-white leading-tight">{planName}</p>
                                            </div>
                                        </div>
                                        {/* Status badge */}
                                        <span
                                            className="text-xs font-bold px-3 py-1 rounded-full tracking-wide"
                                            style={{ backgroundColor: 'rgba(255,255,255,0.25)', color: 'white', border: '1px solid rgba(255,255,255,0.35)' }}
                                        >
                                            {isExpired ? t('Expired') : isTrial == 1 ? t('Trial') : t('Active')}
                                        </span>
                                    </div>

                                    {/* Divider */}
                                    <div className="mb-3" style={{ borderTop: '1px solid rgba(255,255,255,0.2)' }} />

                                    {/* Expiry info */}
                                    <div className="mb-3 space-y-1.5">
                                        {expireDate ? (
                                            <>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>
                                                        {isExpired ? t('Expired on') : isTrial == 1 ? t('Trial expires') : t('Plan expires')}
                                                    </span>
                                                    <span className="text-xs font-bold text-white">
                                                        {window.appSettings?.formatDateTime(expireDate, false) || new Date(expireDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>{!isExpired ? t('Days left') : t('Days since expiration')}</span>
                                                    <span className="text-xs font-bold text-white">
                                                        {isExpired ? -daysLeft : daysLeft} {t('days')}
                                                    </span>
                                                </div>
                                                {/* Progress bar */}
                                                {!isExpired && daysLeft !== null && daysLeft <= 30 && (
                                                    <div className="mt-1">
                                                        <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                                                            <div
                                                                className="h-full rounded-full transition-all"
                                                                style={{ width: `${Math.max(5, (daysLeft / 30) * 100)}%`, backgroundColor: 'rgba(255,255,255,0.9)' }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>{t('Status')}</span>
                                                <span className="text-xs font-bold text-white">
                                                    {isActive ? t('No expiry') : t('Inactive')}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Upgrade button */}
                                    <Link
                                        href={route('plans.index')}
                                        className={`flex items-center justify-center gap-1.5 w-full text-xs font-semibold py-2 px-3 rounded-lg transition-all duration-200 ${isExpired? 'text-red-500 hover:!text-red-500' : 'text-primary hover:text-primary'}`}
                                        style={{ backgroundColor: 'rgba(255,255,255,0.95)'}}
                                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'white')}
                                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.95)')}
                                    >
                                        <CreditCard className="h-3.5 w-3.5" />
                                        <span>{isExpired || !isActive ? t('Renew Plan') : t('Upgrade Plan')}</span>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </SidebarFooter>
        </Sidebar>

        {/* Mzitshwa panel — intercept #mzitshwa nav clicks */}
        <div onClick={(e) => {
            const anchor = (e.target as HTMLElement).closest('a[href="#mzitshwa"]');
            if (anchor) { e.preventDefault(); setMzitshwaOpen(true); }
        }}>
            <MzitshwaPanel isOpen={mzitshwaOpen} onClose={() => setMzitshwaOpen(false)} />
        </div>
        </>
    );
}
