import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarRange, CheckCircle2, Info, LockKeyhole, MapPin, Minus, Plus, ShieldCheck, Ticket, UsersRound } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import useAdmissionProducts from '../hooks/useAdmissionProducts';
import { formatKobo, formatValidityEnd, invokeFunction } from '../lib/catalog';
import { hyperViewLive } from '../lib/hyperview';
import '../components/ticketing.css';

const checkoutTokenKey = (reference) => `cinema57:order:${reference}`;

function PageState({ title, message }) {
  return <main className="booking-not-found"><Ticket size={42} /><h1>{title}</h1><p>{message}</p><Link className="ticket-button ticket-button--primary" to="/tickets">View tickets</Link></main>;
}

export default function SessionBooking() {
  const { passType } = useParams();
  const [searchParams] = useSearchParams();
  const { products, loading, error } = useAdmissionProducts();
  const isGroup = passType === 'group';
  const validType = passType === 'individual' || isGroup;
  const requestedVenue = searchParams.get('venue');
  const product = products.find((item) => item.venue_id === requestedVenue) || products[0];
  const [quantity, setQuantity] = useState(isGroup ? 15 : 1);
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '' });
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { setQuantity(isGroup ? 15 : 1); setPolicyAccepted(false); }, [isGroup]);
  const unitPrice = Number(isGroup ? product?.group_price_kobo : product?.individual_price_kobo) || 0;
  const totalKobo = isGroup ? unitPrice : unitPrice * quantity;
  const expiry = product && formatValidityEnd(product.valid_until, product.venue_timezone, { dateStyle: 'full', timeStyle: 'short' });

  async function checkout(event) {
    event.preventDefault();
    if (!product || !validType) return;
    if ((isGroup && quantity !== 15) || (!isGroup && (quantity < 1 || quantity > 15))) { setMessage('Choose a valid ticket quantity.'); return; }
    if (!customer.name.trim() || !customer.email.trim() || !customer.phone.trim()) { setMessage('Add your name, email and Nigerian phone number.'); return; }
    if (!policyAccepted) { setMessage('Please accept the admission and expiry policy before continuing.'); return; }
    setSubmitting(true); setMessage('');
    try {
      const result = await invokeFunction('initialize-payment', {
        venue_id: product.venue_id, booking_type: isGroup ? 'group' : 'individual', quantity, customer,
        policy: { version: 'hyperview-flex-pass-v1', accepted: true },
      });
      const url = new URL(result.authorization_url);
      if (url.protocol !== 'https:' || url.hostname !== 'checkout.paystack.com' || !result.reference || !result.order_access_token) throw new Error('The payment link was not valid. Please try again.');
      sessionStorage.setItem(checkoutTokenKey(result.reference), result.order_access_token);
      window.location.assign(url.href);
    } catch (checkoutError) { setMessage(checkoutError.message); setSubmitting(false); }
  }

  if (!validType) return <PageState title="Ticket type unavailable" message="Choose individual admission or the 15-person group package." />;
  if (loading) return <PageState title="Preparing today’s ticket…" message="Confirming the current price and expiry window." />;
  if (error) return <PageState title="Online admission is unavailable" message={error} />;
  if (!product) return <PageState title="Online admission is unavailable" message="No active venue or price is configured right now." />;

  return <main className="booking-page flex-checkout-page"><section className="booking-cover session-booking-cover"><img src={hyperViewLive.photos[0].src} alt="" /><div className="booking-cover__veil" />
    <div className="ticket-shell booking-cover__content"><Link to="/tickets" className="booking-back"><ArrowLeft size={17} /> All tickets</Link><div><p className="ticket-kicker">HyperView flexible admission</p>
      <h1>{isGroup ? 'Buy a 15-person group pass' : 'Buy individual admission'}</h1><p>No movie or time selection. Pay now and attend any operating session before this ticket window expires.</p>
      <div className="booking-cover__meta"><span>One-time admission</span><span>Any operating session</span><span>{product.band === 'weekday' ? 'Mon–Thu window' : 'Fri–Sun window'}</span></div></div></div></section>
    <section className="booking-workspace"><div className="ticket-shell"><form className="booking-layout" onSubmit={checkout}><div className="booking-panels">
      <section className="booking-panel flex-expiry-panel"><div className="booking-panel__heading"><span>01</span><div><h2>Your ticket window</h2><p>The expiry is fixed by the day you purchase.</p></div></div>
        <div className="flex-expiry-visual"><CalendarRange size={34} /><div><small>Valid after successful payment</small><strong>Expires {expiry}</strong><p>{product.band === 'weekday' ? 'This weekday ticket will not carry into Friday.' : 'This weekend ticket will not carry into Monday.'}</p></div></div>
        <div className="flex-any-session"><CheckCircle2 size={20} /><div><strong>No session booking needed</strong><p>Come during operating hours and join any available session. Staff choose and coordinate the films at the centre.</p></div></div>
        <p className="showtime-venue"><MapPin size={16} /> {product.venue_name}, {product.venue_address}, {product.venue_city}</p>
      </section>
      <section className="booking-panel"><div className="booking-panel__heading"><span>02</span><div><h2>{isGroup ? 'Your group package' : 'How many tickets?'}</h2><p>{isGroup ? 'One group visit for exactly 15 people.' : 'Each ticket is a separate one-time admission.'}</p></div></div>
        <div className="ticket-options"><div className="ticket-option"><div><h3>{isGroup ? '15-person group pass' : 'Flexible admission'}</h3><p>{isGroup ? '15 guests together · three staff-selected films' : 'One person · any operating session · one-time use'}</p></div><strong>{formatKobo(unitPrice)} {isGroup ? 'total' : 'per person'}</strong>
          {isGroup ? <div className="quantity-control quantity-control--fixed"><UsersRound size={15} /><span>15 guests</span></div> : <div className="quantity-control"><button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} disabled={quantity <= 1}><Minus size={16} /></button><span>{quantity}</span><button type="button" onClick={() => setQuantity((value) => Math.min(15, value + 1))} disabled={quantity >= 15}><Plus size={16} /></button></div>}</div></div>
      </section>
      <section className="booking-panel"><div className="booking-panel__heading"><span>03</span><div><h2>Where should we send your ticket?</h2><p>We will email your confirmation, reference and QR code.</p></div></div>
        <div className="customer-fields"><label className="field field--wide">Full name<input value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} autoComplete="name" maxLength={120} required /></label>
          <label className="field">Email address<input type="email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} autoComplete="email" maxLength={254} required /></label>
          <label className="field">Nigerian phone number<input type="tel" value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} autoComplete="tel" maxLength={24} required /></label></div>
        <div className="booking-policy"><h3>Before you pay</h3><ul><li>This is a one-time admission, not unlimited entry throughout the validity window.</li><li>You may attend any operating session before {expiry}.</li><li>The ticket does not carry into the next weekday/weekend band.</li><li>No movie is selected online; staff coordinate the films when you arrive.</li><li>Payment is non-refundable and the ticket cannot be rescheduled or extended.</li></ul>
          <label><input type="checkbox" checked={policyAccepted} onChange={(event) => { setPolicyAccepted(event.target.checked); setMessage(''); }} /><span>I understand the one-use and expiry policy.</span></label></div>
      </section>
    </div><aside className="order-summary"><p className="order-summary__eyebrow">Your admission</p><div className="order-summary__movie session-summary-mark"><Ticket size={30} /><div><h2>{isGroup ? '15-person group pass' : 'HyperView ticket'}</h2><p>Any operating session · one use</p></div></div>
      <div className="order-summary__detail"><CalendarRange size={18} /><div><small>Expires</small><strong>{expiry}</strong></div></div><div className="order-summary__detail"><MapPin size={18} /><div><small>Venue</small><strong>{product.venue_name}, {product.venue_city}</strong></div></div><div className="order-summary__line" />
      <div className="order-summary__items"><div><span>{isGroup ? '15-person group package' : `${quantity} × Flexible admission`}</span><strong>{formatKobo(totalKobo)}</strong></div></div><div className="order-summary__total"><span>Total</span><strong>{formatKobo(totalKobo)}</strong></div>
      <p className="order-summary__fees"><Info size={14} /> Price and expiry are confirmed securely by the server.</p>{message && <p className="booking-error" role="alert">{message}</p>}
      <button className="ticket-button ticket-button--pay" disabled={submitting}><LockKeyhole size={17} /> {submitting ? 'Opening Paystack…' : 'Continue to secure payment'}</button><p className="order-summary__secure"><ShieldCheck size={16} /> Secure checkout powered by Paystack</p>
    </aside></form></div></section>
  </main>;
}
