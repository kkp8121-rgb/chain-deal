// tools/funqa/run-funqa.cjs — 실행: node tools/funqa/run-funqa.cjs [N]
// 5종 페르소나 × N판 → 재미 5축 → 대중 재미 판정.
const { PERSONAS } = require('./personas.cjs');
const { runFullInstrumented } = require('./runner.cjs');
const { funScore } = require('./metrics.cjs');
const { printReport } = require('./report.cjs');

const N = parseInt(process.argv[2]||"2000", 10);
console.log(`Fun QA: 페르소나 ${PERSONAS.length}종 × ${N}판 (시드 고정)...`);

const results = [];
for(const p of PERSONAS){
  const runs=[]; let reached=0;
  for(let i=0;i<N;i++){ const r=runFullInstrumented(p.pick, p.strat, i+1); runs.push(r); if(r.result==="win") reached++; }
  const f=funScore(runs, p.weight);
  results.push({ persona:p.name, axes:f.axes, score:f.score, reachRate:reached/N });
}
printReport(results);
