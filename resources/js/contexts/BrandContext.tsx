import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getBrandSettings, type BrandSettings } from '@/pages/settings/components/brand-settings';
import { initializeTheme } from '@/hooks/use-appearance';

interface BrandContextType extends BrandSettings {
  updateBrandSettings: (settings: Partial<BrandSettings>) => void;
}

const BrandContext = createContext<BrandContextType | undefined>(undefined);

export function BrandProvider({ children, globalSettings, user }: { children: ReactNode; globalSettings?: any; user?: any }) {
  // Check if in demo mode
  const isDemoMode = globalSettings?.is_demo || 
                     (window as any).page?.props?.is_demo || 
                     (window as any).appSettings?.isDemoMode || 
                     (window as any).isDemo || false;
  
  // Determine which settings to use based on user role and route
  const getEffectiveSettings = () => {
    const isPublicRoute = window.location.pathname.includes('/public/') || 
                         window.location.pathname === '/' || 
                         window.location.pathname.includes('/auth/');
    
    // For public routes (landing page, auth pages), always use superadmin settings
    if (isPublicRoute) {
      return globalSettings;
    }
    
    // Check if SaaS mode is enabled
    const isSaasMode = globalSettings?.is_saas_mode === '1' || globalSettings?.is_saas_mode === 1 || globalSettings?.is_saas_mode === true;
    
    // For authenticated routes in SaaS mode, use user's own settings if company role
    if (isSaasMode && user?.role === 'company' && user?.globalSettings) {
      return user.globalSettings;
    }
    
    // For non-SaaS mode, globalSettings already contains workspace-specific settings from middleware
    // Default to global settings
    return globalSettings;
  };
  
  const [brandSettings, setBrandSettings] = useState<BrandSettings>(() => {
    const effectiveSettings = getEffectiveSettings();
    const settings = getBrandSettings(effectiveSettings, isDemoMode);
    return settings;
  });



  // Listen for changes in settings
  useEffect(() => {
    const effectiveSettings = getEffectiveSettings();
    const updatedSettings = getBrandSettings(effectiveSettings, isDemoMode);
    setBrandSettings(updatedSettings);
  }, [globalSettings, user, isDemoMode]);

  // Listen for workspace switch to immediately apply new brand settings
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const { globalSettings: newGs } = e.detail;
      const updatedSettings = getBrandSettings(newGs, isDemoMode);
      setBrandSettings(updatedSettings);
      // Apply theme (color + dark/light mode) immediately
      initializeTheme();
    };
    window.addEventListener('workspaceSwitched', handler as EventListener);
    return () => window.removeEventListener('workspaceSwitched', handler as EventListener);
  }, [isDemoMode]);

  const updateBrandSettings = (newSettings: Partial<BrandSettings>) => {
    setBrandSettings(prev => ({ ...prev, ...newSettings }));
  };

  return (
    <BrandContext.Provider value={{ ...brandSettings, updateBrandSettings }}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  const context = useContext(BrandContext);
  if (context === undefined) {
    throw new Error('useBrand must be used within a BrandProvider');
  }
  return context;
}