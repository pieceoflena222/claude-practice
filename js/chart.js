/**
 * 태풍 실험실 — 해수면 온도 대비 최대풍속 기준 곡선 SVG 렌더러
 * 현재 슬라이더 값 위치를 곡선 위에 표시해 "온도가 오르면 풍속이 오른다"는
 * 관계를 그래프로도 확인할 수 있게 합니다.
 */
(function (global) {
  'use strict';

  const VB_W = 240;
  const VB_H = 120;
  const PAD_L = 30;
  const PAD_R = 12;
  const PAD_T = 12;
  const PAD_B = 22;

  function mapX(sst, min, max) {
    return PAD_L + ((sst - min) / (max - min)) * (VB_W - PAD_L - PAD_R);
  }

  function mapY(wind, maxWind) {
    const top = PAD_T;
    const bottom = VB_H - PAD_B;
    return bottom - (wind / maxWind) * (bottom - top);
  }

  function sstForWind(wind) {
    return 24 + wind / 6.5;
  }

  function buildGradientStops(maxWind, sstMin, sstMax) {
    const cats = global.TL.physics.CATEGORIES;
    return cats.map((cat) => {
      const sst = Math.min(sstMax, Math.max(sstMin, sstForWind(cat.minWind)));
      const fraction = (sst - sstMin) / (sstMax - sstMin);
      return { offset: Math.round(fraction * 1000) / 10, color: cat.color };
    });
  }

  function render(svg, currentSst) {
    const physics = global.TL.physics;
    const points = physics.referenceCurve(28);
    const maxWind = 62;
    const sstMin = physics.SST_MIN;
    const sstMax = physics.SST_MAX;

    const path = points
      .map((p, i) => {
        const x = mapX(p.sst, sstMin, sstMax);
        const y = mapY(p.windSpeed, maxWind);
        return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
      })
      .join(' ');

    const areaPath =
      path +
      ` L${mapX(sstMax, sstMin, sstMax).toFixed(1)},${(VB_H - PAD_B).toFixed(1)}` +
      ` L${mapX(sstMin, sstMin, sstMax).toFixed(1)},${(VB_H - PAD_B).toFixed(1)} Z`;

    const state = physics.computeState(currentSst);
    const markerX = mapX(state.sst, sstMin, sstMax);
    const markerY = mapY(state.windSpeed, maxWind);

    const stops = buildGradientStops(maxWind, sstMin, sstMax);
    const gradientStops = stops
      .map((s) => `<stop offset="${s.offset}%" stop-color="${s.color}"></stop>`)
      .join('');

    const baseY = VB_H - PAD_B;

    svg.setAttribute('viewBox', `0 0 ${VB_W} ${VB_H}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute(
      'aria-label',
      `해수면 온도와 최대풍속의 관계 그래프. 현재 온도 ${state.sst}도, 예상 풍속 ${state.windSpeed} 미터매초.`
    );

    svg.innerHTML = `
      <defs>
        <linearGradient id="curveGradient" x1="0" y1="0" x2="1" y2="0">
          ${gradientStops}
        </linearGradient>
        <linearGradient id="areaGradient" x1="0" y1="0" x2="1" y2="0">
          ${gradientStops}
        </linearGradient>
      </defs>
      <line x1="${PAD_L}" y1="${baseY}" x2="${VB_W - PAD_R}" y2="${baseY}"
        style="stroke:var(--border-strong)" stroke-width="1"></line>
      <line x1="${PAD_L}" y1="${PAD_T}" x2="${PAD_L}" y2="${baseY}"
        style="stroke:var(--border-strong)" stroke-width="1"></line>
      <path d="${areaPath}" fill="url(#areaGradient)" fill-opacity="0.16" stroke="none"></path>
      <path d="${path}" fill="none" stroke="url(#curveGradient)" stroke-width="2.4"
        stroke-linecap="round"></path>
      <line x1="${markerX.toFixed(1)}" y1="${markerY.toFixed(1)}" x2="${markerX.toFixed(1)}" y2="${baseY}"
        style="stroke:var(--ink-faint)" stroke-width="1" stroke-dasharray="2 3"></line>
      <circle cx="${markerX.toFixed(1)}" cy="${markerY.toFixed(1)}" r="4.5"
        style="fill:var(--surface)" stroke="${state.category.color}" stroke-width="2.5"></circle>
      <text x="${PAD_L}" y="${VB_H - 6}" font-size="7" style="fill:var(--ink-faint)">${sstMin}°C</text>
      <text x="${VB_W - PAD_R}" y="${VB_H - 6}" font-size="7" style="fill:var(--ink-faint)" text-anchor="end">${sstMax}°C</text>
      <text x="${PAD_L - 4}" y="${PAD_T + 4}" font-size="7" style="fill:var(--ink-faint)" text-anchor="end">${maxWind}</text>
      <text x="${PAD_L - 4}" y="${baseY}" font-size="7" style="fill:var(--ink-faint)" text-anchor="end">0</text>
    `;
  }

  global.TL = global.TL || {};
  global.TL.chart = { render };
})(window);
