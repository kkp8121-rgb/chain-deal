// ⚠️ FROZEN(2026-07-01, pre-spark): run-sim에 v3.29 불씨덱이 baked in됨 → 재실행 시 double-spark(가드 없음). 기록된 판정은 measurement-summary-2026-07-01.md 참조. 히스토리 보존용, 재실행 금지.
// 난이도 스칼라 × 페르소나 fun — 이중 제약(스릴러=더어렵게 / 캐주얼=더쉽게) 확증.
// blindTarget 전 안테 ×scalar 주입. scalar<1=쉬움, >1=어려움. baseline 점수.
const fs = require('fs'), path = require('path'), Module = require('module');
const ROOT = 'C:/Projects/CHAINDEAL';
const RS = path.resolve(ROOT, 'tools/run-sim.cjs');
const N = parseInt(process.env.N || '2000', 10);
const OFF = parseInt(process.env.SEED_OFFSET || '0', 10);
let src = fs.readFileSync(RS, 'utf8');
src = src.replace('const blindTarget=(a,b)=>Math.round(blindBase(a)*stakeMult(a)*DMULT*(b===0?1:b===1?1.4:1.6));',
  'const blindTarget=(a,b)=>{ const __s=globalThis.__SCALAR||1; return Math.round(blindBase(a)*stakeMult(a)*DMULT*(b===0?1:b===1?1.4:1.6)*__s); };');
const m = new Module(RS, null); m.filename = RS; m.paths = Module._nodeModulePaths(path.dirname(RS)); m._compile(src, RS); require.cache[RS] = m;
const { PERSONAS } = require(path.resolve(ROOT, 'tools/funqa/personas.cjs'));
const { runFullInstrumented } = require(path.resolve(ROOT, 'tools/funqa/runner.cjs'));
const { funScore } = require(path.resolve(ROOT, 'tools/funqa/metrics.cjs'));
const T = 6.0;
function measure(scalar) {
  globalThis.__SCALAR = scalar;
  const per = [];
  for (const p of PERSONAS) {
    const runs = []; let w = 0; let near = 0, blow = 0, rounds = 0;
    for (let i = 0; i < N; i++) { const r = runFullInstrumented(p.pick, p.strat, OFF + i + 1); runs.push(r); if (r.result === 'win') w++; for (const rd of r.rounds) { rounds++; if (rd.margin >= 1.0 && rd.margin <= 1.15) near++; else if (rd.margin >= 1.5) blow++; } }
    const f = funScore(runs, p.weight);
    per.push({ id: p.id, name: p.name, fun: f.score, tension: +f.axes.tension.toFixed(2), clear: w / N, near: near / rounds, blow: blow / rounds });
  }
  globalThis.__SCALAR = 1;
  return { per, panel: per.filter(x => x.fun >= T).length / PERSONAS.length };
}
const SC = [0.85, 0.90, 1.0, 1.10, 1.20, 1.30];
const pct = x => (x * 100).toFixed(0) + '%';
console.log(`난이도 스칼라 × fun — N=${N} (scalar<1 쉬움 / >1 어려움)\n`);
console.log('scalar  대중재미 | 스릴 fun/tens/blow | 캐주 fun/clear | 마스 fun/clear | 콤보 fun | 안전 fun');
for (const s of SC) {
  const r = measure(s); const g = id => r.per.find(x => x.id === id);
  const T_ = g('thriller'), C = g('casual'), M = g('masterly'), K = g('combo'), S = g('safe');
  console.log(`${s.toFixed(2)}    ${pct(r.panel).padStart(4)} ${r.panel >= 0.7 ? '✅' : '🔴'} | ${T_.fun}/${T_.tension}/blow${pct(T_.blow)} | ${C.fun}/${pct(C.clear)} | ${M.fun}/${pct(M.clear)} | ${K.fun} | ${S.fun}`);
}
