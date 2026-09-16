begin;

insert into public.movies(slug,title,synopsis,status)
values
  ('rls-published','Published Film','Test','published'),
  ('rls-draft','Private Film','Test','draft');

insert into public.venues(name,address,city,country)
values ('RLS Venue','1 Test Road','Lagos','Nigeria');

insert into public.screenings(movie_id,venue_id,starts_at,ends_at,
  sales_start,sales_end,status)
select m.id, v.id, now() + interval '1 day', now() + interval '1 day 2 hours',
  now() - interval '1 day', now() + interval '12 hours', 'on_sale'
from public.movies m cross join public.venues v
where m.slug in ('rls-published','rls-draft') and v.name = 'RLS Venue';

set local role anon;

do $$
begin
  if (select count(*) from public.movies
      where slug in ('rls-published','rls-draft')) <> 1 then
    raise exception 'Anon movie RLS exposed a draft or hid a published movie';
  end if;
  if (select count(*) from public.screenings s
      join public.movies m on m.id = s.movie_id
      where m.slug in ('rls-published','rls-draft')) <> 1 then
    raise exception 'Anon screening RLS exposed a draft screening';
  end if;
  if has_function_privilege('anon',
      'public.verify_ticket_staff(uuid,uuid)', 'EXECUTE') then
    raise exception 'Anon could execute the staff gate RPC';
  end if;
  if has_table_privilege('anon','public.tickets','SELECT') then
    raise exception 'Anon could read raw ticket rows';
  end if;
end;
$$;

rollback;
