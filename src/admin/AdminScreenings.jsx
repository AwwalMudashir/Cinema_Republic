import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, CalendarPlus2, Pencil, Plus, Ticket } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatKobo, formatShowing } from '../lib/catalog';
import { supabase } from '../lib/supabase';
import { useAdminAuth } from './auth-context';
import { assertResult, fromLagosInput, toLagosInput } from './catalogue';
import { clearDraft, draftKey, readDraft, saveDraft } from './drafts';

const emptyScreening = { movie_id: '', venue_id: '', starts_at: '', ends_at: '', sales_start: '', sales_end: '', status: 'draft', admission_opens_minutes: 15, admission_grace_minutes: 30 };
const emptyTier = { name: 'General admission', description: 'HyperView 9D Flying Cinema admission', capacity: '', is_active: true };
const screeningStatusLabels = { draft: 'Draft', on_sale: 'Scheduled', sold_out: 'Full', in_progress: 'In progress', cancelled: 'Cancelled', completed: 'Completed' };

function SessionSeriesCreator() {
  const [catalogue, setCatalogue] = useState({ movies: [], venues: [] });
  const [form, setForm] = useState({ movie_id: '', venue_id: '', start_date: '', end_date: '', times: '10:00, 12:00, 14:00', duration: '20', capacity: '6', sales_start: '', open_sales: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from('movies').select('id,title,status').neq('status', 'archived').order('title'),
      supabase.from('venues').select('id,name,is_active').eq('is_active', true).order('name'),
    ]).then(([movies, venues]) => {
      if (active) setCatalogue({ movies: assertResult(movies) || [], venues: assertResult(venues) || [] });
    }).catch((caught) => { if (active) setError(caught.message); });
    return () => { active = false; };
  }, []);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  async function createSeries(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const times = form.times.split(',').map((value) => value.trim()).filter(Boolean);
      if (!times.length || times.some((value) => !/^([01]\d|2[0-3]):[0-5]\d$/u.test(value))) {
        throw new Error('Enter session times as comma-separated 24-hour values, for example 10:00, 12:30.');
      }
      const result = assertResult(await supabase.rpc('create_hyperview_session_series', {
        p_movie_id: form.movie_id, p_venue_id: form.venue_id,
        p_start_date: form.start_date, p_end_date: form.end_date, p_times: times,
        p_duration_minutes: Number(form.duration), p_capacity: Number(form.capacity),
        p_sales_start: fromLagosInput(form.sales_start), p_open_sales: form.open_sales,
      }));
      setNotice(`${result.created} session${result.created === 1 ? '' : 's'} created${result.skipped ? `; ${result.skipped} duplicate or past time${result.skipped === 1 ? '' : 's'} skipped` : ''}. Refresh the page to see them above.`);
    } catch (caught) { setError(caught.message); }
    finally { setBusy(false); }
  }

  return <form className="admin-panel admin-series-form" onSubmit={createSeries}><div className="admin-panel-heading"><div><p className="admin-overline">Fast scheduling</p><h2>Create a session series</h2></div><CalendarPlus2 size={24} /></div>
    <p>Create the same daily times across a date range. Each session receives one General Admission capacity and the correct weekday/weekend price.</p>
    <div className="admin-fields"><label>Experience<select required value={form.movie_id} onChange={(e) => update('movie_id', e.target.value)}><option value="">Choose experience</option>{catalogue.movies.map((movie) => <option key={movie.id} value={movie.id}>{movie.title} · {movie.status}</option>)}</select></label>
      <label>Venue<select required value={form.venue_id} onChange={(e) => update('venue_id', e.target.value)}><option value="">Choose venue</option>{catalogue.venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</select></label>
      <label>First date<input required type="date" value={form.start_date} onChange={(e) => update('start_date', e.target.value)} /></label>
      <label>Last date<input required type="date" value={form.end_date} onChange={(e) => update('end_date', e.target.value)} /></label>
      <label className="admin-field-wide">Daily start times<input required value={form.times} onChange={(e) => update('times', e.target.value)} placeholder="10:00, 12:00, 14:00" /></label>
      <label>Duration (minutes)<input required type="number" min="5" max="240" value={form.duration} onChange={(e) => update('duration', e.target.value)} /></label>
      <label>Capacity per session<input required type="number" min="1" max="500" value={form.capacity} onChange={(e) => update('capacity', e.target.value)} /></label>
      <label>Sales begin<input required type="datetime-local" value={form.sales_start} onChange={(e) => update('sales_start', e.target.value)} /></label>
      <label className="admin-checkbox"><input type="checkbox" checked={form.open_sales} onChange={(e) => update('open_sales', e.target.checked)} /> Open every generated session for sale immediately</label></div>
    <p className="admin-help">A maximum of 32 dates and 12 times per day can be generated at once. Leave “open for sale” off if you want to review the sessions first.</p>
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
      supabase.from('screenings').select('id,starts_at,ends_at,status,movies(title),venues(name),ticket_types(id)').order('starts_at', { ascending: false }),
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
  return <main className="admin-content"><div className="admin-page-header admin-page-header--row"><div><p className="admin-overline">Catalogue / Programme</p><h1>Sessions</h1><p>Turn approved HyperView experiences into scheduled, capacity-controlled bookings.</p></div>
    <Link className="admin-button admin-button--primary" to="/admin/screenings/new"><Plus size={17} /> Add session</Link></div>
    {error && <p className="admin-error" role="alert">{error}</p>}
    <div className="admin-panel"><h2>All showtimes <span className="admin-count">{rows.length}</span></h2>
      {loading ? <p>Loading screenings…</p> : rows.length === 0 ? <div className="admin-empty"><CalendarDays size={32} /><h3>No screenings yet</h3><p>Choose a real venue and approved showtime to get started.</p></div> :
        <div className="admin-list">{rows.map((row) => <Link key={row.id} to={`/admin/screenings/${row.id}`} className="admin-list-item">
          <span className="admin-list-icon"><CalendarDays size={19} /></span><span><strong>{row.movies?.title || 'Experience'}</strong><small>{formatShowing(row.starts_at, 'Africa/Lagos', { dateStyle: 'medium', timeStyle: 'short' })} · {row.venues?.name || 'Venue'} · {row.inventory ? `${row.inventory.reserved}/${row.inventory.capacity} reserved · ${row.inventory.remaining} remaining` : 'Capacity not set'}</small></span>
          <span className={`admin-status admin-status--${row.status}`}>{screeningStatusLabels[row.status] || row.status}</span><Pencil size={15} /></Link>)}</div>}
    </div>
    <SessionSeriesCreator />
  </main>;
}

export function AdminScreeningForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const { session } = useAdminAuth();
  const screeningDraftKey = draftKey(session.user.id, 'screening', id);
  const tierDraftKey = draftKey(session.user.id, 'ticket-tier', id);
  const [screening, setScreening] = useState(() => isNew ? readDraft(screeningDraftKey) ?? emptyScreening : emptyScreening);
  const [movies, setMovies] = useState([]);
  const [venues, setVenues] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [tier, setTier] = useState(() => readDraft(tierDraftKey) ?? emptyTier);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const update = (key, value) => {
    const next = { ...screening, [key]: value };
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
        const [movieRows, venueRows] = await Promise.all([
          supabase.from('movies').select('id,title,status').neq('status', 'archived').order('title'),
          supabase.from('venues').select('id,name,is_active').order('name'),
        ]);
        const m = assertResult(movieRows); const v = assertResult(venueRows);
        if (active) { setMovies(m || []); setVenues(v || []); }
        if (!isNew) {
          const [screeningResult, tierResult] = await Promise.all([
            supabase.from('screenings').select('*').eq('id', id).single(),
            supabase.from('ticket_types').select('*').eq('screening_id', id).order('price_kobo'),
          ]);
          const row = assertResult(screeningResult);
          if (active) {
            const savedScreening = { ...row, starts_at: toLagosInput(row.starts_at), ends_at: toLagosInput(row.ends_at),
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
      const values = { movie_id: screening.movie_id, venue_id: screening.venue_id,
        starts_at: fromLagosInput(screening.starts_at), ends_at: fromLagosInput(screening.ends_at),
        sales_start: fromLagosInput(screening.sales_start), sales_end: fromLagosInput(screening.sales_end), status: screening.status,
        admission_opens_minutes: Number(screening.admission_opens_minutes),
        admission_grace_minutes: Number(screening.admission_grace_minutes),
        updated_at: new Date().toISOString() };
      if (!values.movie_id || !values.venue_id) throw new Error('Select a movie and venue.');
      if (values.ends_at <= values.starts_at) throw new Error('The screening must end after it starts.');
      if (values.sales_end <= values.sales_start) throw new Error('Sales must end after they start.');
      if (values.sales_end > values.starts_at) throw new Error('Sales must end by the screening start time.');
      if (!Number.isInteger(values.admission_opens_minutes) || values.admission_opens_minutes < 0
        || !Number.isInteger(values.admission_grace_minutes) || values.admission_grace_minutes < 0) {
        throw new Error('Enter valid admission timing values.');
      }
      if (values.status === 'completed' && values.ends_at > new Date().toISOString()) {
        throw new Error('Mark a screening completed only after it has ended.');
      }
      if (values.status === 'on_sale') {
        const movie = movies.find((item) => item.id === values.movie_id);
        const venue = venues.find((item) => item.id === values.venue_id);
        if (movie?.status !== 'published' || !venue?.is_active) throw new Error('Publish the movie and activate the venue before opening sales.');
        if (isNew || tiers.filter((item) => item.is_active).length === 0) throw new Error('Save a draft session and add an active General Admission capacity before opening sales.');
        if (values.starts_at <= new Date().toISOString()) throw new Error('A public screening must start in the future.');
      }
      if (screening.status === 'cancelled' && !isNew && !window.confirm('Cancel this screening? Its issued tickets will be invalidated. Refunds must be handled separately.')) return;
      if (isNew) {
        const saved = assertResult(await supabase.from('screenings').insert(values).select('id').single());
        clearDraft(screeningDraftKey);
        navigate(`/admin/screenings/${saved.id}`, { replace: true });
      } else {
        assertResult(await supabase.from('screenings').update(values).eq('id', id));
        clearDraft(screeningDraftKey);
        setNotice('Screening saved.');
      }
    } catch (caught) { setError(caught.message); }
    finally { setBusy(false); }
  }
  async function saveTier(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const values = { name: tier.name.trim(), description: tier.description.trim() || null,
        price_kobo: 0, capacity: Number(tier.capacity),
        is_active: Boolean(tier.is_active), screening_id: id };
      if (!values.name || !Number.isInteger(values.capacity) || values.capacity < 0) throw new Error('Enter a tier name and valid capacity.');
      if (tier.id) assertResult(await supabase.from('ticket_types').update(values).eq('id', tier.id));
      else assertResult(await supabase.from('ticket_types').insert(values));
      clearDraft(tierDraftKey);
      setTier(emptyTier); await loadTiers(); setNotice('Ticket tier saved.');
    } catch (caught) { setError(caught.message); }
    finally { setBusy(false); }
  }

  return <main className="admin-content"><div className="admin-page-header"><Link className="admin-back" to="/admin/screenings"><ArrowLeft size={16} /> Sessions</Link>
    <p className="admin-overline">Programme / {isNew ? 'New session' : 'Edit session'}</p><h1>{isNew ? 'Add a session' : 'Session setup'}</h1>
    <p>All times are in Lagos time (WAT, UTC+1). Save a draft, set the general-admission capacity, then open sales.</p></div>
    {loading ? <p>Loading screening…</p> : <div className="admin-two-column"><form className="admin-panel" onSubmit={saveScreening}><h2>Showing details</h2>
      <div className="admin-fields"><label>Movie<select required value={screening.movie_id} onChange={(e) => update('movie_id', e.target.value)}><option value="">Choose movie</option>
        {movies.map((movie) => <option key={movie.id} value={movie.id}>{movie.title} · {movie.status}</option>)}</select></label>
        <label>Venue<select required value={screening.venue_id} onChange={(e) => update('venue_id', e.target.value)}><option value="">Choose venue</option>
          {venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}{venue.is_active ? '' : ' · inactive'}</option>)}</select></label>
        <label>Starts at<input required type="datetime-local" value={screening.starts_at} onChange={(e) => update('starts_at', e.target.value)} /></label>
        <label>Ends at<input required type="datetime-local" value={screening.ends_at} onChange={(e) => update('ends_at', e.target.value)} /></label>
        <label>Sales start<input required type="datetime-local" value={screening.sales_start} onChange={(e) => update('sales_start', e.target.value)} /></label>
        <label>Sales end<input required type="datetime-local" value={screening.sales_end} onChange={(e) => update('sales_end', e.target.value)} /></label>
        <label>Admission opens (minutes before)<input required type="number" min="0" max="180" value={screening.admission_opens_minutes} onChange={(e) => update('admission_opens_minutes', e.target.value)} /></label>
        <label>Expiry grace (minutes after end)<input required type="number" min="0" max="240" value={screening.admission_grace_minutes} onChange={(e) => update('admission_grace_minutes', e.target.value)} /></label>
        <label>Status<select value={screening.status} onChange={(e) => update('status', e.target.value)}>
          {['draft', 'on_sale', 'sold_out', 'in_progress', 'cancelled', 'completed'].map((status) => <option key={status} value={status} disabled={['sold_out', 'in_progress', 'completed'].includes(status)}>{screeningStatusLabels[status]}{['sold_out', 'in_progress', 'completed'].includes(status) ? ' (automatic)' : ''}</option>)}</select></label>
      </div><p className="admin-help">Full, in progress and completed states are automatic. Cancelling invalidates tickets but does not issue a Paystack refund automatically.</p>
      {error && <p className="admin-error" role="alert">{error}</p>}{notice && <p className="admin-success" role="status">{notice}</p>}
      <button className="admin-button admin-button--primary" disabled={busy}>{busy ? 'Saving…' : 'Save screening'}</button></form>
      <div className="admin-form-side"><section className="admin-panel"><h2>General admission</h2>
        {isNew ? <p>Save the draft session first, then set its seating capacity.</p> : <>
          <div className="admin-tier-list">{tiers.length === 0 ? <p>No admission capacity yet. Add it before opening sales.</p> : tiers.map((item) => <button type="button" className="admin-tier-item" key={item.id}
            onClick={() => { const next = { ...item }; setTier(next); saveDraft(tierDraftKey, next); }}>
            <span><strong>{item.name}</strong><small>{item.capacity} places · {item.is_active ? 'Active' : 'Inactive'}</small></span><b>{formatKobo(item.price_kobo)}</b><Pencil size={14} /></button>)}</div>
          <form className="admin-fields admin-fields--single" onSubmit={saveTier}><h3>{tier.id ? 'Edit admission' : 'Add admission'}</h3>
            <label>Name<input required value={tier.name} readOnly /></label>
            <label>Description<input value={tier.description || ''} onChange={(e) => updateTier('description', e.target.value)} /></label>
            <label>Capacity<input required type="number" min="0" value={tier.capacity} onChange={(e) => updateTier('capacity', e.target.value)} /></label>
            <label className="admin-checkbox"><input type="checkbox" checked={tier.is_active} onChange={(e) => updateTier('is_active', e.target.checked)} /> Admission is active</label>
            <div className="admin-inline-actions"><button className="admin-button" disabled={busy || (!tier.id && tiers.length > 0)}><Ticket size={16} /> {tier.id ? 'Update admission' : 'Add admission'}</button>
              {tier.id && <button type="button" className="admin-link-button" onClick={() => { setTier(emptyTier); clearDraft(tierDraftKey); }}>Cancel edit</button>}</div>
          </form></>}
      </section><div className="admin-note"><strong>Automatic pricing</strong><p>The price is selected from Pricing using the session's Lagos date: weekday Monday–Friday, weekend Saturday–Sunday. Capacity is the number of people who can book this session.</p></div></div>
    </div>}
  </main>;
}
