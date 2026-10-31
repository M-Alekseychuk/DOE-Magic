#!/usr/bin/env node
// Self-test for scripts/check-boundaries.mjs. Run: node scripts/check-boundaries.test.mjs
// Copies the checked surface into a temp dir, applies one change per case and expects
// either a pass (OK) or that rule to fire. Run it after changing the checker.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = path.join(os.tmpdir(), `doe-magic-boundary-test-${process.pid}`); // short path: git and npm break on long Windows paths
const COPY = ['src', 'server.ts', 'index.html', 'package.json', 'scripts', '.gitignore'];

const append = (f, s) => (d) => fs.appendFileSync(path.join(d, f), s);
const write = (f, s) => (d) => { fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); fs.writeFileSync(path.join(d, f), s); };
const replace = (f, a, b) => (d) => { const p = path.join(d, f); const t = fs.readFileSync(p, 'utf8'); if (!t.includes(a)) throw new Error(`${f}: "${a}" not found`); fs.writeFileSync(p, t.replace(a, b)); };
const both = (...fns) => (d) => fns.forEach((fn) => fn(d));
function gitInit(d) {
  const git = (...a) => spawnSync('git', a, { cwd: d, encoding: 'utf8' });
  git('init', '-q');
  git('add', '-A');
  git('add', '-f', '.aistudio'); // only present in the AI Studio case
}

const CASES = [
  // Violations that must fire.
  ['R1', 'stray src/utils folder', write('src/utils/helper.ts', 'export const x = 1;\n')],
  ['R2', '@/ alias import', append('src/web/App.tsx', "\nimport x from '@/src/core/types';\n")],
  ['R2', 'unresolvable relative import', append('src/web/App.tsx', "\nimport y from './does-not-exist';\n")],
  ['R3', 'core imports react', append('src/core/types.ts', "\nimport React from 'react';\n")],
  ['R3', 'core imports web', append('src/core/types.ts', "\nimport L from '../web/Layout';\n")],
  ['R3', 'core uses window', append('src/core/analysis/analysisCore.ts', '\nexport const w = window.innerWidth;\n')],
  ['R3', 'core uses localStorage?.', append('src/core/types.ts', "\nexport const k = () => localStorage?.getItem('k');\n")],
  ['R3', '.tsx file in core', write('src/core/Thing.tsx', 'export const T = 1;\n')],
  ['R3', '.js file in core importing react', write('src/core/helpers.js', "import React from 'react';\nexport const h = 1;\n")],
  ['R4', 'server imports web', append('src/server/mcp/doeMcpServer.ts', "\nimport { translations } from '../../web/i18n/translations';\n")],
  ['R5', 'web imports server', append('src/web/Layout.tsx', "\nimport { mcpActivityLogs } from '../server/mcp/doeMcpServer';\n")],
  ['R5', 'main.tsx imports server', append('src/main.tsx', "\nimport { mcpActivityLogs } from './server/mcp/doeMcpServer';\n")],
  ['R5', 'template-literal dynamic import of server', append('src/web/Layout.tsx', '\nexport const lazyMcp = () => import(`../server/mcp/doeMcpServer`);\n')],
  ['R5', 'dynamic import with vite-ignore comment', append('src/web/Layout.tsx', "\nexport const lazyMcp2 = () => import(/* @vite-ignore */ '../server/mcp/doeMcpServer');\n")],
  ['R6', 'feature imports another feature', append('src/web/features/compare/CompareResponses.tsx', "\nimport P from '../analysis/PredictionProfiler';\n")],
  ['R6', 'loose file in src/web/features', write('src/web/features/format.ts', 'export const f = 1;\n')],
  ['R7', 'server.ts pulls in web code', append('server.ts', "\nimport './src/web/i18n/translations';\n")],
  ['R8', 'mcp script points at a missing file', (d) => { const f = path.join(d, 'package.json'); const p = JSON.parse(fs.readFileSync(f, 'utf8')); p.scripts.mcp = 'tsx src/mcp/stdio.ts'; fs.writeFileSync(f, JSON.stringify(p)); }],
  ['R8', 'index.html entry moved', replace('index.html', '/src/main.tsx', '/src/web/main.tsx')],
  ['R9', 'scratch script committed at repo root', both(write('fix_thing.mjs', '// patch\n'), gitInit)],
  ['R9', 'AI Studio re-adds .aistudio/', both(write('.aistudio/plan.md', '# plan\n'), gitInit)],
  // Former false positives that must now pass.
  ['OK', 'unmodified copy', () => {}],
  ['OK', 'git repo with only agreed root entries', gitInit],
  ['OK', 'tests/ and vitest.config.ts tracked at the repo root', both(write('tests/core/x.test.ts', 'export {};\n'), write('vitest.config.ts', 'export default {};\n'), gitInit)],
  ['OK', 'commented-out web import in core', append('src/core/types.ts', "\n// import { useTranslation } from '../web/i18n/LanguageContext';\n")],
  ['OK', 'import-like text in a string in core', append('src/core/sampleProject.ts', "\nexport const note = \"Tip: import data from 'Excel' via the toolbar\";\n")],
  ['OK', 'the word document. in a core comment', append('src/core/types.ts', '\n// Shared types for the project document. Keep in sync with the UI.\n')],
  ['OK', '.js suffix naming a .ts file', replace('src/server/mcp/stdio.ts', "'./doeMcpServer'", "'./doeMcpServer.js'")],
  ['OK', 'Vite ?url asset import', append('src/web/Layout.tsx', "\nimport './assets/logo.png?url';\n")],
  ['OK', 'OS clutter src/.DS_Store', write('src/.DS_Store', '')],
];

let failures = 0;
for (const [rule, name, mutate] of CASES) {
  fs.rmSync(tmp, { recursive: true, force: true });
  for (const c of COPY) fs.cpSync(path.join(repo, c), path.join(tmp, c), { recursive: true });
  fs.symlinkSync(path.join(repo, 'node_modules'), path.join(tmp, 'node_modules'), 'junction');
  mutate(tmp);
  const r = spawnSync(process.execPath, [path.join(tmp, 'scripts', 'check-boundaries.mjs')], { encoding: 'utf8' });
  const out = r.stdout + r.stderr;
  const ok = rule === 'OK' ? r.status === 0 : r.status === 1 && out.includes(`  ${rule} `);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${rule.padEnd(3)} ${name}${ok ? '' : `\n${out}`}`);
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures ? `${failures} FAILED` : 'all passed');
process.exit(failures ? 1 : 0);
