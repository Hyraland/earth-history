import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import {
  EXHIBITS, EXTINCTIONS, WALK_LENGTH, GROUND_PALETTE, SKY_KEYS, ASH_SKY, ageAt, xAtAge,
} from './timeline.js';
import { createTerrain, rawHeight, curveDrop, CURVE_R } from './terrain.js';
import { createSky } from './sky.js';
import { bakeGroundTextures, buildEraLut } from './groundTextures.js';
import { createWalker } from './walker.js';
import { ExhibitManager } from './exhibits/index.js';
import { createHud } from './hud.js';
import { setupCredits } from './credits.js';

// ---- 镜头与行走参数 ----
const CAMERA = { y: 380, z: 0, pitch: -0.36, fov: 40 };
const WALKER = { x: -130, z: -540, scale: 5.5 };   // 小人在画面中的位置（本地坐标，偏左，留出前方视野）
const SPEED = { walk: 40, fast: 420, back: -300 };
// 太阳在前方偏右、仰角约 23°（画面上沿之外）：水面的反光才会朝向镜头，影子朝观众这边拉长
const SUN_DIR = new THREE.Vector3(0.45, 0.4, -0.8).normalize();

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
const terrain = createTerrain({
  rifts,
  textures: bakeGroundTextures(renderer),
  eraLut: buildEraLut(GROUND_PALETTE.map((p) => ({ ...p, x: xAtAge(p.age) })), WALK_LENGTH),
  walkLength: WALK_LENGTH,
});
scene.add(terrain.mesh);
EXHIBITS.forEach((e) => { e.groundH = rawHeight(e.x, e.z); });

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
const jump = (walkerX) => { motion.jumpTo = walkerX - WALKER.x; motion.paused = false; };

// 网址带 #展品id（例如 index.html#stegosaurus）时，直接停在这件展品前面
const linked = EXHIBITS.find((e) => e.id === decodeURIComponent(location.hash.slice(1)));
if (linked) Object.assign(motion, { scroll: linked.x - 330 - WALKER.x, paused: true });

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { motion.paused = !motion.paused; motion.jumpTo = null; e.preventDefault(); }
  if (e.code === 'ArrowRight') { motion.right = true; motion.jumpTo = null; }
  if (e.code === 'ArrowLeft') { motion.left = true; motion.jumpTo = null; }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowRight') motion.right = false;
  if (e.code === 'ArrowLeft') motion.left = false;
});
window.addEventListener('wheel', (e) => {
  motion.jumpTo = null;
  motion.velocity = THREE.MathUtils.clamp(motion.velocity + (e.deltaY + e.deltaX) * 2, -1000, 1000);
}, { passive: true });

const hud = createHud({ onJump: jump });
setupCredits();

// ---- 天空颜色随年代变化，大灭绝前后蒙上一层灰 ----
const skyKeys = SKY_KEYS.map((k) => ({ ...k, h: new THREE.Color(k.horizon), z: new THREE.Color(k.zenith) }));
const ashH = new THREE.Color(ASH_SKY.horizon), ashZ = new THREE.Color(ASH_SKY.zenith);
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

  const horizon = sky.uniforms.uHorizon.value.copy(a.h).lerp(b.h, t).lerp(ashH, ash);
  const zenith = sky.uniforms.uZenith.value.copy(a.z).lerp(b.z, t).lerp(ashZ, ash);
  scene.fog.color.copy(horizon);
  scene.fog.density = 0.00011 + 0.00019 * haze;
  terrain.uniforms.uSkyHorizon.value.copy(horizon);
  hemi.color.copy(zenith).lerp(horizon, 0.6);
  sun.intensity = SUN_POWER * (1 - 0.45 * ash);
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
  updateAtmosphere(age, walkerX);
  updateEnvironment(time);
  hud.update(walkerX, age);
  sky.mesh.position.copy(camera.position);

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
window.__earth = { motion, jump, teleport, step, exhibits, camera, renderer, composer, scene, WALK_LENGTH, WALKER };
