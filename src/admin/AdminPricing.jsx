import { useEffect, useState } from 'react';
import { BadgeDollarSign, CalendarRange, Pencil, Plus } from 'lucide-react';
import { formatKobo } from '../lib/catalog';
import { supabase } from '../lib/supabase';
import { assertResult, nairaToKobo } from './catalogue';

const emptyRule = {
  name: 'HyperView standard pricing', venue_id: '', weekday_naira: '10500',
  weekend_naira: '12500', effective_from: '', effective_until: '', is_active: true,
};

export default function AdminPricing() {
  const [rules, setRules] = useState([]);
  const [venues, setVenues] = useState([]);
  const [rule, setRule] = useState(emptyRule);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    const [ruleResult, venueResult] = await Promise.all([
      supabase.from('pricing_rules').select('*').order('effective_from', { ascending: false }),
      supabase.from('venues').select('id,name').order('name'),
    ]);
    setRules(assertResult(ruleResult) || []);
    setVenues(assertResult(venueResult) || []);
  }

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from('pricing_rules').select('*').order('effective_from', { ascending: false }),
      supabase.from('venues').select('id,name').order('name'),
    ]).then(([ruleResult, venueResult]) => {
      if (!active) return;
      setRules(assertResult(ruleResult) || []);
      setVenues(assertResult(venueResult) || []);
    }).catch((caught) => { if (active) setError(caught.message); });
    return () => { active = false; };
  }, []);

  const update = (key, value) => setRule((current) => ({ ...current, [key]: value }));
  const edit = (item) => setRule({
    ...item,
    venue_id: item.venue_id || '',
    weekday_naira: String(Number(item.weekday_price_kobo) / 100),
    weekend_naira: String(Number(item.weekend_price_kobo) / 100),
    effective_until: item.effective_until || '',
  });

  async function save(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const values = {
        name: rule.name.trim(), venue_id: rule.venue_id || null,
        weekday_price_kobo: nairaToKobo(rule.weekday_naira),
        weekend_price_kobo: nairaToKobo(rule.weekend_naira),
        effective_from: rule.effective_from,
        effective_until: rule.effective_until || null,
        is_active: Boolean(rule.is_active), updated_at: new Date().toISOString(),
      };
      if (!values.name || !values.effective_from) throw new Error('Enter a rule name and effective date.');
      if (values.effective_until && values.effective_until < values.effective_from) {
        throw new Error('The end date cannot be before the start date.');
      }
      if (rule.id) assertResult(await supabase.from('pricing_rules').update(values).eq('id', rule.id));
      else assertResult(await supabase.from('pricing_rules').insert(values));
      setRule(emptyRule); await load(); setNotice('Pricing rule saved. Future session prices were refreshed.');
    } catch (caught) { setError(caught.message); }
    finally { setBusy(false); }
  }

  return <main className="admin-content"><div className="admin-page-header"><p className="admin-overline">Commerce / Pricing</p>
    <h1>Session pricing</h1><p>Weekday and weekend prices are selected automatically from the session date in Lagos time.</p></div>
    <div className="admin-two-column"><section className="admin-panel"><h2>Effective rules <span className="admin-count">{rules.length}</span></h2>
      <div className="admin-list">{rules.map((item) => <button type="button" className="admin-list-item" key={item.id} onClick={() => edit(item)}>
        <span className="admin-list-icon"><CalendarRange size={19} /></span><span><strong>{item.name}</strong>
          <small>{venues.find((venue) => venue.id === item.venue_id)?.name || 'All venues'} · from {item.effective_from}{item.effective_until ? ` to ${item.effective_until}` : ''}</small></span>
        <span><strong>{formatKobo(item.weekday_price_kobo)}</strong><small>weekday</small></span>
        <span><strong>{formatKobo(item.weekend_price_kobo)}</strong><small>weekend</small></span>
        <span className={`admin-status ${item.is_active ? 'admin-status--published' : 'admin-status--archived'}`}>{item.is_active ? 'Active' : 'Inactive'}</span><Pencil size={15} />
      </button>)}</div>
    </section>
    <form className="admin-panel" onSubmit={save}><div className="admin-panel-heading"><h2>{rule.id ? 'Edit pricing rule' : 'Add pricing rule'}</h2>
      {rule.id && <button type="button" className="admin-link-button" onClick={() => setRule(emptyRule)}><Plus size={15} /> New rule</button>}</div>
      <div className="admin-fields admin-fields--single"><label>Name<input required value={rule.name} onChange={(e) => update('name', e.target.value)} /></label>
        <label>Venue<select value={rule.venue_id} onChange={(e) => update('venue_id', e.target.value)}><option value="">All venues</option>{venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</select></label>
        <label>Weekday price (₦)<input required inputMode="decimal" value={rule.weekday_naira} onChange={(e) => update('weekday_naira', e.target.value)} /></label>
        <label>Weekend price (₦)<input required inputMode="decimal" value={rule.weekend_naira} onChange={(e) => update('weekend_naira', e.target.value)} /></label>
        <label>Effective from<input required type="date" value={rule.effective_from} onChange={(e) => update('effective_from', e.target.value)} /></label>
        <label>Effective until (optional)<input type="date" value={rule.effective_until} onChange={(e) => update('effective_until', e.target.value)} /></label>
        <label className="admin-checkbox"><input type="checkbox" checked={rule.is_active} onChange={(e) => update('is_active', e.target.checked)} /> Rule is active</label></div>
      <p className="admin-help">A venue-specific rule takes priority over the all-venues rule. For overlapping rules, the latest effective start date wins.</p>
      {error && <p className="admin-error" role="alert">{error}</p>}{notice && <p className="admin-success" role="status">{notice}</p>}
      <button className="admin-button admin-button--primary" disabled={busy}><BadgeDollarSign size={17} /> {busy ? 'Saving…' : 'Save pricing rule'}</button>
    </form></div>
  </main>;
}
