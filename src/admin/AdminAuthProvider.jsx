import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { AdminAuthContext } from './auth-context';
import { clearUserDrafts } from './drafts';

export default function AdminAuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, session: null, profile: null, error: '' });

  useEffect(() => {
    if (!supabase) {
      setState({ loading: false, session: null, profile: null,
        error: 'Supabase is not configured. Add the VITE_SUPABASE_URL and publishable key.' });
      return undefined;
    }
    let active = true;
    let requestId = 0;
    async function refresh(session) {
      const currentRequest = ++requestId;
      if (!session) {
        if (active) setState({ loading: false, session: null, profile: null, error: '' });
        return;
      }
      const { data, error } = await supabase.from('profiles')
        .select('id,full_name,role').eq('id', session.user.id).maybeSingle();
      if (active && currentRequest === requestId) setState({ loading: false, session, profile: data,
        error: error?.message || (!data ? 'Your account has no profile. Contact an admin.' : '') });
    }
    supabase.auth.getSession().then(({ data, error }) => {
      if (error && active) setState((current) => ({ ...current, loading: false, error: error.message }));
      else refresh(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => { if (active) refresh(session); }, 0);
    });
    const onFocus = () => { supabase.auth.getSession().then(({ data }) => refresh(data.session)); };
    window.addEventListener('focus', onFocus);
    return () => { active = false; listener.subscription.unsubscribe(); window.removeEventListener('focus', onFocus); };
  }, []);

  const value = useMemo(() => ({ ...state,
    signIn: async (email, password) => {
      if (!supabase) throw new Error('Supabase is not configured');
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    signOut: async () => {
      if (!supabase) return;
      await supabase.auth.signOut();
      if (state.session?.user.id) clearUserDrafts(state.session.user.id);
    },
  }), [state]);
  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}
