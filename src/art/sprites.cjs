// src/art/sprites.cjs — 비트맵 어휘(rows 인코딩: "X"=칠함, "."=투명). 색은 스탬프 시 주입.
const ART_GLYPH={
  A:[".X.","X.X","XXX","X.X","X.X"],
  2:["XX.","..X",".X.","X..","XXX"],
  3:["XX.","..X",".X.","..X","XX."],
  4:["X.X","X.X","XXX","..X","..X"],
  5:["XXX","X..","XX.","..X","XX."],
  6:[".XX","X..","XX.","X.X",".X."],
  7:["XXX","..X",".X.",".X.",".X."],
  8:[".X.","X.X",".X.","X.X",".X."],
};
const ART_PIP={
  0:{ 9:["....X....","...XXX...","..XXXXX..",".XXXXXXX.","XXXXXXXXX","XXXXXXXXX",".XX.X.XX.","....X....","...XXX..."],
      7:["...X...","..XXX..",".XXXXX.","XXXXXXX","XXXXXXX","...X...",".XXXXX."],
      5:["..X..",".XXX.","XXXXX","..X..",".XXX."] },
  1:{ 9:[".XX...XX.","XXXX.XXXX","XXXXXXXXX","XXXXXXXXX",".XXXXXXX.","..XXXXX..","...XXX...","....X....","........."],
      7:[".XX.XX.","XXXXXXX","XXXXXXX",".XXXXX.","..XXX..","...X...","......."],
      5:[".X.X.","XXXXX","XXXXX",".XXX.","..X.."] },
  2:{ 9:["....X....","...XXX...","..XXXXX..",".XXXXXXX.","XXXXXXXXX",".XXXXXXX.","..XXXXX..","...XXX...","....X...."],
      7:["...X...","..XXX..",".XXXXX.","XXXXXXX",".XXXXX.","..XXX..","...X..."],
      5:["..X..",".XXX.","XXXXX",".XXX.","..X.."] },
  3:{ 9:["...XXX...","..XXXXX..","...XXX...",".XX.X.XX.","XXXXXXXXX","XXXXXXXXX",".XX.X.XX.","....X....","...XXX..."],
      7:["..XXX..",".XXXXX.","..XXX..","XXXXXXX","XXXXXXX","...X...",".XXXXX."],
      5:[".XXX.","XXXXX","..X..","XXXXX",".XXX."] },
};
const ART_BADGE={
  wild:["..X..",".XXX.","XXXXX",".XXX.","X.X.X"],
  gold:[".XXX.","XXXXX","XXXXX","XXXXX",".XXX."],
  mult:["..X..",".XXX.","XXXXX",".XXX.","..X.."],
};
module.exports = { ART_GLYPH, ART_PIP, ART_BADGE };
