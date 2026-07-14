# CHAIN DEAL — 아트 마일스톤 M2: 보드 PixiJS 스왑 + 발라트로급 juice 설계

> 작성: 2026-07-14 · 상태: **설계(구현 전)** · 상위: memory `engine-renderer-decision`(2026-07-06 적대검증) + M1 spec §0/§9(`2026-07-14-art-m1-procedural-pixel-design.md`)
> 대원칙(렌더러 결정 그대로): **게임 보드만 DOM→WebGL(PixiJS) 스왑, 메뉴/HUD/설정/드로어는 DOM 유지, rules/content/sim/gate 무손상.**

---

## 0. 범위 결정 — M2a(본 spec 구현) / M2b(후속 예고)

**M2a (이번 슬라이스, shippable)**: Pixi 스테이지로 **줄(row 8칸)+손패(hand)** 렌더 전환 + 코어 juice 6종(스프링 이동·호버 리프트/틸트·배치 바운스·GPU 파티클·점수 팝업·셰이크/플래시) + **DOM 렌더 경로 폴백 존치**(greybox — WebGL 불가/로드 실패/`?render=dom` 시 현행 그대로).

**M2b (후속, 본 spec 범위 아님)**: 배경 소용돌이 셰이더(발라트로 시그니처) · enh 카드 포일/홀로 셰이더 · 드래그 배치 · idle wobble 고도화 · CRT 필터 · 모바일 성능 프로파일링/튜닝 · DOM 경로 제거(흡수 판정 후).

**Out**: 상점/드로어/정산 tally/셸 화면(전부 DOM 유지 — 발라트로도 메뉴는 단순 UI) · 오디오(beep/boom WebAudio 유지) · 룰/밸런스/컨텐츠 일절.

## 1. 의존성 — PixiJS 벤더링

- **`prototype/assets/pixi.min.js` = PixiJS v8.19.0 브라우저 번들 확정** (★2026-07-14 실측: `pixijs.download/v8.19.0/pixi.min.js` 797KB가 전역 `PIXI` 노출 + 이 환경 헤드리스 Chromium에서 WebGL2 가용 확인 — v7 폴백 불필요, render 모듈은 v8 API에 고정 배선(버전-포터블 아님)). `index.template.html`에 메인 스크립트보다 앞서 `<script src="assets/pixi.min.js"></script>`.
- 근거: assets/ 정적 서빙은 M1 카드시트로 확립된 정책(backend-less 보존). **build.mjs raw-concat 무손상**(번들링 전환 불필요 — PIXI는 전역으로 소비). CDN 금지(오프라인 file://·핀 고정).
- 게임 소스는 `window.PIXI` 전역만 참조. **런타임 의존 "0" 원칙의 명시적 개정**: M2부터 "빌드 무의존 + 벤더링 정적 자산" 로 재정의(렌더러 결정이 승인한 트레이드오프).

## 2. 아키텍처 — `src/render/` 모듈 (art/ 규율 승계)

```
src/render/
  spring.cjs   rSpring(현재값,목표,속도,감쇠) 스프링 물리 + rTween 유틸 — 순수 계산(브라우저 무관)
  stage.cjs    rStageInit(mountEl)·rStageResize — Pixi Application 생성/리사이즈/폴백 감지
  cardsprite.cjs  rCardSprite(card) — artDrawCardFace(card) canvas → PIXI.Texture 캐시 + 스프라이트 팩토리(M1 §9 인터페이스 실현)
  board.cjs    rSync(S)·씬 그래프(row 슬롯 8 + hand 스프라이트) 상태 동기화 + 인터랙션(click→placeCard, hover→willchain 하이라이트)
  juice.cjs    rPopup·rBurst(ParticleContainer)·rShake·rFlash·rChainFlash — 기존 DOM juice 대체 구현
  render.cjs   파사드 — 위를 순서 require(star 토폴로지), rActive()(폴백 판정) 노출
```

- **star 토폴로지·`r`/`R_` 접두·leaf 간 require 금지·한 줄 require/exports** — art/와 동일 규율(build.mjs 중복 require 가드가 지킴). `main.cjs`는 `./render/render.cjs` 하나만 require. build.mjs에 RENDER_DIR 파싱 게이트 추가(ART_DIR 패턴).
- **교차-파사드 결합(검수 반영)**: cardsprite.cjs는 art/의 `artDrawCardFace`/`artSheetOK` 등을 **재-require하지 않고 concat 전역으로 참조**(중복 require 가드 때문에 구조적 강제) — 따라서 **main.cjs의 require 순서 = art.cjs가 render.cjs보다 먼저**(concat 인라인 순서 제약)를 규율로 명문화. render/는 art/ 전역에 의존하는 상위 레이어다.
- **브라우저 전용**(tools/sim 미소비 — 게이트 무영향). PIXI 미존재/WebGL 실패 시 rActive()=false.

## 3. 상태 동기화 모델 (S = SSoT 불변) — ★검수 반영 개정

- 기존 패러다임 유지: **상태 변화 시 render() 호출**. render()는 rActive()면 **row/hand DOM 재구성을 스킵**하고 `rSync(S)` 호출(그 외 HUD·게이지·부적태그 등 DOM 갱신은 현행 유지).
- `rSync(S)`: S.row/S.hand를 씬과 diff —
  1. 카드 스프라이트 생성/제거 (식별 = 객체 identity. ★단 **settle→startBlind 구간은 row/hand가 discard와 이중 참조되는 예외 창**(settle L246-247이 push만 하고 배열을 비우지 않음 — 실측) — rSync는 S.row/S.hand만 스캔하므로 렌더 정합엔 무해, 전제를 "row/hand 내에서 유일"로 한정).
  2. **시각키(suit:rank:enh + 시트세대) 변경 감지 → 스프라이트 texture 재대입**: 스프라이트에 마지막 렌더 시각키(`_vkey`)를 저장하고 diff마다 비교(상점 enh in-place mutate·시트 비동기 로드가 identity 보존 채 시각을 바꾸는 두 벡터를 커버 — 검수 실측). 시트 로드는 **세대 카운터**(artSheetOK 전이 시 +1)를 vkey에 포함해 **콜백 순서 무의존**으로 전 스프라이트 재대입(별도 artSheetReady 콜백에 기대지 않음).
  3. **목표 좌표 갱신**(이동은 스프링이 프레임마다 수행 — 순간이동 금지).
  4. **willchain 미리보기 = 상시 상태-구동(검수 반영)**: S.showPreview(pvToggle, 기본 ON)일 때 연결 가능한 **모든** 손패 스프라이트에 하이라이트+⚡×n 배지를 rSync가 렌더(기존 render() L448-456 로직 이식 — 모바일 터치에서도 유지). hover는 그 위의 **추가 강조**(리프트/틸트)만.
- **입력**: 스프라이트 pointertap → `placeCard(hi)`(기존 함수 그대로). hover(pointerover/out)는 씬만 건드림(**render() 호출 금지 규칙 준수**).
- **juice 디스패치(스코프 확정 — 검수 반영)**: 분기 지점은 **`juicePlace()` 전체 본문**(base 팝업·beep(330)·체인 연쇄 flash 루프·CHAIN 팝업·burst·shake — placeCard가 아님) + **`victory()`의 sparkBurst(#table)×4** + **`revealTally()` climax의 shake/flash**. rActive() 시 DOM 앵커 인자를 버리고 **슬롯 인덱스/스테이지 논리좌표 기반 API**(`rPopupAt(idx|pt,...)`/`rBurstAt(idx|center,...)`/`rShake()`/`rFlash(색)`/`rChainFlash(idx)`)로 위임 — display:none된 #table의 rect(0,0) 붕괴·stale cellEls 문제 원천 차단(검수 실측). DOM 폴백 시 기존 구현 그대로. 오디오(beep/boom)는 공통 유지.
- 정산 시 카드 회수/newGame/useRetry 등 대량 상태 변화도 rSync diff가 흡수(사라진 카드 = 페이드/슬라이드 아웃 후 제거). ★스프라이트 잔존의 정상 시점: settle 직후~상점 구간은 보드 8장 잔존이 **정상**(카드는 startBlind에서 회수), 다음 startBlind 후 이전 판 스프라이트 0이어야 함.

## 4. 코어 juice 사양 (발라트로 감각의 최소 핵심셋)

| # | 효과 | 사양 |
|---|---|---|
| 1 | **스프링 이동** | 모든 스프라이트 위치/스케일 = 스프링(강성·감쇠 튜닝 상수는 `R_TUNE` 한 곳) — 손패 재배치·배치 이동이 슬라이드+오버슛. 등장(드로우)은 아래에서 딜레이 스태거 입장 |
| 2 | **호버 리프트/틸트** | 손패 hover: y −12px 리프트 + 포인터 위치 기반 미세 틸트(rotation ±0.06rad) + scale 1.06. 기존 CSS hover 대체 |
| 3 | **배치 바운스** | placeCard: 손→칸 스프링 비행 + 착지 스케일 펀치(1.15→1) + 칸 화이트 플래시 |
| 4 | **체인 연쇄 플래시** | 기존 cellEls flash 루프 대체 — 연결 칸들이 70ms 간격 순차 화이트 펄스(rChainFlash(idx,k)) |
| 5 | **GPU 파티클** | rBurst: ParticleContainer 스파크(속도·중력·페이드, runLen 비례 수량, 색 인자 유지 — 골드/퍼플) |
| 6 | **점수 팝업 + 셰이크/플래시** | rPopup: 비트맵 텍스트 상승+페이드(+big 스케일) · rShake: 스테이지 오프셋 감쇠 진동 · rFlash: 풀스테이지 틴트 페이드 |

- **카드 텍스처**: `PIXI.Texture.from(artDrawCardFace(card))` — faceCache 위에 텍스처 캐시 1겹(키 = 시각키+시트세대). ★무효화는 §3.2의 **세대 카운터 방식**(rSync가 매 sync에 감지 — artSheetReady 콜백 등록 순서에 무의존, 검수 반영). 기존 main.cjs L634의 artSheetReady→render() 경로가 그대로 rSync를 트리거하므로 추가 콜백 불필요.
- 60fps ticker는 Pixi Application 기본. `prefers-reduced-motion` 시 스프링 즉시 수렴+파티클 감량(기존 접근성 정책 승계).

## 5. 레이아웃/반응형 — ★검수 반영 개정

- **#stage 삽입 지점 = #table 바로 앞**(template L48). rActive() 시 **숨김 대상 = #table + `.handlbl`(L49) + #hand** 3개(★.handlbl 누락 시 캔버스 아래로 밀려 고아가 됨 — 검수 실측). 프롬프트("손패에서 한 장을 골라 클릭")는 스테이지 내 텍스트로 흡수. 이후 컨트롤(rerollBox/deckinfo/charms/banner L51-54)은 캔버스 아래 그대로 흐름(위치 불변은 HUD·버튼에 한함).
- 리사이즈: 컨테이너 폭 실측 → 스테이지 스케일. 논리 좌표계에서 board 카드 71×95·hand 카드 88×118 관계 유지(현행 크기 비율). ★좁은 폰 통짜 축소는 현행(board만 flex 축소, hand 88px 고정)과 **다른 거동**(손패도 함께 축소) — 의도적 개선으로 수용(캔버스 특성상 자연스러움), spec에 명시(검수 반영). `resize` 리스너 + rStageResize.
- 모바일 터치: pointertap이 터치 겸용(Pixi 기본). 탭 딜레이/스크롤 간섭은 canvas touch-action 기존 정책 승계.

## 6. 검증 프로토콜 — ★검수 반영 개정

1. `node build.mjs && node tools/balance-check.cjs` + `npm run gate`(--fast) — 9/9 GREEN 불변(렌더층은 sim 무관·node 게이트는 파싱/밸런스 전용).
2. **Pixi 경로 스모크 = WebGL 지원 헤드리스 브라우저에서**(이 환경 Chromium WebGL2 가용 실측 완료): 로드 직후 **`rActive()===true`를 assert**(거짓이면 즉시 실패 — 조용한 DOM 폴백이 Pixi 회귀를 가리는 거짓 안심 차단, 검수 반영). 새게임→8장 배치→정산→상점 진입 풀 사이클, 콘솔 에러 0. **DOM 폴백은 `?render=dom`으로 별도 사이클**(회귀 0).
3. **시각 판정**: 스크린샷(배치 중간 프레임 포함) + 판정 패널(juice 품질·기능 동등·회귀 3렌즈).
4. **fps**: 절대 임계 게이트 대신 **상대 프레임버짓**(파티클 버스트 on/off ticker FPS 델타 — 소프트웨어 래스터 환경 의존성 회피, 검수 반영) + 실기기 감각은 인간 패스(M1 §7.4 방식).
5. **스프라이트 수명 검증(시점 분리 — 검수 반영)**: settle 직후~상점 = 보드 스프라이트 잔존이 정상 / **다음 startBlind 후 이전 판 스프라이트 0** + 새 손패 스프라이트 수 = S.hand.length. 상점 enh 부여 후 다음 판에서 해당 카드 텍스처가 enh 반영되는지(시각키 재대입 경로) 확인.

## 7. 리스크 & 완화

- ~~v8 전역 번들 부재~~ → **해소됨**(v8.19.0 전역 번들 실측 확정 — §1). render 모듈은 v8 API 고정(Application.init 비동기 등 v8 시맨틱 준수).
- **file:// 텍스처/CORS** → 텍스처 소스가 전부 로컬 canvas(artDrawCardFace)라 taint 무관(M1 하이드레이션과 동일 원리). pixi.min.js도 로컬 script 태그.
- **정산 revealTally와의 상호작용** → tally는 DOM 오버레이 유지, 카드 회수는 rSync diff가 처리(연출은 순수 표시 원칙 유지).
- **모바일 성능** → M2a는 데스크탑 기준 검증 + DOM 폴백 상시 가용, 모바일 튜닝은 M2b. WebGL 미지원 기기는 자동 폴백.
- **파일 크기** → pixi.min.js ~450KB(정적 1회 로드, Pages gzip). 게임 본체(단일 파일)는 불변.
- **greybox 흡수 판정** → DOM 경로 제거는 M2b에서 기능 동등 확인 후(이번엔 존치).

## 8. M1 인터페이스 소비 확인

M1 spec §9의 약속 실현: `artDrawCardFace`(param→canvas 순수 함수) → `Texture.from(canvas)` 무수정 소비. 부적 엠블럼·컨택트시트·덱뷰어는 DOM 유지(M2 무접촉).

---

## 크로스링크

- 상위 결정: memory `engine-renderer-decision` · M1 spec §0(마일스톤 분해)·§9(인터페이스 예고)
- 관련 규율: M1 spec §2(star 토폴로지·접두·중복 require 가드)
- 후속: M2b(셰이더·포일·드래그·모바일 튜닝·DOM 흡수) · M3(배경/UI킷/셸)
