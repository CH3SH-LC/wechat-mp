// revise.ts —— 自动质检自检（第 32 轮）：成稿/修订稿产出后，本地排版引擎若仍检出"可修复质量项"
// （组件化不足 / 未包含美术素材 / 素材用量偏低 / 照片位却无装饰插画 / 气泡角饰未定义），就自动把
// 问题清单喂回模型重写一版，有界最多 MAX_AUTO_REVISES 次，直到无此类问题或达到上限。
// 定位：这是"撰写产物的确定性质量门禁"，不是对话流程——不拦截用户回合、不做澄清/路由判断，
// 不加任何对话状态机；运行期间沿用同一助手气泡与 busy，用户仍可手动停止。
export const REVISE_MARKER = '【自动质检】'
export const MAX_AUTO_REVISES = 2

// 只有这些"改写法即可解决"的结构/素材形状问题会触发自动重写；
// 风格未收录（可能是用户自定义名）、正文偏短（可能是有意短篇）、本地图/art:///表格等不触发。
const FIXABLE_KEYS = ['组件化不足', '未包含美术素材', '素材用量偏低', '只有照片位、没有任何装饰插画', '气泡角饰', '库素材引用缺失']

export function fixableWarnings(warnings: string[]): string[] {
  return warnings.filter((w) => FIXABLE_KEYS.some((k) => w.includes(k)))
}

// 生成"自动修订"的追加用户消息：保留已澄清方向与原文草稿，按问题清单修订并只输出一个 ```v2 围栏。
export function buildReviseContent(v2: string, issues: string[]): string {
  const list = issues.map((w) => '- ' + w).join('\n')
  return (
    `\n${REVISE_MARKER}本地排版引擎质检未通过，请把上一版正文按下列问题修订重写一遍：\n` +
    `（保留已澄清的主题 / 风格 / 事实 / 照片位设置与整体结构，补齐所缺项、纠正问题；不要新增无关内容；不要重复贴旧稿。）\n` +
    `质检问题：\n${list}\n\n` +
    `以下为当前正文，请基于它修订并只输出一个 \`\`\`v2 围栏（围栏前可用一两句自然说明）：\n` +
    `\`\`\`v2\n${v2}\n\`\`\``
  )
}
