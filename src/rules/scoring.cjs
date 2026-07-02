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
// 각각 별도로 만든다(필요 필드가 다름 — placeCard는 liveDeckCount/climbSealed, settle은 blindBase/row 헬퍼):
//   has(id)->bool          해당 부적 보유 여부
//   boss(id)->bool          현재 보스 블라인드가 해당 id인지
//   isRed(suit)->bool       무늬(0~3)가 빨강(♥♦)인지 (placeCard용)
//   liveDeckCount:number    4더미(deck+discard+hand+row) 합 — compactor 전용 (placeCard용)
//   connect(a,b)->bool      현재 보스로 바인딩된 connect (placeCard/settle 공용 — 체인 판정·climax)
//   climbSealed(a,b)->bool  현재 보스로 바인딩된 climbSealed (placeCard용 — 내리막 봉인)
//   blindBase:number        blindBase(S.ante) 1회 계산값 — 스테이크 무관 (settle용, 전부 이 값에 비례)
//   HAND_BONUS:{hk:계수}     족보→계수 맵(content/hands.cjs) — scoreHandBase 전용(main.cjs handBonus()가 넘김)
//   bridgeCount/maxAscLen/edgeVal(row)->number   위치-맥락 헬퍼(main.cjs 원본 재사용, settle용)
//   ownedHooks:[hooks,...]  보유 부적들의 hooks 객체 목록(CHARMS.filter(has).map(c=>c.hooks), hooks 있는 것만)
//
// ★3a 스테이지 = base(4)+mult(6)+chainMul(1) = 11부적. ★3b = settle(12)+settleOverride(1) = 13부적 추가.
// ★4a(이번) = 부적훅 아닌 비-charm 전체 경로(연결판정·chain rank합·보스 base/mult/cap·enh·족보 base보너스)를
//   scoreCard/scoreHandBase로 추출 — placeCard/settle의 인라인 로직이 사라지고 이 엔진 호출로 축소된다.

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

// ★Phase 0 Step 4a — 전체 per-card 점수 경로(비-charm 로직 포함)를 완성된 순수함수로 추출.
// 이전엔 base(4)+mult(6)+chainMul(1) 부적훅만 여기 있었고, 연결판정·chain rank합·보스 base/mult/cap 효과·
// enh(gold/mult-enh)는 main.cjs placeCard에 인라인이었다(=순수하지 않음, S.boss 직접 읽음). 이제 전부 ctx로 받는다.
//
// scoreCard: 카드 1장 배치 시 chain 점수 증분 전체(연결판정→chain합→base(charm+boss+enh)→mult(charm+boss+mult-enh)
// →cap→jackpot). 순수(S/document 미접근) — 호출부(main.cjs placeCard)가 이미 card를 push한 row를 넘긴다.
//   row: 카드가 마지막 원소로 이미 포함된 줄 전체 / card: 방금 배치한 카드 / left: 배치 전 줄의 마지막 카드(첫 장이면 null)
//   ctx: has/boss(id)->bool/isRed/liveDeckCount/connect(a,b)->bool(현재 보스로 바인딩)/climbSealed(a,b)->bool/ownedHooks
// 반환 {gained,base,runLen,bonus} — gained=최종 획득 점수(=score에 가산할 값), base=카드 기본점, runLen=체인 길이,
// bonus=체인 보너스(비연결 시 0). juicePlace 연출이 base/runLen/bonus를 그대로 소비(호출부 책임 — main.cjs).
function scoreCard(row, card, left, ctx){
  const rust = ctx.boss('rust');
  let base = (ctx.boss('red_curse') && ctx.isRed(card.suit)) ? 0 : card.rank;
  if(ctx.boss('tax') && card.rank>=7) base=0; else if(ctx.boss('peasant') && card.rank<=3) base=0;   // 사치세/보릿고개
  base += scoreCardBase(card, ctx);   // greed/lapidary/compactor/runts (부적 훅)
  if(card.enh==="gold" && !rust) base+=5;
  let gained=base, runLen=1, bonus=0;

  if(left && ctx.connect(card,left) && !ctx.climbSealed(card,left) && !(ctx.boss('frost') && row.length<=2)){   // 냉각: 줄 첫 2장 연결 무효 / 내리막: 오름 ±1 봉인
    runLen=1; for(let i=row.length-1;i>0;i--){ if(ctx.connect(row[i],row[i-1]) && !ctx.climbSealed(row[i],row[i-1])) runLen++; else break; }
    let mult=runLen-1;
    mult += scoreCardMult(card, left, ctx);   // pyro/noir/suited/runner/highmult/echo (부적 훅)
    for(let i=row.length-runLen;i<row.length;i++) if(row[i].enh==="mult" && !rust) mult+=1;
    if(ctx.boss('dull')) mult=Math.max(1,mult-1);
    mult=Math.min(mult, ctx.boss('anchor')?3:25);   // 닻: 배율 3 캡
    let sum=0; for(let i=row.length-runLen;i<row.length;i++) sum+=row[i].rank;
    bonus=sum*mult;
    bonus=applyChainMul(bonus, runLen, ctx);   // jackpot: runLen>=4 → ×2 (부적 훅)
    if(ctx.boss('toll')) bonus=Math.round(bonus*0.5);   // 연결세: 보너스 반감
    gained+=bonus;
  }
  return { gained, base, runLen, bonus };
}

// scoreHandBase: 족보 기본 보너스(가산 전, override/settle훅 적용 전) = blindBase × HAND_BONUS[hk]. 순수.
// 이전엔 main.cjs handBonus(row)가 blindBase(S.ante)를 직접 읽어 계산(=S 전역 접근, 비순수)했다 — 그 수식만
// 여기로 옮기고, main.cjs의 handBonus()는 이 함수에 ctx({blindBase,HAND_BONUS})를 만들어 넘기는 얇은 래퍼가 된다.
// ctx: blindBase:number(스테이크 무관 — blinds.cjs blindBase(ante) 1회 계산값) / HAND_BONUS: {hk:계수} 맵(content/hands.cjs).
function scoreHandBase(hk, ctx){ return Math.round(ctx.blindBase*(ctx.HAND_BONUS[hk]||0)); }

module.exports = { scoreCard, scoreHandBase, scoreSettle };
