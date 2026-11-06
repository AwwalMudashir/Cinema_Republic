import { ArrowRight, BadgeCheck, CalendarRange, Clock3, MapPin, ShieldCheck, Sparkles, TicketCheck, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import useAdmissionProducts from '../hooks/useAdmissionProducts';
import { formatKobo, formatValidityEnd } from '../lib/catalog';
import { hyperViewLive } from '../lib/hyperview';
import '../components/ticketing.css';

function validityCopy(product) {
  const until = formatValidityEnd(product.valid_until, product.venue_timezone, { weekday: 'long', hour: 'numeric', minute: '2-digit' });
  return product.band === 'weekday'
    ? `Buy today and use it once at any operating session before ${until}. It will not carry into Friday.`
    : `Buy today and use it once at any operating session before ${until}. It will not carry into Monday.`;
}

export default function Sessions() {
  const { products, loading, error } = useAdmissionProducts();
  const primary = products[0];
  return <main className="movies-page sessions-page flex-pass-page">
    <section className="movies-hero sessions-hero"><img className="movies-hero__image" src={hyperViewLive.photos[1].src} alt="" /><div className="movies-hero__overlay" />
      <div className="ticket-shell movies-hero__content"><div className="movies-hero__copy"><p className="ticket-kicker"><Sparkles size={16} /> HyperView 9D Flying Cinema</p>
        <h1>Buy now.<br /><em>Visit when it suits you.</em></h1><p className="movies-hero__lede">Your ticket is not tied to a movie or a scheduled time. Visit any operating HyperView session before your current weekday or weekend validity window ends.</p>
        <a href="#buy-admission" className="ticket-button ticket-button--primary">Choose your ticket</a></div>
        {primary && <aside className="movies-hero__showcard flex-validity-card"><p>Current validity window</p><h2>{primary.band === 'weekday' ? 'Monday–Thursday admission' : 'Friday–Sunday admission'}</h2>
          <div><CalendarRange size={18} /> Valid until {formatValidityEnd(primary.valid_until, primary.venue_timezone, { dateStyle: 'full', timeStyle: 'short' })}</div>
          <div><Clock3 size={18} /> Any operating session · one-time entry</div><div><MapPin size={18} /> {primary.venue_name}, {primary.venue_city}</div></aside>}
      </div></section>
    <section className="flex-policy-strip"><div className="ticket-shell"><div><CalendarRange size={22} /><span><strong>Mon–Thu purchase</strong><small>Expires Thursday night</small></span></div>
      <div><CalendarRange size={22} /><span><strong>Fri–Sun purchase</strong><small>Expires Sunday night</small></span></div><div><TicketCheck size={22} /><span><strong>Use once</strong><small>At any operating session</small></span></div></div></section>
    <section className="movie-programme" id="buy-admission"><div className="ticket-shell"><div className="movie-programme__header"><div><p className="ticket-kicker ticket-kicker--dark">Choose admission</p><h2>No movie. No time slot. Just your visit.</h2></div>
      <p>The price and expiry below are calculated from today in Lagos. The backend confirms both again before Paystack opens.</p></div>
      {loading && <p className="programme-feedback" role="status">Loading today’s tickets…</p>}{error && <p className="programme-feedback" role="alert">{error}</p>}
      {!loading && !error && products.length === 0 && <p className="programme-feedback">Online admission is temporarily unavailable.</p>}
      {products.map((product) => <div className="flex-product-venue" key={product.venue_id}><p className="showtime-venue"><MapPin size={16} /> {product.venue_name}, {product.venue_city}</p>
        <div className="flex-product-grid"><article className="flex-product-card"><div className="flex-product-card__icon"><TicketCheck size={28} /></div><p className="ticket-kicker ticket-kicker--dark">Individual admission</p><h3>Choose 1–15 tickets</h3>
          <p>Each ticket admits one person once at any operating session before the current window expires.</p><strong>{formatKobo(product.individual_price_kobo)} <small>per person</small></strong>
          <div className="flex-validity-note"><CalendarRange size={18} /><span>{validityCopy(product)}</span></div><Link className="ticket-button ticket-button--primary" to={`/tickets/individual?venue=${product.venue_id}`}>Buy individual tickets <ArrowRight size={17} /></Link></article>
          <article className="flex-product-card flex-product-card--group"><div className="flex-product-card__icon"><UsersRound size={28} /></div><p className="ticket-kicker ticket-kicker--dark">Group package</p><h3>Exactly 15 guests</h3>
            <p>One group visit for 15 people, with three staff-selected films. The group attends together during the validity window.</p><strong>{product.group_available ? formatKobo(product.group_price_kobo) : 'Price being configured'} {product.group_available && <small>total</small>}</strong>
            <div className="flex-validity-note"><CalendarRange size={18} /><span>{validityCopy(product)}</span></div>{product.group_available
              ? <Link className="ticket-button ticket-button--primary" to={`/tickets/group?venue=${product.venue_id}`}>Buy group package <ArrowRight size={17} /></Link>
              : <span className="ticket-button ticket-button--unavailable" aria-disabled="true">Group booking temporarily unavailable</span>}</article></div></div>)}
    </div></section>
    <section className="booking-steps"><div className="ticket-shell"><div className="booking-steps__heading"><p className="ticket-kicker"><ShieldCheck size={16} /> Know before paying</p><h2>Flexible timing, clear boundaries.</h2></div>
      <div className="booking-steps__grid"><article><span>01</span><h3>Buy in the current band</h3><p>Monday–Thursday tickets expire Thursday night. Friday–Sunday tickets expire Sunday night.</p></article>
        <article><span>02</span><h3>Come at any operating time</h3><p>You do not select a movie or session online. Staff coordinate the films when you arrive.</p></article>
        <article><span>03</span><h3>Redeem once</h3><p>Reception verifies the QR and issues physical tags. Used or expired tickets cannot be reused.</p></article></div>
      <div className="booking-steps__note"><BadgeCheck size={20} /> Tickets never carry into the next weekday or weekend band.</div></div></section>
  </main>;
}
