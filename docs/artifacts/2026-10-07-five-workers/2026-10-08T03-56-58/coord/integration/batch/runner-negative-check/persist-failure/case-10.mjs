import { createJudge, guardCrashes } from "file:///D:/deepseek-harness/wechat-mp-desktop/scripts/lib/run-result.mjs";
const dir = process.env.WXMP_CASE_DIR;
const j = createJudge({ script: 'min-checks', outDir: dir, plannedCases: [], minChecks: 3 });
j.check('only-one', true);
j.finish();
