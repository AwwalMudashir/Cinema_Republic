-- Keep individual admission available when a legacy active pricing rule has
-- no group totals yet. Group checkout remains fail-closed in
-- flex_price_for_venue() until both group prices are configured.

create or replace function public.public_flex_pass_products()
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare v_now timestamptz := clock_timestamp();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'venue_id', v.id,
      'venue_name', v.name,
      'venue_address', v.address,
      'venue_city', v.city,
      'venue_timezone', v.timezone,
      'band', wb.band,
      'purchase_date', wb.local_date,
      'valid_from', v_now,
      'valid_until', wb.window_end,
      'individual_price_kobo', case when day_info.is_weekday
        then price.weekday_price_kobo else price.weekend_price_kobo end,
      'group_price_kobo', case when day_info.is_weekday
        then price.group_weekday_price_kobo else price.group_weekend_price_kobo end,
      'group_available', case when day_info.is_weekday
        then price.group_weekday_price_kobo is not null
        else price.group_weekend_price_kobo is not null end
    ) order by v.name)
    from public.venues v
    cross join lateral public.flex_window_bounds(v_now, v.timezone) wb
    cross join lateral (
      select extract(isodow from (v_now at time zone v.timezone))::integer between 1 and 4
        as is_weekday
    ) day_info
    cross join lateral (
      select pr.weekday_price_kobo, pr.weekend_price_kobo,
        pr.group_weekday_price_kobo, pr.group_weekend_price_kobo
      from public.pricing_rules pr
      where pr.is_active
        and (pr.venue_id = v.id or pr.venue_id is null)
        and pr.effective_from <= wb.local_date
        and (pr.effective_until is null or pr.effective_until >= wb.local_date)
      order by (pr.venue_id = v.id) desc, pr.effective_from desc, pr.created_at desc
      limit 1
    ) price
    where v.is_active
      and (case when day_info.is_weekday
        then price.weekday_price_kobo else price.weekend_price_kobo end) > 0
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.public_flex_pass_products() from public;
grant execute on function public.public_flex_pass_products()
to anon, authenticated, service_role;
