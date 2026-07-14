// src/art/cards.cjs — 카드 페이스 71x95 (spec §4 v2). 코너=랭크 글리프 9x11 + 미니 무늬핍 9x9(복원).
// 중앙 핍 = 3톤 셰이딩(artStampMap, suit별 실색 주입): 적=red/redDeep/white · 흑=ink/soft(하이라이트만).
// 핍 배치(x,y=top-left, size): 대형25(A)/중형15(2~3)/소형13(4~8). 경계 검산 완료(spec §4 v2 좌표 SSoT).
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
function artFaceGrid(suit,rank,enh){
  const g=artGrid(71,95);
  artFrame(g,0,0,71,95,ART_C.soft); artFrame(g,1,1,69,93,ART_C.shade); artRect(g,2,2,67,91,ART_C.paper);
  const red=(suit===1||suit===2);
  const ink=red?ART_C.red:ART_C.ink;
  const pipMap=red?{X:ART_C.red,s:ART_C.redDeep,h:ART_C.white}:{X:ART_C.ink,s:ART_C.ink,h:ART_C.soft};
  const gl=ART_GLYPH[rank===1?"A":String(rank)];
  const mini=ART_PIP[suit][9];
  artStamp(g,5,5,gl,ink); artStamp(g,5,18,mini,ink);
  artStamp180(g,57,79,gl,ink); artStamp180(g,57,68,mini,ink);
  for(const p of ART_PIPLAY[rank]) artStampMap(g,p[0],p[1],ART_PIP[suit][p[2]],pipMap);
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
function artDrawCardFace(card){
  const k=card.suit+":"+card.rank+":"+(card.enh||"");
  let src=artFaceCache.get(k);
  if(!src){ src=artPaint(artFaceGrid(card.suit,card.rank,card.enh||null),ART_PAL); artFaceCache.set(k,src); }
  const cv=document.createElement("canvas"); cv.width=71; cv.height=95;
  cv.getContext("2d").drawImage(src,0,0); return cv;
}
function artFaceHTML(card,cls){ return `<canvas class="cface${cls?" "+cls:""}" width="71" height="95" data-cf="${card.suit},${card.rank},${card.enh||""}"></canvas>`; }
function artHydrate(root){
  root.querySelectorAll("canvas[data-cf]").forEach(cv=>{ const a=cv.getAttribute("data-cf").split(","); const card={suit:+a[0],rank:+a[1],enh:a[2]||null}; const k=card.suit+":"+card.rank+":"+(card.enh||"");
    let src=artFaceCache.get(k); if(!src){ src=artPaint(artFaceGrid(card.suit,card.rank,card.enh),ART_PAL); artFaceCache.set(k,src); }
    cv.getContext("2d").drawImage(src,0,0); cv.removeAttribute("data-cf"); });
  root.querySelectorAll("canvas[data-em]").forEach(cv=>{ const a=cv.getAttribute("data-em").split(",");   // 부적 엠블럼(charmart.cjs, 함수선언=호이스팅되어 textual 순서 무관)
    const src=artDrawCharmEmblem({shape:a[0],symbol:a[1],accent:a[2]},a[3]==="1");
    cv.getContext("2d").drawImage(src,0,0); cv.removeAttribute("data-em"); });
}
module.exports = { artDrawCardFace, artFaceHTML, artHydrate };
