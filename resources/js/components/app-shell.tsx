import { SidebarProvider } from '@/components/ui/sidebar';
import { useLayout } from '@/contexts/LayoutContext';
import { FloatingChatGpt } from '@/components/FloatingChatGpt';
import CookieConsentBanner from '@/components/cookie-consent-banner';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { AppSidebar } from '@/components/app-sidebar';

interface AppShellProps {
    children: React.ReactNode;
    variant?: 'header' | 'sidebar';
    enableSidebarDrawer?: boolean;
    sidebarDrawerOpen?: boolean;
    setSidebarDrawerOpen?: (open: boolean) => void;
}

export function AppShell({
    children,
    variant = 'header',
    enableSidebarDrawer = false,
    sidebarDrawerOpen,
    setSidebarDrawerOpen
}: AppShellProps) {
    const [isOpen, setIsOpen] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('sidebar') !== 'false' : true));
    const [drawerOpen, setDrawerOpen] = useState(false);

    const handleSidebarChange = (open: boolean) => {
        setIsOpen(open);

        if (typeof window !== 'undefined') {
            localStorage.setItem('sidebar', String(open));
        }
    };

    const { position } = useLayout();

    // Use controlled drawer state if provided, otherwise use internal state
    const isDrawerControlled = setSidebarDrawerOpen !== undefined;
    const currentDrawerOpen = isDrawerControlled ? sidebarDrawerOpen : drawerOpen;
    const currentSetDrawerOpen = isDrawerControlled ? setSidebarDrawerOpen : setDrawerOpen;

    if (variant === 'header') {
        return (
            <SidebarProvider defaultOpen={isOpen} open={isOpen} onOpenChange={handleSidebarChange}>
                <div className="flex min-h-screen w-full flex-col">
                    {children}
                    {/* Sidebar Drawer for header layout */}
                    {enableSidebarDrawer && (
                        <Sheet open={currentDrawerOpen} onOpenChange={currentSetDrawerOpen}>
                            <SheetContent side={position} className="w-72 max-w-[80vw] p-0">
                                <AppSidebar />
                            </SheetContent>
                        </Sheet>
                    )}
                    <FloatingChatGpt />
                    <CookieConsentBanner />
                </div>
            </SidebarProvider>
        );
    }

    return (
        <SidebarProvider defaultOpen={isOpen} open={isOpen} onOpenChange={handleSidebarChange}>
            <div className={cn('flex w-full overflow-x-hidden', position === 'right' ? 'flex-row-reverse' : 'flex-row')}>
                {children}
                <FloatingChatGpt />
                <CookieConsentBanner />
            </div>
        </SidebarProvider>
    );
}