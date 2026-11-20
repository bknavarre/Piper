// Pass 23: Delete account (required by Apple for apps that let people create accounts).
// Order matters: confirm the password, remove family links, delete the person's data, then delete the sign-in itself.
import {
  EmailAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
} from 'firebase/auth';
import {
  clearIndexedDbPersistence,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  terminate,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from './firebase';

export type DeleteStep = (label: string) => void;

const FRIENDLY: Record<string, string> = {
  'auth/invalid-credential': 'That password is not right. Please try again.',
  'auth/wrong-password': 'That password is not right. Please try again.',
  'auth/missing-password': 'Enter your password to confirm.',
  'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
  'auth/network-request-failed': 'Piper could not reach the internet. Check your connection and try again.',
  'auth/requires-recent-login': 'For your security, please enter your password again.',
  'permission-denied': 'Piper could not remove some of your data. Nothing was deleted from your sign-in. Please try again or contact owner@upswingtx.com.',
};
export const deleteErrorMessage = (e: any) =>
  FRIENDLY[e?.code] || 'Something went wrong while deleting your account. Please try again or contact owner@upswingtx.com.';

/** Deletes every document in a collection the signed-in person is allowed to read, 400 at a time. */
async function deleteAll(path: string[]) {
  const snap = await getDocs(collection(db, path[0], ...path.slice(1)));
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
}

/** Removes the person from a family, or closes the family if they own it. */
async function leaveOrCloseFamily(uid: string, step: DeleteStep) {
  const ownRef = doc(db, 'households', uid);
  const own = await getDoc(ownRef).catch(() => null);

  if (own?.exists()) {
    step('Closing your family');
    const members: string[] = (own.data() as any).members || [];
    // Shared grocery list first: its rule checks the household, so it must go before the household does.
    await deleteAll(['households', uid, 'shared']).catch(() => {});
    const invites = await getDocs(query(collection(db, 'invites'), where('ownerUid', '==', uid))).catch(() => null);
    for (const d of invites?.docs || []) await deleteDoc(d.ref).catch(() => {});
    for (const m of members) if (m !== uid) await deleteDoc(doc(db, 'memberships', m)).catch(() => {});
    await deleteDoc(ownRef);
    return;
  }

  const memRef = doc(db, 'memberships', uid);
  const mem = await getDoc(memRef).catch(() => null);
  const hid = mem?.exists() ? String((mem.data() as any).householdId || '') : '';
  if (!hid) return;
  step('Leaving your family');
  await runTransaction(db, async tx => {
    const ref = doc(db, 'households', hid);
    const s = await tx.get(ref);
    if (!s.exists()) return;
    const h = s.data() as any;
    const members = ((h.members || []) as string[]).filter(m => m !== uid);
    const memberInfo = { ...(h.memberInfo || {}) };
    delete memberInfo[uid];
    tx.update(ref, { members, memberCount: members.length, memberInfo });
  }).catch(() => {});
  await deleteDoc(memRef);
}

/** Removes everything Piper stored on this device (recipes, photos, cached cloud data). */
async function wipeThisDevice() {
  try { await terminate(db); await clearIndexedDbPersistence(db); } catch { /* fine */ }
  try {
    Object.keys(localStorage).filter(k => k.startsWith('piper.')).forEach(k => localStorage.removeItem(k));
  } catch { /* fine */ }
  try {
    const list = await (indexedDB as any).databases?.();
    for (const d of list || []) if (d?.name) indexedDB.deleteDatabase(d.name);
  } catch { /* fine */ }
}

export async function deleteMyAccount(password: string, step: DeleteStep) {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('Please sign in first.');
  const uid = user.uid;

  step('Checking your password');
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));

  await leaveOrCloseFamily(uid, step);

  step('Deleting your recipes');
  await deleteAll(['users', uid, 'recipes']);

  step('Deleting your planner, groceries and settings');
  await deleteAll(['users', uid, 'state']);
  await deleteAll(['users', uid, 'imports']).catch(() => {});
  await deleteDoc(doc(db, 'users', uid)).catch(() => {});
  await deleteDoc(doc(db, 'members', uid)).catch(() => {});

  step('Deleting your feedback');
  const fb = await getDocs(query(collection(db, 'betaFeedback'), where('uid', '==', uid))).catch(() => null);
  for (const d of fb?.docs || []) await deleteDoc(d.ref).catch(() => {});

  step('Deleting your sign-in');
  await deleteUser(user);

  step('Clearing this device');
  await wipeThisDevice();
}
