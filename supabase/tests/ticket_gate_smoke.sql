begin;

do $$
declare
  v_staff uuid;
  v_customer uuid;
  v_movie uuid;
  v_venue uuid;
  v_screening uuid;
  v_type uuid;
  v_order uuid;
  v_item uuid;
  v_ticket uuid;
  v_other_ticket uuid;
  v_result jsonb;
begin
  insert into auth.users(email) values ('gate-staff@example.com') returning id into v_staff;
  insert into auth.users(email) values ('gate-customer@example.com') returning id into v_customer;
  update public.profiles set role = 'check_in_staff' where id = v_staff;

  insert into public.movies(slug,title,synopsis,status)
  values ('gate-smoke','Gate Smoke','Test', 'published') returning id into v_movie;
  insert into public.venues(name,address,city,country)
  values ('Gate Venue','1 Test Road','Lagos','Nigeria') returning id into v_venue;
  insert into public.screenings(movie_id,venue_id,starts_at,ends_at,sales_start,sales_end,status)
  values (v_movie,v_venue,now() + interval '1 hour',now() + interval '3 hours',
    now() - interval '1 day',now() + interval '30 minutes','on_sale')
  returning id into v_screening;
  insert into public.ticket_types(screening_id,name,price_kobo,capacity)
  values (v_screening,'Standard',500000,10) returning id into v_type;
  insert into public.orders(reference,customer_name,customer_email,customer_phone,
    amount_kobo,status,access_token_hash,expires_at)
  values ('GATE-SMOKE','Amina Bello','amina@example.com','+2348012345678',
    500000,'paid',repeat('a',64),now() + interval '1 hour') returning id into v_order;
  insert into public.order_items(order_id,ticket_type_id,quantity,unit_price_kobo)
  values (v_order,v_type,1,500000) returning id into v_item;
  insert into public.tickets(order_id,order_item_id,screening_id,ticket_type_id,
    holder_name,holder_email,valid_from,valid_until)
  values (v_order,v_item,v_screening,v_type,'Amina Bello','amina@example.com',
    now() - interval '1 minute',now() + interval '1 day')
  returning public_id into v_ticket;

  begin
    perform public.verify_ticket_staff(v_ticket, v_customer);
    raise exception 'Customer unexpectedly reached the gate RPC';
  exception when others then
    if sqlerrm not like '%CHECK_IN_FORBIDDEN%' then raise; end if;
  end;

  v_result := public.verify_ticket_staff(v_ticket, v_staff);
  if v_result->>'reason' <> 'valid' or v_result->>'valid' <> 'true' then
    raise exception 'Expected valid verification: %', v_result;
  end if;
  if v_result->'movie'->>'title' <> 'Gate Smoke' then
    raise exception 'Wrong movie returned';
  end if;

  v_result := public.redeem_ticket_staff(v_ticket, v_staff);
  if v_result->>'reason' <> 'redeemed' or v_result->>'redeemed' <> 'true' then
    raise exception 'First redemption failed: %', v_result;
  end if;
  v_result := public.redeem_ticket_staff(v_ticket, v_staff);
  if v_result->>'reason' <> 'already_used'
    or v_result->'ticket'->>'checked_in_at' is null then
    raise exception 'Duplicate redemption was not blocked: %', v_result;
  end if;
  if (select count(*) from public.ticket_gate_audit_log
      where ticket_public_id = v_ticket) <> 3 then
    raise exception 'Verification/redemption audit count was wrong';
  end if;

  insert into public.tickets(order_id,order_item_id,screening_id,ticket_type_id,
    holder_name,holder_email,valid_from,valid_until)
  values (v_order,v_item,v_screening,v_type,'Amina Bello','amina@example.com',
    now() - interval '2 days',now() - interval '1 hour')
  returning public_id into v_other_ticket;
  v_result := public.verify_ticket_staff(v_other_ticket, v_staff);
  if v_result->>'reason' <> 'expired' then raise exception 'Late ticket was accepted'; end if;
  if (select is_active from public.tickets where public_id = v_other_ticket) then
    raise exception 'Late ticket was not marked inactive';
  end if;

  if (public.get_public_ticket_details(v_ticket)::text like '%amina@example.com%'
    or public.get_public_ticket_details(v_ticket)::text like '%Amina Bello%') then
    raise exception 'Public ticket details leaked holder information';
  end if;

  update public.orders set status = 'refunded' where id = v_order;
  if (select count(*) from public.tickets where order_id = v_order
    and (status <> 'refunded' or is_active)) <> 0 then
    raise exception 'Refund failed to invalidate tickets';
  end if;
end;
$$;

rollback;
