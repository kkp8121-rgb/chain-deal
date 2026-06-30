// tools/funqa/regress.cjs — 재미 회귀 비교 (보완 전후 델타).
//   기준선 저장: node tools/funqa/regress.cjs --save [N]   → funqa-baseline.json
//   비교:        node tools/funqa/regress.cjs [N]           → baseline 대비 페르소나별 재미 Δ + 하락 게이트(exit 1)
// 워크플로: 게임 변경 전 --save → 보완 후 비교 → "이 변경이 재미를 올렸나/내렸나".
const fs = require('fs');
const path = require('path');
const { PERSONAS } = require('./personas.cjs');
const { runFullInstrumented } = require('./runner.cjs');
const { funScore } = require('./metrics.cjs');
const BASE = path.join(__dirname, 'funqa-baseline.json');

function measure(N){
  const res = {};
  for(const p of PERSONAS){
    const runs=[]; let win=0;
    for(let i=0;i<N;i++){ const r=runFullInstrumented(p.pick,p.strat,i+1); runs.push(r); if(r.result==="win") win++; }
    const f=funScore(runs,p.weight);
    res[p.id]={ name:p.name, score:f.score, clear:win/N };
  }
  return res;
}

const save = process.argv.includes('--save');
const N = parseInt(process.argv.find(a=>/^\d+$/.test(a)) || "500", 10);
const cur = measure(N);

if(save){
  fs.writeFileSync(BASE, JSON.stringify({ N, res:cur }, null, 2));
  console.log(`baseline 저장: ${BASE} (N=${N})`);
  process.exit(0);
}
if(!fs.existsSync(BASE)){ console.log("baseline 없음 — 먼저 `node tools/funqa/regress.cjs --save` 로 기준선 저장."); process.exit(1); }
const base = JSON.parse(fs.readFileSync(BASE,'utf8')).res;

console.log(`\n=== Fun QA 회귀 (baseline 대비, N=${N}) ===`);
console.log("  페르소나   재미 Δ              클리어% Δ");
let regressed=0;
for(const p of PERSONAS){
  const b=base[p.id], c=cur[p.id]; if(!b) continue;
  const ds=c.score-b.score, dc=(c.clear-b.clear)*100;
  const mark = ds<=-0.3 ? "🔴 하락" : ds>=0.3 ? "🟢 개선" : "⚪";
  if(ds<=-0.3) regressed++;
  console.log(`  ${p.name.padEnd(8)} ${(ds>=0?"+":"")}${ds.toFixed(2)} (${b.score}→${c.score})   ${(dc>=0?"+":"")}${dc.toFixed(1)}pp  ${mark}`);
}
console.log(`\n  ${regressed ? `🔴 ${regressed}종 페르소나 재미 하락(Δ≤-0.3) — 보완이 재미를 깎았는지 검토` : "🟢 재미 회귀 없음"}`);
process.exit(regressed ? 1 : 0);
