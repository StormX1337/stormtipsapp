import { loadEnv, type Env } from '@profit-tips/config';

/** Process-wide validated configuration. Throws at boot when invalid. */
export const env: Env = loadEnv();
