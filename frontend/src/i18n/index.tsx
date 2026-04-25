import { useState, useCallback, useEffect, createContext, useContext, ReactNode } from 'react';
import {
  Language,
  messages,
  defaultLanguage,
  getNestedValue,
  formatMessage,
  LocaleMessages,
} from './messages';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  messages: LocaleMessages;
}

const I18nContext = createContext<I18nContextType | null>(null);

const STORAGE_KEY = 'app-language';

function getStoredLanguage(): Language {
  if (typeof window === 'undefined') {
    return defaultLanguage;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (stored === 'zh-CN' || stored === 'en-US')) {
      return stored;
    }
  } catch {
    // localStorage access failed in restricted environment
  }

  const browserLang = navigator.language;
  if (browserLang.startsWith('zh')) {
    return 'zh-CN';
  }

  return defaultLanguage;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getStoredLanguage);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // localStorage access failed in restricted environment
    }
    document.documentElement.lang = lang;
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const currentMessages = messages[language];
      let message = getNestedValue(currentMessages, key);

      if (params) {
        message = formatMessage(message, params);
      }

      return message;
    },
    [language]
  );

  const value: I18nContextType = {
    language,
    setLanguage,
    t,
    messages: messages[language],
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n(): I18nContextType {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTranslation() {
  const { t, language } = useI18n();
  return { t, language };
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage() {
  const { language, setLanguage } = useI18n();
  return { language, setLanguage };
}

// eslint-disable-next-line react-refresh/only-export-components
export { languageNames } from './messages';
export type { Language } from './messages';
