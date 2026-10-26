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
            <p className="ticket-kicker"><Ticket size={16} /> HyperView 9D sessions</p>
            <h2 id="ticket-preview-title">Choose when you want to fly.</h2>
          </div>
          <div className="ticket-preview__copy">
            <p>
              Choose an available experience, date and session time. Pay securely
              and receive one booking confirmation for your party.
            </p>
            <Link to="/movies" className="ticket-text-link">
              Browse available sessions <ArrowRight size={18} />
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
          <span><BadgeCheck size={18} /> Instant booking confirmation</span>
          <span><BadgeCheck size={18} /> Secure Paystack checkout</span>
          <span><BadgeCheck size={18} /> Reception-ready QR code</span>
        </div>
      </div>
    </section>
  );
};

export default MovieSneakPeek;
