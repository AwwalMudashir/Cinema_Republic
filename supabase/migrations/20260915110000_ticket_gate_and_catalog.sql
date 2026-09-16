-- Public catalogue reads stay within RLS. Orders and admissions never become
-- directly writable from a browser.
create policy "visitors read published movies"
on public.movies for select to anon, authenticated
using (status = 'published');

create policy "catalogue team reads all movies"
on public.movies for select to authenticated
using (public.can_manage_catalog());

create policy "catalogue team adds movies"
on public.movies for insert to authenticated
with check (public.can_manage_catalog());

create policy "catalogue team edits movies"
on public.movies for update to authenticated
using (public.can_manage_catalog())
with check (public.can_manage_catalog());

create policy "visitors read active venues"
on public.venues for select to anon, authenticated
using (is_active);

create policy "catalogue team reads all venues"
on public.venues for select to authenticated
using (public.can_manage_catalog());

create policy "catalogue team adds venues"
on public.venues for insert to authenticated
with check (public.can_manage_catalog());

create policy "catalogue team edits venues"
on public.venues for update to authenticated
using (public.can_manage_catalog())
with check (public.can_manage_catalog());

create policy "visitors read on-sale screenings"
on public.screenings for select to anon, authenticated
using (
  status = 'on_sale'
  and starts_at > now()
  and sales_start <= now()
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

create policy "catalogue team reads all screenings"
on public.screenings for select to authenticated
using (public.can_manage_catalog());

create policy "catalogue team adds screenings"
on public.screenings for insert to authenticated
with check (public.can_manage_catalog());

create policy "catalogue team edits screenings"
on public.screenings for update to authenticated
using (public.can_manage_catalog())
with check (public.can_manage_catalog());

create policy "visitors read active ticket types"
on public.ticket_types for select to anon, authenticated
using (
  is_active
  and exists (
    select 1 from public.screenings s
    where s.id = screening_id
      and s.status = 'on_sale'
      and s.starts_at > now()
      and s.sales_start <= now()
      and s.sales_end > now()
  )
);

create policy "catalogue team reads all ticket types"
on public.ticket_types for select to authenticated
using (public.can_manage_catalog());

create policy "catalogue team adds ticket types"
on public.ticket_types for insert to authenticated
with check (public.can_manage_catalog());

create policy "catalogue team edits ticket types"
on public.ticket_types for update to authenticated
using (public.can_manage_catalog())
with check (public.can_manage_catalog());

create policy "users read their own profile"
on public.profiles for select to authenticated
using (id = auth.uid());

-- Default grants vary by project. Limit browser grants explicitly as well as
-- relying on RLS; server-only tables have no browser mutation path.
revoke all on public.movies, public.venues, public.screenings,
  public.ticket_types from anon, authenticated;
grant select on public.movies, public.venues, public.screenings,
  public.ticket_types to anon, authenticated;
grant insert, update on public.movies, public.venues, public.screenings,
  public.ticket_types to authenticated;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
revoke all on public.payments, public.webhook_events,
  public.email_deliveries, public.tickets,
  public.orders, public.order_items from anon, authenticated;

create table public.ticket_gate_audit_log (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid not null references auth.users(id) on delete restrict,
  ticket_public_id uuid not null,
  action text not null check (action in ('verify', 'redeem')),
  result text not null,
  created_at timestamptz not null default now()
);

create index ticket_gate_audit_staff_time_idx
on public.ticket_gate_audit_log (staff_user_id, created_at desc);
create index ticket_gate_audit_ticket_time_idx
on public.ticket_gate_audit_log (ticket_public_id, created_at desc);
alter table public.ticket_gate_audit_log enable row level security;
revoke all on public.ticket_gate_audit_log from anon, authenticated;

-- Only service_role may call the gate RPCs. The RPCs also re-check the staff
-- role inside the same database transaction as the ticket operation.
create or replace function public.ticket_gate_details(p_public_id uuid)
returns jsonb language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'ticket', jsonb_build_object(
      'id', t.public_id,
      'type', tt.name,
      'holder_name', t.holder_name,
      'status', t.status,
      'is_active', t.is_active,
      'valid_from', t.valid_from,
      'valid_until', t.valid_until,
      'checked_in_at', t.checked_in_at
    ),
    'movie', jsonb_build_object(
      'title', m.title,
      'poster_path', m.poster_path,
      'rating', m.rating,
      'runtime_minutes', m.runtime_minutes
    ),
    'screening', jsonb_build_object(
      'starts_at', s.starts_at,
      'ends_at', s.ends_at,
      'venue', v.name,
      'venue_address', v.address,
      'venue_city', v.city,
      'venue_timezone', v.timezone
    )
  )
  from public.tickets t
  join public.orders o on o.id = t.order_id
  join public.screenings s on s.id = t.screening_id
  join public.movies m on m.id = s.movie_id
  join public.venues v on v.id = s.venue_id
  join public.ticket_types tt on tt.id = t.ticket_type_id
  where t.public_id = p_public_id;
$$;

create or replace function public.ticket_gate_reason(
  p_ticket public.tickets,
  p_order_status public.order_status,
  p_screening_status public.screening_status,
  p_at timestamptz
)
returns text language plpgsql immutable security definer
set search_path = public, pg_temp
as $$
begin
  if p_ticket.status = 'refunded' or p_order_status = 'refunded' then
    return 'refunded';
  end if;
  if p_ticket.status = 'cancelled' or p_order_status = 'cancelled'
    or p_screening_status = 'cancelled' then
    return 'cancelled';
  end if;
  if p_order_status <> 'paid' then
    return 'order_not_paid';
  end if;
  if p_ticket.status = 'used' or p_ticket.checked_in_at is not null then
    return 'already_used';
  end if;
  if p_ticket.status = 'expired' or p_at >= p_ticket.valid_until then
    return 'expired';
  end if;
  if not p_ticket.is_active or p_ticket.status <> 'valid' then
    return 'inactive';
  end if;
  if p_at < p_ticket.valid_from then
    return 'not_yet_valid';
  end if;
  return 'valid';
end;
$$;

create or replace function public.verify_ticket_staff(
  p_public_id uuid, p_staff_user_id uuid
)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_ticket public.tickets%rowtype;
  v_order_status public.order_status;
  v_screening_status public.screening_status;
  v_reason text;
  v_now timestamptz := clock_timestamp();
  v_details jsonb;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_staff_user_id and role in ('check_in_staff', 'admin')
  ) then
    raise exception 'CHECK_IN_FORBIDDEN';
  end if;

  select * into v_ticket from public.tickets
  where public_id = p_public_id for update;

  if not found then
    v_reason := 'not_found';
  else
    select o.status, s.status into v_order_status, v_screening_status
    from public.orders o
    join public.screenings s on s.id = v_ticket.screening_id
    where o.id = v_ticket.order_id;

    v_reason := public.ticket_gate_reason(
      v_ticket, v_order_status, v_screening_status, v_now
    );
    if v_reason = 'expired' and v_ticket.status = 'valid' then
      update public.tickets set status = 'expired', is_active = false
      where id = v_ticket.id;
    end if;
    v_details := public.ticket_gate_details(p_public_id);
  end if;

  insert into public.ticket_gate_audit_log (
    staff_user_id, ticket_public_id, action, result
  ) values (p_staff_user_id, p_public_id, 'verify', v_reason);

  return jsonb_build_object('valid', v_reason = 'valid', 'reason', v_reason)
    || coalesce(v_details, '{}'::jsonb);
end;
$$;

create or replace function public.redeem_ticket_staff(
  p_public_id uuid, p_staff_user_id uuid
)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_ticket public.tickets%rowtype;
  v_order_status public.order_status;
  v_screening_status public.screening_status;
  v_reason text;
  v_now timestamptz := clock_timestamp();
  v_details jsonb;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_staff_user_id and role in ('check_in_staff', 'admin')
  ) then
    raise exception 'CHECK_IN_FORBIDDEN';
  end if;

  select * into v_ticket from public.tickets
  where public_id = p_public_id for update;

  if not found then
    v_reason := 'not_found';
  else
    select o.status, s.status into v_order_status, v_screening_status
    from public.orders o
    join public.screenings s on s.id = v_ticket.screening_id
    where o.id = v_ticket.order_id;

    v_reason := public.ticket_gate_reason(
      v_ticket, v_order_status, v_screening_status, v_now
    );
    if v_reason = 'valid' then
      update public.tickets
      set status = 'used', is_active = false,
        checked_in_at = v_now, checked_in_by = p_staff_user_id
      where id = v_ticket.id and status = 'valid' and is_active
        and checked_in_at is null
        and valid_from <= v_now and valid_until > v_now
      returning * into v_ticket;
      if found then
        v_reason := 'redeemed';
      else
        v_reason := 'already_used';
      end if;
    elsif v_reason = 'expired' and v_ticket.status = 'valid' then
      update public.tickets set status = 'expired', is_active = false
      where id = v_ticket.id;
    end if;
    v_details := public.ticket_gate_details(p_public_id);
  end if;

  insert into public.ticket_gate_audit_log (
    staff_user_id, ticket_public_id, action, result
  ) values (p_staff_user_id, p_public_id, 'redeem', v_reason);

  return jsonb_build_object(
    'redeemed', v_reason = 'redeemed',
    'valid', v_reason = 'redeemed',
    'reason', v_reason
  ) || coalesce(v_details, '{}'::jsonb);
end;
$$;

-- Public ticket links reveal no holder, order, or payment information. The
-- public UUID is an opaque capability; requests are rate-limited at the Edge.
create or replace function public.get_public_ticket_details(p_public_id uuid)
returns jsonb language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'ticket', jsonb_build_object(
      'id', t.public_id,
      'type', tt.name,
      'status', case
        when o.status = 'refunded' or t.status = 'refunded' then 'refunded'
        when o.status = 'cancelled' or s.status = 'cancelled'
          or t.status = 'cancelled' then 'cancelled'
        when t.status = 'used' then 'used'
        when now() >= t.valid_until then 'expired'
        when not t.is_active then 'inactive'
        when now() < t.valid_from then 'not_yet_valid'
        else t.status::text
      end,
      'valid_from', t.valid_from,
      'valid_until', t.valid_until,
      'checked_in_at', t.checked_in_at
    ),
    'movie', jsonb_build_object(
      'title', m.title,
      'poster_path', m.poster_path,
      'rating', m.rating,
      'runtime_minutes', m.runtime_minutes
    ),
    'screening', jsonb_build_object(
      'starts_at', s.starts_at,
      'ends_at', s.ends_at,
      'venue', v.name,
      'venue_address', v.address,
      'venue_city', v.city,
      'venue_timezone', v.timezone
    )
  )
  from public.tickets t
  join public.orders o on o.id = t.order_id
  join public.screenings s on s.id = t.screening_id
  join public.movies m on m.id = s.movie_id
  join public.venues v on v.id = s.venue_id
  join public.ticket_types tt on tt.id = t.ticket_type_id
  where t.public_id = p_public_id
    and o.status in ('paid', 'refunded', 'cancelled');
$$;

create or replace function public.sync_order_ticket_status()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'refunded' and old.status is distinct from new.status then
    update public.tickets set status = 'refunded', is_active = false
    where order_id = new.id and status <> 'refunded';
  elsif new.status = 'cancelled' and old.status is distinct from new.status then
    update public.tickets set status = 'cancelled', is_active = false
    where order_id = new.id and status = 'valid';
  end if;
  return new;
end;
$$;

create trigger sync_order_ticket_status
after update of status on public.orders
for each row execute function public.sync_order_ticket_status();

create or replace function public.sync_screening_ticket_status()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from new.status then
    update public.tickets set status = 'cancelled', is_active = false
    where screening_id = new.id and status = 'valid';
  end if;
  return new;
end;
$$;

create trigger sync_screening_ticket_status
after update of status on public.screenings
for each row execute function public.sync_screening_ticket_status();

create or replace function public.expire_old_tickets()
returns void language sql security definer
set search_path = public, pg_temp
as $$
  update public.tickets set status = 'expired', is_active = false
  where status = 'valid' and valid_until <= now();
$$;

revoke all on function public.ticket_gate_details(uuid) from public, anon, authenticated;
revoke all on function public.ticket_gate_reason(
  public.tickets, public.order_status, public.screening_status, timestamptz
) from public, anon, authenticated;
revoke all on function public.verify_ticket_staff(uuid, uuid) from public, anon, authenticated;
revoke all on function public.redeem_ticket_staff(uuid, uuid) from public, anon, authenticated;
revoke all on function public.get_public_ticket_details(uuid) from public, anon, authenticated;
revoke all on function public.expire_old_tickets() from public, anon, authenticated;
revoke all on function public.sync_order_ticket_status() from public, anon, authenticated;
revoke all on function public.sync_screening_ticket_status() from public, anon, authenticated;

grant execute on function public.ticket_gate_details(uuid) to service_role;
grant execute on function public.ticket_gate_reason(
  public.tickets, public.order_status, public.screening_status, timestamptz
) to service_role;
grant execute on function public.verify_ticket_staff(uuid, uuid) to service_role;
grant execute on function public.redeem_ticket_staff(uuid, uuid) to service_role;
grant execute on function public.get_public_ticket_details(uuid) to service_role;
