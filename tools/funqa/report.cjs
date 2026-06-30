// tools/funqa/report.cjs — 페르소나별 5축 + 대중 재미 판정.
// results = [{ persona, axes, score, reachRate }]. 대중재미 = score>=THRESH 페르소나 비율.
const THRESH=6.0, PASS_RATIO=0.7;
function printReport(results){
  console.log("\n=== Fun QA 리포트 (정량 코어) ===");
  console.log("  페르소나   재미   주체성 긴장  도파민 다양성 흐름   클리어%");
  for(const r of results){
    const a=r.axes;
    console.log(`  ${r.persona.padEnd(8)} ${String(r.score).padStart(4)}   ${a.agency.toFixed(2)}  ${a.tension.toFixed(2)}  ${a.dopamine.toFixed(2)}  ${a.variety.toFixed(2)}  ${a.flow.toFixed(2)}   ${(r.reachRate*100).toFixed(1)}%`);
  }
  const happy=results.filter(r=>r.score>=THRESH).length;
  const ratio=happy/results.length;
  console.log(`\n  대중 재미: ${happy}/${results.length} 페르소나가 임계(${THRESH}) 이상 → ${(ratio*100).toFixed(0)}%`);
  const verdict = ratio>=PASS_RATIO ? "🟢 PASS (대다수 재밌어함)" : "🔴 FAIL (소수 취향)";
  console.log(`  판정: ${verdict}  (기준 ${PASS_RATIO*100}%)`);
  // 편향 경고: 최고-최저 격차 큰 경우
  const scores=results.map(r=>r.score), spread=Math.max(...scores)-Math.min(...scores);
  if(spread>=4){ const hi=results.reduce((a,b)=>a.score>b.score?a:b), lo=results.reduce((a,b)=>a.score<b.score?a:b);
    console.log(`  ⚠ 편향 경고: ${hi.persona}(${hi.score}) ≫ ${lo.persona}(${lo.score}) — 취향 편중`); }
  return { ratio, pass: ratio>=PASS_RATIO };
}
module.exports = { printReport, THRESH, PASS_RATIO };
