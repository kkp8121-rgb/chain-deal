# 아트 M2: PixiJS 보드 스왑 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. 요구사항 SSoT = spec `docs/superpowers/specs/2026-07-14-art-m2-pixi-board-design.md` (검수 반영판 — 각 태스크는 지정된 spec 섹션을 정독 후 구현).

**Goal:** 줄+손패 렌더를 PixiJS(WebGL) 스테이지로 전환 + 코어 juice 6종(스프링·호버 리프트/틸트·배치 바운스·GPU 파티클·팝업·셰이크/플래시). DOM 경로는 폴백 존치(greybox). gate 9/9 GREEN 불변.

**Architecture:** `src/render/` star 토폴로지(spec §2). S=SSoT, render()→rSync(S) diff 동기화(spec §3). 카드 텍스처 = artDrawCardFace canvas(spec §4). PIXI v8.19.0 전역 벤더링(spec §1).

## Global Constraints

- require 한 줄 destructuring·후행 주석 금지 / `module.exports = { A, B };` 한 줄 / render/ 최상위 식별자 `r`/`R_` 접두 / leaf 간 require 금지(render.cjs 파사드만) / **main.cjs에서 art.cjs require가 render.cjs보다 먼저**(concat 순서 — spec §2).
- prototype/index.html은 `node build.mjs`로만 생성·재빌드본 커밋 동봉. rules/hooks/밸런스 수치 무손상.
- 호버에서 render() 호출 금지(호버는 Pixi 씬만). DOM 폴백 경로(기존 render 본문)는 **수정 최소화·존치**.
- Pixi 스모크는 WebGL 헤드리스에서 `rActive()===true` assert 필수(spec §6.2). DOM 폴백은 `?render=dom`.
- 커밋 말미: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` · pre-commit gate --fast 자동(RED면 원인 수정, --no-verify 금지).

## 핵심 알고리즘 (전 태스크 공용 참조)

**스프링 (spring.cjs)** — 프레임 dt 기반 감쇠 스프링, 위치/스케일/회전 공용:
```js
// rSpringStep(s, dt): s={v(현재),t(목표),vel,k(강성),d(감쇠)} — 반환: 새 v. R_TUNE에 k/d 프리셋.
function rSpringStep(s,dt){ const f=(s.t-s.v)*s.k; s.vel=(s.vel+f*dt)*Math.exp(-s.d*dt); s.v+=s.vel*dt; if(Math.abs(s.t-s.v)<.05&&Math.abs(s.vel)<.05){ s.v=s.t; s.vel=0; } return s.v; }
const R_TUNE={ move:{k:170,d:14}, punch:{k:320,d:11}, hover:{k:260,d:18} };
```

**rSync diff (board.cjs)** — spec §3 4단계. 스프라이트 맵 `rMap = Map<cardObj, sprite>`:
```
seen=Set; for (S.row[i]) → ensureSprite(card, slotPos(i), zone='row'); for (S.hand[i]) → ensureSprite(card, handPos(i,n), zone='hand')
ensureSprite: 없으면 생성(입장 연출: 아래+스태거), vkey=`${suit}:${rank}:${enh||''}:${rGen}` 비교 → 다르면 texture 재대입, 목표좌표/존 갱신
rMap의 seen 밖 스프라이트 → 퇴장 연출 후 destroy
willchain: S.showPreview && S.row.length ? 손패별 connect(...)&&!climbSealed(...) 판정(main.cjs render L448-456 식 그대로 이식 — bossId()·frost 조건 포함) → 하이라이트+⚡×n 배지 컨테이너 토글
rGen = 시트세대 카운터: rSync 서두에 `if(artSheetOK!==rLastSheetOK){rGen++; rLastSheetOK=artSheetOK;}`
```

**juice 디스패치 (main.cjs)** — spec §3: `juicePlace()` 서두 `if(rActive()){ rJuicePlace(idx,base,er,runLen,big); return; }`(오디오 beep/boom은 rJuicePlace 내부에서도 동일 호출) · `victory()`의 sparkBurst(#table)×4 → `if(rActive()) rBurstCenter(34,"#ffd15c") else 기존` · `revealTally()` climax shake/flash → rShake()/rFlash() 분기.

---

### Task 1: 벤더링 + 스테이지 스캐폴드 + 폴백 배선

**Files:** Create `prototype/assets/pixi.min.js`(스크래치 `C:\Users\ovencode\AppData\Local\Temp\claude\C--Projects-CHAINDEAL\ef329057-ad30-46ee-b1d5-c8ae6b74bc38\scratchpad\pixi.min.js` = v8.19.0 실측본 복사), `src/render/stage.cjs`, `src/render/render.cjs` · Modify `src/index.template.html`(pixi script 태그 — 메인 `<script>`(L78) 앞 + `#stage` div — `#table`(L48) 바로 앞), `build.mjs`(RENDER_DIR 게이트 — ART_DIR 패턴), `src/main.cjs`(require 1줄 — **art require 아래**), `src/styles.css`(`#stage canvas{display:block;margin:0 auto}` 최소)

**Produces:** `rStageInit(mountEl,onReady)`(PIXI 감지·`?render=dom` 플래그·WebGL 실패 캐치 → 전부 폴백. v8 `new PIXI.Application()` + `await app.init({...})` — async를 콜백으로 감쌈), `rActive()`, `rStage()`(Application), `rStageResize()`, `R_W/R_H` 논리 좌표계 상수(폭 800×높이 460 제안: 보드 영역 y0~250·손패 y250~460). 이 태스크에선 **마운트만** — rActive true여도 아직 rSync 없음 → main.cjs 분기는 넣지 않음(다음 태스크). 부트에서 rStageInit 호출 + onReady 시 #stage 표시 준비만.

**Verify:** `node build.mjs && node tools/balance-check.cjs` · 헤드리스: 기본 로드에서 `rActive()===true` + 콘솔 0 + 게임(DOM 경로) 정상 렌더(캔버스는 비어있고 숨김 or 0높이 — 게임 방해 금지), `?render=dom`에서 `rActive()===false`. 커밋.

### Task 2: spring + cardsprite + board rSync (기능 동등 전환)

**Files:** Create `src/render/spring.cjs`, `src/render/cardsprite.cjs`, `src/render/board.cjs` · Modify `src/render/render.cjs`(require 순서 spring→stage→cardsprite→board·export), `src/main.cjs`(render()의 row/hand 재구성 블록을 `if(!rActive()){...기존...} else rSync(S)` 분기 + rActive 시 #table/.handlbl/#hand 숨김·#stage 표시 — CSS 클래스 토글), `src/styles.css`(숨김 클래스)

**Produces:** `rCardTexture(card)`(vkey 캐시+Texture.from(artDrawCardFace)), `rSync(S)`(위 diff 알고리즘 전부 — 생성/제거/vkey 재대입/좌표/willchain 상시 배지), 슬롯 8 배경(빈칸 대시 프레임 Graphics), 클릭(pointertap→placeCard(hi) — hi는 S.hand.indexOf(card) 실시간 조회), 호버 리프트/틸트(R_TUNE.hover — 배지와 독립), 프롬프트 텍스트("↓ 손패에서 한 장을 골라 클릭" — .handlbl 흡수), 스테이지 리사이즈 반영.

**Verify:** 헤드리스(WebGL): `rActive()===true` assert → newGame→js로 8장 배치→정산 오버레이(DOM tally 정상 표출)→상점 진입→advanceBlind→**이전 판 스프라이트 0 + 새 손패 수 일치**(spec §6.5) · 스프라이트 클릭 시뮬 1회(placeCard 발화) · `?render=dom` 동일 사이클 회귀 0 · 콘솔 0. 스크린샷 2장(보드+손패, willchain 배지). 커밋.

### Task 3: juice.cjs + 디스패치 (발라트로 juice)

**Files:** Create `src/render/juice.cjs` · Modify `src/render/render.cjs`(export), `src/main.cjs`(juicePlace 서두 분기·victory 분기·revealTally climax 분기), `src/render/board.cjs`(배치 바운스 훅 — ensureSprite zone 전이 시 punch)

**Produces:** `rJuicePlace(idx,base,er,runLen,big)`(base 팝업+beep, 체인 연쇄 rChainFlash 70ms 스태거+beep 음계, CHAIN 팝업, rBurstAt(idx) 파티클(runLen 비례·색 유지), rShake/rFlash big 분기 — 기존 juicePlace 의미 1:1 이식), `rPopupAt(pt,text,color,big)`(PIXI.Text 상승+페이드), `rBurstAt(idx|pt,n,color)`+`rBurstCenter`(파티클 — v8: ParticleContainer 또는 Container+Sprite 풀, 중력·감쇠·페이드), `rShake()`(스테이지 오프셋 감쇠 진동), `rFlash(color)`(풀스테이지 사각 페이드), `rChainFlash(idx)`(슬롯 화이트 펄스). `prefers-reduced-motion`: 스프링 즉시 수렴·파티클 1/4(spec §4).

**Verify:** 헤드리스 사이클에서 juice 경로 콘솔 0 + 배치 중간 프레임 스크린샷(파티클·팝업 포착) + victory 강제(`S.ante=8; ...`) 스테이지 버스트 확인 + `?render=dom` 기존 juice 회귀 0. 커밋.

### Task 4: 통합 검증 + 시각 판정 + 출하 (오케스트레이터 주관)

- [ ] `node build.mjs && node tools/balance-check.cjs && npm run gate` 9/9 GREEN
- [ ] 헤드리스 풀 사이클(Pixi assert + DOM 폴백) + 모바일 뷰포트(375px) 스크린샷
- [ ] fps 상대 버짓: 파티클 버스트 on/off ticker FPS 델타 로깅(spec §6.4)
- [ ] 판정 패널 3렌즈(juice 품질·기능 동등·회귀) → 폴리시 루프
- [ ] 문서 동기화: PLAN.md 포인터(M2a 완료)·CLAUDE.md(src/render/ 아키텍처+벤더링 정책)·memory
- [ ] 최종 커밋 + push(kkp8121-rgb 토큰) — Pages 배포

## Self-Review

spec 커버리지: §1=T1, §2=T1·T2, §3=T2(rSync·입력·willchain)+T3(디스패치), §4=T2(텍스처)+T3(juice 6종), §5=T1(#stage)+T2(숨김·리사이즈), §6=각 태스크 Verify+T4. 시그니처 일관성: rActive/rSync/rCardTexture/rJuicePlace/rPopupAt/rBurstAt/rShake/rFlash/rChainFlash — 태스크 간 동일 명칭 사용 확인.
