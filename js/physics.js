/**
 * 태풍 실험실 — 해수면 온도(SST) 기반 태풍 발달 모델
 *
 * 실제 기상 예보에 쓰이는 수치모델이 아니라, 초등학생과 가족이 "해수면 온도가
 * 오르면 태풍이 강해진다"는 핵심 원리를 직관적으로 체감하도록 단순화한
 * 교육용 모델입니다. 태풍 발생 임계 수온(26.5°C)과 기상청 태풍 강도 구간
 * (중/강/매우강/초강력)은 실제 값을 참고했습니다.
 */
(function (global) {
  'use strict';

  const SST_MIN = 20;
  const SST_MAX = 32;
  const GENESIS_SST = 26.5; // 태풍 발생에 필요한 최소 해수면 온도(실측값 참고)

  // 기상청 태풍 강도 구간(최대풍속 m/s 기준)
  const CATEGORIES = [
    {
      id: 'none',
      label: '열대저압부',
      short: 'TD',
      minWind: 0,
      color: '#2f6fb0',
      note: '해수면 온도가 낮아 소용돌이가 조직화되지 못했어요.',
    },
    {
      id: 'medium',
      label: '태풍(중)',
      short: '중',
      minWind: 17,
      color: '#3fa9c9',
      note: '따뜻한 바다에서 수증기가 공급되며 태풍이 만들어졌어요.',
    },
    {
      id: 'strong',
      label: '태풍(강)',
      short: '강',
      minWind: 25,
      color: '#f2c94c',
      note: '바다가 더 뜨거워지며 태풍이 빠르게 회전하고 있어요.',
    },
    {
      id: 'very-strong',
      label: '태풍(매우 강)',
      short: '매우강',
      minWind: 33,
      color: '#f2a341',
      note: '뜨거운 해수면이 강한 상승기류를 만들어 세력이 커졌어요.',
    },
    {
      id: 'super',
      label: '태풍(초강력)',
      short: '초강력',
      minWind: 44,
      color: '#e05a3a',
      note: '아주 뜨거운 바다가 태풍에 최대치의 에너지를 공급하고 있어요.',
    },
  ];

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  /** 해수면 온도(°C) -> 최대풍속(m/s). 24°C 미만은 0으로 수렴합니다. */
  function windSpeedFromSST(sst) {
    const base = Math.max(0, sst - 24);
    return clamp(base * 6.5, 0, 62);
  }

  /** 최대풍속(m/s) -> 중심기압(hPa). 강할수록 기압이 낮아집니다. */
  function pressureFromWind(windSpeed) {
    return clamp(1010 - windSpeed * 1.3, 880, 1012);
  }

  /** 최대풍속(m/s) -> 예상 지름(km). */
  function sizeFromWind(windSpeed) {
    return Math.round(150 + windSpeed * 18);
  }

  function categoryFromWind(windSpeed) {
    let matched = CATEGORIES[0];
    for (const cat of CATEGORIES) {
      if (windSpeed >= cat.minWind) matched = cat;
    }
    return matched;
  }

  /** 0(미형성) ~ 1(초강력)로 정규화한 발달 강도. 시각 연출(회전 속도, 색 등)에 사용. */
  function intensityFromWind(windSpeed) {
    return clamp(windSpeed / 55, 0, 1);
  }

  /**
   * SST(°C) 하나를 받아 이번 상태를 계산합니다.
   * @param {number} sst
   * @param {{jitter?: boolean}} [opts] jitter: true면 "관측" 시점의 미세한 측정
   *   오차(±3%)를 반영해 매번 같은 값이 나오지 않도록 합니다.
   */
  function computeState(sst, opts) {
    const clampedSst = clamp(sst, SST_MIN, SST_MAX);
    let windSpeed = windSpeedFromSST(clampedSst);

    if (opts && opts.jitter && windSpeed > 0) {
      const noise = 1 + (Math.random() - 0.5) * 0.06;
      windSpeed = clamp(windSpeed * noise, 0, 62);
    }

    const pressure = pressureFromWind(windSpeed);
    const sizeKm = sizeFromWind(windSpeed);
    const category = categoryFromWind(windSpeed);
    const intensity = intensityFromWind(windSpeed);

    return {
      sst: Math.round(clampedSst * 10) / 10,
      windSpeed: Math.round(windSpeed * 10) / 10,
      pressure: Math.round(pressure),
      sizeKm,
      category,
      intensity,
    };
  }

  /** 차트용 기준 곡선: SST 전 구간에 대한 이론적(jitter 없는) 풍속 곡선. */
  function referenceCurve(steps) {
    const n = steps || 24;
    const points = [];
    for (let i = 0; i <= n; i++) {
      const sst = SST_MIN + ((SST_MAX - SST_MIN) * i) / n;
      points.push({ sst, windSpeed: windSpeedFromSST(sst) });
    }
    return points;
  }

  global.TL = global.TL || {};
  global.TL.physics = {
    SST_MIN,
    SST_MAX,
    GENESIS_SST,
    CATEGORIES,
    computeState,
    referenceCurve,
    clamp,
  };
})(window);
