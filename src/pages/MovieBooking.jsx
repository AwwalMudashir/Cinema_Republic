import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, CalendarDays, Check, Clock3, Info, LockKeyhole,
  MapPin, Minus, Plus, ShieldCheck, Ticket,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import useMovieProgramme from '../hooks/useMovieProgramme';
import { formatKobo, formatShowing, invokeFunction } from '../lib/catalog';
import '../components/ticketing.css';

const checkoutTokenKey = (reference) => `cinema57:order:${reference}`;

function BookingState({ title, message }) {
  return (
    <main className="booking-not-found">
      <Ticket size={42} />
      <h1>{title}</h1>
      <p>{message}</p>
      <Link className="ticket-button ticket-button--primary" to="/movies">View movies</Link>
    </main>
  );
}

export default function MovieBooking() {
  const { slug } = useParams();
  const { movies, loading, error } = useMovieProgramme();
  const movie = movies.find((item) => item.slug === slug);
  const [screeningId, setScreeningId] = useState('');
  const [quantities, setQuantities] = useState({});
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '' });
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (movie?.openScreenings.length && !movie.openScreenings.some((item) => item.id === screeningId)) {
      setScreeningId(movie.openScreenings[0].id);
    }
  }, [movie, screeningId]);

  const screening = movie?.openScreenings.find((item) => item.id === screeningId)
    || movie?.openScreenings[0];
  const ticketTypes = screening?.ticketTypes ?? [];
  const dates = useMemo(() => {
    const seen = new Set();
    return (movie?.openScreenings ?? []).filter((item) => {
      const localDay = formatShowing(item.starts_at, item.venue.timezone, {
        year: 'numeric', month: '2-digit', day: '2-digit',
      });
      if (seen.has(localDay)) return false;
      seen.add(localDay);
      return true;
    });
  }, [movie]);
  const selectedDay = screening && formatShowing(screening.starts_at, screening.venue.timezone, {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const times = (movie?.openScreenings ?? []).filter((item) =>
    formatShowing(item.starts_at, item.venue.timezone, {
      year: 'numeric', month: '2-digit', day: '2-digit',
    }) === selectedDay);
  const selectedItems = ticketTypes
    .map((type) => ({ ticket_type_id: type.id, quantity: quantities[type.id] || 0 }))
    .filter((item) => item.quantity > 0);
  const ticketCount = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalKobo = ticketTypes.reduce((sum, type) =>
    sum + Number(type.price_kobo) * (quantities[type.id] || 0), 0);

  const chooseScreening = (id) => {
    setScreeningId(id);
    setQuantities({});
    setMessage('');
  };

  const changeQuantity = (id, change) => {
    setQuantities((current) => ({
      ...current,
      [id]: Math.max(0, Math.min(8, (current[id] || 0) + change)),
    }));
    setMessage('');
  };

  const checkout = async (event) => {
    event.preventDefault();
    if (!movie?.isBookable || !screening || !ticketTypes.length
      || new Date(screening.sales_start).getTime() > Date.now()) return;
    if (ticketTypes.some((type) => type.remaining !== null
      && (quantities[type.id] || 0) > type.remaining)) {
      setMessage('Availability has changed. Please adjust your ticket quantities.');
      return;
    }
    if (ticketCount < 1) {
      setMessage('Choose at least one ticket to continue.');
      return;
    }
    if (!customer.name.trim() || !customer.email.trim() || !customer.phone.trim()) {
      setMessage('Add your name, email and Nigerian phone number.');
      return;
    }
    setSubmitting(true);
    setMessage('');
    try {
      const result = await invokeFunction('initialize-payment', {
        screening_id: screening.id,
        items: selectedItems,
        customer,
      });
      const url = new URL(result.authorization_url);
      if (url.protocol !== 'https:' || url.hostname !== 'checkout.paystack.com'
        || !result.reference || !result.order_access_token) {
        throw new Error('The payment link was not valid. Please try again.');
      }
      sessionStorage.setItem(checkoutTokenKey(result.reference), result.order_access_token);
      window.location.assign(url.href);
    } catch (checkoutError) {
      setMessage(checkoutError.message);
      setSubmitting(false);
    }
  };

  if (loading) return <BookingState title="Finding your screening…" message="Loading available showtimes and tickets." />;
  if (error) return <BookingState title="Booking is unavailable" message={error} />;
  if (!movie) return <BookingState title="That screening has left the programme." message="Browse the latest films and find another night under the stars." />;

  return (
    <main className="booking-page">
      <section className="booking-cover">
        <img src={movie.backdrop} alt="" />
        <div className="booking-cover__veil" />
        <div className="ticket-shell booking-cover__content">
          <Link to="/movies" className="booking-back"><ArrowLeft size={17} /> All movies</Link>
          <div>
            <p className="ticket-kicker">{movie.isBookable ? 'Now booking' : movie.isComingSoon ? 'Coming soon' : 'Sold out'} · {movie.genre}</p>
            <h1>{movie.title}</h1>
            <p>{movie.tagline}</p>
            <div className="booking-cover__meta">
              {movie.rating && <span>{movie.rating}</span>}
              {movie.runtime_minutes && <span>{movie.runtime_minutes} min</span>}
              <span>{movie.language}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="booking-workspace">
        <div className="ticket-shell">
          {movie.upcomingScreenings.length > 0 && <section className="coming-soon-panel" aria-labelledby="sales-opening-title">
            <div className="coming-soon-panel__intro">
              <span className="coming-soon-panel__icon"><CalendarDays size={25} /></span>
              <div>
                <p className="ticket-kicker ticket-kicker--dark">Tickets on the horizon</p>
                <h2 id="sales-opening-title">{movie.isBookable ? 'More showtimes open soon' : 'Your next movie night is nearly here'}</h2>
                <p>{movie.isBookable ? 'These additional showtimes are not bookable yet.' : 'Tickets are not available yet. Check back when sales open.'}</p>
              </div>
            </div>
            <div className="coming-soon-panel__list">
              {movie.upcomingScreenings.map((item) => <div className="coming-soon-panel__showing" key={item.id}>
                <div>
                  <span className="coming-soon-panel__label">Tickets open</span>
                  <strong>{formatShowing(item.sales_start, item.venue.timezone, { dateStyle: 'full', timeStyle: 'short' })}</strong>
                  <small>Local time · {item.venue.timezone}</small>
                </div>
                <div>
                  <span className="coming-soon-panel__label">Screening</span>
                  <strong>{formatShowing(item.starts_at, item.venue.timezone, { dateStyle: 'medium', timeStyle: 'short' })}</strong>
                  <small>{item.venue.name}, {item.venue.city}</small>
                </div>
              </div>)}
            </div>
          </section>}
          {movie.soldOutScreenings.length > 0 && <section className="coming-soon-panel coming-soon-panel--sold-out" aria-labelledby="sold-out-title">
            <div className="coming-soon-panel__intro">
              <span className="coming-soon-panel__icon"><Ticket size={25} /></span>
              <div>
                <p className="ticket-kicker ticket-kicker--dark">All places taken</p>
                <h2 id="sold-out-title">{movie.isSoldOut ? 'All showtimes are sold out' : 'Some showtimes are sold out'}</h2>
                <p>{movie.isSoldOut ? 'There are no tickets available right now.' : 'These showtimes have no places available right now.'} If a pending reservation expires, a place may become available again.</p>
              </div>
            </div>
            <div className="coming-soon-panel__list">
              {movie.soldOutScreenings.map((item) => <div className="coming-soon-panel__showing" key={item.id}>
                <div>
                  <span className="coming-soon-panel__label">Screening</span>
                  <strong>{formatShowing(item.starts_at, item.venue.timezone, { dateStyle: 'full', timeStyle: 'short' })}</strong>
                </div>
                <div>
                  <span className="coming-soon-panel__label">Venue</span>
                  <strong>{item.venue.name}</strong>
                  <small>{item.venue.city}</small>
                </div>
              </div>)}
            </div>
          </section>}
          {movie.isBookable && <>
          <div className="booking-progress" aria-label="Booking steps">
            <span className="active"><i>1</i> Showtime</span>
            <span><i>2</i> Tickets</span>
            <span><i>3</i> Checkout</span>
          </div>
          <form className="booking-layout" onSubmit={checkout}>
            <div className="booking-panels">
              <section className="booking-panel" aria-labelledby="showtime-title">
                <div className="booking-panel__heading">
                  <span>01</span><div><h2 id="showtime-title">Choose a showtime</h2><p>All times are local to the venue.</p></div>
                </div>
                <div className="date-picker">
                  {dates.map((item) => {
                    const zone = item.venue.timezone;
                    const day = formatShowing(item.starts_at, zone, { year: 'numeric', month: '2-digit', day: '2-digit' });
                    return (
                      <button type="button" className={selectedDay === day ? 'active' : ''}
                        key={item.id} onClick={() => chooseScreening(item.id)}>
                        <small>{formatShowing(item.starts_at, zone, { weekday: 'short' })}</small>
                        <strong>{formatShowing(item.starts_at, zone, { day: 'numeric' })}</strong>
                        <span>{formatShowing(item.starts_at, zone, { month: 'short' })}</span>
                        {selectedDay === day && <Check size={15} />}
                      </button>
                    );
                  })}
                </div>
                <div className="time-picker" role="group" aria-label="Available showtimes">
                  {times.map((item) => (
                    <button type="button" key={item.id} className={item.id === screening?.id ? 'active' : ''}
                      onClick={() => chooseScreening(item.id)}>
                      <Clock3 size={17} /> {formatShowing(item.starts_at, item.venue.timezone, { timeStyle: 'short' })}
                    </button>
                  ))}
                </div>
                {screening && <p className="showtime-venue"><MapPin size={16} /> {screening.venue.name}, {screening.venue.city}</p>}
              </section>

              <section className="booking-panel" aria-labelledby="tickets-title">
                <div className="booking-panel__heading">
                  <span>02</span><div><h2 id="tickets-title">Choose your tickets</h2><p>Maximum of eight admissions per order.</p></div>
                </div>
                <div className="ticket-options">
                  {ticketTypes.map((type) => (
                    <div className="ticket-option" key={type.id}>
                      <div><h3>{type.name}</h3><p>{type.remaining === 0 ? 'Sold out' : type.description || 'Admission for this screening'}</p></div>
                      <strong>{formatKobo(type.price_kobo)}</strong>
                      <div className="quantity-control" aria-label={`${type.name} quantity`}>
                        <button type="button" onClick={() => changeQuantity(type.id, -1)}
                          aria-label={`Remove one ${type.name}`} disabled={!quantities[type.id]}><Minus size={16} /></button>
                        <span>{quantities[type.id] || 0}</span>
                        <button type="button" onClick={() => changeQuantity(type.id, 1)}
                          aria-label={`Add one ${type.name}`} disabled={ticketCount >= 8 || type.remaining === 0
                            || (type.remaining !== null && (quantities[type.id] || 0) >= type.remaining)}><Plus size={16} /></button>
                      </div>
                    </div>
                  ))}
                  {!ticketTypes.length && <p>No ticket types are on sale for this showing.</p>}
                </div>
              </section>

              <section className="booking-panel" aria-labelledby="details-title">
                <div className="booking-panel__heading">
                  <span>03</span><div><h2 id="details-title">Where should we email your tickets?</h2><p>Each admission gets its own digital QR ticket.</p></div>
                </div>
                <div className="customer-fields">
                  <label className="field field--wide">Full name
                    <input name="name" value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })}
                      autoComplete="name" maxLength={120} required placeholder="Your full name" />
                  </label>
                  <label className="field">Email address
                    <input name="email" type="email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })}
                      autoComplete="email" maxLength={254} required placeholder="you@example.com" />
                  </label>
                  <label className="field">Nigerian phone number
                    <input name="phone" type="tel" value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })}
                      autoComplete="tel" maxLength={24} required placeholder="080… or +234…" />
                  </label>
                </div>
              </section>
            </div>

            <aside className="order-summary" aria-label="Order summary">
              <p className="order-summary__eyebrow">Your order</p>
              <div className="order-summary__movie">
                <img src={movie.image} alt="" />
                <div><h2>{movie.title}</h2><p>{movie.rating} · {movie.runtime_minutes} min</p></div>
              </div>
              {screening && <>
                <div className="order-summary__detail"><CalendarDays size={18} /><div><small>Date</small><strong>{formatShowing(screening.starts_at, screening.venue.timezone, { dateStyle: 'full' })}</strong></div></div>
                <div className="order-summary__detail"><Clock3 size={18} /><div><small>Time</small><strong>{formatShowing(screening.starts_at, screening.venue.timezone, { timeStyle: 'short' })}</strong></div></div>
                <div className="order-summary__detail"><MapPin size={18} /><div><small>Venue</small><strong>{screening.venue.name}, {screening.venue.city}</strong></div></div>
              </>}
              <div className="order-summary__line" />
              <div className="order-summary__items">
                {ticketTypes.filter((type) => quantities[type.id] > 0).map((type) => (
                  <div key={type.id}><span>{quantities[type.id]} × {type.name}</span><strong>{formatKobo(Number(type.price_kobo) * quantities[type.id])}</strong></div>
                ))}
                {!ticketCount && <p>No tickets selected yet.</p>}
              </div>
              <div className="order-summary__total"><span>Subtotal</span><strong>{formatKobo(totalKobo)}</strong></div>
              <p className="order-summary__fees"><Info size={14} /> The final amount and availability are confirmed by the server before Paystack opens.</p>
              {message && <p className="booking-error" role="alert">{message}</p>}
              <button className="ticket-button ticket-button--pay" type="submit" disabled={submitting || !ticketTypes.length}>
                <LockKeyhole size={17} /> {submitting ? 'Opening Paystack…' : 'Continue to secure payment'}
              </button>
              <p className="order-summary__secure"><ShieldCheck size={16} /> Secure checkout powered by Paystack</p>
            </aside>
          </form>
          </>}
        </div>
      </section>
    </main>
  );
}
