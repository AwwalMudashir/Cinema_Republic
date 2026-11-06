import { useEffect, useState } from 'react';
import { BadgeDollarSign, CalendarRange, Pencil, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { formatKobo } from '../lib/catalog';
import { supabase } from '../lib/supabase';
import { adminFunction } from './api';
import { useAdminAuth } from './auth-context';
import { assertResult, nairaToKobo } from './catalogue';

const emptyRule = {
  name: 'HyperView standard pricing', venue_id: '', weekday_naira: '10500',
  weekend_naira: '12500', group_weekday_naira: '', group_weekend_naira: '',
  effective_from: '', effective_until: '', is_active: true,
};

export default function AdminPricing() {
  const { profile } = useAdminAuth();
  const [rules, setRules] = useState([]);
  const [venues, setVenues] = useState([]);
  const [rule, setRule] = useState(emptyRule);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

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
  const edit = (item) => {
    setRule({
      ...item,
      venue_id: item.venue_id || '',
      weekday_naira: String(Number(item.weekday_price_kobo) / 100),
      weekend_naira: String(Number(item.weekend_price_kobo) / 100),
      group_weekday_naira: item.group_weekday_price_kobo == null ? '' : String(Number(item.group_weekday_price_kobo) / 100),
      group_weekend_naira: item.group_weekend_price_kobo == null ? '' : String(Number(item.group_weekend_price_kobo) / 100),
      effective_until: item.effective_until || '',
    });
    setConfirmDelete(false); setError(''); setNotice('');
  };

  async function removeRule() {
    if (!rule.id || profile.role !== 'admin') return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await adminFunction('admin-catalogue', {
        action: 'delete_pricing_rule', pricing_rule_id: rule.id,
      });
      setRule(emptyRule); setConfirmDelete(false); await load();
      setNotice(`${result.title || 'Pricing rule'} was permanently deleted.`);
    } catch (caught) { setError(caught.message); }
    finally { setBusy(false); }
  }

  async function save(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const values = {
        name: rule.name.trim(), venue_id: rule.venue_id || null,
        weekday_price_kobo: nairaToKobo(rule.weekday_naira),
        weekend_price_kobo: nairaToKobo(rule.weekend_naira),
        group_weekday_price_kobo: nairaToKobo(rule.group_weekday_naira),
        group_weekend_price_kobo: nairaToKobo(rule.group_weekend_naira),
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
      setRule(emptyRule); await load(); setNotice('Pricing rule saved. Online ticket prices refresh automatically.');
    } catch (caught) { setError(caught.message); }
    finally { setBusy(false); }
  }

  return <main className="admin-content"><div className="admin-page-header"><p className="admin-overline">Commerce / Pricing</p>
    <h1>Admission pricing</h1><p>Set individual per-person prices and the total price for a 15-person group visit.</p></div>
    <div className="admin-two-column"><section className="admin-panel admin-pricing-rules-panel"><h2>Effective rules <span className="admin-count">{rules.length}</span></h2>
      <div className="admin-pricing-list">{rules.map((item) => <button type="button" className="admin-pricing-rule" key={item.id} onClick={() => edit(item)}>
        <span className="admin-list-icon admin-pricing-rule__icon"><CalendarRange size={19} /></span>
        <span className="admin-pricing-rule__identity"><strong>{item.name}</strong>
          <small>{venues.find((venue) => venue.id === item.venue_id)?.name || 'All venues'}</small>
          <small>{item.effective_from}{item.effective_until ? ` – ${item.effective_until}` : ' – no end date'}</small>
        </span>
        <span className="admin-pricing-rule__action"><span className={`admin-status ${item.is_active ? 'admin-status--published' : 'admin-status--archived'}`}>{item.is_active ? 'Active' : 'Inactive'}</span><Pencil size={15} aria-hidden="true" /></span>
        <span className="admin-pricing-rule__prices">
          <span className="admin-pricing-price"><small>Individual · per guest</small><span><span><em>Mon–Thu</em><strong>{formatKobo(item.weekday_price_kobo)}</strong></span><span><em>Fri–Sun</em><strong>{formatKobo(item.weekend_price_kobo)}</strong></span></span></span>
          <span className={`admin-pricing-price ${item.group_weekday_price_kobo == null ? 'admin-pricing-price--missing' : ''}`}><small>Group · 15-person total</small>{item.group_weekday_price_kobo == null
            ? <strong>Prices not set</strong>
            : <span><span><em>Mon–Thu</em><strong>{formatKobo(item.group_weekday_price_kobo)}</strong></span><span><em>Fri–Sun</em><strong>{formatKobo(item.group_weekend_price_kobo)}</strong></span></span>}</span>
        </span>
      </button>)}</div>
    </section>
    <form className="admin-panel" onSubmit={save}><div className="admin-panel-heading"><h2>{rule.id ? 'Edit pricing rule' : 'Add pricing rule'}</h2>
      {rule.id && <button type="button" className="admin-link-button" onClick={() => { setRule(emptyRule); setConfirmDelete(false); setError(''); setNotice(''); }}><Plus size={15} /> New rule</button>}</div>
      <div className="admin-fields admin-fields--single"><label>Name<input required value={rule.name} onChange={(e) => update('name', e.target.value)} /></label>
        <label>Venue<select value={rule.venue_id} onChange={(e) => update('venue_id', e.target.value)}><option value="">All venues</option>{venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</select></label>
        <label>Individual price, Monday–Thursday (₦)<input required inputMode="decimal" value={rule.weekday_naira} onChange={(e) => update('weekday_naira', e.target.value)} /></label>
        <label>Individual price, Friday–Sunday (₦)<input required inputMode="decimal" value={rule.weekend_naira} onChange={(e) => update('weekend_naira', e.target.value)} /></label>
        <label>15-person group total, Monday–Thursday (₦)<input required inputMode="decimal" value={rule.group_weekday_naira} onChange={(e) => update('group_weekday_naira', e.target.value)} /></label>
        <label>15-person group total, Friday–Sunday (₦)<input required inputMode="decimal" value={rule.group_weekend_naira} onChange={(e) => update('group_weekend_naira', e.target.value)} /></label>
        <label>Effective from<input required type="date" value={rule.effective_from} onChange={(e) => update('effective_from', e.target.value)} /></label>
        <label>Effective until (optional)<input type="date" value={rule.effective_until} onChange={(e) => update('effective_until', e.target.value)} /></label>
        <label className="admin-checkbox"><input type="checkbox" checked={rule.is_active} onChange={(e) => update('is_active', e.target.checked)} /> Rule is active</label></div>
      <p className="admin-help">Individual prices are per guest. Group prices are charged once for exactly 15 guests. Monday–Thursday and Friday–Sunday prices are chosen automatically from the purchase date.</p>
      {error && <p className="admin-error" role="alert">{error}</p>}{notice && <p className="admin-success" role="status">{notice}</p>}
      <button className="admin-button admin-button--primary" disabled={busy}><BadgeDollarSign size={17} /> {busy ? 'Saving…' : 'Save pricing rule'}</button>
      {rule.id && profile.role === 'admin' && <div className="admin-pricing-danger">
        {!confirmDelete ? <><div><strong>Delete this pricing rule</strong><p>Only unused, inactive rules can be permanently deleted.</p></div>
          <button type="button" className="admin-button admin-button--danger" onClick={() => { setConfirmDelete(true); setError(''); }} disabled={busy}><Trash2 size={16} /> Delete rule</button></>
          : <div className="admin-pricing-danger__confirm"><TriangleAlert size={21} /><div><strong>Permanently delete “{rule.name}”?</strong><p>This cannot be undone. Active or historically referenced rules will be blocked automatically.</p>
            <div className="admin-inline-actions"><button type="button" className="admin-button admin-button--danger" onClick={removeRule} disabled={busy}><Trash2 size={16} /> {busy ? 'Deleting…' : 'Yes, delete permanently'}</button>
              <button type="button" className="admin-button admin-button--quiet" onClick={() => setConfirmDelete(false)} disabled={busy}>Cancel</button></div></div></div>}
      </div>}
    </form></div>
  </main>;
}
