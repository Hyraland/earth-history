// 中英文切换。语言存在浏览器里；第一次打开时，中文系统的浏览器用中文，其他用英文。
// 切换时记下当前走到的位置，重新载入页面，再回到这里——比逐个刷新界面上的文字简单可靠。
// 站点（展品、事件）的英文在 timeline.js 的 STATION_EN 里；其余界面文字在这里。

export const LANG = (() => {
  try {
    const saved = localStorage.getItem('earth-lang');
    if (saved === 'zh' || saved === 'en') return saved;
  } catch { /* 没有存储就按浏览器语言 */ }
  return /^zh\b/i.test(navigator.language || '') ? 'zh' : 'en';
})();
export const EN = LANG === 'en';
export const t = (zh, en) => (EN ? en : zh);

// 切换语言：记住位置（和是否暂停），重新载入
export function switchLanguage(motion) {
  try {
    localStorage.setItem('earth-lang', EN ? 'zh' : 'en');
    sessionStorage.setItem('earth-resume', JSON.stringify({ scroll: motion.scroll, paused: motion.paused }));
  } catch { /* 忽略 */ }
  location.reload();
}
// 重新载入后回到原来的位置
export function takeResume() {
  try {
    const r = JSON.parse(sessionStorage.getItem('earth-resume') || 'null');
    sessionStorage.removeItem('earth-resume');
    return r;
  } catch { return null; }
}

// 页面上固定的文字（index.html 里默认是中文）
export function applyStaticText() {
  document.documentElement.lang = EN ? 'en' : 'zh-CN';
  document.body.classList.toggle('lang-en', EN);
  if (!EN) return;
  document.title = 'Walking Through Earth History';
  const set = (sel, html) => { const el = document.querySelector(sel); if (el) el.innerHTML = html; };
  set('#help .help-keys', '<kbd>Space</kbd> pause · <kbd>→</kbd> fast · <kbd>←</kbd> back<br />Scroll to move through time · click the timeline to jump');
  set('#ending-replay', '✦ Replay the ending<br />');
  set('#light-open', '☀ Light');
  set('#credits-open', 'Sources &amp; credits');
  set('#lang-toggle', '中文');
  set('.credits-title', 'Sources &amp; Credits');
  set('#credits-intro', 'These fossil models are 3D scans or reconstructions published by museums and researchers, used under their licenses:');
  set('#credits-procedural', 'The stromatolite, Grypania, Dickinsonia, Cooksonia, Tiktaalik, Lepidodendron, petrified forest, ammonite, sauropod trackway and Archaefructus are generated in code, modelled on published specimens. '
    + 'The landscape, sky and lighting are generated too, and the music is synthesized live in the browser.');
  set('#credits-cat', 'The guiding cat: <a href="https://sketchfab.com/3d-models/medium-poly-cat-in-motion-3d-model-free-5c31c77904de4e458d434c167ea0f4bc" target="_blank" rel="noopener">Medium poly Cat In Motion 3d Model Free</a>'
    + ' · iRahulRajput · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a> · modified (compressed texture, added animation). '
    + '3D rendering by <a href="https://threejs.org" target="_blank" rel="noopener">three.js</a> (MIT). Fonts: Noto Serif SC and Cormorant Garamond (SIL Open Font License).');
  set('.lp-modes [data-mode=day]', 'Day');
  set('.lp-modes [data-mode=sunset]', 'Sunset');
  set('.lp-modes [data-mode=night]', 'Night');
  set('#lp-az-label', '<span id="lp-body-label">Sun</span> direction');
  set('#lp-el-label', 'Height');
  set('.lp-foot', '0° is straight ahead into the distance, 180° is behind the camera · <a id="lp-reset" href="#" onclick="return false">Reset direction</a>');
}
