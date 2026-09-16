-- Optional catalogue starter, checked 15 September 2026.
-- Run manually in the Supabase SQL Editor after the schema migrations are pushed.
-- This is NOT a migration and does NOT create a venue, showtime, or sellable ticket.
-- These titles were showing at Nigerian cinemas, not confirmed Cinema Republic events.
-- Keep them in draft until Cinema Republic confirms screening rights, approved artwork,
-- official descriptions, prices, venue, and showtimes.
-- Sources:
-- https://silverbirdcinemas.com/cinema/ikeja/
-- https://silverbirdcinemas.com/genre/nollywood/
-- https://19themovie.com/
-- https://www.tntheatrical.com/post/first-look-kalu-ikeagwu-returns-to-the-big-screen-in-thriller-invitation-to-kill-in-cinemas-sep
-- https://von.gov.ng/properties-of-the-gods-set-for-nationwide-premiere/

insert into public.movies (
  id, slug, title, tagline, synopsis, poster_path, genre,
  rating, language, runtime_minutes, status, featured
) values
  (
    'a0241e52-5531-4334-b55d-40c46cf2808f', '19-2026', '19',
    'A brilliant mind. A broken system.',
    'Raised amid hardship in Lagos, Ndubuisi Madueke sees technology as a path to a better life. His talent takes a darker turn as he is drawn into cybercrime.',
    'movies/a0241e52-5531-4334-b55d-40c46cf2808f/poster.webp',
    'Crime, Drama', '15', 'English', 120, 'draft', false
  ),
  (
    'fe018f34-97ef-4a3f-ba74-69e94cebaff6', 'one-gidi-night', 'One Gidi Night',
    'One night can change everything.',
    'A tense drama unfolds over one night in Lagos as desperation pushes an ordinary man toward a choice he cannot take back.',
    'movies/fe018f34-97ef-4a3f-ba74-69e94cebaff6/poster.webp',
    'Drama, Thriller', '15', 'English', 95, 'draft', false
  ),
  (
    '7a31a084-e457-486d-9328-4b19384a82a3', 'invitation-to-kill', 'Invitation To Kill',
    'Loss and betrayal leave their mark.',
    'After his business and marriage collapse, a devoted father tries to rebuild his life. A new relationship offers hope, but unresolved pain threatens his fresh start.',
    'movies/7a31a084-e457-486d-9328-4b19384a82a3/poster.webp',
    'Drama, Thriller', '15', 'English', 115, 'draft', false
  ),
  (
    '7c92d330-79fb-40ff-9249-6c76b071ab46', 'properties-of-the-gods', 'Properties of the Gods',
    'A story about belonging and exclusion.',
    'A Nigerian drama confronting the Osu caste system and the social exclusion it has perpetuated in Igboland.',
    'movies/7c92d330-79fb-40ff-9249-6c76b071ab46/poster.webp',
    'Drama', '12A', 'English', 120, 'draft', false
  ),
  (
    'c3cc1cd8-7014-4738-adae-8c5bdb7b73dd', 'king-kosoko-battle-for-lagos',
    'King Kosoko: The Battle For Lagos', 'The struggle for a kingdom.',
    'A historical drama following Prince Kosoko and the struggle for power in Lagos after the death of his father, Esinlokun.',
    'movies/c3cc1cd8-7014-4738-adae-8c5bdb7b73dd/poster.webp',
    'Historical Drama', 'TBC', 'Yoruba', 133, 'draft', false
  )
on conflict (slug) do nothing;

-- Price planning only; the actual price belongs in ticket_types.price_kobo,
-- per screening, not in movies. Suggested open-air starting points:
-- General admission: N8,000 -> price_kobo = 800000
-- Premium lounger:  N12,000 -> price_kobo = 1200000
-- Family/discount tiers need an agreed inclusion and capacity policy.
-- These are estimates, not Cinema Republic's approved prices.
-- Do not create on_sale screenings with invented venue/date/capacity values.
