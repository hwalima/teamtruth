import React from 'react';
import { Head, usePage } from '@inertiajs/react';
import { BarChart3, CheckCircle2, Clock3, Receipt, ShieldCheck, Ticket } from 'lucide-react';
import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useBrand } from '@/contexts/BrandContext';
import { THEME_COLORS } from '@/hooks/use-appearance';
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

const GOLD = '#E3B448';
const NAVY = '#001a4d';
const ROTATING_WORDS = ['projects', 'timesheets', 'invoices', 'stock', 'people', 'tickets'];

/** Styles for the sign-in screens: an animated aurora, a pointer spotlight and a glowing card. */
const AUTH_STYLES = `
@property --tt-angle { syntax: '<angle>'; initial-value: 0deg; inherits: false; }

.tt-auth { --mx: 50vw; --my: 40vh; background: #000d26; }
.tt-auth-aurora { position: absolute; inset: -20%; filter: blur(70px); opacity: .9; pointer-events: none; }
.tt-blob { position: absolute; border-radius: 9999px; mix-blend-mode: screen; will-change: transform; }
.tt-blob-1 { width: 46vmax; height: 46vmax; left: -6%; top: -8%; background: radial-gradient(circle, #0a3fb0 0%, transparent 65%); animation: tt-drift-1 22s ease-in-out infinite alternate; }
.tt-blob-2 { width: 38vmax; height: 38vmax; right: -4%; top: 10%; background: radial-gradient(circle, rgba(227,180,72,.55) 0%, transparent 62%); animation: tt-drift-2 26s ease-in-out infinite alternate; }
.tt-blob-3 { width: 42vmax; height: 42vmax; left: 25%; bottom: -18%; background: radial-gradient(circle, #1d4ed8 0%, transparent 60%); animation: tt-drift-3 30s ease-in-out infinite alternate; }
.tt-blob-4 { width: 24vmax; height: 24vmax; left: 8%; bottom: 8%; background: radial-gradient(circle, rgba(56,189,248,.45) 0%, transparent 65%); animation: tt-drift-2 18s ease-in-out infinite alternate-reverse; }
@keyframes tt-drift-1 { to { transform: translate(14vw, 10vh) scale(1.15); } }
@keyframes tt-drift-2 { to { transform: translate(-12vw, 14vh) scale(.9); } }
@keyframes tt-drift-3 { to { transform: translate(-8vw, -12vh) scale(1.2); } }

.tt-grid { position: absolute; inset: 0; pointer-events: none; opacity: .5;
  background-image: linear-gradient(rgba(227,180,72,.09) 1px, transparent 1px), linear-gradient(90deg, rgba(227,180,72,.09) 1px, transparent 1px);
  background-size: 56px 56px;
  -webkit-mask-image: radial-gradient(ellipse 70% 60% at 50% 45%, #000 20%, transparent 75%);
          mask-image: radial-gradient(ellipse 70% 60% at 50% 45%, #000 20%, transparent 75%);
  animation: tt-grid-pan 40s linear infinite; }
@keyframes tt-grid-pan { to { background-position: 56px 56px, 56px 56px; } }

.tt-spotlight { position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(600px circle at var(--mx) var(--my), rgba(227,180,72,.13), transparent 45%); }
.tt-noise { position: absolute; inset: 0; pointer-events: none; opacity: .06; mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }

.tt-spark { position: absolute; bottom: -10px; width: 3px; height: 3px; border-radius: 9999px; background: ${GOLD};
  box-shadow: 0 0 8px 2px rgba(227,180,72,.6); opacity: 0; animation: tt-rise linear infinite; }
@keyframes tt-rise { 0% { transform: translateY(0); opacity: 0; } 10% { opacity: .9; } 90% { opacity: .5; } 100% { transform: translateY(-105vh); opacity: 0; } }

.tt-reveal { opacity: 0; transform: translateY(18px); filter: blur(6px); animation: tt-reveal .9s cubic-bezier(.2,.7,.2,1) forwards; }
@keyframes tt-reveal { to { opacity: 1; transform: none; filter: blur(0); } }

.tt-shimmer { background: linear-gradient(110deg, ${GOLD} 0%, #fff3cf 22%, ${GOLD} 44%, #c8902a 70%, ${GOLD} 100%);
  background-size: 250% 100%; -webkit-background-clip: text; background-clip: text; color: transparent;
  animation: tt-shimmer 6s linear infinite; }
@keyframes tt-shimmer { to { background-position: -250% 0; } }

.tt-word { display: inline-block; animation: tt-word-in .55s cubic-bezier(.2,.7,.2,1); }
@keyframes tt-word-in { from { opacity: 0; transform: translateY(70%) rotateX(-60deg); filter: blur(4px); } to { opacity: 1; transform: none; filter: none; } }

.tt-float { animation: tt-bob 7s ease-in-out infinite; }
@keyframes tt-bob { 0%, 100% { transform: translateY(0) rotate(var(--tilt, 0deg)); } 50% { transform: translateY(-12px) rotate(var(--tilt, 0deg)); } }

.tt-orbit { position: absolute; border-radius: 9999px; border: 1px dashed rgba(227,180,72,.18); animation: tt-spin 60s linear infinite; }
.tt-orbit::after { content: ''; position: absolute; top: -4px; left: 50%; width: 8px; height: 8px; border-radius: 9999px; background: ${GOLD}; box-shadow: 0 0 14px 3px rgba(227,180,72,.7); }
@keyframes tt-spin { to { transform: rotate(360deg); } }

.tt-card-shell { position: relative; border-radius: 1.5rem; padding: 1.5px; isolation: isolate;
  background: conic-gradient(from var(--tt-angle), rgba(227,180,72,.15), ${GOLD}, rgba(59,130,246,.6), rgba(227,180,72,.15) 60%, rgba(255,255,255,.4), rgba(227,180,72,.15));
  animation: tt-border 7s linear infinite; box-shadow: 0 30px 80px -20px rgba(0,0,0,.55), 0 0 60px -10px rgba(227,180,72,.25); }
@keyframes tt-border { to { --tt-angle: 360deg; } }
.tt-card { position: relative; border-radius: calc(1.5rem - 1.5px); overflow: hidden; background: rgba(255,255,255,.94);
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); color: ${NAVY}; }
.tt-card::before { content: ''; position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity .3s;
  background: radial-gradient(380px circle at var(--cx, 50%) var(--cy, 0%), rgba(227,180,72,.16), transparent 60%); }
.tt-card:hover::before, .tt-card:focus-within::before { opacity: 1; }

.tt-auth .tt-field { transition: box-shadow .2s, background-color .2s, transform .2s; }
.tt-auth .tt-field:focus { background: #fff; box-shadow: 0 0 0 1.5px ${GOLD}, 0 0 0 5px rgba(227,180,72,.18) !important; outline: none; }
.tt-auth .tt-field-wrap:focus-within .tt-field-icon { color: #b8862a; transform: scale(1.1); }
.tt-field-icon { transition: color .2s, transform .2s; }
.tt-auth button[role="checkbox"] { min-height: 0; }
.tt-auth button[role="checkbox"][data-state="checked"] { background: ${GOLD}; border-color: ${GOLD}; color: ${NAVY}; }

.tt-btn { position: relative; overflow: hidden; background: linear-gradient(135deg, #f0c766 0%, ${GOLD} 45%, #cf9c33 100%); color: ${NAVY};
  box-shadow: 0 10px 24px -8px rgba(227,180,72,.7), inset 0 1px 0 rgba(255,255,255,.45); }
.tt-btn::after { content: ''; position: absolute; top: 0; left: -75%; width: 50%; height: 100%; transform: skewX(-20deg);
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent); transition: left .7s ease; }
.tt-btn:hover::after { left: 130%; }
.tt-btn:hover { transform: translateY(-1px); box-shadow: 0 14px 30px -8px rgba(227,180,72,.85), inset 0 1px 0 rgba(255,255,255,.45); }

.tt-live { position: relative; }
.tt-live::after { content: ''; position: absolute; inset: -3px; border-radius: 9999px; border: 2px solid #34d399; animation: tt-ping 1.8s cubic-bezier(0,0,.2,1) infinite; }
@keyframes tt-ping { 75%, 100% { transform: scale(2); opacity: 0; } }

@media (prefers-reduced-motion: reduce) {
  .tt-auth *, .tt-auth *::before, .tt-auth *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .001ms !important; }
  .tt-spark, .tt-spotlight { display: none; }
}
`;

/** Little "live" notification cards that float around the brand panel on large screens. */
const FLOATING_CARDS = [
    { icon: CheckCircle2, tone: '#34d399', title: 'Timesheet approved', meta: 'Week 48 · 40.0 h', className: 'top-[16%] right-[6%]', tilt: '3deg', delay: '0s' },
    { icon: Receipt, tone: GOLD, title: 'Invoice paid', meta: 'INV-0042 · Acme Ltd', className: 'top-[46%] right-[-2%]', tilt: '-2deg', delay: '1.2s' },
    { icon: Ticket, tone: '#60a5fa', title: 'Ticket resolved', meta: 'ICT · 12 min ago', className: 'bottom-[14%] right-[12%]', tilt: '2deg', delay: '2.4s' },
];

const FEATURES = [
    { icon: BarChart3, label: 'Projects' },
    { icon: Clock3, label: 'Timesheets' },
    { icon: Receipt, label: 'Invoices' },
    { icon: Ticket, label: 'ICT Tickets' },
    { icon: ShieldCheck, label: 'ERP' },
];

/** Deterministic sparks so the layout does not jump between renders. */
const SPARKS = Array.from({ length: 18 }, (_, i) => ({
    left: `${(i * 37 + 11) % 100}%`,
    duration: `${9 + ((i * 7) % 9)}s`,
    delay: `${(i * 1.3) % 12}s`,
    size: i % 3 === 0 ? 4 : 2,
}));

function RotatingWord() {
    const [index, setIndex] = useState(0);
    useEffect(() => {
        const timer = window.setInterval(() => setIndex((i) => (i + 1) % ROTATING_WORDS.length), 2200);
        return () => window.clearInterval(timer);
    }, []);

    return (
        <span className="inline-block min-w-[7.5ch] [perspective:400px]" aria-live="off">
            <span key={index} className="tt-word font-semibold" style={{ color: GOLD }}>{ROTATING_WORDS[index]}.</span>
        </span>
    );
}

export default function AuthLayout({
    children,
    title,
    description,
    icon,
    status,
    statusType = 'success',
}: AuthLayoutProps) {
    const { i18n } = useTranslation();
    const [mounted, setMounted] = useState(false);
    const { logoLight, logoDark, themeColor, customColor } = useBrand();
    const rootRef = useRef<HTMLDivElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);

    const { globalSettings } = usePage().props as any;

    // The sign-in screen always sits on a dark backdrop, so prefer the light logo.
    const currentLogo = logoLight || logoDark;
    const primaryColor = themeColor === 'custom' ? customColor : THEME_COLORS[themeColor as keyof typeof THEME_COLORS];
    const footer = globalSettings?.footerText || `© ${new Date().getFullYear()} Team Truth. All rights reserved.`;

    // RTL Support for auth pages - Apply immediately and persist
    const applyRTLDirection = React.useCallback(() => {
        const isDemo = globalSettings?.is_demo || false;
        const currentLang = i18n.language || globalSettings?.defaultLanguage || 'en';
        const isRTLLanguage = ['ar', 'he'].includes(currentLang);
        let dir = 'ltr';

        let data = getCookie('brandSettings');
        if (data) {
            try {
                const parsed = JSON.parse(data);
                data = parsed.layoutDirection;
            } catch (error) {
                data = null;
            }
        }

        const layoutDirection = isDemo ? data : globalSettings?.layoutDirection;
        const isRTLSetting = layoutDirection === 'right';

        if (isRTLLanguage || isRTLSetting) {
            dir = 'rtl';
        }

        document.documentElement.dir = dir;
        document.documentElement.setAttribute('dir', dir);
        document.body.dir = dir;

        return dir;
    }, [i18n.language, globalSettings?.defaultLanguage, globalSettings?.is_demo, globalSettings?.layoutDirection]);

    React.useLayoutEffect(() => {
        const direction = applyRTLDirection();

        const observer = new MutationObserver(() => {
            if (document.documentElement.dir !== direction) {
                document.documentElement.dir = direction;
                document.documentElement.setAttribute('dir', direction);
            }
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['dir'],
        });

        return () => {
            observer.disconnect();
            document.documentElement.dir = 'ltr';
            document.documentElement.setAttribute('dir', 'ltr');
            document.body.dir = 'ltr';
        };
    }, [applyRTLDirection]);

    // Apply theme mode (dark/light) so the rest of the app keeps the saved preference.
    React.useEffect(() => {
        let themeMode = 'light';

        if (isDemoMode()) {
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
            themeMode = globalSettings?.themeMode || 'light';
        }

        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const isDark = themeMode === 'dark' || (themeMode === 'system' && prefersDark);

        document.documentElement.classList.toggle('dark', isDark);
        document.body.classList.toggle('dark', isDark);
    }, [globalSettings?.themeMode]);

    useLayoutEffect(() => {
        const isDemo = globalSettings?.is_demo || false;

        if (isDemo) {
            const savedLanguage = localStorage.getItem('i18nextLng');
            if (savedLanguage && i18n.language !== savedLanguage) {
                i18n.changeLanguage(savedLanguage);
            }
        }

        setMounted(true);
    }, [globalSettings, i18n]);

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

    // Pointer spotlight: write CSS variables straight to the DOM so moving the mouse never re-renders React.
    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.pointerType !== 'mouse') return;
        rootRef.current?.style.setProperty('--mx', `${e.clientX}px`);
        rootRef.current?.style.setProperty('--my', `${e.clientY}px`);
        const card = cardRef.current;
        if (card) {
            const rect = card.getBoundingClientRect();
            card.style.setProperty('--cx', `${e.clientX - rect.left}px`);
            card.style.setProperty('--cy', `${e.clientY - rect.top}px`);
        }
    };

    return (
        <div
            ref={rootRef}
            onPointerMove={handlePointerMove}
            className="tt-auth relative min-h-screen w-full overflow-hidden"
        >
            <Head title={title} />
            <style>{AUTH_STYLES}</style>

            {/* ── Animated backdrop ── */}
            <div aria-hidden className="fixed inset-0">
                <div className="tt-auth-aurora">
                    <div className="tt-blob tt-blob-1" />
                    <div className="tt-blob tt-blob-2" />
                    <div className="tt-blob tt-blob-3" />
                    <div className="tt-blob tt-blob-4" />
                </div>
                <div className="tt-grid" />
                <div className="tt-spotlight" />
                {SPARKS.map((spark, i) => (
                    <span
                        key={i}
                        className="tt-spark"
                        style={{ left: spark.left, animationDuration: spark.duration, animationDelay: spark.delay, width: spark.size, height: spark.size }}
                    />
                ))}
                <div className="tt-noise" />
            </div>

            {/* Language switcher */}
            <div className="absolute top-4 right-4 z-30 sm:top-5 sm:right-5">
                <LanguageSwitcher />
            </div>

            <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
                {/* ── Brand panel ── */}
                <section className="relative hidden flex-col px-12 py-12 lg:flex xl:px-16">
                    <div className="tt-reveal flex items-center gap-3" style={{ animationDelay: '.05s' }}>
                        {currentLogo ? (
                            <img src={currentLogo} alt="Team Truth" className="h-10 w-auto" />
                        ) : (
                            <BrandMark />
                        )}
                    </div>

                    <div className="relative my-auto max-w-xl">
                        {/* Orbit decoration behind the headline */}
                        <div aria-hidden className="tt-orbit -left-24 -top-24 h-[30rem] w-[30rem]" />
                        <div aria-hidden className="tt-orbit -left-8 -top-8 h-[22rem] w-[22rem]" style={{ animationDirection: 'reverse', animationDuration: '45s' }} />

                        <div className="tt-reveal mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/75 backdrop-blur" style={{ animationDelay: '.15s' }}>
                            <span className="tt-live h-2 w-2 rounded-full bg-emerald-400" />
                            All systems running
                        </div>

                        <h2 className="text-5xl font-extrabold leading-[1.05] tracking-tight text-white xl:text-6xl">
                            <span className="tt-reveal block" style={{ animationDelay: '.25s' }}>Manage.</span>
                            <span className="tt-reveal block" style={{ animationDelay: '.4s' }}><span className="tt-shimmer">Collaborate.</span></span>
                            <span className="tt-reveal block" style={{ animationDelay: '.55s' }}>Deliver.</span>
                        </h2>

                        <p className="tt-reveal mt-6 max-w-md text-lg leading-relaxed text-white/65" style={{ animationDelay: '.7s' }}>
                            One workspace for your <RotatingWord /><br />
                            Built for every team, every subsidiary.
                        </p>

                        <div className="mt-9 flex flex-wrap gap-2">
                            {FEATURES.map(({ icon: Icon, label }, i) => (
                                <span
                                    key={label}
                                    className="tt-reveal group inline-flex cursor-default items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-white/75 backdrop-blur transition-colors hover:border-[#E3B448]/60 hover:bg-[#E3B448]/10 hover:text-white"
                                    style={{ animationDelay: `${0.85 + i * 0.08}s` }}
                                >
                                    <Icon className="h-3.5 w-3.5 text-[#E3B448] transition-transform group-hover:scale-110" />
                                    {label}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Floating notification cards */}
                    {FLOATING_CARDS.map(({ icon: Icon, tone, title: cardTitle, meta, className, tilt, delay }) => (
                        <div
                            key={cardTitle}
                            aria-hidden
                            className={`absolute hidden xl:block ${className}`}
                        >
                            <div className="tt-reveal" style={{ animationDelay: `calc(1.1s + ${delay})` }}>
                                <div
                                    className="tt-float flex items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-3 shadow-2xl backdrop-blur-md"
                                    style={{ '--tilt': tilt, animationDelay: delay } as React.CSSProperties}
                                >
                                    <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${tone}22`, color: tone }}>
                                        <Icon className="h-5 w-5" />
                                    </span>
                                    <span className="leading-tight">
                                        <span className="block text-sm font-semibold text-white">{cardTitle}</span>
                                        <span className="block text-xs text-white/55">{meta}</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}

                    <p className="tt-reveal text-xs text-white/35" style={{ animationDelay: '1.2s' }}>{footer}</p>
                </section>

                {/* ── Form panel ── */}
                <section className="flex min-h-screen flex-col items-center justify-center px-4 pb-10 pt-20 sm:px-6 lg:py-12">
                    {/* Compact brand for phones and tablets */}
                    <div className="tt-reveal mb-8 flex flex-col items-center text-center lg:hidden">
                        {currentLogo ? (
                            <img src={currentLogo} alt="Team Truth" className="mb-4 h-10 w-auto" />
                        ) : (
                            <BrandMark />
                        )}
                        <p className="mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                            Manage. <span className="tt-shimmer">Collaborate.</span> Deliver.
                        </p>
                    </div>

                    <div
                        className={`w-full max-w-md transition-all duration-700 ease-out ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}
                    >
                        <div className="tt-card-shell">
                            <div ref={cardRef} className="tt-card px-6 py-8 sm:px-9 sm:py-10">
                                <div className="relative mb-7">
                                    {icon && (
                                        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: `${primaryColor}20` }}>
                                            {icon}
                                        </div>
                                    )}
                                    <h1 className="text-2xl font-bold tracking-tight sm:text-[1.7rem]" style={{ color: NAVY }}>{title}</h1>
                                    {description && (
                                        <p className="mt-1.5 text-sm" style={{ color: 'rgba(0,26,77,0.55)' }}>{description}</p>
                                    )}
                                    <div className="mt-4 h-1 w-12 rounded-full" style={{ background: `linear-gradient(90deg, ${GOLD}, rgba(227,180,72,0))` }} />
                                </div>

                                {status && (
                                    <div className={`relative mb-5 rounded-xl border p-3 text-sm font-medium ${
                                        statusType === 'success'
                                            ? 'border-green-200 bg-green-50 text-green-700'
                                            : 'border-red-200 bg-red-50 text-red-700'
                                    }`}>{status}</div>
                                )}

                                <div className="relative">{children}</div>
                            </div>
                        </div>

                        <p className="mt-6 text-center text-xs text-white/40 lg:hidden">{footer}</p>
                    </div>
                </section>
            </div>

            <CookieConsentBanner />
        </div>
    );
}

/** Text logo used when no brand logo has been uploaded. */
function BrandMark() {
    return (
        <span className="inline-flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black shadow-lg" style={{ background: `linear-gradient(135deg, #f0c766, ${GOLD})`, color: NAVY }}>
                TT
            </span>
            <span className="text-2xl font-bold tracking-tight text-white">Team Truth</span>
        </span>
    );
}
