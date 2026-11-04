-- HyperView is sold as a timed session, not as a customer-selected movie.
-- Historical movie-linked screenings remain readable for audit purposes.

alter table public.screenings
  add column if not exists session_name text not null
    default 'HyperView 9D Flying Cinema Session';

alter table public.screenings alter column movie_id drop not null;

create or replace function public.enforce_hyperview_session_duration()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.movie_id is null then
    new.session_name := coalesce(nullif(btrim(new.session_name), ''), 'HyperView 9D Flying Cinema Session');
    new.ends_at := new.starts_at + interval '30 minutes';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_hyperview_session_duration on public.screenings;
create trigger enforce_hyperview_session_duration
before insert or update of starts_at, ends_at, movie_id, session_name on public.screenings
for each row execute function public.enforce_hyperview_session_duration();

revoke all on function public.enforce_hyperview_session_duration()
from public, anon, authenticated;

-- One physical HyperView venue can run only one active experience at a time.
-- The advisory lock also prevents two concurrent admin requests from creating
-- clashing sessions before either transaction becomes visible to the other.
create or replace function public.prevent_hyperview_session_overlap()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.movie_id is null and new.status <> 'cancelled' then
    perform pg_advisory_xact_lock(hashtextextended(new.venue_id::text, 0));
    if exists (
      select 1
      from public.screenings s
      where s.venue_id = new.venue_id
        and s.id is distinct from new.id
        and s.status <> 'cancelled'
        and s.starts_at < new.starts_at + interval '30 minutes'
        and s.ends_at > new.starts_at
    ) then
      raise exception 'SESSION_TIME_OVERLAP';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_hyperview_session_overlap on public.screenings;
create trigger prevent_hyperview_session_overlap
before insert or update of venue_id, starts_at, ends_at, status, movie_id on public.screenings
for each row execute function public.prevent_hyperview_session_overlap();

revoke all on function public.prevent_hyperview_session_overlap()
from public, anon, authenticated;

revoke execute on function public.public_group_package_prices() from anon, authenticated;

-- Only the new session product is publicly bookable. Historical movie-linked
-- rows remain available to privileged staff for audit and support.
drop policy if exists "visitors read on-sale screenings" on public.screenings;
create policy "visitors read on-sale screenings"
on public.screenings for select to anon, authenticated
using (
  status in ('on_sale', 'sold_out')
  and starts_at > now()
  and sales_end > now()
  and movie_id is null
  and exists (
    select 1 from public.venues v
    where v.id = venue_id and v.is_active
  )
);

-- A session admission always inherits its server-controlled pricing rule. This
-- also covers a ticket type added after its session has already been created.
create or replace function public.enforce_session_ticket_price()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1 from public.screenings s
    where s.id = new.screening_id and s.movie_id is null
  ) then
    new.price_kobo := public.price_for_screening(new.screening_id);
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_session_ticket_price on public.ticket_types;
create trigger enforce_session_ticket_price
before insert or update on public.ticket_types
for each row execute function public.enforce_session_ticket_price();

revoke all on function public.enforce_session_ticket_price()
from public, anon, authenticated;

create or replace function public.public_ticket_availability()
returns table(ticket_type_id uuid, remaining integer)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select tt.id,
    greatest(0, tt.capacity - public.reserved_places_for_ticket_type(tt.id, true))::integer
  from public.ticket_types tt
  join public.screenings s on s.id = tt.screening_id
  join public.venues v on v.id = s.venue_id
  where tt.is_active
    and s.movie_id is null
    and s.status in ('on_sale', 'sold_out')
    and s.sales_start <= now() and s.sales_end > now() and s.starts_at > now()
    and v.is_active;
$$;

create or replace function public.create_hyperview_session_series_v3(
  p_venue_id uuid,
  p_start_date date,
  p_end_date date,
  p_times time[],
  p_capacity integer,
  p_sales_start timestamptz,
  p_pricing_rule_id uuid default null,
  p_open_sales boolean default false
)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_date date;
  v_time time;
  v_starts_at timestamptz;
  v_screening_id uuid;
  v_timezone text;
  v_created integer := 0;
  v_skipped integer := 0;
begin
  if not public.can_manage_catalog() then raise exception 'CATALOGUE_FORBIDDEN'; end if;
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date
    or p_end_date - p_start_date > 31 then raise exception 'INVALID_DATE_RANGE'; end if;
  if p_times is null or cardinality(p_times) not between 1 and 12
    or p_capacity not between 1 and 500 or p_sales_start is null
    then raise exception 'INVALID_SESSION_SERIES'; end if;

  select timezone into v_timezone from public.venues
  where id = p_venue_id and is_active;
  if not found then raise exception 'VENUE_NOT_ACTIVE'; end if;
  if p_pricing_rule_id is not null and not exists (
    select 1 from public.pricing_rules pr
    where pr.id = p_pricing_rule_id and pr.is_active
      and (pr.venue_id is null or pr.venue_id = p_venue_id)
  ) then raise exception 'PRICING_RULE_NOT_AVAILABLE'; end if;

  for v_date in select generate_series(p_start_date, p_end_date, interval '1 day')::date
  loop
    foreach v_time in array p_times loop
      v_starts_at := (v_date + v_time) at time zone v_timezone;
      if v_starts_at <= now() or exists (
        select 1 from public.screenings
        where venue_id = p_venue_id
          and status <> 'cancelled'
          and starts_at < v_starts_at + interval '30 minutes'
          and ends_at > v_starts_at
      ) then
        v_skipped := v_skipped + 1;
        continue;
      end if;

      insert into public.screenings(
        movie_id, session_name, venue_id, pricing_rule_id, starts_at, ends_at,
        sales_start, sales_end, status, admission_opens_minutes, admission_grace_minutes
      ) values (
        null, 'HyperView 9D Flying Cinema Session', p_venue_id, p_pricing_rule_id,
        v_starts_at, v_starts_at + interval '30 minutes',
        least(p_sales_start, v_starts_at - interval '1 minute'), v_starts_at,
        case when p_open_sales then 'on_sale'::public.screening_status
          else 'draft'::public.screening_status end,
        15, 30
      ) returning id into v_screening_id;

      insert into public.ticket_types(
        screening_id, name, description, price_kobo, capacity, is_active
      ) values (
        v_screening_id, 'Session admission',
        'One 30-minute HyperView session with two 15-minute films',
        public.price_for_screening(v_screening_id), p_capacity, true
      );
      v_created := v_created + 1;
    end loop;
  end loop;

  return jsonb_build_object('created', v_created, 'skipped', v_skipped);
end;
$$;

revoke all on function public.create_hyperview_session_series_v3(
  uuid,date,date,time[],integer,timestamptz,uuid,boolean
) from public, anon, authenticated;
grant execute on function public.create_hyperview_session_series_v3(
  uuid,date,date,time[],integer,timestamptz,uuid,boolean
) to authenticated, service_role;

create or replace function public.create_hyperview_session_order_v3(
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
  v_now timestamptz := clock_timestamp();
  v_order_id uuid := gen_random_uuid();
  v_reference text := 'C57-' || upper(replace(gen_random_uuid()::text, '-', ''));
  v_expires_at timestamptz := clock_timestamp() + interval '10 minutes';
  v_ticket_type_id uuid;
  v_quantity integer;
  v_unit_price bigint;
  v_amount_kobo bigint;
  v_capacity integer;
  v_reserved integer;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) <> 1 then raise exception 'INVALID_ITEMS'; end if;
  select item.ticket_type_id, item.quantity into v_ticket_type_id, v_quantity
  from jsonb_to_recordset(p_items) item(ticket_type_id uuid, quantity integer);
  if v_ticket_type_id is null or v_quantity not between 1 and 15
    then raise exception 'INVALID_ITEMS'; end if;
  if p_customer_name is null or length(btrim(p_customer_name)) not between 2 and 120
    or p_customer_email is null or length(p_customer_email) > 254
    or p_customer_phone is null or length(p_customer_phone) > 24
    then raise exception 'INVALID_CUSTOMER'; end if;
  if p_access_token_hash is null or p_access_token_hash !~ '^[0-9a-f]{64}$'
    then raise exception 'INVALID_ACCESS_TOKEN_HASH'; end if;
  if p_policy_version <> 'hyperview-session-v3' or p_policy_accepted_at is null
    or p_policy_accepted_at < v_now - interval '30 minutes'
    or p_policy_accepted_at > v_now + interval '1 minute'
    then raise exception 'POLICY_NOT_ACCEPTED'; end if;

  perform 1 from public.screenings s where s.id = p_screening_id for update;
  if not found then raise exception 'SCREENING_NOT_FOUND'; end if;
  if not exists (
    select 1 from public.screenings s join public.venues v on v.id = s.venue_id
    where s.id = p_screening_id and s.movie_id is null and v.is_active
      and s.status = 'on_sale' and v_now >= s.sales_start
      and v_now < s.sales_end and v_now < s.starts_at
  ) then raise exception 'SCREENING_NOT_ON_SALE'; end if;

  select tt.capacity into v_capacity from public.ticket_types tt
  where tt.id = v_ticket_type_id and tt.screening_id = p_screening_id and tt.is_active
  for update;
  if not found then raise exception 'TICKET_TYPE_NOT_AVAILABLE'; end if;

  v_reserved := public.reserved_places_for_ticket_type(v_ticket_type_id, true);
  if v_reserved + v_quantity > v_capacity then raise exception 'INSUFFICIENT_CAPACITY'; end if;

  v_unit_price := public.price_for_screening(p_screening_id);
  v_amount_kobo := v_unit_price * v_quantity;
  if v_amount_kobo <= 0 or v_amount_kobo > 1000000000
    then raise exception 'INVALID_ORDER_AMOUNT'; end if;

  update public.ticket_types set price_kobo = v_unit_price
  where id = v_ticket_type_id and price_kobo <> v_unit_price;
  insert into public.orders(
    id, reference, user_id, customer_name, customer_email, customer_phone,
    currency, amount_kobo, status, access_token_hash, expires_at,
    policy_version, policy_accepted_at, source, payment_method,
    booking_type, party_size, experience_count
  ) values (
    v_order_id, v_reference, p_user_id, btrim(p_customer_name),
    lower(btrim(p_customer_email)), p_customer_phone, 'NGN', v_amount_kobo,
    'pending', p_access_token_hash, v_expires_at, p_policy_version,
    p_policy_accepted_at, 'online', 'paystack', 'individual', v_quantity, 1
  );
  insert into public.order_items(order_id, ticket_type_id, quantity, unit_price_kobo)
  values (v_order_id, v_ticket_type_id, v_quantity, v_unit_price);

  return jsonb_build_object(
    'order_id', v_order_id, 'reference', v_reference,
    'amount_kobo', v_amount_kobo, 'currency', 'NGN',
    'expires_at', v_expires_at, 'party_size', v_quantity
  );
end;
$$;

revoke all on function public.create_hyperview_session_order_v3(
  uuid,jsonb,text,text,text,text,text,timestamptz,uuid
) from public, anon, authenticated;
grant execute on function public.create_hyperview_session_order_v3(
  uuid,jsonb,text,text,text,text,text,timestamptz,uuid
) to service_role;

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
    'booking_type', 'individual', 'experience_count', 1,
    'session_title', s.session_name, 'movie_title', s.session_name,
    'starts_at', s.starts_at, 'ends_at', s.ends_at,
    'valid_from', s.starts_at - make_interval(mins => s.admission_opens_minutes),
    'valid_until', s.ends_at + make_interval(mins => s.admission_grace_minutes),
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

create or replace function public.get_order_status_by_token(p_reference text, p_access_token_hash text)
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
    'booking_type', 'individual', 'experience_count', 1,
    'session_title', s.session_name, 'movie_title', s.session_name,
    'starts_at', s.starts_at, 'ends_at', s.ends_at,
    'venue_name', v.name, 'venue_city', v.city, 'venue_timezone', v.timezone,
    'itinerary', '[]'::jsonb,
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
  where o.reference = p_reference and o.access_token_hash = p_access_token_hash
  limit 1;
$$;

create or replace function public.get_public_booking_details(p_public_id uuid)
returns jsonb language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'reference', o.reference, 'status', o.status, 'quantity', o.party_size,
    'booking_type', 'individual', 'experience_count', 1,
    'amount_kobo', o.amount_kobo, 'currency', o.currency,
    'arrived_count', count(t.id) filter (where t.arrived_at is not null),
    'admitted_count', count(t.id) filter (where t.checked_in_at is not null),
    'valid_from', min(t.valid_from), 'valid_until', max(t.valid_until),
    'session', jsonb_build_object('title', s.session_name, 'duration_minutes', 30),
    'movie', jsonb_build_object('title', s.session_name, 'poster_path', null,
      'rating', null, 'runtime_minutes', 30),
    'screening', jsonb_build_object('starts_at', s.starts_at, 'ends_at', s.ends_at,
      'status', s.status, 'venue', v.name, 'venue_address', v.address,
      'venue_city', v.city, 'venue_timezone', v.timezone),
    'itinerary', '[]'::jsonb
  )
  from public.orders o
  join public.tickets t on t.order_id = o.id
  join public.screenings s on s.id = t.screening_id
  join public.venues v on v.id = s.venue_id
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
      'arrived_at', t.arrived_at, 'checked_in_at', t.checked_in_at
    ),
    'booking', jsonb_build_object('reference', o.reference, 'public_id', o.public_id),
    'session', jsonb_build_object('title', s.session_name, 'duration_minutes', 30),
    'movie', jsonb_build_object('title', s.session_name, 'poster_path', null,
      'rating', 'Two 15-minute films', 'runtime_minutes', 30),
    'screening', jsonb_build_object(
      'starts_at', s.starts_at, 'ends_at', s.ends_at, 'status', s.status,
      'venue', v.name, 'venue_address', v.address, 'venue_city', v.city,
      'venue_timezone', v.timezone
    )
  )
  from public.tickets t
  join public.orders o on o.id = t.order_id
  join public.screenings s on s.id = t.screening_id
  join public.venues v on v.id = s.venue_id
  join public.ticket_types tt on tt.id = t.ticket_type_id
  where t.public_id = p_public_id;
$$;

create or replace function public.get_public_ticket_details(p_public_id uuid)
returns jsonb language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'ticket', jsonb_build_object(
      'id', t.public_id, 'type', tt.name, 'holder_name', t.holder_name,
      'status', case
        when t.status = 'valid' and now() < t.valid_from then 'not_yet_valid'
        when t.status = 'valid' and now() >= t.valid_until then 'expired'
        else t.status::text end,
      'is_active', t.is_active, 'valid_from', t.valid_from,
      'valid_until', t.valid_until, 'checked_in_at', t.checked_in_at
    ),
    'booking', jsonb_build_object('reference', o.reference, 'public_id', o.public_id),
    'session', jsonb_build_object('title', s.session_name, 'duration_minutes', 30),
    'movie', jsonb_build_object('title', s.session_name, 'poster_path', null,
      'rating', 'Two 15-minute films', 'runtime_minutes', 30),
    'screening', jsonb_build_object(
      'starts_at', s.starts_at, 'ends_at', s.ends_at, 'status', s.status,
      'venue', v.name, 'venue_address', v.address, 'venue_city', v.city,
      'venue_timezone', v.timezone
    )
  )
  from public.tickets t
  join public.orders o on o.id = t.order_id
  join public.screenings s on s.id = t.screening_id
  join public.venues v on v.id = s.venue_id
  join public.ticket_types tt on tt.id = t.ticket_type_id
  where t.public_id = p_public_id and o.status in ('paid', 'refunded', 'cancelled');
$$;

create or replace function public.guard_sold_screening_update()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if old.status = 'cancelled' and new.status <> 'cancelled'
    then raise exception 'CANCELLED_SCREENING_CANNOT_REOPEN'; end if;
  if (new.session_name, new.venue_id, new.starts_at)
      is distinct from (old.session_name, old.venue_id, old.starts_at)
    and exists (
      select 1 from public.order_items oi join public.orders o on o.id = oi.order_id
      join public.ticket_types tt on tt.id = oi.ticket_type_id
      where tt.screening_id = old.id and o.status in ('paid', 'refunded')
    ) then raise exception 'SOLD_SCREENING_DETAILS_IMMUTABLE'; end if;
  return new;
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
    'booking_type', 'individual', 'party_size', o.party_size,
    'experience_count', 1, 'customer_name', o.customer_name,
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
      'showtime', s.starts_at, 'venue', v.name,
      'type', tt.name, 'quantity', oi.quantity,
      'unit_price_kobo', oi.unit_price_kobo, 'included', false
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
    'status', o.status, 'booking_type', 'individual', 'experience_count', 1,
    'customer_name', o.customer_name, 'customer_email', o.customer_email,
    'customer_phone', o.customer_phone, 'amount_kobo', o.amount_kobo,
    'paid_at', o.paid_at, 'arrival_notes', o.arrival_notes,
    'session', s.session_name, 'movie', s.session_name, 'screening_id', s.id,
    'starts_at', s.starts_at, 'ends_at', s.ends_at,
    'screening_status', s.status, 'venue', v.name, 'venue_timezone', v.timezone,
    'quantity', o.party_size, 'itinerary', '[]'::jsonb,
    'arrived_count', (select count(*) from public.tickets t where t.order_id = o.id and t.arrived_at is not null),
    'admitted_count', (select count(*) from public.tickets t where t.order_id = o.id and t.checked_in_at is not null),
    'tickets', (select coalesce(jsonb_agg(jsonb_build_object(
      'public_id', t.public_id, 'status', t.status, 'is_active', t.is_active,
      'arrived_at', t.arrived_at, 'checked_in_at', t.checked_in_at
    ) order by t.created_at), '[]'::jsonb) from public.tickets t where t.order_id = o.id)
  ) order by s.starts_at, o.created_at) from (
    select o.* from public.orders o where o.status in ('paid', 'cancelled', 'refunded') and (
      v_query = '' or o.reference ilike '%' || v_query || '%'
      or o.customer_name ilike '%' || v_query || '%'
      or o.customer_email ilike '%' || v_query || '%'
      or o.customer_phone ilike '%' || v_query || '%'
      or o.public_id::text = v_query
    ) order by o.created_at desc limit greatest(1, least(coalesce(p_limit, 40), 80))
  ) o join public.order_items oi on oi.order_id = o.id
  join public.ticket_types tt on tt.id = oi.ticket_type_id
  join public.screenings s on s.id = tt.screening_id
  join public.venues v on v.id = s.venue_id), '[]'::jsonb);
end;
$$;

create or replace function public.admin_delete_screening(p_actor uuid, p_screening_id uuid)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_title text;
  v_starts_at timestamptz;
  v_order_count integer := 0;
  v_customer_booking_count integer := 0;
  v_ticket_count integer := 0;
begin
  if not exists (select 1 from public.profiles where id = p_actor and role = 'admin')
    then raise exception 'ADMIN_FORBIDDEN'; end if;
  select s.session_name, s.starts_at into v_title, v_starts_at
  from public.screenings s where s.id = p_screening_id for update;
  if not found then raise exception 'SCREENING_NOT_FOUND'; end if;
  perform 1 from public.ticket_types where screening_id = p_screening_id for update;
  select count(distinct oi.order_id)::integer,
    count(distinct oi.order_id) filter (
      where o.paid_at is not null or o.status in ('paid', 'refunded', 'cancelled'))::integer,
    count(distinct t.id)::integer
  into v_order_count, v_customer_booking_count, v_ticket_count
  from public.ticket_types tt
  left join public.order_items oi on oi.ticket_type_id = tt.id
  left join public.orders o on o.id = oi.order_id
  left join public.tickets t on t.order_item_id = oi.id
  where tt.screening_id = p_screening_id;
  if v_order_count > 0 then return jsonb_build_object(
    'deleted', false,
    'reason', case when v_customer_booking_count > 0 or v_ticket_count > 0
      then 'booking_history_exists' else 'checkout_history_exists' end,
    'title', v_title, 'starts_at', v_starts_at, 'order_count', v_order_count,
    'customer_booking_count', v_customer_booking_count, 'ticket_count', v_ticket_count
  ); end if;
  insert into public.catalogue_deletion_audit_log(
    actor_user_id, entity_type, entity_id, entity_title, details
  ) values (p_actor, 'screening', p_screening_id, v_title,
    jsonb_build_object('starts_at', v_starts_at));
  delete from public.screenings where id = p_screening_id;
  return jsonb_build_object('deleted', true, 'entity', 'screening',
    'title', v_title, 'starts_at', v_starts_at);
end;
$$;

select public.sync_screening_sold_out_status();
