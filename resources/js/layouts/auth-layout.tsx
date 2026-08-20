import React from 'react';
import { Head, usePage } from '@inertiajs/react';
import { CreditCard, Users, Smartphone, QrCode } from 'lucide-react';
import { ReactNode, useEffect, useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useBrand } from '@/contexts/BrandContext';
import { useAppearance, THEME_COLORS } from '@/hooks/use-appearance';
import { isDemoMode, getCookie } from '@/utils/cookie-utils';

import CookieConsentBanner from '@/components/cookie-consent-banner';

interface AuthLayoutProps {
    children: ReactNode;
    title: string;
    description?: string;
    icon?: ReactNode;
    status?: string;
    statusType?: 'success' | 'error';
}

export default function AuthLayout({
    children,
    title,
    description,
    icon,
    status,
    statusType = 'success',
}: AuthLayoutProps) {
    const { t, i18n } = useTranslation();
    const [mounted, setMounted] = useState(false);
    const { logoLight, logoDark, themeColor, customColor } = useBrand();
    const { appearance } = useAppearance();
    const [isDarkTheme, setIsDarkTheme] = useState(() => document.documentElement.classList.contains('dark'));

    const { globalSettings } = usePage().props as any;

    // Listen for theme changes using MutationObserver (same as sidebar)
    useEffect(() => {
        const handleThemeChange = () => {
            const newIsDark = document.documentElement.classList.contains('dark');
            setIsDarkTheme(newIsDark);
        };
        
        // Create a MutationObserver to watch for class changes on html element
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    handleThemeChange();
                }
            });
        });
        
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class']
        });
        
        return () => {
            observer.disconnect();
        };
    }, []);

    const currentLogo = isDarkTheme ? logoLight : logoDark;
    const primaryColor = themeColor === 'custom' ? customColor : THEME_COLORS[themeColor as keyof typeof THEME_COLORS];

    // RTL Support for auth pages - Apply immediately and persist
    const applyRTLDirection = React.useCallback(() => {
        const isDemo = globalSettings?.is_demo || false;
        const currentLang = i18n.language || globalSettings?.defaultLanguage || 'en';
        const isRTLLanguage = ['ar', 'he'].includes(currentLang);
        let dir = 'ltr';

        // Check RTL setting from cookies/globalSettings
        let data = getCookie('brandSettings');
        if (data) {
            try {
                const parsed = JSON.parse(data);
                data = parsed.layoutDirection;
            } catch (error) {
                data = null;
            }
        }


        // Check RTL setting from cookies/globalSettings
        const layoutDirection = isDemo ? data : globalSettings?.layoutDirection; const isRTLSetting = layoutDirection === 'right';
        
        // Apply RTL if: 1) Language is ar/he OR 2) RTL setting is enabled
        if (isRTLLanguage || isRTLSetting) {
            dir = 'rtl';
        }

        // Apply direction immediately
        document.documentElement.dir = dir;
        document.documentElement.setAttribute('dir', dir);
        document.body.dir = dir;

        return dir;
    }, [i18n.language, globalSettings?.defaultLanguage, globalSettings?.is_demo, globalSettings?.layoutDirection]);

    // Apply RTL on mount and when dependencies change
    React.useLayoutEffect(() => {
        const direction = applyRTLDirection();

        // Ensure direction persists after any DOM changes
        const observer = new MutationObserver(() => {
            if (document.documentElement.dir !== direction) {
                document.documentElement.dir = direction;
                document.documentElement.setAttribute('dir', direction);
            }
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['dir']
        });

        return () => {
            observer.disconnect();
            // Reset to LTR when leaving auth layout
            document.documentElement.dir = 'ltr';
            document.documentElement.setAttribute('dir', 'ltr');
            document.body.dir = 'ltr';
        };
    }, [applyRTLDirection]);

    // Apply theme mode (dark/light) to auth pages
    React.useEffect(() => {
        let themeMode = 'light'; // default

        if (isDemoMode()) {
            // In demo mode, get theme from cookies
            try {
                const themeSettings = getCookie('themeSettings');
                if (themeSettings) {
                    const parsed = JSON.parse(themeSettings);
                    themeMode = parsed.appearance || 'light';
                }
            } catch (error) {
                // Use default
            }
        } else {
            // In live mode, get theme from database
            themeMode = globalSettings?.themeMode || 'light';
        }

        // Apply theme mode
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const isDark = themeMode === 'dark' || (themeMode === 'system' && prefersDark);

        document.documentElement.classList.toggle('dark', isDark);
        document.body.classList.toggle('dark', isDark);
    }, [globalSettings?.themeMode]);


    // Apply demo mode language and RTL immediately on mount
    useLayoutEffect(() => {
        const isDemo = globalSettings?.is_demo || false;

        if (isDemo) {
            // In demo mode, check for saved language in localStorage
            const savedLanguage = localStorage.getItem('i18nextLng');
            if (savedLanguage && i18n.language !== savedLanguage) {
                i18n.changeLanguage(savedLanguage);
            }
        }

        setMounted(true);
    }, [globalSettings, i18n]);

    // Listen for language changes in demo mode
    useEffect(() => {
        const isDemo = globalSettings?.is_demo || false;

        if (isDemo) {
            const handleStorageChange = (e: StorageEvent) => {
                if (e.key === 'i18nextLng' && e.newValue && i18n.language !== e.newValue) {
                    i18n.changeLanguage(e.newValue);
                }
            };

            window.addEventListener('storage', handleStorageChange);
            return () => window.removeEventListener('storage', handleStorageChange);
        }
    }, [globalSettings?.is_demo, i18n]);

    function hexToAdjustedRgba(hex, opacity = 1, adjust = 0) {
        hex = hex.replace("#", "");
        let r = parseInt(hex.slice(0, 2), 16);
        let g = parseInt(hex.slice(2, 4), 16);
        let b = parseInt(hex.slice(4, 6), 16);
        const clamp = (v) => Math.max(-1, Math.min(1, v));
        const getF = (ch) =>
            typeof adjust === "number" ? clamp(adjust) : clamp(adjust[ch] ?? 0);
        const adj = (c, f) =>
            f < 0 ? Math.floor(c * (1 + f)) : Math.floor(c + (255 - c) * f);
        const rr = adj(r, getF("r"));
        const gg = adj(g, getF("g"));
        const bb = adj(b, getF("b"));
        return opacity === 1
            ? `#${rr.toString(16).padStart(2, "0")}${gg
                .toString(16)
                .padStart(2, "0")}${bb.toString(16).padStart(2, "0")}`.toUpperCase()
            : `rgba(${rr}, ${gg}, ${bb}, ${opacity})`;
    }

    return (
        <div className="flex min-h-screen w-full">
            <Head title={title} />

            {/* â”€â”€ Left brand panel â”€â”€ */}
            <div
                className="hidden lg:flex lg:w-[45%] flex-col relative overflow-hidden"
                style={{ background: 'linear-gradient(145deg, #001a4d 0%, #002d80 60%, #001435 100%)' }}
            >
                {/* Decorative orbs */}
                <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-10"
                    style={{ background: '#E3B448', filter: 'blur(80px)' }} />
                <div className="absolute bottom-0 right-0 w-72 h-72 rounded-full opacity-10"
                    style={{ background: '#E3B448', filter: 'blur(60px)' }} />

                {/* Gold grid lines */}
                <div className="absolute inset-0 opacity-[0.04]"
                    style={{ backgroundImage: 'linear-gradient(#E3B448 1px, transparent 1px), linear-gradient(90deg, #E3B448 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

                {/* Content */}
                <div className="relative z-10 flex flex-col h-full px-12 py-12">
                    {/* Logo */}
                    <div className="flex items-center gap-3 mb-auto">
                        {currentLogo ? (
                            <img src={currentLogo} alt="Team Truth" className="h-10 w-auto" />
                        ) : (
                            <span className="text-2xl font-bold text-white tracking-tight">Team Truth</span>
                        )}
                    </div>

                    {/* Centre copy */}
                    <div className="my-auto">
                        <div className="w-12 h-1 rounded-full mb-8" style={{ background: '#E3B448' }} />
                        <h2 className="text-4xl font-bold text-white leading-tight mb-4">
                            Manage.<br />
                            <span style={{ color: '#E3B448' }}>Collaborate.</span><br />
                            Deliver.
                        </h2>
                        <p className="text-white/60 text-base leading-relaxed max-w-xs">
                            The complete project management platform for Trukumb Holdings â€” built for every team, every subsidiary.
                        </p>

                        {/* Feature pills */}
                        <div className="flex flex-wrap gap-2 mt-8">
                            {['Projects', 'Timesheets', 'Invoices', 'ICT Tickets', 'Analytics'].map(f => (
                                <span key={f} className="text-xs px-3 py-1 rounded-full border border-white/20 text-white/70">
                                    {f}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Footer text */}
                    <p className="text-white/30 text-xs mt-auto">
                        {globalSettings?.footerText || 'Â© 2026 Team Truth. All rights reserved.'}
                    </p>
                </div>
            </div>

            {/* â”€â”€ Right form panel â”€â”€ */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 relative min-h-screen"
                style={{ background: 'linear-gradient(145deg, #f0f4ff 0%, #e8eefc 50%, #edf2ff 100%)' }}>

                {/* Dark mode override */}
                <style>{`.dark .auth-right { background: linear-gradient(145deg,#020c24 0%,#001640 50%,#010f2e 100%) !important; }`}</style>

                {/* Language switcher */}
                <div className="absolute top-5 right-5 z-10">
                    <LanguageSwitcher />
                </div>

                {/* Mobile logo */}
                <div className="lg:hidden mb-8 flex flex-col items-center">
                    {currentLogo ? (
                        <img src={currentLogo} alt="Team Truth" className="h-10 w-auto mb-2" />
                    ) : (
                        <span className="text-2xl font-bold tracking-tight" style={{ color: '#001a4d' }}>Team Truth</span>
                    )}
                </div>

                <div
                    className={`w-full max-w-md transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
                >
                    {/* Glass card */}
                    <div className="rounded-2xl border p-8 shadow-xl"
                        style={{
                            background: 'rgba(255,255,255,0.82)',
                            backdropFilter: 'blur(18px)',
                            WebkitBackdropFilter: 'blur(18px)',
                            borderColor: 'rgba(0,26,77,0.10)',
                        }}>

                        {/* Header */}
                        <div className="mb-7">
                            {icon && (
                                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                                    style={{ background: `${primaryColor}20` }}>
                                    {icon}
                                </div>
                            )}
                            <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#001a4d' }}>{title}</h1>
                            {description && (
                                <p className="text-sm mt-1" style={{ color: 'rgba(0,26,77,0.55)' }}>{description}</p>
                            )}
                            <div className="mt-3 h-0.5 w-10 rounded-full" style={{ background: '#E3B448' }} />
                        </div>

                        {status && (
                            <div className={`mb-5 text-sm font-medium p-3 rounded-xl border ${
                                statusType === 'success'
                                    ? 'text-green-700 bg-green-50 border-green-200'
                                    : 'text-red-700 bg-red-50 border-red-200'
                            }`}>{status}</div>
                        )}

                        {children}
                    </div>

                    {/* Mobile footer */}
                    <p className="lg:hidden text-center text-xs mt-6" style={{ color: 'rgba(0,26,77,0.35)' }}>
                        {globalSettings?.footerText || '© 2026 Team Truth'}
                    </p>
                </div>
            </div>

            <CookieConsentBanner />
        </div>
    );
}