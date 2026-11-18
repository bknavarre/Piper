// Purchase layer. Phase 1: placeholders. Phase 2 (TestFlight): StoreKit via RevenueCat,
// whose webhook writes entitlements/{uid}. Nothing else in the app changes.
import { Billing, PaidPlan, PRICES } from './plans';

export type PurchaseResult = { ok: boolean; message?: string };

// Capacitor puts this global on window inside the iPhone app; it isn't there on the web.
// Reading it directly means no @capacitor/core import, so the web build doesn't need it.
const cap = () => (window as any).Capacitor as
  { isNativePlatform?: () => boolean; getPlatform?: () => string } | undefined;
const isNative = () => !!cap()?.isNativePlatform?.();
const isIOS = () => cap()?.getPlatform?.() === 'ios';

export async function purchase(plan: PaidPlan, billing: Billing): Promise<PurchaseResult> {
  const _productId = PRICES[plan][billing].productId;
  void _productId;
  if (!isNative()) {
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
  if (isIOS()) {
    window.location.href = 'itms-apps://apps.apple.com/account/subscriptions';
  } else {
    window.open('https://apps.apple.com/account/subscriptions', '_blank');
  }
}
