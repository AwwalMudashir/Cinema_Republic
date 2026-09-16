import React from 'react';
import { ArrowUpRight, CalendarDays, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatShowing } from '../lib/catalog';

const MovieCard = ({ movie, compact = false }) => {
  const showing = movie.screenings[0];
  const zone = showing?.venue.timezone || 'Africa/Lagos';
  return (
    <article className={`movie-card ${compact ? 'movie-card--compact' : ''}`}>
      <div className="movie-card__art">
        <img src={movie.image} alt={`${movie.title} screening artwork`} />
        <div className="movie-card__shade" />
        <span className="movie-card__status">On sale</span>
        <span className="movie-card__rating">{movie.rating}</span>
      </div>

      <div className="movie-card__body">
        <p className="movie-card__eyebrow">{movie.genre}</p>
        <h3>{movie.title}</h3>
        <p className="movie-card__tagline">{movie.tagline}</p>

        <div className="movie-card__meta">
          <span><CalendarDays size={15} /> {formatShowing(showing.starts_at, zone, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          <span><Clock3 size={15} /> {movie.runtime_minutes ? `${movie.runtime_minutes} min` : 'Movie night'}</span>
        </div>

        <Link className="movie-card__link" to={`/movies/${movie.slug}`}>
          Get tickets <ArrowUpRight size={17} />
        </Link>
      </div>
    </article>
  );
};

export default MovieCard;
