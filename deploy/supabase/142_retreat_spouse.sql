-- =====================================================================
--  142. 수양회 — 사모님이 직접 가입해 「내 안내」를 쓰게 (2026-10-28)
--
--  문제: 수양회 화면은 정회원만 열 수 있어, 노회 명단(roster)에 없는 사모님은
--        가입해도 승인대기로 남고 자기 좌석·숙소·메뉴를 직접 볼 수 없었다.
--        남편 화면에서 대신 고르는 길만 있었다.
--  해결:
--   · 임원이 명단에서 사모님 생년월일을 적는다 (retreat_births — 임원만 읽고 쓴다.
--     참가자 명단 표에 두지 않는 까닭은 정회원 누구나 그 표를 읽기 때문이다).
--   · 사모님이 가입할 때 적은 이름·생년월일(profiles, 없으면 가입 정보)이 명단과
--     같으면 수양회 화면이 그분을 알아본다. 정회원이 아니어도(승인대기·일반회원) 된다.
--   · 처음 들어온 날 retreat_link_me() 가 그 계정을 명단 줄에 잇고, 승인대기 계정이면
--     일반회원으로 바꾼다 (감사 기록을 남긴다). 그다음부터 알림도 그 계정으로 간다.
--   · 정회원이 아닌 참가자는 자기(와 배우자)·같은 방·일정·단계만 받는다. 참가자 전체
--     명단은 받지 않는다.
--   · 이름만 같은 일반·승인대기 계정이 회원(목사·장로) 줄을 차지하지 못하도록,
--     이름으로 찾는 길은 정회원에게만 둔다.
--   · 알림은 참가자 본인 계정과 배우자가 묶인 회원 계정 모두에게 간다.
--
--  실행: Supabase → SQL Editor → 전체 붙여넣고 Run.  여러 번 실행해도 안전합니다.
--  ※ 140_retreat.sql 이후에 실행.
-- =====================================================================


-- 1. 사모님 생년월일 (임원만) -------------------------------------------------
create table if not exists public.retreat_births (
  participant_id bigint primary key references public.retreat_participants on delete cascade,
  birth_date     date not null,
  updated_at     timestamptz not null default now()
);

alter table public.retreat_births enable row level security;
drop policy if exists retreat_births_officer on public.retreat_births;
create policy retreat_births_officer on public.retreat_births for all
  using (exists (select 1 from public.retreat_participants p join public.retreats r on r.id = p.retreat_id
                  where p.id = participant_id and public.is_committee_officer(r.committee)))
  with check (exists (select 1 from public.retreat_participants p join public.retreats r on r.id = p.retreat_id
                       where p.id = participant_id and public.is_committee_officer(r.committee)));


-- 2. 내가 가입할 때 적은 생년월일 — profiles 에 없으면 가입 정보(raw_user_meta_data) --
create or replace function public.retreat_my_birth()
returns date language plpgsql stable security definer set search_path = public as $fn$
declare
  v date;
  s text;
begin
  if auth.uid() is null then return null; end if;
  select pr.birth_date into v from public.profiles pr where pr.id = auth.uid();
  if v is not null then return v; end if;
  select u.raw_user_meta_data->>'birth_date' into s from auth.users u where u.id = auth.uid();
  begin
    return s::date;
  exception when others then
    return null;
  end;
end
$fn$;
revoke all on function public.retreat_my_birth() from public;


-- 3. 이 수양회에서 나는 누구인가 ------------------------------------------------
--    ① 이 계정으로 이어진 줄
--    ② 정회원이고 이름이 같은 회원(목사·장로) 줄 — 계정이 둘인 분도
--    ③ 아직 아무 계정과도 이어지지 않은 배우자 줄 중 이름·생년월일이 같은 줄
create or replace function public.retreat_my_participant(p_retreat bigint)
returns bigint language sql stable security definer set search_path = public as $fn$
  select p.id
    from public.retreat_participants p
   where p.retreat_id = p_retreat
     and (p.user_id = auth.uid()
       or (p.companion_of is null and p.role not in ('사모', '배우자') and public.is_member()
           and exists (select 1 from public.profiles pr
                        where pr.id = auth.uid() and pr.name is not null and pr.name = p.name))
       or (p.user_id is null and p.role in ('사모', '배우자')
           and exists (select 1 from public.retreat_births b
                         join public.profiles pr on pr.id = auth.uid()
                        where b.participant_id = p.id and pr.name = p.name
                          and b.birth_date = public.retreat_my_birth())))
   order by (p.user_id = auth.uid()) desc nulls last, p.id
   limit 1
$fn$;


-- 4. 화면이 한 번에 읽는 상태 — 정회원이 아니어도 참가자면 연다 -------------------
create or replace function public.retreat_state(p_retreat bigint default null)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare
  r       public.retreats%rowtype;
  v_me    bigint;
  v_off   boolean;
  v_mem   boolean;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if auth.uid() is null then return jsonb_build_object('login', false); end if;
  v_mem := public.is_member();

  r := public.retreat_pick(p_retreat);
  if r.id is null then return jsonb_build_object('login', true, 'member', v_mem, 'retreat', null); end if;

  v_me := public.retreat_my_participant(r.id);
  /* 정회원도 참가자도 아니면 아무것도 주지 않는다 */
  if not v_mem and v_me is null then
    return jsonb_build_object('login', true, 'member', false, 'retreat', null);
  end if;
  v_off := v_mem and public.is_committee_officer(r.committee);

  return jsonb_build_object(
    'login', true, 'member', v_mem, 'officer', v_off, 'today', v_today,
    'retreat', to_jsonb(r),
    'me', (select to_jsonb(p) from public.retreat_participants p where p.id = v_me),
    'companions', (select coalesce(jsonb_agg(to_jsonb(p) order by p.seq), '[]'::jsonb)
                     from public.retreat_participants p where p.companion_of = v_me),
    'roommates', (select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'name', q.name, 'role', q.role, 'church', q.church)
                                            order by q.seq), '[]'::jsonb)
                    from public.retreat_participants p
                    join public.retreat_participants q
                      on q.retreat_id = p.retreat_id and q.room_group = p.room_group and q.id <> p.id
                   where p.id = v_me and p.room_group is not null),
    'steps', (select coalesce(jsonb_agg(jsonb_build_object(
                         'id', s.id, 'seq', s.seq, 'key', s.key, 'title', s.title, 'body', s.body,
                         'kind', s.kind, 'status', s.status, 'due', s.due, 'variants', s.variants,
                         'notify', s.notify, 'opened_at', s.opened_at,
                         'options', (select coalesce(jsonb_agg(jsonb_build_object(
                                                  'id', o.id, 'seq', o.seq, 'label', o.label, 'note', o.note)
                                                  order by o.seq), '[]'::jsonb)
                                       from public.retreat_options o
                                      where o.step_id = s.id and o.enabled))
                       order by s.seq, s.id), '[]'::jsonb)
                from public.retreat_steps s
               where s.retreat_id = r.id and (v_off or s.status <> '닫힘')),
    'choices', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
                  from public.retreat_choices c
                  join public.retreat_participants p on p.id = c.participant_id
                 where p.retreat_id = r.id
                   and (v_off or p.id = v_me or p.companion_of = v_me)),
    /* 참가자 전체 명단은 정회원에게만 (생년월일은 임원에게만) */
    'participants', case when not v_mem then '[]'::jsonb else
                      (select coalesce(jsonb_agg(
                          jsonb_build_object('id', p.id, 'seq', p.seq, 'name', p.name, 'role', p.role,
                                             'church', p.church, 'companion_of', p.companion_of,
                                             'bus_seat', p.bus_seat, 'van_seat', p.van_seat,
                                             'room_group', p.room_group, 'room_no', p.room_no,
                                             'present', p.present, 'linked', p.user_id is not null)
                          || case when v_off
                                  then jsonb_build_object('paid', p.paid, 'fee', p.fee, 'note', p.note,
                                         'birth_date', (select b.birth_date from public.retreat_births b where b.participant_id = p.id))
                                  else '{}'::jsonb end
                          order by p.seq), '[]'::jsonb)
                         from public.retreat_participants p where p.retreat_id = r.id) end,
    'program', (select coalesce(jsonb_agg(to_jsonb(g) order by g.day_no, g.seq), '[]'::jsonb)
                  from public.retreat_program g where g.retreat_id = r.id)
  );
end
$fn$;
revoke all on function public.retreat_state(bigint) from public;
grant execute on function public.retreat_state(bigint) to authenticated;


-- 5. 처음 들어온 날 계정을 명단 줄에 잇는다 ----------------------------------------
--    배우자 줄에 이어졌고 승인대기 계정이면 일반회원으로 바꾼다.
create or replace function public.retreat_link_me(p_retreat bigint default null)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  r      public.retreats%rowtype;
  p      public.retreat_participants%rowtype;
  v_me   bigint;
  v_gen  boolean := false;
begin
  if auth.uid() is null then return null; end if;
  r := public.retreat_pick(p_retreat);
  if r.id is null then return null; end if;
  v_me := public.retreat_my_participant(r.id);
  if v_me is null then return jsonb_build_object('linked', false); end if;

  select * into p from public.retreat_participants where id = v_me;
  if p.user_id is not null then
    return jsonb_build_object('linked', p.user_id = auth.uid(), 'participant', p.id);
  end if;
  /* 이 계정이 이미 다른 줄에 이어져 있으면 두 번 잇지 않는다 */
  if exists (select 1 from public.retreat_participants x where x.retreat_id = r.id and x.user_id = auth.uid()) then
    return jsonb_build_object('linked', false);
  end if;

  update public.retreat_participants set user_id = auth.uid(), updated_at = now()
   where id = p.id and user_id is null;

  if p.role in ('사모', '배우자') then
    update public.profiles set role = 'general' where id = auth.uid() and role = 'pending';
    v_gen := found;
  end if;

  insert into public.audit_logs (user_id, user_email, user_name, role, type, action, detail)
  select auth.uid(), pr.email, pr.name, pr.role, 'update', '수양회 참가자 연결',
         r.title || ' / ' || p.seq || '. ' || p.name || ' ' || p.role ||
         case when v_gen then ' · 승인대기 → 일반회원' else '' end
    from public.profiles pr where pr.id = auth.uid();

  return jsonb_build_object('linked', true, 'participant', p.id, 'general', v_gen);
end
$fn$;
revoke all on function public.retreat_link_me(bigint) from public;
grant execute on function public.retreat_link_me(bigint) to authenticated;


-- 6. 알림 — 참가자 본인 계정과 배우자가 묶인 회원 계정 모두에게 -------------------
create or replace function public.retreat_notify_participants(p_retreat bigint, p_title text, p_body text, p_key text)
returns integer language plpgsql security definer set search_path = public as $fn$
declare v_n integer := 0;
begin
  insert into public.notifications (user_id, kind, title, body, dedupe_key)
  select u.user_id, '수양회', p_title, p_body, p_key
    from (select p.user_id from public.retreat_participants p
           where p.retreat_id = p_retreat and p.user_id is not null
          union
          select m.user_id from public.retreat_participants p
            join public.retreat_participants m on m.id = p.companion_of
           where p.retreat_id = p_retreat and m.user_id is not null) u
   where not exists (select 1 from public.notifications n
                      where n.user_id = u.user_id and n.dedupe_key = p_key);
  get diagnostics v_n = row_count;
  return v_n;
end
$fn$;
revoke all on function public.retreat_notify_participants(bigint, text, text, text) from public;


-- 확인 — 사모님 줄과 생년월일·계정 연결 상태
select p.seq, p.name, p.role,
       case when b.birth_date is null then '생년월일 없음' else '생년월일 있음' end as "생년월일",
       case when p.user_id is null then '-' else '연결됨' end as "계정"
  from public.retreat_participants p
  left join public.retreat_births b on b.participant_id = p.id
 where p.role in ('사모', '배우자')
 order by p.seq;
