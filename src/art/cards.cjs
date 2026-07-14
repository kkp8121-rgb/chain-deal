// src/art/cards.cjs — 카드 페이스 142x190 (spec §4 v3). AI 생성 시트 크롭 + 코드 코너/enh 오버레이 + 절차 폴백.
// ★v3: 중앙 핍 필드 = AI 생성 시트(assets/cards.png, 8열 rank1..8 × 4행 suit0..3, 셀 142×190) 크롭.
//   시트 로드 전/실패 시 = v2 절차 렌더 폴백(artFaceGrid: 보더+중앙핍만, 71×95 → 2× 업스케일).
// 오버레이(코드 보장, 시트·폴백 공통): 코너 랭크 글리프 9×11 + 미니 무늬핍 9×9 + enh 프레임/배지.
//   → artOverlayGrid로 분리(폴백 경로 코너 이중 스탬프 방지 — artFaceGrid는 코너·enh 미포함).
// 핍 배치(x,y=top-left, size): 대형25(A)/중형15(2~3)/소형13(4~8). 좌표 SSoT = spec §4 v2.
const ART_PIPLAY={
  1:[[23,35,25]],
  2:[[28,22,15],[28,58,15]],
  3:[[28,14,15],[28,40,15],[28,66,15]],
  4:[[20,24,13],[38,24,13],[20,58,13],[38,58,13]],
  5:[[20,24,13],[38,24,13],[20,58,13],[38,58,13],[29,41,13]],
  6:[[20,16,13],[38,16,13],[20,41,13],[38,41,13],[20,66,13],[38,66,13]],
  7:[[20,16,13],[38,16,13],[20,41,13],[38,41,13],[20,66,13],[38,66,13],[29,28,13]],
  8:[[20,12,13],[38,12,13],[20,32,13],[38,32,13],[20,52,13],[38,52,13],[20,72,13],[38,72,13]],
};
const ART_ENH_COL={wild:"green",gold:"gold",mult:"purple"};
const artFaceCache=new Map();
let artSheetImg=null, artSheetOK=false; const artSheetCbs=[];
function artSheetReady(cb){ if(artSheetImg&&(artSheetOK||artSheetImg._failed)) cb(artSheetOK); else artSheetCbs.push(cb); }
function artSheetLoad(){ if(artSheetImg) return; artSheetImg=new Image();
  artSheetImg.onload=()=>{ artSheetOK=true; artFaceCache.clear(); artSheetCbs.splice(0).forEach(f=>f(true)); };
  artSheetImg.onerror=()=>{ artSheetImg._failed=true; artSheetCbs.splice(0).forEach(f=>f(false)); };
  artSheetImg.src="assets/cards.png"; }
function artFaceGrid(suit,rank){
  const g=artGrid(71,95);
  artFrame(g,0,0,71,95,ART_C.soft); artFrame(g,1,1,69,93,ART_C.shade); artRect(g,2,2,67,91,ART_C.paper);
  const red=(suit===1||suit===2);
  const pipMap=red?{X:ART_C.red,s:ART_C.redDeep,h:ART_C.white}:{X:ART_C.ink,s:ART_C.ink,h:ART_C.soft};
  for(const p of ART_PIPLAY[rank]) artStampMap(g,p[0],p[1],ART_PIP[suit][p[2]],pipMap);
  return g;
}
function artOverlayGrid(suit,rank,enh){
  const g=artGrid(71,95);
  const red=(suit===1||suit===2);
  const ink=red?ART_C.red:ART_C.ink;
  const gl=ART_GLYPH[rank===1?"A":String(rank)];
  const mini=ART_PIP[suit][9];
  artStamp(g,5,5,gl,ink); artStamp(g,5,18,mini,ink);
  artStamp180(g,57,79,gl,ink); artStamp180(g,57,68,mini,ink);
  if(enh){ const ec=ART_C[ART_ENH_COL[enh]]; const M=3,L=12,T=2;
    artRect(g,M,M,L,T,ec); artRect(g,M,M,T,L,ec);
    artRect(g,71-M-L,M,L,T,ec); artRect(g,71-M-T,M,T,L,ec);
    artRect(g,M,95-M-T,L,T,ec); artRect(g,M,95-M-L,T,L,ec);
    artRect(g,71-M-L,95-M-T,L,T,ec); artRect(g,71-M-T,95-M-L,T,L,ec);
    artRect(g,29,M,L,T,ec); artRect(g,29,95-M-T,L,T,ec);
    artRect(g,M,41,T,L,ec); artRect(g,71-M-T,41,T,L,ec);
    artRect(g,54,4,13,13,ART_C.navy); artStamp(g,55,5,ART_BADGE[enh],ec); }
  return g;
}
function artFaceCanvas(suit,rank,enh){
  const cv=document.createElement("canvas"); cv.width=142; cv.height=190;
  const cx=cv.getContext("2d"); cx.imageSmoothingEnabled=false;
  if(artSheetOK){ cx.drawImage(artSheetImg,(rank-1)*142,suit*190,142,190,0,0,142,190); }
  else { cx.drawImage(artPaint(artFaceGrid(suit,rank),ART_PAL),0,0,71,95,0,0,142,190); }
  cx.drawImage(artPaint(artOverlayGrid(suit,rank,enh),ART_PAL),0,0,71,95,0,0,142,190);
  return cv;
}
function artDrawCardFace(card){
  const k=card.suit+":"+card.rank+":"+(card.enh||"");
  let src=artFaceCache.get(k);
  if(!src){ src=artFaceCanvas(card.suit,card.rank,card.enh||null); artFaceCache.set(k,src); }
  const cv=document.createElement("canvas"); cv.width=142; cv.height=190;
  cv.getContext("2d").drawImage(src,0,0); return cv;
}
function artFaceHTML(card,cls){ return `<canvas class="cface${cls?" "+cls:""}" width="142" height="190" data-cf="${card.suit},${card.rank},${card.enh||""}"></canvas>`; }
function artHydrate(root){
  root.querySelectorAll("canvas[data-cf]").forEach(cv=>{ const a=cv.getAttribute("data-cf").split(","); const card={suit:+a[0],rank:+a[1],enh:a[2]||null}; const k=card.suit+":"+card.rank+":"+(card.enh||"");
    let src=artFaceCache.get(k); if(!src){ src=artFaceCanvas(card.suit,card.rank,card.enh); artFaceCache.set(k,src); }
    cv.getContext("2d").drawImage(src,0,0); cv.removeAttribute("data-cf"); });
  root.querySelectorAll("canvas[data-em]").forEach(cv=>{ const a=cv.getAttribute("data-em").split(",");   // 부적 엠블럼(charmart.cjs, 함수선언=호이스팅되어 textual 순서 무관)
    const src=artDrawCharmEmblem({shape:a[0],symbol:a[1],accent:a[2]},a[3]==="1");
    cv.getContext("2d").drawImage(src,0,0); cv.removeAttribute("data-em"); });
}
module.exports = { artDrawCardFace, artFaceHTML, artHydrate, artSheetLoad, artSheetReady };
