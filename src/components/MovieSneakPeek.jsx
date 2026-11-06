import { ArrowRight, BadgeCheck, CalendarRange, MapPin, Ticket, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import useAdmissionProducts from '../hooks/useAdmissionProducts';
import { formatKobo, formatValidityEnd } from '../lib/catalog';
import './ticketing.css';

export default function MovieSneakPeek() {
  const { products, loading, error } = useAdmissionProducts();
  const product = products[0];
  return <section className="ticket-preview scroll-element" id="ticket-preview" aria-labelledby="ticket-preview-title">
    <div className="ticket-preview__glow ticket-preview__glow--one" /><div className="ticket-preview__glow ticket-preview__glow--two" />
    <div className="ticket-shell ticket-preview__inner"><div className="ticket-preview__intro"><div><p className="ticket-kicker"><Ticket size={16} /> Flexible HyperView admission</p>
      <h2 id="ticket-preview-title">Buy today. Visit any operating session.</h2></div><div className="ticket-preview__copy"><p>No movie or time-slot selection. Your one-use ticket remains valid only inside the current Monday–Thursday or Friday–Sunday window.</p>
        <Link to="/tickets" className="ticket-text-link">See tickets and expiry <ArrowRight size={18} /></Link></div></div>
      {product && <div className="ticket-preview__grid"><article className="ticket-preview-session"><p>Individual admission</p><h3>{formatKobo(product.individual_price_kobo)} per person</h3>
        <span><CalendarRange size={15} /> Valid until {formatValidityEnd(product.valid_until, product.venue_timezone, { dateStyle: 'full', timeStyle: 'short' })}</span><span><MapPin size={15} /> {product.venue_name}, {product.venue_city}</span>
        <Link to={`/tickets/individual?venue=${product.venue_id}`}><Ticket size={16} /> Buy tickets</Link></article>
        <article className="ticket-preview-session"><p>15-person group package</p><h3>{product.group_available ? `${formatKobo(product.group_price_kobo)} total` : 'Price being configured'}</h3><span><UsersRound size={15} /> One group visit · exactly 15 guests</span>
          <span><CalendarRange size={15} /> Same current-band expiry</span>{product.group_available
            ? <Link to={`/tickets/group?venue=${product.venue_id}`}><UsersRound size={16} /> Buy group pass</Link>
            : <span className="ticket-preview-session__unavailable">Temporarily unavailable</span>}</article>
        <article className="ticket-preview-session"><p>How validity works</p><h3>{product.band === 'weekday' ? 'Ends Thursday night' : 'Ends Sunday night'}</h3><span><CalendarRange size={15} /> Tickets never carry into the next band</span><span><Ticket size={15} /> Each admission can be redeemed once</span><Link to="/tickets"><ArrowRight size={16} /> Read before paying</Link></article></div>}
      {loading && <p className="programme-feedback">Loading today’s admission…</p>}{error && <p className="programme-feedback" role="status">Online admission is temporarily unavailable.</p>}
      <div className="ticket-preview__promise"><span><BadgeCheck size={18} /> Any operating session</span><span><BadgeCheck size={18} /> Secure Paystack checkout</span><span><BadgeCheck size={18} /> Reception-ready QR code</span></div>
    </div>
  </section>;
}
