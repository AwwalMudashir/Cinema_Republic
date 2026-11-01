create table if not exists public.catalogue_deletion_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  entity_type text not null check (entity_type in ('movie', 'screening')),
  entity_id uuid not null,
  entity_title text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.catalogue_deletion_audit_log enable row level security;
revoke all on table public.catalogue_deletion_audit_log from public, anon, authenticated;

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
  v_customer_booking_count integer := 0;
  v_ticket_count integer := 0;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_actor and role = 'admin'
  ) then
    raise exception 'ADMIN_FORBIDDEN';
  end if;

  select m.title, s.starts_at
  into v_movie_title, v_starts_at
  from public.screenings s
  join public.movies m on m.id = s.movie_id
  where s.id = p_screening_id
  for update of s;

  if not found then
    raise exception 'SCREENING_NOT_FOUND';
  end if;

  -- Serialise against checkout, which also locks ticket type inventory.
  perform 1
  from public.ticket_types
  where screening_id = p_screening_id
  for update;

  select
    count(distinct oi.order_id)::integer,
    count(distinct oi.order_id) filter (
      where o.paid_at is not null
        or o.status in ('paid', 'refunded', 'cancelled')
    )::integer,
    count(distinct t.id)::integer
  into v_order_count, v_customer_booking_count, v_ticket_count
  from public.ticket_types tt
  left join public.order_items oi on oi.ticket_type_id = tt.id
  left join public.orders o on o.id = oi.order_id
  left join public.tickets t on t.order_item_id = oi.id
  where tt.screening_id = p_screening_id;

  if v_order_count > 0 then
    return jsonb_build_object(
      'deleted', false,
      'reason', case
        when v_customer_booking_count > 0 or v_ticket_count > 0
          then 'booking_history_exists'
        else 'checkout_history_exists'
      end,
      'title', v_movie_title,
      'starts_at', v_starts_at,
      'order_count', v_order_count,
      'customer_booking_count', v_customer_booking_count,
      'ticket_count', v_ticket_count
    );
  end if;

  insert into public.catalogue_deletion_audit_log (
    actor_user_id, entity_type, entity_id, entity_title, details
  ) values (
    p_actor,
    'screening',
    p_screening_id,
    v_movie_title,
    jsonb_build_object('starts_at', v_starts_at)
  );

  -- With no order items, cascading to the unused ticket type is safe.
  delete from public.screenings where id = p_screening_id;

  return jsonb_build_object(
    'deleted', true,
    'entity', 'screening',
    'title', v_movie_title,
    'starts_at', v_starts_at
  );
end;
$$;

create or replace function public.admin_delete_movie(
  p_actor uuid,
  p_movie_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_title text;
  v_poster_path text;
  v_backdrop_path text;
  v_session_count integer := 0;
  v_order_count integer := 0;
  v_customer_booking_count integer := 0;
  v_ticket_count integer := 0;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_actor and role = 'admin'
  ) then
    raise exception 'ADMIN_FORBIDDEN';
  end if;

  select title, poster_path, backdrop_path
  into v_title, v_poster_path, v_backdrop_path
  from public.movies
  where id = p_movie_id
  for update;

  if not found then
    raise exception 'MOVIE_NOT_FOUND';
  end if;

  select count(*)::integer
  into v_session_count
  from public.screenings
  where movie_id = p_movie_id;

  select
    count(distinct oi.order_id)::integer,
    count(distinct oi.order_id) filter (
      where o.paid_at is not null
        or o.status in ('paid', 'refunded', 'cancelled')
    )::integer,
    count(distinct t.id)::integer
  into v_order_count, v_customer_booking_count, v_ticket_count
  from public.screenings s
  join public.ticket_types tt on tt.screening_id = s.id
  left join public.order_items oi on oi.ticket_type_id = tt.id
  left join public.orders o on o.id = oi.order_id
  left join public.tickets t on t.order_item_id = oi.id
  where s.movie_id = p_movie_id;

  if v_order_count > 0 then
    return jsonb_build_object(
      'deleted', false,
      'reason', case
        when v_customer_booking_count > 0 or v_ticket_count > 0
          then 'booking_history_exists'
        else 'checkout_history_exists'
      end,
      'title', v_title,
      'session_count', v_session_count,
      'order_count', v_order_count,
      'customer_booking_count', v_customer_booking_count,
      'ticket_count', v_ticket_count
    );
  end if;

  if v_session_count > 0 then
    return jsonb_build_object(
      'deleted', false,
      'reason', 'sessions_exist',
      'title', v_title,
      'session_count', v_session_count,
      'order_count', 0,
      'customer_booking_count', 0,
      'ticket_count', 0
    );
  end if;

  insert into public.catalogue_deletion_audit_log (
    actor_user_id, entity_type, entity_id, entity_title, details
  ) values (
    p_actor,
    'movie',
    p_movie_id,
    v_title,
    jsonb_build_object(
      'poster_path', v_poster_path,
      'backdrop_path', v_backdrop_path
    )
  );

  delete from public.movies where id = p_movie_id;

  return jsonb_build_object(
    'deleted', true,
    'entity', 'movie',
    'title', v_title,
    'poster_path', v_poster_path,
    'backdrop_path', v_backdrop_path
  );
end;
$$;

revoke all on function public.admin_delete_screening(uuid, uuid) from public, anon, authenticated;
revoke all on function public.admin_delete_movie(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_screening(uuid, uuid) to service_role;
grant execute on function public.admin_delete_movie(uuid, uuid) to service_role;
