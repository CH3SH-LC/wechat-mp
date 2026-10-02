import { createJudge, guardCrashes } from "file:///D:/deepseek-harness/wechat-mp-desktop/scripts/lib/run-result.mjs";
const dir = process.env.WXMP_CASE_DIR;
const j = createJudge({ script: 'stale-pass', outDir: dir, plannedCases: ['case'] });
j.check('case', true);
j.finish({ extraFiles: { 'report.md': '报告正文\n' } });
