'use client';

import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAdminAuth } from '@/lib/auth';

interface QueueHealth {
  name: string;
  workers: number;
  schedules: number;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  lastFinishedAt: string | null;
}

interface WorkerHealth {
  checkedAt: string;
  connected: boolean;
  lastBeatAt: string | null;
  scheduled: boolean;
  queues: QueueHealth[];
}

/**
 * A standing warning when nothing is processing the queues.
 *
 * It sits in the shell rather than on the dashboard because the consequences
 * are everywhere: with the worker stopped, fixtures and live scores stop
 * arriving, results never land, scheduled tips never publish and nothing
 * settles — while every page in here still loads and looks healthy. Naming the
 * cause is the difference between a five-minute fix and a hunt through the
 * provider settings.
 */
export function WorkerHealth(): ReactNode {
  const { user, can } = useAdminAuth();

  const health = useQuery({
    queryKey: ['admin-worker-health'],
    queryFn: () => api<WorkerHealth>('/admin/ops/workers'),
    // Only ADMIN and above can read it; asking as a moderator would just 403.
    enabled: Boolean(user) && can('ADMIN'),
    refetchInterval: 60_000,
    // A banner is not worth a retry storm if the API is the thing that is down.
    retry: false,
  });

  const data = health.data;
  if (!data || data.connected) return null;

  const failed = data.queues.reduce((total, queue) => total + queue.failed, 0);
  const waiting = data.queues.reduce((total, queue) => total + queue.waiting + queue.delayed, 0);

  return (
    <div
      role="alert"
      className="mb-4 flex flex-col gap-1 rounded-md border border-lost/40 bg-lost/10 px-3 py-2.5"
    >
      <p className="flex items-center gap-2 text-[13px] font-semibold text-lost">
        <AlertTriangle size={15} aria-hidden />
        The background worker is not running
      </p>
      <p className="text-[12px] text-ink-muted">
        Fixtures, live scores and results are not being synced, scheduled tips are not publishing
        and nothing is being settled. Start it with{' '}
        <code className="rounded-sm bg-bg-card-alt px-1 py-0.5 text-[11.5px]">
          pnpm --filter @storm-tips/worker dev
        </code>{' '}
        (or <code className="rounded-sm bg-bg-card-alt px-1 py-0.5 text-[11.5px]">start</code> in
        production).
      </p>
      <p className="text-[11px] text-ink-dim">
        {data.scheduled
          ? `${waiting} job(s) queued, ${failed} failed — they run as soon as a worker connects.`
          : 'No repeatable jobs are registered, so the worker has not yet run against this Redis.'}
      </p>
    </div>
  );
}
