import type { ReactNode } from 'react';
import { Redirect } from 'expo-router';

/** The app opens on the Free feed. */
export default function Index(): ReactNode {
  return <Redirect href="/free" />;
}
