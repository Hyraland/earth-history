// 背景音乐：用 Web Audio 实时生成，没有音频文件。
// 想要的感觉是"夜晚的原野上望着星空"——安静、缓慢、开阔：
//   · 铺底：D 利底亚调式的几个和弦，每个十几秒，慢慢淡入淡出，前后重叠；音色是柔和的三角波和正弦波，经过低通滤波
//   · 低音：一个很轻的 D 音，不是一直都在——每隔半分钟左右像潮水一样涨起来又退下去
//   · 星星：偶尔响起一个高音的"铃声"，衰减很长，左右随机，大部分声音送进混响
//   · 雨：走进卡尼期的雨区时混进沙沙的雨声
// 浏览器只允许在用户操作（点击、按键、滚轮）之后开始播放声音，所以第一次操作时才启动。

const CHORDS = [
  [38, 50, 57, 64, 66, 69],   // D(add9)
  [35, 47, 54, 57, 62, 66],   // Bm7
  [43, 55, 62, 66, 69, 73],   // Gmaj7(#11 的色彩来自 C#)
  [45, 52, 57, 62, 64, 71],   // Asus
];
const STARS = [74, 76, 78, 81, 83, 86, 88, 90, 93];   // D 大调五声音阶的高音区
const CHORD_LEN = 14;          // 秒
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

function impulse(ctx, seconds, decay) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

export function createMusic() {
  let ctx = null, master, dry, wet, rainGain, droneGain;
  let muted = false;
  try { muted = localStorage.getItem('earth-music') === 'off'; } catch { /* 没有存储也没关系 */ }
  let nextChord = 0, chordIndex = 0, nextStar = 0, nextSwell = 0, timer = null;
  let rain = 0;

  function build() {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);

    const reverb = ctx.createConvolver();
    reverb.buffer = impulse(ctx, 7, 2.6);
    wet = ctx.createGain();
    wet.gain.value = 0.9;
    reverb.connect(wet).connect(master);
    dry = ctx.createGain();
    dry.gain.value = 0.55;
    dry.connect(master);
    dry.connect(reverb);
    const starBus = ctx.createGain();       // 星星的声音几乎全送进混响
    starBus.gain.value = 1;
    starBus.connect(reverb);
    const starDry = ctx.createGain();
    starDry.gain.value = 0.25;
    starBus.connect(starDry).connect(master);
    build.starBus = starBus;

    // 低音：振荡器一直在跑，音量平时为 0，由 schedule() 安排偶尔涨落
    const drone = ctx.createOscillator();
    drone.type = 'sine';
    drone.frequency.value = hz(26);
    droneGain = ctx.createGain();
    droneGain.gain.value = 0;
    drone.connect(droneGain).connect(dry);
    drone.start();

    // 雨声：循环的白噪声，带通到"沙沙"的频段
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 900;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 7000;
    rainGain = ctx.createGain();
    rainGain.gain.value = 0;
    src.connect(hp).connect(lp).connect(rainGain).connect(master);
    src.start();

    nextChord = nextStar = ctx.currentTime + 0.5;
    nextSwell = ctx.currentTime + 20;
    timer = setInterval(schedule, 250);
  }

  // 一个和弦：每个音两只略微失谐的振荡器，经过低通；慢起慢落
  function playChord(t, notes) {
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(1, t + 6);
    out.gain.setValueAtTime(1, t + CHORD_LEN - 2);
    out.gain.linearRampToValueAtTime(0, t + CHORD_LEN + 7);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(500, t);
    lp.frequency.linearRampToValueAtTime(1300, t + CHORD_LEN * 0.6);
    lp.frequency.linearRampToValueAtTime(700, t + CHORD_LEN + 7);
    lp.Q.value = 0.3;
    out.connect(lp).connect(dry);
    const end = t + CHORD_LEN + 7.5;
    notes.forEach((m, i) => {
      for (const [type, detune] of [['triangle', -6], ['sine', 7]]) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = hz(m);
        o.detune.value = detune;
        const g = ctx.createGain();
        g.gain.value = (i === 0 ? 0.02 : 0.028) * (type === 'sine' ? 1.2 : 1);   // 最低音放轻，不要一直嗡嗡地垫着
        o.connect(g).connect(out);
        o.start(t);
        o.stop(end);
      }
    });
  }

  // 星星：快起、很长的衰减；正弦加一点高八度的泛音，左右随机
  function playStar(t) {
    const m = STARS[Math.floor(Math.random() * STARS.length)];
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 5.5);
    g.connect(pan).connect(build.starBus);
    for (const [mult, amp] of [[1, 1], [2, 0.25], [3.01, 0.08]]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = hz(m) * mult;
      const og = ctx.createGain();
      og.gain.value = amp;
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + 6);
    }
  }

  function schedule() {
    const now = ctx.currentTime;
    while (nextChord < now + 1) {
      playChord(nextChord, CHORDS[chordIndex % CHORDS.length]);
      chordIndex++;
      nextChord += CHORD_LEN;
    }
    while (nextStar < now + 1) {
      playStar(nextStar);
      if (Math.random() < 0.3) playStar(nextStar + 0.35 + Math.random() * 0.4);   // 偶尔两颗接连响起
      nextStar += 2.5 + Math.random() * 6;
    }
    // 低音的涨落：6 秒涨起、停一会、10 秒退去，间隔 25~50 秒
    if (nextSwell < now + 1) {
      const t = nextSwell, g = droneGain.gain;
      g.setValueAtTime(0, t);
      g.linearRampToValueAtTime(0.03, t + 6);
      g.setValueAtTime(0.03, t + 10);
      g.linearRampToValueAtTime(0, t + 20);
      nextSwell = t + 25 + Math.random() * 25;
    }
    rainGain.gain.setTargetAtTime(rain * 0.09, now, 0.8);
  }

  function apply() {
    if (!ctx) return;
    master.gain.setTargetAtTime(muted ? 0 : 1.0, ctx.currentTime, muted ? 0.4 : 2.5);
    if (muted) setTimeout(() => { if (muted && ctx.state === 'running') ctx.suspend(); }, 1500);
    else ctx.resume();
  }

  return {
    get muted() { return muted; },
    get context() { return ctx; },   // 调试用
    get output() { return master; },
    // 第一次用户操作时调用
    start() {
      if (muted || ctx) return;
      build();
      apply();
    },
    toggle() {
      muted = !muted;
      try { localStorage.setItem('earth-music', muted ? 'off' : 'on'); } catch { /* 忽略 */ }
      if (!ctx && !muted) build();
      apply();
      return muted;
    },
    setRain(v) { rain = v; },
  };
}
