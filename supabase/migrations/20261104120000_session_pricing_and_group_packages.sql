-- Session-specific pricing and the 15-person / three-experience group package.
-- Weekdays are Monday-Thursday; weekends are Friday-Sunday in venue local time.

alter table public.pricing_rules
  add column if not exists group_weekday_price_kobo bigint
    check (group_weekday_price_kobo is null or group_weekday_price_kobo > 0),
  add column if not exists group_weekend_price_kobo bigint
    check (group_weekend_price_kobo is null or group_weekend_price_kobo > 0),
  add constraint pricing_rules_group_prices_together check (
    (group_weekday_price_kobo is null) = (group_weekend_price_kobo is null)
  );

alter table public.screenings
  add column if not exists pricing_rule_id uuid
    references public.pricing_rules(id) on delete restrict;

create index if not exists screenings_pricing_rule_idx
on public.screenings(pricing_rule_id);

alter table public.orders
  add column if not exists booking_type text not null default 'individual'
    check (booking_type in ('individual', 'group')),
  add column if not exists party_size integer not null default 1
    check (party_size between 1 and 15),
  add column if not exists experience_count integer not null default 1
    check (experience_count between 1 and 3);

update public.orders o
set party_size = greatest(1, least(15, coalesce((
      select sum(oi.quantity)::integer from public.order_items oi where oi.order_id = o.id
    ), 1))),
    experience_count = 1
where booking_type = 'individual';

alter table public.order_items
  drop constraint if exists order_items_quantity_check;
alter table public.order_items
  add constraint order_items_quantity_check check (quantity between 1 and 15);

create table public.group_booking_sessions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  screening_id uuid not null references public.screenings(id) on delete restrict,
  ticket_type_id uuid not null references public.ticket_types(id) on delete restrict,
  sequence_number integer not null check (sequence_number in (2, 3)),
  party_size integer not null default 15 check (party_size = 15),
  created_at timestamptz not null default now(),
  unique (order_id, sequence_number),
  unique (order_id, screening_id),
  unique (order_id, ticket_type_id)
);

create index group_booking_sessions_ticket_type_idx
on public.group_booking_sessions(ticket_type_id);
create index group_booking_sessions_screening_idx
on public.group_booking_sessions(screening_id);

alter table public.group_booking_sessions enable row level security;
revoke all on public.group_booking_sessions from public, anon, authenticated;
grant select, insert, update on public.group_booking_sessions to service_role;

create or replace function public.price_for_screening(p_screening_id uuid)
returns bigint language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_local_date date;
  v_is_weekend boolean;
  v_price bigint;
  v_venue_id uuid;
  v_selected_rule uuid;
begin
  select (s.starts_at at time zone v.timezone)::date,
         extract(isodow from (s.starts_at at time zone v.timezone)) in (5, 6, 7),
         s.venue_id, s.pricing_rule_id
  into v_local_date, v_is_weekend, v_venue_id, v_selected_rule
  from public.screenings s
  join public.venues v on v.id = s.venue_id
  where s.id = p_screening_id;

  if not found then raise exception 'SCREENING_NOT_FOUND'; end if;

  if v_selected_rule is not null then
    select case when v_is_weekend then pr.weekend_price_kobo else pr.weekday_price_kobo end
    into v_price
    from public.pricing_rules pr
    where pr.id = v_selected_rule and pr.is_active
      and (pr.venue_id is null or pr.venue_id = v_venue_id);
  else
    select case when v_is_weekend then pr.weekend_price_kobo else pr.weekday_price_kobo end
    into v_price
    from public.pricing_rules pr
    where pr.is_active
      and (pr.venue_id = v_venue_id or pr.venue_id is null)
      and pr.effective_from <= v_local_date
      and (pr.effective_until is null or pr.effective_until >= v_local_date)
    order by (pr.venue_id is not null) desc, pr.effective_from desc, pr.created_at desc
    limit 1;
  end if;

  if v_price is null then raise exception 'PRICE_RULE_NOT_FOUND'; end if;
  return v_price;
end;
$$;

create or replace function public.group_price_for_screening(p_screening_id uuid)
returns bigint language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_local_date date;
  v_is_weekend boolean;
  v_price bigint;
  v_venue_id uuid;
  v_selected_rule uuid;
begin
  select (s.starts_at at time zone v.timezone)::date,
         extract(isodow from (s.starts_at at time zone v.timezone)) in (5, 6, 7),
         s.venue_id, s.pricing_rule_id
  into v_local_date, v_is_weekend, v_venue_id, v_selected_rule
  from public.screenings s
  join public.venues v on v.id = s.venue_id
  where s.id = p_screening_id;

  if not found then return null; end if;

  if v_selected_rule is not null then
    select case when v_is_weekend then pr.group_weekend_price_kobo else pr.group_weekday_price_kobo end
    into v_price
    from public.pricing_rules pr
    where pr.id = v_selected_rule and pr.is_active
      and (pr.venue_id is null or pr.venue_id = v_venue_id);
  else
    select case when v_is_weekend then pr.group_weekend_price_kobo else pr.group_weekday_price_kobo end
    into v_price
    from public.pricing_rules pr
    where pr.is_active
      and (pr.venue_id = v_venue_id or pr.venue_id is null)
      and pr.effective_from <= v_local_date
      and (pr.effective_until is null or pr.effective_until >= v_local_date)
    order by (pr.venue_id is not null) desc, pr.effective_from desc, pr.created_at desc
    limit 1;
  end if;

  return v_price;
end;
$$;

revoke all on function public.group_price_for_screening(uuid) from public, anon, authenticated;
grant execute on function public.group_price_for_screening(uuid) to service_role;

drop trigger if exists sync_screening_ticket_prices on public.screenings;
create trigger sync_screening_ticket_prices
after insert or update of starts_at, venue_id, pricing_rule_id on public.screenings
for each row execute function public.sync_screening_ticket_prices();

update public.ticket_types tt
set price_kobo = public.price_for_screening(tt.screening_id)
from public.screenings s
where s.id = tt.screening_id and s.ends_at > now();

create or replace function public.reserved_places_for_ticket_type(
  p_ticket_type_id uuid, p_include_pending boolean default true
)
returns integer language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(reservation.quantity), 0)::integer
  from (
    select oi.quantity
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.ticket_type_id = p_ticket_type_id
      and (o.status = 'paid' or (p_include_pending and o.status = 'pending' and o.expires_at > now()))
    union all
    select gbs.party_size
    from public.group_booking_sessions gbs
    join public.orders o on o.id = gbs.order_id
    where gbs.ticket_type_id = p_ticket_type_id
      and (o.status = 'paid' or (p_include_pending and o.status = 'pending' and o.expires_at > now()))
  ) reservation;
$$;

revoke all on function public.reserved_places_for_ticket_type(uuid, boolean)
from public, anon, authenticated;
grant execute on function public.reserved_places_for_ticket_type(uuid, boolean) to service_role;

create or replace function public.public_ticket_availability()
returns table(ticket_type_id uuid, remaining integer)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select tt.id,
    greatest(0, tt.capacity - public.reserved_places_for_ticket_type(tt.id, true))::integer
  from public.ticket_types tt
  join public.screenings s on s.id = tt.screening_id
  join public.movies m on m.id = s.movie_id
  join public.venues v on v.id = s.venue_id
  where tt.is_active
    and s.status in ('on_sale', 'sold_out')
    and s.sales_start <= now() and s.sales_end > now() and s.starts_at > now()
    and m.status = 'published' and v.is_active;
$$;

create or replace function public.public_group_package_prices()
returns table(screening_id uuid, group_price_kobo bigint)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select s.id, public.group_price_for_screening(s.id)
  from public.screenings s
  join public.movies m on m.id = s.movie_id
  join public.venues v on v.id = s.venue_id
  where s.status = 'on_sale' and s.sales_start <= now()
    and s.sales_end > now() and s.starts_at > now()
    and m.status = 'published' and v.is_active
    and public.group_price_for_screening(s.id) is not null;
$$;

revoke all on function public.public_group_package_prices() from public, anon, authenticated;
grant execute on function public.public_group_package_prices() to anon, authenticated;

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
    where s.status in ('on_sale', 'sold_out') and s.sales_end > now() and s.starts_at > now()
  )
  update public.screenings s
  set status = case when i.has_unsold_places then 'on_sale'::public.screening_status
                    else 'sold_out'::public.screening_status end,
      updated_at = now()
  from inventory i
  where s.id = i.id and ((s.status = 'on_sale' and not i.has_unsold_places)
    or (s.status = 'sold_out' and i.has_unsold_places));
  get diagnostics v_changed = row_count;
  return v_changed;
end;
$$;

create or replace function public.catalogue_session_inventory()
returns table(screening_id uuid, capacity integer, reserved integer, remaining integer)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if not public.can_manage_catalog() then raise exception 'CATALOGUE_FORBIDDEN'; end if;
  return query
  with inventory as (
    select tt.screening_id, sum(tt.capacity)::integer as capacity,
      sum(public.reserved_places_for_ticket_type(tt.id, true))::integer as reserved
    from public.ticket_types tt where tt.is_active group by tt.screening_id
  )
  select s.id, coalesce(i.capacity, 0), coalesce(i.reserved, 0),
    greatest(0, coalesce(i.capacity, 0) - coalesce(i.reserved, 0))::integer
  from public.screenings s left join inventory i on i.screening_id = s.id;
end;
$$;

create or replace function public.guard_ticket_type_capacity()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_reserved integer;
begin
  if new.screening_id <> old.screening_id then raise exception 'TICKET_TYPE_SCREENING_IMMUTABLE'; end if;
  if new.capacity < old.capacity then
    v_reserved := public.reserved_places_for_ticket_type(new.id, true);
    if new.capacity < v_reserved then raise exception 'CAPACITY_BELOW_RESERVED'; end if;
  end if;
  return new;
end;
$$;

create or replace function public.create_hyperview_session_series_v2(
  p_movie_id uuid,
  p_venue_id uuid,
  p_start_date date,
  p_end_date date,
  p_times time[],
  p_duration_minutes integer,
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
        select 1 from public.screenings where movie_id = p_movie_id
          and venue_id = p_venue_id and starts_at = v_starts_at
          and status <> 'cancelled'
      ) then
        v_skipped := v_skipped + 1;
        continue;
      end if;

      insert into public.screenings(
        movie_id, venue_id, pricing_rule_id, starts_at, ends_at,
        sales_start, sales_end, status, admission_opens_minutes, admission_grace_minutes
      ) values (
        p_movie_id, p_venue_id, p_pricing_rule_id, v_starts_at,
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

revoke all on function public.create_hyperview_session_series_v2(
  uuid,uuid,date,date,time[],integer,integer,timestamptz,uuid,boolean
) from public, anon, authenticated;
grant execute on function public.create_hyperview_session_series_v2(
  uuid,uuid,date,date,time[],integer,integer,timestamptz,uuid,boolean
) to authenticated, service_role;

create or replace function public.create_hyperview_pending_order_v2(
  p_booking_type text,
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
  v_item record;
  v_primary_ticket_type uuid;
  v_screening_ids uuid[];
  v_movie_ids uuid[];
  v_venue_ids uuid[];
  v_starts timestamptz[];
  v_ends timestamptz[];
  v_local_dates date[];
  v_amount_kobo bigint;
  v_reserved integer;
  v_item_count integer;
begin
  if p_booking_type not in ('individual', 'group') or p_items is null
    or jsonb_typeof(p_items) <> 'array' then raise exception 'INVALID_ITEMS'; end if;
  v_item_count := jsonb_array_length(p_items);
  if (p_booking_type = 'individual' and v_item_count <> 1)
    or (p_booking_type = 'group' and v_item_count <> 3) then raise exception 'INVALID_ITEMS'; end if;
  if p_customer_name is null or length(btrim(p_customer_name)) not between 2 and 120
    or p_customer_email is null or length(p_customer_email) > 254
    or p_customer_phone is null or length(p_customer_phone) > 24 then raise exception 'INVALID_CUSTOMER'; end if;
  if p_access_token_hash is null or p_access_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_ACCESS_TOKEN_HASH'; end if;
  if p_policy_version <> 'hyperview-booking-v2' or p_policy_accepted_at is null
    or p_policy_accepted_at < v_now - interval '30 minutes'
    or p_policy_accepted_at > v_now + interval '1 minute' then raise exception 'POLICY_NOT_ACCEPTED'; end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) entry
    where (entry->>'ticket_type_id') is null or (entry->>'quantity') is null
  ) then raise exception 'INVALID_ITEMS'; end if;

  if (select count(distinct entry->>'ticket_type_id') from jsonb_array_elements(p_items) entry) <> v_item_count
    then raise exception 'INVALID_ITEMS'; end if;

  perform 1 from public.ticket_types tt
  where tt.id in (select (entry->>'ticket_type_id')::uuid from jsonb_array_elements(p_items) entry)
  order by tt.id for update;
  if (select count(*) from public.ticket_types tt
      where tt.id in (select (entry->>'ticket_type_id')::uuid from jsonb_array_elements(p_items) entry)) <> v_item_count
    then raise exception 'TICKET_TYPE_NOT_AVAILABLE'; end if;

  with selected as (
    select (entry.value->>'ticket_type_id')::uuid ticket_type_id,
      (entry.value->>'quantity')::integer quantity, entry.position::integer position
    from jsonb_array_elements(p_items) with ordinality entry(value, position)
  )
  select array_agg(s.id order by x.position), array_agg(s.movie_id order by x.position),
    array_agg(s.venue_id order by x.position), array_agg(s.starts_at order by x.position),
    array_agg(s.ends_at order by x.position),
    array_agg((s.starts_at at time zone v.timezone)::date order by x.position),
    (array_agg(x.ticket_type_id order by x.position))[1]
  into v_screening_ids, v_movie_ids, v_venue_ids, v_starts, v_ends, v_local_dates,
    v_primary_ticket_type
  from selected x
  join public.ticket_types tt on tt.id = x.ticket_type_id and tt.is_active
  join public.screenings s on s.id = tt.screening_id
  join public.venues v on v.id = s.venue_id and v.is_active
  join public.movies m on m.id = s.movie_id and m.status = 'published'
  where s.status = 'on_sale' and v_now >= s.sales_start
    and v_now < s.sales_end and v_now < s.starts_at;

  if coalesce(cardinality(v_screening_ids), 0) <> v_item_count then raise exception 'SCREENING_NOT_ON_SALE'; end if;
  if v_screening_ids[1] <> p_screening_id then raise exception 'INVALID_PRIMARY_SCREENING'; end if;

  if p_booking_type = 'individual' then
    if (p_items->0->>'quantity')::integer not between 1 and 8 then raise exception 'INVALID_ITEMS'; end if;
    v_amount_kobo := public.price_for_screening(p_screening_id)
      * (p_items->0->>'quantity')::integer;
  else
    if exists (select 1 from jsonb_array_elements(p_items) entry where (entry->>'quantity')::integer <> 15)
      then raise exception 'INVALID_GROUP_SIZE'; end if;
    if (select count(distinct value) from unnest(v_screening_ids) value) <> 3
      or (select count(distinct value) from unnest(v_movie_ids) value) <> 3
      or (select count(distinct value) from unnest(v_venue_ids) value) <> 1
      or (select count(distinct value) from unnest(v_local_dates) value) <> 1
      or v_starts[2] < v_ends[1] or v_starts[3] < v_ends[2]
      then raise exception 'INVALID_GROUP_ITINERARY'; end if;
    v_amount_kobo := public.group_price_for_screening(p_screening_id);
    if v_amount_kobo is null then raise exception 'GROUP_PRICE_NOT_CONFIGURED'; end if;
  end if;

  for v_item in
    select (entry.value->>'ticket_type_id')::uuid ticket_type_id,
      (entry.value->>'quantity')::integer quantity, entry.position::integer position
    from jsonb_array_elements(p_items) with ordinality entry(value, position)
    order by entry.position
  loop
    v_reserved := public.reserved_places_for_ticket_type(v_item.ticket_type_id, true);
    if v_reserved + v_item.quantity > (select capacity from public.ticket_types where id = v_item.ticket_type_id)
      then raise exception 'INSUFFICIENT_CAPACITY'; end if;
  end loop;

  if v_amount_kobo <= 0 or v_amount_kobo > 1000000000 then raise exception 'INVALID_ORDER_AMOUNT'; end if;

  insert into public.orders (
    id, reference, user_id, customer_name, customer_email, customer_phone,
    currency, amount_kobo, status, access_token_hash, expires_at,
    policy_version, policy_accepted_at, source, payment_method,
    booking_type, party_size, experience_count
  ) values (
    v_order_id, v_reference, p_user_id, btrim(p_customer_name), lower(btrim(p_customer_email)),
    p_customer_phone, 'NGN', v_amount_kobo, 'pending', p_access_token_hash, v_expires_at,
    p_policy_version, p_policy_accepted_at, 'online', 'paystack', p_booking_type,
    case when p_booking_type = 'group' then 15 else (p_items->0->>'quantity')::integer end,
    case when p_booking_type = 'group' then 3 else 1 end
  );

  if p_booking_type = 'individual' then
    insert into public.order_items(order_id, ticket_type_id, quantity, unit_price_kobo)
    values (v_order_id, v_primary_ticket_type, (p_items->0->>'quantity')::integer,
      public.price_for_screening(p_screening_id));
    update public.ticket_types set price_kobo = public.price_for_screening(p_screening_id)
    where id = v_primary_ticket_type and price_kobo <> public.price_for_screening(p_screening_id);
  else
    insert into public.order_items(order_id, ticket_type_id, quantity, unit_price_kobo)
    values (v_order_id, v_primary_ticket_type, 15, 0);
    insert into public.group_booking_sessions(order_id, screening_id, ticket_type_id, sequence_number)
    select v_order_id, v_screening_ids[position::integer],
      (entry.value->>'ticket_type_id')::uuid, position::integer
    from jsonb_array_elements(p_items) with ordinality entry(value, position)
    where position in (2, 3);
  end if;

  return jsonb_build_object('order_id', v_order_id, 'reference', v_reference,
    'amount_kobo', v_amount_kobo, 'currency', 'NGN', 'expires_at', v_expires_at,
    'booking_type', p_booking_type, 'party_size', case when p_booking_type = 'group' then 15 else (p_items->0->>'quantity')::integer end);
end;
$$;

revoke all on function public.create_hyperview_pending_order_v2(
  text,uuid,jsonb,text,text,text,text,text,timestamptz,uuid
) from public, anon, authenticated;
grant execute on function public.create_hyperview_pending_order_v2(
  text,uuid,jsonb,text,text,text,text,text,timestamptz,uuid
) to service_role;

create or replace function public.booking_itinerary(p_order_id uuid)
returns jsonb language sql stable security definer
set search_path = public, pg_temp
as $$
  with itinerary as (
    select 1 as sequence_number, s.id screening_id, s.starts_at, s.ends_at,
      m.title movie_title, m.poster_path, v.id venue_id, v.name venue_name,
      v.address venue_address, v.city venue_city, v.timezone venue_timezone
    from public.order_items oi
    join public.ticket_types tt on tt.id = oi.ticket_type_id
    join public.screenings s on s.id = tt.screening_id
    join public.movies m on m.id = s.movie_id
    join public.venues v on v.id = s.venue_id
    where oi.order_id = p_order_id
    limit 1
  ), all_sessions as (
    select * from itinerary
    union all
    select gbs.sequence_number, s.id, s.starts_at, s.ends_at,
      m.title, m.poster_path, v.id, v.name, v.address, v.city, v.timezone
    from public.group_booking_sessions gbs
    join public.screenings s on s.id = gbs.screening_id
    join public.movies m on m.id = s.movie_id
    join public.venues v on v.id = s.venue_id
    where gbs.order_id = p_order_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'sequence', sequence_number, 'screening_id', screening_id,
    'movie_title', movie_title, 'poster_path', poster_path,
    'starts_at', starts_at, 'ends_at', ends_at,
    'venue_id', venue_id, 'venue_name', venue_name, 'venue_address', venue_address,
    'venue_city', venue_city, 'venue_timezone', venue_timezone
  ) order by sequence_number), '[]'::jsonb) from all_sessions;
$$;

revoke all on function public.booking_itinerary(uuid) from public, anon, authenticated;
grant execute on function public.booking_itinerary(uuid) to service_role;

create or replace function public.booking_valid_until(p_order_id uuid)
returns timestamptz language sql stable security definer
set search_path = public, pg_temp
as $$
  with booked_sessions as (
    select s.ends_at, s.admission_grace_minutes
    from public.order_items oi
    join public.ticket_types tt on tt.id = oi.ticket_type_id
    join public.screenings s on s.id = tt.screening_id
    where oi.order_id = p_order_id
    union all
    select s.ends_at, s.admission_grace_minutes
    from public.group_booking_sessions gbs
    join public.screenings s on s.id = gbs.screening_id
    where gbs.order_id = p_order_id
  )
  select max(ends_at + make_interval(mins => admission_grace_minutes))
  from booked_sessions;
$$;

revoke all on function public.booking_valid_until(uuid) from public, anon, authenticated;
grant execute on function public.booking_valid_until(uuid) to service_role;

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
    'movie_title', p.movie_title, 'starts_at', p.starts_at, 'ends_at', p.ends_at,
    'valid_from', p.starts_at - make_interval(mins => p.admission_opens_minutes),
    'valid_until', public.booking_valid_until(o.id),
    'venue_name', p.venue_name, 'venue_address', p.venue_address,
    'venue_city', p.venue_city, 'venue_timezone', p.venue_timezone,
    'itinerary', public.booking_itinerary(o.id),
    'email_delivery_id', ed.id, 'email_delivery_status', ed.status,
    'tickets', coalesce((select jsonb_agg(jsonb_build_object(
      'public_id', t.public_id, 'ticket_type', tt.name, 'status', t.status,
      'valid_from', t.valid_from, 'valid_until', t.valid_until
    ) order by t.created_at, t.public_id)
      from public.tickets t join public.ticket_types tt on tt.id = t.ticket_type_id
      where t.order_id = o.id), '[]'::jsonb)
  )
  from public.orders o
  cross join lateral (
    select m.title movie_title, s.id screening_id, s.starts_at, s.ends_at,
      s.admission_opens_minutes,
      v.name venue_name, v.address venue_address, v.city venue_city, v.timezone venue_timezone
    from public.order_items oi join public.ticket_types tt on tt.id = oi.ticket_type_id
    join public.screenings s on s.id = tt.screening_id join public.movies m on m.id = s.movie_id
    join public.venues v on v.id = s.venue_id where oi.order_id = o.id limit 1
  ) p
  left join public.email_deliveries ed on ed.order_id = o.id and ed.template = 'ticket-confirmation'
  where o.id = p_order_id;
$$;

create or replace function public.process_paystack_charge_success(
  p_event_key text,
  p_order_reference text,
  p_provider_reference text,
  p_amount_kobo bigint,
  p_currency text,
  p_payload jsonb
)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_event_id uuid;
  v_order public.orders%rowtype;
  v_item record;
  v_reserved integer;
  v_email_delivery_id uuid;
  v_valid_from timestamptz;
  v_valid_until timestamptz;
begin
  insert into public.webhook_events(provider_event_key, event_type, payload)
  values (p_event_key, 'charge.success', p_payload)
  on conflict (provider_event_key) do nothing
  returning id into v_event_id;

  select o.* into v_order from public.orders o
  where o.reference = p_order_reference for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;

  if v_event_id is null then
    return public.payment_order_payload(v_order.id, 'already_processed');
  end if;

  if p_amount_kobo <> v_order.amount_kobo or upper(p_currency) <> v_order.currency then
    insert into public.payments(
      order_id, provider, provider_reference, currency, amount_kobo,
      status, verified_at, payload
    ) values (
      v_order.id, 'paystack', p_provider_reference, upper(p_currency),
      p_amount_kobo, 'amount_mismatch', now(), p_payload
    ) on conflict (provider_reference) do nothing;
    update public.orders set status = 'payment_review', updated_at = now()
    where id = v_order.id and status <> 'paid';
    update public.webhook_events set processed_at = now() where id = v_event_id;
    return public.payment_order_payload(v_order.id, 'payment_review');
  end if;

  if v_order.status = 'paid' then
    update public.webhook_events set processed_at = now() where id = v_event_id;
    return public.payment_order_payload(v_order.id, 'already_paid');
  end if;
  if v_order.status in ('cancelled', 'refunded', 'payment_review') then
    update public.webhook_events set processed_at = now() where id = v_event_id;
    return public.payment_order_payload(v_order.id, 'payment_review');
  end if;

  -- Lock the complete itinerary in a deterministic order before the final
  -- capacity check. This includes group experiences two and three.
  perform 1 from public.ticket_types tt
  where tt.id in (
    select oi.ticket_type_id from public.order_items oi where oi.order_id = v_order.id
    union
    select gbs.ticket_type_id from public.group_booking_sessions gbs where gbs.order_id = v_order.id
  )
  order by tt.id for update;

  for v_item in
    with current_reservations as (
      select oi.ticket_type_id, oi.quantity
      from public.order_items oi where oi.order_id = v_order.id
      union all
      select gbs.ticket_type_id, gbs.party_size
      from public.group_booking_sessions gbs where gbs.order_id = v_order.id
    )
    select cr.ticket_type_id, cr.quantity, tt.capacity
    from current_reservations cr
    join public.ticket_types tt on tt.id = cr.ticket_type_id
    order by cr.ticket_type_id
  loop
    select coalesce(sum(other_reservation.quantity), 0)::integer
    into v_reserved
    from (
      select oi.order_id, oi.quantity
      from public.order_items oi where oi.ticket_type_id = v_item.ticket_type_id
      union all
      select gbs.order_id, gbs.party_size
      from public.group_booking_sessions gbs where gbs.ticket_type_id = v_item.ticket_type_id
    ) other_reservation
    join public.orders other_order on other_order.id = other_reservation.order_id
    where other_order.id <> v_order.id
      and (other_order.status = 'paid'
        or (other_order.status = 'pending' and other_order.expires_at > clock_timestamp()));

    if v_reserved + v_item.quantity > v_item.capacity then
      insert into public.payments(
        order_id, provider, provider_reference, currency, amount_kobo,
        status, verified_at, payload
      ) values (
        v_order.id, 'paystack', p_provider_reference, upper(p_currency),
        p_amount_kobo, 'success_unfulfilled', now(), p_payload
      ) on conflict (provider_reference) do nothing;
      update public.orders set status = 'payment_review', updated_at = now()
      where id = v_order.id;
      update public.webhook_events set processed_at = now() where id = v_event_id;
      return public.payment_order_payload(v_order.id, 'payment_review');
    end if;
  end loop;

  insert into public.payments(
    order_id, provider, provider_reference, currency, amount_kobo,
    status, verified_at, payload
  ) values (
    v_order.id, 'paystack', p_provider_reference, upper(p_currency),
    p_amount_kobo, 'success', now(), p_payload
  ) on conflict (provider_reference) do nothing;

  update public.orders set status = 'paid', paid_at = coalesce(paid_at, now()),
    updated_at = now() where id = v_order.id;

  select s.starts_at - make_interval(mins => s.admission_opens_minutes),
    s.ends_at + make_interval(mins => s.admission_grace_minutes)
  into v_valid_from, v_valid_until
  from public.order_items oi
  join public.ticket_types tt on tt.id = oi.ticket_type_id
  join public.screenings s on s.id = tt.screening_id
  where oi.order_id = v_order.id limit 1;

  -- The group receives 15 digital admissions for reception registration.
  -- Experiences two and three are represented by the itinerary and physical
  -- tags issued on arrival; they do not create another 30 customer QR codes.
  insert into public.tickets(
    order_id, order_item_id, screening_id, ticket_type_id,
    holder_name, holder_email, status, is_active, valid_from, valid_until
  )
  select v_order.id, oi.id, tt.screening_id, oi.ticket_type_id,
    v_order.customer_name, v_order.customer_email, 'valid', true,
    v_valid_from, v_valid_until
  from public.order_items oi
  join public.ticket_types tt on tt.id = oi.ticket_type_id
  cross join lateral generate_series(1, oi.quantity)
  where oi.order_id = v_order.id
    and not exists (select 1 from public.tickets existing where existing.order_id = v_order.id);

  insert into public.email_deliveries(order_id, recipient, template, status)
  values (v_order.id, v_order.customer_email, 'ticket-confirmation', 'pending')
  on conflict (order_id, template) do update set recipient = excluded.recipient
  returning id into v_email_delivery_id;

  update public.webhook_events set processed_at = now() where id = v_event_id;
  return public.payment_order_payload(v_order.id, 'paid');
end;
$$;

create or replace function public.get_order_status_by_token(p_reference text, p_access_token_hash text)
returns jsonb language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'booking_public_id', o.public_id, 'reference', o.reference,
    'status', case when o.status = 'pending' and o.expires_at <= now() then 'expired' else o.status::text end,
    'amount_kobo', o.amount_kobo, 'currency', o.currency, 'expires_at', o.expires_at,
    'paid_at', o.paid_at, 'customer_name', o.customer_name, 'quantity', o.party_size,
    'booking_type', o.booking_type, 'experience_count', o.experience_count,
    'movie_title', p.movie_title, 'starts_at', p.starts_at, 'ends_at', p.ends_at,
    'venue_name', p.venue_name, 'venue_city', p.venue_city,
    'venue_timezone', p.venue_timezone,
    'valid_until', public.booking_valid_until(o.id),
    'itinerary', public.booking_itinerary(o.id),
    'tickets', coalesce((select jsonb_agg(jsonb_build_object(
      'public_id', t.public_id, 'status', t.status, 'is_active', t.is_active,
      'valid_from', t.valid_from, 'valid_until', t.valid_until, 'ticket_type', tt.name
    ) order by t.created_at, t.public_id)
      from public.tickets t join public.ticket_types tt on tt.id = t.ticket_type_id
      where t.order_id = o.id), '[]'::jsonb)
  )
  from public.orders o
  cross join lateral (
    select m.title movie_title, s.starts_at, s.ends_at,
      v.name venue_name, v.city venue_city, v.timezone venue_timezone
    from public.order_items oi join public.ticket_types tt on tt.id = oi.ticket_type_id
    join public.screenings s on s.id = tt.screening_id join public.movies m on m.id = s.movie_id
    join public.venues v on v.id = s.venue_id where oi.order_id = o.id limit 1
  ) p
  where o.reference = p_reference and o.access_token_hash = p_access_token_hash;
$$;

create or replace function public.get_public_booking_details(p_public_id uuid)
returns jsonb language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'reference', o.reference, 'status', o.status, 'quantity', o.party_size,
    'booking_type', o.booking_type, 'experience_count', o.experience_count,
    'amount_kobo', o.amount_kobo, 'currency', o.currency,
    'arrived_count', (select count(*) from public.tickets t where t.order_id = o.id and t.arrived_at is not null),
    'admitted_count', (select count(*) from public.tickets t where t.order_id = o.id and t.checked_in_at is not null),
    'valid_from', p.starts_at - make_interval(mins => p.admission_opens_minutes),
    'valid_until', public.booking_valid_until(o.id),
    'movie', jsonb_build_object('title', p.movie_title, 'poster_path', p.poster_path,
      'rating', p.rating, 'runtime_minutes', p.runtime_minutes),
    'screening', jsonb_build_object('starts_at', p.starts_at, 'ends_at', p.ends_at,
      'status', p.screening_status, 'venue', p.venue_name,
      'venue_address', p.venue_address, 'venue_city', p.venue_city,
      'venue_timezone', p.venue_timezone),
    'itinerary', public.booking_itinerary(o.id)
  )
  from public.orders o
  cross join lateral (
    select m.title movie_title, m.poster_path, m.rating, m.runtime_minutes,
      s.starts_at, s.ends_at, s.status screening_status,
      s.admission_opens_minutes, s.admission_grace_minutes,
      v.name venue_name, v.address venue_address, v.city venue_city, v.timezone venue_timezone
    from public.order_items oi join public.ticket_types tt on tt.id = oi.ticket_type_id
    join public.screenings s on s.id = tt.screening_id join public.movies m on m.id = s.movie_id
    join public.venues v on v.id = s.venue_id where oi.order_id = o.id limit 1
  ) p
  where o.public_id = p_public_id and o.status in ('paid', 'refunded', 'cancelled');
$$;

create or replace function public.sync_screening_ticket_status()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from new.status then
    update public.tickets set status = 'cancelled', is_active = false
    where screening_id = new.id and status = 'valid';
    update public.tickets set status = 'cancelled', is_active = false
    where order_id in (
      select order_id from public.group_booking_sessions where screening_id = new.id
    ) and status = 'valid';
    update public.orders set status = 'cancelled', updated_at = now()
    where booking_type = 'group' and id in (
      select order_id from public.group_booking_sessions where screening_id = new.id
      union
      select oi.order_id from public.order_items oi
      join public.ticket_types tt on tt.id = oi.ticket_type_id
      where tt.screening_id = new.id
    )
      and status in ('pending', 'paid');
  end if;
  return new;
end;
$$;

create or replace function public.guard_sold_screening_update()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if old.status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'CANCELLED_SCREENING_CANNOT_REOPEN';
  end if;
  if (new.movie_id, new.venue_id, new.starts_at, new.ends_at)
      is distinct from (old.movie_id, old.venue_id, old.starts_at, old.ends_at)
    and (
      exists (
        select 1 from public.order_items oi join public.orders o on o.id = oi.order_id
        join public.ticket_types tt on tt.id = oi.ticket_type_id
        where tt.screening_id = old.id and o.status in ('paid', 'refunded')
      ) or exists (
        select 1 from public.group_booking_sessions gbs
        join public.orders o on o.id = gbs.order_id
        where gbs.screening_id = old.id and o.status in ('paid', 'refunded')
      )
    ) then raise exception 'SOLD_SCREENING_DETAILS_IMMUTABLE';
  end if;
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
  if not exists (select 1 from public.profiles where id = p_actor and role = 'admin') then
    raise exception 'ADMIN_FORBIDDEN';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id', o.id, 'reference', o.reference, 'status', o.status,
    'booking_type', o.booking_type, 'party_size', o.party_size,
    'experience_count', o.experience_count,
    'customer_name', o.customer_name, 'customer_email', o.customer_email,
    'customer_phone', o.customer_phone, 'amount_kobo', o.amount_kobo,
    'currency', o.currency, 'created_at', o.created_at, 'paid_at', o.paid_at,
    'expires_at', o.expires_at, 'itinerary', public.booking_itinerary(o.id),
    'payment', (select jsonb_build_object('status', p.status,
      'provider_reference', p.provider_reference, 'verified_at', p.verified_at)
      from public.payments p where p.order_id = o.id order by p.created_at desc limit 1),
    'email', (select jsonb_build_object('status', ed.status, 'attempts', ed.attempts,
      'last_error', ed.last_error, 'sent_at', ed.sent_at)
      from public.email_deliveries ed where ed.order_id = o.id order by ed.created_at desc limit 1),
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
      'movie', item.movie, 'showtime', item.showtime, 'venue', item.venue,
      'type', item.type, 'quantity', item.quantity,
      'unit_price_kobo', item.unit_price_kobo, 'included', item.included
    ) order by item.sequence_number), '[]'::jsonb) from (
      select 1 sequence_number, m.title movie, s.starts_at showtime, v.name venue,
        case when o.booking_type = 'group' then 'Group package' else tt.name end type,
        o.party_size quantity, case when o.booking_type = 'group' then o.amount_kobo else oi.unit_price_kobo end unit_price_kobo,
        false included
      from public.order_items oi join public.ticket_types tt on tt.id = oi.ticket_type_id
      join public.screenings s on s.id = tt.screening_id join public.movies m on m.id = s.movie_id
      join public.venues v on v.id = s.venue_id where oi.order_id = o.id
      union all
      select gbs.sequence_number, m.title, s.starts_at, v.name,
        'Included group experience', gbs.party_size, 0, true
      from public.group_booking_sessions gbs join public.screenings s on s.id = gbs.screening_id
      join public.movies m on m.id = s.movie_id join public.venues v on v.id = s.venue_id
      where gbs.order_id = o.id
    ) item),
    'tickets', (select coalesce(jsonb_agg(jsonb_build_object(
      'public_id', t.public_id, 'status', t.status, 'is_active', t.is_active,
      'checked_in_at', t.checked_in_at) order by t.created_at), '[]'::jsonb)
      from public.tickets t where t.order_id = o.id)
  ) order by o.created_at desc) from (
    select * from public.orders o where v_query = ''
      or o.reference ilike '%' || v_query || '%' or o.customer_email ilike '%' || v_query || '%'
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
    and role in ('cashier', 'supervisor', 'check_in_staff', 'admin')) then
    raise exception 'OPERATIONS_FORBIDDEN';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id', o.id, 'public_id', o.public_id, 'reference', o.reference,
    'status', o.status, 'booking_type', o.booking_type,
    'experience_count', o.experience_count, 'customer_name', o.customer_name,
    'customer_email', o.customer_email, 'customer_phone', o.customer_phone,
    'amount_kobo', o.amount_kobo, 'paid_at', o.paid_at,
    'arrival_notes', o.arrival_notes, 'movie', m.title,
    'screening_id', s.id, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
    'screening_status', s.status, 'venue', v.name, 'venue_timezone', v.timezone,
    'quantity', o.party_size, 'itinerary', public.booking_itinerary(o.id),
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
  join public.movies m on m.id = s.movie_id join public.venues v on v.id = s.venue_id), '[]'::jsonb);
end;
$$;

-- A session used as experience two or three is not present in order_items, so the
-- deletion guard must include group package reservations explicitly.
create or replace function public.admin_delete_screening(
  p_actor uuid,
  p_screening_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_movie_title text;
  v_starts_at timestamptz;
  v_order_count integer := 0;
  v_group_order_count integer := 0;
  v_customer_booking_count integer := 0;
  v_group_customer_booking_count integer := 0;
  v_ticket_count integer := 0;
begin
  if not exists (
    select 1 from public.profiles where id = p_actor and role = 'admin'
  ) then
    raise exception 'ADMIN_FORBIDDEN';
  end if;

  select m.title, s.starts_at
  into v_movie_title, v_starts_at
  from public.screenings s
  join public.movies m on m.id = s.movie_id
  where s.id = p_screening_id
  for update of s;

  if not found then raise exception 'SCREENING_NOT_FOUND'; end if;

  perform 1 from public.ticket_types
  where screening_id = p_screening_id
  for update;

  select count(distinct oi.order_id)::integer,
    count(distinct oi.order_id) filter (
      where o.paid_at is not null or o.status in ('paid', 'refunded', 'cancelled')
    )::integer,
    count(distinct t.id)::integer
  into v_order_count, v_customer_booking_count, v_ticket_count
  from public.ticket_types tt
  left join public.order_items oi on oi.ticket_type_id = tt.id
  left join public.orders o on o.id = oi.order_id
  left join public.tickets t on t.order_item_id = oi.id
  where tt.screening_id = p_screening_id;

  select count(distinct gbs.order_id)::integer,
    count(distinct gbs.order_id) filter (
      where o.paid_at is not null or o.status in ('paid', 'refunded', 'cancelled')
    )::integer
  into v_group_order_count, v_group_customer_booking_count
  from public.group_booking_sessions gbs
  join public.orders o on o.id = gbs.order_id
  where gbs.screening_id = p_screening_id;

  if v_order_count + v_group_order_count > 0 then
    return jsonb_build_object(
      'deleted', false,
      'reason', case
        when v_customer_booking_count + v_group_customer_booking_count > 0 or v_ticket_count > 0
          then 'booking_history_exists'
        else 'checkout_history_exists'
      end,
      'title', v_movie_title,
      'starts_at', v_starts_at,
      'order_count', v_order_count + v_group_order_count,
      'group_order_count', v_group_order_count,
      'customer_booking_count', v_customer_booking_count + v_group_customer_booking_count,
      'ticket_count', v_ticket_count
    );
  end if;

  insert into public.catalogue_deletion_audit_log (
    actor_user_id, entity_type, entity_id, entity_title, details
  ) values (
    p_actor, 'screening', p_screening_id, v_movie_title,
    jsonb_build_object('starts_at', v_starts_at)
  );

  delete from public.screenings where id = p_screening_id;

  return jsonb_build_object(
    'deleted', true, 'entity', 'screening',
    'title', v_movie_title, 'starts_at', v_starts_at
  );
end;
$$;

-- Existing sessions without an explicit rule continue to use the effective-date fallback.
select public.sync_screening_sold_out_status();

