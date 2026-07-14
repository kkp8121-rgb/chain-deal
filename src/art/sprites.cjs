// src/art/sprites.cjs — 비트맵 어휘(rows 인코딩). 색은 스탬프 시 주입.
// ★v2(71x95 재저작): 글리프 9x11(굵은 2px 획·세리프 발)·핍 25|15|13|9(25/15/13=3톤 X/s/h, 9=단색 X)·배지 11x11.
// 3톤 인코딩: "X"=기본색 · "s"=음영(우하 rim) · "h"=하이라이트(좌상 rim) · "."=투명. 실색 매핑은 cards.cjs가 suit별 주입(단색은 artStamp, 3톤은 artStampMap).
const ART_GLYPH={
  A:["...XXX...","..XXXXX..","..XX.XX..",".XX...XX.",".XX...XX.","XX.....XX","XXXXXXXXX","XXXXXXXXX","XX.....XX","XX.....XX","XX.....XX"],
  2:[".XXXXXX..","XXXXXXXX.","XX....XX.","......XX.",".....XX..","...XXX...","..XXX....",".XXX.....","XXX......","XXXXXXXXX","XXXXXXXXX"],
  3:["XXXXXXXX.","XXXXXXXX.",".....XXX.","...XXXX..","..XXXX...","...XXXX..",".....XXX.","......XX.","XX...XXX.","XXXXXXXX.",".XXXXXX.."],
  4:["....XXX..","...XXXX..","..XX.XX..",".XX..XX..","XX...XX..","XX...XX..","XXXXXXXXX","XXXXXXXXX",".....XX..",".....XX..",".....XX.."],
  5:["XXXXXXXX.","XXXXXXXX.","XX.......","XX.......","XXXXXXX..","XXXXXXXX.","......XXX","......XX.","XX...XXX.","XXXXXXXX.",".XXXXXX.."],
  6:["..XXXXX..",".XXXXXX..","XXX......","XX.......","XXXXXXX..","XXXXXXXX.","XX....XX.","XX....XX.","XXX..XXX.",".XXXXXX..","..XXXX..."],
  7:["XXXXXXXXX","XXXXXXXXX",".....XXX.","....XXX..","...XXX...","...XXX...","..XXX....","..XXX....",".XXX.....",".XXX.....",".XXX....."],
  8:[".XXXXXX..","XXXXXXXX.","XX....XX.","XXX..XXX.",".XXXXXX..",".XXXXXX..","XXX..XXX.","XX....XX.","XX....XX.","XXXXXXXX.",".XXXXXX.."],
};
const ART_PIP={
  0:{25:[".........................","............h............","............h............","...........hhh...........","..........hhhhh..........",".........hhhXXhh.........","........hhhXXXXhh........","........hhXXXXXXh........",".......hhhXXXXXXXs.......","......hhhXXXXXXXXss......","....hhhhXXXXXXXXXXsss....","...hhhhXXXXXXXXXXXXXss...","..hhhXXXXXXXXXXXXXXXXss..",".hhhXXXXXXXXXXXXXXXXXXss.",".hhXXXXXXXXXXXXXXXXXXXss.","hhhXXXXXXXXXXXXXXXXXXXXss","hhXXXXXXXXXXXXXXXXXXXXXss","hhXXXXXXXXXXXXXXXXXXXXXss","hhXXXXXXXXXXXXXXXXXXXXsss",".hhXXXXXXXXXXXXXXXXXXXss.",".hhXXXXXXXXXXXXXXXXXXsss.","..hXssXXXXXXXXXXXXsssss..","...sssssssssssssssssss...","......sssssssssssss......","........................."],
     15:["...............",".......h.......","......hhh......",".....hhhhh.....","....hhhXXhX....","....hhXXXXs....","..hhhhXXXXsss..",".hhhhXXXXXXXss.","hhhXXXXXXXXXXss","hhXXXXXXXXXXXss","hhXXXXXXXXXXXss","hhXXXXXXXXXXsss",".hXssXXXXsssss.","..sssssssssss..",".....sssss....."],
     13:["......h......","......h......",".....hhh.....","....hhhhh....","...hhhXXXs...","..hhhXXXXss..",".hhhXXXXXXss.","hhhXXXXXXXXss","hhXXXXXXXXXss","hhXXXXXXXXsss",".hXsXXXXssss.","..sssssssss..","....sssss...."],
     9:["....X....","...XXX...","...XXX...",".XXXXXXX.","XXXXXXXXX","XXXXXXXXX","XXXXXXXXX",".XXXXXXX.","...XXX..."] },
  1:{25:[".........................","......hh.........hh......","...hhhhhhhh...hhhhhhhh...","..hhhhhXhhhh.hhhhhXhhXs..",".hhhXXXXXXXhhhhXXXXXXXss.",".hhXXXXXXXXXhhXXXXXXXXss.","hhhXXXXXXXXXXXXXXXXXXXXss","hhXXXXXXXXXXXXXXXXXXXXXss","hhXXXXXXXXXXXXXXXXXXXXXss","hhXXXXXXXXXXXXXXXXXXXXsss",".hhXXXXXXXXXXXXXXXXXXXss.",".hhXXXXXXXXXXXXXXXXXXsss.","..hhXXXXXXXXXXXXXXXXsss..","...hhXXXXXXXXXXXXXssss...","....hhhXXXXXXXXXXssss....","......hhXXXXXXXXsss......",".......hXXXXXXXsss.......","........sXXXXXXss........","........ssXXXXsss........",".........ssXXsss.........","..........sssss..........","...........sss...........","............s............","............s............","........................."],
     15:["...............","..hhhh...hhhh..",".hhhhhh.hhhhXs.","hhhXXXhhhhXXXss","hhXXXXXhhXXXXss","hhXXXXXXXXXXXss","hhXXXXXXXXXXsss",".hhXXXXXXXssss.","..hhhXXXXssss..","....hXXXXss....","....XsXXsss....",".....sssss.....","......sss......",".......s.......","..............."],
     13:[".............","..hhhh.hhhh..",".hhhhhhhhhXs.","hhhXXXhhXXXss","hhXXXXXXXXXss","hhXXXXXXXXsss",".hhXXXXXXsss.","..hhXXXXsss..","...hXXXsss...","....sssss....",".....sss.....","......s......","......s......"],
     9:[".........",".XXX.XXX.","XXXXXXXXX","XXXXXXXXX","XXXXXXXXX",".XXXXXXX.","...XXX...","...XXX...","....X...."] },
  2:{25:["............h............","...........hhh...........","..........hhhhh..........",".........hhhXXhh.........","........hhhXXXXhh........",".......hhhXXXXXXhh.......","......hhhXXXXXXXXhX......",".....hhhXXXXXXXXXXss.....","....hhhXXXXXXXXXXXXss....","...hhhXXXXXXXXXXXXXXss...","..hhhXXXXXXXXXXXXXXXXss..",".hhhXXXXXXXXXXXXXXXXXXss.","hhhXXXXXXXXXXXXXXXXXXXsss",".hhXXXXXXXXXXXXXXXXXXsss.","..hhXXXXXXXXXXXXXXXXsss..","...hhXXXXXXXXXXXXXXsss...","....hhXXXXXXXXXXXXsss....",".....hhXXXXXXXXXXsss.....","......XsXXXXXXXXsss......",".......ssXXXXXXsss.......","........ssXXXXsss........",".........ssXXsss.........","..........sssss..........","...........sss...........","............s............"],
     15:[".......h.......","......hhh......",".....hhhhh.....","....hhhXXhh....","...hhhXXXXXs...","..hhhXXXXXXss..",".hhhXXXXXXXXss.","hhhXXXXXXXXXsss",".hhXXXXXXXXsss.","..hhXXXXXXsss..","...hXXXXXsss...","....ssXXsss....",".....sssss.....","......sss......",".......s......."],
     13:["......h......",".....hhh.....","....hhhhh....","...hhhXXhX...","..hhhXXXXss..",".hhhXXXXXXss.","hhhXXXXXXXsss",".hhXXXXXXsss.","..hhXXXXsss..","...XsXXsss...","....sssss....",".....sss.....","......s......"],
     9:["....X....","...XXX...","..XXXXX..",".XXXXXXX.","XXXXXXXXX",".XXXXXXX.","..XXXXX..","...XXX...","....X...."] },
  3:{25:[".........................","..........hhhhh..........",".........hhhhhhh.........","........hhhXXXXhh........",".......hhhXXXXXXhh.......",".......hhXXXXXXXXh.......","......hhhXXXXXXXXXX......","...hhhhhXXXXXXXXXXXXss...","..hhhhhXXXXXXXXXXXXXXss..","..hhXXXXXXXXXXXXXXXXXss..",".hhhXXXXXXXXXXXXXXXXXXss.",".hhXXXXXXXXXXXXXXXXXXXss.",".hhXXXXXXXXXXXXXXXXXXXss.",".hhXXXXXXXXXXXXXXXXXXXss.",".hhXXXXXXXXXXXXXXXXXXsss.","..hhXXXXXXXXXXXXXXXXsss..","...hhXXXXsXXXXssssssss...","....hhXXsssXXssssssss....","..........XXXss..........",".........XXXXXss.........",".........XXXXXss.........",".........XXXXXss.........","........sssssssss........","........sssssssss........","........................."],
     15:["...............",".....hhhhh.....",".....hhhhh.....","....hhhXXhh....","..hhhhXXXXXss..",".hhhhXXXXXXXss.",".hhXXXXXXXXXss.",".hhXXXXXXXXXss.",".hhXXXXXXXXXss.",".hhXXXXXssssss.","..hhXssssssss..","......Xss......",".....XXXss.....",".....sssss.....",".....sssss....."],
     13:[".............",".....hhh.....","....hhhhh....","...hhhXXhX...",".hhhhXXXXXss.",".hhhXXXXXXss.",".hhXXXXXXXss.",".hhXXXXXXsss.",".hhXXXXsssss.","...Xssssss...",".....Xss.....",".....sss.....","....sssss...."],
     9:[".........","...XXX...","..XXXXX..",".XXXXXXX.","XXXXXXXXX",".XXXXXXX.",".XXXXXXX.","...XXX...","...XXX..."] },
};
const ART_BADGE={
  wild:[".....X.....","....XXX....","....XXX....","XXXXXXXXXXX",".XXXXXXXXX.","..XXXXXXX..","..XXXXXXX..","..XXX.XXX..",".XXX...XXX.",".XX.....XX.","XX.......XX"],
  gold:["...XXXXX...",".XXXXXXXXX.",".XXXXXXXXX.","XXXXXXXXXXX","XXXXXXXXXXX","XXXXXXXXXXX","XXXXXXXXXXX","XXXXXXXXXXX",".XXXXXXXXX.",".XXXXXXXXX.","...XXXXX..."],
  mult:[".....X.....","....XXX....","...XXXXX...","..XXXXXXX..",".XXXXXXXXX.","XXXXXXXXXXX",".XXXXXXXXX.","..XXXXXXX..","...XXXXX...","....XXX....",".....X....."],
};
module.exports = { ART_GLYPH, ART_PIP, ART_BADGE };
