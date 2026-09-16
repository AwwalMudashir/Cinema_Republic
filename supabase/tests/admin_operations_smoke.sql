begin;

do $$
declare
  v_admin uuid; v_manager uuid; v_customer uuid;
  v_movie uuid; v_venue uuid; v_screening uuid; v_type uuid;
  v_order uuid; v_result jsonb;
begin
  insert into auth.users(email) values ('admin-smoke@example.com') returning id into v_admin;
  insert into auth.users(email) values ('manager-smoke@example.com') returning id into v_manager;
  insert into auth.users(email) values ('customer-smoke@example.com') returning id into v_customer;
  update public.profiles set role = 'admin' where id = v_admin;

  begin
    perform public.admin_set_role(v_customer, v_manager, 'check_in_staff');
    raise exception 'Customer changed a role';
  exception when others then
    if sqlerrm not like '%ADMIN_FORBIDDEN%' then raise; end if;
  end;
  begin
    perform public.admin_set_role(v_admin, v_admin, 'customer');
    raise exception 'Admin changed own role';
  exception when others then
    if sqlerrm not like '%SELF_ROLE_CHANGE_FORBIDDEN%' then raise; end if;
  end;

  v_result := public.admin_set_role(v_admin, v_manager, 'content_manager');
  if v_result->>'role' <> 'content_manager' then raise exception 'Role not updated'; end if;
  if (select count(*) from public.role_audit_log
      where changed_by = v_admin and target_user = v_manager) <> 1 then
    raise exception 'Role change not audited';
  end if;
  if jsonb_array_length(public.admin_list_team(v_admin)) <> 3 then
    raise exception 'Team listing did not include all Auth users';
  end if;

  insert into public.movies(slug,title,synopsis,status)
  values ('admin-smoke', 'Admin Smoke', 'Test', 'published') returning id into v_movie;
  insert into public.venues(name,address,city,country)
  values ('Admin Venue', '1 Test Road', 'Lagos', 'Nigeria') returning id into v_venue;
  insert into public.screenings(movie_id,venue_id,starts_at,ends_at,sales_start,sales_end,status)
  values (v_movie,v_venue,now() + interval '1 day',now() + interval '1 day 2 hours',
    now() - interval '1 day',now() + interval '12 hours','on_sale')
  returning id into v_screening;
  insert into public.ticket_types(screening_id,name,price_kobo,capacity)
  values (v_screening,'General admission',800000,20) returning id into v_type;
  insert into public.orders(reference,customer_name,customer_email,customer_phone,
    amount_kobo,status,access_token_hash,expires_at)
  values ('C57-ADMINSMOKETEST1234','Ada Bello','ada@example.com','+2348012345678',
    800000,'pending',repeat('a',64),now() + interval '10 minutes') returning id into v_order;
  insert into public.order_items(order_id,ticket_type_id,quantity,unit_price_kobo)
  values (v_order,v_type,1,800000);

  v_result := public.admin_search_orders(v_admin,'ada@example.com',30);
  if jsonb_array_length(v_result) <> 1
      or v_result->0->>'reference' <> 'C57-ADMINSMOKETEST1234'
      or v_result->0->'items'->0->>'movie' <> 'Admin Smoke' then
    raise exception 'Order search failed: %', v_result;
  end if;
  begin
    perform public.admin_search_orders(v_manager,'ada@example.com',30);
    raise exception 'Manager saw private orders';
  exception when others then
    if sqlerrm not like '%ADMIN_FORBIDDEN%' then raise; end if;
  end;
end;
$$;

do $$
begin
  if has_function_privilege('authenticated','public.admin_list_team(uuid)','EXECUTE')
    or has_function_privilege('authenticated',
      'public.admin_set_role(uuid,uuid,public.app_role)','EXECUTE')
    or has_function_privilege('authenticated',
      'public.admin_search_orders(uuid,text,integer)','EXECUTE') then
    raise exception 'Browser role has direct admin RPC access';
  end if;
end;
$$;

rollback;
