'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setRequestLocale } from './api';
import {
  DEFAULT_LOCALE,
  createTranslator,
  resolveLocale,
  type MessageKey,
  type SupportedLocale,
  type TranslateValues,
} from '@storm-tips/ui';

const STORAGE_KEY = 'st.locale';

interface I18nContextValue {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: MessageKey, values?: TranslateValues) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }): ReactNode {
  const [locale, setLocaleState] = useState<SupportedLocale>(DEFAULT_LOCALE);

  // Resolve the locale on the client only, so SSR output stays deterministic.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    setLocaleState(resolveLocale(stored ?? navigator.language));
  }, []);

  // The API returns editorial content in this language, so it has to know it
  // before the first request, the document has to declare it, and anything
  // already fetched in the previous language has to be refetched.
  const queryClient = useQueryClient();
  const firstRun = useRef(true);
  useEffect(() => {
    setRequestLocale(locale);
    document.documentElement.lang = locale;
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    void queryClient.invalidateQueries();
  }, [locale, queryClient]);

  const setLocale = useCallback((next: SupportedLocale) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    setLocaleState(next);
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t: createTranslator(locale) }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside <I18nProvider>');
  return context;
}

/** Convenience hook for components that only need the translator. */
export function useT(): (key: MessageKey, values?: TranslateValues) => string {
  return useI18n().t;
}
