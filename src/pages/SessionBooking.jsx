import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, Check, Clock3, Info, LockKeyhole, MapPin, Minus, Plus, ShieldCheck, Ticket } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import useSessionProgramme from '../hooks/useSessionProgramme';
import { formatKobo, formatShowing, invokeFunction } from '../lib/catalog';
import { hyperViewLive } from '../lib/hyperview';
import '../components/ticketing.css';

const checkoutTokenKey = (reference) => `cinema57:order:${reference}`;

function BookingState({ title, message }) {
  return <main className="booking-not-found"><Ticket size={42} /><h1>{title}</h1><p>{message}</p>
    <Link className="ticket-button ticket-button--primary" to="/sessions">View sessions</Link></main>;
}

export default function SessionBooking() {
  const { sessionId } = useParams();
  const { sessions, loading, error } = useSessionProgramme();
  const [selectedId, setSelectedId] = useState(sessionId || '');
  const [quantity, setQuantity] = useState(1);
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '' });
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (sessionId) setSelectedId(sessionId); }, [sessionId]);
  const bookable = useMemo(() => sessions.filter((session) => session.isBookable), [sessions]);
  const screening = bookable.find((session) => session.id === selectedId)
    || (!sessionId ? bookable[0] : null);
  const ticket = screening?.ticketTypes[0];
  const dates = useMemo(() => {
    const seen = new Set();
    return bookable.filter((item) => {
      const key = formatShowing(item.starts_at, item.venue.timezone, { year: 'numeric', month: '2-digit', day: '2-digit' });
      if (seen.has(key)) return false; seen.add(key); return true;
    });
  }, [bookable]);
  const selectedDay = screening && formatShowing(screening.starts_at, screening.venue.timezone, { year: 'numeric', month: '2-digit', day: '2-digit' });
  const times = bookable.filter((item) => formatShowing(item.starts_at, item.venue.timezone, { year: 'numeric', month: '2-digit', day: '2-digit' }) === selectedDay);
  const totalKobo = Number(ticket?.price_kobo || 0) * quantity;
  const maxQuantity = Math.max(1, Math.min(15, ticket?.remaining ?? 15));

  const chooseSession = (id) => { setSelectedId(id); setQuantity(1); setPolicyAccepted(false); setMessage(''); };

  async function checkout(event) {
    event.preventDefault();
    if (!screening?.isBookable || !ticket) return;
    if (quantity < 1 || quantity > maxQuantity) { setMessage('Choose a valid number of tickets.'); return; }
    if (!customer.name.trim() || !customer.email.trim() || !customer.phone.trim()) { setMessage('Add your name, email and Nigerian phone number.'); return; }
    if (!policyAccepted) { setMessage('Please accept the session and payment policy before continuing.'); return; }
    setSubmitting(true); setMessage('');
    try {
      const result = await invokeFunction('initialize-payment', {
        screening_id: screening.id,
        items: [{ ticket_type_id: ticket.id, quantity }], customer,
        policy: { version: 'hyperview-session-v3', accepted: true },
      });
      const url = new URL(result.authorization_url);
      if (url.protocol !== 'https:' || url.hostname !== 'checkout.paystack.com' || !result.reference || !result.order_access_token) {
        throw new Error('The payment link was not valid. Please try again.');
      }
      sessionStorage.setItem(checkoutTokenKey(result.reference), result.order_access_token);
      window.location.assign(url.href);
    } catch (checkoutError) { setMessage(checkoutError.message); setSubmitting(false); }
  }

  if (loading) return <BookingState title="Finding your session…" message="Loading available dates and times." />;
  if (error) return <BookingState title="Booking is unavailable" message={error} />;
  if (!screening) return <BookingState title="That session is unavailable" message="Choose another available time." />;

  return <main className="booking-page"><section className="booking-cover session-booking-cover">
    <img src={hyperViewLive.photos[0].src} alt="" /><div className="booking-cover__veil" />
    <div className="ticket-shell booking-cover__content"><Link to="/sessions" className="booking-back"><ArrowLeft size={17} /> All sessions</Link>
      <div><p className="ticket-kicker">HyperView 9D Flying Cinema</p><h1>Book your 30-minute session</h1>
        <p>Enjoy two immersive 15-minute films selected and coordinated by the HyperView team.</p>
        <div className="booking-cover__meta"><span>30 minutes</span><span>Two films</span><span>One booking</span></div></div>
    </div></section>
    <section className="booking-workspace"><div className="ticket-shell"><div className="booking-progress"><span className="active"><i>1</i> Session</span><span><i>2</i> Guests</span><span><i>3</i> Payment</span></div>
      <form className="booking-layout" onSubmit={checkout}><div className="booking-panels">
        <section className="booking-panel"><div className="booking-panel__heading"><span>01</span><div><h2>Choose your session</h2><p>Select one available 30-minute date and time.</p></div></div>
          <div className="date-picker">{dates.map((item) => { const day = formatShowing(item.starts_at, item.venue.timezone, { year: 'numeric', month: '2-digit', day: '2-digit' }); return <button type="button" className={selectedDay === day ? 'active' : ''} key={item.id} onClick={() => chooseSession(item.id)}><small>{formatShowing(item.starts_at, item.venue.timezone, { weekday: 'short' })}</small><strong>{formatShowing(item.starts_at, item.venue.timezone, { day: 'numeric' })}</strong><span>{formatShowing(item.starts_at, item.venue.timezone, { month: 'short' })}</span>{selectedDay === day && <Check size={15} />}</button>; })}</div>
          <div className="time-picker">{times.map((item) => <button type="button" key={item.id} className={item.id === screening.id ? 'active' : ''} onClick={() => chooseSession(item.id)}><Clock3 size={17} /> {formatShowing(item.starts_at, item.venue.timezone, { timeStyle: 'short' })}</button>)}</div>
          <p className="showtime-venue"><MapPin size={16} /> {screening.venue.name}, {screening.venue.city}</p>
          <p className="session-price-note"><Info size={15} /> {['Fri', 'Sat', 'Sun'].includes(formatShowing(screening.starts_at, screening.venue.timezone, { weekday: 'short' })) ? 'Friday–Sunday price' : 'Monday–Thursday price'} applied automatically.</p>
        </section>
        <section className="booking-panel"><div className="booking-panel__heading"><span>02</span><div><h2>How many guests?</h2><p>Each guest receives one admission to this session.</p></div></div>
          <div className="ticket-options"><div className="ticket-option"><div><h3>Session admission</h3><p>30 minutes · two 15-minute films · {ticket?.remaining ?? 'Available'} places remaining</p></div><strong>{formatKobo(ticket?.price_kobo || 0)}</strong>
            <div className="quantity-control"><button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} disabled={quantity <= 1}><Minus size={16} /></button><span>{quantity}</span><button type="button" onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))} disabled={quantity >= maxQuantity}><Plus size={16} /></button></div></div></div>
        </section>
        <section className="booking-panel"><div className="booking-panel__heading"><span>03</span><div><h2>Where should we send your confirmation?</h2><p>We will email your booking reference and QR code.</p></div></div>
          <div className="customer-fields"><label className="field field--wide">Full name<input value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} autoComplete="name" maxLength={120} required /></label>
            <label className="field">Email address<input type="email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} autoComplete="email" maxLength={254} required /></label>
            <label className="field">Nigerian phone number<input type="tel" value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} autoComplete="tel" maxLength={24} required /></label></div>
          <div className="booking-policy"><h3>Before you pay</h3><ul><li>Arrive at least 15 minutes before the selected session.</li><li>Your admission covers one 30-minute session with two 15-minute films.</li><li>The films are selected and played by staff at the centre.</li><li>Payment is non-refundable and the session cannot be rescheduled.</li></ul>
            <label><input type="checkbox" checked={policyAccepted} onChange={(event) => { setPolicyAccepted(event.target.checked); setMessage(''); }} /><span>I understand and accept the HyperView session policy.</span></label></div>
        </section>
      </div><aside className="order-summary"><p className="order-summary__eyebrow">Your booking</p><div className="order-summary__movie session-summary-mark"><Ticket size={30} /><div><h2>HyperView session</h2><p>Two films · 30 minutes</p></div></div>
        <div className="order-summary__detail"><CalendarDays size={18} /><div><small>Date</small><strong>{formatShowing(screening.starts_at, screening.venue.timezone, { dateStyle: 'full' })}</strong></div></div>
        <div className="order-summary__detail"><Clock3 size={18} /><div><small>Time</small><strong>{formatShowing(screening.starts_at, screening.venue.timezone, { timeStyle: 'short' })}</strong></div></div>
        <div className="order-summary__detail"><MapPin size={18} /><div><small>Venue</small><strong>{screening.venue.name}, {screening.venue.city}</strong></div></div><div className="order-summary__line" />
        <div className="order-summary__items"><div><span>{quantity} × Session admission</span><strong>{formatKobo(totalKobo)}</strong></div></div>
        <div className="order-summary__total"><span>Total</span><strong>{formatKobo(totalKobo)}</strong></div><div className="order-summary__total order-summary__total--paid"><span>Full payment due now</span><strong>{formatKobo(totalKobo)}</strong></div>
        <p className="order-summary__fees"><Info size={14} /> Arrive 15 minutes early. Price and capacity are confirmed by the server.</p>{message && <p className="booking-error" role="alert">{message}</p>}
        <button className="ticket-button ticket-button--pay" disabled={submitting || !ticket}><LockKeyhole size={17} /> {submitting ? 'Opening Paystack…' : 'Continue to secure payment'}</button><p className="order-summary__secure"><ShieldCheck size={16} /> Secure checkout powered by Paystack</p>
      </aside></form></div></section>
  </main>;
}
