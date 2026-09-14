import { useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Paginated, PollDTO } from '@storm-tips/types';
import { theme, shared } from '@/lib/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { OfflineBanner, ScreenHeader } from '@/components/layout';
import { Button, EmptyState, ErrorState, Skeleton } from '@/components/primitives';
import { ChartIcon } from '@/components/icons';

const { colors, fontSize, radii, spacing } = theme;

function PollCard({ poll }: { poll: PollDTO }): ReactNode {
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const vote = useMutation({
    mutationFn: (optionId: string) =>
      api<PollDTO>(`/polls/${poll.id}/vote`, { method: 'POST', body: { optionIds: [optionId] } }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['polls'] });
    },
    onError: (caught: Error) => setError(caught.message),
  });

  const closed = poll.status === 'CLOSED';
  const canVote = Boolean(user) && !poll.hasVoted && !closed;

  return (
    <View style={[shared.card, styles.card]}>
      <Text style={styles.question}>{poll.question}</Text>
      {poll.description ? <Text style={styles.description}>{poll.description}</Text> : null}

      <View style={{ marginTop: spacing[3], gap: spacing[2] }}>
        {poll.options.map((option) => {
          const active = selected === option.id || option.isMyVote;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active, disabled: !canVote }}
              disabled={!canVote}
              onPress={() => setSelected(option.id)}
              style={[styles.option, active && { borderColor: colors.accent.DEFAULT }]}
            >
              {poll.showResults ? (
                <View
                  pointerEvents="none"
                  style={[
                    styles.optionBar,
                    {
                      width: `${Math.max(0, Math.min(100, option.percentage))}%`,
                      backgroundColor: option.isMyVote ? colors.accent.soft : colors.bg.cardAlt,
                    },
                  ]}
                />
              ) : null}
              <Text numberOfLines={2} style={styles.optionLabel}>
                {option.label}
              </Text>
              {poll.showResults ? (
                <Text style={styles.optionPercent}>{option.percentage.toFixed(1)}%</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {t('poll.totalVotes', { count: poll.totalVotes })}
          {closed ? ` · ${t('poll.closed')}` : ''}
        </Text>
        {!user ? (
          <Pressable accessibilityRole="button" onPress={() => router.push('/auth/login')}>
            <Text style={styles.link}>{t('poll.loginRequired')}</Text>
          </Pressable>
        ) : poll.hasVoted ? (
          <Text style={styles.voted}>{t('poll.voted')}</Text>
        ) : (
          <Button
            label={t('poll.vote')}
            loading={vote.isPending}
            disabled={!selected || closed}
            onPress={() => selected && vote.mutate(selected)}
            style={{ minHeight: 34, paddingHorizontal: spacing[4] }}
          />
        )}
      </View>
    </View>
  );
}

export default function PollScreen(): ReactNode {
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const polls = useQuery({
    queryKey: ['polls'],
    queryFn: () => api<Paginated<PollDTO>>('/polls?limit=20'),
  });

  return (
    <View style={shared.screen}>
      <ScreenHeader
        title={t('poll.title')}
        left={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('stats.title')}
            hitSlop={8}
            onPress={() => router.push('/statistics')}
          >
            <ChartIcon color={colors.text.secondary} />
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={[shared.gutter, { paddingBottom: insets.bottom + spacing[8] }]}
        refreshControl={
          <RefreshControl
            refreshing={polls.isFetching && !polls.isPending}
            tintColor={colors.text.secondary}
            onRefresh={() => void polls.refetch()}
          />
        }
      >
        <OfflineBanner />
        <View style={{ paddingTop: spacing[4] }}>
          {polls.isPending ? (
            Array.from({ length: 3 }, (_, index) => <Skeleton key={index} height={170} />)
          ) : polls.isError ? (
            <ErrorState
              message={(polls.error as Error).message}
              onRetry={() => void polls.refetch()}
            />
          ) : polls.data.items.length === 0 ? (
            <EmptyState title={t('poll.empty')} />
          ) : (
            polls.data.items.map((poll) => <PollCard key={poll.id} poll={poll} />)
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing[4], marginBottom: spacing[3] },
  question: { color: colors.text.primary, fontSize: fontSize.md, fontWeight: '700' },
  description: { marginTop: spacing[1], color: colors.text.secondary, fontSize: fontSize.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.subtle,
    borderRadius: radii.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2.5],
    overflow: 'hidden',
  },
  optionBar: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  optionLabel: { flex: 1, color: colors.text.primary, fontSize: fontSize.base },
  optionPercent: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  error: { marginTop: spacing[2], color: colors.status.LOST, fontSize: fontSize.sm },
  footer: {
    marginTop: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  footerText: { flex: 1, color: colors.text.muted, fontSize: fontSize.xs },
  link: { color: colors.accent.DEFAULT, fontSize: fontSize.sm },
  voted: { color: colors.accent.DEFAULT, fontSize: fontSize.sm },
});
