# 아트 M1: 절차적 픽셀 아트 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 텍스트+CSS 카드/부적을 절차적 픽셀 아트(canvas)로 전환 — 마스터 16색 팔레트, 32장 카드 페이스, 부적 엠블럼 22종, 컨택트 시트+CVD 검증. 게임 로직·밸런스 무손상(gate 9/9 GREEN 불변).

**Architecture:** `src/art/` 신설(star 토폴로지: art.cjs 파사드만 leaf를 의존 순서로 1회 require, leaf 간 require 금지). 픽셀 그리드(팔레트 인덱스 Uint8Array) 조립과 canvas 페인트를 분리해 CVD 시뮬이 같은 그리드를 변환 팔레트로 재페인트. main.cjs 통합은 표시 전용(cardEl DOM 직접 + innerHTML 표면은 artHydrate 하이드레이션).

**Tech Stack:** vanilla JS(.cjs, 브라우저 전용) · canvas 2D · esbuild(빌드타임 파싱 게이트만) · 런타임 의존성 0 유지.

**Spec:** `docs/superpowers/specs/2026-07-14-art-m1-procedural-pixel-design.md` (이하 "spec")

## Global Constraints

- require는 한 줄 destructuring(`const { X } = require('./x.cjs');`)만, **후행 주석 금지**, 같은 모듈 두 곳 require 금지 (build.mjs 정규식·raw-concat 제약).
- `module.exports = { A, B };` 한 줄 형식만 (EXPORTS_LINE_RE — 중첩 중괄호 금지).
- art/ leaf 모듈은 **서로 require하지 않는다**. art.cjs만 palette→pixel→sprites→cards→charmart→sheet 순서로 각 1회 require. leaf는 앞서 인라인된 심볼을 concat 전역으로 참조. main.cjs는 `./art/art.cjs` 하나만 require.
- art/ 최상위 식별자는 전부 `art`/`ART_` 접두 (concat 전역 충돌 방지).
- `prototype/index.html` 직접 편집 금지 — 항상 `node build.mjs`로 생성, 커밋에 재빌드 산출물 동봉.
- rules/·tuning·부적 hooks **수치 변경 절대 금지**(아트=표시 전용). charms.cjs에는 `art:{...}` 필드만 추가.
- 호버에서 `render()` 호출 금지(기존 규칙 — 이번 변경은 접촉 없음, 새로 추가하지도 말 것).
- 각 태스크 완료 시 커밋. pre-commit 훅이 gate --fast를 자동 실행할 수 있음(RED면 원인 수정 — `--no-verify` 금지).
- 커밋 메시지 말미: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: build.mjs 보강 + src/art/ 스캐폴드 (palette + 파사드) + main.cjs 배선

**Files:**
- Modify: `build.mjs` (ART_DIR 게이트 + 중복 require 검출)
- Create: `src/art/palette.cjs`, `src/art/art.cjs`
- Modify: `src/main.cjs` (require 1줄 추가 — 기존 rules require 블록 아래)

**Interfaces:**
- Produces: 전역(concat) `ART_PAL`(hex 배열, [0]=""=투명), `ART_C`(슬롯명→인덱스), `ART_ACCENT`(cluster→인덱스). build.mjs는 같은 파일 2회 require 시 throw.

- [ ] **Step 1: build.mjs — ART_DIR 파싱 게이트 추가**

`const UI_DIR = path.join(SRC, "ui");` 아래에:
```js
const ART_DIR = path.join(SRC, "art");
```
`const uiFiles = listCjsFilesRecursive(UI_DIR);` 아래에:
```js
const artFiles = listCjsFilesRecursive(ART_DIR);
```
esbuild Promise.all 엔트리 배열에 `...artFiles` 추가:
```js
[path.join(SRC, "main.cjs"), ...contentFiles, ...rulesFiles, ...uiFiles, ...artFiles].map((entry) =>
```

- [ ] **Step 2: build.mjs — resolveRequires에 seen-set 중복 검출**

시그니처와 본문 앞부분을 다음으로 교체 (중복 인라인=조용한 top-level 재선언 SyntaxError를 빌드 실패로 승격 — spec §2):
```js
function resolveRequires(filePath, stack = [], seen = new Set()) {
  if (stack.includes(filePath)) {
    const chain = [...stack, filePath].map((p) => path.relative(__dirname, p)).join(" -> ");
    throw new Error(`build.mjs: circular require detected: ${chain}`);
  }
  if (seen.has(filePath)) {
    throw new Error(`build.mjs: duplicate require detected (같은 모듈 두 곳 require 금지 — raw-concat 중복 인라인 방지): ${path.relative(__dirname, filePath)}`);
  }
  seen.add(filePath);
```
재귀 호출부도 seen 전달: `out.push(resolveRequires(reqPath, [...stack, filePath], seen));`

- [ ] **Step 3: src/art/palette.cjs 작성** (전문)

```js
// ART_PAL — 마스터 16색 (spec §3). 인덱스 0 = 투명. hex는 CVD 캘리브 대상(§3 수용기준).
// ★art/ 모듈 공통 규약: 최상위 식별자는 art/ART_ 접두(concat 전역 충돌 방지),
//   leaf 간 require 금지 — art.cjs 파사드만 의존 순서로 1회 require (spec §2 star 토폴로지).
const ART_PAL=["","#f2ead8","#cfc5ac","#20222b","#4a4f5e","#d84b40","#8e2f28","#e8b03c","#96601e","#58c85c","#9b6fd4","#46c0d8","#e07830","#10142a","#35406e","#ffffff","#6f8fd2"];
const ART_C={paper:1,shade:2,ink:3,soft:4,red:5,redDeep:6,gold:7,bronze:8,green:9,purple:10,cyan:11,orange:12,navy:13,slate:14,white:15,steel:16};
// 클러스터 색 예약(spec §3): cyan=gem·gold=apex·orange=cartel 전용. 무클러스터 부적 재사용 금지.
const ART_ACCENT={gem:ART_C.cyan,apex:ART_C.gold,cartel:ART_C.orange};
module.exports = { ART_PAL, ART_C, ART_ACCENT };
```

- [ ] **Step 4: src/art/art.cjs 파사드 작성** (Task 진행에 따라 require 줄이 늘어남 — 이 태스크에선 palette만)

```js
// src/art/art.cjs — 아트 파사드 (spec §2). ★star 토폴로지: 이 파일만 art/ leaf를
// 의존 순서(palette→pixel→sprites→cards→charmart→sheet)로 정확히 1회 require.
// leaf는 서로 require 금지(빌드 리졸버가 중복 인라인을 throw). main.cjs는 이 파일 하나만 require.
const { ART_PAL, ART_C, ART_ACCENT } = require('./palette.cjs');
module.exports = { ART_PAL, ART_C, ART_ACCENT };
```

- [ ] **Step 5: main.cjs 배선** — 기존 `const { ... } = require('./rules/...')` 줄들 바로 아래에 추가:

```js
const { ART_PAL, ART_C, ART_ACCENT } = require('./art/art.cjs');
```
(주의: main.cjs의 이 require가 유일한 art 진입점. 이후 태스크에서 이 줄의 destructure 목록만 늘린다.)

- [ ] **Step 6: 빌드 + 문법 게이트 확인**

Run: `node build.mjs && node tools/balance-check.cjs`
Expected: `Built prototype\index.html (...)` + balance-check 문법 게이트/클리어율 표 정상 출력(기준선 불변).

- [ ] **Step 7: 중복 require 가드 네거티브 테스트**

`src/art/art.cjs`에 임시로 `const { ART_PAL: _dup } = require('./palette.cjs');` 줄을 하나 더 추가(단, destructure 이름 겹침 방지용 alias) → `node build.mjs` 실행.
Expected: **FAIL** `duplicate require detected ... src\art\palette.cjs`
확인 후 임시 줄 제거, `node build.mjs` 재실행 → PASS.

- [ ] **Step 8: 커밋**

```bash
git add build.mjs src/art/palette.cjs src/art/art.cjs src/main.cjs prototype/index.html
git commit -m "feat(art): M1 스캐폴드 — 마스터 16색 팔레트 + art/ star 토폴로지 + build 중복 require 가드"
```

---

### Task 2: pixel.cjs 프리미티브 + sprites.cjs (핍/랭크 글리프/배지)

**Files:**
- Create: `src/art/pixel.cjs`, `src/art/sprites.cjs`
- Modify: `src/art/art.cjs`(require 2줄 추가), `src/main.cjs`(없음 — 파사드 export만 경유)

**Interfaces:**
- Consumes: `ART_PAL`, `ART_C` (concat 전역)
- Produces (concat 전역):
  - `artGrid(w,h) -> {w,h,px:Uint8Array}` · `artSet(g,x,y,c)` · `artRect(g,x,y,w,h,c)` · `artFrame(g,x,y,w,h,c)`
  - `artStamp(g,x,y,rows,c)` — rows=문자열 배열, `"X"`=색 c, `"."`=투명 유지
  - `artStamp180(g,x,y,rows,c)` — 180° 회전 스탬프(코너 br용)
  - `artPaint(g,palHex) -> HTMLCanvasElement` — 그리드를 1:1 픽셀 캔버스로 페인트(palHex 인자로 CVD 변환 팔레트 주입 가능)
  - `ART_GLYPH` — `{A,2..8}` → 3×5 rows · `ART_PIP` — `[suit][size]` (suit 0~3=♠♥♦♣, size 9|7|5) → rows · `ART_BADGE` — `{wild,gold,mult}` → 5×5 rows

- [ ] **Step 1: src/art/pixel.cjs 작성** (전문)

```js
// src/art/pixel.cjs — 픽셀 그리드 조립(팔레트 인덱스) + 캔버스 페인트 분리 (spec §2).
// 분리 이유: CVD 시뮬(sheet.cjs)이 같은 그리드를 변환 팔레트로 재페인트. ART_PAL은 palette.cjs(concat 전역).
function artGrid(w,h){ return {w:w,h:h,px:new Uint8Array(w*h)}; }
function artSet(g,x,y,c){ if(x>=0&&y>=0&&x<g.w&&y<g.h) g.px[y*g.w+x]=c; }
function artRect(g,x,y,w,h,c){ for(let j=0;j<h;j++) for(let i=0;i<w;i++) artSet(g,x+i,y+j,c); }
function artFrame(g,x,y,w,h,c){ artRect(g,x,y,w,1,c); artRect(g,x,y+h-1,w,1,c); artRect(g,x,y,1,h,c); artRect(g,x+w-1,y,1,h,c); }
function artStamp(g,x,y,rows,c){ for(let j=0;j<rows.length;j++){ const r=rows[j]; for(let i=0;i<r.length;i++) if(r[i]==="X") artSet(g,x+i,y+j,c); } }
function artStamp180(g,x,y,rows,c){ const H=rows.length,W=rows[0].length; for(let j=0;j<H;j++){ const r=rows[H-1-j]; for(let i=0;i<W;i++) if(r[W-1-i]==="X") artSet(g,x+i,y+j,c); } }
function artPaint(g,palHex){ const cv=document.createElement("canvas"); cv.width=g.w; cv.height=g.h; const cx=cv.getContext("2d"); for(let j=0;j<g.h;j++) for(let i=0;i<g.w;i++){ const p=g.px[j*g.w+i]; if(p){ cx.fillStyle=palHex[p]; cx.fillRect(i,j,1,1); } } return cv; }
module.exports = { artGrid, artSet, artRect, artFrame, artStamp, artStamp180, artPaint };
```

- [ ] **Step 2: src/art/sprites.cjs 작성** — 3×5 랭크 글리프 + 무늬 핍 3사이즈 + enh 배지. 아래 초안을 그대로 넣고, Task 6 시각 이터레이션에서 형태만 다듬는다(크기·키 이름 불변).

```js
// src/art/sprites.cjs — 비트맵 어휘(rows 인코딩: "X"=칠함, "."=투명). 색은 스탬프 시 주입.
const ART_GLYPH={
  A:[".X.","X.X","XXX","X.X","X.X"],
  2:["XX.","..X",".X.","X..","XXX"],
  3:["XX.","..X",".X.","..X","XX."],
  4:["X.X","X.X","XXX","..X","..X"],
  5:["XXX","X..","XX.","..X","XX."],
  6:[".XX","X..","XX.","X.X",".X."],
  7:["XXX","..X",".X.",".X.",".X."],
  8:[".X.","X.X",".X.","X.X",".X."],
};
const ART_PIP={
  0:{ 9:["....X....","...XXX...","..XXXXX..",".XXXXXXX.","XXXXXXXXX","XXXXXXXXX",".XX.X.XX.","....X....","...XXX..."],
      7:["...X...","..XXX..",".XXXXX.","XXXXXXX","XXXXXXX","...X...",".XXXXX."],
      5:["..X..",".XXX.","XXXXX","..X..",".XXX."] },
  1:{ 9:[".XX...XX.","XXXX.XXXX","XXXXXXXXX","XXXXXXXXX",".XXXXXXX.","..XXXXX..","...XXX...","....X....","........."],
      7:[".XX.XX.","XXXXXXX","XXXXXXX",".XXXXX.","..XXX..","...X...","......."],
      5:[".X.X.","XXXXX","XXXXX",".XXX.","..X.."] },
  2:{ 9:["....X....","...XXX...","..XXXXX..",".XXXXXXX.","XXXXXXXXX",".XXXXXXX.","..XXXXX..","...XXX...","....X...."],
      7:["...X...","..XXX..",".XXXXX.","XXXXXXX",".XXXXX.","..XXX..","...X..."],
      5:["..X..",".XXX.","XXXXX",".XXX.","..X.."] },
  3:{ 9:["...XXX...","..XXXXX..","...XXX...",".XX.X.XX.","XXXXXXXXX","XXXXXXXXX",".XX.X.XX.","....X....","...XXX..."],
      7:["..XXX..",".XXXXX.","..XXX..","XXXXXXX","XXXXXXX","...X...",".XXXXX."],
      5:[".XXX.","XXXXX","..X..","XXXXX",".XXX."] },
};
const ART_BADGE={
  wild:["..X..",".XXX.","XXXXX",".XXX.","X.X.X"],
  gold:[".XXX.","XXXXX","XXXXX","XXXXX",".XXX."],
  mult:["..X..",".XXX.","XXXXX",".XXX.","..X.."],
};
module.exports = { ART_GLYPH, ART_PIP, ART_BADGE };
```

- [ ] **Step 3: art.cjs 파사드에 require·export 추가** — 최종 형태:

```js
const { ART_PAL, ART_C, ART_ACCENT } = require('./palette.cjs');
const { artGrid, artSet, artRect, artFrame, artStamp, artStamp180, artPaint } = require('./pixel.cjs');
const { ART_GLYPH, ART_PIP, ART_BADGE } = require('./sprites.cjs');
module.exports = { ART_PAL, ART_C, ART_ACCENT, artGrid, artSet, artRect, artFrame, artStamp, artStamp180, artPaint, ART_GLYPH, ART_PIP, ART_BADGE };
```
(main.cjs require 줄의 destructure는 이 시점엔 늘릴 필요 없음 — main이 직접 쓰는 심볼이 생기는 태스크에서만 늘린다. concat 전역이라 미열거 심볼도 스코프엔 존재하나, **main.cjs가 소비하는 심볼은 require 줄에 명시**를 규약으로 유지.)

- [ ] **Step 4: 빌드 + 문법 게이트**

Run: `node build.mjs && node tools/balance-check.cjs`
Expected: 빌드 성공 + 기준선 불변.

- [ ] **Step 5: 커밋**

```bash
git add src/art/pixel.cjs src/art/sprites.cjs src/art/art.cjs prototype/index.html
git commit -m "feat(art): 픽셀 프리미티브(그리드/페인트 분리) + 무늬 핍·랭크 글리프·enh 배지 비트맵"
```

---

### Task 3: cards.cjs 카드 페이스 + cardEl 전환 + CSS

**Files:**
- Create: `src/art/cards.cjs`
- Modify: `src/art/art.cjs`(require 1줄), `src/main.cjs`(cardEl L407-414 + require destructure), `src/styles.css`

**Interfaces:**
- Consumes: `artGrid/artRect/artFrame/artStamp/artStamp180/artPaint`, `ART_PAL/ART_C`, `ART_GLYPH/ART_PIP/ART_BADGE`
- Produces: `artDrawCardFace(card) -> HTMLCanvasElement` (card={suit,rank,enh} — 25×36, faceCache 경유 신규 canvas 반환) · `artFaceHTML(card,cls) -> string` (`<canvas class="cface {cls}" data-cf="s,r,e">` 하이드레이션용) · `artHydrate(root)` 1차 버전(data-cf만; data-em은 Task 4에서 확장)

- [ ] **Step 1: src/art/cards.cjs 작성** (전문 — 좌표는 spec §4 재검산 확정치)

```js
// src/art/cards.cjs — 카드 페이스 25×36 (spec §4). 코너=랭크 글리프만(무늬는 중앙 핍+색이 전달).
// 핍 레이아웃: 중앙 존 x∈[6,18]·y∈[6,28] 내, 같은 색이라 모서리 픽셀 접촉 무해.
const ART_PIPLAY={
  1:[[8,13,9]],
  2:[[9,8,7],[9,21,7]],
  3:[[9,6,7],[9,14,7],[9,22,7]],
  4:[[6,9,5],[14,9,5],[6,21,5],[14,21,5]],
  5:[[6,9,5],[14,9,5],[10,15,5],[6,21,5],[14,21,5]],
  6:[[6,6,5],[14,6,5],[6,15,5],[14,15,5],[6,24,5],[14,24,5]],
  7:[[6,6,5],[14,6,5],[10,10,5],[6,15,5],[14,15,5],[6,24,5],[14,24,5]],
  8:[[6,6,5],[14,6,5],[6,12,5],[14,12,5],[6,18,5],[14,18,5],[6,24,5],[14,24,5]],
};
const ART_ENH_COL={wild:"green",gold:"gold",mult:"purple"};
const artFaceCache=new Map();
function artFaceGrid(suit,rank,enh){
  const g=artGrid(25,36);
  artRect(g,0,0,25,36,ART_C.paper); artFrame(g,0,0,25,36,ART_C.soft); artFrame(g,1,1,23,34,ART_C.shade);
  const ink=(suit===1||suit===2)?ART_C.red:ART_C.ink;
  const gl=ART_GLYPH[rank===1?"A":String(rank)];
  artStamp(g,2,2,gl,ink); artStamp180(g,20,29,gl,ink);
  for(const p of ART_PIPLAY[rank]) artStamp(g,p[0],p[1],ART_PIP[suit][p[2]],ink);
  if(enh){ const ec=ART_C[ART_ENH_COL[enh]];
    artRect(g,2,0,21,1,ec); artRect(g,2,35,21,1,ec); artRect(g,0,2,1,32,ec); artRect(g,24,2,1,32,ec);
    artRect(g,17,1,7,7,ART_C.navy); artStamp(g,18,2,ART_BADGE[enh],ec); }
  return g;
}
function artDrawCardFace(card){
  const k=card.suit+":"+card.rank+":"+(card.enh||"");
  let src=artFaceCache.get(k);
  if(!src){ src=artPaint(artFaceGrid(card.suit,card.rank,card.enh||null),ART_PAL); artFaceCache.set(k,src); }
  const cv=document.createElement("canvas"); cv.width=25; cv.height=36;
  cv.getContext("2d").drawImage(src,0,0); return cv;
}
function artFaceHTML(card,cls){ return `<canvas class="cface${cls?" "+cls:""}" width="25" height="36" data-cf="${card.suit},${card.rank},${card.enh||""}"></canvas>`; }
function artHydrate(root){
  root.querySelectorAll("canvas[data-cf]").forEach(cv=>{ const a=cv.getAttribute("data-cf").split(","); const card={suit:+a[0],rank:+a[1],enh:a[2]||null}; const k=card.suit+":"+card.rank+":"+(card.enh||"");
    let src=artFaceCache.get(k); if(!src){ src=artPaint(artFaceGrid(card.suit,card.rank,card.enh),ART_PAL); artFaceCache.set(k,src); }
    cv.getContext("2d").drawImage(src,0,0); cv.removeAttribute("data-cf"); });
}
module.exports = { artDrawCardFace, artFaceHTML, artHydrate };
```
(주의: artHydrate는 Task 4에서 data-em 처리 분기를 **같은 함수 안에** 추가 확장한다.)

- [ ] **Step 2: art.cjs에 require·export 추가**

```js
const { artDrawCardFace, artFaceHTML, artHydrate } = require('./cards.cjs');
```
export 목록에 `artDrawCardFace, artFaceHTML, artHydrate` 추가.

- [ ] **Step 3: main.cjs cardEl 전환** — L407-414를 다음으로 교체 (컨테이너 클래스 로직 전부 보존, .corner/.center/.enh DOM 생성 제거):

```js
function cardEl(card){
  const el=document.createElement("div"); el.className="pcard "+(isRed(card.suit)?"red":"black")+(cardSealed(card)?" sealed":"");
  el.appendChild(artDrawCardFace(card));   // 절차적 픽셀 페이스(v-art M1) — 표시 전용, 로직 무접촉
  return el;
}
```
main.cjs의 art require destructure에 `artDrawCardFace, artFaceHTML, artHydrate` 추가.

- [ ] **Step 4: styles.css** — `.pcard` 블록 근처에 추가 + 종횡비 통일(spec §4):

```css
.pcard canvas{position:absolute; inset:0; width:100%; height:100%; display:block; image-rendering:pixelated; border-radius:inherit}
```
`.hcard .pcard{width:62px; height:88px}` → `.hcard .pcard{width:62px; height:auto; aspect-ratio:25/36}`
덱픽커 `.pcard` 크기 규칙(42×60 계열, styles.css ~L144)을 찾아 `height:auto; aspect-ratio:25/36`로 동일 통일. 기존 `.pcard .corner/.center/.enh` 규칙은 **존치**(dead화되나 삭제는 별도 커밋 — spec §6.7).

- [ ] **Step 5: 빌드 + 게이트**

Run: `node build.mjs && node tools/balance-check.cjs`
Expected: 빌드 성공, 클리어율 기준선 불변(카드 전환은 표시 전용).

- [ ] **Step 6: 커밋**

```bash
git add src/art/cards.cjs src/art/art.cjs src/main.cjs src/styles.css prototype/index.html
git commit -m "feat(art): 절차적 픽셀 카드 페이스 32종 — cardEl canvas 전환 + faceCache + 종횡비 25:36 통일"
```

---

### Task 4: charmart.cjs 엠블럼 22종 + charms.cjs art 필드 + 부적 표면 통합

**Files:**
- Create: `src/art/charmart.cjs`
- Modify: `src/art/art.cjs`(require 1줄), `src/content/charms.cjs`(art 필드 22개), `src/art/cards.cjs`(artHydrate에 data-em 분기 추가), `src/main.cjs`(ctag/renderShop/charmsHTML/deckHTML/pickSuitToAdd/openDrawer), `src/styles.css`(엠블럼 정렬)

**Interfaces:**
- Consumes: pixel/sprites 전역, `ART_ACCENT`, `ART_C`
- Produces: `artDrawCharmEmblem(art,cluster,locked) -> HTMLCanvasElement(16×16)` · `artEmblemHTML(c,locked,px) -> string` (`<canvas class="cemblem" data-em="shape,symbol,accent,locked" style="width:{px}px;height:{px}px">`) · artHydrate가 data-em도 페인트

- [ ] **Step 1: charms.cjs — 22종에 art 필드 추가** (spec §5 표 = SSoT. hooks·cost·cluster 무변경, 필드만 추가). 매핑 (id → shape/symbol/accent):

```
greed:coin/stack/bronze      pyro:shield/flame/red       suited:banner/pips2/steel
runner:banner/ascend/green   jackpot:coin/burst/white    noir:diamond/spademoon/ink
broker:coin/scales/steel     twins:plate/twindots/white  compactor:plate/press/ink
runts:shield/sprout/green    bridge:plate/arch/steel     stair:shield/steps/steel
keystone:diamond/keystone/steel  lapidary:gem/chisel/cyan  prism:diamond/prism/cyan
jewelbox:plate/box/cyan      highmult:shield/peak/gold   magnate:coin/ingot/gold
echo:banner/waves/orange     loaded:diamond/dice/orange  climax:shield/bolt/orange
twotone:diamond/halves/red
```
각 레코드에 예시처럼: `{id:"greed", ..., art:{shape:"coin",symbol:"stack",accent:"bronze"},` (accent는 클러스터 부적도 명시 — §5 표가 SSoT).

- [ ] **Step 2: src/art/charmart.cjs 작성** — 틀 6종은 코드 드로잉, 심볼 22종은 10×10 비트맵. 아래 골격 + 예시 4심볼을 그대로 쓰고, 나머지 18심볼은 spec §5 모티프 표대로 같은 인코딩으로 저작(Task 6 시각 이터레이션으로 다듬기 — 키 이름·크기 불변):

```js
// src/art/charmart.cjs — 부적 엠블럼 16×16 (spec §5). navy 바탕+slate 보더+accent.
// (shape,accent) 조합 22종 유니크 = 구분성 1차 규칙. locked=ink-soft 실루엣.
const ART_SHAPE={
  shield:(g,c)=>{ artRect(g,3,2,10,9,c); artRect(g,4,11,8,2,c); artRect(g,6,13,4,1,c); },
  coin:(g,c)=>{ artRect(g,4,2,8,12,c); artRect(g,2,4,12,8,c); artRect(g,3,3,10,10,c); },
  banner:(g,c)=>{ artRect(g,3,2,10,11,c); artRect(g,3,13,4,1,c); artRect(g,9,13,4,1,c); },
  plate:(g,c)=>{ artRect(g,2,4,12,9,c); },
  diamond:(g,c)=>{ for(let j=0;j<6;j++){ artRect(g,8-1-j,2+j,2+2*j,1,c); artRect(g,8-1-j,13-j,2+2*j,1,c); } artRect(g,2,8,12,1,c); },
  gem:(g,c)=>{ artRect(g,5,2,6,1,c); artRect(g,3,3,10,4,c); artRect(g,4,7,8,3,c); artRect(g,6,10,4,2,c); artRect(g,7,12,2,1,c); },
};
const ART_SYMBOL={
  flame:["....X.....","...XX.....","...XXX....","..XXXX....",".XXXXXX...",".XX.XXX...","XXX.XXXX..","XXXXXXXX..",".XXXXXX...","..XXXX...."],
  arch:["..........","XXXXXXXXXX","X..XXXX..X","..XX..XX..",".XX....XX.",".X......X.","XX......XX","X........X","X........X",".........."],
  steps:[".......XXX",".......X..","....XXXX..","....X.....",".XXXX.....",".X........","XX........","X.........","X.........","XXXXXXXXXX"],
  scales:["....X.....","..XXXXX...",".X..X..X..","X...X...X.","XXX.X.XXX.",".X..X..X..","....X.....","....X.....","...XXX....","..XXXXX..."],
};
function artDrawCharmEmblem(art,cluster,locked){
  const g=artGrid(16,16);
  artRect(g,0,0,16,16,ART_C.navy); artFrame(g,0,0,16,16,ART_C.slate);
  const ac=locked?ART_C.soft:ART_C[art.accent];
  ART_SHAPE[art.shape](g,ac);
  const inner=locked?ART_C.navy:ART_C.navy;
  // 심볼은 틀 위에 navy로 음각 후 하이라이트 — 가독을 위해 2패스(그림자+본체)
  const sym=ART_SYMBOL[art.symbol]||ART_SYMBOL.flame;
  artStamp(g,3,3,sym,locked?ART_C.ink:ART_C.navy);
  return artPaint(g,ART_PAL);
}
function artEmblemHTML(c,locked,px){ const a=c.art; return `<canvas class="cemblem" width="16" height="16" style="width:${px}px;height:${px}px" data-em="${a.shape},${a.symbol},${a.accent},${locked?1:0}"></canvas>`; }
module.exports = { ART_SHAPE, ART_SYMBOL, artDrawCharmEmblem, artEmblemHTML };
```
나머지 18심볼(stack/pips2/ascend/burst/spademoon/twindots/press/sprout/keystone/chisel/prism/box/peak/ingot/waves/dice/bolt/halves)도 같은 10×10 rows 인코딩으로 이 객체에 추가 저작한다 — 모티프는 spec §5 표(동전더미/동일핍2/오름화살/별폭발/스페이드달/쌍점II/압착기/새싹/쐐기돌/정+보석/프리즘삼각/보석함/산정상/금괴/음파겹원/주사위/번개/반반원). 저작 기준: 10×10 내 인식 가능한 단순 실루엣, 좌우 3px 시야에서도 구분(컨택트 시트로 검증).

- [ ] **Step 3: cards.cjs artHydrate에 data-em 분기 추가** — artHydrate 함수 끝에:

```js
  root.querySelectorAll("canvas[data-em]").forEach(cv=>{ const a=cv.getAttribute("data-em").split(",");
    const src=artDrawCharmEmblem({shape:a[0],symbol:a[1],accent:a[2]},null,a[3]==="1");
    cv.getContext("2d").drawImage(src,0,0); cv.removeAttribute("data-em"); });
```

- [ ] **Step 4: art.cjs require·export 추가**

```js
const { ART_SHAPE, ART_SYMBOL, artDrawCharmEmblem, artEmblemHTML } = require('./charmart.cjs');
```
export에 `artDrawCharmEmblem, artEmblemHTML` 추가. main.cjs require destructure에도 `artEmblemHTML` 추가.

- [ ] **Step 5: main.cjs 부적 표면 통합** (전부 표시 전용):

1. **HUD ctag** (L457): `` S.owned.map(id=>{const c=CHARMS.find(x=>x.id===id); return `<span class="ctag">${artEmblemHTML(c,false,18)}${c.name}</span>`;}).join("") `` 로 교체하고, 직후 `artHydrate(document.getElementById("charms"));` 호출.
2. **상점 오퍼** (renderShop): charm 타입일 때 `.on` 앞에 `p.type==="charm"?artEmblemHTML(p.charm,false,24):""` 삽입, `body.appendChild(off);` 뒤 `artHydrate(body);`.
3. **컬렉션** (charmsHTML): 해금 줄 `<b class="hname">` 앞에 `artEmblemHTML(c,false,20)`, 미해금 줄엔 `artEmblemHTML(c,true,20)`(locked 실루엣 — 🔒 이모지·？？？ 텍스트는 유지).
4. **덱 뷰어** (deckHTML L568): `cs.map(mcEnh).join("")` → `cs.map(c=>artFaceHTML(c,"mini")).join("")` (mcEnh 함수 자체는 존치 — 다른 곳 미사용이어도 삭제는 별도 커밋).
5. **openDrawer**: `document.getElementById("drawerBody").innerHTML=...` 직후 `artHydrate(document.getElementById("drawerBody"));`.
6. **무늬픽커** (pickSuitToAdd L389): `<div class="on" ...>${su.g}</div>` → 대형 핍 canvas: `<canvas class="cface suitpick" width="9" height="9" data-pip="${su.k}"></canvas>` 방식 대신 **간단히** `artFaceHTML({suit:su.k,rank:8,enh:null},"suitpick")`(rank8 대표 카드 — 추가되는 카드가 7~8랭크임을 시각화)로 교체하고 grid 직후 `artHydrate(grid)`.

- [ ] **Step 6: styles.css 엠블럼 정렬**

```css
canvas.cemblem{image-rendering:pixelated; vertical-align:-3px; margin-right:4px}
canvas.cface.mini{width:26px; height:37px; image-rendering:pixelated}
canvas.cface.suitpick{width:50px; height:72px; image-rendering:pixelated}
```

- [ ] **Step 7: 빌드 + 게이트** — Run: `node build.mjs && node tools/balance-check.cjs && node tools/unlock-check.cjs`
Expected: 전부 통과(art 필드는 불활성 데이터 — unlock-check의 CHARMS 소비도 무영향).

- [ ] **Step 8: 커밋**

```bash
git add src/art/charmart.cjs src/art/cards.cjs src/art/art.cjs src/content/charms.cjs src/main.cjs src/styles.css prototype/index.html
git commit -m "feat(art): 부적 엠블럼 22종((shape,accent) 유니크) + 부적/덱뷰어/무늬픽커 표면 픽셀 전환 + artHydrate"
```

---

### Task 5: sheet.cjs 컨택트 시트 + CVD 시뮬 + 부트 분기

**Files:**
- Create: `src/art/sheet.cjs`
- Modify: `src/art/art.cjs`(require 1줄), `src/main.cjs`(부트 꼬리 분기 L626-637 + require destructure)

**Interfaces:**
- Consumes: 전 art 전역 + `CHARMS`(concat 전역 — sheet는 main보다 먼저 인라인되지만 **호출이 부트 시점**이라 TDZ 무관: CHARMS는 const 선언이 sheet 함수 정의보다 뒤여도 호출 시엔 초기화 완료)
- Produces: `artContactSheet(root)` — 팔레트 스와치 / 32 페이스 + enh 3변형 / 엠블럼 22(일반+locked) / CVD 3종(protan/deutan/tritan) 팔레트·엠블럼 재페인트 그리드

- [ ] **Step 1: src/art/sheet.cjs 작성** (전문)

```js
// src/art/sheet.cjs — 컨택트 시트(?art=sheet, spec §6.8/§7.4). CVD=Viénot/Machado 근사 행렬(개발 검수용).
const ART_CVD={
  protan:[0.152286,1.052583,-0.204868,0.114503,0.786281,0.099216,-0.003882,-0.048116,1.051998],
  deutan:[0.367322,0.860646,-0.227968,0.280085,0.672501,0.047413,-0.011820,0.042940,0.968881],
  tritan:[1.255528,-0.076749,-0.178779,-0.078411,0.930809,0.147602,0.004733,0.691367,0.303900],
};
function artCvdPal(m){ return ART_PAL.map(h=>{ if(!h) return h; const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);
  const c=v=>Math.max(0,Math.min(255,Math.round(v)));
  return "#"+[c(m[0]*r+m[1]*g+m[2]*b),c(m[3]*r+m[4]*g+m[5]*b),c(m[6]*r+m[7]*g+m[8]*b)].map(v=>v.toString(16).padStart(2,"0")).join(""); }); }
function artSheetSection(root,title){ const h=document.createElement("h3"); h.textContent=title; h.style.cssText="color:#cdd6f5;font:14px monospace;margin:14px 4px 6px"; root.appendChild(h); const d=document.createElement("div"); d.style.cssText="display:flex;flex-wrap:wrap;gap:4px;align-items:flex-start"; root.appendChild(d); return d; }
function artSheetCanvas(box,cv,scale,label){ cv.style.cssText=`width:${cv.width*scale}px;height:${cv.height*scale}px;image-rendering:pixelated`; const w=document.createElement("div"); w.style.cssText="text-align:center;font:9px monospace;color:#8a93b6"; w.appendChild(cv); if(label){ const t=document.createElement("div"); t.textContent=label; w.appendChild(t);} box.appendChild(w); }
function artContactSheet(root){
  root.innerHTML=""; root.style.cssText="background:#0b0e1d;min-height:100vh;padding:10px";
  const pal=artSheetSection(root,"ART_PAL 16");
  for(let i=1;i<ART_PAL.length;i++){ const g=artGrid(12,12); artRect(g,0,0,12,12,i); artSheetCanvas(pal,artPaint(g,ART_PAL),3,String(i)); }
  const faces=artSheetSection(root,"카드 32 + enh");
  for(let s=0;s<4;s++) for(let r=1;r<=8;r++) artSheetCanvas(faces,artDrawCardFace({suit:s,rank:r,enh:null}),2);
  ["wild","gold","mult"].forEach(e=>artSheetCanvas(faces,artDrawCardFace({suit:0,rank:1,enh:e}),2,e));
  const emb=artSheetSection(root,"엠블럼 22 (+locked)");
  for(const c of CHARMS){ artSheetCanvas(emb,artDrawCharmEmblem(c.art,c.cluster||null,false),3,c.id); }
  for(const c of CHARMS){ artSheetCanvas(emb,artDrawCharmEmblem(c.art,c.cluster||null,true),3); }
  for(const k in ART_CVD){ const p=artCvdPal(ART_CVD[k]); const sec=artSheetSection(root,"CVD "+k);
    for(let i=1;i<ART_PAL.length;i++){ const g=artGrid(12,12); artRect(g,0,0,12,12,i); artSheetCanvas(sec,artPaint(g,p),3,String(i)); }
    for(const c of CHARMS){ const g=artGrid(16,16); artRect(g,0,0,16,16,ART_C.navy); artFrame(g,0,0,16,16,ART_C.slate); ART_SHAPE[c.art.shape](g,ART_C[c.art.accent]); artStamp(g,3,3,ART_SYMBOL[c.art.symbol]||ART_SYMBOL.flame,ART_C.navy); artSheetCanvas(sec,artPaint(g,p),3,c.id); } }
}
module.exports = { artContactSheet };
```
(참고: CVD 섹션 엠블럼은 artDrawCharmEmblem이 ART_PAL로 즉시 페인트하므로 grid 조립을 반복한다 — 그리드/페인트 분리의 소비처.)

- [ ] **Step 2: art.cjs require·export + main.cjs destructure에 `artContactSheet` 추가**

- [ ] **Step 3: main.cjs 부트 분기** — 부트 꼬리(L626~637: jsonp×2·checkUnlocks·registerScreen들·showScreen('title')·selDeck 초기화)를 실측 확인 후 다음 구조로 감싼다 (const 선언이 있으면 가드 밖으로 호이스팅해 스코프 보존):

```js
if(/[?&]art=sheet(&|$)/.test(location.search)){ artContactSheet(document.body); }   // 컨택트 시트 모드(spec §6.8) — jsonp·해금소급·화면등록 전부 스킵(네트워크 발화 0)
else {
  /* 기존 부트 꼬리 원문 그대로 */
}
```

- [ ] **Step 4: 빌드 + 게이트** — Run: `node build.mjs && node tools/balance-check.cjs`
Expected: 통과.

- [ ] **Step 5: 커밋**

```bash
git add src/art/sheet.cjs src/art/art.cjs src/main.cjs prototype/index.html
git commit -m "feat(art): 컨택트 시트(?art=sheet) + CVD 3종 시뮬 — 구분성/색약 검수 표면"
```

---

### Task 6: 통합 검증 + 시각 이터레이션 (오케스트레이터 주관)

**Files:** (수정 발생 시) `src/art/sprites.cjs`, `src/art/charmart.cjs`, `src/art/palette.cjs`

- [ ] **Step 1:** `node build.mjs && node tools/balance-check.cjs && node tools/economy-check.cjs && node tools/unlock-check.cjs` → 전부 PASS
- [ ] **Step 2:** `npm run gate` (--fast) → 9/9 GREEN (기준선 2026-07-14 재현 — RED면 아트가 로직을 건드린 것, 원인 수정)
- [ ] **Step 3:** 헤드리스 브라우저로 `prototype/index.html` 로드 → **콘솔 에러 0**(concat 중복선언 회귀 게이트) + 타이틀→런 진입 스크린샷(카드 8칸+손패 픽셀 렌더 확인) + 상점/드로어(덱뷰어·컬렉션) 스크린샷
- [ ] **Step 4:** `?art=sheet` 스크린샷 → 32 페이스 판독(모바일 배율 감안 50% 축소본도 확인)·엠블럼 22 상호 구분(특히 steel 5종)·CVD 3종에서 클러스터 3색(cyan/gold/orange) 구분(gold↔orange는 휘도차 — 불충분하면 palette.cjs hex 캘리브 후 재확인, spec §8 수용 기준)
- [ ] **Step 5:** 판독 불량 비트맵 발견 시 해당 rows만 수정(sprites/charmart) → Step 1·3·4 반복 (레이아웃·키·API 불변)
- [ ] **Step 6:** 최종 재빌드 + 커밋 + push (이 레포는 main 직접 push가 정상 — memory `git-direct-main`; push=Pages 배포)

```bash
node build.mjs
git add -A src/ prototype/index.html
git commit -m "polish(art): 시각 이터레이션 — 컨택트시트/CVD 검수 반영"
git push origin main
```

---

## Self-Review 결과 (계획 저자 체크)

1. **Spec coverage**: §2 모듈 7종=Task 1~5, §3 팔레트+CVD 기준=Task 1·5·6(Step 4), §4 카드=Task 3(rank4 좌표는 §4의 산술 오류를 재검산 정정 — 2열 7×7은 x예산 13px 초과라 5×5 2열, spec의 "구현 재량 조정" 범위), §5 엠블럼=Task 4, §6 통합 8지점=Task 3(1)·4(2~6)·5(8) — §6.7 CSS 존치 명시, §7 검증=각 태스크 말미+Task 6.
2. **Placeholder**: 18개 엠블럼 심볼 비트맵은 "같은 인코딩으로 저작+시트 검증"이 작업 정의(모티프 표·기준 명시) — 코드 골격/예시 4종 제공. 그 외 전 단계 실코드.
3. **Type consistency**: artDrawCardFace(card)/artFaceHTML(card,cls)/artHydrate(root)/artDrawCharmEmblem(art,cluster,locked)/artEmblemHTML(c,locked,px)/artContactSheet(root) — Task 간 시그니처 일치 확인.
