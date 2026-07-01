// tools/funqa/verify-3bank.cjs — 재QA 3뱅크 강건성 검증 (measurement-summary 프로토콜).
// 편집된 run-sim(불씨덱 baked)을 그대로 사용. 주입 없음 — runner/metrics/personas verbatim.
// 판정: 대중재미 3뱅크 전부 ≥70% & 캐주얼 fun 최저뱅크 ≥6 & 회귀(마스터/안전/콤보 하락 참고).
// 사용: node tools/funqa/verify-3bank.cjs [N]   (기본 2000, 뱅크 50000/70000/90000)
const { PERSONAS } = require('./personas.cjs');
const { runFullInstrumented } = require('./runner.cjs');
const { funScore } = require('./metrics.cjs');

const N = parseInt(process.argv[2] || '2000', 10);
const BANKS = [50000, 70000, 90000];
const T = 6.0;
const pct = x => (x * 100).toFixed(0) + '%';

const funByBank = {};   // persona.id -> [b50,b70,b90]
PERSONAS.forEach(p => funByBank[p.id] = []);
const panelByBank = [];

console.log(`재QA 3뱅크 강건성 — N=${N}, 뱅크 ${BANKS.join('/')}\n`);
console.log('bank    | ' + PERSONAS.map(p => p.name.padStart(7)).join(' ') + ' | 대중재미');
for (const off of BANKS) {
  const row = [];
  for (const p of PERSONAS) {
    const runs = [];
    for (let i = 0; i < N; i++) runs.push(runFullInstrumented(p.pick, p.strat, off + i + 1));
    const fun = funScore(runs, p.weight).score;
    funByBank[p.id].push(fun); row.push({ id: p.id, fun });
  }
  const panel = row.filter(x => x.fun >= T).length / PERSONAS.length;
  panelByBank.push(panel);
  console.log(('b' + off).padEnd(8) + '| ' + row.map(x => x.fun.toFixed(2).padStart(7)).join(' ') + ` | ${pct(panel)} ${panel >= 0.7 ? '✅' : '🔴'}`);
}

console.log('\n=== 판정 (최저뱅크 기준) ===');
const casMin = Math.min(...funByBank['casual']);
const panelMin = Math.min(...panelByBank);
console.log(`  캐주얼 fun 최저뱅크: ${casMin.toFixed(2)}  ${casMin >= 6 ? '✅ ≥6' : '🔴 <6'}`);
console.log(`  대중재미 최저뱅크:   ${pct(panelMin)}  ${panelMin >= 0.7 ? '✅ ≥70%' : '🔴 <70%'}`);
for (const id of ['masterly', 'safe', 'combo', 'thriller']) {
  const arr = funByBank[id]; const mn = Math.min(...arr), mx = Math.max(...arr);
  const nm = PERSONAS.find(p => p.id === id).name;
  console.log(`  ${nm} fun: ${mn.toFixed(2)}~${mx.toFixed(2)} ${mn >= 6 ? '' : '(임계미달)'}`);
}
const pass = casMin >= 6 && panelMin >= 0.7;
console.log(`\n  ${pass ? '🟢 재QA PASS' : '🔴 재QA FAIL'}`);
