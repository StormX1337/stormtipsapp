/**
 * Turns the Redis failures that actually stop this process into one line.
 *
 * They arrive as reply errors whose payload carries the entire Lua script
 * BullMQ was running — hundreds of lines of it, ending in a raw byte array,
 * with the one sentence that matters buried near the top. What the operator
 * needs is the cause and the fix, not the script, so the dump is dropped
 * whenever the error is one we recognise.
 */
export function explainRedisFailure(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('MISCONF')) {
    return (
      'Redis is refusing every write because its last snapshot to disk failed — ' +
      'in practice, a full disk. Free some space, then check that `redis-cli BGSAVE` ' +
      'reports success: Redis re-enables writes as soon as one does.'
    );
  }
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN/.test(message)) {
    return 'Could not reach Redis. Check REDIS_URL and that the server is running.';
  }
  if (message.includes('NOAUTH') || message.includes('WRONGPASS')) {
    return 'Redis rejected the credentials in REDIS_URL.';
  }
  return null;
}
