// 发布输入清单反例：新增/修改证据不能改变输入集合，代码/知识/资源/配置必须保留。
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createJudge, guardCrashes, resolveOutDir } from './lib/run-result.mjs'

const outDir = resolveOutDir('input-manifest-check')
const judge = createJudge({ script: 'input-manifest-check', outDir, minChecks: 5 })
guardCrashes(judge)
const root = join(outDir, 'fixture')
const inputs = ['src/App.tsx', 'src/knowledge/guide.md', 'scripts/fixtures/case.md', 'public/logo.svg', 'src-tauri/src/main.rs', 'src-tauri/resources/manual.html', 'src-tauri/icons/app.ico', 'src-tauri/capabilities/default.json', 'src-tauri/tauri.conf.json', 'src-tauri/Cargo.toml', 'src-tauri/Cargo.lock', 'package.json', 'pnpm-workspace.yaml', 'pnpm-lock.yaml', 'vite.config.ts']
const generated = ['.local/runs/old/evidence.json', 'docs/artifacts/screenshot.png', 'src-tauri/target/release/app.exe', 'src-tauri/gen/schemas/desktop.json', 'dist/index.html', 'dist-ssr/index.js', 'node_modules/pkg/index.js', '.git/objects/mock', 'debug.log', 'tsconfig.tsbuildinfo', 'PROGRESS.md']
function write(rel, content = 'fixture') { const path = join(root, rel); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, content) }
for (const rel of [...inputs, ...generated]) write(rel)
const output = join(root, 'manifest.json') // 清单自身也必须排除；重跑不能把上次输出当成输入。
function run() {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./input-manifest.mjs', import.meta.url)), output, '--root', root], { encoding: 'utf8', windowsHide: true })
  if (result.status !== 0) throw new Error(`manifest exit=${result.status}: ${result.stderr}`)
  return JSON.parse(readFileSync(output, 'utf8'))
}
const first = run()
const paths = first.files.map((file) => file.path)
judge.check('源码、知识、资源、图标和配置均纳入', inputs.every((path) => paths.includes(path)))
judge.check('历史证据、文档和构建生成物均排除', generated.every((path) => !paths.includes(path)))
write('.local/runs/new/evidence.json', 'new evidence')
write('docs/artifacts/screenshot.png', 'changed artifact')
write('PROGRESS.md', 'new progress')
const second = run()
judge.check('证据与进度变动不改变输入条目或哈希', JSON.stringify(first.files) === JSON.stringify(second.files))
judge.check('清单自身不会进入下次清单', !second.files.some((file) => file.path === 'manifest.json'))
write('src/knowledge/guide.md', 'changed runtime knowledge')
const third = run()
judge.check('运行时知识变动确实改变输入哈希', first.files.find((file) => file.path === 'src/knowledge/guide.md').sha256 !== third.files.find((file) => file.path === 'src/knowledge/guide.md').sha256)
judge.finish({ label: 'INPUT-MANIFEST' })
