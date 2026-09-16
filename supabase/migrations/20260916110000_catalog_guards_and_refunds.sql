-- Preserve the meaning of already-paid tickets when the programme changes.
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
    and exists (
      select 1 from public.order_items oi
      join public.orders o on o.id = oi.order_id
      join public.ticket_types tt on tt.id = oi.ticket_type_id
      where tt.screening_id = old.id and o.status in ('paid', 'refunded')
    ) then
    raise exception 'SOLD_SCREENING_DETAILS_IMMUTABLE';
  end if;
  return new;
end;
$$;
create trigger guard_sold_screening_update
before update on public.screenings
for each row execute function public.guard_sold_screening_update();

create or replace function public.guard_ticket_type_capacity()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_reserved integer;
begin
  if new.screening_id <> old.screening_id then
    raise exception 'TICKET_TYPE_SCREENING_IMMUTABLE';
  end if;
  if new.capacity < old.capacity then
    select coalesce(sum(oi.quantity), 0)::integer into v_reserved
    from public.order_items oi join public.orders o on o.id = oi.order_id
    where oi.ticket_type_id = new.id
      and (o.status = 'paid' or (o.status = 'pending' and o.expires_at > now()));
    if new.capacity < v_reserved then
      raise exception 'CAPACITY_BELOW_RESERVED';
    end if;
  end if;
  return new;
end;
$$;
create trigger guard_ticket_type_capacity
before update on public.ticket_types
for each row execute function public.guard_ticket_type_capacity();

create table public.refund_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider_event_key text not null unique,
  status text not null check (status in (
    'pending', 'processing', 'needs-attention', 'failed', 'processed'
  )),
  amount_kobo bigint not null check (amount_kobo > 0),
  currency text not null,
  received_at timestamptz not null default now()
);
create index refund_events_order_time_idx
on public.refund_events(order_id, received_at desc);
alter table public.refund_events enable row level security;
revoke all on public.refund_events from anon, authenticated;
grant select on public.refund_events to service_role;

create or replace function public.process_paystack_refund_event(
  p_event_key text, p_provider_reference text, p_status text,
  p_amount_kobo bigint, p_currency text, p_payload jsonb
)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_order public.orders%rowtype;
begin
  if p_status not in ('pending','processing','needs-attention','failed','processed')
    or p_amount_kobo <= 0 or upper(p_currency) <> 'NGN' then
    raise exception 'INVALID_REFUND_EVENT';
  end if;
  select o.* into v_order from public.orders o
  join public.payments p on p.order_id = o.id
  where p.provider = 'paystack' and p.provider_reference = p_provider_reference
    and p.status = 'success'
  for update of o;
  if not found then raise exception 'REFUND_ORDER_NOT_FOUND'; end if;
  if v_order.currency <> upper(p_currency)
    or p_amount_kobo > v_order.amount_kobo then
    raise exception 'REFUND_AMOUNT_MISMATCH';
  end if;

  insert into public.webhook_events(provider_event_key,event_type,payload,processed_at)
  values (p_event_key, 'refund.' || p_status, p_payload, now())
  on conflict (provider_event_key) do nothing;
  if not found then
    return jsonb_build_object('outcome','duplicate','order_id',v_order.id);
  end if;
  insert into public.refund_events(order_id,provider_event_key,status,amount_kobo,currency)
  values (v_order.id,p_event_key,p_status,p_amount_kobo,upper(p_currency));

  if p_status = 'processed' and p_amount_kobo = v_order.amount_kobo
    and v_order.status in ('paid','payment_review','cancelled') then
    update public.orders set status = 'refunded', updated_at = now()
    where id = v_order.id;
    -- sync_order_ticket_status invalidates all issued tickets.
    return jsonb_build_object('outcome','refunded','order_id',v_order.id);
  end if;
  return jsonb_build_object('outcome',
    case when p_amount_kobo < v_order.amount_kobo then 'partial_review'
      else p_status end, 'order_id',v_order.id);
end;
$$;

revoke all on function public.process_paystack_refund_event(
  text,text,text,bigint,text,jsonb
) from public, anon, authenticated;
grant execute on function public.process_paystack_refund_event(
  text,text,text,bigint,text,jsonb
) to service_role;
revoke all on function public.guard_sold_screening_update() from public, anon, authenticated;
revoke all on function public.guard_ticket_type_capacity() from public, anon, authenticated;
