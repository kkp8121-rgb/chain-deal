// src/art/pixel.cjs — 픽셀 그리드 조립(팔레트 인덱스) + 캔버스 페인트 분리 (spec §2).
// 분리 이유: CVD 시뮬(sheet.cjs)이 같은 그리드를 변환 팔레트로 재페인트. ART_PAL은 palette.cjs(concat 전역).
function artGrid(w,h){ return {w:w,h:h,px:new Uint8Array(w*h)}; }
function artSet(g,x,y,c){ if(x>=0&&y>=0&&x<g.w&&y<g.h) g.px[y*g.w+x]=c; }
function artRect(g,x,y,w,h,c){ for(let j=0;j<h;j++) for(let i=0;i<w;i++) artSet(g,x+i,y+j,c); }
function artFrame(g,x,y,w,h,c){ artRect(g,x,y,w,1,c); artRect(g,x,y+h-1,w,1,c); artRect(g,x,y,1,h,c); artRect(g,x+w-1,y,1,h,c); }
function artStamp(g,x,y,rows,c){ for(let j=0;j<rows.length;j++){ const r=rows[j]; for(let i=0;i<r.length;i++) if(r[i]==="X") artSet(g,x+i,y+j,c); } }
function artStamp180(g,x,y,rows,c){ const H=rows.length,W=rows[0].length; for(let j=0;j<H;j++){ const r=rows[H-1-j]; for(let i=0;i<W;i++) if(r[W-1-i]==="X") artSet(g,x+i,y+j,c); } }
function artStampMap(g,x,y,rows,map){ for(let j=0;j<rows.length;j++){ const r=rows[j]; for(let i=0;i<r.length;i++){ const c=map[r[i]]; if(c) artSet(g,x+i,y+j,c); } } }
function artStampMap180(g,x,y,rows,map){ const H=rows.length,W=rows[0].length; for(let j=0;j<H;j++){ const r=rows[H-1-j]; for(let i=0;i<W;i++){ const c=map[r[W-1-i]]; if(c) artSet(g,x+i,y+j,c); } } }
function artPaint(g,palHex){ const cv=document.createElement("canvas"); cv.width=g.w; cv.height=g.h; const cx=cv.getContext("2d"); for(let j=0;j<g.h;j++) for(let i=0;i<g.w;i++){ const p=g.px[j*g.w+i]; if(p){ cx.fillStyle=palHex[p]; cx.fillRect(i,j,1,1); } } return cv; }
module.exports = { artGrid, artSet, artRect, artFrame, artStamp, artStamp180, artStampMap, artStampMap180, artPaint };
