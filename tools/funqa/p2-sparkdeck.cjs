// P2 캐주얼 — 불씨 덱(Spark Deck) 그레이박스 캘리브. 원본 무수정(require.cache 주입).
// 레버: starterDeck의 최저랭크 N장을 enh:'wild'로 마킹 → 랭크·덱크기 불변(점수 인플레 최소),
//       connect 무조건 성립(run-sim:19)으로 연결밀도만↑ → runLen>=4 스파이크 조기·다발 → 도파민(캐주얼 w=.35).
// 판정: 캐주얼 fun을 3시드뱅크(50000/70000/90000) '최저뱅크' 기준 >=6.0. + 회귀가드(타 페르소나 fun 하락<=0.2, 그리디 clear 중립).
// 사용: node tools/funqa/p2-sparkdeck.cjs   (N env 기본 2000, SEED_OFFSET 지정 시 그 단일뱅크만)
const fs = require('fs'), path = require('path'), Module = require('module');
const ROOT = 'C:/Projects/CHAINDEAL';
const RS = path.resolve(ROOT, 'tools/run-sim.cjs');
const N = parseInt(process.env.N || '2000', 10);
const BANKS = process.env.SEED_OFFSET != null ? [parseInt(process.env.SEED_OFFSET, 10)] : [50000, 70000, 90000];

// --- 주입 1: starterDeck에 __SPARK 훅 (최저랭크 n장 → wild). 랭크/무늬/덱크기 유지, enh만 변경.
// --- 주입 2: blindTarget에 __TMUL 스칼라 (난이도 보정 — 와일드 파워를 상쇄해 그리디 clear를 control로 복원).
//     도파민(runLen>=4)은 target 무관 → __TMUL로 난이도만 복원해도 스파이크 밀도는 유지 → '진짜 도파민 레버 vs 위장 완화' 판별.
let src = fs.readFileSync(RS, 'utf8');
const NEEDLE = 'for(let r=1;r<=8;r++) d.push({suit:s,rank:r,enh:null}); return d; }';
if (!src.includes(NEEDLE)) { console.error('❌ starterDeck needle not found — run-sim.cjs drift'); process.exit(1); }
src = src.replace(NEEDLE,
  "for(let r=1;r<=8;r++) d.push({suit:s,rank:r,enh:null}); " +
  "{ const __s=globalThis.__SPARK; if(__s&&__s.n){ const ord=d.map((c,i)=>[c.rank,i]).sort((a,b)=>a[0]-b[0]); for(let k=0;k<__s.n&&k<ord.length;k++) d[ord[k][1]].enh='wild'; } } return d; }");
const TNEEDLE = 'const blindTarget=(a,b)=>Math.round(blindBase(a)*stakeMult(a)*DMULT*(b===0?1:b===1?1.4:1.6));';
if (!src.includes(TNEEDLE)) { console.error('❌ blindTarget needle not found — run-sim.cjs drift'); process.exit(1); }
src = src.replace(TNEEDLE,
  'const blindTarget=(a,b)=>Math.round(blindBase(a)*stakeMult(a)*DMULT*(globalThis.__TMUL||1)*(b===0?1:b===1?1.4:1.6));');
// __BMUL: blindBase 비례 보정 — target·charm(handBonus가 blindBase 사용) 동반 상승 → charm 상대가치 보존, chain 점수만 상대적으로 눌림.
const BNEEDLE = 'const blindBase=a=>150*Math.pow(1.5,a-1);';
if (!src.includes(BNEEDLE)) { console.error('❌ blindBase needle not found — run-sim.cjs drift'); process.exit(1); }
src = src.replace(BNEEDLE, 'const blindBase=a=>150*Math.pow(1.5,a-1)*(globalThis.__BMUL||1);');
const m = new Module(RS, null); m.filename = RS; m.paths = Module._nodeModulePaths(path.dirname(RS)); m._compile(src, RS); require.cache[RS] = m;
const R = m.exports;
const { PERSONAS } = require(path.resolve(ROOT, 'tools/funqa/personas.cjs'));
const { runFullInstrumented } = require(path.resolve(ROOT, 'tools/funqa/runner.cjs'));
const { funScore } = require(path.resolve(ROOT, 'tools/funqa/metrics.cjs'));

const greedyPick = (h, row, b, ctx) => { let bi = 0, bs = -Infinity; for (let i = 0; i < h.length; i++) { const s = R.gain(row.slice(), h[i], b, ctx.owned, ctx.deckSize); if (s > bs) { bs = s; bi = i; } } return bi; };
const T = 6.0;
const RARE = new Set(["flush", "fullHouse", "fourKind", "straightFlush", "fiveKind"]);

// 캐주얼 진단용: 원 dopamine 정의(metrics.cjs:34-45) 미러의 raw 스파이크 통계.
function spikeStats(runs) {
  let rounds = 0, tot = 0, zero = 0;
  for (const r of runs) for (const rd of r.rounds) {
    let sp = 0; for (const t of rd.turns) if (t.runLen >= 4) sp++;
    if (RARE.has(rd.handKind)) sp++;
    rounds++; tot += sp; if (sp === 0) zero++;
  }
  return { spikePerRound: rounds ? tot / rounds : 0, zeroPct: rounds ? zero / rounds : 0 };
}

function measure(spark, tmul, bmul, off) {
  globalThis.__SPARK = spark; globalThis.__TMUL = tmul || 1; globalThis.__BMUL = bmul || 1;
  const per = [];
  let casualStats = null;
  for (const p of PERSONAS) {
    const runs = []; let w = 0;
    for (let i = 0; i < N; i++) { const r = runFullInstrumented(p.pick, p.strat, off + i + 1); runs.push(r); if (r.result === 'win') w++; }
    const fs2 = funScore(runs, p.weight);
    per.push({ id: p.id, fun: fs2.score, dop: fs2.axes.dopamine, ten: fs2.axes.tension, flow: fs2.axes.flow, clear: w / N });
    if (p.id === 'casual') casualStats = spikeStats(runs);
  }
  let gw = 0; for (let i = 0; i < N; i++) if (runFullInstrumented(greedyPick, 'balance', off + i + 1).result === 'win') gw++;
  globalThis.__SPARK = null; globalThis.__TMUL = 1; globalThis.__BMUL = 1;
  return { per, panel: per.filter(x => x.fun >= T).length / PERSONAS.length, greedy: gw / N, casualStats };
}

// n=4 고정. 보정 방식 비교: tmul(blindTarget만 — charm 약화) vs bmul(blindBase — charm 동반상승 보존).
// blindBase가 charm도 올려 자기상쇄 → 난이도 중립엔 bmul>tmul 필요. safe 회귀·charm 의존 페르소나 보존 여부가 관건.
// 최종 트레이드: 와일드 수 n(강도) × blindBase 보정(난이도 중립). safe 회귀 최소화하며 캐주얼 robust >=6 찾기.
const CFG = [
  { k: 'OFF(control)', s: null },
  { k: 'n2 bmul1.14', s: { n: 2 }, b: 1.14 },
  { k: 'n2 bmul1.18', s: { n: 2 }, b: 1.18 },
  { k: 'n3 bmul1.16', s: { n: 3 }, b: 1.16 },
  { k: 'n3 bmul1.20', s: { n: 3 }, b: 1.20 },
  { k: 'n3 bmul1.24', s: { n: 3 }, b: 1.24 },
  { k: 'n4 bmul1.22', s: { n: 4 }, b: 1.22 },
  { k: 'n4 bmul1.26', s: { n: 4 }, b: 1.26 },
];
const pct = x => (x * 100).toFixed(1) + '%';
const f2 = x => x.toFixed(3);

// 뱅크별 표 + 캐주얼 fun 뱅크-집계(최저뱅크 판정)
const casualFunByCfg = {}; CFG.forEach(c => casualFunByCfg[c.k] = []);
const greedyByCfg = {}; CFG.forEach(c => greedyByCfg[c.k] = []);
const safeByCfg = {}; CFG.forEach(c => safeByCfg[c.k] = []);
for (const off of BANKS) {
  console.log(`\n═══ SEED_OFFSET=${off} (seeds ${off + 1}..${off + N}), N=${N} ═══`);
  console.log('cfg'.padEnd(12) + '| 캐주얼fun 도파민 spike/rd 0-spike | 대중재미 | 마스터 안전 콤보 스릴 | 그리디clear');
  for (const c of CFG) {
    const r = measure(c.s, c.t, c.b, off); const g = id => r.per.find(x => x.id === id);
    const cas = g('casual'); casualFunByCfg[c.k].push(cas.fun); greedyByCfg[c.k].push(r.greedy); safeByCfg[c.k].push(g('safe').fun);
    console.log(
      c.k.padEnd(12) +
      `| ${cas.fun.toFixed(2).padStart(7)} ${f2(cas.dop)} ${r.casualStats.spikePerRound.toFixed(2).padStart(6)} ${pct(r.casualStats.zeroPct).padStart(7)} ` +
      `| ${pct(r.panel).padStart(6)} ${r.panel >= 0.7 ? '✅' : '🔴'} ` +
      `| ${g('masterly').fun.toFixed(2)} ${g('safe').fun.toFixed(2)} ${g('combo').fun.toFixed(2)} ${g('thriller').fun.toFixed(2)} ` +
      `| ${pct(r.greedy)}`);
  }
}

// control 그리디 clear 밴드 (난이도 중립 판정 기준)
const ctrlGreedy = greedyByCfg['OFF(control)'];
const ctrlLo = Math.min(...ctrlGreedy), ctrlHi = Math.max(...ctrlGreedy);
console.log(`\n═══ 뱅크-집계: 캐주얼 fun(최저뱅크) + 난이도중립(그리디 clear vs control ${pct(ctrlLo)}~${pct(ctrlHi)}) ═══`);
const safeCtrlMin = Math.min(...safeByCfg['OFF(control)']);
console.log('cfg'.padEnd(12) + '| 캐주최저 fun>=6 | 그리디vsctrl | safe최저(ctrl ' + safeCtrlMin.toFixed(2) + ') 회귀<=0.2 | 종합');
for (const c of CFG) {
  const mn = Math.min(...casualFunByCfg[c.k]);
  const gmid = greedyByCfg[c.k].reduce((s, x) => s + x, 0) / greedyByCfg[c.k].length;
  const gmax = Math.max(...greedyByCfg[c.k]);
  const neutral = gmax <= ctrlHi * 1.6;
  const safeMin = Math.min(...safeByCfg[c.k]);
  const safeReg = safeCtrlMin - safeMin;   // 하락폭
  const ok = mn >= 6 && neutral && safeMin >= 6 && safeReg <= 0.2;
  console.log(c.k.padEnd(12) +
    `| ${mn.toFixed(2).padStart(7)} ${mn >= 6 ? '✅' : '🔴'} | ${pct(gmid).padStart(6)} ${neutral ? '✅' : '🔴인플'} | ${safeMin.toFixed(2)} (Δ${safeReg >= 0 ? '-' : '+'}${Math.abs(safeReg).toFixed(2)}) ${safeReg <= 0.2 && safeMin >= 6 ? '✅' : '⚠️'} | ${ok ? '★★ 최적' : ''}`);
}
