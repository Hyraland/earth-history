import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import {
  STATIONS, EXHIBITS, EXTINCTIONS, WALK_LENGTH, GROUND_PALETTE, SKY_KEYS, ASH_SKY, MOUNTAIN_KEYS, ageAt, xAtAge,
} from './timeline.js';
import { createTerrain, rawHeight, curveDrop, CURVE_R } from './terrain.js';
import { createSky } from './sky.js';
import { bakeGroundTextures, buildEraLut } from './groundTextures.js';
import { createWalker } from './walker.js';
import { ExhibitManager } from './exhibits/index.js';
import { createHud } from './hud.js';
import { setupCredits } from './credits.js';
import { createRain } from './rain.js';
import { createMusic } from './music.js';
import { applyStaticText, switchLanguage, takeResume, t } from './i18n.js';

applyStaticText();   // 英文版：先换掉页面上固定的文字，再挂各种事件

// ---- 镜头与行走参数 ----
const CAMERA = { y: 380, z: 0, pitch: -0.36, fov: 40 };
const WALKER = { x: -130, z: -540, scale: 5.5 };   // 小人在画面中的位置（本地坐标，偏左，留出前方视野）
const SPEED = { walk: 40, fast: 420, back: -300 };
// 太阳在前方偏右、仰角约 23°（画面上沿之外）：水面的反光才会朝向镜头，影子朝观众这边拉长
const SUN_DIR = new THREE.Vector3(0.45, 0.4, -0.8).normalize();   // 默认（白天）的方向；光照菜单里可以改

// ---- 渲染器 ----
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
// 像素密度封顶，并按实际帧率自动升降
const MAX_DPR = Math.min(window.devicePixelRatio, 1.5);
let dpr = MAX_DPR;
renderer.setPixelRatio(dpr);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2('#d2e3f2', 0.00018);

const camera = new THREE.PerspectiveCamera(CAMERA.fov, window.innerWidth / window.innerHeight, 5, 20000);
camera.position.set(0, CAMERA.y, CAMERA.z);
camera.rotation.x = CAMERA.pitch;

// ---- 光照 ----
// 半球光：上方是天光，下方是被阳光照亮的地面反射上来的暖光（逆光时背光面主要靠它）
const hemi = new THREE.HemisphereLight('#c4d8ee', '#b08560', 0.5);
scene.add(hemi);
const SUN_POWER = 3.3;
const sun = new THREE.DirectionalLight('#ffe6c4', SUN_POWER);
sun.target.position.set(0, 0, -820);
sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 2500);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -1400, right: 1400, top: 900, bottom: -900, near: 200, far: 5000 });
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 1.0;
scene.add(sun, sun.target);

// ---- 天空 ----
const sky = createSky();
sky.uniforms.uSunDir.value.copy(SUN_DIR);
const sunDir = SUN_DIR.clone();   // 当前实际的光照方向（太阳，夜里是月亮）
sky.uniforms.uDip.value = Math.sqrt((2 * CAMERA.y) / CURVE_R);
scene.add(sky.mesh);

// ---- 环境光：用天空生成环境贴图，水面和化石会反射出天空 ----
const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene();
const envSky = new THREE.Mesh(sky.mesh.geometry, sky.mesh.material);
envSky.scale.setScalar(0.01);
envScene.add(envSky);
let envTarget = null;
const envKey = { h: new THREE.Color(-1, 0, 0), z: new THREE.Color(), last: -1 };
function updateEnvironment(time) {
  const h = sky.uniforms.uHorizon.value, z = sky.uniforms.uZenith.value;
  const diff = Math.abs(h.r - envKey.h.r) + Math.abs(h.g - envKey.h.g) + Math.abs(h.b - envKey.h.b)
             + Math.abs(z.r - envKey.z.r) + Math.abs(z.g - envKey.z.g) + Math.abs(z.b - envKey.z.b);
  if (diff < 0.02 || time - envKey.last < 0.3) return;   // 天色变化明显时才重新生成
  envKey.h.copy(h); envKey.z.copy(z); envKey.last = time;
  const next = pmrem.fromScene(envScene, 0, 0.1, 100);
  scene.environment = next.texture;
  envTarget?.dispose();
  envTarget = next;
}
scene.environmentIntensity = 0.25;   // 天空漫射光只占直射阳光的一小部分

// ---- 地面 ----
const rifts = EXTINCTIONS.map((e) => e.x);
// 卡尼期洪积事件：这一站周围下雨
const RAIN = { x: STATIONS.find((s) => s.rain).x, r: 900 };
const terrain = createTerrain({
  rifts,
  rain: RAIN,
  textures: bakeGroundTextures(renderer),
  eraLut: buildEraLut(GROUND_PALETTE.map((p) => ({ ...p, x: xAtAge(p.age) })), WALK_LENGTH),
  walkLength: WALK_LENGTH,
  mountains: MOUNTAIN_KEYS.map((k) => ({ ...k, x: xAtAge(k.age) })),
});
scene.add(terrain.mesh);
EXHIBITS.forEach((e) => { e.groundH = rawHeight(e.x, e.z); });

const rain = createRain({ centerX: RAIN.x, radius: RAIN.r });
scene.add(rain.mesh);

// ---- 小人 ----
const walker = createWalker();
walker.object.scale.setScalar(WALKER.scale);
scene.add(walker.object);

// ---- 展品 ----
const exhibits = new ExhibitManager({ scene, exhibits: EXHIBITS, labelLayer: document.getElementById('labels'), renderer });

// ---- 后期：泛光，让熔岩和水面上的太阳反光发出光晕 ----
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.32, 0.4, 1.2);
composer.addPass(bloom);
composer.addPass(new OutputPass());
composer.setPixelRatio(dpr);
composer.setSize(window.innerWidth, window.innerHeight);

// ---- 行走控制 ----
const motion = {
  scroll: -WALKER.x,          // 小人的世界坐标 = scroll + WALKER.x
  velocity: 0,
  paused: false,
  left: false,
  right: false,
  jumpTo: null,
};
const minScroll = -WALKER.x, maxScroll = WALK_LENGTH - WALKER.x;
// 结尾播放时锁住操作（见下面的"结尾"）
const endingLocked = () => ending.state === 'playing';
const jump = (walkerX) => { if (endingLocked()) return; motion.jumpTo = walkerX - WALKER.x; motion.paused = false; };

// 网址带 #站点id（例如 index.html#stegosaurus、#carnian）时，直接停在这一站前面
const linked = STATIONS.find((s) => s.id && s.id === decodeURIComponent(location.hash.slice(1)));
if (linked) Object.assign(motion, { scroll: linked.x - 330 - WALKER.x, paused: true });
// 切换语言后重新载入：回到原来走到的位置
const resume = takeResume();
if (resume) Object.assign(motion, { scroll: resume.scroll, paused: resume.paused });

window.addEventListener('keydown', (e) => {
  if (endingLocked()) { if (e.code === 'Space') e.preventDefault(); return; }
  if (e.code === 'Space') { motion.paused = !motion.paused; motion.jumpTo = null; e.preventDefault(); }
  if (e.code === 'ArrowRight') { motion.right = true; motion.jumpTo = null; }
  if (e.code === 'ArrowLeft') { motion.left = true; motion.jumpTo = null; }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowRight') motion.right = false;
  if (e.code === 'ArrowLeft') motion.left = false;
});
window.addEventListener('wheel', (e) => {
  if (endingLocked()) return;
  motion.jumpTo = null;
  motion.velocity = THREE.MathUtils.clamp(motion.velocity + (e.deltaY + e.deltaX) * 2, -1000, 1000);
}, { passive: true });

const hud = createHud({ onJump: jump });
setupCredits();

// ---- 背景音乐：浏览器要求用户先操作一次（点击或按键）才能出声 ----
const music = createMusic();
const musicLink = document.getElementById('music-toggle');
const showMusic = () => {
  musicLink.textContent = music.muted ? t('♪ 音乐：关', '♪ Music: off') : music.started ? t('♪ 音乐：开', '♪ Music: on') : t('♪ 音乐：点击页面开始', '♪ Music: click anywhere to start');
};
showMusic();
musicLink.addEventListener('click', (e) => {
  e.stopPropagation();
  if (!music.muted && !music.started) music.start();   // 还没开始时点它，是想开始而不是关掉
  else music.toggle();
  setTimeout(showMusic, 50);
});
// 在捕获阶段监听：页面上的控件（时间轴、菜单）拦下事件也不影响；滚轮不算"用户操作"，浏览器不允许它启动声音
const startMusic = (e) => {
  if (e.target === musicLink) return;          // 点的是开关本身，交给开关处理
  music.start();
  setTimeout(showMusic, 50);
};
for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, startMusic, { capture: true });

// ---- 天空颜色随年代变化，大灭绝前后蒙上一层灰 ----
const skyKeys = SKY_KEYS.map((k) => ({ ...k, h: new THREE.Color(k.horizon), z: new THREE.Color(k.zenith) }));
const ashH = new THREE.Color(ASH_SKY.horizon), ashZ = new THREE.Color(ASH_SKY.zenith);
const rainH = new THREE.Color('#9fa8ad'), rainZ = new THREE.Color('#5f6b75');   // 阴雨天：灰蓝色，头顶更暗
const sunsetH = new THREE.Color('#c8927a'), sunsetZ = new THREE.Color('#14244a');   // 夕阳：天边暗粉紫（金橙色的辉光另外加），头顶深蓝
const nightH = new THREE.Color('#141d2c'), nightZ = new THREE.Color('#03060d');
let rainSky = 0;
function updateAtmosphere(age, walkerX) {
  let i = 1;
  while (i < skyKeys.length - 1 && age < skyKeys[i].age) i++;
  const a = skyKeys[i - 1], b = skyKeys[i];
  const t = THREE.MathUtils.clamp((a.age - age) / (a.age - b.age), 0, 1);
  let haze = THREE.MathUtils.lerp(a.haze, b.haze, t);
  let ash = 0;
  for (const ex of EXTINCTIONS) ash = Math.max(ash, 1 - THREE.MathUtils.smoothstep(Math.abs(walkerX - ex.x), 250, 1100));
  ash *= 0.75;
  haze = THREE.MathUtils.lerp(haze, 1, ash);
  // 走近雨区：天色转阴，云压下来，阳光变弱
  rainSky = 1 - THREE.MathUtils.smoothstep(Math.abs(walkerX - RAIN.x), RAIN.r * 0.35, RAIN.r * 1.4);
  haze = THREE.MathUtils.lerp(haze, 0.85, rainSky);
  sky.uniforms.uCloud.value = rainSky;

  const horizon = sky.uniforms.uHorizon.value.copy(a.h).lerp(b.h, t).lerp(ashH, ash).lerp(rainH, rainSky * 0.85);
  const zenith = sky.uniforms.uZenith.value.copy(a.z).lerp(b.z, t).lerp(ashZ, ash).lerp(rainZ, rainSky * 0.85);
  horizon.lerp(sunsetH, tod.sunset * 0.72).lerp(nightH, tod.night * 0.92);
  zenith.lerp(sunsetZ, tod.sunset * 0.9).lerp(nightZ, tod.night * 0.96);
  scene.fog.color.copy(horizon);
  scene.fog.density = 0.00011 + 0.00019 * haze;
  terrain.uniforms.uSkyHorizon.value.copy(horizon);
  hemi.color.copy(zenith).lerp(horizon, 0.6);
  sun.intensity = tod.power * (1 - 0.45 * ash) * (1 - 0.88 * rainSky);
}

// ---- 光照：白天 / 夕阳 / 夜晚，太阳（夜里是月亮）的方位和高度可调 ----
// 三种模式的参数按权重混合，切换时一两秒内平滑过渡。方位 0° 是正前方（远处的崖壁方向），正数偏右。
const DEG = Math.PI / 180;
const LIGHT_MODES = {
  day:    { elevation: 24, color: new THREE.Color('#ffe6c4'), power: SUN_POWER, hemi: 0.5,  ground: new THREE.Color('#b08560'), env: 0.25, exposure: 1.0 },
  sunset: { elevation: 4,  color: new THREE.Color('#ff9a52'), power: 2.6,       hemi: 0.3,  ground: new THREE.Color('#7a4a32'), env: 0.3,  exposure: 1.05 },
  night:  { elevation: 22, color: new THREE.Color('#a8bcff'), power: 0.34,      hemi: 0.12, ground: new THREE.Color('#1c1e28'), env: 0.2,  exposure: 1.3 },
};
const light = { mode: 'day', azimuth: 29, elevation: 24 };
try { Object.assign(light, JSON.parse(localStorage.getItem('earth-light') || '{}')); } catch { /* 用默认值 */ }
// 可调范围：方位左右各 39°（太阳始终在画面前方），高度 0°~25°；旧设置超出范围时收进来
const AZ_MAX = 39, EL_MAX = 25;
light.azimuth = THREE.MathUtils.clamp(light.azimuth, -AZ_MAX, AZ_MAX);
light.elevation = THREE.MathUtils.clamp(light.elevation, 0, EL_MAX);
const tod = { sunset: 0, night: 0, az: light.azimuth, el: light.elevation, power: SUN_POWER };
if (light.mode !== 'day') tod[light.mode] = 1;
const tmpColor = new THREE.Color();
const dirFrom = (az, el, out) => out.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));

function updateLighting(dt) {
  const k = Math.min(1, dt * 1.5);
  tod.sunset += ((light.mode === 'sunset' ? 1 : 0) - tod.sunset) * k;
  tod.night += ((light.mode === 'night' ? 1 : 0) - tod.night) * k;
  tod.az += (light.azimuth - tod.az) * k;
  tod.el += (light.elevation - tod.el) * k;
  const wd = Math.max(0, 1 - tod.sunset - tod.night), { day, sunset, night } = LIGHT_MODES;
  const mix = (f) => f(day) * wd + f(sunset) * tod.sunset + f(night) * tod.night;

  dirFrom(tod.az * DEG, tod.el * DEG, sunDir);
  sun.position.copy(sun.target.position).addScaledVector(sunDir, 2500);
  sun.color.setRGB(mix((m) => m.color.r), mix((m) => m.color.g), mix((m) => m.color.b));
  tod.power = mix((m) => m.power);
  hemi.intensity = mix((m) => m.hemi);
  hemi.groundColor.setRGB(mix((m) => m.ground.r), mix((m) => m.ground.g), mix((m) => m.ground.b));
  scene.environmentIntensity = mix((m) => m.env);
  renderer.toneMappingExposure = mix((m) => m.exposure);

  // 天空里的日轮：夕阳时画在地平线上方一点（真实的太阳高度在画面上沿之外），夜里换成月亮
  const dip = sky.uniforms.uDip.value;
  const discEl = THREE.MathUtils.lerp(tod.el * DEG, 0.035 - dip, tod.sunset);
  dirFrom(tod.az * DEG, discEl, sky.uniforms.uSunDir.value);
  dirFrom(tod.az * DEG, 0.13 - dip, sky.uniforms.uMoonDir.value);
  sky.uniforms.uSunVis.value = 1 - tod.night;
  sky.uniforms.uGlow.value = tod.sunset;
  sky.uniforms.uStars.value = tod.night;
  sky.uniforms.uMoon.value = tod.night;
}

// 菜单
function setupLightPanel() {
  const panel = document.getElementById('light-panel');
  const az = document.getElementById('lp-az'), el = document.getElementById('lp-el');
  const azV = document.getElementById('lp-az-v'), elV = document.getElementById('lp-el-v');
  const buttons = [...panel.querySelectorAll('[data-mode]')];
  const save = () => { try { localStorage.setItem('earth-light', JSON.stringify(light)); } catch { /* 忽略 */ } };
  const show = () => {
    az.value = light.azimuth; el.value = light.elevation;
    azV.textContent = `${light.azimuth > 0 ? t('右', 'R') : light.azimuth < 0 ? t('左', 'L') : ''} ${Math.abs(light.azimuth)}°`;
    elV.textContent = `${light.elevation}°`;
    buttons.forEach((b) => b.classList.toggle('on', b.dataset.mode === light.mode));
    document.getElementById('lp-body-label').textContent = light.mode === 'night' ? t('月亮', 'Moon') : t('太阳', 'Sun');
  };
  buttons.forEach((b) => b.addEventListener('click', () => {
    light.mode = b.dataset.mode;
    light.elevation = LIGHT_MODES[light.mode].elevation;
    show(); save();
  }));
  az.addEventListener('input', () => { light.azimuth = +az.value; show(); save(); });
  el.addEventListener('input', () => { light.elevation = +el.value; show(); save(); });
  document.getElementById('lp-reset').addEventListener('click', () => {
    Object.assign(light, { azimuth: 29, elevation: LIGHT_MODES[light.mode].elevation }); show(); save();
  });
  // 面板里的按键和滚轮不要传给行走控制
  for (const ev of ['keydown', 'keyup', 'wheel', 'pointerdown']) panel.addEventListener(ev, (e) => e.stopPropagation());
  document.getElementById('light-open').addEventListener('click', (e) => { e.stopPropagation(); panel.hidden = !panel.hidden; });
  show();
  return show;
}
const refreshLightPanel = setupLightPanel();

// 中英文切换
document.getElementById('lang-toggle').addEventListener('click', (e) => { e.stopPropagation(); switchLanguage(motion); });

// ---- 结尾：走到"现在"时，天黑下来，镜头慢慢抬头望向银河，结束语一行行浮现，像展览的尾声 ----
// 每次打开（或刷新）页面后第一次走到这里时自动播放，播放时锁住操作，播完把操作还给观众；
// 同一次浏览里看过之后不再自动播放，菜单里出现"重播结尾"。往回走一段后，恢复观众原来选的光照。
const END_X = WALK_LENGTH;
const ENDING_LINES = t([
  '你走到了今天。',
  '四十六亿年里，这颗星球冷却、下雨、冰封，又开满了花。',
  '五次大灭绝之后，生命每一次都重新开始。',
  '如果把这四十六亿年压缩成一天，智人出现在午夜前的最后六秒。',
  '我们身体里的碳、氧和铁，都诞生在比太阳更古老的恒星里。',
  '谢谢你走完这段路。',
], [
  'And here you are: today.',
  'Over 4.6 billion years, this planet cooled, rained, froze over, and burst into flower.',
  'Five times, mass extinction brought life to the brink, and five times it began again.',
  'If Earth\'s 4.6 billion years were a single day, our species would appear in the last six seconds before midnight.',
  'The carbon, oxygen and iron in our bodies were forged in stars older than the Sun.',
  'Thank you for walking all this way.',
]);
const ending = { state: 'idle', t: 0, lift: 0, saved: null, pending: false, seen: false };
const endingEl = document.getElementById('ending');
const endingLines = endingEl.querySelector('.ending-lines');
const replayLink = document.getElementById('ending-replay');
ENDING_LINES.forEach((text, i) => {
  const p = document.createElement('p');
  p.textContent = text;
  if (i === 0) p.className = 'first';
  endingLines.appendChild(p);
});
replayLink.hidden = !ending.seen;
replayLink.addEventListener('click', (e) => { e.stopPropagation(); ending.pending = true; jump(END_X); });

function startEnding() {
  ending.state = 'playing';
  ending.t = 0;
  ending.saved ??= { ...light };
  if (light.mode !== 'night') { Object.assign(light, { mode: 'night', elevation: LIGHT_MODES.night.elevation }); refreshLightPanel(); }   // 不存进本地设置
  Object.assign(motion, { jumpTo: END_X - WALKER.x, paused: true, right: false, left: false });
  [...endingLines.children].forEach((p) => p.classList.remove('on'));
  endingLines.classList.remove('dim');
  endingEl.hidden = false;
  document.body.classList.add('ending-playing');
  document.getElementById('light-panel').hidden = true;
  walker.setGazeUp(1);
  music.flourish();
}
function finishEnding() {
  ending.state = 'done';
  document.body.classList.remove('ending-playing');
  endingLines.classList.add('dim');
  walker.setGazeUp(0);
  ending.seen = true;   // 只记在这次浏览里，刷新页面后又会自动播放
  replayLink.hidden = false;
}
function leaveEnding() {
  ending.state = 'idle';
  endingEl.hidden = true;
  if (ending.saved) { Object.assign(light, ending.saved); refreshLightPanel(); }
  ending.saved = null;
}
function updateEnding(dt, walkerX) {
  const arrived = walkerX >= END_X - 150;
  if (ending.state === 'idle' && arrived && (ending.pending || (!ending.seen && motion.velocity >= 0))) {
    ending.pending = false;
    startEnding();
  }
  if (ending.state === 'playing') {
    ending.t += dt;
    [...endingLines.children].forEach((p, i) => p.classList.toggle('on', ending.t > 5 + i * 3.6));
    if (ending.t > 5 + ENDING_LINES.length * 3.6 + 4) finishEnding();
  }
  if (ending.state === 'done' && walkerX < END_X - 700) leaveEnding();
  // 镜头：抬头望向银河（从俯视 -0.36 抬到仰视 0.26），播完再慢慢低头
  const target = ending.state === 'playing' && ending.t > 2.5 ? 1 : 0;
  ending.lift += (target - ending.lift) * Math.min(1, dt * (target ? 0.3 : 0.7));
  const e = ending.lift * ending.lift * (3 - 2 * ending.lift);
  camera.rotation.x = CAMERA.pitch + e * 0.62;
  camera.position.y = CAMERA.y - e * 60;
}

// ---- 自适应分辨率 ----
const perf = { sum: 0, n: 0 };
function adaptResolution(rawDt) {
  if (rawDt > 0.25) return;               // 切到后台回来的那一帧不算
  perf.sum += rawDt; perf.n++;
  if (perf.n < 45) return;
  const avg = perf.sum / perf.n;
  perf.sum = perf.n = 0;
  let next = dpr;
  if (avg > 1 / 45) next = Math.max(0.6, dpr - 0.15);
  else if (avg < 1 / 58) next = Math.min(MAX_DPR, dpr + 0.1);
  if (Math.abs(next - dpr) > 0.01) { dpr = next; renderer.setPixelRatio(dpr); composer.setPixelRatio(dpr); }
}

// ---- 主循环 ----
const clock = new THREE.Clock();
function step() {
  const rawDt = clock.getDelta();
  const dt = Math.min(rawDt, 0.05);
  adaptResolution(rawDt);
  const time = clock.elapsedTime;

  let target = motion.paused ? 0 : SPEED.walk;
  if (motion.right) target = SPEED.fast;
  if (motion.left) target = SPEED.back;
  if (motion.jumpTo !== null) {
    const d = motion.jumpTo - motion.scroll;
    target = THREE.MathUtils.clamp(d * 1.6, -5000, 5000);
    if (Math.abs(d) < 3) motion.jumpTo = null;
  }
  motion.velocity += (target - motion.velocity) * Math.min(1, dt * 2.5);
  motion.scroll += motion.velocity * dt;
  if (motion.scroll <= minScroll || motion.scroll >= maxScroll) {
    motion.scroll = THREE.MathUtils.clamp(motion.scroll, minScroll, maxScroll);
    if (motion.scroll >= maxScroll && motion.velocity > 0) motion.velocity = 0;
    if (motion.scroll <= minScroll && motion.velocity < 0) motion.velocity = 0;
  }

  const walkerX = motion.scroll + WALKER.x;
  const age = ageAt(walkerX);

  terrain.update(motion.scroll, time);
  walker.object.position.set(WALKER.x, rawHeight(walkerX, WALKER.z) - curveDrop(WALKER.x, WALKER.z), WALKER.z);
  walker.update(dt, motion.velocity / WALKER.scale);
  exhibits.update(motion.scroll, camera, window.innerWidth, window.innerHeight);
  updateLighting(dt);
  updateAtmosphere(age, walkerX);
  updateEnvironment(time);
  hud.update(walkerX, age);
  updateEnding(dt, walkerX);
  sky.mesh.position.copy(camera.position);
  sky.uniforms.uTime.value = time;
  // 雨幕：雨区进入画面范围（左右约 1800）时才绘制
  music.setRain(rainSky);
  rain.update(time, motion.scroll, 1 - THREE.MathUtils.smoothstep(Math.abs(motion.scroll - RAIN.x), RAIN.r + 1600, RAIN.r + 2100));

  composer.render();
}
function frame() {
  step();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// 调试用
// teleport：直接停在某个位置并手动渲染一帧——浏览器标签在后台、不跑动画帧时也能检查画面
const teleport = (walkerX) => {
  Object.assign(motion, { scroll: walkerX - WALKER.x, velocity: 0, jumpTo: null, paused: true });
  step();
};
window.__earth = { motion, jump, teleport, step, music, walker, ending, exhibits, camera, renderer, composer, scene, WALK_LENGTH, WALKER };
