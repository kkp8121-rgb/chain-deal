"use strict";
// 순수 규칙(Phase 0 Step 3a — 점수 훅 엔진). 부적은 content/charms.cjs의 hooks 필드에 효과를 1회 선언하고
// (effect-registry 취지 — CLAUDE.md/로드맵 §2), 이 엔진이 ctx.ownedHooks(보유 부적의 hooks만 걸러진 목록)를
// 순회해 일괄 적용한다. document/S 전역/localStorage 절대 접근 금지 — 필요한 상태는 전부 ctx로 호출부(main.cjs)가
// 구성해 넘긴다.
//
// ★content/charms.cjs를 여기서 require하지 않는다 — build.mjs의 resolveRequires는 텍스트 스플라이스라
//   같은 content 모듈을 두 곳(main.cjs 직접 + 여기)에서 require하면 `const CHARMS=...`가 번들에 중복
//   선언돼 파싱이 깨진다(호출부가 이미 CHARMS를 갖고 있으므로 ctx로 필터링해 넘기는 편이 더 순수하기도 하다).
//
// ctx 형태 — placeCard용(scoreCtx, 매 카드 배치마다 구성) / settle용(settleCtx, 정산 1회 구성)이 main.cjs에
// 각각 별도로 만든다(필요 필드가 다름 — placeCard는 liveDeckCount, settle은 blindBase/connect/row 헬퍼):
//   has(id)->bool          해당 부적 보유 여부
//   boss(id)->bool          현재 보스 블라인드가 해당 id인지
//   isRed(suit)->bool       무늬(0~3)가 빨강(♥♦)인지 (placeCard용)
//   liveDeckCount:number    4더미(deck+discard+hand+row) 합 — compactor 전용 (placeCard용)
//   connect(a,b)->bool      현재 보스로 바인딩된 connect (settle용 — climax)
//   blindBase:number        blindBase(S.ante) 1회 계산값 — 스테이크 무관 (settle용, 전부 이 값에 비례)
//   bridgeCount/maxAscLen/edgeVal(row)->number   위치-맥락 헬퍼(main.cjs 원본 재사용, settle용)
//   ownedHooks:[hooks,...]  보유 부적들의 hooks 객체 목록(CHARMS.filter(has).map(c=>c.hooks), hooks 있는 것만)
//
// ★3a 스테이지 = base(4)+mult(6)+chainMul(1) = 11부적. ★3b(이번) = settle(12)+settleOverride(1) = 13부적 추가.

// base 훅: card 기본점수(rank 등)에 더할 가산분 합산. hook 시그니처 (card,ctx)->number
function scoreCardBase(card, ctx){
  let add=0;
  for(const h of ctx.ownedHooks) if(h.base) add+=h.base(card, ctx);
  return add;
}
// mult 훅: connect 체인의 배율(mult)에 더할 가산분 합산. hook 시그니처 (card,left,ctx)->number
function scoreCardMult(card, left, ctx){
  let add=0;
  for(const h of ctx.ownedHooks) if(h.mult) add+=h.mult(card, left, ctx);
  return add;
}
// chainMul 훅: bonus(sum×mult) 산출 후 적용하는 배수 변환. hook 시그니처 (bonus,runLen,ctx)->number
function applyChainMul(bonus, runLen, ctx){
  let b=bonus;
  for(const h of ctx.ownedHooks) if(h.chainMul) b=h.chainMul(b, runLen, ctx);
  return b;
}
// settleOverride 훅: hb(족보 보너스)를 고정값으로 덮어씀(가산 아님 — broker 전용). hook 시그니처
// (row,hk,ctx)->number|null (null=미적용). ★가산(settle)보다 먼저 적용 — 옛 인라인(main.cjs L251이 twins 등
// 나머지보다 먼저)과 동일 순서: override가 먼저 hb를 바꾸고, 그 위에 다른 부적들의 settle 가산이 쌓인다.
function applySettleOverride(hb, row, hk, ctx){
  let v=hb;
  for(const h of ctx.ownedHooks) if(h.settleOverride){ const r=h.settleOverride(row, hk, ctx); if(r!=null) v=r; }
  return v;
}
// settle 훅: 정산 시점 hb에 더할 가산분 합산(전부 blindBase 비례). hook 시그니처 (row,hk,ctx)->number
function scoreSettleAdd(row, hk, ctx){
  let add=0;
  for(const h of ctx.ownedHooks) if(h.settle) add+=h.settle(row, hk, ctx);
  return add;
}
// settle 엔진 진입점: override 먼저 적용 → 가산 합산. main.cjs settle()의 유일한 호출 지점.
function scoreSettle(hb, hk, row, ctx){
  return applySettleOverride(hb, row, hk, ctx) + scoreSettleAdd(row, hk, ctx);
}
module.exports = { scoreCardBase, scoreCardMult, applyChainMul, scoreSettle };
