begin;

do $$
declare
  v_movie uuid; v_venue uuid; v_screening uuid; v_type uuid;
  v_order uuid; v_item uuid; v_ticket uuid; v_result jsonb;
begin
  insert into public.movies(slug,title,synopsis,status)
  values ('refund-smoke','Refund Smoke','Test','published') returning id into v_movie;
  insert into public.venues(name,address,city,country)
  values ('Refund Venue','1 Test Road','Lagos','Nigeria') returning id into v_venue;
  insert into public.screenings(movie_id,venue_id,starts_at,ends_at,sales_start,sales_end,status)
  values (v_movie,v_venue,now() + interval '1 day',now() + interval '1 day 2 hours',
    now() - interval '1 day',now() + interval '12 hours','on_sale')
  returning id into v_screening;
  insert into public.ticket_types(screening_id,name,price_kobo,capacity)
  values (v_screening,'General',800000,2) returning id into v_type;
  insert into public.orders(reference,customer_name,customer_email,customer_phone,
    amount_kobo,status,access_token_hash,expires_at)
  values ('C57-REFUNDSMOKETEST1234','Ada Bello','ada@example.com','+2348012345678',
    800000,'paid',repeat('a',64),now() + interval '10 minutes') returning id into v_order;
  insert into public.order_items(order_id,ticket_type_id,quantity,unit_price_kobo)
  values (v_order,v_type,1,800000) returning id into v_item;
  insert into public.payments(order_id,provider,provider_reference,currency,
    amount_kobo,status,verified_at)
  values (v_order,'paystack','C57-REFUNDSMOKETEST1234','NGN',800000,'success',now());
  insert into public.tickets(order_id,order_item_id,screening_id,ticket_type_id,
    holder_name,holder_email,valid_from,valid_until)
  values (v_order,v_item,v_screening,v_type,'Ada Bello','ada@example.com',
    now() - interval '1 hour',now() + interval '2 days') returning id into v_ticket;

  begin
    update public.screenings set starts_at = now() + interval '2 days'
    where id = v_screening;
    raise exception 'Paid screening was rescheduled';
  exception when others then
    if sqlerrm not like '%SOLD_SCREENING_DETAILS_IMMUTABLE%' then raise; end if;
  end;
  begin
    update public.ticket_types set capacity = 0 where id = v_type;
    raise exception 'Capacity fell below sold quantity';
  exception when others then
    if sqlerrm not like '%CAPACITY_BELOW_RESERVED%' then raise; end if;
  end;

  v_result := public.process_paystack_refund_event(
    'paystack:refund.processed:smoke', 'C57-REFUNDSMOKETEST1234',
    'processed',800000,'NGN','{"event":"refund.processed"}'::jsonb
  );
  if v_result->>'outcome' <> 'refunded'
    or (select status from public.orders where id = v_order) <> 'refunded'
    or (select status <> 'refunded' or is_active from public.tickets where id = v_ticket) then
    raise exception 'Full refund did not invalidate the ticket: %', v_result;
  end if;
  v_result := public.process_paystack_refund_event(
    'paystack:refund.processed:smoke', 'C57-REFUNDSMOKETEST1234',
    'processed',800000,'NGN','{"event":"refund.processed"}'::jsonb
  );
  if v_result->>'outcome' <> 'duplicate' then
    raise exception 'Duplicate refund was not idempotent';
  end if;
end;
$$;

rollback;
