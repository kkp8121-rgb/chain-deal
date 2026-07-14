// src/render/stage.cjs — M2 렌더층 스테이지 스캐폴드 (spec §1·§2·§5). PixiJS v8.19.0 전역(window.PIXI) 소비.
// ★star 토폴로지 leaf: PIXI/브라우저 참조는 전부 함수 내부 — top-level은 node 파싱 게이트(PIXI·document 미존재)에서
// 크래시 금지. r·R_ 접두 규율. 이 태스크는 스캐폴드만 — 마운트/폴백 판정만 하고 rSync는 다음 태스크.
const R_W = 800;   // 논리 좌표계 폭 (보드+손패 공용 캔버스)
const R_H = 460;   // 논리 좌표계 높이 (보드 y0~250 · 손패 y250~460 제안)
let rApp = null;       // PIXI.Application — app.init 완료 시에만 set (준비 전엔 null)
let rReady = false;    // rActive() 판정 SSoT — init resolve 후에만 true
// ?render=dom 강제 폴백 플래그: URL 쿼리 검사(art=sheet 모드와 동일 패턴).
function rDomForced(){ return /[?&]render=dom(&|$)/.test(location.search); }
// WebGL 가용성 사전 감지 — Application.init 실패 전에 조용히 폴백 판정(콘솔 에러 0 유지).
function rWebglOK(){ try{ const c=document.createElement("canvas"); return !!(c.getContext("webgl2")||c.getContext("webgl")); }catch(e){ return false; } }
// 스테이지 초기화 — PIXI 미존재·?render=dom·WebGL 실패 시 전부 조용히 폴백(rActive()=false, 게임 DOM 경로 무영향).
// v8 시맨틱: new PIXI.Application() + await app.init({...})는 비동기 → 내부에서 Promise로 감싸 완료 시 onReady 호출.
// 이 태스크에선 캔버스를 mountEl에 붙이기만 하고 표시(#stage display)는 CSS가 항상 숨김(다음 태스크가 rActive 시 표시).
function rStageInit(mountEl, onReady){
  if(!mountEl || typeof PIXI==="undefined" || rDomForced() || !rWebglOK()) return;   // 조용한 폴백
  const app = new PIXI.Application();
  app.init({ width:R_W, height:R_H, backgroundAlpha:0, antialias:false, autoDensity:true, resolution:(window.devicePixelRatio||1) })
    .then(function(){ rApp=app; rReady=true; mountEl.appendChild(app.canvas); if(typeof onReady==="function") onReady(); })
    .catch(function(e){ rApp=null; rReady=false; });   // init 실패 시에도 조용히 폴백(콘솔 에러 억제)
}
// 폴백 판정 SSoT — Pixi 스테이지가 살아있으면 true. main.cjs·rSync가 이 값으로 경로 분기(다음 태스크).
function rActive(){ return rReady; }
// PIXI.Application 접근자(다음 태스크의 씬 그래프·ticker 소비). 준비 전엔 null.
function rStage(){ return rApp; }
// 리사이즈 반영 — 컨테이너 폭 실측 → 스테이지 스케일(spec §5). 스캐폴드에선 no-op(논리 좌표계 고정, 다음 태스크가 배선).
function rStageResize(){ if(!rApp) return; }
module.exports = { rStageInit, rActive, rStage, rStageResize, R_W, R_H };
