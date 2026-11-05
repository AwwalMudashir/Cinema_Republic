import { CalendarCheck2, Clock3, MapPin, ShieldCheck, Sparkles, TicketCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import useSessionProgramme from '../hooks/useSessionProgramme';
import { formatKobo, formatShowing } from '../lib/catalog';
import { hyperViewLive } from '../lib/hyperview';
import '../components/ticketing.css';

export default function Sessions() {
  const { sessions, loading, error } = useSessionProgramme();
  const nextSession = sessions.find((session) => session.isBookable) || sessions[0];

  return <main className="movies-page sessions-page">
    <section className="movies-hero sessions-hero">
      <img className="movies-hero__image" src={hyperViewLive.photos[1].src} alt="" />
      <div className="movies-hero__overlay" />
      <div className="ticket-shell movies-hero__content">
        <div className="movies-hero__copy"><p className="ticket-kicker"><Sparkles size={16} /> HyperView 9D Flying Cinema</p>
          <h1>Choose a time.<br /><em>Take your flight.</em></h1>
          <p className="movies-hero__lede">Choose individual admission for a 30-minute, two-film experience or reserve an exclusive 45-minute session for a group of exactly 15.</p>
          <a href="#available-sessions" className="ticket-button ticket-button--primary">See available sessions</a>
        </div>
        {nextSession && <aside className="movies-hero__showcard"><p>Next session</p><h2>{nextSession.sessionKind === 'group' ? 'Exclusive 15-person group session' : 'Individual HyperView experience'}</h2>
          <div><CalendarCheck2 size={18} /> {formatShowing(nextSession.starts_at, nextSession.venue.timezone, { dateStyle: 'full' })}</div>
          <div><Clock3 size={18} /> {formatShowing(nextSession.starts_at, nextSession.venue.timezone, { timeStyle: 'short' })}</div>
          <div><MapPin size={18} /> {nextSession.venue.name}, {nextSession.venue.city}</div>
          {nextSession.isBookable && <Link to={`/sessions/${nextSession.id}`}>Book this session</Link>}
        </aside>}
      </div>
    </section>

    <section className="movie-programme" id="available-sessions">
          <div className="ticket-shell"><div className="movie-programme__header"><div><p className="ticket-kicker ticket-kicker--dark">Available times</p>
        <h2>Book the session that suits you</h2></div><p>No film selection is required. Staff coordinate two films for individual sessions and three films for group sessions.</p></div>
        <div className="session-programme-grid">
          {sessions.map((session) => {
            const ticket = session.ticketTypes[0];
            return <article className={`session-card ${session.isBookable ? '' : 'session-card--unavailable'}`} key={session.id}>
              <div className="session-card__date"><small>{formatShowing(session.starts_at, session.venue.timezone, { weekday: 'short' })}</small>
                <strong>{formatShowing(session.starts_at, session.venue.timezone, { day: '2-digit' })}</strong><span>{formatShowing(session.starts_at, session.venue.timezone, { month: 'short' })}</span></div>
              <div className="session-card__body"><p>{session.isBookable ? session.sessionKind === 'group' ? 'Exclusive group package' : 'Booking open' : session.isComingSoon ? 'Sales open soon' : 'Full'}</p>
                <h3>{formatShowing(session.starts_at, session.venue.timezone, { timeStyle: 'short' })} session</h3>
                <span><Clock3 size={15} /> {session.durationMinutes} minutes · {session.filmCount} staff-selected films</span><span><MapPin size={15} /> {session.venue.name}, {session.venue.city}</span>
                {ticket && <strong>{formatKobo(ticket.price_kobo)} {session.sessionKind === 'group' ? 'total for 15 guests' : 'per person'}</strong>}
                {ticket?.remaining != null && session.isBookable && <small>{session.sessionKind === 'group' ? 'All 15 places are reserved together' : `${ticket.remaining} place${ticket.remaining === 1 ? '' : 's'} remaining`}</small>}
              </div>
              {session.isBookable ? <Link to={`/sessions/${session.id}`} className="ticket-button ticket-button--primary">Book session</Link>
                : <span className="session-card__status">{session.isComingSoon ? `Opens ${formatShowing(session.sales_start, session.venue.timezone, { dateStyle: 'medium', timeStyle: 'short' })}` : 'Unavailable'}</span>}
            </article>;
          })}
        </div>
        {loading && <p className="programme-feedback" role="status">Loading available sessions…</p>}
        {error && <p className="programme-feedback" role="alert">{error}</p>}
        {!loading && !error && sessions.length === 0 && <p className="programme-feedback">No sessions are scheduled right now. Please check back soon.</p>}
      </div>
    </section>

    <section className="booking-steps"><div className="ticket-shell"><div className="booking-steps__heading"><p className="ticket-kicker"><TicketCheck size={16} /> Simple session booking</p>
      <h2>Your HyperView visit in three steps.</h2></div><div className="booking-steps__grid">
        <article><span>01</span><h3>Choose a session</h3><p>Select an individual or exclusive group date and time.</p></article>
        <article><span>02</span><h3>Confirm your guests</h3><p>Choose individual admissions, or reserve the fixed 15-person group package.</p></article>
        <article><span>03</span><h3>Pay and arrive</h3><p>Pay securely and arrive 15 minutes early with your booking QR.</p></article>
      </div><div className="booking-steps__note"><ShieldCheck size={20} /> Group sessions include three 15-minute films and reserve the full 15-person session.</div></div></section>
  </main>;
}
