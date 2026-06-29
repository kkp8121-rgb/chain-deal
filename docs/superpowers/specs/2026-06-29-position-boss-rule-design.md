# CHAIN DEAL — 위치-맥락 보스룰 "내리막"(seal_climb) 설계 (v3.26 목표)

> 작성: 2026-06-29 · 로드맵 MID "위치-맥락 보스룰"(브릿지/오름 봉인)
> 설계 결정(사용자): ①진입 = **기존 보스 룰 1개 교체**(보스 추가 금지 준수) · ②룰 = **오름 봉인(내리막)** · ③교체 대상 = **seal_run**

---

## 0. 요약 & 목표

v3.23 위치-맥락 부적(bridge/stair/keystone)·오름차순 체인 플레이에 **보스 counterplay가 부재**(spatial 빌드가 "안전"). 설계 철학(보스=규칙으로 어렵게→적응)에 따라 **위치/방향 룰**을 하나 도입한다. 단 **보스 추가 금지**(12종 포화) → 기존 `seal_run`(±1 전면 봉인)을 **`seal_climb`(내리막)**으로 교체. 12종·액트 균형 유지.

**효과**: 오름차순 ±1 연결을 봉인 → stair 부적·"오름 본능" 직격, 핵심 ±1 수읽기를 깊게(내림·같은무늬·같은숫자로 우회). seal_run보다 결적(내림 ±1 허용)이라 tmult 상향.

---

## 1. 룰 정의

**내리막(seal_climb)**: 한 쌍이 **오름차순 순수 ±1**(오른쪽 = 왼쪽+1, 다른 무늬, 비-와일드)이면 **체인 연결 무효**. 다음은 정상 연결:
- **내림차순 ±1**(왼쪽 = 오른쪽+1)
- **같은 무늬** (오름 ±1이어도 무늬로 연결 유지)
- **같은 숫자** (±1과 공존 불가하나 일반 연결)
- **와일드** (무조건 연결)

판정 `climbSealed(right, left)`:
```
seal_climb && right.enh!=="wild" && left.enh!=="wild" && right.suit!==left.suit && right.rank-left.rank===1
```
(`right.rank-left.rank===1` = 오른쪽이 왼쪽보다 정확히 1 큼 = 오름 +1. 내림은 −1이라 미봉인.)

**메타**: id `seal_climb` · name **내리막** · icon ⤵ · desc `오르막(↑) ±1 연결 무효 — 내림·같은무늬·같은숫자만` · act 2 · actBoss false · **tmult 0.72(가설, 캘리브)**.

---

## 2. 구현 (connect 대칭성 보존)

★`connect(a,b)`는 **대칭**(bridge 부적이 `connect(c,왼)`·`connect(c,오)` 양방향 호출). 방향 룰을 connect에 넣으면 bridge의 오른쪽-판정이 깨짐. → **connect에서 seal_run 제거**(±1 항상 허용) + **방향 봉인은 placeCard/gain의 체인 판정에만** `climbSealed` 적용. bridge 부적의 인접 판정은 seal_climb **무영향**(체인 방향만 봉인 = 의도된 분리).

### index.html
1. **BOSSES** (L236): `seal_run` 항목 → `{id:"seal_climb", icon:"⤵", name:"내리막", desc:"오르막(↑) ±1 연결 무효 — 내림·같은무늬·같은숫자만", tmult:0.72, act:2, actBoss:false}`.
2. **connect()** (L220): `const runOk=Math.abs(a.rank-b.rank)===1 && !(boss&&boss.id==="seal_run");` → `const runOk=Math.abs(a.rank-b.rank)===1;` (seal_run 제거).
3. **climbSealed 헬퍼** (connect 근처 추가):
   ```javascript
   function climbSealed(right,left){ return S.boss && S.boss.id==="seal_climb" && right.enh!=="wild" && left.enh!=="wild" && right.suit!==left.suit && right.rank-left.rank===1; }
   ```
4. **placeCard 연결 판정** (L461): `if(left && connect(card,left) && !(S.boss&&S.boss.id==="frost"&&S.row.length<=2)){` → `connect(card,left)` 다음에 `&& !climbSealed(card,left)` 추가.
5. **placeCard runLen 루프** (L463): `if(connect(S.row[i],S.row[i-1])) runLen++;` → `if(connect(S.row[i],S.row[i-1]) && !climbSealed(S.row[i],S.row[i-1])) runLen++;`.

### tools/run-sim.cjs
1. **BOSSES** (L89): `{id:"seal_run",tmult:.58,...}` → `{id:"seal_climb",tmult:.72,act:2,actBoss:false}`.
2. **connect()** (L33): `&& boss !== "seal_run"` 제거.
3. **climbSealedSim 헬퍼** (gain 위 추가): `function climbSealedSim(right,left,boss){ return boss==="seal_climb" && right.enh!=="wild" && left.enh!=="wild" && right.suit!==left.suit && right.rank-left.rank===1; }`.
4. **gain()** 연결 판정 (L28): `connect(card,left,boss)` 다음에 `&& !climbSealedSim(card,left,boss)`.
5. **gain()** rl 루프 (L30): `if(connect(row[i],row[i-1],boss) && !climbSealedSim(row[i],row[i-1],boss)) rl++;`.
6. **BOSS_KO** (L184): `seal_run:"스트봉인"` → `seal_climb:"내리막"`.

### tools/balance-check.cjs
1. **BOSSES** (L107): `seal_run` 항목 → `{ id: "seal_climb", name: "⤵ 내리막", tmult: 0.72, hand: 3, act: 2, actBoss: false }`.
2. **connect()** (L33): `&& boss !== "seal_run"` 제거.
3. **scoring 루프**: index와 동일하게 climbSealed 적용(★구현 시 balance-check 점수 루프 정확 위치 확인 — connect 사용처에 동일 미러).

★**드리프트 가드**: seal_climb tmult가 3파일(index/run-sim/balance-check) **일치**.

---

## 3. 파라미터 (tmult 캘리브)

- seal_run(0.58)은 ±1 *전면* 봉인이라 점수 손실 큼 → 낮은 목표. seal_climb은 *오름만* 봉인(내림 ±1 생존) → 손실 ~절반 → **tmult 상향**.
- 캘리브 목표: ①`balance-check` 보스 상대난이도 게이지에서 seal_climb 클리어율이 다른 Act2 보스(seal_run 자리)와 **유사** ②`run-sim` 전체 balance 기준선(~9.x%) **불변**(seal_climb 교체로 안 흔들림) + seal_climb 조건부 통과율 건강 밴드.
- 가설 0.72 → 너무 쉬우면(balance 기준선↑) tmult↓(0.65), 너무 어려우면 tmult↑(0.78).

---

## 4. 검증

1. **문법+보스 게이지**: `node tools/balance-check.cjs` — 문법 PASS + seal_climb 상대난이도가 Act2 밴드.
2. **전체 밸런스**: `node tools/run-sim.cjs` — balance 기준선 ~9.x% **불변**(±0.5pp), seal_climb 조건부 통과율 건강(다른 보스 밴드 내), 스테이크 스윕 단조 유지.
3. **경제/해금 회귀**: `economy-check`·`unlock-check` (무관하나 회귀 확인).
4. **UI 스모크**: 노드 DOM-스텁 — seal_climb 보스전 진입 시 오름 ±1 무연결·내림 연결 정상, 콘솔에러0. (Playwright 미설치 대체.)

---

## 5. 범위

**IN**: `index.html`(BOSSES·connect·climbSealed·placeCard 2곳) · `run-sim.cjs`(BOSSES·connect·climbSealedSim·gain 2곳·BOSS_KO) · `balance-check.cjs`(BOSSES·connect·scoring climbSealed) · 문서(HANDOVER/CLAUDE/PLAN).

**OUT (YAGNI)**:
- 브릿지 봉인·끝자리 봉인(다른 위치 룰 — 차후 별도).
- 새 보스 추가(SSoT 금지).
- seal_climb를 connect()에 직접(대칭성 깨짐 — placeCard/gain만).
- bridge 부적 인접 판정에 seal_climb 적용(체인 방향만 봉인 = 의도).
- runner 부적 byRun: 오름 ±1 같은무늬 연결 시 byRun 여전히 발화(희소 엣지, 미세 — 가산 무시).

---

## 6. 리스크

- **drift(3파일)**: seal_run→seal_climb + climbSealed를 index/run-sim/balance-check 동기화. tmult 일치 가드.
- **connect 대칭성**: climbSealed를 connect에 넣으면 bridge 깨짐 → placeCard/gain만(검증: bridge 부적 보스전 동작).
- **balance-check 단일라운드 한계**: 맨덱 단일라운드라 seal_climb 절대난이도 근사 — 진짜 밸런스는 run-sim 풀런.
- **tmult 과/저**: 캘리브로 balance 기준선 불변 확인(0.72 가설, 스윕).
