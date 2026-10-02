// Run from repo root: node docs/artifacts/2026-10-02-continuation-review/cdp-evidence-audit/reproduce.mjs
// Offline only: the extracted function receives mocks for every OS/process operation.
import { readFileSync } from 'node:fs';
import { createJudge } from '../../../../scripts/lib/run-result.mjs';
const source = readFileSync('scripts/lib/desktop-harness.mjs', 'utf8');
const start = source.indexOf('export async function closeOwnPid(');
const end = source.indexOf('\n/**', start);
if (start < 0 || end < 0) throw new Error('Source extraction boundary changed');
const functionSource = source.slice(start, end).replace('export async function', 'async function');
for (const matchesExpected of [false, null]) {
  let alive = true;
  const commands = [];
  const identity = { pid: 987654, expectedImage: 'wechat-mp-desktop.exe', actualImage: matchesExpected === false ? 'other.exe' : null, alive: true, matchesExpected };
  const close = Function('procIdentity', 'execFileSync', 'alivePid', 'sleep', functionSource + '\nreturn closeOwnPid;')(
    () => identity,
    (exe, args) => { commands.push({ exe, args }); alive = false; return ''; },
    () => alive,
    async () => {},
  );
  const result = await close(987654, { exe: 'wechat-mp-desktop.exe' });
  console.log(JSON.stringify({ name: 'identity-cleanup-gate', matchesExpected, commands, result, allOperationsMocked: true }, null, 2));
}
const judge = createJudge({ script: 'pure-no-finish-probe', outDir: 'isolated-evidence-directory' });
console.log(JSON.stringify({ name: 'matrix-output-location', runHasOutDir: Object.hasOwn(judge.run, 'outDir'), observedFallback: judge.run.outDir || '', expected: 'isolated-evidence-directory', noFinishCalled: true }, null, 2));
