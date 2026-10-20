import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from './LanguageContext';
import { Globe, Check, ChevronUp } from 'lucide-react';

export function FlagIcon({ code, className = "w-4 h-2.5" }: { code: string; className?: string }) {
  if (code === 'en') {
    return (
      <svg className={`${className} shrink-0 rounded-[1.5px] shadow-xs border border-white/20`} viewBox="0 0 60 30" aria-hidden="true">
        <clipPath id="uk-flag-clip"><rect width="60" height="30" rx="2"/></clipPath>
        <g clipPath="url(#uk-flag-clip)">
          <path d="M0,0 v30 h60 v-30 z" fill="#012169"/>
          <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6"/>
          <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="4"/>
          <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10"/>
          <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6"/>
        </g>
      </svg>
    );
  }
  if (code === 'zh') {
    return (
      <svg className={`${className} shrink-0 rounded-[1.5px] shadow-xs border border-white/20`} viewBox="0 0 30 20" aria-hidden="true">
        <rect width="30" height="20" fill="#DE2910" rx="1.5"/>
        <polygon fill="#FFDE00" points="5,2 6.18,5.63 10,5.63 6.91,7.88 8.09,11.51 5,9.26 1.91,11.51 3.09,7.88 0,5.63 3.82,5.63"/>
        <polygon fill="#FFDE00" points="10,2 10.3,3 11.3,3 10.5,3.6 10.8,4.6 10,4 9.2,4.6 9.5,3.6 8.7,3 9.7,3" transform="rotate(-30 10 3)"/>
        <polygon fill="#FFDE00" points="12,4 12.3,5 13.3,5 12.5,5.6 12.8,6.6 12,6 11.2,6.6 11.5,5.6 10.7,5 11.7,5" transform="rotate(-10 12 5)"/>
        <polygon fill="#FFDE00" points="12,7 12.3,8 13.3,8 12.5,8.6 12.8,9.6 12,9 11.2,9.6 11.5,8.6 10.7,8 11.7,8" transform="rotate(10 12 8)"/>
        <polygon fill="#FFDE00" points="10,9 10.3,10 11.3,10 10.5,10.6 10.8,11.6 10,11 9.2,11.6 9.5,10.6 8.7,10 9.7,10" transform="rotate(30 10 10)"/>
      </svg>
    );
  }
  if (code === 'de') {
    return (
      <svg className={`${className} shrink-0 rounded-[1.5px] shadow-xs border border-white/20`} viewBox="0 0 5 3" aria-hidden="true">
        <rect width="5" height="1" y="0" fill="#000000"/>
        <rect width="5" height="1" y="1" fill="#DD0000"/>
        <rect width="5" height="1" y="2" fill="#FFCE00"/>
      </svg>
    );
  }
  if (code === 'es') {
    return (
      <svg className={`${className} shrink-0 rounded-[1.5px] shadow-xs border border-white/20`} viewBox="0 0 6 4" aria-hidden="true">
        <rect width="6" height="1" y="0" fill="#AA151B"/>
        <rect width="6" height="2" y="1" fill="#F1BF00"/>
        <rect width="6" height="1" y="3" fill="#AA151B"/>
      </svg>
    );
  }
  if (code === 'fr') {
    return (
      <svg className={`${className} shrink-0 rounded-[1.5px] shadow-xs border border-white/20`} viewBox="0 0 3 2" aria-hidden="true">
        <rect width="1" height="2" x="0" fill="#002654"/>
        <rect width="1" height="2" x="1" fill="#FFFFFF"/>
        <rect width="1" height="2" x="2" fill="#CE1126"/>
      </svg>
    );
  }
  if (code === 'it') {
    return (
      <svg className={`${className} shrink-0 rounded-[1.5px] shadow-xs border border-white/20`} viewBox="0 0 3 2" aria-hidden="true">
        <rect width="1" height="2" x="0" fill="#009246"/>
        <rect width="1" height="2" x="1" fill="#FFFFFF"/>
        <rect width="1" height="2" x="2" fill="#CE2B37"/>
      </svg>
    );
  }
  return null;
}

export default function LanguageSelector() {
  const { locale, setLocale, supportedLanguages, currentLanguage, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Dropdown Popup Menu (opens upward from the sidebar footer) */}
      {isOpen && (
        <div 
          className="absolute bottom-full left-0 mb-2 w-56 bg-slate-900 border border-slate-700/80 rounded-lg shadow-2xl py-1.5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 backdrop-blur-md"
          role="menu"
          aria-orientation="vertical"
        >
          <div className="px-3 py-1.5 border-b border-slate-800 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>{t('language', 'Language')}</span>
            <span className="text-slate-500 font-mono text-[9px]">i18n</span>
          </div>

          <div className="py-1">
            {supportedLanguages
              .filter((lang) => lang.isAvailable)
              .map((lang) => {
                const isSelected = lang.code === locale;

                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      setLocale(lang.code);
                      setIsOpen(false);
                    }}
                    className={`w-full px-3 py-1.5 flex items-center justify-between text-left transition-colors text-[11px] ${
                      isSelected
                        ? 'bg-brand-600/30 text-white font-medium border-l-2 border-brand-400'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                    role="menuitem"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <FlagIcon code={lang.code} className="w-5 h-3.5" />
                      <div className="flex flex-col text-left truncate">
                        <span className="truncate">{lang.nativeName}</span>
                        <span className="text-[9px] text-slate-400 truncate">{lang.name}</span>
                      </div>
                    </div>

                    <div className="flex items-center pl-2 shrink-0">
                      {isSelected && (
                        <Check size={14} className="text-brand-400" />
                      )}
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* Trigger Button at Bottom of Sidebar */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className={`w-full px-2.5 py-1.5 flex items-center justify-between rounded text-[11px] transition-all duration-150 ${
          isOpen
            ? 'bg-slate-800 text-white ring-1 ring-brand-500/50'
            : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
        }`}
        title={`${t('language', 'Language')}: ${currentLanguage.nativeName}`}
      >
        <div className="flex items-center gap-2 truncate">
          <Globe size={14} className="text-brand-400 shrink-0" />
          <span className="truncate font-medium">{currentLanguage.nativeName}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-400 shrink-0">
          <FlagIcon code={currentLanguage.code} className="w-4 h-2.5" />
          <ChevronUp 
            size={12} 
            className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-brand-400' : ''}`} 
          />
        </div>
      </button>
    </div>
  );
}
