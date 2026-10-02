// Offline regression probe: a result destination that is a file must not produce PASS.
// Usage: node <this-file> <new-output-directory>
// No application launch, network, model calls, or product source modifications.
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const destination = process.argv[2]
if (!destination) throw new Error('Pass a new output directory; existing evidence will not be overwritten')
const out = resolve(destination)
if (existsSync(out)) throw new Error('Output directory already exists: ' + out)
mkdirSync(out, { recursive: true })
const badOut = join(out, 'not-a-directory')
writeFileSync(badOut, 'sentinel: this is a file, not a directory\n', { flag: 'wx' })
const source = join(repo, 'scripts', 'lib', 'run-result.mjs')
const program = `
import { createJudge } from ${JSON.stringify(pathToFileURL(source).href)};
const judge = createJudge({script:'persist-failure-proof',outDir:process.env.WXMP_AUDIT_BAD_OUT,plannedCases:['case']});
judge.check('case',true);
judge.finish();
`
const child = spawnSync(process.execPath, ['--input-type=module', '-e', program], {
  cwd: repo,
  env: { ...process.env, WXMP_AUDIT_BAD_OUT: badOut },
  encoding: 'utf8',
  timeout: 10000,
  windowsHide: true,
})
writeFileSync(join(out, 'stdout.log'), child.stdout || '')
writeFileSync(join(out, 'stderr.log'), child.stderr || '')
const printedPass = /PERSIST-FAILURE-PROOF PASS\b/.test(child.stdout || '')
const printedError = /PERSIST-FAILURE-PROOF ERROR\b/.test(child.stdout || '')
const hasResult = existsSync(join(badOut, 'run-result.json'))
const fixed = child.status !== null && child.status !== 0 && printedError && !printedPass
const result = {
  source,
  sourceSha256: createHash('sha256').update(readFileSync(source)).digest('hex'),
  childExit: child.status,
  childError: child.error ? String(child.error.message) : null,
  printedPass,
  printedError,
  hasResult,
  assertion: 'When evidence persistence fails, the runner reports ERROR, exits nonzero, and never prints PASS',
  assertionPassed: fixed,
  status: fixed ? 'PASS' : 'FAIL',
}
writeFileSync(join(out, 'probe-result.json'), JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify(result, null, 2))
process.exitCode = fixed ? 0 : 1
