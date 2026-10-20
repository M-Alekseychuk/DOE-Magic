#!/usr/bin/env node
// Layer boundary check for DOE-Magic. Run with `npm run check` (after tsc).
// Rules R1-R9 are described in docs/spec/DOE-Magic/design-spec.md. No dependencies.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = path.posix;
const CORE_PACKAGES = new Set(['jstat', 'uuid']);
const SRC_TOP_LEVEL = new Set(['main.tsx', 'vite-env.d.ts', 'core', 'server', 'web']);
const REPO_TOP_LEVEL = new Set([
  '.env.example', '.gitignore', 'AGENTS.md', 'CLAUDE.md', 'README.md', 'assets', 'bun.lock', 'docs', 'index.html',
  'metadata.json', 'package-lock.json', 'package.json', 'public', 'scripts', 'server.ts', 'src', 'tsconfig.json', 'vite.config.ts',
]);
const DOM_GLOBALS = /\b(window|document|localStorage|sessionStorage|navigator)\s*[.[]/;
const RESOLVE_SUFFIXES = ['', '.ts', '.tsx', '.js', '.css', '/index.ts', '/index.tsx'];

const errors = [];
const fail = (rule, file, msg) => errors.push(`${rule} ${file}: ${msg}`);
const exists = (rel) => fs.existsSync(path.join(ROOT, rel)) && fs.statSync(path.join(ROOT, rel)).isFile();
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function walk(dir) {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(P.join(dir, e.name)) : [P.join(dir, e.name)]);
}

function specifiers(source) {
  const found = [];
  const patterns = [
    /\b(?:import|export)\s[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g, // import x from '...', export { x } from '...'
    /\bimport\s*['"]([^'"]+)['"]/g, // import '...'
    /\b(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g, // import('...'), require('...')
  ];
  for (const re of patterns) for (const m of source.matchAll(re)) found.push(m[1]);
  return found;
}

function resolve(fromFile, spec) {
  const base = P.normalize(P.join(P.dirname(fromFile), spec));
  for (const suffix of RESOLVE_SUFFIXES) if (exists(base + suffix)) return base + suffix;
  return null;
}

const layerOf = (file) => file.split('/')[1]; // 'core' | 'server' | 'web' | top-level file
const featureOf = (file) => (file.startsWith('src/web/features/') ? file.split('/')[3] : null);
const isCode = (file) => /\.(ts|tsx)$/.test(file);

// R9: only the agreed files and folders are tracked at the repo root (no scratch scripts).
let tracked = null;
try {
  tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\0').filter(Boolean);
} catch {
  console.warn('R9 skipped: git is not available here.');
}
for (const entry of new Set((tracked ?? []).map((f) => f.split('/')[0]))) {
  if (!REPO_TOP_LEVEL.has(entry)) fail('R9', entry, 'not an agreed repo-root entry; put code in src/, tools in scripts/, docs in docs/ (or update the list in this script and AGENTS.md)');
}

// R1: only the agreed entries at the top of src/.
for (const entry of fs.readdirSync(path.join(ROOT, 'src'))) {
  if (!SRC_TOP_LEVEL.has(entry)) fail('R1', `src/${entry}`, 'unexpected top-level entry; src/ holds main.tsx, vite-env.d.ts, core/, server/, web/');
}

const files = [...walk('src').filter(isCode), 'server.ts'];
const graph = new Map(); // file -> resolved relative imports

for (const file of files) {
  const source = read(file);
  const layer = layerOf(file);
  const edges = [];
  graph.set(file, edges);

  if (layer === 'core') {
    if (file.endsWith('.tsx')) fail('R3', file, 'src/core holds plain .ts only (no React)');
    const line = source.split('\n').findIndex((l) => DOM_GLOBALS.test(l));
    if (line !== -1) fail('R3', `${file}:${line + 1}`, 'browser global used in src/core');
  }

  for (const spec of specifiers(source)) {
    // R2: relative imports only, and they must resolve.
    if (spec.startsWith('@/') || spec.startsWith('src/')) {
      fail('R2', file, `"${spec}": use a relative path (aliases are not wired into esbuild/tsx)`);
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
    if (layer === 'server' && to !== 'core' && to !== 'server') fail('R4', file, `imports ${target}; src/server may only import src/core and src/server`);
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
