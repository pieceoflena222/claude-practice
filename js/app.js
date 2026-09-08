/**
 * 태풍 실험실 — 메인 애플리케이션 로직
 * physics/store/stage/chart/ui 모듈을 엮어 실험실 화면과 관측 기록 화면,
 * 로그인/회원가입 흐름을 동작시킵니다.
 */
(function () {
  'use strict';

  const physics = window.TL.physics;
  const store = window.TL.store;
  const chart = window.TL.chart;
  const ui = window.TL.ui;

  const el = {
    sstRange: document.getElementById('sstRange'),
    sstValue: document.getElementById('sstValue'),
    sstCaption: document.getElementById('sstCaption'),
    windValue: document.getElementById('windValue'),
    pressureValue: document.getElementById('pressureValue'),
    sizeValue: document.getElementById('sizeValue'),
    statusBadge: document.getElementById('statusBadge'),
    statusNote: document.getElementById('statusNote'),
    curveChart: document.getElementById('curveChart'),
    stageCanvas: document.getElementById('stage'),
    runBtn: document.getElementById('runBtn'),
    saveBtn: document.getElementById('saveBtn'),
    runResult: document.getElementById('runResult'),
    runResultTitle: document.getElementById('runResultTitle'),
    runResultDetail: document.getElementById('runResultDetail'),

    navLinks: document.querySelectorAll('.nav-link'),
    authArea: document.getElementById('authArea'),
    themeToggle: document.getElementById('themeToggle'),
    themeIconSun: document.getElementById('themeIconSun'),
    themeIconMoon: document.getElementById('themeIconMoon'),

    recordsLoading: document.getElementById('recordsLoading'),
    recordsSignedOut: document.getElementById('recordsSignedOut'),
    recordsEmpty: document.getElementById('recordsEmpty'),
    recordsError: document.getElementById('recordsError'),
    recordsErrorText: document.getElementById('recordsErrorText'),
    recordsList: document.getElementById('recordsList'),
    recordsLoginBtn: document.getElementById('recordsLoginBtn'),
    recordsGoConsole: document.getElementById('recordsGoConsole'),
    recordsRetryBtn: document.getElementById('recordsRetryBtn'),

    authModal: document.getElementById('authModal'),
    authForm: document.getElementById('authForm'),
    authTitle: document.getElementById('authTitle'),
    authTabs: document.querySelectorAll('.auth-tab'),
    authUsername: document.getElementById('authUsername'),
    authPassword: document.getElementById('authPassword'),
    authNickRow: document.getElementById('authNickRow'),
    authNick: document.getElementById('authNick'),
    authError: document.getElementById('authError'),
    authSubmit: document.getElementById('authSubmit'),
    authSubmitLabel: document.getElementById('authSubmitLabel'),
    authHint: document.getElementById('authHint'),
    authSwitch: document.getElementById('authSwitch'),
    authClose: document.getElementById('authClose'),
  };

  const stage = new window.TL.TyphoonStage(el.stageCanvas);
  stage.start();

  let session = store.getSession();
  let authMode = 'login';
  let pendingSaveAfterLogin = false;
  let lastRun = null;

  /* ---------------------------- 온도 안내 문구 ---------------------------- */
  function sstCaptionFor(sst) {
    if (sst < 23) return '한겨울 동해 수준으로 차가운 바다예요.';
    if (sst < 25.5) return '이른 여름 바다 정도의 수온이에요.';
    if (sst < physics.GENESIS_SST) return '태풍이 만들어지기엔 아직 조금 차가워요.';
    if (sst < 28.5) return '한여름 남해 수준의 따뜻한 바다예요.';
    if (sst < 30) return '태풍이 힘을 빠르게 키울 수 있는 뜨거운 바다예요.';
    return '역대급 이상 고수온! 태풍이 최대로 발달할 수 있어요.';
  }

  function hexToRgb(hex) {
    const clean = hex.replace('#', '');
    const num = parseInt(clean, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

  function readableTextColor(hex) {
    const { r, g, b } = hexToRgb(hex);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.62 ? '#06111c' : '#ffffff';
  }

  /* ---------------------------- 슬라이더 -> 화면 갱신 ---------------------------- */
  function updateFromSst(sst) {
    const state = physics.computeState(sst);

    el.sstValue.innerHTML = state.sst.toFixed(1) + '<span>°C</span>';
    el.sstCaption.textContent = sstCaptionFor(state.sst);

    el.windValue.textContent = state.windSpeed.toFixed(1) + ' m/s';
    el.pressureValue.textContent = state.pressure + ' hPa';
    el.sizeValue.textContent = state.sizeKm + ' km';

    el.statusBadge.textContent = state.category.label;
    el.statusBadge.style.background = state.category.color;
    el.statusBadge.style.color = readableTextColor(state.category.color);

    let note = state.category.note;
    if (state.category.id === 'none') {
      note += ' 26.5도 이상으로 올려보세요.';
    }
    el.statusNote.textContent = note;

    stage.setTarget({
      intensity: state.intensity,
      sizeKm: state.sizeKm,
      colorHex: state.category.color,
    });

    chart.render(el.curveChart, state.sst);

    return state;
  }

  el.sstRange.addEventListener('input', (e) => {
    updateFromSst(parseFloat(e.target.value));
  });

  /* ---------------------------- 관측 시작 / 저장 ---------------------------- */
  function formatRunDetail(state) {
    return (
      '해수면 온도 ' +
      state.sst.toFixed(1) +
      '°C · 최대풍속 ' +
      state.windSpeed.toFixed(1) +
      ' m/s · 중심기압 ' +
      state.pressure +
      ' hPa · 지름 ' +
      state.sizeKm +
      ' km'
    );
  }

  el.runBtn.addEventListener('click', () => {
    const sst = parseFloat(el.sstRange.value);
    const state = physics.computeState(sst, { jitter: true });
    lastRun = state;

    el.runResult.hidden = false;
    el.runResultTitle.textContent = '관측 완료 — ' + state.category.label;
    el.runResultDetail.textContent = formatRunDetail(state);

    el.saveBtn.disabled = false;
    ui.toast('관측을 완료했어요. 결과를 저장할 수 있어요.', 'success');
  });

  el.saveBtn.addEventListener('click', () => {
    if (!lastRun) return;

    if (!session) {
      pendingSaveAfterLogin = true;
      openAuth('login');
      ui.toast('저장하려면 먼저 로그인해주세요.');
      return;
    }

    saveCurrentRun();
  });

  function saveCurrentRun() {
    if (!lastRun) return;
    try {
      store.addRecord(session.username, {
        sst: lastRun.sst,
        windSpeed: lastRun.windSpeed,
        pressure: lastRun.pressure,
        sizeKm: lastRun.sizeKm,
        categoryId: lastRun.category.id,
        categoryLabel: lastRun.category.label,
        categoryColor: lastRun.category.color,
      });
      el.saveBtn.disabled = true;
      ui.toast('관측 기록이 저장되었어요!', 'success');
      if (!el.recordsList.closest('.view').hidden) {
        loadRecords();
      }
    } catch (err) {
      ui.toast('저장에 실패했어요. 다시 시도해주세요.', 'error');
    }
  }

  /* ---------------------------- 화면 이동 ---------------------------- */
  el.navLinks.forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.showView(btn.dataset.view);
      if (btn.dataset.view === 'records') loadRecords();
    });
  });

  el.recordsLoginBtn.addEventListener('click', () => openAuth('login'));
  el.recordsGoConsole.addEventListener('click', () => {
    ui.showView('console');
    el.navLinks.forEach((b) => b.classList.toggle('is-active', b.dataset.view === 'console'));
  });
  el.recordsRetryBtn.addEventListener('click', loadRecords);

  /* ---------------------------- 관측 기록 렌더링 ---------------------------- */
  function setRecordsState(name) {
    el.recordsLoading.hidden = name !== 'loading';
    el.recordsSignedOut.hidden = name !== 'signed-out';
    el.recordsEmpty.hidden = name !== 'empty';
    el.recordsError.hidden = name !== 'error';
    el.recordsList.hidden = name !== 'list';
  }

  function loadRecords() {
    if (!session) {
      setRecordsState('signed-out');
      el.recordsList.innerHTML = '';
      return;
    }

    setRecordsState('loading');

    window.setTimeout(() => {
      try {
        const records = store.getRecords(session.username);
        if (records.length === 0) {
          setRecordsState('empty');
          el.recordsList.innerHTML = '';
          return;
        }
        renderRecordsList(records);
        setRecordsState('list');
      } catch (err) {
        el.recordsErrorText.textContent = '기록을 불러오지 못했어요. 다시 시도해주세요.';
        setRecordsState('error');
      }
    }, 260);
  }

  function renderRecordsList(records) {
    el.recordsList.innerHTML = '';
    records.forEach((record, index) => {
      const older = records[index + 1];
      const li = document.createElement('li');
      li.className = 'record-item';

      const deltaHtml = older
        ? buildDeltaHtml(record.windSpeed - older.windSpeed)
        : '<span class="delta">첫 관측</span>';

      li.innerHTML =
        '<span class="record-index">#' +
        (records.length - index) +
        '</span>' +
        '<div class="record-main">' +
        '<div class="record-top">' +
        '<span class="record-badge" style="background:' +
        record.categoryColor +
        ';color:' +
        readableTextColor(record.categoryColor) +
        '">' +
        record.categoryLabel +
        '</span>' +
        '<span class="record-time">' +
        ui.formatDateTime(record.createdAt) +
        '</span>' +
        '</div>' +
        '<div class="record-metrics">' +
        '<span>' +
        record.sst.toFixed(1) +
        '°C</span><span>' +
        record.windSpeed.toFixed(1) +
        ' m/s</span><span>' +
        record.pressure +
        ' hPa</span><span>' +
        record.sizeKm +
        ' km</span><span>' +
        deltaHtml +
        '</span>' +
        '</div>' +
        '</div>' +
        '<div class="record-actions">' +
        '<button type="button" class="btn btn-ghost" data-action="rerun" data-sst="' +
        record.sst +
        '">다시 실행</button>' +
        '<button type="button" class="btn btn-danger" data-action="delete" data-id="' +
        record.id +
        '">삭제</button>' +
        '</div>';

      el.recordsList.appendChild(li);
    });
  }

  function buildDeltaHtml(diff) {
    const rounded = Math.round(diff * 10) / 10;
    if (Math.abs(rounded) < 0.1) {
      return '<span class="delta">이전과 비슷함</span>';
    }
    const cls = rounded > 0 ? 'up' : 'down';
    const arrow = rounded > 0 ? '▲' : '▼';
    return '<span class="delta ' + cls + '">' + arrow + ' ' + Math.abs(rounded).toFixed(1) + ' m/s</span>';
  }

  el.recordsList.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    if (btn.dataset.action === 'rerun') {
      const sst = parseFloat(btn.dataset.sst);
      el.sstRange.value = sst;
      updateFromSst(sst);
      ui.showView('console');
      el.navLinks.forEach((b) => b.classList.toggle('is-active', b.dataset.view === 'console'));
      ui.toast('실험실에 해당 조건을 불러왔어요.');
      return;
    }

    if (btn.dataset.action === 'delete') {
      if (btn.dataset.confirming === 'true') {
        store.deleteRecord(session.username, btn.dataset.id);
        ui.toast('기록을 삭제했어요.');
        loadRecords();
      } else {
        btn.dataset.confirming = 'true';
        btn.textContent = '정말 삭제?';
        window.setTimeout(() => {
          if (btn.isConnected) {
            btn.dataset.confirming = 'false';
            btn.textContent = '삭제';
          }
        }, 2500);
      }
    }
  });

  /* ---------------------------- 인증 영역 ---------------------------- */
  function renderAuthArea() {
    if (session) {
      const initial = (session.nickname || session.username).slice(0, 1).toUpperCase();
      el.authArea.innerHTML =
        '<div class="user-chip">' +
        '<span class="avatar">' +
        initial +
        '</span>' +
        '<span class="username">' +
        session.nickname +
        '</span>' +
        '<button type="button" class="btn-ghost" id="logoutBtn">로그아웃</button>' +
        '</div>';
      document.getElementById('logoutBtn').addEventListener('click', () => {
        store.logOut();
        session = null;
        renderAuthArea();
        ui.toast('로그아웃되었어요.');
        if (!document.querySelector('.view[data-view="records"]').hidden) {
          loadRecords();
        }
        el.saveBtn.disabled = true;
      });
    } else {
      el.authArea.innerHTML = '<button type="button" class="btn btn-primary" id="loginBtn">로그인</button>';
      document.getElementById('loginBtn').addEventListener('click', () => openAuth('login'));
    }
  }

  function setAuthMode(mode) {
    authMode = mode;
    el.authTabs.forEach((tab) => {
      const active = tab.dataset.tab === mode;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    el.authNickRow.hidden = mode !== 'signup';
    el.authTitle.textContent = mode === 'signup' ? '관측소 계정 만들기' : '관측소에 로그인';
    el.authSubmitLabel.textContent = mode === 'signup' ? '회원가입' : '로그인';
    el.authPassword.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    el.authHint.innerHTML =
      mode === 'signup'
        ? '이미 계정이 있으신가요? <button type="button" id="authSwitch2">로그인</button>'
        : '계정이 없으신가요? <button type="button" id="authSwitch2">회원가입</button>';
    const switchBtn = document.getElementById('authSwitch2');
    if (switchBtn) {
      switchBtn.addEventListener('click', () => setAuthMode(mode === 'signup' ? 'login' : 'signup'));
    }
    el.authError.hidden = true;
  }

  el.authTabs.forEach((tab) => {
    tab.addEventListener('click', () => setAuthMode(tab.dataset.tab));
  });

  function openAuth(mode) {
    setAuthMode(mode || 'login');
    el.authForm.reset();
    ui.openModal(el.authModal);
  }

  el.authClose.addEventListener('click', () => ui.closeModal(el.authModal));
  el.authModal.addEventListener('click', (e) => {
    if (e.target === el.authModal) ui.closeModal(el.authModal);
  });

  el.authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    el.authError.hidden = true;

    const username = el.authUsername.value.trim();
    const password = el.authPassword.value;
    const nickname = el.authNick.value.trim();

    el.authSubmit.disabled = true;
    const originalLabel = el.authSubmitLabel.textContent;
    el.authSubmitLabel.innerHTML = '<span class="spinner"></span>';

    try {
      const result =
        authMode === 'signup'
          ? await store.signUp(username, password, nickname)
          : await store.logIn(username, password);

      session = result;
      renderAuthArea();
      ui.closeModal(el.authModal);
      ui.toast(
        (authMode === 'signup' ? '환영해요, ' : '다시 오셨네요, ') + result.nickname + '님!',
        'success'
      );

      if (pendingSaveAfterLogin) {
        pendingSaveAfterLogin = false;
        saveCurrentRun();
      }
      if (!document.querySelector('.view[data-view="records"]').hidden) {
        loadRecords();
      }
    } catch (err) {
      el.authError.textContent = err.message || '문제가 발생했어요. 다시 시도해주세요.';
      el.authError.hidden = false;
    } finally {
      el.authSubmit.disabled = false;
      el.authSubmitLabel.textContent = originalLabel;
    }
  });

  /* ---------------------------- 야간/주간 모드 ---------------------------- */
  function effectiveTheme() {
    const explicit = document.documentElement.getAttribute('data-theme');
    if (explicit) return explicit;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyThemeIcon() {
    const eff = effectiveTheme();
    el.themeIconSun.hidden = eff === 'dark';
    el.themeIconMoon.hidden = eff !== 'dark';
    el.themeToggle.setAttribute('aria-pressed', String(eff === 'dark'));
    el.themeToggle.setAttribute(
      'aria-label',
      eff === 'dark' ? '주간 관측 모드로 전환' : '야간 관측 모드로 전환'
    );
  }

  el.themeToggle.addEventListener('click', () => {
    const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    store.setTheme(next);
    applyThemeIcon();
  });

  /* ---------------------------- 초기화 ---------------------------- */
  (function init() {
    const storedTheme = store.getTheme();
    if (storedTheme) document.documentElement.setAttribute('data-theme', storedTheme);
    applyThemeIcon();

    renderAuthArea();
    updateFromSst(parseFloat(el.sstRange.value));
  })();
})();
