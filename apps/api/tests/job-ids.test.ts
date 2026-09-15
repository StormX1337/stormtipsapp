import { afterAll, describe, expect, it } from 'vitest';
import { Queue } from 'bullmq';
import { enqueue, getQueue, safeJobId } from '../src/lib/queues.js';
import { redis } from '../src/lib/redis.js';

/**
 * Every custom job id in this codebase used `:` as its separator, and BullMQ
 * rejects that — it is the separator in its own Redis keys. The jobs were
 * dropped rather than queued: scheduled publishing, and every push
 * notification. This pins both halves, the rule and the failure it works
 * around, against the real BullMQ rather than a description of it.
 */
const QUEUE = `test-job-ids-${process.pid}`;

afterAll(async () => {
  await getQueue(QUEUE).obliterate({ force: true });
  await getQueue(QUEUE).close();
  redis.disconnect();
});

describe('custom job ids', () => {
  it('is what BullMQ refuses', async () => {
    const queue = new Queue(QUEUE, { connection: redis });
    await expect(queue.add('probe', {}, { jobId: 'kickoff:abc' })).rejects.toThrow(
      /cannot contain :/,
    );
    await queue.close();
  });

  it('queues a job whose id came in with a colon', async () => {
    await enqueue(QUEUE, 'probe', { value: 1 }, { jobId: 'kickoff:abc' });

    const job = await getQueue(QUEUE).getJob('kickoff-abc');
    expect(job).toBeTruthy();
    expect(job?.data).toEqual({ value: 1 });
  });

  it('keeps two ids apart that differed only where the colons were', () => {
    expect(safeJobId('tip:a')).not.toBe(safeJobId('tip:b'));
    expect(safeJobId('kickoff:abc')).toBe('kickoff-abc');
    expect(safeJobId('repeat:sync:fixtures')).toBe('repeat-sync-fixtures');
  });

  it('leaves an id without a colon alone, so dedupe still matches', () => {
    expect(safeJobId('already-safe')).toBe('already-safe');
  });
});
