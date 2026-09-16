import { useEffect, useState } from 'react';
import { loadMovieProgramme } from '../lib/catalog';

export default function useMovieProgramme() {
  const [state, setState] = useState({ movies: [], loading: true, error: '' });

  useEffect(() => {
    let active = true;
    loadMovieProgramme()
      .then((movies) => {
        if (active) setState({ movies, loading: false, error: '' });
      })
      .catch((error) => {
        if (active) setState({ movies: [], loading: false, error: error.message });
      });
    return () => { active = false; };
  }, []);

  return state;
}
