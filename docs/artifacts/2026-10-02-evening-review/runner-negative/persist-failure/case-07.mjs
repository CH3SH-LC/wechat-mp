import { createJudge, guardCrashes } from "file:///D:/deepseek-harness/wechat-mp-desktop/scripts/lib/run-result.mjs";
const dir = process.env.WXMP_CASE_DIR;
const j = createJudge({ script: 'crash', outDir: dir, plannedCases: ['case'] });
guardCrashes(j);
j.check('case', true);
setTimeout(() => { throw new Error('模拟半路崩溃'); }, 0);
