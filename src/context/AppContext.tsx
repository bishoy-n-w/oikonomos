import React, { createContext, useContext, useEffect, useState } from 'react';
import { type Language, isRtl as checkIsRtl, t } from '../services/i18n';

interface AppContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  isRtl: boolean;
  theme: 'light' | 'dark';
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
    return (localStorage.getItem('oikonomos_theme') as 'light' | 'dark') || 'light';
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
    localStorage.setItem('oikonomos_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('oikonomos_mobile_view_mode', mobileViewMode);
  }, [mobileViewMode]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
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
