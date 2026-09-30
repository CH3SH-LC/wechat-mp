# 预览全过程外部资源检查

时间：2026-09-29T16:44:46.242Z
入口：`node scripts/preview-resource-check.mjs C:/Users/Lenovo/.codex/visualizations/2026/09/29/01a0ebd4-c0e0-7742-90c2-10bc6149387b/ds-audit-20260930/preview/existing-script http://127.0.0.1:1448`
被测：`src/lib/preview-safe.ts`（纯函数）+ `src/components/PreviewPane.tsx`（显示边界）
源码哈希：preview-safe=`b7fea5f5f8ad5ef45df1e1cec4ea82d730f5152b7f34b9aecb059bad3265e3be`

**结果：全部 PASS**

```
  PASS - 全过程未经许可的外链请求 = 0
  PASS - 特别是 example.com 一次都没被真的请求
  PASS - 预览 iframe 里没有任何外链引用残留
  PASS - 全程无页面异常
  PASS - 原始违规证据仍进了门禁（不是靠把外链洗掉变绿） (质量记录：[["html.emoji","html.gradient","html.shadow","html.external-img"],[]])
  PASS - 纯函数：外链 img 被换成内联占位 (<img src="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.o)
  PASS - 纯函数：被拦 URL 有记录 (["https://example.com/x.jpg"])
  PASS - 纯函数：data: 图**不动** (<img src="data:image/png;base64,AAAA">)
  PASS - 纯函数：CSS url() 外链被换掉 (<div style="background:url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org)
  PASS - 纯函数：协议相对 //host 也算外链 (<img src="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.o)
  PASS - 纯函数：单引号属性不被打断（占位符不含引号） (<img src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%271%27 height=%271%27%3E%3C/svg%3E'>)
  PASS - 纯函数：srcset 全被过滤时退化为占位图（不留空的 srcset） (<img srcset="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%271%27 height=%271%27%3E%3C/svg%3E">)
  PASS - 纯函数：srcset 只剔除外链项、保留 data: 项 (<img srcset="data:image/png;base64, AA 2x">)
```
