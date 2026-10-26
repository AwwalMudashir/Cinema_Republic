import React, { useMemo, useState } from 'react';
import { ArrowDown, CalendarCheck2, MapPin, ShieldCheck, Sparkles, TicketCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import MovieCard from '../components/MovieCard';
import '../components/ticketing.css';
import useMovieProgramme from '../hooks/useMovieProgramme';
import { formatShowing } from '../lib/catalog';

const filters = ['All screenings', 'This week', 'Family', 'Date night'];

const Movies = () => {
  const [activeFilter, setActiveFilter] = useState(filters[0]);
  const { movies, loading, error } = useMovieProgramme();

  const visibleMovies = useMemo(() => {
    if (activeFilter === 'Family') return movies.filter((movie) => /family|animation/iu.test(movie.genre || ''));
    if (activeFilter === 'Date night') return movies.filter((movie) => /romance|comedy/iu.test(movie.genre || ''));
    if (activeFilter === 'This week') {
      const until = Date.now() + 7 * 24 * 60 * 60 * 1000;
      return movies.filter((movie) => movie.screenings.some((screening) =>
        new Date(screening.starts_at).getTime() <= until));
    }
    return movies;
  }, [activeFilter, movies]);

  const featuredMovie = movies.find((movie) => movie.featured) || movies[0];
  const featuredShowing = featuredMovie?.primaryScreening;

  return (
    <main className="movies-page">
      <section className="movies-hero">
        {featuredMovie && <img className="movies-hero__image" src={featuredMovie.backdrop} alt="" />}
        <div className="movies-hero__overlay" />
        <div className="ticket-shell movies-hero__content">
          <div className="movies-hero__copy">
            <p className="ticket-kicker"><Sparkles size={16} /> HyperView 9D Flying Cinema</p>
            <h1>Choose your session.<br /><em>Feel the adventure.</em></h1>
            <p className="movies-hero__lede">
              Explore immersive 9D experiences, choose an available date and time,
              and secure every place in your party before you arrive.
            </p>
            <div className="movies-hero__actions">
              <a href="#now-showing" className="ticket-button ticket-button--primary">
                See available sessions <ArrowDown size={18} />
              </a>
              {featuredMovie && <Link to={`/movies/${featuredMovie.slug}`} className="ticket-button ticket-button--glass">{featuredMovie.isBookable ? 'Book this experience' : 'View experience'}</Link>}
            </div>
          </div>

          {featuredMovie && <aside className="movies-hero__showcard" aria-label="Featured screening">
            <p>{featuredMovie.isBookable ? 'Featured experience' : featuredMovie.isComingSoon ? 'Coming soon' : 'Sold out'}</p>
            <h2>{featuredMovie.title}</h2>
            <div><CalendarCheck2 size={18} /> {formatShowing(featuredShowing.starts_at, featuredShowing.venue.timezone, { dateStyle: 'full', timeStyle: 'short' })}</div>
            <div><MapPin size={18} /> {featuredShowing.venue.name}, {featuredShowing.venue.city}</div>
            <Link to={`/movies/${featuredMovie.slug}`}>{featuredMovie.isBookable ? 'Reserve a session' : featuredMovie.isComingSoon ? 'See when sales open' : 'View session'}</Link>
          </aside>}
        </div>
      </section>

      <section className="movie-programme" id="now-showing" aria-labelledby="programme-title">
        <div className="ticket-shell">
          <div className="movie-programme__header">
            <div>
              <p className="ticket-kicker ticket-kicker--dark">Now at HyperView</p>
              <h2 id="programme-title">Choose your next adventure</h2>
            </div>
            <p>Every booking secures a specific immersive experience, date and session time.</p>
          </div>

          <div className="movie-filters" role="group" aria-label="Filter screenings">
            {filters.map((filter) => (
              <button
                className={activeFilter === filter ? 'active' : ''}
                key={filter}
                onClick={() => setActiveFilter(filter)}
                type="button"
              >
                {filter}
              </button>
            ))}
          </div>

          <div className="movie-programme__grid">
            {visibleMovies.map((movie) => <MovieCard movie={movie} key={movie.slug} />)}
          </div>
          {loading && <p className="programme-feedback" role="status">Loading upcoming screenings…</p>}
          {error && <p className="programme-feedback" role="alert">{error}</p>}
          {!loading && !error && visibleMovies.length === 0 && <p className="programme-feedback">No screenings match this filter right now. Check back soon.</p>}
        </div>
      </section>

      <section className="booking-steps" aria-labelledby="booking-steps-title">
        <div className="ticket-shell">
          <div className="booking-steps__heading">
            <p className="ticket-kicker"><TicketCheck size={16} /> From sofa to screen</p>
            <h2 id="booking-steps-title">Your session in three easy steps.</h2>
          </div>
          <div className="booking-steps__grid">
            <article><span>01</span><h3>Pick a session</h3><p>Choose the experience, date and available time that suits you.</p></article>
            <article><span>02</span><h3>Add your guests</h3><p>Select up to eight places. Weekday or weekend pricing is automatic.</p></article>
            <article><span>03</span><h3>Pay & arrive</h3><p>Pay securely, then arrive 15 minutes early with your booking QR.</p></article>
          </div>
          <div className="booking-steps__note"><ShieldCheck size={20} /> Payments will be securely processed by Paystack.</div>
        </div>
      </section>
    </main>
  );
};

export default Movies;
