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

### 기각된 두 레버 (실측)

1. **계수 버프 (REJECTED)** — 앵커부적 계수 상향은 시드고정 페어드측정서 **함정빌드(+0.25~0.64pp)보다 healthy 빌드를 더 키움**(balance +1.41·black +2.07), 절대격차 확대(6.98→7.77pp). 병인 = `run-sim` **buy-everything filler-buy**(memory `balance-calibration` §6): 부적 트리거(징검다리·오름·자리값·enh수·홀짝치우침)가 *어떤 강한 줄에서도 우발 발생* → 모든 빌드가 주워 이득. threshold-게이팅도 못 막음(강한 줄은 게이트 넘김).
2. **build-exclusive settle-시너지 (REJECTED for settle)** — evenodd를 paritybet 동시보유(=전념 parity) 시 증폭하도록 게이팅해 run별재시드 페어드측정 → **parity +0.14pp만**(여전히 최하위). settle 보너스 적재는 무스케일.

### C2 대원칙 (확정)

> **함정 클러스터 fix는 mult 엔진에 기여(체인-시너지)해야 한다. settle 보너스 적재는 leak + 무스케일이다.**

체인이 `Σrank × mult`(mult 25캡) 엔진인데, 함정빌드들은 mult를 안 쓰고 정산 가산 gimmick에 의존한다 → 근본적으로 비효율. 신규 부적은 **연결 밀도·mult·runLen을 키우는 방향**이어야 한다(가산>곱셈 헌법은 유지 — mult 가산은 허용, 신규 곱셈 금지).

---

## 1. Per-cluster 판정 (버프-또는-컷)

| 클러스터 | v3.29 | 판정 | 근거 · 방향 |
|---|---|---|---|
| **parity** | 1.47% | ⛔ **CUT** (또는 전제 재설계) | one-parity 줄(전부 짝/홀)은 랭크 ±2씩 → **±1 연결(3연결타입 중 1개)을 자진 포기**하고 약한 settle과 맞바꿈 = self-sabotage. 3갈래 증거: (a) settle-버프 leak, (b) build-exclusive 시너지 +0.14pp만, (c) mult-복원은 **헌법상 막힘**(신규 곱셈 금지 + mult-훅은 연결에서만 발동하는데 parity는 연결이 없음). → 2종(evenodd/paritybet) 제거, 클러스터 슬롯을 다른 축에 재배분. ★human 확인 대상(cut 결정). |
| **spatial** | 1.85% | ⚠️ **측정 불가 (sim 아티팩트)** | bridge/stair/keystone는 **의도적 카드 배치**를 보상하는데 그리디 봇은 즉시-점수-최대만 함 → 배치 못 모델(memory §5). 저 1.85%는 *실제 실력 천장이 아니라 봇 한계*일 수 있음. → **committed-placement pick 정책**(spatial 빌드용 배치 휴리스틱)을 `run-sim`에 추가해 실제 천장을 재측정한 뒤에야 buff/cut 판정 가능. 그 전엔 확장 보류. |
| **gem** | 2.00% | 🔧 **체인-시너지 신규부적** | enh(wild=만능연결·gold=base·mult=mult)는 체인과 안 싸움. 약한 건 gem 부적(lapidary/prism/jewelbox)이 골드-비싼 enh 스태킹에 작은 settle만 줌. → 신규는 **enh를 mult/연결로 전환**(예 "와일드 카드로 연결 시 mult +1", "줄의 enh 3+장이면 runLen 판정에 보너스"). settle 적재 금지. |
| **compact** | 2.66% | 🔧 **체인-시너지 신규부적** | 덱 압축은 연결 일관성을 높이나 compactor 페이오프(base 가산)가 약함. → 신규는 **압축을 mult/연결로**(예 "덱 24장 이하면 runLen −1 보정 완화", "압축분만큼 mult 가산"). |
| healthy 8종 | 5.7~8.5% | ✅ **밀도 확장** | flush/black/color/apex/cartel/jokbo/(compact/spatial 후속) — build-exclusive 시너지("클러스터 부적 N+개 보유 시 발동")로 깊이 추가. leak 없이 전념자만 보상. |

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
| **확장 우선순위** | gem→compact→healthy 밀도→spatial(sim모델 후) | parity는 cut, spatial은 측정선행 |

---

## 4. 구현 순서 (제안)

1. **spatial sim-모델** — `run-sim`에 committed-placement pick 추가 → spatial 실제 천장 재측정 → buff/cut 판정 (측정 인프라, 콘텐츠 0). **verify**: spatial 클리어율이 그리디 1.85%보다 유의하게 높으면 아티팩트 확정.
2. **엔진 플러밍** — `ctx.clusterCount(cl)` (gem 첫 체인-시너지 부적과 함께). **verify**: 게임·sim ctx 일치, 게이트 G0/G1 GREEN.
3. **gem/compact 체인-시너지 신규부적** — 각 클러스터에 mult/연결 기여 부적 추가. **verify**: 시드 페어드측정서 해당 빌드↑ + 타빌드 flat(leak 없음) + 게이트 9/9.
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
