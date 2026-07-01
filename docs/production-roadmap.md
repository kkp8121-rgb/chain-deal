# CHAIN DEAL — Milestone Production Roadmap (v3.29 → Commercial Launch)
*Technical Producer synthesis · Steam PC + Google Play · backend-less · rich scope · solo dev*

---

## 1. EXECUTIVE SUMMARY

**The path in 5 lines:**
1. **Refactor first** (Phase 0, ~1 wk): extract rules+content into `src/` modules so game and sims share ONE copy — this kills the drift tax that otherwise makes rich content impossible.
2. **Build variety, gated by the sim** (Content, ~4–6 mo): charms 24→80, decks 3→8, a new 3-tier consumable system, bosses 12→20, stakes→8, unlock tree, ~45 achievements — every addition screened by a `gate.cjs` regression harness.
3. **Art in parallel** (~2–3 mo, overlaps content): **pixel art, procedural-synthesis** for the 80 charms/cards/bosses in code (GPT 0, 100% consistent — 프로젝트 초기 결정), **GPT only for ~20–30 backgrounds/UI** (16-color quantized), human/outsource for capsule + logo + trailer.
4. **Wrap & ship** (Phase B, ~1 mo build + calendar walls): Electron+`steamworks.js` for Steam, Capacitor for Android, backend-less achievements/leaderboards/cloud-save, deterministic-replay for the daily board.
5. **Market from Day 0**: Steam "Coming Soon" page live NOW, wishlist for months, Next Fest, launch.

**Total realistic timeline (solo, part-to-full-time):** **9–14 months** wall-clock from today to dual-store launch. Aggressive full-time floor ~7 months; comfortable ~12.

**The 3 biggest risks:**
- **Balance-surface explosion** — 80 charms × 8 decks × consumables is a combinatorial space no solo dev can hand-verify. Mitigation = Phase 0 + the scaled `gate.cjs` toolchain are non-negotiable prerequisites, not nice-to-haves.
- **Art consistency at 80 icons** — the single most likely thing to make the game look amateur or get a store capsule rejected. Mitigation = template/palette lock + post-processing homogenization; budget honestly.
- **Marketing runway (wishlists)** — the actual determinant of commercial success, and it's calendar not code. Mitigation = Coming-Soon page up before content is even done.

---

## 2. PHASE 0 — Modular / Data-Driven Refactor (THE PREREQUISITE)

**Why this is gate zero:** adding a charm today = editing `gain()`+`handBonus()` in 2 files + data arrays in 2–3 files, tracked only by prose invariants in CLAUDE.md. At 24 charms this already "costs a full session per deck." At 80 charms + 40 consumables + 20 bosses the manual-mirror cost is untenable AND the sim/funqa gates silently lose validity the moment they drift. **This refactor converts "add content = edit 4 files and hope" into "add content = one data object."**

### Deliverables & module layout

```
src/
  content/   cards, charms(→80), bosses(→20), decks(→8),
             consumables(NEW), unlocks, tuning   ← PURE DATA
  rules/     connect, hands, scoring(hook engine),
             blinds, economy                     ← PURE FUNCTIONS (boss/owned passed in, no globals)
  engine/    rng, state(+assertPileInvariant), shop, consume ← PURE STATE
  platform/  storage (KV: localStorage|SteamCloud|Android)
  ui/        render, juice, audio, tally, shopview, share, leaderboard ← DOM ONLY
  main.cjs   index.template.html   styles.css
build.mjs    esbuild → inlined single prototype/index.html
tools/run-sim.cjs  ← becomes a THIN ADAPTER (require src/, re-export; funqa untouched)
```
Dependency rule: `ui → engine → rules → content`, downward only. Nothing in rules/content/engine may touch `document`, the `S` global, or `localStorage`.

### How it kills sim-mirror-drift
The **effect-registry hook pattern** is the mechanism: each charm declares its effect ONCE as pure hooks (`base`/`mult`/`chainMul`/`settle`/`settleOverride`), and one `scoreCard`/`scoreSettle` engine applies them generically. Game (`engine/state`) and sim (`run-sim gain`) call the *same* function. `run-sim.cjs` re-exports `gain = scoreCard`, so **funqa/greybox tools need zero changes**. Adding charm #80 = append one object; the game bundle and every sim tool pick it up with zero mirror edits. Additive-by-construction also enforces the "가산 > 곱셈" balance rule mechanically.

The single behavioral-risk conversion: `connect` must move from reading the `S.boss` global to taking `boss` as a param (`run-sim.cjs` already has the correct pure signature — port that one, delete the game's copy).

### Strangler-fig migration (shippable every step, guarded by the "golden triple": funqa golden + run-sim clear-rate + economy-check invariants)

| # | Step | Verify gate | Effort |
|---|------|-------------|--------|
| 0 | Scaffold: `package.json`+esbuild+`build.mjs`, move `<script>`/CSS/HTML **verbatim** into `src/`. No logic change. | Built file plays identically; funqa/balance byte-stable | 0.5 d |
| 1 | Extract content data (`CHARMS/BOSSES/DECKS/HAND_BONUS/tuning`) → `src/content/*` | Build diff clean; game identical | 0.5 d |
| 2 | Extract pure rules; convert `connect` global→param | funqa + balance + economy match exactly | 1.0 d |
| 3 | Scoring hook engine; port 24 charms to hooks **behind an equivalence harness** (old-inline vs new-hook on 100k random rows → assert identical) | Equivalence 100%; funqa golden unchanged | 1.5–2.0 d |
| 4 | **Kill drift:** rewrite run-sim as adapter, delete private copies in balance-check/strategy-sim/hand-frequency/unlock-check | `grep` proves exactly ONE definition of connect/scoreCard/CHARMS. **Payoff reached.** | 1.0 d |
| 5 | *(follow-on)* Engine/UI split; promote pile-invariant to runnable `assertPileInvariant`; enables true headless sim | Game identical; invariant passes every round | 1.5–2.0 d |

### Effort & exit criteria
- **Phase-0 mandatory (Steps 0–4): ≈ 4.5–5 focused days (~1.5–2 wk calendar).** With Step 5 follow-on: ≈ 6–7 d.
- **Build:** esbuild in devDependencies only; ships one self-contained `prototype/index.html` (inlined `<style>`+`<script>`, zero runtime deps). GitHub Pages / Steam wrapper / Android WebView all unchanged.
- **Exit criteria:** (a) `grep` shows one copy of each rule; (b) `npm run build --check` syntax gate green in CI; (c) golden triple matches pre-refactor exactly; (d) adding a test charm is a single-file edit that both game and sim consume automatically.

---

## 3. CONTENT MILESTONES

Ordered **by leverage**: build-variety (charms/decks) first — it's what makes runs feel distinct and drives the mastery multiplier; consumables next (biggest missing pillar); bosses/tail/unlocks last. Every milestone gated by the scaled toolchain from Research 5.

**Volume targets (Research 1):**

| Content | Now | Launch target | Stretch |
|---|---|---|---|
| Charms | 24 | **80** (7–8 clusters) | 100 |
| Decks | 3 | **8** | 10 |
| Consumables | 0 | **~40** (3-tier, 2-slot) | 52 |
| Bosses | 12 | **20** (16 reg + 4–6 showdown) | 24 |
| Stakes | 6 | **8** | 8 |
| Enhancements | 3 | **5–6** | 6 |
| Unlock nodes | ~0 | **~65–75 gated** | 90 |
| Achievements | 0 | **~45** | 50 |
| Challenges | 0 | **12–15** | 20 |

**The mastery engine:** 8 decks × 8 stakes = **64 mastery cells** — that, not raw card count, is the 100h+ tail (Balatro 15×8=120, STS 4×20=80).

### The verification gate (built in Milestone C1, used by every milestone after)
`node tools/gate.cjs` — one command, machine-readable scorecard, non-zero exit on red:

| Gate | Green band |
|---|---|
| G0 build+inline-integrity+syntax | inline == rebuild; parses |
| G1 card-conservation + mult-cap≤25 + additive-only hooks | exact |
| G2 build-diversity spread (auto-derived per-cluster strats) | no strat >2× median, none <0.3× |
| G3 per-item EV z-score / boss conditional-pass / deck parity | charm z∈[−1.5,+2.0]; boss∈[55%,85%] |
| G4 conditional-clear flatness | per-blind 85–97%, ≤1 wall, no cliff>15pp |
| G5 economy invariants | escalating reroll, spillover=floor(g*.1), monotonic gold |
| G6 fun-axis non-regression vs baseline | persona Δ≥−0.3; mass-appeal≥70% |
| G7 3-seed-bank robustness | min-bank mass-appeal≥70% |

Two-tier: `--fast` (N=2000, seconds, inner loop) / `--full` (N=20000, 3 banks, sharded across workers, pre-commit). A **content-ledger** snapshots per-item EV/pick-rate each release; the gate diffs it to catch **dilution** (the 13→24 collapse signature: baseline clear 9.6→3.5%) and **creep** before they ship — an addition that drops baseline clear must ship *with* a named compensating lever (weighted offer / reroll / cluster tag).

### Milestones

| # | Ships | Volume | Balance/verify gate | Effort | Depends on |
|---|-------|--------|---------------------|--------|-----------|
| **C0** | Refactor done (Phase 0) | — | golden triple + grep=1 | 4.5–5 d | — |
| **C1** | `gate.cjs` + content-ledger + auto-derived strats + forced-inclusion EV harness | tooling | self-test: reproduces current baselines | 3–5 d | C0 |
| **C2** | **Charms 24→50** (fill existing 7–8 clusters to density) | +26 | greybox per-charm (EV z, diversity Δ, fun Δ) → gate --full green, no dilution | 3–5 wk | C1 |
| **C3** | **Decks 3→8** + enhancements 3→5/6 | +5 decks, +2–3 enh | each deck teaches a distinct chain strategy; deck-parity band; new strat added free from cluster tags | 2–3 wk | C2 |
| **C4** | **Consumable system** (engine slice + Tier1 Splices ~16) | ~16 | NEW metrics: clutch, timing-variance, deadweight; consumable-use personas (hoarder/spender/optimizer/panic). Low timing-variance ⇒ auto-pilot ⇒ cut | 3–4 wk | C1 (engine/consume) |
| **C5** | **Consumables Tier2 Currents (~12) + Tier3 Surges (~10–12)** | ~24 | Currents = permanent per-connection-type scaling (the original twist, additive/bounded, mult-cap 25); Surges = adjacency-warping high-risk. Same gates | 2–3 wk | C4 |
| **C6** | **Charms 50→80** (synergy depth across all clusters) | +30 | dilution watch is critical here (~7× the 24-pool pressure); auto-recalibrate CLUSTER_W when offer-reachability dips | 3–4 wk | C2 |
| **C7** | **Bosses 12→20** (+4–6 fixed showdown for antes 3/6/8) | +8 | ~2.5 candidates/tier; rule-not-statwall; conditional-pass 55–85%; tmult calibrated on run-sim --full (not single-round balance-check) | 2–3 wk | C1 |
| **C8** | **Stakes 6→8** + **unlock tree (~65–75 nodes)** + **~45 achievements** + **12–15 challenges** | tail layer | unlock triggers = play-goals that *teach* ("win with suit-runner," "25-mult chain"); stakes calibrated by run-sim sweep (St0 baseline unchanged → St7 monotone >0) | 3–4 wk | C2–C7 |

**Content track subtotal: ~4–6 months** (C2–C8), overlapping art.

---

## 4. ART TRACK (parallel to content) — ★PROCEDURAL-FIRST PIXEL (프로젝트 초기 결정 — GDD §8/§9.4, HANDOVER:222)

> **Decision (locked, revised from workflow default):** static **pixel art**; **procedural synthesis in code** for all repeatable in-game assets (cards/charms/enh/bosses) = **GPT 0**; **GPT only for ~20–30 backgrounds/UI/coins** + master-16-color quantization; frame-animation 0 (all motion = code). This pre-solves the "80-icon consistency" risk the flat-vector/AI-batch plan flagged as Critical — procedural = 100% consistent by construction.

**Architecture note:** procedural icons are *code-drawn* (canvas/SVG from a param record), so there's **no icon image bloat** — the charm record carries draw-params (`{id,name,cost,cluster, art:{shape,symbol,accent,deco}}`), not a PNG. Only the ~20–30 GPT backgrounds + store assets are real image files → served from `assets/` (static, **backend-less preserved**). No sprite atlas needed for icons.

### Style: static pixel art (locked)
Cards = clean procedural pips (readability-first — illustrating 32 is waste + hurts chain reading). Charms = ornate procedural emblems (shape + symbol + cluster-accent + border/deco). One renderer + master **16-color palette** → consistency is *structural*, not post-hoc. Cluster-accent colors double as gameplay readability. Motion via existing `sparkBurst`/`shake`/`flash`/count-up tally.

### ★ The one real risk (GDD-flagged) → procedural icon **distinctiveness**
80 charms from shape+symbol combos risk looking samey. Mitigation = a **rich procedural vocabulary** (N base shapes × M symbols × accent palettes × borders/deco) sized so 80 are visually distinct, + a **visual-verification milestone** (contact-sheet of all 80 → human distinctiveness pass, 0 confusable pairs — GDD's "M2 시각 검증"). Designing the procedural icon generator IS the art track's key engineering task.

### Asset split
- **Procedural (code, GPT 0):** 32 card faces + suit pips + backs, ~80 charm emblems, 3–6 enhancement overlays, ~20 boss sigils, VFX.
- **GPT (~20–30 only) + 16-color quantize:** 8–12 backgrounds, UI frame/panel kit, coins/meta icons. GPT = the tool (project decision); quantize to master palette. Minimal AI footprint → minimal Valve AI-disclosure exposure.
- **Store hero (human/focused-production):** Steam 14 exact-spec images from ONE pixel hero key-art (Header 920×430, Main 1232×706, Vertical 748×896, Library 600×900, Hero 3840×1240, Logo 1280w transparent, +5 shots 1920×1080; small logo legible at 120×45 or reject). Google Play: feature 1024×500 (no alpha), icon 512×512, phone shots. Hero = GPT-assisted draft + hand polish, or outsource. **Trailer.**

### Art roadmap (parallel to content C2–C8)
```
A0 (1wk):   procedural icon generator + master-16 palette + art-param schema → renders test icons
A1 (2–3wk): procedural vocab depth for 80 charms + card/pip/enh system      → contact-sheet distinctiveness (0 confusable)
A2 (2wk):   ~20 boss sigils (procedural) + GPT backgrounds 8–12 (quantized) + UI kit → act-tier escalation, mobile-crisp
A3 (2–3wk ∥, focused/outsource): Steam capsules + logo + Google assets (pixel hero) → 14-asset spec check, 120×45 legible
A4 (2wk):   screenshots + TRAILER                                            → first-5-sec hook, 0 spec rejects
```

### Effort & cost band (procedural-first = dev-time-heavy, low cash)
In-game art ≈ mostly **DEV time** (the procedural generator, one-time) + GPT background credits (~$20–100). Big cash = hero/capsule/**trailer** only.
- **Solo (procedural + GPT backgrounds + solo trailer): ~$0.1–0.6k · ~2–3 mo.**
- **Hybrid (outsource capsule/logo/trailer): ~$3–8k · ~2 mo.**
**Trailer = still #1 lever** — existing juice (count-up climax, sparkBurst, shake/flash) is trailer-gold; solo capture + licensed music (~$50–200) beats the outsource floor. Procedural-first removes the flat-vector plan's dominant cost/consistency risk (80-icon AI batch + homogenization).

---

## 5. PHASE B — Platform (Steam + Google Play)

**Total hard cash to be on both stores: ~$125** ($100 Steam Direct recoupable + $25 Play + $0 IARC + $0 Cloudflare).

### Wrap decision
- **Steam → Electron + `steamworks.js`** (NOT Tauri). Tauri's <10MB is a false economy: no Node context so `steamworks.js` won't drop in, plus per-OS WebView divergence testing. Electron's 80–150MB is a non-issue for desktop; `steamworks.js` gives achievements+leaderboards+cloud+overlay via npm, no compile. **2–5 days.**
- **Android → Capacitor** (NOT TWA — TWA needs hosted PWA+service worker; Capacitor wraps the single local HTML file). Produces signed `.aab`. **Must target API 35** (minSdk can stay 24). **1–2 days wrap + 2–4 days PGS bridge** (PGS is native SDK → needs a Capacitor plugin bridge, the one genuinely fiddly integration).

### Platform services (backend-less, confirmed Valve/Google-hosted)
Achievements, leaderboards, cloud-save all live on Valve/Google servers, zero backend. `platform/storage.cjs` (from Phase 0) abstracts localStorage → Steam Cloud / Android saves in one file.

**The backend-less leaderboard tradeoff:** both boards are **client-trusted and forgeable**. Ship casual/vanity boards as-is. For a **daily-seed competitive board**, lean into CHAIN DEAL's decisive advantage: it's fully deterministic (`mulberry32`) and you already have a Node replayer. Submit **seed + ordered placements**, not the score; re-simulate in a **$0 Cloudflare Worker** (the `LOG_URL` path already exists) and reject mismatches. This turns the old drift-pain into the anti-cheat oracle — but makes rule-parity between game and validator load-bearing (another reason Phase 0 ships first).

### Store assets, ratings, review
- **Steam:** own content survey (covers Germany USK auto). Build review + page review ~3–5 business days each, plan 7+; submit build 2–3 wk before release.
- **Play:** IARC questionnaire (free, instant). **Hard 2-week wall:** new personal accounts need **12 testers opted-in continuously ≥14 days** before production — start the day you make the account, or use an org account (needs D-U-N-S) to skip.

### Monetization (Play)
F2P dominates mobile (~96% of downloads). Best fit: **free + single "unlock full game" IAP** (demo→buy). Optional hybrid: **rewarded ad → meta-currency** (retry token/reroll) maps onto the existing meta-shop with almost no design change — keep opt-in and never gate fairness. Steam = clean upfront paid, carried by wishlisted brand.

### Marketing calendar (the actual success determinant)
```
Coming-Soon page LIVE NOW  →  wishlist for months  →  demo ready (~6wk pre-Fest)
   →  Steam Next Fest (cashes in momentum, doesn't build it)  →  launch
```
~7,000 wishlists ≈ "Popular Upcoming" slot. **The wishlist tier you enter Next Fest with is the tier you leave with.**

### Phase B effort
| Track | Build work | Calendar wall |
|---|---|---|
| Steam wrap + services | 2–5 d | review 7+ business days |
| Steam store page + surveys | 1–2 d | wishlist runway = months |
| Play wrap + API35 + IARC | 2–4 d | — |
| PGS bridge | 2–4 d | — |
| Play closed test | — | **12 testers × 14 days (hard)** |
**Phase B build ≈ 2–3 weeks; calendar dominated by wishlist runway + the 2-week Play gate.**

---

## 6. CRITICAL PATH & DEPENDENCIES

```
Phase 0 (refactor) ──┬──> Content C1..C8 ─────────────┐
                     │                                 ├──> Phase B wrap+services ──> Launch
                     └──> Art A0..A5 (∥ content) ──────┘         │
                                                                 └── Marketing (Coming-Soon page starts DAY 1, runs the whole time)
```
- **Phase 0 blocks everything content** (drift makes rich content + valid gates impossible). It does NOT block art A0 (style bible) or the Coming-Soon page.
- **Content ∥ Art** — the two big tracks run in parallel for months. Art A5 (trailer) is the one true content→art dependency: it needs C2–C5 assets integrated to capture hero footage.
- **Phase B wrap** needs a feature-complete build (post-C8) but the Steam page + wishlisting starts immediately with placeholder/early art.
- **Marketing has no code dependency** and is on the critical path for *success* even though not for *shipping* — start Day 1.
- **Longest pole:** Content C2–C8 (~4–6 mo) is the critical path; Art (~2.5–4 mo) fits inside it; Phase B (~1 mo) tails it; the Play 2-week test wall and Steam review buffer are absorbed at the end.

---

## 7. RISKS & MITIGATIONS

| Risk | Severity | Mitigation |
|---|---|---|
| **Balance-surface explosion** (80×8×consumables uncheckable by hand) | Critical | Phase 0 + `gate.cjs` two-tier harness + content-ledger diff are prerequisites; per-item forced-inclusion EV; greybox-before-`src/` so bad items never ship. Human playtest = final authority on what the machine passes. |
| **Art consistency at 80 icons** | Critical | Template+palette lock + POST homogenization pass (consistency baked in post, not prompt); contact-sheet QA regenerates outliers; emblem-not-character for bosses. Don't undersell: this is 3–4 wk + real $. |
| **Dilution as pool grows** (13→24 collapsed 9.6→3.5%) | High | Ledger gates baseline-clear trendline; an addition dropping it must ship a named compensating lever (weighted offer/reroll/cluster). Auto-recalibrate CLUSTER_W on offer-reachability dip. |
| **Scope creep** (80→100 charms, 52 consumables, endless polish) | High | Launch targets are the ceiling, stretch is post-launch. Mastery multiplier (8×8 cells) delivers 100h+ from *cheap* content (decks/stakes) — resist adding expensive content. |
| **Marketing / wishlists** | High | Coming-Soon page Day 1; months of runway; enter Next Fest with a wishlist tier already built. Trailer = #1 lever, funded from the art budget. |
| **Backend-less leaderboard forgeable** | Medium | Casual boards: accept it. Competitive daily board: deterministic seed+replay re-sim in $0 Worker (reuses `LOG_URL`). Accept the rule-parity discipline it forces (Phase 0 already delivers it). |
| **PGS-from-WebView bridge** | Medium | Budget 2–4 d; use community Capacitor plugin or thin custom bridge; Steam side (`steamworks.js`) is the easy one. |
| **Play 12-tester / 14-day wall** | Medium | Start the day the account is created, or convert to org account (D-U-N-S). |
| **Full-DOM `render()` jank on low-end Android** | Low–Med | Step 5 engine/UI split enables targeted render; QA on low-end device; consider dirty-region rendering only if measured. |

---

## 8. OPEN DECISIONS (human must decide)

**Before / within Phase 0:**
- CJS vs ESM authoring for `src/` (research recommends CJS = zero churn for 15 `.cjs` tools; ESM is purist but costs conversion). → *Recommend CJS.*
- Whether to do Step 5 (engine/UI split) now or defer (it buys headless sim + runtime pile-invariant; not blocking).

**Before Content:**
- **Consumable mechanic final design** — confirm the 3-tier CHAIN-native design (Splices/Currents/Surges), the 2-slot cap, and whether Currents (per-connection-type permanent scaling) is the signature growth knob. This is the biggest *new design* decision in the whole project.
- Cluster count (7 vs 8) and which build each of the 8 decks teaches.
- Which ~40% of content is unlock-gated vs start-available (pacing the 100h arc).

**Before Art:**
- ✅ **RESOLVED — art style: pixel, procedural-synthesis for in-game (GPT 0), GPT only for ~20–30 backgrounds** (project initial decision, GDD §8/§9.4). Icon method = **Option A** (fully procedural; distinctiveness handled by rich vocab + contact-sheet verify).
- ✅ **RESOLVED — AI tool: GPT** (backgrounds only). AI-disclosure exposure minimal (few assets).
- **Budget band (revised)**: Solo procedural (~$0.1–0.6k) vs Hybrid outsource-hero (~$3–8k) — decides only the capsule/logo/**trailer** quality ceiling (in-game art is dev-time, not cash).
- Outsource vs solo for capsule/hero/logo/trailer (the sell-assets) — still open.
- Procedural icon vocabulary depth (how many shapes×symbols×accents) to guarantee 80 distinct — the A0/A1 design task.

**Before Phase B:**
- **Monetization price point** — Steam upfront price; Play model (paid-unlock IAP vs rewarded-ad hybrid vs upfront). Does the rewarded-ad option compromise the "fair roguelike" brand?
- Personal Play account (accept 2-wk test wall) vs org account (D-U-N-S).
- Ship the daily-seed competitive board at launch, or casual-only first?
- Simultaneous dual-store launch vs Steam-first-then-Play (carry wishlist brand to mobile).

---

## 9. IMMEDIATE NEXT STEP

**Execute Phase 0, Step 0 (Scaffold) — today.** Add `package.json` (esbuild as sole devDependency) + `build.mjs`, and move the current `<script>` verbatim into `src/main.cjs`, CSS into `src/styles.css`, HTML shell into `src/index.template.html`. Run `node build.mjs` and confirm the built `prototype/index.html` plays byte-identically and passes the existing funqa golden + `balance-check`. **Zero logic change** — this is the safe, shippable first commit that unlocks the entire modular migration.

*(Parallel Day-1 action with no code dependency: reserve the Steam app, pay the $100 Direct fee, and put up the "Coming Soon" page skeleton to start the wishlist clock — the marketing runway is the longest non-code pole.)*