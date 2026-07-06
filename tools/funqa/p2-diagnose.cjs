// ⚠️ FROZEN(2026-07-01, pre-spark): run-sim에 v3.29 불씨덱이 baked in됨 → 재실행 시 double-spark(가드 없음). 기록된 판정은 measurement-summary-2026-07-01.md 참조. 히스토리 보존용, 재실행 금지.
// P2 진단 #2 — 콤보러 0% clear의 진짜 원인. 보너스 OFF(baseline 점수)로 순수 진단.
// (a) 콤보러 죽는판 vs 통과판 maxRunLen 분포 → "짧은 체인에서 죽는가?"
// (b) pick/strat 분리: combo-pick × {cartel,balance,apex} clear% → 원인이 pick인가 shop인가?
const fs = require('fs'), path = require('path'), Module = require('module');
const ROOT = 'C:/Projects/CHAINDEAL';
const RS = path.resolve(ROOT, 'tools/run-sim.cjs');
const N = parseInt(process.env.N || '2000', 10);
// baseline(주입 no-op) 로드 — 하네스 일관성 위해 동일 스캐폴드
let src = fs.readFileSync(RS, 'utf8');
const m = new Module(RS, null); m.filename = RS; m.paths = Module._nodeModulePaths(path.dirname(RS)); m._compile(src, RS); require.cache[RS] = m;
const { PERSONAS } = require(path.resolve(ROOT, 'tools/funqa/personas.cjs'));
const { runFullInstrumented } = require(path.resolve(ROOT, 'tools/funqa/runner.cjs'));
const combo = PERSONAS.find(p => p.id === 'combo');

// (a) 죽는판 vs 통과판 maxRunLen 분포 (콤보러, cartel)
const dead = {}, pass = {}; let deaths = 0, deathShort = 0;
for (let i = 0; i < N; i++) {
  const r = runFullInstrumented(combo.pick, combo.strat, i + 1);
  const last = r.rounds[r.rounds.length - 1];
  if (r.result === 'death') {
    deaths++;
    const ml = last.maxRunLen; dead[ml] = (dead[ml] || 0) + 1;
    if (ml <= 5) deathShort++;
    // 통과한 앞 라운드들
    for (let k = 0; k < r.rounds.length - 1; k++) { const ml2 = r.rounds[k].maxRunLen; pass[ml2] = (pass[ml2] || 0) + 1; }
  } else {
    for (const rd of r.rounds) { const ml2 = rd.maxRunLen; pass[ml2] = (pass[ml2] || 0) + 1; }
  }
}
const fmt = h => Object.keys(h).sort((a, b) => a - b).map(k => `${k}:${h[k]}`).join(' ');
console.log('=== (a) 콤보러 maxRunLen 분포 (baseline 점수) ===');
console.log('  죽는 판  :', fmt(dead));
console.log('  통과 판  :', fmt(pass));
console.log(`  죽는 판 중 maxChain<=5 비율: ${(deathShort / deaths * 100).toFixed(1)}% (${deathShort}/${deaths})`);

// (b) pick/strat 분리 — combo pick × 각 strat, + greedy pick × cartel(대조)
const greedyPick = (hand, row, boss, ctx) => { let bi = 0, bs = -Infinity; const R = m.exports; for (let i = 0; i < hand.length; i++) { const s = R.gain(row.slice(), hand[i], boss, ctx.owned, ctx.deckSize); if (s > bs) { bs = s; bi = i; } } return bi; };
function clearOf(pick, strat) { let w = 0, at = 0; for (let i = 0; i < N; i++) { const r = runFullInstrumented(pick, strat, i + 1); if (r.result === 'win') w++; at += r.reachedAnte; } return { clear: w / N, avgAnte: at / N }; }
console.log('\n=== (b) pick/strat 분리 (clear% / avgAnte, baseline 점수) ===');
for (const st of ['cartel', 'balance', 'apex']) { const r = clearOf(combo.pick, st); console.log(`  combo-pick × ${st.padEnd(8)}: clear ${(r.clear * 100).toFixed(1)}%  avgAnte ${r.avgAnte.toFixed(2)}`); }
const g = clearOf(greedyPick, 'cartel'); console.log(`  greedy-pick × cartel  : clear ${(g.clear * 100).toFixed(1)}%  avgAnte ${g.avgAnte.toFixed(2)}  (대조: shop만 다름)`);
const gb = clearOf(greedyPick, 'balance'); console.log(`  greedy-pick × balance : clear ${(gb.clear * 100).toFixed(1)}%  avgAnte ${gb.avgAnte.toFixed(2)}  (대조: 최적)`);
