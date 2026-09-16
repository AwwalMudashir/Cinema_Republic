create table public.checkout_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1 check (request_count > 0),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.checkout_rate_limits enable row level security;

create unique index email_deliveries_order_template_idx
on public.email_deliveries (order_id, template);

create or replace function public.check_checkout_rate_limit(
  p_key_hash text,
  p_limit integer default 5,
  p_window_seconds integer default 600,
  p_block_seconds integer default 900
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.checkout_rate_limits%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if p_key_hash is null or length(p_key_hash) <> 64 then
    raise exception 'INVALID_RATE_LIMIT_KEY';
  end if;

  if p_limit < 1 or p_window_seconds < 1 or p_block_seconds < 1 then
    raise exception 'INVALID_RATE_LIMIT_CONFIGURATION';
  end if;

  insert into public.checkout_rate_limits (key_hash)
  values (p_key_hash)
  on conflict (key_hash) do nothing
  returning * into v_row;

  if found then
    return true;
  end if;

  select *
  into v_row
  from public.checkout_rate_limits
  where key_hash = p_key_hash
  for update;

  if v_row.blocked_until is not null and v_row.blocked_until > v_now then
    return false;
  end if;

  if v_row.window_started_at <= v_now - make_interval(secs => p_window_seconds) then
    update public.checkout_rate_limits
    set window_started_at = v_now,
        request_count = 1,
        blocked_until = null,
        updated_at = v_now
    where key_hash = p_key_hash;
    return true;
  end if;

  if v_row.request_count >= p_limit then
    update public.checkout_rate_limits
    set request_count = request_count + 1,
        blocked_until = v_now + make_interval(secs => p_block_seconds),
        updated_at = v_now
    where key_hash = p_key_hash;
    return false;
  end if;

  update public.checkout_rate_limits
  set request_count = request_count + 1,
      updated_at = v_now
  where key_hash = p_key_hash;

  return true;
end;
$$;

create or replace function public.create_pending_order(
  p_screening_id uuid,
  p_items jsonb,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_access_token_hash text,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_screening public.screenings%rowtype;
  v_ticket_type public.ticket_types%rowtype;
  v_item record;
  v_order_id uuid := gen_random_uuid();
  v_reference text := 'C57-' || upper(replace(gen_random_uuid()::text, '-', ''));
  v_expires_at timestamptz := clock_timestamp() + interval '10 minutes';
  v_now timestamptz := clock_timestamp();
  v_amount_kobo bigint := 0;
  v_reserved integer;
  v_item_count integer;
  v_distinct_item_count integer;
  v_total_quantity integer;
begin
  if p_items is null
    or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) = 0
    or jsonb_array_length(p_items) > 8 then
    raise exception 'INVALID_ITEMS';
  end if;

  select
    count(*),
    count(distinct parsed.ticket_type_id),
    coalesce(sum(parsed.quantity), 0)
  into v_item_count, v_distinct_item_count, v_total_quantity
  from jsonb_to_recordset(p_items) as parsed(ticket_type_id uuid, quantity integer);

  if v_item_count <> jsonb_array_length(p_items)
    or v_item_count <> v_distinct_item_count
    or v_total_quantity < 1
    or v_total_quantity > 8
    or exists (
      select 1
      from jsonb_to_recordset(p_items) as parsed(ticket_type_id uuid, quantity integer)
      where parsed.ticket_type_id is null
        or parsed.quantity is null
        or parsed.quantity < 1
        or parsed.quantity > 8
    ) then
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

  select s.*
  into v_screening
  from public.screenings as s
  where s.id = p_screening_id
  for update;

  if not found then
    raise exception 'SCREENING_NOT_FOUND';
  end if;

  if v_screening.status <> 'on_sale' then
    raise exception 'SCREENING_NOT_ON_SALE';
  end if;

  if v_now < v_screening.sales_start
    or v_now > v_screening.sales_end
    or v_now >= v_screening.starts_at then
    raise exception 'SALES_CLOSED';
  end if;

  -- Lock every requested ticket type in a stable order. Both checkout and
  -- payment fulfilment use the same lock, preventing overselling and deadlocks.
  perform 1
  from public.ticket_types as tt
  where tt.id in (
    select parsed.ticket_type_id
    from jsonb_to_recordset(p_items) as parsed(ticket_type_id uuid, quantity integer)
  )
  order by tt.id
  for update;

  for v_item in
    select parsed.ticket_type_id, parsed.quantity
    from jsonb_to_recordset(p_items) as parsed(ticket_type_id uuid, quantity integer)
    order by parsed.ticket_type_id
  loop
    select tt.*
    into v_ticket_type
    from public.ticket_types as tt
    where tt.id = v_item.ticket_type_id
      and tt.screening_id = p_screening_id;

    if not found or not v_ticket_type.is_active then
      raise exception 'TICKET_TYPE_NOT_AVAILABLE';
    end if;

    select coalesce(sum(oi.quantity), 0)::integer
    into v_reserved
    from public.order_items as oi
    join public.orders as o on o.id = oi.order_id
    where oi.ticket_type_id = v_item.ticket_type_id
      and (
        o.status = 'paid'
        or (o.status = 'pending' and o.expires_at > v_now)
      );

    if v_reserved + v_item.quantity > v_ticket_type.capacity then
      raise exception 'INSUFFICIENT_CAPACITY';
    end if;

    v_amount_kobo := v_amount_kobo + (v_ticket_type.price_kobo * v_item.quantity);
  end loop;

  -- This flow supports paid orders up to NGN 10,000,000. Raise this ceiling
  -- deliberately if the business later sells higher-value packages.
  if v_amount_kobo <= 0 or v_amount_kobo > 1000000000 then
    raise exception 'INVALID_ORDER_AMOUNT';
  end if;

  insert into public.orders (
    id,
    reference,
    user_id,
    customer_name,
    customer_email,
    customer_phone,
    currency,
    amount_kobo,
    status,
    access_token_hash,
    expires_at
  ) values (
    v_order_id,
    v_reference,
    p_user_id,
    btrim(p_customer_name),
    lower(btrim(p_customer_email)),
    p_customer_phone,
    'NGN',
    v_amount_kobo,
    'pending',
    p_access_token_hash,
    v_expires_at
  );

  insert into public.order_items (
    order_id,
    ticket_type_id,
    quantity,
    unit_price_kobo
  )
  select
    v_order_id,
    parsed.ticket_type_id,
    parsed.quantity,
    tt.price_kobo
  from jsonb_to_recordset(p_items) as parsed(ticket_type_id uuid, quantity integer)
  join public.ticket_types as tt on tt.id = parsed.ticket_type_id;

  return jsonb_build_object(
    'order_id', v_order_id,
    'reference', v_reference,
    'amount_kobo', v_amount_kobo,
    'currency', 'NGN',
    'expires_at', v_expires_at
  );
end;
$$;

create or replace function public.payment_order_payload(
  p_order_id uuid,
  p_outcome text
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'outcome', p_outcome,
    'order_id', o.id,
    'reference', o.reference,
    'order_status', o.status,
    'customer_name', o.customer_name,
    'customer_email', o.customer_email,
    'amount_kobo', o.amount_kobo,
    'currency', o.currency,
    'movie_title', m.title,
    'starts_at', s.starts_at,
    'venue_name', v.name,
    'venue_address', v.address,
    'venue_city', v.city,
    'venue_timezone', v.timezone,
    'email_delivery_id', ed.id,
    'email_delivery_status', ed.status,
    'tickets', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'public_id', t.public_id,
            'ticket_type', tt2.name,
            'status', t.status,
            'valid_from', t.valid_from,
            'valid_until', t.valid_until
          )
          order by t.created_at, t.public_id
        )
        from public.tickets as t
        join public.ticket_types as tt2 on tt2.id = t.ticket_type_id
        where t.order_id = o.id
      ),
      '[]'::jsonb
    )
  )
  from public.orders as o
  join public.order_items as oi on oi.order_id = o.id
  join public.ticket_types as tt on tt.id = oi.ticket_type_id
  join public.screenings as s on s.id = tt.screening_id
  join public.movies as m on m.id = s.movie_id
  join public.venues as v on v.id = s.venue_id
  left join public.email_deliveries as ed
    on ed.order_id = o.id and ed.template = 'ticket-confirmation'
  where o.id = p_order_id
  limit 1;
$$;

create or replace function public.process_paystack_charge_success(
  p_event_key text,
  p_order_reference text,
  p_provider_reference text,
  p_amount_kobo bigint,
  p_currency text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
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
  insert into public.webhook_events (
    provider_event_key,
    event_type,
    payload
  ) values (
    p_event_key,
    'charge.success',
    p_payload
  )
  on conflict (provider_event_key) do nothing
  returning id into v_event_id;

  select o.*
  into v_order
  from public.orders as o
  where o.reference = p_order_reference
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if v_event_id is null then
    return public.payment_order_payload(v_order.id, 'already_processed');
  end if;

  if p_amount_kobo <> v_order.amount_kobo
    or upper(p_currency) <> v_order.currency then
    insert into public.payments (
      order_id,
      provider,
      provider_reference,
      currency,
      amount_kobo,
      status,
      verified_at,
      payload
    ) values (
      v_order.id,
      'paystack',
      p_provider_reference,
      upper(p_currency),
      p_amount_kobo,
      'amount_mismatch',
      now(),
      p_payload
    )
    on conflict (provider_reference) do nothing;

    update public.orders
    set status = 'payment_review', updated_at = now()
    where id = v_order.id and status <> 'paid';

    update public.webhook_events
    set processed_at = now()
    where id = v_event_id;

    return public.payment_order_payload(v_order.id, 'payment_review');
  end if;

  if v_order.status = 'paid' then
    update public.webhook_events
    set processed_at = now()
    where id = v_event_id;

    return public.payment_order_payload(v_order.id, 'already_paid');
  end if;

  if v_order.status in ('cancelled', 'refunded', 'payment_review') then
    update public.webhook_events
    set processed_at = now()
    where id = v_event_id;

    return public.payment_order_payload(v_order.id, 'payment_review');
  end if;

  perform 1
  from public.ticket_types as tt
  join public.order_items as oi on oi.ticket_type_id = tt.id
  where oi.order_id = v_order.id
  order by tt.id
  for update of tt;

  for v_item in
    select oi.ticket_type_id, oi.quantity, tt.capacity
    from public.order_items as oi
    join public.ticket_types as tt on tt.id = oi.ticket_type_id
    where oi.order_id = v_order.id
    order by oi.ticket_type_id
  loop
    select coalesce(sum(other_item.quantity), 0)::integer
    into v_reserved
    from public.order_items as other_item
    join public.orders as other_order on other_order.id = other_item.order_id
    where other_item.ticket_type_id = v_item.ticket_type_id
      and other_order.id <> v_order.id
      and (
        other_order.status = 'paid'
        or (
          other_order.status = 'pending'
          and other_order.expires_at > clock_timestamp()
        )
      );

    if v_reserved + v_item.quantity > v_item.capacity then
      insert into public.payments (
        order_id,
        provider,
        provider_reference,
        currency,
        amount_kobo,
        status,
        verified_at,
        payload
      ) values (
        v_order.id,
        'paystack',
        p_provider_reference,
        upper(p_currency),
        p_amount_kobo,
        'success_unfulfilled',
        now(),
        p_payload
      )
      on conflict (provider_reference) do nothing;

      update public.orders
      set status = 'payment_review', updated_at = now()
      where id = v_order.id;

      update public.webhook_events
      set processed_at = now()
      where id = v_event_id;

      return public.payment_order_payload(v_order.id, 'payment_review');
    end if;
  end loop;

  insert into public.payments (
    order_id,
    provider,
    provider_reference,
    currency,
    amount_kobo,
    status,
    verified_at,
    payload
  ) values (
    v_order.id,
    'paystack',
    p_provider_reference,
    upper(p_currency),
    p_amount_kobo,
    'success',
    now(),
    p_payload
  )
  on conflict (provider_reference) do nothing;

  update public.orders
  set status = 'paid',
      paid_at = coalesce(paid_at, now()),
      updated_at = now()
  where id = v_order.id;

  select
    s.starts_at - interval '30 minutes',
    (
      date_trunc('day', s.ends_at at time zone v.timezone) + interval '1 day'
    ) at time zone v.timezone
  into v_valid_from, v_valid_until
  from public.order_items as oi
  join public.ticket_types as tt on tt.id = oi.ticket_type_id
  join public.screenings as s on s.id = tt.screening_id
  join public.venues as v on v.id = s.venue_id
  where oi.order_id = v_order.id
  limit 1;

  insert into public.tickets (
    order_id,
    order_item_id,
    screening_id,
    ticket_type_id,
    holder_name,
    holder_email,
    status,
    is_active,
    valid_from,
    valid_until
  )
  select
    v_order.id,
    oi.id,
    tt.screening_id,
    oi.ticket_type_id,
    v_order.customer_name,
    v_order.customer_email,
    'valid',
    true,
    v_valid_from,
    v_valid_until
  from public.order_items as oi
  join public.ticket_types as tt on tt.id = oi.ticket_type_id
  cross join lateral generate_series(1, oi.quantity)
  where oi.order_id = v_order.id
    and not exists (
      select 1 from public.tickets as existing where existing.order_id = v_order.id
    );

  insert into public.email_deliveries (
    order_id,
    recipient,
    template,
    status
  ) values (
    v_order.id,
    v_order.customer_email,
    'ticket-confirmation',
    'pending'
  )
  on conflict (order_id, template) do update
    set recipient = excluded.recipient
  returning id into v_email_delivery_id;

  update public.webhook_events
  set processed_at = now()
  where id = v_event_id;

  return public.payment_order_payload(v_order.id, 'paid');
end;
$$;

create or replace function public.get_order_status_by_token(
  p_reference text,
  p_access_token_hash text
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'reference', o.reference,
    'status', case
      when o.status = 'pending' and o.expires_at <= now() then 'expired'
      else o.status::text
    end,
    'amount_kobo', o.amount_kobo,
    'currency', o.currency,
    'expires_at', o.expires_at,
    'paid_at', o.paid_at,
    'tickets', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'public_id', t.public_id,
            'status', t.status,
            'is_active', t.is_active,
            'valid_from', t.valid_from,
            'valid_until', t.valid_until,
            'ticket_type', tt.name
          )
          order by t.created_at, t.public_id
        )
        from public.tickets as t
        join public.ticket_types as tt on tt.id = t.ticket_type_id
        where t.order_id = o.id
      ),
      '[]'::jsonb
    )
  )
  from public.orders as o
  where o.reference = p_reference
    and o.access_token_hash = p_access_token_hash;
$$;

create or replace function public.expire_pending_orders()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.orders
  set status = 'expired', updated_at = now()
  where status = 'pending' and expires_at <= now();

  delete from public.checkout_rate_limits
  where updated_at < now() - interval '7 days';
end;
$$;

revoke all on table public.checkout_rate_limits from anon, authenticated;

revoke all on function public.check_checkout_rate_limit(text, integer, integer, integer)
from public, anon, authenticated;
revoke all on function public.create_pending_order(uuid, jsonb, text, text, text, text, uuid)
from public, anon, authenticated;
revoke all on function public.payment_order_payload(uuid, text)
from public, anon, authenticated;
revoke all on function public.process_paystack_charge_success(text, text, text, bigint, text, jsonb)
from public, anon, authenticated;
revoke all on function public.get_order_status_by_token(text, text)
from public, anon, authenticated;

grant execute on function public.check_checkout_rate_limit(text, integer, integer, integer)
to service_role;
grant execute on function public.create_pending_order(uuid, jsonb, text, text, text, text, uuid)
to service_role;
grant execute on function public.payment_order_payload(uuid, text)
to service_role;
grant execute on function public.process_paystack_charge_success(text, text, text, bigint, text, jsonb)
to service_role;
grant execute on function public.get_order_status_by_token(text, text)
to service_role;
