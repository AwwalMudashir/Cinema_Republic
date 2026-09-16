-- A screening is sold out only when every active tier has zero unsold places.
-- Pending checkout holds are intentionally excluded from the persisted status:
-- they expire and should not permanently close sales. The public inventory
-- function below does include live holds, so checkout availability stays honest.
create index if not exists order_items_ticket_type_id_idx
on public.order_items(ticket_type_id);

create or replace function public.sync_screening_sold_out_status()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_changed integer;
begin
  with inventory as (
    select s.id,
      exists (
        select 1
        from public.ticket_types tt
        where tt.screening_id = s.id
          and tt.is_active
          and tt.capacity > coalesce((
            select sum(oi.quantity)
            from public.order_items oi
            join public.orders o on o.id = oi.order_id
            where oi.ticket_type_id = tt.id and o.status = 'paid'
          ), 0)
      ) as has_unsold_places
    from public.screenings s
    where s.status in ('on_sale', 'sold_out')
      and s.sales_end > now()
      and s.starts_at > now()
  )
  update public.screenings s
  set status = case when i.has_unsold_places then 'on_sale'::public.screening_status
                    else 'sold_out'::public.screening_status end,
      updated_at = now()
  from inventory i
  where s.id = i.id
    and ((s.status = 'on_sale' and not i.has_unsold_places)
      or (s.status = 'sold_out' and i.has_unsold_places));

  get diagnostics v_changed = row_count;
  return v_changed;
end;
$$;

revoke all on function public.sync_screening_sold_out_status()
from public, anon, authenticated;

-- Expose only the remaining count for public, sale-open tiers. Raw orders stay
-- private. Include unexpired pending holds so the UI does not promise a place
-- that another customer is currently checking out with.
create or replace function public.public_ticket_availability()
returns table(ticket_type_id uuid, remaining integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select tt.id,
    greatest(0, tt.capacity - coalesce((
      select sum(oi.quantity)::integer
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.ticket_type_id = tt.id
        and (o.status = 'paid'
          or (o.status = 'pending' and o.expires_at > now()))
    ), 0))::integer
  from public.ticket_types tt
  join public.screenings s on s.id = tt.screening_id
  join public.movies m on m.id = s.movie_id
  join public.venues v on v.id = s.venue_id
  where tt.is_active
    and s.status in ('on_sale', 'sold_out')
    and s.sales_start <= now()
    and s.sales_end > now()
    and s.starts_at > now()
    and m.status = 'published'
    and v.is_active;
$$;

revoke all on function public.public_ticket_availability()
from public, anon, authenticated;
grant execute on function public.public_ticket_availability()
to anon, authenticated;

-- Sold-out screenings must remain visible on the public programme.
drop policy if exists "visitors read on-sale screenings" on public.screenings;
create policy "visitors read on-sale screenings"
on public.screenings for select to anon, authenticated
using (
  status in ('on_sale', 'sold_out')
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

drop policy if exists "visitors read active ticket types" on public.ticket_types;
create policy "visitors read active ticket types"
on public.ticket_types for select to anon, authenticated
using (
  is_active
  and exists (
    select 1 from public.screenings s
    where s.id = screening_id
      and s.status in ('on_sale', 'sold_out')
      and s.starts_at > now()
      and s.sales_start <= now()
      and s.sales_end > now()
  )
);

-- Bring existing rows up to date immediately. If Cron is already enabled,
-- install the recurring job too; otherwise enable Cron and add it in Dashboard.
select public.sync_screening_sold_out_status();

do $$
begin
  if to_regprocedure('cron.schedule(text,text,text)') is not null then
    begin
      execute 'select cron.schedule(''sync-screening-inventory'', ''* * * * *'', ''select public.sync_screening_sold_out_status();'')';
    exception when others then
      raise warning 'Could not schedule sync-screening-inventory: %', sqlerrm;
    end;
  else
    raise notice 'Supabase Cron is not enabled; schedule sync-screening-inventory after enabling it.';
  end if;
end;
$$;
