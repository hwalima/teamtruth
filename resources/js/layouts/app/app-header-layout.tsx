import { AppContent } from '@/components/app-content';
import { AppHeader } from '@/components/app-header';
import { AppShell } from '@/components/app-shell';
import { type BreadcrumbItem } from '@/types';
import type { PropsWithChildren } from 'react';
import { useState } from 'react';

export default function AppHeaderLayout({ children, breadcrumbs }: PropsWithChildren<{ breadcrumbs?: BreadcrumbItem[] }>) {
    const [sidebarDrawerOpen, setSidebarDrawerOpen] = useState(false);

    return (
        <AppShell enableSidebarDrawer>
            <AppHeader breadcrumbs={breadcrumbs} sidebarDrawerOpen={sidebarDrawerOpen} setSidebarDrawerOpen={setSidebarDrawerOpen} />
            <AppContent>{children}</AppContent>
        </AppShell>
    );
}
