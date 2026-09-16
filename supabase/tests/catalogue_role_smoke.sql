begin;

insert into auth.users(id,email) values
  ('11111111-1111-4111-8111-111111111111','catalogue-manager@example.com'),
  ('22222222-2222-4222-8222-222222222222','catalogue-staff@example.com'),
  ('33333333-3333-4333-8333-333333333333','catalogue-admin@example.com');
update public.profiles set role = 'content_manager'
where id = '11111111-1111-4111-8111-111111111111';
update public.profiles set role = 'check_in_staff'
where id = '22222222-2222-4222-8222-222222222222';
update public.profiles set role = 'admin'
where id = '33333333-3333-4333-8333-333333333333';

set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
insert into public.movies(slug,title,synopsis,status)
values ('manager-created','Manager Created','Test','draft');

select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$
begin
  begin
    insert into public.movies(slug,title,synopsis,status)
    values ('staff-created','Staff Created','Test','draft');
    raise exception 'Check-in staff unexpectedly created a movie';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
insert into public.movies(slug,title,synopsis,status)
values ('admin-created','Admin Created','Test','draft');

reset role;
do $$
begin
  if not exists (select 1 from public.movies where slug = 'manager-created')
    or not exists (select 1 from public.movies where slug = 'admin-created')
    or exists (select 1 from public.movies where slug = 'staff-created') then
    raise exception 'Catalogue role test failed';
  end if;
end;
$$;

rollback;
