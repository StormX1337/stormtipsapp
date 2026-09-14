import type { Processor } from 'bullmq';
import { QUEUE_NAMES } from '@storm-tips/config';
import { syncFixturesJob, syncLiveJob, syncOddsJob } from './jobs/sports.js';
import { settleDueJob, syncResultsJob } from './jobs/results.js';
import {
  kickoffRemindersJob,
  publishComboJob,
  publishDueTipsJob,
  publishTipJob,
  refreshTipOddsJob,
} from './jobs/tips.js';
import {
  checkPushReceiptsJob,
  fanOutNotificationJob,
  sendNotificationJob,
  sendScheduledJob,
} from './jobs/notifications.js';
import { expireSubscriptionsJob, expiringRemindersJob } from './jobs/subscriptions.js';
import { cleanupJob, closePollsJob, recomputeStatisticsJob } from './jobs/maintenance.js';

/**
 * The worker's routing table.
 *
 * Kept apart from the bootstrap so it can be asserted in tests without
 * connecting to Redis: every scheduled job must have a handler, and every
 * schedule must carry a cron expression the scheduler understands.
 */
export interface Schedule {
  queue: string;
  name: string;
  cron: string;
  data?: Record<string, unknown>;
}

/** Job name → processor, per queue. */
export const HANDLERS: Record<string, Record<string, Processor>> = {
  [QUEUE_NAMES.sports]: {
    'sync:fixtures': syncFixturesJob as Processor,
    'sync:live': syncLiveJob as Processor,
  },
  [QUEUE_NAMES.odds]: {
    'sync:odds': syncOddsJob as Processor,
    'refresh:tip-odds': refreshTipOddsJob as Processor,
  },
  [QUEUE_NAMES.results]: {
    'sync:results': syncResultsJob as Processor,
    'settle:due': settleDueJob as Processor,
  },
  [QUEUE_NAMES.tips]: {
    'publish:tip': publishTipJob as Processor,
    'publish:combo': publishComboJob as Processor,
    'publish:due': publishDueTipsJob as Processor,
    'reminders:kickoff': kickoffRemindersJob as Processor,
  },
  [QUEUE_NAMES.notifications]: {
    'notification:fanout': fanOutNotificationJob as Processor,
    'notification:send': sendNotificationJob as Processor,
    'notification:scheduled': sendScheduledJob as Processor,
    'notification:receipts': checkPushReceiptsJob as Processor,
  },
  [QUEUE_NAMES.subscriptions]: {
    'subscriptions:check': expireSubscriptionsJob as Processor,
    'subscriptions:reminders': expiringRemindersJob as Processor,
  },
  [QUEUE_NAMES.statistics]: {
    'stats:recompute': recomputeStatisticsJob as Processor,
  },
  [QUEUE_NAMES.maintenance]: {
    cleanup: cleanupJob as Processor,
    'polls:close': closePollsJob as Processor,
  },
};

/** Per-queue concurrency. Network-bound queues get more, DB-heavy ones fewer. */
export const CONCURRENCY: Record<string, number> = {
  [QUEUE_NAMES.sports]: 2,
  [QUEUE_NAMES.odds]: 2,
  [QUEUE_NAMES.results]: 2,
  [QUEUE_NAMES.tips]: 4,
  [QUEUE_NAMES.notifications]: 6,
  [QUEUE_NAMES.subscriptions]: 1,
  [QUEUE_NAMES.statistics]: 1,
  [QUEUE_NAMES.maintenance]: 1,
};

/**
 * Repeatable schedules.
 *
 * `jobId` is stable per schedule so restarting the worker never creates a
 * duplicate repeatable job.
 */
export const SCHEDULES: Schedule[] = [
  { queue: QUEUE_NAMES.sports, name: 'sync:fixtures', cron: '*/15 * * * *' },
  { queue: QUEUE_NAMES.sports, name: 'sync:live', cron: '* * * * *' },
  { queue: QUEUE_NAMES.odds, name: 'sync:odds', cron: '*/5 * * * *' },
  { queue: QUEUE_NAMES.odds, name: 'refresh:tip-odds', cron: '*/10 * * * *' },
  { queue: QUEUE_NAMES.results, name: 'sync:results', cron: '*/5 * * * *' },
  { queue: QUEUE_NAMES.results, name: 'settle:due', cron: '*/10 * * * *' },
  { queue: QUEUE_NAMES.tips, name: 'publish:due', cron: '* * * * *' },
  { queue: QUEUE_NAMES.tips, name: 'reminders:kickoff', cron: '*/5 * * * *' },
  { queue: QUEUE_NAMES.notifications, name: 'notification:scheduled', cron: '* * * * *' },
  { queue: QUEUE_NAMES.notifications, name: 'notification:receipts', cron: '*/10 * * * *' },
  { queue: QUEUE_NAMES.subscriptions, name: 'subscriptions:check', cron: '0 * * * *' },
  { queue: QUEUE_NAMES.subscriptions, name: 'subscriptions:reminders', cron: '0 9 * * *' },
  { queue: QUEUE_NAMES.statistics, name: 'stats:recompute', cron: '*/30 * * * *' },
  { queue: QUEUE_NAMES.maintenance, name: 'cleanup', cron: '30 3 * * *' },
  { queue: QUEUE_NAMES.maintenance, name: 'polls:close', cron: '*/5 * * * *' },
];
