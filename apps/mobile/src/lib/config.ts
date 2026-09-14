/** Public runtime configuration. Only EXPO_PUBLIC_* values are embedded. */
export const config = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000',
  wsUrl: process.env.EXPO_PUBLIC_WS_URL ?? 'ws://localhost:4000/ws',
  appName: process.env.EXPO_PUBLIC_APP_NAME ?? 'STORM TIPS',
} as const;

export const apiBase = `${config.apiUrl}/api/v1`;
