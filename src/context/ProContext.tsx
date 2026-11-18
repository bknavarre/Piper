import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, runTransaction, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { FREE_RECIPE_LIMIT, LIMITS, monthKey, PaidPlan, Plan, ProReason } from '../lib/plans';
import PaywallModal from '../components/PaywallModal';

export type Source = 'none' | 'apple' | 'comp' | 'beta' | 'family';
export type AiGate = 'ok' | 'limit' | 'signin';

export type ProState = {
  user: User | null;
  loading: boolean;
  plan: Plan;
  isPro: boolean;
  source: Source;
  expiresAt: Date | null;
  isFamilyOwner: boolean;
  isFamilyMember: boolean;
  householdId: string | null;
  aiUsed: number; aiLimit: number; aiRemaining: number;
  recipeLimit: number;
  recipeCounts: { active: number; archived: number };
  keepOpen: boolean;
};

type Ctx = ProState & {
  openPaywall: (reason?: ProReason, plan?: PaidPlan) => void;
  /** App reports how many recipes are active / archived (from its own recipe state). */
  reportRecipes: (active: number, archived: number) => void;
  openKeepPicker: () => void;
  closeKeepPicker: (dismiss: boolean) => void;
  /** true = allowed. Otherwise opens the paywall. */
  guardRecipeAdd: (currentActiveCount: number, adding?: number) => boolean;
  guardFeature: (f: 'bulkImport' | 'socialImport') => boolean;
  /** Uses 1 AI action. 'limit' opens the paywall; 'signin' means no account. */
  consumeAi: () => Promise<AiGate>;
};

const ProCtx = createContext<Ctx | null>(null);

const entActive = (e: any) => {
  if (!e || e.active !== true) return false;
  const exp = e.expiresAt instanceof Timestamp ? e.expiresAt.toDate() : null;
  return !exp || exp > new Date();
};

export function ProProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ownEnt, setOwnEnt] = useState<any>(null);
  const [ownLoaded, setOwnLoaded] = useState(false);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [memLoaded, setMemLoaded] = useState(false);
  const [famEnt, setFamEnt] = useState<any>(null);
  const [aiUsed, setAiUsed] = useState(0);
  const [counts, setCounts] = useState({ active: 0, archived: 0 });
  const [countsReady, setCountsReady] = useState(false);
  const [paywall, setPaywall] = useState<{ reason: ProReason; plan: PaidPlan } | null>(null);
  const [keepOpen, setKeepOpen] = useState(false);
  const [keepDismissed, setKeepDismissed] = useState(false);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    setOwnEnt(null); setHouseholdId(null); setAiUsed(0); setKeepDismissed(false); setKeepOpen(false); setCountsReady(false);
    if (!user) { setOwnLoaded(true); setMemLoaded(true); return; }
    setOwnLoaded(false); setMemLoaded(false);
    const subs = [
      onSnapshot(doc(db, 'entitlements', user.uid),
        s => { setOwnEnt(s.exists() ? s.data() : null); setOwnLoaded(true); },
        () => setOwnLoaded(true)),
      onSnapshot(doc(db, 'memberships', user.uid),
        s => { setHouseholdId(s.exists() ? (s.data().householdId as string) : null); setMemLoaded(true); },
        () => setMemLoaded(true)),
      onSnapshot(doc(db, 'users', user.uid, 'usage', monthKey()),
        s => setAiUsed((s.data()?.aiActions as number) ?? 0), () => {}),
    ];
    return () => subs.forEach(u => u());
  }, [user]);

  useEffect(() => {
    setFamEnt(null);
    if (!user || !householdId) return;
    return onSnapshot(doc(db, 'entitlements', householdId),
      s => setFamEnt(s.exists() ? s.data() : null), () => setFamEnt(null));
  }, [user, householdId]);

  const state = useMemo<ProState>(() => {
    const ownPlan: PaidPlan | null = entActive(ownEnt) ? (ownEnt.plan === 'family' ? 'family' : 'pro') : null;
    const viaFamily = !!householdId && entActive(famEnt) && famEnt.plan === 'family';
    const plan: Plan = ownPlan ?? (viaFamily ? 'family' : 'free');
    const expTs = ownPlan ? ownEnt.expiresAt : viaFamily ? famEnt.expiresAt : null;
    const aiLimit = LIMITS[plan].aiPerMonth;
    return {
      user, loading: !(ownLoaded && memLoaded), plan, isPro: plan !== 'free',
      source: ownPlan ? ((ownEnt.source as Source) ?? 'comp') : viaFamily ? 'family' : 'none',
      expiresAt: expTs instanceof Timestamp ? expTs.toDate() : null,
      isFamilyOwner: ownPlan === 'family',
      isFamilyMember: !ownPlan && viaFamily,
      householdId,
      aiUsed, aiLimit, aiRemaining: Math.max(aiLimit - aiUsed, 0),
      recipeLimit: LIMITS[plan].recipes, recipeCounts: counts, keepOpen,
    };
  }, [user, ownEnt, ownLoaded, memLoaded, householdId, famEnt, aiUsed, counts, keepOpen]);

  // Reporting mirror on members/{uid} (display only; access always comes from entitlements)
  useEffect(() => {
    if (!user || state.loading) return;
    setDoc(doc(db, 'members', user.uid), {
      email: user.email ?? '', displayName: user.displayName ?? '',
      plan: state.plan, planSource: state.source,
      householdId: state.isFamilyOwner ? user.uid : state.householdId ?? null,
      familyRole: state.isFamilyOwner ? 'owner' : state.isFamilyMember ? 'member' : null,
      recipesActive: counts.active, recipesArchived: counts.archived,
      aiUsedThisMonth: aiUsed, lastSeen: serverTimestamp(),
    }, { merge: true }).catch(() => {});
  }, [user, state.loading, state.plan, state.source, state.householdId, state.isFamilyOwner, state.isFamilyMember, counts.active, counts.archived, aiUsed]);

  // On Free with more than 50 active recipes → ask them to choose their 50
  useEffect(() => {
    if (user && countsReady && !state.loading && !state.isPro && counts.active > FREE_RECIPE_LIMIT && !keepDismissed) setKeepOpen(true);
    if (state.isPro) setKeepOpen(false);
  }, [user, countsReady, state.loading, state.isPro, counts.active, keepDismissed]);

  const reportRecipes = useCallback((active: number, archived: number) => {
    setCounts(c => (c.active === active && c.archived === archived ? c : { active, archived }));
    setCountsReady(true);
  }, []);

  const openPaywall = useCallback((reason: ProReason = 'general', plan: PaidPlan = 'pro') =>
    setPaywall({ reason, plan: reason === 'family' ? 'family' : plan }), []);

  const guardRecipeAdd = useCallback((current: number, adding = 1) => {
    if (current + adding <= state.recipeLimit) return true;
    openPaywall(adding > 1 ? 'bulkImport' : 'recipes'); return false;
  }, [state.recipeLimit, openPaywall]);

  const guardFeature = useCallback((f: 'bulkImport' | 'socialImport') => {
    if (LIMITS[state.plan][f]) return true;
    openPaywall(f); return false;
  }, [state.plan, openPaywall]);

  const consumeAi = useCallback(async (): Promise<AiGate> => {
    if (!user) return 'signin';
    const ref = doc(db, 'users', user.uid, 'usage', monthKey());
    try {
      const ok = await runTransaction(db, async tx => {
        const cur = ((await tx.get(ref)).data()?.aiActions as number) ?? 0;
        if (cur >= state.aiLimit) return false;
        tx.set(ref, { aiActions: cur + 1, updatedAt: serverTimestamp() }, { merge: true });
        return true;
      });
      if (!ok) { openPaywall('ai'); return 'limit'; }
      return 'ok';
    } catch { openPaywall('ai'); return 'limit'; }
  }, [user, state.aiLimit, openPaywall]);

  return (
    <ProCtx.Provider value={{
      ...state, openPaywall, reportRecipes,
      openKeepPicker: () => setKeepOpen(true),
      closeKeepPicker: (dismiss: boolean) => { setKeepOpen(false); if (dismiss) setKeepDismissed(true); },
      guardRecipeAdd, guardFeature, consumeAi,
    }}>
      {children}
      {paywall && (
        <PaywallModal reason={paywall.reason} initialPlan={paywall.plan} currentPlan={state.plan}
          onClose={() => setPaywall(null)} />
      )}
    </ProCtx.Provider>
  );
}

export function usePro() {
  const c = useContext(ProCtx);
  if (!c) throw new Error('usePro must be used inside <ProProvider>');
  return c;
}
