// E 路 阶段二：C（交付说明）独立复核 —— 手册实际描述与源码是否一致 + 未验条件是否如实标注。
// 对象：冻结候选 src-tauri/resources/使用手册.html（哈希 ce0f8498…）；只读对账，不执行安装/后台。
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../../../..')
const outDir = join(here, 'out')
mkdirSync(outDir, { recursive: true })
const sha256 = (b) => createHash('sha256').update(b).digest('hex')

const manualRel = 'src-tauri/resources/使用手册.html'
const manualBytes = readFileSync(join(repoRoot, manualRel))
const manual = manualBytes.toString('utf8')
const conf = JSON.parse(readFileSync(join(repoRoot, 'src-tauri/tauri.conf.json'), 'utf8'))
const chatrs = readFileSync(join(repoRoot, 'src-tauri/src/chat.rs'), 'utf8')
const exportrs = readFileSync(join(repoRoot, 'src-tauri/src/export.rs'), 'utf8')
const previewpane = readFileSync(join(repoRoot, 'src/components/PreviewPane.tsx'), 'utf8')
const nsisDir = join(repoRoot, 'src-tauri/target/release/bundle/nsis')
const onDisk = existsSync(nsisDir) ? readdirSync(nsisDir).filter((f) => f.endsWith('.exe')) : []

const rec = { script: 'phase2-c-check', manualSha256: sha256(manualBytes), checks: [] }
const ok = (id, pass, ev = '') => { rec.checks.push({ id, pass: Boolean(pass), evidence: String(ev ?? '') }); console.log(`  ${pass ? 'OK  ' : 'FAIL'} ${id}${ev ? '  (' + ev + ')' : ''}`) }

// S1 包名
const expected = `${conf.productName}_${conf.version}_x64-setup.exe`
const named = [...manual.matchAll(/<code>([^<]*setup\.exe)<\/code>/g)].map((m) => m[1])
ok('S1 手册包名 == productName 推出的实际名，且磁盘上存在', named.includes(expected) && onDisk.includes(expected), `手册=${JSON.stringify(named)} 磁盘含=${onDisk.includes(expected)}`)
ok('S1b 手册不再出现已停用的英文名', !named.some((n) => n.startsWith('wechat-mp-desktop')), JSON.stringify(named))

// S2 writeText：手册须说明"纯文本、非富文本"
const usesWriteText = /navigator\.clipboard\.writeText\(html\)/.test(previewpane)
const saysPlain = /纯文本/.test(manual) && /不是带排版的富文本|不会保留版式/.test(manual)
ok('S2 「复制 HTML」= writeText 纯文本，且手册如实说明非富文本', usesWriteText && saysPlain, `writeText=${usesWriteText} 手册明说纯文本=${saysPlain}`)

// S3 exports/img-<名>
const srcImgName = /format!\("img-\{\}",\s*sanitize_name\(base\)\)/.test(exportrs) || /img-\{\}/.test(exportrs)
const manImgName = /exports\/img-&lt;名&gt;|img-&lt;名&gt;/.test(manual)
ok('S3 导出去向 exports/img-<名> 与源码一致', srcImgName && manImgName, `源码=${srcImgName} 手册=${manImgName}`)

// S4 LOCKED_MODEL
const locked = /const LOCKED_MODEL: Option<&str> = Some\("deepseek-flash"\)/.test(chatrs)
const manLocked = /锁定为\s*deepseek-flash|临时锁定为 deepseek-flash/.test(manual) && /置灰/.test(manual)
ok('S4 模型锁定（LOCKED_MODEL）与手册描述一致', locked && manLocked, `源码锁定=${locked} 手册=${manLocked}`)

// S5 未实测断言必须已移除
const badClaims = [
  ['2-3 分钟', /全程约\s*2-3\s*分钟/],
  ['任何公众号都能用', /任何公众号都能用/],
  ['密钥不会上传到任何地方', /不会把它上传到任何地方/],
]
for (const [n, re] of badClaims) {
  const present = re.test(manual)
  ok(`S5 未实测/不实断言「${n}」已移除`, !present, `present=${present}`)
}

// S6 不得声称安装/后台已实测通过
const claimsTested = /(安装|后台|草稿).{0,12}(已实测|已验证|已通过|实测通过)/.test(manual)
ok('S6 手册未把"安装/后台"写成已实测通过', !claimsTested, `claimsTested=${claimsTested}`)

// S7 隐私/密钥去向须与实际发送行为一致
const sendsAuth = /\.header\("Authorization",\s*format!\("Bearer \{\}",\s*cfg\.key\)\)/.test(chatrs)
const manKeyTruth = /Authorization|认证头/.test(manual) && /随请求/.test(manual)
ok('S7 密钥去向描述与源码发送行为一致', sendsAuth ? manKeyTruth : true, `源码发 Authorization=${sendsAuth} 手册如实=${manKeyTruth}`)

writeFileSync(join(outDir, 'phase2-c.json'), JSON.stringify(rec, null, 2))
const failed = rec.checks.filter((c) => !c.pass)
console.log(`\n检查 ${rec.checks.length} 条，未过 ${failed.length} 条：${failed.map((c) => c.id).join(' / ')}`)
console.log('手册 sha256 =', rec.manualSha256)
console.log('写出：', join(outDir, 'phase2-c.json'))
