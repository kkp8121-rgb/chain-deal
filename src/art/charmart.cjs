// src/art/charmart.cjs — 부적 엠블럼 16×16 (spec §5). navy 바탕+slate 보더+accent.
// (shape,accent) 조합 22종 유니크 = 구분성 1차 규칙. locked=ink-soft 실루엣.
// ★art/ 규약: 최상위 식별자 art/ART_ 접두, leaf 간 require 금지(파사드 art.cjs만 의존 순서로 require).
//   여기서 쓰는 artGrid/artRect/artFrame/artStamp/artPaint·ART_C/ART_PAL 은 concat 전역(pixel/palette).
// ★심볼 인코딩: 10행×10자, "X"=칠함 "."=투명. 스탬프 위치 (3,3) — 틀 위 navy 음각(심볼=구멍). locked는 ink 실루엣.
//   판독 규칙: 2px 이상 굵기(1px 음각은 안 보임)·수직/수평/계단 우선. Task 6에서 시각 이터레이션(키·크기 불변).
const ART_SHAPE={
  shield:(g,c)=>{ artRect(g,3,2,10,9,c); artRect(g,4,11,8,2,c); artRect(g,6,13,4,1,c); },
  coin:(g,c)=>{ artRect(g,4,2,8,12,c); artRect(g,2,4,12,8,c); artRect(g,3,3,10,10,c); },
  banner:(g,c)=>{ artRect(g,3,2,10,11,c); artRect(g,3,13,4,1,c); artRect(g,9,13,4,1,c); },
  plate:(g,c)=>{ artRect(g,2,4,12,9,c); },
  diamond:(g,c)=>{ for(let j=0;j<6;j++){ artRect(g,8-1-j,2+j,2+2*j,1,c); artRect(g,8-1-j,13-j,2+2*j,1,c); } artRect(g,2,8,12,1,c); },
  gem:(g,c)=>{ artRect(g,5,2,6,1,c); artRect(g,3,3,10,4,c); artRect(g,4,7,8,3,c); artRect(g,6,10,4,2,c); artRect(g,7,12,2,1,c); },
};
const ART_SYMBOL={
  flame:["....X.....","...XX.....","...XXX....","..XXXX....",".XXXXXX...",".XX.XXX...","XXX.XXXX..","XXXXXXXX..",".XXXXXX...","..XXXX...."],
  arch:["..........","XXXXXXXXXX","X..XXXX..X","..XX..XX..",".XX....XX.",".X......X.","XX......XX","X........X","X........X",".........."],
  steps:[".......XXX",".......X..","....XXXX..","....X.....",".XXXX.....",".X........","XX........","X.........","X.........","XXXXXXXXXX"],
  scales:["....X.....","..XXXXX...",".X..X..X..","X...X...X.","XXX.X.XXX.",".X..X..X..","....X.....","....X.....","...XXX....","..XXXXX..."],
  stack:["..........",".XXXXXXXX.",".XXXXXXXX.","..........",".XXXXXXXX.",".XXXXXXXX.","..........",".XXXXXXXX.",".XXXXXXXX.",".........."],
  pips2:["..........","..........",".XX....XX.","XXXX..XXXX","XXXX..XXXX","XXXX..XXXX",".XX....XX.","..........","..........",".........."],
  ascend:["..........","......XXXX","......XXXX","....XXXX..","....XX....","..XXXX....","..XX......","XXXX......","XX........",".........."],
  burst:["....XX....",".X..XX..X.","..X.XX.X..","...XXXX...","XXXXXXXXXX","XXXXXXXXXX","...XXXX...","..X.XX.X..",".X..XX..X.","....XX...."],
  spademoon:["..XXXX....",".XXX......","XXX....X..","XX....XXX.","XX...XXXXX","XX....XXX.","XX.....X..","XXX.......",".XXX......","..XXXX...."],
  twindots:["XXXX..XXXX",".XX....XX.",".XX....XX.",".XX....XX.",".XX....XX.",".XX....XX.",".XX....XX.",".XX....XX.","XXXX..XXXX",".........."],
  press:["XXXXXXXXXX","XXXXXXXXXX","....XX....","....XX....","..XXXXXX..","..XXXXXX..","..........","XXXXXXXXXX","XXXXXXXXXX",".........."],
  sprout:[".XX....XX.","XXXX..XXXX",".XXX..XXX.","...XXXX...","....XX....","....XX....","....XX....","....XX....","..XXXXXX..",".........."],
  keystone:["..........","XXXXXXXXXX","XXXXXXXXXX",".XXXXXXXX.",".XXXXXXXX.","..XXXXXX..","..XXXXXX..","...XXXX...","...XXXX...",".........."],
  chisel:[".XXX......",".XXX......",".XXX......",".XXX...X..","..X...XXX.","..X..XXXXX","..X...XXX.",".XXX...X..","..........",".........."],
  prism:["...X......","..XXX.....","..XXX..XXX",".XXXXX....",".XXXXX.XXX","XXXXXXX...","XXXXXXX.XX","..........","..........",".........."],
  box:[".XXXXXXXX.",".X......X.",".XXXXXXXX.","..........","XXXXXXXXXX","X...XX...X","X..XXXX..X","X...XX...X","X........X","XXXXXXXXXX"],
  peak:["....XXXX..","....X.....","...XXX....","...XXXX...","..XXXXXX..","..XXXXXX..",".XXXXXXXX.","XXXXXXXXXX","XXXXXXXXXX",".........."],
  ingot:["..........","...XXXX...","..XXXXXX..","..XXXXXX..","..........",".XXXXXXXX.","XXXXXXXXXX","XXXXXXXXXX","..........",".........."],
  waves:["..........","...XXXX...","..X....X..",".X..XX..X.",".X.X..X.X.",".X.X..X.X.",".X..XX..X.","..X....X..","...XXXX...",".........."],
  dice:["XXXXXXXXXX","X........X","X.XX..XX.X","X.XX..XX.X","X........X","X...XX...X","X...XX...X","X.XX..XX.X","X.XX..XX.X","XXXXXXXXXX"],
  bolt:[".....XXX..","....XX....","...XX.....","..XXXXX...",".....XX...","....XX....","...XX.....","..XX......",".X........",".........."],
  halves:["...XXXX...",".XXX...X..",".XX.....X.","XXX......X","XXX......X","XXX......X","XXX......X",".XX.....X.",".XXX...X..","...XXXX..."],
};
function artDrawCharmEmblem(art,locked){
  const g=artGrid(16,16);
  artRect(g,0,0,16,16,ART_C.navy); artFrame(g,0,0,16,16,ART_C.slate);
  const ac=locked?ART_C.soft:ART_C[art.accent];
  ART_SHAPE[art.shape](g,ac);
  const sym=ART_SYMBOL[art.symbol]||ART_SYMBOL.flame;   // 폴백=중복 flame이 시트에서 시각적으로 드러남(무성 실패 방지)
  artStamp(g,3,3,sym,locked?ART_C.ink:ART_C.navy);      // 틀 위 navy 음각 — locked는 ink로 실루엣만
  return artPaint(g,ART_PAL);
}
function artEmblemHTML(c,locked,px){ const a=c.art; return `<canvas class="cemblem" width="16" height="16" style="width:${px}px;height:${px}px" data-em="${a.shape},${a.symbol},${a.accent},${locked?1:0}"></canvas>`; }
module.exports = { ART_SHAPE, ART_SYMBOL, artDrawCharmEmblem, artEmblemHTML };
