-- Flexible HyperView admission passes.
-- New purchases are not tied to a scheduled start time. A pass is redeemable
-- once at any operating session during the purchase-day business band:
-- Monday-Thursday expires at Friday 00:00 Africa/Lagos;
-- Friday-Sunday expires at Monday 00:00 Africa/Lagos.

alter table public.screenings
  add column if not exists sale_mode text not null default 'scheduled'
    check (sale_mode in ('scheduled', 'flex_pass'));

create index if not exists screenings_flex_lookup_idx
on public.screenings(venue_id, sale_mode, session_kind, starts_at, ends_at);

create or replace function public.flex_window_bounds(
  p_at timestamptz default now(), p_timezone text default 'Africa/Lagos'
)
returns table(
  local_date date, band text, window_start timestamptz, window_end timestamptz
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_date date := (p_at at time zone p_timezone)::date;
  v_day integer := extract(isodow from (p_at at time zone p_timezone))::integer;
  v_end_date date;
begin
  if v_day between 1 and 4 then
    band := 'weekday';
    v_end_date := v_date + (5 - v_day);
  else
    band := 'weekend';
    v_end_date := v_date + (8 - v_day);
  end if;
  local_date := v_date;
  window_start := v_date::timestamp at time zone p_timezone;
  window_end := v_end_date::timestamp at time zone p_timezone;
  return next;
end;
$$;

revoke all on function public.flex_window_bounds(timestamptz,text)
from public, anon, authenticated;
grant execute on function public.flex_window_bounds(timestamptz,text) to service_role;

create or replace function public.flex_price_for_venue(
  p_venue_id uuid, p_booking_type text, p_at timestamptz default now()
)
returns bigint language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_timezone text;
  v_local_date date;
  v_day integer;
  v_price bigint;
begin
  if p_booking_type not in ('individual', 'group') then
    raise exception 'INVALID_BOOKING_TYPE';
  end if;
  select timezone into v_timezone from public.venues
  where id = p_venue_id and is_active;
  if not found then raise exception 'VENUE_NOT_ACTIVE'; end if;

  v_local_date := (p_at at time zone v_timezone)::date;
  v_day := extract(isodow from (p_at at time zone v_timezone))::integer;

  select case
    when p_booking_type = 'group' and v_day between 1 and 4 then pr.group_weekday_price_kobo
    when p_booking_type = 'group' then pr.group_weekend_price_kobo
    when v_day between 1 and 4 then pr.weekday_price_kobo
    else pr.weekend_price_kobo
  end into v_price
  from public.pricing_rules pr
  where pr.is_active
    and (pr.venue_id = p_venue_id or pr.venue_id is null)
    and pr.effective_from <= v_local_date
    and (pr.effective_until is null or pr.effective_until >= v_local_date)
  order by (pr.venue_id = p_venue_id) desc, pr.effective_from desc, pr.created_at desc
  limit 1;

  if v_price is null then
    if p_booking_type = 'group' then raise exception 'GROUP_PRICE_NOT_CONFIGURED'; end if;
    raise exception 'PRICE_RULE_NOT_FOUND';
  end if;
  return v_price;
end;
$$;

revoke all on function public.flex_price_for_venue(uuid,text,timestamptz)
from public, anon, authenticated;
grant execute on function public.flex_price_for_venue(uuid,text,timestamptz) to service_role;

create or replace function public.public_flex_pass_products()
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare v_now timestamptz := clock_timestamp();
begin
  return coalesce((select jsonb_agg(jsonb_build_object(
    'venue_id', v.id, 'venue_name', v.name, 'venue_address', v.address,
    'venue_city', v.city, 'venue_timezone', v.timezone,
    'band', wb.band, 'purchase_date', wb.local_date,
    'valid_from', v_now, 'valid_until', wb.window_end,
    'individual_price_kobo', public.flex_price_for_venue(v.id, 'individual', v_now),
    'group_price_kobo', public.flex_price_for_venue(v.id, 'group', v_now)
  ) order by v.name)
  from public.venues v
  cross join lateral public.flex_window_bounds(v_now, v.timezone) wb
  where v.is_active), '[]'::jsonb);
end;
$$;

revoke all on function public.public_flex_pass_products() from public;
grant execute on function public.public_flex_pass_products() to anon, authenticated, service_role;

create or replace function public.enforce_hyperview_session_duration()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.movie_id is null and new.sale_mode = 'scheduled' then
    new.session_kind := coalesce(new.session_kind, 'individual');
    if new.session_kind = 'group' then
      new.session_name := 'HyperView 9D Group Session';
      new.ends_at := new.starts_at + interval '45 minutes';
    else
      new.session_name := 'HyperView 9D Flying Cinema Session';
      new.ends_at := new.starts_at + interval '30 minutes';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_hyperview_session_duration on public.screenings;
create trigger enforce_hyperview_session_duration
before insert or update of starts_at, ends_at, movie_id, session_name, session_kind, sale_mode
on public.screenings for each row execute function public.enforce_hyperview_session_duration();

create or replace function public.prevent_hyperview_session_overlap()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.movie_id is null and new.sale_mode = 'scheduled' and new.status <> 'cancelled' then
    perform pg_advisory_xact_lock(hashtextextended(new.venue_id::text, 0));
    if exists (
      select 1 from public.screenings s
      where s.venue_id = new.venue_id and s.sale_mode = 'scheduled'
        and s.id is distinct from new.id and s.status <> 'cancelled'
        and s.starts_at < new.ends_at and s.ends_at > new.starts_at
    ) then raise exception 'SESSION_TIME_OVERLAP'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_hyperview_session_overlap on public.screenings;
create trigger prevent_hyperview_session_overlap
before insert or update of venue_id, starts_at, ends_at, status, movie_id, sale_mode
on public.screenings for each row execute function public.prevent_hyperview_session_overlap();

create or replace function public.enforce_session_ticket_price()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_kind text; v_mode text;
begin
  select session_kind, sale_mode into v_kind, v_mode from public.screenings
  where id = new.screening_id and movie_id is null;
  if found then
    new.price_kobo := public.session_price_for_screening(new.screening_id);
    if v_mode = 'flex_pass' then
      new.name := case when v_kind = 'group' then '15-person group pass' else 'Flexible admission' end;
      new.description := case when v_kind = 'group'
        then 'One 15-person group visit during the current business-week validity window'
        else 'One admission at any operating session during the current validity window' end;
      new.capacity := greatest(new.capacity, 1000000);
    elsif v_kind = 'group' then
      new.name := 'Group session package';
      new.description := 'Exactly 15 guests, 45 minutes and three staff-selected films';
      new.capacity := 15;
    else
      new.name := 'Session admission';
      new.description := coalesce(nullif(btrim(new.description), ''),
        'One 30-minute session with two staff-selected films');
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.sync_screening_ticket_prices()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  update public.ticket_types
  set price_kobo = public.session_price_for_screening(new.id),
      capacity = case when new.sale_mode = 'flex_pass' then greatest(capacity, 1000000)
        when new.session_kind = 'group' then 15 else capacity end,
      name = case when new.sale_mode = 'flex_pass' and new.session_kind = 'group' then '15-person group pass'
        when new.sale_mode = 'flex_pass' then 'Flexible admission'
        when new.session_kind = 'group' then 'Group session package' else 'Session admission' end,
      description = case when new.sale_mode = 'flex_pass' and new.session_kind = 'group'
        then 'One 15-person group visit during the current business-week validity window'
        when new.sale_mode = 'flex_pass'
        then 'One admission at any operating session during the current validity window'
        when new.session_kind = 'group'
        then 'Exactly 15 guests, 45 minutes and three staff-selected films'
        else coalesce(nullif(btrim(description), ''),
          'One 30-minute session with two staff-selected films') end
  where screening_id = new.id and new.movie_id is null;
  return new;
end;
$$;

drop trigger if exists sync_screening_ticket_prices on public.screenings;
create trigger sync_screening_ticket_prices
after insert or update of starts_at, venue_id, pricing_rule_id, session_kind, sale_mode
on public.screenings for each row execute function public.sync_screening_ticket_prices();

create or replace function public.ensure_flex_inventory(
  p_venue_id uuid, p_booking_type text, p_at timestamptz default now()
)
returns table(screening_id uuid, ticket_type_id uuid, valid_until timestamptz, unit_price_kobo bigint)
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_timezone text;
  v_bounds record;
  v_screening_id uuid;
  v_ticket_type_id uuid;
  v_price bigint;
begin
  if p_booking_type not in ('individual', 'group') then raise exception 'INVALID_BOOKING_TYPE'; end if;
  select timezone into v_timezone from public.venues where id = p_venue_id and is_active;
  if not found then raise exception 'VENUE_NOT_ACTIVE'; end if;
  select * into v_bounds from public.flex_window_bounds(p_at, v_timezone);
  v_price := public.flex_price_for_venue(p_venue_id, p_booking_type, p_at);

  perform pg_advisory_xact_lock(hashtextextended(
    p_venue_id::text || '|' || p_booking_type || '|' || v_bounds.local_date::text, 0
  ));
  select s.id into v_screening_id from public.screenings s
  where s.venue_id = p_venue_id and s.sale_mode = 'flex_pass'
    and s.session_kind = p_booking_type and s.starts_at = v_bounds.window_start
    and s.ends_at = v_bounds.window_end limit 1;

  if v_screening_id is null then
    insert into public.screenings(
      movie_id, session_name, session_kind, sale_mode, venue_id,
      starts_at, ends_at, sales_start, sales_end, status,
      admission_opens_minutes, admission_grace_minutes
    ) values (
      null,
      case when p_booking_type = 'group' then 'Flexible 15-person group admission'
        else 'Flexible HyperView admission' end,
      p_booking_type, 'flex_pass', p_venue_id,
      v_bounds.window_start, v_bounds.window_end,
      v_bounds.window_start, v_bounds.window_end, 'on_sale', 0, 0
    ) returning id into v_screening_id;
  end if;

  select tt.id into v_ticket_type_id from public.ticket_types tt
  where tt.screening_id = v_screening_id limit 1 for update;
  if v_ticket_type_id is null then
    insert into public.ticket_types(screening_id, name, description, price_kobo, capacity, is_active)
    values (
      v_screening_id,
      case when p_booking_type = 'group' then '15-person group pass' else 'Flexible admission' end,
      case when p_booking_type = 'group'
        then 'One 15-person group visit during the current business-week validity window'
        else 'One admission at any operating session during the current validity window' end,
      v_price, 1000000, true
    ) returning id into v_ticket_type_id;
  else
    update public.ticket_types set price_kobo = v_price, is_active = true
    where id = v_ticket_type_id;
  end if;

  return query select v_screening_id, v_ticket_type_id, v_bounds.window_end, v_price;
end;
$$;

revoke all on function public.ensure_flex_inventory(uuid,text,timestamptz)
from public, anon, authenticated;
grant execute on function public.ensure_flex_inventory(uuid,text,timestamptz) to service_role;

create or replace function public.create_hyperview_flex_order(
  p_venue_id uuid,
  p_booking_type text,
  p_quantity integer,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_access_token_hash text,
  p_policy_version text,
  p_policy_accepted_at timestamptz,
  p_user_id uuid default null
)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_order_id uuid := gen_random_uuid();
  v_reference text := 'C57-' || upper(replace(gen_random_uuid()::text, '-', ''));
  v_inventory record;
  v_amount bigint;
  v_expires timestamptz;
begin
  if p_booking_type not in ('individual', 'group') then raise exception 'INVALID_BOOKING_TYPE'; end if;
  if (p_booking_type = 'group' and p_quantity <> 15)
    or (p_booking_type = 'individual' and p_quantity not between 1 and 15)
    then raise exception 'INVALID_QUANTITY'; end if;
  if p_customer_name is null or length(btrim(p_customer_name)) not between 2 and 120
    or p_customer_email is null or length(p_customer_email) > 254
    or p_customer_phone is null or length(p_customer_phone) > 24
    then raise exception 'INVALID_CUSTOMER'; end if;
  if p_access_token_hash is null or p_access_token_hash !~ '^[0-9a-f]{64}$'
    then raise exception 'INVALID_ACCESS_TOKEN_HASH'; end if;
  if p_policy_version <> 'hyperview-flex-pass-v1' or p_policy_accepted_at is null
    or p_policy_accepted_at < v_now - interval '30 minutes'
    or p_policy_accepted_at > v_now + interval '1 minute'
    then raise exception 'POLICY_NOT_ACCEPTED'; end if;

  select * into v_inventory from public.ensure_flex_inventory(p_venue_id, p_booking_type, v_now);
  v_amount := case when p_booking_type = 'group' then v_inventory.unit_price_kobo
    else v_inventory.unit_price_kobo * p_quantity end;
  if v_amount <= 0 or v_amount > 1000000000 then raise exception 'INVALID_ORDER_AMOUNT'; end if;
  v_expires := least(v_now + interval '10 minutes', v_inventory.valid_until);
  if v_expires <= v_now then raise exception 'ADMISSION_WINDOW_CLOSED'; end if;

  insert into public.orders(
    id, reference, user_id, customer_name, customer_email, customer_phone,
    currency, amount_kobo, status, access_token_hash, expires_at,
    policy_version, policy_accepted_at, source, payment_method,
    booking_type, party_size, experience_count
  ) values (
    v_order_id, v_reference, p_user_id, btrim(p_customer_name),
    lower(btrim(p_customer_email)), p_customer_phone, 'NGN', v_amount,
    'pending', p_access_token_hash, v_expires, p_policy_version,
    p_policy_accepted_at, 'online', 'paystack', p_booking_type, p_quantity,
    case when p_booking_type = 'group' then 3 else 2 end
  );
  insert into public.order_items(order_id, ticket_type_id, quantity, unit_price_kobo)
  values (v_order_id, v_inventory.ticket_type_id, p_quantity,
    case when p_booking_type = 'group' then 0 else v_inventory.unit_price_kobo end);

  return jsonb_build_object(
    'order_id', v_order_id, 'reference', v_reference, 'amount_kobo', v_amount,
    'currency', 'NGN', 'expires_at', v_expires,
    'valid_until', v_inventory.valid_until, 'party_size', p_quantity,
    'booking_type', p_booking_type
  );
end;
$$;

revoke all on function public.create_hyperview_flex_order(
  uuid,text,integer,text,text,text,text,text,timestamptz,uuid
) from public, anon, authenticated;
grant execute on function public.create_hyperview_flex_order(
  uuid,text,integer,text,text,text,text,text,timestamptz,uuid
) to service_role;

create or replace function public.enforce_flex_ticket_validity()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_end timestamptz; v_paid_at timestamptz;
begin
  select s.ends_at into v_end from public.screenings s
  where s.id = new.screening_id and s.sale_mode = 'flex_pass';
  if found then
    select coalesce(
      nullif(p.payload #>> '{data,paid_at}', '')::timestamptz,
      p.verified_at, o.paid_at, clock_timestamp()
    ) into v_paid_at
    from public.orders o
    left join lateral (
      select payload, verified_at from public.payments
      where order_id = o.id and status = 'success'
      order by created_at desc limit 1
    ) p on true where o.id = new.order_id;
    -- Webhook delivery may occur after the provider captured payment. Use the
    -- provider timestamp so a delayed webhook cannot shorten a valid purchase.
    new.valid_from := least(coalesce(v_paid_at, clock_timestamp()), v_end - interval '1 second');
    new.valid_until := v_end;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_flex_ticket_validity on public.tickets;
create trigger enforce_flex_ticket_validity
before insert on public.tickets for each row execute function public.enforce_flex_ticket_validity();

create or replace function public.sync_in_progress_screenings()
returns integer language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_changed integer;
begin
  update public.screenings set status = 'in_progress', updated_at = now()
  where sale_mode = 'scheduled' and status in ('on_sale', 'sold_out')
    and starts_at <= now() and ends_at > now();
  get diagnostics v_changed = row_count;
  return v_changed;
end;
$$;

create or replace function public.sync_completed_screenings()
returns integer language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_changed integer;
begin
  update public.screenings set status = 'completed', updated_at = now()
  where status in ('on_sale', 'sold_out', 'in_progress') and ends_at <= now();
  get diagnostics v_changed = row_count;
  return v_changed;
end;
$$;

create or replace function public.sync_screening_sold_out_status()
returns integer language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_changed integer;
begin
  with inventory as (
    select s.id, exists (
      select 1 from public.ticket_types tt
      where tt.screening_id = s.id and tt.is_active
        and tt.capacity > public.reserved_places_for_ticket_type(tt.id, false)
    ) as has_unsold_places
    from public.screenings s
    where s.sale_mode = 'scheduled' and s.status in ('on_sale', 'sold_out')
      and s.sales_end > now() and s.starts_at > now()
  )
  update public.screenings s
  set status = case when i.has_unsold_places then 'on_sale'::public.screening_status
                    else 'sold_out'::public.screening_status end,
      updated_at = now()
  from inventory i where s.id = i.id
    and ((s.status = 'on_sale' and not i.has_unsold_places)
      or (s.status = 'sold_out' and i.has_unsold_places));
  get diagnostics v_changed = row_count;
  return v_changed;
end;
$$;

create or replace function public.payment_order_payload(p_order_id uuid, p_outcome text)
returns jsonb language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'outcome', p_outcome, 'order_id', o.id, 'booking_public_id', o.public_id,
    'reference', o.reference, 'order_status', o.status,
    'customer_name', o.customer_name, 'customer_email', o.customer_email,
    'customer_phone', o.customer_phone, 'amount_kobo', o.amount_kobo,
    'currency', o.currency, 'quantity', o.party_size,
    'booking_type', o.booking_type, 'experience_count', o.experience_count,
    'access_mode', s.sale_mode,
    'duration_minutes', case when s.sale_mode = 'flex_pass' then null
      else extract(epoch from (s.ends_at - s.starts_at))::integer / 60 end,
    'session_title', s.session_name, 'movie_title', s.session_name,
    'starts_at', s.starts_at, 'ends_at', s.ends_at,
    'valid_from', coalesce((select min(t.valid_from) from public.tickets t where t.order_id = o.id), o.paid_at, now()),
    'valid_until', coalesce((select max(t.valid_until) from public.tickets t where t.order_id = o.id), s.ends_at),
    'venue_name', v.name, 'venue_address', v.address,
    'venue_city', v.city, 'venue_timezone', v.timezone,
    'itinerary', '[]'::jsonb,
    'email_delivery_id', ed.id, 'email_delivery_status', ed.status,
    'tickets', coalesce((select jsonb_agg(jsonb_build_object(
      'public_id', t.public_id, 'ticket_type', tt2.name, 'status', t.status,
      'valid_from', t.valid_from, 'valid_until', t.valid_until
    ) order by t.created_at, t.public_id)
      from public.tickets t join public.ticket_types tt2 on tt2.id = t.ticket_type_id
      where t.order_id = o.id), '[]'::jsonb)
  )
  from public.orders o
  join public.order_items oi on oi.order_id = o.id
  join public.ticket_types tt on tt.id = oi.ticket_type_id
  join public.screenings s on s.id = tt.screening_id
  join public.venues v on v.id = s.venue_id
  left join public.email_deliveries ed on ed.order_id = o.id and ed.template = 'ticket-confirmation'
  where o.id = p_order_id limit 1;
$$;

create or replace function public.get_order_status_by_token(
  p_reference text, p_access_token_hash text
)
returns jsonb language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'booking_public_id', o.public_id, 'reference', o.reference,
    'status', case when o.status = 'pending' and o.expires_at <= now()
      then 'expired' else o.status::text end,
    'amount_kobo', o.amount_kobo, 'currency', o.currency,
    'expires_at', o.expires_at, 'paid_at', o.paid_at,
    'customer_name', o.customer_name, 'quantity', o.party_size,
    'booking_type', o.booking_type, 'experience_count', o.experience_count,
    'access_mode', s.sale_mode,
    'duration_minutes', case when s.sale_mode = 'flex_pass' then null
      else extract(epoch from (s.ends_at - s.starts_at))::integer / 60 end,
    'session_title', s.session_name, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
    'valid_from', coalesce((select min(t.valid_from) from public.tickets t where t.order_id = o.id), o.paid_at),
    'valid_until', coalesce((select max(t.valid_until) from public.tickets t where t.order_id = o.id), s.ends_at),
    'venue_name', v.name, 'venue_city', v.city, 'venue_timezone', v.timezone,
    'tickets', coalesce((select jsonb_agg(jsonb_build_object(
      'public_id', t.public_id, 'status', t.status, 'is_active', t.is_active,
      'valid_from', t.valid_from, 'valid_until', t.valid_until, 'ticket_type', tt2.name
    ) order by t.created_at, t.public_id)
      from public.tickets t join public.ticket_types tt2 on tt2.id = t.ticket_type_id
      where t.order_id = o.id), '[]'::jsonb)
  )
  from public.orders o
  join public.order_items oi on oi.order_id = o.id
  join public.ticket_types tt on tt.id = oi.ticket_type_id
  join public.screenings s on s.id = tt.screening_id
  join public.venues v on v.id = s.venue_id
  where o.reference = p_reference and o.access_token_hash = p_access_token_hash limit 1;
$$;

create or replace function public.get_public_booking_details(p_public_id uuid)
returns jsonb language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'reference', o.reference, 'status', o.status, 'quantity', o.party_size,
    'booking_type', o.booking_type, 'experience_count', o.experience_count,
    'access_mode', s.sale_mode, 'amount_kobo', o.amount_kobo, 'currency', o.currency,
    'arrived_count', count(t.id) filter (where t.arrived_at is not null),
    'admitted_count', count(t.id) filter (where t.checked_in_at is not null),
    'valid_from', min(t.valid_from), 'valid_until', max(t.valid_until),
    'session', jsonb_build_object(
      'title', s.session_name, 'kind', s.session_kind, 'access_mode', s.sale_mode,
      'duration_minutes', case when s.sale_mode = 'flex_pass' then null
        else extract(epoch from (s.ends_at - s.starts_at))::integer / 60 end,
      'film_count', o.experience_count),
    'movie', jsonb_build_object('title', s.session_name, 'poster_path', null,
      'rating', concat(o.experience_count, ' staff-selected films'), 'runtime_minutes', null),
    'screening', jsonb_build_object('starts_at', s.starts_at, 'ends_at', s.ends_at,
      'status', s.status, 'sale_mode', s.sale_mode, 'venue', v.name,
      'venue_address', v.address, 'venue_city', v.city, 'venue_timezone', v.timezone),
    'itinerary', '[]'::jsonb
  )
  from public.orders o join public.tickets t on t.order_id = o.id
  join public.screenings s on s.id = t.screening_id join public.venues v on v.id = s.venue_id
  where o.public_id = p_public_id and o.status in ('paid', 'refunded', 'cancelled')
  group by o.id, s.id, v.id;
$$;

create or replace function public.ticket_gate_details(p_public_id uuid)
returns jsonb language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'ticket', jsonb_build_object(
      'id', t.public_id, 'type', tt.name, 'holder_name', t.holder_name,
      'status', t.status, 'is_active', t.is_active,
      'valid_from', t.valid_from, 'valid_until', t.valid_until,
      'arrived_at', t.arrived_at, 'checked_in_at', t.checked_in_at),
    'booking', jsonb_build_object('reference', o.reference, 'public_id', o.public_id,
      'booking_type', o.booking_type, 'party_size', o.party_size, 'access_mode', s.sale_mode),
    'session', jsonb_build_object('title', s.session_name, 'kind', s.session_kind,
      'access_mode', s.sale_mode, 'duration_minutes', null, 'film_count', o.experience_count),
    'movie', jsonb_build_object('title', s.session_name, 'poster_path', null,
      'rating', concat(o.experience_count, ' staff-selected films'), 'runtime_minutes', null),
    'screening', jsonb_build_object('starts_at', s.starts_at, 'ends_at', s.ends_at,
      'status', s.status, 'sale_mode', s.sale_mode, 'venue', v.name,
      'venue_address', v.address, 'venue_city', v.city, 'venue_timezone', v.timezone)
  )
  from public.tickets t join public.orders o on o.id = t.order_id
  join public.screenings s on s.id = t.screening_id join public.venues v on v.id = s.venue_id
  join public.ticket_types tt on tt.id = t.ticket_type_id where t.public_id = p_public_id;
$$;

create or replace function public.get_public_ticket_details(p_public_id uuid)
returns jsonb language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'ticket', jsonb_build_object(
      'id', t.public_id, 'type', tt.name, 'holder_name', t.holder_name,
      'status', case when t.status = 'valid' and now() < t.valid_from then 'not_yet_valid'
        when t.status = 'valid' and now() >= t.valid_until then 'expired'
        else t.status::text end,
      'is_active', t.is_active, 'valid_from', t.valid_from,
      'valid_until', t.valid_until, 'checked_in_at', t.checked_in_at),
    'booking', jsonb_build_object('reference', o.reference, 'public_id', o.public_id,
      'booking_type', o.booking_type, 'party_size', o.party_size, 'access_mode', s.sale_mode),
    'session', jsonb_build_object('title', s.session_name, 'kind', s.session_kind,
      'access_mode', s.sale_mode, 'duration_minutes', null, 'film_count', o.experience_count),
    'movie', jsonb_build_object('title', s.session_name, 'poster_path', null,
      'rating', concat(o.experience_count, ' staff-selected films'), 'runtime_minutes', null),
    'screening', jsonb_build_object('starts_at', s.starts_at, 'ends_at', s.ends_at,
      'status', s.status, 'sale_mode', s.sale_mode, 'venue', v.name,
      'venue_address', v.address, 'venue_city', v.city, 'venue_timezone', v.timezone)
  )
  from public.tickets t join public.orders o on o.id = t.order_id
  join public.screenings s on s.id = t.screening_id join public.venues v on v.id = s.venue_id
  join public.ticket_types tt on tt.id = t.ticket_type_id
  where t.public_id = p_public_id and o.status in ('paid', 'refunded', 'cancelled');
$$;

create or replace function public.staff_search_bookings(
  p_actor uuid, p_query text default '', p_limit integer default 40
)
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare v_query text := left(btrim(coalesce(p_query, '')), 120);
begin
  if not exists (select 1 from public.profiles where id = p_actor
    and role in ('cashier', 'supervisor', 'check_in_staff', 'admin'))
    then raise exception 'OPERATIONS_FORBIDDEN'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id', o.id, 'public_id', o.public_id, 'reference', o.reference,
    'status', o.status, 'booking_type', o.booking_type, 'experience_count', o.experience_count,
    'customer_name', o.customer_name, 'customer_email', o.customer_email,
    'customer_phone', o.customer_phone, 'amount_kobo', o.amount_kobo,
    'paid_at', o.paid_at, 'arrival_notes', o.arrival_notes,
    'session', s.session_name, 'movie', s.session_name, 'screening_id', s.id,
    'session_kind', s.session_kind, 'access_mode', s.sale_mode,
    'starts_at', s.starts_at, 'ends_at', s.ends_at,
    'valid_from', (select min(t.valid_from) from public.tickets t where t.order_id = o.id),
    'valid_until', (select max(t.valid_until) from public.tickets t where t.order_id = o.id),
    'screening_status', s.status, 'venue', v.name, 'venue_timezone', v.timezone,
    'quantity', o.party_size, 'itinerary', '[]'::jsonb,
    'arrived_count', (select count(*) from public.tickets t where t.order_id = o.id and t.arrived_at is not null),
    'admitted_count', (select count(*) from public.tickets t where t.order_id = o.id and t.checked_in_at is not null),
    'tickets', (select coalesce(jsonb_agg(jsonb_build_object(
      'public_id', t.public_id, 'status', t.status, 'is_active', t.is_active,
      'arrived_at', t.arrived_at, 'checked_in_at', t.checked_in_at
    ) order by t.created_at), '[]'::jsonb) from public.tickets t where t.order_id = o.id)
  ) order by o.created_at desc) from (
    select o.* from public.orders o where o.status in ('paid', 'cancelled', 'refunded') and (
      v_query = '' or o.reference ilike '%' || v_query || '%'
      or o.customer_name ilike '%' || v_query || '%'
      or o.customer_email ilike '%' || v_query || '%'
      or o.customer_phone ilike '%' || v_query || '%' or o.public_id::text = v_query
    ) order by o.created_at desc limit greatest(1, least(coalesce(p_limit, 40), 80))
  ) o join public.order_items oi on oi.order_id = o.id
  join public.ticket_types tt on tt.id = oi.ticket_type_id
  join public.screenings s on s.id = tt.screening_id
  join public.venues v on v.id = s.venue_id), '[]'::jsonb);
end;
$$;

create or replace function public.admin_search_orders(
  p_actor uuid, p_query text default '', p_limit integer default 30
)
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare v_query text := left(btrim(coalesce(p_query, '')), 120);
begin
  if not exists (select 1 from public.profiles where id = p_actor and role = 'admin')
    then raise exception 'ADMIN_FORBIDDEN'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id', o.id, 'reference', o.reference, 'status', o.status,
    'booking_type', o.booking_type, 'party_size', o.party_size,
    'experience_count', o.experience_count, 'customer_name', o.customer_name,
    'customer_email', o.customer_email, 'customer_phone', o.customer_phone,
    'amount_kobo', o.amount_kobo, 'currency', o.currency,
    'created_at', o.created_at, 'paid_at', o.paid_at, 'expires_at', o.expires_at,
    'payment', (select jsonb_build_object('status', p.status,
      'provider_reference', p.provider_reference, 'verified_at', p.verified_at)
      from public.payments p where p.order_id = o.id order by p.created_at desc limit 1),
    'email', (select jsonb_build_object('status', ed.status, 'attempts', ed.attempts,
      'last_error', ed.last_error, 'sent_at', ed.sent_at)
      from public.email_deliveries ed where ed.order_id = o.id order by ed.created_at desc limit 1),
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
      'session', s.session_name, 'movie', s.session_name,
      'access_mode', s.sale_mode, 'showtime', s.starts_at,
      'valid_until', s.ends_at, 'venue', v.name,
      'type', case when o.booking_type = 'group' then '15-person group pass' else tt.name end,
      'quantity', oi.quantity,
      'unit_price_kobo', case when o.booking_type = 'group' then o.amount_kobo else oi.unit_price_kobo end,
      'included', false, 'package_total', o.booking_type = 'group'
    )), '[]'::jsonb) from public.order_items oi
      join public.ticket_types tt on tt.id = oi.ticket_type_id
      join public.screenings s on s.id = tt.screening_id
      join public.venues v on v.id = s.venue_id where oi.order_id = o.id),
    'tickets', (select coalesce(jsonb_agg(jsonb_build_object(
      'public_id', t.public_id, 'status', t.status, 'is_active', t.is_active,
      'checked_in_at', t.checked_in_at) order by t.created_at), '[]'::jsonb)
      from public.tickets t where t.order_id = o.id)
  ) order by o.created_at desc) from (
    select * from public.orders o where v_query = ''
      or o.reference ilike '%' || v_query || '%'
      or o.customer_email ilike '%' || v_query || '%'
      or exists (select 1 from public.tickets t where t.order_id = o.id and t.public_id::text = v_query)
    order by o.created_at desc limit greatest(1, least(coalesce(p_limit, 30), 50))
  ) o), '[]'::jsonb);
end;
$$;

