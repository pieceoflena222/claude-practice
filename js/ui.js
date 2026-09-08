/**
 * 태풍 실험실 — 공용 UI 유틸리티 (토스트, 모달, 화면 전환)
 */
(function (global) {
  'use strict';

  function toast(message, type) {
    const region = document.getElementById('toastRegion');
    if (!region) return;
    const el = document.createElement('div');
    el.className = 'toast' + (type ? ' is-' + type : '');
    el.textContent = message;
    region.appendChild(el);
    window.setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.2s ease';
      window.setTimeout(() => el.remove(), 220);
    }, 2600);
  }

  function showView(name) {
    document.querySelectorAll('.view').forEach((section) => {
      section.hidden = section.dataset.view !== name;
    });
    document.querySelectorAll('.nav-link').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.view === name);
    });
  }

  function openModal(modal) {
    modal.hidden = false;
    const firstField = modal.querySelector('input, button');
    if (firstField) firstField.focus();
    document.addEventListener('keydown', modal._escHandler || (modal._escHandler = (e) => {
      if (e.key === 'Escape') closeModal(modal);
    }));
  }

  function closeModal(modal) {
    modal.hidden = true;
    if (modal._escHandler) {
      document.removeEventListener('keydown', modal._escHandler);
    }
  }

  function formatDateTime(iso) {
    const d = new Date(iso);
    return d.toLocaleString('ko-KR', {
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  global.TL = global.TL || {};
  global.TL.ui = { toast, showView, openModal, closeModal, formatDateTime };
})(window);
