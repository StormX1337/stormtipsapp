import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { toDateKey } from '@profit-tips/ui';
import { theme } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';

const { colors, fontSize, radii, sizes, spacing } = theme;

/**
 * Horizontal date picker.
 *
 * Mirrors the web strip: a window of days around today, the selected day in
 * bold white with an accent underline.
 */
export function DateStrip({
  value,
  onChange,
  daysBefore = 7,
  daysAfter = 7,
}: {
  value: string;
  onChange: (date: string) => void;
  daysBefore?: number;
  daysAfter?: number;
}): ReactNode {
  const { locale, t } = useI18n();
  const scrollRef = useRef<ScrollView>(null);
  const intlLocale = locale === 'de' ? 'de-DE' : 'en-GB';

  const days = useMemo(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return Array.from({ length: daysBefore + daysAfter + 1 }, (_, index) => {
      const date = new Date(today.getTime() + (index - daysBefore) * 86_400_000);
      return {
        key: toDateKey(date),
        weekday: new Intl.DateTimeFormat(intlLocale, { weekday: 'short' }).format(date),
        month: new Intl.DateTimeFormat(intlLocale, { month: 'short' }).format(date),
        day: date.getDate(),
        isToday: index === daysBefore,
      };
    });
  }, [daysBefore, daysAfter, intlLocale]);

  // Centre the selected day on first paint.
  useEffect(() => {
    const index = days.findIndex((day) => day.key === value);
    if (index < 0) return;
    const offset = Math.max(0, index * (sizes.dateChipWidth + spacing[1]) - sizes.dateChipWidth * 2);
    scrollRef.current?.scrollTo({ x: offset, animated: false });
  }, [days, value]);

  return (
    <View style={styles.wrapper}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {days.map((day) => {
          const active = day.key === value;
          return (
            <Pressable
              key={day.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => onChange(day.key)}
              style={styles.chip}
            >
              <Text
                style={[
                  styles.weekday,
                  active && { color: colors.text.primary, fontWeight: '700' },
                ]}
              >
                {day.isToday ? t('common.today') : day.weekday}
              </Text>
              <Text
                style={[styles.date, active && { color: colors.text.primary, fontWeight: '700' }]}
              >
                {day.month} {day.day}
              </Text>
              {active ? <View style={styles.underline} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle,
    backgroundColor: colors.bg.base,
  },
  content: { paddingHorizontal: sizes.pageGutter, gap: spacing[1] },
  chip: {
    width: sizes.dateChipWidth,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing[2.5],
  },
  weekday: { color: colors.text.disabled, fontSize: fontSize.xs, lineHeight: 13 },
  date: { color: colors.text.disabled, fontSize: fontSize.xs, fontWeight: '500', lineHeight: 13 },
  underline: {
    position: 'absolute',
    bottom: 0,
    left: spacing[2],
    right: spacing[2],
    height: 2,
    borderRadius: radii.full,
    backgroundColor: colors.accent.DEFAULT,
  },
});
