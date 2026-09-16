import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, Pencil, Plus, Ticket } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatKobo, formatShowing } from '../lib/catalog';
import { supabase } from '../lib/supabase';
import { assertResult, fromLagosInput, nairaToKobo, toLagosInput } from './catalogue';

const emptyScreening = { movie_id: '', venue_id: '', starts_at: '', ends_at: '', sales_start: '', sales_end: '', status: 'draft' };
const emptyTier = { name: '', description: '', price_naira: '', capacity: '', is_active: true };

export function AdminScreenings() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    supabase.from('screenings').select('id,starts_at,ends_at,status,movies(title),venues(name),ticket_types(id)')
      .order('starts_at', { ascending: false }).then(({ data, error: requestError }) => {
        if (active) { setRows(data || []); setError(requestError?.message || ''); setLoading(false); }
      });
    return () => { active = false; };
  }, []);
  return <main className="admin-content"><div className="admin-page-header admin-page-header--row"><div><p className="admin-overline">Catalogue / Programme</p><h1>Screenings</h1><p>Turn approved films into bookable experiences.</p></div>
    <Link className="admin-button admin-button--primary" to="/admin/screenings/new"><Plus size={17} /> Add screening</Link></div>
    {error && <p className="admin-error" role="alert">{error}</p>}
    <div className="admin-panel"><h2>All showtimes <span className="admin-count">{rows.length}</span></h2>
      {loading ? <p>Loading screenings…</p> : rows.length === 0 ? <div className="admin-empty"><CalendarDays size={32} /><h3>No screenings yet</h3><p>Choose a real venue and approved showtime to get started.</p></div> :
        <div className="admin-list">{rows.map((row) => <Link key={row.id} to={`/admin/screenings/${row.id}`} className="admin-list-item">
          <span className="admin-list-icon"><CalendarDays size={19} /></span><span><strong>{row.movies?.title || 'Movie'}</strong><small>{formatShowing(row.starts_at, 'Africa/Lagos', { dateStyle: 'medium', timeStyle: 'short' })} · {row.venues?.name || 'Venue'} · {row.ticket_types?.length || 0} tiers</small></span>
          <span className={`admin-status admin-status--${row.status}`}>{row.status.replaceAll('_', ' ')}</span><Pencil size={15} /></Link>)}</div>}
    </div>
  </main>;
}

export function AdminScreeningForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const [screening, setScreening] = useState(emptyScreening);
  const [movies, setMovies] = useState([]);
  const [venues, setVenues] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [tier, setTier] = useState(emptyTier);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const update = (key, value) => setScreening((current) => ({ ...current, [key]: value }));
  const updateTier = (key, value) => setTier((current) => ({ ...current, [key]: value }));

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
            setScreening({ ...row, starts_at: toLagosInput(row.starts_at), ends_at: toLagosInput(row.ends_at),
              sales_start: toLagosInput(row.sales_start), sales_end: toLagosInput(row.sales_end) });
            setTiers(assertResult(tierResult) || []);
          }
        }
      } catch (caught) { if (active) setError(caught.message); }
      finally { if (active) setLoading(false); }
    }
    load();
    return () => { active = false; };
  }, [id, isNew]);

  async function saveScreening(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const values = { movie_id: screening.movie_id, venue_id: screening.venue_id,
        starts_at: fromLagosInput(screening.starts_at), ends_at: fromLagosInput(screening.ends_at),
        sales_start: fromLagosInput(screening.sales_start), sales_end: fromLagosInput(screening.sales_end), status: screening.status,
        updated_at: new Date().toISOString() };
      if (!values.movie_id || !values.venue_id) throw new Error('Select a movie and venue.');
      if (values.ends_at <= values.starts_at) throw new Error('The screening must end after it starts.');
      if (values.sales_end <= values.sales_start) throw new Error('Sales must end after they start.');
      if (values.sales_end > values.starts_at) throw new Error('Sales must end by the screening start time.');
      if (values.status === 'on_sale') {
        const movie = movies.find((item) => item.id === values.movie_id);
        const venue = venues.find((item) => item.id === values.venue_id);
        if (movie?.status !== 'published' || !venue?.is_active) throw new Error('Publish the movie and activate the venue before opening sales.');
        if (isNew || tiers.filter((item) => item.is_active).length === 0) throw new Error('Save a draft screening and add an active ticket tier before opening sales.');
        if (values.starts_at <= new Date().toISOString()) throw new Error('A public screening must start in the future.');
      }
      if (screening.status === 'cancelled' && !isNew && !window.confirm('Cancel this screening? Its issued tickets will be invalidated. Refunds must be handled separately.')) return;
      if (isNew) {
        const saved = assertResult(await supabase.from('screenings').insert(values).select('id').single());
        navigate(`/admin/screenings/${saved.id}`, { replace: true });
      } else {
        assertResult(await supabase.from('screenings').update(values).eq('id', id));
        setNotice('Screening saved.');
      }
    } catch (caught) { setError(caught.message); }
    finally { setBusy(false); }
  }
  async function saveTier(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const values = { name: tier.name.trim(), description: tier.description.trim() || null,
        price_kobo: nairaToKobo(tier.price_naira), capacity: Number(tier.capacity),
        is_active: Boolean(tier.is_active), screening_id: id };
      if (!values.name || !Number.isInteger(values.capacity) || values.capacity < 0) throw new Error('Enter a tier name and valid capacity.');
      if (tier.id) assertResult(await supabase.from('ticket_types').update(values).eq('id', tier.id));
      else assertResult(await supabase.from('ticket_types').insert(values));
      setTier(emptyTier); await loadTiers(); setNotice('Ticket tier saved.');
    } catch (caught) { setError(caught.message); }
    finally { setBusy(false); }
  }

  return <main className="admin-content"><div className="admin-page-header"><Link className="admin-back" to="/admin/screenings"><ArrowLeft size={16} /> Screenings</Link>
    <p className="admin-overline">Programme / {isNew ? 'New showing' : 'Edit showing'}</p><h1>{isNew ? 'Add a screening' : 'Screening setup'}</h1>
    <p>All times below are in Lagos time (WAT, UTC+1). Save a draft, add ticket tiers, then open sales.</p></div>
    {loading ? <p>Loading screening…</p> : <div className="admin-two-column"><form className="admin-panel" onSubmit={saveScreening}><h2>Showing details</h2>
      <div className="admin-fields"><label>Movie<select required value={screening.movie_id} onChange={(e) => update('movie_id', e.target.value)}><option value="">Choose movie</option>
        {movies.map((movie) => <option key={movie.id} value={movie.id}>{movie.title} · {movie.status}</option>)}</select></label>
        <label>Venue<select required value={screening.venue_id} onChange={(e) => update('venue_id', e.target.value)}><option value="">Choose venue</option>
          {venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}{venue.is_active ? '' : ' · inactive'}</option>)}</select></label>
        <label>Starts at<input required type="datetime-local" value={screening.starts_at} onChange={(e) => update('starts_at', e.target.value)} /></label>
        <label>Ends at<input required type="datetime-local" value={screening.ends_at} onChange={(e) => update('ends_at', e.target.value)} /></label>
        <label>Sales start<input required type="datetime-local" value={screening.sales_start} onChange={(e) => update('sales_start', e.target.value)} /></label>
        <label>Sales end<input required type="datetime-local" value={screening.sales_end} onChange={(e) => update('sales_end', e.target.value)} /></label>
        <label>Status<select value={screening.status} onChange={(e) => update('status', e.target.value)}>
          {['draft', 'on_sale', 'sold_out', 'cancelled', 'completed'].map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></label>
      </div><p className="admin-help">Cancelling a screening invalidates tickets. It does not issue a Paystack refund automatically.</p>
      {error && <p className="admin-error" role="alert">{error}</p>}{notice && <p className="admin-success" role="status">{notice}</p>}
      <button className="admin-button admin-button--primary" disabled={busy}>{busy ? 'Saving…' : 'Save screening'}</button></form>
      <div className="admin-form-side"><section className="admin-panel"><h2>Ticket tiers</h2>
        {isNew ? <p>Save the draft screening first to add prices and capacities.</p> : <>
          <div className="admin-tier-list">{tiers.length === 0 ? <p>No tiers yet. Add one before opening sales.</p> : tiers.map((item) => <button type="button" className="admin-tier-item" key={item.id}
            onClick={() => setTier({ ...item, price_naira: String(Number(item.price_kobo) / 100) })}>
            <span><strong>{item.name}</strong><small>{item.capacity} places · {item.is_active ? 'Active' : 'Inactive'}</small></span><b>{formatKobo(item.price_kobo)}</b><Pencil size={14} /></button>)}</div>
          <form className="admin-fields admin-fields--single" onSubmit={saveTier}><h3>{tier.id ? 'Edit tier' : 'Add tier'}</h3>
            <label>Name<input required value={tier.name} placeholder="General admission" onChange={(e) => updateTier('name', e.target.value)} /></label>
            <label>Description<input value={tier.description || ''} onChange={(e) => updateTier('description', e.target.value)} /></label>
            <label>Price (₦)<input required inputMode="decimal" value={tier.price_naira} placeholder="8000" onChange={(e) => updateTier('price_naira', e.target.value)} /></label>
            <label>Capacity<input required type="number" min="0" value={tier.capacity} onChange={(e) => updateTier('capacity', e.target.value)} /></label>
            <label className="admin-checkbox"><input type="checkbox" checked={tier.is_active} onChange={(e) => updateTier('is_active', e.target.checked)} /> Tier is active</label>
            <div className="admin-inline-actions"><button className="admin-button" disabled={busy}><Ticket size={16} /> {tier.id ? 'Update tier' : 'Add tier'}</button>
              {tier.id && <button type="button" className="admin-link-button" onClick={() => setTier(emptyTier)}>Cancel edit</button>}</div>
          </form></>}
      </section><div className="admin-note"><strong>Capacity check</strong><p>Set capacities to the actual number of places available for each tier. Never reduce a tier below tickets already paid or reserved.</p></div></div>
    </div>}
  </main>;
}
