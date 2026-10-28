-- =====================================================================
--  141. 수양회 글에서 그림 글자(이모지) 빼기 (2026-10-28)
--
--  문제: 140 시드가 가이드북(아티팩트)의 글을 그대로 옮겨, 일정표·단계·좌석
--        메모에 🚌 🚐 ✈ ⛴ ⚠ ☔ 같은 그림 글자가 섞여 있었다. 홈페이지는 그림
--        글자를 쓰지 않는다(아이콘은 선으로 그린 SVG).
--  해결: 그림 글자(U+2600–27BF, U+1F000–1FAFF, 이음 글자 FE0F·200D)와 그 뒤의
--        빈칸 하나를 지운다. 화살표(→)·가운뎃점(·)·동그라미 숫자(①)는 그대로 둔다.
--        수양회 표(retreats·retreat_steps·retreat_options·retreat_choices·
--        retreat_program)만 고친다.
--
--  실행: Supabase → SQL Editor → 전체 붙여넣고 Run.  여러 번 실행해도 안전합니다.
--  ※ 140_retreat.sql 이후에 실행.
-- =====================================================================

create or replace function public.retreat_no_emoji(p text)
returns text language sql immutable set search_path = public as $fn$
  select regexp_replace(p,
           '[' || chr(9728) || '-' || chr(10175) || chr(126976) || '-' || chr(129791) ||
           chr(65039) || chr(8205) || ']+ ?', '', 'g')
$fn$;

update public.retreat_program
   set title = btrim(public.retreat_no_emoji(title)),
       body  = btrim(public.retreat_no_emoji(body)),
       place = btrim(public.retreat_no_emoji(place)),
       move  = btrim(public.retreat_no_emoji(move)),
       updated_at = now()
 where title is distinct from btrim(public.retreat_no_emoji(title))
    or body  is distinct from btrim(public.retreat_no_emoji(body))
    or place is distinct from btrim(public.retreat_no_emoji(place))
    or move  is distinct from btrim(public.retreat_no_emoji(move));

update public.retreat_steps
   set title = btrim(public.retreat_no_emoji(title)),
       body  = btrim(public.retreat_no_emoji(body)),
       updated_at = now()
 where title is distinct from btrim(public.retreat_no_emoji(title))
    or body  is distinct from btrim(public.retreat_no_emoji(body));

update public.retreat_options
   set label = btrim(public.retreat_no_emoji(label))
 where label is distinct from btrim(public.retreat_no_emoji(label));

update public.retreat_choices
   set option_label = btrim(public.retreat_no_emoji(option_label))
 where option_label is distinct from btrim(public.retreat_no_emoji(option_label));

-- settings 는 jsonb — 문자열 안의 그림 글자만 빠진다 (JSON 문법 글자는 이 범위에 없다)
update public.retreats
   set title    = btrim(public.retreat_no_emoji(title)),
       place    = btrim(public.retreat_no_emoji(place)),
       settings = public.retreat_no_emoji(settings::text)::jsonb,
       updated_at = now()
 where title is distinct from btrim(public.retreat_no_emoji(title))
    or place is distinct from btrim(public.retreat_no_emoji(place))
    or settings::text is distinct from public.retreat_no_emoji(settings::text);


-- 확인 — 모두 0 이면 끝
select (select count(*) from public.retreat_program
         where coalesce(title,'') || coalesce(body,'') || coalesce(place,'') || coalesce(move,'')
               is distinct from public.retreat_no_emoji(coalesce(title,'') || coalesce(body,'') || coalesce(place,'') || coalesce(move,''))) as "일정표",
       (select count(*) from public.retreat_steps
         where coalesce(title,'') || coalesce(body,'') is distinct from public.retreat_no_emoji(coalesce(title,'') || coalesce(body,''))) as "단계",
       (select count(*) from public.retreat_options
         where label is distinct from public.retreat_no_emoji(label)) as "선택지",
       (select count(*) from public.retreats
         where settings::text is distinct from public.retreat_no_emoji(settings::text)) as "설정";
