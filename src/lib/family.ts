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

/* ===================== Pass 19: duplicate detection ===================== */

/** Link from a saved copy back to the recipe it came from. Stored on the copy. */
export type CopyOrigin = { uid: string; recipeId: string; name: string; fp: string; at: number };

type R19 = { id: string; title: string; ingredients: string[]; instructions: string[]; sourceUrl?: string; copiedFrom?: CopyOrigin };

const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9½¼¾/.]+/g, ' ').replace(/\s+/g, ' ').trim();
const hash = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };

/** Fingerprint of what the recipe says (title, ingredients, steps). Ignores photo, notes, favorites. */
export function contentKey(r: R19): string {
  return hash([norm(r.title), ...(r.ingredients || []).map(norm), '|', ...(r.instructions || []).map(norm)].join('\n'));
}

/** The same web page, however the link was written (http/https, www, tracking tags, trailing slash). */
export function sourceKey(r: { sourceUrl?: string }): string {
  const raw = String(r.sourceUrl || '').trim();
  if (!raw) return '';
  try {
    const u = new URL(raw);
    if (!/^https?:$/.test(u.protocol)) return '';
    return (u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/+$/, '')).toLowerCase();
  } catch { return ''; }
}

/** An unedited copy still matches the fingerprint taken when it was saved. */
export const isUneditedCopy = (r: R19) => !!r.copiedFrom && contentKey(r) === r.copiedFrom.fp;

/** Where a recipe really came from. An unedited copy of a copy points to the first original. */
export function rootOrigin(r: R19, ownerUid: string, ownerName: string): CopyOrigin {
  if (r.copiedFrom && isUneditedCopy(r)) return r.copiedFrom;
  return { uid: ownerUid, recipeId: r.id, name: ownerName, fp: contentKey(r), at: Date.now() };
}

/** Recipes that say the same thing: same web page + title, otherwise same content. */
function dupKey(r: R19): string {
  const s = sourceKey(r);
  return s ? 's:' + s + '|' + norm(r.title) : 'c:' + contentKey(r);
}
const originKey = (o: { uid: string; recipeId: string }) => o.uid + ':' + o.recipeId;

export type FamilyCard<R> = {
  key: string;
  recipe: R;                                // what opens when tapped
  owners: { uid: string; name: string }[];  // "From Alice & Lisa"
  versionOf?: string;                       // edited copy: "Lisa's version of Alice's recipe"
  saved?: R;                                // my own copy, if I already saved it
};

export type FamilyDedupe<R> = { cards: FamilyCard<R>[]; hiddenCopies: number; merged: number };

/**
 * Turns everyone's shared recipes into the Family tab:
 *  1. Hides unedited copies whose original is visible (or is mine), so nothing shows twice.
 *  2. Shows edited copies as "Lisa's version".
 *  3. Combines independent imports of the same web recipe into one card: "From Alice & Lisa".
 *  4. Marks cards I already saved with ✓ Saved (and links to my copy).
 */
export function dedupeFamily<R extends R19>(list: FamilyRecipe<R>[], mine: R[], me: string, myName = 'you'): FamilyDedupe<R> {
  const visible = new Set(list.map(x => originKey({ uid: x.fromUid, recipeId: x.recipe.id })));
  mine.forEach(r => visible.add(originKey({ uid: me, recipeId: r.id })));
  const nameOf = new Map<string, string>([[me, myName]]);
  list.forEach(x => nameOf.set(x.fromUid, x.from));

  // 1 + 2: drop unedited copies of something still visible; keep edited ones as versions
  let hiddenCopies = 0;
  const kept: (FamilyRecipe<R> & { versionOf?: string })[] = [];
  for (const x of list) {
    const o = x.recipe.copiedFrom;
    if (o && o.uid !== x.fromUid && visible.has(originKey(o))) {
      if (isUneditedCopy(x.recipe)) { hiddenCopies++; continue; }
      kept.push({ ...x, versionOf: o.uid === me ? 'your' : `${nameOf.get(o.uid) || o.name}’s` });
      continue;
    }
    kept.push(x);
  }

  // 3: merge same-recipe imports (edited versions always stay separate)
  const groups = new Map<string, (typeof kept)[number][]>();
  for (const x of kept) {
    const k = x.versionOf ? 'v:' + x.fromUid + ':' + x.recipe.id : dupKey(x.recipe);
    const g = groups.get(k); if (g) g.push(x); else groups.set(k, [x]);
  }

  // 4: my saved copies, by origin and by sameness
  const myByOrigin = new Map<string, R>(), myByDup = new Map<string, R>();
  for (const r of mine) {
    if (r.copiedFrom) myByOrigin.set(originKey(r.copiedFrom), r);
    if (!r.copiedFrom || isUneditedCopy(r)) { const k = dupKey(r); if (!myByDup.has(k)) myByDup.set(k, r); }
  }

  let merged = 0;
  const cards: FamilyCard<R>[] = [];
  groups.forEach((g, k) => {
    g.sort((a, b) => a.from.localeCompare(b.from));
    if (g.length > 1) merged += g.length - 1;
    const owners: { uid: string; name: string }[] = [];
    g.forEach(x => { if (!owners.some(o => o.uid === x.fromUid)) owners.push({ uid: x.fromUid, name: x.from }); });
    let saved: R | undefined;
    for (const x of g) {
      saved = myByOrigin.get(originKey({ uid: x.fromUid, recipeId: x.recipe.id }))
        || (x.recipe.copiedFrom ? myByOrigin.get(originKey(x.recipe.copiedFrom)) : undefined);
      if (saved) break;
    }
    if (!saved && !g[0].versionOf) saved = myByDup.get(k);
    cards.push({ key: k, recipe: g[0].recipe, owners, versionOf: g[0].versionOf, saved });
  });
  cards.sort((a, b) => String(a.recipe.title).localeCompare(String(b.recipe.title)));
  return { cards, hiddenCopies, merged };
}

export const ownersLabel = (owners: { name: string }[]) =>
  owners.length <= 2 ? owners.map(o => o.name).join(' & ') : `${owners[0].name} & ${owners.length - 1} others`;
