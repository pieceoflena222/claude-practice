/**
 * 태풍 실험실 — 계정 & 관측 기록 저장소
 *
 * 브라우저에 안전하게 남아있는 localStorage를 데이터베이스로 사용합니다.
 * 비밀번호는 평문으로 저장하지 않고 PBKDF2(SHA-256, 100,000회)로 각 계정마다
 * 다른 salt를 적용해 해시만 저장하며, 로그인 시 동일한 방식으로 해시를 다시
 * 계산해 비교합니다. 이 방식은 클라우드 서버 없이도 실제로 동작하는 회원가입
 * ·로그인이며, 새로고침이나 브라우저 재시작 후에도 계정과 기록이 그대로
 * 남아 있습니다. (다만 다른 기기와는 동기화되지 않는, 이 브라우저 전용
 * 계정입니다.)
 */
(function (global) {
  'use strict';

  const USERS_KEY = 'typhoonlab_users_v1';
  const SESSION_KEY = 'typhoonlab_session_v1';
  const RECORDS_PREFIX = 'typhoonlab_records_v1_';
  const THEME_KEY = 'typhoonlab_theme_v1';
  const MAX_RECORDS = 60;

  class StoreError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  }

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getUsers() {
    return readJSON(USERS_KEY, {});
  }

  function bufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  function randomSaltHex() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return bufferToHex(bytes.buffer);
  }

  async function deriveHash(password, saltHex) {
    const encoder = new TextEncoder();
    const saltBytes = new Uint8Array(saltHex.match(/.{2}/g).map((h) => parseInt(h, 16)));
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      256
    );
    return bufferToHex(bits);
  }

  function validateUsername(username) {
    if (!/^[a-zA-Z0-9_가-힣]{3,20}$/.test(username || '')) {
      throw new StoreError(
        'invalid_username',
        '아이디는 한글/영문/숫자/밑줄로 3~20자여야 해요.'
      );
    }
  }

  function validatePassword(password) {
    if (!password || password.length < 6 || password.length > 64) {
      throw new StoreError('invalid_password', '비밀번호는 6자 이상 입력해주세요.');
    }
  }

  async function signUp(username, password, nickname) {
    validateUsername(username);
    validatePassword(password);

    const users = getUsers();
    if (users[username]) {
      throw new StoreError('duplicate_username', '이미 사용 중인 아이디예요.');
    }

    const salt = randomSaltHex();
    const hash = await deriveHash(password, salt);

    users[username] = {
      salt,
      hash,
      nickname: (nickname || username).slice(0, 12),
      createdAt: new Date().toISOString(),
    };
    writeJSON(USERS_KEY, users);
    localStorage.setItem(SESSION_KEY, username);

    return { username, nickname: users[username].nickname };
  }

  async function logIn(username, password) {
    if (!username || !password) {
      throw new StoreError('invalid_input', '아이디와 비밀번호를 입력해주세요.');
    }
    const users = getUsers();
    const record = users[username];
    if (!record) {
      throw new StoreError('not_found', '아이디 또는 비밀번호가 올바르지 않아요.');
    }
    const hash = await deriveHash(password, record.salt);
    if (hash !== record.hash) {
      throw new StoreError('wrong_password', '아이디 또는 비밀번호가 올바르지 않아요.');
    }
    localStorage.setItem(SESSION_KEY, username);
    return { username, nickname: record.nickname };
  }

  function logOut() {
    localStorage.removeItem(SESSION_KEY);
  }

  function getSession() {
    const username = localStorage.getItem(SESSION_KEY);
    if (!username) return null;
    const users = getUsers();
    const record = users[username];
    if (!record) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return { username, nickname: record.nickname };
  }

  function recordsKey(username) {
    return RECORDS_PREFIX + username;
  }

  function getRecords(username) {
    const list = readJSON(recordsKey(username), []);
    return list.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  function addRecord(username, entry) {
    const list = readJSON(recordsKey(username), []);
    const record = Object.assign(
      {
        id: 'r_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        createdAt: new Date().toISOString(),
      },
      entry
    );
    list.push(record);
    while (list.length > MAX_RECORDS) list.shift();
    writeJSON(recordsKey(username), list);
    return record;
  }

  function deleteRecord(username, id) {
    const list = readJSON(recordsKey(username), []);
    const next = list.filter((r) => r.id !== id);
    writeJSON(recordsKey(username), next);
  }

  function getTheme() {
    return localStorage.getItem(THEME_KEY);
  }

  function setTheme(theme) {
    if (theme) {
      localStorage.setItem(THEME_KEY, theme);
    } else {
      localStorage.removeItem(THEME_KEY);
    }
  }

  global.TL = global.TL || {};
  global.TL.store = {
    StoreError,
    signUp,
    logIn,
    logOut,
    getSession,
    getRecords,
    addRecord,
    deleteRecord,
    getTheme,
    setTheme,
  };
})(window);
