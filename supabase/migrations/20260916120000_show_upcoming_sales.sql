-- Publicly preview scheduled screenings before sales open. Ticket tiers remain
-- hidden by their separate policy, and create_pending_order enforces the window.
drop policy if exists "visitors read on-sale screenings" on public.screenings;

create policy "visitors read on-sale screenings"
on public.screenings for select to anon, authenticated
using (
  status = 'on_sale'
  and starts_at > now()
  and sales_end > now()
  and exists (
    select 1 from public.movies m
    where m.id = movie_id and m.status = 'published'
  )
  and exists (
    select 1 from public.venues v
    where v.id = venue_id and v.is_active
  )
);
