import { supabase } from './supabase';

export const formatNaira = (amount) => new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
}).format(amount);

export const formatKobo = (amountKobo) => formatNaira(Number(amountKobo) / 100);

export function formatShowing(value, timeZone = 'Africa/Lagos', options = {}) {
  return new Intl.DateTimeFormat('en-NG', {
    timeZone,
    ...options,
  }).format(new Date(value));
}

export function posterUrl(path) {
  if (!path || !supabase) return '/og_cultural.jpeg';
  return supabase.storage.from('movie-posters').getPublicUrl(path).data.publicUrl;
}

export async function loadMovieProgramme() {
  if (!supabase) throw new Error('Movie booking is not configured yet. Add the Supabase site variables.');

  const { data, error } = await supabase
    .from('screenings')
    .select(`
      id, starts_at, ends_at, sales_end,
      movie:movies!inner(id, slug, title, tagline, synopsis, poster_path,
        backdrop_path, genre, rating, language, runtime_minutes, featured),
      venue:venues!inner(name, address, city, country, timezone),
      ticket_types(id, name, description, price_kobo, capacity, is_active)
    `)
    .eq('status', 'on_sale')
    .eq('movie.status', 'published')
    .eq('venue.is_active', true)
    .lte('sales_start', new Date().toISOString())
    .gt('sales_end', new Date().toISOString())
    .gt('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true });
  if (error) throw new Error(`Could not load screenings: ${error.message}`);

  const byMovie = new Map();
  for (const row of data ?? []) {
    if (!row.movie || !row.venue) continue;
    const movie = row.movie;
    const screening = {
      id: row.id,
      starts_at: row.starts_at,
      ends_at: row.ends_at,
      sales_end: row.sales_end,
      venue: row.venue,
      ticketTypes: (row.ticket_types ?? [])
        .filter((type) => type.is_active)
        .sort((a, b) => Number(a.price_kobo) - Number(b.price_kobo)),
    };
    if (!byMovie.has(movie.id)) {
      byMovie.set(movie.id, {
        ...movie,
        image: posterUrl(movie.poster_path),
        backdrop: posterUrl(movie.backdrop_path || movie.poster_path),
        screenings: [],
      });
    }
    byMovie.get(movie.id).screenings.push(screening);
  }
  return [...byMovie.values()].sort((a, b) =>
    new Date(a.screenings[0].starts_at) - new Date(b.screenings[0].starts_at));
}

export async function invokeFunction(name, body) {
  if (!supabase) throw new Error('Supabase is not configured on this site.');
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let message = error.message;
    if (error.context instanceof Response) {
      const response = await error.context.json().catch(() => null);
      message = response?.message || message;
    }
    throw new Error(message);
  }
  return data;
}
