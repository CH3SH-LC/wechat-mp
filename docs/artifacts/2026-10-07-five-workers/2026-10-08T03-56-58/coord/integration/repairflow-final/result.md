# 自动修复事实保护 —— 真实 App 回归

状态：**PASS**（检查 69/69 通过；计划 8 / 执行 8）

时间：2026-10-07T20:15:00.710Z
入口：`node scripts/repair-flow-check.mjs docs/artifacts/2026-10-07-five-workers/2026-10-08T03-56-58/coord/integration/repairflow-final http://127.0.0.1:1439`

被测源码指纹：

```json
{
  "src/App.tsx": "8a04066497b41924e0a69b81f924e6beeeb44bd5bd33efc10e8b61afb560b7b7",
  "src/lib/delivery-quality.ts": "81cfc78555e94edeaa7ac88079cd133e1e67ba7aece8687fc45c4ad3ebccee4c",
  "src/lib/compose.ts": "040b958b1075b2441b0da9bd943f5db14b426ef0590bc6eadf6d703191589dd9",
  "src/lib/prep.ts": "db238631ec62074b62e71338b4468d9ee2f495a354eaf8a16fe2b185dd00be4f"
}
```

```
  PASS - facts-lost：首稿确实进入了自动修订（模型被调用 2 次） (calls=write,revise)
  PASS - facts-lost：App 真的执行了正文保留比较（trace 有 bodyApplicability=applied） (applied=2 not-applicable=1)
  PASS - facts-lost：正文投影来自 compose 作者节点（不是 legacy-html 弱化回退） (第 1 轮门禁：阻断 1 / 提示 0；正文保留比较=not-applicable；投影=ok | 第 2 轮门禁：阻断 1 / 提示 2；正文保留比较=applied；投影=ok)
  PASS - facts-lost：全程无外链请求
  PASS - facts-lost：全程无页面异常
  PASS - facts-lost：首稿真的抽出了要保护的事实（先证"抽得出来"，再谈"漏没漏"） (期望=date:9 月 1 日 / time:上午8 点 30 分 / place:东区操场 / name:张老师 / number:100名；实抽=date:9 月 1 日 / time:上午8 点 30 分 / name:张老师 / place:东区操场 / number:100名)
  PASS - facts-lost：丢事实的修订稿**没有**被标成成品 (accepted=false docState=draft-failed)
  PASS - facts-lost：独立复算同样判不通过（App 结论与生产判定一致） (directVerdictOk=false 缺失=date:9 月 1 日 / time:上午8 点 30 分 / name:张老师 / place:东区操场 / number:100名)
  PASS - facts-preserved：首稿确实进入了自动修订（模型被调用 2 次） (calls=write,revise)
  PASS - facts-preserved：App 真的执行了正文保留比较（trace 有 bodyApplicability=applied） (applied=1 not-applicable=1)
  PASS - facts-preserved：正文投影来自 compose 作者节点（不是 legacy-html 弱化回退） (第 1 轮门禁：阻断 1 / 提示 0；正文保留比较=not-applicable；投影=ok | 第 2 轮门禁：阻断 0 / 提示 1；正文保留比较=applied；投影=ok)
  PASS - facts-preserved：全程无外链请求
  PASS - facts-preserved：全程无页面异常
  PASS - facts-preserved：首稿真的抽出了要保护的事实（先证"抽得出来"，再谈"漏没漏"） (期望=place:东区操场；实抽=date:9 月 1 日 / time:上午8 点 30 分 / name:张老师 / place:东区操场 / number:100名)
  PASS - facts-preserved：保留事实的修订稿**被**接受为成品 (accepted=true docState=accepted)
  PASS - facts-preserved：落盘源文保留全部指定事实 (source=已按要求写好。

```v2
[[theme:校园]]

## 新生见面会

活动于9 月 1 日上午8 点 30 分在)
  PASS - facts-preserved：独立复算同样判通过（正反对照成立） ([])
  PASS - place-only-loss：首稿确实进入了自动修订（模型被调用 2 次） (calls=write,revise)
  PASS - place-only-loss：App 真的执行了正文保留比较（trace 有 bodyApplicability=applied） (applied=2 not-applicable=1)
  PASS - place-only-loss：正文投影来自 compose 作者节点（不是 legacy-html 弱化回退） (第 1 轮门禁：阻断 1 / 提示 0；正文保留比较=not-applicable；投影=ok | 第 2 轮门禁：阻断 1 / 提示 2；正文保留比较=applied；投影=ok)
  PASS - place-only-loss：全程无外链请求
  PASS - place-only-loss：全程无页面异常
  PASS - place-only-loss：首稿真的抽出了要保护的事实（先证"抽得出来"，再谈"漏没漏"） (期望=place:东区操场；实抽=date:9 月 1 日 / time:上午8 点 30 分 / name:张老师 / place:东区操场 / number:100名)
  PASS - place-only-loss：丢事实的修订稿**没有**被标成成品 (accepted=false docState=draft-failed)
  PASS - place-only-loss：独立复算同样判不通过（App 结论与生产判定一致） (directVerdictOk=false 缺失=place:东区操场)
  PASS - ampm-changed：首稿确实进入了自动修订（模型被调用 2 次） (calls=write,revise)
  PASS - ampm-changed：App 真的执行了正文保留比较（trace 有 bodyApplicability=applied） (applied=2 not-applicable=1)
  PASS - ampm-changed：正文投影来自 compose 作者节点（不是 legacy-html 弱化回退） (第 1 轮门禁：阻断 1 / 提示 0；正文保留比较=not-applicable；投影=ok | 第 2 轮门禁：阻断 1 / 提示 2；正文保留比较=applied；投影=ok)
  PASS - ampm-changed：全程无外链请求
  PASS - ampm-changed：全程无页面异常
  PASS - ampm-changed：首稿真的抽出了要保护的事实（先证"抽得出来"，再谈"漏没漏"） (期望=time:上午8 点 30 分；实抽=date:9 月 1 日 / time:上午8 点 30 分 / name:张老师 / place:东区操场 / number:100名)
  PASS - ampm-changed：丢事实的修订稿**没有**被标成成品 (accepted=false docState=draft-failed)
  PASS - ampm-changed：独立复算同样判不通过（App 结论与生产判定一致） (directVerdictOk=false 缺失=time:上午8 点 30 分)
  PASS - inline-phone-loss：首稿确实进入了自动修订（模型被调用 2 次） (calls=write,revise)
  PASS - inline-phone-loss：App 真的执行了正文保留比较（trace 有 bodyApplicability=applied） (applied=2 not-applicable=1)
  PASS - inline-phone-loss：正文投影来自 compose 作者节点（不是 legacy-html 弱化回退） (第 1 轮门禁：阻断 1 / 提示 0；正文保留比较=not-applicable；投影=ok | 第 2 轮门禁：阻断 1 / 提示 2；正文保留比较=applied；投影=ok)
  PASS - inline-phone-loss：全程无外链请求
  PASS - inline-phone-loss：全程无页面异常
  PASS - inline-phone-loss：首稿真的抽出了要保护的事实（先证"抽得出来"，再谈"漏没漏"） (期望=phone:010-55556666；实抽=phone:010-55556666)
  PASS - inline-phone-loss：丢事实的修订稿**没有**被标成成品 (accepted=false docState=draft-failed)
  PASS - inline-phone-loss：独立复算同样判不通过（App 结论与生产判定一致） (directVerdictOk=false 缺失=phone:010-55556666)
  PASS - inline-phone-preserved：首稿确实进入了自动修订（模型被调用 2 次） (calls=write,revise)
  PASS - inline-phone-preserved：App 真的执行了正文保留比较（trace 有 bodyApplicability=applied） (applied=1 not-applicable=1)
  PASS - inline-phone-preserved：正文投影来自 compose 作者节点（不是 legacy-html 弱化回退） (第 1 轮门禁：阻断 1 / 提示 0；正文保留比较=not-applicable；投影=ok | 第 2 轮门禁：阻断 0 / 提示 1；正文保留比较=applied；投影=ok)
  PASS - inline-phone-preserved：全程无外链请求
  PASS - inline-phone-preserved：全程无页面异常
  PASS - inline-phone-preserved：首稿真的抽出了要保护的事实（先证"抽得出来"，再谈"漏没漏"） (期望=phone:010-55556666；实抽=phone:010-55556666)
  PASS - inline-phone-preserved：保留事实的修订稿**被**接受为成品 (accepted=true docState=accepted)
  PASS - inline-phone-preserved：落盘源文保留全部指定事实 (source=已按要求写好。

```v2
[[theme:校园]]

## 新生见面会

联系电话：`010-55556666`。
)
  PASS - inline-phone-preserved：独立复算同样判通过（正反对照成立） ([])
  PASS - standalone-emoji-preserved：首稿确实进入了自动修订（模型被调用 2 次） (calls=write,revise)
  PASS - standalone-emoji-preserved：App 真的执行了正文保留比较（trace 有 bodyApplicability=applied） (applied=1 not-applicable=1)
  PASS - standalone-emoji-preserved：正文投影来自 compose 作者节点（不是 legacy-html 弱化回退） (第 1 轮门禁：阻断 1 / 提示 0；正文保留比较=not-applicable；投影=ok | 第 2 轮门禁：阻断 0 / 提示 1；正文保留比较=applied；投影=ok)
  PASS - standalone-emoji-preserved：全程无外链请求
  PASS - standalone-emoji-preserved：全程无页面异常
  PASS - standalone-emoji-preserved：首稿真的抽出了要保护的事实（先证"抽得出来"，再谈"漏没漏"） (期望=place:东区操场；实抽=date:9 月 1 日 / time:上午8 点 30 分 / name:张老师 / place:东区操场 / number:100名)
  PASS - standalone-emoji-preserved：保留事实的修订稿**被**接受为成品 (accepted=true docState=accepted)
  PASS - standalone-emoji-preserved：落盘源文保留全部指定事实 (source=已按要求写好。

```v2
[[theme:校园]]

## 新生见面会

活动于9 月 1 日上午8 点 30 分在)
  PASS - standalone-emoji-preserved：独立复算同样判通过（正反对照成立） ([])
  PASS - no-protected-facts-accepted：首稿确实进入了自动修订（模型被调用 2 次） (calls=write,revise)
  PASS - no-protected-facts-accepted：App 真的执行了正文保留比较（trace 有 bodyApplicability=applied） (applied=1 not-applicable=1)
  PASS - no-protected-facts-accepted：正文投影来自 compose 作者节点（不是 legacy-html 弱化回退） (第 1 轮门禁：阻断 1 / 提示 0；正文保留比较=not-applicable；投影=ok | 第 2 轮门禁：阻断 0 / 提示 1；正文保留比较=applied；投影=ok)
  PASS - no-protected-facts-accepted：确认正文里**确实没有**受保护事实（否则这条用例测的不是它） (实抽=（无）)
  PASS - no-protected-facts-accepted：投影仍是 ok（不是 failed/empty），无事实不等于投影失败 (第 1 轮门禁：阻断 1 / 提示 0；正文保留比较=not-applicable；投影=ok | 第 2 轮门禁：阻断 0 / 提示 1；正文保留比较=applied；投影=ok)
  PASS - no-protected-facts-accepted：全程无外链请求
  PASS - no-protected-facts-accepted：全程无页面异常
  PASS - no-protected-facts-accepted：保留事实的修订稿**被**接受为成品 (accepted=true docState=accepted)
  PASS - no-protected-facts-accepted：落盘源文保留全部指定事实 (source=已按要求写好。

```v2
[[theme:校园]]

## 新生见面会

本期栏目主题是春游随笔，欢迎投稿。

欢迎)
  PASS - no-protected-facts-accepted：独立复算同样判通过（正反对照成立） ([])
```
