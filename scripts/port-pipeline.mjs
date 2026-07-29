/**
 * port-pipeline.mjs — ghep module Pipeline Tracker vao app.
 *
 * CUNG TRIET LY VOI port-engine.mjs: khong viet lai module bang React.
 * Module goc (do team khac ban giao) la vanilla HTML/CSS/JS da chay production
 * va da qua audit isolation. Script nay chi COPY/DONG GOI co hoc:
 *
 *   scripts/_source/pipeline/pipeline.body.html -> src/components/pipelineBody.js
 *   scripts/_source/pipeline/pipeline.css       -> src/app/pipeline/pipeline.css
 *   scripts/_source/pipeline/pipeline.js        -> public/pipeline/pipeline.js
 *   scripts/_source/pipeline/data/pipeline.json -> public/pipeline/data/pipeline.json
 *
 * SUA O DAU: sua trong scripts/_source/pipeline/ roi chay `npm run port:pipeline`.
 * 4 file sinh ra o tren la file SINH TU DONG — dung sua tay.
 *
 * Script cung tu kiem chung 2 rang buoc isolation truoc khi ghi (fail fast):
 *   1. Moi selector trong CSS phai nam duoi #pipeline-root
 *   2. JS chi duoc gan dung 1 global: window.PipelineTracker
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'scripts', '_source', 'pipeline');

const read = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');
const GEN = '/* SINH TU DONG tu scripts/_source/pipeline/ boi scripts/port-pipeline.mjs. DUNG SUA TAY. */';

/* ------------------------------------------------------------------
   1. Kiem chung isolation — chay TRUOC khi ghi bat cu file nao
   ------------------------------------------------------------------ */
const css = read('pipeline.css');
const js = read('pipeline.js');

// (a) CSS: moi selector phai nam duoi #pipeline-root.
//     Phai XOA COMMENT TRUOC khi quet — comment nhieu dong co the chua vi du
//     nhu `body { ... }` va se bi bao dong (da tung xay ra). Thay comment bang
//     dong trong de so dong bao loi van dung.
const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
const badSelectors = cssNoComments
  .split('\n')
  .map((line, i) => ({ line: line.trim(), n: i + 1 }))
  .filter(({ line }) => line.endsWith('{') || /\{\s*[a-z-]+\s*:/.test(line))
  .filter(({ line }) => !line.startsWith('@'))
  .filter(({ line }) => !line.includes('#pipeline-root'));

if (badSelectors.length) {
  console.error('[port-pipeline] CSS ISOLATION FAIL — selector khong nam duoi #pipeline-root:');
  badSelectors.forEach(({ n, line }) => console.error(`  pipeline.css:${n}  ${line}`));
  process.exit(1);
}

// (b) JS: chi duoc gan dung 1 global. `typeof window.x === ...` la doc, khong phai gan.
const globalAssigns = [...js.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=(?!=)/g)].map((m) => m[1]);
const unexpected = [...new Set(globalAssigns)].filter((g) => g !== 'PipelineTracker');
if (unexpected.length) {
  console.error(`[port-pipeline] GLOBAL LEAK FAIL — module gan them global: ${unexpected.join(', ')}`);
  process.exit(1);
}
if (!globalAssigns.includes('PipelineTracker')) {
  console.error('[port-pipeline] FAIL — khong tim thay `window.PipelineTracker =` trong pipeline.js');
  process.exit(1);
}

// (c) Khong duoc tu nap script (module phai de host quyet dinh nap vendor nao)
if (/document\.head\s*\.\s*appendChild/.test(js)) {
  console.error('[port-pipeline] FAIL — pipeline.js tu chen <script> vao document.head');
  process.exit(1);
}

/* ------------------------------------------------------------------
   2. Sinh file
   ------------------------------------------------------------------ */
const mkdir = (p) => fs.mkdirSync(p, { recursive: true });

// body.html -> chuoi JS. Dung JSON.stringify (giong shellBody.js) de khong phai
// tu escape backtick / ${...} / backslash.
let body = read('pipeline.body.html').replace(/^<!--[\s\S]*?-->\s*/, '').trim();
const bodyOut = path.join(ROOT, 'src', 'components', 'pipelineBody.js');
mkdir(path.dirname(bodyOut));
fs.writeFileSync(bodyOut, `${GEN}\nexport const PIPELINE_BODY = ${JSON.stringify(body)};\n`, 'utf8');

// CSS -> import o route level (KHONG import trong layout.jsx, tranh dung engine.css)
const cssOut = path.join(ROOT, 'src', 'app', 'pipeline', 'pipeline.css');
mkdir(path.dirname(cssOut));
fs.writeFileSync(cssOut, `${GEN}\n${css}`, 'utf8');

// JS -> /public: khong phai ES module, expose global -> nap bang <script src>
const jsOut = path.join(ROOT, 'public', 'pipeline', 'pipeline.js');
mkdir(path.dirname(jsOut));
fs.writeFileSync(jsOut, `${GEN}\n${js}`, 'utf8');

// data -> /public: fetch luc runtime, doi data khong can rebuild
const dataOut = path.join(ROOT, 'public', 'pipeline', 'data', 'pipeline.json');
mkdir(path.dirname(dataOut));
const raw = read(path.join('data', 'pipeline.json'));
JSON.parse(raw); // fail fast neu JSON hong
fs.writeFileSync(dataOut, raw, 'utf8');

const kb = (s) => `${(Buffer.byteLength(s, 'utf8') / 1024).toFixed(1)} KB`;
console.log('[port-pipeline] OK — isolation checks passed');
console.log(`  src/components/pipelineBody.js      ${kb(body)}`);
console.log(`  src/app/pipeline/pipeline.css       ${kb(css)}`);
console.log(`  public/pipeline/pipeline.js         ${kb(js)}`);
console.log(`  public/pipeline/data/pipeline.json  ${kb(raw)}  (${JSON.parse(raw).deals.length} deals)`);
