// src/art/sheet.cjs — 컨택트 시트(?art=sheet, spec §6.8/§7.4). CVD=Viénot/Machado 근사 행렬(개발 검수용).
const ART_CVD={
  protan:[0.152286,1.052583,-0.204868,0.114503,0.786281,0.099216,-0.003882,-0.048116,1.051998],
  deutan:[0.367322,0.860646,-0.227968,0.280085,0.672501,0.047413,-0.011820,0.042940,0.968881],
  tritan:[1.255528,-0.076749,-0.178779,-0.078411,0.930809,0.147602,0.004733,0.691367,0.303900],
};
function artCvdPal(m){ return ART_PAL.map(h=>{ if(!h) return h; const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);
  const c=v=>Math.max(0,Math.min(255,Math.round(v)));
  return "#"+[c(m[0]*r+m[1]*g+m[2]*b),c(m[3]*r+m[4]*g+m[5]*b),c(m[6]*r+m[7]*g+m[8]*b)].map(v=>v.toString(16).padStart(2,"0")).join(""); }); }
function artSheetSection(root,title){ const h=document.createElement("h3"); h.textContent=title; h.style.cssText="color:#cdd6f5;font:14px monospace;margin:14px 4px 6px"; root.appendChild(h); const d=document.createElement("div"); d.style.cssText="display:flex;flex-wrap:wrap;gap:4px;align-items:flex-start"; root.appendChild(d); return d; }
function artSheetCanvas(box,cv,scale,label){ cv.style.cssText=`width:${cv.width*scale}px;height:${cv.height*scale}px;image-rendering:pixelated`; const w=document.createElement("div"); w.style.cssText="text-align:center;font:9px monospace;color:#8a93b6"; w.appendChild(cv); if(label){ const t=document.createElement("div"); t.textContent=label; w.appendChild(t);} box.appendChild(w); }
function artContactSheet(root){
  root.innerHTML=""; root.style.cssText="background:#0b0e1d;min-height:100vh;padding:10px";
  const pal=artSheetSection(root,"ART_PAL 16");
  for(let i=1;i<ART_PAL.length;i++){ const g=artGrid(12,12); artRect(g,0,0,12,12,i); artSheetCanvas(pal,artPaint(g,ART_PAL),3,String(i)); }
  const faces=artSheetSection(root,"카드 32 + enh");
  for(let s=0;s<4;s++) for(let r=1;r<=8;r++) artSheetCanvas(faces,artDrawCardFace({suit:s,rank:r,enh:null}),2);
  ["wild","gold","mult"].forEach(e=>artSheetCanvas(faces,artDrawCardFace({suit:0,rank:1,enh:e}),2,e));
  const emb=artSheetSection(root,"엠블럼 22 (+locked)");
  for(const c of CHARMS){ artSheetCanvas(emb,artDrawCharmEmblem(c.art,false),3,c.id); }
  for(const c of CHARMS){ artSheetCanvas(emb,artDrawCharmEmblem(c.art,true),3); }
  for(const k in ART_CVD){ const p=artCvdPal(ART_CVD[k]); const sec=artSheetSection(root,"CVD "+k);
    for(let i=1;i<ART_PAL.length;i++){ const g=artGrid(12,12); artRect(g,0,0,12,12,i); artSheetCanvas(sec,artPaint(g,p),3,String(i)); }
    for(const c of CHARMS){ const g=artGrid(16,16); artRect(g,0,0,16,16,ART_C.navy); artFrame(g,0,0,16,16,ART_C.slate); ART_SHAPE[c.art.shape](g,ART_C[c.art.accent]); artStamp(g,3,3,ART_SYMBOL[c.art.symbol]||ART_SYMBOL.flame,ART_C.navy); artSheetCanvas(sec,artPaint(g,p),3,c.id); } }
}
module.exports = { artContactSheet };
