begin;

alter table public.links add column if not exists access_policy jsonb not null
  default '{"requireCaptcha":false,"waitSeconds":0,"revealText":""}'::jsonb;

alter table public.links drop constraint if exists links_access_policy_check;
alter table public.links add constraint links_access_policy_check check (
  jsonb_typeof(access_policy) = 'object'
  and access_policy ?& array['requireCaptcha', 'waitSeconds', 'revealText']
  and jsonb_typeof(access_policy->'requireCaptcha') = 'boolean'
  and jsonb_typeof(access_policy->'waitSeconds') = 'number'
  and (access_policy->>'waitSeconds')::numeric between 0 and 300
  and (access_policy->>'waitSeconds')::numeric = trunc((access_policy->>'waitSeconds')::numeric)
  and jsonb_typeof(access_policy->'revealText') = 'string'
  and length(access_policy->>'revealText') <= 2000
);

commit;
