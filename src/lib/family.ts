// Pass 18: Piper Family sharing — household info, family recipes, optional shared grocery list.
import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from 'react';
import { collection, doc, getDocs, onSnapshot, query, runTransaction, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { usePro } from '../context/ProContext';

export type FamilyMember = { uid: string; name: string };

/** The family you belong to (as owner or member), live. */
export function useHousehold() {
  const pro = usePro();
  const myUid = pro.user?.uid ?? null;
  const hid = pro.isFamilyOwner ? myUid : pro.isFamilyMember ? pro.householdId : null;
  const [h, setH] = useState<any>(null);
  useEffect(() => {
    setH(null);
    if (!hid) return;
    return onSnapshot(doc(db, 'households', hid), s => setH(s.exists() ? s.data() : null), () => setH(null));
  }, [hid]);
  const members: FamilyMember[] = h
    ? (h.members || []).map((uid: string) => ({ uid, name: h.memberInfo?.[uid]?.name || 'Family member' }))
    : [];
  return { hid, inFamily: !!hid && !!h, isOwner: pro.isFamilyOwner, sharedGrocery: !!h?.sharedGrocery, members, myUid };
}

export type FamilyRecipe<R> = { recipe: R; from: string; fromUid: string };

/** Everyone else's shared (not private, not archived) recipes. */
export async function loadFamilyRecipes<R>(members: FamilyMember[], me: string): Promise<FamilyRecipe<R>[]> {
  const out: FamilyRecipe<R>[] = [];
  let failed = 0;
  const others = members.filter(m => m.uid !== me);
  await Promise.all(others.map(async m => {
    try {
      const s = await getDocs(query(collection(db, 'users', m.uid, 'recipes'), where('familyPrivate', '==', false)));
      s.docs.forEach(d => {
        const x = d.data() as any;
        if (x.archived === true) return;
        out.push({
          from: m.name, fromUid: m.uid,
          recipe: {
            ...x, id: x.id || d.id, title: x.title || 'Untitled recipe', image: x.image || '',
            servings: Number(x.servings) || 4, time: Number(x.time) || 30, favorite: false,
            tags: Array.isArray(x.tags) ? x.tags : [], allergens: Array.isArray(x.allergens) ? x.allergens : [],
            ingredients: Array.isArray(x.ingredients) ? x.ingredients : [],
            instructions: Array.isArray(x.instructions) ? x.instructions : [],
          } as R,
        });
      });
    } catch { failed++; }
  }));
  if (failed && failed === others.length) throw new Error('family-load-failed');
  return out.sort((a, b) => String((a.recipe as any).title).localeCompare(String((b.recipe as any).title)));
}

const clean = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/**
 * One grocery list for the whole family, stored at households/{hid}/shared/grocery.
 * Each change is applied to the latest server copy, so two people adding items don't erase each other.
 * When it's off, everyone keeps using their own list.
 */
export function useSharedGrocery<T extends { id: string }>(hid: string | null, on: boolean, isOwner: boolean, seed: T[], uid: string | null) {
  const [items, setLocal] = useState<T[]>([]);
  const [ready, setReady] = useState(false);
  const latest = useRef<T[]>([]);
  const seedRef = useRef(seed);
  seedRef.current = seed;

  useEffect(() => {
    setReady(false); setLocal([]); latest.current = [];
    if (!hid || !on) return;
    const ref = doc(db, 'households', hid, 'shared', 'grocery');
    return onSnapshot(ref, s => {
      if (!s.exists()) {
        // First time it's turned on: the owner's current list becomes the family list.
        if (isOwner) setDoc(ref, { items: clean(seedRef.current), updatedAt: Date.now(), updatedBy: uid || '' }).catch(() => {});
        latest.current = []; setLocal([]); setReady(true);
        return;
      }
      const it = ((s.data() as any).items || []) as T[];
      latest.current = it; setLocal(it); setReady(true);
    }, () => setReady(true));
  }, [hid, on, isOwner, uid]);

  const setItems: Dispatch<SetStateAction<T[]>> = useCallback((u: SetStateAction<T[]>) => {
    if (!hid) return;
    const apply = (p: T[]): T[] => (typeof u === 'function' ? (u as (p: T[]) => T[])(p) : u);
    const optimistic = apply(latest.current);
    latest.current = optimistic; setLocal(optimistic);
    const ref = doc(db, 'households', hid, 'shared', 'grocery');
    runTransaction(db, async tx => {
      const s = await tx.get(ref);
      const cur = (s.exists() ? ((s.data() as any).items || []) : []) as T[];
      tx.set(ref, { items: clean(apply(cur)), updatedAt: Date.now(), updatedBy: uid || '' });
    }).catch(() => setDoc(ref, { items: clean(latest.current), updatedAt: Date.now(), updatedBy: uid || '' }).catch(() => {}));
  }, [hid, uid]);

  return { items, setItems, ready };
}
