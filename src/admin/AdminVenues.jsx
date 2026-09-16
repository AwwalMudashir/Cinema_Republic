import { useEffect, useState } from 'react';
import { MapPin, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAdminAuth } from './auth-context';
import { assertResult } from './catalogue';
import { clearDraft, draftKey, readDraft, saveDraft } from './drafts';

const emptyVenue = { name: '', address: '', city: 'Lagos', country: 'Nigeria', timezone: 'Africa/Lagos', is_active: true };

export default function AdminVenues() {
  const { session } = useAdminAuth();
  const venueDraftKey = draftKey(session.user.id, 'venue');
  const [venues, setVenues] = useState([]);
  const [venue, setVenue] = useState(() => readDraft(venueDraftKey) ?? emptyVenue);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function refresh() {
    const rows = assertResult(await supabase.from('venues').select('*').order('name'));
    setVenues(rows || []);
  }
  useEffect(() => {
    let active = true;
    supabase.from('venues').select('*').order('name').then(({ data, error: requestError }) => {
      if (active) { setVenues(data || []); setError(requestError?.message || ''); setLoading(false); }
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(''), 4000);
    return () => window.clearTimeout(timeout);
  }, [notice]);
  const update = (key, value) => {
    setNotice('');
    const next = { ...venue, [key]: value };
    setVenue(next);
    saveDraft(venueDraftKey, next);
  };

  async function save(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const values = { name: venue.name.trim(), address: venue.address.trim(), city: venue.city.trim(),
        country: venue.country.trim(), timezone: 'Africa/Lagos', is_active: venue.is_active };
      if (!values.name || !values.address || !values.city || !values.country) throw new Error('Complete all venue fields.');
      if (venue.id) assertResult(await supabase.from('venues').update(values).eq('id', venue.id));
      else assertResult(await supabase.from('venues').insert(values));
      clearDraft(venueDraftKey);
      setVenue(emptyVenue); await refresh(); setNotice('Venue saved.');
    } catch (caught) { setError(caught.message); }
    finally { setBusy(false); }
  }

  return <main className="admin-content"><div className="admin-page-header"><p className="admin-overline">Catalogue / Locations</p><h1>Venues</h1><p>Guests rely on these details to find the screen.</p></div>
    <div className="admin-two-column"><section className="admin-panel"><h2>Locations <span className="admin-count">{venues.length}</span></h2>
      {loading ? <p>Loading venues…</p> : venues.length === 0 ? <div className="admin-empty"><MapPin size={30} /><p>No venues yet.</p></div> :
        <div className="admin-list">{venues.map((item) => <button type="button" key={item.id} className="admin-list-item" onClick={() => { setVenue(item); saveDraft(venueDraftKey, item); setNotice(''); setError(''); }}>
          <span className="admin-list-icon"><MapPin size={19} /></span><span><strong>{item.name}</strong><small>{item.address}, {item.city}</small></span>
          <span className={`admin-status ${item.is_active ? 'admin-status--published' : 'admin-status--archived'}`}>{item.is_active ? 'Active' : 'Inactive'}</span>
        </button>)}</div>}
    </section><form className="admin-panel" onSubmit={save}><div className="admin-panel-heading"><h2>{venue.id ? 'Edit venue' : 'Add a venue'}</h2>
      {venue.id && <button type="button" className="admin-link-button" onClick={() => { setVenue(emptyVenue); clearDraft(venueDraftKey); setNotice(''); setError(''); }}><Plus size={15} /> New venue</button>}</div>
      <div className="admin-fields admin-fields--single"><label>Venue name<input required value={venue.name} onChange={(e) => update('name', e.target.value)} /></label>
        <label>Street address / arrival landmark<textarea required rows={3} value={venue.address} onChange={(e) => update('address', e.target.value)} /></label>
        <label>City<input required value={venue.city} onChange={(e) => update('city', e.target.value)} /></label>
        <label>Country<input required value={venue.country} onChange={(e) => update('country', e.target.value)} /></label>
        <label>Time zone<input readOnly value="Africa/Lagos" /></label>
        <label className="admin-checkbox"><input type="checkbox" checked={venue.is_active} onChange={(e) => update('is_active', e.target.checked)} /> Venue is active</label></div>
      <p className="admin-help">Deactivating a venue removes its screenings from public listings; it does not automatically refund sold tickets.</p>
      {error && <p className="admin-error" role="alert">{error}</p>}{notice && <p className="admin-success" role="status">{notice}</p>}
      <button className="admin-button admin-button--primary" disabled={busy}>{busy ? 'Saving…' : 'Save venue'}</button>
    </form></div>
  </main>;
}
