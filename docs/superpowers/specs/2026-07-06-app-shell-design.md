# App Shell (프론트오브하우스) — 설계 Spec

- **날짜**: 2026-07-06
- **상태**: draft (사용자 검토 대기)
- **범위 원칙**: **구조 먼저, 아트 나중.** 라우터 + 5화면 구조를 현재 네온 스킨(placeholder)으로 구현하고, 픽셀 16색 리스타일은 이후 아트 트랙(A0/A1) 별도 패스로 채운다. 스타일 seam을 심어 그 리스타일이 리빌드가 아닌 리스킨이 되게 한다.
- **관련**: 엔진/렌더러 결정 memory `engine-renderer-decision`(웹 유지·보드 WebGL은 아트단계), `docs/production-roadmap.md`(아트 A0–A4), `docs/superpowers/specs/2026-07-02-chaindeal-master-spec.md`.

## 1. 목표 & 범위

현재 게임은 `src/index.template.html`의 단일 스크롤 `.wrap`에 라이브 보드 + 셋업 컨트롤 + Giscus가 뒤섞여 있고, 타이틀/설정/온보딩/전용 승패 화면이 없다. 이 작업은 그 **구조적 갭**을 메운다 — 프로토타입을 제품 골격으로.

**MVP 화면**: Title · Run · Settings · Summary · Pause.

**명시적 out-of-scope** (별도 서브프로젝트/후속):
- mastery grid(8덱×8스테이크) · 언락 트리 · 도전과제 · 온보딩 · 소비아이템 UI (각각 별도)
- **픽셀 아트 / 16색 팔레트 / 절차적 엠블럼**(아트 A0/A1 패스) · **WebGL 보드 승급**(아트단계)
- **Continue(런 중간 저장·재개)** — 유예(seam만)
- **런타임 언어 스위처(ko/en)** — 유예(런타임 i18n 별도 과제, Settings에 슬롯만)

## 2. 아키텍처 — 화면 라우터 (approach B)

- **`src/ui/router.cjs`**: 화면 레지스트리 `{id → screen}`, `showScreen(id, ctx)`, 현재 화면 보유, `mount/unmount` 생명주기, 가벼운 CSS 페이드 전환(`prefers-reduced-motion` 존중).
- **화면 계약**: 각 화면 모듈은 `{ mount(root, ctx), unmount() }` 을 export. `mount`는 자기 DOM을 `root`(=`#screen-root`)에 구성, `unmount`는 리스너/타이머 정리.
- **`run` 화면 = 기존 `render()`/juice의 얇은 래퍼** — 보드 로직은 손대지 않고 컨테이너에 스코프만. **이 지점이 훗날 DOM→WebGL 보드 스왑이 들어오는 seam**(run 화면 내부만 교체, 라우터·타 화면 불변).
- **스타일 seam**: 화면은 시맨틱 클래스 + 팔레트 CSS 변수만 사용 → 이후 픽셀 A0 패스가 팔레트/폰트/프레임만 스왑, 구조 무변경.
- **불변식 준수**: 런타임 의존성 0(바닐라 + 인라인 CSS) · `render()`는 여전히 자기 서브트리 재구성 · **hover는 CSS 전용**(호버-리렌더 클릭씹힘 버그 회피) · **카드 불변식**(화면 전환은 카드 더미 미접촉; Quit-to-Menu만 전량 회수로 안전 복구) · 모든 문자열 `t()` 키(ko+en) · `prototype/index.html`은 빌드 산출물(→ `src/` 편집 후 `node build.mjs`, raw-concat require 제약 준수).

## 3. 화면

### 3.1 Title (메인메뉴)
- **목적**: 현관. 부팅 시 첫 화면(현재의 즉시 `newGame()` 대체).
- **구성**: 로고(기존 골드 H1 글로우) · **New Run 패널**(덱 stepper + 스테이크 stepper + Start) · **Daily**(dailySeed) · 서브 진입: **Collection**(부적/족보/덱/통계/룰 드로어) · **Meta**(업그레이드 드로어) · **Leaderboard** · **⚙ Settings**.
- **상태**: Continue = 유예(자리 없음, 후속 추가 시 New Run 위에).

### 3.2 Run (보드)
- **목적**: 코어 플레이. 기존 `render()`/juice/shop/drawer를 그대로 래핑.
- **변경점**: HUD에 **⏸ Pause** 버튼 추가 · 최종 정산 → tally 카운트업(불변) → **Summary로 라우팅**(현재의 제자리 배너/tally-재사용 대체).

### 3.3 Summary (승리/패배 런 요약)
- **목적**: 런 종료 후 전용 화면.
- **구성**: 결과 배너(승/패, 승리 시 confetti/boom) · 런 스탯(도달 안테·블라인드, 최종 점수, 최고 족보, 골드, 보유 부적, daily면 시드) · **Share**(기존 `shareResult`, Wordle식) · CTA: **New Run** / **Menu** / **Retry**(재도전권 보유 시).
- **대체**: 기존 `victory()` 제자리 배너 + 패배 시 tally 오버레이 재사용.

### 3.4 Settings
- **오디오**: 마스터 뮤트(+게인 노드 추가 시 볼륨)
- **모션**: `prefers-reduced-motion` 토글 · ⚡preview · ⏩fast-fx (기존 인라인 HUD 체크박스 이관)
- **닉네임**: 정식 입력창 (native `prompt()` 제거)
- **언어(ko/en)**: 유예 — 런타임 i18n 도입 시 채울 슬롯만 명시.

### 3.5 Pause (인런 오버레이)
- Resume · Settings · **Quit to Menu**(런 포기 → 카드 전량 회수로 불변식 사수 후 Title).

**드로어**(Collection/Meta/Leaderboard): 기존 바텀시트 재사용, 이제 Title/Pause에서 호출(어느 화면 위에도 오버레이). mastery grid/언락 = 별도 서브프로젝트.

## 4. 데이터 흐름 & 상태

- **라우터 상태**: `router.current`(화면 id). `S`는 게임 상태 그대로.
- **라우팅 이벤트**: 부팅→Title · New Run/Daily→Run · 최종 정산(승/패)→Summary · Pause(Run 위 오버레이) · Quit→Title(카드 회수).
- **영속화**: `cd_meta`(localStorage) 불변. 신규 **settings 객체**(뮤트/모션/닉네임)를 localStorage에 저장·부팅 시 로드.
- **native 제거**: `prompt()`(닉네임)→Settings 입력창 · `alert()`(share 폴백)→인UI 토스트.

## 5. 결정 (잠금) & 유예

| # | 결정 | 값 | 비고 |
|---|---|---|---|
| A | Continue(중간저장) | **유예** | `S` 직렬화 seam만. 모바일 상용엔 곧 필요 → 후속. |
| B | 언어 스위처 | **유예** | 런타임 i18n(eager-freeze+셸 reload) 별도. Settings 슬롯만. |
| C | Giscus 댓글 | **셸에서 제거** | 상용 앱에 이질적. 웹 데모 푸터로만(선택). |
| D | 덱/스테이크 선택 | **스테퍼**(Title New Run) | 화려한 픽커 = 메타 서브프로젝트. |
| — | 스킨 | **현행 네온(placeholder)** | 픽셀 16색 리스타일 = 후속 아트 A0/A1 패스(스타일 seam). |

## 6. 검증

- **UI 전용 → sim/밸런스 영향 0** (rules/content/tooling 무접촉). C1 게이트 G0(build+문법)·전체 GREEN 밴드 유지 확인.
- 절차: `node build.mjs` OK → `node tools/gate.cjs --fast` GREEN(밴드 불변) → **수동 화면 QA**: 라우팅 전환, Pause/Quit **카드 불변식 스팟체크**, 정산→Summary, Settings 영속, native prompt/alert 부재.
- i18n: 신규 문자열 전부 `t()` 키(ko+en 엔트리) — 하드코딩 금지.

## 7. Out of scope (재명시)

mastery grid · 언락 트리 · 도전과제 · 온보딩 · 소비아이템 UI · 픽셀 아트/16색/절차적 엠블럼 · WebGL 보드 · Continue 저장 · 런타임 언어 스위처. (각각 별도 spec/패스.)
