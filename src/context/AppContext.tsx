import React, { createContext, useContext, useEffect, useState } from 'react';
import { type Language, isRtl as checkIsRtl, t } from '../services/i18n';

interface AppContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  isRtl: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  translate: (key: string) => string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('oikonomos_language') as Language) || 'en';
  });

  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('oikonomos_theme') as 'light' | 'dark') || 'light';
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

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
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
