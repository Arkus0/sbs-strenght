begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'athlete-one@example.test', '', now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'athlete-two@example.test', '', now(), now());

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

select lives_ok(
  $$insert into public.profiles (user_id, payload) values ('11111111-1111-1111-1111-111111111111', '{"theme":"system"}')$$,
  'athlete can create their own profile'
);

select lives_ok(
  $$insert into public.programs (id, user_id, payload) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '{"name":"SBS"}')$$,
  'athlete can create their own program'
);

select lives_ok(
  $$insert into public.sessions (id, user_id, program_id, payload) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '{"code":"W1D1"}')$$,
  'athlete can create their own session'
);

select lives_ok(
  $$insert into public.measurements (id, user_id, payload) values ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', '{"value":80}')$$,
  'athlete can create their own measurement'
);

select results_eq(
  $$select count(*)::bigint from public.sessions$$,
  $$values (1::bigint)$$,
  'owner can read their session'
);

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);

select results_eq(
  $$select count(*)::bigint from public.sessions$$,
  $$values (0::bigint)$$,
  'another athlete cannot read the session'
);

select throws_ok(
  $$insert into public.measurements (id, user_id, payload) values ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', '{"value":90}')$$,
  '42501',
  null,
  'another athlete cannot write rows for the owner'
);

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

select ok(
  (select change_version from public.sessions where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') > 0,
  'sync cursor is populated'
);

select * from finish();
rollback;
