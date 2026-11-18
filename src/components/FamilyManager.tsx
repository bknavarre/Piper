import { useEffect, useState } from 'react';
import {
  arrayRemove, arrayUnion, deleteField, doc, getDoc, increment, onSnapshot,
  serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { usePro } from '../context/ProContext';
import { FAMILY_MAX_MEMBERS } from '../lib/plans';
import './Pro.css';

const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from(crypto.getRandomValues(new Uint32Array(8)), n => ALPHA[n % ALPHA.length]).join('');
const pretty = (c: string) => `${c.slice(0, 4)}-${c.slice(4)}`;
const clean = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, '');

type Household = {
  ownerUid: string; ownerName: string; inviteCode: string; members: string[];
  memberInfo: Record<string, { name: string; email: string; joinedAt?: any }>; memberCount?: number;
};

export default function FamilyManager() {
  const { user, isFamilyOwner, isFamilyMember, householdId } = usePro();
  const hid = isFamilyOwner ? user?.uid ?? null : householdId;
  const [hh, setHh] = useState<Household | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const me = user ? { name: user.displayName || user.email?.split('@')[0] || 'Member', email: user.email || '' } : null;

  useEffect(() => {
    if (!hid) { setHh(null); return; }
    return onSnapshot(doc(db, 'households', hid), async s => {
      if (s.exists()) { setHh(s.data() as Household); return; }
      if (isFamilyOwner && user && me) { // first time: create the household + invite code
        const c = newCode(); const b = writeBatch(db);
        b.set(doc(db, 'households', user.uid), {
          ownerUid: user.uid, ownerName: me.name, ownerEmail: me.email, inviteCode: c, members: [user.uid], memberCount: 1,
          memberInfo: { [user.uid]: { ...me, joinedAt: serverTimestamp() } }, createdAt: serverTimestamp(),
        });
        b.set(doc(db, 'invites', c), { ownerUid: user.uid, createdAt: serverTimestamp() });
        await b.commit().catch(() => setMsg("Couldn't set up your family. Try again."));
      }
    }, () => setHh(null));
  }, [hid, isFamilyOwner, user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (fn: () => Promise<void>, fail: string) => {
    setBusy(true); setMsg(null);
    try { await fn(); } catch { setMsg(fail); }
    setBusy(false);
  };

  const share = async () => {
    if (!hh) return;
    const text = `Join my Piper Family! Open Piper → Preferences → Join a family, and enter code ${pretty(hh.inviteCode)}`;
    try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); setMsg('Invite copied.'); } }
    catch { /* user canceled */ }
  };

  const rotate = () => act(async () => {
    if (!user || !hh) return;
    const c = newCode(); const b = writeBatch(db);
    b.set(doc(db, 'invites', c), { ownerUid: user.uid, createdAt: serverTimestamp() });
    b.update(doc(db, 'households', user.uid), { inviteCode: c });
    b.delete(doc(db, 'invites', hh.inviteCode));
    await b.commit();
  }, "Couldn't make a new code.");

  const removeMember = (uid: string) => act(async () => {
    if (!user) return;
    const b = writeBatch(db);
    b.update(doc(db, 'households', user.uid), { members: arrayRemove(uid), memberCount: increment(-1), [`memberInfo.${uid}`]: deleteField() });
    b.delete(doc(db, 'memberships', uid));
    await b.commit();
  }, "Couldn't remove that member.");

  const leave = () => act(async () => {
    if (!user || !householdId) return;
    const b = writeBatch(db);
    b.update(doc(db, 'households', householdId), { members: arrayRemove(user.uid), memberCount: increment(-1), [`memberInfo.${user.uid}`]: deleteField() });
    b.delete(doc(db, 'memberships', user.uid));
    await b.commit();
  }, "Couldn't leave the family. Try again.");

  const join = () => act(async () => {
    if (!user || !me) return;
    const c = clean(code);
    if (c.length !== 8) throw new Error();
    const inv = await getDoc(doc(db, 'invites', c));
    if (!inv.exists()) throw new Error();
    const owner = inv.data().ownerUid as string;
    if (owner === user.uid) throw new Error();
    const b = writeBatch(db);
    b.update(doc(db, 'households', owner), { members: arrayUnion(user.uid), memberCount: increment(1), [`memberInfo.${user.uid}`]: { ...me, joinedAt: serverTimestamp() }, lastJoinCode: c });
    b.set(doc(db, 'memberships', user.uid), { householdId: owner, joinedAt: serverTimestamp() });
    await b.commit();
    setCode('');
  }, "That code didn't work. It may be expired, or the family may be full.");

  // ── Owner ──
  if (isFamilyOwner) {
    if (!hh) return <div className="fm-card"><p>Setting up your family…</p>{msg && <p className="pw-msg">{msg}</p>}</div>;
    return (
      <div className="fm-card">
        <h4>Your Piper Family · {hh.members.length}/{FAMILY_MAX_MEMBERS}</h4>
        <div className="fm-code">
          <span>Invite code</span><strong>{pretty(hh.inviteCode)}</strong>
          <div className="fm-row">
            <button className="fm-btn" onClick={share} disabled={busy}>Share invite</button>
            <button className="fm-link" onClick={rotate} disabled={busy}>New code</button>
          </div>
        </div>
        <ul className="fm-members">
          {hh.members.map(uid => (
            <li key={uid}>
              <span>{hh.memberInfo?.[uid]?.name ?? 'Member'}{uid === hh.ownerUid ? ' (you)' : ''}
                <small>{hh.memberInfo?.[uid]?.email}</small></span>
              {uid !== hh.ownerUid && <button className="fm-link danger" disabled={busy} onClick={() => removeMember(uid)}>Remove</button>}
            </li>
          ))}
        </ul>
        {msg && <p className="pw-msg">{msg}</p>}
      </div>
    );
  }

  // ── Member ──
  if (isFamilyMember) {
    return (
      <div className="fm-card">
        <h4>You're in {hh?.ownerName ?? 'a'}'s Piper Family 👨‍👩‍👧‍👦</h4>
        <p className="fm-note">You have every Pro feature, and your recipes are your own.</p>
        <button className="fm-link danger" onClick={leave} disabled={busy}>Leave family</button>
        {msg && <p className="pw-msg">{msg}</p>}
      </div>
    );
  }

  // ── Not in a family: join with a code ──
  return (
    <div className="fm-card">
      <h4>Join a family</h4>
      <p className="fm-note">Got an invite code? Enter it to get Piper Pro through a Family plan.</p>
      <div className="fm-row">
        <input className="fm-input" placeholder="XXXX-XXXX" value={code} autoCapitalize="characters"
          onChange={e => setCode(e.target.value)} maxLength={9} />
        <button className="fm-btn" onClick={join} disabled={busy || clean(code).length !== 8}>Join</button>
      </div>
      {msg && <p className="pw-msg">{msg}</p>}
    </div>
  );
}

