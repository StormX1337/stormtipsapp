import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { LEGAL_FOOTNOTE, getLegalDocument, isLegalSlug } from '@storm-tips/ui';
import { theme } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';
import { Screen } from '@/components/layout';
import { EmptyState } from '@/components/primitives';

const { colors, fontSize, spacing } = theme;

/**
 * Legal and support documents.
 *
 * Rendered from the shared content module so the wording is identical on web
 * and on device, in both languages.
 */
export default function LegalScreen(): ReactNode {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t, locale } = useI18n();

  if (!slug || !isLegalSlug(slug)) {
    return (
      <Screen title={t('legal.help')} back>
        <EmptyState title={t('error.notFound')} />
      </Screen>
    );
  }

  const document = getLegalDocument(locale, slug);

  return (
    <Screen title={document.title} back>
      <View style={{ paddingTop: spacing[4] }}>
        <Text style={styles.h1}>{document.title}</Text>
        {document.intro ? <Text style={styles.p}>{document.intro}</Text> : null}

        {document.blocks.map((block, index) => {
          if (block.type === 'h2') {
            return (
              <Text key={index} style={styles.h2}>
                {block.text}
              </Text>
            );
          }
          if (block.type === 'h3') {
            return (
              <Text key={index} style={styles.h3}>
                {block.text}
              </Text>
            );
          }
          if (block.type === 'ul') {
            return (
              <View key={index} style={styles.list}>
                {block.items.map((item) => (
                  <View key={item} style={styles.listItem}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.listText}>{item}</Text>
                  </View>
                ))}
              </View>
            );
          }
          return (
            <Text key={index} style={styles.p}>
              {block.text}
            </Text>
          );
        })}

        <Text style={styles.footnote}>{LEGAL_FOOTNOTE[locale]}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { color: colors.text.primary, fontSize: fontSize['3xl'], fontWeight: '800' },
  h2: {
    marginTop: spacing[6],
    color: colors.text.primary,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  h3: {
    marginTop: spacing[4],
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  p: {
    marginTop: spacing[3],
    color: colors.text.secondary,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * 1.6,
  },
  list: { marginTop: spacing[3], gap: spacing[1.5] },
  listItem: { flexDirection: 'row', gap: spacing[2] },
  bullet: { color: colors.text.muted, fontSize: fontSize.base, lineHeight: fontSize.base * 1.6 },
  listText: {
    flex: 1,
    color: colors.text.secondary,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * 1.6,
  },
  footnote: {
    marginTop: spacing[10],
    paddingTop: spacing[5],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.subtle,
    color: colors.text.muted,
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * 1.6,
  },
});
