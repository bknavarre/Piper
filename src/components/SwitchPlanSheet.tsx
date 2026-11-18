import { arrayRemove, deleteField, doc, increment, writeBatch } from 'firebase/firestore';
import { ReactNode, useState } from 'react';
import { db } from '../firebase';
import { usePro } from '../context/ProContext';
import { FREE_RECIPE_LIMIT, LIMITS, PLAN_NAME, SUPPORT_EMAIL } from '../lib/plans';
import { openManageSubscriptions } from '../lib/purchases';
import './Pro.css';

/** target 'free' = downgrade to Free; 'pro' = Family owner moving down to Pro */
export default function SwitchPlanSheet({ target, onClose }: { target: 'free' | 'pro'; onClose: () => void }) {
  const pro = usePro();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const over = Math.max(pro.recipeCounts.active - FREE_RECIPE_LIMIT, 0);
  const until = pro.expiresAt ? pro.expiresAt.toLocaleDateString() : 'the end of your billing period';

  const leaveFamily = async () => {
    if (!pro.user || !pro.householdId) return;
    setBusy(true); setErr(null);
    try {
      const b = writeBatch(db);
      b.update(doc(db, 'households', pro.householdId), { members: arrayRemove(pro.user.uid), memberCount: increment(-1), [`memberInfo.${pro.user.uid}`]: deleteField() });
      b.delete(doc(db, 'memberships', pro.user.uid));
      await b.commit(); onClose();
    } catch { setErr("Couldn't leave the family. Try again."); setBusy(false); }
  };

  const whatHappens = target === 'free' ? [
    pro.source === 'apple' ? `You keep ${PLAN_NAME[pro.plan]} until ${until}.` : null,
    `Piper AI drops to ${LIMITS.free.aiPerMonth} actions a month.`,
    over > 0
      ? `You have ${pro.recipeCounts.active} recipes. You'll choose ${FREE_RECIPE_LIMIT} to keep active. The other ${over} go to your Pro archive. Nothing is deleted.`
      : `You can keep up to ${FREE_RECIPE_LIMIT} recipes.`,
    'Bulk and social imports become Pro-only.',
    pro.isFamilyOwner ? 'Everyone in your family goes back to Free too.' : null,
    'Your planner, grocery list, and pantry stay exactly as they are.',
  ] : [
    'You keep Piper Pro with all your recipes and AI.',
    'Family members lose Pro when your Family plan ends.',
  ];

  let action: ReactNode;
  if (pro.isFamilyMember) {
    action = <button className="pw-cta danger" disabled={busy} onClick={leaveFamily}>{busy ? 'Working…' : 'Leave family & switch to Free'}</button>;
  } else if (pro.source === 'apple') {
    action = <button className="pw-cta" onClick={() => { openManageSubscriptions(); onClose(); }}>Continue in the App Store</button>;
  } else {
    action = <a className="pw-cta as-link" href={`mailto:${SUPPORT_EMAIL}?subject=Piper%20plan%20change`}>Contact Piper support</a>;
  }

  return (
    <div className="pw-backdrop" onClick={onClose}>
      <div className="pw-sheet" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <button className="pw-close" aria-label="Close" onClick={onClose}>✕</button>
        <h2 className="pw-title">{target === 'free' ? 'Switch to Piper Free?' : 'Switch to Piper Pro?'}</h2>
        {pro.isFamilyMember && <p className="pw-sub">You're on a Family plan. Leaving the family switches you to Free.</p>}
        {pro.source === 'apple' && <p className="pw-sub">Apple handles plan changes. We'll open your App Store subscriptions.</p>}
        {(pro.source === 'comp' || pro.source === 'beta') &&
          <p className="pw-sub">Your {PLAN_NAME[pro.plan]} is complimentary, so there's nothing to cancel. If you'd still like to change it, let us know.</p>}
        <h4 className="sp-h">What changes</h4>
        <ul className="sp-list">{whatHappens.filter(Boolean).map(t => <li key={t as string}>{t}</li>)}</ul>
        {action}
        {err && <p className="pw-msg">{err}</p>}
        <button className="pw-free" onClick={onClose}>Keep {PLAN_NAME[pro.plan]}</button>
      </div>
    </div>
  );
}
