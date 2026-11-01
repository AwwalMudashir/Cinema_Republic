begin;

do $$
declare
  v_admin uuid;
  v_manager uuid;
  v_movie uuid;
  v_booked_movie uuid;
  v_venue uuid;
  v_screening uuid;
  v_booked_screening uuid;
  v_type uuid;
  v_order uuid;
  v_result jsonb;
begin
  insert into auth.users(email) values ('catalogue-admin@example.com') returning id into v_admin;
  insert into auth.users(email) values ('catalogue-manager@example.com') returning id into v_manager;
  update public.profiles set role = 'admin' where id = v_admin;
  update public.profiles set role = 'content_manager' where id = v_manager;

  insert into public.venues(name, address, city, country)
  values ('Deletion Test Venue', '1 Test Road', 'Lagos', 'Nigeria')
  returning id into v_venue;

  insert into public.movies(slug, title, synopsis, status)
  values ('safe-delete-movie', 'Safe Delete Movie', 'Test', 'draft')
  returning id into v_movie;

  insert into public.screenings(movie_id, venue_id, starts_at, ends_at, sales_start, sales_end, status)
  values (v_movie, v_venue, now() + interval '1 day', now() + interval '1 day 1 hour',
    now(), now() + interval '23 hours', 'draft')
  returning id into v_screening;

  v_result := public.admin_delete_movie(v_admin, v_movie);
  if v_result->>'reason' <> 'sessions_exist' then
    raise exception 'Movie deletion did not require its unused session to be removed first: %', v_result;
  end if;

  begin
    perform public.admin_delete_screening(v_manager, v_screening);
    raise exception 'Content manager unexpectedly deleted a session';
  exception when others then
    if sqlerrm not like '%ADMIN_FORBIDDEN%' then raise; end if;
  end;

  v_result := public.admin_delete_screening(v_admin, v_screening);
  if v_result->>'deleted' <> 'true' then
    raise exception 'Unused session was not deleted: %', v_result;
  end if;

  v_result := public.admin_delete_movie(v_admin, v_movie);
  if v_result->>'deleted' <> 'true' then
    raise exception 'Unused movie was not deleted: %', v_result;
  end if;

  if (select count(*) from public.catalogue_deletion_audit_log
      where actor_user_id = v_admin and entity_id in (v_movie, v_screening)) <> 2 then
    raise exception 'Catalogue deletion audit records were not written';
  end if;

  insert into public.movies(slug, title, synopsis, status)
  values ('booked-delete-movie', 'Booked Delete Movie', 'Test', 'published')
  returning id into v_booked_movie;

  insert into public.screenings(movie_id, venue_id, starts_at, ends_at, sales_start, sales_end, status)
  values (v_booked_movie, v_venue, now() + interval '2 days', now() + interval '2 days 1 hour',
    now(), now() + interval '47 hours', 'on_sale')
  returning id into v_booked_screening;

  insert into public.ticket_types(screening_id, name, price_kobo, capacity)
  values (v_booked_screening, 'General admission', 1050000, 6)
  returning id into v_type;

  insert into public.orders(reference, customer_name, customer_email, customer_phone,
    amount_kobo, status, access_token_hash, expires_at)
  values ('DELETE-SMOKE', 'Test Customer', 'customer@example.com', '+2348012345678',
    1050000, 'pending', repeat('d', 64), now() + interval '10 minutes')
  returning id into v_order;

  insert into public.order_items(order_id, ticket_type_id, quantity, unit_price_kobo)
  values (v_order, v_type, 1, 1050000);

  v_result := public.admin_delete_screening(v_admin, v_booked_screening);
  if v_result->>'reason' <> 'checkout_history_exists' then
    raise exception 'Checkout history did not block session deletion: %', v_result;
  end if;

  v_result := public.admin_delete_movie(v_admin, v_booked_movie);
  if v_result->>'reason' <> 'checkout_history_exists' then
    raise exception 'Checkout history did not block movie deletion: %', v_result;
  end if;
end;
$$;

rollback;
