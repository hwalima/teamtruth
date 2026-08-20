import { createContext, ReactNode, useContext, useEffect, useState, useRef } from 'react';
import { setCookie, getCookie, isDemoMode } from '@/utils/cookie-utils';

export type LayoutPosition = 'left' | 'right';

type LayoutContextType = {
    position: LayoutPosition;
    effectivePosition: LayoutPosition;
    updatePosition: (val: LayoutPosition) => void;
    isRtl: boolean;
    saveLayoutPosition: (position: LayoutPosition) => void;
};

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export const LayoutProvider = ({ children }: { children: ReactNode }) => {
    const [position, setPosition] = useState<LayoutPosition>("left");
    const [isRtl, setIsRtl] = useState<boolean>(false);
    const isManualChange = useRef(false);
    const prevLayoutDirection = useRef<LayoutPosition | null>(null);

    useEffect(() => {
        // Don't override if user manually changed the position
        if (isManualChange.current) return;
        
        const isDemo = (window as any).page?.props?.globalSettings?.is_demo || false;
        let storedPosition: LayoutPosition | null = null;

        if (isDemo) {
            // In demo mode, use cookies
            const getCookieValue = (name: string): string | null => {
                if (typeof document === 'undefined') return null;
                const value = `; ${document.cookie}`;
                const parts = value.split(`; ${name}=`);
                if (parts.length === 2) {
                    const cookieValue = parts.pop()?.split(';').shift();
                    return cookieValue ? decodeURIComponent(cookieValue) : null;
                }
                return null;
            };
            
            // Try layoutDirection cookie first
            storedPosition = getCookieValue('layoutDirection') as LayoutPosition;
            
            // If not found, try brandSettings cookie
            if (!storedPosition) {
                const brandSettings = getCookieValue('brandSettings');
                if (brandSettings) {
                    try {
                        const parsed = JSON.parse(brandSettings);
                        storedPosition = parsed.layoutDirection as LayoutPosition;
                    } catch (error) {
                        console.error('[LayoutContext] Failed to parse brandSettings:', error);
                    }
                }
            }
        } else {
            // In normal mode, get from database via globalSettings
            const globalSettings = (window as any).page?.props?.globalSettings;
            storedPosition = globalSettings?.layoutDirection as LayoutPosition;
        }

        // Update position if it changed from database/cookies
        if ((storedPosition === 'left' || storedPosition === 'right') && storedPosition !== prevLayoutDirection.current) {
            prevLayoutDirection.current = storedPosition;
            setPosition(storedPosition);
        }

        // Check if the document is in RTL mode
        const checkRtl = () => {
            // Don't automatically set RTL based on document direction
            // Let the user's manual layout direction setting take precedence
            setIsRtl(false);
        };

        // Initial check
        checkRtl();

        // Set up a mutation observer to detect changes to the dir attribute
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'dir') {
                    checkRtl();
                }
            });
        });

        observer.observe(document.documentElement, { attributes: true });

        // Listen for layout direction change events
        const handleLayoutDirectionChange = (event: CustomEvent) => {
            const { direction } = event.detail;
            if (direction === 'left' || direction === 'right') {
                isManualChange.current = true;
                setPosition(direction);
            }
        };

        window.addEventListener('layoutDirectionChanged', handleLayoutDirectionChange as EventListener);

        // Listen for workspace switch to apply new layout direction
        const handleWorkspaceSwitched = (event: CustomEvent) => {
            const { globalSettings: newGs } = event.detail;
            const newDirection = newGs?.layoutDirection as LayoutPosition;
            if (newDirection === 'left' || newDirection === 'right') {
                isManualChange.current = false;
                prevLayoutDirection.current = newDirection;
                setPosition(newDirection);
            }
        };
        window.addEventListener('workspaceSwitched', handleWorkspaceSwitched as EventListener);

        return () => {
            observer.disconnect();
            window.removeEventListener('layoutDirectionChanged', handleLayoutDirectionChange as EventListener);
            window.removeEventListener('workspaceSwitched', handleWorkspaceSwitched as EventListener);
        };
    }, []);

    const updatePosition = (val: LayoutPosition) => {
        isManualChange.current = true;
        prevLayoutDirection.current = val;
        setPosition(val);
    };

    const saveLayoutPosition = (positionToSave?: LayoutPosition) => {
        const isDemo = (window as any).page?.props?.globalSettings?.is_demo || false;
        const posValue = positionToSave || position;
        

        if (isDemo) {
            const setCookie = (name: string, value: string, days = 365) => {
                if (typeof document === 'undefined') return;
                const maxAge = days * 24 * 60 * 60;
                document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${maxAge};SameSite=Lax`;
            };
            
            setCookie('layoutDirection', posValue);
            
            // Also update brandSettings cookie
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
            
            const currentBrandSettings = getCookie('brandSettings');
            let brandSettings = {};
            if (currentBrandSettings) {
                try {
                    brandSettings = JSON.parse(currentBrandSettings);
                } catch (error) {
                    console.error('[LayoutContext] Failed to parse brand settings', error);
                }
            }
            
            setCookie('brandSettings', JSON.stringify({
                ...brandSettings,
                layoutDirection: posValue
            }));
            
            // Reset manual change flag after saving to allow future updates
            prevLayoutDirection.current = posValue;
            setTimeout(() => {
                isManualChange.current = false;
            }, 100);
        }
    };

    // Calculate effective position based on RTL mode
    // const effectivePosition: LayoutPosition = position;

    const effectivePosition: LayoutPosition = position === 'right' ? 'right' : 'left';
    return <LayoutContext.Provider value={{ position, effectivePosition, updatePosition, saveLayoutPosition, isRtl }}>{children}</LayoutContext.Provider>;
};

export const useLayout = () => {
    const context = useContext(LayoutContext);
    if (!context) throw new Error('useLayout must be used within LayoutProvider');
    return context;
};
