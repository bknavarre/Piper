import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection, doc, getCountFromServer, getDocs, onSnapshot, query, runTransaction,
  serverTimestamp, setDoc, Timestamp, where, writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebase'; // adjust if your Firebase file is elsewhere
import { FREE_RECIPE_LIMIT, LIMITS, monthKey, PaidPlan, Plan, ProReason, RECIPES } from '../lib/plans';
import PaywallModal from '../components/PaywallModal';
import KeepRecipesPicker from '../components/KeepRecipesPicker';

export type Source = 'none' | 'apple' | 'comp' | 'beta' | 'family';

export type ProState = {
  user: User | null;
  loading: boolean;
  plan: Plan;
  isPro: boolean;              // true for Pro and Family
  source: Source;              // how they got it
  expiresAt: Date | null;
  isFamilyOwner: boolean;
  isFamilyMember: boolean;     // joined someone else's family
  householdId: string | null;  // family they belong to (owner uid)
  aiUsed: number; aiLimit: number; aiRemaining: number;
  recipeLimit: number;
  recipeCounts: { active: number; archived: number };
};

type Ctx = ProState & {
  openPaywall: (reason?: ProReason, plan?: PaidPlan) => void;
  openKeepPicker: () => void;
  refreshRecipeCounts: () => Promise<void>;
  guardRecipeAdd: (currentActiveCount: number, adding?: number) => boolean;
  guardFeature: (f: 'bulkImport' | 'socialImport') => boolean;
  useAiAction: () => Promise<boolean>;
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
  const [paywall, setPaywall] = useState<{ reason: ProReason; plan: PaidPlan } | null>(null);
  const [keepOpen, setKeepOpen] = useState(false);
  const [keepDismissed, setKeepDismissed] = useState(false);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    setOwnEnt(null); setHouseholdId(null); setAiUsed(0); setKeepDismissed(false);
    if (!user) { setOwnLoaded(true); setMemLoaded(true); return; }
    setOwnLoaded(false); setMemLoaded(false);
    setDoc(doc(db, 'members', user.uid), {
      email: user.email ?? '', displayName: user.displayName ?? '', lastSeen: serverTimestamp(),
    }, { merge: true }).catch(() => {});
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

  // Owner's entitlement when you're a family member
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
      recipeLimit: LIMITS[plan].recipes, recipeCounts: counts,
    };
  }, [user, ownEnt, ownLoaded, memLoaded, householdId, famEnt, aiUsed, counts]);

  // Mirror plan info onto members/{uid} so you can filter/track in the Firebase console.
  // (Display only — real access always comes from entitlements.)
  useEffect(() => {
    if (!user || state.loading) return;
    setDoc(doc(db, 'members', user.uid), {
      plan: state.plan, planSource: state.source,
      householdId: state.isFamilyOwner ? user.uid : state.householdId ?? null,
      familyRole: state.isFamilyOwner ? 'owner' : state.isFamilyMember ? 'member' : null,
      recipesActive: counts.active, recipesArchived: counts.archived,
      aiUsedThisMonth: aiUsed, lastSeen: serverTimestamp(),
    }, { merge: true }).catch(() => {});
  }, [user, state.loading, state.plan, state.source, state.householdId, state.isFamilyOwner, state.isFamilyMember, counts.active, counts.archived, aiUsed]);

  const refreshRecipeCounts = useCallback(async () => {
    if (!user) return;
    try {
      const col = collection(db, RECIPES.collection(user.uid));
      const [all, arch] = await Promise.all([
        getCountFromServer(col),
        getCountFromServer(query(col, where(RECIPES.archivedField, '==', true))),
      ]);
      const archived = arch.data().count;
      setCounts({ active: all.data().count - archived, archived });
    } catch { /* offline — keep last known */ }
  }, [user]);

  useEffect(() => { if (!state.loading) refreshRecipeCounts(); }, [state.loading, state.plan, refreshRecipeCounts]);

  // Upgraded → bring every archived recipe back automatically
  useEffect(() => {
    if (!user || !state.isPro || counts.archived === 0) return;
    (async () => {
      const snap = await getDocs(query(collection(db, RECIPES.collection(user.uid)), where(RECIPES.archivedField, '==', true)));
      for (let i = 0; i < snap.docs.length; i += 400) {
        const b = writeBatch(db);
        snap.docs.slice(i, i + 400).forEach(d => b.update(d.ref, { [RECIPES.archivedField]: false }));
        await b.commit();
      }
      refreshRecipeCounts();
    })().catch(() => {});
  }, [user, state.isPro, counts.archived, refreshRecipeCounts]);

  // On Free with more than 50 active → ask them to choose their 50
  useEffect(() => {
    if (!state.loading && user && !state.isPro && counts.active > FREE_RECIPE_LIMIT && !keepDismissed) setKeepOpen(true);
  }, [state.loading, state.isPro, counts.active, keepDismissed, user]);

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

  const useAiAction = useCallback(async () => {
    if (!user) return false;
    const ref = doc(db, 'users', user.uid, 'usage', monthKey());
    try {
      const ok = await runTransaction(db, async tx => {
        const cur = ((await tx.get(ref)).data()?.aiActions as number) ?? 0;
        if (cur >= state.aiLimit) return false;
        tx.set(ref, { aiActions: cur + 1, updatedAt: serverTimestamp() }, { merge: true });
        return true;
      });
      if (!ok) openPaywall('ai');
      return ok;
    } catch { openPaywall('ai'); return false; }
  }, [user, state.aiLimit, openPaywall]);

  return (
    <ProCtx.Provider value={{
      ...state, openPaywall, openKeepPicker: () => setKeepOpen(true),
      refreshRecipeCounts, guardRecipeAdd, guardFeature, useAiAction,
    }}>
      {children}
      {paywall && (
        <PaywallModal reason={paywall.reason} initialPlan={paywall.plan} currentPlan={state.plan}
          onClose={() => setPaywall(null)} />
      )}
      {keepOpen && user && (
        <KeepRecipesPicker uid={user.uid}
          onUpgrade={() => { setKeepOpen(false); openPaywall('recipes'); }}
          onLater={() => { setKeepOpen(false); setKeepDismissed(true); }}
          onDone={() => { setKeepOpen(false); setKeepDismissed(true); refreshRecipeCounts(); }} />
      )}
    </ProCtx.Provider>
  );
}

export function usePro() {
  const c = useContext(ProCtx);
  if (!c) throw new Error('usePro must be used inside <ProProvider>');
  return c;
}
