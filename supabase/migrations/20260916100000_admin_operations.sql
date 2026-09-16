-- Server-only admin operations. Browser clients cannot execute these RPCs.
create or replace function public.admin_list_team(p_actor uuid)
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.profiles where id = p_actor and role = 'admin') then
    raise exception 'ADMIN_FORBIDDEN';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'email', u.email, 'full_name', p.full_name,
      'role', p.role, 'created_at', p.created_at,
      'last_sign_in_at', u.last_sign_in_at
    ) order by p.created_at desc)
    from public.profiles p join auth.users u on u.id = p.id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_set_role(
  p_actor uuid, p_target uuid, p_role public.app_role
)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_old public.app_role; v_email text;
begin
  if not exists (select 1 from public.profiles where id = p_actor and role = 'admin') then
    raise exception 'ADMIN_FORBIDDEN';
  end if;
  if p_actor = p_target then
    raise exception 'SELF_ROLE_CHANGE_FORBIDDEN';
  end if;
  if p_role is null then raise exception 'INVALID_ROLE'; end if;

  select p.role, u.email into v_old, v_email
  from public.profiles p join auth.users u on u.id = p.id
  where p.id = p_target for update of p;
  if not found then raise exception 'USER_NOT_FOUND'; end if;

  if v_old is distinct from p_role then
    update public.profiles set role = p_role, updated_at = now()
    where id = p_target;
    insert into public.role_audit_log(changed_by, target_user, old_role, new_role)
    values (p_actor, p_target, v_old, p_role);
  end if;
  return jsonb_build_object('id', p_target, 'email', v_email, 'role', p_role);
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
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', o.id, 'reference', o.reference, 'status', o.status,
      'customer_name', o.customer_name, 'customer_email', o.customer_email,
      'customer_phone', o.customer_phone, 'amount_kobo', o.amount_kobo,
      'currency', o.currency, 'created_at', o.created_at,
      'paid_at', o.paid_at, 'expires_at', o.expires_at,
      'payment', (select jsonb_build_object(
        'status', p.status, 'provider_reference', p.provider_reference,
        'verified_at', p.verified_at
      ) from public.payments p where p.order_id = o.id order by p.created_at desc limit 1),
      'email', (select jsonb_build_object(
        'status', ed.status, 'attempts', ed.attempts, 'last_error', ed.last_error,
        'sent_at', ed.sent_at
      ) from public.email_deliveries ed where ed.order_id = o.id
        order by ed.created_at desc limit 1),
      'items', (select coalesce(jsonb_agg(jsonb_build_object(
        'movie', m.title, 'showtime', s.starts_at, 'venue', v.name,
        'type', tt.name, 'quantity', oi.quantity,
        'unit_price_kobo', oi.unit_price_kobo
      ) order by s.starts_at), '[]'::jsonb)
        from public.order_items oi
        join public.ticket_types tt on tt.id = oi.ticket_type_id
        join public.screenings s on s.id = tt.screening_id
        join public.movies m on m.id = s.movie_id
        join public.venues v on v.id = s.venue_id
        where oi.order_id = o.id),
      'tickets', (select coalesce(jsonb_agg(jsonb_build_object(
        'public_id', t.public_id, 'status', t.status,
        'is_active', t.is_active, 'checked_in_at', t.checked_in_at
      ) order by t.created_at), '[]'::jsonb)
        from public.tickets t where t.order_id = o.id)
    ) order by o.created_at desc)
    from (select * from public.orders o
      where v_query = ''
        or o.reference ilike '%' || v_query || '%'
        or o.customer_email ilike '%' || v_query || '%'
        or exists (select 1 from public.tickets t
          where t.order_id = o.id and t.public_id::text = v_query)
      order by o.created_at desc
      limit greatest(1, least(coalesce(p_limit, 30), 50))
    ) o
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.admin_list_team(uuid) from public, anon, authenticated;
revoke all on function public.admin_set_role(uuid, uuid, public.app_role) from public, anon, authenticated;
revoke all on function public.admin_search_orders(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.admin_list_team(uuid) to service_role;
grant execute on function public.admin_set_role(uuid, uuid, public.app_role) to service_role;
grant execute on function public.admin_search_orders(uuid, text, integer) to service_role;
