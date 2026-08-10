/* 시화산노회 홈페이지 - 회원/권한 관리 및 감사 로그
 * 데모 구현: 브라우저 localStorage 기반.
 * 실제 운영 시 서버(예: Supabase, 그누보드 등) 인증으로 교체해야 합니다.
 */

/* ---------- 감사 로그 (감독 기능) ----------
 * 개인정보 열람, 자료 추가·수정·삭제, 로그인 등 주요 행위를 기록한다.
 * 로그 열람은 최고관리자만 가능하며, 로그는 삭제 기능을 두지 않는다.
 */
var SHSAudit = (function () {
  var KEY = 'shs_audit_v1';
  var MAX = 500;

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
  }

  function stamp() {
    var d = new Date();
    function p(n) { return String(n).padStart(2, '0'); }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  /* type: view(개인정보·자료 열람) / create(추가) / update(수정) / delete(삭제) / auth(로그인·아웃) / issue(서류발급) */
  function log(type, action, detail) {
    var u = null;
    try { u = SHSAuth.currentUser(); } catch (e) {}
    var rows = load();
    rows.push({
      time: stamp(),
      userId: u ? u.id : '(비로그인)',
      userName: u ? u.name : '방문자',
      role: u ? u.role : '-',
      type: type,
      action: action,
      detail: detail || ''
    });
    if (rows.length > MAX) rows = rows.slice(rows.length - MAX);
    localStorage.setItem(KEY, JSON.stringify(rows));
  }

  function list() { return load(); }

  var TYPE_NAMES = {
    view: '열람', create: '추가', update: '수정', 'delete': '삭제', auth: '접속', issue: '서류발급'
  };

  return { log: log, list: list, typeName: function (t) { return TYPE_NAMES[t] || t; } };
})();

var SHSAuth = (function () {
  var USERS_KEY = 'shs_users_v3';
  var SESSION_KEY = 'shs_session_v1';

  /* 등급 정의
   * superadmin : 최고관리자
   * president  : 노회장
   * clerk      : 서기
   * staff      : 간사
   * member     : 정회원 (노회 소속 목사, 총대 장로)
   */
  var ROLE_NAMES = {
    superadmin: '최고관리자',
    president: '노회장',
    clerk: '서기',
    staff: '간사',
    member: '정회원',
    pending: '승인대기'
  };

  function hash(str) {
    /* 데모용 해시 (운영 시 서버측 bcrypt 등으로 교체) */
    var h = 5381, i;
    str = 'shs$' + str + '$presbytery';
    for (i = 0; i < str.length; i++) {
      h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    }
    return 'h' + (h >>> 0).toString(36);
  }

  /* 홈페이지 관리자: 노회장, 서기, 간사 */
  function seedUsers() {
    return [
      { id: 'parkhy',   pw: hash('1234'), name: '박흥열', role: 'president', position: '목사', church: '시흥생수교회' },
      { id: 'kwonbr',   pw: hash('1234'), name: '권병렬', role: 'clerk', position: '목사', church: '섬김의교회' },
      { id: 'gansa',    pw: hash('1234'), name: '노회 간사', role: 'staff', position: '간사', church: '노회 사무실' },
      { id: 'kimds',    pw: hash('1234'), name: '김동석', role: 'member', position: '목사', church: '운평장로교회' }
    ];
  }

  /* 별도 파일에서 계정을 보장 생성 (이미 있으면 유지) */
  function ensureAccount(seed) {
    var users = loadUsers();
    for (var i = 0; i < users.length; i++) {
      if (users[i].id === seed.id) return;
    }
    users.push({
      id: seed.id, pw: hash(seed.pw), name: seed.name,
      role: seed.role || 'member', position: seed.position || '', church: seed.church || ''
    });
    saveUsers(users);
  }

  function loadUsers() {
    try {
      var raw = localStorage.getItem(USERS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    var seeded = seedUsers();
    saveUsers(seeded);
    return seeded;
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function currentUser() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      var users = loadUsers();
      for (var i = 0; i < users.length; i++) {
        if (users[i].id === s.id) return users[i];
      }
    } catch (e) {}
    return null;
  }

  function login(id, pw, keep) {
    var users = loadUsers();
    for (var i = 0; i < users.length; i++) {
      if (users[i].id === id && users[i].pw === hash(pw)) {
        var store = keep ? localStorage : sessionStorage;
        store.setItem(SESSION_KEY, JSON.stringify({ id: id, at: new Date().toISOString() }));
        SHSAudit.log('auth', '로그인', '아이디 ' + id);
        return { ok: true, user: users[i] };
      }
    }
    SHSAudit.log('auth', '로그인 실패', '아이디 ' + id);
    return { ok: false, msg: '아이디 또는 비밀번호가 올바르지 않습니다.' };
  }

  function logout() {
    SHSAudit.log('auth', '로그아웃', '');
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
  }

  /* ---------- 권한 ---------- */

  function roleName(role) { return ROLE_NAMES[role] || role; }

  /* 회원명단 추가·삭제: 노회장, 서기, 간사, 최고관리자 */
  function canManageMembers(u) {
    return !!u && (u.role === 'president' || u.role === 'clerk' || u.role === 'staff' || u.role === 'superadmin');
  }

  /* 서류 발급: 서기, 노회장, 간사 */
  function canIssueDocuments(u) {
    return !!u && (u.role === 'clerk' || u.role === 'president' || u.role === 'staff');
  }

  /* 직책(서기·노회장·간사) 지정: 최고관리자 */
  function canAssignRoles(u) {
    return !!u && u.role === 'superadmin';
  }

  /* 정회원 이상 열람 자료 (승인대기 회원 제외) */
  function isMember(u) { return !!u && u.role !== 'pending'; }

  /* 승인대기 회원을 정회원으로 설정: 서기, 간사, 최고관리자 */
  function canApproveMembers(u) {
    return !!u && (u.role === 'clerk' || u.role === 'staff' || u.role === 'superadmin');
  }

  /* 임원 전용 자료(회의록 등): 노회장, 서기, 간사, 최고관리자 */
  function isOfficer(u) {
    return !!u && (u.role === 'president' || u.role === 'clerk' || u.role === 'staff' || u.role === 'superadmin');
  }

  /* ---------- 회원가입 ---------- */

  /* 교회명 정규화: 공백 제거, 끝의 "교회" 생략 허용 */
  function normChurch(s) {
    return String(s || '').replace(/\s+/g, '').replace(/교회$/, '');
  }

  /* 회원명단(노회 소속 목사·총대 장로)과 이름·교회 일치 여부 확인 */
  function rosterMatch(name, church) {
    var D = window.SHSData;
    if (!D) return false;
    var n = String(name || '').replace(/\s+/g, '');
    var c = normChurch(church);
    if (!n || !c) return false;
    var lists = [];
    lists = lists.concat(D.pastors || [], D.assocPastors || [], D.seniorPastors || [], D.retiredPastors || []);
    Object.keys(D.elders || {}).forEach(function (k) { lists = lists.concat(D.elders[k]); });
    for (var i = 0; i < lists.length; i++) {
      if (lists[i].name.replace(/\s+/g, '') === n && normChurch(lists[i].church) === c) return true;
    }
    return false;
  }

  /* 자가 회원가입: 회원명단과 일치하면 자동 정회원, 불일치 시 승인대기 */
  function register(data) {
    if (!data.id || !data.pw || !data.name || !data.church) {
      return { ok: false, msg: '아이디, 비밀번호, 성명, 소속 교회는 필수 항목입니다.' };
    }
    if (!/^[a-zA-Z0-9]{4,20}$/.test(data.id)) {
      return { ok: false, msg: '아이디는 영문·숫자 4~20자로 입력해 주세요.' };
    }
    if (String(data.pw).length < 4) {
      return { ok: false, msg: '비밀번호는 4자 이상으로 입력해 주세요.' };
    }
    var users = loadUsers();
    for (var i = 0; i < users.length; i++) {
      if (users[i].id === data.id) return { ok: false, msg: '이미 사용 중인 아이디입니다.' };
    }
    var auto = rosterMatch(data.name, data.church);
    users.push({
      id: data.id, pw: hash(data.pw), name: data.name,
      role: auto ? 'member' : 'pending',
      position: data.position || '목사', church: data.church
    });
    saveUsers(users);
    SHSAudit.log('create', '회원가입', '아이디 ' + data.id + ' (' + data.name + ', ' + data.church + ') → ' +
      (auto ? '정회원 자동승인' : '승인대기'));
    return { ok: true, autoApproved: auto };
  }

  /* 승인대기 회원을 정회원으로 설정 */
  function approveMember(actor, id) {
    if (!canApproveMembers(actor)) return { ok: false, msg: '정회원 승인은 서기, 간사, 최고관리자만 할 수 있습니다.' };
    var users = loadUsers();
    for (var i = 0; i < users.length; i++) {
      if (users[i].id === id) {
        if (users[i].role !== 'pending') return { ok: false, msg: '승인대기 상태의 회원이 아닙니다.' };
        users[i].role = 'member';
        saveUsers(users);
        SHSAudit.log('update', '정회원 승인', '아이디 ' + id + ' (' + users[i].name + ') 승인대기 → 정회원');
        return { ok: true };
      }
    }
    return { ok: false, msg: '해당 아이디를 찾을 수 없습니다.' };
  }

  /* ---------- 아이디 찾기 / 비밀번호 재설정 ---------- */

  /* 아이디 일부 마스킹: parkhy → pa***y */
  function maskId(id) {
    var s = String(id);
    if (s.length <= 3) return s.charAt(0) + '**';
    return s.slice(0, 2) + '***'.slice(0, Math.min(3, s.length - 3)) + s.charAt(s.length - 1);
  }

  /* 아이디 찾기: 성명 + 소속 교회가 일치하는 계정의 마스킹된 아이디 반환 */
  function findIds(name, church) {
    var n = String(name || '').replace(/\s+/g, '');
    var c = normChurch(church);
    if (!n || !c) return { ok: false, msg: '성명과 소속 교회를 모두 입력해 주세요.' };
    var found = [];
    loadUsers().forEach(function (u) {
      if (u.role === 'superadmin') return;
      if (u.name.replace(/\s+/g, '') === n && normChurch(u.church) === c) found.push(maskId(u.id));
    });
    if (!found.length) {
      return { ok: false, msg: '일치하는 계정을 찾을 수 없습니다. 노회 사무실(031-486-9993)로 문의해 주세요.' };
    }
    SHSAudit.log('view', '아이디 찾기', '성명 ' + name + ', 교회 ' + church + ' → ' + found.length + '건 조회');
    return { ok: true, ids: found };
  }

  /* 비밀번호 재설정: 아이디 + 성명 + 소속 교회가 모두 일치할 때 새 비밀번호로 변경 */
  function resetPassword(id, name, church, newPw) {
    if (!id || !name || !church || !newPw) {
      return { ok: false, msg: '모든 항목을 입력해 주세요.' };
    }
    if (String(newPw).length < 4) {
      return { ok: false, msg: '새 비밀번호는 4자 이상으로 입력해 주세요.' };
    }
    var users = loadUsers();
    var n = String(name).replace(/\s+/g, '');
    var c = normChurch(church);
    for (var i = 0; i < users.length; i++) {
      if (users[i].role === 'superadmin') continue;
      if (users[i].id === id &&
          users[i].name.replace(/\s+/g, '') === n &&
          normChurch(users[i].church) === c) {
        users[i].pw = hash(newPw);
        saveUsers(users);
        SHSAudit.log('update', '비밀번호 재설정', '아이디 ' + id + ' 본인확인(성명·교회 일치) 후 재설정');
        return { ok: true };
      }
    }
    SHSAudit.log('view', '비밀번호 재설정 실패', '아이디 ' + id + ' 본인확인 불일치');
    return { ok: false, msg: '입력하신 정보와 일치하는 계정이 없습니다. 노회 사무실(031-486-9993)로 문의해 주세요.' };
  }

  /* ---------- 계정 관리 ---------- */

  function addAccount(actor, data) {
    if (!canManageMembers(actor)) return { ok: false, msg: '회원 등록 권한이 없습니다.' };
    var users = loadUsers();
    for (var i = 0; i < users.length; i++) {
      if (users[i].id === data.id) return { ok: false, msg: '이미 사용 중인 아이디입니다.' };
    }
    users.push({
      id: data.id, pw: hash(data.pw), name: data.name,
      role: 'member', position: data.position || '목사', church: data.church || ''
    });
    saveUsers(users);
    SHSAudit.log('create', '회원 추가', '아이디 ' + data.id + ' (' + data.name + ', ' + (data.church || '-') + ')');
    return { ok: true };
  }

  function removeAccount(actor, id) {
    if (!canManageMembers(actor)) return { ok: false, msg: '회원 삭제 권한이 없습니다.' };
    var users = loadUsers();
    for (var k = 0; k < users.length; k++) {
      if (users[k].id === id && users[k].role === 'superadmin' && (!actor || actor.role !== 'superadmin')) {
        return { ok: false, msg: '해당 아이디를 찾을 수 없습니다.' };
      }
    }
    var next = [];
    for (var i = 0; i < users.length; i++) {
      if (users[i].id !== id) next.push(users[i]);
    }
    if (next.length === users.length) return { ok: false, msg: '해당 아이디를 찾을 수 없습니다.' };
    saveUsers(next);
    SHSAudit.log('delete', '회원 삭제', '아이디 ' + id);
    return { ok: true };
  }

  function assignRole(actor, id, role) {
    if (!canAssignRoles(actor)) return { ok: false, msg: '직책 지정은 최고관리자만 할 수 있습니다.' };
    if (!ROLE_NAMES[role]) return { ok: false, msg: '알 수 없는 등급입니다.' };
    var users = loadUsers();
    for (var i = 0; i < users.length; i++) {
      if (users[i].id === id) {
        if (users[i].role === 'superadmin' && role !== 'superadmin') {
          /* 최고관리자가 1명뿐이면 강등 금지 */
          var admins = 0;
          for (var j = 0; j < users.length; j++) if (users[j].role === 'superadmin') admins++;
          if (admins <= 1) return { ok: false, msg: '최고관리자가 1명뿐이므로 등급을 변경할 수 없습니다.' };
        }
        var before = users[i].role;
        users[i].role = role;
        saveUsers(users);
        SHSAudit.log('update', '등급 변경', '아이디 ' + id + ' (' + users[i].name + ') ' +
          ROLE_NAMES[before] + ' → ' + ROLE_NAMES[role]);
        return { ok: true };
      }
    }
    return { ok: false, msg: '해당 아이디를 찾을 수 없습니다.' };
  }

  function listAccounts() { return loadUsers(); }

  return {
    login: login,
    logout: logout,
    ensureAccount: ensureAccount,
    currentUser: currentUser,
    roleName: roleName,
    canManageMembers: canManageMembers,
    canIssueDocuments: canIssueDocuments,
    canAssignRoles: canAssignRoles,
    isMember: isMember,
    isOfficer: isOfficer,
    canApproveMembers: canApproveMembers,
    register: register,
    approveMember: approveMember,
    findIds: findIds,
    resetPassword: resetPassword,
    addAccount: addAccount,
    removeAccount: removeAccount,
    assignRole: assignRole,
    listAccounts: listAccounts
  };
})();
