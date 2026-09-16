begin;

do $$
declare
  v_movie_id uuid;
  v_venue_id uuid;
  v_screening_id uuid;
  v_ticket_type_id uuid;
  v_order jsonb;
  v_fulfilment jsonb;
  v_duplicate jsonb;
  v_status jsonb;
  v_reference text;
  v_order_id uuid;
  v_count integer;
begin
  insert into public.movies (slug, title, synopsis, status)
  values ('payment-smoke-test', 'Payment Smoke Test', 'Temporary test movie', 'published')
  returning id into v_movie_id;

  insert into public.venues (name, address, city, country, timezone)
  values ('Test Screen', '1 Test Road', 'Lagos', 'Nigeria', 'Africa/Lagos')
  returning id into v_venue_id;

  insert into public.screenings (
    movie_id,
    venue_id,
    starts_at,
    ends_at,
    sales_start,
    sales_end,
    status
  ) values (
    v_movie_id,
    v_venue_id,
    now() + interval '1 day',
    now() + interval '1 day 2 hours',
    now() - interval '1 day',
    now() + interval '23 hours',
    'on_sale'
  ) returning id into v_screening_id;

  insert into public.ticket_types (screening_id, name, price_kobo, capacity)
  values (v_screening_id, 'Standard', 500000, 2)
  returning id into v_ticket_type_id;

  v_order := public.create_pending_order(
    v_screening_id,
    jsonb_build_array(jsonb_build_object(
      'ticket_type_id', v_ticket_type_id,
      'quantity', 2
    )),
    'Amina Bello',
    'amina@example.com',
    '+2348012345678',
    repeat('a', 64),
    null
  );

  if (v_order->>'amount_kobo')::bigint <> 1000000 then
    raise exception 'Expected database-calculated total of 1000000 kobo';
  end if;

  begin
    perform public.create_pending_order(
      v_screening_id,
      jsonb_build_array(jsonb_build_object(
        'ticket_type_id', v_ticket_type_id,
        'quantity', 1
      )),
      'Second Customer',
      'second@example.com',
      '+2348098765432',
      repeat('b', 64),
      null
    );
    raise exception 'Expected capacity check to reject the second order';
  exception
    when others then
      if sqlerrm not like '%INSUFFICIENT_CAPACITY%' then
        raise;
      end if;
  end;

  v_reference := v_order->>'reference';
  v_order_id := (v_order->>'order_id')::uuid;
  v_fulfilment := public.process_paystack_charge_success(
    'paystack:charge.success:' || v_reference,
    v_reference,
    v_reference,
    1000000,
    'NGN',
    jsonb_build_object('event', 'charge.success')
  );

  if v_fulfilment->>'order_status' <> 'paid' then
    raise exception 'Expected the fulfilled order to be paid';
  end if;

  v_duplicate := public.process_paystack_charge_success(
    'paystack:charge.success:' || v_reference,
    v_reference,
    v_reference,
    1000000,
    'NGN',
    jsonb_build_object('event', 'charge.success')
  );

  if v_duplicate->>'outcome' <> 'already_processed' then
    raise exception 'Expected duplicate event to be idempotent';
  end if;

  select count(*) into v_count from public.payments where order_id = v_order_id;
  if v_count <> 1 then
    raise exception 'Expected exactly one payment, got %', v_count;
  end if;

  select count(*) into v_count from public.tickets where order_id = v_order_id;
  if v_count <> 2 then
    raise exception 'Expected exactly two tickets, got %', v_count;
  end if;

  select count(*) into v_count from public.email_deliveries where order_id = v_order_id;
  if v_count <> 1 then
    raise exception 'Expected exactly one email delivery, got %', v_count;
  end if;

  v_status := public.get_order_status_by_token(v_reference, repeat('a', 64));
  if v_status->>'status' <> 'paid' or jsonb_array_length(v_status->'tickets') <> 2 then
    raise exception 'Expected token-protected status to return the paid order and tickets';
  end if;

  if public.get_order_status_by_token(v_reference, repeat('c', 64)) is not null then
    raise exception 'An invalid order token must not return the order';
  end if;
end;
$$;

rollback;
