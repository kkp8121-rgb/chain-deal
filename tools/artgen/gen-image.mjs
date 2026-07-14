// gen-image.mjs — Gemini 이미지 생성 CLI (키는 env GEMINI_API_KEY, 출력 금지)
// usage: node gen-image.mjs <out.png> <model> <aspect|-> <refImage|-> "<prompt>"
// aspect: "3:4" 등 (- 생략). refImage: 스타일 앵커 PNG 경로 (- 생략). 429/503 시 3회 백오프 재시도.
import { writeFileSync, readFileSync } from "fs";
const [out, model, aspect, ref, prompt] = process.argv.slice(2);
const key = process.env.GEMINI_API_KEY;
if (!key) { console.error("GEMINI_API_KEY unset"); process.exit(1); }
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
const parts = [];
if (ref && ref !== "-") parts.push({ inlineData: { mimeType: "image/png", data: readFileSync(ref).toString("base64") } });
parts.push({ text: prompt });
const body = { contents: [{ parts }] };
if (aspect && aspect !== "-") body.generationConfig = { imageConfig: { aspectRatio: aspect } };
let lastErr = "";
for (let attempt = 1; attempt <= 4; attempt++) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (res.status === 429 || res.status === 503) { lastErr = `HTTP ${res.status}`; await new Promise(r => setTimeout(r, 15000 * attempt)); continue; }
  if (!res.ok) { console.error("HTTP", res.status, (await res.text()).slice(0, 400)); process.exit(1); }
  const data = await res.json();
  const img = (data.candidates?.[0]?.content?.parts || []).find(p => p.inlineData?.data);
  if (!img) { console.error("NO_IMAGE:", JSON.stringify(data.candidates?.[0]?.finishReason || data).slice(0, 300)); process.exit(1); }
  writeFileSync(out, Buffer.from(img.inlineData.data, "base64"));
  console.log("saved", out);
  process.exit(0);
}
console.error("RETRIES_EXHAUSTED", lastErr); process.exit(1);
