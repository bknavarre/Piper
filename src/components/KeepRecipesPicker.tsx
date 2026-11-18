import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { FREE_RECIPE_LIMIT, RECIPES } from '../lib/plans';
import './Pro.css';

type R = { id: string; title: string; image?: string; fav: boolean; updated: number };
type Props = { uid: string; onDone: () => void; onLater: () => void; onUpgrade: () => void };

const ts = (v: any) => (v?.toMillis ? v.toMillis() : typeof v === 'number' ? v : v ? Date.parse(v) || 0 : 0);

export default function KeepRecipesPicker({ uid, onDone, onLater, onUpgrade }: Props) {
  const [all, setAll] = useState<R[]>([]);
  const [keep, setKeep] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    getDocs(collection(db, RECIPES.collection(uid))).then(s => {
      const list = s.docs.map(d => {
        const x = d.data() as any;
        return { id: d.id, title: x[RECIPES.titleField] || 'Untitled recipe', image: x[RECIPES.imageField],
          fav: !!x[RECIPES.favoriteField], updated: ts(x[RECIPES.updatedField]) };
      }).sort((a, b) => Number(b.fav) - Number(a.fav) || b.updated - a.updated);
      setAll(list);
      setKeep(new Set(list.slice(0, FREE_RECIPE_LIMIT).map(r => r.id))); // favorites first, then most recent
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [uid]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? all.filter(r => r.title.toLowerCase().includes(t)) : all;
  }, [all, q]);

  const toggle = (id: string) => {
    setNote(null);
    setKeep(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else if (n.size >= FREE_RECIPE_LIMIT) { setNote(`You can keep ${FREE_RECIPE_LIMIT}. Uncheck one first.`); return prev; }
      else n.add(id);
      return n;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      for (let i = 0; i < all.length; i += 400) {
        const b = writeBatch(db);
        all.slice(i, i + 400).forEach(r => {
          const ref = doc(db, RECIPES.collection(uid), r.id);
          if (keep.has(r.id)) b.update(ref, { [RECIPES.archivedField]: false });
          else b.update(ref, { [RECIPES.archivedField]: true, archivedAt: serverTimestamp() });
        });
        await b.commit();
      }
      onDone();
    } catch { setNote("Couldn't save. Check your connection and try again."); setSaving(false); }
  };

  const archiveCount = all.length - keep.size;

  return (
    <div className="kp-screen" role="dialog" aria-modal="true">
      <header className="kp-head">
        <h2>Choose your 50 recipes</h2>
        <p>Piper Free keeps {FREE_RECIPE_LIMIT} recipes active. The rest go to your <strong>Pro archive</strong>.
          They're never deleted, and they come back the moment you upgrade.</p>
        <input className="kp-search" placeholder="Search your recipes" value={q} onChange={e => setQ(e.target.value)} />
        <div className="kp-count"><strong>{keep.size}</strong> / {FREE_RECIPE_LIMIT} kept · ⭐ favorites picked first</div>
        {note && <div className="pw-msg">{note}</div>}
      </header>

      <ul className="kp-list">
        {loading ? <li className="kp-empty">Loading your recipes…</li> :
          shown.map(r => (
            <li key={r.id} className={keep.has(r.id) ? 'on' : ''} onClick={() => toggle(r.id)}>
              <span className="kp-check">{keep.has(r.id) ? '✓' : ''}</span>
              {r.image ? <img src={r.image} alt="" /> : <span className="kp-noimg">🍽️</span>}
              <span className="kp-title">{r.fav ? '⭐ ' : ''}{r.title}</span>
            </li>
          ))}
      </ul>

      <footer className="kp-foot">
        {!confirm ? (
          <>
            <button className="pw-cta" disabled={loading || keep.size === 0} onClick={() => setConfirm(true)}>
              Keep these {keep.size}
            </button>
            <button className="kp-upgrade" onClick={onUpgrade}>Keep all {all.length || ''} with Piper Pro</button>
            <button className="pw-free" onClick={onLater}>Decide later</button>
          </>
        ) : (
          <>
            <p className="kp-confirm">{archiveCount} recipe{archiveCount === 1 ? '' : 's'} will move to your Pro archive.
              You can swap which ones are active anytime from Preferences.</p>
            <button className="pw-cta" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Confirm'}</button>
            <button className="pw-free" disabled={saving} onClick={() => setConfirm(false)}>Back</button>
          </>
        )}
      </footer>
    </div>
  );
}

