-- =====================================================================
--  140. 수양회 — 참가자 안내 · 단계별 선택 · 진행 관리 (2026-10-28)
--
--  문제: 교육친교부 제주 부부수양회의 명단·좌석·숙소·카페 주문·일정표가
--        임원 개인 도구(아티팩트)와 github.io 복사본에 흩어져 있어, 고칠 때마다
--        손으로 옮겨야 했고 참가자는 자기 좌석·방·골라야 할 것을 홈페이지에서
--        볼 수 없었다.
--  해결:
--   · 부서 달력의 수양회 일정(committee_events, 136 sql 로 노회 일정과 이어짐)에
--     수양회 한 건(retreats)을 붙이고, 그 아래에 참가자(retreat_participants),
--     진행 단계(retreat_steps: 탑승 안내 → 좌석 → 숙소 → 카페 주문 …),
--     단계별 선택지(retreat_options)와 참가자별 선택(retreat_choices),
--     일정표·안내 멘트(retreat_program)를 둔다.
--   · 참가자는 「내 안내」에서 자기(와 배우자)의 좌석·방·열린 단계를 보고 고른다.
--     회원 연결은 user_id 로, 없으면 이름이 같은 가입 회원으로 찾는다.
--     배우자(사모·배우자)는 companion_of 로 회원에게 묶여 회원 화면에서 함께 다룬다.
--   · 임원(그 부서의 부장·서기·회계·지정 임원 = is_committee_officer)은 단계를
--     열고(열림) 마감하며, 열 때 참가자 회원에게 알림을 보낸다 (notifications, dedupe).
--   · 메인 화면 히어로와 대시보드는 retreat_today() 로 수양회 기간인지 안다.
--
--  표는 모두 RLS. 선택(retreat_choose)·단계 전환(retreat_set_step)·공지(retreat_notify)는
--  함수로만 한다. 참가자 명단(개인정보)은 이 파일에 넣지 않는다 — 별도 시드
--  (140b, 공개 저장소에 올리지 않음)로 SQL Editor 에서만 넣는다.
--
--  실행: Supabase → SQL Editor → 전체 붙여넣고 Run.  여러 번 실행해도 안전합니다.
--  ※ 20_committees.sql, 136_committee_schedule_link.sql 이후에 실행.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. 수양회
--    committee_event_id : 부서 달력의 그 일정 (제주 부부수양회 = 6번). 외래 키는
--                         걸지 않는다 — 부서 일정이 지워져도 수양회 기록은 남긴다.
--    stage  : 준비 / 진행 / 마침  (임원이 바꾼다. 화면 문구에만 쓴다)
--    status : open / closed       (closed 면 retreat_pick · retreat_today 에서 빠진다)
-- ---------------------------------------------------------------------
create table if not exists public.retreats (
  id                 bigserial primary key,
  committee          text not null default '교육친교부',
  committee_event_id bigint,
  title              text not null,
  start_date         date not null,
  end_date           date,
  place              text,
  verse              text,
  chat_url           text,          -- 단톡방
  guide_url          text,          -- 가이드북(포스터·사진) 주소
  survey_url         text,          -- 설문·자료 모음
  stage              text not null default '준비' check (stage in ('준비', '진행', '마침')),
  status             text not null default 'open'  check (status in ('open', 'closed')),
  settings           jsonb not null default '{}'::jsonb,   -- 항공편·호텔 등 자유 칸
  created_by         text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists retreats_idx on public.retreats (status, start_date desc);

alter table public.retreats enable row level security;
drop policy if exists retreats_read  on public.retreats;
drop policy if exists retreats_write on public.retreats;
create policy retreats_read  on public.retreats for select using (public.is_member());
create policy retreats_write on public.retreats for all
  using (public.is_committee_officer(committee)) with check (public.is_committee_officer(committee));


-- ---------------------------------------------------------------------
-- 2. 참가자
--    seq          : 명단 번호 (좌석표·방 배정표의 번호와 같다)
--    role         : 목사 / 장로 / 원로목사 / 사모 / 배우자
--    user_id      : 홈페이지 회원 (없으면 이름으로 찾는다 — retreat_my_participant)
--    companion_of : 배우자가 묶인 회원 참가자 (그 회원 화면에서 함께 고른다)
--    room_group   : 같은 방 번호(배정표 줄 번호). room_no 는 호텔이 정해 준 호수
--    전화번호는 두지 않는다 — 회원은 profiles 에 있고, 배우자 연락은 회원을 통한다.
-- ---------------------------------------------------------------------
create table if not exists public.retreat_participants (
  id           bigserial primary key,
  retreat_id   bigint not null references public.retreats on delete cascade,
  seq          integer not null,
  name         text not null,
  role         text not null default '목사',
  church       text,
  user_id      uuid references auth.users on delete set null,
  companion_of bigint references public.retreat_participants on delete set null,
  fee          integer,
  paid         integer not null default 0,
  bus_seat     integer,
  van_seat     integer,
  room_group   integer,
  room_no      text,
  present      boolean not null default false,
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index if not exists retreat_participants_seq_idx on public.retreat_participants (retreat_id, seq);
create index if not exists retreat_participants_user_idx on public.retreat_participants (user_id);
create index if not exists retreat_participants_comp_idx on public.retreat_participants (companion_of);

alter table public.retreat_participants enable row level security;
drop policy if exists retreat_participants_read  on public.retreat_participants;
drop policy if exists retreat_participants_write on public.retreat_participants;
-- 명단·좌석·방은 정회원이 함께 본다 (납부액·메모는 retreat_state 가 임원에게만 준다)
create policy retreat_participants_read  on public.retreat_participants for select using (public.is_member());
create policy retreat_participants_write on public.retreat_participants for all
  using (exists (select 1 from public.retreats r where r.id = retreat_id and public.is_committee_officer(r.committee)))
  with check (exists (select 1 from public.retreats r where r.id = retreat_id and public.is_committee_officer(r.committee)));


-- ---------------------------------------------------------------------
-- 3. 진행 단계
--    kind   : 안내(읽기만) / 배정(좌석·방 — 참가자 칸을 보여 준다) / 선택(선택지 중 고른다)
--    status : 닫힘(참가자에게 안 보임) / 열림(고를 수 있음) / 마감(보이되 못 고침)
--    variants : 선택에 덧붙이는 갈래 (예: 차갑게 / 따뜻하게 / 상관없음)
-- ---------------------------------------------------------------------
create table if not exists public.retreat_steps (
  id         bigserial primary key,
  retreat_id bigint not null references public.retreats on delete cascade,
  seq        integer not null default 0,
  key        text not null,
  title      text not null,
  body       text,
  kind       text not null default '안내' check (kind in ('안내', '배정', '선택')),
  status     text not null default '닫힘' check (status in ('닫힘', '열림', '마감')),
  due        date,
  variants   text[],
  notify     boolean not null default false,   -- 열 때 알림을 보냈는가
  opened_at  timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists retreat_steps_key_idx on public.retreat_steps (retreat_id, key);

alter table public.retreat_steps enable row level security;
drop policy if exists retreat_steps_read  on public.retreat_steps;
drop policy if exists retreat_steps_write on public.retreat_steps;
create policy retreat_steps_read  on public.retreat_steps for select using (public.is_member());
create policy retreat_steps_write on public.retreat_steps for all
  using (exists (select 1 from public.retreats r where r.id = retreat_id and public.is_committee_officer(r.committee)))
  with check (exists (select 1 from public.retreats r where r.id = retreat_id and public.is_committee_officer(r.committee)));


-- ---------------------------------------------------------------------
-- 4. 선택지 (카페 메뉴 등)
-- ---------------------------------------------------------------------
create table if not exists public.retreat_options (
  id      bigserial primary key,
  step_id bigint not null references public.retreat_steps on delete cascade,
  seq     integer not null default 0,
  label   text not null,
  note    text,
  enabled boolean not null default true
);
create unique index if not exists retreat_options_seq_idx on public.retreat_options (step_id, seq);

alter table public.retreat_options enable row level security;
drop policy if exists retreat_options_read  on public.retreat_options;
drop policy if exists retreat_options_write on public.retreat_options;
create policy retreat_options_read  on public.retreat_options for select using (public.is_member());
create policy retreat_options_write on public.retreat_options for all
  using (exists (select 1 from public.retreat_steps s join public.retreats r on r.id = s.retreat_id
                  where s.id = step_id and public.is_committee_officer(r.committee)))
  with check (exists (select 1 from public.retreat_steps s join public.retreats r on r.id = s.retreat_id
                       where s.id = step_id and public.is_committee_officer(r.committee)));


-- ---------------------------------------------------------------------
-- 5. 참가자별 선택 — 쓰기는 retreat_choose() 로만
-- ---------------------------------------------------------------------
create table if not exists public.retreat_choices (
  id             bigserial primary key,
  step_id        bigint not null references public.retreat_steps on delete cascade,
  participant_id bigint not null references public.retreat_participants on delete cascade,
  option_id      bigint references public.retreat_options on delete set null,
  option_label   text,
  variant        text,
  note           text,
  chosen_by      uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists retreat_choices_idx on public.retreat_choices (step_id, participant_id);

alter table public.retreat_choices enable row level security;
drop policy if exists retreat_choices_read  on public.retreat_choices;
drop policy if exists retreat_choices_write on public.retreat_choices;
-- 내 것·내 배우자 것은 보고, 임원은 다 본다. 쓰기는 함수(security definer)가 한다.
create policy retreat_choices_read on public.retreat_choices for select
  using (exists (select 1 from public.retreat_participants p
                  join public.retreats r on r.id = p.retreat_id
                 where p.id = participant_id
                   and (p.user_id = auth.uid()
                     or exists (select 1 from public.retreat_participants m
                                 where m.id = p.companion_of and m.user_id = auth.uid())
                     or public.is_committee_officer(r.committee))));
create policy retreat_choices_write on public.retreat_choices for all
  using (exists (select 1 from public.retreat_participants p join public.retreats r on r.id = p.retreat_id
                  where p.id = participant_id and public.is_committee_officer(r.committee)))
  with check (exists (select 1 from public.retreat_participants p join public.retreats r on r.id = p.retreat_id
                       where p.id = participant_id and public.is_committee_officer(r.committee)));


-- ---------------------------------------------------------------------
-- 6. 일정표 · 안내 멘트
--    kind   : move(이동) / meal(식사) / sight(관광) / rest(휴식) / wor(예배) / ment(안내 멘트)
--    status : 예정 / 진행 / 끝 / 변경   (당일 임원이 바꾼다 — 히어로·내 안내가 따라간다)
--    ment 는 time 없이 day_no 아래 글로만 둔다 (seq 900 번대).
-- ---------------------------------------------------------------------
create table if not exists public.retreat_program (
  id         bigserial primary key,
  retreat_id bigint not null references public.retreats on delete cascade,
  day_no     integer not null,
  day_date   date,
  seq        integer not null,
  time       text,
  title      text not null,
  body       text,
  kind       text not null default 'move',
  place      text,
  depart     text,            -- 그곳에서 떠나는 시각
  move       text,            -- 다음 곳까지 이동 (버스 10분 · 2km)
  ref        text,            -- 아티팩트 쪽 번호 (d1-3, c2 …) — 대조용
  status     text not null default '예정' check (status in ('예정', '진행', '끝', '변경')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists retreat_program_idx on public.retreat_program (retreat_id, day_no, seq);

alter table public.retreat_program enable row level security;
drop policy if exists retreat_program_read  on public.retreat_program;
drop policy if exists retreat_program_write on public.retreat_program;
create policy retreat_program_read  on public.retreat_program for select using (public.is_member());
create policy retreat_program_write on public.retreat_program for all
  using (exists (select 1 from public.retreats r where r.id = retreat_id and public.is_committee_officer(r.committee)))
  with check (exists (select 1 from public.retreats r where r.id = retreat_id and public.is_committee_officer(r.committee)));


-- ---------------------------------------------------------------------
-- 7. 어느 수양회인가
--    번호를 주면 그것, 아니면 오늘 열리는 것 → 가장 가까운 앞으로의 것 → 가장 최근 것
-- ---------------------------------------------------------------------
create or replace function public.retreat_pick(p_retreat bigint default null)
returns public.retreats language sql stable security definer set search_path = public as $fn$
  select r.*
    from public.retreats r
   where (p_retreat is not null and r.id = p_retreat)
      or (p_retreat is null and r.status = 'open')
   order by case when p_retreat is not null then 0
                 when (now() at time zone 'Asia/Seoul')::date
                      between r.start_date and coalesce(r.end_date, r.start_date) then 1
                 when r.start_date >= (now() at time zone 'Asia/Seoul')::date then 2
                 else 3 end,
            abs(r.start_date - (now() at time zone 'Asia/Seoul')::date),
            r.id desc
   limit 1
$fn$;

-- 이 수양회에서 나는 누구인가 — 회원 연결(user_id)이 먼저, 아니면 이름이 같은 회원 참가자.
-- 계정이 둘인 분(서기 등)이 다른 계정으로 들어와도 이름으로 찾도록, 연결된 줄도 이름 대조에 넣는다.
-- (user_id 는 알림을 보낼 계정을 정할 뿐이다)
create or replace function public.retreat_my_participant(p_retreat bigint)
returns bigint language sql stable security definer set search_path = public as $fn$
  select p.id
    from public.retreat_participants p
   where p.retreat_id = p_retreat
     and (p.user_id = auth.uid()
       or (p.companion_of is null
           and exists (select 1 from public.profiles pr
                        where pr.id = auth.uid() and pr.name is not null and pr.name = p.name)))
   order by (p.user_id = auth.uid()) desc nulls last, p.id
   limit 1
$fn$;

-- 이 참가자 몫을 내가 고칠 수 있는가 — 본인, 본인에게 묶인 배우자, 임원
create or replace function public.retreat_can_act(p_participant bigint)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1
      from public.retreat_participants p
      join public.retreats r on r.id = p.retreat_id
     where p.id = p_participant
       and (p.id = public.retreat_my_participant(p.retreat_id)
         or p.companion_of = public.retreat_my_participant(p.retreat_id)
         or public.is_committee_officer(r.committee))
  )
$fn$;


-- ---------------------------------------------------------------------
-- 8. 화면이 한 번에 읽는 상태
--    참가자 : retreat, me, companions, roommates, 열린·마감 단계와 선택지, 내 선택, 일정표
--    임원   : 닫힌 단계·모든 선택·납부액·메모까지
-- ---------------------------------------------------------------------
create or replace function public.retreat_state(p_retreat bigint default null)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare
  r       public.retreats%rowtype;
  v_me    bigint;
  v_off   boolean;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if auth.uid() is null then return jsonb_build_object('login', false); end if;
  if not public.is_member() then return jsonb_build_object('login', true, 'member', false); end if;

  r := public.retreat_pick(p_retreat);
  if r.id is null then return jsonb_build_object('login', true, 'member', true, 'retreat', null); end if;

  v_off := public.is_committee_officer(r.committee);
  v_me  := public.retreat_my_participant(r.id);

  return jsonb_build_object(
    'login', true, 'member', true, 'officer', v_off, 'today', v_today,
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
    'participants', (select coalesce(jsonb_agg(
                          jsonb_build_object('id', p.id, 'seq', p.seq, 'name', p.name, 'role', p.role,
                                             'church', p.church, 'companion_of', p.companion_of,
                                             'bus_seat', p.bus_seat, 'van_seat', p.van_seat,
                                             'room_group', p.room_group, 'room_no', p.room_no,
                                             'present', p.present, 'linked', p.user_id is not null)
                          || case when v_off
                                  then jsonb_build_object('paid', p.paid, 'fee', p.fee, 'note', p.note)
                                  else '{}'::jsonb end
                          order by p.seq), '[]'::jsonb)
                       from public.retreat_participants p where p.retreat_id = r.id),
    'program', (select coalesce(jsonb_agg(to_jsonb(g) order by g.day_no, g.seq), '[]'::jsonb)
                  from public.retreat_program g where g.retreat_id = r.id)
  );
end
$fn$;
revoke all on function public.retreat_state(bigint) from public;
grant execute on function public.retreat_state(bigint) to authenticated;


-- ---------------------------------------------------------------------
-- 9. 고르기 — 본인·배우자 몫만, 열린 단계에서만 (임원은 마감 뒤에도 대신 고칠 수 있다)
--    p_option 과 p_note 가 모두 비면 선택을 거둔다.
-- ---------------------------------------------------------------------
create or replace function public.retreat_choose(p_step bigint, p_participant bigint,
                                                 p_option bigint default null,
                                                 p_variant text default null,
                                                 p_note text default null)
returns bigint language plpgsql security definer set search_path = public as $fn$
declare
  s     public.retreat_steps%rowtype;
  p     public.retreat_participants%rowtype;
  r     public.retreats%rowtype;
  v_lbl text;
  v_id  bigint;
  v_off boolean;
begin
  if auth.uid() is null then raise exception '로그인해 주세요.'; end if;
  select * into s from public.retreat_steps where id = p_step;
  if s.id is null then raise exception '단계를 찾을 수 없습니다.'; end if;
  select * into p from public.retreat_participants where id = p_participant;
  if p.id is null or p.retreat_id <> s.retreat_id then raise exception '참가자를 찾을 수 없습니다.'; end if;
  select * into r from public.retreats where id = s.retreat_id;
  v_off := public.is_committee_officer(r.committee);

  if not public.retreat_can_act(p.id) then
    raise exception '본인과 배우자 몫만 고르실 수 있습니다.';
  end if;
  if s.kind <> '선택' then raise exception '고르는 단계가 아닙니다.'; end if;
  if s.status <> '열림' and not v_off then
    if s.status = '마감' then
      raise exception '이 단계는 마감되었습니다. 바꾸시려면 임원에게 말씀해 주세요.';
    end if;
    raise exception '아직 열리지 않은 단계입니다.';
  end if;

  if p_option is null and btrim(coalesce(p_note, '')) = '' then
    delete from public.retreat_choices where step_id = s.id and participant_id = p.id;
    return null;
  end if;

  if p_option is not null then
    select label into v_lbl from public.retreat_options where id = p_option and step_id = s.id and enabled;
    if v_lbl is null then raise exception '선택지가 맞지 않습니다.'; end if;
  end if;
  if p_variant is not null and s.variants is not null and not (p_variant = any(s.variants)) then
    raise exception '갈래가 맞지 않습니다.';
  end if;

  insert into public.retreat_choices (step_id, participant_id, option_id, option_label, variant, note, chosen_by)
  values (s.id, p.id, p_option, v_lbl, nullif(btrim(coalesce(p_variant, '')), ''),
          nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  on conflict (step_id, participant_id) do update
     set option_id = excluded.option_id, option_label = excluded.option_label,
         variant = excluded.variant, note = excluded.note,
         chosen_by = excluded.chosen_by, updated_at = now()
  returning id into v_id;
  return v_id;
end
$fn$;
revoke all on function public.retreat_choose(bigint, bigint, bigint, text, text) from public;
grant execute on function public.retreat_choose(bigint, bigint, bigint, text, text) to authenticated;


-- ---------------------------------------------------------------------
-- 10. 참가자 회원에게 알리기 (공통) — 참가자 본인과, 배우자가 묶인 회원에게
--     같은 dedupe_key 로는 두 번 가지 않는다.
-- ---------------------------------------------------------------------
create or replace function public.retreat_notify_participants(p_retreat bigint, p_title text, p_body text, p_key text)
returns integer language plpgsql security definer set search_path = public as $fn$
declare v_n integer := 0;
begin
  insert into public.notifications (user_id, kind, title, body, dedupe_key)
  select u.user_id, '수양회', p_title, p_body, p_key
    from (select distinct coalesce(m.user_id, p.user_id) as user_id
            from public.retreat_participants p
            left join public.retreat_participants m on m.id = p.companion_of
           where p.retreat_id = p_retreat) u
   where u.user_id is not null
     and not exists (select 1 from public.notifications n
                      where n.user_id = u.user_id and n.dedupe_key = p_key);
  get diagnostics v_n = row_count;
  return v_n;
end
$fn$;
revoke all on function public.retreat_notify_participants(bigint, text, text, text) from public;


-- ---------------------------------------------------------------------
-- 11. 단계 열기·마감·닫기 — 임원만. 열면서 p_notify 면 참가자에게 알림.
-- ---------------------------------------------------------------------
create or replace function public.retreat_set_step(p_step bigint, p_status text, p_notify boolean default false)
returns integer language plpgsql security definer set search_path = public as $fn$
declare
  s   public.retreat_steps%rowtype;
  r   public.retreats%rowtype;
  v_n integer := 0;
begin
  if auth.uid() is null then raise exception '로그인해 주세요.'; end if;
  select * into s from public.retreat_steps where id = p_step;
  if s.id is null then raise exception '단계를 찾을 수 없습니다.'; end if;
  select * into r from public.retreats where id = s.retreat_id;
  if not public.is_committee_officer(r.committee) then
    raise exception '이 부서의 임원만 단계를 바꿀 수 있습니다.';
  end if;
  if p_status not in ('닫힘', '열림', '마감') then raise exception '상태가 맞지 않습니다.'; end if;

  update public.retreat_steps
     set status = p_status,
         opened_at = case when p_status = '열림' then coalesce(opened_at, now()) else opened_at end,
         updated_at = now()
   where id = s.id;

  if p_status = '열림' and p_notify then
    v_n := public.retreat_notify_participants(
             r.id,
             '[' || r.title || '] ' || s.title,
             coalesce(s.body, '') ||
             case when s.kind = '선택' then chr(10) || '홈페이지 → 수양회 → 내 안내에서 골라 주세요.' else '' end ||
             case when s.due is not null then chr(10) || '기한 : ' || to_char(s.due, 'FMMM월 FMDD일') else '' end,
             'retreat-step-' || s.id);
    update public.retreat_steps set notify = true where id = s.id;
  end if;
  return v_n;
end
$fn$;
revoke all on function public.retreat_set_step(bigint, text, boolean) from public;
grant execute on function public.retreat_set_step(bigint, text, boolean) to authenticated;


-- ---------------------------------------------------------------------
-- 12. 임원 공지 — 참가자 전원에게 알림 (같은 글은 한 번만)
-- ---------------------------------------------------------------------
create or replace function public.retreat_notify(p_retreat bigint, p_title text, p_body text default null)
returns integer language plpgsql security definer set search_path = public as $fn$
declare r public.retreats%rowtype;
begin
  if auth.uid() is null then raise exception '로그인해 주세요.'; end if;
  select * into r from public.retreats where id = p_retreat;
  if r.id is null then raise exception '수양회를 찾을 수 없습니다.'; end if;
  if not public.is_committee_officer(r.committee) then
    raise exception '이 부서의 임원만 공지를 보낼 수 있습니다.';
  end if;
  if btrim(coalesce(p_title, '')) = '' then raise exception '제목을 적어 주세요.'; end if;
  return public.retreat_notify_participants(
           r.id, '[' || r.title || '] ' || btrim(p_title), p_body,
           'retreat-notice-' || r.id || '-' || md5(btrim(p_title) || coalesce(p_body, '')));
end
$fn$;
revoke all on function public.retreat_notify(bigint, text, text) from public;
grant execute on function public.retreat_notify(bigint, text, text) to authenticated;


-- ---------------------------------------------------------------------
-- 13. 오늘이 수양회 기간인가 — 메인 히어로·대시보드 카드용 (로그인 전에도 읽는다)
--     stage 가 '마침'이면 기간 중이라도 띄우지 않는다.
-- ---------------------------------------------------------------------
create or replace function public.retreat_today()
returns jsonb language sql stable security definer set search_path = public as $fn$
  select jsonb_build_object('id', r.id, 'title', r.title, 'place', r.place,
                            'start_date', r.start_date, 'end_date', r.end_date, 'stage', r.stage,
                            'day_no', ((now() at time zone 'Asia/Seoul')::date - r.start_date) + 1,
                            'days', (coalesce(r.end_date, r.start_date) - r.start_date) + 1)
    from public.retreats r
   where r.status = 'open' and r.stage <> '마침'
     and (now() at time zone 'Asia/Seoul')::date between r.start_date and coalesce(r.end_date, r.start_date)
   order by r.id desc
   limit 1
$fn$;
grant execute on function public.retreat_today() to anon, authenticated;


-- =====================================================================
--  14. 시드 — 2026 제주 부부수양회 (개인정보 없음)
--      아티팩트(가이드북)의 일정표 35줄 · 안내 멘트 19편 · 카페 메뉴 4곳 · 진행 단계.
--      이미 있으면 건드리지 않는다 (제목·본문을 홈페이지에서 고친 것이 지워지지 않게).
-- =====================================================================
do $seed$
declare
  v_r   bigint;
  v_ce  bigint;
  v_s   bigint;
begin
  -- 부서 달력의 그 일정 (136 sql 로 노회 일정 10번과 이어진 줄)
  select id into v_ce from public.committee_events
   where committee = '교육친교부' and title like '%제주%수양회%'
   order by event_date desc nulls last, id limit 1;

  select id into v_r from public.retreats where title = $t$2026 제주 부부수양회$t$ limit 1;
  if v_r is null then
    insert into public.retreats (committee, committee_event_id, title, start_date, end_date, place, verse,
                                 chat_url, guide_url, survey_url, stage, settings, created_by)
    values ('교육친교부', v_ce, $t$2026 제주 부부수양회$t$, date '2026-11-02', date '2026-11-04',
            '제주 · 라마다 제주함덕호텔', $t$마가복음 6장 31절 (개역개정)
이르시되 너희는 따로 한적한 곳에 가서 잠깐 쉬어라 하시니 이는 오고 가는 사람이 많아 음식 먹을 겨를도 없음이라$t$,
            $t$https://open.kakao.com/o/gqvWzxTi$t$, 'https://dongjin0191.github.io/jeju-2026/', $t$https://drive.google.com/drive/folders/1SEcLwN5OF8Q0FdEePYLkwIaJ-pfIVs4h?usp=sharing$t$,
            '준비', $t${"flight_out": "이스타 ZE201 · 김포 06:45 → 제주 08:00 · 집결 05:30 국내선", "hotel": "라마다 제주함덕호텔 (제주시 조천읍 신북로 470 · 064-793-5500)", "worship": [{"k": "찬양", "v": "손병민 목사(노진교회)"}, {"k": "사회", "v": "김선민 목사 (교육친교부 부총무)"}, {"k": "찬송", "v": "413장 내 평생에 가는 길"}, {"k": "대표기도", "v": "박현정 목사 (직전 친교부장)"}, {"k": "성경 본문", "v": "마가복음 6장 31절 · 봉독 안상천 목사 (회계)"}, {"k": "설교 제목", "v": "잠깐 쉬어라"}, {"k": "설교", "v": "강명우목사(교육친교부 부장)"}, {"k": "찬송", "v": "419장 주 날개 밑 내가 평안히 쉬네"}, {"k": "축도", "v": "박흥열 목사 (시화산노회 노회장)"}, {"k": "광고", "v": "이동진 목사 (교육친교부 총무)"}], "prayers": [{"k": "공항 출발 기도", "v": "기도생략"}, {"k": "1일 출발 버스", "v": "신동열 원로목사 (노진교회)"}, {"k": "1일 출발 쏠라티", "v": "김충현 원로목사 (운평장로교회)"}, {"k": "1일 중식 기도", "v": "서용호 목사 (수암제일교회)"}, {"k": "1일 석식 기도", "v": "박양수 목사 (힘찬교회)"}, {"k": "1일 마침 버스", "v": "이재용 목사 (안산상록교회)"}, {"k": "1일 마침 쏠라티", "v": "명영석 목사 (행복한교회)"}, {"k": "2일 출발 버스", "v": "전종호 목사 (동탄인랜드교회)"}, {"k": "2일 출발 쏠라티", "v": "김종수 목사 (섬기는교회)"}, {"k": "2일 중식 기도", "v": "김성중 목사 (한숲우리교회)"}, {"k": "2일 석식 기도", "v": "권병렬 목사 (섬김의교회)"}, {"k": "2일 마침 버스", "v": "김지수 목사 (반월교회)"}, {"k": "2일 마침 쏠라티", "v": "유성준 목사 (주품에교회)"}, {"k": "3일 출발 버스", "v": "김영돈 목사 (안산원곡동교회)"}, {"k": "3일 출발 쏠라티", "v": "김동석 목사 (운평장로교회)"}, {"k": "3일 중식 기도", "v": "김운갑 목사 (시흥은혜교회)"}, {"k": "3일 마침 버스", "v": "문태환 목사 (성산교회)"}, {"k": "3일 마침 쏠라티", "v": "박영수 장로 (안산샬롬교회)"}, {"k": "최종 마침 기도", "v": "강명우 목사 (교육친교부 부장)"}], "duties": {"bujang": "교육친교부 최종책임자 및 결정자 ", "chongmu": "전체 총괄 준비 및 진행 ", "buchong": "전체 진행 보조 및 발권 담당, 선발대", "seogi": "후원자 발굴, 순서자 기도 담당", "hoegye": "회계업무 및 현지가이드 소통, 선발대, 선물관리 "}, "fee": {"조직": 200000, "미조직": 150000}}$t$::jsonb, '140 sql')
    returning id into v_r;
  else
    update public.retreats set committee_event_id = coalesce(committee_event_id, v_ce) where id = v_r;
  end if;

  insert into public.retreat_steps (retreat_id, seq, key, title, body, kind, status, due, variants, created_by)
  values (v_r, 1, $t$flight$t$, $t$항공·집결 안내$t$, $t$11/2(월) 05:30 김포공항 국내선 집결 · 이스타 ZE201 06:45 출발 → 제주 08:00 도착.
탑승수속은 카운터에서 개별 수속(신분증 원본). 종이 탑승권은 제주공항에서 탐나는전 지원금 받을 때 내니 버리지 마세요.
바이오(프리패스) 등록을 미리 해 두시면 빠르게 들어갑니다.$t$, $t$안내$t$, $t$열림$t$, null, null, '140 sql')
  on conflict (retreat_id, key) do nothing;

  insert into public.retreat_steps (retreat_id, seq, key, title, body, kind, status, due, variants, created_by)
  values (v_r, 2, $t$seat$t$, $t$버스·쏠라티 좌석$t$, $t$1일차 공항 출발 때 좌석입니다. 버스 45인승 · 쏠라티 15인승. 「내 안내」에 내 자리가 나옵니다.$t$, $t$배정$t$, $t$닫힘$t$, null, null, '140 sql')
  on conflict (retreat_id, key) do nothing;

  insert into public.retreat_steps (retreat_id, seq, key, title, body, kind, status, due, variants, created_by)
  values (v_r, 3, $t$room$t$, $t$숙소 배정$t$, $t$라마다 제주함덕호텔 2박. 방 번호는 체크인 뒤에 적습니다. 「내 안내」에 함께 쓰는 분이 나옵니다.$t$, $t$배정$t$, $t$닫힘$t$, null, null, '140 sql')
  on conflict (retreat_id, key) do nothing;

  insert into public.retreat_steps (retreat_id, seq, key, title, body, kind, status, due, variants, created_by)
  values (v_r, 4, $t$cafe1$t$, $t$카페 주문 · 1일차 비양도 올레커피숍$t$, $t$11/2(월) 보말이야기 점심 후
메뉴 하나를 골라 주세요. 가격은 메뉴판 기준입니다.$t$, $t$선택$t$, $t$닫힘$t$, date '2026-11-01', array[$t$차갑게 (ICE)$t$, $t$따뜻하게 (HOT)$t$, $t$상관없음$t$]::text[], '140 sql')
  on conflict (retreat_id, key) do nothing;
  select id into v_s from public.retreat_steps where retreat_id = v_r and key = $t$cafe1$t$;
  insert into public.retreat_options (step_id, seq, label) values
    (v_s, 1, $t$에스프레소 (HOT) 4,500$t$),
    (v_s, 2, $t$아메리카노 HOT 5,000 / ICE 5,500$t$),
    (v_s, 3, $t$카페라떼 HOT 5,500 / ICE 6,000$t$),
    (v_s, 4, $t$카푸치노 HOT 5,500 / ICE 6,000$t$),
    (v_s, 5, $t$바닐라라떼 HOT 5,500 / ICE 6,000$t$),
    (v_s, 6, $t$카라멜마끼아또 HOT 5,500 / ICE 6,000$t$),
    (v_s, 7, $t$카페모카 HOT 5,500 / ICE 6,000$t$),
    (v_s, 8, $t$딸기라떼 (ICE) 6,000$t$),
    (v_s, 9, $t$초코라떼 HOT 5,500 / ICE 6,000$t$),
    (v_s, 10, $t$말차라떼 HOT 5,500 / ICE 6,000$t$),
    (v_s, 11, $t$고구마라떼 HOT 5,500 / ICE 6,000$t$),
    (v_s, 12, $t$한라봉라떼 (ICE) 6,000$t$),
    (v_s, 13, $t$한라봉차 HOT 5,500 / ICE 6,000$t$),
    (v_s, 14, $t$자몽차 HOT 5,500 / ICE 6,000$t$),
    (v_s, 15, $t$레몬차 HOT 5,500 / ICE 6,000$t$),
    (v_s, 16, $t$귤차 HOT 5,500 / ICE 6,000$t$),
    (v_s, 17, $t$한라봉 에이드 (ICE) 6,000$t$),
    (v_s, 18, $t$자몽 에이드 (ICE) 6,000$t$),
    (v_s, 19, $t$레몬 에이드 (ICE) 6,000$t$),
    (v_s, 20, $t$청포도 에이드 (ICE) 6,000$t$),
    (v_s, 21, $t$청귤 에이드 (ICE) 6,000$t$),
    (v_s, 22, $t$블루베리 스무디 (ICE) 6,000$t$),
    (v_s, 23, $t$딸기 스무디 (ICE) 6,000$t$),
    (v_s, 24, $t$망고 스무디 (ICE) 6,000$t$),
    (v_s, 25, $t$카라향 주스 (ICE) 6,000$t$),
    (v_s, 26, $t$복숭아 아이스티 (ICE) 5,500$t$),
    (v_s, 27, $t$레몬 아이스티 (ICE) 5,500$t$),
    (v_s, 28, $t$생귤주스 (ICE) 6,000$t$),
    (v_s, 29, $t$비트주스 (ICE) 6,000$t$),
    (v_s, 30, $t$인절미 팥빙수 1인 7,500$t$),
    (v_s, 31, $t$인절미 팥빙수 2인 14,000$t$),
    (v_s, 32, $t$안 마심$t$)
  on conflict (step_id, seq) do nothing;

  insert into public.retreat_steps (retreat_id, seq, key, title, body, kind, status, due, variants, created_by)
  values (v_r, 5, $t$cafe2$t$, $t$카페 주문 · 2일차 플로이스트 베이커리 카페$t$, $t$11/3(화) 섭지코지 후 · 친교의 시간 2
메뉴 하나를 골라 주세요. 가격은 메뉴판 기준입니다.$t$, $t$선택$t$, $t$닫힘$t$, date '2026-11-02', array[$t$차갑게 (ICE)$t$, $t$따뜻하게 (HOT)$t$, $t$상관없음$t$]::text[], '140 sql')
  on conflict (retreat_id, key) do nothing;
  select id into v_s from public.retreat_steps where retreat_id = v_r and key = $t$cafe2$t$;
  insert into public.retreat_options (step_id, seq, label) values
    (v_s, 1, $t$아메리카노 7,000$t$),
    (v_s, 2, $t$에스프레소 7,000$t$),
    (v_s, 3, $t$플랫화이트 7,000$t$),
    (v_s, 4, $t$카페라떼 7,500$t$),
    (v_s, 5, $t$카푸치노 8,000$t$),
    (v_s, 6, $t$바닐라라떼 8,500$t$),
    (v_s, 7, $t$카페모카 8,500$t$),
    (v_s, 8, $t$초코라떼 8,500$t$),
    (v_s, 9, $t$디카페인 블렌드 8,500$t$),
    (v_s, 10, $t$휘닉스 블렌드 8,000$t$),
    (v_s, 11, $t$더 성산 유자 9,200$t$),
    (v_s, 12, $t$피스타치오베라 11,500$t$),
    (v_s, 13, $t$플라보 11,500$t$),
    (v_s, 14, $t$요미요미 유기농 주스 2,500$t$),
    (v_s, 15, $t$안 마심$t$)
  on conflict (step_id, seq) do nothing;

  insert into public.retreat_steps (retreat_id, seq, key, title, body, kind, status, due, variants, created_by)
  values (v_r, 6, $t$cafe3$t$, $t$카페 주문 · 2일차 함덕 델문도 카페$t$, $t$11/3(화) 삼다온 저녁 후 · 19:35 (가격은 인터넷 메뉴 기준, 현장 확인 필요)
메뉴 하나를 골라 주세요. 가격은 메뉴판 기준입니다.$t$, $t$선택$t$, $t$닫힘$t$, date '2026-11-02', array[$t$차갑게 (ICE)$t$, $t$따뜻하게 (HOT)$t$, $t$상관없음$t$]::text[], '140 sql')
  on conflict (retreat_id, key) do nothing;
  select id into v_s from public.retreat_steps where retreat_id = v_r and key = $t$cafe3$t$;
  insert into public.retreat_options (step_id, seq, label) values
    (v_s, 1, $t$아메리카노 HOT 7,000 / ICE 7,500$t$),
    (v_s, 2, $t$카페라떼 ICE 8,500 (HOT 가격 확인 필요)$t$),
    (v_s, 3, $t$문도슈페너 9,000 (대표 메뉴)$t$),
    (v_s, 4, $t$우도땅콩라떼 ICE 9,000$t$),
    (v_s, 5, $t$말차라떼 ICE 9,000$t$),
    (v_s, 6, $t$망고 트로피칼 에이드 9,000$t$),
    (v_s, 7, $t$백향과귤 주스 9,500$t$),
    (v_s, 8, $t$젤라또 7,500$t$),
    (v_s, 9, $t$오메기 우도 단팥빵 6,000$t$),
    (v_s, 10, $t$고메버터 소금빵 5,000$t$),
    (v_s, 11, $t$우도 땅콩빵 5,500$t$),
    (v_s, 12, $t$라봉슈 6,500$t$),
    (v_s, 13, $t$안 마심$t$)
  on conflict (step_id, seq) do nothing;

  insert into public.retreat_steps (retreat_id, seq, key, title, body, kind, status, due, variants, created_by)
  values (v_r, 7, $t$cafe4$t$, $t$카페 주문 · 3일차 폴 바셋$t$, $t$11/4(수) 해녀잠수촌 점심 후 · 공항 가기 전 티타임
메뉴 하나를 골라 주세요. 가격은 메뉴판 기준입니다.$t$, $t$선택$t$, $t$닫힘$t$, date '2026-11-03', array[$t$차갑게 (ICE)$t$, $t$따뜻하게 (HOT)$t$, $t$상관없음$t$]::text[], '140 sql')
  on conflict (retreat_id, key) do nothing;
  select id into v_s from public.retreat_steps where retreat_id = v_r and key = $t$cafe4$t$;
  insert into public.retreat_options (step_id, seq, label) values
    (v_s, 1, $t$아메리카노 4,700$t$),
    (v_s, 2, $t$룽고 5,300$t$),
    (v_s, 3, $t$에스프레소 4,400$t$),
    (v_s, 4, $t$카페라떼 5,900$t$),
    (v_s, 5, $t$카푸치노 5,900$t$),
    (v_s, 6, $t$바닐라빈 카페라떼 6,500$t$),
    (v_s, 7, $t$스페니쉬 카페라떼 6,500$t$),
    (v_s, 8, $t$카페모카 6,500$t$),
    (v_s, 9, $t$아이스크림 카페라떼 7,500$t$),
    (v_s, 10, $t$제주 말차라떼 6,300$t$),
    (v_s, 11, $t$제주 한라봉 티 5,900$t$),
    (v_s, 12, $t$캐모마일 허브차 5,500$t$),
    (v_s, 13, $t$루이보스 밀크티 6,300$t$),
    (v_s, 14, $t$밀크 아이스크림 (컵) 4,300$t$),
    (v_s, 15, $t$안 마심$t$)
  on conflict (step_id, seq) do nothing;

  insert into public.retreat_steps (retreat_id, seq, key, title, body, kind, status, due, variants, created_by)
  values (v_r, 9, $t$survey$t$, $t$마무리 설문·자료$t$, $t$수양회 뒤 설문과 사진 모음입니다.
https://drive.google.com/drive/folders/1SEcLwN5OF8Q0FdEePYLkwIaJ-pfIVs4h?usp=sharing$t$, $t$안내$t$, $t$닫힘$t$, null, null, '140 sql')
  on conflict (retreat_id, key) do nothing;

  -- 일정표 (아티팩트 DAYS — 3일 35줄)
  insert into public.retreat_program (retreat_id, day_no, day_date, seq, time, title, body, kind, place, depart, move, ref) values
    (v_r, 1, date '2026-11-02', 1, $t$05:30$t$, $t$김포공항 국내선 집결$t$, $t$탑승수속 카운터 개별 수속 · 신분증 원본$t$, $t$move$t$, null, null, null, $t$d1-1$t$),
    (v_r, 1, date '2026-11-02', 2, $t$06:45$t$, $t$이스타 ZE201 출발$t$, $t$제주 도착 08:00 (이스타항공 동계 시간표 기준) · 종이 탑승권은 제주공항에서 탐나는전 지원금 받을 때 제출하니 버리지 마세요$t$, $t$move$t$, null, null, null, $t$d1-2$t$),
    (v_r, 1, date '2026-11-02', 3, $t$08:00$t$, $t$제주공항 도착 · 탐나는전 지원금 수령$t$, $t$도착하자마자 탐나는전 지원금 수령 · 종이 탑승권(발권표) 제출 필요 — 김포에서 받은 종이 탑승권을 버리지 말고 꼭 챙기세요 · 짐 찾고 나올 때 임원이 거둡니다 · 08:15 버스 탑승$t$, $t$move$t$, $t$제주국제공항$t$, $t$08:15$t$, $t$비행 약 1시간 15분 · 김포→제주 450km$t$, $t$d1-3$t$),
    (v_r, 1, date '2026-11-02', 4, $t$08:25$t$, $t$조식 · 고사리해장국 · 제주 순풍해장국 공항본점$t$, $t$고사리해장국 · 선지는 통일하지 않고 각자 주문 · 단체 할인 요청 중 · 1인 12,000원 (예산 반영)$t$, $t$meal$t$, $t$제주 순풍해장국 본점$t$, $t$09:10$t$, $t$버스 약 10분 · 공항→해장국 2km$t$, $t$d1-4$t$),
    (v_r, 1, date '2026-11-02', 5, $t$09:25$t$, $t$무지개 해안도로 산책 · 어영공원$t$, $t$해안도로 걷기·사진 약 40분 · 10:05 한림항으로 출발$t$, $t$sight$t$, $t$어영공원$t$, $t$10:05$t$, $t$버스 약 15분 · 4km$t$, $t$d1-5$t$),
    (v_r, 1, date '2026-11-02', 6, $t$11:05$t$, $t$한림항 도착 · 들어가는 배 11:20 → 11:35$t$, $t$승선권 구매 · 신분증 필수 · 들어가는 배: 11:20 한림항 출발 → 11:35 비양도 도착 (배 약 15분) · 정기 운항: 한림항 출발 09:20·11:20·13:20·15:20 / 비양도 출발 09:35·11:35·13:35·15:35 (사정에 따라 증편) · 비양도해운 장석진 대표 010-8541-0866 · 매표 064-796-7522 · 배가 안 뜨면 아래 우천 코스로 바뀝니다$t$, $t$move$t$, $t$한림항 비양도 도항선$t$, $t$11:35$t$, $t$버스 약 1시간 · 어영공원→한림항 30km$t$, $t$d1-6$t$),
    (v_r, 1, date '2026-11-02', 7, $t$11:45$t$, $t$중식 · 비양도 보말이야기 (보말칼국수)$t$, $t$선착장에서 걸어서 · 약 40분 · 보말칼국수 12,000원 / 보말죽 15,000원 / 보말보리비빔밥 15,000원$t$, $t$meal$t$, $t$비양도 보말이야기$t$, $t$12:25$t$, $t$도보 약 10분$t$, $t$d1-7$t$),
    (v_r, 1, date '2026-11-02', 8, $t$12:25$t$, $t$카페 · 제주올레커피숍$t$, $t$약 40분 · 카페를 이용하면 자전거 무료 · 메뉴는 홈 '메뉴 고르기'에서 미리 주문$t$, $t$rest$t$, $t$비양도 올레커피숍$t$, $t$13:05$t$, $t$도보$t$, $t$d1-8$t$),
    (v_r, 1, date '2026-11-02', 9, $t$13:05$t$, $t$자전거 둘레길$t$, $t$자전거 20대 · 섬 둘레 약 3km · 약 20분 (걷는 분은 해안 산책)$t$, $t$sight$t$, $t$비양도$t$, $t$13:25$t$, null, $t$d1-9$t$),
    (v_r, 1, date '2026-11-02', 10, $t$13:25$t$, $t$자유시간 · 비양도 선착장 광장$t$, $t$사진·휴식 · 13:50까지 광장 집결 (나오는 배 10분 전)$t$, $t$rest$t$, null, $t$13:50$t$, null, $t$d1-10$t$),
    (v_r, 1, date '2026-11-02', 11, $t$14:00$t$, $t$나오는 배 14:00 → 14:15 한림항$t$, $t$나오는 배: 14:00 비양도 출발 → 14:15 한림항 도착 (배 약 15분) · 14:00 배는 증편을 전제로 한 예상 시각 (비양도해운이 10/27 사무실에서 확인) · 증편이 안 되면 정기편 13:35 → 13:50 또는 15:35 → 15:50(마지막)$t$, $t$move$t$, $t$한림항 비양도 도항선$t$, $t$14:15$t$, $t$배 약 15분$t$, $t$d1-11$t$),
    (v_r, 1, date '2026-11-02', 12, $t$14:40$t$, $t$예비 코스 · 애월 한담해안산책로 (후보)$t$, $t$한림항~노형 사이 시간이 남을 때 · 곽지해수욕장~한담 해안 산책로 약 1.2km · 무료 · 산책·사진 약 80분 · 다른 후보: 협재해수욕장(무료), 한림공원(입장료)$t$, $t$sight$t$, $t$애월 한담해안산책로$t$, $t$16:05$t$, $t$버스 약 20분 · 한림항→애월 14km$t$, $t$d1-12$t$),
    (v_r, 1, date '2026-11-02', 13, $t$16:45$t$, $t$노형수퍼마켓$t$, $t$미디어아트 전시 · 입장 1인 15,000원 · 관람 약 60분$t$, $t$sight$t$, $t$노형수퍼마켙$t$, $t$17:45$t$, $t$버스 약 35분 · 애월→노형 20km (예비 코스 없으면 한림항→노형 50분)$t$, $t$d1-13$t$),
    (v_r, 1, date '2026-11-02', 14, $t$17:55$t$, $t$석식 · 흑돼지구이 · 늘봄흑돼지$t$, $t$흑돼지 구이 + 식사 1인 약 30,000원 · 약 90분$t$, $t$meal$t$, $t$늘봄흑돼지$t$, $t$19:25$t$, $t$버스 약 5분 · 1km$t$, $t$d1-14$t$),
    (v_r, 1, date '2026-11-02', 15, $t$20:10$t$, $t$라마다 제주함덕호텔 체크인$t$, $t$2인 1실 · 방 배정$t$, $t$move$t$, $t$라마다 제주함덕호텔$t$, null, $t$버스 약 40분 · 노형→함덕 25km$t$, $t$d1-15$t$),
    (v_r, 1, date '2026-11-02', 16, $t$20:40$t$, $t$개회 예배$t$, $t$호텔 세미나실$t$, $t$wor$t$, null, $t$21:30$t$, null, $t$d1-16$t$),
    (v_r, 1, date '2026-11-02', 17, $t$21:30$t$, $t$친교의 시간 1 · 1일차 저녁$t$, $t$호텔 세미나실 · 예배 후 이어서 약 1시간 · 부부 테이블 게임 · 진행 계획은 총무 탭$t$, $t$rest$t$, null, $t$22:30$t$, null, $t$d1-17$t$),
    (v_r, 2, date '2026-11-03', 1, $t$07:00$t$, $t$호텔 조식 · 08:20 버스 탑승 · 08:30 출발$t$, $t$라마다 제주함덕호텔 · 조식은 08:10까지 · 짐은 객실에 두고 08:20까지 호텔 앞 버스에 탑승 · 08:30 출발 (스카이워터쇼까지 18km 약 30분)$t$, $t$meal$t$, null, $t$08:30$t$, null, $t$d2-1$t$),
    (v_r, 2, date '2026-11-03', 2, $t$09:00$t$, $t$스카이 워터쇼 관람$t$, $t$09:00 도착 · 단체 발권·입장 후 09:30 회차 관람 · 관람료 1인 20,000원 · 공연 약 50분$t$, $t$sight$t$, $t$스카이워터쇼 제주$t$, $t$10:20$t$, $t$버스 약 30분 · 함덕→구좌 18km$t$, $t$d2-2$t$),
    (v_r, 2, date '2026-11-03', 3, $t$10:45$t$, $t$동화마을$t$, $t$무료 · 산책·사진 약 60분$t$, $t$sight$t$, $t$제주 동화마을$t$, $t$11:45$t$, $t$버스 약 25분 · 15km$t$, $t$d2-3$t$),
    (v_r, 2, date '2026-11-03', 4, $t$12:25$t$, $t$중식 · 성산바다$t$, $t$해산물 전문식당 · 약 60분$t$, $t$meal$t$, $t$성산바다 성산읍$t$, $t$13:25$t$, $t$버스 약 40분 · 성산 방면 30km$t$, $t$d2-4$t$),
    (v_r, 2, date '2026-11-03', 5, $t$13:40$t$, $t$섭지코지$t$, $t$등대·해안 산책 약 80분$t$, $t$sight$t$, $t$섭지코지$t$, $t$15:00$t$, $t$버스 약 15분 · 8km$t$, $t$d2-5$t$),
    (v_r, 2, date '2026-11-03', 6, $t$15:15$t$, $t$친교의 시간 2 · 2일차 점심$t$, $t$플로이스트 베이커리 카페 · 휘닉스 아일랜드 글라스하우스 · 성산일출봉 뷰 · 별실 없이 이용(대관비 없음) · 차·음료는 홈 '메뉴 고르기'에서 미리 주문 · 레크 약 70분 (총무 탭에 진행 계획)$t$, $t$rest$t$, $t$플로이스트 베이커리 카페$t$, $t$16:30$t$, $t$버스 약 15분 · 3km$t$, $t$d2-6$t$),
    (v_r, 2, date '2026-11-03', 7, $t$16:50$t$, $t$녹차 족욕 · 오늘은 녹차한잔$t$, $t$족욕 체험 1인 8,000원 · 약 60분 · 영업 09:00~18:00$t$, $t$rest$t$, $t$오늘은녹차한잔$t$, $t$17:50$t$, $t$버스 약 20분 · 17km$t$, $t$d2-7$t$),
    (v_r, 2, date '2026-11-03', 8, $t$18:05$t$, $t$석식 · 통갈치조림 · 제주 삼다온$t$, $t$갈치조림정식 4인 98,000원 · 예약 확인됨 · 조천읍 와흘리(남조로) · 약 75분 · 무료 주차$t$, $t$meal$t$, $t$제주 삼다온 갈치조림$t$, $t$19:20$t$, $t$버스 약 15분$t$, $t$d2-8$t$),
    (v_r, 2, date '2026-11-03', 9, $t$19:35$t$, $t$카페 · 함덕 델문도$t$, $t$함덕해수욕장 바닷가 카페 · 영업 06:00~24:00 · 차·음료는 홈 '메뉴 고르기'에서 미리 주문 · 약 45분$t$, $t$rest$t$, $t$카페 델문도 함덕$t$, $t$20:20$t$, $t$버스 약 15분 · 와흘→함덕 9km$t$, $t$d2-9$t$),
    (v_r, 2, date '2026-11-03', 10, $t$20:30$t$, $t$친교의 시간 3 · 2일차 저녁$t$, $t$라마다 제주함덕호텔 세미나실$t$, $t$wor$t$, null, null, $t$도보 이동 약 10분 · 델문도→호텔 0.7km$t$, $t$d2-10$t$),
    (v_r, 3, date '2026-11-04', 1, $t$07:00$t$, $t$호텔 조식 · 체크아웃 · 08:40 버스 탑승 · 08:50 출발$t$, $t$라마다 제주함덕호텔 · 조식은 08:20까지 · 08:30까지 체크아웃(객실 키 반납) · 짐을 버스에 싣고 08:40까지 탑승 · 08:50 출발 (본제주까지 20km 약 35분)$t$, $t$meal$t$, null, $t$08:50$t$, null, $t$d3-1$t$),
    (v_r, 3, date '2026-11-04', 2, $t$09:25$t$, $t$간단한 쇼핑 · 본제주$t$, $t$약 40분 · 제주 특산품 · 10:05 출발$t$, $t$rest$t$, $t$본제주 연북로$t$, $t$10:05$t$, $t$버스 약 35분 · 함덕→연북로 20km$t$, $t$d3-2$t$),
    (v_r, 3, date '2026-11-04', 3, $t$10:40$t$, $t$돌문화공원$t$, $t$입장 무료 · 넓은 공원 · 관람 약 70분$t$, $t$sight$t$, $t$제주돌문화공원$t$, $t$11:50$t$, $t$버스 약 35분 · 연북로→교래 22km$t$, $t$d3-3$t$),
    (v_r, 3, date '2026-11-04', 4, $t$12:30$t$, $t$중식 · 해녀잠수촌 (전복뚝배기)$t$, $t$1인 15,000원 · 약 50분$t$, $t$meal$t$, $t$해녀잠수촌 제주$t$, $t$13:20$t$, $t$버스 약 40분 · 교래→공항 근처 30km$t$, $t$d3-4$t$),
    (v_r, 3, date '2026-11-04', 5, $t$13:25$t$, $t$카페 · 티타임 · 폴 바셋 (Paul Bassett)$t$, $t$공항 근처 용담2동 · 영업 07:30~22:00 · 13:50 출발$t$, $t$rest$t$, $t$폴바셋 제주 용담$t$, $t$13:50$t$, $t$버스 약 5분 · 3km$t$, $t$d3-5$t$),
    (v_r, 3, date '2026-11-04', 6, $t$14:00$t$, $t$제주공항 집결$t$, $t$탑승수속 · 수하물 부치기 · 15:15 출발$t$, $t$move$t$, $t$제주국제공항$t$, $t$15:15$t$, $t$버스 약 10분 · 3km$t$, $t$d3-6$t$),
    (v_r, 3, date '2026-11-04', 7, $t$15:15$t$, $t$이스타 ZE252 제주 출발$t$, $t$김포 도착 16:30 예정 (이스타항공 시간표 기준)$t$, $t$move$t$, null, null, null, $t$d3-7$t$),
    (v_r, 3, date '2026-11-04', 8, $t$16:30$t$, $t$김포공항 도착$t$, $t$16:30 도착 예정, 지연 가능 · 수하물 찾고 해산 · 마침기도$t$, $t$move$t$, $t$김포공항 국내선$t$, null, $t$비행 약 1시간 15분 · 제주→김포 450km$t$, $t$d3-8$t$)
  on conflict (retreat_id, day_no, seq) do nothing;

  -- 안내 멘트 (아티팩트 guide — 날짜 아래 글, seq 900번대)
  insert into public.retreat_program (retreat_id, day_no, day_date, seq, time, title, body, kind, ref) values
    (v_r, 1, date '2026-11-02', 901, null, $t$1일차 · 김포→제주 · 출발 · 어서 오세요, 제주$t$, $t$공항에서 아침 식사할 해장국집까지는 약 2km, 버스로 10분 거리입니다. 사랑하는 목사님, 장로님, 사모님들, 새벽 일찍 나오시느라 정말 수고 많으셨습니다. 제주 말로 '혼저 옵서예', 어서 오시라는 인사로 첫 버스를 엽니다. 08:00에 제주에 내리자마자 탐나는전 지원금을 받으셨지요. 종이 탑승권을 제출해야 받을 수 있으니, 혹시 아직 안 내신 분은 지금 임원에게 주세요. 이제 아침부터 드시겠습니다. 버스로 10분 거리, 공항 앞 제주 순풍해장국에서 고사리해장국입니다. 선지는 넣고 빼는 것을 각자 편하게 주문하시면 됩니다. 이번 2박 3일은 일보다 쉼, 회의보다 교제, 그리고 무엇보다 부부가 함께 걷는 시간입니다. 시편 133편 말씀처럼 형제가 연합하여 동거함이 얼마나 선하고 아름다운지, 이 길 위에서 함께 누리시길 바랍니다. 버스 출발 기도로 첫 일정을 시작하겠습니다. 식사 후 9시 10분까지 버스로 돌아와 주세요.

퀴즈: [["김포공항에서 제주공항까지 비행 거리는 대략 몇 km일까요?"], ["김포~제주 노선은 세계 항공 노선 중 승객 수로 몇 위에 자주 꼽힐까요?"], ["제주 말 '혼저 옵서예'는 무슨 뜻일까요?"], ["제주를 '삼다도'라고 부릅니다. 많은 세 가지는?"], ["반대로 '삼무'는 없는 세 가지입니다. 무엇일까요?"], ["대문 대신 걸치던 나무 막대 '정낭'이 세 개 다 걸쳐 있으면 무슨 뜻일까요?"], ["제주도 넓이는 서울의 약 몇 배일까요?"], ["(제주 넌센스) 제주 분이 '혼저 옵서예' 했는데 혼자 왔다면 혼날까요?"], ["(제주 넌센스) 제주 말 '폭삭 속았수다'를 들으면 사기당한 걸까요?"], ["(제주 상식) 옛말에 '말은 나면 제주로 보내고, 사람은 나면 어디로 보내라' 했을까요?"], ["(성경 넌센스) 성경에서 가장 긴 이름을 가진 아이는? (힌트: 이사야의 아들)"], ["(성경 넌센스) 성경에서 가장 오래 산 사람의 아버지는 죽지 않았습니다. 누구일까요?"]]$t$, 'ment', $t$c0$t$),
    (v_r, 1, date '2026-11-02', 902, null, $t$1일차 오전 · 무지개 해안도로 · 어영공원$t$, $t$해장국집에서 어영공원까지 약 4km, 버스로 약 15분 갑니다. 아침 드셨으니 첫 코스, 공항 바로 옆 바닷길 어영공원입니다. 해안도로를 따라 알록달록한 무지개 색 방호석이 길게 이어져서 '무지개 해안도로'라는 이름이 붙었습니다. 공항이 가까워 머리 위로 비행기가 지나가는 모습도 보실 수 있습니다. 약 40분 걷고 사진 찍으신 뒤 10시 5분에 한림항으로 출발합니다. 바다를 보며 부부가 나란히 사진 한 장 꼭 남기세요. 무지개는 하나님이 노아에게 주신 언약의 표징이지요. 우리 가정과 노회 위에도 그 언약의 신실하심이 함께하길 기도합니다. 10시 5분까지 버스로 돌아와 주세요.

퀴즈: [["무지개 해안도로는 제주시 어느 바닷가 동네에 있을까요?"], ["이 해안도로에서 머리 위로 자주 볼 수 있는 것은?"], ["무지개 해안도로의 방호석은 몇 가지 색일까요?"], ["제주 해안의 검은 바위는 무엇이 굳어서 생긴 돌일까요?"], ["현무암에 구멍이 숭숭 뚫린 까닭은?"], ["근처 이호테우 해변의 명물, 말 모양 등대 두 개의 색은?"], ["'이호테우'의 '테우'는 무엇일까요?"], ["(제주 넌센스) 제주는 '바람'이 많은 섬이라지만, 이번 수양회에서 절대 불면 안 되는 바람은?"], ["(제주 상식) 구멍 숭숭 검은 돌로 쌓은 밭의 경계 담을 무엇이라 할까요?"], ["(제주 상식) 제주 돌담을 다 이으면 아주 길어서 붙은 별명은?"], ["(성경 넌센스) 방주에서 나온 노아가 포도나무를 심은 뒤 생긴 첫 '실수'는?"], ["(성경 넌센스) 하나님이 아담과 하와에게 처음 지어 입히신 옷의 재료는?"]]$t$, 'ment', $t$c1$t$),
    (v_r, 1, date '2026-11-02', 903, null, $t$1일차 오후 · 비양도 섬 투어 · 보말칼국수$t$, $t$어영공원에서 한림항까지 약 30km, 버스로 약 1시간 걸립니다. 이제 한림항에서 11시 20분 배를 타면 15분 뒤 11시 35분, 섬 속의 섬 비양도에 도착합니다. 배에 오를 때 신분증 원본이 꼭 필요하니 지금 한 번 확인해 주세요. 비양도는 고려 시대 화산 활동 기록이 전해져 '천 년의 섬'이라고도 불립니다. 점심은 선착장에서 걸어서 10분, 보말이야기의 보말칼국수로 약 40분입니다. 보말은 제주 바닷가 바위에 붙어 사는 작은 고둥인데 국물이 아주 시원합니다. 식사 후 제주올레커피숍에서 40분 쉬시고, 카페를 이용하면 자전거를 무료로 빌려 20분 둘레길을 달립니다. 그다음은 선착장 광장에서 자유시간입니다. 나오는 배는 2시에 비양도를 떠나 2시 15분 한림항에 닿도록 증편을 요청해 두었고, 안 되면 정기편 1시 35분이나 마지막 3시 35분 배를 탑니다. 배 시간은 섬에서 다시 알려 드리겠습니다. 혹시 바람으로 배가 뜨지 않으면 더마파크 기마공연과 근처 삼대고기국수로 바꿉니다. 갈릴리 바다 위 제자들의 배에 예수님이 함께 계셨듯, 오늘 우리 배에도 주님이 함께하십니다. 다시 한번, 1시 50분까지 비양도 선착장 광장으로 모여 주세요. 한림항에 내리시면 바로 버스로 오시면 됩니다.

퀴즈: [["비양도로 가는 배는 어느 항구에서 탈까요?"], ["배를 타기 전에 꼭 챙겨야 하는 것은?"], ["비양도를 '천 년의 섬'이라 부르는 까닭은?"], ["바다 건너 비양도가 그림처럼 보이는 유명한 해수욕장은?"], ["비양도 바닷가에 있는, 아기를 업은 엄마 모습이라는 바위 이름은?"], ["점심 메뉴 '보말'은 무엇일까요?"], ["보말칼국수 국물이 초록빛을 띠는 까닭은?"], ["(제주 넌센스) 물질하던 해녀가 물 위로 올라와 휘파람처럼 내쉬는 소리는?"], ["(제주 상식) 해녀가 물 위에 띄워 몸을 의지하는 둥근 부표 이름은?"], ["(제주 넌센스) 우도(牛島)는 섬 모양이 어떤 동물이 누운 모습이라 붙은 이름일까요?"], ["(성경 넌센스) 요나가 그늘 삼아 좋아하던 박넝쿨을 하루아침에 시들게 한 것은?"], ["(성경 넌센스) 바울이 멜리데 섬에서 나뭇가지를 불에 넣다가 손에 달라붙은 것은?"]]$t$, 'ment', $t$c2$t$),
    (v_r, 1, date '2026-11-02', 904, null, $t$1일차 우천·결항 시 · 더마파크 (비양도 대신)$t$, $t$어영공원에서 더마파크까지 약 30km, 버스로 약 45분 갑니다. 여러분, 오늘 바다 날씨 때문에 비양도 배가 뜨지 못합니다. 아쉽지만 걱정하지 마세요. 하나님께서 준비해 두신 다른 길이 있습니다. 비양도 대신 가까운 한림 월림리의 더마파크로 갑니다. 이름의 '마'는 말 마(馬) 자로, 말을 주제로 한 테마공원입니다. 공연장에서 말을 타고 펼치는 기마공연을 관람합니다. 말 위에서 서고 달리고 뛰어넘는 마상 무예가 볼만합니다. 공연 시간과 관람료는 현장에서 다시 안내하겠습니다. 제주는 예로부터 '사람은 나면 서울로, 말은 나면 제주로'라고 할 만큼 말의 고장입니다. 공연이 끝나면 점심을 먹고, 오후 노형수퍼마켓부터는 원래 일정대로 진행합니다. 비가 오면 바닥이 미끄러우니 우산 챙기시고 천천히 움직여 주세요. 공연이 끝나면 11시 50분까지 버스로 돌아와 주세요.

퀴즈: [["더마파크 이름의 '마(馬)'는 무슨 뜻일까요?"], ["제주 토종 조랑말을 부르는 이름과 천연기념물 번호는?"], ["'사람은 나면 서울로, ○○ 나면 제주로' 빈칸은?"], ["고려 때 원나라(몽골)가 제주에 말 목장을 두려고 세운 관청 이름은?"], ["조선 시대 가장 좋은 말(갑마)을 길러 나라에 바치던 서귀포 가시리의 목장 이름은?"], ["말의 나이는 어디를 보면 알 수 있을까요?"], ["(제주어) 제주 말로 '몰'은 무엇일까요?"], ["(제주어) '하영 봥 갑서'는 무슨 뜻일까요?"], ["(성경) 요한계시록 6장에 나오는 네 말의 색깔은?"], ["(성경) 엘리야가 회오리바람으로 하늘에 올라갈 때 나타난 것은?"], ["(성경 넌센스) 성경에서 사람에게 '말'을 한 동물 두 마리는?"], ["(추억) 놀이공원에서 말을 타고 빙글빙글 도는 놀이기구는? 영어 이름까지!"]]$t$, 'ment', $t$c2r$t$),
    (v_r, 1, date '2026-11-02', 905, null, $t$1일차 우천·결항 시 · 점심 변경 · 삼대국수회관 협재점 (보말칼국수 대신)$t$, $t$더마파크에서 협재 삼대국수회관까지 약 6km, 버스로 약 10분입니다. 비양도에 들어가지 못해 점심 식당도 바뀌었습니다. 보말칼국수 대신 협재해수욕장 근처 삼대국수회관 협재점에서 제주 대표 음식인 고기국수를 먹습니다. 돼지 뼈를 오래 고아 낸 뽀얀 국물에 중면을 말고, 도마에 썰어 내는 돼지고기 수육을 올린 국수입니다. 제주에서는 도마를 '돔베'라고 해서 이 고기를 돔베고기라고 부릅니다. 옛날 제주에서는 잔칫날 돼지를 잡아 국수를 대접했는데, 그 잔치국수가 오늘의 고기국수가 되었습니다. 비 오는 날 따뜻한 국물로 몸을 녹이시고, 식사 후 노형수퍼마켓으로 이동합니다. 식사 후 12시 50분까지 버스로 돌아와 주세요.

퀴즈: [["고기국수 국물은 무엇을 고아서 낼까요?"], ["고기국수 위에 올리는 돼지고기 수육을 제주에서는 무엇이라 부를까요?"], ["제주어 '돔베'는 무엇을 뜻할까요?"], ["고기국수에 주로 쓰는 국수 굵기는? 소면·중면·우동면 중에서"], ["(성경) 오병이어 기적에서 예수님이 축사하신 음식과 먹은 남자의 수는?"], ["(성경) 그릿 시냇가의 엘리야에게 까마귀가 아침저녁으로 가져다준 것은?"]]$t$, 'ment', $t$c2n$t$),
    (v_r, 1, date '2026-11-02', 906, null, $t$1일차 오후 · 노형수퍼마켓$t$, $t$애월에서 노형까지 약 20km, 버스로 약 35분 갑니다. 예비 코스 없이 한림항에서 바로 가면 약 32km, 50분입니다. 다음은 노형수퍼마켓입니다. 입장료는 1인 15,000원으로 이미 회비에 들어 있습니다. 겉보기에는 옛날 동네 구멍가게 같지만, 문을 열고 들어가면 빛과 영상으로 만든 미디어아트 세상이 펼쳐집니다. 관람은 약 60분입니다. 어릴 적 동네 가게에서 사 먹던 과자 이야기 한두 가지씩 나누어 보시면 좋겠습니다. 사진 찍기 좋은 곳이 많으니 부부 사진 꼭 남기세요. 어두운 곳이 있으니 발밑 조심하시고, 일행을 놓치지 않도록 해 주세요. 17시 45분까지 버스로 돌아와 주세요.

퀴즈: [["노형수퍼마켓은 무엇을 보여 주는 전시관일까요?"], ["이 전시관 겉모습은 무엇을 닮았을까요?"], ["노형동·연동 일대를 옛 제주시와 구분해 부르는 이름은?"], ["노형동에 있는 제주에서 가장 높은 건물은?"], ["드림타워는 몇 층일까요?"], ["(추억) 어릴 적 구멍가게에서 가장 많이 사 먹던 과자는? (가장 공감 많은 답이 정답)"], ["(추억) 구멍가게에서 돈 없이 사고 나중에 갚는 것을 무엇이라 했을까요?"], ["(제주 넌센스) 제주 시장에서 '감저' 달라고 하면 무엇을 받을까요?"], ["(제주 상식) 귤나무 몇 그루로 자녀 대학 등록금을 냈다고 해서 귤나무에 붙은 별명은?"], ["(제주 넌센스) 제주 할망이 '미깡' 사러 간다고 합니다. 무엇을 살까요?"], ["(성경 넌센스) 성경(66권)에 개, 돼지, 나귀는 나오는데 한 번도 안 나오는 집 동물은?"], ["(성경 넌센스) 감옥에서 풀려난 베드로가 문을 두드리자 너무 기뻐서 문도 안 열고 뛰어간 여종은?"]]$t$, 'ment', $t$c3$t$),
    (v_r, 1, date '2026-11-02', 907, null, $t$1일차 저녁 · 흑돼지 저녁 · 함덕 · 개회 예배$t$, $t$노형수퍼마켓에서 늘봄흑돼지까지는 약 1km, 버스로 5분입니다. 오늘 저녁은 노형동 늘봄흑돼지에서 제주 흑돼지 구이입니다. 약 90분 넉넉히 드시고, 식사 후에는 버스로 40분, 숙소인 함덕 라마다 호텔로 갑니다. 함덕 해변은 에메랄드빛 바다로 이름난 곳이고, 바로 옆 서우봉에 오르면 해변이 한눈에 보입니다. 객실은 2인 1실이고 방 번호는 호텔에 도착해서 현장에서 나누어 드립니다. 짐을 푸신 뒤 20시 40분 세미나실에서 개회 예배를 드립니다. 첫날 밤이 가장 중요합니다. 피곤하시더라도 예배 자리에서 꼭 함께 뵙겠습니다. 식사 후 19시 25분까지 버스로 돌아와 주세요.

퀴즈: [["제주 흑돼지는 국가 지정 무엇으로 보호받고 있을까요?"], ["흑돼지 구이를 찍어 먹는 제주식 젓갈 소스는?"], ["제주 말 '멜'은 무슨 생선일까요?"], ["우리가 묵는 함덕은 제주시 어느 읍에 있을까요?"], ["함덕 해변 바로 옆에 있는 오름 이름은?"], ["제주에서 작은 화산 언덕을 부르는 말은?"], ["함덕 바다가 에메랄드빛으로 보이는 까닭은?"], ["(제주 상식) 옛 제주 화장실 아래에서 돼지를 키우던 곳을 무엇이라 할까요?"], ["(제주 넌센스) 돼지 뼈 국물에 굵은 면을 말고 수육을 얹은 제주 국수는?"], ["(제주 상식) 제주 '몸국'의 '몸'은 무엇일까요?"], ["(성경 넌센스) 철로 만든 침대 길이가 아홉 규빗이나 되었던 거인 왕은?"], ["(성경 넌센스) 바울의 밤샘 설교 중 졸다가 3층에서 떨어진 청년은?"]]$t$, 'ment', $t$c4$t$),
    (v_r, 1, date '2026-11-02', 908, null, $t$1일차 밤 · 저녁 개회 예배 · 호텔 세미나실$t$, $t$오늘 새벽부터 함께 달려오시느라 정말 수고 많으셨습니다. 바다를 건너고 섬을 걷고 맛있는 저녁까지 나누었으니, 이제 하루의 마지막을 주님께 드리는 시간입니다. 잠시 후 20시 40분 호텔 세미나실에서 제19회기 부부수양회 개회 예배를 드립니다. 객실에 짐을 내려놓으시고 시간에 맞춰 세미나실로 모여 주십시오. 예배 순서와 말씀은 가이드북 '일정' 탭 아래 '개회 예배 순서'에서 보실 수 있습니다. 예배 후 21시 30분부터 약 1시간, 같은 자리에서 부부가 함께하는 친교의 시간이 이어집니다.

예배: true$t$, 'ment', $t$c4w$t$),
    (v_r, 1, date '2026-11-02', 909, null, $t$1일차 밤 · 친교의 시간 1 · 1일차 저녁 (부부 테이블 게임, 21:30~22:30)$t$, $t$예배 후 테이블별로 둘러앉아 부부가 함께 웃는 시간입니다. 아래 칸은 비워 두었으니 진행할 순서를 적어 두시고, 추천 게임에서 골라 쓰세요.

게임: [["부부 이심전심", "질문을 읽으면 부부가 서로 안 보고 답을 적어 동시에 공개합니다. 같은 답이 많은 부부가 우승. 예: 첫 데이트 장소, 배우자가 제일 좋아하는 반찬, 결혼기념일 날씨.", "메모지·펜 · 10분"], ["감귤 껍질 길게 까기", "제주 귤 하나씩! 껍질을 끊지 않고 가장 길게 까는 사람이 승. 부부 합산 길이로 겨루면 더 재미있어요.", "귤(인원수) · 5분"], ["찬송 첫 소절 맞히기", "총무가 찬송 첫 소절을 흥얼거리거나 읽으면 테이블별로 장 번호나 제목을 먼저 외칩니다. 맞힌 곡은 다 같이 한 절 부르기.", "찬송가 · 10분"], ["성경 인물 스무고개", "한 사람이 성경 인물을 정하면 테이블은 '예/아니요'로만 답하는 질문 20번 안에 맞힙니다.", "없음 · 10분"], ["부부 젓가락 콩 옮기기", "남편은 접시를 들고, 아내는 젓가락으로 30초 동안 땅콩(또는 콩)을 옮깁니다. 역할 바꿔 한 번 더.", "젓가락·땅콩·접시 · 5분"], ["종이컵 탑 쌓기 (한 손씩)", "부부가 각자 한 손만 써서 종이컵 탑을 1분 동안 가장 높이 쌓습니다. 손발이 맞아야 해요.", "종이컵 20개씩 · 5분"], ["제주어 맞히기", "'혼저 옵서예', '폭삭 속았수다', '하영'처럼 제주 말을 보여 주고 뜻을 맞힙니다. 오늘 버스 퀴즈 복습도 겸해요.", "카드 · 5분"], ["우리 부부 감사 한 줄", "마무리로 배우자에게 오늘 고마웠던 점을 한 줄씩 적어 읽어 줍니다. 서로 손 잡고 짧게 축복 기도.", "메모지 · 10분"]]$t$, 'ment', $t$c4r$t$),
    (v_r, 2, date '2026-11-03', 910, null, $t$2일차 오전 · 스카이 워터쇼$t$, $t$호텔에서 구좌 스카이 워터쇼까지 약 18km, 버스로 약 30분 갑니다. 좋은 아침입니다. 어젯밤 잘 쉬셨는지요. 조식은 8시 10분까지 마쳐 주시고, 8시 20분까지 호텔 앞 버스에 타 주세요. 버스는 8시 30분에 출발합니다. 오늘 첫 코스는 구좌의 스카이 워터쇼입니다. 관람료 1인 20,000원은 회비에 들어 있습니다. 물 위와 공중을 오가며 펼치는 곡예 공연이라 손에 땀을 쥐게 됩니다. 9시쯤 도착해 단체 발권을 하고, 9시 30분 회차를 봅니다. 공연은 약 50분이고 시작 시간이 정해져 있으니, 버스에서 내리시면 바로 인솔자를 따라와 주세요. 공연을 보면서 서로의 손을 꼭 잡아 주는 것도 부부수양회의 숙제입니다. 공연이 끝나면 10시 20분까지 버스로 돌아와 주세요.

퀴즈: [["스카이 워터쇼는 어떤 공연일까요?"], ["공연 관람 때 꼭 지켜야 할 것은? (총무 부탁)"], ["물 공연 맨 앞줄에 앉으면 조심할 것은?"], ["오늘 2일차에 버스가 주로 다니는 곳은 제주의 동쪽과 서쪽 중 어디?"], ["제주를 한 바퀴 도는 일주도로의 번호는?"], ["일주도로로 제주를 한 바퀴 돌면 대략 몇 km일까요?"], ["제주에서 바다로 곧장 떨어지는 폭포가 많은 지역은 제주시와 서귀포시 중 어디?"], ["(제주 상식) 바다로 곧장 떨어지는 폭포로 유명한 서귀포 폭포는?"], ["(제주 상식) 천지연폭포에 사는 천연기념물 물고기는?"], ["(제주 넌센스) 제주에서는 할머니 해녀도 남자 어른도 똑같이 이렇게 부릅니다. 무엇일까요?"], ["(성경 넌센스) 엘리사가 물에 빠진 쇠도끼를 떠오르게 한 방법은?"], ["(성경 넌센스) 삼손이 꼬리에 횃불을 달아 블레셋 밭으로 보낸 여우는 몇 마리?"]]$t$, 'ment', $t$c5$t$),
    (v_r, 2, date '2026-11-03', 911, null, $t$2일차 오전 · 동화마을$t$, $t$워터쇼에서 동화마을까지 약 15km, 버스로 약 25분입니다. 이어서 동화마을로 갑니다. 입장료는 없고 약 60분 머뭅니다. 이름처럼 아기자기한 동화 속 풍경과 포토존이 가득한 곳입니다. 오늘만큼은 목사님, 장로님이 아니라 소년 소녀로 돌아가 사진도 찍고 산책도 즐기시면 좋겠습니다. 예수님께서 '어린아이들이 내게 오는 것을 용납하고 금하지 말라' 하셨지요. 어린아이 같은 마음으로 이 하루를 받아 보시길 바랍니다. 여기서 성산으로 이동해 해산물 전문식당 '성산바다'에서 점심을 먹습니다. 11시 45분까지 버스로 돌아와 주세요.

퀴즈: [["(동화) 일곱 난쟁이와 함께 산 공주는?"], ["(동화) 열두 시 종이 울리자 유리구두를 남기고 떠난 사람은?"], ["(동화) 거짓말을 하면 코가 길어지는 나무 인형은?"], ["(동화) 콩쥐가 깨진 독에 물을 채우도록 도와준 동물은?"], ["(동화) '떡 하나 주면 안 잡아먹지'를 외친 동물은?"], ["(제주 전설) 제주시 바닷가 '용두암'은 무엇이 굳어 바위가 되었다는 이야기일까요?"], ["(제주 전설) 한라산을 베개 삼아 누웠다는 제주를 만든 거인 할머니는?"], ["(제주 넌센스) 돌하르방에게 부인이 있다면 이름은?"], ["(제주 상식) 제주 땅에서 처음 솟아났다는 세 신인의 성씨는?"], ["(제주 상식) 제주의 옛 나라 이름은?"], ["(성경 넌센스) 나귀가 사람 말을 하며 주인을 나무랐습니다. 그 주인은?"], ["(성경 넌센스) '대머리여 올라가라' 놀린 아이들 앞에 암곰 두 마리가 나왔습니다. 놀림받은 선지자는?"]]$t$, 'ment', $t$c6$t$),
    (v_r, 2, date '2026-11-03', 912, null, $t$2일차 오후 · 섭지코지$t$, $t$점심 식당(성산바다)에서 섭지코지까지 약 8km, 버스로 약 15분입니다. 점심 맛있게 드셨는지요. 이제 섭지코지로 갑니다. '코지'는 바다로 튀어나온 땅, 곶을 뜻하는 제주 말입니다. 해안 언덕길을 따라 걸으면 건너편으로 성산일출봉이 보이고, 드라마 '올인' 촬영지로도 잘 알려진 곳입니다. 등대까지 약 80분 산책합니다. 바람이 세니 겉옷을 꼭 챙겨 주세요. 산책하시면서 부부 사진을 꼭 한 장 남겨 주세요. 이어지는 플로이스트 카페 '친교의 시간 2'에서 베스트 컷을 뽑습니다. 15시 정각까지 버스로 돌아와 주세요.

퀴즈: [["제주 말 '코지'는 무슨 뜻일까요?"], ["섭지코지에서 건너다보이는 유네스코 세계자연유산 봉우리는?"], ["섭지코지를 널리 알린 2003년 드라마는?"], ["섭지코지 바다 위에 홀로 우뚝 선 바위 이름은?"], ["섭지코지 언덕 끝에 서 있는 등대 이름은?"], ["성산일출봉 아래에서 하루 두 번 볼 수 있는 공연은?"], ["제주의 화산섬과 용암동굴이 유네스코 세계자연유산에 오른 해는?"], ["(제주 상식) 성산일출봉의 높이는 약 몇 미터일까요?"], ["(제주 상식) 육각형 돌기둥이 바닷가에 병풍처럼 늘어선 지형은?"], ["(제주 넌센스) 한라산 꼭대기 호수 '백록담'은 무엇이 물을 마시던 곳이라는 뜻일까요?"], ["(성경 넌센스) 머리털이 무거워 해마다 깎았는데 무게가 200세겔이나 나간 왕자는?"], ["(성경 넌센스) 모압 왕 에글론을 물리친 사사 에훗은 어느 손잡이였을까요?"]]$t$, 'ment', $t$c7$t$),
    (v_r, 2, date '2026-11-03', 913, null, $t$2일차 오후 · 친교의 시간 2 · 2일차 점심 · 플로이스트 베이커리 카페$t$, $t$섭지코지에서 플로이스트 카페까지 약 3km, 버스로 약 15분입니다. 바람 속을 걸었으니 이제 따뜻한 차와 빵으로 몸을 녹일 시간입니다. 휘닉스 아일랜드 글라스하우스 안 플로이스트 카페로, 창밖으로 성산일출봉이 보입니다. 별실은 따로 없고 일반 좌석을 함께 쓰니, 다른 손님을 배려해 목소리는 조금 낮춰 주세요. 음료는 홈 '메뉴 고르기'에서 미리 주문한 대로 나옵니다. 테이블별로 앉아 약 70분 동안 '친교의 시간 2'을 진행하고 녹차 족욕으로 이동합니다. 16시 30분까지 버스로 돌아와 주세요.

진행 계획 (약 70분, 테이블별): [["여는 인사 · 감사 기도 (5분)", "음료와 빵을 받는 동안 총무가 인사하고, 장로님 한 분께 짧은 감사 기도를 부탁합니다.", "마이크(별실에 있는지 확인)"], ["섭지코지 부부 베스트 컷 (10분)", "방금 찍은 부부 사진 한 장씩 단톡방에 올리고, 테이블마다 돌아가며 사진 속 이야기를 한마디씩. 박수 소리로 베스트 컷 3쌍을 뽑습니다.", "단톡방 · 작은 상품 3개"], ["내 기분 좋은 별명 소개 (10분)", "부부가 서로에게 '오늘의 별명'을 지어 주고 이유를 소개합니다. 예: '섭지코지 바람막이', '우리 집 성산일출봉'.", "메모지·펜"], ["빵 이름 맞히기 (10분)", "테이블에 놓인 빵을 보고 이름을 적어 맞힙니다. 카페에 미리 메뉴판을 받아 두면 좋아요. 가장 많이 맞힌 테이블에 쿠키 한 봉지.", "메뉴 목록 · 쿠키"], ["제주 빙고 (15분)", "5×5 칸에 오늘·내일 갈 제주 지명과 음식을 적고, 총무가 부르는 대로 지웁니다. 세 줄 먼저 완성한 사람이 '빙고!'", "빙고 종이(46장) · 펜"], ["성경 스무고개 (10분)", "총무가 성경 인물·물건 하나를 정하면 테이블별로 돌아가며 '예/아니요' 질문을 해 먼저 맞힙니다. 예: 다윗의 물맷돌, 노아의 방주.", "없음"], ["옆 부부 칭찬 릴레이 · 마무리 (10분)", "옆 테이블 부부에게 칭찬 한마디씩 건네고, 다 같이 찬양 한 곡을 부른 뒤 족욕 장소로 이동합니다.", "찬양 한 곡 (예: '사랑의 종소리')"]]$t$, 'ment', $t$c7f$t$),
    (v_r, 2, date '2026-11-03', 914, null, $t$2일차 오후 · 녹차 족욕$t$, $t$카페에서 표선 '오늘은 녹차한잔'까지 약 17km, 버스로 약 20분 갑니다. 많이 걸으셨으니 이제 발을 쉬게 해 드릴 시간입니다. 표선의 '오늘은 녹차한잔'에서 녹차 족욕을 합니다. 체험비 1인 8,000원은 회비에 들어 있고 약 60분입니다. 따뜻한 녹차 물에 발을 담그고 차 향기와 함께 피로를 풀어 보세요. 오늘은 특별히 부부가 서로의 발을 한 번 바라보며 수고했다고 말해 주시면 좋겠습니다. 예수님께서 제자들의 발을 씻기시며 '내가 너희에게 행한 것 같이 너희도 행하게 하려 하여 본을 보였노라' 하셨습니다. 17시 50분까지 버스로 돌아와 주세요.

퀴즈: [["녹차와 홍차는 같은 차나무 잎일까요, 다른 나무일까요?"], ["녹차의 쌉쌀한 맛을 내는 대표 성분은?"], ["제주를 대표하는 녹차밭 브랜드는?"], ["오설록 녹차밭이 있는 서귀포 동네 이름은?"], ["제주 녹차가 잘 자라는 까닭은?"], ["한 잔 기준 카페인은 녹차와 커피 중 어느 쪽이 적을까요?"], ["족욕할 때 물은 대략 어느 높이까지 담그면 좋을까요?"], ["(제주 넌센스) 제주 말 '놀멍 쉬멍'은? (지금 딱 우리 모습)"], ["(제주 상식) 제주 말 '하영'은?"], ["(제주 넌센스) '괸당'이 많은 제주에서는 선거도 이것으로 한다는 우스개가 있습니다. '괸당'은?"], ["(성경 넌센스) 게으른 자에게 누구에게 가서 지혜를 배우라 했을까요?"], ["(성경 넌센스) 로뎀나무 아래서 잠든 엘리야가 천사가 깨워 먹은 것은?"]]$t$, 'ment', $t$c8$t$),
    (v_r, 2, date '2026-11-03', 915, null, $t$2일차 저녁 · 통갈치조림 저녁$t$, $t$족욕장에서 조천 와흘리 삼다온까지 약 30km, 버스로 약 35분 갑니다. 오늘 저녁은 조천 와흘리 삼다온의 통갈치조림정식입니다. 예약은 확인되어 있고 네 분이 한 상씩 드십니다. 갈치는 가시가 있으니 천천히 드세요. 저녁 후에는 호텔로 돌아가 20시 30분 세미나실에서 '친교의 시간 3'를 갖습니다. 서로 몰랐던 이야기, 우리 부부가 처음 만난 이야기를 나누는 시간이 되면 좋겠습니다. 오늘 하루 함께 웃어 주셔서 감사합니다. 식사 후 19시 20분까지 버스로 돌아와 주세요.

퀴즈: [["갈치는 몸 빛깔 때문에 흔히 어떤 생선이라 불릴까요?"], ["갈치라는 이름은 무엇을 닮아서 붙었을까요?"], ["제주 은갈치가 은빛이 살아 있는 까닭은? (잡는 방법)"], ["갈치 은빛 비늘 가루는 옛날에 무엇을 만드는 데 쓰였을까요?"], ["(부부) 우리 부부가 처음 만난 장소는? (부부가 함께 맞혀야 정답)"], ["(부부) 배우자 휴대폰에 저장된 내 이름은? (공개!)"], ["(부부) 결혼기념일을 부부가 동시에 외쳐 보세요."], ["(제주 상식) 제주에서 서로 일을 거들어 주는 품앗이를 무엇이라 할까요?"], ["(제주 넌센스) 갈치는 칼처럼 생겼는데 왜 '칼치'가 아니라 '갈치'일까요?"], ["(제주 상식) 옛 제주 여인들이 물을 길어 등에 지고 나르던 항아리는?"], ["(성경 넌센스) 새로 장가든 남편은 1년 동안 무엇을 면제받고 아내를 즐겁게 하라 했을까요?"], ["(성경 넌센스) 잠언은 다투는 여인과 큰 집에서 사는 것보다 어디서 사는 것이 낫다 했을까요? (남편들 조심!)"]]$t$, 'ment', $t$c9$t$),
    (v_r, 2, date '2026-11-03', 916, null, $t$2일차 밤 · 친교의 시간 3 · 2일차 저녁 · 마지막 밤 (호텔 세미나실 20:30)$t$, $t$삼다온에서 함덕 바닷가 델문도 카페까지 약 9km, 버스로 약 15분 갑니다. 미리 고른 음료로 밤바다를 보며 쉬고, 8시 20분에 호텔까지 약 10분 걸어갑니다. 내일이면 집으로 돌아갑니다. 오늘 밤은 이번 수양회의 마지막 밤이자 가장 의미 있는 시간으로 준비했습니다. 웃음으로 시작해서, 서로에게 고마운 마음을 전하고, 하나님 앞에서 우리 부부의 약속을 다시 고백하며 마치겠습니다. 테이블에 부부가 나란히 앉아 주세요. 20시 30분까지 세미나실로 모여 주세요.

진행 계획 (약 90분, 테이블별) · 근거 자료 바탕 추천: [["① 2박 3일 사진 돌아보기 (10분)", "단톡방에 올린 사진과 답사 사진을 화면에 띄우고 함께 웃으며 봅니다. 마음을 여는 시작이에요.", "노트북·HDMI(세미나실 화면 확인)"], ["② 우리 부부 '사랑 지도' 퀴즈 (15분)", "배우자의 요즘 걱정, 가장 좋아하는 찬송, 어릴 적 별명 같은 질문 10개에 각자 답을 적고 맞춰 봅니다. 부부 연구자 가트맨이 말한 '사랑 지도(서로의 속마음 알기)'를 놀이로 바꾼 것입니다.", "질문 카드·펜"], ["③ 결혼사진 한 장 이야기 (15분)", "휴대폰에 있는 결혼사진이나 젊은 시절 사진 한 장을 테이블에 보여 주며 그때 이야기를 나눕니다. 지난 일을 함께 떠올리는 회상 활동은 중년·노년 부부에게 특히 정서적 만족이 크다고 알려져 있습니다.", "각자 휴대폰 사진"], ["④ 배우자에게 감사 편지 (15분)", "작은 카드에 '당신에게 고마운 세 가지'를 적어 건넵니다. 원하는 세 부부는 앞에서 낭독. 감사를 말로 표현할수록 부부 만족도가 높아진다는 연구가 많습니다.", "감사 카드·펜 (46장)"], ["⑤ 손 축복 (10분)", "세족식 대신 테이블에서 할 수 있게, 배우자 손에 핸드크림을 발라 주며 손을 잡고 서로를 위해 짧게 축복 기도합니다. 조용한 찬양을 배경으로 틀어 주세요.", "핸드크림(테이블마다)·잔잔한 찬양"], ["⑥ 결혼 서약 다시 고백 (10분)", "노회장 목사님 인도로 부부가 마주 보고 손잡고 결혼 서약을 다시 고백합니다. 교회 부부 수양회를 마무리할 때 많이 하는 순서입니다.", "서약문(화면 또는 종이)"], ["⑦ 감사 나눔 · 시상 · 축도 (15분)", "'베스트 커플', '최고 웃음상', '최다 사진상' 같은 작은 상을 드리고, 다 같이 찬양한 뒤 축도로 마칩니다.", "작은 상품·상장"]]$t$, 'ment', $t$c9h$t$),
    (v_r, 3, date '2026-11-04', 917, null, $t$3일차 오전 · 본제주 쇼핑 · 돌문화공원$t$, $t$호텔에서 연북로 본제주까지 약 20km, 버스로 약 35분 갑니다. 마지막 날 아침입니다. 조식은 8시 20분까지, 체크아웃은 8시 30분까지 마쳐 주세요. 짐을 버스에 싣고 8시 40분까지 탑승해 주시면 8시 50분에 출발합니다. 체크아웃하시면서 객실에 두고 오신 물건이 없는지 한 번 더 살펴 주세요. 오늘은 먼저 연북로 본제주에서 약 40분 간단히 쇼핑하고, 10시 5분에 출발해 교래의 돌문화공원으로 갑니다. 돌문화공원은 약 70분 관람합니다. 제주의 탄생 신화와 돌 문화를 한자리에 모은 곳으로, 제주를 만들었다는 거인 할머니 설문대할망과 오백장군 이야기가 담겨 있습니다. 제주를 지켜 온 돌하르방도 만나실 수 있습니다. 우리 신앙의 반석 되신 주님을 생각하며 걸어 보시길 바랍니다. 본제주에서는 10시 5분, 돌문화공원에서는 11시 50분까지 버스로 돌아와 주세요.

퀴즈: [["'돌하르방'은 무슨 뜻일까요?"], ["돌하르방의 옛 이름 가운데 하나는?"], ["돌하르방 코를 만지면 무엇이 생긴다는 속설이 있을까요?"], ["설문대할망과 함께 전해지는 아들들의 이야기 이름은?"], ["설문대할망이 육지까지 다리를 놓아 주겠다며 달라고 한 것은?"], ["돌문화공원은 제주시 어느 읍에 있을까요?"], ["제주 사람들이 돌을 쌓을 때 일부러 틈을 남기는 까닭은?"], ["(제주 상식) 제주 무덤 둘레에 네모나게 쌓은 돌담은?"], ["(제주 넌센스) 돌하르방은 두 손을 어디에 두고 있을까요?"], ["(제주 상식) 제주에 있는 오름은 대략 몇 개일까요?"], ["(성경 넌센스) 손가락과 발가락이 여섯 개씩, 모두 스물네 개인 거인이 나타난 곳은?"], ["(성경 넌센스) 야곱이 베개로 베고 잔 뒤 기둥으로 세운 것은?"]]$t$, 'ment', $t$c10$t$),
    (v_r, 3, date '2026-11-04', 918, null, $t$3일차 오후 · 해녀잠수촌 전복뚝배기 · 공항으로$t$, $t$돌문화공원에서 해녀잠수촌까지 약 30km, 버스로 약 40분 갑니다. 아침에 본제주에서 고르신 감귤 초콜릿, 오메기떡 같은 선물은 버스에 잘 두셨지요. 11시 50분 돌문화공원을 출발해 점심을 먹으러 갑니다. 점심은 해녀잠수촌의 전복뚝배기입니다. 식사 후 공항 근처 폴 바셋에서 잠시 차를 마시고 13시 50분에 출발합니다. 오후 2시까지 제주공항에 모여 15시 15분 이스타 ZE252편으로 김포에 갑니다. 신분증 다시 한 번 확인해 주세요. 김포에는 16시 30분 도착 예정인데 지연될 수 있습니다. 2박 3일 동안 안전하게 지켜 주신 하나님께 감사드리며, 공항에 도착하면 마침 기도로 일정을 마치겠습니다. 점심 후 13시 20분, 폴 바셋에서는 13시 50분까지 버스로 돌아와 주세요.

퀴즈: [["제주 전통 떡 '오메기떡'의 '오메기'는 무엇일까요?"], ["제주 노지 감귤은 보통 몇 월부터 수확할까요?"], ["전복은 바닷속에서 무엇을 먹고 자랄까요?"], ["전복 요리(전복죽·전복뚝배기)가 초록빛을 띠고 맛이 진한 까닭은? (제주 말로 '게웃')"], ["제주에서 바닷속에 들어가 전복·소라를 따는 여성을 무엇이라 부를까요?"], ["제주 해녀문화는 유네스코의 무엇에 올랐을까요?"], ["귀가편 ZE252는 제주공항에서 몇 시에 출발할까요?"], ["(제주 상식) 메밀 반죽을 얇게 부쳐 무채를 넣고 돌돌 만 제주 음식은?"], ["(제주 넌센스) 한라봉은 꼭지가 볼록 튀어나온 모양이 무엇을 닮아 붙은 이름일까요?"], ["(제주 상식) 천연기념물로 보호받는 제주 토종 말은?"], ["(성경 넌센스) 솔로몬의 후궁과 첩을 합하면 몇 명일까요?"], ["(성경 넌센스) 먼저 손을 내밀어 손목에 홍색 실을 맸는데 나중에 태어난 쌍둥이는?"]]$t$, 'ment', $t$c11$t$),
    (v_r, 3, date '2026-11-04', 919, null, $t$돌아오는 길 · 마무리 퀴즈 · 우리가 함께한 2박 3일$t$, $t$제주에서 김포까지 약 450km, 비행 시간은 약 1시간 15분입니다. 이제 김포로 돌아갑니다. 마지막으로 이번 수양회를 함께 돌아보는 퀴즈를 내겠습니다. 다 맞히시는 분께는 작은 선물이 있습니다. 함께해 주신 모든 분, 기도와 찬조로 섬겨 주신 분들께 진심으로 감사드립니다. 집에 도착하실 때까지 평안하시기를 빕니다.

퀴즈: [["첫날 우리가 배를 타고 들어간 섬은?"], ["첫날 점심 메뉴는?"], ["우리가 이틀 밤 묵은 호텔은?"], ["둘째 날 저녁 메뉴는?"], ["갈 때 탄 비행기 편명은?"], ["섭지코지에서 건너다보인 봉우리는?"], ["이번 수양회는 시화산노회 제 몇 회기 행사였을까요?"], ["(제주 넌센스) 2박 3일 '놀멍 쉬멍' 했으니 서로에게 할 제주 말 인사는?"], ["(제주 상식) 제주 밭담이 2014년에 오른 FAO의 유산 이름은?"], ["(제주 넌센스) 제주에서 기념품으로 가져가면 안 되는 것은?"], ["(성경 넌센스) 기드온의 300 용사는 물을 어떻게 마신 사람들이었을까요?"], ["(성경 넌센스) 예수님이 '저 여우'라고 부르신 사람은?"]]$t$, 'ment', $t$c12$t$)
  on conflict (retreat_id, day_no, seq) do nothing;
end
$seed$;


-- 확인
select r.id, r.title, r.start_date, r.end_date, r.stage, r.committee_event_id,
       (select count(*) from public.retreat_steps s where s.retreat_id = r.id)        as "단계",
       (select count(*) from public.retreat_program g where g.retreat_id = r.id)      as "일정표·멘트",
       (select count(*) from public.retreat_participants p where p.retreat_id = r.id) as "참가자(140b)"
  from public.retreats r order by r.id;
