import React, { createContext, useContext, useState, useEffect } from 'react';
import { SupportedLocale, SUPPORTED_LANGUAGES, LanguageOption, translations } from './translations';

interface LanguageContextType {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: string, defaultVal?: string, params?: Record<string, string | number>) => string;
  supportedLanguages: LanguageOption[];
  currentLanguage: LanguageOption;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<SupportedLocale>(() => {
    const saved = localStorage.getItem('app_language');
    if (saved && (saved === 'en' || saved === 'zh' || saved === 'de' || saved === 'es' || saved === 'fr' || saved === 'it')) {
      return saved as SupportedLocale;
    }
    // Check browser language
    if (typeof navigator !== 'undefined' && navigator.language && navigator.language.startsWith('zh')) {
      return 'zh';
    }
    return 'en';
  });

  const setLocale = (newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
    localStorage.setItem('app_language', newLocale);
  };

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale === 'zh' ? 'zh-CN' : locale;
    }
  }, [locale]);

  const currentLanguage = SUPPORTED_LANGUAGES.find(l => l.code === locale) || SUPPORTED_LANGUAGES[0];

  const t = (key: string, defaultVal?: string, params?: Record<string, string | number>): string => {
    const langDict = translations[locale] || {};
    const fallbackDict = translations['en'] || {};
    
    let text = langDict[key] || fallbackDict[key] || defaultVal || key;

    if (params) {
      Object.entries(params).forEach(([paramKey, val]) => {
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(val));
      });
    }

    return text;
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t, supportedLanguages: SUPPORTED_LANGUAGES, currentLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};
