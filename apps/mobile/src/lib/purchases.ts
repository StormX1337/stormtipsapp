import { Platform } from 'react-native';
import type * as ReactNativeIap from 'react-native-iap';
import type { SubscriptionDTO } from '@storm-tips/types';
import { api } from './api';

/**
 * In-app purchases.
 *
 * `react-native-iap` is a native module, so it is imported lazily: in Expo Go
 * (and on web) the module is absent and every function degrades to a clear
 * "not available in this build" error instead of crashing the app.
 *
 * The purchase itself never grants access. The signed transaction is sent to
 * `POST /billing/purchases/verify`, the server re-verifies it with Apple or
 * Google, and entitlements are derived from that verified state.
 */

type IapModule = typeof ReactNativeIap;

let iap: IapModule | null = null;
let connected = false;

export class PurchasesUnavailableError extends Error {
  constructor() {
    super(
      'In-app purchases are not available in this build. Create a development or ' +
        'production build (EAS) — Expo Go cannot make store purchases.',
    );
    this.name = 'PurchasesUnavailableError';
  }
}

async function loadModule(): Promise<IapModule> {
  if (iap) return iap;
  try {
    iap = (await import('react-native-iap')) as IapModule;
  } catch {
    throw new PurchasesUnavailableError();
  }
  return iap;
}

export async function initPurchases(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const module = await loadModule();
    if (!connected) {
      await module.initConnection();
      connected = true;
    }
    return true;
  } catch {
    return false;
  }
}

export async function endPurchases(): Promise<void> {
  if (!connected || !iap) return;
  try {
    await iap.endConnection();
  } finally {
    connected = false;
  }
}

export interface StoreProduct {
  productId: string;
  title: string;
  description: string;
  localizedPrice: string;
}

/** Loads the store's own localised pricing for the given product ids. */
export async function loadStoreProducts(productIds: string[]): Promise<StoreProduct[]> {
  if (productIds.length === 0) return [];
  const module = await loadModule();
  await initPurchases();

  const subscriptions = (await module.getSubscriptions({ skus: productIds })) as unknown as Record<
    string,
    unknown
  >[];

  return subscriptions.map((item) => ({
    productId: String(item.productId ?? ''),
    title: String(item.title ?? ''),
    description: String(item.description ?? ''),
    localizedPrice: String(item.localizedPrice ?? item.displayPrice ?? ''),
  }));
}

export interface VerifiedPurchase {
  subscription: SubscriptionDTO;
  entitlements: { product: string; active: boolean; expiresAt: string | null }[];
}

/**
 * Sends a completed purchase to the server for verification and only then
 * finishes the transaction with the store.
 */
export async function verifyAndFinish(purchase: {
  productId: string;
  transactionReceipt?: string;
  purchaseToken?: string;
}): Promise<VerifiedPurchase> {
  const module = await loadModule();

  // iOS supplies the signed StoreKit 2 transaction; Android the purchase token.
  const receipt = Platform.OS === 'ios' ? purchase.transactionReceipt : purchase.purchaseToken;
  if (!receipt) {
    throw new Error('Der Kaufbeleg konnte nicht gelesen werden.');
  }

  const verified = await api<VerifiedPurchase>('/billing/purchases/verify', {
    method: 'POST',
    body: {
      provider: Platform.OS === 'ios' ? 'APPLE' : 'GOOGLE',
      receipt,
      productId: purchase.productId,
    },
  });

  // Finishing only after the server confirmed prevents losing a purchase the
  // backend has not recorded yet.
  await module.finishTransaction({ purchase: purchase as never, isConsumable: false });
  return verified;
}

/** Starts the store purchase flow for a subscription product. */
export async function purchaseSubscription(productId: string): Promise<void> {
  const module = await loadModule();
  await initPurchases();
  if (Platform.OS === 'android') {
    await module.requestSubscription({ sku: productId } as never);
    return;
  }
  await module.requestSubscription({ sku: productId } as never);
}

/** Re-verifies everything the store knows about this account. */
export async function restorePurchases(): Promise<number> {
  const module = await loadModule();
  await initPurchases();
  const purchases = (await module.getAvailablePurchases()) as unknown as {
    productId: string;
    transactionReceipt?: string;
    purchaseToken?: string;
  }[];

  let restored = 0;
  for (const purchase of purchases) {
    try {
      await verifyAndFinish(purchase);
      restored += 1;
    } catch {
      // Skip purchases the server rejects (refunded, other account…).
    }
  }

  // The server-side restore also re-derives entitlements from stored state.
  await api('/billing/purchases/restore', { method: 'POST' });
  return restored;
}

/** Subscribes to store-side purchase updates (renewals, deferred purchases). */
export async function listenForPurchases(
  onVerified: (verified: VerifiedPurchase) => void,
  onError: (error: Error) => void,
): Promise<() => void> {
  let cleanup = (): void => undefined;
  try {
    const module = await loadModule();
    await initPurchases();

    const updateSubscription = module.purchaseUpdatedListener((purchase) => {
      void verifyAndFinish(purchase as never)
        .then(onVerified)
        .catch((error: Error) => onError(error));
    });
    const errorSubscription = module.purchaseErrorListener((error) => {
      onError(new Error(error.message ?? 'Kauf abgebrochen'));
    });

    cleanup = () => {
      updateSubscription.remove();
      errorSubscription.remove();
    };
  } catch {
    // Expo Go: no listeners, and the paywall shows the build hint instead.
  }
  return cleanup;
}
