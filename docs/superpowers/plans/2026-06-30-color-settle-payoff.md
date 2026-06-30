# 색 settle 페이오프 "투톤"(duochrome) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 색축(빨강 ♥♦ / 검정 ♠♣)에 settle 가산 페이오프 부적 1종 "투톤"을 추가해 pyro/noir와 2-레이어 빌드를 완성한다.

**Architecture:** 순수 정산 가산(connect 무건드림). 한 색으로 치우치고(dom) 그 색 두 무늬가 모두 있으면 `blindBase × K × (dom−thr)` 가산, 순수 플러시(한 무늬)는 게이트로 제외. run-sim.cjs(권위)에서 먼저 구현·캘리브 후 index.html에 값 미러(2파일). cluster 무태그(베이스 풀).

**Tech Stack:** vanilla JS 단일 파일(`prototype/index.html`) + node 시뮬 검증 스크립트(`.cjs`). 테스트 프레임워크 없음 — 검증 = run-sim/balance-check/unlock-check/economy-check 실행 + DOM 스모크.

**설계 SSoT:** `docs/superpowers/specs/2026-06-30-color-settle-payoff-design.md`

---

## File Structure

- **Modify `tools/run-sim.cjs`** (밸런스 권위 + 캘리브): CHARMS 목록 / handBonus 투톤 메트릭 / color strat / applyOne add 색분기 / STRAT_KO. 캘리브가 여기서 일어나고 최종 K·thr를 확정.
- **Modify `prototype/index.html`** (게임): CHARMS 항목 / settle 가산 블록(L515 뒤) / UNLOCKS 항목(L366 뒤). 투톤 메트릭은 run-sim과 **값·식 일치 미러**. 드로어/상점은 CHARMS+UNLOCKS로 자동 배선.
- **Modify `tools/unlock-check.cjs`** (해금 검증): UNLOCKS 투톤 cond + eq() 테스트.
- **Modify `HANDOVER.md` / `CLAUDE.md` / `docs/PLAN.md`** (문서): v3.27 항목·드리프트 지점.

**드리프트 가드:** 투톤 settle 식의 K·thr·cap이 `run-sim.cjs` ↔ `index.html` 일치. cluster 무태그(CLUSTER 맵 무변경). connect 무건드림 → balance-check/strategy-sim/hand-frequency 미동기화(구부적 기준, run-sim 단독 권위).

---

## Task 1: run-sim.cjs — 투톤 handBonus + color strat (시작값)

**Files:**
- Modify: `tools/run-sim.cjs` (CHARMS L111 · handBonus paritybet 뒤 L85 · STRATS parity 뒤 L135 · applyOne add L150 · STRAT_KO L199)

- [ ] **Step 1: CHARMS 목록에 twotone 추가**

`tools/run-sim.cjs` L111의 CHARMS 배열 끝(`"paritybet"` 뒤)에 추가:

```javascript
const CHARMS=["greed","pyro","suited","runner","jackpot","noir","broker","twins","compactor","runts","bridge","stair","keystone","lapidary","prism","jewelbox","highmult","magnate","echo","loaded","climax","evenodd","paritybet","twotone"];
```

- [ ] **Step 2: handBonus에 투톤 메트릭 추가**

`paritybet` 줄(L85) **바로 뒤**에 삽입:

```javascript
  if(owned&&owned.includes("twotone")){ let h=0,d=0,s=0,c=0; for(const x of row){ if(x.enh==="wild")continue; if(x.suit===1)h++; else if(x.suit===2)d++; else if(x.suit===0)s++; else c++; } const red=h+d,black=s+c,dom=Math.max(red,black); const bothSuits=red>=black?(h>0&&d>0):(s>0&&c>0); if(bothSuits) hb+=Math.round(blindBase(ante)*0.04*Math.max(0,Math.min(dom,8)-4)); }   // 투톤: 두 무늬 섞은 단색 치우침(순수 플러시 제외)
```

- [ ] **Step 3: color strat 추가**

`STRATS` 객체의 `parity:` 줄(L135) 뒤에 추가:

```javascript
  color:  { charm:{twotone:10,pyro:9,greed:5,suited:4,jackpot:4}, enh:{wild:3,mult:4,gold:3}, item:{add:8,thin:5,hand:5,copy:3,reroll:1} },   // 색(투톤+발화) 빌드 — 대표 빨강 경로
```

- [ ] **Step 4: applyOne add 색분기 확장**

L150의 `add` 분기 suit 결정 삼항을 교체:

```javascript
  else if(o.type==="add") { const suit=strat==="flush"?1:strat==="black"?(ri(2)?0:3):strat==="color"?(ri(2)?1:2):ri(4); d.push({suit,rank:7+ri(2),enh:null}); }
```

- [ ] **Step 5: STRAT_KO에 color 추가**

L199의 STRAT_KO 객체에 `color:"색(투톤) 빌드"` 추가(끝에):

```javascript
const STRAT_KO={balance:"밸런스 빌드",flush:"플러시 빌드",black:"흑심(검정/2색) 빌드",jokbo:"족보(중개상+쌍둥이) 빌드",compact:"압축(정련가+잔챙이) 빌드",spatial:"위치-맥락(다리+계단+주춧돌) 빌드",gem:"보석세공(enh 스태킹) 빌드",apex:"정점(고랭크 7·8) 빌드",cartel:"같은수 카르텔 빌드",parity:"홀짝 패리티 빌드",color:"색(투톤) 빌드"};
```

- [ ] **Step 6: 실행해서 color strat·기준선 관찰**

Run: `node tools/run-sim.cjs 2>&1 | grep -A1 "색(투톤)"` 그리고 `node tools/run-sim.cjs 2>&1 | grep "St0:"`

Expected: `=== 전략: 색(투톤) 빌드 ===` 섹션이 클리어율과 함께 출력(에러 0). St0 라인 출력. (수치 판정은 Task 2.)

- [ ] **Step 7: Commit**

```bash
git add tools/run-sim.cjs
git commit -m "feat(sim): 투톤(색 settle) handBonus + color strat (시작값 K=0.04/thr=4)"
```

---

## Task 2: 캘리브레이션 (K·thr 확정)

**Files:**
- Modify: `tools/run-sim.cjs` (필요 시 handBonus 투톤의 0.04 / -4 만)

게이트(run-sim 권위, N=20000):
- **①무인플레**: balance 빌드 St0 클리어가 기준선 **7.6% ±0.5pp** 유지(투톤이 비특화 빌드 인플레 금지).
- **②비지배**: color strat 클리어가 **balance(7.6%) 이하** + 다른 클러스터 밴드(대략 3~7%)와 동급.
- **③비사망**: color strat이 **2% 이상**(투톤이 의미있는 빌드 — marginal/dead 회피).

- [ ] **Step 1: 측정**

Run: `node tools/run-sim.cjs 2>&1 | grep -E "색\(투톤\)|🏆|St0:"`
- color strat `🏆 클리어 %` 와 St0 balance 값을 기록.

- [ ] **Step 2: 게이트 판정 & 조정**

판정표(셋 다 통과면 Step 4로 건너뜀):
- color strat > 7% (지배) **또는** balance St0 > 8.1% (인플레) → 약화: handBonus 투톤의 `0.04`→`0.03`. 재측정.
- color strat < 2% (사망) → 강화: 투톤의 `Math.max(0,Math.min(dom,8)-4)`의 `-4`→`-3`(thr 낮춤). 재측정.
- 둘 다 아니면(2~7%, balance 7.1~8.1%) → 통과.

- [ ] **Step 3: 조정 시 재실행 (수렴까지 반복)**

조정했다면 Step 1 재실행. 게이트 셋 다 통과할 때까지 반복(보통 0~1회).

- [ ] **Step 4: 최종값 기록**

확정된 K(0.04 또는 0.03)·thr(4 또는 3)을 이 줄에 메모(Task 3 미러용):
`▶ 확정: K=____ / thr=____ / color strat ____% / balance St0 ____%`

- [ ] **Step 5: Commit (조정 있었을 때만)**

```bash
git add tools/run-sim.cjs
git commit -m "balance(sim): 투톤 캘리브 — K·thr 확정 (color strat 비지배·비사망)"
```

(조정이 없었으면 이 커밋 생략.)

---

## Task 3: index.html — 투톤 미러 (CHARMS + settle + UNLOCKS)

**Files:**
- Modify: `prototype/index.html` (CHARMS paritybet L334 뒤 · settle has("paritybet") L515 뒤 · UNLOCKS paritybet L366 뒤)

★**Task 2에서 K·thr이 바뀌었으면** 아래 settle 블록의 `0.04`·`-4`를 확정값으로 교체(run-sim과 일치 — 드리프트 가드).

- [ ] **Step 1: CHARMS 항목 추가**

L334 `paritybet` 항목 **뒤**에 삽입(cost 필드 없음 = 기본 8, cluster 필드 없음 = 베이스 풀):

```javascript
  {id:"twotone",  name:"투톤", desc:"정산 시 한 색(♥♦/♠♣)으로 치우치고 그 색 두 무늬가 다 있으면 치우친 만큼 보너스 (순수 플러시는 제외)"},
```

- [ ] **Step 2: settle 가산 블록 추가**

L515 `has("paritybet")` 줄 **바로 뒤**에 삽입(run-sim Task 1 Step 2와 식 일치):

```javascript
  if(has("twotone")){ let h=0,d=0,s=0,c=0; for(const x of S.row){ if(x.enh==="wild")continue; if(x.suit===1)h++; else if(x.suit===2)d++; else if(x.suit===0)s++; else c++; } const red=h+d,black=s+c,dom=Math.max(red,black); const bothSuits=red>=black?(h>0&&d>0):(s>0&&c>0); if(bothSuits) hb+=Math.round(blindBase(S.ante)*0.04*Math.max(0,Math.min(dom,8)-4)); }   // 투톤: 두 무늬 섞은 단색 치우침(순수 플러시 제외)
```

- [ ] **Step 3: UNLOCKS 항목 추가**

L366 `paritybet` UNLOCKS 항목 **뒤**(닫는 `};` 앞)에 삽입:

```javascript
  twotone:  {cond:(st,row)=>{ let r=0,b=0; for(const c of row) if(c.enh!=="wild"){ if(c.suit===1||c.suit===2)r++; else b++; } return Math.max(r,b)>=6; }, hint:"한 줄에 같은 색(♥♦/♠♣) 6장"},
```

- [ ] **Step 4: 문법 검증**

Run: `node tools/balance-check.cjs 2>&1 | head -1`
Expected: `✅ index.html 인라인 JS 문법 OK`

- [ ] **Step 5: Commit**

```bash
git add prototype/index.html
git commit -m "feat: 투톤(색 settle 페이오프) 부적 — CHARMS/settle/UNLOCKS (run-sim 미러)"
```

---

## Task 4: unlock-check.cjs — 투톤 해금 조건 (TDD)

**Files:**
- Modify: `tools/unlock-check.cjs` (UNLOCKS paritybet L40 뒤 · 테스트 L106 부근)

- [ ] **Step 1: 실패하는 테스트 추가**

테스트 섹션(`paritybet` eq 줄들 L103~106 부근)에 추가:

```javascript
reset(); const tt6=[{suit:1,rank:1,enh:null},{suit:1,rank:2,enh:null},{suit:2,rank:3,enh:null},{suit:2,rank:4,enh:null},{suit:1,rank:5,enh:null},{suit:2,rank:6,enh:null},{suit:0,rank:7,enh:null},{suit:3,rank:8,enh:null}];
eq("twotone 한색6(♥♦) 해금", checkUnlocks({},tt6).includes("twotone"), true);
reset(); const tt44=[{suit:1,rank:1,enh:null},{suit:2,rank:2,enh:null},{suit:1,rank:3,enh:null},{suit:2,rank:4,enh:null},{suit:0,rank:5,enh:null},{suit:3,rank:6,enh:null},{suit:0,rank:7,enh:null},{suit:3,rank:8,enh:null}];
eq("twotone 4-4 균형 안열림", checkUnlocks({},tt44).includes("twotone"), false);
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node tools/unlock-check.cjs 2>&1 | tail -3`
Expected: FAIL — `❌ twotone 한색6(♥♦) 해금: got false want true` (UNLOCKS에 twotone 아직 없음 → cond 미존재로 false).

- [ ] **Step 3: UNLOCKS cond 추가**

L40 `paritybet` UNLOCKS 항목 **뒤**(닫는 `};` 앞)에 삽입(index.html Task 3 Step 3과 동일):

```javascript
  twotone:  {cond:(st,row)=>{ let r=0,b=0; for(const c of row) if(c.enh!=="wild"){ if(c.suit===1||c.suit===2)r++; else b++; } return Math.max(r,b)>=6; }, hint:"한 줄에 같은 색(♥♦/♠♣) 6장"},
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node tools/unlock-check.cjs 2>&1 | tail -2`
Expected: PASS — `✅ 부적 해금: 27 pass / 0 fail` (기존 26 + 투톤 2 테스트 중 신규 통과, 총 카운트 27/0).

- [ ] **Step 5: Commit**

```bash
git add tools/unlock-check.cjs
git commit -m "test(unlock): 투톤 해금 조건(한 색 6장) + eq 테스트"
```

---

## Task 5: 최종 검증 + DOM 스모크

**Files:**
- 없음(검증만). 필요 시 임시 스크립트는 스크래치패드.

- [ ] **Step 1: 투톤 공식 엣지 단위 검증**

스크래치패드에 임시 파일 생성 후 실행 — 게이트(두 무늬) 동작 확인:

```bash
cat > "$TMPDIR/tt.cjs" <<'JS'
const bb=a=>150*Math.pow(1.5,a-1);
function tt(row,ante){ let h=0,d=0,s=0,c=0; for(const x of row){ if(x.enh==="wild")continue; if(x.suit===1)h++; else if(x.suit===2)d++; else if(x.suit===0)s++; else c++; } const red=h+d,black=s+c,dom=Math.max(red,black); const both=red>=black?(h>0&&d>0):(s>0&&c>0); return both?Math.round(bb(ante)*0.04*Math.max(0,Math.min(dom,8)-4)):0; }
const R=n=>Array.from({length:n},(_,i)=>({suit:i%2?2:1}));   // ♥♦ 번갈아
const F=n=>Array.from({length:n},()=>({suit:1}));            // 순수 ♥ 플러시
console.log("4♥4♦ a1:", tt(R(8),1), "expect", Math.round(bb(1)*0.04*4));   // dom8 both → +16%
console.log("8♥ 순수플러시 a1:", tt(F(8),1), "expect 0");                    // 게이트 미통과
console.log("4-4 균형:", tt([{suit:1},{suit:1},{suit:2},{suit:2},{suit:0},{suit:0},{suit:3},{suit:3}],1), "expect 0");
JS
node "$TMPDIR/tt.cjs"
```

Expected: `4♥4♦ a1: 24 expect 24` · `8♥ 순수플러시 a1: 0 expect 0` · `4-4 균형: 0 expect 0`. (값이 Task 2서 K·thr 바뀌었으면 그에 맞게 — 0/0 게이트만 핵심.)

- [ ] **Step 2: 전체 회귀 스위트**

Run:
```bash
node tools/balance-check.cjs 2>&1 | head -1
node tools/unlock-check.cjs 2>&1 | tail -1
node tools/economy-check.cjs 2>&1 | tail -1
node tools/run-sim.cjs 2>&1 | grep -E "색\(투톤\)|St0:|내리막"
```
Expected: balance-check 문법 OK · unlock 27/0 · economy 통과 · color strat 출력·St0 기준선(7.6%±0.5)·내리막 등 기존 보스 조건부 통과율 불변.

- [ ] **Step 3: DOM 스모크 (Playwright 미설치 대체 — 노드 스텁)**

기존 노드 DOM-스텁 스모크 패턴이 있으면 그것으로 CHARMS 24종 렌더·드로어 잠금/해금 표시 확인. 없으면 Step 1·2 + 수동 브라우저 1회(상점에 투톤 등장·정산 시 보너스 가산·드로어 잠금 힌트 "한 줄에 같은 색 6장")로 갈음.

Run(브라우저): `prototype/index.html` 열고 색 치우친 줄로 정산 → 콘솔 에러 0 확인.

- [ ] **Step 4: 검증 통과 시 다음 Task로** (커밋 없음 — 검증 전용)

---

## Task 6: 문서 동기화 + 마무리

**Files:**
- Modify: `HANDOVER.md` (§6 v3.27 항목 추가 · §3 드리프트 노트) · `CLAUDE.md` (드리프트 지점에 투톤·24부적) · `docs/PLAN.md` (v3.27 항목)

- [ ] **Step 1: HANDOVER §6에 v3.27 항목 추가**

§6 최상단(`✅ 위치-맥락 보스룰 "내리막"` 항목 앞)에 추가:

```markdown
- ✅ **색 settle 페이오프 "투톤" (v3.27, 부적 23→24종)**: 색축(♥♦/♠♣)의 인지된 갭(settle 가산 부재, pyro/noir는 place mult뿐) 해소. **투톤** = 한 색 치우침(dom) + 그 색 두 무늬 게이트 → `blindBase × K × max(0,min(dom,8)−thr)` 가산(순수 플러시는 게이트로 제외 = 플러시 더블딥 차단 = 소프트플러시 니치). ★distinct 근거 = 기계적 신규성 아닌 *플러시축 분리*(B 단색치우침과 전형 동작 유사, 정직 수용). cluster **무태그**(베이스 풀 — 싱글톤 cluster는 영구 down-weight 사장). 캘리브: K=__/thr=__ → color strat __%(비지배·비사망), balance 기준선 7.6% 불변. 드리프트: settle 식 `index.html`(L515 뒤) ↔ `run-sim.cjs`(handBonus) **2파일 미러**(connect 무건드림 → balance-check/strategy-sim/hand-frequency 미동기). UNLOCKS(한 색 6장) + unlock-check **27/0**. 설계 `docs/superpowers/specs/2026-06-30-color-settle-payoff-design.md`·계획 `…/plans/2026-06-30-color-settle-payoff.md`.
```

(K·thr은 Task 2 확정값 기입.)

- [ ] **Step 2: CLAUDE.md 드리프트 지점 갱신**

`run-sim.cjs 만 부적 23종` → `24종`으로, 투톤(색 settle, 2파일 미러, cluster 무태그)을 드리프트 지점 문장에 한 구 추가.

- [ ] **Step 3: docs/PLAN.md에 v3.27 항목 추가**

PLAN.md 버전 추적에 v3.27 투톤 항목(설계·계획·구현·검증 체크) 추가.

- [ ] **Step 4: 최종 커밋 + 푸시**

```bash
git add HANDOVER.md CLAUDE.md docs/PLAN.md
git commit -m "docs: 색 settle 페이오프 투톤 (v3.27) — HANDOVER/CLAUDE/PLAN"
git -c credential.helper= -c credential.helper='!f(){ echo username=x-access-token; echo "password=$(gh auth token)"; }; f' push origin main
```

---

## Self-Review

**Spec coverage** (spec §별 → task 매핑):
- §1 룰(투톤 공식·게이트·메타) → Task 1(run-sim handBonus)·Task 3(index settle+CHARMS)
- §2 구현(index↔run-sim 2파일·unlock-check·color strat·applyOne) → Task 1·3·4
- §3 파라미터 캘리브(K/thr 가드 3종) → Task 2
- §4 검증(balance-check/run-sim/unlock/economy/DOM) → Task 5
- §5 범위(IN 전부 task 존재, OUT은 미구현 유지) → ✓
- §6 리스크(marginal→Task2 비사망 가드 / 드리프트→Task1·3 식 일치 / 희석→Task2 무인플레 가드) → ✓
- 문서 동기화 → Task 6

**Placeholder scan:** K·thr은 "Task 2 확정값"으로 명시(캘리브 산출물 — placeholder 아님, 시작값 0.04/4 코드 제시 + 조정 규칙 명시). 그 외 모든 step에 실제 코드/명령/기대출력 존재.

**Type/이름 일관성:** charm id `twotone` 전 task 통일 · settle 식(red/black/dom/bothSuits) Task1·3·4 동일 · STRATS key `color` ↔ applyOne `strat==="color"` ↔ STRAT_KO `color` 일치 · UNLOCKS cond(Task3 index ↔ Task4 unlock-check) 동일 식.

이슈 없음.
