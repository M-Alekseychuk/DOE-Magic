#!/usr/bin/env node
// Layer boundary check for DOE-Magic. Run with `npm run check` (after tsc).
// Rules R1-R9 are described in docs/spec/DOE-Magic/design-spec.md.
// Uses the TypeScript compiler API (already a devDependency) to read imports, so
// commented-out code and strings that merely look like imports are ignored.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = path.posix;
const CORE_PACKAGES = new Set(['jstat', 'uuid']);
const SRC_TOP_LEVEL = new Set(['main.tsx', 'vite-env.d.ts', 'core', 'server', 'web']);
const REPO_TOP_LEVEL = new Set([
  '.env.example', '.github', '.gitignore', 'AGENTS.md', 'CLAUDE.md', 'LICENSE', 'README.md', 'assets', 'bun.lock', 'docs',
  'index.html', 'metadata.json', 'package-lock.json', 'package.json', 'public', 'scripts', 'server.ts', 'src', 'tests', 'tsconfig.json', 'vite.config.ts',
  'vitest.config.ts',
]);
const AI_STUDIO_LEFTOVERS = new Set(['.aistudio', 'data.json']);
const DOM_GLOBALS = new Set(['window', 'document', 'localStorage', 'sessionStorage', 'navigator']);
const RESOLVE_SUFFIXES = ['', '.ts', '.tsx', '.js', '.jsx', '.css', '/index.ts', '/index.tsx'];

const errors = [];
const fail = (rule, file, msg) => errors.push(`${rule} ${file}: ${msg}`);
const exists = (rel) => fs.existsSync(path.join(ROOT, rel)) && fs.statSync(path.join(ROOT, rel)).isFile();
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function walk(dir) {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(P.join(dir, e.name)) : [P.join(dir, e.name)]);
}

// Static imports, re-exports, side-effect imports, import() and require().
const specifiers = (source) => ts.preProcessFile(source, true, true).importedFiles.map((f) => f.fileName);

// First line (1-based) where code reads a browser global such as `window.x` or
// `localStorage?.getItem`, or 0. Works on the syntax tree, so comments and strings never match.
function domGlobalLine(file, source) {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  let line = 0;
  const visit = (node) => {
    if (line) return;
    if ((ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
      ts.isIdentifier(node.expression) && DOM_GLOBALS.has(node.expression.text)) {
      line = sf.getLineAndCharacterOfPosition(node.expression.getStart(sf)).line + 1;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return line;
}

function resolve(fromFile, spec) {
  const base = P.normalize(P.join(P.dirname(fromFile), spec.replace(/[?#].*$/, '')));
  const candidates = [base, base.replace(/\.(m?)js(x?)$/, '.$1ts$2')]; // './x.js' may name x.ts
  for (const c of candidates) for (const suffix of RESOLVE_SUFFIXES) if (exists(c + suffix)) return c + suffix;
  return null;
}

const layerOf = (file) => (file === 'src/main.tsx' ? 'web' : file === 'server.ts' ? 'server' : file.split('/')[1]);
const featureOf = (file) => {
  const parts = file.split('/');
  return parts[2] === 'features' && parts.length > 4 ? parts[3] : null;
};
const isCode = (file) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file);

// R1: only the agreed entries at the top of src/ (dotfiles such as .DS_Store are ignored).
for (const entry of fs.readdirSync(path.join(ROOT, 'src'))) {
  if (!entry.startsWith('.') && !SRC_TOP_LEVEL.has(entry)) fail('R1', `src/${entry}`, 'unexpected top-level entry; src/ holds main.tsx, vite-env.d.ts, core/, server/, web/');
}

// R9: only the agreed files and folders are tracked at the repo root (no scratch scripts).
let tracked = null;
try {
  tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\0').filter(Boolean);
} catch {
  console.warn('R9 skipped: not a git checkout (or git is not installed).');
}
for (const entry of new Set((tracked ?? []).map((f) => f.split('/')[0]))) {
  if (AI_STUDIO_LEFTOVERS.has(entry)) fail('R9', entry, 're-added by an AI Studio sync; remove it from git with `git rm -r --cached` (it is in .gitignore)');
  else if (!REPO_TOP_LEVEL.has(entry)) fail('R9', entry, 'not an agreed repo-root entry; put code in src/, tests in tests/, tools in scripts/, docs in docs/ (or update the list in this script and AGENTS.md)');
}

const files = [...walk('src').filter(isCode), 'server.ts'];
const graph = new Map(); // file -> resolved relative imports

for (const file of files) {
  const source = read(file);
  const layer = layerOf(file);
  const edges = [];
  graph.set(file, edges);

  if (file.startsWith('src/web/features/') && file.split('/').length === 4) {
    fail('R6', file, 'loose file in src/web/features/; put it in a feature folder, src/web/shared/ or src/core/');
  }
  if (layer === 'core') {
    if (/\.(tsx|jsx)$/.test(file)) fail('R3', file, 'src/core holds plain TypeScript only (no React/JSX)');
    const line = domGlobalLine(file, source);
    if (line) fail('R3', `${file}:${line}`, 'browser global used in src/core');
  }

  for (const spec of specifiers(source)) {
    // R2: relative imports only, and they must resolve.
    if (spec.startsWith('@/') || spec.startsWith('src/')) {
      fail('R2', file, `"${spec}": use a relative path ("@/" maps to the repo root, not src/, and the check cannot place aliased imports in a layer)`);
      continue;
    }
    if (!spec.startsWith('.')) {
      const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
      if (layer === 'core' && !CORE_PACKAGES.has(pkg)) fail('R3', file, `package "${spec}" not allowed in src/core (allowed: ${[...CORE_PACKAGES].join(', ')})`);
      if (layer === 'server' && /^react/.test(pkg)) fail('R4', file, `"${spec}" is browser-only`);
      continue;
    }
    const target = resolve(file, spec);
    if (!target) { fail('R2', file, `"${spec}" does not resolve to a file`); continue; }
    edges.push(target);

    const to = layerOf(target);
    if (layer === 'core' && to !== 'core') fail('R3', file, `imports ${target}; src/core may only import src/core`);
    if (layer === 'server' && to !== 'core' && to !== 'server') fail('R4', file, `imports ${target}; server code may only import src/core and src/server`);
    if (layer === 'web' && to === 'server') fail('R5', file, `imports ${target}; the browser reaches the server over HTTP only`);
    const [fromFeature, toFeature] = [featureOf(file), featureOf(target)];
    if (fromFeature && toFeature && fromFeature !== toFeature) {
      fail('R6', file, `imports ${target}; move shared code to src/web/shared/ or src/core/`);
    }
  }
}

// R8: the entry points AI Studio, Vite and npm scripts rely on must exist.
const pkg = JSON.parse(read('package.json'));
const htmlEntry = read('index.html').match(/<script[^>]*type="module"[^>]*src="\/?([^"]+)"/)?.[1];
const mcpEntry = (pkg.scripts?.mcp ?? '').split(/\s+/).find((t) => /\.ts$/.test(t));
for (const [what, rel] of [['index.html module script', htmlEntry], ['npm run mcp entry', mcpEntry], ['server entry', 'server.ts']]) {
  if (!rel || !exists(rel)) fail('R8', rel ?? what, `${what} is missing`);
}

// R7: everything Node loads must live in src/core or src/server.
const queue = ['server.ts', mcpEntry].filter((f) => f && graph.has(f));
const seen = new Set(queue);
while (queue.length) {
  const file = queue.shift();
  for (const dep of graph.get(file) ?? []) {
    if (seen.has(dep)) continue;
    seen.add(dep);
    if (!['core', 'server'].includes(layerOf(dep))) fail('R7', dep, `reached from the Node entry points via ${file}`);
    if (graph.has(dep)) queue.push(dep);
  }
}

if (errors.length) {
  console.error(`Layer boundary check failed (${errors.length}):\n  ${errors.join('\n  ')}`);
  console.error('Rules: docs/spec/DOE-Magic/design-spec.md');
  process.exit(1);
}
console.log(`Layer boundaries OK: ${files.length} files, ${seen.size} reachable from the Node entry points.`);
