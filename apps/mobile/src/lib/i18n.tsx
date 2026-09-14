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
 * switcher: it exists so screens keep calling `t(...)` instead of reaching into
 * a catalogue, which is what a second language would come back through.
 */
interface I18nValue {
  locale: SupportedLocale;
  t: (key: MessageKey, values?: TranslateValues) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }): ReactNode {
  const value = useMemo<I18nValue>(
    () => ({ locale: DEFAULT_LOCALE, t: createTranslator(DEFAULT_LOCALE) }),
    [],
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
