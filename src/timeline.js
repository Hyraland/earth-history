// 地球历史时间轴：展品、地球事件、地质年代与"世界坐标 ↔ 年代"的换算。
// 年代单位统一为 Ma（百万年前）。

// ---- 站点：按时间顺序排列。展品之间留更长的路，事件之间留短一点 ----
// kind: 'exhibit' 展品 | 'event' 地球事件 | 'extinction' 大灭绝 | 'start' / 'end'
export const STATIONS = [
  { kind: 'start', age: 4600, name: '地球形成', desc: '岩浆海洋逐渐冷却，最早的地壳开始形成。' },
  { kind: 'exhibit', id: 'stromatolite', age: 3500, name: '叠层石', latin: 'Stromatolite',
    milestone: '最早的生命', desc: '微生物席一层层黏结沉积物形成的圆丘，是地球上最古老的生命证据之一。' },
  { kind: 'event', age: 2400, name: '大氧化事件', desc: '光合微生物释放的氧气开始在大气中累积，海水中的铁被氧化，沉淀成红黑相间的条带状铁建造。' },
  { kind: 'exhibit', id: 'grypania', age: 1870, name: '卷曲藻', latin: 'Grypania spiralis',
    milestone: '真核生物出现', desc: '肉眼可见的螺旋带状化石，可能是最早的真核藻类之一。' },
  { kind: 'event', age: 720, name: '雪球地球', desc: '冰川可能一直延伸到赤道，整颗星球几乎被冰雪覆盖，持续近亿年。' },
  { kind: 'exhibit', id: 'dickinsonia', age: 558, name: '狄更逊水母', latin: 'Dickinsonia',
    milestone: '最早的复杂动物', desc: '扁平分节的椭圆形生物。它的化石中检出了胆固醇分子，证实它是动物，而不是真的水母。' },
  { kind: 'exhibit', id: 'trilobite', age: 521, name: '三叶虫', latin: 'Trilobita',
    milestone: '寒武纪大爆发', desc: '最早拥有复杂眼睛的动物之一，在海洋中繁盛了近 3 亿年。' },
  { kind: 'extinction', age: 445, name: '奥陶纪末大灭绝', desc: '冰期来临、海平面骤降，约 85% 的海洋物种消失。' },
  { kind: 'exhibit', id: 'cooksonia', age: 430, name: '库克逊蕨', latin: 'Cooksonia',
    milestone: '植物登上陆地', desc: '只有几厘米高的分叉小茎，顶端长着孢子囊，是最早的维管植物之一。' },
  { kind: 'exhibit', id: 'tiktaalik', age: 375, name: '提塔利克鱼', latin: 'Tiktaalik roseae',
    milestone: '从水走上陆地', desc: '有脖子、有能撑起身体的鳍肢，介于鱼和四足动物之间。' },
  { kind: 'extinction', age: 372, name: '泥盆纪晚期大灭绝', desc: '海洋大范围缺氧，生物礁生态系统崩溃。' },
  { kind: 'exhibit', id: 'dunkleosteus', age: 365, name: '邓氏鱼', latin: 'Dunkleosteus terrelli',
    milestone: '有颌鱼称霸', desc: '体长约 4 米、头部覆盖厚重骨甲的盾皮鱼，泥盆纪"鱼类时代"的顶级掠食者。' },
  { kind: 'exhibit', id: 'lepidodendron', age: 310, name: '鳞木', latin: 'Lepidodendron',
    milestone: '最早的大森林', desc: '高达 30 多米的石松类大树，树皮布满菱形叶痕。石炭纪森林的遗骸变成了今天的煤层。' },
  { kind: 'exhibit', id: 'diictodon', age: 258, name: '二齿兽', latin: 'Diictodon feliceps',
    milestone: '哺乳动物的远祖支系', desc: '二叠纪晚期的小型植食性合弓类，嘴里只有一对獠牙，会挖洞生活。合弓类不是恐龙，和哺乳动物的亲缘关系反而更近。' },
  { kind: 'extinction', age: 252, name: '二叠纪末大灭绝', desc: '西伯利亚大规模火山喷发，八成以上的海洋物种灭绝，是地球史上最严重的一次。' },
  { kind: 'extinction', age: 201, name: '三叠纪末大灭绝', desc: '中大西洋岩浆省喷发。灾难之后，恐龙崛起为陆地霸主。' },
  { kind: 'exhibit', id: 'ammonite', age: 195, name: '菊石', latin: 'Asteroceras obtusum',
    milestone: '中生代的海洋', desc: '侏罗纪早期的菊石，粗壮笔直的放射肋和腹部中央的棱脊是它的特征。菊石演化快、分布广，是地质学家划分地层的"时钟"。' },
  { kind: 'exhibit', id: 'ichthyosaur', age: 182, name: '狭翼鱼龙', latin: 'Stenopterygius quadriscissus',
    milestone: '爬行动物重返海洋', desc: '德国霍尔茨马登黑色页岩中的完整骨架。鱼龙的祖先是陆地爬行动物，三叠纪初期重新回到海洋，演化出和海豚相似的流线体形。' },
  { kind: 'exhibit', id: 'mamenchisaurus', age: 160, name: '马门溪龙', latin: 'Mamenchisaurus',
    milestone: '恐龙称霸陆地', desc: '颈长可达 15 米，是已知脖子最长的动物之一。' },
  { kind: 'exhibit', id: 'archaeopteryx', age: 150, name: '始祖鸟', latin: 'Archaeopteryx',
    milestone: '鸟类起源', desc: '有羽毛和翅膀，也有牙齿和长长的尾骨，是恐龙与鸟之间的过渡。' },
  { kind: 'exhibit', id: 'archaefructus', age: 125, name: '辽宁古果', latin: 'Archaefructus liaoningensis',
    milestone: '开花植物出现', desc: '种子被心皮包裹，是已知最早的开花植物之一。' },
  { kind: 'exhibit', id: 'triceratops', age: 67, name: '三角龙', latin: 'Triceratops horridus',
    milestone: '恐龙时代的尾声', desc: '最后的非鸟恐龙之一，与霸王龙生活在同一时代。这具骨架由 J. B. Hatcher 于 1890 年在怀俄明州采集，现藏史密森尼国家自然历史博物馆。' },
  { kind: 'extinction', age: 66, name: '白垩纪末大灭绝', desc: '小行星撞击希克苏鲁伯，非鸟恐龙与菊石一同消失。' },
  { kind: 'exhibit', id: 'cetotherium', age: 11, name: '鲸兽', latin: 'Cetotherium riabinini',
    milestone: '海洋里的哺乳动物', desc: '中新世的小型须鲸，靠鲸须滤食。鲸的祖先是陆地上的偶蹄类，大约 5000 万年前才回到海洋。这具骨架藏于乌克兰国家自然历史博物馆。' },
  { kind: 'exhibit', id: 'lucy', age: 3.2, name: '露西', latin: 'Australopithecus afarensis',
    milestone: '直立行走', desc: '骨盆和腿骨显示她已能直立行走，而脑容量仍与黑猩猩相近。' },
  { kind: 'event', age: 2.58, name: '第四纪冰期', desc: '冰盖周期性地推进和消退，冰期与间冰期开始交替。' },
  { kind: 'exhibit', id: 'mammoth', age: 0.02, name: '猛犸象', latin: 'Mammuthus primigenius',
    milestone: '末次冰盛期', desc: '长毛象的象牙可达 4 米长。它们与早期人类共同生活在冰原上。' },
  { kind: 'end', age: 0, name: '现在', desc: '你走到了今天。' },
];

// 每类站点占用的"半宽"——相邻两站的距离 = 两者半宽之和
const HALF_SPACING = { exhibit: 720, event: 400, extinction: 400, start: 260, end: 460 };

// 展品摆放的纵深（负 z 越远）和大小，循环使用，避免排成一条直线
const DEPTHS = [-840, -900, -800, -930, -870];

let x = 0;
STATIONS.forEach((s, i) => {
  if (i > 0) x += HALF_SPACING[STATIONS[i - 1].kind] + HALF_SPACING[s.kind];
  s.x = x;
});
export const WALK_LENGTH = x;

export const EXHIBITS = STATIONS.filter((s) => s.kind === 'exhibit');
EXHIBITS.forEach((e, i) => {
  e.index = i + 1;
  e.z ??= DEPTHS[i % DEPTHS.length];   // 可在站点里单独指定纵深
});

export const EXTINCTIONS = STATIONS.filter((s) => s.kind === 'extinction');

// ---- 世界坐标 x ↔ 年代（站点之间线性插值，站点之外夹紧） ----
export function ageAt(wx) {
  if (wx <= 0) return STATIONS[0].age;
  for (let i = 1; i < STATIONS.length; i++) {
    const a = STATIONS[i - 1], b = STATIONS[i];
    if (wx <= b.x) return a.age + (b.age - a.age) * ((wx - a.x) / (b.x - a.x));
  }
  return 0;
}

export function xAtAge(age) {
  if (age >= STATIONS[0].age) return 0;
  for (let i = 1; i < STATIONS.length; i++) {
    const a = STATIONS[i - 1], b = STATIONS[i];
    if (age >= b.age) return a.x + (b.x - a.x) * ((a.age - age) / (a.age - b.age));
  }
  return WALK_LENGTH;
}

// ---- 地质年代表（起始年代，Ma） ----
const EONS = [
  [4600, '冥古宙'], [4000, '太古宙'], [2500, '元古宙'], [538.8, '显生宙'],
];
const ERAS = [
  [2500, '古元古代'], [1600, '中元古代'], [1000, '新元古代'],
  [538.8, '古生代'], [251.9, '中生代'], [66, '新生代'],
];
const PERIODS = [
  [1000, '拉伸纪'], [720, '成冰纪'], [635, '埃迪卡拉纪'],
  [538.8, '寒武纪'], [485.4, '奥陶纪'], [443.8, '志留纪'], [419.2, '泥盆纪'],
  [358.9, '石炭纪'], [298.9, '二叠纪'], [251.9, '三叠纪'], [201.4, '侏罗纪'],
  [145, '白垩纪'], [66, '古近纪'], [23.03, '新近纪'], [2.58, '第四纪'],
];

function pick(table, age) {
  let found = null;
  for (const [start, name] of table) if (age <= start) found = name;
  return found;
}

export function geoNames(age) {
  return [pick(EONS, age), pick(ERAS, age), pick(PERIODS, age)].filter(Boolean);
}

// 年代 → 中文读法："35 亿年前" / "320 万年前" / "2 万年前"
export function formatAge(age, { suffix = '前' } = {}) {
  if (age <= 0.0005) return '现在';
  if (age >= 100) {
    const yi = age / 100;
    return `${Number(yi.toFixed(yi >= 10 ? 1 : 2))} 亿年${suffix}`;
  }
  const wan = age * 100;
  if (wan >= 1) return `${wan >= 100 ? Math.round(wan) : Number(wan.toFixed(1))} 万年${suffix}`;
  return `${Math.round(age * 1e6).toLocaleString()} 年${suffix}`;
}

// ---- 地貌：按年代分段 ----
// a / b 岩土色，v 植被色，wc 水色（sRGB）
// veg 植被覆盖，tree 乔木比例（0 草地/苔原，1 森林），water 浅水/潮坪/沼泽，lava 熔岩，
// ice 冰雪，dunes 沙丘，cracks 龟裂，rock 层状岩床露头
export const GROUND_PALETTE = [
  // 冥古宙：黑色玄武岩结壳，裂缝和熔岩湖发光
  { age: 4600, a: '#1f1917', b: '#3b2e28', lava: 1, cracks: 1, rock: 0.1 },
  // 太古宙：深色火山岩，大片浅海（富含二价铁的海水可能偏绿）
  { age: 4000, a: '#3e413c', b: '#625f53', wc: '#2f5a4c', water: 0.55, cracks: 0.45, rock: 0.35 },
  // 大氧化之后：铁被氧化，条带状铁建造的红黑岩层
  { age: 2400, a: '#6a2c1e', b: '#ad5a3c', wc: '#27566a', water: 0.3, cracks: 0.3, rock: 0.8 },
  // 雪球地球：冰原、冰裂和风蚀雪脊
  { age: 720, a: '#b4c6d2', b: '#edf2f6', ice: 1, cracks: 0.55, dunes: 0.45 },
  // 埃迪卡拉纪：潮坪、微生物席、泥裂
  { age: 635, a: '#7a705f', b: '#a8977b', v: '#5a6048', veg: 0.2, wc: '#2a5a66', water: 0.5, cracks: 0.5, rock: 0.2 },
  // 寒武纪：灰绿色页岩与浅海
  { age: 538.8, a: '#686e60', b: '#948f7a', v: '#5d6448', veg: 0.1, wc: '#245e6e', water: 0.55, cracks: 0.35, rock: 0.3 },
  // 奥陶–志留纪：浅灰石灰岩，陆地上只有苔藓状的地衣和最早的小植物
  { age: 485.4, a: '#8f8a7e', b: '#bdb6a5', v: '#6b7148', veg: 0.08, wc: '#2a6272', water: 0.4, cracks: 0.2, rock: 0.5 },
  // 泥盆纪：老红砂岩，最早的森林
  { age: 419.2, a: '#86432f', b: '#b46a4c', v: '#4b6634', veg: 0.35, tree: 0.6, wc: '#2e5560', water: 0.2, rock: 0.35 },
  // 石炭纪：成片的沼泽森林
  { age: 358.9, a: '#3e4034', b: '#5c5a48', v: '#2c4a28', veg: 0.85, tree: 0.95, wc: '#2a3a2c', water: 0.4 },
  // 二叠纪：盘古大陆内部的荒漠沙丘
  { age: 298.9, a: '#a2573a', b: '#d19262', v: '#6b6b3c', veg: 0.06, tree: 0.5, dunes: 0.85, rock: 0.3 },
  // 三叠纪：红层（像参考图里的峡谷地）
  { age: 251.9, a: '#93432e', b: '#c97a52', v: '#5e6a3a', veg: 0.12, tree: 0.6, dunes: 0.2, rock: 0.85 },
  // 侏罗纪：浅黄砂岩，针叶林与蕨类
  { age: 201.4, a: '#bd966e', b: '#e2c89f', v: '#38563a', veg: 0.45, tree: 0.85, wc: '#2b6070', water: 0.12, rock: 0.4 },
  // 白垩纪：白垩与开花植物带来的更鲜亮的绿
  { age: 145, a: '#b3ab96', b: '#e1dbc9', v: '#46703a', veg: 0.6, tree: 0.8, wc: '#2c6878', water: 0.2, rock: 0.2 },
  // 古近纪：温暖湿润，森林茂密
  { age: 66, a: '#86705a', b: '#b39a78', v: '#3b6630', veg: 0.82, tree: 1, wc: '#2d5c62', water: 0.1 },
  // 新近纪：草原扩张
  { age: 23.03, a: '#978659', b: '#c2b07a', v: '#96994c', veg: 0.72, tree: 0.12, rock: 0.15 },
  // 第四纪：冰盖、冻土与苔原
  { age: 2.58, a: '#8b9288', b: '#d9dfe2', v: '#6f7a5c', veg: 0.2, tree: 0.25, ice: 0.6, cracks: 0.3 },
  // 全新世：冰期结束
  { age: 0.0117, a: '#8a775a', b: '#c0a37c', v: '#627a3a', veg: 0.55, tree: 0.5, wc: '#2d5c6a', water: 0.1, rock: 0.25 },
];

// ---- 天空：按年代的关键帧（sRGB） ----
// 天空的蓝主要来自氮气的瑞利散射，与氧气无关：只要大气清澈，远古也是蓝天。
// 冥古宙原始大气浓厚多蒸汽，偏浑浊；太古宙可能有间歇的有机雾霾，蓝天偏暖偏淡；
// 大氧化之后甲烷雾霾消失，是清澈的蓝天。
export const SKY_KEYS = [
  { age: 4600, horizon: '#b98f72', zenith: '#5d5552', haze: 1.0 },
  { age: 4000, horizon: '#d9cbb8', zenith: '#7f96ae', haze: 0.75 },
  { age: 2600, horizon: '#d4d3cc', zenith: '#6f93bf', haze: 0.6 },
  { age: 2300, horizon: '#c3d8ee', zenith: '#2f6cc0', haze: 0.35 },
  { age: 720, horizon: '#d6e6f4', zenith: '#3a7ccc', haze: 0.25 },    // 雪球地球：空气干冷，格外通透
  { age: 600, horizon: '#c2d8ee', zenith: '#2a66bd', haze: 0.3 },
  { age: 0, horizon: '#c2d8ee', zenith: '#2a66bd', haze: 0.3 },
];
// 大灭绝前后火山灰、撞击尘埃让天空暂时变暗
export const ASH_SKY = { horizon: '#a89484', zenith: '#5e5650' };
