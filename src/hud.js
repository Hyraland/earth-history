// 界面：左上角的年代、画面上方的事件字幕、底部的时间轴。

import { STATIONS, EXHIBITS, WALK_LENGTH, GROUND_PALETTE, xAtAge, geoNames, formatAge } from './timeline.js';

const TICKS = [4600, 2500, 538.8, 251.9, 66, 0];

export function createHud({ onJump }) {
  const $ = (id) => document.getElementById(id);
  const eraEl = $('era'), ageEl = $('age');
  const capEl = $('caption'), capTitle = $('caption-title'), capDesc = $('caption-desc');
  const track = $('tl-track'), marker = $('tl-marker'), bar = $('timeline');

  // 时间轴：地层色带 + 展品圆点 + 事件刻度
  const pct = (x) => `${((x / WALK_LENGTH) * 100).toFixed(3)}%`;
  GROUND_PALETTE.forEach((p, i) => {
    const x0 = xAtAge(p.age);
    const x1 = i + 1 < GROUND_PALETTE.length ? xAtAge(GROUND_PALETTE[i + 1].age) : WALK_LENGTH;
    const seg = document.createElement('div');
    seg.className = 'tl-seg';
    seg.style.left = pct(x0);
    seg.style.width = pct(x1 - x0);
    seg.style.background = `linear-gradient(${p.a}, ${p.b})`;
    track.appendChild(seg);
  });
  STATIONS.forEach((s) => {
    if (s.kind === 'start' || s.kind === 'end') return;
    const dot = document.createElement('button');
    dot.className = `tl-dot tl-${s.kind}`;
    dot.style.left = pct(s.x);
    dot.title = `${s.name} · ${formatAge(s.age)}`;
    dot.addEventListener('click', (ev) => { ev.stopPropagation(); onJump(s.x); });
    track.appendChild(dot);
  });
  TICKS.forEach((age) => {
    const t = document.createElement('div');
    t.className = 'tl-tick';
    t.style.left = pct(xAtAge(age));
    t.textContent = formatAge(age, { suffix: '' });
    track.appendChild(t);
  });
  bar.addEventListener('click', (ev) => {
    const r = track.getBoundingClientRect();
    onJump(Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)) * WALK_LENGTH);
  });

  const captions = STATIONS.filter((s) => s.kind !== 'exhibit' && s.kind !== 'end');   // 终点的话在结尾的星空里
  let lastEra = '', lastAge = '', lastCap = null;

  return {
    update(walkerX, age) {
      const era = geoNames(age).join(' · ');
      if (era !== lastEra) { eraEl.textContent = era; lastEra = era; }
      const ageText = formatAge(age);
      if (ageText !== lastAge) { ageEl.textContent = ageText; lastAge = ageText; }
      marker.style.left = pct(Math.min(WALK_LENGTH, Math.max(0, walkerX)));

      // 经过地球事件时显示字幕
      let best = null, bestD = Infinity;
      for (const s of captions) {
        const d = Math.abs(s.x - walkerX);
        if (d < bestD) { best = s; bestD = d; }
      }
      const vis = best && bestD < 600 ? 1 - Math.max(0, (bestD - 250) / 350) : 0;
      if (best !== lastCap && vis > 0) {
        capTitle.textContent = `${best.name}${best.kind === 'end' ? '' : ` · ${formatAge(best.age)}`}`;
        capDesc.textContent = best.desc;
        capEl.dataset.kind = best.kind;
        lastCap = best;
      }
      capEl.style.opacity = vis.toFixed(3);
    },
  };
}
