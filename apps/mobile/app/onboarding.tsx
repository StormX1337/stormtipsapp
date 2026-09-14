import { useRef, useState, type ReactNode } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MessageKey } from '@storm-tips/ui';
import { theme, shared } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';
import { preferences } from '@/lib/storage';
import { registerPushToken } from '@/lib/notifications';
import { Button } from '@/components/primitives';
import { BallIcon, ChartIcon, ShieldIcon } from '@/components/icons';

const { colors, fontSize, radii, spacing } = theme;

const SLIDES: { icon: typeof BallIcon; title: MessageKey; body: MessageKey }[] = [
  { icon: BallIcon, title: 'onboarding.1.title', body: 'onboarding.1.body' },
  { icon: ChartIcon, title: 'onboarding.2.title', body: 'onboarding.2.body' },
  { icon: ShieldIcon, title: 'onboarding.3.title', body: 'onboarding.3.body' },
];

/**
 * Three-slide introduction shown once.
 *
 * The last slide is where notification permission is requested — asking at the
 * moment the value is explained converts far better than asking on launch.
 */
export default function OnboardingScreen(): ReactNode {
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const width = Dimensions.get('window').width;

  async function finish(): Promise<void> {
    await preferences.set('onboarded', '1');
    void registerPushToken();
    router.replace('/free');
  }

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>): void {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  }

  const last = index === SLIDES.length - 1;

  return (
    <View style={[shared.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Pressable
        accessibilityRole="button"
        onPress={() => void finish()}
        style={styles.skip}
        hitSlop={8}
      >
        <Text style={styles.skipText}>{t('common.skip')}</Text>
      </Pressable>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {SLIDES.map((slide) => {
          const Icon = slide.icon;
          return (
            <View key={slide.title} style={[styles.slide, { width }]}>
              <View style={styles.iconCircle}>
                <Icon size={48} color={colors.accent.DEFAULT} />
              </View>
              <Text style={styles.title}>{t(slide.title)}</Text>
              <Text style={styles.body}>{t(slide.body)}</Text>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.dots}>
        {SLIDES.map((slide, dotIndex) => (
          <View
            key={slide.title}
            style={[
              styles.dot,
              dotIndex === index && { backgroundColor: colors.accent.DEFAULT, width: 18 },
            ]}
          />
        ))}
      </View>

      <View style={[shared.gutter, { paddingBottom: spacing[6] }]}>
        <Button
          label={last ? t('onboarding.start') : t('common.next')}
          onPress={() => {
            if (last) {
              void finish();
              return;
            }
            scrollRef.current?.scrollTo({ x: (index + 1) * width, animated: true });
            setIndex(index + 1);
          }}
        />
        <Text style={styles.legal}>
          {t('legal.ageNotice')} {t('legal.noGuarantee')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skip: { alignSelf: 'flex-end', padding: spacing[4] },
  skipText: { color: colors.text.muted, fontSize: fontSize.md },
  slide: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[8],
    gap: spacing[4],
  },
  iconCircle: {
    width: 116,
    height: 116,
    borderRadius: radii.full,
    backgroundColor: colors.accent.soft,
    borderWidth: 1,
    borderColor: colors.border.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.text.primary,
    fontSize: fontSize['3xl'],
    fontWeight: '800',
    textAlign: 'center',
  },
  body: {
    color: colors.text.secondary,
    fontSize: fontSize.md,
    lineHeight: fontSize.md * 1.5,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: spacing[1.5],
    justifyContent: 'center',
    paddingVertical: spacing[5],
  },
  dot: { width: 6, height: 6, borderRadius: radii.full, backgroundColor: colors.bg.cardAlt },
  legal: {
    marginTop: spacing[3],
    color: colors.text.muted,
    fontSize: fontSize.xs,
    textAlign: 'center',
    lineHeight: fontSize.xs * 1.5,
  },
});
