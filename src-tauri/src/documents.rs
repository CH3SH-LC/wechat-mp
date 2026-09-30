// documents.rs —— 文档存储：不可变版本目录 + 提交指针（质量恢复计划 §7）
//
// 布局（`documents/<docId>/`）：
//   manifest.json                # 当前指针：schemaVersion / acceptedRevisionId / draftRevisionId / generation
//   revisions/<revisionId>/      # 不可变版本：source.md + article.html + meta.json（绑定/快照/诊断/检查版本/哈希/来源 runId/质量结果）
//   staging/<transactionId>/     # 未提交候选：读者**永不**把它当成当前成品
//
// 为什么不再是"三文件就地覆盖"：
//   旧实现依次 write meta.json → source.md → article.html。每一步都是一次"截断 + 写"，
//   中途任何一步失败（磁盘满、进程被杀、断电）都会留下**半新半旧**的一篇稿子——
//   例如 source.md 已是新稿、article.html 还是旧稿。用户拿到的就是"新源文配旧 HTML"的混合版本：
//   既不能回滚也不能重放，只能人工比对。
//   多个 write 之间**没有事务**；跨文件 rename 也**不是**事务（rename 一次只能替换一个名字，
//   三个文件就要三次替换，中间照样能被中断）。所以这里改成：
//   ① 先把一整份候选写进 staging，校验文件齐备/哈希/绑定/质量记录；
//   ② 通过后把 staging 目录**整体改名**成 revisions/<revisionId>（同卷目录改名，一次目录项操作）；
//   ③ 最后用**一次同目录 rename** 换掉 manifest.json —— 这是唯一的提交点。
//   读者只认 manifest 指向的那一份版本，因此提交点之前的一切中断都不会被当成成品，
//   提交点失败/中断时旧指针原封不动。
//
// 旧布局（meta.json/source.md/article.html 平铺在文档目录下）由 migrate_legacy_doc 迁成
// revisions/legacy/，原三文件保留不删；旧版本没有验收记录，一律标为"未验证"（§7.3）。
//
// 文档 id 与产生它的会话 id 相同（对话与文稿分离存放，但 1:1 关联）。

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

/// manifest 结构版本。将来布局再变时，靠它决定怎么读旧指针。
pub const SCHEMA_VERSION: u32 = 1;

/// 验收状态取值。空串 = **未记录**（旧调用方不传时不臆断，也不影响读写）。
/// - `verified`：调用方声明已通过交付门禁（这时必须同时给质量记录，见 validate_version）
/// - `unverified`：明确知道没有验收记录（旧文档迁移成 legacy 版就是这种）
/// - `failed`：候选已判定不合格（仍可作为草稿保留）
const VALIDATION_VERIFIED: &str = "verified";
const VALIDATION_UNVERIFIED: &str = "unverified";
const VALIDATION_FAILED: &str = "failed";

/// 旧布局迁移出来的固定版本 id（写死才能让"迁移中断后补提交指针"可判定）
const LEGACY_REVISION_ID: &str = "legacy";

// ---------- 数据形态 ----------

/// 素材引用快照（V3-R3 固化副本用；R1/R2 阶段为空映射，字段先行保持兼容）
#[derive(Serialize, Deserialize, Clone, Default, Debug)]
pub struct AssetSnap {
    pub svg: String,
    pub ver: u64,
}

/// 素材位 → 库素材 id / 来源 / 原因的确定绑定（P0 §7）。
/// 与 session_id 同存的 meta.json 里带 `#[serde(default)]`：旧文档没这个字段也能读出来。
///
/// 阶段 3（2026-09-28 修复计划）新增 `slotId`：素材位在本轮创作内的稳定标识，
/// 用于"未完成素材清单"里的**单项重试**，也让同一素材位跨越多次自动修订仍可追踪。
/// 旧文档缺该字段时退化为空串（不是错误）。
#[derive(Serialize, Deserialize, Clone, Default, Debug)]
pub struct AssetBinding {
    pub slot: String,
    #[serde(default, rename = "slotId")]
    pub slot_id: String,
    pub id: String,
    pub source: String,
    pub reason: String,
}

/// 版本内两个产物的内容哈希（SHA-256 十六进制）。
/// 用途是**判断这一版的文件是否还是我们提交时的那些**（被外部改动/写坏/混杂），
/// 不是对抗性安全用途。提交前用写入内容算一遍，读取时再算一遍比对。
#[derive(Serialize, Deserialize, Clone, Default)]
pub struct RevisionHashes {
    #[serde(default)]
    pub source: String,
    #[serde(default)]
    pub html: String,
}

/// 一份版本的元数据。**同时用于两处**：旧布局平铺的 meta.json（缺新字段，靠 default 兼容读），
/// 以及 revisions/<id>/meta.json（新字段齐备）。合并成一个类型是刻意的：
/// 旧文档兼容读取因此不需要第二套解析代码，也就不会两处口径打架。
#[derive(Serialize, Deserialize, Clone, Default)]
pub struct DocMeta {
    pub id: String,
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub warnings: Vec<String>,
    #[serde(default)]
    pub snapshots: HashMap<String, AssetSnap>,
    #[serde(default)]
    pub bindings: Vec<AssetBinding>,
    // ---- 版本绑定信息（§7.1：绑定、快照、诊断、检查版本、文件哈希和来源 runId）----
    /// 产生这一版的那一轮 runId（与 trace/取消链路对齐，便于把版本追回具体请求）
    #[serde(default)]
    pub run_id: Option<String>,
    /// 检查（门禁）实现的版本标识；换了检查口径后旧版本不会被误当同口径结果
    #[serde(default)]
    pub validation_version: Option<String>,
    /// 交付质量结果：**前端传入的结构化结果，Rust 只存不解释**。
    /// 不在这里做任何判定——门禁语义归前端 delivery-quality，Rust 只负责"整份绑定"。
    #[serde(default)]
    pub quality: Option<serde_json::Value>,
    /// 验收状态，见文件头的 VALIDATION_* 常量；空串 = 未记录
    #[serde(default)]
    pub validation: String,
    /// 版本来源：`commit`（成品提交）/ `draft`（草稿提交）/ `legacy`（旧文档迁移）
    #[serde(default)]
    pub origin: String,
    #[serde(default)]
    pub hashes: RevisionHashes,
}

/// 当前指针。§7.1 规定的四个字段，不多不少。
#[derive(Serialize, Deserialize, Clone, Default)]
pub struct DocManifest {
    #[serde(default)]
    pub schema_version: u32,
    #[serde(default)]
    pub accepted_revision_id: Option<String>,
    #[serde(default)]
    pub draft_revision_id: Option<String>,
    /// 每成功提交一次 +1。**提交前检查它**（连同 baseRevisionId）用于挡住迟到的旧请求。
    #[serde(default)]
    pub generation: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DocContent {
    pub id: String,
    pub title: String,
    pub updated_at: String,
    pub source: String,
    pub html: String,
    #[serde(default)]
    pub warnings: Vec<String>,
    #[serde(default)]
    pub snapshots: HashMap<String, AssetSnap>,
    #[serde(default)]
    pub bindings: Vec<AssetBinding>,
    // ---- 版本信息（附加字段：旧调用方忽略即可，形状不破坏）----
    /// 这次读到的内容属于哪一版（成品版）
    #[serde(default)]
    pub revision_id: Option<String>,
    #[serde(default)]
    pub accepted_revision_id: Option<String>,
    #[serde(default)]
    pub draft_revision_id: Option<String>,
    #[serde(default)]
    pub generation: u64,
    #[serde(default)]
    pub validation: String,
    #[serde(default)]
    pub quality: Option<serde_json::Value>,
    #[serde(default)]
    pub run_id: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct DocListEntry {
    pub id: String,
    pub title: String,
    pub updated_at: String,
    /// 成品版本的验收状态（空串 = 未记录）。附加字段，不改变 `items` 形状。
    #[serde(default)]
    pub validation: String,
    /// 是否存在比成品更新的草稿版本（§8：预览要能说明"显示的是草稿还是成品"）
    #[serde(default)]
    pub has_draft: bool,
}

#[derive(Serialize, Deserialize)]
pub struct DocList {
    pub items: Vec<DocListEntry>,
    /// R3：读不出来的文稿（meta 损坏 / article.html 读取失败 / 版本不完整）。
    /// 它们不在 `items` 里（拿不到完整正文就不该当正常项渲染），但**必须**回传：
    /// 旧实现把 IO 失败折叠成"没有产物"，一篇正文完好的稿子会像不存在一样消失，
    /// 而同一份坏 meta 在 open_at / save_at 里却是抛错的——同一数据两处口径必须一致。
    #[serde(default)]
    pub unreadable: Vec<crate::sessions::UnreadableItem>,
}

/// 历史版本一览里的一条
#[derive(Serialize, Deserialize, Clone, Default)]
pub struct RevisionInfo {
    pub id: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub updated_at: String,
    #[serde(default)]
    pub validation: String,
    #[serde(default)]
    pub origin: String,
    #[serde(default)]
    pub run_id: Option<String>,
    #[serde(default)]
    pub quality: Option<serde_json::Value>,
    #[serde(default)]
    pub is_accepted: bool,
    #[serde(default)]
    pub is_draft: bool,
    /// 三个文件齐备且哈希与提交时一致。**不完整的历史版本不能当回滚目标**。
    #[serde(default)]
    pub complete: bool,
    /// complete=false 时的中文原因
    #[serde(default)]
    pub error: Option<String>,
}

/// 未提交候选（staging）。孤立候选只报告存在与齐备性，供恢复/诊断；
/// 它**不会**被自动提升为成品（§7.2 第 6 条），也不会被自动清理。
#[derive(Serialize, Deserialize, Clone, Default)]
pub struct StagingInfo {
    pub transaction_id: String,
    #[serde(default)]
    pub has_source: bool,
    #[serde(default)]
    pub has_html: bool,
    #[serde(default)]
    pub has_meta: bool,
    /// 三件齐备（能作为恢复候选）——注意：齐备 ≠ 已提交为成品
    #[serde(default)]
    pub recoverable: bool,
}

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct DocRevisionList {
    pub id: String,
    pub schema_version: u32,
    pub generation: u64,
    pub accepted_revision_id: Option<String>,
    pub draft_revision_id: Option<String>,
    pub revisions: Vec<RevisionInfo>,
    pub staging: Vec<StagingInfo>,
}

/// 保存选项。`fault` **仅供测试**注入中断点，生产路径一律 `FaultPoint::None`。
#[derive(Clone, Default)]
pub struct SaveOpts {
    pub quality: Option<serde_json::Value>,
    pub run_id: Option<String>,
    pub validation_version: Option<String>,
    pub validation: Option<String>,
    /// 提交前检查：调用方认为自己基于哪一版成品。与当前指针不符 → 拒绝（旧请求不覆盖新提交）
    pub base_revision_id: Option<String>,
    /// 提交前检查：调用方认为自己看到的 generation。与当前不符 → 拒绝
    pub expected_generation: Option<u64>,
    /// true = 只推进草稿指针，**不动成品指针**（失败候选不许替换已验收成品）
    pub as_draft: bool,
    pub fault: FaultPoint,
}

/// 提交过程中的故障注入点（**仅供测试**）。
/// 为什么留这个口子：§10 要求"meta/source/html/manifest 任一步失败 → 当前已提交版本可读、
/// 不存在新源文配旧 HTML 的混合版本"，这条断言只能在真实的中间步骤上失败才可证伪，
/// 读代码推断不算证据。生产路径一律传 `FaultPoint::None`。
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
#[allow(dead_code)]
pub enum FaultPoint {
    #[default]
    None,
    /// 写完 staging 的 source.md 后中断
    AfterStagingSource,
    /// 写完 staging 的 article.html 后中断
    AfterStagingHtml,
    /// 写完 staging 的 meta.json 后中断
    AfterStagingMeta,
    /// 校验通过、把候选安装为版本之前中断
    BeforeInstall,
    /// 版本已就位、提交 manifest 指针之前中断
    BeforeManifestCommit,
    /// 替换 manifest 时失败（走真实的失败清理分支）
    ManifestRenameFails,
}

// ---------- 目录与基础 ----------

fn documents_dir_at(base: &Path) -> PathBuf {
    base.join("documents")
}

/// 全局单调时间戳源。
/// 为什么不用 `SystemTime::now()` 直接格式化：系统时钟粒度粗时两次相邻调用可能取到同一个值，
/// 于是新版本 id 会撞上已有版本目录——而**不可变版本绝不允许覆盖**，撞上就只能报错。
/// 这里在进程内强制严格递增，代价只是几个原子操作。
static LAST_TS: AtomicU64 = AtomicU64::new(0);

fn now_ts() -> String {
    let d = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    let mut n = d.as_secs().saturating_mul(1_000_000_000).saturating_add(d.subsec_nanos() as u64);
    loop {
        let prev = LAST_TS.load(Ordering::SeqCst);
        if n <= prev {
            n = prev + 1;
        }
        if LAST_TS.compare_exchange(prev, n, Ordering::SeqCst, Ordering::SeqCst).is_ok() {
            break;
        }
    }
    format!("{n}")
}

/// 文档/版本/事务 id 都必须可作目录名（会话 id 为 s<ts> 形态；防路径穿越）
fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-'))
}

fn doc_dir_at(base: &Path, id: &str) -> Result<PathBuf, String> {
    if !valid_id(id) {
        return Err(format!("非法文档 id：{id}"));
    }
    Ok(documents_dir_at(base).join(id))
}

fn revisions_dir(dir: &Path) -> PathBuf {
    dir.join("revisions")
}

fn staging_dir(dir: &Path) -> PathBuf {
    dir.join("staging")
}

fn manifest_path(dir: &Path) -> PathBuf {
    dir.join("manifest.json")
}

fn revision_dir(dir: &Path, rev_id: &str) -> Result<PathBuf, String> {
    if !valid_id(rev_id) {
        return Err(format!("非法版本 id：{rev_id}"));
    }
    Ok(revisions_dir(dir).join(rev_id))
}

fn read_meta(dir: &Path) -> Result<Option<DocMeta>, String> {
    let p = dir.join("meta.json");
    if !p.exists() {
        return Ok(None);
    }
    let raw = std::fs::read_to_string(&p).map_err(|e| format!("读取文档 meta 失败：{e}"))?;
    serde_json::from_str::<DocMeta>(&raw).map(Some).map_err(|e| format!("文档 meta 损坏：{e}"))
}

fn read_file(path: &Path) -> Result<String, String> {
    if !path.exists() {
        return Ok(String::new()); // 确实没有这个文件（正常态：如尚未生成的产物）
    }
    // 错误里带上文件名：列表的"坏文档"告警要能让用户知道是 meta 坏了还是正文坏了
    let label = path
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string_lossy().to_string());
    std::fs::read_to_string(path).map_err(|e| format!("读取 {label} 失败：{e}"))
}

fn content_hash(s: &str) -> String {
    let mut h = Sha256::new();
    h.update(s.as_bytes());
    let d = h.finalize();
    let mut out = String::with_capacity(d.len() * 2);
    for b in d.iter() {
        out.push_str(&format!("{b:02x}"));
    }
    out
}

fn read_manifest(dir: &Path) -> Result<Option<DocManifest>, String> {
    let p = manifest_path(dir);
    if !p.exists() {
        return Ok(None);
    }
    let raw = std::fs::read_to_string(&p).map_err(|e| format!("读取 manifest 失败：{e}"))?;
    serde_json::from_str::<DocManifest>(&raw).map(Some).map_err(|e| format!("manifest 损坏：{e}"))
}

// ---------- 原子写与提交点 ----------

/// 写同目录临时文件并 fsync。
/// 为什么必须先落盘再改名：rename 只保证"名字指向换一次"，不保证内容已经离开页缓存；
/// 崩溃后可能看到"名字是新的、内容是旧的/半截的"。sync_all 之后内容才真的在盘上。
fn write_tmp_file(dir: &Path, name: &str, bytes: &[u8]) -> Result<PathBuf, String> {
    std::fs::create_dir_all(dir).map_err(|e| format!("创建目录失败：{e}"))?;
    let tmp = dir.join(format!(".{name}.tmp-{}-{}", std::process::id(), now_ts()));
    let mut f = std::fs::File::create(&tmp).map_err(|e| format!("创建临时文件失败：{e}"))?;
    if let Err(e) = f.write_all(bytes) {
        let _ = std::fs::remove_file(&tmp);
        return Err(format!("写入临时文件失败：{e}"));
    }
    if let Err(e) = f.sync_all() {
        let _ = std::fs::remove_file(&tmp);
        return Err(format!("临时文件落盘失败：{e}"));
    }
    Ok(tmp)
}

/// 单文件替换 = 提交点。
/// Windows 上 `std::fs::rename` 走 `MoveFileExW(MOVEFILE_REPLACE_EXISTING)`，
/// 同卷内是一次目录项替换：读者要么看到整份旧文件、要么看到整份新文件。
/// **注意边界**：这是"一个文件"的原子替换，不是"多文件事务"。
/// 版本目录在替换之前已经整份就位，所以本流程里没有需要跨文件原子性的步骤；
/// 反过来说，任何"写三个文件再指望它们一起生效"的做法都不成立。
/// 失败时**不删任何旧文件**，只清掉自己的临时文件。
fn replace_file(tmp: &Path, dst: &Path) -> Result<(), String> {
    std::fs::rename(tmp, dst).map_err(|e| {
        let _ = std::fs::remove_file(tmp);
        let label = dst
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| dst.to_string_lossy().to_string());
        format!("替换 {label} 失败（旧文件保持原样，未做任何删除）：{e}")
    })
}

/// 提交 manifest 指针。整个保存流程里**唯一**改变"当前成品是谁"的地方。
fn commit_manifest(dir: &Path, m: &DocManifest, fault: FaultPoint) -> Result<(), String> {
    let json = serde_json::to_string_pretty(m).map_err(|e| format!("序列化 manifest 失败：{e}"))?;
    let tmp = write_tmp_file(dir, "manifest.json", json.as_bytes())?;
    if fault == FaultPoint::ManifestRenameFails {
        let _ = std::fs::remove_file(&tmp);
        return Err(injected("替换 manifest 失败"));
    }
    replace_file(&tmp, &manifest_path(dir))
}

fn injected(what: &str) -> String {
    format!("注入中断：{what}（测试用；已完成的部分留在 staging/ 供诊断，当前成品指针未改动）")
}

fn normalize_validation(v: Option<&str>) -> Result<String, String> {
    let s = v.unwrap_or("").trim();
    match s {
        "" => Ok(String::new()),
        VALIDATION_VERIFIED | VALIDATION_UNVERIFIED | VALIDATION_FAILED => Ok(s.to_string()),
        other => Err(format!("未知的验收状态：{other}（只接受 verified/unverified/failed 或留空）")),
    }
}

// ---------- 版本写入 / 校验 / 读取 ----------

/// 把一个版本的三件文件写进 `rdir`（staging 目录与正式版本目录布局完全相同）。
fn write_version_files(
    rdir: &Path,
    meta: &DocMeta,
    source: &str,
    html: &str,
    fault: FaultPoint,
) -> Result<(), String> {
    std::fs::create_dir_all(rdir).map_err(|e| format!("创建版本目录失败：{e}"))?;
    std::fs::write(rdir.join("source.md"), source).map_err(|e| format!("写入 source.md 失败：{e}"))?;
    if fault == FaultPoint::AfterStagingSource {
        return Err(injected("写 source.md 后中断"));
    }
    std::fs::write(rdir.join("article.html"), html).map_err(|e| format!("写入 article.html 失败：{e}"))?;
    if fault == FaultPoint::AfterStagingHtml {
        return Err(injected("写 article.html 后中断"));
    }
    let json = serde_json::to_string_pretty(meta).map_err(|e| format!("序列化版本 meta 失败：{e}"))?;
    std::fs::write(rdir.join("meta.json"), json).map_err(|e| format!("写入 meta.json 失败：{e}"))?;
    if fault == FaultPoint::AfterStagingMeta {
        return Err(injected("写 meta.json 后中断"));
    }
    Ok(())
}

/// 提交前校验（§7.2 第 1 条）：必要文件齐备、哈希一致、绑定可序列化、质量记录与验收声明一致。
/// **读回磁盘上的产物**再比对，而不是拿内存里的副本自证——要拦的正是"写下去的东西和以为的不一样"。
fn validate_version(rdir: &Path, meta: &DocMeta) -> Result<(), String> {
    for name in ["source.md", "article.html", "meta.json"] {
        if !rdir.join(name).is_file() {
            return Err(format!("提交校验失败：版本缺少 {name}"));
        }
    }
    let source = std::fs::read_to_string(rdir.join("source.md"))
        .map_err(|e| format!("提交校验失败：读回 source.md 失败：{e}"))?;
    let html = std::fs::read_to_string(rdir.join("article.html"))
        .map_err(|e| format!("提交校验失败：读回 article.html 失败：{e}"))?;
    if meta.hashes.source != content_hash(&source) {
        return Err("提交校验失败：source.md 与写入内容哈希不一致".to_string());
    }
    if meta.hashes.html != content_hash(&html) {
        return Err("提交校验失败：article.html 与写入内容哈希不一致".to_string());
    }
    // 绑定要能原样序列化回去：落成"不可变版本"之后就不该再发现结构本身有问题
    serde_json::to_string(&meta.bindings).map_err(|e| format!("提交校验失败：素材绑定无法序列化：{e}"))?;
    // 声称"已验收"却没有质量记录 = 没有证据的验收声明，不允许提交
    if meta.validation == VALIDATION_VERIFIED && meta.quality.is_none() {
        return Err("提交校验失败：声明 verified 必须同时给出质量记录（quality）".to_string());
    }
    Ok(())
}

fn read_revision_meta(dir: &Path, rev_id: &str) -> Result<DocMeta, String> {
    let rdir = revision_dir(dir, rev_id)?;
    read_meta(&rdir)?.ok_or_else(|| format!("版本 {rev_id} 缺少 meta.json"))
}

/// 读一个已安装的版本（§7.2 第 6 条：只读已提交的完整版本）。
/// 哈希不一致 → 报错，而不是把"被外部改过的文件"当成我们提交的那一版交付出去。
fn read_revision(dir: &Path, id: &str, rev_id: &str, m: &DocManifest) -> Result<DocContent, String> {
    let rdir = revision_dir(dir, rev_id)?;
    if !rdir.exists() {
        return Err(format!("版本 {rev_id} 不存在"));
    }
    let meta = read_revision_meta(dir, rev_id)?;
    let source = read_file(&rdir.join("source.md"))?;
    let html = read_file(&rdir.join("article.html"))?;
    if !meta.hashes.source.is_empty() && meta.hashes.source != content_hash(&source) {
        return Err(format!("版本 {rev_id} 的 source.md 与提交时的哈希不一致（文件被外部改动）"));
    }
    if !meta.hashes.html.is_empty() && meta.hashes.html != content_hash(&html) {
        return Err(format!("版本 {rev_id} 的 article.html 与提交时的哈希不一致（文件被外部改动）"));
    }
    Ok(content_from(id, &meta, &source, &html, m, rev_id))
}

fn content_from(id: &str, meta: &DocMeta, source: &str, html: &str, m: &DocManifest, rev_id: &str) -> DocContent {
    DocContent {
        id: id.to_string(),
        title: meta.title.clone(),
        updated_at: meta.updated_at.clone(),
        source: source.to_string(),
        html: html.to_string(),
        warnings: meta.warnings.clone(),
        snapshots: meta.snapshots.clone(),
        bindings: meta.bindings.clone(),
        revision_id: Some(rev_id.to_string()),
        accepted_revision_id: m.accepted_revision_id.clone(),
        draft_revision_id: m.draft_revision_id.clone(),
        generation: m.generation,
        validation: meta.validation.clone(),
        quality: meta.quality.clone(),
        run_id: meta.run_id.clone(),
    }
}

// ---------- 旧文档迁移（§7.3） ----------

/// 迁移模式：读路径遇到"指针丢了但历史版本还在"必须报错（不猜哪一版是成品）；
/// 写路径则放行——用户正要落一份新提交，旧孤立版本原样保留即可，拦死只会让文稿彻底写不进去。
#[derive(Clone, Copy, PartialEq, Eq)]
enum MigrationMode {
    Read,
    Write,
}

/// 旧布局 → revisions/legacy 版本 + manifest 指针。
///
/// 口径（§7.3）：
/// - 原 meta.json/source.md/article.html **保留不删**：迁移失败时原文档仍可恢复，用户也还能直接看到原件；
/// - 旧版本没有验收记录 → 一律标 `unverified`，**不能因为有图片就当成合格回滚目标**；
/// - 读取失败（meta 损坏 / 文件读不出来）**明确报错**，绝不返回"没有旧稿"让上层接着覆盖；
/// - 幂等：已经有 manifest 就不再迁移。
fn migrate_legacy_doc(base: &Path, id: &str, mode: MigrationMode) -> Result<bool, String> {
    let dir = doc_dir_at(base, id)?;
    if !dir.exists() {
        return Ok(false);
    }
    if manifest_path(&dir).exists() {
        return Ok(false); // 已经有指针：迁移过，或本来就是新布局
    }
    let rd = revisions_dir(&dir);
    let mut existing: Vec<String> = Vec::new();
    if rd.exists() {
        for e in std::fs::read_dir(&rd).map_err(|e| format!("读取版本目录失败：{e}"))? {
            let e = e.map_err(|e| format!("目录项错误：{e}"))?;
            if e.path().is_dir() {
                existing.push(e.file_name().to_string_lossy().to_string());
            }
        }
        existing.sort();
    }
    // 只有 legacy 一版却没有 manifest：只可能是"迁移写好了版本、提交指针前中断"，
    // 或者之后指针文件丢了。legacy 是我们写死的固定 id，重新指向它不会张冠李戴，
    // 所以这是唯一可以自动补指针的情形（版本本身没动，不涉及覆盖）。
    if existing.len() == 1 && existing[0] == LEGACY_REVISION_ID {
        return commit_manifest(&dir, &legacy_manifest(), FaultPoint::None).map(|_| true);
    }
    // 有历史版本却没有指针：**无法判定**哪一版是当前成品。
    // 读取路径如实报错（不自动把某一版提升为成品，§7.2 第 6 条；也不拿顶层旧文件冒充成品）。
    if !existing.is_empty() {
        if mode == MigrationMode::Read {
            return Err(format!(
                "manifest.json 缺失但已存在 {} 个历史版本，无法判定当前成品（原文件全部保留，未做任何覆盖）",
                existing.len()
            ));
        }
        return Ok(false);
    }
    // 到这里：没有 manifest、没有历史版本。只有存在旧 meta.json 才算旧文稿，否则确实不是文稿。
    let Some(meta) = read_meta(&dir)? else {
        return Ok(false);
    };
    let source = read_file(&dir.join("source.md"))?;
    let html = read_file(&dir.join("article.html"))?;
    let mut rmeta = meta;
    rmeta.hashes = RevisionHashes { source: content_hash(&source), html: content_hash(&html) };
    rmeta.validation = VALIDATION_UNVERIFIED.to_string();
    rmeta.origin = LEGACY_REVISION_ID.to_string();

    let stg = staging_dir(&dir).join(format!("t{}", now_ts()));
    write_version_files(&stg, &rmeta, &source, &html, FaultPoint::None)?;
    validate_version(&stg, &rmeta)?;
    let rdir = rd.join(LEGACY_REVISION_ID);
    if rdir.exists() {
        return Err("legacy 版本目录已存在（不可变版本不允许覆盖）".to_string());
    }
    std::fs::create_dir_all(&rd).map_err(|e| format!("创建版本目录失败：{e}"))?;
    std::fs::rename(&stg, &rdir).map_err(|e| format!("安装 legacy 版本失败（原文档未被改动）：{e}"))?;
    commit_manifest(&dir, &legacy_manifest(), FaultPoint::None)?;
    Ok(true)
}

fn legacy_manifest() -> DocManifest {
    DocManifest {
        schema_version: SCHEMA_VERSION,
        accepted_revision_id: Some(LEGACY_REVISION_ID.to_string()),
        draft_revision_id: None,
        generation: 1,
    }
}

// ---------- 核心操作（base 可注入，便于测试） ----------

fn list_at(base: &Path) -> Result<DocList, String> {
    let root = documents_dir_at(base);
    let mut items = Vec::new();
    let mut unreadable: Vec<crate::sessions::UnreadableItem> = Vec::new();
    if !root.exists() {
        return Ok(DocList { items, unreadable });
    }
    for entry in std::fs::read_dir(&root).map_err(|e| format!("读取文档目录失败：{e}"))? {
        let entry = entry.map_err(|e| format!("目录项错误：{e}"))?;
        if !entry.path().is_dir() {
            continue;
        }
        let id = entry.file_name().to_string_lossy().to_string();
        // 旧布局先迁移。迁移失败 = 这篇文稿读不出来，如实上报（不能折叠成"没有这篇"）
        if let Err(e) = migrate_legacy_doc(base, &id, MigrationMode::Read) {
            unreadable.push(crate::sessions::UnreadableItem { id, error: e });
            continue;
        }
        let manifest = match read_manifest(&entry.path()) {
            Ok(Some(m)) => m,
            Ok(None) => continue, // 没有指针也不是旧文稿：目录刚建、还没落盘（正常态）
            Err(e) => {
                unreadable.push(crate::sessions::UnreadableItem { id, error: e });
                continue;
            }
        };
        // 还没有成品版本（例如只提交过草稿）→ 无可展示的正文，跳过
        let Some(acc) = manifest.accepted_revision_id.clone() else {
            continue;
        };
        match read_revision(&entry.path(), &id, &acc, &manifest) {
            Ok(c) => {
                // 能读出来但确实为空 → 正常态（还没生成产物的会话），不算文档也不算坏
                if c.html.trim().is_empty() {
                    continue;
                }
                items.push(DocListEntry {
                    id,
                    title: c.title,
                    updated_at: c.updated_at,
                    validation: c.validation,
                    has_draft: manifest.draft_revision_id.is_some(),
                });
            }
            Err(e) => unreadable.push(crate::sessions::UnreadableItem { id, error: e }),
        }
    }
    items.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(DocList { items, unreadable })
}

/// 打开当前**成品**版本（accepted）。草稿另见 `draft_revision_id` 与 list_document_revisions。
fn open_at(base: &Path, id: &str) -> Result<Option<DocContent>, String> {
    let dir = doc_dir_at(base, id)?;
    if !dir.exists() {
        return Ok(None);
    }
    migrate_legacy_doc(base, id, MigrationMode::Read)?;
    let manifest = match read_manifest(&dir)? {
        Some(m) => m,
        None => return Ok(None),
    };
    let Some(acc) = manifest.accepted_revision_id.clone() else {
        return Ok(None);
    };
    Ok(Some(read_revision(&dir, id, &acc, &manifest)?))
}

fn open_revision_at(base: &Path, id: &str, rev_id: &str) -> Result<Option<DocContent>, String> {
    let dir = doc_dir_at(base, id)?;
    if !dir.exists() {
        return Ok(None);
    }
    migrate_legacy_doc(base, id, MigrationMode::Read)?;
    let manifest = read_manifest(&dir)?.unwrap_or_default();
    let rdir = revision_dir(&dir, rev_id)?;
    if !rdir.exists() {
        return Ok(None);
    }
    Ok(Some(read_revision(&dir, id, rev_id, &manifest)?))
}

/// 测试专用便捷入口：默认选项的保存（生产路径走 save_with_at，由命令层带上 CAS/质量/草稿选项）。
#[cfg(test)]
fn save_at(
    base: &Path,
    id: &str,
    title: &str,
    source: &str,
    html: &str,
    warnings: &[String],
    snapshots: &HashMap<String, AssetSnap>,
    bindings: &[AssetBinding],
) -> Result<DocContent, String> {
    save_with_at(base, id, title, source, html, warnings, snapshots, bindings, &SaveOpts::default())
}

/// 保存一份新版本（§7.2 提交协议）：
/// 写 staging → 校验 → 安装为不可变版本 → **一次 rename** 提交指针。
/// 任何一步失败都不动旧指针，也绝不先删旧文件。
#[allow(clippy::too_many_arguments)]
fn save_with_at(
    base: &Path,
    id: &str,
    title: &str,
    source: &str,
    html: &str,
    warnings: &[String],
    snapshots: &HashMap<String, AssetSnap>,
    bindings: &[AssetBinding],
    opts: &SaveOpts,
) -> Result<DocContent, String> {
    let dir = doc_dir_at(base, id)?;
    // 旧布局先迁移；迁移失败**必须**报错——绝不能当成"没有旧稿"继续往下覆盖（§7.3）
    migrate_legacy_doc(base, id, MigrationMode::Write)?;
    let manifest = read_manifest(&dir)?.unwrap_or_default();

    // ---- 提交前检查 generation / baseRevisionId：迟到的旧请求不能覆盖用户较新的提交 ----
    // 不匹配就**什么都不写**直接返回（连 staging 都不建），调用方据此重新取最新成品。
    if let Some(exp) = opts.expected_generation {
        if exp != manifest.generation {
            return Err(format!(
                "提交被拒绝：文档已更新（期望 generation={exp}，当前 {}），本次未写入任何内容",
                manifest.generation
            ));
        }
    }
    if let Some(b) = opts.base_revision_id.as_deref() {
        let cur = manifest.accepted_revision_id.as_deref();
        if Some(b) != cur {
            return Err(format!(
                "提交被拒绝：基准版本不匹配（期望 {}，当前 {}），本次未写入任何内容",
                b,
                cur.unwrap_or("无")
            ));
        }
    }

    let validation = normalize_validation(opts.validation.as_deref())?;
    // 旧标题/创建时间从上一版继承（成品优先，其次草稿）
    let prev = manifest
        .accepted_revision_id
        .as_deref()
        .or(manifest.draft_revision_id.as_deref())
        .and_then(|r| read_revision_meta(&dir, r).ok());
    let now = now_ts();
    let meta = DocMeta {
        id: id.to_string(),
        title: if title.trim().is_empty() {
            prev.as_ref().map(|m| m.title.clone()).unwrap_or_default()
        } else {
            title.to_string()
        },
        created_at: prev
            .as_ref()
            .map(|m| m.created_at.clone())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| now.clone()),
        updated_at: now.clone(),
        warnings: warnings.to_vec(),
        snapshots: snapshots.clone(),
        bindings: bindings.to_vec(),
        run_id: opts.run_id.clone(),
        validation_version: opts.validation_version.clone(),
        quality: opts.quality.clone(),
        validation,
        origin: if opts.as_draft { "draft".to_string() } else { "commit".to_string() },
        hashes: RevisionHashes { source: content_hash(source), html: content_hash(html) },
    };

    let rev_id = format!("r{now}");
    let txn_id = format!("t{now}");
    // ① 先写进 staging/<transactionId>/ —— 读者路径**不扫描** staging，
    //    所以这份候选在指针提交之前不可能被当成当前成品。
    let stg = staging_dir(&dir).join(&txn_id);
    write_version_files(&stg, &meta, source, html, opts.fault)?;
    // ② 校验（读回磁盘产物比对）
    validate_version(&stg, &meta)?;
    if opts.fault == FaultPoint::BeforeInstall {
        return Err(injected("安装版本前中断"));
    }
    // ③ 安装为不可变版本：staging 目录**整体改名**进 revisions/。
    //    目录改名是同卷内的一次目录项操作，候选要么整份出现，要么原地不动，
    //    不存在"一半文件进了版本目录"的中间态。
    let rdir = revisions_dir(&dir).join(&rev_id);
    if rdir.exists() {
        return Err(format!("版本 {rev_id} 已存在（不可变版本不允许覆盖）"));
    }
    std::fs::create_dir_all(revisions_dir(&dir)).map_err(|e| format!("创建版本目录失败：{e}"))?;
    std::fs::rename(&stg, &rdir)
        .map_err(|e| format!("安装版本失败（候选留在 staging 供诊断，成品未改动）：{e}"))?;
    if opts.fault == FaultPoint::BeforeManifestCommit {
        return Err(injected("提交 manifest 前中断"));
    }
    // ④ 唯一的提交点：一次同目录 rename 换掉 manifest 指针
    let mut next = manifest.clone();
    next.schema_version = SCHEMA_VERSION;
    next.generation = manifest.generation + 1;
    if opts.as_draft {
        // 草稿提交：只动草稿指针，成品指针一动不动（失败候选不许替换已验收成品）
        next.draft_revision_id = Some(rev_id.clone());
    } else {
        next.accepted_revision_id = Some(rev_id.clone());
        // 成品被新版本取代后旧草稿指针随之失效（版本目录本身保留，不删）
        next.draft_revision_id = None;
    }
    commit_manifest(&dir, &next, opts.fault)?;

    Ok(content_from(id, &meta, source, html, &next, &rev_id))
}

fn commit_revision_at(
    base: &Path,
    id: &str,
    rev_id: &str,
    base_revision_id: Option<&str>,
    expected_generation: Option<u64>,
) -> Result<DocContent, String> {
    let dir = doc_dir_at(base, id)?;
    migrate_legacy_doc(base, id, MigrationMode::Write)?;
    // manifest 丢失时允许提交：这正是"指针丢了，但历史版本还在"的恢复入口（§7.2 第 6 条）。
    let manifest = read_manifest(&dir)?.unwrap_or_default();
    if let Some(exp) = expected_generation {
        if exp != manifest.generation {
            return Err(format!(
                "提交被拒绝：文档已更新（期望 generation={exp}，当前 {}），本次未写入任何内容",
                manifest.generation
            ));
        }
    }
    if let Some(b) = base_revision_id {
        let cur = manifest.accepted_revision_id.as_deref();
        if Some(b) != cur {
            return Err(format!(
                "提交被拒绝：基准版本不匹配（期望 {}，当前 {}），本次未写入任何内容",
                b,
                cur.unwrap_or("无")
            ));
        }
    }
    let rdir = revision_dir(&dir, rev_id)?;
    if !rdir.exists() {
        return Err(format!("版本 {rev_id} 不存在，无法提交为成品"));
    }
    // 目标版本必须自证完整（三件齐 + 哈希一致）——回滚**只选完整版本**，不拼旧 HTML 和新元数据
    let content = read_revision(&dir, id, rev_id, &manifest)?;
    let mut next = manifest.clone();
    next.schema_version = SCHEMA_VERSION;
    next.generation = manifest.generation + 1;
    next.accepted_revision_id = Some(rev_id.to_string());
    if next.draft_revision_id.as_deref() == Some(rev_id) {
        next.draft_revision_id = None; // 草稿被提升为成品后，草稿指针不再指向它
    }
    commit_manifest(&dir, &next, FaultPoint::None)?;
    Ok(DocContent {
        accepted_revision_id: next.accepted_revision_id.clone(),
        draft_revision_id: next.draft_revision_id.clone(),
        generation: next.generation,
        ..content
    })
}

fn list_revisions_at(base: &Path, id: &str) -> Result<DocRevisionList, String> {
    let dir = doc_dir_at(base, id)?;
    migrate_legacy_doc(base, id, MigrationMode::Read)?;
    let manifest = read_manifest(&dir)?.unwrap_or_default();
    let mut revisions: Vec<RevisionInfo> = Vec::new();
    let rd = revisions_dir(&dir);
    if rd.exists() {
        for e in std::fs::read_dir(&rd).map_err(|e| format!("读取版本目录失败：{e}"))? {
            let e = e.map_err(|e| format!("目录项错误：{e}"))?;
            if !e.path().is_dir() {
                continue;
            }
            let rev_id = e.file_name().to_string_lossy().to_string();
            let meta = match read_revision_meta(&dir, &rev_id) {
                Ok(m) => m,
                Err(err) => {
                    revisions.push(RevisionInfo {
                        id: rev_id,
                        complete: false,
                        error: Some(err),
                        ..Default::default()
                    });
                    continue;
                }
            };
            // 完整性用与读者完全相同的那条校验（哈希），避免"列表说完整、打开却报错"
            let (complete, error) = match read_revision(&dir, id, &rev_id, &manifest) {
                Ok(_) => (true, None),
                Err(err) => (false, Some(err)),
            };
            revisions.push(RevisionInfo {
                id: rev_id.clone(),
                title: meta.title,
                updated_at: meta.updated_at,
                validation: meta.validation,
                origin: meta.origin,
                run_id: meta.run_id,
                quality: meta.quality,
                is_accepted: manifest.accepted_revision_id.as_deref() == Some(rev_id.as_str()),
                is_draft: manifest.draft_revision_id.as_deref() == Some(rev_id.as_str()),
                complete,
                error,
            });
        }
    }
    revisions.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    let mut staging: Vec<StagingInfo> = Vec::new();
    let sd = staging_dir(&dir);
    if sd.exists() {
        for e in std::fs::read_dir(&sd).map_err(|e| format!("读取 staging 目录失败：{e}"))? {
            let e = e.map_err(|e| format!("目录项错误：{e}"))?;
            if !e.path().is_dir() {
                continue;
            }
            let p = e.path();
            let has_source = p.join("source.md").is_file();
            let has_html = p.join("article.html").is_file();
            let has_meta = p.join("meta.json").is_file();
            staging.push(StagingInfo {
                transaction_id: e.file_name().to_string_lossy().to_string(),
                has_source,
                has_html,
                has_meta,
                recoverable: has_source && has_html && has_meta,
            });
        }
    }
    staging.sort_by(|a, b| b.transaction_id.cmp(&a.transaction_id));
    Ok(DocRevisionList {
        id: id.to_string(),
        schema_version: manifest.schema_version,
        generation: manifest.generation,
        accepted_revision_id: manifest.accepted_revision_id,
        draft_revision_id: manifest.draft_revision_id,
        revisions,
        staging,
    })
}

fn delete_at(base: &Path, id: &str) -> Result<(), String> {
    let dir = doc_dir_at(base, id)?;
    if dir.exists() {
        std::fs::remove_dir_all(&dir).map_err(|e| format!("删除文档失败：{e}"))?;
    }
    Ok(())
}

// ---------- Tauri 命令 ----------

#[tauri::command]
pub fn list_documents() -> Result<DocList, String> {
    let base = crate::sessions::workspace_dir()?;
    list_at(&base)
}

/// 打开文档的**当前成品版本**。
/// 附加返回 `revision_id/accepted_revision_id/draft_revision_id/generation/validation/quality/run_id`，
/// 旧字段（id/title/updated_at/source/html/warnings/snapshots/bindings）形状不变。
#[tauri::command]
pub fn open_document(id: String) -> Result<Option<DocContent>, String> {
    let base = crate::sessions::workspace_dir()?;
    open_at(&base, &id)
}

/// 保存一份新版本。
///
/// 参数（camelCase 由前端传入，Tauri 自动映射到 snake_case）：
/// - `quality`           可选，任意 JSON：前端交付质量结果，原样存进版本 meta，Rust 不解释
/// - `runId`             可选：产生这一版的 runId
/// - `validationVersion` 可选：检查实现版本标识
/// - `validation`        可选：""/"verified"/"unverified"/"failed"；`verified` 时必须带 quality，否则报错
/// - `baseRevisionId`    可选：提交前检查的基准成品版本；与当前不符 → 返回"提交被拒绝：…"且不写任何内容
/// - `expectedGeneration`可选：提交前检查的 generation；与当前不符 → 同上拒绝
/// - `asDraft`           可选：true = 只推进草稿指针，**不动已验收成品**（失败候选不得替换成品）
///
/// 失败语义：先删旧文件再提交这种顺序**不存在**——提交失败时旧指针与旧版本原封不动，返回中文错误。
#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub fn save_document(
    id: String,
    title: String,
    source: String,
    html: String,
    warnings: Vec<String>,
    snapshots: HashMap<String, AssetSnap>,
    bindings: Option<Vec<AssetBinding>>,
    quality: Option<serde_json::Value>,
    run_id: Option<String>,
    validation_version: Option<String>,
    validation: Option<String>,
    base_revision_id: Option<String>,
    expected_generation: Option<u64>,
    as_draft: Option<bool>,
) -> Result<DocContent, String> {
    let base = crate::sessions::workspace_dir()?;
    let opts = SaveOpts {
        quality,
        run_id,
        validation_version,
        validation,
        base_revision_id,
        expected_generation,
        as_draft: as_draft.unwrap_or(false),
        fault: FaultPoint::None,
    };
    save_with_at(
        &base,
        &id,
        &title,
        &source,
        &html,
        &warnings,
        &snapshots,
        &bindings.unwrap_or_default(),
        &opts,
    )
}

/// 列出该文档的全部不可变版本与未提交候选（staging）。
/// 返回：`{ id, schema_version, generation, accepted_revision_id, draft_revision_id, revisions[], staging[] }`
/// 每条 revision：`{ id, title, updated_at, validation, origin, run_id, quality, is_accepted, is_draft, complete, error }`
/// `complete=false` 的版本**不能**当回滚目标（error 是中文原因）。
#[tauri::command]
pub fn list_document_revisions(id: String) -> Result<DocRevisionList, String> {
    let base = crate::sessions::workspace_dir()?;
    list_revisions_at(&base, &id)
}

/// 按 revisionId 打开任一已安装版本（回滚前的预览/诊断）。
/// 返回形状与 `open_document` 相同；版本不存在 → `Ok(None)`；版本被改坏 → `Err`。
#[tauri::command]
pub fn open_document_revision(id: String, revision_id: String) -> Result<Option<DocContent>, String> {
    let base = crate::sessions::workspace_dir()?;
    open_revision_at(&base, &id, &revision_id)
}

/// 把一个已安装版本提交为成品（回滚 = 选择完整版本，不做旧 HTML 拼新元数据）。
/// 返回提交后的 `DocContent`；`validation` 原样回传（unverified 的 legacy 版也能提交，
/// 但"是否算合格回滚"由调用方按 validation 判定——Rust 不制造"回滚成功"的结论）。
#[tauri::command]
pub fn commit_document_revision(
    id: String,
    revision_id: String,
    base_revision_id: Option<String>,
    expected_generation: Option<u64>,
) -> Result<DocContent, String> {
    let base = crate::sessions::workspace_dir()?;
    commit_revision_at(&base, &id, &revision_id, base_revision_id.as_deref(), expected_generation)
}

#[tauri::command]
pub fn delete_document(id: String) -> Result<(), String> {
    let base = crate::sessions::workspace_dir()?;
    delete_at(&base, &id)
}

// ---------- 测试 ----------

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp_base(tag: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("wxmp-doc-{tag}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(&d).unwrap();
        d
    }

    fn opts() -> SaveOpts {
        SaveOpts::default()
    }

    fn read_manifest_raw(base: &Path, id: &str) -> Option<String> {
        std::fs::read_to_string(manifest_path(&doc_dir_at(base, id).unwrap())).ok()
    }

    fn revision_ids(base: &Path, id: &str) -> Vec<String> {
        let rd = revisions_dir(&doc_dir_at(base, id).unwrap());
        let mut v: Vec<String> = std::fs::read_dir(rd)
            .map(|it| {
                it.filter_map(|e| e.ok())
                    .filter(|e| e.path().is_dir())
                    .map(|e| e.file_name().to_string_lossy().to_string())
                    .collect()
            })
            .unwrap_or_default();
        v.sort();
        v
    }

    /// 写一份"旧布局"文档（meta.json/source.md/article.html 平铺）
    fn write_legacy_doc(base: &Path, id: &str, meta_json: &str, source: &str, html: &str) -> PathBuf {
        let dir = doc_dir_at(base, id).unwrap();
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("meta.json"), meta_json).unwrap();
        std::fs::write(dir.join("source.md"), source).unwrap();
        std::fs::write(dir.join("article.html"), html).unwrap();
        dir
    }

    fn legacy_meta_json(id: &str, title: &str) -> String {
        format!(
            r#"{{"id":"{id}","title":"{title}","created_at":"1","updated_at":"2","warnings":[],"snapshots":{{}},"bindings":[]}}"#
        )
    }

    #[test]
    fn save_list_open_roundtrip() {
        let base = tmp_base("roundtrip");
        let id = "s123".to_string();
        let mut snaps = HashMap::new();
        snaps.insert("as-1".to_string(), AssetSnap { svg: "<svg/>".into(), ver: 1 });
        let binds = vec![AssetBinding {
            slot: "[[deco:blossom|花簇角饰]]".into(),
            slot_id: "r1-s1".into(),
            id: "as-1".into(),
            source: "new".into(),
            reason: "新建：库无强命中".into(),
        }];
        let c = save_at(&base, &id, "开学典礼", "说明\n```v2\n正文\n```", "<section>html</section>", &["警告一".to_string()], &snaps, &binds).expect("save");
        assert_eq!(c.title, "开学典礼");
        assert!(c.html.contains("<section>"));
        // §7：保存返回的就是一份带 id 的版本，指针已指向它
        let rev = c.revision_id.clone().expect("保存必须产生版本 id");
        assert_eq!(c.accepted_revision_id.as_deref(), Some(rev.as_str()));
        assert_eq!(c.generation, 1, "首次提交 generation 从 1 起");
        let list = list_at(&base).expect("list");
        assert_eq!(list.items.len(), 1);
        assert_eq!(list.items[0].title, "开学典礼");
        assert!(list.unreadable.is_empty());
        let opened = open_at(&base, &id).expect("open").expect("some");
        assert_eq!(opened.source, "说明\n```v2\n正文\n```");
        assert_eq!(opened.warnings.len(), 1);
        assert_eq!(opened.snapshots.get("as-1").unwrap().ver, 1);
        assert_eq!(opened.revision_id.as_deref(), Some(rev.as_str()));
        // P0 §7：素材位绑定要能随文档持久化并读回（否则素材身份只能靠自然语言描述恢复）
        assert_eq!(opened.bindings.len(), 1);
        assert_eq!(opened.bindings[0].id, "as-1");
        assert_eq!(opened.bindings[0].source, "new");
        // 阶段 3：素材位 id 要一起持久化（"未完成素材"的单项重试靠它定位）
        assert_eq!(opened.bindings[0].slot_id, "r1-s1");
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn legacy_binding_without_slot_id_still_opens() {
        // 旧文档的 bindings 没有 slotId（阶段 3 新增）——必须退化为空串而不是打不开
        let base = tmp_base("legacy-slotid");
        write_legacy_doc(
            &base,
            "s8",
            r#"{"id":"s8","title":"旧绑定","created_at":"1","updated_at":"2","warnings":[],"snapshots":{},
                "bindings":[{"slot":"[[deco:a|说明]]","id":"as-9","source":"reuse","reason":"命中"}]}"#,
            "old",
            "<section>old</section>",
        );
        let opened = open_at(&base, "s8").expect("open").expect("some");
        assert_eq!(opened.bindings.len(), 1);
        assert_eq!(opened.bindings[0].id, "as-9");
        assert_eq!(opened.bindings[0].slot_id, "", "缺 slotId 应退化为空串");
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn legacy_meta_without_bindings_still_opens() {
        // 旧版 meta.json 没有 bindings 字段（P0 新增）——必须能读出来，否则老文档打不开
        let base = tmp_base("legacy");
        write_legacy_doc(
            &base,
            "s9",
            r#"{"id":"s9","title":"旧文档","created_at":"1","updated_at":"2","warnings":[],"snapshots":{}}"#,
            "old",
            "<section>old</section>",
        );
        let opened = open_at(&base, "s9").expect("open").expect("some");
        assert_eq!(opened.title, "旧文档");
        assert!(opened.bindings.is_empty(), "缺字段应退化为空表而非报错");
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn in_place_update_keeps_single_version() {
        // 旧口径："就地刷新不留第二版"。新口径（§7）：磁盘上**保留历史版本**（首批不自动清理），
        // 但**文档列表**仍然一份文档只出一条——历史版本不改变"这是一篇稿子"。
        let base = tmp_base("update");
        let id = "s1".to_string();
        save_at(&base, &id, "旧标题", "v1", "<section>v1</section>", &[], &HashMap::new(), &[]).expect("save1");
        let created = open_at(&base, &id).unwrap().unwrap();
        let c2 = save_at(&base, &id, "", "v2", "<section>v2</section>", &[], &HashMap::new(), &[]).expect("save2");
        assert_eq!(c2.title, "旧标题", "空标题保留旧标题");
        assert_eq!(list_at(&base).unwrap().items.len(), 1, "列表仍只有一条");
        assert_eq!(revision_ids(&base, &id).len(), 2, "两次提交 = 两个不可变版本");
        assert_eq!(c2.generation, 2, "每次成功提交 generation +1");
        assert!(c2.updated_at >= created.updated_at);
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn delete_removes_doc() {
        let base = tmp_base("del");
        save_at(&base, "s1", "a", "v", "<section>x</section>", &[], &HashMap::new(), &[]).expect("save");
        delete_at(&base, "s1").expect("del");
        assert!(list_at(&base).unwrap().items.is_empty());
        assert!(open_at(&base, "s1").unwrap().is_none());
        // 重复删除幂等
        delete_at(&base, "s1").expect("del again");
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn empty_html_is_not_listed_but_dirs_remain() {
        let base = tmp_base("empty");
        // 写入 meta + 空 article → 不应作为文档列出（无产物的会话）
        let dir = doc_dir_at(&base, "s-empty").expect("dir");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("meta.json"), serde_json::to_string(&DocMeta { id: "s-empty".into(), title: "新对话".into(), ..Default::default() }).unwrap()).unwrap();
        std::fs::write(dir.join("source.md"), "").unwrap();
        std::fs::write(dir.join("article.html"), "").unwrap();
        let list = list_at(&base).expect("list");
        assert!(list.items.is_empty());
        assert!(list.unreadable.is_empty(), "空产物是正常态，不是'坏掉'");
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn invalid_id_rejected() {
        assert!(doc_dir_at(Path::new("x"), "../evil").is_err());
        assert!(doc_dir_at(Path::new("x"), "a/b").is_err());
        assert!(doc_dir_at(Path::new("x"), "s-ok_1").is_ok());
        // 版本 id 同样要挡住路径穿越（它会拼进 revisions/ 下的目录名）
        assert!(revision_dir(Path::new("x"), "../evil").is_err());
        assert!(revision_dir(Path::new("x"), "r-ok_1").is_ok());
    }

    #[test]
    fn corrupt_meta_listed_as_unreadable_not_absent() {
        // R3：损坏的 meta 不能只是"不列出"——界面上"文稿坏了"与"文稿不存在"必须能区分
        let base = tmp_base("corrupt");
        write_legacy_doc(&base, "s-bad", "not json", "", "<section>x</section>");
        let list = list_at(&base).expect("list");
        assert!(list.items.is_empty(), "损坏 meta 不应作为正常项列入");
        assert_eq!(list.unreadable.len(), 1, "但必须如实上报");
        assert_eq!(list.unreadable[0].id, "s-bad");
        assert!(!list.unreadable[0].error.is_empty());
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn article_html_read_failure_is_reported_not_hidden() {
        // R3 的关键一条：article.html 读失败被旧实现 unwrap_or_default() 伪装成"没有产物"，
        // 一篇正文完好的文稿因此消失。把它做成目录制造非 NotFound 的 IO 错误。
        let base = tmp_base("html-io");
        let dir = write_legacy_doc(&base, "s-io", &legacy_meta_json("s-io", "正文完好"), "正文真源", "");
        std::fs::remove_file(dir.join("article.html")).unwrap();
        std::fs::create_dir_all(dir.join("article.html")).unwrap(); // 文件位被目录占了 → 读取 IO 错误
        let list = list_at(&base).expect("list");
        assert!(list.items.is_empty());
        assert_eq!(list.unreadable.len(), 1);
        assert_eq!(list.unreadable[0].id, "s-io");
        assert!(list.unreadable[0].error.contains("article"), "原因应指向出错的文件：{}", list.unreadable[0].error);
        let _ = std::fs::remove_dir_all(&base);
    }

    // ---------- §7 / §10 故障注入与提交协议 ----------

    #[test]
    fn fault_mid_commit_never_mixes_source_and_html() {
        // §10：meta/source/html/manifest 任一步失败 → **当前已提交版本可读**，
        // 且**不存在"新源文配旧 HTML"的混合版本**。
        // 逐个故障点验：每一次失败后，读回来的 source 和 html 必须同属 v1。
        let faults = [
            FaultPoint::AfterStagingSource,
            FaultPoint::AfterStagingHtml,
            FaultPoint::AfterStagingMeta,
            FaultPoint::BeforeInstall,
            FaultPoint::BeforeManifestCommit,
            FaultPoint::ManifestRenameFails,
        ];
        for (i, f) in faults.iter().enumerate() {
            let base = tmp_base(&format!("fault{i}"));
            let id = "s1";
            let v1 = save_at(&base, id, "标题v1", "源文v1", "<section>html-v1</section>", &[], &HashMap::new(), &[]).unwrap();
            let manifest_before = read_manifest_raw(&base, id).expect("v1 提交后应有 manifest");

            let err = save_with_at(
                &base, id, "标题v2", "源文v2", "<section>html-v2</section>", &[], &HashMap::new(), &[],
                &SaveOpts { fault: *f, ..opts() },
            )
            .expect_err(&format!("故障点 {f:?} 必须失败"));
            assert!(err.contains("失败") || err.contains("中断"), "错误要说清原因：{err}");

            // 当前已提交版本仍可读，且源文/HTML 同属 v1（没有半新半旧）
            let opened = open_at(&base, id).expect("open").expect("some");
            assert_eq!(opened.source, "源文v1", "故障点 {f:?} 后源文必须还是已提交那一版");
            assert_eq!(opened.html, "<section>html-v1</section>", "故障点 {f:?} 后 HTML 必须还是已提交那一版");
            assert_eq!(opened.revision_id.as_deref(), v1.revision_id.as_deref());
            assert_eq!(opened.generation, 1, "失败的提交不得推进 generation");

            // 指针文件逐字节未变（ManifestRenameFails 会留下临时文件，但 manifest 本体不受影响）
            assert_eq!(read_manifest_raw(&base, id).as_deref(), Some(manifest_before.as_str()));

            let list = list_at(&base).expect("list");
            assert_eq!(list.items.len(), 1);
            assert!(list.unreadable.is_empty(), "故障后文档仍应是可读的正常项：{:?}", list.unreadable.iter().map(|u| &u.error).collect::<Vec<_>>());
            assert_eq!(list.items[0].title, "标题v1");

            // 故障之后照常能提交新版本（不需要人工清理）
            let v3 = save_at(&base, id, "标题v3", "源文v3", "<section>html-v3</section>", &[], &HashMap::new(), &[]).unwrap();
            assert_eq!(v3.generation, 2);
            let reopened = open_at(&base, id).unwrap().unwrap();
            assert_eq!(reopened.source, "源文v3");
            assert_eq!(reopened.html, "<section>html-v3</section>");
            let _ = std::fs::remove_dir_all(&base);
        }
    }

    #[test]
    fn uncommitted_staging_never_becomes_product() {
        // §10：进程中断后重开 → 从最后一次完整提交恢复，**未提交候选不成为成品**；
        // 孤立 staging 保留供恢复/诊断（§7.2 第 6 条），不自动提升、不自动清理。
        let base = tmp_base("staging");
        let id = "s1";
        save_at(&base, id, "成品v1", "源文v1", "<section>html-v1</section>", &[], &HashMap::new(), &[]).unwrap();
        let err = save_with_at(
            &base, id, "候选v2", "源文v2", "<section>html-v2</section>", &[], &HashMap::new(), &[],
            &SaveOpts { fault: FaultPoint::AfterStagingMeta, ..opts() },
        )
        .expect_err("必须失败");
        assert!(err.contains("staging"), "错误应指出候选留在 staging：{err}");

        // 候选确实在 staging 里（三件齐备），且**没有**进入 revisions/
        let sd = staging_dir(&doc_dir_at(&base, id).unwrap());
        let txn: Vec<_> = std::fs::read_dir(&sd).unwrap().filter_map(|e| e.ok()).collect();
        assert_eq!(txn.len(), 1, "候选应留在 staging 供诊断");
        assert!(txn[0].path().join("source.md").is_file());
        assert_eq!(revision_ids(&base, id).len(), 1, "只有 v1 是已安装版本");

        // "重开"：读路径不会看 staging，仍从最后一次完整提交恢复
        let opened = open_at(&base, id).unwrap().unwrap();
        assert_eq!(opened.source, "源文v1");
        assert_eq!(opened.html, "<section>html-v1</section>");
        let revlist = list_revisions_at(&base, id).unwrap();
        assert_eq!(revlist.revisions.len(), 1);
        assert_eq!(revlist.staging.len(), 1, "孤立候选要能在版本一览里被看到（供恢复/诊断）");
        assert!(revlist.staging[0].recoverable);
        assert!(revlist.revisions.iter().all(|r| !r.is_accepted || r.id == opened.revision_id.clone().unwrap()));
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn commit_rejects_stale_generation_or_base_revision() {
        // §10：generation/baseRevisionId 不匹配 → 拒绝覆盖（且不改任何东西）
        let base = tmp_base("cas");
        let id = "s1";
        let v1 = save_at(&base, id, "v1", "源文v1", "<section>h1</section>", &[], &HashMap::new(), &[]).unwrap();
        let manifest_before = read_manifest_raw(&base, id).unwrap();

        // 迟到的旧请求：以为自己基于更早的版本
        let e1 = save_with_at(
            &base, id, "", "源文旧", "<section>h旧</section>", &[], &HashMap::new(), &[],
            &SaveOpts { base_revision_id: Some("r-不存在的版本".into()), ..opts() },
        )
        .expect_err("基准版本不匹配必须拒绝");
        assert!(e1.contains("提交被拒绝"), "错误要可判别：{e1}");

        // 迟到请求：以为自己看到的是第 0 代
        let e2 = save_with_at(
            &base, id, "", "源文旧", "<section>h旧</section>", &[], &HashMap::new(), &[],
            &SaveOpts { expected_generation: Some(0), ..opts() },
        )
        .expect_err("generation 不匹配必须拒绝");
        assert!(e2.contains("提交被拒绝"), "错误要可判别：{e2}");

        // 两次拒绝都没有留下任何痕迹：指针逐字节不变、没有新版本目录
        assert_eq!(read_manifest_raw(&base, id).as_deref(), Some(manifest_before.as_str()));
        assert_eq!(revision_ids(&base, id).len(), 1);
        let opened = open_at(&base, id).unwrap().unwrap();
        assert_eq!(opened.source, "源文v1");

        // 正确的 CAS 通过
        let v2 = save_with_at(
            &base, id, "", "源文v2", "<section>h2</section>", &[], &HashMap::new(), &[],
            &SaveOpts {
                base_revision_id: v1.revision_id.clone(),
                expected_generation: Some(1),
                ..opts()
            },
        )
        .expect("基准正确应当提交成功");
        assert_eq!(v2.generation, 2);
        assert_ne!(v2.revision_id, v1.revision_id);
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn manifest_replace_failure_keeps_old_pointer_valid() {
        // §10：提交失败旧指针有效——旧版本仍可读，且指针文件内容一字未动
        let base = tmp_base("ptrfail");
        let id = "s1";
        let v1 = save_at(&base, id, "v1", "源文v1", "<section>h1</section>", &[], &HashMap::new(), &[]).unwrap();
        let before = read_manifest_raw(&base, id).unwrap();
        save_with_at(
            &base, id, "v2", "源文v2", "<section>h2</section>", &[], &HashMap::new(), &[],
            &SaveOpts { fault: FaultPoint::ManifestRenameFails, ..opts() },
        )
        .expect_err("替换失败必须返回错误");
        assert_eq!(read_manifest_raw(&base, id).unwrap(), before, "旧指针必须原封不动");
        let opened = open_at(&base, id).unwrap().unwrap();
        assert_eq!(opened.revision_id, v1.revision_id);
        assert_eq!(opened.source, "源文v1");
        assert_eq!(opened.html, "<section>h1</section>");
        // 失败留下的临时文件只是垃圾，不影响任何读取
        assert!(list_at(&base).unwrap().items.len() == 1);
        let _ = std::fs::remove_dir_all(&base);
    }

    // ---------- §7.3 旧文档迁移 ----------

    #[test]
    fn legacy_migration_copies_to_unverified_revision_and_keeps_originals() {
        let base = tmp_base("migrate");
        let dir = write_legacy_doc(
            &base,
            "s-old",
            &legacy_meta_json("s-old", "旧稿标题"),
            "旧源文",
            "<section>旧 html</section>",
        );

        let opened = open_at(&base, "s-old").expect("open").expect("some");
        assert_eq!(opened.title, "旧稿标题");
        assert_eq!(opened.source, "旧源文");
        assert_eq!(opened.html, "<section>旧 html</section>");
        // §7.3：旧版本没有验收记录 → 默认标为"未验证"，不能当合格回滚目标
        assert_eq!(opened.validation, VALIDATION_UNVERIFIED);
        assert!(opened.quality.is_none(), "旧稿没有质量记录，不得凭空补一个");

        // 迁移成了一份不可变版本，且被指针指向
        assert_eq!(revision_ids(&base, "s-old"), vec!["legacy".to_string()]);
        assert_eq!(opened.revision_id.as_deref(), Some(LEGACY_REVISION_ID));
        let rmeta = read_revision_meta(&dir, LEGACY_REVISION_ID).unwrap();
        assert_eq!(rmeta.validation, VALIDATION_UNVERIFIED);
        assert_eq!(rmeta.origin, "legacy");
        assert_eq!(rmeta.hashes.source, content_hash("旧源文"), "版本要记下文件哈希");

        // 原三文件保留（迁移失败时原文档仍可恢复；用户也还能看到原件）
        assert_eq!(std::fs::read_to_string(dir.join("source.md")).unwrap(), "旧源文");
        assert_eq!(std::fs::read_to_string(dir.join("article.html")).unwrap(), "<section>旧 html</section>");
        assert!(dir.join("meta.json").is_file());
        // 迁移用的 staging 已被改名安装，不该残留
        assert!(!staging_dir(&dir).exists() || std::fs::read_dir(staging_dir(&dir)).unwrap().next().is_none());

        // 幂等：再打开一次不会产生第二个版本
        let again = open_at(&base, "s-old").unwrap().unwrap();
        assert_eq!(again.revision_id.as_deref(), Some(LEGACY_REVISION_ID));
        assert_eq!(revision_ids(&base, "s-old").len(), 1);
        assert_eq!(list_at(&base).unwrap().items.len(), 1);
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn legacy_read_failure_errors_and_does_not_overwrite() {
        // §7.3：读取失败明确报错，**不得按"没有旧稿"继续覆盖**；迁移失败时原文档仍可恢复
        let base = tmp_base("migfail");
        let dir = write_legacy_doc(&base, "s-bad", "{ 这不是 JSON", "用户的旧源文", "<section>旧 html</section>");

        open_at(&base, "s-bad").expect_err("损坏的旧 meta 必须报错，不能当作没有旧稿");
        let save_err = save_at(&base, "s-bad", "新标题", "新源文", "<section>新 html</section>", &[], &HashMap::new(), &[])
            .expect_err("旧稿读不出来时保存必须报错，不能覆盖");
        assert!(save_err.contains("meta"), "错误要指明坏在哪：{save_err}");

        // 原件一字未动，且没有留下任何半成品
        assert_eq!(std::fs::read_to_string(dir.join("meta.json")).unwrap(), "{ 这不是 JSON");
        assert_eq!(std::fs::read_to_string(dir.join("source.md")).unwrap(), "用户的旧源文");
        assert_eq!(std::fs::read_to_string(dir.join("article.html")).unwrap(), "<section>旧 html</section>");
        assert!(!manifest_path(&dir).exists(), "失败的保存不得留下指针");
        assert!(!revisions_dir(&dir).exists(), "失败的保存不得安装任何版本");
        // 列表如实上报，而不是让文稿凭空消失
        let list = list_at(&base).unwrap();
        assert!(list.items.is_empty());
        assert_eq!(list.unreadable.len(), 1);
        assert_eq!(list.unreadable[0].id, "s-bad");

        // 把原文档修好后（人工恢复）仍能正常读取并迁移
        std::fs::write(dir.join("meta.json"), legacy_meta_json("s-bad", "修好的旧稿")).unwrap();
        let opened = open_at(&base, "s-bad").unwrap().unwrap();
        assert_eq!(opened.title, "修好的旧稿");
        assert_eq!(opened.source, "用户的旧源文");
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn missing_manifest_with_history_reported_then_self_heals_on_save() {
        // 指针文件丢失（崩溃/外部删除）：读路径**不猜**哪一版是成品，如实报错；
        // 写路径放行（新提交自会带来新指针），旧版本原样保留（§7.2 第 6 条）。
        let base = tmp_base("nomanifest");
        let id = "s1";
        let v1 = save_at(&base, id, "v1", "源文v1", "<section>h1</section>", &[], &HashMap::new(), &[]).unwrap();
        let dir = doc_dir_at(&base, id).unwrap();
        std::fs::remove_file(manifest_path(&dir)).unwrap();

        let list = list_at(&base).unwrap();
        assert!(list.items.is_empty(), "指针丢失时不能随便挑一版当成品");
        assert_eq!(list.unreadable.len(), 1);
        assert!(list.unreadable[0].error.contains("manifest"), "原因要指明缺的是 manifest：{}", list.unreadable[0].error);
        open_at(&base, id).expect_err("读路径必须报错");
        assert!(revision_ids(&base, id).len() == 1, "旧版本仍在盘上");

        // 保存可以自愈：新提交写新指针，孤立版本不删
        let v2 = save_at(&base, id, "v2", "源文v2", "<section>h2</section>", &[], &HashMap::new(), &[]).unwrap();
        assert_eq!(v2.generation, 1, "指针丢失后 generation 从可确认的值重新起算");
        let opened = open_at(&base, id).unwrap().unwrap();
        assert_eq!(opened.source, "源文v2");
        let ids = revision_ids(&base, id);
        assert_eq!(ids.len(), 2, "历史版本不自动清理");
        assert!(ids.contains(&v1.revision_id.clone().unwrap()));
        assert!(list_at(&base).unwrap().unreadable.is_empty(), "自愈后不再上报坏文档");
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn revision_hash_mismatch_is_reported_not_delivered() {
        // 版本文件被外部改动：不能把它当成我们提交过的那一版交付出去
        let base = tmp_base("hash");
        let id = "s1";
        let v1 = save_at(&base, id, "v1", "源文v1", "<section>h1</section>", &[], &HashMap::new(), &[]).unwrap();
        let dir = doc_dir_at(&base, id).unwrap();
        std::fs::write(revisions_dir(&dir).join(v1.revision_id.clone().unwrap()).join("article.html"), "<section>被改过</section>").unwrap();

        let err = open_at(&base, id).expect_err("哈希不一致必须报错");
        assert!(err.contains("哈希"), "错误应说明是哈希不一致：{err}");
        let list = list_at(&base).unwrap();
        assert!(list.items.is_empty());
        assert_eq!(list.unreadable.len(), 1);
        assert!(list.unreadable[0].error.contains("哈希"), "列表要给出同样的原因");
        let _ = std::fs::remove_dir_all(&base);
    }

    // ---------- 质量记录 / 验收状态 / 草稿与回滚 ----------

    #[test]
    fn verified_commit_requires_quality_record() {
        // 声明"已验收"必须同时给出质量记录——没有证据的验收声明不允许落成不可变版本
        let base = tmp_base("quality");
        let id = "s1";
        let err = save_with_at(
            &base, id, "v1", "源文", "<section>h</section>", &[], &HashMap::new(), &[],
            &SaveOpts { validation: Some("verified".into()), ..opts() },
        )
        .expect_err("verified 但没有 quality 必须拒绝");
        assert!(err.contains("质量记录"), "错误要说明缺什么：{err}");
        assert!(!manifest_path(&doc_dir_at(&base, id).unwrap()).exists());
        assert!(revision_ids(&base, id).is_empty(), "被拒的提交不得留下版本");

        let q = serde_json::json!({ "ok": true, "issues": [], "validationVersion": "v1" });
        let c = save_with_at(
            &base, id, "v1", "源文", "<section>h</section>", &[], &HashMap::new(), &[],
            &SaveOpts {
                validation: Some("verified".into()),
                quality: Some(q.clone()),
                run_id: Some("run-7".into()),
                validation_version: Some("v1".into()),
                ..opts()
            },
        )
        .expect("带质量记录应当通过");
        assert_eq!(c.validation, "verified");
        let opened = open_at(&base, id).unwrap().unwrap();
        assert_eq!(opened.quality.as_ref(), Some(&q), "质量结果必须原样读回（Rust 只存不解释）");
        assert_eq!(opened.run_id.as_deref(), Some("run-7"));
        let meta = read_revision_meta(&doc_dir_at(&base, id).unwrap(), &c.revision_id.unwrap()).unwrap();
        assert_eq!(meta.validation_version.as_deref(), Some("v1"));

        // 乱填的验收状态要挡住（否则"合格回滚目标"的判断会被垃圾值污染）
        let bad = save_with_at(
            &base, id, "v2", "源文", "<section>h</section>", &[], &HashMap::new(), &[],
            &SaveOpts { validation: Some("大概通过".into()), ..opts() },
        )
        .expect_err("未知验收状态必须拒绝");
        assert!(bad.contains("未知的验收状态"));
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn draft_commit_keeps_accepted_and_can_be_promoted() {
        // §7.2：草稿与成品可以指向不同版本；失败候选不替换已验收成品
        let base = tmp_base("draft");
        let id = "s1";
        let q = serde_json::json!({ "ok": true, "issues": [{"code":"leak","severity":"blocking"}] });
        let v1 = save_with_at(
            &base, id, "成品v1", "源文v1", "<section>h1</section>", &[], &HashMap::new(), &[],
            &SaveOpts { validation: Some("verified".into()), quality: Some(q.clone()), ..opts() },
        )
        .unwrap();

        let d2 = save_with_at(
            &base, id, "候选v2", "源文v2", "<section>h2</section>", &[], &HashMap::new(), &[],
            &SaveOpts {
                as_draft: true,
                validation: Some("failed".into()),
                quality: Some(serde_json::json!({ "ok": false })),
                ..opts()
            },
        )
        .unwrap();
        assert_eq!(d2.accepted_revision_id, v1.revision_id, "成品指针不许被草稿推动");
        assert_eq!(d2.draft_revision_id, d2.revision_id);

        // 打开文档拿到的是**成品**，但能看到有一个更新的草稿
        let opened = open_at(&base, id).unwrap().unwrap();
        assert_eq!(opened.source, "源文v1");
        assert_eq!(opened.validation, "verified");
        assert_eq!(opened.draft_revision_id, d2.revision_id);
        let list = list_at(&base).unwrap();
        assert!(list.items[0].has_draft, "列表要能说明存在更新的草稿");
        assert_eq!(list.items[0].validation, "verified");

        // 用户手动把草稿提升为成品（回滚语义之一）：仍要过 CAS
        commit_revision_at(&base, id, &d2.revision_id.clone().unwrap(), Some("不存在的基准"), None)
            .expect_err("CAS 不匹配必须拒绝");
        let promoted = commit_revision_at(&base, id, &d2.revision_id.clone().unwrap(), v1.revision_id.as_deref(), Some(2)).unwrap();
        assert_eq!(promoted.accepted_revision_id, d2.revision_id);
        assert!(promoted.draft_revision_id.is_none(), "提升后草稿指针不再指向它");
        assert_eq!(promoted.validation, "failed", "验收状态如实回传，不制造'回滚成功'的结论");
        let opened2 = open_at(&base, id).unwrap().unwrap();
        assert_eq!(opened2.source, "源文v2");

        // 提交不存在的版本必须报错（不可能凭空造出一个回滚目标）
        commit_revision_at(&base, id, "r-nope", None, None).expect_err("缺版本必须报错");
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn revision_list_reports_completeness_and_orphan_staging() {
        let base = tmp_base("revlist");
        let id = "s1";
        let v1 = save_at(&base, id, "v1", "源文v1", "<section>h1</section>", &[], &HashMap::new(), &[]).unwrap();
        save_at(&base, id, "", "源文v2", "<section>h2</section>", &[], &HashMap::new(), &[]).unwrap();
        // 一次中断留下孤立候选
        let _ = save_with_at(
            &base, id, "v3", "源文v3", "<section>h3</section>", &[], &HashMap::new(), &[],
            &SaveOpts { fault: FaultPoint::AfterStagingHtml, ..opts() },
        );
        // 把一个版本的文件删掉，模拟"版本不完整"
        let broken = format!("r{}", now_ts());
        std::fs::create_dir_all(revisions_dir(&doc_dir_at(&base, id).unwrap()).join(&broken)).unwrap();

        let rl = list_revisions_at(&base, id).unwrap();
        assert_eq!(rl.generation, 2);
        assert_eq!(rl.schema_version, SCHEMA_VERSION);
        assert_eq!(rl.revisions.len(), 3, "两个正常版本 + 一个坏掉的版本目录");
        let ok: Vec<_> = rl.revisions.iter().filter(|r| r.complete).collect();
        assert_eq!(ok.len(), 2);
        assert_eq!(ok.iter().filter(|r| r.is_accepted).count(), 1);
        assert!(ok.iter().all(|r| r.id != broken));
        let bad = rl.revisions.iter().find(|r| r.id == broken).expect("坏版本也要列出来");
        assert!(!bad.complete);
        assert!(bad.error.as_deref().unwrap_or("").contains("meta"), "要给出中文原因：{:?}", bad.error);
        assert_eq!(rl.staging.len(), 1);
        assert!(!rl.staging[0].recoverable, "只写了一半的候选不完整");
        assert_eq!(rl.staging[0].has_source, true);
        assert_eq!(rl.staging[0].has_html, true);
        assert_eq!(rl.staging[0].has_meta, false);
        assert_eq!(open_revision_at(&base, id, &v1.revision_id.unwrap()).unwrap().unwrap().source, "源文v1");
        assert!(open_revision_at(&base, id, "r-nope").unwrap().is_none(), "不存在的版本返回 None");
        assert!(open_revision_at(&base, id, "../evil").is_err(), "版本 id 要挡路径穿越");
        let _ = std::fs::remove_dir_all(&base);
    }
}
