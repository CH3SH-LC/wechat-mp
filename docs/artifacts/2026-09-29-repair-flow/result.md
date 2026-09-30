# 自动修复事实保护 —— 真实 App 回归

时间：2026-09-29T08:35:49.319Z
入口：`node scripts/repair-flow-check.mjs docs\artifacts\2026-09-29-repair-flow http://127.0.0.1:1420`

**结果：全部 PASS**

被测源码指纹：

```json
{
  "src/App.tsx": "dce1040531da38564a48e51f7677f7bdd415b442a38c32467905db73c1348a36",
  "src/lib/delivery-quality.ts": "4aca0a83ab49d87d0ff9b934eb1f6ac142e199bd3ca6314308015bdcf9fa270e",
  "src/lib/compose.ts": "4312f701e89017bd2b96ba375703232270828b7b6bc7dfe659b5420d3ba4c7ad",
  "src/lib/prep.ts": "a7966100d66ca31dc67de1e3a1cdfd0f46160045fb8afca1f9ea778618d73d7f"
}
```

```
  PASS - facts-lost：首稿确实进入了自动修订（模型被调用 2 次） (calls=write,revise)
  PASS - facts-lost：App 真的执行了正文保留比较（trace 有 bodyApplicability=applied） (applied=2 not-applicable=1)
  PASS - facts-lost：全程无外链请求
  PASS - facts-lost：全程无页面异常
  PASS - facts-lost：丢事实的修订稿**没有**被标成成品 (accepted=false docState=draft-failed)
  PASS - facts-lost：独立复算同样判不通过（App 结论与生产判定一致） (directVerdictOk=false 缺失=date:9 月 1 日 / time:8 点 30 分 / name:张老师 / number:100名)
  PASS - facts-preserved：首稿确实进入了自动修订（模型被调用 2 次） (calls=write,revise)
  PASS - facts-preserved：App 真的执行了正文保留比较（trace 有 bodyApplicability=applied） (applied=1 not-applicable=1)
  PASS - facts-preserved：全程无外链请求
  PASS - facts-preserved：全程无页面异常
  PASS - facts-preserved：保留事实的修订稿**被**接受为成品 (accepted=true docState=accepted)
  PASS - facts-preserved：落盘源文保留全部指定事实 (source=已按要求写好。

```v2
[[theme:校园]]

## 新生见面会

活动于9 月 1 日上午8 点 30 分在)
  PASS - facts-preserved：独立复算同样判通过（正反对照成立） ([])
```
