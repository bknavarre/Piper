import { useState } from 'react';
import { Billing, FAMILY_MAX_MEMBERS, PaidPlan, Plan, PRICES, PRIVACY_URL, ProReason, TERMS_URL } from '../lib/plans';
import { purchase, restorePurchases } from '../lib/purchases';
import './Pro.css';

const HEAD: Record<ProReason, { title: string; body: string }> = {
  general:      { title: 'Cook more. Plan less.', body: 'Piper Pro turns every recipe, meal plan, and grocery run into something effortless.' },
  ai:           { title: "You've used this month's free Piper AI", body: 'Free includes 5 AI actions a month. Pro gives you 100, plus unlimited recipes and premium imports.' },
  recipes:      { title: 'Your cookbook is full 📚', body: "You've saved 50 recipes on Piper Free. Go Pro to keep every recipe you love." },
  bulkImport:   { title: 'Bring your whole cookbook to Piper', body: 'Importing a full collection is part of Piper Pro. Start your free week and bring every recipe with you.' },
  socialImport: { title: 'Import this with Piper Pro', body: 'Turn social posts and captions into clean recipes in one tap.' },
  family:       { title: 'Pay for 2. Cook for 5.', body: `Everything in Piper Pro for up to ${FAMILY_MAX_MEMBERS} people, for about the price of two Pro plans.` },
};

const BENEFITS: Record<PaidPlan, [string, string, string][]> = {
  pro: [
    ['✨', 'Piper AI', 'Clean up messy recipes, create new ones from an idea, swap ingredients, and scale servings.'],
    ['📖', 'Share your recipes', 'See each other’s recipes and save favorites to your own cookbook.'],
    ['📦', 'Bring your whole cookbook', 'Import your collection from Copy Me That and other recipe apps.'],
    ['📥', 'Import from anywhere', 'Websites and social captions become clean, cookable Piper cards.'],
    ['🗓️', 'Smarter planning', 'Let Piper build your week and turn it into a grocery list.'],
    ['🥕', 'Pantry to plate', 'Tell Piper what you have. Get dinner ideas you can actually make.'],
  ],
  family: [
    ['👨‍👩‍👧‍👦', `Pro for up to ${FAMILY_MAX_MEMBERS} people`, 'Everyone in your household gets every Piper Pro feature.'],
    ['✨', 'Piper AI for everyone', 'Each person gets their own 100 AI actions every month.'],
    ['📚', 'Unlimited recipes each', 'Every member keeps their own full, private cookbook.'],
    ['🔑', 'Invite with a code', 'Share a code. Family joins in seconds, and you can remove anyone anytime.'],
    ['💸', 'Pay for 2, cook for 5', 'About the price of two Pro plans, shared by up to five people.'],
  ],
};

type Props = { reason: ProReason; initialPlan: PaidPlan; currentPlan: Plan; onClose: () => void };

export default function PaywallModal({ reason, initialPlan, currentPlan, onClose }: Props) {
  const [plan, setPlan] = useState<PaidPlan>(currentPlan === 'pro' ? 'family' : initialPlan);
  const [billing, setBilling] = useState<Billing>('annual');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const h = plan === 'family' && reason === 'general' ? HEAD.family : HEAD[reason];
  const p = PRICES[plan];
  const isCurrent = currentPlan === plan;

  const run = async (fn: () => Promise<{ ok: boolean; message?: string }>) => {
    setBusy(true); setMsg(null);
    const r = await fn(); setBusy(false);
    if (r.ok) onClose(); else if (r.message) setMsg(r.message);
  };

  const cta = isCurrent ? `You're on ${plan === 'pro' ? 'Piper Pro' : 'Piper Family'}`
    : currentPlan === 'pro' && plan === 'family' ? 'Upgrade to Family'
    : billing === 'annual' ? 'Start my free week'
    : `Subscribe for ${p.monthly.price}`;

  return (
    <div className="pw-backdrop" onClick={onClose}>
      <div className="pw-sheet" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <button className="pw-close" aria-label="Close" onClick={onClose}>✕</button>

        <div className="pw-seg" role="tablist">
          {(['pro', 'family'] as PaidPlan[]).map(k => (
            <button key={k} role="tab" aria-selected={plan === k} className={plan === k ? 'on' : ''} onClick={() => setPlan(k)}>
              {k === 'pro' ? '🍊 Pro' : '👨‍👩‍👧‍👦 Family'}
            </button>
          ))}
        </div>

        <h2 className="pw-title">{h.title}</h2>
        <p className="pw-sub">{h.body}</p>

        <ul className="pw-benefits">
          {BENEFITS[plan].map(([i, t, d]) => (
            <li key={t}><span className="pw-ico">{i}</span><div><strong>{t}</strong><span>{d}</span></div></li>
          ))}
        </ul>

        <div className="pw-plans">
          {(['annual', 'monthly'] as Billing[]).map(b => (
            <button key={b} className={`pw-plan ${billing === b ? 'on' : ''}`} onClick={() => setBilling(b)}>
              {p[b].badge && <span className="pw-tag">{p[b].badge}</span>}
              <strong>{b === 'annual' ? 'Annual' : 'Monthly'}</strong>
              <span>{p[b].price}</span>
              <small>{p[b].perMonth ? `just ${p[b].perMonth}` : '\u00a0'}</small>
            </button>
          ))}
        </div>

        <button className="pw-cta" disabled={busy || isCurrent} onClick={() => run(() => purchase(plan, billing))}>
          {busy ? 'Working…' : cta}
        </button>
        <p className="pw-cta-sub">{p[billing].trial}</p>
        {msg && <p className="pw-msg">{msg}</p>}

        <button className="pw-free" onClick={onClose}>
          {currentPlan === 'free' ? 'Continue with Piper Free' : 'Not now'}
        </button>

        <div className="pw-links">
          <button onClick={() => run(restorePurchases)} disabled={busy}>Restore Purchases</button>·
          <a href={TERMS_URL} target="_blank" rel="noreferrer">Terms of Use</a>·
          <a href={PRIVACY_URL} target="_blank" rel="noreferrer">Privacy Policy</a>
        </div>
        <p className="pw-legal">
          Payment is charged to your Apple ID at confirmation of purchase. Subscription renews automatically unless
          canceled at least 24 hours before the end of the current period. Manage or cancel anytime in your App Store
          account settings.
        </p>
      </div>
    </div>
  );
}
