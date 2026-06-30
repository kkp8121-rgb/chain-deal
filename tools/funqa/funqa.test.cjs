// tools/funqa/funqa.test.cjs — 실행: node tools/funqa/funqa.test.cjs
let fail=0; const ok=(n,c)=>{ console.log((c?"✅":"❌")+" "+n); if(!c) fail++; };
const R = require('../run-sim.cjs');
const { PERSONAS } = require('./personas.cjs');
const { playRoundInstrumented, mulberry32 } = require('./runner.cjs');

// --- 모듈화 보존: run-sim require가 콘솔 실행을 트리거하지 않고 함수 노출 ---
ok("run-sim exports gain/setRNG/BOSSES", typeof R.gain==="function" && typeof R.setRNG==="function" && R.BOSSES.length===12);

// --- 드리프트 가드: funqa가 쓰는 규칙이 run-sim 현재 값과 일치 ---
ok("HAND_BONUS flush=.30 (드리프트 가드)", Math.round(R.handBonus(
  [{suit:1,rank:1,enh:null},{suit:1,rank:2,enh:null},{suit:1,rank:3,enh:null},{suit:1,rank:9,enh:null},{suit:1,rank:10,enh:null},{suit:0,rank:2,enh:null},{suit:0,rank:4,enh:null},{suit:0,rank:6,enh:null}],
  1, [], null)) === Math.round(R.blindBase(1)*0.30));
ok("stingy tmult=.58 (드리프트 가드)", R.BOSSES.find(b=>b.id==="stingy").tmult===0.58);

// --- 골든 테스트: stingy(손패2)가 일반(손패3)보다 주체성 낮음 ---
// 동일 덱·시드에서 손패만 2 vs 3으로 같은 라운드를 돌려 주체성(후보 spread) 비교.
function agencyOfRound(turns){
  const per=turns.map(t=>{ const mx=Math.max(...t.candScores),mn=Math.min(...t.candScores); const spread=(mx-mn)/(mx+1); return spread*(Math.min(t.handN,3)/3); });
  return per.reduce((s,x)=>s+x,0)/per.length;
}
const masterly=PERSONAS.find(p=>p.id==="masterly");
let agStingy=0, agNormal=0, N=400;
for(let i=0;i<N;i++){
  R.setRNG(mulberry32(i+1));
  const deck=R.starterDeck();
  const rng=mulberry32((i+1)^0x9e3779b9);
  const target=R.blindTarget(1,2);
  const rN=playRoundInstrumented(deck, [], null, 3, 1, target, masterly.pick, rng);   // 일반: 보스없음 손패3
  const rS=playRoundInstrumented(deck, [], "stingy", 2, 1, Math.round(target*0.58), masterly.pick, rng); // stingy: 손패2
  agNormal+=agencyOfRound(rN.turns); agStingy+=agencyOfRound(rS.turns);
}
R.setRNG(null);
agNormal/=N; agStingy/=N;
console.log(`   주체성 일반(손패3)=${agNormal.toFixed(3)}  인색한손(손패2)=${agStingy.toFixed(3)}`);
ok("골든: 인색한손이 일반보다 주체성 유의 하락(≥10%)", agStingy < agNormal*0.9);

console.log(fail ? `\n❌ ${fail} 실패` : "\n✅ 전체 통과");
process.exit(fail?1:0);
