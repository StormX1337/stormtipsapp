'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useAuth } from './auth';

/**
 * The tips the signed-in reader has added to their own record.
 *
 * Kept as one list of ids rather than a flag on each tip: the feed payloads are
 * cached and shared between readers, so a per-reader flag inside them would be
 * served to the wrong person.
 */
export function useFollowedTipIds(): { ids: Set<string>; ready: boolean } {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['follows'],
    queryFn: () => api<{ items: string[] }>('/me/follows'),
    enabled: Boolean(user),
    staleTime: 60_000,
  });
  return { ids: new Set(query.data?.items ?? []), ready: query.isSuccess };
}

/**
 * Adds or removes a tip from the record.
 *
 * The id list is updated before the request lands, because the button's whole
 * job is to answer immediately; a failure puts it back by refetching.
 */
export function useFollowTip(tipId: string): {
  following: boolean;
  pending: boolean;
  toggle: () => void;
} {
  const queryClient = useQueryClient();
  const { ids, ready } = useFollowedTipIds();
  const following = ids.has(tipId);

  const mutation = useMutation({
    mutationFn: async (next: boolean) => {
      if (next) await api(`/me/follows/${tipId}`, { method: 'PUT', body: {} });
      else await api(`/me/follows/${tipId}`, { method: 'DELETE' });
    },
    onMutate: (next: boolean) => {
      queryClient.setQueryData<{ items: string[] }>(['follows'], (current) => {
        const items = current?.items ?? [];
        return { items: next ? [...items, tipId] : items.filter((id) => id !== tipId) };
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['follows'] });
      void queryClient.invalidateQueries({ queryKey: ['record'] });
    },
  });

  return {
    following,
    pending: mutation.isPending || !ready,
    toggle: () => mutation.mutate(!following),
  };
}
