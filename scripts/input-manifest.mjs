// input-manifest.mjs —— 发布/验收输入清单与 SHA-256（DS 修复指南 §7 末段）
//
// 用法：
//   node scripts/input-manifest.mjs <outFile> [--root <dir>]
//
// 记录"这次验收/发布对应的**全部输入**"的逐文件 SHA-256，以及清单自身的 SHA-256、
// 工具版本与非敏感构建参数。要点（指南原文）：
//   · 必须包含**未跟踪**的输入（新写的 runner、fixture、配置也一样算输入）；
//   · 排除**产物**：`dist/`、`src-tauri/target/`、`node_modules/`、`.git/`；
//   · 不记录任何密钥或凭据内容。
//
// 为什么需要它：审计时"现存 exe 的修改时间 + 155 个前端文件相同"只能说明**前端**没变，
// 不能证明 Rust/配置/资源那些输入与 exe 的对应关系。清单是发布 provenance 的原始材料。
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')

const args = process.argv.slice(2)
const outIdx = args.indexOf('--root')
const root = outIdx >= 0 && args[outIdx + 1] ? resolve(args[outIdx + 1]) : repoRoot
const skipIdx = outIdx >= 0 ? outIdx + 1 : -1 // 只有真的出现 --root 时才跳过它的值
const outFile = args.find((a, i) => !a.startsWith('--') && i !== skipIdx)
if (!outFile) {
  console.error('用法：node scripts/input-manifest.mjs <outFile> [--root <dir>]')
  process.exit(2)
}

/** 产物 / 依赖 / VCS：不属于"输入" */
const EXCLUDE_DIRS = new Set(['node_modules', 'dist', '.git', 'target', '.vite', '.pnpm-store', 'coverage'])
/** 明确的**产物**文件（即便在根目录下也不计入输入清单） */
const EXCLUDE_FILES = [/\.exe$/i, /\.msi$/i, /\.nsis\.zip$/i]
/** 已知的敏感文件：只记"存在"，**绝不**记录内容或哈希以外的东西（哈希本身不泄露密钥） */
const SENSITIVE = [/credential/i, /\.env$/i, /secret/i]

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name)
    let st
    try {
      st = statSync(abs)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      if (EXCLUDE_DIRS.has(name)) continue
      walk(abs, out)
      continue
    }
    if (EXCLUDE_FILES.some((re) => re.test(name))) continue
    out.push(abs)
  }
  return out
}

const files = walk(root).sort()
const entries = []
let sensitiveSkipped = 0
for (const abs of files) {
  const rel = relative(root, abs).split(sep).join('/')
  if (SENSITIVE.some((re) => re.test(rel))) {
    sensitiveSkipped++
    continue
  }
  const buf = readFileSync(abs)
  entries.push({ path: rel, bytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex') })
}

/** 工具版本与非敏感构建参数：解释"这份清单是用什么产出的" */
function execSyncQuiet(cmd) {
  // 用 child_process 同步执行，失败就返回 unknown（不抛出、不把 stderr 泄漏进报告）
  try {
    return String(execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] })).trim()
  } catch {
    return 'unknown'
  }
}
const tooling = {}
for (const [key, cmd] of [
  ['node', 'node --version'],
  ['pnpm', 'pnpm --version'],
  ['cargo', 'cargo --version'],
  ['rustc', 'rustc --version'],
]) {
  tooling[key] = execSyncQuiet(cmd)
}

// git HEAD（本地提交号）：只作溯源提示，非 git 目录如实写 unknown
const manifest = {
  generatedAt: new Date().toISOString(),
  root,
  gitHead: execSyncQuiet('git rev-parse HEAD'),
  tooling,
  excludedDirs: [...EXCLUDE_DIRS],
  excludedArtifactPatterns: EXCLUDE_FILES.map((r) => String(r)),
  sensitiveFilesSkipped: sensitiveSkipped,
  fileCount: entries.length,
  totalBytes: entries.reduce((a, e) => a + e.bytes, 0),
  files: entries,
}
const text = JSON.stringify(manifest, null, 2) + '\n'
mkdirSync(dirname(resolve(outFile)), { recursive: true })
writeFileSync(outFile, text, 'utf8')
// 清单自身的哈希：单独写一行到 stdout，便于在报告里引用而不必再读整份清单
const selfHash = createHash('sha256').update(text).digest('hex')
console.log(`[input-manifest] ${entries.length} 个输入文件，共 ${manifest.totalBytes} 字节`)
console.log(`[input-manifest] manifest sha256 = ${selfHash}`)
console.log(`[input-manifest] 输出：${outFile}`)
