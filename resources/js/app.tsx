// RTL is now handled by app.blade.php and LayoutContext

import '../css/app.css';
import '../css/dark-mode.css';

import { createInertiaApp, router } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { lazy, Suspense } from 'react';
import { LayoutProvider } from './contexts/LayoutContext';
import { SidebarProvider } from './contexts/SidebarContext';
import { BrandProvider } from './contexts/BrandContext';
import { ModalStackProvider } from './contexts/ModalStackContext';


import { initializeTheme } from './hooks/use-appearance';
import { CustomToast } from './components/custom-toast';
import { initializeGlobalSettings } from './utils/globalSettings';
import i18n from './i18n'; // Import i18n configuration
import './utils/axios-config'; // Import axios configuration
import { getCookie, isDemoMode } from './utils/cookie-utils';


const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

// const syncLanguage = (pageProps: any) => {
//     const userLanguage = pageProps?.props?.userLanguage;
    
//     if (userLanguage && i18n.language !== userLanguage) {
//         i18n.changeLanguage(userLanguage);
//     }
// };

createInertiaApp({
        
    resolve: (name) => resolvePageComponent(`./pages/${name}.tsx`, import.meta.glob('./pages/**/*.tsx')),
    setup({ el, App, props }) {
        const root = createRoot(el);
        
        // Make page data globally available for axios interceptor
        try {
            (window as any).page = props.initialPage;
        } catch (e) {
            console.warn('Could not set global page data:', e);
        }
        
        // Set demo mode globally
        try {
            (window as any).isDemo = props.initialPage.props?.is_demo || false;
        } catch (e) {
            // Ignore errors
        }

        // Sync language from database when not in demo mode
        const syncLanguage = (pageProps: any) => {
            // Don't sync language in demo mode - let cookies/localStorage handle it
            if (isDemoMode()) {
                return;
            }
            
            const userLanguage = pageProps?.props?.userLanguage;
            const layoutDirection = pageProps?.props?.globalSettings?.layoutDirection;
            
            if (userLanguage) {
                // Always keep dir=ltr for proper sidebar functionality
                // RTL content will be handled by CSS and layoutDirection setting
                document.documentElement.dir = 'ltr';
                document.documentElement.setAttribute('dir', 'ltr');

                if (i18n.language !== userLanguage) {
                    i18n.changeLanguage(userLanguage);
                }
            }
        };

        // Initial language sync
        syncLanguage(props.initialPage);
        
        // Sync language on initial load
        // syncLanguage(props.initialPage);
        
        // Initialize global settings from shared data
        const globalSettings = props.initialPage.props.globalSettings || {};
        if (Object.keys(globalSettings).length > 0) {
            initializeGlobalSettings(globalSettings);
        }
        
        // Listen for language changes
        i18n.on('languageChanged', (lng) => {
            // Language changes are handled by LayoutContext
        });

        // Create a memoized render function to prevent unnecessary re-renders
        const renderApp = (appProps: any) => {
            const currentGlobalSettings = appProps.initialPage.props.globalSettings || {};
            const user = appProps.initialPage.props.auth?.user;
            
            return (
                <ModalStackProvider>
                        <LayoutProvider>
                            <SidebarProvider globalSettings={currentGlobalSettings} workspaceId={user?.current_workspace_id}>
                                <BrandProvider globalSettings={currentGlobalSettings} user={user}>
                                    <Suspense fallback={<div className="flex h-screen w-full items-center justify-center">Loading...</div>}>
                                        <App {...appProps} />
                                    </Suspense>
                                    <CustomToast />
                                </BrandProvider>
                            </SidebarProvider>
                        </LayoutProvider>
                    </ModalStackProvider>
            );
        };
        
        // Initial render
        root.render(renderApp(props));
        
        // Update global page data on navigation and re-render with new settings
        router.on('navigate', (event) => {
            try {
                // Check if user just logged in in demo mode - do this FIRST before any render
                const isDemo = isDemoMode();
                const currentUrl = event.detail.page.url;
                const wasOnAuthPage = sessionStorage.getItem('wasOnAuthPage') === 'true';
                const isNowAuthenticated = event.detail.page.props?.auth?.user;
                
                // Track if we're on an auth page
                if (currentUrl.includes('/login') || currentUrl.includes('/register') || currentUrl.includes('/forgot-password')) {
                    sessionStorage.setItem('wasOnAuthPage', 'true');
                } else if (isNowAuthenticated && wasOnAuthPage && isDemo) {
                    // User just logged in from auth page in demo mode - reload immediately
                    sessionStorage.removeItem('wasOnAuthPage');
                    // window.location.reload();
                    return;
                } else {
                    sessionStorage.removeItem('wasOnAuthPage');
                }
                
                (window as any).page = event.detail.page;
                
                // Sync language on navigation
                // syncLanguage(event.detail.page);
                
                // Re-render with updated props including globalSettings
                root.render(renderApp({ initialPage: event.detail.page }));

                // Sync language from database on navigation AFTER render
                setTimeout(() => {
                    syncLanguage(event.detail.page);
                    
                    // Force layout direction update after login (only in non-demo mode)
                    if (!isDemoMode()) {
                        const globalSettings = event.detail.page?.props?.globalSettings;
                        if (globalSettings?.layoutDirection) {
                            const layoutDirection = globalSettings.layoutDirection;
                            // Dispatch custom event to force LayoutContext update
                            window.dispatchEvent(new CustomEvent('layoutDirectionChanged', {
                                detail: { direction: layoutDirection }
                            }));
                        }
                    }
                }, 0);

                // Force dark mode check on navigation
                let savedTheme = null;

                if (isDemoMode()) {
                    savedTheme = getCookie('themeSettings');
                }

                if (savedTheme) {
                    const themeSettings = JSON.parse(savedTheme);
                    const isDark = themeSettings.appearance === 'dark' ||
                        (themeSettings.appearance === 'system' &&
                            window.matchMedia('(prefers-color-scheme: dark)').matches);
                    document.documentElement.classList.toggle('dark', isDark);
                    document.body.classList.toggle('dark', isDark);
                }
                
            } catch (e) {
                console.error('Navigation error:', e);
            }
        });
    },
    progress: {
        color: '#4B5563',
    },
});



// Initialize theme on all pages
initializeTheme();