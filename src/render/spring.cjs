// src/render/spring.cjs — 감쇠 스프링 물리(위치·스케일·회전 공용, 프레임 dt 기반). 순수 계산(top-level PIXI/document 미참조 — node 파싱 게이트 안전).
// rSpringStep(s,dt): s={v(현재),t(목표),vel,k(강성),d(감쇠)} → 새 v 반환. 프리셋 R_TUNE. 수렴 시 snap(잔떨림 제거). r·R_ 접두 규율.
function rSpringStep(s,dt){ const f=(s.t-s.v)*s.k; s.vel=(s.vel+f*dt)*Math.exp(-s.d*dt); s.v+=s.vel*dt; if(Math.abs(s.t-s.v)<.05&&Math.abs(s.vel)<.05){ s.v=s.t; s.vel=0; } return s.v; }
const R_TUNE={ move:{k:170,d:14}, punch:{k:320,d:11}, hover:{k:260,d:18} };
function rSpringMake(v,tune){ const p=tune||R_TUNE.move; return { v:v, t:v, vel:0, k:p.k, d:p.d }; }
function rReduced(){ try{ return !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches); }catch(e){ return false; } }
module.exports = { rSpringStep, rSpringMake, rReduced, R_TUNE };
