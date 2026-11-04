import React, { createContext, useContext, useState, useEffect } from 'react';
import { logoBase64 } from '../shared/logoBase64';

export const CUSTOM_LOGO_STORAGE_KEY = 'app_custom_logo';
export const DEFAULT_LOGO_STORAGE_KEY = 'app_default_logo';
export const LOGO_WIDTH_STORAGE_KEY = 'app_logo_width';
export const DEFAULT_LOGO_WIDTH = 100; // Percentage of available sidebar width (100% = full width)

export function getStoredDefaultLogo(): string {
  try {
    const val = localStorage.getItem(DEFAULT_LOGO_STORAGE_KEY);
    // If it's the legacy Jiuzhou logo, remove it so the new standard logo displays
    if (val && val.startsWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA3sAAAF/')) {
      localStorage.removeItem(DEFAULT_LOGO_STORAGE_KEY);
      return logoBase64;
    }
    if (val && val.startsWith('data:image/')) return val;
  } catch {
    // fallback
  }
  return logoBase64;
}

export function getStoredCustomLogo(): string | null {
  try {
    const val = localStorage.getItem(CUSTOM_LOGO_STORAGE_KEY);
    // If it's the legacy Jiuzhou logo, remove it so the new standard logo displays
    if (val && val.startsWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA3sAAAF/')) {
      localStorage.removeItem(CUSTOM_LOGO_STORAGE_KEY);
      return null;
    }
    return val;
  } catch {
    return null;
  }
}

export function getStoredLogoWidth(): number {
  try {
    const val = localStorage.getItem(LOGO_WIDTH_STORAGE_KEY);
    if (val !== null) {
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed) && parsed >= 40 && parsed <= 100) {
        return parsed;
      }
    }
  } catch {
    // fallback
  }
  return DEFAULT_LOGO_WIDTH;
}

export function getActiveLogo(): string {
  const custom = getStoredCustomLogo();
  if (custom) return custom;
  return getStoredDefaultLogo();
}

interface BrandingContextType {
  customLogo: string | null;
  activeLogo: string;
  defaultLogo: string;
  isCustom: boolean;
  logoWidth: number;
  setLogoWidth: (width: number) => void;
  resetLogoWidth: () => void;
  setCustomLogo: (base64: string) => void;
  makeCurrentLogoDefault: () => void;
  resetToDefaultLogo: () => void;
  restoreFactoryLogo: () => void;
  isBrandingModalOpen: boolean;
  openBrandingModal: () => void;
  closeBrandingModal: () => void;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [defaultLogo, setDefaultLogoState] = useState<string>(() => getStoredDefaultLogo());
  const [customLogo, setCustomLogoState] = useState<string | null>(() => getStoredCustomLogo());
  const [logoWidth, setLogoWidthState] = useState<number>(() => getStoredLogoWidth());
  const [isBrandingModalOpen, setIsBrandingModalOpen] = useState(false);

  // Sync across tabs/windows (e.g. multi-window desktop or tab sync)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === CUSTOM_LOGO_STORAGE_KEY) {
        setCustomLogoState(e.newValue);
      } else if (e.key === DEFAULT_LOGO_STORAGE_KEY) {
        setDefaultLogoState(e.newValue || logoBase64);
      } else if (e.key === LOGO_WIDTH_STORAGE_KEY) {
        if (e.newValue !== null) {
          const val = parseInt(e.newValue, 10);
          if (!isNaN(val)) setLogoWidthState(val);
        } else {
          setLogoWidthState(DEFAULT_LOGO_WIDTH);
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const setCustomLogo = (base64: string) => {
    try {
      localStorage.setItem(CUSTOM_LOGO_STORAGE_KEY, base64);
    } catch (e) {
      console.warn('Failed to save custom logo to localStorage:', e);
    }
    setCustomLogoState(base64);
  };

  const makeCurrentLogoDefault = () => {
    const current = customLogo || defaultLogo;
    try {
      localStorage.setItem(DEFAULT_LOGO_STORAGE_KEY, current);
      localStorage.removeItem(CUSTOM_LOGO_STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to save default logo to localStorage:', e);
    }
    setDefaultLogoState(current);
    setCustomLogoState(null);
  };

  const resetToDefaultLogo = () => {
    try {
      localStorage.removeItem(CUSTOM_LOGO_STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to remove custom logo from localStorage:', e);
    }
    setCustomLogoState(null);
  };

  const restoreFactoryLogo = () => {
    try {
      localStorage.removeItem(DEFAULT_LOGO_STORAGE_KEY);
      localStorage.removeItem(CUSTOM_LOGO_STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to restore factory logo:', e);
    }
    setDefaultLogoState(logoBase64);
    setCustomLogoState(null);
  };

  const setLogoWidth = (width: number) => {
    const clamped = Math.max(40, Math.min(100, Math.round(width)));
    try {
      localStorage.setItem(LOGO_WIDTH_STORAGE_KEY, clamped.toString());
    } catch (e) {
      console.warn('Failed to save logo width to localStorage:', e);
    }
    setLogoWidthState(clamped);
  };

  const resetLogoWidth = () => {
    try {
      localStorage.removeItem(LOGO_WIDTH_STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to remove logo width from localStorage:', e);
    }
    setLogoWidthState(DEFAULT_LOGO_WIDTH);
  };

  const openBrandingModal = () => setIsBrandingModalOpen(true);
  const closeBrandingModal = () => setIsBrandingModalOpen(false);

  const activeLogo = customLogo || defaultLogo;
  const isCustom = !!customLogo && customLogo !== defaultLogo;

  return (
    <BrandingContext.Provider
      value={{
        customLogo,
        activeLogo,
        defaultLogo,
        isCustom,
        logoWidth,
        setLogoWidth,
        resetLogoWidth,
        setCustomLogo,
        makeCurrentLogoDefault,
        resetToDefaultLogo,
        restoreFactoryLogo,
        isBrandingModalOpen,
        openBrandingModal,
        closeBrandingModal
      }}
    >
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding(): BrandingContextType {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
}
