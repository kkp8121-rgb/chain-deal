// ⚠️ FROZEN(2026-07-01, pre-spark): run-sim에 v3.29 불씨덱이 baked in됨 → 재실행 시 double-spark(가드 없음). 기록된 판정은 measurement-summary-2026-07-01.md 참조. 히스토리 보존용, 재실행 금지.
// 강건성 재검 — 두 결정적 주장(option1 반증 / relief 0.85 sweet spot)을 다른 시드뱅크로 확인.
// 두 주입(__EXP 점수보너스 + __RELIEF 초반목표) 동시 지원. SEED_OFFSET로 시드뱅크 이동.
const fs = require('fs'), path = require('path'), Module = require('module');
const ROOT = 'C:/Projects/CHAINDEAL';
const RS = path.resolve(ROOT, 'tools/run-sim.cjs');
const N = parseInt(process.env.N || '2000', 10);
const OFF = parseInt(process.env.SEED_OFFSET || '0', 10);
let src = fs.readFileSync(RS, 'utf8');
src = src.replace('let bonus=sum*mult;', "let bonus=sum*mult; { const __e=globalThis.__EXP; if(__e){ const v=__e.curve[rl]; if(v) bonus += (__e.mode==='flat'? v : sum*v); } }");
src = src.replace('const blindTarget=(a,b)=>Math.round(blindBase(a)*stakeMult(a)*DMULT*(b===0?1:b===1?1.4:1.6));',
  'const blindTarget=(a,b)=>{ const __r=(globalThis.__RELIEF&&globalThis.__RELIEF[a])||1; return Math.round(blindBase(a)*stakeMult(a)*DMULT*(b===0?1:b===1?1.4:1.6)*__r); };');
const m = new Module(RS, null); m.filename = RS; m.paths = Module._nodeModulePaths(path.dirname(RS)); m._compile(src, RS); require.cache[RS] = m;
const R = m.exports;
const { PERSONAS } = require(path.resolve(ROOT, 'tools/funqa/personas.cjs'));
const { runFullInstrumented } = require(path.resolve(ROOT, 'tools/funqa/runner.cjs'));
const { funScore } = require(path.resolve(ROOT, 'tools/funqa/metrics.cjs'));
const greedyPick = (h, row, b, ctx) => { let bi = 0, bs = -Infinity; for (let i = 0; i < h.length; i++) { const s = R.gain(row.slice(), h[i], b, ctx.owned, ctx.deckSize); if (s > bs) { bs = s; bi = i; } } return bi; };
const T = 6.0;
function measure(exp, relief) {
  globalThis.__EXP = exp; globalThis.__RELIEF = relief;
  const per = [];
  for (const p of PERSONAS) { const runs = []; let w = 0; for (let i = 0; i < N; i++) { const r = runFullInstrumented(p.pick, p.strat, OFF + i + 1); runs.push(r); if (r.result === 'win') w++; } per.push({ id: p.id, fun: funScore(runs, p.weight).score, clear: w / N }); }
  let gw = 0; for (let i = 0; i < N; i++) if (runFullInstrumented(greedyPick, 'balance', OFF + i + 1).result === 'win') gw++;
  globalThis.__EXP = null; globalThis.__RELIEF = null;
  return { per, panel: per.filter(x => x.fun >= T).length / PERSONAS.length, greedy: gw / N };
}
const CFG = [
  { k: 'OFF(control)', e: null, r: null },
  { k: 'U:15/30/50(opt1)', e: { mode: 'scaled', curve: { 6: .15, 7: .30, 8: .50 } }, r: null },
  { k: 'relief a1-2 x0.90', e: null, r: { 1: .90, 2: .90 } },
  { k: 'relief a1-2 x0.85', e: null, r: { 1: .85, 2: .85 } },
  { k: 'relief a1-2 x0.82', e: null, r: { 1: .82, 2: .82 } },
  { k: 'relief a1-2 x0.80', e: null, r: { 1: .80, 2: .80 } },
];
const pct = x => (x * 100).toFixed(1) + '%';
console.log(`강건성 재검 — N=${N} SEED_OFFSET=${OFF} (시드 ${OFF + 1}..${OFF + N})\n`);
for (const c of CFG) {
  const r = measure(c.e, c.r); const g = id => r.per.find(x => x.id === id);
  console.log(`${c.k.padEnd(20)} 대중재미 ${pct(r.panel)} ${r.panel >= 0.7 ? '✅' : '🔴'} | 캐주얼 fun ${g('casual').fun} | 콤보 clear ${pct(g('combo').clear)} fun ${g('combo').fun} | 스릴 fun ${g('thriller').fun} | 마스터 clear ${pct(g('masterly').clear)} | 그리디 ${pct(r.greedy)}`);
}
