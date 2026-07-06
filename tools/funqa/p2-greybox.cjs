// ⚠️ FROZEN(2026-07-01, pre-spark): run-sim에 v3.29 불씨덱이 baked in됨 → 재실행 시 double-spark(가드 없음). 기록된 판정은 measurement-summary-2026-07-01.md 참조. 히스토리 보존용, 재실행 금지.
// P2 그레이박스 실험 — 긴 체인 가산 보너스 스윕. QA 측정 전용(게임 코드 무수정).
// run-sim.cjs 소스를 in-memory 패치 → require.cache 주입 → funqa 파이프라인 그대로 재사용.
// 보너스 항은 globalThis.__EXP 로 런타임 스위칭(제어군 OFF=null).
const fs = require('fs');
const path = require('path');
const Module = require('module');

const ROOT = 'C:/Projects/CHAINDEAL';
const RS = path.resolve(ROOT, 'tools/run-sim.cjs');
const N = parseInt(process.env.N || '2000', 10);

// 1) 소스 읽기 + 주입점 확인(유일성 assert)
let src = fs.readFileSync(RS, 'utf8');
const NEEDLE = 'let bonus=sum*mult;';
const cnt = src.split(NEEDLE).length - 1;
if (cnt !== 1) { console.error(`주입점 '${NEEDLE}' 개수=${cnt} (기대 1). 중단.`); process.exit(2); }
// 가드된 가산 항: __EXP 없으면 no-op → OFF는 baseline 정확 재현.
const INJECT = NEEDLE +
  " { const __e=globalThis.__EXP; if(__e){ const v=__e.curve[rl]; if(v) bonus += (__e.mode==='flat'? v : sum*v); } }";
const patched = src.replace(NEEDLE, INJECT);

// 2) 패치 모듈을 실제 run-sim 경로로 컴파일 → require.cache 주입
const m = new Module(RS, null);
m.filename = RS;
m.paths = Module._nodeModulePaths(path.dirname(RS));
m._compile(patched, RS);
require.cache[RS] = m;

// 3) funqa 파이프라인 require (위 캐시 히트 → 패치본 사용)
const { PERSONAS } = require(path.resolve(ROOT, 'tools/funqa/personas.cjs'));
const { runFullInstrumented } = require(path.resolve(ROOT, 'tools/funqa/runner.cjs'));
const { funScore } = require(path.resolve(ROOT, 'tools/funqa/metrics.cjs'));
const R = m.exports;

const THRESH = 6.0, PASS = 0.7;

// 순수 그리디 픽(난이도 가드용) — 매 턴 최대 후보점수. balance 상점정책.
const greedyPick = (hand, row, boss, ctx) => {
  let bi = 0, bs = -Infinity;
  for (let i = 0; i < hand.length; i++) {
    const s = R.gain(row.slice(), hand[i], boss, ctx.owned, ctx.deckSize);
    if (s > bs) { bs = s; bi = i; }
  }
  return bi;
};

function measure(exp) {
  globalThis.__EXP = exp; // null=OFF
  const per = [];
  for (const p of PERSONAS) {
    const runs = []; let win = 0;
    for (let i = 0; i < N; i++) { const r = runFullInstrumented(p.pick, p.strat, i + 1); runs.push(r); if (r.result === 'win') win++; }
    const f = funScore(runs, p.weight);
    per.push({ id: p.id, name: p.name, fun: f.score, axes: f.axes, clear: win / N });
  }
  // 난이도 가드: 그리디 balance, stake0(runFullInstrumented 고정)
  let gwin = 0, anteSum = 0;
  for (let i = 0; i < N; i++) { const r = runFullInstrumented(greedyPick, 'balance', i + 1); if (r.result === 'win') gwin++; anteSum += r.reachedAnte; }
  const happy = per.filter(x => x.fun >= THRESH).length;
  globalThis.__EXP = null;
  return { per, panel: happy / PERSONAS.length, panelPass: happy / PERSONAS.length >= PASS,
           greedyClear: gwin / N, greedyAvgAnte: anteSum / N };
}

// 스윕 대상
const CURVES = [
  { key: 'OFF(control)',  exp: null },
  { key: 'U:15/30/50',    exp: { mode: 'scaled', curve: { 6: 0.15, 7: 0.30, 8: 0.50 } } },
  { key: 'gentle:10/20/35', exp: { mode: 'scaled', curve: { 6: 0.10, 7: 0.20, 8: 0.35 } } },
  { key: 'steep:20/45/75', exp: { mode: 'scaled', curve: { 6: 0.20, 7: 0.45, 8: 0.75 } } },
  { key: 'only8:60',      exp: { mode: 'scaled', curve: { 8: 0.60 } } },
  { key: 'early5:8/16/28/45', exp: { mode: 'scaled', curve: { 5: 0.08, 6: 0.16, 7: 0.28, 8: 0.45 } } },
  { key: 'flat:8/18/32',  exp: { mode: 'flat', curve: { 6: 8, 7: 18, 8: 32 } } },
  { key: 'flatBig:12/26/44', exp: { mode: 'flat', curve: { 6: 12, 7: 26, 8: 44 } } },
];

const out = [];
const pct = x => (x * 100).toFixed(1) + '%';
console.log(`P2 그레이박스 스윕 — N=${N}/페르소나, 시드고정. THRESH=${THRESH} PASS=${PASS}\n`);
for (const c of CURVES) {
  const r = measure(c.exp);
  out.push({ key: c.key, ...r });
  const combo = r.per.find(x => x.id === 'combo');
  const mast = r.per.find(x => x.id === 'masterly');
  const cas = r.per.find(x => x.id === 'casual');
  const thr = r.per.find(x => x.id === 'thriller');
  console.log(`── ${c.key}`);
  console.log(`   대중재미 ${pct(r.panel)} ${r.panelPass ? '✅' : '🔴'} | 콤보 clear ${pct(combo.clear)} fun ${combo.fun} 흐름 ${combo.axes.flow.toFixed(2)} | 마스터리 clear ${pct(mast.clear)} fun ${mast.fun} | 스릴 fun ${thr.fun} | 캐주얼 fun ${cas.fun} clear ${pct(cas.clear)}`);
  console.log(`   [가드] 그리디 clear ${pct(r.greedyClear)} avgAnte ${r.greedyAvgAnte.toFixed(2)}`);
}
console.log('\n===JSON===');
console.log(JSON.stringify(out.map(o => ({
  key: o.key, panel: o.panel, panelPass: o.panelPass, greedyClear: o.greedyClear, greedyAvgAnte: o.greedyAvgAnte,
  per: o.per.map(p => ({ name: p.name, fun: p.fun, clear: p.clear, flow: +p.axes.flow.toFixed(3), dopamine: +p.axes.dopamine.toFixed(3), tension: +p.axes.tension.toFixed(3) }))
})), null, 0));
