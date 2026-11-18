// ─── Piper plans, limits, prices. Change numbers here only. ───
export type Plan = 'free' | 'pro' | 'family';
export type PaidPlan = 'pro' | 'family';
export type Billing = 'annual' | 'monthly';
export type ProReason = 'general' | 'ai' | 'recipes' | 'bulkImport' | 'socialImport' | 'family';

export const FREE_RECIPE_LIMIT = 50;
export const FAMILY_MAX_MEMBERS = 5; // includes the owner

export const LIMITS = {
  free:   { recipes: FREE_RECIPE_LIMIT, aiPerMonth: 5,   bulkImport: false, socialImport: false },
  pro:    { recipes: Infinity,          aiPerMonth: 100, bulkImport: true,  socialImport: true },
  family: { recipes: Infinity,          aiPerMonth: 100, bulkImport: true,  socialImport: true }, // per person
} as const;

export const PRICES = {
  pro: {
    annual:  { productId: 'piper_pro_annual',  price: '$49.99/year', perMonth: '$4.17/month', badge: 'BEST VALUE · Save 30%', trial: '7 days free, then $49.99/year. Cancel anytime.' },
    monthly: { productId: 'piper_pro_monthly', price: '$5.99/month', perMonth: '',            badge: '',                      trial: '$5.99/month. Cancel anytime.' },
  },
  family: {
    annual:  { productId: 'piper_family_annual',  price: '$99.99/year', perMonth: '$8.33/month', badge: 'BEST VALUE · Save 30%', trial: '7 days free, then $99.99/year. Cancel anytime.' },
    monthly: { productId: 'piper_family_monthly', price: '$11.99/month', perMonth: '',           badge: '',                      trial: '$11.99/month. Cancel anytime.' },
  },
} as const;

export const PLAN_NAME: Record<Plan, string> = { free: 'Piper Free', pro: 'Piper Pro', family: 'Piper Family' };

// ─── Where your recipes live in Firestore. ADJUST to match Piper. ───
export const RECIPES = {
  collection: (uid: string) => `users/${uid}/recipes`,
  titleField: 'title',
  imageField: 'image',
  favoriteField: 'favorite',
  updatedField: 'updatedAt',
  archivedField: 'archived', // added by Piper Pro; true = saved but inactive on Free
};
export const isArchived = (r: any) => r?.[RECIPES.archivedField] === true;

export const TERMS_URL = 'https://YOUR-SITE/terms';      // TODO
export const PRIVACY_URL = 'https://YOUR-SITE/privacy';  // TODO
export const SUPPORT_EMAIL = 'support@YOUR-SITE';        // TODO

export const monthKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
