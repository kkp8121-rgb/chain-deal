// build.mjs — Phase 0 Step 0 (Scaffold) + Step 1a (content extraction) + Step 2 (pure rules extraction) build pipeline.
// Assembles prototype/index.html from src/index.template.html + src/styles.css + src/main.cjs
// (with src/content/*.cjs and src/rules/*.cjs requires resolved — see resolveRequires below).
// esbuild is a build-time-only devDependency — the shipped prototype/index.html has zero runtime deps.
//
// ★ src/main.cjs's only require()s are local `./content/*.cjs` data modules (Step 1a) and `./rules/*.cjs`
// pure-rule modules (Step 2). There is still nothing to bundle in the esbuild sense (no npm deps, no
// cross-package resolution) — this pipeline
// resolves those local requires itself via plain text splicing (resolveRequires) and uses esbuild purely
// as a SYNTAX-VALIDATION GATE (fails the build on a parse error), inlining the raw, untransformed source
// text into the template. Two esbuild behaviors make running its *output* through unsuitable for this step:
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
import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import path from "path";

const require = createRequire(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "src");
const CONTENT_DIR = path.join(SRC, "content");
const RULES_DIR = path.join(SRC, "rules");
const UI_DIR = path.join(SRC, "ui");
const OUT = path.join(__dirname, "prototype", "index.html");

// Matches a whole-line local require, e.g.:  const { CHARMS } = require('./content/charms.cjs');
// (single- or double-quoted, only relative `./`/`../` paths — no bare/npm specifiers here.)
const REQUIRE_LINE_RE = /^\s*const\s*\{[^}]*\}\s*=\s*require\((['"])(\.\.?\/[^'"]+)\1\)\s*;\s*$/;
const EXPORTS_LINE_RE = /^\s*module\.exports\s*=\s*\{[^}]*\}\s*;\s*$/;

// Resolves every local `require('./content/xxx.cjs')` line in a file by inlining the required module's
// body (verbatim, minus its own require/module.exports lines) in place — recursively, so a required
// module may itself require further content modules. Detects missing files and circular requires.
function resolveRequires(filePath, stack = []) {
  if (stack.includes(filePath)) {
    const chain = [...stack, filePath].map((p) => path.relative(__dirname, p)).join(" -> ");
    throw new Error(`build.mjs: circular require detected: ${chain}`);
  }
  const raw = readFileSync(filePath, "utf8");
  const dir = path.dirname(filePath);
  const lines = raw.replace(/\n$/, "").split("\n");
  const out = [];
  for (const line of lines) {
    const m = line.match(REQUIRE_LINE_RE);
    if (m) {
      const reqPath = path.join(dir, m[2]);
      if (!existsSync(reqPath)) {
        throw new Error(`build.mjs: required module not found: '${m[2]}' (from ${path.relative(__dirname, filePath)})`);
      }
      out.push(resolveRequires(reqPath, [...stack, filePath]));
      continue;
    }
    if (EXPORTS_LINE_RE.test(line)) continue; // module.exports is Node-only, browser has no `module`
    out.push(line);
  }
  return out.join("\n");
}

// Recursively lists every .cjs file under dir (src/content now nests src/content/locale/ — Step 1b i18n
// key-out — so this can't stay a flat readdirSync or ko.cjs/en.cjs/i18n.cjs would silently skip the gate).
function listCjsFilesRecursive(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listCjsFilesRecursive(full));
    else if (entry.name.endsWith(".cjs")) out.push(full);
  }
  return out;
}

async function main() {
  // Syntax-validation gate — output is discarded, see header comment. Covers main.cjs AND every
  // src/content/**/*.cjs data module + src/rules/**/*.cjs pure-rule module (each must independently
  // parse; a broken content/rules file fails the build).
  const contentFiles = listCjsFilesRecursive(CONTENT_DIR);
  const rulesFiles = listCjsFilesRecursive(RULES_DIR);
  const uiFiles = listCjsFilesRecursive(UI_DIR);
  await Promise.all(
    [path.join(SRC, "main.cjs"), ...contentFiles, ...rulesFiles, ...uiFiles].map((entry) =>
      build({ entryPoints: [entry], bundle: false, write: false, logLevel: "silent" })
    )
  );

  // Trim exactly one trailing newline — src/*.{cjs,css} end with a newline (standard for text files) and
  // the template already puts a newline after each marker, so without this trim every build would grow
  // an extra blank line before </style>/</script> on top of the original prototype/index.html.
  const js = resolveRequires(path.join(SRC, "main.cjs")).replace(/\n$/, "");
  const css = readFileSync(path.join(SRC, "styles.css"), "utf8").replace(/\n$/, "");
  const rawTemplate = readFileSync(path.join(SRC, "index.template.html"), "utf8");

  // Step 1b i18n key-out (shell strings — CLAUDE.md/HANDOVER) — `{{ui.key}}` markers in the template
  // are resolved at BUILD time against the default locale (ko.cjs), same as main.cjs's t() calls being
  // eager/dormant-ko today (see src/content/locale/i18n.cjs). This substitution runs before the
  // CSS/JS injection below so it only ever touches the static shell markup, never the (much larger,
  // coincidentally-bracey) injected JS/CSS text.
  const { KO } = require(path.join(SRC, "content", "locale", "ko.cjs"));
  const template = rawTemplate.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (whole, key) => {
    if (!Object.prototype.hasOwnProperty.call(KO, key)) {
      throw new Error(`build.mjs: i18n marker '{{${key}}}' has no matching key in src/content/locale/ko.cjs`);
    }
    return KO[key];
  });
  if (template.includes("{{")) {
    throw new Error("build.mjs: an unresolved i18n marker remains — check src/index.template.html");
  }

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
