-- Admin-only, audited pricing-rule deletion. Active rules and rules referenced
-- by historical catalogue rows are retained to prevent checkout outages and
-- preserve the pricing context of existing records.

alter table public.catalogue_deletion_audit_log
  drop constraint if exists catalogue_deletion_audit_log_entity_type_check;

alter table public.catalogue_deletion_audit_log
  add constraint catalogue_deletion_audit_log_entity_type_check
  check (entity_type in ('movie', 'screening', 'pricing_rule'));

create or replace function public.admin_delete_pricing_rule(
  p_actor uuid,
  p_pricing_rule_id uuid
)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_rule public.pricing_rules%rowtype;
  v_reference_count integer := 0;
begin
  if not exists (
    select 1 from public.profiles where id = p_actor and role = 'admin'
  ) then
    raise exception 'ADMIN_FORBIDDEN';
  end if;

  select * into v_rule from public.pricing_rules
  where id = p_pricing_rule_id for update;
  if not found then raise exception 'PRICING_RULE_NOT_FOUND'; end if;

  if v_rule.is_active then
    return jsonb_build_object(
      'deleted', false,
      'reason', 'active_pricing_rule',
      'title', v_rule.name
    );
  end if;

  select count(*)::integer into v_reference_count
  from public.screenings where pricing_rule_id = p_pricing_rule_id;

  if v_reference_count > 0 then
    return jsonb_build_object(
      'deleted', false,
      'reason', 'pricing_rule_in_use',
      'title', v_rule.name,
      'session_count', v_reference_count
    );
  end if;

  insert into public.catalogue_deletion_audit_log(
    actor_user_id, entity_type, entity_id, entity_title, details
  ) values (
    p_actor, 'pricing_rule', v_rule.id, v_rule.name,
    jsonb_build_object(
      'venue_id', v_rule.venue_id,
      'effective_from', v_rule.effective_from,
      'effective_until', v_rule.effective_until
    )
  );

  delete from public.pricing_rules where id = p_pricing_rule_id;
  return jsonb_build_object(
    'deleted', true,
    'entity', 'pricing_rule',
    'title', v_rule.name
  );
end;
$$;

revoke all on function public.admin_delete_pricing_rule(uuid,uuid)
from public, anon, authenticated;
grant execute on function public.admin_delete_pricing_rule(uuid,uuid)
to service_role;
