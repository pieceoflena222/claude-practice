/**
 * 예온컴퍼니 강사료 노트 — Google Apps Script
 * ------------------------------------------------------------
 * 파일 구성: Code.gs (이 파일) + Index.html (휴대폰 앱 화면)
 *
 * ▶ 자주 고치는 곳
 *   1) 세율·페이백 비율  → 구글시트 '설정' 탭에서 숫자만 바꾸면 됨 (코드 수정 불필요)
 *   2) 드롭다운 선택지    → '설정' 탭 오른쪽 목록에 한 줄 추가하면 됨
 *   3) 새 항목(칸) 추가   → 아래 COLUMNS 에 한 줄 추가 → 시트 메뉴 [강사료관리 > 새 항목(칸) 반영]
 *   4) 색상               → 아래 APP.colors
 * ------------------------------------------------------------
 */

// =============================================================
// 1. 기본 설정
// =============================================================
const APP = {
  name: '강사료 노트',
  brand: 'YeOn Company',
  filePrefix: '강사료관리_',
  sheets: {
    data: '전체기록',
    settings: '설정',
    pending: '입금대기·기타',
    summary: '연간요약',
  },
  // 예온컴퍼니 양식 컬러
  colors: {
    navy: '#1B1F5E',
    deep: '#060356',
    pink: '#FB0271',
    pinkLight: '#FDEBF3',
    bg: '#F5F6FA',
    border: '#C9CCD8',
    white: '#FFFFFF',
  },
  dataRows: 1000,      // 한 해 파일에 준비해 둘 행 수
  sessionHours: 6,     // PIN 입력 후 유지 시간
  pinMaxTry: 5,        // PIN 연속 오류 허용 횟수
  pinLockMinutes: 10,  // 초과 시 잠금 시간
};

// '설정' 탭의 숫자 값들 (이름은 계산식에서 쓰이므로 바꾸지 말 것)
const RATES = [
  // [이름, 라벨, 기본값, 설명]
  ['YEAR_NR', '연도', null, '이 파일이 관리하는 연도'],
  ['RATE_33', '3.3% 건 소득세율', 0.03, '사업소득 3% (지방소득세 별도)'],
  ['RATE_88', '8.8% 건 소득세율', 0.08, '기타소득: 필요경비 60% 공제 후 20% = 8%'],
  ['RATE_LOCAL', '지방소득세 (소득세 대비)', 0.1, '소득세의 10%'],
  ['RATE_VAT', '부가세율', 0.1, '세금계산서 강사료는 부가세 포함 금액으로 계산'],
  ['RATE_PAYBACK', '페이백 비율', 0.1, '강사료 × 비율'],
];

// 드롭다운 선택지 ('설정' 탭에 복사되며, 이후엔 시트에서 추가·수정)
// ※ '3.3%', '8.8%', '세금계산서', '본인', 'O' 는 계산식에 쓰이므로 이름을 바꾸지 말 것
const OPTIONS = [
  { key: 'role', label: '주/보', values: ['주강사', '보조강사'] },
  { key: 'ox', label: 'O/X', values: ['O', 'X'] },
  { key: 'tax', label: '세금구분', values: ['3.3%', '8.8%', '세금계산서'] },
  { key: 'asstTax', label: '보조강사 원천징수', values: ['3.3%', '8.8%'] },
  { key: 'travelMode', label: '여비 입금방식', values: ['별도', '합산'] },
  { key: 'status', label: '입금상태', values: ['예정', '입금완료', '미입금'] },
  { key: 'payer', label: '보조강사 지급주체', values: ['본인', '기관'] },
];
const OPTION_SLOTS = 12; // 선택지마다 준비해 둘 칸 수

// 항목(칸) 정의 — 시트 열 순서 = 이 목록 순서
// type: date | text | money | select | auto(자동계산)
// sec : 앱 입력화면에서 묶일 구역
// f   : 자동계산식. {키} 는 해당 열 범위(예: I2:I)로 바뀜. g 는 '이 칸이 비어 있으면 빈칸' 기준 키
const COLUMNS = [
  { key: 'date', header: '강의일', type: 'date', w: 95, sec: 'basic', req: true },
  { key: 'org', header: '기관', type: 'text', w: 170, sec: 'basic', suggest: true, req: true },
  { key: 'agency', header: '에이전시', type: 'text', w: 120, sec: 'basic', suggest: true, hint: '없으면 비워두기' },
  { key: 'target', header: '대상', type: 'text', w: 150, sec: 'basic', suggest: true },
  { key: 'time', header: '시간', type: 'text', w: 105, sec: 'basic', hint: '예: 10:00~13:00' },
  { key: 'curriculum', header: '커리큘럼·실습플랫폼', type: 'text', w: 180, sec: 'basic', suggest: true },
  { key: 'role', header: '주/보', type: 'select', opt: 'role', w: 75, sec: 'basic' },
  { key: 'material', header: '교안제출', type: 'select', opt: 'ox', w: 70, sec: 'basic' },

  { key: 'fee', header: '강사료', type: 'money', w: 100, sec: 'fee', req: true, hint: '세금계산서 건은 부가세 포함 금액' },
  { key: 'taxType', header: '세금구분', type: 'select', opt: 'tax', w: 90, sec: 'fee' },
  { key: 'withholding', header: '원천징수액', type: 'auto', w: 95, g: 'fee',
    f: 'IF({taxType}="3.3%", ROUNDDOWN({fee}*RATE_33,-1)+ROUNDDOWN(ROUNDDOWN({fee}*RATE_33,-1)*RATE_LOCAL,-1),' +
       ' IF({taxType}="8.8%", ROUNDDOWN({fee}*RATE_88,-1)+ROUNDDOWN(ROUNDDOWN({fee}*RATE_88,-1)*RATE_LOCAL,-1), 0))' },
  { key: 'vat', header: '부가세', type: 'auto', w: 90, g: 'fee',
    f: 'IF({taxType}="세금계산서", {fee}-ROUND({fee}/(1+RATE_VAT)), 0)' },
  { key: 'afterTax', header: '세후강사료', type: 'auto', w: 100, g: 'fee',
    f: '{fee}-{withholding}-{vat}' },
  { key: 'invoiceDate', header: '세금계산서 발행일', type: 'date', w: 110, sec: 'fee', showIf: ['taxType', '세금계산서'] },

  { key: 'travel', header: '여비', type: 'money', w: 90, sec: 'pay', hint: '기관이 따로 준 경우만' },
  { key: 'travelMode', header: '여비 입금방식', type: 'select', opt: 'travelMode', w: 95, sec: 'pay' },
  { key: 'received', header: '실제 입금액', type: 'money', w: 105, sec: 'pay', hint: '통장에 들어온 금액' },
  { key: 'paidDate', header: '지급일', type: 'date', w: 95, sec: 'pay', hint: '월별 합계 기준 날짜' },
  { key: 'payerName', header: '입금자명', type: 'text', w: 120, sec: 'pay', suggest: true },
  { key: 'status', header: '입금상태', type: 'select', opt: 'status', w: 85, sec: 'pay' },

  { key: 'paybackYn', header: '페이백대상', type: 'select', opt: 'ox', w: 80, sec: 'payback' },
  { key: 'payback', header: '페이백', type: 'auto', w: 90, g: 'fee',
    f: 'IF({paybackYn}="O", ROUND({fee}*RATE_PAYBACK), 0)' },

  { key: 'asstName', header: '보조강사', type: 'text', w: 100, sec: 'asst', suggest: true },
  { key: 'asstFee', header: '보조강사료', type: 'money', w: 100, sec: 'asst' },
  { key: 'asstPayer', header: '보조강사 지급주체', type: 'select', opt: 'payer', w: 110, sec: 'asst', hint: '기관이 직접 주면 기록만' },
  { key: 'asstTaxType', header: '보조강사 원천징수', type: 'select', opt: 'asstTax', w: 110, sec: 'asst' },
  { key: 'asstWithholding', header: '보조 원천징수액', type: 'auto', w: 105, g: 'asstFee',
    f: 'IF({asstPayer}<>"본인", 0, IF({asstTaxType}="3.3%", ROUNDDOWN({asstFee}*RATE_33,-1)+ROUNDDOWN(ROUNDDOWN({asstFee}*RATE_33,-1)*RATE_LOCAL,-1),' +
       ' IF({asstTaxType}="8.8%", ROUNDDOWN({asstFee}*RATE_88,-1)+ROUNDDOWN(ROUNDDOWN({asstFee}*RATE_88,-1)*RATE_LOCAL,-1), 0)))' },
  { key: 'asstNet', header: '보조 실지급액', type: 'auto', w: 105, g: 'asstFee',
    f: 'IF({asstPayer}="본인", {asstFee}-{asstWithholding}, 0)' },
  { key: 'asstPaidDate', header: '보조강사 지급일', type: 'date', w: 105, sec: 'asst' },

  { key: 'feeMinusAsst', header: '강사료−보조강사료', type: 'auto', w: 125, g: 'fee',
    f: '{fee}-IF({asstPayer}="본인", {asstFee}, 0)' },
  { key: 'memo', header: '메모', type: 'text', w: 220, sec: 'memo' },
];

// 월별·연간 요약에 보여줄 합계 항목
const SUM_KEYS = ['fee', 'withholding', 'vat', 'afterTax', 'travel', 'received', 'payback', 'asstNet', 'feeMinusAsst'];

// =============================================================
// 2. 시트 메뉴
// =============================================================
function onOpen() {
  SpreadsheetApp.getUi().createMenu('강사료관리')
    .addItem('① 처음 설정 (이 파일)', 'menuSetupThisFile')
    .addItem('새 연도 파일 만들기', 'menuCreateYearFile')
    .addSeparator()
    .addItem('월별·요약 탭 다시 만들기', 'menuRebuildViews')
    .addItem('새 항목(칸) 반영', 'menuSyncColumns')
    .addSeparator()
    .addItem('연도별 파일 목록 보기', 'menuShowYears')
    .addItem('앱 PIN 초기화', 'menuResetPin')
    .addToUi();
}

function menuSetupThisFile() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName(APP.sheets.data)) {
    ui.alert('이미 설정된 파일입니다.\n탭만 다시 만들려면 [월별·요약 탭 다시 만들기]를 사용하세요.');
    return;
  }
  const year = askYear_(ui, new Date().getFullYear());
  if (!year) return;
  buildYearFile_(ss, year);
  registerYear_(year, ss.getId());
  ui.alert(year + '년 강사료 관리 시트가 준비되었습니다.\n\n다음 단계: [배포 > 새 배포 > 웹 앱]으로 휴대폰 앱을 배포하세요.');
}

function menuCreateYearFile() {
  const ui = SpreadsheetApp.getUi();
  const year = askYear_(ui, new Date().getFullYear() + 1);
  if (!year) return;
  if (PropertiesService.getScriptProperties().getProperty('SHEET_' + year)) {
    ui.alert(year + '년 파일이 이미 등록되어 있습니다. [연도별 파일 목록 보기]에서 확인하세요.');
    return;
  }
  const ss = SpreadsheetApp.create(APP.filePrefix + year);
  buildYearFile_(ss, year);
  registerYear_(year, ss.getId());
  ui.alert(year + '년 파일을 만들었습니다.\n\n' + ss.getUrl() + '\n\n휴대폰 앱 상단 연도 선택에서 바로 쓸 수 있습니다.');
}

function menuRebuildViews() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  buildViews_(ss, getYearOf_(ss));
  SpreadsheetApp.getUi().alert('월별·입금대기·연간요약 탭을 다시 만들었습니다. (전체기록 데이터는 그대로입니다)');
}

function menuSyncColumns() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const added = syncColumns_(ss);
  buildViews_(ss, getYearOf_(ss));
  SpreadsheetApp.getUi().alert(added.length ? '추가된 칸: ' + added.join(', ') : '추가할 새 칸이 없습니다.');
}

function menuShowYears() {
  const years = listYears_();
  const lines = years.map(function (y) {
    try { return y + '년: ' + SpreadsheetApp.openById(getSheetId_(y)).getUrl(); }
    catch (e) { return y + '년: (파일을 열 수 없음)'; }
  });
  let url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (e) {}
  SpreadsheetApp.getUi().alert((lines.join('\n') || '등록된 파일 없음') + (url ? '\n\n앱 주소: ' + url : ''));
}

function menuResetPin() {
  const ui = SpreadsheetApp.getUi();
  if (ui.alert('앱 PIN을 초기화할까요? 다음에 앱을 열 때 새 PIN을 정합니다.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const p = PropertiesService.getScriptProperties();
  p.deleteProperty('PIN_HASH');
  p.deleteProperty('PIN_SALT');
  p.setProperty('SESSION_EPOCH', String(Date.now())); // 기존 로그인 모두 해제
  ui.alert('초기화했습니다.');
}

function askYear_(ui, def) {
  const r = ui.prompt('연도 입력', '관리할 연도를 숫자로 입력하세요 (예: ' + def + ')', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return null;
  const y = parseInt(String(r.getResponseText()).trim() || def, 10);
  if (!(y >= 2000 && y <= 2100)) { ui.alert('연도를 다시 확인해 주세요.'); return null; }
  return y;
}

// =============================================================
// 3. 시트 만들기
// =============================================================
function buildYearFile_(ss, year) {
  ss.setSpreadsheetLocale('ko_KR');
  ss.setSpreadsheetTimeZone('Asia/Seoul');
  const first = ss.getSheets()[0];
  buildSettings_(ss, year);
  buildDataSheet_(ss);
  if (first && first.getName() !== APP.sheets.data && first.getName() !== APP.sheets.settings && first.getLastRow() === 0) {
    ss.deleteSheet(first);
  }
  buildViews_(ss, year);
  ss.setActiveSheet(ss.getSheetByName(APP.sheets.data));
}

function buildSettings_(ss, year) {
  const C = APP.colors;
  const sh = ss.getSheetByName(APP.sheets.settings) || ss.insertSheet(APP.sheets.settings);
  sh.clear();
  sh.getRange('A1').setValue('설정 — 숫자와 선택지는 여기서 바로 고치면 시트·앱에 반영됩니다')
    .setFontWeight('bold').setFontSize(13).setFontColor(C.deep);
  sh.getRange('A2:C2').setValues([['항목', '값', '설명']]);
  RATES.forEach(function (r, i) {
    const row = 3 + i;
    sh.getRange(row, 1, 1, 3).setValues([[r[1], r[0] === 'YEAR_NR' ? year : r[2], r[3]]]);
    if (r[0] !== 'YEAR_NR') sh.getRange(row, 2).setNumberFormat('0.0%');
    ss.setNamedRange(r[0], sh.getRange(row, 2));
  });
  sh.getRange(3, 2, RATES.length, 1).setBackground(C.pinkLight).setFontWeight('bold').setFontColor(C.deep);

  // 선택지 목록: E열부터
  OPTIONS.forEach(function (o, i) {
    const col = 5 + i;
    sh.getRange(2, col).setValue(o.label);
    sh.getRange(3, col, OPTION_SLOTS, 1).setNumberFormat('@')
      .setValues(padList_(o.values, OPTION_SLOTS).map(function (v) { return [v]; }));
    sh.setColumnWidth(col, 110);
  });
  const lastCol = 4 + OPTIONS.length;
  styleHeader_(sh.getRange(2, 1, 1, 3));
  styleHeader_(sh.getRange(2, 5, 1, OPTIONS.length));
  sh.getRange(3, 5, OPTION_SLOTS, OPTIONS.length).setBackground(C.bg);
  sh.getRange(3 + OPTION_SLOTS + 1, 5).setValue(
    '※ 빈칸에 선택지를 추가할 수 있습니다. 단, 3.3% · 8.8% · 세금계산서 · 본인 · O 는 계산식에 쓰이니 이름을 바꾸지 마세요.')
    .setFontColor(C.pink).setFontSize(9);
  sh.setColumnWidth(1, 190); sh.setColumnWidth(2, 80); sh.setColumnWidth(3, 300); sh.setColumnWidth(4, 24);
  sh.setFrozenRows(2);
  sh.getRange(1, 1, 3 + OPTION_SLOTS + 1, lastCol).setFontFamily('Arial');
  return sh;
}

function buildDataSheet_(ss) {
  const C = APP.colors;
  const sh = ss.getSheetByName(APP.sheets.data) || ss.insertSheet(APP.sheets.data, 0);
  const n = COLUMNS.length;
  if (sh.getMaxColumns() < n) sh.insertColumnsAfter(sh.getMaxColumns(), n - sh.getMaxColumns());
  if (sh.getMaxRows() < APP.dataRows) sh.insertRowsAfter(sh.getMaxRows(), APP.dataRows - sh.getMaxRows());
  const letters = {};
  COLUMNS.forEach(function (c, i) { letters[c.key] = colLetter_(i + 1); });
  COLUMNS.forEach(function (c, i) { writeColumn_(sh, c, i + 1, letters); });

  sh.setFrozenRows(1);
  sh.setFrozenColumns(2);
  sh.setRowHeight(1, 40);
  const all = sh.getRange(1, 1, APP.dataRows, n);
  all.setFontFamily('Arial').setFontSize(10).setVerticalAlignment('middle');
  sh.getRange(2, 1, APP.dataRows - 1, n).setBorder(null, null, true, null, true, null, C.border, SpreadsheetApp.BorderStyle.SOLID);
  applyDataRules_(sh);
  return sh;
}

// 한 열을 헤더·서식·드롭다운·계산식까지 설정
function writeColumn_(sh, c, col, letters) {
  const C = APP.colors;
  const head = sh.getRange(1, col);
  const body = sh.getRange(2, col, APP.dataRows - 1, 1);
  sh.setColumnWidth(col, c.w || 100);
  if (c.type === 'auto') {
    const expr = c.f.replace(/\{(\w+)\}/g, function (_, k) { return letters[k] + '2:' + letters[k]; });
    const guard = letters[c.g] + '2:' + letters[c.g];
    head.setFormula('={"' + c.header + '"; ARRAYFORMULA(IF(LEN(' + guard + ')=0, "", IFERROR(' + expr + ', "확인")))}');
    head.setBackground(C.pink);
    body.setNumberFormat('#,##0').setFontColor(C.deep).setBackground(null);
    const p = sh.getRange(1, col, APP.dataRows, 1).protect();
    p.setDescription('자동계산: ' + c.header);
    p.setWarningOnly(true);
  } else {
    head.setValue(c.header).setBackground(C.navy);
    if (c.type === 'date') {
      body.setNumberFormat('m/d (ddd)').setHorizontalAlignment('center')
        .setDataValidation(SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(true).build());
    } else if (c.type === 'money') {
      body.setNumberFormat('#,##0');
    } else {
      body.setNumberFormat('@');
      if (c.type === 'select') {
        body.setHorizontalAlignment('center').setDataValidation(
          SpreadsheetApp.newDataValidation().requireValueInRange(optionRange_(sh.getParent(), c.opt), true).setAllowInvalid(false).build());
      }
    }
  }
  head.setFontColor(C.white).setFontWeight('bold').setHorizontalAlignment('center').setWrap(true);
}

function applyDataRules_(sh) {
  const n = sh.getLastColumn();
  const statusCol = colIndexByKey_(sh, 'status');
  const range = sh.getRange(2, 1, APP.dataRows - 1, n);
  const rules = [];
  if (statusCol) {
    const L = colLetter_(statusCol);
    const r = sh.getRange(2, statusCol, APP.dataRows - 1, 1);
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$' + L + '2="미입금"')
      .setBackground(APP.colors.pinkLight).setFontColor(APP.colors.pink).setBold(true).setRanges([r]).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$' + L + '2="입금완료"')
      .setBackground('#E7F6EE').setFontColor('#1E7B4F').setBold(true).setRanges([r]).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$' + L + '2="예정"')
      .setFontColor(APP.colors.navy).setRanges([r]).build());
  }
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=ISEVEN(ROW())')
    .setBackground(APP.colors.bg).setRanges([range]).build());
  sh.setConditionalFormatRules(rules);
}

// 월별(1~12월) · 입금대기 · 연간요약 탭 (수식만 있으므로 언제든 다시 만들 수 있음)
function buildViews_(ss, year) {
  const data = ss.getSheetByName(APP.sheets.data);
  const n = data.getLastColumn();
  const headers = data.getRange(1, 1, 1, n).getDisplayValues()[0];
  const lastL = colLetter_(n);
  const L = function (key) { const i = headers.indexOf(headerOf_(key)); return i < 0 ? null : colLetter_(i + 1); };
  const D = "'" + APP.sheets.data + "'!";
  const paid = L('paidDate'), fee = L('fee');
  const colTypes = headers.map(function (h) { const c = COLUMNS.filter(function (x) { return x.header === h; })[0]; return c ? c.type : 'text'; });

  for (let m = 1; m <= 12; m++) {
    const name = m + '월';
    const start = 'DATE(YEAR_NR,' + m + ',1)', end = 'DATE(YEAR_NR,' + (m + 1) + ',1)';
    const cond = D + '$' + paid + ':$' + paid + ',">="&' + start + ',' + D + '$' + paid + ':$' + paid + ',"<"&' + end;
    const filter = '=IFERROR(FILTER(' + D + 'A2:' + lastL + ', LEN(' + D + fee + '2:' + fee + ')>0, ' +
      'IFERROR(YEAR(' + D + paid + '2:' + paid + '),0)=YEAR_NR, IFERROR(MONTH(' + D + paid + '2:' + paid + '),0)=' + m + '), "이 달 입금 내역이 없습니다")';
    buildViewSheet_(ss, name, 2 + m, year + '년 ' + m + '월  ·  지급일 기준', cond, filter, headers, colTypes, L, D);
  }
  const pendingFilter = '=IFERROR(FILTER(' + D + 'A2:' + lastL + ', LEN(' + D + fee + '2:' + fee + ')>0, ' +
    'IFERROR(YEAR(' + D + paid + '2:' + paid + '),0)<>YEAR_NR), "입금대기 내역이 없습니다")';
  buildViewSheet_(ss, APP.sheets.pending, 2, '입금대기  ·  지급일 미입력 또는 다른 연도에 입금된 건', null, pendingFilter, headers, colTypes, L, D);
  buildSummary_(ss, year, L, D);
}

function buildViewSheet_(ss, name, position, title, sumCond, filterFormula, headers, colTypes, L, D) {
  const C = APP.colors;
  let sh = ss.getSheetByName(name);
  if (sh) ss.deleteSheet(sh);
  sh = ss.insertSheet(name, Math.min(position, ss.getNumSheets()));
  const n = headers.length;
  const width = Math.max(n, SUM_KEYS.length + 1);
  if (sh.getMaxColumns() < width) sh.insertColumnsAfter(sh.getMaxColumns(), width - sh.getMaxColumns());
  sh.getRange(1, 1, 1, Math.min(width, 12)).merge();
  sh.getRange('A1').setValue(title).setFontSize(14).setFontWeight('bold').setFontColor(C.white);
  sh.getRange(1, 1, 1, width).setBackground(C.navy);
  sh.setRowHeight(1, 42);

  // 2~3행: 요약 카드
  const labels = ['건수'], formulas = [];
  if (sumCond) {
    formulas.push('=COUNTIFS(' + sumCond + ')');
  } else {
    const fee = L('fee'), paid = L('paidDate');
    formulas.push('=COUNTIFS(' + D + fee + ':' + fee + ',"<>",' + D + paid + ':' + paid + ',"") + COUNTIFS(' + D + fee + ':' + fee + ',"<>",' + D + paid + ':' + paid + ',"<"&DATE(YEAR_NR,1,1)) + COUNTIFS(' + D + fee + ':' + fee + ',"<>",' + D + paid + ':' + paid + ',">="&DATE(YEAR_NR+1,1,1))');
  }
  SUM_KEYS.forEach(function (k) {
    const col = L(k); if (!col) return;
    labels.push(headerOf_(k));
    if (sumCond) {
      formulas.push('=SUMIFS(' + D + col + ':' + col + ',' + sumCond + ')');
    } else {
      const paid = L('paidDate');
      formulas.push('=SUM(' + D + col + '2:' + col + ')-SUMIFS(' + D + col + ':' + col + ',' + D + paid + ':' + paid + ',">="&DATE(YEAR_NR,1,1),' + D + paid + ':' + paid + ',"<"&DATE(YEAR_NR+1,1,1))');
    }
  });
  sh.getRange(2, 1, 1, labels.length).setValues([labels]).setBackground(C.pinkLight).setFontColor(C.deep)
    .setFontSize(9).setFontWeight('bold').setHorizontalAlignment('center');
  sh.getRange(3, 1, 1, formulas.length).setFormulas([formulas]).setNumberFormat('#,##0').setFontSize(13)
    .setFontWeight('bold').setFontColor(C.deep).setHorizontalAlignment('center');
  sh.setRowHeight(3, 34);

  // 5행: 헤더, 6행~: 목록
  sh.getRange(5, 1).setFormula("={'" + APP.sheets.data + "'!A1:" + colLetter_(n) + '1}');
  sh.getRange(5, 1, 1, n).setBackground(C.navy).setFontColor(C.white).setFontWeight('bold')
    .setHorizontalAlignment('center').setWrap(true);
  sh.setRowHeight(5, 36);
  sh.getRange(6, 1).setFormula(filterFormula);
  colTypes.forEach(function (t, i) {
    const r = sh.getRange(6, i + 1, APP.dataRows, 1);
    if (t === 'date') r.setNumberFormat('m/d (ddd)').setHorizontalAlignment('center');
    else if (t === 'money' || t === 'auto') r.setNumberFormat('#,##0');
  });
  headers.forEach(function (h, i) {
    const c = COLUMNS.filter(function (x) { return x.header === h; })[0];
    sh.setColumnWidth(i + 1, Math.max(c ? c.w || 100 : 100, 90));
  });
  sh.getRange(1, 1, sh.getMaxRows(), width).setFontFamily('Arial').setVerticalAlignment('middle');
  sh.setFrozenRows(5);
  sh.setConditionalFormatRules([SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=AND(ROW()>5,ISEVEN(ROW()))')
    .setBackground(C.bg).setRanges([sh.getRange(6, 1, APP.dataRows, n)]).build()]);
  sh.setTabColor(sumCond ? C.navy : C.pink);
  return sh;
}

function buildSummary_(ss, year, L, D) {
  const C = APP.colors;
  let sh = ss.getSheetByName(APP.sheets.summary);
  if (sh) ss.deleteSheet(sh);
  sh = ss.insertSheet(APP.sheets.summary, 1);
  sh.getRange('A1:K1').merge();
  sh.getRange('A1').setValue(year + '년 연간요약  ·  지급일 기준').setFontSize(15).setFontWeight('bold').setFontColor(C.white);
  sh.getRange('A1:K1').setBackground(C.navy);
  sh.setRowHeight(1, 46);

  const keys = SUM_KEYS.filter(function (k) { return L(k); });
  const head = ['월', '건수'].concat(keys.map(headerOf_));
  sh.getRange(3, 1, 1, head.length).setValues([head]);
  styleHeader_(sh.getRange(3, 1, 1, head.length));
  const paid = L('paidDate');
  const rows = [];
  for (let m = 1; m <= 12; m++) {
    const cond = D + '$' + paid + ':$' + paid + ',">="&DATE(YEAR_NR,' + m + ',1),' + D + '$' + paid + ':$' + paid + ',"<"&DATE(YEAR_NR,' + (m + 1) + ',1)';
    rows.push([m + '월', '=COUNTIFS(' + cond + ')'].concat(keys.map(function (k) {
      const c = L(k); return '=SUMIFS(' + D + c + ':' + c + ',' + cond + ')';
    })));
  }
  sh.getRange(4, 1, 12, head.length).setFormulas(rows.map(function (r) { return r.map(String); }));
  sh.getRange(4, 1, 12, 1).setValues(rows.map(function (r) { return [r[0]]; }));
  const total = ['연간 합계'];
  for (let i = 2; i <= head.length; i++) { const l = colLetter_(i); total.push('=SUM(' + l + '4:' + l + '15)'); }
  sh.getRange(16, 1, 1, head.length).setValues([[total[0]].concat(new Array(head.length - 1).fill(''))]);
  sh.getRange(16, 2, 1, head.length - 1).setFormulas([total.slice(1)]);
  sh.getRange(4, 2, 13, head.length - 1).setNumberFormat('#,##0').setHorizontalAlignment('right');
  sh.getRange(4, 1, 12, head.length).setBorder(null, null, true, null, null, true, C.border, SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange(16, 1, 1, head.length).setBackground(C.pinkLight).setFontWeight('bold').setFontColor(C.deep);
  sh.getRange(4, 1, 13, 1).setFontWeight('bold').setHorizontalAlignment('center').setFontColor(C.navy);

  // 부가세 참고 (세금계산서 발행일 기준) + 입금대기
  const inv = L('invoiceDate'), vat = L('vat'), fee = L('fee');
  const box = [
    ['부가세 신고 참고 (세금계산서 발행일 기준)', ''],
    ['상반기 (1~6월 발행) 부가세', '=SUMIFS(' + D + vat + ':' + vat + ',' + D + inv + ':' + inv + ',">="&DATE(YEAR_NR,1,1),' + D + inv + ':' + inv + ',"<"&DATE(YEAR_NR,7,1))'],
    ['하반기 (7~12월 발행) 부가세', '=SUMIFS(' + D + vat + ':' + vat + ',' + D + inv + ':' + inv + ',">="&DATE(YEAR_NR,7,1),' + D + inv + ':' + inv + ',"<"&DATE(YEAR_NR+1,1,1))'],
    ['입금대기 건수 (지급일 미입력)', '=COUNTIFS(' + D + fee + ':' + fee + ',"<>",' + D + paid + ':' + paid + ',"")'],
    ['입금대기 강사료 합계', '=SUMIFS(' + D + fee + ':' + fee + ',' + D + paid + ':' + paid + ',"")'],
  ];
  sh.getRange(18, 1, box.length, 1).setValues(box.map(function (r) { return [r[0]]; }));
  sh.getRange(19, 3, box.length - 1, 1).setFormulas(box.slice(1).map(function (r) { return [r[1]]; }));
  sh.getRange(18, 1, 1, 4).setBackground(C.navy).setFontColor(C.white).setFontWeight('bold');
  sh.getRange(19, 1, box.length - 1, 3).setBackground(C.bg);
  sh.getRange(19, 3, box.length - 1, 1).setNumberFormat('#,##0').setFontWeight('bold').setFontColor(C.deep);
  sh.getRange(23, 1).setValue('※ 세금 금액은 관리용 추정치입니다. 실제 신고는 원천징수영수증·홈택스 자료를 기준으로 하세요.')
    .setFontSize(9).setFontColor(C.pink);

  sh.setColumnWidth(1, 220);
  for (let i = 2; i <= head.length; i++) sh.setColumnWidth(i, 105);
  sh.getRange(1, 1, 30, head.length).setFontFamily('Arial').setVerticalAlignment('middle');
  sh.setFrozenRows(3);
  sh.setTabColor(C.pink);

  // 월별 강사료 차트
  const feeIdx = head.indexOf(headerOf_('fee')) + 1;
  if (feeIdx > 0) {
    const chart = sh.newChart().asColumnChart()
      .addRange(sh.getRange(3, 1, 13, 1)).addRange(sh.getRange(3, feeIdx, 13, 1))
      .setNumHeaders(1).setColors([C.navy]).setLegendPosition(Charts.Position.NONE)
      .setTitle('월별 강사료 (지급일 기준)').setPosition(25, 1, 0, 0).setOption('width', 760).setOption('height', 320)
      .build();
    sh.insertChart(chart);
  }
}

// COLUMNS 에 새로 추가된 항목을 시트 오른쪽 끝에 붙임
function syncColumns_(ss) {
  const sh = ss.getSheetByName(APP.sheets.data);
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  const missing = COLUMNS.filter(function (c) { return headers.indexOf(c.header) < 0; });
  if (!missing.length) return [];
  let next = sh.getLastColumn() + 1;
  if (sh.getMaxColumns() < next + missing.length - 1) sh.insertColumnsAfter(sh.getMaxColumns(), next + missing.length - 1 - sh.getMaxColumns());
  const letters = {};
  headers.forEach(function (h, i) { const c = COLUMNS.filter(function (x) { return x.header === h; })[0]; if (c) letters[c.key] = colLetter_(i + 1); });
  missing.forEach(function (c, i) { letters[c.key] = colLetter_(next + i); });
  missing.forEach(function (c, i) { writeColumn_(sh, c, next + i, letters); });
  applyDataRules_(sh);
  return missing.map(function (c) { return c.header; });
}

// =============================================================
// 4. 휴대폰 앱 (웹앱)
// =============================================================
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle(APP.name)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover')
    .addMetaTag('theme-color', APP.colors.navy);
}

// ---- PIN ----
function apiPinStatus() {
  return { hasPin: !!PropertiesService.getScriptProperties().getProperty('PIN_HASH'), app: APP.name, brand: APP.brand };
}

function apiSetPin(pin) {
  const p = PropertiesService.getScriptProperties();
  if (p.getProperty('PIN_HASH')) throw new Error('이미 PIN이 있습니다. 시트 메뉴에서 초기화 후 다시 설정하세요.');
  if (!/^\d{4,8}$/.test(String(pin))) throw new Error('PIN은 숫자 4~8자리로 정해 주세요.');
  const salt = Utilities.getUuid();
  p.setProperty('PIN_SALT', salt);
  p.setProperty('PIN_HASH', hash_(salt + pin));
  return newSession_();
}

function apiLogin(pin) {
  const p = PropertiesService.getScriptProperties();
  const cache = CacheService.getScriptCache();
  const tries = Number(cache.get('PIN_FAIL') || 0);
  if (tries >= APP.pinMaxTry) throw new Error('PIN을 여러 번 틀려 ' + APP.pinLockMinutes + '분간 잠겼습니다.');
  if (hash_(p.getProperty('PIN_SALT') + pin) !== p.getProperty('PIN_HASH')) {
    cache.put('PIN_FAIL', String(tries + 1), APP.pinLockMinutes * 60);
    throw new Error('PIN이 맞지 않습니다. (' + (tries + 1) + '/' + APP.pinMaxTry + ')');
  }
  cache.remove('PIN_FAIL');
  return newSession_();
}

function newSession_() {
  const token = Utilities.getUuid();
  const epoch = PropertiesService.getScriptProperties().getProperty('SESSION_EPOCH') || '0';
  CacheService.getScriptCache().put('S_' + token, epoch, APP.sessionHours * 3600);
  return token;
}

function auth_(token) {
  const v = token && CacheService.getScriptCache().get('S_' + token);
  const epoch = PropertiesService.getScriptProperties().getProperty('SESSION_EPOCH') || '0';
  if (!v || v !== epoch) throw new Error('SESSION_EXPIRED');
}

function hash_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

// ---- 데이터 ----
function apiBootstrap(token, year) {
  auth_(token);
  const years = listYears_();
  if (!years.length) throw new Error('등록된 연도 파일이 없습니다. 시트 메뉴 [강사료관리 > 처음 설정]을 먼저 실행하세요.');
  const now = new Date().getFullYear();
  const y = Number(year) || (years.indexOf(now) >= 0 ? now : years[years.length - 1]);
  const ss = openYear_(y);
  return {
    year: y,
    years: years,
    columns: COLUMNS.map(function (c) {
      return { key: c.key, header: c.header, type: c.type, sec: c.sec || '', opt: c.opt || '', req: !!c.req,
        suggest: !!c.suggest, hint: c.hint || '', showIf: c.showIf || null };
    }),
    options: readOptions_(ss),
    rates: readRates_(ss),
    rows: readRows_(ss),
    sheetUrl: ss.getUrl(),
  };
}

function apiList(token, year) {
  auth_(token);
  return readRows_(openYear_(year));
}

function apiSave(token, year, rowNo, data) {
  auth_(token);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = openYear_(year);
    const sh = ss.getSheetByName(APP.sheets.data);
    const map = headerMap_(sh);
    COLUMNS.forEach(function (c) {
      if (c.req && (data[c.key] === undefined || data[c.key] === null || String(data[c.key]).trim() === '')) {
        throw new Error(c.header + '을(를) 입력해 주세요.');
      }
    });
    let row = Number(rowNo);
    if (!row) {
      row = lastDataRow_(sh, map) + 1;
      if (row > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 100);
    }
    // 자동계산 칸을 피해 입력 칸만 연속 구간으로 나눠서 기록
    const cols = COLUMNS.filter(function (c) { return c.type !== 'auto' && map[c.key]; })
      .map(function (c) { return { col: map[c.key], c: c }; })
      .sort(function (a, b) { return a.col - b.col; });
    let run = [];
    const flush = function () {
      if (!run.length) return;
      const r = sh.getRange(row, run[0].col, 1, run.length);
      const fmts = run.map(function (x) { return x.c.type === 'date' ? 'm/d (ddd)' : x.c.type === 'money' ? '#,##0' : '@'; });
      r.setNumberFormats([fmts]);
      r.setValues([run.map(function (x) { return toCell_(x.c, data[x.c.key]); })]);
      run = [];
    };
    cols.forEach(function (x) {
      if (run.length && x.col !== run[run.length - 1].col + 1) flush();
      run.push(x);
    });
    flush();
    SpreadsheetApp.flush();
    return readRows_(ss);
  } finally {
    lock.releaseLock();
  }
}

function apiDelete(token, year, rowNo, check) {
  auth_(token);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = openYear_(year);
    const sh = ss.getSheetByName(APP.sheets.data);
    const map = headerMap_(sh);
    const row = Number(rowNo);
    const org = String(sh.getRange(row, map.org).getDisplayValue());
    if (row < 2 || org !== String(check || '')) throw new Error('삭제할 행이 바뀌었습니다. 새로고침 후 다시 시도하세요.');
    sh.deleteRow(row);
    SpreadsheetApp.flush();
    return readRows_(ss);
  } finally {
    lock.releaseLock();
  }
}

function readRows_(ss) {
  const sh = ss.getSheetByName(APP.sheets.data);
  const map = headerMap_(sh);
  const last = lastDataRow_(sh, map);
  if (last < 2) return [];
  const values = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
  const tz = ss.getSpreadsheetTimeZone();
  const out = [];
  values.forEach(function (v, i) {
    const o = { _row: i + 2 };
    let any = false;
    COLUMNS.forEach(function (c) {
      if (!map[c.key]) return;
      let x = v[map[c.key] - 1];
      if (x instanceof Date) x = Utilities.formatDate(x, tz, 'yyyy-MM-dd');
      else if (x === null || x === undefined) x = '';
      if (x !== '' && c.type !== 'auto') any = true;
      o[c.key] = x;
    });
    if (any) out.push(o);
  });
  return out;
}

// =============================================================
// 5. 도우미
// =============================================================
function toCell_(c, v) {
  if (v === undefined || v === null || v === '') return '';
  if (c.type === 'money') {
    const n = Number(String(v).replace(/[^\d.-]/g, ''));
    return isNaN(n) ? '' : n;
  }
  if (c.type === 'date') {
    const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : '';
  }
  return String(v);
}

function headerMap_(sh) {
  const h = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  const map = {};
  COLUMNS.forEach(function (c) { const i = h.indexOf(c.header); if (i >= 0) map[c.key] = i + 1; });
  if (!map.org || !map.fee) throw new Error("'" + APP.sheets.data + "' 탭의 기관·강사료 제목칸을 찾을 수 없습니다.");
  return map;
}

function lastDataRow_(sh, map) {
  const maxRow = sh.getLastRow();
  if (maxRow < 2) return 1;
  const keys = ['date', 'org', 'fee'].filter(function (k) { return map[k]; });
  let last = 1;
  keys.forEach(function (k) {
    const vals = sh.getRange(2, map[k], maxRow - 1, 1).getValues();
    for (let i = vals.length - 1; i >= 0; i--) {
      if (vals[i][0] !== '' && vals[i][0] !== null) { last = Math.max(last, i + 2); break; }
    }
  });
  return last;
}

function readOptions_(ss) {
  const sh = ss.getSheetByName(APP.sheets.settings);
  const vals = sh.getRange(2, 5, OPTION_SLOTS + 1, OPTIONS.length).getDisplayValues();
  const out = {};
  OPTIONS.forEach(function (o, i) {
    out[o.key] = vals.slice(1).map(function (r) { return String(r[i]).trim(); }).filter(String);
  });
  return out;
}

function readRates_(ss) {
  const out = {};
  RATES.forEach(function (r) {
    const nr = ss.getRangeByName(r[0]);
    out[r[0]] = nr ? Number(nr.getValue()) : r[2];
  });
  return out;
}

function optionRange_(ss, key) {
  const i = OPTIONS.map(function (o) { return o.key; }).indexOf(key);
  return ss.getSheetByName(APP.sheets.settings).getRange(3, 5 + i, OPTION_SLOTS, 1);
}

function colIndexByKey_(sh, key) {
  const h = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  const i = h.indexOf(headerOf_(key));
  return i < 0 ? 0 : i + 1;
}

function headerOf_(key) {
  const c = COLUMNS.filter(function (x) { return x.key === key; })[0];
  return c ? c.header : key;
}

function styleHeader_(range) {
  range.setBackground(APP.colors.navy).setFontColor(APP.colors.white).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
}

function registerYear_(year, id) {
  PropertiesService.getScriptProperties().setProperty('SHEET_' + year, id);
}

function getSheetId_(year) {
  return PropertiesService.getScriptProperties().getProperty('SHEET_' + year);
}

function listYears_() {
  return Object.keys(PropertiesService.getScriptProperties().getProperties())
    .filter(function (k) { return /^SHEET_\d{4}$/.test(k); })
    .map(function (k) { return Number(k.slice(6)); })
    .sort();
}

function openYear_(year) {
  const id = getSheetId_(year);
  if (!id) throw new Error(year + '년 파일이 등록되어 있지 않습니다.');
  return SpreadsheetApp.openById(id);
}

function getYearOf_(ss) {
  const r = ss.getRangeByName('YEAR_NR');
  return r ? Number(r.getValue()) : new Date().getFullYear();
}

function colLetter_(n) {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function padList_(arr, n) {
  const out = arr.slice(0, n);
  while (out.length < n) out.push('');
  return out;
}
