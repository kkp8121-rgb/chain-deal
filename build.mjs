// build.mjs — Phase 0 Step 0 (Scaffold) build pipeline.
// Assembles prototype/index.html from src/index.template.html + src/styles.css + src/main.cjs.
// esbuild is a build-time-only devDependency — the shipped prototype/index.html has zero runtime deps.
//
// ★ src/main.cjs has no require()/import yet — there is nothing to bundle (that arrives in later Phase 0
// steps once content/rules/engine modules exist). Step 0's job is a verbatim code move, so this pipeline
// uses esbuild as a SYNTAX-VALIDATION GATE only (fails the build on a parse error) and inlines the raw,
// untransformed src/main.cjs + src/styles.css text into the template. Two esbuild behaviors make running
// its *output* through unsuitable for this step:
//   1. esbuild's printer unconditionally strips regular // and /* */ comments (even with minify:false;
//      legalComments only preserves license/copyright-style comments) — this file's comments carry load-
//      bearing design rationale (CLAUDE.md/HANDOVER references, drift-sync notes) that must survive intact.
//   2. bundle:true would treat a ".cjs" entry as a CommonJS module and wrap it in an unused __commonJS()
//      factory (no module.exports exists in the source), silently discarding every top-level statement —
//      and even bundle:false's plain-transform output re-serializes the AST (reformatted whitespace,
//      \uXXXX-escaped Korean/suit characters unless charset:'utf8' is set), which is not "verbatim".
// Bottom line: emitting esbuild's transformed JS into the page would violate the verbatim/no-semantic-
// change constraint for this step. Once later Phase-0 steps introduce real cross-file require()s, the
// bundle output (with charset:'utf8') becomes the right choice — revisit this file then.
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "src");
const OUT = path.join(__dirname, "prototype", "index.html");

async function main() {
  // Syntax-validation gate only — output is discarded, see header comment.
  await build({
    entryPoints: [path.join(SRC, "main.cjs")],
    bundle: false,
    write: false,
    logLevel: "silent",
  });

  // Trim exactly one trailing newline — src/*.{cjs,css} end with a newline (standard for text files) and
  // the template already puts a newline after each marker, so without this trim every build would grow
  // an extra blank line before </style>/</script> on top of the original prototype/index.html.
  const js = readFileSync(path.join(SRC, "main.cjs"), "utf8").replace(/\n$/, "");
  const css = readFileSync(path.join(SRC, "styles.css"), "utf8").replace(/\n$/, "");
  const template = readFileSync(path.join(SRC, "index.template.html"), "utf8");

  let html = template.replace("/*__BUILD_INJECT_CSS__*/", () => css);
  html = html.replace("/*__BUILD_INJECT_JS__*/", () => js);

  if (html.includes("__BUILD_INJECT_")) {
    throw new Error("build.mjs: an injection marker was not replaced — check src/index.template.html");
  }

  writeFileSync(OUT, html);
  console.log(`Built ${path.relative(__dirname, OUT)} (${html.length.toLocaleString()} bytes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
