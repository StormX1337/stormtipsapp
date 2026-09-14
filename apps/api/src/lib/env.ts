import { loadEnv, type Env } from '@storm-tips/config';

/** Process-wide validated configuration. Throws at boot when invalid. */
export const env: Env = loadEnv();
