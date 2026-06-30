// tools/funqa/judge-pack.cjs — 재미 판정 팩 생성. 실행: node tools/funqa/judge-pack.cjs [N] > funqa-judge-pack.md
// Phase 1 정량 + 페르소나별 대표 궤적(승리/패배/near-miss) 내러티브 → Claude Code 세션이 정성 판정.
const { PERSONAS } = require('./personas.cjs');
const { runFullInstrumented } = require('./runner.cjs');
const { funScore } = require('./metrics.cjs');
const { BOSS_KO } = require('../run-sim.cjs');

const BL = ["작은","큰","보스"];
const HAND_KO = {highCard:"하이카드",pair:"페어",twoPair:"투페어",trips:"트리플",straight:"스트레이트",flush:"플러시",fullHouse:"풀하우스",fourKind:"포카드",straightFlush:"스트플",fiveKind:"파이브카드"};
const LENS = {
  masterly:"깊은 수읽기·최적화를 중시. 매 턴 선택이 결과를 가르길 원하고, 뭘 해도 비슷한 얕은 국면에 지루함을 느낀다.",
  safe:"안정적 진행·예측가능성을 중시. 계획대로 풀리길 원하고, 운빨 억까·손쓸 수 없는 죽음에 이탈한다.",
  combo:"큰 체인 폭발·도파민을 중시. 빌드가 터지는 순간을 원하고, 밋밋해서 폭발이 없는 판에 이탈한다.",
  thriller:"아슬아슬한 마진·역전 스릴을 중시. 빠듯하게 넘기는 손맛을 원하고, 너무 쉬워 긴장이 없으면 지루하다.",
  casual:"직관적 손맛을 중시. 바로 이해되는 재미를 원하고, 복잡한 수읽기를 강요당하면 이탈한다.",
};

function roundLine(rd){
  const where = rd.bossId ? `보스(${BOSS_KO[rd.bossId]||rd.bossId})` : BL[rd.blind];
  if(rd.passed){
    const tag = (rd.margin>=1.0&&rd.margin<=1.15) ? "  ← 아슬아슬" : (rd.margin>=1.5?"  (낙승)":"");
    return `안테${rd.ante} ${where}: 클리어 (마진 ${rd.margin.toFixed(2)}, 최대체인 ${rd.maxRunLen}, ${HAND_KO[rd.handKind]||rd.handKind})${tag}`;
  }
  return `안테${rd.ante} ${where}: 실패 (점수 ${rd.finalScore}/목표 ${rd.target}, 최대체인 ${rd.maxRunLen})`;
}
function narrative(run){ return run.rounds.map(roundLine).join("\n"); }

function median(arr){ const s=arr.slice().sort((a,b)=>a-b); return s.length?s[Math.floor(s.length/2)]:0; }
function lastMargin(r){ return r.rounds[r.rounds.length-1].margin; }
function nmCount(r){ return r.rounds.filter(rd=>rd.passed&&rd.margin>=1.0&&rd.margin<=1.15).length; }

function pickSamples(runs){
  const wins=runs.filter(r=>r.result==="win");
  let winRun, winLabel;
  if(wins.length){
    const med=median(wins.map(lastMargin));
    winRun=wins.reduce((b,r)=>Math.abs(lastMargin(r)-med)<Math.abs(lastMargin(b)-med)?r:b);
    winLabel="전형적 승리 (안테8 클리어, 마진 중앙값 판)";
  } else {
    winRun=runs.reduce((b,r)=>r.reachedAnte>b.reachedAnte?r:b);
    winLabel=`최고 도달 (안테${winRun.reachedAnte}까지 — 이 페르소나 클리어 0%)`;
  }
  const deaths=runs.filter(r=>r.result==="death");
  let loseRun=null, loseLabel="";
  if(deaths.length){
    // 조건부 죽음률(도달자 중 사망%) 최고 안테 = 진짜 벽. 최빈 deathAnte는 생존자 편향(모두 안테1 거침)이라 오도.
    const reach={}, die={};
    for(const r of runs){ for(let a=1;a<=r.reachedAnte;a++) reach[a]=(reach[a]||0)+1; if(r.result==="death") die[r.deathAnte]=(die[r.deathAnte]||0)+1; }
    let wallAnte=deaths[0].deathAnte, wallRate=-1;
    for(let a=1;a<=8;a++){ const rc=reach[a]||0; if(rc<10) continue; const rate=(die[a]||0)/rc; if(rate>wallRate){ wallRate=rate; wallAnte=a; } }
    loseRun=deaths.find(r=>r.deathAnte===wallAnte) || deaths[0];
    loseLabel=`전형적 패배 (최대 벽 = 안테${wallAnte}, 도달자 중 ${(wallRate*100).toFixed(0)}% 사망)`;
  }
  const nmRun=runs.reduce((b,r)=>nmCount(r)>nmCount(b)?r:b);
  return { winRun, winLabel, loseRun, loseLabel, nmRun, nmLabel:`아슬아슬 (near-miss 라운드 ${nmCount(nmRun)}회 판)` };
}

function personaSection(p, runs){
  const f=funScore(runs, p.weight), a=f.axes, s=pickSamples(runs);
  let md=`\n## 페르소나: ${p.name}\n`;
  md+=`- **재미 5축**: 주체성 ${a.agency.toFixed(2)} / 긴장 ${a.tension.toFixed(2)} / 도파민 ${a.dopamine.toFixed(2)} / 다양성 ${a.variety.toFixed(2)} / 흐름 ${a.flow.toFixed(2)}  →  정량 재미 ${f.score}\n`;
  md+=`- **판정 렌즈**: ${LENS[p.id]}\n`;
  md+=`\n### ${s.winLabel}\n\`\`\`\n${narrative(s.winRun)}\n\`\`\`\n`;
  if(s.loseRun) md+=`\n### ${s.loseLabel}\n\`\`\`\n${narrative(s.loseRun)}\n\`\`\`\n`;
  md+=`\n### ${s.nmLabel}\n\`\`\`\n${narrative(s.nmRun)}\n\`\`\`\n`;
  return { md, score:f.score };
}

const N=parseInt(process.argv[2]||"2000",10);
let out=`# Fun QA 판정 팩 (Phase 2)\n\n페르소나 ${PERSONAS.length}종 × ${N}판 (시드 고정). 아래 정량 메트릭과 대표 궤적을 읽고, **각 페르소나 취향 렌즈로 "이 유저가 재밌을까"를 0~10으로 정성 판정**하라. ⚠️ 정량 점수에 휘둘리지 말 것 — 5축이 비슷해도 궤적이 실제로 같은 경험인지 독립 판단.\n`;
out+=`\n## Phase 1 정량 요약\n| 페르소나 | 정량 재미 | 클리어% |\n|---|---|---|\n`;
const sections=[];
for(const p of PERSONAS){
  const runs=[]; let win=0;
  for(let i=0;i<N;i++){ const r=runFullInstrumented(p.pick,p.strat,i+1); runs.push(r); if(r.result==="win") win++; }
  const sec=personaSection(p,runs);
  sections.push(sec.md);
  out+=`| ${p.name} | ${sec.score} | ${(win/N*100).toFixed(1)}% |\n`;
}
out+=sections.join("");
out+=`\n---\n## 판정 요청 (Claude Code가 채움)\n각 페르소나: **재미 0~10 + 한 줄 이유 + 의심지점(Phase 3에서 직접 재생해볼 것)**.\n종합: **대중재미 정성판정**(패널 70%+) + Phase 1 정량(60% FAIL)과 일치/괴리. 특히 마스터리·안전·스릴 5축 수렴이 "실질적으로 같은 플레이"인지 궤적으로 판단.\n`;
console.log(out);
