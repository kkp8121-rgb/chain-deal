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
  root.querySelectorAll("canvas[data-em]").forEach(cv=>{ const a=cv.getAttribute("data-em").split(",");   // 부적 엠블럼(charmart.cjs, 함수선언=호이스팅되어 textual 순서 무관)
    const src=artDrawCharmEmblem({shape:a[0],symbol:a[1],accent:a[2]},a[3]==="1");
    cv.getContext("2d").drawImage(src,0,0); cv.removeAttribute("data-em"); });
}
module.exports = { artDrawCardFace, artFaceHTML, artHydrate };
