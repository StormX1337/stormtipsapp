import { describe, expect, it } from 'vitest';
import { QUEUE_NAMES } from '@profit-tips/config';
import { CONCURRENCY, HANDLERS, SCHEDULES } from '../src/registry.js';

/** Minimal 5-field cron validator — enough to catch a typo in a schedule. */
function isCron(expression: string): boolean {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  return fields.every((field) =>
    field.split(',').every((part) => /^(\*|\d+)(-\d+)?(\/\d+)?$/.test(part)),
  );
}

describe('worker registry', () => {
  it('registers handlers only for known queues', () => {
    const known: string[] = Object.values(QUEUE_NAMES);
    for (const queue of Object.keys(HANDLERS)) {
      expect(known, queue).toContain(queue);
    }
  });

  it('gives every queue a concurrency', () => {
    for (const queue of Object.keys(HANDLERS)) {
      expect(CONCURRENCY[queue], queue).toBeGreaterThan(0);
    }
  });

  it('has a handler for every scheduled job', () => {
    for (const schedule of SCHEDULES) {
      const handlers = HANDLERS[schedule.queue];
      expect(handlers, `queue ${schedule.queue}`).toBeDefined();
      expect(typeof handlers?.[schedule.name], `${schedule.queue}/${schedule.name}`).toBe(
        'function',
      );
    }
  });

  it('uses valid cron expressions', () => {
    for (const schedule of SCHEDULES) {
      expect(isCron(schedule.cron), `${schedule.name}: ${schedule.cron}`).toBe(true);
    }
  });

  it('schedules each job at most once', () => {
    const ids = SCHEDULES.map((schedule) => `${schedule.queue}:${schedule.name}`);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers the pipeline a running deployment depends on', () => {
    const names = new Set(SCHEDULES.map((schedule) => schedule.name));
    for (const required of [
      'sync:fixtures',
      'sync:live',
      'sync:odds',
      'sync:results',
      'settle:due',
      'publish:due',
      'reminders:kickoff',
      'subscriptions:check',
      'stats:recompute',
      'cleanup',
    ]) {
      expect(names.has(required), required).toBe(true);
    }
  });

  it('exposes every handler as a callable processor', () => {
    for (const [queue, handlers] of Object.entries(HANDLERS)) {
      for (const [name, handler] of Object.entries(handlers)) {
        expect(typeof handler, `${queue}/${name}`).toBe('function');
      }
    }
  });
});
