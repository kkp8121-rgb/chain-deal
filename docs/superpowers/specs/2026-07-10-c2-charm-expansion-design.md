# CHAIN DEAL — C2 부적 확장 (24→50) 설계

> 작성: 2026-07-10 · 상태: **설계(구현 전)** · 대상: 상업화 로드맵 C2 (부적 24→50, 클러스터 밀도 채움)
> 상위 SSoT: `docs/production-roadmap.md` §3(C2 행) + `docs/superpowers/specs/2026-07-02-chaindeal-master-spec.md` §2.
> ★본 스펙은 **C2 pre-step 약빌드 트라이애그(2026-07-10, 2실험 시드측정 확정)**의 산출물이다. 실험 근거·수치 = memory `balance-calibration` §8 + `docs/PLAN.md` C2 노트.
> ★모든 계수는 **sim 캘리브 대상** — 본 스펙은 설계 의도 + 검증 프로토콜을 고정한다.

---

## 0. 왜 이 스펙이 필요한가 (트라이애그 결과)

로드맵/master-spec §65는 C2 선행으로 **"약빌드 v3.29 재측정 → 버프-또는-컷"**을 지정했다. 수행 결과, **순진한 확장은 위험**하다는 것이 실측으로 드러났다:

**v3.29 함정빌드 4종** (시드42·N=20000, ledger 재현 검증):

| 함정 | 클리어 | | healthy 참조 |
|---|---|---|---|
| parity 1.47% · spatial 1.85% · gem 2.00% · compact 2.66% | 🔴 | | balance 8.45 · black 7.81 · color 6.96 · apex 6.86 · flush 5.74% |

pre-v3.29 함정 3종(parity/spatial/gem)보다 **악화 + compact 신규 합류** — 불씨덱(v3.29 와일드 4장)이 비-와일드 속성 의존 빌드를 눌러 로드맵 경고가 확증됐다.

### 기각된 네 레버 (실측 — 4실험 시드측정)

1. **계수 버프 (REJECTED)** — 앵커부적 계수 상향은 시드고정 페어드측정서 **함정빌드(+0.25~0.64pp)보다 healthy 빌드를 더 키움**(balance +1.41·black +2.07), 절대격차 확대(6.98→7.77pp). 병인 = `run-sim` **buy-everything filler-buy**(memory `balance-calibration` §6): 부적 트리거가 *어떤 강한 줄에서도 우발 발생* → 모든 빌드가 주워 이득. threshold-게이팅도 못 막음.
2. **build-exclusive settle-시너지 (REJECTED)** — evenodd를 paritybet 동시보유 시 증폭 게이팅 → run별재시드 페어드 **parity +0.14pp만**(최하위 유지). settle 적재 무스케일.
3. **committed-placement (spatial, REJECTED)** — 위치가치를 배치 결정에 반영하는 pick → spatial **+0.04pp만**(1.87→1.91%). 위치 settle(max ~.43×blindBase)이 너무 작아 배치로 못 살림 = sim 아티팩트 아님.
4. **chain-synergy mult, 약게이트 (REJECTED)** — jewelbox에 "committed gem(lapidary 동시보유) 시 enh 연결마다 mult+1" → gem **+0.12pp만 + 전 빌드 균등 leak**(apex +0.16이 타겟보다 큼). co-own-2 게이트를 filler가 뚫음.
5. **chain-synergy mult, HARD 게이트 (REJECTED — ★sim 구조 한계 확정)** — `ctx.clusterCount('gem')≥3`(gem 3종 전부 보유=전념) + enh 연결마다 mult+2 → gem **+0.21pp만, 그런데도 leak**(black +0.19·apex +0.19 ≈ 타겟). 병인: 가중오퍼가 **첫 클러스터 부적만** down-weight → 하나 사면 나머지 full-weight → **buy-everything이 8안테에 걸쳐 clusterCount≥3을 전 빌드에 누적**. **어떤 소유-기반 게이트도 leak 불가피**.

### ★실험이 확정한 것 (메타 — 5실험, C2 전제 변경)

> **1) 함정빌드는 부적 튜닝 레벨서 해결 불가** — 5종 개입(계수·settle시너지·배치·mult시너지 약/hard게이트) 전부 marginal(+0.04~0.21pp). 약점은 전략 비효율.
> **2) ★이 sim(run-sim/gate)은 build-specific 콘텐츠를 구조적으로 평가 불가** — buy-everything(memory §6, 유지 필수)이 모든 클러스터 부적을 모든 빌드에 누적시켜 **어떤 소유-기반 hard 게이트도 leak**한다. ★**실험6·7(healthy 밀도 추가로 재확증)**: apex에 신규부적 추가 시도 → 범용(7/8 mult+1)=전빌드 인플레(apex=balance 동반), 특화(8-8 mult+2)=apex 미도움(그리디가 8 인접배치 안함). **범용=인플레 / 특화=미발동** → 클린한 build-specific 추가 자체가 불가. 즉 C2가 추가하려는 바로 그 콘텐츠(전념빌드 보상)를 sim이 못 잰다. **로드맵 원칙 그대로: sim=floor 감지기(인플레·지배 차단), 인간=ceiling 판정자.** 효과는 **인간 플레이테스트로만 검증**(memory §5).

### C2 대원칙 (확정 — 개정)

> **1) parity는 CUT** (구조적 안티시너지 + 5레버 무효, 이견 없음). **2) gem/compact/spatial = spice 수용이 기본값** — sim상 지배 안 함(=다양성엔 무해), 살리려면 **인간 플레이테스트 기반 설계 베팅**(sim은 leak/floor만 확인, 효과는 못 잼). **3) charm-adding≠빌드 살아남** — "밀도 채움"으로 약빌드를 top-tier로 만들 수 있다는 보장 없음. 무리한 확장 대신 **healthy 8클러스터 밀도 + 신규 강클러스터**에 C2 예산 집중.

체인이 `Σrank × mult`(25캡) 엔진인데 함정빌드는 mult 안 쓰고 가산 gimmick 의존 → 비효율. 헌법 유지(가산>곱셈, mult 가산 허용, 신규 곱셈 금지).

---

## 1. Per-cluster 판정 (버프-또는-컷)

| 클러스터 | v3.29 | 판정 | 근거 · 방향 |
|---|---|---|---|
| **parity** | 1.47% | ✅ **CUT 실행됨** (커밋 `ca6b26d`, 부적 24→22) | one-parity 줄은 랭크 ±2씩 → **±1 연결을 자진 포기**하고 약한 settle과 맞바꿈=self-sabotage. 3갈래 증거(settle-버프 leak·시너지 +0.14pp·mult-복원 헌법상 막힘). evenodd/paritybet + STRAT/CLUSTER/UNLOCKS 제거. ★**게이트 9/9 GREEN**(구 v3.29 ledger 대비로도 — 약빌드라 balance 8.45%·spread·flatness·재미 무영향). ledger는 보수적 v3.29 앵커 유지(재anchor는 C2 콘텐츠 결정과 함께). 가역적(git revert). |
| **spatial** | 1.85% | 🔧 **측정됨: 배치로 못 살림 → 체인-시너지** | ★**committed-placement pick 실험 완료(2026-07-10)**: 위치가치(bridge/stair/keystone settle 기여)를 배치 결정에 반영 → **+0.04pp만**(1.87→1.91%, paired reseed). **sim 아티팩트 아님 확정** — 위치 settle 보너스(합계 max ~.43×blindBase)가 너무 작아, 체인 최대화 대비 열위(완벽 배치로도 못 이김). memory §5의 "그리디 과소평가"는 실재하나 **미미**(보너스 자체가 작아서). ∴ gem/compact와 **동일 처방**: 위치구조를 **mult/연결로**(settle 아님) 주는 신규부적. (caveat: heuristic이 myopic이라 진짜 천장은 하한 추정 — 단 페이오프-매그니튜드 논거가 결론 지지.) |
| **gem** | 2.00% | 🎲 **spice 수용(기본) / human-playtest bet** | 실험4·5로 chain-synergy(약/hard게이트)도 gem 못살림 + leak(sim 검증불가, §0). enh→mult 전환 설계는 유효 방향이나 **효과는 인간 플레이테스트로만 검증** — sim은 지배 안함(=다양성 무해)만 확인. |
| **compact** | 2.66% | 🎲 **spice 수용(기본) / human-playtest bet** | 동상. 압축→mult 방향 유효하나 sim 검증불가 → 인간 플레이테스트 베팅 or spice 수용. |
| **spatial** | 1.85% | 🎲 **spice 수용(기본) / human-playtest bet** | 실험3(committed-placement +0.04pp)로 아티팩트 아님 확정 + 위치 settle 너무 작음. 위치→mult 방향 유효하나 sim 검증불가. |
| healthy 8종 | 5.7~8.5% | ✅ **밀도 확장 = C2 예산 집중처** | flush/black/color/apex/cartel/jokbo + **신규 강클러스터** — sim으로 인플레/지배만 확인 가능(build-exclusivity는 sim 못잼, §0). 약클러스터 무리한 확장보다 여기+신규 강축에 투자. |

---

## 2. 필요한 엔진 플러밍 (선행)

체인-시너지·build-exclusive 부적은 현재 ctx에 없는 정보를 요구한다:

- **`ctx.clusterCount(cl)`** (settle+placeCard ctx) — 보유 부적 중 cluster===cl 개수. build-exclusive 조건("N+개 보유")의 SSoT. `src/rules/scoring.cjs` ctx 소비, 구성은 `main.cjs`(게임)·`run-sim.cjs`(sim) 양쪽 ctx 빌더에 추가(현재 `has`/`ownedHooks`처럼). ★sim ctx는 `handBonus`(run-sim L89)·`scoreCtxSim`에 주입.
- **mult-조건부 훅 활용** — 이미 `mult:(card,left,ctx)` 훅 존재(연결 시 mult 가산). 체인-시너지 부적은 이 경로 우선 사용(settle 아님).
- **(spatial 전용) committed-placement pick** — `run-sim` `defaultPick`(그리디) 옆에 `spatialPick`(양옆연결·오름 우선 배치) 추가, spatial STRAT가 주입. gem/compact/parity는 그리디로 측정 가능(배치 무관) — spatial만 필요.

⚠️ **YAGNI 준수**: 플러밍은 그것을 쓰는 첫 부적과 **함께** 추가한다(선행 투기 금지). clusterCount는 첫 build-exclusive 부적 구현 시.

---

## 3. Human-owned 결정 (master-spec §8 Q2 — 진행 전 확인 권장)

| 결정 | 추천 기본값 | 영향 |
|---|---|---|
| **parity CUT 여부** | ✅ CUT (3갈래 증거) | cut 시 24→22, 슬롯 2개를 gem/compact/신규축에 재배분 |
| **클러스터 7 vs 8** | 8 (parity 제거 후 신축 1개로 채움 or gem/compact 심화) | 마스터리 다양성 |
| **8덱 각 전략** | master-spec 미정 — C3(덱 2→8)와 공동설계 | 각 덱이 1클러스터를 "가르침" |
| **확장 우선순위** | gem→compact→spatial 체인-시너지 → healthy 밀도 | parity는 cut(3갈래 증거), spatial 측정완료(아티팩트 아님, 재설계 대상) |

---

## 4. 구현 순서 (제안)

1. ~~spatial sim-모델~~ ✅ **완료(2026-07-10)** — committed-placement pick 실험 → **+0.04pp**(sim 아티팩트 아님). spatial을 체인-시너지 재설계 대상으로 확정(gem/compact 합류). 실험 revert(spatial 전용 특수 placer는 sim 일관성 저해).
2. **엔진 플러밍** — `ctx.clusterCount(cl)` (gem 첫 체인-시너지 부적과 함께, YAGNI). **verify**: 게임·sim ctx 일치, 게이트 G0/G1 GREEN.
3. **(선택·human-bet) gem/compact/spatial chain-synergy 신규부적** — ★실험5로 **sim은 이걸 검증 못함 확정**(hard 게이트도 buy-everything leak). 그래서 이 단계는 **기본 SKIP(spice 수용)** — 굳이 살릴 땐 **인간 플레이테스트 베팅**: mult/연결 기여 부적 추가(spatial=위치→mult, gem=enh→연결, compact=압축→mult). **verify**: sim/게이트는 **floor만**(인플레≤+2pp·G2 지배 안함·leak Δ<0.2pp = 다양성 무해) 확인 → **효과(전념자 체감)는 인간 플레이테스트가 판정**(로드맵 "human=ceiling"). floor 위반 없으면 다양성엔 무해하니 재미 판단은 사람.
4. **parity CUT** (human 승인 시) — evenodd/paritybet 제거, locale·unlock·ledger 정리. **verify**: 게이트 재snapshot, 잔여 참조 grep=0.
5. **healthy 밀도 확장 + build-exclusive 시너지** — 24→50까지. **verify**: 각 추가 시 시드측정 + `gate.cjs --full`(G2.5 floor≥7.5%·인플레≤+2pp·G2 다양성·G6 재미).

★**모든 신규부적 = 시드하네스**(`setRNG(mulberry32(42))`+`runFull`, run-sim 언시드라 필수) **또는 gate.cjs로 A/B** — 언시드 `node run-sim` 직접비교 금지(런간 드리프트 ±1.4pp를 효과로 오인).

---

## 5. 검증 프로토콜 (C2 전체)

- **시드 페어드측정** (leak 감지): 신규부적 추가 시 baseline vs 변경본을 run별재시드 페어드로 → 대상빌드만↑, 타빌드 flat 확인.
- **`gate.cjs --full`** (게이트 9/9): G2.5(St0 balance ∈[7.5%, ledger+2pp]) · G2(다양성 스프레드) · G3(부적 EV 드리프트, 의도변경은 `--snapshot` 재앵커) · G4(flatness) · G6/G7(재미 ≥ledger−0.2, 대중재미≥70%).
- **content-ledger**: 마일스톤 종료 시 `npm run gate:snapshot`으로 재앵커(의도된 콘텐츠 변경 ↔ 회귀 구분).
- **jackpot 재검토**: 24종 유일 복리형(chainMul×2, ΔEV +45pp) — 80종 확장 시 균형 재평가(게이트가 C2 리뷰대상으로 표면화).

---

## 크로스링크

- 트라이애그 실험·수치: memory `balance-calibration` §8, `docs/PLAN.md` C2 노트(커밋 `677f6f6`·`e3b5e06`).
- buy-everything/희석 원리: memory `balance-calibration` §6.
- 상위 로드맵: `docs/production-roadmap.md` §3(C2), master-spec §2·§8.
- 후속: C3(덱 2→8)와 덱-클러스터 매핑 공동설계.
