import { useEffect, useState } from 'react';
import { loadSessionProgramme } from '../lib/catalog';

export default function useSessionProgramme() {
  const [state, setState] = useState({ sessions: [], loading: true, error: '' });

  useEffect(() => {
    let active = true;
    let refreshTimer;

    const refresh = async () => {
      try {
        const sessions = await loadSessionProgramme();
        if (!active) return;
        setState({ sessions, loading: false, error: '' });
        const nextOpening = Math.min(...sessions.filter((session) => session.isComingSoon)
          .map((session) => new Date(session.sales_start).getTime()));
        refreshTimer = window.setTimeout(refresh, Number.isFinite(nextOpening)
          ? Math.min(Math.max(nextOpening - Date.now() + 1500, 1500), 60_000)
          : 60_000);
      } catch (error) {
        if (active) setState({ sessions: [], loading: false, error: error.message });
      }
    };

    refresh();
    return () => { active = false; window.clearTimeout(refreshTimer); };
  }, []);

  return state;
}
