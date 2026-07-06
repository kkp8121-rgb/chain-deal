// ⚠️ FROZEN(2026-07-01, pre-spark): run-sim에 v3.29 불씨덱이 baked in됨 → 재실행 시 double-spark(가드 없음). 기록된 판정은 measurement-summary-2026-07-01.md 참조. 히스토리 보존용, 재실행 금지.
// 재미 5축 성분 분해 — 페르소나별 fun<6의 원인 축 격리 + 드라이버 분포.
// 스릴러=tension, 캐주얼=dopamine 의심 → margin/spike 분포로 확증. baseline 점수(무주입).
const path = require('path');
const ROOT = 'C:/Projects/CHAINDEAL';
const { PERSONAS } = require(path.resolve(ROOT, 'tools/funqa/personas.cjs'));
const { runFullInstrumented } = require(path.resolve(ROOT, 'tools/funqa/runner.cjs'));
const { funScore } = require(path.resolve(ROOT, 'tools/funqa/metrics.cjs'));
const N = parseInt(process.env.N || '2000', 10);
const OFF = parseInt(process.env.SEED_OFFSET || '0', 10);
const RARE = new Set(['flush', 'fullHouse', 'fourKind', 'straightFlush', 'fiveKind']);

for (const p of PERSONAS) {
  const runs = [];
  for (let i = 0; i < N; i++) runs.push(runFullInstrumented(p.pick, p.strat, OFF + i + 1));
  const f = funScore(runs, p.weight);
  const w = p.weight, ax = f.axes;
  // 가중 기여 = axis*weight (fun = Σ×10). 가장 낮은 항 = 드래그.
  const contrib = Object.keys(w).map(k => ({ k, c: ax[k] * w[k], ax: ax[k], w: w[k] })).sort((a, b) => a.c - b.c);
  // margin 분포(긴장 드라이버): near[1.0,1.15] / mid(.5,1.5) / blow>=1.5 / death<.5
  let near = 0, mid = 0, blow = 0, dead = 0, rounds = 0;
  // spike 분포(도파민 드라이버): 라운드당 스파이크 수, rare-hand 비율, 0-spike 라운드 비율
  let spikeSum = 0, rareR = 0, zeroSpike = 0;
  const dieAnte = {};
  for (const r of runs) {
    for (const rd of r.rounds) {
      rounds++;
      const m = rd.margin;
      if (m >= 1.0 && m <= 1.15) near++; else if (m >= 1.5) blow++; else if (m < 0.5) dead++; else mid++;
      let sp = 0; for (const t of rd.turns) if (t.runLen >= 4) sp++;
      if (RARE.has(rd.handKind)) sp++;
      spikeSum += sp; if (RARE.has(rd.handKind)) rareR++; if (sp === 0) zeroSpike++;
    }
    if (r.result === 'death') dieAnte[r.deathAnte] = (dieAnte[r.deathAnte] || 0) + 1;
  }
  const pc = x => (x / rounds * 100).toFixed(1) + '%';
  console.log(`\n■ ${p.name}  fun ${f.score}  (w: ${Object.entries(w).map(([k, v]) => k[0] + v).join(' ')})`);
  console.log(`  드래그 순위(가중기여 낮은순): ` + contrib.map(x => `${x.k}=${x.c.toFixed(3)}(ax${x.ax.toFixed(2)}×w${x.w})`).join('  '));
  console.log(`  최대 드래그축: 【${contrib[0].k}】 (ax ${contrib[0].ax.toFixed(2)}, 이 페르소나 최중요축 여부: w=${contrib[0].w})`);
  console.log(`  margin분포: near[1.0-1.15] ${pc(near)} | mid ${pc(mid)} | blowout≥1.5 ${pc(blow)} | death<0.5 ${pc(dead)}`);
  console.log(`  spike: 라운드당평균 ${(spikeSum / rounds).toFixed(2)} | rare족보라운드 ${pc(rareR)} | 0-spike라운드 ${pc(zeroSpike)}`);
  console.log(`  사망안테분포: ` + Object.keys(dieAnte).sort((a, b) => a - b).map(k => `a${k}:${(dieAnte[k] / N * 100).toFixed(0)}%`).join(' '));
}
