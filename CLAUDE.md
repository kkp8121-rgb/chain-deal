# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

**CHAIN DEAL** — 트럼프 카드를 한 줄로 깔아 이웃과 연결되면 체인이 폭발하는 로그라이크 덱빌더 (발라트로식 메타 + 오리지널 "체인 연결" 코어). **게임 전체가 `prototype/index.html` 단일 파일** 에 HTML+CSS+vanilla JS로 인라인. 외부 라이브러리 0, 번들러 0, 빌드 0.

## ⚠️ 작업 시작 전 필수

- **`HANDOVER.md` 를 먼저 읽으세요.** 설계 결정의 "왜"(암묵지), 정확한 점수 공식, 파라미터, 그리고 *버려진 시도와 그 이유* 가 전부 들어 있습니다. 코드만 봐서는 알 수 없는 컨텍스트의 SSoT입니다. (`docs/PLAN.md` = 작업 체크리스트, 버전·항목 ID 추적.)
- `docs/CHAINDEAL_GDD.md` 는 초기 자동생성 기획서로 **현재 구현과 일부 다릅니다.** 현재 상태의 정답 = HANDOVER + 실제 `index.html` 코드.

## 명령어

빌드/린트/테스트 프레임워크·`package.json` 없음. 검증은 순수 node 시뮬 스크립트(`.cjs`)로 한다.

- **플레이/테스트**: `prototype/index.html` 을 브라우저에서 연다 (설치·빌드 불필요).
- **밸런스 + 문법 검증**: `node tools/balance-check.cjs` — (1) 인라인 `<script>` 를 `new Function()` 으로 파싱해 **문법 체크** + (2) 그리디(잘하는 플레이) 시뮬로 블라인드별 클리어율 측정. **점수/연결/족보 규칙을 바꾸면 항상 재실행.**
- **전체 런 시뮬** (안테 1~8 + 상점 덱빌딩 누적, 빌드 전략 5종 비교): `node tools/run-sim.cjs`
- **족보 밸런싱** (노리는 봇 vs 그리디 클리어율 비교): `node tools/strategy-sim.cjs`
- **8장 줄 족보 빈도 측정**: `node tools/hand-frequency.cjs`

## 코드 아키텍처

### 단일 파일 게임 (`prototype/index.html`)

- **전역 상태 = `S` 객체 하나** (`ante, blind, deck, discard, row, hand, score, target, boss, owned, bonusHand, rerollMax, seed, daily …`). `newGame(seed?)` 가 생성하며, 시드 RNG(`mulberry32`)를 `S` 생성 *전* 설정해야 `shuffle`/`pickBoss` 가 데일리 시드를 쓴다.
- **★불변식 (치명적)**: 모든 카드 객체는 4개 더미(`deck`/`discard`/`hand`/`row`)에서 **항상 어딘가에 정확히 1번** 존재해야 한다. 라운드 전환·리롤·정산 시 회수 누락 금지 — 과거 `settle()` 이 손패를 회수 안 해 덱이 고갈되고 fallback이 랜덤 카드를 양산하던 치명적 버그가 있었다 (HANDOVER §3.2).
- **`render()` 가 DOM 전체를 재구성** — 상태 변화 시에만 호출. **절대 호버에서 `render()` 를 부르지 말 것** (호버-재렌더가 클릭 씹힘 버그를 냄). 호버 효과 = CSS 클래스 토글만.
- **연출(juice)** 은 "손맛"의 핵심: 정적 카드 + CSS 트윈/파티클(`sparkBurst`) + 흔들림(`shake`)/플래시(`flash`) + WebAudio 절차 사운드(`beep`/`boom`). 프레임 애니 0장. 건드릴 때 주의.

### 게임 루프 핵심 함수

- `placeCard(hi)` — 카드 깔기 + 체인 점수 계산. 8장 채우면 `settle()`.
- `settle()` — 정산: 체인 점수 + 족보 보너스(가산) → 목표 비교 → 통과(`openShop`)/패배(`newGame`)/승리(`victory`). 카드 회수도 여기서.
- `connect(a,b)` — 같은 무늬 OR 같은 숫자 OR ±1 연속 (와일드는 무조건). 보스 규칙(`seal_suit`/`seal_run`)이 일부 봉인.
- `evalHand(8장)` / `handBonus()` — 텍사스 서열 최고 족보 1개 판정 → `HAND_BONUS` 계수 × 안테 기본 목표 = **가산** 보너스.
- `startBlind()`/`advanceBlind()`/`openShop()` — 안테/블라인드/상점 진행. `pickBoss(ante)` — `minAnte` 필터로 보스 풀 선택.

### 점수 공식 / 파라미터 (정확한 정의는 HANDOVER §4)

카드 = `{suit:0~3(♠♥♦♣), rank:1~8, enh:null|'wild'|'gold'|'mult'}`. 체인 = `런의 rank 합 × mult`, `mult = runLen-1 + 부적 보정`, **mult는 25 캡** (발산 방지). 정산 시 족보 보너스를 **가산**. 주요 밸런스 조정 지점: `fullDeck()`(시작 덱 A~8 32장), `blindTarget()`, `BOSSES`(`tmult`/`minAnte`), `HAND_BONUS`, `CHARMS`(부적 10종).

### ⚠️ 규칙 중복 — sim 도구 ↔ index.html 드리프트 주의

`tools/*.cjs` 의 시뮬은 `index.html` 의 `connect()` / `placeCard`(시뮬에선 `gain()`) / `evalHand()` / `HAND_BONUS` / `BOSSES` / `blindTarget()` 로직을 **수동 복제** 한 것이다. **index.html의 점수·연결·족보·부적 규칙을 바꾸면 해당 `.cjs` 도 같이 맞춰야** 시뮬 결과가 유효하다.

- **현재 드리프트 상태**: `run-sim.cjs` 만 부적 10종 + `fiveKind` 족보까지 동기화됨. **`balance-check.cjs` · `strategy-sim.cjs` · `hand-frequency.cjs` 는 구 5부적 기준이고 `fiveKind` 미반영** — 이들로 신규 부적/족보를 검증하려면 먼저 동기화할 것.

## 밸런스 설계 원칙 (변경 시 지켜야 함)

- **가산 > 곱셈**: 족보·부적 보너스는 곱이 아니라 **가산**. 체인이 이미 ×배수 엔진이라 또 곱하면 분산이 폭발해 "아슬아슬(빠듯한 마진)" 재미가 파괴된다 (HANDOVER §3.2). 신규 부적도 전부 가산·바운드로.
- **빈도보정 족보**: 8장 강제 구조라 포커 빈도가 역전된다(풀하우스 > 플러시). 라벨은 텍사스 서열(익숙) / 값은 빈도 — 흔한 족보=소액, 희소 족보=큰 가산.
- **보스 = 숫자 벽이 아니라 *규칙* 으로** 어렵게 → 플레이어가 덱을 조정(적응)하게. 도구 없는 안테1엔 순한 보스만 등장(`minAnte`).
- **목표 클리어율**(그리디 시뮬 기준): 작은 ~90% / 큰 ~80% / 보스 55~72%. 잘하면 깨고 운으로 가끔 억까당하는 발라트로 감각.
- **단순성·압축 유지**: 시작 덱 A~8(32장) 압축 구조 유지. 무작정 카드 추가는 덱 비대화로 연결률을 떨어뜨린다 — 추가는 *의도적 빌드* 일 때만.

## 배포 (선택)

- **GitHub Pages**: `main` 에 push = 자동 재빌드(1~2분 반영). 루트 `index.html` 이 `prototype/index.html` 로 리다이렉트한다. 리포는 **public** — 시크릿·민감정보 커밋 금지.
- **`git push` 가 hang하면**: credential 프롬프트 대기 문제. gh 토큰을 인라인 helper로 우회 — `git -c credential.helper= -c credential.helper='!f(){ echo username=x-access-token; echo "password=$(gh auth token)"; }; f' push origin main` (HANDOVER §2).
- **백엔드(익명 플레이로그·리더보드, 선택)**: 게임 → Cloudflare Worker(Origin 검증으로 비밀 은닉) → Apps Script → Google Sheet. `index.html` 의 `LOG_URL`; 읽기는 CORS 우회 위해 JSONP. 스크립트는 `tools/cloudflare-worker.js` · `tools/playlog-appsscript.gs`. Apps Script 재배포는 **"배포 관리 → 편집"** 으로 해야 URL이 유지된다.
