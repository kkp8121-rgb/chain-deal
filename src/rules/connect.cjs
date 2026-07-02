"use strict";
// 순수 규칙(Phase 0 Step 2): connect/climbSealed는 전역 S를 읽지 않고 boss를 파라미터로 받는다.
// boss = 보스 id 문자열(예: "rust") | null — tools/run-sim.cjs의 기존 순수 시그니처를 포팅(동일 구현).
// document/S전역/localStorage 절대 접근 금지 — 호출부(main.cjs)가 S.boss.id를 넘겨준다.

// 연결: 같은 무늬 OR 같은 숫자 OR ±1 연속 (와일드 무조건). 보스 규칙이 일부를 봉인.
function connect(a,b,boss){
  if(boss!=="rust" && (a.enh==="wild"||b.enh==="wild")) return true;   // 부식: 와일드 무력화
  if(boss==="seal_suit" && (a.suit===0||b.suit===0)) return false;     // ♠ 봉인
  if(boss==="mono") return a.suit===b.suit;                            // 단일강요: 같은 무늬만
  const run=Math.abs(a.rank-b.rank)===1;                                // ±1 (방향 봉인은 placeCard climbSealed에서)
  return a.suit===b.suit||a.rank===b.rank||run;
}
function climbSealed(right,left,boss){ return boss==="seal_climb" && right.enh!=="wild" && left.enh!=="wild" && right.suit!==left.suit && right.rank-left.rank===1; }   // 내리막: 오름 +1(다른무늬·비와일드) 체인 봉인

module.exports = { connect, climbSealed };
