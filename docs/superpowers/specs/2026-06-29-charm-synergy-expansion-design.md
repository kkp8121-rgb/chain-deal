# CHAIN DEAL — 부적 시너지 확장 10종 설계 (v3.24 목표)

> 작성: 2026-06-29 · 로드맵 MID "부적 ~20-25종 시너지 확장" (HANDOVER §7 🧭)
> 방법론: 5렌즈 생성(21후보) → 후보별 적대적 밸런스 심사(run-sim 실측) → 합성. 워크플로우 `wf_5eab1e92-bd6`.
> ★현재 13종 → **+10종 = 23종**. "시너지 밀도 > 개수" 원칙.

---

## 0. 요약

기존 13 부적은 빌드축이 단순 부스트/색/연결타입/체인길이/압축/족보/위치로 분산돼 있고, **부적 = 유일한 빌드축이자 가장 약한 차원**(발라트로 ~150조커 대비). 본 설계는 **4개 시너지 클러스터로 10종**을 추가한다. 전부 **가산·바운드**(곱셈 0), connect 시그니처 **무변경**(→ `index.html ↔ run-sim.cjs` **2파일만** 미러). 적대적 심사가 run-sim에 실제 미러해 클리어율을 측정, 전 부적이 **비특화 9.4% 기준선을 인플레하지 않고** 전용 빌드도 단독 지배하지 않음(3.8~9.4%)을 확인했다.

**4 클러스터 / 10 부적 / 스파이스 1**:
1. **보석 세공** (enh 스태킹, 빈 축): lapidary · prism · jewelbox
2. **정점** (고랭크 7·8, compactor/runts의 반대축): highmult · magnate
3. **같은수 카르텔** (족보↔체인 브릿지, twins/broker와 메타클러스터): echo · loaded · climax
4. **홀짝 패리티** (빈 축, ±1과 직교): evenodd · **paritybet(스파이스)**

---

## 1. 목표 & 확정 설계 결정

| 결정 | 값 | 근거 |
|---|---|---|
| 시너지 철학 | **혼합** (인에이블러+신규 페이오프+크로스브릿지) | SSoT "시너지 밀도 > 개수" |
| 규칙 파괴(②) | **대부분 보수 + ICONIC 스파이스 1개**(paritybet) | 분산은 가산으로 보존, ②재미는 소량 |
| cost 차등 | **신규 부적 cost 필드 도입**(기본 8, 인에이블러 3~5) | 콤보 인에이블러("단독 약함")가 8값이면 안 팔려 시너지 죽음 |
| 규모 | **~10종(→23), 4클러스터** | 25종(C)은 상점 3오퍼 희석↑ → 23이 밀도·리스크 균형점 |
| 상점 희석 처리 | **10종만 출하**, 희석 메커니즘은 후속 분리 | unlock 게이팅 + `!has` 필터로 풀 점진 축소 → 희석 완화. 단순성 원칙 |

**불변 제약 (HARD)**: ①가산·바운드만(곱 금지) ②카드 추가 0 ③시작덱 A~8 32장 압축 유지 ④모든 비시작 부적 UNLOCKS 항목 필수 ⑤run-sim.cjs 미러 가능(row/per-card 훅) ⑥connect 시그니처 무변경.

---

## 2. 신규 부적 10종 (정확한 공식·삽입지점)

> **index.html 삽입지점**: per-card base = `placeCard` L433(`gold +5`) 다음 / per-card mult = connect 블록 L445(`runner`) 다음(`left` 보장) / settle = `settle()` L482(`keystone`) 다음·L483(`S.score+=hb`) 직전(`hk`=L477·`S.row`·`S.ante`·`S.boss` 사용, `blindBase(S.ante)`).
> **run-sim.cjs 미러**: per-card base = `gain()` L23 다음 / per-card mult = L35(`runner`) 다음(`left`=L27) / settle = `handBonus()` L74(`keystone`) 다음·L75(`return hb`) 직전(`hk`=L68·`connect(...,boss)`·`owned`·`row`·`ante`·`boss`).

### 클러스터 ① 보석 세공 (enh 스태킹)

현재 enh(★와일드·●황금·◆배율석)는 개별 효과만 있고 **"여러 장 모음"엔 무보상** = 빈 축. enh 획득 비용(상점 5~8골드)이 자연 바운드.

**1) `lapidary` 세공사** — per-card base · cost **5** · 인에이블러
- desc: `강화 카드(★●◆)를 깔면 기본 점수 +3 (부식 보스 중엔 무효)`
- index: `if(has("lapidary") && card.enh && !rust) base+=3;`
- run-sim: `if(owned.includes("lapidary")&&card.enh&&!rust) base+=3;`
- unlock: `row.filter(c=>c.enh).length>=3` · hint "한 줄에 강화 카드 3장"
- balance: greed(+3)/runts(+4) 선례 동급. base는 sum×mult 미경유(raw rank) → ×엔진 무증폭(분산 안전 확정). row당 enh≤8로 구조적 바운드. 의도된 약한 인에이블러 → jewelbox/prism과 동시 출시 전제.

**2) `prism` 프리즘** — settle · cost **5** · 인에이블러
- desc: `줄에 와일드·황금·배율석이 모두(3종) 있으면 정산 보너스 +12% (부식 보스 중엔 무효)`
- index: `if(has("prism")){ let w=0,g=0,m=0; for(const c of S.row){ if(c.enh==="wild")w=1; else if(c.enh==="gold")g=1; else if(c.enh==="mult")m=1; } if(w&&g&&m && !(S.boss&&S.boss.id==="rust")) hb+=Math.round(blindBase(S.ante)*.12); }`
- run-sim: `if(owned&&owned.includes("prism")){ let w=0,g=0,m=0; for(const c of row){ if(c.enh==="wild")w=1; else if(c.enh==="gold")g=1; else if(c.enh==="mult")m=1; } if(w&&g&&m&&boss!=="rust") hb+=Math.round(blindBase(ante)*.12); }`
- unlock: 3종 동시(`w&&g&&m`) · hint "한 줄에 와일드·황금·배율석 동시"
- balance: 심사 revise 반영 — rust 게이트 추가(테마 일관성) + 8%→12% 상향(트리거 빈도 ~5%라 함정픽 구제, enabler 정체성 '3종-동시 단발' 유지). 비특화 인플레 ~0. **★gem 클러스터 동시 출시 전제**(단독은 함정픽).

**3) `jewelbox` 보석함** — settle · cost **8** · 페이오프(클러스터 앵커)
- desc: `정산 시 줄에 깔린 강화 카드(★●◆) 1장마다 보너스 +2.5% (최대 6장)`
- index: `if(has("jewelbox")){ let e=0; for(const c of S.row) if(c.enh) e++; hb+=Math.round(blindBase(S.ante)*.025*Math.min(e,6)); }`
- run-sim: `if(owned&&owned.includes("jewelbox")){ let e=0; for(const c of row) if(c.enh) e++; hb+=Math.round(blindBase(ante)*.025*Math.min(e,6)); }`
- unlock: `row.filter(c=>c.enh).length>=3` · hint "한 줄에 강화 카드 3장" (lapidary와 동일 = gem 클러스터 동시 해금)
- balance: 실측 풀 투입 후 balance 9.4~9.7%→8.7~9.0%(인플레 없음, 오히려 희석↓). 전용 jewel빌드 3.8%(비지배·비死). cap6는 cosmetic, 실 레버 per-unit .025(bridge .03 미만 보수). rust 무게이트(보관량 의도).

### 클러스터 ② 정점 (고랭크 7·8)

compactor/runts(저카드 압축)의 정반대 축. 카운터 = tax 보스(7·8 base 0).

**4) `highmult` 위세** — per-card mult · cost **5** · 인에이블러
- desc: `7·8 고카드로 연결하면 배율 +1`
- index: `if(has("highmult") && card.rank>=7) mult+=1;` (connect 블록, L445 옆)
- run-sim: `if(owned.includes("highmult")&&card.rank>=7) mult+=1;` (L35 옆)
- unlock: `row.filter(c=>c.rank===8).length>=3` · hint "한 줄에 8 카드 3장"
- balance: +1 = suited/runner 동급, **25 mult 캡(닻은 3) 종속**이 최종 방어선. 실측 balance 능동픽 8.5%≈baseline(인플레 0), apex 천장 9.4%=동률(비지배). ★`rank>=7` 유지(rank===8 하향은 apex 死화, sim 반증).

**5) `magnate` 거물** — settle · cost **8** · 페이오프
- desc: `정산 시 줄의 7·8 고카드 1장마다 보너스 +3% (최대 5장)`
- index: `if(has("magnate")){ let h=0; for(const c of S.row) if(c.enh!=="wild"&&c.rank>=7) h++; hb+=Math.round(blindBase(S.ante)*.03*Math.min(h,5)); }`
- run-sim: `if(owned&&owned.includes("magnate")){ let h=0; for(const c of row) if(c.enh!=="wild"&&c.rank>=7) h++; hb+=Math.round(blindBase(ante)*.03*Math.min(h,5)); }`
- unlock: `row.filter(c=>c.rank>=7).length>=5` · hint "한 줄에 7·8 카드 5장"
- balance: 실측 balmag 9.3%≈baseline(스텔스 인플레 아님, 8골드 기회비용 상쇄). 전용 high빌드 7.0%(highmult 동반으로 해소 의도). count 기반이라 tax 보스서도 일부 잔존=회복 여지. 와일드 제외(무랭크).

### 클러스터 ③ 같은수 카르텔 (족보↔체인 브릿지)

connect 3연결유형 중 보상 없던 '같은 랭크'를 채우고(echo), 불법패를 보상(loaded), 족보+긴체인 동시를 보상(climax). 기존 twins/broker와 4+종 메타클러스터.

**6) `echo` 메아리** — per-card mult · cost **3** · 인에이블러
- desc: `같은 숫자로 연결하면 배율 +1`  (★정직 표기 — "연속으로 친다" 거짓 프레이밍 금지)
- index: `if(has("echo") && card.rank===left.rank) mult+=1;` (connect 블록 내부, L445 옆 — `left` 보장)
- run-sim: `if(owned.includes("echo")&&card.rank===left.rank) mult+=1;` (L35 옆, `left`=L27)
- unlock: `maxRankCount(row)>=4` (기존 헬퍼 L328) · hint "한 줄에 같은 숫자 4장"
- balance: 두 생성 후보(맞장구 +1 / 메아리 +2) **dedup → 단일 +1 enabler cost3**(+2는 cost대 미스매치·인플레). 실측 echo픽 8.8%==미픽(진성 enabler). 32장 유니크덱서 같은랭크=다른무늬라 suited 동시발화 불가(안전).

**7) `loaded` 사기패** — settle · cost **8** · 페이오프
- desc: `정산 시 포카드면 보너스 +10%, 파이브카드(같은숫자 5장)면 +30%`
- index: `if(has("loaded")){ if(hk==="fourKind") hb+=Math.round(blindBase(S.ante)*.10); else if(hk==="fiveKind") hb+=Math.round(blindBase(S.ante)*.30); }` (`hk`=L477 재사용)
- run-sim: `if(owned&&owned.includes("loaded")){ if(hk==="fourKind") hb+=Math.round(blindBase(ante)*.10); else if(hk==="fiveKind") hb+=Math.round(blindBase(ante)*.30); }` (`hk`=L68 재사용)
- unlock: `evalHand(row)==="fiveKind"` · hint "파이브 카드 완성"
- balance: evalHand 최고족보 1개만 → 라운드당 1회=cap 내장. fourKind +1.02pp(기존 페이오프 봉투 내 최저). **★fiveKind=0.30 분기는 run-sim(random copy)로 검증 불가** → HANDOVER/CLAUDE 드리프트 노트 + unlock 게이트 + copy 덱비대 기회비용으로 수동 가드.

**8) `climax` 절정** — settle · cost **8** · 브릿지(체인↔족보)
- desc: `풀하우스 이상 족보를 만든 라운드, 줄의 최장 연결이 6칸부터 길수록 정산 보너스 추가 (최대 8연결)`
- index: `if(has("climax") && ["fullHouse","fourKind","straightFlush","fiveKind"].includes(hk)){ let L=1,cur=1; for(let i=1;i<S.row.length;i++){ if(connect(S.row[i],S.row[i-1])){ cur++; if(cur>L)L=cur; } else cur=1; } hb+=Math.round(blindBase(S.ante)*.03*Math.max(0,Math.min(L,8)-5)); }`
- run-sim: `if(owned&&owned.includes("climax") && ["fullHouse","fourKind","straightFlush","fiveKind"].includes(hk)){ let L=1,cur=1; for(let i=1;i<row.length;i++){ if(connect(row[i],row[i-1],boss)){ cur++; if(cur>L)L=cur; } else cur=1; } hb+=Math.round(blindBase(ante)*.03*Math.max(0,Math.min(L,8)-5)); }`
- unlock: 8칸 전부 연결 + 풀하우스↑ 동시 · hint "8칸 전부 연결 + 풀하우스↑"
- balance: 심사 revise 반영 — 게이트 trips/straight/flush→**fullHouse+**, 임계 5→**6연결**(L-5), coef .03 → cap +9%(초안 .12서 하향). 실측 force-own +1.78pp→+0.64pp, 발동 59%→27%(진성 이중빌드 게이트). flush/straight는 L≥5 자동충족이라 비선택성 야기 → 제거. broker는 fullHouse+ 하 반시너지라 파트너 제외.

### 클러스터 ④ 홀짝 패리티 (빈 축)

±1(runner) 연결이 패리티를 반전 → 홀짝 몰빵은 런을 포기하는 자명한 기회비용 = 직교 빌드. 점증 우세(evenodd) → 완벽 한쪽(paritybet) 램프.

**9) `evenodd` 홀짝 정렬** — settle · cost **8** · 페이오프
- desc: `정산 시 줄이 짝수 또는 홀수 한쪽으로 6장부터 치우칠수록 보너스 (초과분마다 +4%)`
- index: `if(has("evenodd")){ let ev=0,od=0; for(const c of S.row) if(c.enh!=="wild")(c.rank%2?od++:ev++); hb+=Math.round(blindBase(S.ante)*.04*Math.max(0,Math.max(ev,od)-5)); }`
- run-sim: `if(owned&&owned.includes("evenodd")){ let ev=0,od=0; for(const c of row) if(c.enh!=="wild")(c.rank%2?od++:ev++); hb+=Math.round(blindBase(ante)*.04*Math.max(0,Math.max(ev,od)-5)); }`
- unlock: `Math.max(ev,od)>=6` · hint "한 줄에 같은 홀짝 6장"
- balance: ★심사 핵심 — 임계 **d-5**(d-4는 무작위 8장줄 72.7%가 d≥5라 +4.38% 무조건 바닥값 = bridge/keystone식 비특화 인플레 위험). d-5로 '진짜 몰빵(6장+)'만 보상. cap d=8 → +12%. 와일드 제외.

**10) `paritybet` 패리티 도박** — settle · cost **8** · **스파이스(②규칙파괴)**
- desc: `줄 전체가 짝수만 또는 홀수만이면 정산 보너스 +30% (와일드는 자유)`
- index: `if(has("paritybet")){ const nw=S.row.filter(c=>c.enh!=="wild"); if(S.row.length>=8 && (nw.every(c=>c.rank%2===0)||nw.every(c=>c.rank%2===1))) hb+=Math.round(blindBase(S.ante)*.30); }`
- run-sim: `if(owned&&owned.includes("paritybet")){ const nw=row.filter(c=>c.enh!=="wild"); if(row.length>=8 && (nw.every(c=>c.rank%2===0)||nw.every(c=>c.rank%2===1))) hb+=Math.round(blindBase(ante)*.30); }`
- unlock: perfect parity 1회(업적=해금) · hint "줄 전체 짝수만/홀수만"
- balance: ★유일 ICONIC 스파이스(가장 iconic·드리프트 최저·인플레 안전). 전원 동일 패리티=±1 연결 원천불가라 우연발동≈0 → 9.4% 미상승(keystone과 달리 anti-correlated). flush(.30) 동급 티어. **머지 게이트**: run-sim 미러 후 ①balance ~9.4% 불변 ②패리티 전용빌드 비지배(spatial ~3.4% 밴드 이하). 지배 시 **.25 폴백**, flush co-stack(.60~.72) 지배 시 `if(hk!=="flush"&&hk!=="straightFlush")` 가드.

---

## 3. 컷 (생성됐으나 심사가 잘라낸 것)

| 후보 | 컷 사유 |
|---|---|
| `scout` (손패+1) | run-sim 실측 9.4%→**41%**(4.4배 인플레). 비특화 최강 레버 = 가드 정면 위반 |
| `curator` (보유 부적 수 보상) | greed 중복(4번째 평면 base 부적), 죽은 카드 |
| `mono` (단일무늬 몰빵) | **보스 id `mono`(단일강요)와 네임스페이스 충돌** |
| `acewild`·`colorbond` | **connect 시그니처 변경 유발**(3파일 HIGH 드리프트) → 컷으로 2파일 미러 유지 |
| `twotone`·`mosaic`·`purity`·`softlow`·`distill` | marginal/dead/dup |
| `echo`(메아리 +2 spice) | echo(맞장구 +1 enabler)와 id 충돌 → 단일 enabler로 dedup |

**★색채(2색) 신규 부적 전무**: 색계열 5종 전부 컷. 기존 pyro/noir/suited로 색축 충분 판단(의도적). 색 settle 페이오프 부재는 **인지된 갭** — 향후 connect 미건드리는 순수 가산형(같은색 인접쌍 카운트 등)으로 별도 검토.

---

## 4. 드리프트 동기화 계획 (2파일)

connect 시그니처 무변경(acewild/colorbond 컷) → **`index.html ↔ run-sim.cjs` 2파일 미러로 충분**. balance-check.cjs·strategy-sim.cjs·hand-frequency.cjs는 **구 13부적 기준이라 신규 검증 무효** — 동기화 보류(문법·단일라운드 기준선 역할만), **신규 검증은 run-sim.cjs 단독 권위**.

| 위치 | index.html | run-sim.cjs |
|---|---|---|
| per-card base | placeCard L433(gold) 다음: lapidary | gain() L23 다음: lapidary (rust 공유) |
| per-card mult | connect 블록 L445(runner) 다음: highmult, echo | gain() L35 다음 (`left`=L27): highmult, echo |
| settle hb | settle() L482(keystone) 다음·L483 직전: prism, jewelbox, magnate, loaded, climax, evenodd, paritybet | handBonus() L74 다음·L75 직전 동일 7종 (`hk`=L68, `connect(...,boss)`) |
| rust 게이트 | lapidary(base)·prism(hb)만. jewelbox/magnate/loaded 무게이트 | 동일 |
| 부적 정의 | `CHARMS` 배열 + `cost` 필드(인에이블러 3·5) | `CHARMS` 배열(L100) + `costOf()`(L110) charm cost 분기 |
| 상점 strat | (해당없음) | `STRATS`(L114~)에 gem/apex/cartel/parity 4 프로필 추가 |
| 해금 | `UNLOCKS` 객체(L335) 10종 cond/hint | `tools/unlock-check.cjs` 10종 미러 |

★`cost` 차등 도입: 현 `shopPool()`(index L552)은 charm 일괄 `cost:8`. → `cost:(c.cost||8)`로 변경, charm 정의에 `cost:5`/`cost:3` 필드. run-sim `costOf()`도 charm cost를 id별 분기(또는 charm 객체 cost 참조).

---

## 5. 리스크 & 가드

1. **상점 희석 (최대 리스크, 후속 분리)**: 13→23종이면 3오퍼 변별력↓(신규 1종당 전 빌드 ~0.3~0.9pp 균일 하락 = 포트폴리오 효과, 개별 결함 아님). **이번 범위 제외** — unlock 게이팅 + `!has` 필터로 완화. 실제 물리면 상점 메커니즘(클러스터-태그 오퍼/리롤강화/배니시)을 후속 작업으로.
2. **미러 드리프트**: settle 7종 + per-card 3종 모두 2파일 동기화. balance-check/strategy-sim/hand-frequency 구13부적 → run-sim 단독 권위.
3. **loaded fiveKind=0.30 검증 불가**(run-sim random copy) → HANDOVER/CLAUDE 드리프트 노트 + unlock 게이트 + 경제 추론 수동 가드.
4. **climax/evenodd 임계 인플레**(bridge/keystone 0.05/cap4 교훈): 채택값(climax fullHouse+/L-5/+9%, evenodd d-5/+12%)은 심사 하향분 — **머지 전 run-sim 스윕으로 balance 9.4% 불변 재확인 필수**.
5. **prism 단독 함정픽** → gem 클러스터(jewelbox+lapidary) 동시 출시 전제. 클러스터 합산 클리어율로만 최종 수락.
6. **UNLOCKS 누락 시 영구잠김**(HARD ④): 10종 전부 index UNLOCKS + unlock-check.cjs 실배선. ★전 부적 `checkUnlocks(st,row)` 시그니처(row만)로 판정 가능 → 시그니처 변경 불필요. 단 loaded/climax cond는 `evalHand`/`connect`(+climax는 8칸)를 unlock-check.cjs에서도 호출 가능해야 함.

---

## 6. 검증 계획 (수락 게이트)

1. **문법**: `node tools/balance-check.cjs` (인라인 script `new Function()` 파싱). + stake0 단일라운드 기준선 불변(neither 신규부적 미보유 시 무영향).
2. **밸런스 (권위)**: `node tools/run-sim.cjs`
   - **St0 balance 클리어 9.4% 불변 가드**(±0.5pp) — 신규 10종 풀 투입 후에도 비특화 인플레 없음.
   - **각 신규 전용 strat(gem/apex/cartel/parity) 비지배** = 3~9% 밴드(밸런스 9.4% 미만 또는 동률, spatial 3.4% 밴드 이상이되 단독 지배 아님).
   - paritybet 머지 게이트: 지배 시 .25 폴백 / flush co-stack 지배 시 hk 가드.
3. **해금**: `node tools/unlock-check.cjs` — 13→**23/0** (전 신규 cond 도달 가능 + 미도달 0 확인).
4. **경제 불변**: `node tools/economy-check.cjs` — 골드 공식 무관(부적은 라운드 점수층) 확인.
5. **UI 스모크**: Playwright 실Chromium — 부팅·상점에 신규 부적/cost 표시·정산 보너스 합산·컬렉션 드로어 잠금/해금·콘솔에러0.

---

## 7. 부수 정정 — bridge 설명문 드리프트

부적 정의 블록을 편집하는 김에 함께 정정(코드값이 정답, 설명문이 stale):
- **`bridge`** (index L319): `"+5% (최대 4장)"` → `"+3% (최대 3장)"` (실제 코드 L480 = `.03*min(n,3)`, HANDOVER §6 캘리브 0.03/cap3와 일치).
- (참고·범위 외) `keystone` desc "양 끝과 한가운데"는 실제 0·3·7칸·평균초과식과 부정확하나 **수치 오류 아님** → 이번 범위 제외(별도 승인 시).

---

## 8. 구현 범위 / 비범위

**범위(IN)**:
- `prototype/index.html`: CHARMS 10종 정의(+cost 필드) · placeCard 3 훅 · settle 7 훅 · UNLOCKS 10 · shopPool cost 분기 · (컬렉션 드로어는 기존 `UNLOCKS`/`shopPool` 필터가 자동 처리) · bridge desc 정정.
- `tools/run-sim.cjs`: gain 3 훅 · handBonus 7 훅 · CHARMS 배열 10 · costOf charm cost · STRATS 4 프로필.
- `tools/unlock-check.cjs`: UNLOCKS 10 미러(필요 시 evalHand/connect/maxRankCount 헬퍼).
- 문서: HANDOVER §6/§7 · CLAUDE.md 드리프트 섹션(부적 13→23, run-sim 13→23 동기화 표기) · docs/PLAN.md 항목.

**비범위(OUT)**:
- 상점 희석 메커니즘(후속).
- 색채 settle 페이오프(인지된 갭, 별도 검토).
- balance-check/strategy-sim/hand-frequency 신규 부적 동기화(구13부적 기준 유지).
- keystone/stair 설명문 정밀화(수치 오류 아님).
- 보스 추가(SSoT ⚠️ 금지).
