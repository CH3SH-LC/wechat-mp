import { createJudge, guardCrashes } from "file:///D:/deepseek-harness/wechat-mp-desktop/scripts/lib/run-result.mjs";
const dir = process.env.WXMP_CASE_DIR;
const j = createJudge({ script: 'out-is-file', outDir: dir, plannedCases: ['case'] });
j.check('case', true);
j.finish();
