import { MzitshwaPanel } from '@/components/Mzitshwa';
import { NavMain } from '@/components/nav-main';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarTrigger } from '@/components/ui/sidebar';
import { useBrand } from '@/contexts/BrandContext';
import { useLayout } from '@/contexts/LayoutContext';
import { useSidebarSettings } from '@/contexts/SidebarContext';
import { useNavigation } from '@/hooks/use-navigation';

import { type NavItem } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { CreditCard, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { route } from 'ziggy-js';

export function AppSidebar() {
    const { t, i18n } = useTranslation();
    const { navItems: mainNavItems, isRTL } = useNavigation();
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
            setForceUpdate((prev) => prev + 1);
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

    const { auth, isSaasMode, globalSettings } = usePage().props as any;

    const { position, effectivePosition } = useLayout();
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
                color: 'white',
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
                    <div className="relative flex items-center justify-center p-2">
                        {/* Close button — only shown on mobile inside the Sheet */}
                        <SidebarTrigger className="absolute top-1/2 right-2 h-8 w-8 -translate-y-1/2 md:hidden" />
                        <Link href={getFirstAvailableHref()} prefetch className="flex items-center justify-center">
                            {/* Logo for expanded sidebar */}
                            <div className="flex items-center group-data-[collapsible=icon]:hidden">
                                {(() => {
                                    const currentLogo = isDarkTheme ? logoLight : logoDark;
                                    const displayUrl = currentLogo
                                        ? currentLogo.startsWith('http')
                                            ? currentLogo
                                            : currentLogo.startsWith('/storage/')
                                              ? `${window.location.origin}${currentLogo}`
                                              : currentLogo.startsWith('/')
                                                ? `${window.location.origin}${currentLogo}`
                                                : currentLogo
                                        : '';

                                    return displayUrl ? (
                                        <img
                                            key={`${currentLogo}-${isDarkTheme}-${Date.now()}`}
                                            src={displayUrl}
                                            alt="Logo"
                                            className="w-auto transition-all duration-200"
                                            onError={() => updateBrandSettings({ [isDarkTheme ? 'logoLight' : 'logoDark']: '' })}
                                        />
                                    ) : (
                                        <div className="flex h-8 items-center text-lg font-semibold tracking-tight text-inherit">WorkDo</div>
                                    );
                                })()}
                            </div>

                            {/* Icon for collapsed sidebar */}
                            <div className="hidden h-8 w-8 group-data-[collapsible=icon]:block">
                                {(() => {
                                    const displayFavicon = favicon
                                        ? favicon.startsWith('http')
                                            ? favicon
                                            : favicon.startsWith('/storage/')
                                              ? `${window.location.origin}${favicon}`
                                              : favicon.startsWith('/')
                                                ? `${window.location.origin}${favicon}`
                                                : favicon
                                        : '';

                                    return displayFavicon ? (
                                        <img
                                            key={`${favicon}-${Date.now()}`}
                                            src={displayFavicon}
                                            alt="Icon"
                                            className="h-8 w-8 transition-all duration-200"
                                            onError={() => updateBrandSettings({ favicon: '' })}
                                        />
                                    ) : (
                                        <div className="bg-primary flex h-8 w-8 items-center justify-center rounded font-bold text-white shadow-sm">
                                            W
                                        </div>
                                    );
                                })()}
                            </div>
                        </Link>
                    </div>

                    {/* Search Input */}
                    <div className="px-2 pb-2 group-data-[collapsible=icon]:hidden">
                        <div className="relative">
                            <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={t('Search menu...')}
                                className="focus:border-primary focus:ring-primary w-full rounded-md border border-gray-300 bg-gray-50 py-1.5 pr-7 pl-8 text-sm text-gray-700 placeholder-gray-400 transition-all outline-none focus:ring-1 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:placeholder-gray-500"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute top-1/2 right-2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                    </div>
                </SidebarHeader>

                <SidebarContent style={sidebarStyle} className={style !== 'plain' ? 'sidebar-styled' : ''}>
                    {filteredNavItems.length === 0 && searchQuery ? (
                        <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                            <Search className="mb-3 h-8 w-8 text-gray-300" />
                            <p className="text-sm font-medium text-gray-500">{t('No menu found')}</p>
                            <p className="mt-1 text-xs text-gray-400">"{searchQuery}"</p>
                        </div>
                    ) : (
                        <NavMain items={filteredNavItems} position={effectivePosition} sidebarStyle={style} />
                    )}
                </SidebarContent>

                <SidebarFooter className="p-3">
                    {/* <NavFooter items={footerNavItems} className="mt-auto" position={position} /> */}
                    {/* Profile menu moved to header */}

                    {/* Plan Active UI — SaaS + Company only */}
                    {isSaasMode &&
                        auth.user?.workspace_role === 'owner' &&
                        (() => {
                            const user = auth.user;
                            const plan = user?.plan;

                            const planName = plan?.name ?? t('No Plan');
                            const isActive = user?.plan_is_active === 1;
                            const isTrial = user?.is_trial;

                            const expireDate = isTrial == 1 ? user?.trial_expire_date : user?.plan_expire_date || globalSettings?.planExirationDate;

                            const daysLeft = expireDate ? Math.ceil((new Date(expireDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
                            const isExpired = daysLeft == null || daysLeft <= 0;
                            const isExpiringSoon = daysLeft !== null && daysLeft > 0 && daysLeft <= 7;

                            return (
                                <div className="group-data-[collapsible=icon]:hidden">
                                    <div
                                        className={`relative overflow-hidden rounded-xl ${isExpired ? 'bg-card text-card-foreground rounded-lg border bg-gradient-to-r from-red-500 to-red-400 shadow-sm' : 'bg-primary border-t border-t-[color-mix(in_srgb,var(--primary),white_20%)]'}`}
                                    >
                                        {/* Decorative circles */}
                                        <div
                                            className="absolute -top-4 -right-4 h-16 w-16 rounded-full"
                                            style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                                        />
                                        <div
                                            className="absolute -bottom-3 -left-3 h-10 w-10 rounded-full"
                                            style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
                                        />

                                        <div className="relative p-5">
                                            {/* Header row */}
                                            <div className="mb-3 flex items-start justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="rounded-lg p-1.5" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                                                        <CreditCard className="h-4 w-4 text-white" />
                                                    </div>
                                                    <div>
                                                        <p
                                                            className="mb-1 text-xs leading-tight font-semibold"
                                                            style={{ color: 'rgba(255,255,255,0.9)' }}
                                                        >
                                                            {t('Current Plan')}
                                                        </p>
                                                        <p className="text-sm leading-tight font-bold text-white">{planName}</p>
                                                    </div>
                                                </div>
                                                {/* Status badge */}
                                                <span
                                                    className="rounded-full px-3 py-1 text-xs font-bold tracking-wide"
                                                    style={{
                                                        backgroundColor: 'rgba(255,255,255,0.25)',
                                                        color: 'white',
                                                        border: '1px solid rgba(255,255,255,0.35)',
                                                    }}
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
                                                                {window.appSettings?.formatDateTime(expireDate, false) ||
                                                                    new Date(expireDate).toLocaleDateString(undefined, {
                                                                        day: '2-digit',
                                                                        month: 'short',
                                                                        year: 'numeric',
                                                                    })}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>
                                                                {!isExpired ? t('Days left') : t('Days since expiration')}
                                                            </span>
                                                            <span className="text-xs font-bold text-white">
                                                                {isExpired ? -daysLeft : daysLeft} {t('days')}
                                                            </span>
                                                        </div>
                                                        {/* Progress bar */}
                                                        {!isExpired && daysLeft !== null && daysLeft <= 30 && (
                                                            <div className="mt-1">
                                                                <div
                                                                    className="h-1.5 w-full overflow-hidden rounded-full"
                                                                    style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
                                                                >
                                                                    <div
                                                                        className="h-full rounded-full transition-all"
                                                                        style={{
                                                                            width: `${Math.max(5, (daysLeft / 30) * 100)}%`,
                                                                            backgroundColor: 'rgba(255,255,255,0.9)',
                                                                        }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>
                                                            {t('Status')}
                                                        </span>
                                                        <span className="text-xs font-bold text-white">
                                                            {isActive ? t('No expiry') : t('Inactive')}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Upgrade button */}
                                            <Link
                                                href={route('plans.index')}
                                                className={`flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-200 ${isExpired ? 'text-red-500 hover:!text-red-500' : 'text-primary hover:text-primary'}`}
                                                style={{ backgroundColor: 'rgba(255,255,255,0.95)' }}
                                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'white')}
                                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.95)')}
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
            <div
                onClick={(e) => {
                    const anchor = (e.target as HTMLElement).closest('a[href="#mzitshwa"]');
                    if (anchor) {
                        e.preventDefault();
                        setMzitshwaOpen(true);
                    }
                }}
            >
                <MzitshwaPanel isOpen={mzitshwaOpen} onClose={() => setMzitshwaOpen(false)} />
            </div>
        </>
    );
}
