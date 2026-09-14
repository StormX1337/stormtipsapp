import { useEffect, useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, shared } from '@/lib/theme';
import { useT } from '@/lib/i18n';
import { reachability } from '@/lib/api';
import { ChevronLeftIcon } from './icons';

const { colors, fontSize, radii, sizes, spacing } = theme;

/** Subscribes to the API client's reachability signal. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(reachability.online);
  useEffect(() => reachability.subscribe(setOnline), []);
  return online;
}

export function ScreenHeader({
  title,
  subtitle,
  left,
  right,
  back,
}: {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  back?: boolean;
}): ReactNode {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <View style={styles.headerSlot}>
          {back ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Zurück"
              hitSlop={8}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/free'))}
            >
              <ChevronLeftIcon color={colors.text.primary} />
            </Pressable>
          ) : (
            left
          )}
        </View>

        <View style={styles.headerTitleWrap}>
          <Text numberOfLines={1} style={styles.headerTitle}>
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} style={styles.headerSubtitle}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View style={[styles.headerSlot, { alignItems: 'flex-end' }]}>{right}</View>
      </View>
    </View>
  );
}

/** Slim banner shown while the last request could not reach the API. */
export function OfflineBanner(): ReactNode {
  const t = useT();
  const online = useOnline();
  if (online) return null;
  return (
    <View style={styles.offline}>
      <Text style={styles.offlineTitle}>{t('feed.offlineTitle')}</Text>
      <Text style={styles.offlineBody}>{t('feed.offlineBody')}</Text>
    </View>
  );
}

export function Card({
  children,
  style,
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}): ReactNode {
  return (
    <View style={[shared.card, padded && { padding: sizes.cardPadding }, style]}>{children}</View>
  );
}

export function SectionTitle({ children }: { children: string }): ReactNode {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Divider(): ReactNode {
  return <View style={shared.separator} />;
}

/** Tappable settings-style row with an optional value and chevron. */
export function ListRow({
  label,
  value,
  onPress,
  icon,
  danger,
  right,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  icon?: ReactNode;
  danger?: boolean;
  right?: ReactNode;
}): ReactNode {
  const content = (
    <View style={styles.listRow}>
      {icon ? <View style={styles.listIcon}>{icon}</View> : null}
      <Text
        style={[styles.listLabel, danger && { color: colors.feedback.danger }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {value ? (
        <Text numberOfLines={1} style={styles.listValue}>
          {value}
        </Text>
      ) : null}
      {right}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => pressed && { opacity: 0.7 }}
    >
      {content}
    </Pressable>
  );
}

/**
 * Standard screen frame: header, scrollable body with the correct safe-area
 * padding, and the offline banner every data screen needs.
 */
export function Screen({
  title,
  subtitle,
  back,
  left,
  right,
  children,
  scroll = true,
  refreshControl,
  contentStyle,
}: {
  title?: string;
  subtitle?: string;
  back?: boolean;
  left?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  refreshControl?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}): ReactNode {
  const insets = useSafeAreaInsets();
  const body = (
    <>
      <OfflineBanner />
      {children}
    </>
  );

  return (
    <View style={shared.screen}>
      {title ? (
        <ScreenHeader title={title} subtitle={subtitle} back={back} left={left} right={right} />
      ) : null}
      {scroll ? (
        <ScrollView
          contentContainerStyle={[
            shared.gutter,
            { paddingBottom: insets.bottom + spacing[10] },
            contentStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl as never}
        >
          {body}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, shared.gutter, contentStyle]}>{body}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.bg.subtle,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle,
  },
  headerRow: {
    height: sizes.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sizes.pageGutter,
    gap: spacing[2],
  },
  headerSlot: { width: 40, justifyContent: 'center' },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerTitle: {
    color: colors.text.primary,
    fontSize: fontSize.lg,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  headerSubtitle: { color: colors.text.muted, fontSize: fontSize.xs, marginTop: 1 },
  offline: {
    marginTop: spacing[3],
    padding: spacing[3],
    borderRadius: radii.md,
    backgroundColor: colors.gold.soft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.gold,
  },
  offlineTitle: { color: colors.gold[200], fontSize: fontSize.base, fontWeight: '700' },
  offlineBody: { color: colors.gold[100], fontSize: fontSize.xs, marginTop: 2 },
  sectionTitle: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: '800',
    marginTop: spacing[5],
    marginBottom: spacing[2],
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[2],
  },
  listIcon: { width: 24, alignItems: 'center' },
  listLabel: { flex: 1, color: colors.text.primary, fontSize: fontSize.md },
  listValue: { color: colors.text.muted, fontSize: fontSize.base, maxWidth: '50%' },
});
