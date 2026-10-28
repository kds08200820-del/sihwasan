/* 수양회 카드 — 대시보드 맨 위 카드와 메인 화면 히어로 창 (140 sql, retreat.html)
 *
 *   SHSRetreat.dashCard(자리, 이용자)   대시보드 허브 위 (js/board.js 의 #hub-retreat)
 *   SHSRetreat.hero(이용자)             메인 화면 히어로 (index.html 의 #hero-retreat)
 *
 * 카드는 참가자(와 그 부서 임원)에게만, 수양회 2주 전부터 끝나는 날까지 보인다.
 * 기간 중에는 지금 진행 중인 일정 줄과 아직 안 고른 선택을 함께 보여 주고,
 * 그 전에는 내 좌석·숙소와 열린 단계를 보여 준다. 「그만 보기」는 단계가 새로
 * 열리면 다시 나타난다 (열린 단계 수가 열쇠에 들어간다).
 */
var SHSRetreat = (function () {
  'use strict';

  function esc(s) { return SHS.esc(s); }
  function ready() { return !!(window.SHSCloud && SHSCloud.enabled && SHSCloud.enabled()); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function days(a, b) { return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000); }
  function kdate(ymd) {
    if (!ymd) return '';
    var d = new Date(ymd + 'T00:00:00');
    return (d.getMonth() + 1) + '/' + d.getDate() + '(' + ['일', '월', '화', '수', '목', '금', '토'][d.getDay()] + ')';
  }
  function nowHM() { var d = new Date(); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
  function choiceOf(S, stepId, pid) {
    return (S.choices || []).filter(function (c) {
      return String(c.step_id) === String(stepId) && String(c.participant_id) === String(pid);
    })[0];
  }

  /* 상태(retreat_state)에서 카드에 쓸 것만 추린다 */
  function digest(S) {
    var R = S && S.retreat;
    if (!R) return null;
    var dn = days(R.start_date, S.today) + 1;      /* 오늘이 몇 일차인가 (전이면 0 이하) */
    var total = R.end_date && R.end_date > R.start_date ? days(R.start_date, R.end_date) + 1 : 1;
    var people = S.me ? [S.me].concat(S.companions || []) : [];
    var pending = 0, pendingTitles = [];
    (S.steps || []).forEach(function (s) {
      if (s.kind !== '선택' || s.status !== '열림') return;
      var miss = people.filter(function (p) { return !choiceOf(S, s.id, p.id); }).length;
      if (miss) { pending += miss; pendingTitles.push(s.title.replace(/^카페 주문 · /, '')); }
    });
    var open = (S.steps || []).filter(function (s) { return s.status === '열림'; });
    var prog = (S.program || []).filter(function (g) { return g.kind !== 'ment' && g.day_no === dn; });
    var now = prog.filter(function (g) { return g.status === '진행'; })[0] || null;
    var hm = nowHM();
    var next = prog.filter(function (g) { return g.status === '예정' && g.time && g.time >= hm; })[0] ||
               (now ? null : prog.filter(function (g) { return g.status !== '끝'; })[0]) || null;
    return {
      R: R, dn: dn, total: total, inDays: dn >= 1 && dn <= total, before: dn < 1, after: dn > total,
      me: S.me, people: people, roommates: S.roommates || [],
      pending: pending, pendingTitles: pendingTitles, open: open, now: now, next: next, officer: !!S.officer
    };
  }

  function badge(d) {
    if (d.inDays) return '<span class="role-badge" style="background:#fdf3f3;color:var(--red);border:1px solid var(--red)">오늘 ' + d.dn + '일차</span>';
    if (d.before) return '<span class="role-badge">D-' + (1 - d.dn) + '</span>';
    return '<span class="role-badge">다녀왔습니다</span>';
  }

  /* ---------- 대시보드 카드 ---------- */
  function dashCard(slot, user) {
    if (!slot || !user || !user.cloud || !ready()) return;
    SHSCloud.init().then(function (c) { return c ? c.rpc('retreat_state') : null; }).then(function (r) {
      if (!r || r.error || !r.data) return;
      var d = digest(r.data);
      if (!d) return;
      var R = d.R;
      if (R.status !== 'open' || R.stage === '마침') return;
      if (!d.me && !d.officer) return;              /* 참가자도 임원도 아니면 보이지 않는다 */
      if (d.dn < -13 || d.after) return;            /* 2주 전부터 끝나는 날까지 */
      var hideKey = 'shs_retreat_card_' + R.id + '_' + d.open.length;
      if (!d.inDays) { try { if (localStorage.getItem(hideKey)) return; } catch (x) {} }
      render(slot, d, hideKey);
    }).catch(function () {});
  }

  function render(slot, d, hideKey) {
    var R = d.R, me = d.me;
    var base = 'retreat.html?id=' + R.id;
    var h = '<div class="admin-card rt-dash" style="border-left:4px solid var(--navy);margin-bottom:18px">' +
      '<h3 style="margin:0 0 6px">' + esc(R.title) + ' ' + badge(d) + '</h3>' +
      '<p style="margin:0 0 10px;color:var(--gray-5)">' + esc(kdate(R.start_date)) +
      (R.end_date && R.end_date > R.start_date ? ' ~ ' + esc(kdate(R.end_date)) : '') +
      (R.place ? ' · ' + esc(R.place) : '') + '</p>';

    /* 내 좌석·숙소 — 참가자에게 */
    if (me) {
      var seat = me.bus_seat ? '버스 ' + me.bus_seat + '번' : (me.van_seat ? '쏠라티 ' + me.van_seat + '번' : '좌석 미정');
      var room = me.room_no ? me.room_no + '호' : (me.room_group ? me.room_group + '번 방' : '숙소 미정');
      var mates = d.roommates.map(function (q) { return q.name; }).join(', ');
      h += '<p style="margin:0 0 8px;line-height:1.7"><strong>' + esc(seat) + '</strong> · <strong>' + esc(room) + '</strong>' +
        (mates ? ' <span style="color:var(--gray-5)">(함께: ' + esc(mates) + ')</span>' : '') +
        (d.people.length > 1 ? ' · ' + d.people.slice(1).map(function (p) { return esc(p.name) + ' ' + esc(p.role || ''); }).join(', ') + ' 함께' : '') +
        '</p>';
    }

    /* 기간 중 — 지금·다음 일정 */
    if (d.inDays && (d.now || d.next)) {
      h += '<p style="margin:0 0 8px;line-height:1.7">' +
        (d.now ? '<strong style="color:var(--red)">지금</strong> ' + esc(d.now.time || '') + ' ' + esc(d.now.title) +
                 (d.now.place ? ' <span style="color:var(--gray-5)">· ' + esc(d.now.place) + '</span>' : '') + '<br>' : '') +
        (d.next ? '<strong>다음</strong> ' + esc(d.next.time || '') + ' ' + esc(d.next.title) +
                  (d.next.place ? ' <span style="color:var(--gray-5)">· ' + esc(d.next.place) + '</span>' : '') : '') +
        '</p>';
    }

    /* 아직 안 고른 선택 */
    if (d.pending) {
      h += '<div class="dash-alert"><strong>아직 고르지 않은 것 ' + d.pending + '건</strong> — ' +
        esc(d.pendingTitles.join(' · ')) + ' <a href="' + base + '#me">지금 고르기</a></div>';
    } else if (me && d.open.length) {
      h += '<p style="margin:0 0 8px;color:var(--gray-5);font-size:0.9rem">열린 안내 ' + d.open.length + '건 — 고를 것은 모두 고르셨습니다.</p>';
    }

    h += '<a class="btn" href="' + base + '#me">내 안내</a> ' +
      '<a class="btn ghost" href="' + base + '#prog">일정</a> ' +
      (d.officer ? '<a class="btn ghost" href="' + base + '#ops">진행 관리</a> ' : '') +
      (!d.inDays ? '<button type="button" class="btn ghost sm" data-rt-hide>그만 보기</button>' : '') +
      '</div>';
    slot.innerHTML = h;
    var hb = slot.querySelector('[data-rt-hide]');
    if (hb) hb.addEventListener('click', function () {
      try { localStorage.setItem(hideKey, '1'); } catch (x) {}
      slot.innerHTML = '';
    });
  }

  /* ---------- 메인 화면 히어로 ----------
   * 수양회 기간(retreat_today)에 로그인한 회원에게 「수양회」 창을 띄운다.
   * 정기노회 날 창(hero-today)이 이미 켜져 있으면 그쪽을 우선한다. */
  function hero(user) {
    var heroEl = document.querySelector('.hero');
    var card = document.getElementById('hero-retreat');
    if (!heroEl || !card || !ready()) return;
    if (!(user && user.cloud)) return;
    SHSCloud.init().then(function (c) { return c ? c.rpc('retreat_today') : null; }).then(function (r) {
      if (!r || r.error || !r.data) return;
      if (heroEl.classList.contains('hero-today')) return;
      var d = r.data;
      var t = card.querySelector('.ht-title'), n = card.querySelector('.ht-name');
      if (t) t.textContent = d.title || '수양회';
      if (n) n.textContent = (d.day_no ? d.day_no + '일차' : '') + (d.place ? ' · ' + d.place : '');
      card.href = 'retreat.html?id=' + d.id + '#me';
      card.classList.remove('hidden');
    }, function () {});
  }

  return { dashCard: dashCard, hero: hero };
})();
