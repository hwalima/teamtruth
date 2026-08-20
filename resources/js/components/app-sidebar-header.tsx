import { Breadcrumbs } from '@/components/breadcrumbs';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useLayout } from '@/contexts/LayoutContext';
import { type BreadcrumbItem as BreadcrumbItemType } from '@/types';
import { ProfileMenu } from '@/components/profile-menu';
import { LanguageSwitcher } from '@/components/language-switcher';
import { WorkspaceSwitcher } from '@/components/workspace-switcher';
import NavigationTimer from '@/components/timesheets/NavigationTimer';
import { usePage, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { Building2,Sun,Moon } from 'lucide-react';
import { useState, useEffect } from 'react';


const setCookie = (name: string, value: string, days = 365) => {
    if (typeof document === 'undefined') return;
    const maxAge = days * 24 * 60 * 60;
    document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${maxAge};SameSite=Lax`;
};

const getCookie = (name: string): string | null => {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
        const cookieValue = parts.pop()?.split(';').shift();
        return cookieValue ? decodeURIComponent(cookieValue) : null;
    }
    return null;
};

export function AppSidebarHeader({ breadcrumbs = [] }: { breadcrumbs?: BreadcrumbItemType[] }) {
    const { t } = useTranslation();
    const { position } = useLayout();
    const { auth } = usePage().props as any;
    const currentWorkspace = auth?.user?.current_workspace;
    const { globalSettings } = usePage().props as any;
    const isDemo = globalSettings?.is_demo || false;

    // Determine current mode from DB (non-demo) or cookie (demo)
    const getCurrentMode = (): 'light' | 'dark' => {
        if (isDemo) {
            try {
                const cookie = getCookie('themeSettings');
                if (cookie) {
                    const parsed = JSON.parse(cookie);
                    return parsed.appearance === 'dark' ? 'dark' : 'light';
                }
            } catch {}
            return 'light';
        }
        return (globalSettings?.themeMode === 'dark') ? 'dark' : 'light';
    };

    const [isDark, setIsDark] = useState(
        () => globalSettings?.themeMode === 'dark'
    );
    // Sync with globalSettings changes (main version)
        useEffect(() => {
        if (isDemo) return;
        setIsDark(globalSettings?.themeMode === 'dark');
    }, [globalSettings?.themeMode, isDemo]);

    // Sync with DOM dark class changes (demo version — settings page updates DOM directly)
    useEffect(() => {
        if (!isDemo) return;
        const observer = new MutationObserver(() => {
            const domIsDark = document.documentElement.classList.contains('dark');
            setIsDark(domIsDark);
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, [isDemo]);


       const handleToggle = () => {
        const newMode = isDark ? 'light' : 'dark';
        setIsDark(!isDark);

        // Apply theme directly to DOM
        document.documentElement.classList.toggle('dark', newMode === 'dark');
        document.body.classList.toggle('dark', newMode === 'dark');

        if (isDemo) {
            // Demo: save to cookie directly with new mode value — no router call
            try {
                const existing = getCookie('themeSettings');
                const parsed = existing ? JSON.parse(existing) : {};
                const updated = { ...parsed, appearance: newMode };
                setCookie('themeSettings', JSON.stringify(updated));

                // Also sync brandSettings cookie so BrandContext/useBrandTheme don't overwrite the DOM
                const existingBrand = getCookie('brandSettings');
                const parsedBrand = existingBrand ? JSON.parse(existingBrand) : {};
                setCookie('brandSettings', JSON.stringify({ ...parsedBrand, themeMode: newMode }));
            } catch {
                setCookie('themeSettings', JSON.stringify({ appearance: newMode }));
            }
        } else {
            // Main: save to database
            router.post(route('settings.brand.update'), {
                settings: {
                    themeMode: newMode,
                }
            }, { preserveScroll: true, preserveState: true });
        }
    };

    return (
        <>
            <header className="border-sidebar-border/50 flex h-14 shrink-0 items-center gap-2 border-b px-[50px] transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">            
            <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-2">
                    {position === 'left' && <SidebarTrigger className="-ml-1" />}
                    {auth?.user?.type === 'company' && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Building2 className="h-4 w-4" />
                            <span>{currentWorkspace?.name || 'No Workspace'}</span>
                            {breadcrumbs.length > 0 && <span className="mx-1">/</span>}
                        </div>
                    )}
                    <Breadcrumbs items={breadcrumbs.map(b => ({ label: b.title, href: b.href }))} />
                </div>
                <div className="flex items-center gap-2">
                    {(usePage().props as any).isImpersonating && (
                        <button 
                            onClick={() => router.post(route('impersonate.leave'))}
                            className="bg-red-500 cursor-pointer text-white px-2 py-1 rounded text-xs hover:bg-red-600"
                        >
                            {t("Return Back")}
                        </button>
                    )}
                    {auth?.user?.type !== 'superadmin' && <NavigationTimer />}
                    <WorkspaceSwitcher />
                    {/* Dark/Light Mode Toggle */}
                    <button
                        onClick={handleToggle}
                        className="flex items-center justify-center h-9 w-9 rounded-md border shadow-sm bg-white dark:bg-gray-900 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                        title={isDark ? t('Switch to Light Mode') : t('Switch to Dark Mode')}
                    >
                        {isDark
                            ? <Sun className="h-4 w-4 text-yellow-500" />
                            : <Moon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                        }
                    </button>
                    <LanguageSwitcher />
                    <ProfileMenu />
                    {position === 'right' && <SidebarTrigger className="-mr-1" />}
                </div>
            </div>
        </header>
        </>
    );
}
