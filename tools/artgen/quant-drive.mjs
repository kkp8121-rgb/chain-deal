// quant-drive.mjs — 카드 1장을 quant.html 페이지에 주입할 eval JS 파일 생성
// usage: node quant-drive.mjs <in-image> <key> <w> <h> <out-evaljs>
import { readFileSync, writeFileSync } from "fs";
const [inp, key, w, h, out] = process.argv.slice(2);
const b64 = readFileSync(inp).toString("base64");
const mime = inp.endsWith(".png") ? "image/png" : "image/jpeg";
writeFileSync(out, `window.quantize("data:${mime};base64,${b64}", ${JSON.stringify(key)}, ${w}, ${h})`);
console.log("wrote", out);
