import { supabase } from '../lib/supabase';

export async function adminFunction(name, body) {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (!error) return data;
  if (error.context instanceof Response) {
    const details = await error.context.json().catch(() => null);
    throw new Error(details?.message || error.message);
  }
  throw error;
}
