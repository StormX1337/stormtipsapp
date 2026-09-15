import { describe, expect, it } from 'vitest';
import { explainRedisFailure } from '../src/redis-errors.js';

/**
 * The MISCONF text is quoted from a real failure: a production host whose disk
 * filled, where this reached the operator as several hundred lines of Lua and a
 * raw byte array, with "worker failed to start" as the only readable part.
 */
const MISCONF =
  "MISCONF Redis is configured to save RDB snapshots, but it's currently unable to persist " +
  'to disk. Commands that may modify the data set are disabled, because this instance is ' +
  'configured to report errors during writes if RDB snapshotting fails ' +
  '(stop-writes-on-bgsave-error option). Please check the Redis logs for details about the RDB error.';

describe('explaining a Redis failure', () => {
  it('names the disk as the cause of a refused write', () => {
    const reason = explainRedisFailure(new Error(MISCONF));
    expect(reason).toMatch(/snapshot to disk failed/);
    expect(reason).toMatch(/BGSAVE/);
  });

  it('recognises an unreachable server', () => {
    expect(explainRedisFailure(new Error('connect ECONNREFUSED 127.0.0.1:6379'))).toMatch(
      /Could not reach Redis/,
    );
    expect(explainRedisFailure(new Error('getaddrinfo ENOTFOUND redis'))).toMatch(
      /Could not reach Redis/,
    );
  });

  it('recognises a rejected password', () => {
    expect(explainRedisFailure(new Error('WRONGPASS invalid username-password pair'))).toMatch(
      /credentials/,
    );
  });

  it('says nothing about an error it does not recognise, so the dump is kept', () => {
    expect(explainRedisFailure(new Error('something else entirely'))).toBeNull();
    expect(explainRedisFailure('not an error at all')).toBeNull();
  });
});
