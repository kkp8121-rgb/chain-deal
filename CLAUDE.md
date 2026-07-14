# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

**CHAIN DEAL** — 트럼프 카드를 한 줄로 깔아 이웃과 연결되면 체인이 폭발하는 로그라이크 덱빌더 (발라트로식 메타 + 오리지널 "체인 연결" 코어). 게임 소스 = **`src/` 모듈/데이터주도** (vanilla JS, 외부 **런타임** 라이브러리 0). `build.mjs`(esbuild = 유일 devDep, 빌드타임 전용)가 raw-concat으로 **단일 배포 파일 `prototype/index.html`** 생성(무런타임 의존 유지). ★**2026-07-02 Phase 0 리팩터로 "단일 index.html"→모듈 전환 완료** — 이제 `prototype/index.html`은 **빌드 산출물**(소스 아님). 미러 드리프트 영구 제거(규칙 정의 각 src/ 1곳).

## ⚠️ 작업 시작 전 필수

- **`HANDOVER.md` 를 먼저 읽으세요.** 설계 결정의 "왜"(암묵지), 정확한 점수 공식, 파라미터, 그리고 *버려진 시도와 그 이유* 가 전부 들어 있습니다. 코드만 봐서는 알 수 없는 컨텍스트의 SSoT입니다. (`docs/PLAN.md` = 작업 체크리스트, 버전·항목 ID 추적.)
- `docs/CHAINDEAL_GDD.md` 는 초기 자동생성 기획서로 **현재 구현과 일부 다릅니다.** 현재 상태의 정답 = HANDOVER + 실제 `src/` 코드. 상업 출시 설계 SSoT = `docs/superpowers/specs/2026-07-02-chaindeal-master-spec.md` + `docs/production-roadmap.md`.

## 명령어

`package.json`(esbuild devDep) + `build.mjs` 있음. 린트/테스트 **프레임워크는 없고** 검증은 순수 node 시뮬(`.cjs`)로 한다.

- **★빌드**: `node build.mjs` — `src/`(main.cjs + content/ + rules/ + locale)를 raw-concat + 로케일 주입해 `prototype/index.html` 생성. **규칙/부적/보스/덱/문자열을 바꾸면 항상 재빌드.** (`src/` require 줄에 후행주석 금지·같은 모듈 두 곳 require 금지 = raw-concat 제약.)
- **플레이/테스트**: `src/` 편집 → `node build.mjs` → `prototype/index.html`(빌드 산출물) 브라우저에서 연다. ★**`prototype/index.html` 직접 편집 금지**(빌드가 덮어씀).
- **밸런스 + 문법 검증**: `node tools/balance-check.cjs` — (1) 빌드된 인라인 `<script>` 를 `new Function()` 으로 파싱해 **문법 게이트** + (2) 그리디 시뮬로 블라인드별 클리어율(rules는 src/ require). **점수/연결/족보 규칙을 바꾸면 재빌드 후 재실행.**
- **전체 런 시뮬** (안테 1~8 + 상점 덱빌딩 누적, 빌드 전략 5종 비교, **골드 경제 포함**): `node tools/run-sim.cjs` — 끝에 **조건부 클리어율**(도달자 중 통과%, per 블라인드·per 보스) + **난이도 사다리 스테이크별 클리어율 스윕**(St0~5, `runFull(strat,acc,stake)`)도 출력. ★사망'비중'은 생존자 편향(모두 안테1 지남)이라 초반에 쏠려 *오도* → 진짜 난이도 곡선·보스 벽은 **조건부 통과율**로 본다(평탄 85~97%=건강, 유일 벽=안테8 닻 ~69%). 스테이크 캘리브는 스윕으로(St0=기준선 8.9~9.3 불변 가드 → St5 ~0.6 단조).
- **골드 경제 단위 검증** (환전 공식·스필오버·재도전 카드 불변식): `node tools/economy-check.cjs`
- **★C1 회귀 게이트** (전 검증기 run-sim·economy·funqa를 G0~G7 8밴드로 묶어 v3.29 ledger(`tools/gate-baseline.json`) 대비 **드리프트만** 검출 — "무변경 코드=항상 GREEN"): `node tools/gate.cjs [--fast(N=2000,~37s)|--full(N=20000)|--snapshot]`. ★**pre-commit 훅 배선됨**(`.githooks/pre-commit` + `core.hooksPath`, 의존성0 — 밸런스/규칙/빌드 파일 스테이징 시 `--fast` 자동 실행, 문서 커밋은 스킵). 의도된 콘텐츠/밸런스 변경이면 `npm run gate:snapshot`으로 ledger 갱신 후 커밋(안 그러면 RED). 편의: `npm run gate`/`gate:full`. 신규 클론은 `npm install`의 `prepare`가 훅 경로 자동설정. 밴드 SSoT = `docs/production-roadmap.md` §3 + master-spec §7·§10.
- **족보 밸런싱** (노리는 봇 vs 그리디 클리어율 비교): `node tools/strategy-sim.cjs`
- **8장 줄 족보 빈도 측정**: `node tools/hand-frequency.cjs`
- **재미 QA** (5종 페르소나 봇이 자동플레이 → 재미 5축(주체성·긴장·도파민·다양성·흐름) 측정 → 대중재미 분포 판정): `node tools/funqa/run-funqa.cjs [N]` · 테스트(골든+드리프트 가드): `node tools/funqa/funqa.test.cjs`. **규칙은 `run-sim.cjs`(이제 src/ 어댑터)를 require**. 난이도 시뮬과 직교(재미 측정 전용). 설계 `docs/superpowers/specs/2026-06-30-fun-qa-design.md`, 계획 `docs/superpowers/plans/2026-06-30-fun-qa-phase1.md`. ★재QA SSoT = `tools/funqa/measurement-summary-2026-07-01.md`(5축·3뱅크 최저뱅크 판정·반증 레버 금지목록).

## 코드 아키텍처

### 모듈 구조 (`src/`, Phase 0 이후)

- **`src/main.cjs`** — 게임 오케스트레이션(전역 `S` 상태·루프·render·juice·상점·render 프리뷰). content/rules를 require.
- **`src/content/`** — 순수 데이터: `charms.cjs`(부적 24종, ★각 부적이 `hooks` 필드로 효과 선언) · `bosses.cjs`(12종) · `decks.cjs`(2종 + 생성기) · `hands.cjs`(`HAND_BONUS`) · `tuning.cjs`(상수) · `locale/`(ko/en + `t()` 로더).
- **`src/rules/`** — 순수 함수(전역 미접근): `connect.cjs`(connect(a,b,boss)·climbSealed) · `hands.cjs`(evalHand·hasRun5) · `blinds.cjs`(blindBase·sparkComp) · `economy.cjs`(spillover) · `scoring.cjs`(★훅 엔진 `scoreCard`/`scoreSettle` — 부적 hooks + boss/enh/cap 일괄 적용).
- **`src/art/`** (M1, 2026-07-14) — 절차적 픽셀 아트(브라우저 전용, 표시층 — 밸런스 무관·tools 미소비): `palette.cjs`(ART_PAL 16색) · `pixel.cjs`(그리드/페인트 분리 프리미티브) · `sprites.cjs`(핍·글리프·배지 비트맵) · `cards.cjs`(artDrawCardFace 25×36+faceCache+artHydrate) · `charmart.cjs`(엠블럼 22종, (shape,accent) 유니크) · `sheet.cjs`(컨택트시트+CVD) · `art.cjs`(파사드). ★**star 토폴로지**: leaf 간 require 금지, art.cjs만 의존 순서 require(build.mjs가 중복 require throw). 부적 아트 = charms.cjs `art:{shape,symbol,accent}` 필드(sim 불활성). 검수 표면 = **`?art=sheet`**(컨택트시트+색약 3종 시뮬, 배포 페이지에서도 동작). 설계 `docs/superpowers/specs/2026-07-14-art-m1-procedural-pixel-design.md`.
- **`build.mjs`** — raw-concat + esbuild 파싱게이트 → `prototype/index.html`. **`src/index.template.html`** = 셸(빌드타임 로케일 주입).
- **콘텐츠 추가 = 데이터 1객체**(hooks 포함) — `src/content/`에 추가하면 게임과 sim이 자동 소비(드리프트 0).

- **전역 상태 = `S` 객체 하나** (`ante, blind, deck, discard, row, hand, score, target, boss, owned, bonusHand, rerollMax, seed, daily …`, `src/main.cjs`). `newGame(seed?)` 가 생성하며, 시드 RNG(`mulberry32`)를 `S` 생성 *전* 설정해야 `shuffle`/`pickBoss` 가 데일리 시드를 쓴다.
- **★불변식 (치명적)**: 모든 카드 객체는 4개 더미(`deck`/`discard`/`hand`/`row`)에서 **항상 어딘가에 정확히 1번** 존재해야 한다. 라운드 전환·리롤·정산 시 회수 누락 금지 — 과거 `settle()` 이 손패를 회수 안 해 덱이 고갈되고 fallback이 랜덤 카드를 양산하던 치명적 버그가 있었다 (HANDOVER §3.2).
- **`render()` 가 DOM 전체를 재구성** — 상태 변화 시에만 호출. **절대 호버에서 `render()` 를 부르지 말 것** (호버-재렌더가 클릭 씹힘 버그를 냄). 호버 효과 = CSS 클래스 토글만.
- **연출(juice)** 은 "손맛"의 핵심: 정적 카드 + CSS 트윈/파티클(`sparkBurst`) + 흔들림(`shake`)/플래시(`flash`) + WebAudio 절차 사운드(`beep`/`boom`). 프레임 애니 0장. 건드릴 때 주의.

### 게임 루프 핵심 함수

- `placeCard(hi)` — 카드 깔기 + 체인 점수 계산. 8장 채우면 `settle()`.
- `settle()` — 정산: 체인 점수 + 족보 보너스(가산) → 목표 비교 → 통과(`openShop`)/패배(`newGame`)/승리(`victory`). 카드 회수도 여기서. 표시는 `revealTally()`가 **순차 카운트업**(v3.18, 체인→보너스→최종, 목표돌파 순간 클라이맥스) — ⏩`#fxToggle`/클릭 스킵. ★연출은 **순수 표시**: 점수계산·카드회수는 settle서 끝, `revealTally`는 오버레이 텍스트만 rAF 갱신(`render()` 미호출 → 카드 불변식 무관, **`.cjs` 동기화 불필요**).
- `connect(a,b,boss)` (`src/rules/connect.cjs`, boss=id문자열|null) — 같은 무늬 OR 같은 숫자 OR ±1 연속 (와일드는 무조건). 보스 규칙(`seal_suit`/`mono`/`rust`)이 일부 봉인. main.cjs 호출부는 `bossId()`로 S.boss(객체)→id 변환 후 전달. 오름 ±1 봉인은 `climbSealed`(대칭성 보존 위해 connect 밖 체인 판정에만).
- `evalHand(8장)`(`src/rules/hands.cjs`) / `handBonus()`(main.cjs 얇은 래퍼) — 텍사스 서열 최고 족보 1개 판정 → `HAND_BONUS` 계수 × 안테 기본 목표 = **가산** 보너스. 부적 점수효과는 `src/rules/scoring.cjs` 훅 엔진(`scoreCard`/`scoreSettle`)이 적용.
- `startBlind()`/`advanceBlind()`/`openShop()` — 안테/블라인드/상점 진행. `pickBoss(ante)` — `actOf(ante)` 액트 풀(A1=1-3/A2=4-6/A3=7-8)에서 선택, 액트-final 안테(3·6·8)는 `actBoss` 서브셋.

### 점수 공식 / 파라미터 (정확한 정의는 HANDOVER §4)

카드 = `{suit:0~3(♠♥♦♣), rank:1~8, enh:null|'wild'|'gold'|'mult'}`. 체인 = `런의 rank 합 × mult`, `mult = runLen-1 + 부적 보정`, **mult는 25 캡** (발산 방지). 정산 시 족보 보너스를 **가산**. 주요 밸런스 조정 지점(전부 `src/`): `decks.cjs`(시작 덱 A~8 32장, `starterDeck`/불씨), `blindTarget()`(main.cjs, S.stake/dmult 읽음), `bosses.cjs`(12종, `act`/`actBoss`/`tmult` — 룰은 `connect`/`scoreCard`에 배선), `hands.cjs`(`HAND_BONUS`), `charms.cjs`(부적 24종 — 시작5+B1 5+위치맥락3+시너지10+색1(투톤 v3.27), `hooks`로 효과 선언, 일부 `cost`/`cluster` 필드).

**골드 경제 (v3.16, 메타층)**: 상점은 **유료**(`shopPool` 각 품목 `cost`, 티어 8/5/3). 블라인드 통과 시 `S.gold += goldEarned()` = `floor(GOLD_BASE + (점수/목표−1)*GOLD_K)` (확정 `GOLD_BASE=1, GOLD_K=4` — run-sim 캘리브로 balance 8.8%≈무료 기준선 8.6%). 런 종료 `cashOut()`이 `spillover()`=`floor(남은골드*0.1)`을 `cd_meta.coins`로 반출. `cd_meta = {coins,retry,goldLv,rerollLv}` → `newGame`서 시작 골드(`goldLv*3`)·리롤(`rerollLv`)·재도전권(`retry`) 로드. 메타 상점 = `metaHTML`/`buyMeta`(`META_PRICE`). 재도전권 `useRetry`는 패배 시 덱 전량 회수 후 `startBlind()` 재시작 — ★카드 불변식 사수. ★골드 파라미터(`goldEarned`)는 아직 game(main.cjs)이 `S.stake`를 읽어 순수 아님 → `run-sim.cjs`·`economy-check.cjs`에 **잔여 미러**(stakeMult·blindTarget·goldEarned, 후속 전역→param 전환 시 통합). 변경 시 이 3곳 동기화(잔여).

### 규칙 SSoT — `src/` 단일소스 (드리프트 제거됨, Phase 0 · 2026-07-02)

★게임과 sim이 **같은 `src/` 규칙 모듈을 호출**한다. `tools/run-sim.cjs`는 이제 **어댑터**(src/ require, `gain`=`scoreCard`·`handBonus`=`scoreSettle`), balance-check/strategy-sim/hand-frequency/unlock-check도 src/ require. **grep=1**: connect/scoreCard/CHARMS/BOSSES/evalHand/HAND_BONUS/blindBase 정의 각 src/ 1곳 → **규칙(RULES)을 바꿔도 미러 수동 동기화 불필요**(src/ 편집 → `node build.mjs` → 게임·sim 자동 반영). ★단 **난이도·골드·덱·상점 파라미터는 아직 잔여 미러**(run-sim 손-복제) — 아래 두 목록(단일소스 vs 잔여 미러) 참조.

**★단일소스 (드리프트 없음) = grep=1 RULES**: connect/climbSealed · scoreCard/scoreSettle(부적 hooks + boss/enh/cap) · evalHand/hasRun5 · HAND_BONUS · blindBase · sparkComp · BOSSES · CHARMS. src/ 편집하면 game·tools 자동 반영(run-sim 등이 require).

**★잔여 미러 (Step 4가 아직 통합 안 함 — 변경 시 동기화 필수)**: 두 부류.
- **(a) 순수함수인데 미통합** (→ follow-up서 src/ require로 통합 가능): **덱 빌더**(`starterDeck`/`highDeck`, 스파크 와일드 k<4·구성 — run-sim·balance-check·hand-frequency·funqa/runner·strategy-sim 등 **여러 툴이 `src/content/decks.cjs`를 손-복제**) · **위치-맥락 헬퍼**(`bridgeCount`/`maxAscLen`/`edgeVal` — run-sim이 `*Sim`으로 재구현, bridge/stair/keystone 훅이 ctx로 소비).
- **(b) game이 `S`를 읽어 아직 순수 아님** (sim 재구현): 난이도(`stakeMult`/`blindTarget`/`STK_T`/`STK_AC`) · 골드(`goldEarned`/`GOLD_BASE`/`GOLD_K`) · 덱 스칼라(`DMULT`) · 상점(`CLUSTER`/`CLUSTER_W`/`CHARM_COST`). + `REROLL_BASE`는 `src/content/tuning.cjs`↔`economy-check.cjs` 미러(run-sim엔 없음 — reroll no-op).
- ★**per-symbol 권위 = `tools/run-sim.cjs`의 "미러"·"잔여 미러"·"통합 예정" 주석(8곳)**. 밸런스 상수·덱을 바꿀 땐 그 심볼을 저장소 전체 grep해 미러 위치를 **전부** 확인 후 동기화(이 목록은 개괄 — 열거 누락 위험이 있어 grep이 SSoT).

⚠️ **아래 v3.24~29 = 밸런스 설계 *이력*(값·계수·반증레버 = 유효).** 그 안의 "N파일 미러/3곳 동시수정" 표현 중 **위 RULES 관련은 이제 무의미**(단일소스), **잔여-미러 파라미터 관련만 유효**. 상세 = HANDOVER §6 + `.claude` 메모리 `balance-calibration`·`phase0-complete-architecture`.

- **현재 드리프트 상태**: `run-sim.cjs` 만 부적 **24종**(+시너지 10종 v3.24: 보석세공 lapidary/prism/jewelbox·정점 highmult/magnate·카르텔 echo/loaded/climax·패리티 evenodd/paritybet — placeCard 3훅·settle 7훅 미러, `handBonus`에 boss 인자) + `fiveKind` 족보 + **골드 경제** + **난이도 사다리(STK)** + **부적 cost 차등**(`CHARM_COST` 맵·전략루프 `Object.keys(STRATS)`)까지 동기화됨. ★**정정(Phase 0 후)**: `unlock-check`·`balance-check`·`strategy-sim`·`hand-frequency`는 이제 connect/evalHand를 `src/rules`에서 **require**(복사 아님) → 연결·족보(`fiveKind` 포함) 단일소스 자동일치. 이들이 모델 안 하는 것은 **부적 hooks뿐** → 신규 *부적 밸런스* 검증만 `run-sim.cjs` 권위(족보/연결 검증은 이제 이 툴들도 유효). ★**v3.24 희석 → v3.25 완화**: 23종이 sim balance를 9.6→3.5%로 희석(인플레 아님). **v3.25 상점 희석 완화**로 대응 — ①리롤(`rerollShop`·`REROLL_BASE` 에스컬레이팅, *주체성 도구*, ★sim 희석 fix 아님: 스태킹 경제선 선택성=손해라 sim 미모델) ②**가중 오퍼**(`weightedSample`·`CLUSTER` 맵·`CLUSTER_W`=0.15, 미투자 클러스터 부적 감량=실제 fix, balance 7.6% 회복). 동기화 지점: `REROLL_BASE`·`CLUSTER_W`·`CLUSTER`(=index CHARMS `cluster` 필드) **index↔run-sim 미러**(값 일치), `weightedSample`(index `rng()` / run-sim Math.random), economy-check 에스컬레이팅 불변식. ★`applyShop` buy-everything 사수(discerning 실험 붕괴). 상세 HANDOVER §6 v3.25. ★**v3.27 색 settle 투톤**(24종째): settle 가산 식 `index.html`↔`run-sim.cjs` **2파일 미러**(connect 무건드림), **cluster 무태그**(베이스 풀·`CLUSTER` 맵 무변경), run-sim `color` strat 추가. 희석 7.6→6.5%(수용·인플레 아님). 상세 §6 v3.27.
- **보스 12종/액트** (★이제 단일소스): `BOSSES`(act/actBoss/tmult) = `src/content/bosses.cjs` 1곳, 룰은 `connect`/`scoreCard`. tmult 바꿔도 tools 자동 반영(3곳 동시수정 불필요 — 옛 프레이밍). 단 `balance-check`는 맨덱 단일라운드라 **부식(rust, enh 의존)·스케일 민감 보스(anchor)는 과대평가** → 실제 풀런 밸런스는 `run-sim.cjs`. ★**v3.26 내리막(seal_climb)**: seal_run 교체(12종 유지·보스 추가 금지). 오름 ±1 봉인 룰은 **connect 대칭성 보존** 위해 connect서 빼고 `placeCard`/`gain` 체인 판정에만 `climbSealed`(=`climbSealedSim`/`climbSealedBC`) 적용 — 3파일 미러(bridge 인접 판정 무영향=의도). tmult 0.72(balance 기준선 불변 캘리브).
- **골드 경제 동기화 지점**: `goldEarned`/가격은 `index.html` ↔ `run-sim.cjs` ↔ `economy-check.cjs` 3곳에 중복. 단 `balance-check.cjs`는 **단일 라운드(맨 덱)** 만 보므로 라운드-사이 경제인 골드와 **무관** — 골드 모델 이식 불필요(문법 체크 + 단일라운드 기준선 가드 역할만).
- **난이도 사다리(Stakes, v3.22) 동기화 지점**: `S.stake`(0~`MAX_STAKE`=5)를 읽는 티어 델타 = `stakeMult`(`STAKE_T`/`STAKE_AC` 배열)·`goldEarned`(바닥)·`startBlind`(boss/baseHand)·tmult 가드. **`index.html` ↔ `run-sim.cjs`(STK) 미러**(STAKE_T===STK_T 등 값 일치 — 드리프트 가드). `balance-check.cjs`는 stake0만 보므로 **미러 불필요**(stake0=no-op 기준선 가드). ★`handBonus`/broker/twins는 `blindBase(ante)`(스테이크 무관) 사용 — 목표만 사다리로 오르고 족보 보너스는 불변(상쇄 버그 차단). 캘리브는 run-sim 스윕(8.9→0.6 단조, 최상위 >0). 캡·보스룰-큰블라인드 레버는 제외/보류(코드 `STK>=6`는 비활성). 설계 `docs/superpowers/specs/2026-06-25-difficulty-ladder-design.md`.
- **시작덱 변형(v3.28) 동기화 지점**: `highDeck`(composition `[3,4,5,6,7,7,8,8]×4=32`)·`DECKS` `dmult`·`blindTarget` deckMult 팩터 = `index.html`(`S.dmult`) ↔ `run-sim.cjs`(`DMULT`) **미러**(값·식 일치). `balance-check.cjs`는 표준 덱(dmult=1)만 보므로 **미러 불필요**(no-op 가드). ★`dmult`는 `blindTarget`에만(보너스는 `blindBase` 불변=상쇄버그 차단). `S.variant`(id)≠`S.deck`(카드더미). 선택 UI·`cd_meta.deck`는 index 전용. 캘리브 dmult 1.55(고랭크 ≈ 표준 밴드, 파워크리프 차단). 설계 `docs/superpowers/specs/2026-06-30-start-deck-variants-design.md`.
- **불씨덱(spark, v3.29) 동기화 지점**: 재미QA 대중재미 FAIL(60%)의 캐주얼 블로커(도파민/spike density 부족) 수정. **기본 덱(standard/`fullDeck`·`starterDeck`)의 최저랭크 4장을 `enh:'wild'`로** 마킹(랭크·무늬·덱크기 32 불변, 연결밀도만↑ → runLen≥4 spike 조기·다발 = 캐주얼 도파민 w=.35). 결과: 캐주얼 fun 5.56→6.49, 대중재미 60→**80% PASS**(3뱅크 재QA). ★**보정 = `sparkComp`(front-loaded, blindTarget 전용)**: `1.0+0.34*(8-ante)/7`(a1=1.34→a8=1.00) — **blindBase(150) 불변**(charm 리밸런스 없음, sparkComp는 `blindTarget`에만 곱). ★**왜 front-loaded(균일 아님)**: spark가 초반을 매우 쉽게(안테1 98%) 만들어 난이도가 후반 쏠림 → 균일 보정은 thin-headroom 최상단(안테8)을 과세해 flatness 붕괴(안테8 63%🟡) → front-loaded가 초반 과세·후반 무과세로 flatness 보존(전 안테 🟢). ★**high dmult 1.55→1.29 재캘리브**(sparkComp 흡수분 — 표준 8.5%≈high 7.9%). 위치: `sparkComp`(계수 0.34)는 **단일소스**(`src/rules/blinds.cjs`, run-sim require) · `starterDeck`/`highDeck`(k<4 wild·high dmult 1.29)는 `src/content/decks.cjs`가 소스이나 **여러 툴이 손-복제(잔여 미러 (a) — grep 동기화)**. `blindBase`는 150으로 **불변**(charm 미러 불필요). 검증: `verify-3bank.cjs`(신규 3뱅크 재QA)·`run-funqa`·`run-sim`(St0 8.5%·조건부클리어 전🟢·economy PASS·덱스윕)·balance-check 문법. ★**수용 비용**: safe 페르소나 -0.35(≥6 유지 — 와일드=분산축소로 near-miss↓ tension↓, 보정방식 무관 내재)·St0 6.6→8.5%(P3 "St0~9%" 의도적 달성). 스릴러 5.98(영구 임계미달 = 봇 아티팩트, 게이트와 무관 — 콤보 0%처럼; ★**2026-07-06 인과격리로 확정** — tension은 유능플레이와 구조적 역상관(최적봇 마스터리도 0.19/blowout 80%)·tense+승리 사분면 empty. memory `thriller-artifact-verdict`). ★**반증 레버(재도입 금지)**: 긴체인 점수보너스(opt1)·순수 초반완화(relief)·균일 blindBase 보정(flatness 붕괴)·**마진압축(스릴러 tension — metric-hack이자 goldEarned=f(margin) 경제 붕괴, 2026-07-06 기각)**. QA SSoT `tools/funqa/measurement-summary-2026-07-01.md`, 캘리브 하네스 `tools/funqa/p2-sparkdeck.cjs`.

## 밸런스 설계 원칙 (변경 시 지켜야 함)

- **가산 > 곱셈**: 족보·부적 보너스는 곱이 아니라 **가산**. 체인이 이미 ×배수 엔진이라 또 곱하면 분산이 폭발해 "아슬아슬(빠듯한 마진)" 재미가 파괴된다 (HANDOVER §3.2). 신규 부적도 전부 가산·바운드로.
- **빈도보정 족보**: 8장 강제 구조라 포커 빈도가 역전된다(풀하우스 > 플러시). 라벨은 텍사스 서열(익숙) / 값은 빈도 — 흔한 족보=소액, 희소 족보=큰 가산.
- **보스 = 숫자 벽이 아니라 *규칙* 으로** 어렵게 → 플레이어가 덱을 조정(적응)하게. **액트 티어 풀**로 등장(A1 순함 → A3 가혹), 액트-final 안테(3·6·8)는 고정 **액트 보스**(climax). 액트 보스가 고정이라 "운 좋은 순한 최종보스" 변수가 없어 후반이 일관되게 빡빡 — tmult로 보정.
- **목표 클리어율**(그리디 시뮬 기준): 작은 ~90% / 큰 ~80% / 보스 55~72%. 잘하면 깨고 운으로 가끔 억까당하는 발라트로 감각.
- **단순성·압축 유지**: 시작 덱 A~8(32장) 압축 구조 유지. 무작정 카드 추가는 덱 비대화로 연결률을 떨어뜨린다 — 추가는 *의도적 빌드* 일 때만.

## 배포 (선택)

- **GitHub Pages**: `main` 에 push = 자동 배포(1~2분 반영). Pages는 **커밋된 `prototype/index.html`(빌드 산출물)을 그대로 서빙**(CI 빌드 없음) → ★`src/` 변경 후 반드시 `node build.mjs` 하고 **빌드된 `prototype/index.html`도 함께 커밋**. 루트 `index.html` 이 `prototype/index.html` 로 리다이렉트한다. 리포는 **public** — 시크릿·민감정보 커밋 금지.
- **`git push` 가 hang하면**: credential 프롬프트 대기 문제. gh 토큰을 인라인 helper로 우회 — `git -c credential.helper= -c credential.helper='!f(){ echo username=x-access-token; echo "password=$(gh auth token)"; }; f' push origin main` (HANDOVER §2). ★**403(권한 거부) 시**: gh에 다중 계정이 등록돼 활성 계정이 이 레포 소유자(`kkp8121-rgb`)가 아닌 경우 — `$(gh auth token)`을 `$(gh auth token --user kkp8121-rgb)`로 바꿔 계정을 명시(전역 활성 계정 전환 불필요, 2026-07-14 실측).
- **백엔드(익명 플레이로그·리더보드, 선택)**: 게임 → Cloudflare Worker(Origin 검증으로 비밀 은닉) → Apps Script → Google Sheet. `src/main.cjs` 의 `LOG_URL`; 읽기는 CORS 우회 위해 JSONP. 스크립트는 `tools/cloudflare-worker.js` · `tools/playlog-appsscript.gs`. Apps Script 재배포는 **"배포 관리 → 편집"** 으로 해야 URL이 유지된다.
