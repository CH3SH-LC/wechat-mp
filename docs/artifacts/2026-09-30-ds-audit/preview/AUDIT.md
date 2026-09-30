# DS F5 / T1 / E independent audit

Audit date: 2026-09-30 Asia/Shanghai. Scope: source read-only, independent Chromium contexts, current Vite at http://127.0.0.1:1448. No desktop launch, model call, product edit, or historical artifact overwrite. HTTP resource attempts in the adversarial test were fulfilled locally by Playwright routes; attempts still count as failures.

## Conclusion

F5 is partially repaired, with four real external-resource bypasses and two rendering regressions reproduced. T1 is incomplete: new offline scripts exist, but the old live runner is unchanged and one new runner can write an all-PASS report after infrastructure failure. E has a newly built release and a documented isolated startup smoke test, but no new full publish-input provenance or L1-L5 real-model acceptance evidence was found in the inspected workspace and evidence root. DS explicitly records real-model acceptance as unfinished; do not describe the whole guide as completed.

## P1: F5 still permits ordinary external resources

Actual current `PreviewPane` was mounted in a fresh browser context; every case passed through production `wrapSrcDoc` (`src/components/PreviewPane.tsx:127-145`, `:514`) and the real iframe. This is a display-boundary test, not merely a pure-regex test. The test uses ordinary HTML/CSS syntax, without scripts.

| Case | Input | Actual browser request |
| --- | --- | --- |
| Unquoted img | `<img src=https://example.com/unquoted.png>` | `https://example.com/unquoted.png` |
| HTML entity in img URL | `<img src="https:&#x2f;&#x2f;example.com/entity.png">` | `https://example.com/entity.png` |
| CSS quoted import | `<style>@import "https://example.com/theme.css";</style>` | `https://example.com/theme.css` |
| HTML entities in CSS URL | `style="background-image:url(&quot;https://example.com/css-entity.png&quot;)"` | `https://example.com/css-entity.png` |

Relevant implementation: `src/lib/preview-safe.ts:35` only matches quoted attribute values; `:61-66` tests raw, undecoded values; `:80-85` only handles a subset of CSS URL syntax. The claim at `:53-55` that the regex cannot miss external resources is disproven by these four requests. Guide `docs/design/ds-repair-guide-2026-09-29.md:311,319` requires zero attempts throughout preview.

## P2: F5 changes legitimate rendering

1. `src/lib/preview-safe.ts:85` inserts double quotes into an already double-quoted style attribute. For `<div style="background-image:url(https://example.com/background.png);color:rgb(1, 2, 3);height:20px">`, the browser receives a truncated `style="background-image:url("` and stray attributes. Computed color is `rgb(0, 0, 0)`, rather than `rgb(1, 2, 3)`.
2. `src/lib/preview-safe.ts:42-47,69-77` splits srcset at every comma, including the comma inside a data URI. A real, decodable 2x2 PNG in mixed srcset is changed from `data:image/png;base64,<payload>` into `data:image/png;base64, <payload> 1x`; its `naturalWidth` becomes 0. The identical image in a normal data src has width 2 and remains visible.

Eight cases total: two controls pass (normal quoted external img suppressed; valid data img remains intact), four cases emit external requests, and two cases corrupt rendering. Details, DOM attributes, hashes and request events: `boundary-results.json`; executable test: `preview-boundary-audit.mjs`.

## P2: T1 still has misleading PASS evidence

The existing `scripts/preview-resource-check.mjs` independently passed its current fixture at the fresh Vite URL; see `existing-script/result.md` and `existing-script/raw.json`. That result is reproducible but narrower than its general claim:

- The actual App case covers the fixed quoted `example.com/x.jpg` fixture. CSS/srcset checks at `:119-130,160-175` inspect returned strings; they do not mount those variants or decode a real data image. The fake `AAAA` input cannot prove a valid local image survives.
- `:153-158` accepts any `html.*` issue as proof that external-image evidence survived. It should assert the specific `html.external-img` issue as well as raw source preservation. The actual current run does contain `html.external-img`; this is a weakness in the oracle, not a claim that it is currently absent.
- An independent infrastructure-error control used `http://127.0.0.1:1`. Navigation failed with `ERR_UNSAFE_PORT` and Node exited 1, yet `runner-error-control/result.md` says **all PASS** with zero executed checks. The unconditional finally block at `:179-185` derives the report only from `failed`, which remains zero on exceptions. Report must record ERROR/BLOCKED and an execution-complete flag, never infer PASS from zero failed assertions.
- The wait at `:105` only waits for absence of a work bubble; it does not prove this turn started and finished. Its timeout object is passed as the second argument (evaluation arg), not the Playwright options argument.

The old `scripts/live-three-samples.mjs` is byte-for-byte unchanged from the pre-guide source manifest: SHA256 `7F4DFD0A9AE2D900085ACF543C10F63728F216181B77B446C2DC58ADADDBCF47`. It still picks the newest trace by mtime (`:76-80`), uses hard-coded dependency/port/history defaults (`:24,32-36`), clears the current document (`:120-123`), and prints expectations without asserting them (`:218-227`). No replacement live runner / isolated launcher / shared live business verdict was found in repository scripts. The external `start-live.ps1`, `live-check.mjs`, `summarize-live.mjs` retain the old September 29 14:28-14:41 local timestamps and previously audited weaknesses.

## E: current release exists; full acceptance is still unfinished

Read-only inspection confirms these current files:

| Artifact | Size | Modified UTC | SHA256 |
| --- | ---: | --- | --- |
| `src-tauri/target/release/wechat-mp-desktop.exe` | 15,705,600 | 2026-09-29 08:32:18 | `FD24167433D70B352540551FE4174D746E42510365FC9D193B1ED0A1504B3DF8` |
| `src-tauri/target/release/bundle/nsis/智序_0.1.0_x64-setup.exe` | 4,582,036 | 2026-09-29 08:32:18 | `02148B3C2FDC53F3CC4144804B0AF9D424F499AD88B0DCC0899AAC545D989580` |

No checked source file had a later modification time than that exe. This supports chronology, not cryptographic provenance. No new complete build-before/build-after/acceptance-after input manifest was found; the external `source-manifest.json` remains the old 75-file list. Guide `:363-374` requires CSS, knowledge, public, resources, build.rs, test runners and fixtures plus manifest/build hashes, not only executable existence or time.

`PROGRESS.md:64` documents an isolated USERPROFILE + WebView2 startup smoke test, window title, workspace creation, and unchanged session/document/asset/trace counts. This is a DS-reported startup result, not an independently rerun test in this audit. It does not provide L1-L5 model creation/revision/reopen/export evidence or whole-workspace hash equality. `PROGRESS.md:92-94` explicitly says the new real-model rounds were not run; `REQUIREMENTS.md:20` likewise says these changes do not constitute real acceptance. Old real-model artifacts cannot verify the new finish_preparation protocol.

## Reproduction (new output directories only)

```powershell
$env:VERIFY_PLAYWRIGHT='D:/deepseek-harness/deepseek-harness/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright'
$env:VERIFY_CHROMIUM='C:/Users/Lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
# Supply fresh absolute output paths; do not overwrite this audit or historical evidence.
node scripts/preview-resource-check.mjs <fresh-baseline-output> http://127.0.0.1:1448
node C:/Users/Lenovo/.codex/visualizations/2026/09/29/01a0ebd4-c0e0-7742-90c2-10bc6149387b/ds-audit-20260930/preview/preview-boundary-audit.mjs http://127.0.0.1:1448 <fresh-boundary-output>
node scripts/preview-resource-check.mjs <fresh-error-output> http://127.0.0.1:1
```

Expected on current source: baseline script exit 0; boundary test exit 1 with exactly the four request and two rendering cases above; error control exits 1 but incorrectly writes all PASS. Fix validation must keep the existing successful fixture and both positive controls, then turn these six boundary cases green without hiding attempted requests.
