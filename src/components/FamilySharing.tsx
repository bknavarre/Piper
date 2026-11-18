// Pass 18: what a Piper Family shares. Shown under the family manager in Prefs.
import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useHousehold } from '../lib/family';
import './Pro.css';

export default function FamilySharing() {
  const fam = useHousehold();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (!fam.inFamily || !fam.hid) return null;

  const toggle = async () => {
    setBusy(true); setMsg(null);
    try { await updateDoc(doc(db, 'households', fam.hid!), { sharedGrocery: !fam.sharedGrocery }); }
    catch { setMsg("Couldn't change that. Try again."); }
    setBusy(false);
  };

  return (
    <div className="fm-card fs-card">
      <h4>What your family shares</h4>
      <div className="fs-row">
        <span><b>📖 Recipes</b><small>Everyone can see and save each other’s recipes. Make any recipe private from its page.</small></span>
        <em className="fs-pill on">Shared</em>
      </div>
      <div className="fs-row">
        <span><b>🗓️ Meal planner</b><small>Always private to each person.</small></span>
        <em className="fs-pill">Private</em>
      </div>
      <div className="fs-row">
        <span><b>🛒 Grocery list</b><small>{fam.sharedGrocery
          ? 'One list for the family. Ingredients from each person’s own meal plan still show only for them.'
          : 'Each person keeps their own list.'}</small></span>
        {fam.isOwner
          ? <button type="button" role="switch" aria-checked={fam.sharedGrocery} aria-label="Share one grocery list with the family"
              className={'fs-switch' + (fam.sharedGrocery ? ' on' : '')} disabled={busy} onClick={toggle}><i /></button>
          : <em className={'fs-pill' + (fam.sharedGrocery ? ' on' : '')}>{fam.sharedGrocery ? 'Shared' : 'Private'}</em>}
      </div>
      {!fam.isOwner && <small className="fm-note fs-foot">Only the family owner can turn the shared grocery list on or off.</small>}
      {fam.isOwner && <small className="fm-note fs-foot">Turning it off gives everyone back their own list. The family list is kept for next time.</small>}
      {msg && <p className="pw-msg">{msg}</p>}
    </div>
  );
}
