# 故障样例：2026-09-28「筑基」稿

这批文件是**只读回归样例**，供离线断言脚本使用。它们是从当时真实工作区复制过来的副本，
脚本只读不写；任何测试产物都不得覆盖真实作品目录。

| 文件 | 来源 | 说明 |
| --- | --- | --- |
| `failing-source.md` | `<workspace>/documents/s1790565874610554000/source.md` | 用户实际拿到的失败稿。三个角饰写成纯文字 `::: art deco` 块（块内没有 SVG），一处 `[[asset:…]]` 用的是**中文类别** |
| `failing-doc.json` | 同目录 `meta.json` | 当时保存的 7 条告警与 3 条 `source=failed` 绑定 |
| `assets/bud/` | `<workspace>/assets/items/as-1790588922712090500/` | 花苞角饰（usage=deco，name=bud） |
| `assets/star/` | `<workspace>/assets/items/as-1790583788378180800/` | 星星角饰（usage=deco，name=star） |
| `assets/deco-mtt2ujno/` | `<workspace>/assets/items/as-1788896601351150500/` | 四叶草小苗角饰（usage=deco） |
| `assets/inline-mtx761tr/` | `<workspace>/assets/items/as-1789145721283342400/` | 校园书桌插画（usage=inline，category=art-inline） |

每枚素材保留原始 `meta.json` 与 `source.svg`，不做任何改写。

## 这批样例要证明什么

修复计划阶段 2 的验收：**这四枚已有素材必须全部恢复绑定，且四枚复用位产生 0 次绘图调用。**
其中：

- `inline-mtx761tr` 是被中文类别 `[[asset:正文内嵌插画|…]]` 挡住的那一枚（正确类别是 `art-inline`）；
- `bud` / `star` / `deco-mtt2ujno` 是被纯文字 `::: art deco` 块挡住、随后气泡引用报「未定义」的三枚。

`failing-doc.json` 里的 7 条告警是修复前的基线：3 条「装饰素材未达标（需带 viewBox）」、
3 条「气泡角饰未定义」、1 条「只有照片位、没有任何装饰插画」。修复后前 6 条都必须消失。
