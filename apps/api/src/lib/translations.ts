import { mergeTranslations, type TranslationBundle } from '@storm-tips/types';

/**
 * Prepares a `translations` value for a Prisma write.
 *
 * Admin forms submit only the locale they are editing, so an update merges the
 * patch into what is stored rather than replacing it — editing the English name
 * must not silently drop a German one. Returns `undefined` when the request
 * carries no patch, which leaves the column untouched.
 */
export function translationPatch(
  current: unknown,
  patch: Record<string, Record<string, unknown>> | undefined,
): TranslationBundle | undefined {
  if (!patch) return undefined;
  return mergeTranslations(current, patch);
}
