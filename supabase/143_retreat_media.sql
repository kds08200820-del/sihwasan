-- =====================================================================
--  143. 수양회 사진·영상 (2026-10-28)
--
--  교육친교부 수양회 화면에 「사진·영상」 칸을 둔다.
--   · 사진은 노회 갤러리·시찰 사진첩과 똑같이 웹 크기로 줄여 Cloudflare R2 에 올리고
--     (js/photos.js), 여기에는 주소만 적는다.
--   · 영상은 유튜브 주소로 받는다 (시찰 사진첩과 같은 방식 — 한 표에 함께 담고
--     kind 로 가린다).
--   · day_no : 0 = 준비·답사, 1·2·3 = n일차, 비우면 기타
--   · 보기  : 정회원, 그리고 수양회 참가자(일반회원 사모님 포함)
--   · 올리기: 그 부서 임원과 정회원 참가자 (사진 보관소가 정회원만 받으므로)
--   · 고치기·지우기: 임원, 또는 올린 본인
--   · 가이드북(아티팩트)의 영상 2편을 넣는다. 사진 70장은 임원이 화면에서 올린다
--     (사진 보관소는 로그인한 회원의 이름으로만 받는다).
--
--  실행: Supabase → SQL Editor → 전체 붙여넣고 Run.  여러 번 실행해도 안전합니다.
--  ※ 142_retreat_spouse.sql 이후에 실행.
-- =====================================================================

create table if not exists public.retreat_media (
  id          bigserial primary key,
  retreat_id  bigint not null references public.retreats on delete cascade,
  kind        text not null default 'photo' check (kind in ('photo', 'video')),
  day_no      integer,
  title       text,                 -- 사진 설명 / 영상 제목
  image_url   text not null,        -- 큰 사진 주소, 또는 유튜브 주소
  thumb_url   text,                 -- 작은 사진 (영상은 비우면 유튜브 기본 그림)
  sort        integer not null default 0,
  author_id   uuid default auth.uid(),
  author_name text,
  created_at  timestamptz not null default now()
);
create index if not exists retreat_media_idx on public.retreat_media (retreat_id, kind, day_no, sort, id);

alter table public.retreat_media enable row level security;
drop policy if exists retreat_media_read   on public.retreat_media;
drop policy if exists retreat_media_insert on public.retreat_media;
drop policy if exists retreat_media_update on public.retreat_media;
drop policy if exists retreat_media_delete on public.retreat_media;

create policy retreat_media_read on public.retreat_media for select
  using (public.is_member() or public.retreat_my_participant(retreat_id) is not null);

create policy retreat_media_insert on public.retreat_media for insert
  with check (public.is_member()
              and author_id = auth.uid()
              and exists (select 1 from public.retreats r where r.id = retreat_id
                           and (public.is_committee_officer(r.committee)
                             or public.retreat_my_participant(r.id) is not null)));

create policy retreat_media_update on public.retreat_media for update
  using (author_id = auth.uid()
         or exists (select 1 from public.retreats r where r.id = retreat_id and public.is_committee_officer(r.committee)))
  with check (author_id = auth.uid()
         or exists (select 1 from public.retreats r where r.id = retreat_id and public.is_committee_officer(r.committee)));

create policy retreat_media_delete on public.retreat_media for delete
  using (author_id = auth.uid()
         or exists (select 1 from public.retreats r where r.id = retreat_id and public.is_committee_officer(r.committee)));


-- 메인 화면 히어로가 가이드북 단추를 띄울 수 있게 가이드북 주소도 준다 (로그인한 분에게만)
create or replace function public.retreat_today()
returns jsonb language sql stable security definer set search_path = public as $fn$
  select jsonb_build_object('id', r.id, 'title', r.title, 'place', r.place,
                            'start_date', r.start_date, 'end_date', r.end_date, 'stage', r.stage,
                            'day_no', ((now() at time zone 'Asia/Seoul')::date - r.start_date) + 1,
                            'days', (coalesce(r.end_date, r.start_date) - r.start_date) + 1,
                            'guide_url', case when auth.uid() is not null then r.guide_url end)
    from public.retreats r
   where r.status = 'open' and r.stage <> '마침'
     and (now() at time zone 'Asia/Seoul')::date between r.start_date and coalesce(r.end_date, r.start_date)
   order by r.id desc
   limit 1
$fn$;
grant execute on function public.retreat_today() to anon, authenticated;


-- 가이드북의 영상 2편 (답사 영상 · 친교의 시간 미리보기) — 이미 있으면 넣지 않는다
insert into public.retreat_media (retreat_id, kind, day_no, title, image_url, sort, author_id, author_name)
select r.id, 'video', 0, v.title, v.url, v.sort, null, '가이드북에서 옮김'
  from public.retreats r
  cross join (values
    ('사전 답사 — 철저한 검토, 정확한 동선, 뛰어난 미각', 'https://youtu.be/k_Tfscc35S4', 1),
    ('친교의 시간 미리보기', 'https://www.youtube.com/watch?v=p6tjJwH1cbY', 2)
  ) as v(title, url, sort)
 where r.title = '2026 제주 부부수양회'
   and not exists (select 1 from public.retreat_media m where m.retreat_id = r.id and m.image_url = v.url);


-- 확인
select r.title,
       (select count(*) from public.retreat_media m where m.retreat_id = r.id and m.kind = 'photo') as "사진",
       (select count(*) from public.retreat_media m where m.retreat_id = r.id and m.kind = 'video') as "영상"
  from public.retreats r order by r.id;
