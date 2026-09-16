-- Only screenings that actually opened for sale are completed automatically.
-- Drafts remain drafts and cancelled screenings retain their cancellation state.
-- Completing a screening does not alter its issued tickets or their validity.
create or replace function public.sync_completed_screenings()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_changed integer;
begin
  update public.screenings
  set status = 'completed', updated_at = now()
  where status in ('on_sale', 'sold_out')
    and ends_at <= now();

  get diagnostics v_changed = row_count;
  return v_changed;
end;
$$;

revoke all on function public.sync_completed_screenings()
from public, anon, authenticated;

-- Backfill any screenings that have already ended.
select public.sync_completed_screenings();

-- Install the recurring job when Supabase Cron is enabled. If it is not yet
-- enabled, the function is still ready for a Dashboard Cron job afterward.
do $$
begin
  if to_regprocedure('cron.schedule(text,text,text)') is not null then
    begin
      execute 'select cron.schedule(''complete-finished-screenings'', ''* * * * *'', ''select public.sync_completed_screenings();'')';
    exception when others then
      raise warning 'Could not schedule complete-finished-screenings: %', sqlerrm;
    end;
  else
    raise notice 'Supabase Cron is not enabled; schedule complete-finished-screenings after enabling it.';
  end if;
end;
$$;
