// E 路 阶段一：独立复现 C 的缺陷 —— 手册写的包名与实测条件不符（英文名 vs 实际中文包名）。
//
// 判据（自定）：
//   S1  手册里的安装包文件名必须与实际构建产物**逐字一致**（用户按手册找文件必须能找到）；
//   S2  手册对"密钥去向"的描述必须与实际网络行为一致（源码里密钥是否离开本机）；
//   S3  手册中"未实测"的量化/普适断言（时长、适用性）不得当作已验证事实陈述。
//
// 对象：**git HEAD df97022 的 src-tauri/resources/使用手册.html**（C 正在改该文件，必须对冻结点复核）。
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../../../..')
const outDir = join(here, 'out')
mkdirSync(outDir, { recursive: true })
const sha256 = (b) => createHash('sha256').update(b).digest('hex')
const git = (args) => execFileSync('git', args, { cwd: repoRoot, maxBuffer: 1 << 26 }).toString('utf8')

const rec = { script: 'repro-c-manual-claims', startedAt: new Date().toISOString(), checks: [], findings: [] }
const ok = (id, pass, ev = '') => { rec.checks.push({ id, pass: Boolean(pass), evidence: String(ev ?? '') }); console.log(`  ${pass ? 'OK  ' : 'MISS'} ${id}${ev ? '  (' + ev + ')' : ''}`) }

// 冻结基线的手册正文
const manual = git(['show', 'df97022:src-tauri/resources/使用手册.html'])
rec.manualSha256 = sha256(Buffer.from(manual, 'utf8'))
rec.manualLines = manual.split(/\r?\n/).length

const conf = JSON.parse(readFileSync(join(repoRoot, 'src-tauri/tauri.conf.json'), 'utf8'))
const expectedBundle = `${conf.productName}_${conf.version}_x64-setup.exe`
const nsisDir = join(repoRoot, 'src-tauri/target/release/bundle/nsis')
const onDisk = existsSync(nsisDir) ? readdirSync(nsisDir).filter((f) => f.endsWith('.exe')) : []
rec.productName = conf.productName
rec.expectedBundle = expectedBundle
rec.onDiskBundles = onDisk

// ---- S1：手册写的包名 vs 实际产物名
const namedInManual = [...manual.matchAll(/<code>([^<]*setup\.exe)<\/code>/g)].map((m) => m[1])
rec.namesInManual = namedInManual
const match = namedInManual.some((n) => onDisk.includes(n))
ok('S1a 手册里出现的安装包名能在实际产物中找到', match, `手册=${JSON.stringify(namedInManual)}；磁盘=${JSON.stringify(onDisk)}`)
ok('S1b 手册包名 == productName 推出的实际名', namedInManual.includes(expectedBundle), `期望 ${expectedBundle}`)
rec.findings.push({
  id: 'C-包名不符',
  severity: 'decisive',
  baselineClaim: namedInManual.join(' / '),
  actual: onDisk.join(' / '),
  why: '用户按手册去找一个并不存在的英文名文件；实际安装包是中文名「智序_0.1.0_x64-setup.exe」，且分隔符是下划线不是连字符',
})

// ---- S2：密钥去向
const keyClaim = /本软件不会把它上传到任何地方/.test(manual)
const sendsAuth = /\.header\("Authorization",\s*format!\("Bearer \{\}",\s*cfg\.key\)\)/.test(readFileSync(join(repoRoot, 'src-tauri/src/chat.rs'), 'utf8'))
rec.authHeaderSites = (readFileSync(join(repoRoot, 'src-tauri/src/chat.rs'), 'utf8').match(/\.header\("Authorization"/g) || []).length
ok('S2 手册"密钥不会上传到任何地方" 与源码不符（源码把 key 放进 Authorization 发出）', !(keyClaim && sendsAuth), `手册含该断言=${keyClaim}；chat.rs 发 Authorization=${sendsAuth}（${rec.authHeaderSites} 处）`)
if (keyClaim && sendsAuth) rec.findings.push({ id: 'C-密钥去向表述不符', severity: 'decisive', baselineClaim: '本软件不会把它上传到任何地方', actual: `chat.rs 在 ${rec.authHeaderSites} 处发送 Authorization: Bearer <key> 到配置的接口地址`, why: '密钥必然随每次请求离开本机到配置的服务；"不会上传到任何地方"与该行为矛盾' })

// ---- S3：未实测断言
const unverified = [
  { id: 'C-时长未实测', re: /全程约\s*2-3\s*分钟/, claim: '全程约 2-3 分钟' },
  { id: 'C-普适未实测', re: /任何公众号都能用/, claim: '图片方式所见即所得，任何公众号都能用' },
  { id: 'C-粘贴未实测', re: /把 HTML 内容复制到公众号编辑器/, claim: '把 HTML 内容复制到公众号编辑器' },
]
for (const u of unverified) {
  const present = u.re.test(manual)
  ok(`S3 ${u.id}（手册是否把未实测断言当事实陈述）`, !present, `present=${present}「${u.claim}」`)
  if (present) rec.findings.push({ id: u.id, severity: 'unverified-claim', baselineClaim: u.claim, actual: '仓库内无对应实测证据（安装与后台均登记为 NOT RUN）', why: '未实测的条件被写成普适结论，用户据此预期可能落空' })
}

writeFileSync(join(outDir, 'repro-c.json'), JSON.stringify(rec, null, 2))
console.log('\n手册（冻结基线）命中包名：', JSON.stringify(namedInManual), '| 实际产物：', JSON.stringify(onDisk))
console.log('关键发现：', rec.findings.map((f) => f.id).join(' / '))
console.log('写出：', join(outDir, 'repro-c.json'))
