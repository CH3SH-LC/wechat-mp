# 真实 App 实参截获（F1 材料依据边界）

状态：**PASS**（executionComplete=true，检查 67/67 通过）
时间：2026-10-07T20:14:50.192Z → 2026-10-07T20:15:00.327Z
入口：`node scripts/app-message-grounding-check.mjs docs/artifacts/2026-10-07-five-workers/2026-10-08T03-56-58/coord/integration/grounding-final http://127.0.0.1:1439`
被测：真实 App（React 组件 + `turn()` + 交付门禁）+ `src/lib/chat.ts` 通道替身（受控夹具，非原响应回放）
源码哈希：`{"src/App.tsx":"8a04066497b41924e0a69b81f924e6beeeb44bd5bd33efc10e8b61afb560b7b7","src/lib/chat.ts":"82c37c3b1665fa5107dd1745e143837df452cd151669603b5a5037e6b710e365","src/lib/persona.ts":"63c01438d638f087613d1587109a54527864949bca795e0754ea113cb514bcf6","src/lib/prep.ts":"db238631ec62074b62e71338b4468d9ee2f495a354eaf8a16fe2b185dd00be4f","src/lib/revise.ts":"6db46df0f4a1fcc3d235d69a4dea58af598c4aeab763bac5878c9c53576cd006"}`

```
PASS - compose-write-and-revise：页面无异常
PASS - compose-write-and-revise：没有外链请求
PASS - compose-write-and-revise：本回合真的跑起来了（有 prep 往返） (prep 往返 3 次)
PASS - compose-write-and-revise：prep 第 1 次请求的系统提示含共同依据规则 (system 长度 5360)
PASS - compose-write-and-revise：prep 第 1 次请求的指令消息本身含依据边界 (指令长度 988)
PASS - compose-write-and-revise：prep 第 2 次请求的系统提示含共同依据规则 (system 长度 5360)
PASS - compose-write-and-revise：prep 第 2 次请求的指令消息本身含依据边界 (指令长度 988)
PASS - compose-write-and-revise：prep 第 3 次请求的系统提示含共同依据规则 (system 长度 5360)
PASS - compose-write-and-revise：prep 第 3 次请求的指令消息本身含依据边界 (指令长度 988)
PASS - compose-write-and-revise：预算提醒只出现在最后一次 prep 请求（共 3 次往返） (各次提醒条数=[0,0,1]，期望=[0,0,1])
PASS - compose-write-and-revise：末轮提醒里也写了依据边界（时间紧不补事实） (提醒长度 282)
PASS - compose-write-and-revise：共同规则保留了正向授权（连接语与普通建议照常写）
PASS - compose-write-and-revise：共同规则不是"见到承诺就删/封"式口径（查一组措辞） (命中=[])
PASS - compose-write-and-revise：共同规则明确不要为缺项反复追问
PASS - compose-write-and-revise：共同规则允许省略非必要缺项（不是"缺任何字段都不成稿"）
PASS - compose-write-and-revise：compose 路径确实发出了 write 请求 (streamTurns=["write","revise"])
PASS - compose-write-and-revise：WRITE 的系统提示含共同依据规则
PASS - compose-write-and-revise：WRITE 的 digest 不再笼统让位给知识库 (追加速度 12274)
PASS - compose-write-and-revise：WRITE 的追加指令（最后一条消息）含材料依据边界
PASS - compose-write-and-revise：REVISE 的系统提示含共同依据规则
PASS - compose-write-and-revise：REVISE 的追加指令含"只修所列问题、不新增运营规则"
PASS - compose-write-and-revise：REVISE 的"保留已澄清事实"已限定为用户材料/确认
PASS - candidate-then-revise：页面无异常
PASS - candidate-then-revise：没有外链请求
PASS - candidate-then-revise：本回合真的跑起来了（有 prep 往返） (prep 往返 3 次)
PASS - candidate-then-revise：prep 第 1 次请求的系统提示含共同依据规则 (system 长度 5360)
PASS - candidate-then-revise：prep 第 1 次请求的指令消息本身含依据边界 (指令长度 988)
PASS - candidate-then-revise：prep 第 2 次请求的系统提示含共同依据规则 (system 长度 5360)
PASS - candidate-then-revise：prep 第 2 次请求的指令消息本身含依据边界 (指令长度 988)
PASS - candidate-then-revise：prep 第 3 次请求的系统提示含共同依据规则 (system 长度 5360)
PASS - candidate-then-revise：prep 第 3 次请求的指令消息本身含依据边界 (指令长度 988)
PASS - candidate-then-revise：预算提醒只出现在最后一次 prep 请求（共 3 次往返） (各次提醒条数=[0,0,1]，期望=[0,0,1])
PASS - candidate-then-revise：末轮提醒里也写了依据边界（时间紧不补事实） (提醒长度 282)
PASS - candidate-then-revise：共同规则保留了正向授权（连接语与普通建议照常写）
PASS - candidate-then-revise：共同规则不是"见到承诺就删/封"式口径（查一组措辞） (命中=[])
PASS - candidate-then-revise：共同规则明确不要为缺项反复追问
PASS - candidate-then-revise：共同规则允许省略非必要缺项（不是"缺任何字段都不成稿"）
PASS - candidate-then-revise：candidate 路径不发起撰写请求 (streamTurns=["revise"])
PASS - candidate-then-revise：REVISE 的系统提示含共同依据规则
PASS - candidate-then-revise：REVISE 的追加指令含"只修所列问题、不新增运营规则"
PASS - candidate-then-revise：REVISE 的"保留已澄清事实"已限定为用户材料/确认
PASS - prior-doc-title-only：页面无异常
PASS - prior-doc-title-only：没有外链请求
PASS - prior-doc-title-only：本回合真的跑起来了（有 prep 往返） (prep 往返 3 次)
PASS - prior-doc-title-only：prep 第 1 次请求的系统提示含共同依据规则 (system 长度 5795)
PASS - prior-doc-title-only：prep 第 1 次请求的指令消息本身含依据边界 (指令长度 988)
PASS - prior-doc-title-only：prep 第 2 次请求的系统提示含共同依据规则 (system 长度 5795)
PASS - prior-doc-title-only：prep 第 2 次请求的指令消息本身含依据边界 (指令长度 988)
PASS - prior-doc-title-only：prep 第 3 次请求的系统提示含共同依据规则 (system 长度 5795)
PASS - prior-doc-title-only：prep 第 3 次请求的指令消息本身含依据边界 (指令长度 988)
PASS - prior-doc-title-only：预算提醒只出现在最后一次 prep 请求（共 3 次往返） (各次提醒条数=[0,0,1]，期望=[0,0,1])
PASS - prior-doc-title-only：末轮提醒里也写了依据边界（时间紧不补事实） (提醒长度 282)
PASS - prior-doc-title-only：共同规则保留了正向授权（连接语与普通建议照常写）
PASS - prior-doc-title-only：共同规则不是"见到承诺就删/封"式口径（查一组措辞） (命中=[])
PASS - prior-doc-title-only：共同规则明确不要为缺项反复追问
PASS - prior-doc-title-only：共同规则允许省略非必要缺项（不是"缺任何字段都不成稿"）
PASS - prior-doc-title-only：续改实参带上了当前正式稿
PASS - prior-doc-title-only：续改实参限定了「权威」只指版本与素材引用
PASS - prior-doc-title-only：续改实参仍要求保持既有素材引用
PASS - prior-doc-title-only：续改实参把上一版的未给依据规则保留为原文（不静默删除、不加占位）
PASS - prior-doc-title-only：compose 路径确实发出了 write 请求 (streamTurns=["write","revise"])
PASS - prior-doc-title-only：WRITE 的系统提示含共同依据规则
PASS - prior-doc-title-only：WRITE 的 digest 不再笼统让位给知识库 (追加速度 12274)
PASS - prior-doc-title-only：WRITE 的追加指令（最后一条消息）含材料依据边界
PASS - prior-doc-title-only：REVISE 的系统提示含共同依据规则
PASS - prior-doc-title-only：REVISE 的追加指令含"只修所列问题、不新增运营规则"
PASS - prior-doc-title-only：REVISE 的"保留已澄清事实"已限定为用户材料/确认
```
