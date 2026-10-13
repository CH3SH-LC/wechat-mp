// Pure authorization regression: no disk reads, network calls, or model invocation.
import { isExplicitLocalImagePath as allowed } from '../src/lib/local-image-path.ts'
import { createJudge, guardCrashes, resolveOutDir } from './lib/run-result.mjs'

const judge = createJudge({ script: 'local-image-path-check', outDir: resolveOutDir('local-image-path-check'), minChecks: 34 })
guardCrashes(judge)
const cases = [
  ['中文空格绝对路径', 'C:/作品/活动 现场.png', ['请用 C:\\作品\\活动 现场.png 写篇推文'], true],
  ['独立路径行', 'D:/images/photo.png', ['D:\\images\\photo.png'], true],
  ['大小写和斜杠等价', 'c:/pictures/PHOTO.PNG', ['C:\\Pictures\\photo.png'], true],
  ['完整双引号路径', 'D:/活动/photo.png extra.png', ['把 "D:\\活动\\photo.png extra.png" 放进正文'], true],
  ['完整单引号路径', 'D:/活动/原图.jpg', ["使用 'D:\\活动\\原图.jpg'"], true],
  ['反引号路径', 'D:/活动/图.png', ['读取 `D:/活动/图.png`'], true],
  ['中文引号路径', 'D:/活动/图.png', ['读取“D:/活动/图.png”'], true],
  ['候选外部引号', '"D:/活动/图.png"', ['D:/活动/图.png'], true],
  ['图片名圆括号', 'C:/图像/活动 (1).png', ['用 C:/图像/活动 (1).png 配图'], true],
  ['原生路径井号', 'C:/图像/现场 #1.png', ['用 C:/图像/现场 #1.png 配图'], true],
  ['file URL中文空格', 'C:/图像/活动 现场.png', ['file:///C:/%E5%9B%BE%E5%83%8F/%E6%B4%BB%E5%8A%A8%20%E7%8E%B0%E5%9C%BA.png'], true],
  ['file URL含localhost', 'file://localhost/C:/图像/原图.png', ['C:/图像/原图.png'], true],
  ['用户file localhost URL', 'C:/图像/原图.png', ['file://localhost/C:/图像/原图.png'], true],
  ['file URL井号解码一次', 'C:/图像/现场 #1.png', ['file:///C:/图像/现场%20%231.png'], true],
  ['百分号原生文件名', 'C:/图像/100%25.png', ['C:/图像/100%25.png'], true],
  ['两个路径各自授权', 'D:/b.png', ['用 C:/a.png 和 D:/b.png'], true],
  ['跨用户消息不丢授权', 'C:/a.png', ['C:/a.png', '改一下标题'], true],
  ['明确无后缀文件', 'C:/图像/原图', ['"C:/图像/原图"'], true],
  ['未提供图片路径', 'C:/a.png', ['帮我配一张图'], false],
  ['相似文件不授权', 'C:/图像/活动.png', ['C:/图像/活动2.png'], false],
  ['前缀路径不得截短空格文件名', 'C:/dir/photo.png', ['用 C:/dir/photo.png extra.png 写推文'], false],
  ['引号内文件名不可截短', 'C:/dir/photo.png', ['用 "C:/dir/photo.png extra.png" 写推文'], false],
  ['后缀文件不得截短', 'C:/a.png', ['C:/a.png.bak'], false],
  ['文件内嵌盘符不是独立路径', 'C:/a.png', ['D:/folder/C:/a.png'], false],
  ['标识符前缀不是独立路径', 'C:/a.png', ['prefixC:/a.png'], false],
  ['网页URL不授权本地路径', 'C:/a.png', ['https://example.test/C:/a.png'], false],
  ['网页URL查询里的路径不授权', 'C:/a.png', ['https://example.test/?file=C:/a.png'], false],
  ['data URL里的路径不授权', 'C:/a.png', ['data:text/plain,C:/a.png'], false],
  ['不同目录不能替换', 'C:/private/a.png', ['C:/public/a.png'], false],
  ['相对路径拒绝', 'images/a.png', ['images/a.png'], false],
  ['网络共享拒绝', '\\\\server\\share\\a.png', ['\\\\server\\share\\a.png'], false],
  ['远程file主机拒绝', 'file://server/C:/a.png', ['file://server/C:/a.png'], false],
  ['file URL原始片段拒绝', 'file:///C:/a.png#other', ['file:///C:/a.png#other'], false],
  ['file URL查询拒绝', 'file:///C:/a.png?x=1', ['file:///C:/a.png?x=1'], false],
  ['原生百分号不按URL解码', 'C:/图像/a b.png', ['C:/图像/a%20b.png'], false],
  ['编码分隔符不放大授权', 'file:///C:/private%2fa.png', ['C:/private/a.png'], false],
  ['双重解码不放大授权', 'C:/图像/a b.png', ['file:///C:/图像/a%2520b.png'], false],
  ['编码盘符拒绝', 'file:///C%3A/a.png', ['file:///C%3A/a.png'], false],
  ['路径遍历拒绝', 'C:/public/../private/a.png', ['C:/public/../private/a.png'], false],
  ['编码遍历拒绝', 'file:///C:/public/%2e%2e/private/a.png', ['file:///C:/public/%2e%2e/private/a.png'], false],
  ['控制字符拒绝', 'C:/a\0.png', ['C:/a\0.png'], false],
  ['设备路径拒绝', '\\\\?\\C:\\a.png', ['\\\\?\\C:\\a.png'], false],
  ['ADS数据流拒绝', 'C:/a.png:stream', ['C:/a.png:stream'], false],
  ['尾点Windows别名拒绝', 'C:/a.png.', ['C:/a.png.'], false],
]
let failures = 0
for (const [name, path, texts, expected] of cases) {
  const actual = allowed(path, texts)
  judge.check(name, actual === expected, `actual=${actual}, expected=${expected}`)
  if (actual !== expected) failures++
}
judge.finish({ exitCode: failures ? 1 : 0, label: 'LOCAL-IMAGE-PATH' })
