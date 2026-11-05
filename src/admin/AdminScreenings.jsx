import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, CalendarPlus2, Pencil, Plus, Ticket, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatKobo, formatShowing } from '../lib/catalog';
import { supabase } from '../lib/supabase';
import { useAdminAuth } from './auth-context';
import { assertResult, fromLagosInput, toLagosInput } from './catalogue';
import { adminFunction } from './api';
import { clearDraft, draftKey, readDraft, saveDraft } from './drafts';

const emptyScreening = { session_name: 'HyperView 9D Flying Cinema Session', session_kind: 'individual', venue_id: '', pricing_rule_id: '', starts_at: '', ends_at: '', sales_start: '', sales_end: '', status: 'draft', admission_opens_minutes: 15, admission_grace_minutes: 30 };
const emptyTier = { name: 'Session admission', description: 'One 30-minute session with two 15-minute films', capacity: '', is_active: true };
const screeningStatusLabels = { draft: 'Draft', on_sale: 'Scheduled', sold_out: 'Full', in_progress: 'In progress', cancelled: 'Cancelled', completed: 'Completed' };
const sessionRules = {
  individual: { duration: 30, films: 2, capacity: null, name: 'Session admission', description: 'One 30-minute session with two staff-selected films' },
  group: { duration: 45, films: 3, capacity: 15, name: 'Group session package', description: 'Exactly 15 guests, 45 minutes and three staff-selected films' },
};

function SessionSeriesCreator() {
  const [catalogue, setCatalogue] = useState({ venues: [], pricingRules: [] });
  const [form, setForm] = useState({ session_kind: 'individual', venue_id: '', pricing_rule_id: '', start_date: '', end_date: '', times: '10:00, 10:30, 11:00', capacity: '6', sales_start: '', open_sales: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from('venues').select('id,name,is_active').eq('is_active', true).order('name'),
      supabase.from('pricing_rules').select('id,name,venue_id,weekday_price_kobo,weekend_price_kobo,group_weekday_price_kobo,group_weekend_price_kobo,is_active').eq('is_active', true).order('name'),
    ]).then(([venues, pricingRules]) => {
      if (active) setCatalogue({ venues: assertResult(venues) || [], pricingRules: assertResult(pricingRules) || [] });
    }).catch((caught) => { if (active) setError(caught.message); });
    return () => { active = false; };
  }, []);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const updateSessionKind = (sessionKind) => setForm((current) => ({
    ...current,
    session_kind: sessionKind,
    capacity: sessionKind === 'group' ? '15' : current.capacity,
    times: sessionKind === 'group' && current.times === '10:00, 10:30, 11:00'
      ? '10:00, 10:45, 11:30'
      : sessionKind === 'individual' && current.times === '10:00, 10:45, 11:30'
        ? '10:00, 10:30, 11:00' : current.times,
    pricing_rule_id: '',
  }));
  const updateVenue = (venueId) => setForm((current) => {
    const selectedRule = catalogue.pricingRules.find((rule) => rule.id === current.pricing_rule_id);
    return { ...current, venue_id: venueId,
      pricing_rule_id: selectedRule?.venue_id && selectedRule.venue_id !== venueId ? '' : current.pricing_rule_id };
  });

  async function createSeries(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const times = form.times.split(',').map((value) => value.trim()).filter(Boolean);
      if (!times.length || times.some((value) => !/^([01]\d|2[0-3]):[0-5]\d$/u.test(value))) {
        throw new Error('Enter session times as comma-separated 24-hour values, for example 10:00, 12:30.');
      }
      const result = assertResult(await supabase.rpc('create_hyperview_session_series_v4', {
        p_venue_id: form.venue_id,
        p_pricing_rule_id: form.pricing_rule_id || null,
        p_session_kind: form.session_kind,
        p_start_date: form.start_date, p_end_date: form.end_date, p_times: times,
        p_capacity: form.session_kind === 'group' ? 15 : Number(form.capacity),
        p_sales_start: fromLagosInput(form.sales_start), p_open_sales: form.open_sales,
      }));
      setNotice(`${result.created} session${result.created === 1 ? '' : 's'} created${result.skipped ? `; ${result.skipped} past or conflicting time${result.skipped === 1 ? '' : 's'} skipped` : ''}. Refresh the page to see them above.`);
    } catch (caught) { setError(caught.message); }
    finally { setBusy(false); }
  }

  return <form className="admin-panel admin-series-form" onSubmit={createSeries}><div className="admin-panel-heading"><div><p className="admin-overline">Fast scheduling</p><h2>Create a session series</h2></div><CalendarPlus2 size={24} /></div>
    <p>Create individual or exclusive group sessions across a date range. Films are selected by staff at the centre.</p>
    <div className="admin-fields"><label>Session type<select value={form.session_kind} onChange={(e) => updateSessionKind(e.target.value)}>
      <option value="individual">Individual booking · 30 minutes · 2 films</option><option value="group">15-person group · 45 minutes · 3 films</option></select></label>
      <label>Venue<select required value={form.venue_id} onChange={(e) => updateVenue(e.target.value)}><option value="">Choose venue</option>{catalogue.venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</select></label>
      <label className="admin-field-wide">Pricing rule<select value={form.pricing_rule_id} onChange={(e) => update('pricing_rule_id', e.target.value)}><option value="">Automatic rule for each date</option>
        {catalogue.pricingRules.filter((rule) => !rule.venue_id || !form.venue_id || rule.venue_id === form.venue_id)
          .map((rule) => { const groupReady = rule.group_weekday_price_kobo != null && rule.group_weekend_price_kobo != null; return <option key={rule.id} value={rule.id} disabled={form.session_kind === 'group' && !groupReady}>{rule.name} · {form.session_kind === 'group'
            ? groupReady ? `${formatKobo(rule.group_weekday_price_kobo)} Mon–Thu / ${formatKobo(rule.group_weekend_price_kobo)} Fri–Sun total` : 'add group prices first'
            : `${formatKobo(rule.weekday_price_kobo)} Mon–Thu / ${formatKobo(rule.weekend_price_kobo)} Fri–Sun per guest`}</option>; })}</select></label>
      <label>First date<input required type="date" value={form.start_date} onChange={(e) => update('start_date', e.target.value)} /></label>
      <label>Last date<input required type="date" value={form.end_date} onChange={(e) => update('end_date', e.target.value)} /></label>
      <label className="admin-field-wide">Daily start times<input required value={form.times} onChange={(e) => update('times', e.target.value)} placeholder="10:00, 12:00, 14:00" /></label>
      <label>Capacity per session<input required type="number" min="1" max="500" readOnly={form.session_kind === 'group'} value={form.session_kind === 'group' ? 15 : form.capacity} onChange={(e) => update('capacity', e.target.value)} /></label>
      <label>Sales begin<input required type="datetime-local" value={form.sales_start} onChange={(e) => update('sales_start', e.target.value)} /></label>
      <label className="admin-checkbox"><input type="checkbox" checked={form.open_sales} onChange={(e) => update('open_sales', e.target.checked)} /> Open every generated session for sale immediately</label></div>
    <p className="admin-help">Individual sessions last 30 minutes. Group sessions reserve all 15 places and last 45 minutes. Conflicting times are skipped automatically.</p>
    {error && <p className="admin-error" role="alert">{error}</p>}{notice && <p className="admin-success" role="status">{notice}</p>}
    <button className="admin-button admin-button--primary" disabled={busy}><CalendarPlus2 size={17} /> {busy ? 'Creating…' : 'Create session series'}</button>
  </form>;
}

export function AdminScreenings() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from('screenings').select('id,session_name,session_kind,starts_at,ends_at,status,venues(name),ticket_types(id)').is('movie_id', null).order('starts_at', { ascending: false }),
      supabase.rpc('catalogue_session_inventory'),
    ]).then(([screeningResult, inventoryResult]) => {
      if (!active) return;
      if (screeningResult.error) throw screeningResult.error;
      if (inventoryResult.error) throw inventoryResult.error;
      const inventory = new Map((inventoryResult.data || []).map((item) => [item.screening_id, item]));
      setRows((screeningResult.data || []).map((item) => ({ ...item, inventory: inventory.get(item.id) })));
    }).catch((caught) => { if (active) setError(caught.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return <main className="admin-content"><div className="admin-page-header admin-page-header--row"><div><p className="admin-overline">Operations / Schedule</p><h1>Sessions</h1><p>Create 30-minute individual sessions or exclusive 45-minute group sessions.</p></div>
    <Link className="admin-button admin-button--primary" to="/admin/screenings/new"><Plus size={17} /> Add session</Link></div>
    {error && <p className="admin-error" role="alert">{error}</p>}
    <div className="admin-panel"><h2>All sessions <span className="admin-count">{rows.length}</span></h2>
      {loading ? <p>Loading sessions…</p> : rows.length === 0 ? <div className="admin-empty"><CalendarDays size={32} /><h3>No sessions yet</h3><p>Choose a venue and add the first available time slot.</p></div> :
        <div className="admin-list">{rows.map((row) => <Link key={row.id} to={`/admin/screenings/${row.id}`} className="admin-list-item">
          <span className="admin-list-icon"><CalendarDays size={19} /></span><span><strong>{formatShowing(row.starts_at, 'Africa/Lagos', { dateStyle: 'medium', timeStyle: 'short' })}</strong><small>{row.session_kind === 'group' ? 'Group · 45 minutes · 3 films' : 'Individual · 30 minutes · 2 films'} · {row.venues?.name || 'Venue'} · {row.inventory ? `${row.inventory.reserved}/${row.inventory.capacity} reserved · ${row.inventory.remaining} remaining` : 'Capacity not set'}</small></span>
          <span className={`admin-status admin-status--${row.status}`}>{screeningStatusLabels[row.status] || row.status}</span><Pencil size={15} /></Link>)}</div>}
    </div>
    <SessionSeriesCreator />
  </main>;
}

export function AdminScreeningForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const { session, profile } = useAdminAuth();
  const screeningDraftKey = draftKey(session.user.id, 'screening', id);
  const tierDraftKey = draftKey(session.user.id, 'ticket-tier', id);
  const [screening, setScreening] = useState(() => isNew ? readDraft(screeningDraftKey) ?? emptyScreening : emptyScreening);
  const [venues, setVenues] = useState([]);
  const [pricingRules, setPricingRules] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [tier, setTier] = useState(() => readDraft(tierDraftKey) ?? emptyTier);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const update = (key, value) => {
    const next = { ...screening, [key]: value };
    setScreening(next);
    saveDraft(screeningDraftKey, next);
  };
  const updateStart = (value) => {
    let endsAt = '';
    if (value) {
      const start = new Date(`${value}:00+01:00`);
      const minutes = sessionRules[screening.session_kind]?.duration || 30;
      if (!Number.isNaN(start.getTime())) endsAt = toLagosInput(new Date(start.getTime() + minutes * 60_000).toISOString());
    }
    const next = { ...screening, starts_at: value, ends_at: endsAt };
    setScreening(next);
    saveDraft(screeningDraftKey, next);
  };
  const updateSessionKind = (sessionKind) => {
    const rule = sessionRules[sessionKind] || sessionRules.individual;
    const selectedPricingRule = pricingRules.find((item) => item.id === screening.pricing_rule_id);
    const groupPriceMissing = sessionKind === 'group' && selectedPricingRule
      && (selectedPricingRule.group_weekday_price_kobo == null || selectedPricingRule.group_weekend_price_kobo == null);
    let endsAt = screening.ends_at;
    if (screening.starts_at) {
      const start = new Date(`${screening.starts_at}:00+01:00`);
      if (!Number.isNaN(start.getTime())) endsAt = toLagosInput(new Date(start.getTime() + rule.duration * 60_000).toISOString());
    }
    const next = {
      ...screening, session_kind: sessionKind, ends_at: endsAt,
      pricing_rule_id: groupPriceMissing ? '' : screening.pricing_rule_id,
      session_name: sessionKind === 'group' ? 'HyperView 9D Group Session' : 'HyperView 9D Flying Cinema Session',
    };
    setScreening(next);
    setTier((current) => ({
      ...current, name: rule.name, description: rule.description,
      capacity: rule.capacity ?? current.capacity,
    }));
    saveDraft(screeningDraftKey, next);
  };
  const updateVenue = (venueId) => {
    const selectedRule = pricingRules.find((rule) => rule.id === screening.pricing_rule_id);
    const next = { ...screening, venue_id: venueId,
      pricing_rule_id: selectedRule?.venue_id && selectedRule.venue_id !== venueId ? '' : screening.pricing_rule_id };
    setScreening(next);
    saveDraft(screeningDraftKey, next);
  };
  const updateTier = (key, value) => {
    const next = { ...tier, [key]: value };
    setTier(next);
    saveDraft(tierDraftKey, next);
  };

  async function loadTiers() {
    if (!isNew) setTiers(assertResult(await supabase.from('ticket_types').select('*').eq('screening_id', id).order('price_kobo')) || []);
  }
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [venueRows, pricingRows] = await Promise.all([
          supabase.from('venues').select('id,name,is_active').order('name'),
          supabase.from('pricing_rules').select('id,name,venue_id,weekday_price_kobo,weekend_price_kobo,group_weekday_price_kobo,group_weekend_price_kobo,is_active').order('name'),
        ]);
        const v = assertResult(venueRows); const p = assertResult(pricingRows);
        if (active) { setVenues(v || []); setPricingRules(p || []); }
        if (!isNew) {
          const [screeningResult, tierResult] = await Promise.all([
            supabase.from('screenings').select('*').eq('id', id).is('movie_id', null).single(),
            supabase.from('ticket_types').select('*').eq('screening_id', id).order('price_kobo'),
          ]);
          const row = assertResult(screeningResult);
          if (active) {
            const savedScreening = { ...row, pricing_rule_id: row.pricing_rule_id || '', starts_at: toLagosInput(row.starts_at), ends_at: toLagosInput(row.ends_at),
              sales_start: toLagosInput(row.sales_start), sales_end: toLagosInput(row.sales_end) };
            setScreening(readDraft(screeningDraftKey) ?? savedScreening);
            setTier(readDraft(tierDraftKey) ?? emptyTier);
            setTiers(assertResult(tierResult) || []);
          }
        }
      } catch (caught) { if (active) setError(caught.message); }
      finally { if (active) setLoading(false); }
    }
    load();
    return () => { active = false; };
  }, [id, isNew, screeningDraftKey, tierDraftKey]);

  async function saveScreening(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const rule = sessionRules[screening.session_kind] || sessionRules.individual;
      const values = { movie_id: null,
        session_name: screening.session_kind === 'group' ? 'HyperView 9D Group Session' : 'HyperView 9D Flying Cinema Session',
        session_kind: screening.session_kind, venue_id: screening.venue_id,
        pricing_rule_id: screening.pricing_rule_id || null,
        starts_at: fromLagosInput(screening.starts_at), ends_at: fromLagosInput(screening.ends_at),
        sales_start: fromLagosInput(screening.sales_start), sales_end: fromLagosInput(screening.sales_end), status: screening.status,
        admission_opens_minutes: Number(screening.admission_opens_minutes),
        admission_grace_minutes: Number(screening.admission_grace_minutes),
        updated_at: new Date().toISOString() };
      if (!values.venue_id) throw new Error('Select a venue.');
      if (values.pricing_rule_id) {
        const selectedRule = pricingRules.find((rule) => rule.id === values.pricing_rule_id);
        if (!selectedRule?.is_active) throw new Error('Choose an active pricing rule.');
        if (selectedRule.venue_id && selectedRule.venue_id !== values.venue_id) {
          throw new Error('The selected pricing rule belongs to a different venue.');
        }
        if (screening.session_kind === 'group'
          && (selectedRule.group_weekday_price_kobo == null || selectedRule.group_weekend_price_kobo == null)) {
          throw new Error('Add both 15-person group totals to this pricing rule before using it for a group session.');
        }
      }
      if (values.ends_at <= values.starts_at) throw new Error('The session must end after it starts.');
      if (new Date(values.ends_at).getTime() - new Date(values.starts_at).getTime() !== rule.duration * 60_000) {
        throw new Error(`${screening.session_kind === 'group' ? 'Group' : 'Individual'} sessions must last exactly ${rule.duration} minutes.`);
      }
      if (values.sales_end <= values.sales_start) throw new Error('Sales must end after they start.');
      if (values.sales_end > values.starts_at) throw new Error('Sales must end by the session start time.');
      if (!Number.isInteger(values.admission_opens_minutes) || values.admission_opens_minutes < 0
        || !Number.isInteger(values.admission_grace_minutes) || values.admission_grace_minutes < 0) {
        throw new Error('Enter valid admission timing values.');
      }
      if (values.status === 'completed' && values.ends_at > new Date().toISOString()) {
        throw new Error('A session can be completed only after it has ended.');
      }
      if (values.status === 'on_sale') {
        const venue = venues.find((item) => item.id === values.venue_id);
        if (!venue?.is_active) throw new Error('Activate the venue before opening sales.');
        if (isNew || tiers.filter((item) => item.is_active).length === 0) throw new Error('Save a draft session and add an active General Admission capacity before opening sales.');
        if (values.starts_at <= new Date().toISOString()) throw new Error('A public session must start in the future.');
      }
      if (screening.status === 'cancelled' && !isNew && !window.confirm('Cancel this session? Its issued tickets will be invalidated. Refunds must be handled separately.')) return;
      if (isNew) {
        const saved = assertResult(await supabase.from('screenings').insert(values).select('id').single());
        clearDraft(screeningDraftKey);
        navigate(`/admin/screenings/${saved.id}`, { replace: true });
      } else {
        assertResult(await supabase.from('screenings').update(values).eq('id', id));
        clearDraft(screeningDraftKey);
        setNotice('Session saved.');
      }
    } catch (caught) { setError(caught.message); }
    finally { setBusy(false); }
  }
  async function saveTier(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const rule = sessionRules[screening.session_kind] || sessionRules.individual;
      const values = { name: rule.name, description: rule.description,
        price_kobo: 0, capacity: rule.capacity ?? Number(tier.capacity),
        is_active: Boolean(tier.is_active), screening_id: id };
      if (!values.name || !Number.isInteger(values.capacity) || values.capacity < 0) throw new Error('Enter a tier name and valid capacity.');
      if (tier.id) assertResult(await supabase.from('ticket_types').update(values).eq('id', tier.id));
      else assertResult(await supabase.from('ticket_types').insert(values));
      clearDraft(tierDraftKey);
      setTier(emptyTier); await loadTiers(); setNotice('Ticket tier saved.');
    } catch (caught) { setError(caught.message); }
    finally { setBusy(false); }
  }
  async function deleteScreening() {
    if (isNew || !window.confirm('Permanently delete this session? This succeeds only when no checkout or booking history depends on it.')) return;
    setBusy(true); setDeleteError(''); setError(''); setNotice('');
    try {
      await adminFunction('admin-catalogue', { action: 'delete_screening', screening_id: id });
      clearDraft(screeningDraftKey); clearDraft(tierDraftKey);
      navigate('/admin/screenings', { replace: true });
    } catch (caught) { setDeleteError(caught.message); }
    finally { setBusy(false); }
  }

  return <main className="admin-content"><div className="admin-page-header"><Link className="admin-back" to="/admin/screenings"><ArrowLeft size={16} /> Sessions</Link>
    <p className="admin-overline">Programme / {isNew ? 'New session' : 'Edit session'}</p><h1>{isNew ? 'Add a session' : 'Session setup'}</h1>
    <p>All times are in Lagos time (WAT, UTC+1). Individual sessions last 30 minutes; exclusive 15-person group sessions last 45 minutes.</p></div>
    {loading ? <p>Loading session…</p> : <div className="admin-two-column"><form className="admin-panel" onSubmit={saveScreening}><h2>Session details</h2>
      <div className="admin-fields"><label>Session type<select value={screening.session_kind || 'individual'} onChange={(e) => updateSessionKind(e.target.value)}>
        <option value="individual">Individual booking · 30 minutes · 2 films</option><option value="group">15-person group · 45 minutes · 3 films</option></select></label>
        <label>Venue<select required value={screening.venue_id} onChange={(e) => updateVenue(e.target.value)}><option value="">Choose venue</option>
          {venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}{venue.is_active ? '' : ' · inactive'}</option>)}</select></label>
        <label className="admin-field-wide">Pricing rule<select value={screening.pricing_rule_id || ''} onChange={(e) => update('pricing_rule_id', e.target.value)}>
          <option value="">Automatic rule for the venue and date</option>
          {pricingRules.filter((rule) => (rule.is_active || rule.id === screening.pricing_rule_id)
            && (!rule.venue_id || !screening.venue_id || rule.venue_id === screening.venue_id))
            .map((rule) => { const groupReady = rule.group_weekday_price_kobo != null && rule.group_weekend_price_kobo != null; return <option key={rule.id} value={rule.id} disabled={screening.session_kind === 'group' && !groupReady}>
              {rule.name} · {screening.session_kind === 'group'
                ? groupReady ? `${formatKobo(rule.group_weekday_price_kobo)} Mon–Thu / ${formatKobo(rule.group_weekend_price_kobo)} Fri–Sun total` : 'add group prices first'
                : `${formatKobo(rule.weekday_price_kobo)} Mon–Thu / ${formatKobo(rule.weekend_price_kobo)} Fri–Sun per guest`}{rule.is_active ? '' : ' · inactive'}
            </option>; })}
        </select></label>
        <label>Starts at<input required type="datetime-local" value={screening.starts_at} onChange={(e) => updateStart(e.target.value)} /></label>
        <label>Ends at (automatic)<input required readOnly type="datetime-local" value={screening.ends_at} /></label>
        <label>Sales start<input required type="datetime-local" value={screening.sales_start} onChange={(e) => update('sales_start', e.target.value)} /></label>
        <label>Sales end<input required type="datetime-local" value={screening.sales_end} onChange={(e) => update('sales_end', e.target.value)} /></label>
        <label>Admission opens (minutes before)<input required type="number" min="0" max="180" value={screening.admission_opens_minutes} onChange={(e) => update('admission_opens_minutes', e.target.value)} /></label>
        <label>Expiry grace (minutes after end)<input required type="number" min="0" max="240" value={screening.admission_grace_minutes} onChange={(e) => update('admission_grace_minutes', e.target.value)} /></label>
        <label>Status<select value={screening.status} onChange={(e) => update('status', e.target.value)}>
          {['draft', 'on_sale', 'sold_out', 'in_progress', 'cancelled', 'completed'].map((status) => <option key={status} value={status} disabled={['sold_out', 'in_progress', 'completed'].includes(status)}>{screeningStatusLabels[status]}{['sold_out', 'in_progress', 'completed'].includes(status) ? ' (automatic)' : ''}</option>)}</select></label>
      </div><p className="admin-help">Full, in progress and completed states are automatic. Cancelling invalidates tickets but does not issue a Paystack refund automatically.</p>
      {error && <p className="admin-error" role="alert">{error}</p>}{notice && <p className="admin-success" role="status">{notice}</p>}
      <button className="admin-button admin-button--primary" disabled={busy}>{busy ? 'Saving…' : 'Save session'}</button></form>
      <div className="admin-form-side"><section className="admin-panel"><h2>{screening.session_kind === 'group' ? 'Group package' : 'General admission'}</h2>
        {isNew ? <p>Save the draft session first, then set its seating capacity.</p> : <>
          <div className="admin-tier-list">{tiers.length === 0 ? <p>No admission capacity yet. Add it before opening sales.</p> : tiers.map((item) => <button type="button" className="admin-tier-item" key={item.id}
            onClick={() => { const next = { ...item }; setTier(next); saveDraft(tierDraftKey, next); }}>
            <span><strong>{item.name}</strong><small>{item.capacity} places · {item.is_active ? 'Active' : 'Inactive'}</small></span><b>{formatKobo(item.price_kobo)}</b><Pencil size={14} /></button>)}</div>
          <form className="admin-fields admin-fields--single" onSubmit={saveTier}><h3>{tier.id ? 'Edit admission' : 'Add admission'}</h3>
            <label>Name<input required value={sessionRules[screening.session_kind]?.name || tier.name} readOnly /></label>
            <label>Description<input value={sessionRules[screening.session_kind]?.description || tier.description || ''} readOnly /></label>
            <label>Capacity<input required type="number" min="0" readOnly={screening.session_kind === 'group'} value={screening.session_kind === 'group' ? 15 : tier.capacity} onChange={(e) => updateTier('capacity', e.target.value)} /></label>
            <label className="admin-checkbox"><input type="checkbox" checked={tier.is_active} onChange={(e) => updateTier('is_active', e.target.checked)} /> Admission is active</label>
            <div className="admin-inline-actions"><button className="admin-button" disabled={busy || (!tier.id && tiers.length > 0)}><Ticket size={16} /> {tier.id ? 'Update admission' : 'Add admission'}</button>
              {tier.id && <button type="button" className="admin-link-button" onClick={() => { setTier(emptyTier); clearDraft(tierDraftKey); }}>Cancel edit</button>}</div>
          </form></>}
      </section><div className="admin-note"><strong>Session pricing</strong><p>{screening.session_kind === 'group' ? 'The selected rule charges one group total for exactly 15 guests. This session becomes full after one paid or actively held group booking.' : 'Individual pricing is per guest, and capacity is the number of people who can book.'} Monday–Thursday and Friday–Sunday prices are selected from the session's Lagos date.</p></div>
        {!isNew && profile?.role === 'admin' && <section className="admin-panel admin-danger-zone"><h2>Delete session</h2>
          <p>Use this only for an unused session created by mistake. Sessions with checkout, payment or admission history must be cancelled and retained.</p>
          <button className="admin-button admin-button--danger" type="button" disabled={busy} onClick={deleteScreening}><Trash2 size={16} /> {busy ? 'Checking…' : 'Delete unused session'}</button>
          {deleteError && <p className="admin-error" role="alert">{deleteError}</p>}
        </section>}
      </div>
    </div>}
  </main>;
}
