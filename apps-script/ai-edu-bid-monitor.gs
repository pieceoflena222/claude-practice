/**
 * ============================================================
 *  AI 교육 공공입찰 모니터링 봇  (Google Apps Script)
 * ------------------------------------------------------------
 *  대상: AI 교육을 하는 개인사업자(1인 강사·소규모 교육기업)
 *
 *  하는 일:
 *   나라장터 용역 입찰공고 조회
 *   → "AI·디지털 주제" + "교육·강의 형태"가 함께 있는 공고만 선별
 *   → 개인사업자가 참여하기 어려운 대형 사업은 금액 기준으로 제외
 *   → 이미 본 공고는 제외
 *   → 새 공고만 이메일로 알림
 *
 *  운영 원칙:
 *   - 트리거에는 checkNewBids 함수만 연결
 *   - resetSeenForTest는 테스트할 때만 수동 실행
 *   - forceSendLatestMatchedForTest는 시연용 강제 발송
 * ============================================================
 */


// ===========================================================
//  ① 여기만 내 상황에 맞게 수정
// ===========================================================

// 공공데이터포털에서 받은 '인코딩 인증키'를 붙여넣으세요.
// ※ 인증키가 들어간 코드는 GitHub 등 공개된 곳에 올리지 마세요.
const SERVICE_KEY = '여기에_인코딩_인증키를_붙여넣으세요';

// 나라장터 입찰공고정보서비스 - 용역조회
const API_URL = 'https://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoServc';

// 알림 받을 이메일 (비워 두면 스크립트를 실행한 구글 계정으로 발송)
const NOTIFY_EMAIL = '';

// 최근 며칠 치를 조회할지
const LOOKBACK_DAYS = 1;

// 메일 본문에 표시할 최대 공고 수
const MAX_EMAIL_ITEMS = 30;

// 평소 false 권장. true면 새 공고가 0건이어도 상태 메일이 옵니다.
const SEND_ZERO_RESULT_EMAIL_FOR_TEST = false;

// 필터 기준 점수
// 관련 없는 공고가 많으면 10으로 올리고, 너무 안 잡히면 6으로 낮추세요.
const MIN_RELEVANCE_SCORE = 8;

// 개인사업자가 현실적으로 참여 가능한 사업 규모 (원, 추정가격 기준)
// - 이 금액을 넘는 공고는 제외합니다. 0으로 두면 금액 제한 없음.
// - 금액 정보가 없는 공고는 제외하지 않습니다.
const MAX_BUDGET_KRW = 100000000;   // 1억 원

// 이 금액 이하인 소규모 사업은 가점 (1인 견적·소액수의 가능성이 높은 구간)
const SMALL_BUDGET_KRW = 50000000;  // 5천만 원

// 지역 제한은 기본적으로 쓰지 않습니다.
// 소액 공고는 '사업장 소재지'로 참가를 제한하는 경우가 많으니,
// 특정 지역만 보고 싶으면 예: ['서울', '경기'] 처럼 넣으세요.
const REGIONS = [];


// ===========================================================
//  ② AI 교육 관련 키워드
// ===========================================================

// [주제] AI·디지털 관련 키워드 — 무엇을 가르치는가
const AI_TOPIC_KEYWORDS = [
  'AI',
  '인공지능',
  '생성형',
  '생성AI',
  '챗GPT',
  '챗지피티',
  'ChatGPT',
  'GPT',
  'LLM',
  '거대언어모델',
  '프롬프트',
  '코파일럿',
  'Copilot',
  '제미나이',
  'Gemini',
  '클로드',
  '머신러닝',
  '딥러닝',
  '디지털',
  '디지털전환',
  'DX',
  '디지털역량',
  '디지털리터러시',
  '디지털 리터러시',
  'AI리터러시',
  'AI 리터러시',
  '데이터',
  '데이터분석',
  '데이터 분석',
  '빅데이터',
  '업무자동화',
  '업무 자동화',
  '자동화',
  'RPA',
  '노코드',
  '로우코드',
  '코딩',
  'SW교육',
  'SW 교육',
  '소프트웨어교육',
  '소프트웨어 교육',
  '에듀테크',
  '메타버스',
  '스마트워크',
  '엑셀',
  '파이썬',
  'Python'
];

// [형태] 교육·강의 관련 키워드 — 어떤 방식의 과업인가
const EDU_FORMAT_KEYWORDS = [
  '교육',
  '강의',
  '특강',
  '강좌',
  '강사',
  '연수',
  '워크숍',
  '워크샵',
  '세미나',
  '아카데미',
  '캠프',
  '과정',
  '교육과정',
  '교육운영',
  '위탁교육',
  '위탁운영',
  '역량강화',
  '역량 강화',
  '직무교육',
  '재직자',
  '리스킬링',
  '업스킬링',
  '멘토링',
  '코칭',
  '컨설팅',
  '해커톤',
  '경진대회',
  '체험',
  '교재',
  '콘텐츠 개발',
  '이러닝',
  'e-러닝',
  '양성'
];

// 제목에 이 표현이 있으면 AI 교육 공고일 가능성이 매우 높음 (가점)
const STRONG_PHRASES = [
  'AI교육',
  'AI 교육',
  '인공지능교육',
  '인공지능 교육',
  '생성형AI 교육',
  '생성형 AI 교육',
  '생성형 AI 활용',
  '생성형AI 활용',
  'AI 활용 교육',
  'AI활용교육',
  'AI 활용',
  'AI활용',
  '디지털 역량',
  '디지털역량',
  '디지털 교육',
  '디지털교육',
  '디지털 배움터',
  '디지털배움터',
  'AI 역량',
  'AI역량',
  'AI 리터러시',
  'AI리터러시',
  'AI 인재',
  'AI인재',
  '챗GPT 활용',
  'ChatGPT 활용',
  '업무자동화 교육',
  'SW·AI',
  'SW/AI'
];

// 교육 수요가 많은 발주기관 키워드 (가점)
const AGENCY_KEYWORDS = [
  '교육청',
  '교육지원청',
  '대학교',
  '대학',
  '평생교육',
  '평생학습',
  '인재개발원',
  '공무원교육원',
  '연수원',
  '교육원',
  '도서관',
  '청소년',
  '진흥원',
  '진흥공단',
  '한국지능정보사회진흥원',
  'NIA',
  '정보통신산업진흥원',
  'NIPA',
  '한국교육학술정보원',
  'KERIS',
  '소상공인시장진흥공단',
  '창업진흥원',
  '한국산업인력공단',
  '중소벤처기업',
  '고용노동부',
  '고용센터',
  '일자리',
  '여성인력개발센터',
  '새일센터',
  '테크노파크',
  '상공회의소',
  '문화재단',
  '시청',
  '군청',
  '구청',
  '도청'
];

// 교육 공고지만 AI 교육과 무관한 경우 (강하게 제외)
const HARD_EXCLUDE_KEYWORDS = [
  '안전교육',
  '안전보건교육',
  '소방교육',
  '위생교육',
  '성희롱',
  '성폭력',
  '성범죄',
  '폭력예방',
  '장애인식',
  '인권교육',
  '청렴교육',
  '심폐소생',
  '운전교육',
  '수영',
  '체육',
  '승마',
  '요리',
  '조리',
  '급식',
  '예비군',
  '민방위',
  '공사',
  '설계',
  '감리',
  '건축',
  '토목',
  '측량'
];

// AI 교육과 거리가 먼 과업 (감점)
const SOFT_EXCLUDE_KEYWORDS = [
  '시스템 구축',
  '시스템구축',
  '시스템 개발',
  '플랫폼 구축',
  '구축사업',
  '고도화',
  '유지관리',
  '유지보수',
  '운영유지',
  '데이터베이스 구축',
  'DB구축',
  '데이터 구축',
  '데이터구축',
  '라벨링',
  '전산장비',
  '서버',
  '네트워크',
  '보안관제',
  '청소',
  '경비',
  '시설관리',
  '폐기물',
  '방역',
  '조경',
  '인쇄',
  '차량임차',
  '보험',
  '회계감사'
];


// ===========================================================
//  ③ 메인 함수 — 트리거에는 이 함수만 연결
// ===========================================================

function checkNewBids() {
  try {
    Logger.log('===== AI 교육 공공입찰 모니터링 시작 =====');
    Logger.log('알림 이메일: ' + getNotifyEmail_());
    Logger.log('조회 기간: 최근 ' + LOOKBACK_DAYS + '일');
    Logger.log('관련성 최소 점수: ' + MIN_RELEVANCE_SCORE);
    Logger.log('최대 사업 금액: ' + (MAX_BUDGET_KRW ? formatWon_(MAX_BUDGET_KRW) : '제한 없음'));

    var items = fetchBids_();
    Logger.log('1) API에서 받은 전체 공고 수: ' + items.length);

    var matched = filterBids_(items);
    Logger.log('2) 정밀 필터 통과: ' + matched.length);

    var fresh = removeSeen_(matched);
    Logger.log('3) 중복 제거 후 새 공고: ' + fresh.length);

    if (fresh.length > 0) {
      var sent = sendEmail_(fresh);

      if (sent) {
        markSeen_(fresh);
        Logger.log('4) 중복 기록 저장 완료: ' + fresh.length + '건');
      }
    } else {
      Logger.log('새 공고가 없어 이메일을 발송하지 않았습니다.');

      if (SEND_ZERO_RESULT_EMAIL_FOR_TEST) {
        sendStatusEmail_(
          '[AI 교육 공공입찰] 새 공고 없음',
          '이번 실행에서는 새 관심 공고가 없습니다.\n\n' +
          'API 전체 공고 수: ' + items.length + '\n' +
          '정밀 필터 통과 공고 수: ' + matched.length + '\n' +
          '중복 제거 후 새 공고 수: ' + fresh.length
        );
      }
    }

    Logger.log('처리 완료 — 새 공고 ' + fresh.length + '건');
    Logger.log('===== AI 교육 공공입찰 모니터링 종료 =====');

  } catch (e) {
    Logger.log('오류 발생: ' + e.message);

    try {
      sendStatusEmail_(
        '[오류] AI 교육 공공입찰 모니터링 실패',
        '스크립트 실행 중 오류가 발생했습니다.\n\n' +
        '오류 메시지:\n' + e.message
      );
    } catch (mailError) {
      Logger.log('오류 알림 메일 발송도 실패: ' + mailError.message);
    }

    throw e;
  }
}


function getNotifyEmail_() {
  return NOTIFY_EMAIL || Session.getEffectiveUser().getEmail();
}


// ===========================================================
//  ④ 진단용 함수
// ===========================================================

function showDiagnostics() {
  Logger.log('===== 진단 정보 =====');
  Logger.log('알림 이메일: ' + getNotifyEmail_());
  Logger.log('현재 실행 계정: ' + Session.getEffectiveUser().getEmail());
  Logger.log('남은 일일 메일 발송 가능 수: ' + MailApp.getRemainingDailyQuota());

  var sheet = getSeenSheet_();
  Logger.log('중복 기록 시트 URL: ' + sheet.getParent().getUrl());
  Logger.log('중복 기록 행 수: ' + Math.max(sheet.getLastRow() - 1, 0));
  Logger.log('=====================');
}


function testEmail() {
  var to = getNotifyEmail_();
  Logger.log('테스트 이메일 발송 시도: ' + to);
  Logger.log('남은 일일 메일 발송 가능 수: ' + MailApp.getRemainingDailyQuota());

  MailApp.sendEmail({
    to: to,
    subject: '[테스트] Apps Script 메일 발송 확인',
    body:
      '이 메일이 도착하면 Apps Script의 MailApp 발송 기능은 정상입니다.\n\n' +
      '발송 대상: ' + to + '\n' +
      '실행 계정: ' + Session.getEffectiveUser().getEmail(),
    name: 'Apps Script 테스트'
  });

  Logger.log('테스트 이메일 발송 완료: ' + to);
}


// ===========================================================
//  ⑤ API에서 공고 목록 가져오기
// ===========================================================

function fetchBids_() {
  var tz = 'Asia/Seoul';
  var now = new Date();
  var from = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  var bgn = Utilities.formatDate(from, tz, 'yyyyMMddHHmm');
  var end = Utilities.formatDate(now, tz, 'yyyyMMddHHmm');

  var allItems = [];
  var pageNo = 1;
  var numOfRows = 100;
  var maxPages = 20;

  while (pageNo <= maxPages) {
    var url = API_URL
      + '?inqryDiv=1'
      + '&type=json'
      + '&pageNo=' + pageNo
      + '&numOfRows=' + numOfRows
      + '&inqryBgnDt=' + bgn
      + '&inqryEndDt=' + end
      + '&ServiceKey=' + SERVICE_KEY;

    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var code = res.getResponseCode();
    var body = res.getContentText();

    if (code !== 200) {
      throw new Error('API 응답 오류 HTTP ' + code + ': ' + body.slice(0, 500));
    }

    var json;

    try {
      json = JSON.parse(body);
    } catch (e) {
      throw new Error('JSON 파싱 실패. 응답 원문 앞부분: ' + body.slice(0, 800));
    }

    if (json && json.cmmMsgHeader) {
      throw new Error('API 인증/요청 오류: ' + JSON.stringify(json.cmmMsgHeader));
    }

    if (pageNo === 1) {
      Logger.log('요청 URL 키 가림: ' + url.replace(SERVICE_KEY, '(키생략)'));
    }

    var header = json && json.response && json.response.header;

    if (header && header.resultCode && header.resultCode !== '00') {
      throw new Error(
        'API 오류 응답 — resultCode: ' + header.resultCode +
        ', resultMsg: ' + header.resultMsg
      );
    }

    var bodyData = json && json.response && json.response.body;
    var rawItems = bodyData && bodyData.items;
    var totalCount = bodyData && Number(bodyData.totalCount) || 0;

    if (pageNo === 1) {
      Logger.log('API totalCount 전체 검색결과: ' + totalCount);
    }

    if (!rawItems) {
      break;
    }

    var items = rawItems.item || rawItems;

    if (!Array.isArray(items)) {
      items = [items];
    }

    allItems = allItems.concat(items);

    if (items.length < numOfRows || allItems.length >= totalCount) {
      break;
    }

    pageNo++;
  }

  return allItems;
}


// ===========================================================
//  ⑥ 정밀 필터링
// ===========================================================

function filterBids_(items) {
  var filtered = [];

  items.forEach(function (it) {
    var analysis = analyzeBid_(it);

    if (analysis.include) {
      it.__score = analysis.score;
      it.__matchedKeywords = analysis.matchedKeywords;
      it.__budget = analysis.budget;
      it.__reason = analysis.reason;
      filtered.push(it);
    }
  });

  filtered.sort(function (a, b) {
    return (b.__score || 0) - (a.__score || 0);
  });

  return filtered;
}


function analyzeBid_(it) {
  var title = it.bidNtceNm || '';
  var orgText = (it.ntceInsttNm || '') + ' ' + (it.dminsttNm || '');

  // JSON 전체(필드명 포함)를 검색하면 'email' 안의 'ai'처럼 엉뚱한 매칭이 생기므로
  // 공고 내용을 담은 필드 값만 모아서 검색합니다.
  var bodyText = [
    title,
    it.pubPrcrmntClsfcNm,   // 공공조달분류명
    it.srvceDivNm,          // 용역구분명
    it.cntrctCnclsMthdNm,   // 계약체결방법명
    it.bidMethdNm           // 입찰방식명
  ].join(' ');

  var budget = getBudget_(it);

  var titleTopic = getMatches_(title, AI_TOPIC_KEYWORDS);
  var bodyTopic = getMatches_(bodyText, AI_TOPIC_KEYWORDS);
  var titleEdu = getMatches_(title, EDU_FORMAT_KEYWORDS);
  var bodyEdu = getMatches_(bodyText, EDU_FORMAT_KEYWORDS);
  var strong = getMatches_(title, STRONG_PHRASES);
  var agency = getMatches_(orgText, AGENCY_KEYWORDS);
  var hardExclude = getMatches_(title, HARD_EXCLUDE_KEYWORDS);
  var softExclude = getMatches_(title, SOFT_EXCLUDE_KEYWORDS);

  var score = 0;

  score += titleTopic.length * 4;   // 제목에 AI·디지털 주제
  score += bodyTopic.length * 1;
  score += titleEdu.length * 3;     // 제목에 교육·강의 형태
  score += bodyEdu.length * 1;
  score += strong.length * 5;       // 'AI 교육' 같은 결합 표현
  score += Math.min(agency.length, 2) * 2;  // 교육 수요 기관

  // 개인사업자에게 맞는 소규모 사업이면 가점
  if (budget > 0 && budget <= SMALL_BUDGET_KRW) {
    score += 3;
  }

  // 소액수의·견적 공고는 1인 사업자도 접근하기 쉬움
  if (containsText_(it.cntrctCnclsMthdNm, '수의') || containsText_(title, '견적')) {
    score += 2;
  }

  score -= softExclude.length * 4;

  var hasTopic = titleTopic.length > 0 || strong.length > 0;
  var hasEdu = titleEdu.length > 0 || bodyEdu.length > 0 || strong.length > 0;
  var budgetOk = !MAX_BUDGET_KRW || budget === 0 || budget <= MAX_BUDGET_KRW;

  var regionOk = true;
  if (REGIONS.length > 0) {
    var regionText = objectValuesText_(it);
    regionOk = REGIONS.some(function (r) {
      return containsText_(regionText, r);
    });
  }

  // 필수 조건:
  // 1) 제목에 AI·디지털 주제가 있고
  // 2) 교육·강의 형태의 과업이며
  // 3) 무관한 교육(안전·성희롱 예방 등)이 아니고
  // 4) 금액·지역 조건이 맞고
  // 5) 점수가 기준 이상
  var include =
    hasTopic &&
    hasEdu &&
    hardExclude.length === 0 &&
    budgetOk &&
    regionOk &&
    score >= MIN_RELEVANCE_SCORE;

  var matched = uniqueArray_(strong.concat(titleTopic, bodyTopic, titleEdu, bodyEdu, agency));

  return {
    include: include,
    score: score,
    budget: budget,
    matchedKeywords: matched,
    reason: (include ? '관련성 점수 ' : '제외 / 점수 ') + score + '점'
  };
}


// 추정가격 → 배정예산 → 기초금액 순으로 금액을 찾습니다. 없으면 0.
function getBudget_(it) {
  var fields = ['presmptPrce', 'asignBdgtAmt', 'bssamt'];

  for (var i = 0; i < fields.length; i++) {
    var n = Number(String(it[fields[i]] || '').replace(/[^0-9.]/g, ''));
    if (n > 0) return n;
  }

  return 0;
}


// 영문 약어(AI, GPT, DX 등)는 단어 경계로, 한글은 포함 여부로 매칭합니다.
// 예: 'AI'는 'AI교육', '생성형 AI'와는 맞고 'MAIL', 'DETAIL'과는 맞지 않습니다.
function getMatches_(text, keywords) {
  var source = String(text || '');
  var lower = source.toLowerCase();
  var result = [];

  keywords.forEach(function (k) {
    var keyword = String(k || '');
    if (!keyword) return;

    var hit;
    if (/^[A-Za-z0-9\-\/·]+$/.test(keyword)) {
      var escaped = keyword.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
      hit = new RegExp('(^|[^A-Za-z])' + escaped + '($|[^A-Za-z])', 'i').test(source);
    } else {
      hit = lower.indexOf(keyword.toLowerCase()) !== -1;
    }

    if (hit) result.push(k);
  });

  return uniqueArray_(result);
}


function containsText_(text, keyword) {
  return String(text || '').toLowerCase().indexOf(String(keyword || '').toLowerCase()) !== -1;
}


function objectValuesText_(obj) {
  return Object.keys(obj)
    .filter(function (k) { return k.indexOf('__') !== 0; })
    .map(function (k) { return obj[k]; })
    .join(' ');
}


function uniqueArray_(arr) {
  var map = {};
  var result = [];

  arr.forEach(function (v) {
    if (v && !map[v]) {
      map[v] = true;
      result.push(v);
    }
  });

  return result;
}


function formatWon_(n) {
  if (!n) return '미기재';
  if (n >= 100000000) return (Math.round(n / 1000000) / 100) + '억 원';
  if (n >= 10000) return Math.round(n / 10000).toLocaleString('ko-KR') + '만 원';
  return n.toLocaleString('ko-KR') + '원';
}


// ===========================================================
//  ⑦ 이미 본 공고 제외
// ===========================================================

function removeSeen_(items) {
  var seen = getSeenSet_();

  return items.filter(function (it) {
    var key = getBidKey_(it);
    return key && !seen[key];
  });
}


function getBidKey_(it) {
  var bidNo = it.bidNtceNo || '';
  var bidOrd = it.bidNtceOrd || '';

  if (bidNo) {
    return bidNo + '_' + bidOrd;
  }

  return (it.bidNtceNm || '') + '_' + (it.bidNtceDt || '');
}


// ===========================================================
//  ⑧ 이메일 발송
// ===========================================================

function sendEmail_(items) {
  if (!items || items.length === 0) {
    Logger.log('이메일 발송 생략: 보낼 공고가 없습니다.');
    return false;
  }

  var to = getNotifyEmail_();
  Logger.log('이메일 발송 시도: ' + to + ' / 공고 ' + items.length + '건');
  Logger.log('남은 일일 메일 발송 가능 수: ' + MailApp.getRemainingDailyQuota());

  var displayItems = items.slice(0, MAX_EMAIL_ITEMS);
  var subject = '[AI 교육 공공입찰] 새 관심 공고 ' + items.length + '건';

  var plainText = '';
  plainText += 'AI 교육 공공입찰 모니터링 결과\n\n';
  plainText += 'AI 교육 개인사업자가 참여해 볼 만한 새 공고 ' + items.length + '건이 확인되었습니다.\n';
  plainText += '메일 본문에는 최대 ' + MAX_EMAIL_ITEMS + '건까지 표시됩니다.\n\n';

  displayItems.forEach(function (it, i) {
    plainText += (i + 1) + '. ' + (it.bidNtceNm || '(공고명 없음)') + '\n';
    plainText += '기관: ' + (it.ntceInsttNm || it.dminsttNm || '') + '\n';
    plainText += '추정가격: ' + formatWon_(it.__budget) + '\n';
    plainText += '계약방법: ' + (it.cntrctCnclsMthdNm || '') + '\n';
    plainText += '공고일: ' + (it.bidNtceDt || '') + '\n';
    plainText += '마감일: ' + (it.bidClseDt || it.opengDt || '') + '\n';
    plainText += '관련성 점수: ' + (it.__score || '') + '\n';
    plainText += '매칭 키워드: ' + (it.__matchedKeywords || []).join(', ') + '\n';
    plainText += '상세: ' + (it.bidNtceDtlUrl || '') + '\n\n';
  });

  if (items.length > MAX_EMAIL_ITEMS) {
    plainText += '※ 전체 ' + items.length + '건 중 ' + MAX_EMAIL_ITEMS + '건만 표시했습니다.\n';
  }

  var html = '';
  html += '<h2>AI 교육 공공입찰 모니터링 결과</h2>';
  html += '<p>나라장터 용역 공고 중 <b>AI·디지털 주제의 교육·강의 과업</b>이면서 ';
  html += '개인사업자가 참여 가능한 규모의 공고만 골라낸 결과입니다.</p>';
  html += '<p><b>총 새 관심 공고:</b> ' + items.length + '건</p>';
  html += '<p style="color:#666;">관련성 점수 기준: ' + MIN_RELEVANCE_SCORE + '점 이상 / ';
  html += '사업 금액: ' + (MAX_BUDGET_KRW ? formatWon_(MAX_BUDGET_KRW) + ' 이하' : '제한 없음') + '</p>';

  if (items.length > MAX_EMAIL_ITEMS) {
    html += '<p style="color:#666;">가독성을 위해 상위 ' + MAX_EMAIL_ITEMS + '건만 표시합니다.</p>';
  }

  html += '<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse; font-size:13px;">';
  html += '<tr style="background:#f2f2f2;">';
  html += '<th>순위</th>';
  html += '<th>점수</th>';
  html += '<th>공고명</th>';
  html += '<th>기관</th>';
  html += '<th>추정가격</th>';
  html += '<th>계약방법</th>';
  html += '<th>마감일</th>';
  html += '<th>매칭 키워드</th>';
  html += '<th>상세</th>';
  html += '</tr>';

  displayItems.forEach(function (it, i) {
    var link = it.bidNtceDtlUrl || '';

    html += '<tr>';
    html += '<td>' + (i + 1) + '</td>';
    html += '<td><b>' + escapeHtml_(it.__score || '') + '</b></td>';
    html += '<td><b>' + escapeHtml_(it.bidNtceNm || '(공고명 없음)') + '</b></td>';
    html += '<td>' + escapeHtml_(it.ntceInsttNm || it.dminsttNm || '') + '</td>';
    html += '<td>' + escapeHtml_(formatWon_(it.__budget)) + '</td>';
    html += '<td>' + escapeHtml_(it.cntrctCnclsMthdNm || '') + '</td>';
    html += '<td>' + escapeHtml_(it.bidClseDt || it.opengDt || '') + '</td>';
    html += '<td>' + escapeHtml_((it.__matchedKeywords || []).join(', ')) + '</td>';
    html += '<td>' + (link ? '<a href="' + escapeHtml_(link) + '">공고 보기</a>' : '') + '</td>';
    html += '</tr>';
  });

  html += '</table>';

  html += '<br><p><b>검토 포인트 (개인사업자 기준)</b></p>';
  html += '<ul>';
  html += '<li><b>참가자격</b>: 개인사업자 참여 가능 여부, 요구 업종(교육서비스업·소프트웨어사업자 등) 등록 여부</li>';
  html += '<li><b>지역제한</b>: 사업장 소재지 제한이 있는지 (소액 공고에서 자주 있음)</li>';
  html += '<li><b>실적·인력 요건</b>: 유사 교육 수행실적, 강사 자격, 투입 인원 수</li>';
  html += '<li><b>과업 범위</b>: 강의만인지, 교재·콘텐츠 개발·모집·운영까지 포함인지</li>';
  html += '<li><b>제출 방식과 마감일</b>: 제안서·견적서·발표평가 여부, 공동수급 가능 여부</li>';
  html += '</ul>';

  html += '<p style="color:#666; font-size:12px;">이 메일은 Google Apps Script 자동화로 발송되었습니다.</p>';

  MailApp.sendEmail({
    to: to,
    subject: subject,
    body: plainText,
    htmlBody: html,
    name: 'AI 교육 입찰 모니터링 봇'
  });

  Logger.log('이메일 발송 완료: ' + to + ' / 공고 ' + items.length + '건');
  return true;
}


function sendStatusEmail_(subject, body) {
  var to = getNotifyEmail_();
  Logger.log('상태 메일 발송 시도: ' + subject);

  MailApp.sendEmail({
    to: to,
    subject: subject,
    body: body,
    name: 'AI 교육 입찰 모니터링 봇'
  });

  Logger.log('상태 메일 발송 완료: ' + to);
}


// ===========================================================
//  ⑨ 중복 체크용 스프레드시트
//  (기존 방산·ICT 봇과 기록이 섞이지 않도록 별도 시트를 씁니다)
// ===========================================================

var SEEN_SHEET_PROP_ = 'SEEN_SHEET_ID_AI_EDU';

function getSeenSheet_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(SEEN_SHEET_PROP_);

  if (id) {
    try {
      return SpreadsheetApp.openById(id).getSheets()[0];
    } catch (e) {
      Logger.log('기존 중복 기록 시트를 열 수 없어 새로 생성합니다: ' + e.message);
      props.deleteProperty(SEEN_SHEET_PROP_);
    }
  }

  var ss = SpreadsheetApp.create('AI교육_공공입찰_모니터링_기록');
  props.setProperty(SEEN_SHEET_PROP_, ss.getId());

  var sheet = ss.getSheets()[0];
  sheet.appendRow(['공고키', '공고번호', '차수', '공고명', '기관', '추정가격', '관련성점수', '매칭키워드', '기록일시']);
  sheet.setFrozenRows(1);

  Logger.log('새 중복 기록 시트 생성: ' + ss.getUrl());

  return sheet;
}


function getSeenSet_() {
  var values = getSeenSheet_().getDataRange().getValues();
  var set = {};

  for (var i = 1; i < values.length; i++) {
    set[String(values[i][0])] = true;
  }

  return set;
}


function markSeen_(items) {
  var sheet = getSeenSheet_();
  var now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');

  var rows = items.map(function (it) {
    return [
      getBidKey_(it),
      it.bidNtceNo || '',
      it.bidNtceOrd || '',
      it.bidNtceNm || '',
      it.ntceInsttNm || it.dminsttNm || '',
      it.__budget || '',
      it.__score || '',
      (it.__matchedKeywords || []).join(', '),
      now
    ];
  });

  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  }
}


// ===========================================================
//  ⑩ 테스트용 함수 (트리거 연결 금지)
// ===========================================================

// 중복 기록 초기화
function resetSeenForTest() {
  var sheet = getSeenSheet_();
  var lastRow = sheet.getLastRow();

  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
    Logger.log('테스트용 중복 기록 초기화 완료: ' + (lastRow - 1) + '건 삭제');
  } else {
    Logger.log('초기화할 중복 기록이 없습니다.');
  }
}


// 시연용 강제 발송: 중복 무시, 상위 5건만 발송, 기록하지 않음
function forceSendLatestMatchedForTest() {
  var items = fetchBids_();
  var matched = filterBids_(items);

  Logger.log('API 전체 공고 수: ' + items.length + ' / 필터 통과: ' + matched.length);

  if (matched.length === 0) {
    throw new Error(
      '필터 통과 공고가 없습니다. LOOKBACK_DAYS를 7로 늘리거나 MIN_RELEVANCE_SCORE를 6으로 낮춰 테스트하세요.'
    );
  }

  sendEmail_(matched.slice(0, 5));
}


// 필터 결과만 로그로 확인 (메일 발송 없음)
function debugFilteredBids() {
  var items = fetchBids_();
  var matched = filterBids_(items);

  Logger.log('전체 공고 수: ' + items.length);
  Logger.log('필터 통과 공고 수: ' + matched.length);

  matched.slice(0, 20).forEach(function (it, i) {
    Logger.log(
      (i + 1) + '. 점수 ' + (it.__score || 0) +
      ' | ' + (it.bidNtceNm || '(공고명 없음)') +
      ' | 기관: ' + (it.ntceInsttNm || it.dminsttNm || '') +
      ' | 금액: ' + formatWon_(it.__budget) +
      ' | 키워드: ' + (it.__matchedKeywords || []).join(', ')
    );
  });
}


// 제목에 'AI'나 '교육'이 들어갔는데 필터에서 떨어진 공고와 그 이유를 확인
function debugRejectedBids() {
  var items = fetchBids_();

  items
    .filter(function (it) {
      var t = it.bidNtceNm || '';
      return /AI|인공지능|디지털|교육|강의/i.test(t) && !analyzeBid_(it).include;
    })
    .slice(0, 30)
    .forEach(function (it, i) {
      var a = analyzeBid_(it);
      Logger.log(
        (i + 1) + '. ' + a.reason +
        ' | 금액: ' + formatWon_(a.budget) +
        ' | ' + (it.bidNtceNm || '')
      );
    });
}


function escapeHtml_(text) {
  if (!text) return '';

  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
