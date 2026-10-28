/* 대시보드 — 로그인한 정회원이 한눈에 보는 화면
 *
 * 흩어져 있던 것을 한자리에 모은다.
 *   나의 알림 · 노회 공지 · 노회 일정
 *   내가 맡은 부서 · 그 부서의 일정과 공지
 *   (대시보드 화면에서 <전체 보기>를 누르면 상비부 전체까지 본다)
 *   신청서류 발급 현황 · 교회상황 보고서
 *
 * 가운데 상비부 부분은 <상비부 대시보드>(js/dashboard.js)를 그대로
 * 불러 쓴다. 두 곳이 갈라져 서로 달라지는 일을 막기 위함이다.
 *
 * 로그인하지 않은 분과 정회원이 아닌 분에게는 이 화면을 보이지 않는다.
 * 부르는 쪽에서 SHSBoard.can(user) 로 먼저 가려 주면 된다.
 *
 *   SHSBoard.mount(자리, 지금 로그인한 사람)
 */
var SHSBoard = (function () {
  'use strict';

  function esc(s) { return SHS.esc(s); }

  /* 상회비 회기: 4월에 시작해 다음 해 3월에 끝난다 */
  var FY_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
  function fyYear() {
    var d = new Date();
    return d.getMonth() + 1 >= 4 ? d.getFullYear() : d.getFullYear() - 1;
  }
  /* 회기에서 이번 달까지 몇 달째인지 (4월=1 ... 3월=12) */
  function fyElapsed() {
    return FY_MONTHS.indexOf(new Date().getMonth() + 1) + 1;
  }
  function ymd(d) { return d.toISOString().slice(0, 10); }

  /* 이 화면을 볼 수 있는 사람인가 — 서버 로그인한 정회원 */
  function can(user) {
    return !!(user && user.cloud && SHS.isActiveMember(user) &&
              window.SHSCloud && SHSCloud.enabled());
  }

  /* full : 상비부 전체까지 보여 준다 (대시보드 화면)
   *        아니면 내가 맡은 부서만 보여 준다 (메인 화면) */
  function mount(box, user, opts) {
    if (!box) return;
    if (!can(user)) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    var full = !!(opts && opts.full);
    /* 최고관리자(노회 사무실 계정)는 소속 교회·시찰·부서가 없으므로
     * 개인 칸은 빼고 노회 전체 정보만 보여 준다. */
    var isSuper = user.role === 'superadmin';
    var hubSicLink = null;   /* 나의 시찰 화면 주소 (drawMine에서 채운다) */
    /* 상회비 내역을 볼 수 있는가 — 상회비를 내는 시무 교회 담임목사·장로와
     * 관리자·노회 회계·부회계만 (main.js SHS.duesAccess). 부목사·무임목사·원로목사·
     * 은퇴목사 등에게는 나의 상회비 카드와 시찰별 납부 현황을 보이지 않는다. */
    var duesGate = SHS.duesAccess ? SHS.duesAccess(user) : Promise.resolve(true);

    /* ---------- 화면 얼개 ----------
     * 전체 대시보드(full)는 카드 허브형 — 항목 카드를 누르면 상세가 열린다.
     * 메인 화면 요약은 예전 그대로 촘촘한 표 형태를 쓴다. */
    var LOADING = '<p class="dash-none">불러오는 중...</p>';

    /* 선으로 그린 아이콘 (참조 디자인풍) */
    function hicon(d) {
      return '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.7" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
    }
    var HICONS = {
      noti: hicon('<path d="M24 8a10 10 0 0 0-10 10v7l-4 6h28l-4-6v-7a10 10 0 0 0-10-10z"/><path d="M20 33a4 4 0 0 0 8 0"/><circle cx="33" cy="11" r="4"/>'),
      notice: hicon('<path d="M8 20v8h6l14 8V12l-14 8H8z"/><path d="M33 18a8 8 0 0 1 0 12"/><path d="M37 14a14 14 0 0 1 0 20"/>'),
      sched: hicon('<rect x="8" y="12" width="32" height="28" rx="3"/><path d="M8 20h32M16 8v8M32 8v8"/><path d="M15 27h4M22 27h4M29 27h4M15 33h4M22 33h4"/>'),
      church: hicon('<path d="M10 40V24l14-10 14 10v16"/><path d="M24 6v8M20 10h8"/><path d="M20 40v-8a4 4 0 0 1 8 0v8"/><path d="M6 40h36"/>'),
      sichal: hicon('<path d="M24 42s-13-11.5-13-21a13 13 0 0 1 26 0c0 9.5-13 21-13 21z"/><circle cx="24" cy="21" r="5"/>'),
      mydues: hicon('<circle cx="20" cy="20" r="11"/><path d="M15 20h10M15 24h10M17 15l3 6 3-6"/><path d="M31 15a11 11 0 1 1-9 17"/>'),
      com: hicon('<circle cx="17" cy="17" r="6"/><circle cx="33" cy="19" r="5"/><path d="M6 38a11 11 0 0 1 22 0"/><path d="M28 38a9 9 0 0 1 14-7"/>'),
      doc: hicon('<path d="M14 6h14l8 8v28H14z"/><path d="M28 6v8h8"/><path d="M19 22h10M19 28h10M19 34h6"/>'),
      report: hicon('<rect x="12" y="8" width="24" height="34" rx="3"/><path d="M19 6h10v6H19z"/><path d="M18 22h12M18 28h12M18 34h8"/>'),
      dues: hicon('<path d="M8 40h32"/><rect x="11" y="26" width="6" height="14"/><rect x="21" y="18" width="6" height="22"/><rect x="31" y="10" width="6" height="30"/>'),
      me: hicon('<circle cx="24" cy="17" r="8"/><path d="M9 41a15 15 0 0 1 30 0"/>'),
      schedmgr: hicon('<rect x="8" y="12" width="32" height="28" rx="3"/><path d="M8 20h32M16 8v8M32 8v8"/><path d="M24 26v8M20 30h8"/>'),
      assembly: hicon('<path d="M6 18 24 8l18 10"/><path d="M11 22v14M19 22v14M29 22v14M37 22v14"/><path d="M6 40h36"/><path d="M8 18h32"/>'),
      audit: hicon('<path d="M13 8h22v32H13z"/><path d="M19 8V5h10v3"/><path d="M19 18h10M19 24h10M19 30h6"/><path d="M28 34l3 3 6-7"/>'),
      call: hicon('<circle cx="24" cy="26" r="14"/><path d="M24 18v8l6 4"/><path d="M19 6h10M24 6v6"/>'),
      oreport: hicon('<rect x="10" y="7" width="28" height="34" rx="3"/><path d="M16 16h16M16 22h16M16 28h9"/><path d="M28 33l3 3 6-7"/>')
    };

    function hubCard(id, title, sub, extra) {
      return '<button type="button" class="hub-card' + (extra && extra.hidden ? ' hidden' : '') +
        '" data-hub="' + id + '"' + (extra && extra.cid ? ' id="' + extra.cid + '"' : '') + '>' +
        (extra && extra.badge ? '<span class="hub-badge hidden" id="' + extra.badge + '"></span>' : '') +
        HICONS[id] +
        '<span class="hc-t"><span>' + title +
        (sub ? '<span class="hc-s">' + sub + '</span>' : '') + '</span>' +
        '<span class="hc-arrow">&#8594;</span></span></button>';
    }

    /* 메인 화면과 전체 대시보드 모두 카드 허브형으로 그린다 */
    {
      var cards = '';
      cards += hubCard('noti', '나의 알림', '', { badge: 'hub-badge-noti' });
      /* 임원에게 — 매일 아침 6시 AI 가 쓰는 직책별 업무 보고서 (officer-report.html, 128 sql) */
      if (SHSAuth.isOfficer(user)) {
        var when = (user.role === 'president' || user.role === 'clerk') ? '화·목요일 아침 6시'
                 : user.role === 'staff' ? '할 일은 알림으로 옵니다' : '매월 첫째 월요일 아침 6시';
        cards += hubCard('oreport', '업무 보고서', when, { cid: 'hub-card-oreport' });
      }
      /* 공지와 일정은 한 카드에서 함께 본다 */
      cards += hubCard('notice', '노회 공지·일정', '');
      cards += hubCard('assembly', '총회 활동 현황', '총대 · 파송 이사');
      if (!isSuper) {
        cards += hubCard('church', '나의 교회', '');
        cards += hubCard('sichal', '나의 시찰');
        /* 상회비를 볼 수 있는 분에게만 연다 (duesGate 가 확인한 뒤 보인다) */
        cards += hubCard('mydues', '나의 상회비', '상회비 · 세례의무금', { cid: 'hub-card-mydues', hidden: true, badge: 'hub-badge-mydues' });
        /* 부목사·시무목사에게만 — 나의 남은 청빙 임기 (loadCallTerm 이 열고 채운다) */
        cards += hubCard('call', '나의 청빙 임기', '', { cid: 'hub-card-call', hidden: true, badge: 'hub-badge-call' });
        cards += hubCard('com', '상비부', '');
      }
      cards += hubCard('doc', '서류 발급', '');
      cards += hubCard('report', '교회상황 보고서', '', { cid: 'hub-card-report' });
      cards += hubCard('me', '내 정보', '사진 · 도장 · 연락처');
      /* 감사함 — 감사 기간에 감사부장·서기(와 관리자)에게만 나타난다 (loadAudit 이 연다) */
      cards += hubCard('audit', '감사', '회계 장부 감사', { cid: 'hub-card-audit', hidden: true });
      /* 노회장·서기·간사에게는 노회 일정 카드 대신 노회 일정관리 카드를 둔다 */
      if (SHSAuth.canManageMembers(user)) cards += hubCard('schedmgr', '노회 일정관리', '달력 · 임직식');
      /* 노회 사무실 계정은 개인 칸이 없으므로 상회비 전체를 카드로 둔다 */
      if (isSuper) cards += hubCard('dues', '상회비 전체', '관리 현황');

      box.innerHTML =
        /* 서기 알림 카드 자리 — 정기노회 4주 전 총대 장로 임기 확인 (js/elder-notice.js) */
        /* 상회비 미납 안내 자리 — 노회규칙 제29조 (loadRule29 가 채운다) */
        '<div id="hub-dues29"></div>' +
        /* 청빙 임기 안내 자리 — 부목사·시무목사 본인의 임기가 넉 달 안이거나 끝났을 때 (loadCallTerm) */
        '<div id="hub-call"></div>' +
        '<div id="hub-elder"></div>' +
        /* 수양회 참가자 안내 자리 — 내 좌석·숙소·골라야 할 것 (js/retreat-card.js, 140 sql) */
        '<div id="hub-retreat"></div>' +
        '<div id="hub-home" class="dash-hub">' +
        '<div class="hub-left">' +
        '<div id="hub-photo" class="hidden" style="margin-bottom:16px"></div>' +
        '<div class="hub-label">&#10013; Dashboard</div>' +
        '<h2 class="hub-title">' + esc(SHS.honorific(user)) + ',<br>시화산노회의 <strong>소식과 현황</strong>을<br>확인해보세요.</h2>' +
        '<p class="hub-sub">알림 · 일정 · 납부 현황 · 서류를 한자리에 모았습니다.</p>' +
        '<div id="hub-cal" class="hidden" style="margin-top:22px"></div>' +
        '</div>' +
        '<div class="hub-grid">' + cards + '</div>' +
        '</div>' +
        '<div id="hub-detail" class="hidden">' +
        '<div class="hub-detail-head">' +
        '<button type="button" class="btn ghost sm" id="hub-back">&#8592; 대시보드</button>' +
        '<h2 id="hub-detail-title" style="margin:0"></h2></div>' +
        '<div class="hub-panel hidden" data-hp="noti"><div id="dash-noti"></div></div>' +
        '<div class="hub-panel hidden" data-hp="notice">' +
        '<h3 class="mn-sub" style="margin:0 0 10px">노회 공지</h3>' +
        '<div id="dash-notice">' + LOADING + '</div>' +
        '<h3 class="mn-sub" style="margin:20px 0 10px">노회 일정</h3>' +
        '<div id="dash-sched">' + LOADING + '</div></div>' +
        '<div class="hub-panel hidden" data-hp="assembly"><div id="dash-assembly">' + LOADING + '</div></div>' +
        (isSuper ? '' :
          '<div class="hub-panel hidden" data-hp="church"><div id="dash-church">' + LOADING + '</div></div>' +
          '<div class="hub-panel hidden" data-hp="sichal"><div id="dash-sichal">' + LOADING + '</div></div>' +
          '<div class="hub-panel hidden" data-hp="mydues">' +
          '<div class="tabs" id="md-tabs" style="margin-bottom:14px">' +
          '<button type="button" class="active" data-mdt="dues">나의 상회비</button>' +
          '<button type="button" data-mdt="bap">나의 세례의무금</button>' +
          '<button type="button" data-mdt="all" id="md-tab-all" class="hidden">상회비 전체</button></div>' +
          '<div id="dash-mydues">' + LOADING + '</div>' +
          '<div id="dash-mybap" class="hidden">' + LOADING + '</div>' +
          /* 상회비 전체 (관리자·회계에게만 탭이 열린다) */
          '<div id="dash-dues-sec" class="hidden">' +
          '<p class="dash-more" style="margin-top:0"><a href="officer.html#sec-%EC%83%81%ED%9A%8C%EB%B9%84-%EA%B4%80%EB%A6%AC">관리 화면으로</a></p>' +
          '<div id="dash-dues-body">' + LOADING + '</div></div></div>' +
          '<div class="hub-panel hidden" data-hp="com"><div id="dash-com"></div></div>') +
        '<div class="hub-panel hidden" data-hp="doc"><div id="dash-doc">' + LOADING + '</div></div>' +
        '<div class="hub-panel hidden" data-hp="report"><div id="dash-report">' + LOADING + '</div></div>' +
        '<div class="hub-panel hidden" data-hp="audit"><div id="dash-audit">' + LOADING + '</div></div>' +
        (isSuper
          ? '<div class="hub-panel hidden" data-hp="dues"><div id="dash-dues-sec" class="hidden">' +
            '<p class="dash-more" style="margin-top:0"><a href="officer.html#sec-%EC%83%81%ED%9A%8C%EB%B9%84-%EA%B4%80%EB%A6%AC">관리 화면으로</a></p>' +
            '<div id="dash-dues-body">' + LOADING + '</div></div></div>'
          : '') +
        '</div>';

      var HUB_TITLES = {
        noti: '나의 알림', notice: '노회 공지·일정', assembly: '총회 활동 현황', church: '나의 교회',
        sichal: '나의 시찰 · 납부 현황', mydues: '나의 상회비 · 세례의무금',
        com: '상비부', doc: '서류 발급', report: '교회상황 보고서', dues: '상회비 전체',
        audit: '감사 · 회계 장부'
      };
      /* 상세로 들어가면 주소 뒤에 #hub-항목 이 붙어, 브라우저의
       * <뒤로 가기>를 눌러도 이전 단계(허브)로 돌아온다. */
      function showHub(id) {
        var panel = id && box.querySelector('.hub-panel[data-hp="' + id + '"]');
        /* 상세를 보는 동안에는 아래 갤러리 등 다른 섹션이 따라붙지 않게 감춘다 */
        document.querySelectorAll('.home-gallery').forEach(function (g2) {
          g2.classList.toggle('hidden', !!panel);
        });
        var elderSlot = document.getElementById('hub-elder');
        if (elderSlot) elderSlot.classList.toggle('hidden', !!panel);
        var d29Slot = document.getElementById('hub-dues29');
        if (d29Slot) d29Slot.classList.toggle('hidden', !!panel);
        var callSlot = document.getElementById('hub-call');
        if (callSlot) callSlot.classList.toggle('hidden', !!panel);
        var rtSlot = document.getElementById('hub-retreat');
        if (rtSlot) rtSlot.classList.toggle('hidden', !!panel);
        if (!panel) {
          document.getElementById('hub-detail').classList.add('hidden');
          document.getElementById('hub-home').classList.remove('hidden');
          return;
        }
        document.getElementById('hub-home').classList.add('hidden');
        document.getElementById('hub-detail').classList.remove('hidden');
        box.querySelectorAll('.hub-panel').forEach(function (p) {
          p.classList.toggle('hidden', p.dataset.hp !== id);
        });
        document.getElementById('hub-detail-title').textContent = HUB_TITLES[id] || '';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      function hubFromHash() {
        var m = (location.hash || '').match(/^#hub-([a-z]+)$/);
        showHub(m ? m[1] : null);
      }
      /* 상회비 · 세례의무금 탭 전환 */
      var mdTabs = document.getElementById('md-tabs');
      if (mdTabs) mdTabs.querySelectorAll('button').forEach(function (b) {
        b.addEventListener('click', function () {
          mdTabs.querySelectorAll('button').forEach(function (x) { x.classList.remove('active'); });
          b.classList.add('active');
          document.getElementById('dash-mydues').classList.toggle('hidden', b.dataset.mdt !== 'dues');
          document.getElementById('dash-mybap').classList.toggle('hidden', b.dataset.mdt !== 'bap');
          var allSec = document.getElementById('dash-dues-sec');
          if (allSec) allSec.classList.toggle('hidden', b.dataset.mdt !== 'all');
        });
      });

      /* 서기에게 — 정기노회 4주 전부터 남은 임기 1년 미만 장로 총대와 공문 안내 */
      if (window.SHSElderNotice) SHSElderNotice.dashCard(document.getElementById('hub-elder'), user);
      /* 수양회 참가자(와 그 부서 임원)에게 — 2주 전부터 끝나는 날까지 (js/retreat-card.js) */
      if (window.SHSRetreat) SHSRetreat.dashCard(document.getElementById('hub-retreat'), user);

      /* 업무 보고서 카드: 오늘 보고서가 있으면 그 요약을 부제로 */
      (function () {
        var card = document.getElementById('hub-card-oreport');
        if (!card || !(window.SHSCloud && SHSCloud.enabled())) return;
        SHSCloud.init().then(function (c) {
          return c.from('ai_reports').select('headline,report_date').eq('user_id', user.id)
            .order('report_date', { ascending: false }).limit(1);
        }).then(function (r) {
          var x = r && !r.error && r.data && r.data[0];
          var d = new Date(), today = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
          var sub = card.querySelector('.hc-s');
          if (x && sub && x.report_date === today && x.headline) {
            sub.textContent = '오늘: ' + (x.headline.length > 34 ? x.headline.slice(0, 34) + '…' : x.headline);
            card.classList.add('hub-card-new');
          }
        }).catch(function () {});
      })();

      /* 내 사진: 명단 카드에 올린 사진을 대시보드에도 보여 준다 */
      (function () {
        var slot = document.getElementById('hub-photo');
        if (!slot || !user.id || !(window.SHSCloud && SHSCloud.enabled())) return;
        SHSCloud.init().then(function (c) {
          var path = user.photo_path
            ? Promise.resolve(user.photo_path)
            : c.from('profiles').select('photo_path').eq('id', user.id).single()
                .then(function (r) { return r.data && r.data.photo_path; });
          return Promise.resolve(path).then(function (pp) {
            if (!pp) return null;
            return c.storage.from('member-photos').createSignedUrl(pp, 600);
          });
        }).then(function (r) {
          var url = r && r.data && r.data.signedUrl;
          if (!url) return;
          slot.innerHTML = '<img src="' + url + '" alt="내 사진" style="width:400px;height:500px;max-width:100%;' +
            'object-fit:cover;border-radius:18px;' +
            'box-shadow:0 10px 24px rgba(0,0,0,0.22), 0 2px 6px rgba(0,0,0,0.15);' +
            'border:3px solid rgba(255,255,255,0.55)">';
          slot.classList.remove('hidden');
        }).catch(function () {});
      })();

      /* 노회장·서기·간사에게는 왼쪽에 이달 일정 달력을 보여 준다.
       * 날짜를 누르면 노회 일정관리(schedule.html)의 그날로 간다. */
      (function () {
        if (!SHSAuth.canManageMembers(user) || !user.cloud) return;
        var slot = document.getElementById('hub-cal');
        if (!slot) return;
        var calY = new Date().getFullYear(), calM = new Date().getMonth();
        var evrows = [];
        function pad2(n) { return String(n).padStart(2, '0'); }
        function rowDate(x) {
          if (x.event_date) return x.event_date;
          var m = String(x.date_label || '').match(/^(\d{1,2})\.(\d{1,2})$/);
          return m ? (new Date().getFullYear() + '-' + pad2(m[1]) + '-' + pad2(m[2])) : '';
        }
        function draw() {
          var first = new Date(calY, calM, 1);
          var start = first.getDay();
          var days = new Date(calY, calM + 1, 0).getDate();
          var nowD = new Date();
          var todayS = nowD.getFullYear() + '-' + pad2(nowD.getMonth() + 1) + '-' + pad2(nowD.getDate());
          var byDate = {};
          evrows.forEach(function (x) {
            var d = rowDate(x);
            if (!d) return;
            (byDate[d] = byDate[d] || []).push(x);
            /* 수양회처럼 여러 날 일정은 끝 날짜까지 점을 찍는다 */
            if (x.end_date && x.end_date > d) {
              var t = new Date(d + 'T00:00:00');
              for (var k = 0; k < 60; k++) {
                t.setDate(t.getDate() + 1);
                var ts = t.getFullYear() + '-' + pad2(t.getMonth() + 1) + '-' + pad2(t.getDate());
                if (ts > x.end_date) break;
                (byDate[ts] = byDate[ts] || []).push(x);
              }
            }
          });
          var h = '<div style="background:rgba(255,255,255,0.55);border-radius:14px;padding:14px 16px;' +
            'max-width:420px;box-shadow:0 4px 14px rgba(0,0,0,0.08)">' +
            '<div style="display:flex;align-items:center;margin-bottom:8px">' +
            '<button type="button" class="btn ghost sm" data-hc="p" style="padding:2px 9px">&#8249;</button>' +
            '<strong style="flex:1;text-align:center">' + calY + '년 ' + (calM + 1) + '월</strong>' +
            '<button type="button" class="btn ghost sm" data-hc="n" style="padding:2px 9px">&#8250;</button></div>' +
            '<table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:0.82rem;text-align:center">' +
            '<thead><tr>' + ['일','월','화','수','목','금','토'].map(function (w, i) {
              return '<th style="padding:3px 0;font-weight:600;' + (i === 0 ? 'color:#c0392b' : '') + '">' + w + '</th>';
            }).join('') + '</tr></thead><tbody><tr>';
          var cell = 0;
          for (var i = 0; i < start; i++) { h += '<td></td>'; cell++; }
          for (var d = 1; d <= days; d++) {
            var ds = calY + '-' + pad2(calM + 1) + '-' + pad2(d);
            var evs = byDate[ds] || [];
            h += '<td data-hd="' + ds + '" title="' + SHS.esc(evs.map(function (x) { return x.title; }).join('\n')) + '" ' +
              'style="padding:4px 0;cursor:pointer;border-radius:8px;' +
              (ds === todayS ? 'outline:2px solid var(--accent,#b08d3e);outline-offset:-2px;' : '') +
              (cell % 7 === 0 ? 'color:#c0392b;' : '') + '">' + d +
              (evs.length ? '<div style="line-height:0.5;font-size:1rem;color:#b03a2e">&#8226;</div>'
                          : '<div style="line-height:0.5;font-size:1rem;visibility:hidden">&#8226;</div>') +
              '</td>';
            cell++;
            if (cell % 7 === 0 && d < days) h += '</tr><tr>';
          }
          while (cell % 7 !== 0) { h += '<td></td>'; cell++; }
          h += '</tr></tbody></table>' +
            '<p style="margin:8px 0 0;text-align:right;font-size:0.82rem">' +
            '<a href="schedule.html" style="text-decoration:underline">노회 일정관리 &#8594;</a></p></div>';
          slot.innerHTML = h;
          slot.classList.remove('hidden');
          slot.querySelector('[data-hc="p"]').addEventListener('click', function () {
            calM--; if (calM < 0) { calM = 11; calY--; } draw();
          });
          slot.querySelector('[data-hc="n"]').addEventListener('click', function () {
            calM++; if (calM > 11) { calM = 0; calY++; } draw();
          });
          slot.querySelectorAll('td[data-hd]').forEach(function (td) {
            td.addEventListener('click', function () {
              location.href = 'schedule.html#d=' + td.dataset.hd;
            });
          });
        }
        SHSCloud.init().then(function (c) {
          return c.from('site_schedule').select('id,title,event_date,end_date,date_label,kind');
        }).then(function (r) {
          evrows = (r && r.data) || [];
          draw();
        }).catch(function () {});
      })();

      box.querySelectorAll('.hub-card').forEach(function (b) {
        b.addEventListener('click', function () {
          /* 노회 일정관리는 그 화면으로 바로 간다 */
          if (b.dataset.hub === 'schedmgr') { location.href = 'schedule.html'; return; }
          /* 서류 발급은 서류 신청 화면으로 바로 간다 */
          if (b.dataset.hub === 'doc') { location.href = 'request.html'; return; }
          /* 교회상황 보고서는 보고서 작성·열람 화면으로 바로 간다 */
          if (b.dataset.hub === 'report') { location.href = 'report.html'; return; }
          /* 임원 업무 보고서는 보고서 화면으로 바로 간다 */
          if (b.dataset.hub === 'oreport') { location.href = 'officer-report.html'; return; }
          /* 내 정보는 내 정보 화면으로 바로 간다 */
          if (b.dataset.hub === 'me') { location.href = 'mypage.html'; return; }
          /* 나의 청빙 임기는 내 정보의 청빙 칸으로 바로 간다 */
          if (b.dataset.hub === 'call') { location.href = 'mypage.html#call'; return; }
          /* 나의 시찰은 그 시찰 화면으로 바로 간다 */
          if (b.dataset.hub === 'sichal' && hubSicLink) { location.href = hubSicLink; return; }
          location.hash = 'hub-' + b.dataset.hub;
        });
      });
      document.getElementById('hub-back').addEventListener('click', function () {
        if (/^#hub-/.test(location.hash)) history.back();
        else showHub(null);
      });
      window.addEventListener('hashchange', hubFromHash);
      hubFromHash();
      loadAudit();
      loadRule29();
      loadCallTerm();
    }

    /* ---------- 나의 청빙 임기 ----------
     * 부목사(1년)·시무목사(3년) 본인에게 남은 청빙 임기를 카드로 보이고,
     * 넉 달 안으로 줄었거나 이미 끝났으면 맨 위에 안내를 띄운다.
     * 셈은 관리자 명단과 같은 SHS.callTerm (명단의 call_on·call_until) */
    function loadCallTerm() {
      var CALL_NOTICE_DAYS = 120;   /* 넉 달 */
      if (!user.cloud || isSuper || !SHS.callTerm) return;
      SHSCloud.init().then(function (c) { return c.rpc('my_member'); }).then(function (r) {
        var m = r && !r.error && r.data && r.data[0];
        if (!m) return;
        var t = SHS.callTerm({
          category: m.out_category, position: m.out_position,
          call_on: m.out_call_on, call_until: m.out_call_until
        });
        if (!t.kind) return;   /* 위임목사·장로 등 — 청빙 임기가 없다 */
        var card = document.getElementById('hub-card-call');
        if (card) {
          var sub = card.querySelector('.hc-s');
          if (!sub) {
            sub = document.createElement('span');
            sub.className = 'hc-s';
            card.querySelector('.hc-t > span').appendChild(sub);
          }
          sub.textContent = t.state === 'none' ? '기록 없음 · 노회 서기에게 문의' : t.left + ' (' + t.until + ' 만료)';
          card.classList.remove('hidden');
        }
        var near = t.state !== 'none' && t.days !== null && t.days <= CALL_NOTICE_DAYS;
        var badge = document.getElementById('hub-badge-call');
        if (badge && near) {
          badge.textContent = t.days < 0 ? '임기 끝남' : '곧 만료';
          badge.classList.remove('hidden');
        }
        var top = document.getElementById('hub-call');
        if (top && near) top.innerHTML = callNoticeHtml(t, m.out_call_acting);
      }).catch(function () {});
    }
    function callNoticeHtml(t, acting) {
      var assoc = t.kind === 'assoc';
      var over = t.days < 0;
      var color = over ? 'var(--red)' : '#b0731f';
      return '<div class="notice-banner" style="border-left:4px solid ' + color + ';margin:0 0 18px">' +
        '<strong style="color:' + color + '">' + esc(t.kindName) + ' 청빙 임기 ' +
        (over ? '— 임기가 끝났습니다' : '— 넉 달 안으로 끝납니다') + '</strong><br>' +
        esc(t.on) + ' 허락 · <strong>' + esc(t.until) + ' 만료</strong> · ' +
        '<strong style="color:' + color + '">' + esc(t.left) + '</strong>' +
        '<p style="margin:8px 0 0;font-size:0.9rem">' +
        (assoc
          ? '부목사는 시무 기간이 ' + SHS.ASSOC_YEARS + '년입니다. 정기노회에서 <strong>부목사 계속 청빙청원</strong>이 ' +
            '가결되어야 다시 ' + SHS.ASSOC_YEARS + '년을 시무합니다. 당회장과 함께 청원을 준비해 주세요.'
          : '시무목사는 ' + SHS.CALL_YEARS + '년마다 <strong>시무목사 청빙청원</strong>을 해야 합니다. ' +
            '다가오는 정기노회에 청원을 올려 주세요.' +
            (acting ? ' (임시당회장 ' + esc(acting) + ' 목사)' : '')) +
        '</p>' +
        '<p style="margin:8px 0 0;font-size:0.84rem;color:var(--gray-7)">' +
        '청원이 가결되어 노회 서기가 날짜를 고치면 이 안내가 사라집니다. 기록이 사실과 다르면 노회 서기에게 문의해 주세요. ' +
        '<a class="btn sm" href="petition.html" style="margin-left:6px">청빙청원서 작성</a>' +
        '<a class="btn ghost sm" href="mypage.html#call" style="margin-left:6px">내 정보에서 보기</a></p></div>';
    }

    /* ---------- 감사함 ----------
     * 감사 기간(관리자가 정한 시작일~종료일)에 감사부장·감사부 서기와
     * 노회 관리자에게만 <감사> 카드가 나타난다. 재정부·상비부·시찰 장부를
     * 한눈에 보고, 고른 장부를 이 자리에서 살펴 감사필 처리와 회기 마감 승인을
     * 한다. 증빙(영수증·지급 확인)도 장부 안에서 바로 본다. (79 sql) */
    var auditYear = fyYear(), auditRows = [], auditWin = null, auditOpen = null;
    var AUDIT_KIND = { presbytery: '노회 재정부', committee: '상비부', sichal: '시찰', ministers: '시찰 교역자회' };
    function auditLink(b) {
      if (b.owner_kind === 'presbytery') return 'officer.html#sec-%EC%9E%AC%EC%A0%95%EB%B6%80-%ED%9A%8C%EA%B3%84';
      if (b.owner_kind === 'committee') return 'committee.html?c=' + encodeURIComponent(b.owner) + '#lg';
      /* 시찰회 장부 / 교역자회 장부 — 시찰 화면의 회계 관리 탭을 바로 연다 (sichal.html 의 ?acc=) */
      return 'sichal.html?s=' + encodeURIComponent(b.owner) +
        (b.owner_kind === 'ministers' ? '&acc=ministers' : '&acc=ledger') + '#ledger';
    }
    function loadAudit() {
      var card = document.getElementById('hub-card-audit');
      var panel = document.getElementById('dash-audit');
      if (!card || !panel || !window.SHSAuditMark || !window.SHSLedger) return;
      Promise.all([
        SHSAuditMark.ready(),
        SHSCloud.init().then(function (c) { return c.rpc('is_audit_reviewer'); })
          .then(function (r) { return !!(r && r.data === true); }, function () { return false; })
      ]).then(function (rs) {
        auditWin = SHSAuditMark.windowNow();
        var reviewer = rs[1] || SHSAuth.canManageMembers(user);
        if (!(reviewer && auditWin.open)) return;
        card.classList.remove('hidden');
        return fetchAudit();
      }).catch(function () {});
    }
    function fetchAudit() {
      var panel = document.getElementById('dash-audit');
      if (!panel) return Promise.resolve();
      panel.innerHTML = LOADING;
      return SHSCloud.init().then(function (c) {
        return c.rpc('audit_ledger_overview', { p_year: auditYear });
      }).then(function (r) {
        if (r.error) {
          panel.innerHTML = '<p class="dash-none">감사 목록을 불러오지 못했습니다: ' + esc(r.error.message) + '</p>';
          return;
        }
        auditRows = r.data || [];
        drawAudit();
        /* 감사필에 찍힐 도장이 갖추어졌는지 — 없으면 내 정보로 안내 */
        return SHSCloud.init().then(function (c) { return c.rpc('audit_seal_status'); }).then(function (r2) {
          var st = (r2 && !r2.error && r2.data) || [];
          var missing = st.filter(function (x) { return !x.has_seal; });
          var slot = document.getElementById('dash-audit-seal');
          if (!slot || !missing.length) return;
          var mineMissing = missing.some(function (x) { return x.mine; });
          slot.innerHTML = '<div class="notice-banner" style="border-left:4px solid #d9a33b;margin-bottom:10px">' +
            '<strong>감사필 도장</strong> — ' + missing.map(function (x) { return x.key === '감사부장' ? '감사부장' : '감사부 서기'; }).join('·') +
            ' 도장이 아직 등록되지 않았습니다. 감사필을 찍으면 도장 자리가 비어 나옵니다.' +
            (mineMissing ? ' <a class="btn sm" href="mypage.html#ps-title" style="margin-left:8px">내 정보에서 도장 만들기·등록</a>' : '') +
            '</div>';
        }, function () {});
      });
    }
    function drawAudit() {
      var panel = document.getElementById('dash-audit');
      if (!panel) return;
      var w = auditWin || { open: false };
      function won(n) { return (Number(n) || 0).toLocaleString('ko-KR'); }
      var ys = {};
      [fyYear(), fyYear() - 1, auditYear].forEach(function (y) { ys[y] = 1; });
      var years = Object.keys(ys).map(Number).sort(function (a, b) { return b - a; });

      var sd = SHSAuditMark.shortDate;
      var h = '<div id="dash-audit-seal"></div>' +
        '<div class="notice-banner" style="border-left:4px solid var(--navy)">' +
        '<strong>' + esc(String(w.year || auditYear)) + '년 ' + esc(w.period || '') + ' 감사 기간</strong>' +
        ' <span style="font-size:0.84rem;color:var(--gray-6)">' + sd(w.from) + ' ~ ' + sd(w.until) +
        (w.daysLeft > 0 ? ' · ' + w.daysLeft + '일 남음' : ' · 오늘까지') +
        (w.note ? ' · ' + esc(w.note) : '') + '</span>' +
        ' — 아래에서 장부를 골라 살펴보고 <strong>감사필 처리</strong>와 <strong>회기 마감 승인</strong>을 하세요. ' +
        '영수증·지급 확인 같은 증빙도 장부 안에서 바로 봅니다.</div>';
      h += '<div class="inline-form" style="margin-bottom:8px;align-items:flex-end">' +
        '<div class="field" style="flex:0 0 240px"><label>회계 연도</label><select id="au-year">' +
        years.map(function (y) {
          return '<option value="' + y + '"' + (y === auditYear ? ' selected' : '') + '>' + y + ' 회계연도 (' + y + '.4 ~ ' + (y + 1) + '.3)</option>';
        }).join('') + '</select></div>' +
        '<button type="button" class="btn ghost sm" id="au-refresh">목록 새로 고침</button>' +
        '<a class="btn sm" href="audit-report.html?y=' + encodeURIComponent(String(w.year || auditYear)) +
        '&p=' + encodeURIComponent(w.period || '') + '" style="margin-left:auto">감사 결과 · 보고서</a></div>';

      var done = auditRows.filter(function (b) { return b.audited_yn; }).length;
      var waiting = auditRows.filter(function (b) { return b.close_requested_at && !b.closed_yn; }).length;
      h += '<p style="font-size:0.86rem;color:var(--gray-6);margin:0 0 8px">장부 ' + auditRows.length + '권 · 감사필 ' + done + '권' +
        (waiting ? ' · <strong style="color:#b0731f">마감 승인 대기 ' + waiting + '권</strong>' : '') + '</p>';

      h += '<div style="overflow-x:auto"><table class="tbl" style="font-size:0.86rem"><thead><tr>' +
        '<th style="width:90px">구분</th><th class="left">장부</th><th>이월금</th><th>수입</th><th>지출</th><th>남은 돈</th>' +
        '<th>항목·증빙</th><th style="width:80px">마감</th><th style="width:70px">감사</th><th style="width:90px"></th></tr></thead><tbody>';
      if (!auditRows.length) {
        h += '<tr><td colspan="10" style="text-align:center;color:var(--gray-5);padding:16px">' + auditYear + ' 회계연도 장부가 없습니다.</td></tr>';
      }
      auditRows.forEach(function (b) {
        var closeCell = b.closed_yn
          ? '<span class="role-badge" style="color:#2a7a2a;border-color:#2a7a2a">마감</span>'
          : (b.close_requested_at
              ? '<span class="role-badge" style="color:#b0731f;border-color:#b0731f">승인 요청</span>'
              : '<span style="color:var(--gray-5)">-</span>');
        var audCell = b.audited_yn
          ? '<span class="role-badge" style="color:#2a7a2a;border-color:#2a7a2a">감사필</span>'
          : '<span style="color:var(--gray-5)">전</span>';
        var open = String(auditOpen) === String(b.book_id);
        h += '<tr' + (open ? ' style="background:var(--gray-1,#f4efe7)"' : '') + '>' +
          '<td>' + AUDIT_KIND[b.owner_kind] + '</td>' +
          '<td class="left"><strong>' + esc(b.owner_kind === 'presbytery' ? '노회' : b.owner) + '</strong></td>' +
          '<td style="text-align:right">' + won(b.opening_balance) + '</td>' +
          '<td style="text-align:right;color:#2a7a2a">+' + won(b.income) + '</td>' +
          '<td style="text-align:right;color:#b03a3a">−' + won(b.expense) + '</td>' +
          '<td style="text-align:right"><strong>' + won(b.balance) + '</strong></td>' +
          '<td style="font-size:0.8rem">' + b.entries + '건' +
          (b.receipts ? ' · 영수증 ' + b.receipts : '') + (b.payouts ? ' · 수령 ' + b.payouts : '') + '</td>' +
          '<td>' + closeCell + '</td><td>' + audCell + '</td>' +
          '<td><button type="button" class="btn sm" data-auopen="' + b.book_id + '">' + (open ? '보는 중' : '감사하기') + '</button></td></tr>';
      });
      h += '</tbody></table></div>';
      h += '<div id="dash-audit-ledger" style="margin-top:18px"></div>';
      panel.innerHTML = h;

      document.getElementById('au-year').addEventListener('change', function () {
        auditYear = parseInt(this.value, 10); auditOpen = null; fetchAudit();
      });
      document.getElementById('au-refresh').addEventListener('click', function () { fetchAudit(); });
      panel.querySelectorAll('button[data-auopen]').forEach(function (b) {
        b.addEventListener('click', function () { openAuditLedger(b.dataset.auopen); });
      });
      if (auditOpen) openAuditLedger(auditOpen);
    }
    /* 고른 장부를 목록 아래에 펼친다 — 장부·감사 칸·마감 승인, 그리고 재정보고서 */
    function openAuditLedger(bookId) {
      var b = auditRows.filter(function (x) { return String(x.book_id) === String(bookId); })[0];
      var slot = document.getElementById('dash-audit-ledger');
      if (!b || !slot) return;
      var changed = String(auditOpen) !== String(bookId);
      auditOpen = bookId;
      var panel = document.getElementById('dash-audit');
      panel.querySelectorAll('button[data-auopen]').forEach(function (x) {
        var mine = String(x.dataset.auopen) === String(bookId);
        x.textContent = mine ? '보는 중' : '감사하기';
        var tr = x.closest('tr');
        if (tr) tr.style.background = mine ? 'var(--gray-1,#f4efe7)' : '';
      });
      var title = (b.owner_kind === 'presbytery' ? '노회 재정부' : AUDIT_KIND[b.owner_kind] + ' · ' + b.owner) +
        ' — ' + b.year + ' 회계연도';
      slot.innerHTML =
        '<div class="hub-detail-head" style="margin:0 0 10px;flex-wrap:wrap;gap:10px">' +
        '<h3 style="margin:0">' + esc(title) + '</h3>' +
        '<div class="tabs" id="au-tabs" style="margin:0;border-bottom:none">' +
        '<button type="button" class="active" data-aut="ledger">장부 · 감사</button>' +
        '<button type="button" data-aut="report">재정보고서</button></div>' +
        '<a class="btn ghost sm" href="' + auditLink(b) + '">그 화면으로 열기</a></div>' +
        '<div id="au-body"></div>';
      var body = document.getElementById('au-body');
      function show(t) {
        if (t === 'report') {
          SHSLedger.report(body, { kind: b.owner_kind, owner: b.owner, year: b.year });
        } else {
          SHSLedger.mount(body, {
            kind: b.owner_kind, owner: b.owner, user: user, year: b.year,
            canEdit: false, isAuditor: true
          });
        }
      }
      slot.querySelectorAll('#au-tabs button').forEach(function (t) {
        t.addEventListener('click', function () {
          slot.querySelectorAll('#au-tabs button').forEach(function (x) { x.classList.toggle('active', x === t); });
          show(t.dataset.aut);
        });
      });
      show('ledger');
      if (changed) slot.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /* 상회비: 정회원 모두에게 '나의 교회 납부 현황'을,
     * 관리자와 회계·부회계에게는 노회 전체 요약을 함께 보여 준다.
     * 내 교회는 노회 명단(roster)에서 온다 — my_dues 가 계정→명단→교회로 잇는다.
     * 상회비를 내지 않는 분(부목사·무임목사·원로·은퇴 등)에게는 불러오지 않는다 (아래 duesGate). */
    /* ---------- 노회규칙 제29조 (상회비 미납) ----------
     * 내 교회가 기한 지난 상회비 미납이면 대시보드 맨 위에 안내를 띄우고,
     * 나의 상회비 카드에 표식을 달고, 나의 상회비 상세에도 같은 안내를 둔다.
     * 서류 발급 중지(1항)는 교회 단위로 걸리므로 상회비를 내지 않는 분(부목사 등)에게도 안내는 보인다.
     * (supabase/135_dues_rule29.sql — 실행 전이면 조용히 건너뛴다) */
    var r29 = null;
    function paintR29() {
      var slot = document.getElementById('md-r29');
      if (!slot || !r29 || !SHS.dues29Html) return;
      slot.innerHTML = SHS.dues29Html(r29, { where: 'panel' });
    }
    function loadRule29() {
      if (!user.cloud || isSuper || !SHS.dues29Html) return;
      SHSCloud.init().then(function (c) { return c.rpc('my_dues_rule29'); }).then(function (r) {
        var st = r && !r.error && r.data;
        if (!st || !st.blocked) return;
        r29 = st;
        var top = document.getElementById('hub-dues29');
        if (top) top.innerHTML = SHS.dues29Html(st, { where: 'top' });
        var badge = document.getElementById('hub-badge-mydues');
        if (badge) { badge.textContent = '미납 ' + st.late_count + '개월'; badge.classList.remove('hidden'); }
        paintR29();
      }).catch(function () {});
    }

    function loadDues() {
      if (!user.cloud) return;
      var canDues = SHSAuth.canManageMembers(user) || user.role === 'officer';
      var duesLink = 'officer.html#sec-%EC%83%81%ED%9A%8C%EB%B9%84-%EA%B4%80%EB%A6%AC';
      /* 관리자·회계에게는 나의 시찰 옆에 전체 요약 칸을 연다.
       * 아닌 회원에게는 나의 시찰이 줄 전체를 쓴다. */
      var sicSec = document.getElementById('dash-sichal-sec');
      if (canDues) {
        /* 관리자·회계에게 '상회비 전체' 탭을 연다 (내용은 탭을 눌러야 보인다) */
        var duesTab = document.getElementById('md-tab-all');
        if (duesTab) duesTab.classList.remove('hidden');
        if (isSuper) {
          var duesSec = document.getElementById('dash-dues-sec');
          if (duesSec) duesSec.classList.remove('hidden');
        }
      } else if (sicSec) sicSec.classList.add('span2');
      var calYr = new Date().getFullYear();
      var yr = fyYear();          /* 상회비 회기 연도 (4월 시작) */
      var mo = new Date().getMonth() + 1;
      var fyEl = fyElapsed();     /* 회기에서 몇 달째인지 */

      /* ----- 나의 상회비 (명단의 내 교회 기준) ----- */
      SHSCloud.init().then(function (c) {
        return c.rpc('my_dues', { p_year: yr });
      }).then(function (r) {
        var el = document.getElementById('dash-mydues');
        if (!el) return;
        var rows = (r && r.data) || [];
        if (!rows.length) {
          el.innerHTML = '<p class="dash-none">우리 교회는 올해 상회비 설정에 없습니다. ' +
            '궁금하신 점은 노회 회계에게 문의해 주세요.</p>';
          return;
        }
        var info = rows[0];
        var paid = {};
        rows.forEach(function (x) { if (x.out_month) paid[x.out_month] = x; });
        var months = Object.keys(paid).length;
        var sum = 0;
        rows.forEach(function (x) { if (x.out_month) sum += Number(x.out_amount || 0); });
        /* 납부한 달은 동그라미 아래에 입금일(월.일)을 함께 보여 준다 */
        function payDay(pd) {
          var mt = String(pd.out_paid_on || '').match(/^\d{4}-(\d{2})-(\d{2})/);
          return mt ? (Number(mt[1]) + '.' + Number(mt[2])) : '';
        }
        var dots = '';
        FY_MONTHS.forEach(function (m) {
          var pd = paid[m];
          dots += '<span class="md-cell"><span class="md-dot' + (pd ? ' on' : '') + (m === mo ? ' cur' : '') + '"' +
            (pd ? ' title="' + m + '월 ' + Number(pd.out_amount || 0) + '만원 납부 (' + (pd.out_paid_on || '') + ')"'
                : ' title="' + m + '월 미납"') + '>' + m + '</span>' +
            '<span class="md-date">' + (pd ? payDay(pd) : '') + '</span></span>';
        });
        /* 회기(4월 시작)에서 이번 달까지 안 낸 달을 미납으로 본다 */
        var lateMonths = [];
        for (var li = 0; li < fyEl; li++) if (!paid[FY_MONTHS[li]]) lateMonths.push(FY_MONTHS[li]);
        var lateAmt = lateMonths.length * Number(info.out_monthly || 0);
        var lateHtml = lateMonths.length
          ? '<p class="mydues-late">' + lateMonths.join('·') + '월 미납 — <strong>' +
            lateAmt.toLocaleString('ko-KR') + '만원</strong></p>'
          : '<p class="mydues-ok">이번 달까지 미납이 없습니다.</p>';
        el.innerHTML =
          '<div class="mydues-head"><strong>' + SHS.esc(info.out_church) + '</strong>' +
          (info.out_pastor ? ' <span class="mydues-p">' + SHS.esc(info.out_pastor) + ' 목사</span>' : '') +
          ' · 월 ' + Number(info.out_monthly || 0) + '만원' +
          ' <span style="font-size:0.76rem;color:var(--gray-5)">회기 ' + yr + '년 4월 ~ ' + (yr + 1) + '년 3월</span>' +
          (info.out_closed ? ' <span class="dues-mini-closed">' + yr + '년 마감</span>' : '') + '</div>' +
          '<div class="mydues-dots">' + dots + '</div>' +
          lateHtml +
          '<div id="md-r29"></div>' +
          '<p class="mydues-sum">이번 회기 ' + months + '개월 납부 · ' + sum.toLocaleString('ko-KR') + '만원' +
          '<span class="mydues-note">납부 확인이 실제와 다르면 노회 회계에게 알려 주세요.</span></p>';
        paintR29();
      }).catch(function () {
        var el = document.getElementById('dash-mydues');
        if (el) el.innerHTML = '<p class="dash-none">상회비 현황을 불러오지 못했습니다.</p>';
      });

      /* ----- 나의 세례의무금 (해마다 한 번 총회에 내는 세례교인헌금) ----- */
      SHSCloud.init().then(function (c) {
        return Promise.all([
          c.from('bapdues').select('*').in('year', [calYr, calYr - 1])
            .then(function (x) { return x; }, function () { return { data: [] }; }),
          c.from('site_settings').select('*').in('key', ['bapdues_pay', 'bapdues_deadline'])
            .then(function (x) { return x; }, function () { return { data: [] }; })
        ]);
      }).then(function (rs) {
        var el = document.getElementById('dash-mybap');
        if (!el) return;
        var all = (rs[0] && rs[0].data) || [];
        var pay = {}, deadlines = {};
        ((rs[1] && rs[1].data) || []).forEach(function (x) {
          if (x.key === 'bapdues_pay' && x.value) pay = x.value;
          if (x.key === 'bapdues_deadline' && x.value) deadlines = x.value;
        });
        function key(s) { return String(s || '').replace(/\s|교회$/g, ''); }
        var myKey = key(user.church || '');
        if (!myKey || !all.length) {
          el.innerHTML = '<p class="dash-none">세례의무금 자료가 아직 없습니다.</p>';
          return;
        }
        var bapYr = all.some(function (b) { return b.year === calYr && key(b.church) === myKey; }) ? calYr : calYr - 1;
        var mine = all.filter(function (b) { return b.year === bapYr && key(b.church) === myKey; })[0];
        if (!mine) {
          el.innerHTML = '<p class="dash-none">우리 교회는 올해 세례의무금 배정에 없습니다. ' +
            '궁금하신 점은 노회 회계에게 문의해 주세요.</p>';
          return;
        }
        var target = Number(mine.target || 0), paidAmt = Number(mine.paid || 0);
        var done = target > 0 && paidAmt >= target;
        var part = paidAmt > 0 && !done;
        var state = done
          ? '<span class="mydues-ok" style="display:inline">납부 완료' +
            (mine.paid_on ? ' (' + SHS.esc(mine.paid_on) + ')' : '') + '</span>'
          : (part
            ? '<span style="color:#b0731f">일부 납부 — ' + paidAmt.toLocaleString('ko-KR') + '원 / 잔액 ' +
              Math.max(0, target - paidAmt).toLocaleString('ko-KR') + '원</span>'
            : '<span class="mydues-late" style="display:inline;margin:0">미납</span>');
        el.innerHTML =
          '<div class="mydues-head"><strong>' + SHS.esc(mine.church) + '</strong>' +
          ' · ' + bapYr + '년' + (bapYr !== calYr ? ' <span style="color:var(--gray-5)">(지난해 배정 기준)</span>' : '') +
          ' · 세례교인 ' + Number(mine.members || 0) + '명</div>' +
          '<p style="margin:4px 0">배정액 <strong>' + target.toLocaleString('ko-KR') + '원</strong> — ' + state + '</p>' +
          (function () {
            /* 시행기한과 남은 기간 (총회 공문) */
            var dl = deadlines[String(bapYr)];
            if (!dl) return '';
            var dld = new Date(dl + 'T00:00:00');
            var left = Math.round((dld - new Date().setHours(0, 0, 0, 0)) / 86400000);
            var dlTxt = dld.getFullYear() + '년 ' + (dld.getMonth() + 1) + '월 ' + dld.getDate() + '일';
            if (done) return '<p style="font-size:0.85rem;margin:4px 0;color:var(--gray-5)">시행기한 ' + dlTxt + '</p>';
            return '<p style="font-size:0.85rem;margin:4px 0">시행기한 <strong>' + dlTxt + '</strong> — ' +
              (left > 0 ? '<strong style="color:' + (left <= 14 ? '#b0731f' : 'var(--navy)') + '">' + left + '일 남음</strong>'
                : (left === 0 ? '<strong style="color:#a33">오늘까지</strong>'
                              : '<strong style="color:#a33">' + (-left) + '일 지남</strong>')) + '</p>';
          })() +
          (pay.account
            ? '<p style="font-size:0.85rem;margin:4px 0">납부 계좌: <strong>' +
              SHS.esc((pay.bank || '') + ' ' + pay.account + ' (' + (pay.holder || '') + ')') + '</strong></p>'
            : '') +
          '<p class="mydues-sum" style="margin-top:4px"><span class="mydues-note">해마다 한 번 총회에 내는 세례교인헌금입니다. ' +
          '납부 확인이 실제와 다르면 노회 회계에게 알려 주세요.</span></p>';
      }).catch(function () {
        var el = document.getElementById('dash-mybap');
        if (el) el.innerHTML = '<p class="dash-none">세례의무금 현황을 불러오지 못했습니다.</p>';
      });

      /* ----- 전체 요약 (관리자·회계) ----- */
      if (!canDues) return;
      SHSCloud.init().then(function (c) {
        return Promise.all([
          c.from('dues_rates').select('church,monthly_amount').eq('year', yr),
          c.from('dues_payments').select('church,month,amount').eq('year', yr),
          c.from('dues_closings').select('year').eq('year', yr)
        ]);
      }).then(function (rs) {
        var rates = rs[0].data || [], pays = rs[1].data || [];
        var closed = ((rs[2] || {}).data || []).length > 0;
        var el = document.getElementById('dash-dues-body');
        if (!rates.length) {
          el.innerHTML = '<p class="dash-none">' + yr + '년 상회비 설정이 아직 없습니다. ' +
            '<a href="' + duesLink + '" style="color:var(--navy);text-decoration:underline">관리 화면에서 설정</a></p>';
          return;
        }
        var monthly = 0, paid = 0, curCnt = 0, paidToDate = 0;
        var rateBy = {};
        rates.forEach(function (r2) { monthly += Number(r2.monthly_amount || 0); rateBy[r2.church] = Number(r2.monthly_amount || 0); });
        pays.forEach(function (p2) {
          var a = p2.amount != null ? Number(p2.amount) : (rateBy[p2.church] || 0);
          paid += a;
          /* 회기(4월 시작)에서 이번 달까지 낸 것만 센다 */
          var idx = FY_MONTHS.indexOf(Number(p2.month));
          if (idx > -1 && idx < fyEl) paidToDate += a;
          if (p2.month === mo) curCnt++;
        });
        var pct = monthly ? Math.round(paid / (monthly * 12) * 100) : 0;
        /* 회기에서 이번 달까지 부과된 금액과 실제 낸 금액의 차이 */
        var late = Math.max(0, monthly * fyEl - paidToDate);
        el.innerHTML =
          '<div class="dues-mini">' +
          '<span><strong>' + curCnt + '/' + rates.length + '</strong> ' + mo + '월 납부 교회</span>' +
          '<span><strong>' + paid.toLocaleString('ko-KR') + '만</strong> 올해 납부액</span>' +
          '<span><strong>' + pct + '%</strong> 연간 납부율</span>' +
          '<span class="' + (late ? 'dues-mini-late' : '') + '"><strong>' +
          late.toLocaleString('ko-KR') + '만</strong> ' + mo + '월까지 미납</span>' +
          (closed ? '<span class="dues-mini-closed">' + yr + '년 마감됨</span>' : '') +
          '</div>' +
          '<div class="dues-mini-bar"><div style="width:' + Math.min(100, pct) + '%"></div></div>';
      }).catch(function () {
        var el = document.getElementById('dash-dues-body');
        if (el) el.innerHTML = '<p class="dash-none">상회비 현황을 불러오지 못했습니다.</p>';
      });
    }

    duesGate.then(function (ok) {
      if (ok) {
        var mc = document.getElementById('hub-card-mydues');
        if (mc) mc.classList.remove('hidden');
        loadDues();
        return;
      }
      /* 상회비를 내지 않는 분 — 카드는 감춘 채 두고, 주소(#hub-mydues)로 바로 들어와도 안내만 보인다 */
      if (HUB_TITLES) {
        HUB_TITLES.sichal = '나의 시찰';
        var ht = document.getElementById('hub-detail-title');
        if (ht && location.hash === '#hub-sichal') ht.textContent = HUB_TITLES.sichal;
      }
      var mdTabs2 = document.getElementById('md-tabs');
      if (mdTabs2) mdTabs2.classList.add('hidden');
      ['dash-mybap', 'dash-dues-sec'].forEach(function (id) {
        var x = document.getElementById(id);
        if (x) { x.classList.add('hidden'); x.innerHTML = ''; }
      });
      var md = document.getElementById('dash-mydues');
      if (md) {
        md.classList.remove('hidden');
        md.innerHTML = '<p class="dash-none">' + esc(SHS.DUES_NOTICE || '상회비 내역은 볼 수 없습니다.') + '</p>';
      }
    });

    /* 상비부 부분은 상비부 대시보드를 그대로 쓰되, 내가 맡은 것만 보여 준다.
     * 다른 부서의 일정과 공지까지 여기서 볼 까닭은 없다. */
    if (window.SHSDash) {
      SHSDash.mount(document.getElementById('dash-com'), user, { onlyMine: !full });
    }

    SHSCloud.init().then(function (c) {
      function soft(p) { return p.then(function (x) { return x; }, function () { return { data: null }; }); }
      var year = new Date().getFullYear();
      return Promise.all([
        soft(c.from('notifications').select('*').order('created_at', { ascending: false }).limit(30)),
        soft(c.from('site_notices').select('*')
              .order('date', { ascending: false }).order('id', { ascending: false }).limit(6)),
        soft(c.from('site_schedule').select('*').order('sort')),
        soft(c.from('doc_requests').select('*').order('id', { ascending: false }).limit(50)),
        soft(c.from('doc_issues').select('id,doc_no,doc_type,issued_on,void_yn,request_id')
              .order('id', { ascending: false }).limit(50)),
        soft(c.from('church_reports')
              .select('year,sichal,church,updated_at,status,approved_at').eq('year', year)),
        soft(c.from('sichal_churches').select('sichal,name,pastor,url,address,phone')),
        soft(c.from('sichals').select('name,area,head,clerk,treasurer').order('sort')),
        soft(c.rpc('my_sichal_name')),
        soft(c.from('sichal_report_submissions').select('*').eq('year', year)),
        soft(c.from('church_staff').select('church').eq('role', '시무장로')),
        soft(c.from('delegates').select('*').eq('active', true).order('sort')),
        soft(c.from('board_members').select('*').eq('active', true).order('sort')),
        soft(c.from('assembly_news').select('*').order('id', { ascending: false }).limit(12)),
        soft(c.from('gallery_items').select('id,title,image_url,thumb_url')
              .eq('category', '총회 활동').order('id', { ascending: false }).limit(8))
      ]);
    }).then(function (rs) {
      /* 기간이 지난 안내는 빼고 보인다 (SHS.notiLive) */
      drawNoti(SHS.notiLive ? SHS.notiLive((rs[0] && rs[0].data) || []) : ((rs[0] && rs[0].data) || []));
      drawNotices((rs[1] && rs[1].data) || []);
      drawSchedule((rs[2] && rs[2].data) || []);
      drawDocs((rs[3] && rs[3].data) || [], (rs[4] && rs[4].data) || []);
      drawReports((rs[5] && rs[5].data) || [], (rs[9] && rs[9].data) || []);
      drawMine((rs[6] && rs[6].data) || [], (rs[7] && rs[7].data) || [],
               (rs[8] && rs[8].data) || '');
      drawDanghoi((rs[6] && rs[6].data) || [], (rs[10] && rs[10].data) || []);
      drawAssembly((rs[11] && rs[11].data) || [], (rs[12] && rs[12].data) || [],
                   (rs[13] && rs[13].data) || [], (rs[14] && rs[14].data) || []);
    }).catch(function () {});

    /* ---------- 나의 교회 · 나의 시찰 ----------
     * 내 교회와 내 시찰이 어디인지, 누가 임원인지 한자리에서 보여 준다.
     * 교회는 노회 명단이 아니라 관내 교회(sichal_churches)에서 찾는다. */
    function drawMine(churches, sichals, sicName) {
      var myChurch = user.church || '';
      var row = churches.filter(function (x) { return x.name === myChurch; })[0] || null;
      var sic = String(sicName || (row && row.sichal) || '');
      var link = 'sichal.html?s=' + encodeURIComponent(sic);
      if (sic) hubSicLink = link + '#church';

      /* 나의 교회 (최고관리자 화면에는 이 칸이 없다) */
      var el = document.getElementById('dash-church');
      if (!el) return;
      var h = '';
      if (!myChurch) {
        h = '<p class="dash-none">가입 정보에 소속 교회가 없습니다. ' +
            '<a href="mypage.html">내 정보</a>에서 등록해 주세요.</p>';
      } else {
        h = '<div class="dash-box">' +
          '<div class="dash-box-t">' + esc(myChurch) + '</div>' +
          '<div class="dash-box-s">' +
          (sic ? esc(sic) : '시찰 미지정') +
          (row && row.pastor ? ' · 담임 ' + esc(row.pastor) : '') + '</div>' +
          (row
            ? '<dl class="dash-kv">' +
              (row.address ? '<div><dt>주소</dt><dd>' + esc(row.address) + '</dd></div>' : '') +
              (row.phone ? '<div><dt>전화</dt><dd><a href="tel:' + esc(row.phone) + '">' +
                            esc(row.phone) + '</a></dd></div>' : '') +
              (row.url ? '<div><dt>홈페이지</dt><dd><a href="' + esc(row.url) +
                          '" target="_blank" rel="noopener">' + esc(row.url) + '</a></dd></div>' : '') +
              '</dl>' +
              (!row.address && !row.phone && !row.url
                ? '<p class="dash-none">주소·연락처·홈페이지가 아직 비어 있습니다.</p>' : '')
            : '<p class="dash-none">관내 교회 명단에 이 교회가 아직 없습니다. ' +
              '노회 사무실로 알려 주시기 바랍니다.</p>');
        h += '</div><div class="dash-more">' +
          (sic ? '<a href="' + link + '&ch=' + encodeURIComponent(myChurch) +
            '#church">교회 정보 보기·고치기</a>' : '') + '</div>';
      }
      el.innerHTML = h;

      /* 나의 시찰 */
      el = document.getElementById('dash-sichal');
      var s2 = sichals.filter(function (x) { return x.name === sic; })[0] || null;
      if (!sic) {
        el.innerHTML = '<p class="dash-none">속한 시찰을 알 수 없습니다. ' +
          '노회 사무실(031-486-9993)로 알려 주시기 바랍니다.</p>';
        return;
      }
      var cnt = churches.filter(function (x) { return x.sichal === sic; }).length;
      el.innerHTML = '<div class="dash-box">' +
        '<div class="dash-box-t">' + esc(sic) + '</div>' +
        (s2 && s2.area ? '<div class="dash-box-s">' + esc(s2.area) + '</div>' : '') +
        '<dl class="dash-kv">' +
        '<div><dt>시찰장</dt><dd>' + esc((s2 && s2.head) || '-') + '</dd></div>' +
        '<div><dt>서기</dt><dd>' + esc((s2 && s2.clerk) || '-') + '</dd></div>' +
        '<div><dt>회계</dt><dd>' + esc((s2 && s2.treasurer) || '-') + '</dd></div>' +
        '<div><dt>관내 교회</dt><dd>' + cnt + '곳</dd></div>' +
        '</dl>' +
        '<div id="dash-sicfin"><p class="dash-none">시찰별 납부 현황을 불러오는 중...</p></div>' +
        '</div>' +
        '<div class="dash-more"><a href="' + link + '#church">시찰 화면으로</a>' +
        ' · <a href="' + link + '#doc">자료실</a>' +
        ' · <a href="' + link + '#minutes">회의록</a></div>';
      /* 시찰별 납부 현황은 상회비 내역이다 — 볼 수 있는 분에게만 불러온다 */
      duesGate.then(function (ok) {
        if (ok) { loadSicFin(sic); return; }
        var fb = document.getElementById('dash-sicfin');
        if (fb) fb.innerHTML = '';
      });
    }

    /* ---------- 시찰별 납부 현황 (상회비 · 세례의무금) ----------
     * 서버 함수(49 sichal_finance)가 시찰별로 모아 준다.
     * 시찰 이름을 누르면 그 시찰의 교회별 상세가 열린다. */
    function loadSicFin(mySic) {
      var box = document.getElementById('dash-sicfin');
      if (!box) return;
      var yr = fyYear();          /* 상회비 회기 연도 (4월 시작) */
      var mo = fyElapsed();       /* 회기에서 몇 달째인지 */
      var ORDER = ['북부시찰', '상록시찰', '남부시찰', '기타'];

      function wonf(n) { return Number(n || 0).toLocaleString('ko-KR'); }
      function bar(pct, color, pos) {
        return '<div style="position:relative;background:var(--gray-2,#e8eaef);border-radius:3px;height:7px">' +
          '<div style="height:100%;width:' + Math.min(100, pct) + '%;background:' + color + ';border-radius:3px"></div>' +
          (pos != null && pos < 100
            ? '<div style="position:absolute;top:-2px;bottom:-2px;left:' + pos + '%;width:2px;margin-left:-1px;' +
              'background:var(--navy,#1f2a44)" title="이번 달까지 부과액"></div>'
            : '') + '</div>';
      }

      SHSCloud.init().then(function (c) {
        return c.rpc('sichal_finance', { p_year: yr });
      }).then(function (r) {
        var rows = (r && r.data) || [];
        if (r && r.error) throw r.error;
        if (!rows.length) { box.innerHTML = ''; return; }
        function ord(s) { var i = ORDER.indexOf(s); return i < 0 ? 99 : i; }
        rows.sort(function (a, b) {
          return ord(a.out_sichal) - ord(b.out_sichal) ||
            String(a.out_sichal).localeCompare(b.out_sichal, 'ko');
        });

        var h = '<div style="border-top:1px solid var(--gray-2,#e8eaef);margin-top:12px;padding-top:10px">' +
          '<div style="font-size:0.85rem;font-weight:700;color:var(--navy);margin-bottom:8px">' +
          yr + '년 납부 현황 <span style="font-weight:400;color:var(--gray-5);font-size:0.76rem">' +
          '시찰 이름을 누르면 교회별 상세가 열립니다</span></div>';

        /* 상회비 막대 = 연간 목표 대비 납부액, 세로 눈금 = 이번 달까지 부과액 (임원방 상회비 화면과 같은 기준).
         * out_dues_due·out_dues_paid_due·out_dues_full 은 72_sichal_finance_due 부터 온다. */
        var upto = FY_MONTHS[mo - 1] + '월까지';
        var hasDue = rows.every(function (x) { return x.out_dues_due != null; });
        function duesInfo(plan, paid, due, paidDue) {
          plan = Number(plan || 0); paid = Number(paid || 0);
          due = due != null ? Number(due) : plan / 12 * mo;
          var pct = plan ? Math.min(100, Math.round(paid / plan * 100)) : 0;
          var pctDue = (paidDue != null && due) ? Math.min(100, Math.round(Number(paidDue) / due * 100)) : null;
          var prepaid = paidDue != null ? paid - Number(paidDue) : 0;
          return {
            plan: plan, paid: paid, pct: pct,
            pos: plan ? Math.min(100, Math.round(due / plan * 1000) / 10) : 0,
            sub: upto + ' 부과 ' + wonf(due) + '만원' +
              (pctDue != null ? ' 중 ' + wonf(paidDue) + '만원 (' + pctDue + '%)' : '') +
              (prepaid > 0 ? ' · 선납 ' + wonf(prepaid) + '만원' : '')
          };
        }
        function duesBlock(plan, paid, due, paidDue, strong) {
          var di = duesInfo(plan, paid, due, paidDue);
          var pctHtml = strong ? '<strong>' + di.pct + '%</strong>' : di.pct + '%';
          return '<div style="flex:1 1 130px;min-width:120px">' +
            '<div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--gray-6)">' +
            '<span>상회비</span><span>' + pctHtml + ' <span style="color:var(--gray-5)">(' +
            wonf(di.paid) + '/' + wonf(di.plan) + '만원)</span></span></div>' +
            bar(di.pct, '#b03a3a', mo < 12 ? di.pos : null) +
            '<div style="font-size:0.7rem;font-weight:600;color:var(--red,#b03a3a);margin-top:2px">' +
            di.sub + '</div></div>';
        }

        /* 노회 전체 진행률 */
        var tDuesPlan = 0, tDuesPaid = 0, tDuesDue = 0, tDuesPaidDue = 0;
        var tBapTarget = 0, tBapPaid = 0, tBapJoin = 0, tBapN = 0;
        rows.forEach(function (x) {
          tDuesPlan += Number(x.out_dues_plan || 0); tDuesPaid += Number(x.out_dues_paid || 0);
          tDuesDue += Number(x.out_dues_due || 0); tDuesPaidDue += Number(x.out_dues_paid_due || 0);
          tBapTarget += Number(x.out_bap_target || 0); tBapPaid += Number(x.out_bap_paid || 0);
          tBapJoin += Number(x.out_bap_join || 0); tBapN += Number(x.out_bap_churches || 0);
        });
        var tBapPct = tBapTarget ? Math.round(tBapPaid / tBapTarget * 100) : 0;
        h += '<div style="margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--gray-2,#e8eaef)">' +
          '<span style="font-size:0.85rem;font-weight:700;color:var(--navy)">노회 전체</span>' +
          '<div style="display:flex;gap:10px;margin-top:4px;flex-wrap:wrap">' +
          duesBlock(tDuesPlan, tDuesPaid, hasDue ? tDuesDue : null, hasDue ? tDuesPaidDue : null, true) +
          '<div style="flex:1 1 130px;min-width:120px">' +
          '<div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--gray-6)">' +
          '<span>세례의무금</span><span><strong>' + tBapPct + '%</strong> <span style="color:var(--gray-5)">(' +
          tBapJoin + '/' + tBapN + '곳)</span></span></div>' + bar(tBapPct, '#d97b6c') + '</div>' +
          '</div></div>';
        /* 시찰별 막대는 내가 속한 시찰만 보여 준다 */
        rows.filter(function (x) { return x.out_sichal === mySic; }).forEach(function (x) {
          var bapPct = Number(x.out_bap_target || 0)
            ? Math.round(Number(x.out_bap_paid || 0) / Number(x.out_bap_target) * 100) : 0;
          var isMine = x.out_sichal === mySic;
          h += '<div style="margin-bottom:9px' + (isMine ? ';background:var(--gray-1,#f4f6fa);border-radius:6px;padding:6px 8px' : '') + '">' +
            '<a href="#" data-sicfin="' + esc(x.out_sichal) + '" ' +
            'style="font-size:0.85rem;font-weight:700;color:var(--navy);text-decoration:underline">' +
            esc(x.out_sichal) + '</a>' +
            (isMine ? ' <span style="font-size:0.72rem;color:var(--gold,#b9974e)">나의 시찰</span>' : '') +
            (hasDue && x.out_dues_full != null
              ? ' <span style="font-size:0.72rem;color:var(--gray-5)">완납 ' + x.out_dues_full + '/' + x.out_dues_churches + '곳</span>'
              : '') +
            '<div style="display:flex;gap:10px;margin-top:4px;flex-wrap:wrap">' +
            duesBlock(x.out_dues_plan, x.out_dues_paid, hasDue ? x.out_dues_due : null, hasDue ? x.out_dues_paid_due : null, false) +
            '<div style="flex:1 1 130px;min-width:120px">' +
            '<div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--gray-6)">' +
            '<span>세례의무금</span><span>' + bapPct + '% <span style="color:var(--gray-5)">(' +
            x.out_bap_join + '/' + x.out_bap_churches + '곳)</span></span></div>' + bar(bapPct, '#d97b6c') + '</div>' +
            '</div>' +
            '<div class="hidden" data-sicdetail="' + esc(x.out_sichal) + '" style="margin-top:6px"></div>' +
            '</div>';
        });
        h += '<p style="font-size:0.7rem;color:var(--gray-5);margin:2px 0 0">상회비는 연간 목표액 대비 납부액이며 ' +
          '세로 눈금이 ' + upto + ' 부과액입니다. 세례의무금은 올해 목표금액 대비 납부율입니다.</p></div>';
        box.innerHTML = h;

        box.querySelectorAll('a[data-sicfin]').forEach(function (a) {
          a.addEventListener('click', function (ev) {
            ev.preventDefault();
            var name = a.dataset.sicfin;
            var det = box.querySelector('[data-sicdetail="' + name + '"]');
            if (!det) return;
            if (!det.classList.contains('hidden')) { det.classList.add('hidden'); return; }
            det.classList.remove('hidden');
            if (det.dataset.loaded) return;
            det.innerHTML = '<p class="dash-none">불러오는 중...</p>';
            SHSCloud.init().then(function (c) {
              return c.rpc('sichal_finance_detail', { p_year: yr, p_sichal: name });
            }).then(function (r2) {
              det.dataset.loaded = '1';
              var list = (r2 && r2.data) || [];
              if (!list.length) { det.innerHTML = '<p class="dash-none">자료가 없습니다.</p>'; return; }
              var t = '<div style="overflow-x:auto"><table class="tbl" style="font-size:0.78rem">' +
                '<thead><tr><th class="left">교회</th><th>상회비<br>(납부/회기 경과)</th>' +
                '<th>세례의무금<br>(납입/목표)</th><th>상태</th></tr></thead><tbody>';
              list.forEach(function (d) {
                var bapDone = Number(d.out_bap_target) > 0 && Number(d.out_bap_paid) >= Number(d.out_bap_target);
                var bapPart = Number(d.out_bap_paid) > 0 && !bapDone;
                var mDue = d.out_months_due != null ? Number(d.out_months_due) : Math.min(Number(d.out_months || 0), mo);
                var pre = Number(d.out_months || 0) - mDue;   /* 다음 달 이후분 선납 개월 */
                var late = Math.max(0, mo - mDue);
                t += '<tr><td class="left">' + esc(d.out_church) + '</td>' +
                  '<td>' + mDue + '/' + mo + '개월' + (pre > 0 ? ' (+선납 ' + pre + ')' : '') +
                  (Number(d.out_monthly) ? ' · ' + wonf(d.out_dues_paid) + '만원' : '') + '</td>' +
                  '<td>' + wonf(d.out_bap_paid) + ' / ' + wonf(d.out_bap_target) + '원</td>' +
                  '<td>' +
                  (late > 0 ? '<span style="color:#b0731f">상회비 ' + late + '개월 미납</span>'
                            : '<span style="color:#2a7a2a">상회비 완납</span>') + '<br>' +
                  (bapDone ? '<span style="color:#2a7a2a">세례의무금 완납</span>'
                    : (bapPart ? '<span style="color:#b0731f">세례의무금 일부</span>'
                               : '<span style="color:var(--gray-5)">세례의무금 미납</span>')) +
                  '</td></tr>';
              });
              t += '</tbody></table></div>';
              det.innerHTML = t;
            }).catch(function () {
              det.innerHTML = '<p class="dash-none">상세를 불러오지 못했습니다.</p>';
            });
          });
        });
      }).catch(function () {
        box.innerHTML = '';
      });
    }

    /* ---------- 나의 알림 ---------- */
    function drawNoti(rows) {
      var el = document.getElementById('dash-noti');
      var unread = rows.filter(function (n) { return !n.read_at; });
      /* 허브 카드의 안 읽은 알림 수 배지 */
      var badge = document.getElementById('hub-badge-noti');
      if (badge) {
        badge.textContent = unread.length;
        badge.classList.toggle('hidden', !unread.length);
      }
      var h = '<div class="noti-card' + (unread.length ? ' has' : '') + '">' +
        '<div class="noti-card-head"><span class="n-label">나의 알림</span>' +
        (unread.length
          ? '<span class="n-count">' + unread.length + '</span>' +
            '<span class="n-sub">확인하지 않은 알림이 ' + unread.length + '건 있습니다</span>'
          : '<span class="n-sub">확인하지 않은 알림이 없습니다</span>') +
        '<a class="more" href="notifications.html">알림함</a></div>';
      if (unread.length) {
        h += '<ul class="noti-card-list">' + unread.slice(0, 5).map(function (n) {
          return '<li><a href="notifications.html">' +
            (n.kind ? '<span class="n-kind">' + esc(n.kind) + '</span>' : '') +
            '<span class="n-t">' + esc(n.title) + '</span>' +
            '<span class="n-d">' + esc(String(n.created_at).slice(0, 10)) + '</span></a></li>';
        }).join('') + '</ul>' +
          (unread.length > 5
            ? '<div class="noti-card-more"><a href="notifications.html">' +
              (unread.length - 5) + '건 더 보기</a></div>' : '');
      }
      el.innerHTML = h + '</div>';
    }

    /* ---------- 노회 공지 ---------- */
    function drawNotices(rows) {
      var el = document.getElementById('dash-notice');
      if (!rows.length) rows = (SHSData.notices || []).slice(0, 6);
      if (!rows.length) { el.innerHTML = '<p class="dash-none">등록된 공지가 없습니다.</p>'; return; }
      el.innerHTML = '<ul class="notice-list">' + rows.slice(0, 6).map(function (n) {
        return '<li><span class="cat">' + esc(n.cat) + '</span>' +
          '<a href="board.html#notice">' + SHS.newTag(n.date) + esc(n.title) + '</a>' +
          '<span class="date">' + esc(n.date) + '</span></li>';
      }).join('') + '</ul>' +
        '<div class="dash-more"><a href="board.html">공지사항 더보기</a></div>';
    }

    /* ---------- 노회 일정 ---------- */
    /* 모든 회원에게 달력 + 목록을 함께 보여 준다. 달력은 읽기 전용이며,
     * 관리자(노회장·서기·간사)가 날짜를 누르면 일정관리로 간다. */
    function drawSchedule(rows) {
      var el = document.getElementById('dash-sched');
      var list = rows.length
        ? rows.map(function (s) { return { date: s.date_label, title: s.title }; })
        : (SHSData.schedule || []);
      var calY = new Date().getFullYear(), calM = new Date().getMonth();
      var canEdit = SHSAuth.canManageMembers(user);

      function pad2(n) { return String(n).padStart(2, '0'); }
      function rowDate(x) {
        if (x.event_date) return x.event_date;
        var m = String(x.date_label || '').match(/^(\d{1,2})\.(\d{1,2})$/);
        return m ? (new Date().getFullYear() + '-' + pad2(m[1]) + '-' + pad2(m[2])) : '';
      }

      var KIND_BG = { '정기노회': '#b03a2e', '임직식': '#8e44ad', '총회': '#1f618d',
        '임원회의': '#7d6608', '상비부 일정': '#1e8449', '수양회': '#148f77' };

      function calHtml() {
        var first = new Date(calY, calM, 1);
        var start = first.getDay();
        var days = new Date(calY, calM + 1, 0).getDate();
        var nowD = new Date();
        var todayS = nowD.getFullYear() + '-' + pad2(nowD.getMonth() + 1) + '-' + pad2(nowD.getDate());
        /* 여러 날 일정은 시작~끝 모든 날에 넣되, 이어지는 칸은 띠로 연결한다 */
        var byDate = {};
        rows.forEach(function (x) {
          var d = rowDate(x);
          if (!d) return;
          if (!(x.end_date && x.end_date > d)) {
            (byDate[d] = byDate[d] || []).push({ ev: x, pos: '' });
            return;
          }
          (byDate[d] = byDate[d] || []).push({ ev: x, pos: 's' });
          var t = new Date(d + 'T00:00:00');
          for (var k = 0; k < 60; k++) {
            t.setDate(t.getDate() + 1);
            var ts = t.getFullYear() + '-' + pad2(t.getMonth() + 1) + '-' + pad2(t.getDate());
            if (ts > x.end_date) break;
            (byDate[ts] = byDate[ts] || []).push({ ev: x, pos: ts === x.end_date ? 'e' : 'm' });
          }
        });
        var h = '<div style="background:#fff;border:1px solid var(--gray-2,#e8e5df);border-radius:12px;' +
          'padding:14px 16px;margin-bottom:16px;overflow-x:auto">' +
          '<div style="display:flex;align-items:center;margin-bottom:8px">' +
          '<button type="button" class="btn ghost sm" data-dc="p" style="padding:2px 10px">&#8249;</button>' +
          '<strong style="flex:1;text-align:center">' + calY + '년 ' + (calM + 1) + '월</strong>' +
          '<button type="button" class="btn ghost sm" data-dc="n" style="padding:2px 10px">&#8250;</button></div>' +
          '<table style="width:100%;min-width:560px;border-collapse:collapse;table-layout:fixed;font-size:0.82rem">' +
          '<thead><tr>' + ['일', '월', '화', '수', '목', '금', '토'].map(function (w, i) {
            return '<th style="padding:4px 0;font-weight:600;text-align:center;' +
              (i === 0 ? 'color:#c0392b' : '') + '">' + w + '</th>';
          }).join('') + '</tr></thead><tbody><tr>';
        var cell = 0;
        for (var i = 0; i < start; i++) { h += '<td style="border:1px solid var(--gray-1,#f2efe9)"></td>'; cell++; }
        for (var d = 1; d <= days; d++) {
          var ds = calY + '-' + pad2(calM + 1) + '-' + pad2(d);
          var evs = byDate[ds] || [];
          h += '<td data-dd="' + ds + '" ' +
            'style="height:64px;vertical-align:top;padding:3px 4px;border:1px solid var(--gray-1,#f2efe9);' +
            (evs.length || canEdit ? 'cursor:pointer;' : '') +
            (ds === todayS ? 'outline:2px solid var(--accent,#b08d3e);outline-offset:-2px;' : '') + '">' +
            '<div style="font-weight:600;font-size:0.78rem;' + (cell % 7 === 0 ? 'color:#c0392b' : '') + '">' + d + '</div>' +
            evs.map(function (it) {
              var x = it.ev;
              /* 이어지는 날은 제목을 되풀이하지 않되, 주 첫 칸에는 다시 보여 준다 */
              var showTitle = !it.pos || it.pos === 's' || cell % 7 === 0;
              var edge =
                (it.pos === 's' || it.pos === 'm' ? 'margin-right:-6px;border-top-right-radius:0;border-bottom-right-radius:0;' : '') +
                (it.pos === 'm' || it.pos === 'e' ? 'margin-left:-6px;border-top-left-radius:0;border-bottom-left-radius:0;' : '');
              return '<span title="' + esc(x.title) + '" style="display:block;margin-top:3px;padding:2px 5px;' +
                'border-radius:4px;font-size:0.7rem;line-height:1.35;color:#fff;white-space:nowrap;' +
                'overflow:hidden;text-overflow:ellipsis;background:' +
                (KIND_BG[x.kind] || 'var(--navy,#4b3f33)') + ';' + edge + '">' +
                (showTitle ? esc(x.title) : '&nbsp;') + '</span>';
            }).join('') + '</td>';
          cell++;
          if (cell % 7 === 0 && d < days) h += '</tr><tr>';
        }
        while (cell % 7 !== 0) { h += '<td style="border:1px solid var(--gray-1,#f2efe9)"></td>'; cell++; }
        h += '</tr></tbody></table>' +
          '<p style="margin:6px 0 0;font-size:0.78rem;color:var(--gray-5)">' +
          '일정을 누르면 자세한 내용을 볼 수 있습니다.' +
          (canEdit ? ' <a href="schedule.html" style="text-decoration:underline">일정관리 &#8594;</a>' : '') +
          '</p></div>';
        return h;
      }

      /* ----- 일정 상세 팝업: 누르면 깔끔하게 정리된 세부 내용을 보여 준다 ----- */
      function timeK(t) {
        if (!t) return '';
        var hh = Number(t.split(':')[0]), mm = t.split(':')[1];
        return (hh < 12 ? '오전 ' : '오후 ') + ((hh % 12) || 12) + '시' +
          (mm !== '00' ? ' ' + Number(mm) + '분' : '');
      }
      function fmtD(s) {
        if (!s) return '';
        var p = s.split('-');
        return Number(p[0]) + '년 ' + Number(p[1]) + '월 ' + Number(p[2]) + '일';
      }
      function openDetail(evs) {
        var old = document.getElementById('sch-modal');
        if (old) old.remove();
        var ov = document.createElement('div');
        ov.id = 'sch-modal';
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:1000;' +
          'display:flex;align-items:flex-start;justify-content:center;padding:50px 16px;overflow:auto';
        var KIND_C = { '정기노회': '#b03a2e', '임직식': '#8e44ad', '총회': '#1f618d',
          '임원회의': '#7d6608', '상비부 일정': '#1e8449', '수양회': '#148f77' };
        var inner = evs.map(function (x) {
          var m = x.meta || {};
          function row(t, v, pre) {
            if (!v) return '';
            return '<div style="display:flex;gap:12px;padding:7px 0;border-bottom:1px solid var(--gray-1,#f2efe9)">' +
              '<span style="flex:0 0 84px;color:var(--gray-5);font-size:0.84rem">' + t + '</span>' +
              '<span style="flex:1;font-size:0.92rem;' + (pre ? 'white-space:pre-line;line-height:1.7' : '') + '">' +
              esc(v) + '</span></div>';
          }
          var when = fmtD(rowDate(x)) + (x.end_date ? ' ~ ' + fmtD(x.end_date) : '') +
            (m.time ? ' · ' + timeK(m.time) : '');
          return '<div style="padding:4px 0 14px">' +
            '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">' +
            (x.kind ? '<span style="flex:none;font-size:0.76rem;color:#fff;padding:3px 11px;border-radius:12px;' +
              'background:' + (KIND_C[x.kind] || 'var(--navy,#4b3f33)') + '">' + esc(x.kind) + '</span>' : '') +
            '<strong style="font-size:1.05rem;line-height:1.5">' + esc(m.rname || x.title) + '</strong></div>' +
            row('일시', when) +
            row('장소', m.loc || m.place) +
            (m.person ? row('대상자', m.person + (m.church ? ' (' + m.church + ')' : '') +
              (m.sub ? ' · ' + m.sub : '')) : '') +
            row('대상', m.target) +
            row('회비', m.fee) +
            row('주관부서', m.dept) +
            row('담당자', m.contact) +
            row('안내', m.info, true) +
            (m.note ? row('비고', m.note) : '') +
            '</div>';
        }).join('<hr style="border:none;border-top:1px solid var(--gray-2,#e8e5df);margin:4px 0 14px">');
        ov.innerHTML =
          '<div style="background:#fff;border-radius:14px;max-width:520px;width:100%;padding:24px 26px;' +
          'box-shadow:0 14px 40px rgba(0,0,0,0.25);position:relative">' +
          '<button aria-label="닫기" id="sch-modal-x" style="position:absolute;top:10px;right:14px;border:none;' +
          'background:none;font-size:1.5rem;color:var(--gray-5);cursor:pointer">&times;</button>' +
          inner +
          (canEdit ? '<p style="margin:6px 0 0;text-align:right"><a class="btn ghost sm" href="schedule.html#d=' +
            rowDate(evs[0]) + '">일정관리에서 수정</a></p>' : '') +
          '</div>';
        document.body.appendChild(ov);
        ov.addEventListener('click', function (ev) { if (ev.target === ov) ov.remove(); });
        ov.querySelector('#sch-modal-x').addEventListener('click', function () { ov.remove(); });
      }
      function dayEvents(ds) {
        return rows.filter(function (x) {
          var d = rowDate(x);
          return d === ds || (d && x.end_date && d <= ds && ds <= x.end_date);
        });
      }

      function render() {
        el.innerHTML = calHtml() +
          (rows.length
            ? '<div class="side-box"><div class="box-body">' +
              rows.map(function (x, i) {
                return '<div class="schedule-item" data-si="' + i + '" style="cursor:pointer">' +
                  '<span class="d">' + esc(x.date_label) + '</span>' +
                  '<span class="t">' + esc(x.title) + '</span></div>';
              }).join('') + '</div></div>' +
              '<p style="font-size:0.8rem;color:var(--gray-5);margin-top:8px">일정을 누르면 자세한 내용을 볼 수 있습니다.</p>'
            : (list.length
              ? '<div class="side-box"><div class="box-body">' +
                list.map(function (s) {
                  return '<div class="schedule-item"><span class="d">' + esc(s.date) + '</span>' +
                    '<span class="t">' + esc(s.title) + '</span></div>';
                }).join('') + '</div></div>'
              : '<p class="dash-none">잡힌 일정이 없습니다.</p>'));
        el.querySelector('[data-dc="p"]').addEventListener('click', function () {
          calM--; if (calM < 0) { calM = 11; calY--; } render();
        });
        el.querySelector('[data-dc="n"]').addEventListener('click', function () {
          calM++; if (calM > 11) { calM = 0; calY++; } render();
        });
        el.querySelectorAll('.schedule-item[data-si]').forEach(function (it) {
          it.addEventListener('click', function () {
            openDetail([rows[Number(it.dataset.si)]]);
          });
        });
        el.querySelectorAll('td[data-dd]').forEach(function (td) {
          td.addEventListener('click', function () {
            var evs = dayEvents(td.dataset.dd);
            if (evs.length) openDetail(evs);
          });
        });
      }
      render();
    }

    /* ---------- 신청서류 발급 현황 ---------- */
    function drawDocs(reqs, issues) {
      var el = document.getElementById('dash-doc');
      var admin = SHSAuth.canManageMembers(user);
      var mine = reqs.filter(function (r) { return r.user_id === user.id; });
      var waiting = reqs.filter(function (r) { return r.status === '신청'; });
      var myIssues = issues.filter(function (x) { return !x.void_yn; });

      var h = '';

      if (admin && waiting.length) {
        h += '<div class="dash-alert"><strong>처리할 서류 신청 ' + waiting.length + '건</strong>' +
          ' <a href="documents.html#requests">지금 처리하기</a></div>';
      }

      /* 내가 낸 신청 */
      if (mine.length) {
        h += '<table class="tbl dash-tbl"><thead><tr><th style="width:104px">신청일</th>' +
          '<th>서류</th><th style="width:92px">상태</th></tr></thead><tbody>' +
          mine.slice(0, 4).map(function (r) {
            return '<tr><td>' + esc(String(r.created_at).slice(0, 10)) + '</td>' +
              '<td class="left">' + esc(r.doc_type) + '</td>' +
              '<td><span class="role-badge">' + esc(r.status) + '</span></td></tr>';
          }).join('') + '</tbody></table>';
      } else {
        h += '<p class="dash-none">신청하신 서류가 없습니다.</p>';
      }

      h += '<div class="dash-more">' +
        '<a href="request.html">서류 신청하기</a>' +
        (myIssues.length ? ' · <a href="request.html">발급된 증명서 ' + myIssues.length + '건</a>' : '') +
        (admin ? ' · <a href="documents.html">발급 대장</a>' : '') +
        '</div>';
      el.innerHTML = h;
    }

    /* ---------- 당회가 있는 교회 수 (관리자) ----------
     * 당회가 있는 교회 = 시무장로가 있는 조직교회 (담임은 위임목사로 표기).
     * 교회 관리에서 시무장로를 넣고 빼면 이 수가 함께 바뀐다. */
    function drawDanghoi(churches, elders) {
      if (!SHSAuth.canManageMembers(user)) return;
      var el = document.getElementById('dash-report');
      if (!el) return;
      var set = {};
      (elders || []).forEach(function (x) {
        set[String(x.church || '').replace(/\s|교회$/g, '')] = 1;
      });
      var organized = Object.keys(set).length;
      var total = (churches || []).length;
      el.insertAdjacentHTML('afterbegin',
        '<p class="dash-sub" style="margin-top:0">당회가 있는 교회(조직교회) <strong>' +
        organized + '곳</strong>' + (total ? ' / 관내 교회 ' + total + '곳' : '') +
        ' <span class="dash-dim">— 교회 관리의 시무장로 기준</span></p>');
    }

    /* ---------- 총회 활동 현황 ----------
     * 이 노회가 총회에 보낸 총대·파송 이사와 함께,
     * 관리자가 등록한 총회 기사(스크랩)와 활동 사진을 보여 준다.
     * 기사는 주소만 넣으면 제목·사진·요약을 저절로 채운다. (Edge Function og-meta)
     * 활동 사진은 메인 갤러리의 '총회 활동' 갈래에 올라가 자동으로 연동된다. */
    function drawAssembly(dels, boards, news, photos) {
      var el = document.getElementById('dash-assembly');
      if (!el) return;
      var admin = SHSAuth.canManageMembers(user);
      var today = new Date().toISOString().slice(0, 10);

      function group(rows, kinds, keyOf) {
        var by = {};
        rows.forEach(function (x) { (by[keyOf(x)] = by[keyOf(x)] || []).push(x); });
        return kinds.filter(function (k) { return by[k] && by[k].length; }).map(function (k) {
          return '<div style="display:flex;gap:12px;padding:7px 0;border-bottom:1px solid var(--gray-1,#f2efe9)">' +
            '<span style="flex:0 0 110px;color:var(--gray-5);font-size:0.84rem">' + esc(k) + '</span>' +
            '<span style="flex:1;font-size:0.92rem">' + by[k].map(function (x) {
              return esc(x.name) + (x.title ? ' <span style="color:var(--gray-5);font-size:0.8rem">(' +
                esc(x.title) + ')</span>' : '');
            }).join(', ') + '</span></div>';
        }).join('');
      }
      var h = '';
      var delHtml = group(dels, ['목사 정총대', '목사 부총대', '장로 정총대', '장로 부총대'],
        function (x) { return x.kind; });
      h += '<h3 class="mn-sub" style="margin:0 0 8px">총회 총대</h3>' +
        (delHtml || '<p class="dash-none">등록된 총회 총대가 없습니다.</p>');
      var bdKinds = [];
      boards.forEach(function (x) { if (bdKinds.indexOf(x.kind) === -1) bdKinds.push(x.kind); });
      var bdHtml = group(boards, bdKinds, function (x) { return x.kind; });
      h += '<h3 class="mn-sub" style="margin:18px 0 8px">총회 파송 이사 · 위원</h3>' +
        (bdHtml || '<p class="dash-none">등록된 파송 이사가 없습니다.</p>');

      /* 총회 소식 · 기사 */
      h += '<h3 class="mn-sub" style="margin:20px 0 8px">총회 소식 · 기사</h3>' +
        '<div id="asm-news"></div>';
      if (admin) {
        h += '<div class="admin-card" style="margin-top:12px">' +
          '<h4 class="mn-sub" style="margin-top:0">기사 등록 ' +
          '<span style="font-weight:400;font-size:0.8rem;color:var(--gray-5)">(관리자)</span></h4>' +
          '<div class="inline-form">' +
          '<div class="field" style="flex:1 1 300px"><label>기사 주소 (URL)</label>' +
          '<input type="text" id="asm-url" placeholder="https:// 기사 주소를 붙여 넣으세요"></div>' +
          '<button type="button" class="btn" id="asm-fetch" style="align-self:flex-end">가져오기</button>' +
          '</div>' +
          '<p style="font-size:0.78rem;color:var(--gray-5);margin:2px 0 0">' +
          '주소를 넣고 가져오기를 누르면 제목·사진·요약이 저절로 채워집니다.</p>' +
          '<div id="asm-preview" class="hidden" ' +
          'style="margin-top:12px;border-top:1px solid var(--gray-2,#e8e5df);padding-top:12px">' +
          '<div class="field"><label>제목</label><input type="text" id="asm-title"></div>' +
          '<div class="field"><label>요약 (선택)</label><input type="text" id="asm-desc"></div>' +
          '<div class="field"><label>사진 주소 (선택)</label><input type="text" id="asm-img"></div>' +
          '<div class="field"><label>또는 사진 파일 올리기 (선택)</label>' +
          '<input type="file" id="asm-imgfile" accept="image/*"></div>' +
          '<img id="asm-imgprev" class="hidden" alt="" ' +
          'style="max-width:220px;border-radius:10px;margin:4px 0 10px;box-shadow:0 3px 10px rgba(0,0,0,0.14)">' +
          '<div><button type="button" class="btn" id="asm-add">기사 추가</button></div></div>' +
          '<div class="form-msg" id="asm-msg"></div></div>';
      }

      /* 활동 사진 — 메인 갤러리 '총회 활동' 갈래와 연동 */
      h += '<h3 class="mn-sub" style="margin:20px 0 8px">활동 사진</h3>' +
        '<div id="asm-photos"></div>';
      if (admin) {
        h += '<div class="admin-card" style="margin-top:12px">' +
          '<h4 class="mn-sub" style="margin-top:0">활동 사진 올리기 ' +
          '<span style="font-weight:400;font-size:0.8rem;color:var(--gray-5)">(관리자)</span></h4>' +
          '<div class="field"><input type="file" id="asm-photo" accept="image/*" multiple></div>' +
          '<p style="font-size:0.78rem;color:var(--gray-5);margin:2px 0 0">올린 사진은 노회 메인 갤러리의 ' +
          '<strong>총회 활동</strong> 앨범에도 함께 실립니다.</p>' +
          '<div class="form-msg" id="asm-pmsg"></div></div>';
      }

      h += '<div class="dash-more" style="margin-top:14px">' +
        '<a href="organization.html#delegates-body">총대 명단</a>' +
        ' · <a href="gallery.html">메인 갤러리</a>' +
        ' · <a href="assembly-constitution.html">총회 헌법</a>' +
        ' · <a href="assembly-rules.html">총회 규칙</a>' +
        ' · <a href="assembly-resolution.html">총회 결의</a>' +
        ' · <a href="assembly-report.html">총회 보고</a></div>';
      el.innerHTML = h;

      /* ----- 기사 갤러리 그리기 ----- */
      function renderNews(list) {
        var box = document.getElementById('asm-news');
        if (!box) return;
        if (!list.length) {
          box.innerHTML = '<p class="dash-none">등록된 기사가 없습니다.' +
            (admin ? ' 아래에서 기사 주소를 넣어 등록해 주세요.' : '') + '</p>';
          return;
        }
        box.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px">' +
          list.map(function (n) {
            return '<a href="' + esc(n.url) + '" target="_blank" rel="noopener" ' +
              'style="display:block;border:1px solid var(--gray-2,#e8e5df);border-radius:10px;overflow:hidden;' +
              'background:#fff;text-decoration:none;color:inherit;position:relative">' +
              (n.image_url
                ? '<img src="' + esc(n.image_url) + '" alt="" loading="lazy" ' +
                  'style="width:100%;height:122px;object-fit:cover;display:block">'
                : '<div style="height:122px;background:var(--gray-1,#f2efe9)"></div>') +
              '<div style="padding:10px 12px">' +
              '<div style="font-weight:700;font-size:0.88rem;line-height:1.4;max-height:2.8em;overflow:hidden">' +
              esc(n.title) + '</div>' +
              (n.description
                ? '<div style="font-size:0.76rem;color:var(--gray-6);margin-top:4px;max-height:3em;overflow:hidden">' +
                  esc(n.description) + '</div>'
                : '') +
              '<div style="font-size:0.7rem;color:var(--gray-5);margin-top:6px">' + esc(n.source || '') +
              (n.news_date ? ' · ' + esc(n.news_date) : '') + '</div></div>' +
              (admin
                ? '<button type="button" data-ndel="' + n.id + '" ' +
                  'style="position:absolute;top:6px;right:6px;border:none;background:rgba(0,0,0,0.55);' +
                  'color:#fff;border-radius:8px;padding:2px 8px;font-size:0.72rem;cursor:pointer">삭제</button>'
                : '') +
              '</a>';
          }).join('') + '</div>';
        box.querySelectorAll('button[data-ndel]').forEach(function (b) {
          b.addEventListener('click', function (ev) {
            ev.preventDefault(); ev.stopPropagation();
            if (!confirm('이 기사를 목록에서 지우시겠습니까?')) return;
            SHSCloud.init().then(function (c) {
              return c.from('assembly_news').delete().eq('id', parseInt(b.dataset.ndel, 10));
            }).then(function (r) {
              if (r.error) { alert(r.error.message); return; }
              refreshNews();
            });
          });
        });
      }
      function refreshNews() {
        SHSCloud.init().then(function (c) {
          return c.from('assembly_news').select('*').order('id', { ascending: false }).limit(12);
        }).then(function (r) { renderNews((r && r.data) || []); });
      }
      renderNews(news);

      /* ----- 활동 사진 그리기 ----- */
      function renderPhotos(list) {
        var box = document.getElementById('asm-photos');
        if (!box) return;
        if (!list.length) {
          box.innerHTML = '<p class="dash-none">올린 활동 사진이 없습니다.</p>';
          return;
        }
        box.innerHTML = '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
          list.map(function (p) {
            return '<a href="gallery.html" title="' + esc(p.title || '') + '">' +
              '<img src="' + esc(p.thumb_url || p.image_url) + '" alt="" loading="lazy" ' +
              'style="width:112px;height:84px;object-fit:cover;border-radius:8px;display:block">' + '</a>';
          }).join('') + '</div>';
      }
      function refreshPhotos() {
        SHSCloud.init().then(function (c) {
          return c.from('gallery_items').select('id,title,image_url,thumb_url')
                  .eq('category', '총회 활동').order('id', { ascending: false }).limit(8);
        }).then(function (r) { renderPhotos((r && r.data) || []); });
      }
      renderPhotos(photos);

      if (!admin) return;

      /* ----- 기사 등록: 주소를 넣으면 제목·사진·요약을 저절로 채운다 ----- */
      var msg = document.getElementById('asm-msg');
      function say(t, err) { msg.className = 'form-msg' + (err ? ' err' : ''); msg.textContent = t || ''; }
      var fetched = { source: '' };
      document.getElementById('asm-fetch').addEventListener('click', function () {
        var url = document.getElementById('asm-url').value.trim();
        if (!/^https?:\/\//i.test(url)) { say('http:// 또는 https:// 로 시작하는 기사 주소를 넣어 주세요.', true); return; }
        say('기사 정보를 가져오는 중입니다...');
        SHSCloud.init().then(function (c) {
          return c.functions.invoke('og-meta', { body: { url: url } });
        }).then(function (r) {
          var d = r && r.data;
          if (!d || r.error || d.error) {
            throw new Error((d && d.error) || (r.error && r.error.message) || '가져오지 못했습니다.');
          }
          fetched.source = d.source || '';
          document.getElementById('asm-title').value = d.title || '';
          document.getElementById('asm-desc').value = d.description || '';
          document.getElementById('asm-img').value = d.image || '';
          var pv = document.getElementById('asm-imgprev');
          pv.src = d.image || '';
          pv.classList.toggle('hidden', !d.image);
          document.getElementById('asm-preview').classList.remove('hidden');
          say(d.title ? '내용을 확인하고 기사 추가를 눌러 주세요.'
                      : '제목을 읽지 못했습니다. 직접 적은 뒤 기사 추가를 눌러 주세요.', !d.title);
        }).catch(function (x) {
          /* 자동 수집이 안 되는 기사면 직접 적어서라도 등록할 수 있게 한다 */
          document.getElementById('asm-preview').classList.remove('hidden');
          say('자동으로 가져오지 못했습니다 (' + ((x && x.message) || x) + '). 제목을 직접 적어 주세요.', true);
        });
      });
      document.getElementById('asm-add').addEventListener('click', function () {
        var url = document.getElementById('asm-url').value.trim();
        var title = document.getElementById('asm-title').value.trim();
        if (!url || !title) { say('기사 주소와 제목을 확인해 주세요.', true); return; }
        say('등록 중입니다...');
        SHSCloud.init().then(function (c) {
          return c.from('assembly_news').insert({
            url: url, title: title,
            description: document.getElementById('asm-desc').value.trim() || null,
            image_url: document.getElementById('asm-img').value.trim() || null,
            source: fetched.source || (url.match(/^https?:\/\/(?:www\.)?([^\/]+)/i) || [])[1] || null,
            news_date: today, created_by: user.name
          });
        }).then(function (r) {
          if (r.error) { say(r.error.message, true); return; }
          document.getElementById('asm-url').value = '';
          document.getElementById('asm-preview').classList.add('hidden');
          var fIn = document.getElementById('asm-imgfile');
          if (fIn) { fIn.value = ''; fIn.dispatchEvent(new Event('change', { bubbles: true })); }
          say('기사를 등록했습니다.');
          SHSCloud.log('create', '총회 기사 등록', title);
          refreshNews();
        });
      });

      /* 기사 사진: 주소를 적어도 되고, 파일을 끌어다 놓아도 된다.
       * 파일을 올리면 사진 보관소에 저장하고 그 주소가 사진 주소 칸에 채워진다. */
      var imgIn = document.getElementById('asm-img');
      if (imgIn) imgIn.addEventListener('change', function () {
        var pv = document.getElementById('asm-imgprev');
        pv.src = this.value.trim();
        pv.classList.toggle('hidden', !this.value.trim());
      });
      var imgFile = document.getElementById('asm-imgfile');
      if (imgFile && SHS.dropZone) SHS.dropZone(imgFile, { what: '기사 사진', accept: 'image' });
      if (imgFile) imgFile.addEventListener('change', function () {
        var f = this.files && this.files[0];
        if (!f) return;
        if (!window.SHSPhotos) { say('사진 도구를 불러오지 못했습니다.', true); return; }
        say('사진을 올리는 중입니다...');
        Promise.all([shrink(f, 1200, 0.82), shrink(f, 640, 0.72)]).then(function (bs) {
          return SHSPhotos.putPair(bs[0], bs[1]);
        }).then(function (u) {
          document.getElementById('asm-img').value = u.full;
          var pv = document.getElementById('asm-imgprev');
          pv.src = u.full;
          pv.classList.remove('hidden');
          say('사진을 올렸습니다. 내용을 확인하고 기사 추가를 눌러 주세요.');
        }).catch(function (x) {
          say('사진을 올리지 못했습니다: ' + ((x && x.message) || x), true);
        });
      });

      /* ----- 활동 사진 올리기 → 메인 갤러리 '총회 활동' 앨범 ----- */
      function shrink(file, maxW, quality) {
        return new Promise(function (resolve, reject) {
          var img = new Image();
          var url = URL.createObjectURL(file);
          img.onload = function () {
            var w = img.width, ht = img.height;
            if (w > maxW) { ht = Math.round(ht * maxW / w); w = maxW; }
            var cv = document.createElement('canvas');
            cv.width = w; cv.height = ht;
            cv.getContext('2d').drawImage(img, 0, 0, w, ht);
            URL.revokeObjectURL(url);
            cv.toBlob(function (b) {
              if (b) resolve(b); else reject(new Error('사진을 줄이지 못했습니다.'));
            }, 'image/jpeg', quality);
          };
          img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('사진을 읽지 못했습니다.')); };
          img.src = url;
        });
      }
      var pin = document.getElementById('asm-photo');
      /* 끌어다 놓기(드래그 앤 드롭)로도 올릴 수 있는 상자로 바꾼다 */
      if (pin && SHS.dropZone) SHS.dropZone(pin, { what: '활동 사진', accept: 'image' });
      if (pin) pin.addEventListener('change', function () {
        var files = Array.prototype.slice.call(this.files || []);
        if (!files.length) return;
        if (!window.SHSPhotos) {
          document.getElementById('asm-pmsg').textContent = '사진 도구를 불러오지 못했습니다. 갤러리 화면에서 올려 주세요.';
          return;
        }
        var pmsg = document.getElementById('asm-pmsg');
        pmsg.className = 'form-msg'; pmsg.textContent = '사진을 올리는 중입니다... (0/' + files.length + ')';
        SHSCloud.init().then(function (c) {
          return c.from('gallery_items').select('sort').order('sort', { ascending: false }).limit(1);
        }).then(function (r) {
          var sort = (r && r.data && r.data[0] && Number(r.data[0].sort)) || 0;
          var chain = Promise.resolve();
          files.forEach(function (f, i) {
            chain = chain.then(function () {
              return Promise.all([shrink(f, 1400, 0.8), shrink(f, 640, 0.72)]).then(function (bs) {
                return SHSPhotos.putPair(bs[0], bs[1]);
              }).then(function (u) {
                return SHSCloud.init().then(function (c) {
                  return c.from('gallery_items').insert({
                    title: '총회 활동', taken: today, category: '총회 활동',
                    image_url: u.full, thumb_url: u.thumb,
                    author_id: user.id, author_name: user.name, sort: sort + i + 1
                  });
                });
              }).then(function (r2) {
                if (r2.error) throw r2.error;
                pmsg.textContent = '사진을 올리는 중입니다... (' + (i + 1) + '/' + files.length + ')';
              });
            });
          });
          return chain;
        }).then(function () {
          pmsg.className = 'form-msg ok';
          pmsg.textContent = files.length + '장을 올렸습니다. 메인 갤러리의 총회 활동 앨범에서도 볼 수 있습니다.';
          pin.value = '';
          pin.dispatchEvent(new Event('change', { bubbles: true }));   /* 드롭존 목록 비우기 */
          SHSCloud.log('create', '총회 활동 사진 등록', files.length + '장');
          refreshPhotos();
        }).catch(function (x) {
          pmsg.className = 'form-msg err';
          pmsg.textContent = '올리지 못했습니다: ' + ((x && x.message) || x);
        });
      });
    }

    /* ---------- 교회상황 보고서 ---------- */
    function drawReports(rows, subs) {
      subs = subs || [];
      var el = document.getElementById('dash-report');
      var year = new Date().getFullYear();
      var officer = SHSAuth.isOfficer(user);
      var myChurch = user.church || '';
      var mine = rows.filter(function (r) { return r.church === myChurch; })[0];

      /* 허브 카드에 우리 교회의 제출 여부를 표시한다 */
      var card = document.getElementById('hub-card-report');
      if (card && user.role !== 'superadmin' && myChurch) {
        var tSpan = card.querySelector('.hc-t > span');
        if (tSpan && !tSpan.querySelector('.hc-rp')) {
          tSpan.insertAdjacentHTML('beforeend',
            '<span class="hc-s hc-rp" style="font-weight:700;color:' +
            (mine ? '#2a7a2a">' + year + '년 제출 완료' : '#b03a3a">' + year + '년 미제출') +
            '</span>');
        }
      }

      var h = '';
      if (user.role === 'superadmin') {
        h += '';   /* 노회 사무실 계정은 낼 보고서가 없다 — 아래 전체 현황만 */
      } else if (myChurch) {
        /* 결재 흐름(71) : 작성 → 시찰접수 → 노회제출 → 반영완료 (보완요청은 되돌아온 것) */
        var stage = window.SHSReport
          ? SHSReport.stage(mine && mine.status)
          : esc((mine && mine.status) || '');
        h += mine
          ? (mine.status === '보완요청'
              ? '<div class="dash-alert"><strong>' + esc(myChurch) + '</strong>의 ' + year +
                '년 보고서에 <strong>노회 보완요청</strong>이 있습니다. 고쳐서 다시 내 주세요.</div>'
              : '<div class="dash-ok"><strong>' + esc(myChurch) + '</strong>의 ' + year + '년 보고서 — ' +
                stage + ' <span class="dash-dim">(' +
                esc(String(mine.approved_at || mine.updated_at || '').slice(0, 10)) + ')</span></div>')
          : '<div class="dash-alert"><strong>' + esc(myChurch) + '</strong>의 ' + year +
            '년 보고서를 아직 내지 않으셨습니다.</div>';
      } else {
        h += '<p class="dash-none">가입 정보에 소속 교회가 없어 보고서를 낼 수 없습니다.</p>';
      }

      if (officer) {
        var bySic = {};
        rows.forEach(function (r) { bySic[r.sichal] = (bySic[r.sichal] || 0) + 1; });
        var keys = Object.keys(bySic).sort();
        var nApproved = rows.filter(function (r) { return r.status === '반영완료'; }).length;
        h += '<p class="dash-sub">' + year + '년 제출 현황 — 모두 <strong>' + rows.length + '곳</strong>' +
          (keys.length ? ' (' + keys.map(function (k) {
            return esc(k) + ' ' + bySic[k];
          }).join(' · ') + ')' : '') +
          ' · 노회 반영완료 <strong>' + nApproved + '건</strong></p>';

        /* 시찰이 노회 서기에게 낸 것 */
        var subMap = {};
        subs.forEach(function (x) { subMap[x.sichal] = x; });
        var sicNames = Object.keys(bySic).concat(Object.keys(subMap))
          .filter(function (x, i, a) { return a.indexOf(x) === i; }).sort();
        if (sicNames.length) {
          h += '<p class="dash-sub">시찰 제출 — ' + sicNames.map(function (k) {
            var x = subMap[k];
            return esc(k) + ' ' + (x
              ? '<strong>제출 (' + esc(String(x.submitted_at).slice(0, 10)) + ')</strong>'
              : '<span class="dash-dim">미제출</span>');
          }).join(' · ') + '</p>';
        }
      }

      h += '<div class="dash-more">' +
        '<a href="sichal.html#report">내 시찰에서 내기</a></div>';
      el.innerHTML = h;
    }
  }

  return { can: can, mount: mount };
})();
