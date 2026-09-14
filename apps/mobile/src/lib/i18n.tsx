import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getLocales } from 'expo-localization';
import {
  createTranslator,
  resolveLocale,
  type MessageKey,
  type SupportedLocale,
  type TranslateValues,
} from '@storm-tips/ui';
import { preferences } from './storage';

interface I18nValue {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: MessageKey, values?: TranslateValues) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }): ReactNode {
  const [locale, setLocaleState] = useState<SupportedLocale>(() =>
    resolveLocale(getLocales()[0]?.languageCode ?? undefined),
  );

  useEffect(() => {
    void preferences.get('locale').then((stored) => {
      if (stored) setLocaleState(resolveLocale(stored));
    });
  }, []);

  const setLocale = useCallback((next: SupportedLocale) => {
    setLocaleState(next);
    void preferences.set('locale', next);
  }, []);

  const value = useMemo<I18nValue>(
    () => ({ locale, setLocale, t: createTranslator(locale) }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside <I18nProvider>');
  return context;
}

export function useT(): (key: MessageKey, values?: TranslateValues) => string {
  return useI18n().t;
}
