// Drop at the VERY BOTTOM of Preferences:  <PlanSection />
import { useState } from 'react';
import { usePro } from '../context/ProContext';
import { FREE_RECIPE_LIMIT, PLAN_NAME } from '../lib/plans';
import { openManageSubscriptions, restorePurchases } from '../lib/purchases';
import FamilyManager from './FamilyManager';
import SwitchPlanSheet from './SwitchPlanSheet';
import AdminPanel from './AdminPanel';
import './Pro.css';

const SOURCE_LABEL: Record<string, string> = {
  apple: 'Billed through Apple', comp: 'Complimentary', beta: 'Beta tester', family: 'Through a Family plan', none: '',
};

export default function PlanSection() {
  const pro = usePro();
  const [sheet, setSheet] = useState<'free' | 'pro' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  if (!pro.user) return (
    <section className="ps-wrap">
      <h3 className="ps-h">Your plan</h3>
      <div className="ps-card"><strong>🥄 Piper Free</strong>
        <p className="fm-note" style={{ margin: '6px 0 0' }}>Sign in above to unlock Piper Pro or Piper Family and keep your plan on every device.</p></div>
    </section>);
  if (pro.loading) return null;

  const restore = async () => { const r = await restorePurchases(); setMsg(r.ok ? 'Purchases restored.' : r.message ?? null); };

  return (
    <section className="ps-wrap">
      <h3 className="ps-h">Your plan</h3>

      <div className={`ps-card ${pro.plan}`}>
        <div className="ps-top">
          <strong>{pro.plan === 'free' ? '🥄' : pro.plan === 'pro' ? '🍊' : '👨‍👩‍👧‍👦'} {PLAN_NAME[pro.plan]}</strong>
          {SOURCE_LABEL[pro.source] && <span className="ps-pill">{SOURCE_LABEL[pro.source]}</span>}
        </div>
        <div className="ps-stats">
          <span>✨ {pro.aiUsed}/{pro.aiLimit} AI this month</span>
          <span>📚 {pro.recipeCounts.active}{pro.isPro ? '' : `/${FREE_RECIPE_LIMIT}`} recipes</span>
          {pro.recipeCounts.archived > 0 && <span>🗄️ {pro.recipeCounts.archived} archived</span>}
        </div>
        {pro.expiresAt && <small className="ps-exp">{pro.source === 'apple' ? 'Renews or ends' : 'Ends'} {pro.expiresAt.toLocaleDateString()}</small>}
      </div>

      <div className="ps-actions">
        {pro.plan === 'free' && <>
          <button className="pw-cta" onClick={() => pro.openPaywall('general', 'pro')}>Upgrade to Piper Pro</button>
          <button className="ps-btn" onClick={() => pro.openPaywall('family', 'family')}>Get Piper Family</button>
          {pro.recipeCounts.archived > 0 &&
            <button className="ps-btn" onClick={pro.openKeepPicker}>Choose which {FREE_RECIPE_LIMIT} recipes are active</button>}
        </>}

        {pro.plan === 'pro' && <>
          <button className="pw-cta" onClick={() => pro.openPaywall('family', 'family')}>Upgrade to Piper Family</button>
          <button className="ps-btn subtle" onClick={() => setSheet('free')}>Switch to Free</button>
        </>}

        {pro.isFamilyOwner && <>
          <FamilyManager />
          <button className="ps-btn subtle" onClick={() => setSheet('pro')}>Switch to Pro</button>
          <button className="ps-btn subtle" onClick={() => setSheet('free')}>Switch to Free</button>
        </>}

        {pro.isFamilyMember && <>
          <FamilyManager />
          <button className="ps-btn subtle" onClick={() => setSheet('free')}>Switch to Free</button>
        </>}

        {pro.plan === 'free' && <FamilyManager />}
      </div>

      <div className="pw-links ps-links">
        <button onClick={restore}>Restore Purchases</button>
        {pro.source === 'apple' && <>·<button onClick={openManageSubscriptions}>Manage subscription</button></>}
      </div>
      {msg && <p className="pw-msg">{msg}</p>}

      <AdminPanel />

      {sheet && <SwitchPlanSheet target={sheet} onClose={() => setSheet(null)} />}
    </section>
  );
}
