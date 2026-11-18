// Purchase layer. Phase 1: placeholders. Phase 2 (TestFlight): StoreKit via RevenueCat,
// whose webhook writes entitlements/{uid}. Nothing else in the app changes.
import { Capacitor } from '@capacitor/core';
import { Billing, PaidPlan, PRICES } from './plans';

export type PurchaseResult = { ok: boolean; message?: string };

export async function purchase(plan: PaidPlan, billing: Billing): Promise<PurchaseResult> {
  const _productId = PRICES[plan][billing].productId;
  if (!Capacitor.isNativePlatform()) {
    return { ok: false, message: 'Subscriptions can be purchased in the Piper iPhone app.' };
  }
  // TODO Phase 2: RevenueCat purchase of _productId
  return { ok: false, message: 'Subscriptions are coming soon. Thanks for testing Piper!' };
}

export async function restorePurchases(): Promise<PurchaseResult> {
  // TODO Phase 2: RevenueCat restore
  return { ok: false, message: 'No previous purchases found.' };
}

/** Apple requires cancel / switch plans to happen in the App Store. */
export function openManageSubscriptions() {
  if (Capacitor.getPlatform() === 'ios') {
    window.location.href = 'itms-apps://apps.apple.com/account/subscriptions';
  } else {
    window.open('https://apps.apple.com/account/subscriptions', '_blank');
  }
}
