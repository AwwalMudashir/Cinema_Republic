import { useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, Search, TicketCheck, UserCheck } from 'lucide-react';
import { formatKobo, formatShowing } from '../lib/catalog';
import { useAdminAuth } from './auth-context';
import { adminFunction } from './api';

const UUID_IN_TEXT = /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/iu;

export default function AdminReception() {
  const { profile } = useAdminAuth();
  const [bookings, setBookings] = useState([]);
  const [query, setQuery] = useState('');
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const canRegister = ['cashier', 'admin'].includes(profile.role);
  const canAdmit = ['supervisor', 'check_in_staff', 'admin'].includes(profile.role);

  async function search(term = query) {
    setBusy(true); setError('');
    try {
      const entered = String(term).trim();
      const normalized = UUID_IN_TEXT.exec(entered)?.[0] || entered;
      const result = await adminFunction('staff-bookings', { action: 'search', query: normalized });
      setBookings(result.bookings || []);
    } catch (caught) { setError(caught.message); }
    finally { setBusy(false); }
  }

  useEffect(() => { search(''); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function registerArrival(booking) {
    if (!window.confirm(`Register ${booking.quantity} guest(s) for ${booking.reference} as arrived?`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await adminFunction('staff-bookings', {
        action: 'register_arrival', order_id: booking.id, notes: notes[booking.id] || '',
      });
      setNotice(`${booking.reference} is registered at reception. Physical tags can now be issued.`);
      await search();
    } catch (caught) { setError(caught.message); }
    finally { setBusy(false); }
  }

  async function admit(ticket, booking) {
    if (!window.confirm(`Admit one guest from ${booking.reference}? This cannot be undone.`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await adminFunction('redeem-ticket', { ticket_id: ticket.public_id });
      if (!result.redeemed) throw new Error(result.reason === 'not_registered' ? 'Reception has not registered this guest.' : `Admission failed: ${String(result.reason).replaceAll('_', ' ')}`);
      setNotice(`One guest from ${booking.reference} was admitted.`);
      await search();
    } catch (caught) { setError(caught.message); }
    finally { setBusy(false); }
  }

  return <main className="admin-content"><div className="admin-page-header"><p className="admin-overline">Operations / Reception</p>
    <h1>Expected guests</h1><p>Retrieve paid bookings, register arrivals and prepare each party for supervisor admission.</p></div>
    <form className="admin-toolbar" onSubmit={(event) => { event.preventDefault(); search(); }}><label className="admin-search"><Search size={18} />
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Reference, booking ID, name, email or phone" /></label>
      <button className="admin-button" disabled={busy}><Search size={16} /> Search</button>
      <button type="button" className="admin-button admin-button--quiet" onClick={() => search()} disabled={busy}><RefreshCw size={16} /> Refresh</button></form>
    {error && <p className="admin-error" role="alert">{error}</p>}{notice && <p className="admin-success" role="status">{notice}</p>}
    <div className="admin-operations-grid">{bookings.length === 0 ? <div className="admin-panel admin-empty"><UserCheck size={32} /><h2>No bookings found</h2><p>Try a booking reference, email address or phone number.</p></div> : bookings.map((booking) => {
      const zone = booking.venue_timezone || 'Africa/Lagos';
      const fullyArrived = Number(booking.arrived_count) >= Number(booking.quantity);
      return <article className="admin-panel admin-booking-card" key={booking.id}>
        <div className="admin-booking-card__head"><div><p className="admin-overline">{booking.reference}</p><h2>{booking.movie}</h2></div>
          <span className={`admin-status admin-status--${booking.status}`}>{booking.status}</span></div>
        <p className="admin-booking-card__customer"><strong>{booking.customer_name}</strong><span>{booking.customer_email}</span><span>{booking.customer_phone}</span></p>
        <div className="admin-order-facts"><span><small>Session</small><strong>{formatShowing(booking.starts_at, zone, { dateStyle: 'medium', timeStyle: 'short' })}</strong></span>
          <span><small>Guests</small><strong>{booking.quantity}</strong></span><span><small>Arrived</small><strong>{booking.arrived_count}</strong></span>
          <span><small>Admitted</small><strong>{booking.admitted_count}</strong></span><span><small>Paid</small><strong>{formatKobo(booking.amount_kobo)}</strong></span>
          <span><small>Session status</small><strong>{String(booking.screening_status).replaceAll('_', ' ')}</strong></span></div>
        {canRegister && !fullyArrived && booking.status === 'paid' && <div className="admin-arrival-actions"><label>Physical tag notes (optional)
          <input value={notes[booking.id] || ''} maxLength={300} placeholder="e.g. Tags H21–H24" onChange={(event) => setNotes((current) => ({ ...current, [booking.id]: event.target.value }))} /></label>
          <button className="admin-button admin-button--primary" type="button" onClick={() => registerArrival(booking)} disabled={busy}><UserCheck size={17} /> Register arrival</button></div>}
        {fullyArrived && <p className="admin-success"><CheckCircle2 size={16} /> Reception complete. The supervisor can now admit the guests.</p>}
        {booking.tickets?.length > 0 && <div className="admin-ticket-links"><strong>Individual admissions</strong>{booking.tickets.map((ticket, index) => <span key={ticket.public_id}><TicketCheck size={15} /> Guest {index + 1}: {ticket.checked_in_at ? 'admitted' : ticket.arrived_at ? 'waiting' : ticket.status}
          {canAdmit && ticket.arrived_at && !ticket.checked_in_at && ticket.status === 'valid' && <button type="button" className="admin-link-button" disabled={busy} onClick={() => admit(ticket, booking)}>Admit guest</button>}</span>)}</div>}
      </article>;
    })}</div>
  </main>;
}
