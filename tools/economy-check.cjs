// CHAIN DEAL 골드 경제 단위 검증 · 실행: node tools/economy-check.cjs
// ⚠️ index.html 의 goldEarned/spillover/재도전 회수 로직을 복제 검증 (드리프트 시 동기화).
//    파라미터(GOLD_BASE/GOLD_K)를 index.html에서 바꾸면 아래 상수와 기대값도 같이 갱신할 것.
let fail = 0;
const ok = (n, c) => { console.log((c ? "✅" : "❌") + " " + n); if (!c) fail++; };

const GOLD_BASE = 1, GOLD_K = 4;   // run-sim 캘리브 확정값 (balance 8.9% ≈ 기준선 8.6%)
const goldEarned = (s, t) => Math.floor(GOLD_BASE + Math.max(0, s / t - 1) * GOLD_K);
const spillover = g => Math.floor(g * 0.1);

// 1) 환전 공식 (초과율 기반)
ok("간당간당(목표=점수) → BASE(1)", goldEarned(150, 150) === 1);
ok("50% 초과 → 3", goldEarned(225, 150) === 3);
ok("100% 초과 → 5", goldEarned(300, 150) === 5);
ok("미달도 음수 안 됨(클램프 → BASE)", goldEarned(100, 150) === 1);
ok("안테 무관 비율 일관(50% 초과 = 3, 큰 목표서도)", goldEarned(3000, 2000) === 3);

// 2) 스필오버 1/10 내림
ok("스필오버 23골드 → 2", spillover(23) === 2);
ok("스필오버 9골드 → 0", spillover(9) === 0);
ok("스필오버 0골드 → 0", spillover(0) === 0);

// 3) 재도전 카드 불변식: row/hand는 settle에서 회수됨 → deck+discard 전량 회수 시 총량 보존
function retryRecollect(piles) { // {deck,discard,row,hand} — 패배 정산 시점엔 row/hand 빈 상태
  const total = piles.deck.length + piles.discard.length + piles.row.length + piles.hand.length;
  const deck = piles.deck.concat(piles.discard), discard = [];
  return { total, after: deck.length + discard.length + piles.row.length + piles.hand.length };
}
{
  const r = retryRecollect({ deck: Array(18).fill(0), discard: Array(14).fill(0), row: [], hand: [] });
  ok("재도전 회수 후 카드 총량 보존(32)", r.total === 32 && r.after === 32);
}
{ // 압축/추가로 덱 크기가 바뀐 런에서도 보존
  const r = retryRecollect({ deck: Array(9).fill(0), discard: Array(20).fill(0), row: [], hand: [] });
  ok("재도전 회수 후 총량 보존(비표준 덱 29)", r.total === 29 && r.after === 29);
}

// 4) 메타 가격 단조 증가(레벨업할수록 비쌈)
const GOLD_LV = [5, 8, 12], REROLL_LV = [6, 10];
ok("시작골드 가격 단조 증가", GOLD_LV[0] < GOLD_LV[1] && GOLD_LV[1] < GOLD_LV[2]);
ok("시작리롤 가격 단조 증가", REROLL_LV[0] < REROLL_LV[1]);

// 5) 상점 리롤 에스컬레이팅 (cost = REROLL_BASE + shopRerolls) — index.html 동기화
const REROLL_BASE = 2;
const rerollCost = n => REROLL_BASE + n;
ok("리롤 1회차 = BASE(2)", rerollCost(0) === 2);
ok("리롤 2회차 = 3", rerollCost(1) === 3);
ok("리롤 단조 증가", rerollCost(0) < rerollCost(1) && rerollCost(1) < rerollCost(2));
const canReroll = (gold, n) => gold >= rerollCost(n);
ok("골드 부족 리롤 차단", canReroll(1, 0) === false && canReroll(2, 0) === true);

console.log(fail ? `\n❌ ${fail} 실패` : "\n✅ 전체 통과");
process.exit(fail ? 1 : 0);
