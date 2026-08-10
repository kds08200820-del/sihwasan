/* 시화산노회 홈페이지 - 공통 레이아웃 및 유틸 */

(function () {
  var user = SHSAuth.currentUser();

  /* ---------- 상단바 + 헤더 + GNB ---------- */
  var NAV = [
    { title: '노회소개', href: 'about.html', sub: [
      { t: '인사말', h: 'about.html#greeting' },
      { t: '노회 연혁', h: 'about.html#history' },
      { t: '관할지역 안내', h: 'about.html#area' },
      { t: '오시는 길', h: 'about.html#location' }
    ]},
    { title: '조직', href: 'organization.html', sub: [
      { t: '노회 임원', h: 'organization.html#officers' },
      { t: '회원명단', h: 'organization.html#members' },
      { t: '시찰회', h: 'organization.html#sichal' },
      { t: '상비부', h: 'organization.html#committees' }
    ]},
    { title: '회칙', href: 'rules-presbytery.html', sub: [
      { t: '노회 회칙', h: 'rules-presbytery.html' },
      { t: '총회 회칙 안내', h: 'rules-assembly.html' },
      { t: '각종 내규', h: 'rules-presbytery.html#bylaws' }
    ]},
    { title: '자료실', href: 'archive.html', sub: [
      { t: '자료 목록', h: 'archive.html' },
      { t: '지난 회기 결의사항', h: 'archive.html#resolutions' },
      { t: '구비서류 안내', h: 'archive.html#forms' }
    ]},
    { title: '게시판', href: 'board.html', sub: [
      { t: '공지사항', h: 'board.html#notice' },
      { t: '자유게시판', h: 'board.html#free' }
    ]},
    { title: '갤러리', href: 'gallery.html', sub: [
      { t: '노회 행사', h: 'gallery.html' }
    ]},
    { title: '임원방', href: 'officer.html', sub: [
      { t: '임원 자료실', h: 'officer.html' },
      { t: '노회 회의록', h: 'minutes.html' },
      { t: '서류 발급', h: 'documents.html' },
      { t: '회원 관리', h: 'admin.html' },
      { t: '감독(감사 로그)', h: 'audit.html' }
    ]}
  ];

  function buildTopbar() {
    var right;
    if (user) {
      right = '<span class="user-name">' + user.name + '</span>' +
        '<span>(' + SHSAuth.roleName(user.role) + ')</span>' +
        '<a href="#" id="btn-logout">로그아웃</a>';
    } else {
      right = '<a href="login.html">로그인</a>';
    }
    return '<div class="topbar"><div class="container">' +
      '<div>대한예수교장로회(합동) 시화산노회</div>' +
      '<div class="util"><a href="https://gapck.org" target="_blank" rel="noopener">총회 홈페이지</a>' + right + '</div>' +
      '</div></div>';
  }

  function buildHeader() {
    return '<header class="site-header"><div class="container">' +
      '<a class="brand" href="index.html">' +
      '<img class="brand-logo" src="images/logo.svg" alt="시화산노회 로고">' +
      '<span class="brand-text"><span class="denom">THE PRESBYTERIAN CHURCH IN KOREA</span>' +
      '<span class="name">시화산노회</span></span></a>' +
      '<div class="header-contact">노회 사무실<strong>031-486-9993</strong>안산시 단원구 와동공원로1안길 13-7</div>' +
      '</div></header>';
  }

  function buildGnb() {
    var here = location.pathname.split('/').pop() || 'index.html';
    var html = '<nav class="gnb"><ul class="gnb-list">';
    NAV.forEach(function (m) {
      var active = here === m.href ? ' active' : '';
      html += '<li class="gnb-item' + active + '"><a href="' + m.href + '">' + m.title + '</a><div class="gnb-sub">';
      m.sub.forEach(function (s) { html += '<a href="' + s.h + '">' + s.t + '</a>'; });
      html += '</div></li>';
    });
    html += '</ul></nav>';
    return html;
  }

  function buildFooter() {
    return '<footer class="site-footer"><div class="container">' +
      '<div class="f-name">대한예수교장로회(합동) 시화산노회</div>' +
      '<div>노회 사무실 : 경기도 안산시 단원구 와동공원로1안길 13-7 (반월교회 교육관 1층)</div>' +
      '<div>전화 031-486-9993 / 팩스 031-486-9993</div>' +
      '<div class="f-links"><a href="about.html">노회소개</a><a href="rules-presbytery.html">노회 회칙</a>' +
      '<a href="terms.html"><strong>이용약관</strong></a>' +
      '<a href="privacy.html"><strong>개인정보처리방침</strong></a>' +
      '<a href="https://gapck.org" target="_blank" rel="noopener">대한예수교장로회총회</a></div>' +
      '</div></footer>';
  }

  document.addEventListener('DOMContentLoaded', function () {
    var fav = document.createElement('link');
    fav.rel = 'icon';
    fav.type = 'image/svg+xml';
    fav.href = 'images/logo.svg';
    document.head.appendChild(fav);

    document.body.insertAdjacentHTML('afterbegin', buildTopbar() + buildHeader() + buildGnb());
    document.body.insertAdjacentHTML('beforeend', buildFooter());

    var lg = document.getElementById('btn-logout');
    if (lg) lg.addEventListener('click', function (e) {
      e.preventDefault();
      SHSAuth.logout();
      location.href = 'index.html';
    });

    /* 탭 */
    document.querySelectorAll('.tabs').forEach(function (tabs) {
      var btns = tabs.querySelectorAll('button');
      btns.forEach(function (b) {
        b.addEventListener('click', function () {
          btns.forEach(function (x) { x.classList.remove('active'); });
          b.classList.add('active');
          var scope = tabs.parentElement;
          scope.querySelectorAll(':scope > .tab-panel').forEach(function (p) {
            p.classList.toggle('active', p.id === b.dataset.tab);
          });
        });
      });
    });

    /* 해시로 탭 열기 (#officers 등) */
    if (location.hash) {
      var target = document.querySelector('.tabs button[data-tab="' + location.hash.slice(1) + '"]');
      if (target) target.click();
    }
  });

  /* 이름 마스킹: 개인정보 보호를 위해 비회원에게는 가운데 글자를 *로 표시 */
  function maskName(name) {
    var n = String(name || '').trim();
    if (n.length <= 1) return '*';
    if (n.length === 2) return n.charAt(0) + '*';
    if (n.length === 3) return n.charAt(0) + '*' + n.charAt(2);
    return n.charAt(0) + '**' + n.charAt(n.length - 1);
  }

  /* 전역 헬퍼 */
  window.SHS = {
    user: user,
    maskName: maskName,
    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    },
    fmtDate: function (d) { return d; },
    requireLogin: function (msg) {
      if (!SHSAuth.currentUser()) {
        alert(msg || '로그인이 필요한 페이지입니다.');
        location.href = 'login.html';
        return false;
      }
      return true;
    }
  };
})();
