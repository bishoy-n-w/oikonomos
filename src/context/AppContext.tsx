import React, { createContext, useContext, useEffect, useState } from 'react';
import { type Language, isRtl as checkIsRtl, t } from '../services/i18n';

interface AppContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  isRtl: boolean;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  translate: (key: string) => string;
  mobileViewMode: 'tiles' | 'list';
  setMobileViewMode: (mode: 'tiles' | 'list') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('oikonomos_language') as Language) || 'en';
  });

  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    try {
      const savedTheme = localStorage.getItem('oikonomos_theme');
      if (savedTheme === 'light' || savedTheme === 'dark') {
        return savedTheme;
      }
      if (
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
      ) {
        return 'dark';
      }
    } catch {
      // Ignore storage or media-query errors in non-standard environments
    }
    return 'light';
  });

  const [mobileViewMode, setMobileViewModeState] = useState<'tiles' | 'list'>(() => {
    return (localStorage.getItem('oikonomos_mobile_view_mode') as 'tiles' | 'list') || 'tiles';
  });

  const isRtl = checkIsRtl(language);

  useEffect(() => {
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
    localStorage.setItem('oikonomos_language', language);
  }, [language, isRtl]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      try {
        const savedTheme = localStorage.getItem('oikonomos_theme');
        // Only react to system changes if user has not explicitly chosen a preference
        if (!savedTheme) {
          setThemeState(e.matches ? 'dark' : 'light');
        }
      } catch {
        // Fallback safely
      }
    };

    mediaQuery.addEventListener?.('change', handleChange);
    return () => {
      mediaQuery.removeEventListener?.('change', handleChange);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('oikonomos_mobile_view_mode', mobileViewMode);
  }, [mobileViewMode]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const setTheme = (newTheme: 'light' | 'dark') => {
    try {
      localStorage.setItem('oikonomos_theme', newTheme);
    } catch {
      // Ignore storage errors
    }
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      try {
        localStorage.setItem('oikonomos_theme', next);
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  const setMobileViewMode = (mode: 'tiles' | 'list') => {
    setMobileViewModeState(mode);
  };

  const translate = (key: string) => t(key, language);

  return (
    <AppContext.Provider
      value={{
        language,
        setLanguage,
        isRtl,
        theme,
        setTheme,
        toggleTheme,
        translate,
        mobileViewMode,
        setMobileViewMode,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
