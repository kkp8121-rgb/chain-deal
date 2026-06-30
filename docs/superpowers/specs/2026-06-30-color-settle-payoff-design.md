# CHAIN DEAL — 색 settle 페이오프 "투톤"(duochrome) 설계 (v3.27 목표)

> 작성: 2026-06-30 · 로드맵: v3.24 **인지된 갭**(색 settle 페이오프 부재) 해소
> 설계 결정(사용자, 브레인스토밍): ①진입 = **1종 신규 settle charm**(희석 최소) · ②메커니즘 = **이중색(소프트 플러시)** · ③이름 = **투톤** · ④unlock 조건 그대로

---

## 0. 요약 & 목표

색(빨강 ♥♦ / 검정 ♠♣)은 현재 **place-time 체인 mult 부적만** 가진 유일한 빌드축이다 — `pyro`(발화: 빨강 연결 mult+2)·`noir`(흑심: 검정 연결 mult+2). 다른 모든 빌드축(gem/apex/cartel/parity/position)은 **settle 가산 페이오프**를 갖는데 색만 없다(v3.24에서 색계열 5종을 marginal/dead로 컷하며 명시한 인지된 갭). 

**목표**: settle 가산형 색 부적 **1종(투톤)**을 추가해 색축에 2-레이어(place mult + settle 가산)를 부여, pyro/noir와 시너지로 색을 온전한 빌드축으로 완성한다. **단 connect 시그니처 무건드림**(2파일 미러 유지) + 가산·바운드(아슬아슬 보존).

**핵심 distinct 근거**: 순수 플러시(1무늬)는 보상에서 **제외**(두 무늬 게이트) → 색 charm이 플러시 족보 보너스와 **더블딥하지 않음** → 색축과 플러시축이 분리 유지. "두 무늬 섞은 단색" = 플러시보다 쉽고 낮은 *소프트 플러시* 니치(비어있음).

---

## 1. 룰 정의

**투톤(twotone)**: 정산 시 줄을 색으로 집계해, **한 색으로 치우치고(dom) 그 우세 색의 두 무늬가 모두 존재**하면 치우친 만큼 가산 보너스. 순수 플러시(우세 색이 한 무늬뿐)는 게이트 미통과로 **0**.

집계(비-와일드만, 다른 부적 관례와 동일):
- `red = (♥ 수) + (♦ 수)`, `black = (♠ 수) + (♣ 수)`
- `dom = max(red, black)` (8 캡), `domColor` = 우세 색(동률 시 빨강)
- `bothSuits` = domColor가 빨강이면 `♥≥1 && ♦≥1`, 검정이면 `♠≥1 && ♣≥1`

보너스(가산, `blindBase` 스케일):
```
bothSuits ? round(blindBase(ante) × 0.04 × max(0, min(dom,8) − 4)) : 0
```

| dom | bothSuits | 보너스 |
|---|---|---|
| 4 (4-4 균형) | — | 0% |
| 5 | ✓ | +4% |
| 6 | ✓ | +8% |
| 7 | ✓ | +12% |
| 8 (예: 4♥4♦) | ✓ | +16% |
| 8 (8♥ = 순수 플러시) | ✗ (한 무늬) | **0%** |

(suit 매핑 = `0♠ 1♥ 2♦ 3♣`, `isRed` = suit 1·2.)

**메타**: id `twotone` · name **투톤** · icon 🎨 · desc `정산 시 한 색(♥♦/♠♣)으로 치우치고 그 색 두 무늬가 다 있으면 치우친 만큼 보너스 (순수 플러시는 제외)` · cost **8**(표준) · **cluster 없음**(베이스 풀, offerWeight 1.0).

★**cluster 무태그 이유**: 가중 오퍼(v3.25)의 `CLUSTER` 맵은 *미투자 클러스터*를 `CLUSTER_W`(0.15)로 감량한다. 단일 charm에 신규 cluster 태그를 주면 "그 클러스터 charm을 이미 보유" 조건을 영영 못 채워 **영구 down-weight → 사장**된다. 투톤은 pyro/noir/suited처럼 **베이스(무태그) 부적**으로 두어 정상 등장률 유지.

---

## 2. 구현 (connect 무건드림 → index ↔ run-sim 2파일 미러)

색 집계는 **순수 정산 가산**이며 connect()/체인 판정과 무관 → `balance-check.cjs`(단일라운드·구부적)·`strategy-sim.cjs`·`hand-frequency.cjs` 동기화 불필요(run-sim 단독 권위, v3.24 선례).

### index.html
1. **CHARMS** (parity charm `paritybet` 항목 L334 뒤): `{id:"twotone", name:"투톤", desc:"정산 시 한 색(♥♦/♠♣)으로 치우치고 그 색 두 무늬가 다 있으면 치우친 만큼 보너스 (순수 플러시는 제외)"}`.
   - cost 미지정 = 기본 8(인에이블러 cost 필드 없음). cluster 필드 **미지정**(베이스 풀).
2. **settle 가산 블록** (`has("paritybet")` L515 바로 뒤):
   ```javascript
   if(has("twotone")){
     let h=0,d=0,s=0,c=0;
     for(const x of S.row){ if(x.enh==="wild") continue; if(x.suit===1)h++; else if(x.suit===2)d++; else if(x.suit===0)s++; else c++; }
     const red=h+d, black=s+c, dom=Math.max(red,black);
     const bothSuits = red>=black ? (h>0&&d>0) : (s>0&&c>0);
     if(bothSuits) hb+=Math.round(blindBase(S.ante)*0.04*Math.max(0,Math.min(dom,8)-4));   // 투톤: 두 무늬 섞은 단색 치우침(순수 플러시 제외)
   }
   ```
3. **UNLOCKS** 항목 추가(불변식: 시작 부적 아닌 모든 부적은 UNLOCKS 필수): id `twotone`, 조건 = **한 라운드에 한 색 6장+ 로 정산**(메커니즘 학습형). settle 시 `Math.max(red,black) >= 6` 판정(컬렉션 드로어 힌트 문구 포함).
4. **컬렉션 드로어**(잠금 실루엣+조건 힌트) — 기존 해금 charm과 동일 배선.

### tools/run-sim.cjs
1. **CHARMS 배열** (L111)에 `"twotone"` 추가.
2. **handBonus** (parity `paritybet` 미러 L85 뒤) — index와 **동일 로직**(`owned.includes("twotone")`, `row`, `ante`):
   ```javascript
   if(owned&&owned.includes("twotone")){ let h=0,d=0,s=0,c=0; for(const x of row){ if(x.enh==="wild")continue; if(x.suit===1)h++; else if(x.suit===2)d++; else if(x.suit===0)s++; else c++; } const red=h+d,black=s+c,dom=Math.max(red,black); const bothSuits=red>=black?(h>0&&d>0):(s>0&&c>0); if(bothSuits) hb+=Math.round(blindBase(ante)*0.04*Math.max(0,Math.min(dom,8)-4)); }
   ```
3. **color strat 추가** (STRATS, L125~): 색 빌드 viability 실측용(대표 = 빨강 경로).
   ```javascript
   color: { charm:{twotone:10,pyro:9,greed:5,suited:4,jackpot:4}, enh:{wild:3,mult:4,gold:3}, item:{add:8,thin:5,hand:5,copy:3,reroll:1} },
   ```
4. **applyOne `add`** (L150) 색 분기 확장: `strat==="color"`면 빨강 카드(♥/♦) 매입 — 게이트(두 무늬)도 자연 충족.
   `const suit=strat==="flush"?1:strat==="black"?(ri(2)?0:3):strat==="color"?(ri(2)?1:2):ri(4);`
5. **STRAT_KO**에 `color:"색(투톤) 빌드"` 추가.

### tools/unlock-check.cjs
- `UNLOCKS`/조건 미러에 `twotone`(한 색 6장+ settle) 추가 → 검증 카운트 26→**27/0**.

★**드리프트 가드**: 투톤 settle 로직 = `index.html`(L515 뒤) ↔ `run-sim.cjs`(L85 뒤) **값·식 일치 미러**. cluster 무태그(CLUSTER 맵 무변경) 확인.

---

## 3. 파라미터 (캘리브 계획)

- **시작값**: K=0.04 / thr=4 / dom 캡 8 → 보너스 0~16%. evenodd(+12% 상한, thr 5)보다 약간 후함 = **두-무늬 게이트가 더 빡세서** 상쇄(게이트 없는 evenodd 대비 보정).
- **캘리브 절차**(run-sim 권위):
  1. `node tools/run-sim.cjs` — color strat 추가 후 클리어율 측정.
  2. **가드 ①무인플레**: balance 기준선(7.6%·St0) **불초과**(투톤 추가가 비특화 빌드 인플레 금지).
  3. **가드 ②비지배**: color strat이 다른 클러스터 밴드(3~6%대)와 동급 — 단독 지배(≫balance) 금지.
  4. **가드 ③비사망**: color strat이 투톤으로 의미있는 페이오프(투톤 미보유 대비 향상). 죽으면 thr 4→3 또는 K↑.
  - 너무 세면 K 0.04→0.03, 너무 순하면 thr 4→3.
- ★**희석 주의**: 베이스 풀에 +1(무태그=항상 등장)이라 미세 희석. 단일 charm·범용성이라 v3.24식 클러스터 희석과 다름 — balance 기준선 불변 확인으로 충분.

---

## 4. 검증

1. **문법**: `node tools/balance-check.cjs` — index.html 인라인 JS 파싱 OK(투톤 무관하나 회귀 가드).
2. **밸런스(권위)**: `node tools/run-sim.cjs` — ①balance 기준선 불변(±0.5pp) ②color strat viable·비지배 ③조건부 통과율 곡선 불변.
3. **해금**: `node tools/unlock-check.cjs` — 27/0(투톤 조건 추가).
4. **경제 회귀**: `node tools/economy-check.cjs`(무관, 회귀 확인).
5. **UI 스모크**: 노드 DOM-스텁 — CHARMS 24종 렌더·정산 시 투톤 보너스 가산·드로어 잠금/해금 표시·콘솔에러0. (Playwright 미설치 대체.)

---

## 5. 범위

**IN**: `index.html`(CHARMS·settle 가산·UNLOCKS·드로어) · `run-sim.cjs`(CHARMS·handBonus·color strat·applyOne add·STRAT_KO) · `unlock-check.cjs`(조건) · 문서(HANDOVER/CLAUDE/PLAN).

**OUT (YAGNI)**:
- 색 클러스터 2~3종 확장(단일 charm 결정 — 추후 viability 보고 별도).
- pyro/noir에 settle 성분 부여(기존 정체성 변경·밸런스 리스크 — 컷).
- connect 시그니처 변경형 색 부적(acewild/colorbond류 — 3파일 드리프트, v3.24 컷 유지).
- 색 cluster 태그(싱글톤 down-weight 사장 — 무태그 유지).
- B(단색 치우침)·C(같은색 인접쌍) 메커니즘(A로 확정).

---

## 6. 리스크

- **marginal/dead 재현**(이전 색 5종 운명): 캘리브 가드 ③(비사망)으로 방어 — color strat이 죽으면 thr/K 조정.
- **B와 사실상 동일 동작**: 전형 플레이에선 단색 치우침과 유사 — A의 가치는 *플러시 더블딥 차단*(distinct 근거)이지 기계적 신규성 아님. 정직히 수용(설계 의도).
- **희석**: 베이스 +1. 단일·범용이라 미미하나 balance 기준선 불변으로 확인.
- **드리프트(2파일)**: 투톤 로직 index↔run-sim 미러. cluster 무태그 가드.
- **sim 한계**: greedy 봇은 색 집계 자체는 잘 모델(배치 의도 불필요, 단순 카운트)이라 stair/keystone식 과소평가 적음 — color strat 실측 신뢰도 양호.
