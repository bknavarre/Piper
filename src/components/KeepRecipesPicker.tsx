import { useMemo, useState } from 'react';
import { FREE_RECIPE_LIMIT } from '../lib/plans';
import './Pro.css';

type R = { id: string; title: string; image?: string; favorite?: boolean; lastMade?: number; madeCount?: number; archived?: boolean };
type Props = { recipes: R[]; onConfirm: (keep: Set<string>) => void; onLater: () => void; onUpgrade: () => void };

export default function KeepRecipesPicker({ recipes, onConfirm, onLater, onUpgrade }: Props) {
  // Favorites first, then most-cooked / most-recently cooked, then the order they're stored in (newest first)
  const all = useMemo(() => recipes.map((r, i) => ({ r, i })).sort((a, b) =>
    Number(!!b.r.favorite) - Number(!!a.r.favorite) ||
    (b.r.lastMade || 0) - (a.r.lastMade || 0) ||
    (b.r.madeCount || 0) - (a.r.madeCount || 0) || a.i - b.i).map(x => x.r), [recipes]);
  // Re-picking? Start from what's active now. First time? Start from favorites + most cooked.
  const [keep, setKeep] = useState<Set<string>>(() => {
    const active = all.filter(r => !r.archived);
    const start = recipes.some(r => r.archived) && active.length <= FREE_RECIPE_LIMIT ? active : all;
    return new Set(start.slice(0, FREE_RECIPE_LIMIT).map(r => r.id));
  });
  const [q, setQ] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState<string | null>(null);

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

  const archiveCount = all.length - keep.size;

  return (
    <div className="kp-screen" role="dialog" aria-modal="true" aria-labelledby="kp-title">
      <header className="kp-head">
        <h2 id="kp-title">Choose your {FREE_RECIPE_LIMIT} recipes</h2>
        <p>Piper Free keeps {FREE_RECIPE_LIMIT} recipes active. The rest go to your <strong>Pro archive</strong>.
          They're never deleted, and they come back the moment you upgrade.</p>
        <input className="kp-search" placeholder="Search your recipes" aria-label="Search your recipes" value={q} onChange={e => setQ(e.target.value)} />
        <div className="kp-count"><strong>{keep.size}</strong> / {FREE_RECIPE_LIMIT} kept · ♥ favorites picked first</div>
        {note && <div className="pw-msg" role="status">{note}</div>}
      </header>

      <ul className="kp-list">
        {shown.map(r => (
          <li key={r.id}>
            <button type="button" className={keep.has(r.id) ? 'on' : ''} aria-pressed={keep.has(r.id)} onClick={() => toggle(r.id)}>
              <span className="kp-check">{keep.has(r.id) ? '✓' : ''}</span>
              {r.image && !r.image.startsWith('data:') ? <img src={r.image} alt="" loading="lazy" /> : <span className="kp-noimg">🍽️</span>}
              <span className="kp-title">{r.favorite ? '♥ ' : ''}{r.title}</span>
            </button>
          </li>
        ))}
      </ul>

      <footer className="kp-foot">
        {!confirm ? (
          <>
            <button className="pw-cta" disabled={keep.size === 0} onClick={() => setConfirm(true)}>Keep these {keep.size}</button>
            <button className="kp-upgrade" onClick={onUpgrade}>Keep all {all.length} with Piper Pro</button>
            <button className="pw-free" onClick={onLater}>Decide later</button>
          </>
        ) : (
          <>
            <p className="kp-confirm">{archiveCount} recipe{archiveCount === 1 ? '' : 's'} will move to your Pro archive.
              You can change which ones are active anytime from Preferences.</p>
            <button className="pw-cta" onClick={() => onConfirm(keep)}>Confirm</button>
            <button className="pw-free" onClick={() => setConfirm(false)}>Back</button>
          </>
        )}
      </footer>
    </div>
  );
}
