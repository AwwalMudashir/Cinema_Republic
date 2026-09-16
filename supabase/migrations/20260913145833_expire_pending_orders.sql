create or replace function public.expire_pending_orders()
returns void
language sql
security definer
set search_path = public
as $$
  update public.orders
  set status = 'expired', updated_at = now()
  where status = 'pending' and expires_at <= now();
$$;