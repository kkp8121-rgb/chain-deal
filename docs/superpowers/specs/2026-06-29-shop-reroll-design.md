# CHAIN DEAL — 상점 희석 완화 (리롤 + 가중 오퍼) 설계 (v3.25 목표)

> 작성: 2026-06-29 · v3.24 부적 23종 확장의 직접 후속(희석 -6pp 대응) · 갱신: 가중 오퍼 추가
> 설계 결정(사용자): ①**상점 리롤**(발라트로식·에스컬레이팅) = *주체성 도구* · ②**가중 오퍼**(클러스터 관련성) = *실제 희석 fix* · 메타 업그레이드 = OUT(YAGNI)
>
> ★**구현 중 발견(중요)**: 상점 리롤은 sim에서 희석을 **회복 못 함**(오히려 3.5→2.3%로 악화). CHAIN DEAL은 *다부적 스태킹 가산 경제*라 **선택성(specific 피스 디깅)이 손해**(골드 소진 + 준범용 부적까지 버림). 리롤은 *주체성*으로 유지하되(실플레이어는 의도적으로 잘 씀, sim의 경직 AI는 빌드 의도 없어 못 씀), **실제 희석 fix = 가중 오퍼**(buy-everything과 안 싸움 — 등장 부적만 더 유용하게, 골드 비용 0, sim 검증 가능). 상세 §6.

---

## 0. 요약 & 목표

v3.24가 부적을 13→23종으로 확장하자 run-sim에서 상점 희석이 발생(완성형 베테랑: balance 9.6→3.5%, 23종이 3오퍼 슬롯에 분산돼 빌드 피스 확보율↓). **인플레가 아니라 희석**이라 안전성은 유지되나, 완성형 플레이어 경험이 나빠짐. 

**상점 리롤**: 골드를 써서 3오퍼를 새로 뽑는 버튼. 발라트로 canonical. 효과 — 플레이어가 골드를 지불해 **빌드 피스를 디깅** → 희석 상쇄 + 골드 싱크 + 주체성. **에스컬레이팅 cost**(상점 내 누를수록 비싸짐, 상점 나가면 리셋)로 무한 디깅 차단.

목표: run-sim에서 balance·신규빌드 클리어율이 **희석 전(~9.6%) 쪽으로 회복**하되 **과회복(>베이스라인 = 파워 인플레) 안 함**.

---

## 1. 메커니즘

### 상태
- 신규 전역 `S.shopRerolls` = 이번 상점 방문의 리롤 횟수. **`openShop()`에서 0으로 리셋** → 상점 나가면 초기화(다음 상점 BASE부터).
- `newGame` 초기화 불필요(openShop이 매번 리셋).

### cost (에스컬레이팅)
- `cost = REROLL_BASE + S.shopRerolls` — 첫 리롤 `REROLL_BASE`, 이후 +1씩.
- `REROLL_BASE` = **2(가설)** → run-sim 캘리브로 확정.

### 함수 `rerollShop()`
```javascript
function rerollShop(){
  const cost=REROLL_BASE+S.shopRerolls;
  if(S.gold<cost) return;
  S.gold-=cost; S.shopRerolls++;
  S.shopOffers = shuffle(shopPool()).slice(0,3).map(o=>({...o, sold:false}));   // openShop과 동일 생성
  document.getElementById("hGold").textContent=S.gold;
  try{beep(500,.05);}catch(e){}
  renderShop();
}
```
- 이미 보유한 charm은 `shopPool()`의 `!has` 필터로 자동 제외(재등장 방지). 아이템(thin/copy/enh 등)은 재등장 가능(정상 — 소모성).

### UI (`renderShop()` 버튼 추가)
- 기존 offer 카드들과 "상점 나가기" 버튼 **사이**에 리롤 버튼:
```javascript
const rrCost=REROLL_BASE+S.shopRerolls, canRR=S.gold>=rrCost;
const rr=document.createElement("div"); rr.style.marginTop="10px";
rr.innerHTML=`<button onclick="rerollShop()"${canRR?"":" disabled style='opacity:.45;cursor:not-allowed'"}>🔄 오퍼 새로고침 (💰${rrCost})</button>`;
body.appendChild(rr);
```
- ★**기존 손패 리롤(`rerollMax`/`rerollHand`)과 명확 구분**: 상점 버튼 라벨 = "🔄 오퍼 새로고침", 손패 리롤은 인게임 "🎲 리롤". 둘은 별개 시스템(혼동 방지).

### openShop 리셋
```javascript
function openShop(){
  S.shopRerolls=0;                                              // ★추가
  S.shopOffers = shuffle(shopPool()).slice(0,3).map(o=>({...o, sold:false}));
  ...
}
```

---

## 2. 검증 (★sim이 리롤을 모델해야 유효)

희석이 메커니즘으로 상쇄되는지 보려면 run-sim의 `applyShop`이 **리롤 디깅**을 모델해야 한다.

### run-sim `applyShop` 리롤 미러
```javascript
const REROLL_BASE=2;   // index.html과 동기화
function applyShop(state, strat){
  const SC=(STRATS[strat]||STRATS.balance).charm;
  // 풀에 '전략이 원하는 미보유 charm'이 존재할 때만 디깅 가치 있음(완성 빌드는 디깅 안 함)
  const poolWanted=shopPool(state).some(o=>o.type==="charm" && SC[o.id]);   // shopPool이 !owned 필터
  let offers=shuffle(shopPool(state)).slice(0,3), rr=0;
  while(poolWanted && rr<8){
    const wantsNow=offers.some(o=>o.type==="charm" && SC[o.id]);   // 현재 오퍼에 원하는 charm 있나
    const rc=REROLL_BASE+rr;
    if(wantsNow || state.gold<rc) break;                          // 원하는 게 보이거나 골드 부족 → 디깅 중단
    state.gold-=rc; rr++; offers=shuffle(shopPool(state)).slice(0,3);
  }
  const mapped=offers.map(o=>({o,pr:priority(o,strat),cost:costOf(o)}));
  mapped.sort((a,b)=>b.pr-a.pr);
  for(const it of mapped){ if(state.gold>=it.cost){ state.gold-=it.cost; applyOne(state,it.o,strat); } }   // 구매 모델 불변(buy-everything 유지)
}
```
- ★**buy-everything 구매 모델 불변**(이전 'discerning buyer' 실험이 전 빌드 붕괴시킨 교훈 — 빌드는 다부적 스태킹 의존). 리롤은 **구매 전 디깅**만 추가.
- `poolWanted` 가드 = 빌드가 원하는 charm을 다 가지면 디깅 안 함(무한 리롤·완성빌드 골드낭비 방지).
- cap `rr<8` = 무한루프 안전망(에스컬레이팅 cost가 실질 한도).

### 캘리브 절차
1. `node tools/run-sim.cjs` — REROLL_BASE=2로 측정.
2. 판정: balance가 희석(3.5%)에서 **회복**하되 **베이스라인 9.6% 미초과**(과회복=파워인플레 차단). 신규빌드도 회복(피스 확보↑)하되 비지배 유지.
3. 회복 부족 → BASE 하향(2→1) / 과회복 → BASE 상향(2→3) 또는 cap 조정. index.html·run-sim 동시.

### economy-check 불변식 (신규)
- 에스컬레이팅: 리롤 N회차 cost = `REROLL_BASE + N`(N=0부터). 단조 증가 확인.
- 골드 부족 시 리롤 불가(`gold<cost` → no-op) 확인.

---

## 3. 드리프트 동기화

| 항목 | index.html | run-sim.cjs | economy-check.cjs |
|---|---|---|---|
| `REROLL_BASE` | const(L303 근처) | const | const(검증용) |
| 리롤 로직 | `rerollShop()`(UI) | `applyShop` 디깅 루프 | 에스컬레이팅 단조 테스트 |
| 리셋 | `openShop` `S.shopRerolls=0` | per-shop `rr=0`(applyShop 내) | — |

★`REROLL_BASE`는 3파일 동기화(드리프트 가드: 값 일치). 캘리브로 변경 시 3곳 동시. balance-check.cjs는 단일라운드(라운드-사이 상점 무관)라 미반영.

---

## 4. 범위

**IN**:
- `prototype/index.html`: `REROLL_BASE` const · `S.shopRerolls` · `rerollShop()` · `renderShop()` 버튼 · `openShop()` 리셋.
- `tools/run-sim.cjs`: `REROLL_BASE` · `applyShop` 디깅 루프.
- `tools/economy-check.cjs`: 에스컬레이팅 불변식 테스트.
- 문서: HANDOVER §6 v3.25 · CLAUDE.md(상점 리롤·REROLL_BASE 동기화 지점) · PLAN.md.

**OUT (YAGNI)**:
- 메타 상점 "상점 리롤 할인/무료 +1" 업그레이드(차후 별도).
- 손패 리롤(`rerollMax`)과의 통합/공유.
- 배니시·클러스터-태그 오퍼(이번 메커니즘으로 충분 판정 시 불필요).
- 무료 리롤 1회 제공(에스컬레이팅 단독으로 검증).

---

## 5. 리스크

- **과회복(파워 인플레)**: 리롤이 너무 싸면 완성형이 매 상점 원하는 피스를 확정 확보 → 빌드 과강화 → 베이스라인 초과. 가드 = 에스컬레이팅 + BASE 캘리브(sim에서 >9.6% 시 BASE↑).
- **sim 모델 충실도**: `applyShop` 디깅이 실제 플레이어보다 단순(전략맵 기반). 실제는 더 유연 → sim은 회복을 *과소/과대* 평가 가능. run-sim 단독 권위지만 절대수치보다 *회복 방향*을 본다.
- **UI 혼동**: 상점 리롤 vs 손패 리롤 — 라벨로 구분(위 §1).
- **골드 경제 충돌**: 리롤이 골드를 빨아들여 charm 구매 골드 감소 → 디깅과 구매의 텐션. ★sim 검증 결과 리롤은 희석 fix가 아님(§6) → 리롤은 *주체성*으로만 유지, sim AI는 리롤 미사용(경직 AI가 잘못 쓰면 악화).

---

## 6. 가중 오퍼 (★실제 희석 fix · 구현 중 추가)

### 발견 (왜 리롤이 아니라 가중인가)
리롤을 run-sim `applyShop`에 디깅 모델로 미러한 결과 balance가 희석값(3.5%)에서 **회복 못 하고 2.3~2.9%로 악화**(reserve-aware·BASE 1~2 모두). 근본: CHAIN DEAL은 **다부적 스태킹 가산 경제** — bridge/stair/keystone 등 *준범용* 부적까지 아무 덱이나 트리거. 희석의 정체는 "내 피스를 못 찾음"이 아니라 **"구매의 절반이 효과 0인 니치 부적"**. 리롤은 *선택성*(골드로 specific 피스 디깅)을 사는데 이 경제선 **선택성=손해**(골드 소진→총 부적↓ + 준범용 버림). → 리롤은 주체성 도구로만, **희석 fix는 가중 오퍼**.

### 메커니즘
- **클러스터 태그**: 신규 10부적에 `cluster`(gem/apex/cartel/parity). 기존 13 = 태그 없음(범용, 항상 풀 가중).
- **가중 샘플**: 오퍼 3장을 `weightedSample(shopPool(), 3)`로 — 가중치 `offerWeight(o)`:
  - 범용 charm(클러스터 없음)·아이템 = **1.0**
  - 클러스터 charm: 그 클러스터에 **투자(보유≥1)했으면 1.0, 아니면 `CLUSTER_W`(0.3 가설)**.
- `ownsCluster(cl)` = `CHARMS`에 그 클러스터 부적 중 `has(id)` 있으면 true.
- `openShop`·`rerollShop` 모두 `weightedSample` 사용. ★`rng()`(시드 RNG)로 **데일리 결정론 유지**.

### 공식 (index.html)
```javascript
const CLUSTER_W=0.3;   // 미투자 클러스터 부적 가중(run-sim 동기화·캘리브)
function ownsCluster(cl){ for(const c of CHARMS) if(c.cluster===cl && has(c.id)) return true; return false; }
function offerWeight(o){ if(o.type!=="charm" || !o.charm.cluster) return 1; return ownsCluster(o.charm.cluster) ? 1 : CLUSTER_W; }
function weightedSample(pool, n){
  const p=pool.slice(), out=[];
  for(let k=0;k<n && p.length;k++){
    let tot=0; for(const o of p) tot+=offerWeight(o);
    let r=rng()*tot, idx=p.length-1;
    for(let i=0;i<p.length;i++){ r-=offerWeight(p[i]); if(r<=0){ idx=i; break; } }
    out.push(p[idx]); p.splice(idx,1);
  }
  return out;
}
// openShop/rerollShop: S.shopOffers = weightedSample(shopPool(),3).map(o=>({...o, sold:false}));
```
- CHARMS 정의에 `cluster` 추가: lapidary/prism/jewelbox=`"gem"`, highmult/magnate=`"apex"`, echo/loaded/climax=`"cartel"`, evenodd/paritybet=`"parity"`.

### 효과
- 범용·밸런스 빌드(클러스터 미투자): 니치 클러스터 부적이 0.3× 등장 → **희석↓**.
- 클러스터 투자 빌드: 해당 클러스터 풀 등장 → **빌드 조립↑**.
- 골드 비용 0, buy-everything과 비충돌. ★실게임은 **해금 게이팅**이 이미 1차 필터(안 한 아키타입 미해금=풀에 없음) — 가중은 완성형(전부 해금) 정제.

### 검증 (run-sim 미러)
- run-sim에 `const CLUSTER={lapidary:"gem",...}` + `CLUSTER_W` + `weightedSample`(Math.random 기반) 미러. `shopPool`은 그대로, `openShop`/`applyShop`의 오퍼 선택을 가중 샘플로.
- 측정: **balance가 희석(3.5%)→회복**(목표 ~7~9%, ★베이스라인 9.6% 미초과=과회복 차단). 신규빌드도 회복(클러스터 투자 시 조립↑)하되 비지배.
- **`CLUSTER_W` 캘리브**: 0.3에서 회복 부족 → 낮춤(0.2/0.15, 희석 더 제거). 과회복(>9.6%) → 높임. **0 제외**(클러스터 시작 불가 — 단 sim은 unlock 무시라 0도 동작하나 실게임 chicken-egg 방지 위해 0.1+ 유지). index↔run-sim 동시.

### 드리프트 동기화 (가중 오퍼)
| 항목 | index.html | run-sim.cjs |
|---|---|---|
| 클러스터 태그 | CHARMS `cluster` 필드 | `CLUSTER` 맵 |
| 미투자 가중 | `CLUSTER_W` | `CLUSTER_W` (값 일치) |
| 샘플 | `weightedSample`(rng) | `weightedSample`(Math.random) |
| 적용 | openShop·rerollShop | openShop·applyShop의 오퍼 선택 |

### 범위 (가중 오퍼)
- IN: index.html(cluster 태그 10·CLUSTER_W·ownsCluster·offerWeight·weightedSample·openShop/rerollShop 적용) · run-sim(CLUSTER 맵·CLUSTER_W·weightedSample·오퍼 선택 교체).
- OUT: 리롤 디깅 sim 모델(폐기 — 리롤은 주체성 도구, sim 미모델).
