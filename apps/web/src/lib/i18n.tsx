'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  DEFAULT_LOCALE,
  createTranslator,
  type MessageKey,
  type SupportedLocale,
  type TranslateValues,
} from '@storm-tips/ui';

/**
 * The product ships one language, so this is a thin wrapper rather than a
 * switcher: it exists so components keep calling `t(...)` instead of reaching
 * into a catalogue, which is what a second language would come back through.
 */
interface I18nContextValue {
  locale: SupportedLocale;
  t: (key: MessageKey, values?: TranslateValues) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }): ReactNode {
  const value = useMemo<I18nContextValue>(
    () => ({ locale: DEFAULT_LOCALE, t: createTranslator(DEFAULT_LOCALE) }),
    [],
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
