// "来源与致谢"面板：列出所有扫描模型的作者、原始页面和许可证（CC BY 要求的署名）。

import { EXHIBITS } from './timeline.js';
import { SCANS } from './exhibits/scan.js';

export function setupCredits() {
  const panel = document.getElementById('credits');
  const list = document.getElementById('credits-list');
  const names = Object.fromEntries(EXHIBITS.map((e) => [e.id, e.name]));

  for (const e of EXHIBITS) {
    const c = SCANS[e.id]?.credit;
    if (!c) continue;
    const li = document.createElement('li');
    const title = document.createElement('a');
    title.href = c.url;
    title.target = '_blank';
    title.rel = 'noopener';
    title.textContent = c.title;
    const lic = document.createElement('a');
    lic.href = c.licenseUrl;
    lic.target = '_blank';
    lic.rel = 'noopener';
    lic.textContent = c.license;
    li.append(`${names[e.id]}：`, title, ` · ${c.by} · `, lic, c.modified ? ' · 已修改（清理碎片、减面、压缩、调整朝向和尺寸）' : '');
    list.appendChild(li);
  }

  const open = () => { panel.hidden = false; };
  const close = () => { panel.hidden = true; };
  document.getElementById('credits-open').addEventListener('click', open);
  panel.addEventListener('click', (ev) => { if (ev.target === panel || ev.target.dataset.close !== undefined) close(); });
  window.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') close(); });
}
