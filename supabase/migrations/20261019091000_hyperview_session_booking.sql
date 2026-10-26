-- HyperView session booking: effective-dated prices, session-valid admissions,
-- reception registration and a separate supervisor admission step.

create table public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references public.venues(id) on delete cascade,
  name text not null,
  weekday_price_kobo bigint not null check (weekday_price_kobo > 0),
  weekend_price_kobo bigint not null check (weekend_price_kobo > 0),
  effective_from date not null,
  effective_until date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_until is null or effective_until >= effective_from)
);

create index pricing_rules_lookup_idx
on public.pricing_rules (venue_id, is_active, effective_from desc);

alter table public.pricing_rules enable row level security;

create policy "catalogue team reads pricing rules"
on public.pricing_rules for select to authenticated
using (public.can_manage_catalog());

create policy "catalogue team adds pricing rules"
on public.pricing_rules for insert to authenticated
with check (public.can_manage_catalog());

create policy "catalogue team edits pricing rules"
on public.pricing_rules for update to authenticated
using (public.can_manage_catalog())
with check (public.can_manage_catalog());

revoke all on public.pricing_rules from anon, authenticated;
grant select, insert, update on public.pricing_rules to authenticated;

-- The global rule is the fallback for every venue. A later effective rule wins,
-- so November pricing can be entered ahead of time without a code deployment.
insert into public.pricing_rules (
  venue_id, name, weekday_price_kobo, weekend_price_kobo, effective_from
) values (
  null, 'HyperView standard pricing', 1050000, 1250000, date '2026-01-01'
);

alter table public.screenings
  add column admission_opens_minutes integer not null default 15
    check (admission_opens_minutes between 0 and 180),
  add column admission_grace_minutes integer not null default 30
    check (admission_grace_minutes between 0 and 240);

alter table public.orders
  add column public_id uuid not null default gen_random_uuid(),
  add column policy_version text,
  add column policy_accepted_at timestamptz,
  add column source text not null default 'online'
    check (source in ('online', 'walk_in')),
  add column payment_method text not null default 'paystack'
    check (payment_method in ('paystack', 'cash', 'pos', 'bank_transfer')),
  add column arrival_notes text;

create unique index orders_public_id_key on public.orders(public_id);

alter table public.tickets
  add column arrived_at timestamptz,
  add column registered_by uuid references auth.users(id) on delete set null;

create index tickets_arrival_idx on public.tickets(screening_id, arrived_at);

create table public.booking_operations_audit (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  staff_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('view', 'register_arrival')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index booking_operations_audit_order_time_idx
on public.booking_operations_audit(order_id, created_at desc);

alter table public.booking_operations_audit enable row level security;
revoke all on public.booking_operations_audit from anon, authenticated;

create or replace function public.can_check_in()
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('cashier', 'supervisor', 'check_in_staff', 'admin')
  );
$$;

create or replace function public.can_register_arrivals()
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('cashier', 'admin')
  );
$$;

create or replace function public.can_supervise_sessions()
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('supervisor', 'check_in_staff', 'admin')
  );
$$;

revoke all on function public.can_register_arrivals() from public, anon, authenticated;
revoke all on function public.can_supervise_sessions() from public, anon, authenticated;
grant execute on function public.can_register_arrivals() to authenticated;
grant execute on function public.can_supervise_sessions() to authenticated;

create or replace function public.price_for_screening(p_screening_id uuid)
returns bigint language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_local_date date;
  v_is_weekend boolean;
  v_price bigint;
  v_venue_id uuid;
begin
  select (s.starts_at at time zone v.timezone)::date,
         extract(isodow from (s.starts_at at time zone v.timezone)) in (6, 7),
         s.venue_id
  into v_local_date, v_is_weekend, v_venue_id
  from public.screenings s
  join public.venues v on v.id = s.venue_id
  where s.id = p_screening_id;

  if not found then raise exception 'SCREENING_NOT_FOUND'; end if;

  select case when v_is_weekend
    then pr.weekend_price_kobo else pr.weekday_price_kobo end
  into v_price
  from public.pricing_rules pr
  where pr.is_active
    and (pr.venue_id = v_venue_id or pr.venue_id is null)
    and pr.effective_from <= v_local_date
    and (pr.effective_until is null or pr.effective_until >= v_local_date)
  order by (pr.venue_id is not null) desc, pr.effective_from desc, pr.created_at desc
  limit 1;

  if v_price is null then raise exception 'PRICE_RULE_NOT_FOUND'; end if;
  return v_price;
end;
$$;

create or replace function public.apply_session_price_to_ticket_type()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  new.price_kobo := public.price_for_screening(new.screening_id);
  return new;
end;
$$;

create trigger apply_session_price_to_ticket_type
before insert or update of screening_id on public.ticket_types
for each row execute function public.apply_session_price_to_ticket_type();

create or replace function public.sync_screening_ticket_prices()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  update public.ticket_types
  set price_kobo = public.price_for_screening(new.id)
  where screening_id = new.id;
  return new;
end;
$$;

create trigger sync_screening_ticket_prices
after insert or update of starts_at, venue_id on public.screenings
for each row execute function public.sync_screening_ticket_prices();

create or replace function public.sync_prices_after_rule_change()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  update public.ticket_types tt
  set price_kobo = public.price_for_screening(tt.screening_id)
  from public.screenings s
  where s.id = tt.screening_id
    and s.ends_at > now();
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger sync_prices_after_rule_change
after insert or update or delete on public.pricing_rules
for each row execute function public.sync_prices_after_rule_change();

-- Bring existing future catalogue prices in line with the effective rule.
update public.ticket_types tt
set price_kobo = public.price_for_screening(tt.screening_id)
from public.screenings s
where s.id = tt.screening_id and s.ends_at > now();

create or replace function public.set_ticket_session_validity()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_screening public.screenings%rowtype;
begin
  select * into v_screening from public.screenings where id = new.screening_id;
  if not found then raise exception 'SCREENING_NOT_FOUND'; end if;
  new.valid_from := v_screening.starts_at
    - make_interval(mins => v_screening.admission_opens_minutes);
  new.valid_until := v_screening.ends_at
    + make_interval(mins => v_screening.admission_grace_minutes);
  return new;
end;
$$;

create trigger set_ticket_session_validity
before insert or update of screening_id on public.tickets
for each row execute function public.set_ticket_session_validity();

update public.tickets t
set valid_from = s.starts_at - make_interval(mins => s.admission_opens_minutes),
    valid_until = s.ends_at + make_interval(mins => s.admission_grace_minutes)
from public.screenings s
where s.id = t.screening_id and t.status = 'valid';

create or replace function public.create_hyperview_pending_order(
  p_screening_id uuid,
  p_items jsonb,
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
  v_screening public.screenings%rowtype;
  v_ticket_type public.ticket_types%rowtype;
  v_ticket_type_id uuid;
  v_quantity integer;
  v_order_id uuid := gen_random_uuid();
  v_reference text := 'C57-' || upper(replace(gen_random_uuid()::text, '-', ''));
  v_expires_at timestamptz := clock_timestamp() + interval '10 minutes';
  v_now timestamptz := clock_timestamp();
  v_unit_price bigint;
  v_amount_kobo bigint;
  v_reserved integer;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) <> 1 then
    raise exception 'INVALID_ITEMS';
  end if;

  select item.ticket_type_id, item.quantity
  into v_ticket_type_id, v_quantity
  from jsonb_to_recordset(p_items) item(ticket_type_id uuid, quantity integer);

  if v_ticket_type_id is null or v_quantity is null or v_quantity not between 1 and 8 then
    raise exception 'INVALID_ITEMS';
  end if;
  if p_customer_name is null or length(btrim(p_customer_name)) not between 2 and 120 then
    raise exception 'INVALID_CUSTOMER_NAME';
  end if;
  if p_customer_email is null or length(p_customer_email) > 254 then
    raise exception 'INVALID_CUSTOMER_EMAIL';
  end if;
  if p_customer_phone is null or length(p_customer_phone) > 24 then
    raise exception 'INVALID_CUSTOMER_PHONE';
  end if;
  if p_access_token_hash is null or p_access_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_ACCESS_TOKEN_HASH';
  end if;
  if p_policy_version <> 'hyperview-booking-v1'
    or p_policy_accepted_at is null
    or p_policy_accepted_at < v_now - interval '30 minutes'
    or p_policy_accepted_at > v_now + interval '1 minute' then
    raise exception 'POLICY_NOT_ACCEPTED';
  end if;

  select * into v_screening from public.screenings
  where id = p_screening_id for update;
  if not found then raise exception 'SCREENING_NOT_FOUND'; end if;
  if v_screening.status <> 'on_sale' then raise exception 'SCREENING_NOT_ON_SALE'; end if;
  if v_now < v_screening.sales_start or v_now >= v_screening.sales_end
    or v_now >= v_screening.starts_at then
    raise exception 'SALES_CLOSED';
  end if;

  select * into v_ticket_type from public.ticket_types
  where id = v_ticket_type_id and screening_id = p_screening_id
    and is_active for update;
  if not found then raise exception 'TICKET_TYPE_NOT_AVAILABLE'; end if;

  select coalesce(sum(oi.quantity), 0)::integer into v_reserved
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.ticket_type_id = v_ticket_type_id
    and (o.status = 'paid' or (o.status = 'pending' and o.expires_at > v_now));

  if v_reserved + v_quantity > v_ticket_type.capacity then
    raise exception 'INSUFFICIENT_CAPACITY';
  end if;

  v_unit_price := public.price_for_screening(p_screening_id);
  v_amount_kobo := v_unit_price * v_quantity;
  if v_amount_kobo <= 0 or v_amount_kobo > 1000000000 then
    raise exception 'INVALID_ORDER_AMOUNT';
  end if;

  update public.ticket_types set price_kobo = v_unit_price
  where id = v_ticket_type_id and price_kobo <> v_unit_price;

  insert into public.orders (
    id, reference, user_id, customer_name, customer_email, customer_phone,
    currency, amount_kobo, status, access_token_hash, expires_at,
    policy_version, policy_accepted_at, source, payment_method
  ) values (
    v_order_id, v_reference, p_user_id, btrim(p_customer_name),
    lower(btrim(p_customer_email)), p_customer_phone, 'NGN', v_amount_kobo,
    'pending', p_access_token_hash, v_expires_at,
    p_policy_version, p_policy_accepted_at, 'online', 'paystack'
  );

  insert into public.order_items(order_id, ticket_type_id, quantity, unit_price_kobo)
  values (v_order_id, v_ticket_type_id, v_quantity, v_unit_price);

  return jsonb_build_object(
    'order_id', v_order_id, 'reference', v_reference,
    'amount_kobo', v_amount_kobo, 'currency', 'NGN',
    'expires_at', v_expires_at
  );
end;
$$;

create or replace function public.payment_order_payload(p_order_id uuid, p_outcome text)
returns jsonb language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'outcome', p_outcome,
    'order_id', o.id,
    'booking_public_id', o.public_id,
    'reference', o.reference,
    'order_status', o.status,
    'customer_name', o.customer_name,
    'customer_email', o.customer_email,
    'customer_phone', o.customer_phone,
    'amount_kobo', o.amount_kobo,
    'currency', o.currency,
    'quantity', (select coalesce(sum(oi2.quantity), 0) from public.order_items oi2 where oi2.order_id = o.id),
    'movie_title', m.title,
    'starts_at', s.starts_at,
    'ends_at', s.ends_at,
    'valid_from', s.starts_at - make_interval(mins => s.admission_opens_minutes),
    'valid_until', s.ends_at + make_interval(mins => s.admission_grace_minutes),
    'venue_name', v.name,
    'venue_address', v.address,
    'venue_city', v.city,
    'venue_timezone', v.timezone,
    'email_delivery_id', ed.id,
    'email_delivery_status', ed.status,
    'tickets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'public_id', t.public_id, 'ticket_type', tt2.name,
        'status', t.status, 'valid_from', t.valid_from,
        'valid_until', t.valid_until
      ) order by t.created_at, t.public_id)
      from public.tickets t
      join public.ticket_types tt2 on tt2.id = t.ticket_type_id
      where t.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o
  join public.order_items oi on oi.order_id = o.id
  join public.ticket_types tt on tt.id = oi.ticket_type_id
  join public.screenings s on s.id = tt.screening_id
  join public.movies m on m.id = s.movie_id
  join public.venues v on v.id = s.venue_id
  left join public.email_deliveries ed
    on ed.order_id = o.id and ed.template = 'ticket-confirmation'
  where o.id = p_order_id
  limit 1;
$$;

create or replace function public.get_order_status_by_token(
  p_reference text, p_access_token_hash text
)
returns jsonb language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'booking_public_id', o.public_id,
    'reference', o.reference,
    'status', case when o.status = 'pending' and o.expires_at <= now()
      then 'expired' else o.status::text end,
    'amount_kobo', o.amount_kobo,
    'currency', o.currency,
    'expires_at', o.expires_at,
    'paid_at', o.paid_at,
    'customer_name', o.customer_name,
    'quantity', (select coalesce(sum(oi2.quantity), 0) from public.order_items oi2 where oi2.order_id = o.id),
    'movie_title', m.title,
    'starts_at', s.starts_at,
    'ends_at', s.ends_at,
    'venue_name', v.name,
    'venue_city', v.city,
    'venue_timezone', v.timezone,
    'tickets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'public_id', t.public_id, 'status', t.status,
        'is_active', t.is_active, 'valid_from', t.valid_from,
        'valid_until', t.valid_until, 'ticket_type', tt2.name
      ) order by t.created_at, t.public_id)
      from public.tickets t
      join public.ticket_types tt2 on tt2.id = t.ticket_type_id
      where t.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o
  join public.order_items oi on oi.order_id = o.id
  join public.ticket_types tt on tt.id = oi.ticket_type_id
  join public.screenings s on s.id = tt.screening_id
  join public.movies m on m.id = s.movie_id
  join public.venues v on v.id = s.venue_id
  where o.reference = p_reference and o.access_token_hash = p_access_token_hash
  limit 1;
$$;

create or replace function public.get_public_booking_details(p_public_id uuid)
returns jsonb language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'reference', o.reference,
    'status', o.status,
    'quantity', (select coalesce(sum(oi2.quantity), 0) from public.order_items oi2 where oi2.order_id = o.id),
    'amount_kobo', o.amount_kobo,
    'currency', o.currency,
    'arrived_count', (select count(*) from public.tickets t where t.order_id = o.id and t.arrived_at is not null),
    'admitted_count', (select count(*) from public.tickets t where t.order_id = o.id and t.checked_in_at is not null),
    'valid_from', min(t.valid_from),
    'valid_until', max(t.valid_until),
    'movie', jsonb_build_object(
      'title', m.title, 'poster_path', m.poster_path,
      'rating', m.rating, 'runtime_minutes', m.runtime_minutes
    ),
    'screening', jsonb_build_object(
      'starts_at', s.starts_at, 'ends_at', s.ends_at,
      'status', s.status, 'venue', v.name, 'venue_address', v.address,
      'venue_city', v.city, 'venue_timezone', v.timezone
    )
  )
  from public.orders o
  join public.tickets t on t.order_id = o.id
  join public.screenings s on s.id = t.screening_id
  join public.movies m on m.id = s.movie_id
  join public.venues v on v.id = s.venue_id
  where o.public_id = p_public_id and o.status in ('paid', 'refunded', 'cancelled')
  group by o.id, m.id, s.id, v.id;
$$;

create or replace function public.catalogue_session_inventory()
returns table (
  screening_id uuid,
  capacity integer,
  reserved integer,
  remaining integer
) language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if not public.can_manage_catalog() then raise exception 'CATALOGUE_FORBIDDEN'; end if;
  return query
  with per_type as (
    select tt.screening_id, tt.capacity,
      coalesce(sum(oi.quantity) filter (
        where o.status = 'paid' or (o.status = 'pending' and o.expires_at > now())
      ), 0)::integer as reserved
    from public.ticket_types tt
    left join public.order_items oi on oi.ticket_type_id = tt.id
    left join public.orders o on o.id = oi.order_id
    where tt.is_active
    group by tt.id
  ), inventory as (
    select pt.screening_id, sum(pt.capacity)::integer as capacity,
      sum(pt.reserved)::integer as reserved
    from per_type pt group by pt.screening_id
  )
  select s.id, coalesce(i.capacity, 0), coalesce(i.reserved, 0),
    greatest(0, coalesce(i.capacity, 0) - coalesce(i.reserved, 0))::integer
  from public.screenings s
  left join inventory i on i.screening_id = s.id;
end;
$$;

create or replace function public.create_hyperview_session_series(
  p_movie_id uuid,
  p_venue_id uuid,
  p_start_date date,
  p_end_date date,
  p_times time[],
  p_duration_minutes integer,
  p_capacity integer,
  p_sales_start timestamptz,
  p_open_sales boolean default false
)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_date date; v_time time; v_starts_at timestamptz; v_screening_id uuid;
  v_timezone text; v_created integer := 0; v_skipped integer := 0;
begin
  if not public.can_manage_catalog() then raise exception 'CATALOGUE_FORBIDDEN'; end if;
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date
    or p_end_date - p_start_date > 31 then raise exception 'INVALID_DATE_RANGE'; end if;
  if p_times is null or cardinality(p_times) not between 1 and 12
    or p_duration_minutes not between 5 and 240
    or p_capacity not between 1 and 500
    or p_sales_start is null then raise exception 'INVALID_SESSION_SERIES'; end if;

  select timezone into v_timezone from public.venues
  where id = p_venue_id and is_active;
  if not found then raise exception 'VENUE_NOT_ACTIVE'; end if;
  if not exists (select 1 from public.movies where id = p_movie_id and status <> 'archived') then
    raise exception 'MOVIE_NOT_AVAILABLE';
  end if;
  if p_open_sales and not exists (
    select 1 from public.movies where id = p_movie_id and status = 'published'
  ) then raise exception 'MOVIE_NOT_PUBLISHED'; end if;

  for v_date in select generate_series(p_start_date, p_end_date, interval '1 day')::date
  loop
    foreach v_time in array p_times loop
      v_starts_at := (v_date + v_time) at time zone v_timezone;
      if v_starts_at <= now() or exists (
        select 1 from public.screenings where movie_id = p_movie_id
          and venue_id = p_venue_id and starts_at = v_starts_at
          and status <> 'cancelled'
      ) then
        v_skipped := v_skipped + 1;
        continue;
      end if;

      insert into public.screenings(
        movie_id, venue_id, starts_at, ends_at, sales_start, sales_end, status,
        admission_opens_minutes, admission_grace_minutes
      ) values (
        p_movie_id, p_venue_id, v_starts_at,
        v_starts_at + make_interval(mins => p_duration_minutes),
        least(p_sales_start, v_starts_at - interval '1 minute'), v_starts_at,
        'draft', 15, 30
      ) returning id into v_screening_id;

      insert into public.ticket_types(
        screening_id, name, description, price_kobo, capacity, is_active
      ) values (
        v_screening_id, 'General admission',
        'HyperView 9D Flying Cinema admission', 0, p_capacity, true
      );

      if p_open_sales then
        update public.screenings set status = 'on_sale', updated_at = now()
        where id = v_screening_id;
      end if;
      v_created := v_created + 1;
    end loop;
  end loop;

  return jsonb_build_object('created', v_created, 'skipped', v_skipped);
end;
$$;

create or replace function public.staff_search_bookings(
  p_actor uuid, p_query text default '', p_limit integer default 40
)
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare v_query text := left(btrim(coalesce(p_query, '')), 120);
begin
  if not exists (
    select 1 from public.profiles where id = p_actor
      and role in ('cashier', 'supervisor', 'check_in_staff', 'admin')
  ) then raise exception 'OPERATIONS_FORBIDDEN'; end if;

  return coalesce((select jsonb_agg(jsonb_build_object(
    'id', o.id, 'public_id', o.public_id, 'reference', o.reference,
    'status', o.status, 'customer_name', o.customer_name,
    'customer_email', o.customer_email, 'customer_phone', o.customer_phone,
    'amount_kobo', o.amount_kobo, 'paid_at', o.paid_at,
    'arrival_notes', o.arrival_notes,
    'movie', m.title, 'screening_id', s.id, 'starts_at', s.starts_at,
    'ends_at', s.ends_at, 'screening_status', s.status,
    'venue', v.name, 'venue_timezone', v.timezone,
    'quantity', (select coalesce(sum(oi2.quantity), 0) from public.order_items oi2 where oi2.order_id = o.id),
    'arrived_count', (select count(*) from public.tickets t where t.order_id = o.id and t.arrived_at is not null),
    'admitted_count', (select count(*) from public.tickets t where t.order_id = o.id and t.checked_in_at is not null),
    'tickets', (select coalesce(jsonb_agg(jsonb_build_object(
      'public_id', t.public_id, 'status', t.status, 'is_active', t.is_active,
      'arrived_at', t.arrived_at, 'checked_in_at', t.checked_in_at
    ) order by t.created_at), '[]'::jsonb) from public.tickets t where t.order_id = o.id)
  ) order by s.starts_at, o.created_at)
  from (
    select o.* from public.orders o
    where o.status in ('paid', 'cancelled', 'refunded') and (
      v_query = '' or o.reference ilike '%' || v_query || '%'
      or o.customer_name ilike '%' || v_query || '%'
      or o.customer_email ilike '%' || v_query || '%'
      or o.customer_phone ilike '%' || v_query || '%'
      or o.public_id::text = v_query
    ) order by o.created_at desc
    limit greatest(1, least(coalesce(p_limit, 40), 80))
  ) o
  join public.order_items oi on oi.order_id = o.id
  join public.ticket_types tt on tt.id = oi.ticket_type_id
  join public.screenings s on s.id = tt.screening_id
  join public.movies m on m.id = s.movie_id
  join public.venues v on v.id = s.venue_id), '[]'::jsonb);
end;
$$;

create or replace function public.register_booking_arrival(
  p_actor uuid, p_order_id uuid, p_notes text default null
)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_order public.orders%rowtype; v_count integer; v_now timestamptz := clock_timestamp();
begin
  if not exists (
    select 1 from public.profiles where id = p_actor and role in ('cashier', 'admin')
  ) then raise exception 'RECEPTION_FORBIDDEN'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status <> 'paid' then raise exception 'ORDER_NOT_PAID'; end if;
  if not exists (
    select 1 from public.tickets t
    join public.screenings s on s.id = t.screening_id
    where t.order_id = v_order.id and s.status not in ('cancelled', 'completed')
      and v_now >= t.valid_from and v_now < t.valid_until
  ) then raise exception 'BOOKING_NOT_ARRIVABLE'; end if;

  update public.tickets set arrived_at = coalesce(arrived_at, v_now),
    registered_by = coalesce(registered_by, p_actor)
  where order_id = v_order.id and status = 'valid' and is_active;
  get diagnostics v_count = row_count;

  update public.orders set arrival_notes = nullif(left(btrim(coalesce(p_notes, '')), 300), ''),
    updated_at = now() where id = v_order.id;

  insert into public.booking_operations_audit(order_id, staff_user_id, action, details)
  values (v_order.id, p_actor, 'register_arrival', jsonb_build_object('tickets', v_count));

  return jsonb_build_object('registered', true, 'order_id', v_order.id,
    'arrived_count', (select count(*) from public.tickets where order_id = v_order.id and arrived_at is not null));
end;
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
      'arrived_at', t.arrived_at, 'checked_in_at', t.checked_in_at
    ),
    'booking', jsonb_build_object('reference', o.reference, 'public_id', o.public_id),
    'movie', jsonb_build_object(
      'title', m.title, 'poster_path', m.poster_path,
      'rating', m.rating, 'runtime_minutes', m.runtime_minutes
    ),
    'screening', jsonb_build_object(
      'starts_at', s.starts_at, 'ends_at', s.ends_at,
      'status', s.status, 'venue', v.name, 'venue_address', v.address,
      'venue_city', v.city, 'venue_timezone', v.timezone
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
  p_ticket public.tickets, p_order_status public.order_status,
  p_screening_status public.screening_status, p_at timestamptz
)
returns text language plpgsql immutable security definer
set search_path = public, pg_temp
as $$
begin
  if p_ticket.status = 'refunded' or p_order_status = 'refunded' then return 'refunded'; end if;
  if p_ticket.status = 'cancelled' or p_order_status = 'cancelled'
    or p_screening_status = 'cancelled' then return 'cancelled'; end if;
  if p_order_status <> 'paid' then return 'order_not_paid'; end if;
  if p_ticket.status = 'used' or p_ticket.checked_in_at is not null then return 'already_used'; end if;
  if p_ticket.status = 'no_show' then return 'no_show'; end if;
  if p_ticket.status = 'expired' or p_at >= p_ticket.valid_until then return 'expired'; end if;
  if not p_ticket.is_active or p_ticket.status <> 'valid' then return 'inactive'; end if;
  if p_at < p_ticket.valid_from then return 'not_yet_valid'; end if;
  if p_ticket.arrived_at is null then return 'not_registered'; end if;
  return 'valid';
end;
$$;

create or replace function public.verify_ticket_staff(p_public_id uuid, p_staff_user_id uuid)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_ticket public.tickets%rowtype; v_order_status public.order_status;
  v_screening_status public.screening_status; v_reason text;
  v_now timestamptz := clock_timestamp(); v_details jsonb;
begin
  if not exists (select 1 from public.profiles where id = p_staff_user_id
    and role in ('cashier', 'supervisor', 'check_in_staff', 'admin')) then
    raise exception 'CHECK_IN_FORBIDDEN';
  end if;
  select * into v_ticket from public.tickets where public_id = p_public_id for update;
  if not found then v_reason := 'not_found';
  else
    select o.status, s.status into v_order_status, v_screening_status
    from public.orders o join public.screenings s on s.id = v_ticket.screening_id
    where o.id = v_ticket.order_id;
    v_reason := public.ticket_gate_reason(v_ticket, v_order_status, v_screening_status, v_now);
    if v_reason in ('expired', 'no_show') and v_ticket.status = 'valid' then
      update public.tickets set status = 'no_show', is_active = false where id = v_ticket.id;
      v_reason := 'no_show';
    end if;
    v_details := public.ticket_gate_details(p_public_id);
  end if;
  insert into public.ticket_gate_audit_log(staff_user_id, ticket_public_id, action, result)
  values (p_staff_user_id, p_public_id, 'verify', v_reason);
  return jsonb_build_object('valid', v_reason = 'valid', 'reason', v_reason)
    || coalesce(v_details, '{}'::jsonb);
end;
$$;

create or replace function public.redeem_ticket_staff(p_public_id uuid, p_staff_user_id uuid)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_ticket public.tickets%rowtype; v_order_status public.order_status;
  v_screening_status public.screening_status; v_reason text;
  v_now timestamptz := clock_timestamp(); v_details jsonb;
begin
  if not exists (select 1 from public.profiles where id = p_staff_user_id
    and role in ('supervisor', 'check_in_staff', 'admin')) then
    raise exception 'CHECK_IN_FORBIDDEN';
  end if;
  select * into v_ticket from public.tickets where public_id = p_public_id for update;
  if not found then v_reason := 'not_found';
  else
    select o.status, s.status into v_order_status, v_screening_status
    from public.orders o join public.screenings s on s.id = v_ticket.screening_id
    where o.id = v_ticket.order_id;
    v_reason := public.ticket_gate_reason(v_ticket, v_order_status, v_screening_status, v_now);
    if v_reason = 'valid' then
      update public.tickets set status = 'used', is_active = false,
        checked_in_at = v_now, checked_in_by = p_staff_user_id
      where id = v_ticket.id and status = 'valid' and is_active
        and arrived_at is not null and checked_in_at is null
        and valid_from <= v_now and valid_until > v_now
      returning * into v_ticket;
      v_reason := case when found then 'redeemed' else 'already_used' end;
    elsif v_reason in ('expired', 'no_show') and v_ticket.status = 'valid' then
      update public.tickets set status = 'no_show', is_active = false where id = v_ticket.id;
      v_reason := 'no_show';
    end if;
    v_details := public.ticket_gate_details(p_public_id);
  end if;
  insert into public.ticket_gate_audit_log(staff_user_id, ticket_public_id, action, result)
  values (p_staff_user_id, p_public_id, 'redeem', v_reason);
  return jsonb_build_object('redeemed', v_reason = 'redeemed',
    'valid', v_reason = 'redeemed', 'reason', v_reason)
    || coalesce(v_details, '{}'::jsonb);
end;
$$;

create or replace function public.expire_old_tickets()
returns void language sql security definer
set search_path = public, pg_temp
as $$
  update public.tickets set status = 'no_show', is_active = false
  where status = 'valid' and valid_until <= now();
$$;

create or replace function public.sync_in_progress_screenings()
returns integer language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_changed integer;
begin
  update public.screenings set status = 'in_progress', updated_at = now()
  where status in ('on_sale', 'sold_out') and starts_at <= now() and ends_at > now();
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

create or replace function public.sync_hyperview_operations()
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform public.sync_in_progress_screenings();
  perform public.sync_completed_screenings();
  perform public.expire_old_tickets();
end;
$$;

select public.sync_in_progress_screenings();
select public.sync_completed_screenings();

do $$
begin
  if to_regprocedure('cron.schedule(text,text,text)') is not null then
    begin
      perform cron.unschedule('sync-hyperview-sessions');
    exception when others then null;
    end;
    perform cron.schedule(
      'sync-hyperview-sessions', '* * * * *',
      'select public.sync_hyperview_operations();'
    );
  end if;
end;
$$;

revoke all on function public.price_for_screening(uuid) from public, anon, authenticated;
revoke all on function public.apply_session_price_to_ticket_type() from public, anon, authenticated;
revoke all on function public.sync_screening_ticket_prices() from public, anon, authenticated;
revoke all on function public.sync_prices_after_rule_change() from public, anon, authenticated;
revoke all on function public.set_ticket_session_validity() from public, anon, authenticated;
revoke all on function public.create_hyperview_pending_order(uuid,jsonb,text,text,text,text,text,timestamptz,uuid) from public, anon, authenticated;
revoke all on function public.get_public_booking_details(uuid) from public, anon, authenticated;
revoke all on function public.staff_search_bookings(uuid,text,integer) from public, anon, authenticated;
revoke all on function public.register_booking_arrival(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.sync_in_progress_screenings() from public, anon, authenticated;
revoke all on function public.sync_hyperview_operations() from public, anon, authenticated;
revoke all on function public.catalogue_session_inventory() from public, anon, authenticated;
revoke all on function public.create_hyperview_session_series(uuid,uuid,date,date,time[],integer,integer,timestamptz,boolean) from public, anon, authenticated;

grant execute on function public.price_for_screening(uuid) to service_role;
grant execute on function public.create_hyperview_pending_order(uuid,jsonb,text,text,text,text,text,timestamptz,uuid) to service_role;
grant execute on function public.get_public_booking_details(uuid) to service_role;
grant execute on function public.staff_search_bookings(uuid,text,integer) to service_role;
grant execute on function public.register_booking_arrival(uuid,uuid,text) to service_role;
grant execute on function public.sync_in_progress_screenings() to service_role;
grant execute on function public.sync_hyperview_operations() to service_role;
grant execute on function public.catalogue_session_inventory() to authenticated, service_role;
grant execute on function public.create_hyperview_session_series(uuid,uuid,date,date,time[],integer,integer,timestamptz,boolean) to authenticated, service_role;
