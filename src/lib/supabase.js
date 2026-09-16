import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// The site still renders a clear setup message when deployment variables have
// not yet been configured, instead of crashing during module initialization.
export const supabase = url && publishableKey
  ? createClient(url, publishableKey, {
    // Auth invitation/recovery links return to /admin/login with a session in
    // the URL. Supabase must consume it before the admin password form loads.
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
  })
  : null;

export const supabaseConfigured = Boolean(supabase);
