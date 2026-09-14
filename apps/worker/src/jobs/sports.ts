import type { Job } from 'bullmq';
import { sync } from '@storm-tips/api/services';
import { logger } from '@storm-tips/api/lib/logger';

export interface FixtureJobData {
  providerSlug?: string;
  daysBack?: number;
  daysForward?: number;
}

/** Pulls the fixture list for the rolling window shown in the app. */
export async function syncFixturesJob(job: Job<FixtureJobData>): Promise<unknown> {
  const summary = await sync.syncFixtures(job.data ?? {});
  logger.info({ jobId: job.id, ...summary }, 'fixture sync finished');
  if (summary.errors.length > 0) {
    // Surfacing the error fails the job so BullMQ retries with backoff.
    throw new Error(summary.errors.join('; '));
  }
  return summary;
}

export async function syncOddsJob(job: Job<{ eventIds?: string[] }>): Promise<unknown> {
  const summary = await sync.syncOdds(job.data ?? {});
  // Closing prices are frozen once a fixture kicks off.
  const frozen = await sync.freezeClosingOdds();
  logger.info({ jobId: job.id, ...summary, frozen }, 'odds sync finished');
  if (summary.errors.length > 0) throw new Error(summary.errors.join('; '));
  return { ...summary, frozen };
}

export async function syncLiveJob(job: Job): Promise<unknown> {
  const live = await sync.syncLive();
  logger.debug({ jobId: job.id, live: live.length }, 'live sync finished');
  return { live: live.length };
}
