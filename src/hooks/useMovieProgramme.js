import { useEffect, useState } from 'react';
import { loadMovieProgramme } from '../lib/catalog';

export default function useMovieProgramme() {
  const [state, setState] = useState({ movies: [], loading: true, error: '' });

  useEffect(() => {
    let active = true;
    let refreshTimer;

    const refresh = async () => {
      try {
        const movies = await loadMovieProgramme();
        if (!active) return;
        setState({ movies, loading: false, error: '' });

        const nextOpening = Math.min(...movies.flatMap((movie) =>
          movie.upcomingScreenings.map((screening) => new Date(screening.sales_start).getTime())));
        refreshTimer = window.setTimeout(refresh,
          Number.isFinite(nextOpening)
            ? Math.min(Math.max(nextOpening - Date.now() + 1500, 1500), 60_000)
            : 60_000);
      } catch (error) {
        if (active) setState({ movies: [], loading: false, error: error.message });
      }
    };

    refresh();
    return () => {
      active = false;
      window.clearTimeout(refreshTimer);
    };
  }, []);

  return state;
}
