// src/render/board.cjs — Pixi 씬 상태 동기화(spec §3). S=SSoT diff → 스프라이트 생성/제거·시각키 텍스처 재대입·목표좌표·상시 willchain.
// ★star topology leaf: spring(rSpringStep/rSpringMake/rReduced/R_TUNE)·stage(rActive/rStage/R_W/R_H)·cardsprite(rCardTexture)·
//   art(artSheetOK/artDrawCardFace)·main(S/placeCard/connect/climbSealed/bossId/SLOTS/t) 심볼을 concat 전역으로 참조(leaf 간 require 금지). r·R_ 접두.
// 좌표계 = stage 논리 800×460(spec §5): 보드 카드 71×95 중심 y110 · 손패 카드 88×118 중심 y350 · 프롬프트 y258.
const R_SCALE_ROW = 71/142;    // 텍스처 142×190 → 보드 71×95(=0.5)
const R_SCALE_HAND = 88/142;   // → 손패 88×118(≈0.62)
const R_BOARD_Y = 110;         // 보드 카드 중심 y (0~250 영역)
const R_HAND_Y = 350;          // 손패 카드 중심 y (250~460 영역)
const R_PROMPT_Y = 258;        // 프롬프트 텍스트 y
const R_ENTER_STAGGER = 0.045; // 입장 스태거(초/장)
const rMap = new Map();        // Map<cardObj, container> — 살아있는 카드(식별=객체 identity)
const rDead = [];              // 퇴장 애니메이션 중(페이드/슬라이드 후 destroy)
let rGen = 0, rLastSheetOK = false;  // 시트 세대 카운터: artSheetOK 전이 감지 → 전 스프라이트 텍스처 재대입(콜백 순서 무의존)
let rEnterN = 0;               // rSync 1회당 신규 입장 카운터(스태거용)
let rSceneReady = false, rSlotLayer = null, rCardLayer = null, rPromptText = null;

function rSlotX(i){ const cw=71, gap=5, tot=SLOTS*cw+(SLOTS-1)*gap, x0=(R_W-tot)/2; return x0 + i*(cw+gap) + cw/2; }
function rHandX(i,n){ const cw=88, gap=12, tot=n*cw+(n-1)*gap, x0=(R_W-tot)/2; return x0 + i*(cw+gap) + cw/2; }

// 빈 슬롯 대시 프레임(DOM .pcard.empty 2px dashed #2c3766 대응) — 직선 대시 근사(코너 반경 생략).
function rDashRect(g,x,y,w,h,dash,gap,col){
  const seg=(x1,y1,x2,y2)=>{ const dx=x2-x1, dy=y2-y1, len=Math.hypot(dx,dy)||1, ux=dx/len, uy=dy/len; let d=0; while(d<len){ const e=Math.min(d+dash,len); g.moveTo(x1+ux*d,y1+uy*d).lineTo(x1+ux*e,y1+uy*e); d+=dash+gap; } };
  seg(x,y,x+w,y); seg(x+w,y,x+w,y+h); seg(x+w,y+h,x,y+h); seg(x,y+h,x,y);
  g.stroke({width:2,color:col,alpha:.9});
}

function rEnsureScene(){
  if(rSceneReady) return; const app=rStage(); if(!app) return;
  rSlotLayer=new PIXI.Container(); rCardLayer=new PIXI.Container();
  app.stage.addChild(rSlotLayer); app.stage.addChild(rCardLayer);
  for(let i=0;i<SLOTS;i++){ const g=new PIXI.Graphics(); rDashRect(g, rSlotX(i)-35.5, R_BOARD_Y-47.5, 71, 95, 7, 5, 0x2c3766); rSlotLayer.addChild(g); }
  rPromptText=new PIXI.Text({ text:t('ui.hand.pickPrompt'), style:{ fontFamily:"system-ui, -apple-system, 'Segoe UI', sans-serif", fontSize:15, fill:0x8a93b6 } });
  rPromptText.anchor.set(.5); rPromptText.x=R_W/2; rPromptText.y=R_PROMPT_Y;
  app.stage.addChild(rPromptText);
  app.ticker.add(rTick);
  rSceneReady=true;
}

// willchain 하이라이트(초록 림+글로우) — face 뒤에 두어 3~6px 림만 노출(DOM border-color #5ad15a + box-shadow 대응).
function rBuildHl(){ const g=new PIXI.Graphics(); g.roundRect(-77,-101,154,202,12).fill({color:0x5ad15a,alpha:.15}); g.roundRect(-77,-101,154,202,12).stroke({width:6,color:0x5ad15a,alpha:.95}); g.visible=false; return g; }
// ⚡×n 배지(DOM .zap 대응) — 카드 우상단.
function rBuildBadge(){ const b=new PIXI.Container(); const bg=new PIXI.Graphics(); bg.roundRect(-22,-12,44,24,11).fill(0x5ad15a); const txt=new PIXI.Text({ text:"⚡×2", style:{ fontFamily:"system-ui, sans-serif", fontSize:14, fontWeight:"900", fill:0x06210a } }); txt.anchor.set(.5); b.addChild(bg); b.addChild(txt); b.x=52; b.y=-84; b.visible=false; b.__txt=txt; return b; }

function rMakeCC(card){
  const cc=new PIXI.Container();
  const face=new PIXI.Sprite(rCardTexture(card)); face.anchor.set(.5);
  const hl=rBuildHl(), badge=rBuildBadge();
  cc.addChild(hl); cc.addChild(face); cc.addChild(badge);   // hl 뒤 · face 위 · badge 최상
  cc.__card=card; cc.__face=face; cc.__hl=hl; cc.__badge=badge; cc.__badgeTxt=badge.__txt;
  cc.__vkey=card.suit+":"+card.rank+":"+(card.enh||"")+":"+rGen;
  cc.__zone="hand"; cc.__base=R_SCALE_HAND; cc.__hover=false; cc.__liftY=0; cc.__hoverScale=1; cc.__tiltR=0; cc.__delay=0; cc.__dead=false;
  cc.sx=rSpringMake(0,R_TUNE.move); cc.sy=rSpringMake(0,R_TUNE.move); cc.ss=rSpringMake(R_SCALE_HAND,R_TUNE.move); cc.sr=rSpringMake(0,R_TUNE.hover);
  cc.hitArea=new PIXI.Rectangle(-71,-95,142,190);
  cc.on("pointertap", ()=>{ const i=S.hand.indexOf(cc.__card); if(i>=0) placeCard(i); });   // 인덱스 실시간 조회(-1 가드) — hand 재배열 무관
  cc.on("pointerover", ()=>{ cc.__hover=true; cc.__liftY=-12; cc.__hoverScale=1.06; });         // 호버 리프트/스케일(render() 미호출 — 씬만)
  cc.on("pointerout", ()=>{ cc.__hover=false; cc.__liftY=0; cc.__hoverScale=1; cc.__tiltR=0; });
  cc.on("pointermove", (e)=>{ if(!cc.__hover||!cc.parent) return; const p=cc.parent.toLocal(e.global); cc.__tiltR=Math.max(-1,Math.min(1,(p.x-cc.x)/44))*.06; });  // 포인터 위치 기반 미세 틸트
  return cc;
}

function rEnsureSprite(card, tx, ty, zone){
  let cc=rMap.get(card);
  if(!cc){ cc=rMakeCC(card);
    cc.sx.v=cc.sx.t=tx; cc.sy.v=R_H+90; cc.sy.t=ty; cc.ss.v=cc.ss.t=(zone==="row"?R_SCALE_ROW:R_SCALE_HAND);   // 입장: 화면 아래에서 시작
    cc.x=tx; cc.y=R_H+90; cc.scale.set(cc.ss.v); cc.alpha=1;
    cc.__delay=rEnterN*R_ENTER_STAGGER; rEnterN++;                                                             // 스태거 입장
    rMap.set(card,cc); rCardLayer.addChild(cc);
  }
  const vk=card.suit+":"+card.rank+":"+(card.enh||"")+":"+rGen;
  if(cc.__vkey!==vk){ cc.__face.texture=rCardTexture(card); cc.__vkey=vk; }                                    // 시각키 변경(enh mutate·시트 세대) → 텍스처 재대입
  cc.__zone=zone; cc.__tx=tx; cc.__ty=ty; cc.__base=(zone==="row"?R_SCALE_ROW:R_SCALE_HAND);
  cc.eventMode=(zone==="hand")?"static":"none"; cc.cursor=(zone==="hand")?"pointer":"default";                // 손패만 인터랙티브(줄 카드는 view-only)
  if(zone==="row"){ cc.__hover=false; cc.__liftY=0; cc.__hoverScale=1; cc.__tiltR=0; cc.__hl.visible=false; cc.__badge.visible=false; }  // 손→줄 이동 시 호버/배지 잔상 리셋
  return cc;
}

// willchain 상시(상태-구동, spec §3.4): S.showPreview일 때 연결 가능한 모든 손패 하이라이트+⚡×n. 판정식 = main.cjs render L448-456 이식(frost·climbSealed 포함).
function rWillchain(S){
  const last=S.row[S.row.length-1], bId=bossId();
  const pv=S.showPreview && !!last && !(S.boss&&S.boss.id==="frost"&&S.row.length<=1);
  let er=1;
  if(last){ for(let j=S.row.length-1;j>0;j--){ if(connect(S.row[j],S.row[j-1],bId) && !climbSealed(S.row[j],S.row[j-1],bId)) er++; else break; } }
  for(const [card,cc] of rMap){
    let on=false;
    if(cc.__zone==="hand" && pv && connect(card,last,bId) && !climbSealed(card,last,bId)) on=true;
    cc.__hl.visible=on; cc.__badge.visible=on;
    if(on) cc.__badgeTxt.text="⚡×"+(er+1);
  }
}

function rSync(S){
  if(!rActive()) return; rEnsureScene(); if(!rSceneReady) return;
  if(artSheetOK!==rLastSheetOK){ rGen++; rLastSheetOK=artSheetOK; }   // 시트 세대 전이 감지(전 스프라이트 재대입)
  rEnterN=0;
  const seen=new Set();
  for(let i=0;i<S.row.length;i++){ seen.add(S.row[i]); rEnsureSprite(S.row[i], rSlotX(i), R_BOARD_Y, "row"); }
  const n=S.hand.length;
  for(let i=0;i<n;i++){ seen.add(S.hand[i]); rEnsureSprite(S.hand[i], rHandX(i,n), R_HAND_Y, "hand"); }
  for(const [card,cc] of rMap){ if(!seen.has(card)){ rMap.delete(card); rKill(cc); } }   // 퇴장: row/hand에서 사라진 카드
  rWillchain(S);
}

function rKill(cc){
  cc.eventMode="none"; cc.__hover=false; cc.__hl.visible=false; cc.__badge.visible=false;
  if(rReduced()){ if(cc.parent) cc.parent.removeChild(cc); cc.destroy({children:true}); return; }
  cc.__dead=true; cc.__tx=cc.x; cc.__ty=R_H+120; cc.__liftY=0; cc.__hoverScale=1; cc.__tiltR=0; cc.__fade=1;   // 아래로 슬라이드 + 페이드
  rDead.push(cc);
}
function rStepCC(cc,dt,reduced){
  if(cc.__delay>0){ cc.__delay-=dt; return; }   // 스태거 대기 중엔 아래 위치 유지
  cc.sx.t=cc.__tx; cc.sy.t=cc.__ty+(cc.__liftY||0); cc.ss.t=cc.__base*(cc.__hoverScale||1); cc.sr.t=(cc.__tiltR||0);
  if(reduced){ cc.sx.v=cc.sx.t; cc.sy.v=cc.sy.t; cc.ss.v=cc.ss.t; cc.sr.v=cc.sr.t; }   // 모션 축소 → 즉시 수렴
  else { rSpringStep(cc.sx,dt); rSpringStep(cc.sy,dt); rSpringStep(cc.ss,dt); rSpringStep(cc.sr,dt); }
  cc.x=cc.sx.v; cc.y=cc.sy.v; cc.scale.set(cc.ss.v); cc.rotation=cc.sr.v;
}
function rTick(){
  const dt=Math.min(rStage().ticker.deltaMS/1000, 1/20), reduced=rReduced();   // ★초 단위 dt(deltaMS/1000) — R_TUNE k/d 전제. 1/20 상한=탭 백그라운드 복귀 폭주 방지
  for(const [card,cc] of rMap) rStepCC(cc,dt,reduced);
  for(let i=rDead.length-1;i>=0;i--){ const cc=rDead[i];
    rStepCC(cc,dt,reduced); cc.__fade-=dt*2.4; cc.alpha=Math.max(0,cc.__fade);
    if(cc.__fade<=0){ if(cc.parent) cc.parent.removeChild(cc); cc.destroy({children:true}); rDead.splice(i,1); }
  }
}
module.exports = { rSync };
