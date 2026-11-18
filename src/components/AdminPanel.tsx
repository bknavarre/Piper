// Pass 16: Piper Admin — give, change, or remove Pro & Family without the Firebase console.
// Only shown to ADMIN_EMAILS. Firestore rules (isAdmin) enforce it on the server too.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { usePro } from '../context/ProContext';
import { isAdminEmail } from '../lib/plans';
import './Pro.css';

type Member = {
  uid: string; email: string; displayName: string; lastSeen: Date | null;
  recipesActive?: number; aiUsedThisMonth?: number; familyRole?: string | null;
};
type Ent = { plan: 'pro' | 'family'; active: boolean; source: string; note: string; expiresAt: Date | null; email?: string };
type Filter = 'all' | 'pro' | 'family' | 'free' | 'ending';

const toDate = (v: any): Date | null => (v && typeof v.toDate === 'function' ? v.toDate() : null);
const live = (e?: Ent) => !!e && e.active && (!e.expiresAt || e.expiresAt > new Date());
const fmt = (d: Date | null) => (d ? d.toLocaleDateString() : '');
const ago = (d: Date | null) => {
  if (!d) return 'not yet';
  const days = Math.floor((Date.now() - d.getTime()) / 864e5);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days}d ago`;
};

const LENGTHS = [
  { k: 'none', label: 'No end date', days: 0 },
  { k: '30', label: '1 month', days: 30 },
  { k: '90', label: '3 months', days: 90 },
  { k: '365', label: '1 year', days: 365 },
  { k: 'date', label: 'Pick a date…', days: 0 },
];

export default function AdminPanel() {
  const pro = usePro();
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [ents, setEnts] = useState<Record<string, Ent>>({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<string | null>(null);
  const admin = isAdminEmail(pro.user?.email);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const [ms, es] = await Promise.all([getDocs(collection(db, 'members')), getDocs(collection(db, 'entitlements'))]);
      setMembers(ms.docs.map((d: any) => {
        const x = d.data() as any;
        return { uid: d.id, email: x.email || '', displayName: x.displayName || '', lastSeen: toDate(x.lastSeen),
          recipesActive: x.recipesActive, aiUsedThisMonth: x.aiUsedThisMonth, familyRole: x.familyRole };
      }));
      const map: Record<string, Ent> = {};
      es.docs.forEach((d: any) => {
        const x = d.data() as any;
        map[d.id] = { plan: x.plan === 'family' ? 'family' : 'pro', active: x.active === true, source: x.source || 'comp',
          note: x.note || '', expiresAt: toDate(x.expiresAt), email: x.email };
      });
      setEnts(map);
    } catch (e: any) {
      setErr(e?.code === 'permission-denied'
        ? 'Permission denied. Make sure your email is in isAdmin() in firestore.rules and the rules are published.'
        : "Couldn't load users. Check your connection and try again.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (open && admin) load(); }, [open, admin, load]);

  const rows = useMemo(() => {
    const byUid = new Map<string, Member>(members.map(m => [m.uid, m]));
    Object.entries(ents).forEach(([uid, e]) => {
      if (!byUid.has(uid)) byUid.set(uid, { uid, email: e.email || '(hasn’t opened the new build yet)', displayName: '', lastSeen: null });
    });
    const soon = Date.now() + 14 * 864e5;
    const t = q.trim().toLowerCase();
    return [...byUid.values()]
      .filter(m => !t || m.email.toLowerCase().includes(t) || m.displayName.toLowerCase().includes(t) || m.uid.toLowerCase().startsWith(t))
      .filter(m => {
        const e = ents[m.uid];
        if (filter === 'all') return true;
        if (filter === 'free') return !live(e) && m.familyRole !== 'member';
        if (filter === 'ending') return live(e) && !!e.expiresAt && e.expiresAt.getTime() < soon;
        return live(e) && e.plan === filter;
      })
      .sort((a, b) => Number(live(ents[b.uid])) - Number(live(ents[a.uid])) ||
        (b.lastSeen?.getTime() || 0) - (a.lastSeen?.getTime() || 0));
  }, [members, ents, q, filter]);

  const stats = useMemo(() => {
    const on = Object.values(ents).filter(live);
    return {
      users: new Set([...members.map(m => m.uid), ...Object.keys(ents)]).size,
      pro: on.filter(e => e.plan === 'pro').length,
      family: on.filter(e => e.plan === 'family').length,
      inFamily: members.filter(m => m.familyRole === 'member').length,
      paying: on.filter(e => e.source === 'apple').length,
    };
  }, [members, ents]);

  if (!admin) return null;

  return (
    <section className="ad-wrap">
      <button className="ad-toggle" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span>🛠️ Piper Admin</span><span>{open ? '▾' : '▸'}</span>
      </button>

      {open && <>
        <div className="ad-stats">
          <div><b>{stats.users}</b><small>users</small></div>
          <div><b>{stats.pro}</b><small>Pro</small></div>
          <div><b>{stats.family}</b><small>Families</small></div>
          <div><b>{stats.inFamily}</b><small>in families</small></div>
          <div><b>{stats.paying}</b><small>paying</small></div>
        </div>

        <div className="ad-tools">
          <input className="kp-search" placeholder="Search email or name" value={q} onChange={e => setQ(e.target.value)} aria-label="Search users" />
          <button className="fm-link" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
        </div>
        <div className="ad-filters" role="tablist">
          {(['all', 'pro', 'family', 'free', 'ending'] as Filter[]).map(f => (
            <button key={f} role="tab" aria-selected={filter === f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
              {f === 'ending' ? 'Ending soon' : f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {err && <p className="pw-msg">{err}</p>}
        {!loading && !err && rows.length === 0 &&
          <p className="fm-note ad-note">No one matches. People appear here after they sign in to the latest Piper build once.</p>}

        <ul className="ad-list">
          {rows.map(m => {
            const e = ents[m.uid]; const on = live(e);
            const viaFamily = !on && m.familyRole === 'member';
            const badge = on ? (e.plan === 'family' ? 'Family' : 'Pro') : viaFamily ? 'In a family' : e && !e.active ? 'Removed' : e ? 'Expired' : 'Free';
            return (
              <li key={m.uid}>
                <button className="ad-row" onClick={() => setEditing(editing === m.uid ? null : m.uid)} aria-expanded={editing === m.uid}>
                  <span className="ad-who">
                    <strong>{m.displayName || m.email.split('@')[0] || 'User'}{m.uid === pro.user?.uid ? ' (you)' : ''}</strong>
                    <small>{m.email}</small>
                    <small>Seen {ago(m.lastSeen)} · {m.recipesActive ?? '–'} recipes · {m.aiUsedThisMonth ?? 0} AI</small>
                  </span>
                  <span className={`ad-badge ${on ? e.plan : viaFamily ? 'family' : 'free'}`}>
                    {badge}
                    {on && <small>{e.source === 'beta' ? 'beta' : e.source === 'apple' ? 'paid' : 'comp'}{e.expiresAt ? ` · ends ${fmt(e.expiresAt)}` : ''}</small>}
                  </span>
                </button>
                {editing === m.uid && (
                  <GrantEditor member={m} ent={e} adminEmail={pro.user?.email || ''}
                    onSaved={next => { setEnts(s => ({ ...s, [m.uid]: next })); setEditing(null); }} />
                )}
              </li>
            );
          })}
        </ul>
        <p className="fm-note ad-note">Changes apply instantly on their device. Paid plans are handled by Apple.</p>
      </>}
    </section>
  );
}

function GrantEditor({ member, ent, adminEmail, onSaved }:
  { member: Member; ent?: Ent; adminEmail: string; onSaved: (e: Ent) => void }) {
  const on = live(ent);
  const [plan, setPlan] = useState<'pro' | 'family'>(ent?.plan ?? 'pro');
  const [source, setSource] = useState<'beta' | 'comp'>(ent?.source === 'comp' ? 'comp' : 'beta');
  const [note, setNote] = useState(ent?.note ?? '');
  const [len, setLen] = useState(on && ent?.expiresAt ? 'date' : 'none');
  const [date, setDate] = useState(on && ent?.expiresAt ? ent.expiresAt.toISOString().slice(0, 10) : '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (on && ent?.source === 'apple') {
    return <div className="ad-edit"><p className="fm-note">This person pays through Apple. Their plan updates automatically when they renew or cancel.</p></div>;
  }

  const expiry = (): Date | null => {
    if (len === 'date') return date ? new Date(`${date}T23:59:59`) : null;
    const d = LENGTHS.find(l => l.k === len)?.days || 0;
    return d ? new Date(Date.now() + d * 864e5) : null;
  };

  const save = async () => {
    const exp = expiry();
    if (len === 'date' && !exp) { setMsg('Pick an end date.'); return; }
    if (exp && exp <= new Date()) { setMsg('That end date is in the past.'); return; }
    setBusy(true); setMsg(null);
    try {
      await setDoc(doc(db, 'entitlements', member.uid), {
        plan, active: true, source, note: note.trim(), email: member.email,
        expiresAt: exp ? Timestamp.fromDate(exp) : null,
        updatedAt: serverTimestamp(), updatedBy: adminEmail,
        ...(on ? {} : { grantedAt: serverTimestamp() }),
      }, { merge: true });
      onSaved({ plan, active: true, source, note: note.trim(), expiresAt: exp, email: member.email });
    } catch { setMsg("Couldn't save. Check your rules and connection."); setBusy(false); }
  };

  const remove = async () => {
    const what = ent?.plan === 'family' ? 'Family' : 'Pro';
    if (!window.confirm(`Remove ${what} from ${member.email || 'this user'}?${ent?.plan === 'family' ? ' Everyone in their family goes back to Free too.' : ''}`)) return;
    setBusy(true); setMsg(null);
    try {
      await updateDoc(doc(db, 'entitlements', member.uid), {
        active: false, revokedAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: adminEmail,
      });
      onSaved({ ...(ent as Ent), active: false });
    } catch { setMsg("Couldn't remove it. Try again."); setBusy(false); }
  };

  return (
    <div className="ad-edit">
      <div className="ad-field"><span>Plan</span>
        <div className="pw-seg">
          {(['pro', 'family'] as const).map(p =>
            <button key={p} className={plan === p ? 'on' : ''} onClick={() => setPlan(p)}>{p === 'pro' ? '🍊 Pro' : '👨‍👩‍👧‍👦 Family'}</button>)}
        </div>
      </div>
      <div className="ad-field"><span>Type</span>
        <div className="pw-seg">
          {(['beta', 'comp'] as const).map(s =>
            <button key={s} className={source === s ? 'on' : ''} onClick={() => setSource(s)}>{s === 'beta' ? 'Beta tester' : 'Complimentary'}</button>)}
        </div>
      </div>
      <label className="ad-field"><span>Length</span>
        <select className="fm-input ad-input" value={len} onChange={e => setLen(e.target.value)}>
          {LENGTHS.map(l => <option key={l.k} value={l.k}>{l.label}</option>)}
        </select>
      </label>
      {len === 'date' && <label className="ad-field"><span>Ends</span>
        <input type="date" className="fm-input ad-input" value={date} onChange={e => setDate(e.target.value)} /></label>}
      <label className="ad-field"><span>Note</span>
        <input className="fm-input ad-input" placeholder="Sister, coworker, beta group 1…" value={note} maxLength={80} onChange={e => setNote(e.target.value)} /></label>
      {msg && <p className="pw-msg">{msg}</p>}
      <div className={`ad-actions ${on ? '' : 'one'}`}>
        <button className="pw-cta" disabled={busy} onClick={save}>{busy ? 'Saving…' : on ? 'Update' : `Give ${plan === 'family' ? 'Family' : 'Pro'}`}</button>
        {on && <button className="ps-btn subtle" disabled={busy} onClick={remove}>Remove</button>}
      </div>
      <small className="ad-uid">UID {member.uid}</small>
    </div>
  );
}
