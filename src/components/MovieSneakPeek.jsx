import React from 'react';
import { ArrowRight, BadgeCheck, CalendarDays, Clock3, MapPin, Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';
import useSessionProgramme from '../hooks/useSessionProgramme';
import { formatKobo, formatShowing } from '../lib/catalog';
import './ticketing.css';

const MovieSneakPeek = () => {
  const { sessions, loading, error } = useSessionProgramme();
  return (
    <section className="ticket-preview scroll-element" id="ticket-preview" aria-labelledby="ticket-preview-title">
      <div className="ticket-preview__glow ticket-preview__glow--one" />
      <div className="ticket-preview__glow ticket-preview__glow--two" />
      <div className="ticket-shell ticket-preview__inner">
        <div className="ticket-preview__intro">
          <div>
            <p className="ticket-kicker"><Ticket size={16} /> HyperView 9D sessions</p>
            <h2 id="ticket-preview-title">Choose when you want to fly.</h2>
          </div>
          <div className="ticket-preview__copy">
            <p>
              Choose an available 30-minute session. Each guest enjoys two
              immersive 15-minute films coordinated by staff at the centre.
            </p>
            <Link to="/sessions" className="ticket-text-link">
              Browse available sessions <ArrowRight size={18} />
            </Link>
          </div>
        </div>

        <div className="ticket-preview__grid">
          {sessions.slice(0, 3).map((session) => <article className="ticket-preview-session" key={session.id}>
            <p>{session.isBookable ? 'Booking open' : session.isComingSoon ? 'Coming soon' : 'Full'}</p>
            <h3>{formatShowing(session.starts_at, session.venue.timezone, { weekday: 'long', day: 'numeric', month: 'short' })}</h3>
            <span><Clock3 size={15} /> {formatShowing(session.starts_at, session.venue.timezone, { timeStyle: 'short' })} · 30 minutes</span>
            <span><MapPin size={15} /> {session.venue.name}, {session.venue.city}</span>
            {session.ticketTypes[0] && <strong>{formatKobo(session.ticketTypes[0].price_kobo)} per person</strong>}
            {session.isBookable && <Link to={`/sessions/${session.id}`}><CalendarDays size={16} /> Book this session</Link>}
          </article>)}
          {loading && <p className="programme-feedback">Loading upcoming sessions…</p>}
          {!loading && !error && sessions.length === 0 && <p className="programme-feedback">New sessions are coming soon.</p>}
          {error && <p className="programme-feedback" role="status">Session times are temporarily unavailable.</p>}
        </div>

        <div className="ticket-preview__promise">
          <span><BadgeCheck size={18} /> Instant booking confirmation</span>
          <span><BadgeCheck size={18} /> Secure Paystack checkout</span>
          <span><BadgeCheck size={18} /> Reception-ready QR code</span>
        </div>
      </div>
    </section>
  );
};

export default MovieSneakPeek;
