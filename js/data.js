/* 시화산노회 홈페이지 - 기초 자료
 * 출처: 제19회기 정기노회(봄) 2026 회의자료
 */

var SHSData = {

  /* ---------- 현 노회 임원 (제19회 정기노회 선출, 2026. 4. 13) ---------- */
  officers: [
    { role: '노회장', name: '박흥열', position: '목사', church: '시흥생수교회' },
    { role: '부노회장', name: '이재용', position: '목사', church: '안산상록교회' },
    { role: '부노회장', name: '이신영', position: '장로', church: '수암제일교회' },
    { role: '서기', name: '권병렬', position: '목사', church: '섬김의교회' },
    { role: '부서기', name: '김동석', position: '목사', church: '운평장로교회' },
    { role: '회록서기', name: '김지수', position: '목사', church: '반월교회' },
    { role: '부회록서기', name: '손영득', position: '목사', church: '새솔제일교회' },
    { role: '회계', name: '김득철', position: '장로', church: '은광교회' },
    { role: '부회계', name: '고동욱', position: '장로', church: '섬기는교회' }
  ],

  /* ---------- 총회 총대 (제19회 정기노회 선출) ---------- */
  delegates: {
    pastorMain: ['박흥열 (노회장)', '김종수', '서용호'],
    pastorSub: ['박재완', '김성중', '박양수'],
    elderMain: ['이신영 (부노회장)', '윤성복', '정재영'],
    elderSub: ['김창룡', '백윤복', '이재복']
  },

  /* ---------- 역대 노회장 (시화산노회) ---------- */
  history: [
    { no: '1대', year: '2017', president: '김영길' },
    { no: '2대', year: '2018', president: '김삼성' },
    { no: '3대', year: '2019', president: '강명우' },
    { no: '4대', year: '2020', president: '이용수' },
    { no: '5대', year: '2021', president: '김충현' },
    { no: '6대', year: '2022', president: '박재완' },
    { no: '7대', year: '2023', president: '박재완' },
    { no: '8대', year: '2024', president: '김성중' },
    { no: '9대', year: '2025', president: '박양수' },
    { no: '10대', year: '2026', president: '박흥열' }
  ],

  /* ---------- 회원 명단 ---------- */
  seniorPastors: [
    { name: '이세용', church: '반월교회', retired: '2017. 10. 30' },
    { name: '신동열', church: '노진교회', retired: '2020. 12. 12' },
    { name: '김충현', church: '운평장로교회', retired: '2023. 06. 17' },
    { name: '김삼성', church: '새솔제일교회', retired: '2023. 10. 28' }
  ],
  retiredPastors: [
    { name: '김해수', church: '목자교회' }
  ],
  pastors: [
    { name: '박현정', church: '율리교회' }, { name: '강명우', church: '반석교회' },
    { name: '임동준', church: '새힘교회' }, { name: '서용호', church: '수암제일교회' },
    { name: '문광선', church: '새누리교회' }, { name: '박재완', church: '수암새권능교회' },
    { name: '박양수', church: '힘찬교회' }, { name: '송기태', church: '새날선교교회' },
    { name: '박흥열', church: '시흥생수교회' }, { name: '주강완', church: '서신영광교회' },
    { name: '이재용', church: '안산상록교회' }, { name: '김선민', church: '나눔의교회' },
    { name: '전종호', church: '동탄인랜드교회' }, { name: '김성중', church: '한숲우리교회' },
    { name: '권병렬', church: '섬김의교회' }, { name: '안상천', church: '참된빛교회' },
    { name: '이성대', church: '새생명교회' }, { name: '명영석', church: '행복한교회' },
    { name: '김지수', church: '반월교회' }, { name: '백용선', church: '노진교회' },
    { name: '김종수', church: '섬기는교회' }, { name: '이동진', church: '동탄영광교회' },
    { name: '유성준', church: '주품에교회' }, { name: '김영돈', church: '안산원곡동교회' },
    { name: '김운갑', church: '시흥은혜교회' }, { name: '장정훈', church: '아름다운숲교회' },
    { name: '한동준', church: '은광교회' }, { name: '김동석', church: '운평장로교회' },
    { name: '손영득', church: '새솔제일교회' }, { name: '송요한', church: '안산샬롬교회' },
    { name: '김성신', church: '연수교회' }, { name: '정주원', church: '주말씀교회' },
    { name: '제갈광철', church: '예전교회' }, { name: '문태환', church: '성산교회' }
  ],
  assocPastors: [
    { name: '박규태', church: '반월교회' }, { name: '조능', church: '반월교회' },
    { name: '김하진', church: '섬기는교회' }, { name: '박상우', church: '시흥생수교회' },
    { name: '오윤석', church: '안산상록교회' }, { name: '박희원', church: '반월교회' }
  ],
  pastorsWithoutCharge: [
    '유충근', '박지만', '이병준', '이현철', '서기영', '정해정',
    '김익환', '안상환', '김영창', '안창선', '주재경'
  ],
  elders: {
    '북부시찰': [
      { name: '박영수', church: '안산샬롬교회' }, { name: '유승열', church: '시흥생수교회' },
      { name: '장경환', church: '새날선교교회' }, { name: '이재복', church: '안산상록교회' },
      { name: '김성훈', church: '목자교회' }, { name: '박아론', church: '수암새권능교회' },
      { name: '윤성복', church: '섬기는교회' }, { name: '고동욱', church: '섬기는교회' },
      { name: '김완수', church: '섬김의교회' }, { name: '김성조', church: '새힘교회' },
      { name: '장명국', church: '안산원곡동교회' }
    ],
    '상록시찰': [
      { name: '김창룡', church: '반월교회' }, { name: '정재영', church: '반월교회' },
      { name: '김상진', church: '반월교회' }, { name: '김영우', church: '새솔제일교회' },
      { name: '윤위석', church: '은광교회' }, { name: '김득철', church: '은광교회' },
      { name: '김종서', church: '힘찬교회' }, { name: '이신영', church: '수암제일교회' },
      { name: '송언빈', church: '서안문호교회' }
    ],
    '남부시찰': [
      { name: '문명수', church: '노진교회' }, { name: '안태성', church: '반석교회' },
      { name: '백윤복', church: '성산교회' }, { name: '김종관', church: '연수교회' },
      { name: '신용화', church: '운평장로교회' }, { name: '허경하', church: '한숲우리교회' }
    ]
  },

  /* ---------- 시찰회 ---------- */
  sichals: [
    {
      name: '북부시찰',
      area: '안산시 단원구와 시흥시 일부 지역',
      head: '김종수 목사(섬기는교회)',
      clerk: '김영돈 목사', treasurer: '김운갑 목사',
      churches: [
        '목자교회', '새날선교교회', '새누리교회', '새생명교회', '새힘교회',
        '섬기는교회', '섬김의교회', '수암새권능교회', '시흥생수교회', '시흥은혜교회',
        '안산샬롬교회', '안산상록교회', '안산원곡동교회', '참된빛교회', '예전교회'
      ]
    },
    {
      name: '상록시찰',
      area: '안산시 상록구와 수원시 일부 지역',
      head: '한동준 목사(은광교회)',
      clerk: '정주원 목사', treasurer: '김득철 장로',
      churches: [
        '반월교회', '새솔제일교회', '서신영광교회', '수암제일교회',
        '은광교회', '힘찬교회', '서안문호교회', '주말씀교회'
      ]
    },
    {
      name: '남부시찰',
      area: '화성시 지역과 오산시 일부, 용인시 일부 지역',
      head: '김성중 목사(한숲우리교회)',
      clerk: '이동진 목사', treasurer: '장정훈 목사',
      churches: [
        '나눔의교회', '노진교회', '동탄영광교회', '동탄인랜드교회', '반석교회',
        '성산교회', '아름다운숲교회', '연수교회', '운평장로교회', '율리교회',
        '주품에교회', '한숲우리교회', '행복한교회', '경기은목교회', '꿈꾸는작은교회'
      ]
    }
  ],

  /* ---------- 상비부 (제19회 정기노회 공천 인준 및 조직보고) ---------- */
  committees: [
    { name: '감사헌의부', duty: '각 시찰회를 경유하여 제출된 각종 서류를 심의하여 본회에 상정하며, 노회 회의록·회계장부·각 상비부 회의록 및 재정장부·지교회 당회록을 감사한다.',
      head: '이재용 목사', clerk: '문태환 목사', treasurer: '백윤복 장로',
      y1: '이재용, 주강완, 박영수, 김완수', y2: '송기태, 김종서', y3: '박상우, 백윤복, 김성조, 문태환' },
    { name: '정치부', duty: '본회가 위임하는 회원심사 및 정치에 관한 사항을 심의 보고한다.',
      head: '김성중 목사', clerk: '서용호 목사', treasurer: '정재영 장로',
      y1: '서용호, 김지수, 윤위석', y2: '김성중, 정재영', y3: '김종수, 김영돈' },
    { name: '고시규칙부', duty: '본회에서 시행하는 각종 고시에 관한 일체를 시행하며 그 결과를 보고하고, 본회의 규칙에 관한 일체를 담당한다.',
      head: '박재완 목사', clerk: '한동준 목사', treasurer: '장정훈 목사',
      y1: '박재완, 문광선', y2: '유성준', y3: '한동준, 장정훈' },
    { name: '재정부', duty: '본회의 재정에 관한 일체를 담당한다.',
      head: '이신영 장로', clerk: '명영석 목사', treasurer: '김득철 장로',
      y1: '명영석, 송언빈, 박아론, 이신영', y2: '유승열, 김득철, 고동욱', y3: '오윤석, 제갈광철, 김하진' },
    { name: '교육친교부', duty: '본회의 교육사업 일체와 주일학교연합회·중고등부 교육사업, 교역자 보수교육, 회원 상호간의 친교와 체육행사 일체를 담당한다.',
      head: '강명우 목사', clerk: '김창룡 장로', treasurer: '안상천 목사',
      y1: '강명우, 이동진, 장경환', y2: '김창룡, 조능, 김종관, 안상천, 김동석', y3: '김선민, 김성훈' },
    { name: '전도선교부', duty: '본회의 전도사업 일체, 남녀전도회 사업감독과 미자립교회·개척교회 지원, 국내외 선교 및 특수분야 선교 일체를 담당한다.',
      head: '박현정 목사', clerk: '송요한 목사', treasurer: '윤성복 장로',
      y1: '김성신, 이재복, 송요한', y2: '김운갑, 정주원, 허경하, 박희원, 박현정', y3: '박규태, 윤성복, 이성대' },
    { name: '사회복지부', duty: '본회가 일임한 사회복지·구제사업, 회원의 후생사업 및 장례 일체를 담당하며, 회원 예우와 애경사는 내규로 정한다.',
      head: '박양수 목사', clerk: '손영득 목사', treasurer: '김영우 장로',
      y1: '박양수, 임동준, 신용화', y2: '전종호, 김영우, 문명수', y3: '손영득, 김상진, 장명국, 안태성' }
  ],

  /* ---------- 공지사항 ---------- */
  notices: [
    { id: 7, cat: '소식', title: '제19회 정기노회 폐회 및 신임 임원 선출 (노회장 박흥열 목사)', date: '2026-04-13',
      body: '제19회 정기노회가 2026년 4월 13일(월) 섬기는교회에서 회집되어 은혜 가운데 폐회하였습니다. 신임 임원으로 노회장 박흥열 목사, 부노회장 이재용 목사·이신영 장로, 서기 권병렬 목사, 부서기 김동석 목사, 회록서기 김지수 목사, 부회록서기 손영득 목사, 회계 김득철 장로, 부회계 고동욱 장로가 선출되었습니다. 회의록은 임원방에서 열람할 수 있습니다.' },
    { id: 1, cat: '공지', title: '제19회 정기노회 소집 안내 (2026. 4. 13. 섬기는교회)', date: '2026-03-16',
      body: '제19회 정기노회를 2026년 4월 13일(월) 오전 10시 섬기는교회(화성특례시 수노을2로 15)에서 소집합니다. 각종 청원서는 서식대로 당회장이 각 시찰회의 진단을 거쳐 제출해 주시기 바라며, 각 시찰 서기는 청원서를 3월 25일(수)까지 노회 서기에게 접수해 주시기 바랍니다.' },
    { id: 2, cat: '공지', title: '상회비 및 세례교인헌금 납부 안내', date: '2026-03-16',
      body: '각 지교회 상회비와 세례교인헌금은 3월 25일(수)까지 납부해 주시기 바랍니다. 노회규칙 제9장 제29조에 따라 미납교회는 서류 접수 및 발급이 보류됩니다. 상회비 입금계좌: 농협 351-1015-8676-63 (시화산노회)' },
    { id: 3, cat: '안내', title: '상비부 사전모임 일정 안내', date: '2026-03-16',
      body: '고시규칙부 3월 30일(월) 오전 9:30, 감사헌의부 3월 30일(월) 오후 1시~4시, 정치부 3월 30일(월) 오후 3시, 공천부 3월 30일(월) 오전 11시, 재정부 4월 6일(월) 오전 11시. 장소는 모두 노회사무실입니다.' },
    { id: 4, cat: '안내', title: '2026년 교세통계보고서 제출 안내', date: '2026-03-16',
      body: '총회 홈페이지를 통해 2026년 교세통계보고서를 각 지교회별로 보고해 주시기 바랍니다.' },
    { id: 5, cat: '소식', title: '장로고시 합격자 발표', date: '2025-12-12',
      body: '2025년 12월 12일(금) 노회사무실에서 실시한 장로고시에 2명이 응시하여 다음과 같이 합격하였습니다. 합격자: 안태성(반석교회), 김명관(반석교회)' },
    { id: 6, cat: '소식', title: '안산샬롬교회 송요한 목사 위임식 안내', date: '2026-03-20',
      body: '안산샬롬교회 송요한 목사 위임식이 2026년 4월 25일(토) 오전 11시에 거행됩니다. 노회원 여러분의 축하와 기도를 부탁드립니다.' }
  ],

  /* ---------- 일정 ---------- */
  schedule: [
    { date: '3.25', title: '청원서 접수 마감 · 상회비 납부 기한' },
    { date: '3.30', title: '상비부 사전모임 (노회사무실)' },
    { date: '4.6', title: '재정부 모임 (노회사무실)' },
    { date: '4.13', title: '제19회 정기노회 (섬기는교회)' },
    { date: '4.25', title: '안산샬롬교회 송요한 목사 위임식' }
  ],


  /* ---------- 자료실 목록 ---------- */
  archives: [
    { title: '제19회 정기노회 회의록 (2026. 4. 13)', date: '2026-04-13', type: '회의록', officerOnly: true,
      desc: '제19회 정기노회 회의록 전문입니다. 노회 임원(노회장·서기·간사)과 최고관리자만 열람할 수 있습니다.', href: 'minutes.html' },
    { title: '제19회 정기노회(봄) 회의자료', date: '2026-04-13', type: '회의자료', memberOnly: false,
      desc: '제19회 정기노회 회의순서, 회원명단, 각 부 보고서, 노회규칙 전문이 수록된 회의자료입니다.' },
    { title: '제19회기 임원회 결의사항 모음', date: '2026-04-13', type: '결의사항', memberOnly: true,
      desc: '제19회기 제1차부터 제7차까지 임원회의 주요 결의사항입니다. 정회원 로그인 후 열람할 수 있습니다.' },
    { title: '제19회 정기노회 헌의안건', date: '2026-04-13', type: '결의사항', memberOnly: true,
      desc: '감사헌의부가 본회에 상정한 제19회 정기노회 헌의안건 목록입니다.' },
    { title: '노회규칙 (2025. 10. 13. 개정)', date: '2025-10-13', type: '규칙', memberOnly: false,
      desc: '시화산노회 규칙 전문(제12장 제41조)입니다. 노회 회칙 페이지에서 열람할 수 있습니다.' },
    { title: '미래교회자립위원회 내규', date: '2025-10-13', type: '내규', memberOnly: false,
      desc: '미자립교회 지원과 관련한 제반 정책 및 시행 사항을 정한 내규입니다.' },
    { title: '선거관리위원회 내규', date: '2025-04-21', type: '내규', memberOnly: false,
      desc: '노회 임원과 총대 선출에 관한 선거 규약입니다.' },
    { title: '사회복지부 내규 (장례에 관한 내규)', date: '2023-10-10', type: '내규', memberOnly: false,
      desc: '회원 예우와 장례에 관한 사회복지부 내규입니다.' },
    { title: '구비서류 및 사무규정', date: '2026-04-13', type: '서식', memberOnly: false,
      desc: '청빙·고시·추천·이명 등 각종 청원 시 구비서류 안내입니다.' },
    { title: '각종 청원 서식 모음', date: '2026-04-13', type: '서식', memberOnly: true,
      desc: '청빙청원서, 고시청원서, 이명 청원서 등 노회 행정 서식 모음입니다.' }
  ],

  /* ---------- 갤러리 ---------- */
  gallery: [
    { img: 'images/gallery/photo01.jpg', thumb: 'images/gallery/thumb01.jpg', title: '노회원 수련회', date: '2024년 6월' },
    { img: 'images/gallery/photo02.jpg', thumb: 'images/gallery/thumb02.jpg', title: '노회원 수련회', date: '2024년 6월' },
    { img: 'images/gallery/photo03.jpg', thumb: 'images/gallery/thumb03.jpg', title: '노회원 수련회', date: '2024년 6월' },
    { img: 'images/gallery/photo04.jpg', thumb: 'images/gallery/thumb04.jpg', title: '노회원 수련회', date: '2024년 6월' },
    { img: 'images/gallery/photo05.jpg', thumb: 'images/gallery/thumb05.jpg', title: '노회원 수련회', date: '2024년 6월' },
    { img: 'images/gallery/photo06.jpg', thumb: 'images/gallery/thumb06.jpg', title: '노회원 수련회', date: '2024년 6월' },
    { img: 'images/gallery/photo07.jpg', thumb: 'images/gallery/thumb07.jpg', title: '노회원 수련회', date: '2024년 6월' },
    { img: 'images/gallery/photo08.jpg', thumb: 'images/gallery/thumb08.jpg', title: '노회원 수련회', date: '2024년 6월' },
    { img: 'images/gallery/photo09.jpg', thumb: 'images/gallery/thumb09.jpg', title: '노회원 수련회', date: '2024년 6월' },
    { img: 'images/gallery/photo10.jpg', thumb: 'images/gallery/thumb10.jpg', title: '노회원 수련회', date: '2024년 6월' },
    { img: 'images/gallery/photo11.jpg', thumb: 'images/gallery/thumb11.jpg', title: '노회원 수련회', date: '2024년 6월' },
    { img: 'images/gallery/photo12.jpg', thumb: 'images/gallery/thumb12.jpg', title: '노회원 수련회', date: '2024년 6월' }
  ]
};
