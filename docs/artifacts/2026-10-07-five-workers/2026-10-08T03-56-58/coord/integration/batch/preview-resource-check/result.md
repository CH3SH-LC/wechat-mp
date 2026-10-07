# 预览全过程外部资源检查

状态：**PASS**（executionComplete=true，检查 26/26 通过）
时间：2026-10-07T20:18:02.547Z → 2026-10-07T20:18:14.742Z
入口：`node scripts/preview-resource-check.mjs docs/artifacts/2026-10-07-five-workers/2026-10-08T03-56-58/coord/integration/batch/preview-resource-check http://127.0.0.1:1439`
计划场景：9；实际执行：9
被测源码哈希：`{"src/lib/preview-safe.ts":"46f79eb450baae3eefb27b736cb8e5be533d18dfa26c66e7d05a7ba7c8dd924f","src/components/PreviewPane.tsx":"d73317439bfb3a2f3ba87c7333b8dbb8bc5feedc3a8fcc470c8f6feda61585b7"}`
外链请求尝试总数：0

## 检查

```
PASS - app-run：预览 iframe 里没有任何外链引用残留 ()
PASS - app-run：门禁记录了特定的 html.external-img 问题（不是任意 html.* 就算） (UI 阻断项=[]｜全过程诊断=["html.emoji","html.gradient","html.shadow","html.external-img"]｜trace 质量记录=[["html.emoji","html.gradient","html.shadow","html.external-img"],[]])
PASS - app-run：原始违规原文跟着问题一起进了门禁（诊断带原始外链，不是洗掉之后才过检） (期望原文=["https://example.com/x.jpg"]｜诊断=["外链图片（发布后失效）：https://example.com/x.jpg"]｜留存核对（仅记录）会话=false 留存稿 source=false html=false)
PASS - app-run：本轮 App 运行期间外链请求 = 0 ()
PASS - preview:quoted-img-control / noResourceRequests (dom={"src":"data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%271%27 height=%271%27%3E%3C/svg%3E","currentSrc":"data:image/svg+xml,%3Csvg xmlns=%27http:","naturalWidth":1,"color":"rgb(0, 0, 0)"})
PASS - preview:quoted-img-control / referenceNeutralized (dom={"src":"data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%271%27 height=%271%27%3E%3C/svg%3E","currentSrc":"data:image/svg+xml,%3Csvg xmlns=%27http:","naturalWidth":1,"color":"rgb(0, 0, 0)"})
PASS - preview:unquoted-img / noResourceRequests (dom={"src":"data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%271%27 height=%271%27%3E%3C/svg%3E","currentSrc":"data:image/svg+xml,%3Csvg xmlns=%27http:","naturalWidth":1,"color":"rgb(0, 0, 0)"})
PASS - preview:unquoted-img / referenceNeutralized (dom={"src":"data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%271%27 height=%271%27%3E%3C/svg%3E","currentSrc":"data:image/svg+xml,%3Csvg xmlns=%27http:","naturalWidth":1,"color":"rgb(0, 0, 0)"})
PASS - preview:entity-img / noResourceRequests (dom={"src":"data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%271%27 height=%271%27%3E%3C/svg%3E","currentSrc":"data:image/svg+xml,%3Csvg xmlns=%27http:","naturalWidth":1,"color":"rgb(0, 0, 0)"})
PASS - preview:entity-img / referenceNeutralized (dom={"src":"data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%271%27 height=%271%27%3E%3C/svg%3E","currentSrc":"data:image/svg+xml,%3Csvg xmlns=%27http:","naturalWidth":1,"color":"rgb(0, 0, 0)"})
PASS - preview:css-import-string / noResourceRequests (dom={"src":null,"naturalWidth":null,"color":null})
PASS - preview:css-import-string / referenceNeutralized (dom={"src":null,"naturalWidth":null,"color":null})
PASS - preview:css-html-entity-url / noResourceRequests (dom={"src":null,"naturalWidth":null,"color":"rgb(0, 0, 0)"})
PASS - preview:css-html-entity-url / referenceNeutralized (dom={"src":null,"naturalWidth":null,"color":"rgb(0, 0, 0)"})
PASS - preview:css-style-preservation / noResourceRequests (dom={"src":null,"naturalWidth":null,"color":"rgb(1, 2, 3)"})
PASS - preview:css-style-preservation / unrelatedStylePreserved (dom={"src":null,"naturalWidth":null,"color":"rgb(1, 2, 3)"})
PASS - preview:css-style-preservation / referenceNeutralized (dom={"src":null,"naturalWidth":null,"color":"rgb(1, 2, 3)"})
PASS - preview:data-img-control / noResourceRequests (dom={"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4AWJiYGD4D8IgBpBmYAAAAAD//7vS9wEAAAAGSURBVAMAGDACA6ybwrYAAAAASUVORK5CYII=","currentSrc":"data:image/png;base64,iVBORw0KGgoAAAANSU","naturalWidth":2,"color":"rgb(0, 0, 0)"})
PASS - preview:data-img-control / localImageVisible (dom={"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4AWJiYGD4D8IgBpBmYAAAAAD//7vS9wEAAAAGSURBVAMAGDACA6ybwrYAAAAASUVORK5CYII=","currentSrc":"data:image/png;base64,iVBORw0KGgoAAAANSU","naturalWidth":2,"color":"rgb(0, 0, 0)"})
PASS - preview:data-img-control / currentSrcPreserved (dom={"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4AWJiYGD4D8IgBpBmYAAAAAD//7vS9wEAAAAGSURBVAMAGDACA6ybwrYAAAAASUVORK5CYII=","currentSrc":"data:image/png;base64,iVBORw0KGgoAAAANSU","naturalWidth":2,"color":"rgb(0, 0, 0)"})
PASS - preview:data-img-control / referenceNeutralized (dom={"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4AWJiYGD4D8IgBpBmYAAAAAD//7vS9wEAAAAGSURBVAMAGDACA6ybwrYAAAAASUVORK5CYII=","currentSrc":"data:image/png;base64,iVBORw0KGgoAAAANSU","naturalWidth":2,"color":"rgb(0, 0, 0)"})
PASS - preview:mixed-srcset-data / noResourceRequests (dom={"src":null,"currentSrc":"data:image/png;base64,iVBORw0KGgoAAAANSU","naturalWidth":2,"color":"rgb(0, 0, 0)"})
PASS - preview:mixed-srcset-data / localImageVisible (dom={"src":null,"currentSrc":"data:image/png;base64,iVBORw0KGgoAAAANSU","naturalWidth":2,"color":"rgb(0, 0, 0)"})
PASS - preview:mixed-srcset-data / currentSrcPreserved (dom={"src":null,"currentSrc":"data:image/png;base64,iVBORw0KGgoAAAANSU","naturalWidth":2,"color":"rgb(0, 0, 0)"})
PASS - preview:mixed-srcset-data / referenceNeutralized (dom={"src":null,"currentSrc":"data:image/png;base64,iVBORw0KGgoAAAANSU","naturalWidth":2,"color":"rgb(0, 0, 0)"})
PASS - 全程无页面异常 ()
```
