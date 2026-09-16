import React from 'react';
import { ArrowRight, BadgeCheck, Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';
import useMovieProgramme from '../hooks/useMovieProgramme';
import MovieCard from './MovieCard';
import './ticketing.css';

const MovieSneakPeek = () => {
  const { movies, loading, error } = useMovieProgramme();
  return (
    <section className="ticket-preview scroll-element" id="ticket-preview" aria-labelledby="ticket-preview-title">
      <div className="ticket-preview__glow ticket-preview__glow--one" />
      <div className="ticket-preview__glow ticket-preview__glow--two" />
      <div className="ticket-shell ticket-preview__inner">
        <div className="ticket-preview__intro">
          <div>
            <p className="ticket-kicker"><Ticket size={16} /> Your next movie night</p>
            <h2 id="ticket-preview-title">The big screen is calling.</h2>
          </div>
          <div className="ticket-preview__copy">
            <p>
              Browse upcoming screenings, choose your night and book in minutes.
              Your digital ticket arrives ready for the gate.
            </p>
            <Link to="/movies" className="ticket-text-link">
              Explore all movies <ArrowRight size={18} />
            </Link>
          </div>
        </div>

        <div className="ticket-preview__grid">
          {movies.slice(0, 3).map((movie) => (
            <MovieCard movie={movie} compact key={movie.slug} />
          ))}
          {loading && <p className="programme-feedback">Loading upcoming films…</p>}
          {!loading && !error && movies.length === 0 && <p className="programme-feedback">New screenings are coming soon.</p>}
          {error && <p className="programme-feedback" role="status">Movie listings are temporarily unavailable.</p>}
        </div>

        <div className="ticket-preview__promise">
          <span><BadgeCheck size={18} /> Instant digital tickets</span>
          <span><BadgeCheck size={18} /> Secure Paystack checkout</span>
          <span><BadgeCheck size={18} /> Easy gate check-in</span>
        </div>
      </div>
    </section>
  );
};

export default MovieSneakPeek;
