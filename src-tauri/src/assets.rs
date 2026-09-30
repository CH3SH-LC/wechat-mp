// assets.rs —— V3-R2 个人素材库：Documents/wechat-mp-workspace/assets/items/<assetId>/
// 每素材 = meta.json（语义元数据：category/name/title/desc/tags/usage/style/version/…）+ source.svg。
// 素材库为单机单用户私有资产；检索在 TS 侧做（list 后确定性打分），Rust 侧负责落盘、版本与影响扫描。
// 实现注：不另建 index.json——每素材单目录 meta 扫描即索引，量级小（≤数百）足够；与设计文档"目录即索引"等价。

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::sessions::UnreadableItem;

// ---------- 数据形态 ----------

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct AssetMeta {
    pub id: String,
    pub category: String, // bubble|divider|deco|banner|heading|art-inline|art-wide|photo-frame
    pub name: String,     // 简短唯一名（机器/模型引用；bubble/deco 名须可作引擎装饰名：小写字母数字中划线）
    pub title: String,    // 展示标题
    pub desc: String,     // 语义化自描述（"右下角一朵小花的气泡角饰…"）——检索主文本
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub usage: String, // deco|wide|inline（可被引擎放在哪类装饰位）
    #[serde(default)]
    pub placement: String, // 更细安放位（可选）
    #[serde(default)]
    pub style: Vec<String>, // 软参考（口径 4：不强约束）
    #[serde(default)]
    pub palette_note: String, // 配色备注（文本）
    #[serde(default)]
    pub version: u64, // 库端版本：替换源 SVG 时 +1，文档固化快照据此比较
    #[serde(default)]
    pub origin: String, // workshop | article-fallback
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AssetInput {
    pub category: String,
    pub name: String,
    pub title: String,
    pub desc: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub usage: String,
    #[serde(default)]
    pub placement: String,
    #[serde(default)]
    pub style: Vec<String>,
    #[serde(default)]
    pub palette_note: String,
    #[serde(default)]
    pub origin: String,
    pub svg: String,
}

/// 元数据更新补丁（全可选字段；None 保持不变）
#[derive(Serialize, Deserialize, Clone, Default)]
pub struct AssetPatch {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub desc: Option<String>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
    #[serde(default)]
    pub usage: Option<String>,
    #[serde(default)]
    pub placement: Option<String>,
    #[serde(default)]
    pub style: Option<Vec<String>>,
    #[serde(default)]
    pub palette_note: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AssetRecord {
    pub meta: AssetMeta,
    pub svg: String,
}

/// 引用某素材的文档（影响扫描：改版后是否扩散到老文档由用户逐篇选择）
#[derive(Serialize, Deserialize, Clone)]
pub struct RefDoc {
    pub id: String,
    pub title: String,
}

/// meta.json 读不出来时给引用清单显示的标题。
/// 显示空白会被误读成"这篇没标题"，所以宁可明说"读不出来"——只影响显示，不影响"未判定"计数。
const TITLE_UNREADABLE: &str = "（标题读取失败）";

/// 素材列表报告（R2）：正常项与"读不出来"的素材分开放。
///
/// 为什么不直接给 `list_assets` 加字段：它返回的是裸 `Vec<AssetMeta>`，前端
/// `src/lib/asset-library.ts` 直接 `map(fromWire)`；改结构会连带改前端。故保留旧命令不动，
/// 另开 `list_assets_report` 供界面区分"库是空的"与"有素材坏了"。
///
#[derive(Serialize, Deserialize)]
pub struct AssetListReport {
    pub items: Vec<AssetMeta>,
    /// 读不出来（meta 损坏 / IO 失败）的素材目录。不在 items 里，但必须让用户看到。
    #[serde(default)]
    pub unreadable: Vec<UnreadableItem>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct UpdateResult {
    pub meta: AssetMeta,
    pub references: Vec<RefDoc>,
    /// 影响扫描是否完整。**必须让用户看到**：扫描是"改素材前先看看谁在用"的依据，
    /// 一旦把"某篇文档读不出来"当成"没有引用"，用户会以为可以安全覆盖，实际会改坏那篇文档。
    /// 为空 = 扫描完整；非空 = 有 N 篇文档未能判定，文案给用户看。
    #[serde(default)]
    pub scan_warning: Option<String>,
}

// ---------- 目录与基础 ----------

fn assets_dir_at(base: &Path) -> PathBuf {
    base.join("assets").join("items")
}

fn now_ts() -> String {
    let d = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("{}{:09}", d.as_secs(), d.subsec_nanos())
}

pub fn new_asset_id() -> String {
    format!("as-{}", now_ts())
}

/// 素材 id 必须可作目录名（as-<ts> 形态；防路径穿越）
fn valid_id(id: &str) -> bool {
    !id.is_empty() && id.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-'))
}

fn item_dir_at(base: &Path, id: &str) -> Result<PathBuf, String> {
    if !valid_id(id) {
        return Err(format!("非法素材 id：{id}"));
    }
    Ok(assets_dir_at(base).join(id))
}

fn read_meta(dir: &Path) -> Result<Option<AssetMeta>, String> {
    let p = dir.join("meta.json");
    if !p.exists() {
        return Ok(None);
    }
    let raw = std::fs::read_to_string(&p).map_err(|e| format!("读取素材 meta 失败：{e}"))?;
    serde_json::from_str::<AssetMeta>(&raw).map(Some).map_err(|e| format!("素材 meta 损坏：{e}"))
}

fn write_files(dir: &Path, meta: &AssetMeta, svg: Option<&str>) -> Result<(), String> {
    std::fs::create_dir_all(dir).map_err(|e| format!("创建素材目录失败：{e}"))?;
    let json = serde_json::to_string_pretty(meta).map_err(|e| format!("序列化失败：{e}"))?;
    std::fs::write(dir.join("meta.json"), json).map_err(|e| format!("写入 meta 失败：{e}"))?;
    if let Some(svg) = svg {
        std::fs::write(dir.join("source.svg"), svg).map_err(|e| format!("写入 source.svg 失败：{e}"))?;
    }
    Ok(())
}

fn read_svg(dir: &Path) -> Result<String, String> {
    let p = dir.join("source.svg");
    if !p.exists() {
        return Ok(String::new());
    }
    std::fs::read_to_string(&p).map_err(|e| format!("读取 source.svg 失败：{e}"))
}

fn derive_usage(category: &str, usage: &str) -> String {
    let u = usage.trim();
    if !u.is_empty() {
        return u.to_string();
    }
    // 默认按分类推导可放置位：角饰系 → deco；横幅/宽幅/照片框/分割线 → wide；小节/正文 → inline
    match category {
        "bubble" | "deco" => "deco".into(),
        "banner" | "art-wide" | "photo-frame" | "divider" => "wide".into(),
        _ => "inline".into(),
    }
}

// ---------- 核心操作（base 可注入，便于测试） ----------

/// 扫描素材目录：返回 (正常素材, 读不出来的素材目录)。
/// 为什么要把两者分开：旧实现 `if let Ok(Some(m))` 让 meta 损坏的素材从库里"凭空消失"，
/// 用户看到的是"我的素材被删了？"——坏素材仍不进 items（不能拿坏数据渲染），但必须如实上报。
fn scan_at(base: &Path, category: Option<&str>) -> Result<(Vec<AssetMeta>, Vec<UnreadableItem>), String> {
    let root = assets_dir_at(base);
    let mut items = Vec::new();
    let mut unreadable = Vec::new();
    if !root.exists() {
        return Ok((items, unreadable));
    }
    for entry in std::fs::read_dir(&root).map_err(|e| format!("读取素材目录失败：{e}"))? {
        let entry = entry.map_err(|e| format!("目录项错误：{e}"))?;
        if !entry.path().is_dir() {
            continue;
        }
        match read_meta(&entry.path()) {
            Ok(Some(m)) => {
                if let Some(c) = category {
                    if m.category != c {
                        continue;
                    }
                }
                items.push(m);
            }
            Ok(None) => continue, // 没有 meta.json：本来就不是素材目录（如半途创建的临时目录）
            Err(e) => unreadable.push(UnreadableItem {
                id: entry.file_name().to_string_lossy().to_string(),
                error: e,
            }),
        }
    }
    items.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok((items, unreadable))
}

/// 旧命令用的列表：只要正常素材（保持返回结构不变，前端 src/lib/asset-library.ts 不受影响）
fn list_at(base: &Path, category: Option<&str>) -> Result<Vec<AssetMeta>, String> {
    Ok(scan_at(base, category)?.0)
}

fn get_at(base: &Path, id: &str) -> Result<Option<AssetRecord>, String> {
    let dir = item_dir_at(base, id)?;
    if !dir.exists() {
        return Ok(None);
    }
    match read_meta(&dir)? {
        Some(meta) => Ok(Some(AssetRecord { meta, svg: read_svg(&dir)? })),
        None => Ok(None),
    }
}

fn add_at(base: &Path, input: AssetInput) -> Result<AssetMeta, String> {
    let now = now_ts();
    let usage = derive_usage(&input.category, &input.usage);
    let meta = AssetMeta {
        id: new_asset_id(),
        category: input.category,
        name: input.name,
        title: input.title,
        desc: input.desc,
        tags: input.tags,
        usage,
        placement: input.placement,
        style: input.style,
        palette_note: input.palette_note,
        version: 1,
        origin: input.origin,
        created_at: now.clone(),
        updated_at: now,
    };
    write_files(&item_dir_at(base, &meta.id)?, &meta, Some(&input.svg))?;
    Ok(meta)
}

/// 扫描某素材被哪些文档引用（解析 documents/*/source.md 中的 [[asset:分类|<id>|…]] 引用行）。
///
/// 返回 `(引用清单, 未判定文档数)`。**第二个返回值是本次修复的重点**：
/// 旧实现用 `read_to_string(...).unwrap_or_default()` 把"读不出来"折叠成"空文本"，
/// 于是那篇文档看起来就是"没引用这张素材"——用户据此放心覆盖素材，实际改坏了那篇文档。
/// 现在只把 `NotFound` 当作"确实没有源文件"，其余 IO 错误一律计入未判定并让用户看到。
fn scan_usage_at(base: &Path, asset_id: &str) -> Result<(Vec<RefDoc>, usize), String> {
    let root = base.join("documents");
    let mut refs = Vec::new();
    let mut undecided = 0usize;
    if !root.exists() {
        return Ok((refs, undecided));
    }
    for entry in std::fs::read_dir(&root).map_err(|e| format!("读取文档目录失败：{e}"))? {
        let entry = entry.map_err(|e| format!("目录项错误：{e}"))?;
        let dir = entry.path();
        if !dir.is_dir() {
            continue;
        }
        let source = match std::fs::read_to_string(dir.join("source.md")) {
            Ok(t) => t,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => continue, // 本就没有源文件
            Err(_) => {
                undecided += 1; // 读不出来 ≠ 没有引用
                continue;
            }
        };
        if source.contains(&format!("|{asset_id}|")) && source.contains("[[asset:") {
            // 文档 meta 是 DocMeta 结构（与素材 meta 不同），单独解析取标题。
            // 标题取不到只影响显示，不作为"未判定"——引用关系本身已经从 source.md 确认了。
            // 但**显示成空白也是不诚实的**（空白会被当成"这篇没标题"），读不出来就明说。
            let title = match std::fs::read_to_string(dir.join("meta.json")) {
                Ok(raw) => serde_json::from_str::<crate::documents::DocMeta>(&raw)
                    .map(|m| m.title)
                    .unwrap_or_else(|_| TITLE_UNREADABLE.to_string()),
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => String::new(), // 本就没有 meta
                Err(_) => TITLE_UNREADABLE.to_string(),
            };
            let id = entry.file_name().to_string_lossy().to_string();
            refs.push(RefDoc { id, title });
        }
    }
    Ok((refs, undecided))
}

/// 更新素材：patch 更新元数据（不升版本）；svg 提供时替换源并 version += 1；
/// 返回更新后的 meta 与引用它的文档清单（改版影响扫描，D5）。
fn update_at(base: &Path, id: &str, patch: AssetPatch, svg: Option<String>) -> Result<UpdateResult, String> {
    let dir = item_dir_at(base, id)?;
    let mut meta = match read_meta(&dir)? {
        Some(m) => m,
        None => return Err(format!("素材不存在：{id}")),
    };
    if let Some(v) = patch.name {
        if !v.trim().is_empty() {
            meta.name = v;
        }
    }
    if let Some(v) = patch.title {
        meta.title = v;
    }
    if let Some(v) = patch.desc {
        meta.desc = v;
    }
    if let Some(v) = patch.tags {
        meta.tags = v;
    }
    if let Some(v) = patch.usage {
        meta.usage = derive_usage(&meta.category, &v);
    }
    if let Some(v) = patch.placement {
        meta.placement = v;
    }
    if let Some(v) = patch.style {
        meta.style = v;
    }
    if let Some(v) = patch.palette_note {
        meta.palette_note = v;
    }
    meta.updated_at = now_ts();
    let has_new_svg = svg.as_ref().map(|s| !s.trim().is_empty()).unwrap_or(false);
    if has_new_svg {
        meta.version += 1;
    }
    write_files(&dir, &meta, svg.as_deref().filter(|_| has_new_svg))?;
    let (references, undecided) = scan_usage_at(base, id)?;
    let scan_warning = if undecided > 0 {
        Some(format!(
            "影响扫描不完整：有 {undecided} 篇文档未能读取，无法判定它们是否引用了这张素材——请勿据此断定'没有文档在用'"
        ))
    } else {
        None
    };
    Ok(UpdateResult { meta, references, scan_warning })
}

fn delete_at(base: &Path, id: &str) -> Result<(), String> {
    let dir = item_dir_at(base, id)?;
    if dir.exists() {
        std::fs::remove_dir_all(&dir).map_err(|e| format!("删除素材失败：{e}"))?;
    }
    Ok(())
}

// ---------- Tauri 命令 ----------

#[tauri::command]
pub fn list_assets(category: Option<String>) -> Result<Vec<AssetMeta>, String> {
    let base = crate::sessions::workspace_dir()?;
    list_at(&base, category.as_deref())
}

/// R2 新增：素材列表 + "读不出来"清单。界面据此区分"素材库是空的"与"有素材坏了"。
#[tauri::command]
pub fn list_assets_report(category: Option<String>) -> Result<AssetListReport, String> {
    let base = crate::sessions::workspace_dir()?;
    let (items, unreadable) = scan_at(&base, category.as_deref())?;
    Ok(AssetListReport { items, unreadable })
}

#[tauri::command]
pub fn add_asset(input: AssetInput) -> Result<AssetMeta, String> {
    let base = crate::sessions::workspace_dir()?;
    add_at(&base, input)
}

#[tauri::command]
pub fn get_asset(id: String) -> Result<Option<AssetRecord>, String> {
    let base = crate::sessions::workspace_dir()?;
    get_at(&base, &id)
}

#[tauri::command]
pub fn update_asset(id: String, patch: AssetPatch, svg: Option<String>) -> Result<UpdateResult, String> {
    let base = crate::sessions::workspace_dir()?;
    update_at(&base, &id, patch, svg)
}

#[tauri::command]
pub fn delete_asset(id: String) -> Result<(), String> {
    let base = crate::sessions::workspace_dir()?;
    delete_at(&base, &id)
}

// ---------- 测试 ----------

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp_base(tag: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("wxmp-asset-{tag}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(&d).unwrap();
        d
    }

    fn input(name: &str, category: &str, desc: &str) -> AssetInput {
        AssetInput {
            category: category.into(),
            name: name.into(),
            title: name.into(),
            desc: desc.into(),
            tags: vec!["气泡".into(), "小花".into()],
            usage: String::new(),
            placement: String::new(),
            style: vec![],
            palette_note: String::new(),
            origin: "workshop".into(),
            svg: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 300 300\"><circle cx=\"150\" cy=\"150\" r=\"40\" fill=\"#c96f4a\"/><path d=\"M0 0 L10 0 L0 10 Z\"/></svg>".into(),
        }
    }

    #[test]
    fn add_list_get_roundtrip() {
        let base = tmp_base("roundtrip");
        let m = add_at(&base, input("bubble-flower", "bubble", "右下角一朵小花的气泡角饰，浅暖色")).expect("add");
        assert!(m.id.starts_with("as-"));
        assert_eq!(m.version, 1);
        assert_eq!(m.usage, "deco", "bubble 默认 usage=deco");
        let list = list_at(&base, None).expect("list");
        assert_eq!(list.len(), 1);
        let cat = list_at(&base, Some("divider")).expect("cat");
        assert!(cat.is_empty());
        let rec = get_at(&base, &m.id).expect("get").expect("some");
        assert!(rec.svg.contains("<svg"));
        assert_eq!(rec.meta.desc, "右下角一朵小花的气泡角饰，浅暖色");
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn svg_replace_bumps_version_and_scans_docs() {
        let base = tmp_base("update");
        let m = add_at(&base, input("b-flower", "bubble", "花")).expect("add");
        // 构造一篇引用了该素材的文档
        let doc_dir = base.join("documents").join("s-doc1");
        std::fs::create_dir_all(&doc_dir).unwrap();
        std::fs::write(
            doc_dir.join("source.md"),
            format!("说明\n```v2\n[[asset:bubble|{}|右下角小花]]\n:::\n```", m.id),
        )
        .unwrap();
        std::fs::write(
            doc_dir.join("meta.json"),
            serde_json::to_string(&crate::documents::DocMeta { id: "s-doc1".into(), title: "开学推文".into(), ..Default::default() }).unwrap(),
        )
        .unwrap();
        std::fs::write(doc_dir.join("article.html"), "<section/>").unwrap();

        let r = update_at(&base, &m.id, AssetPatch::default(), Some("<svg viewBox=\"0 0 1 1\"><rect/></svg>".into())).expect("upd");
        assert_eq!(r.meta.version, 2, "替换源应 version+1");
        assert_eq!(r.references.len(), 1, "影响扫描应命中引用文档");
        assert_eq!(r.references[0].id, "s-doc1");
        assert_eq!(r.references[0].title, "开学推文");
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn meta_only_update_keeps_version() {
        let base = tmp_base("metaupd");
        let m = add_at(&base, input("a", "bubble", "旧描述")).expect("add");
        let mut p = AssetPatch::default();
        p.desc = Some("新描述：右下角两朵小花".into());
        p.title = Some("花角饰v2".into());
        let r = update_at(&base, &m.id, p, None).expect("upd");
        assert_eq!(r.meta.version, 1, "纯元数据更新不升版本");
        assert_eq!(r.meta.desc, "新描述：右下角两朵小花");
        assert_eq!(r.meta.title, "花角饰v2");
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn delete_is_idempotent_and_unknown_id_errors_on_update() {
        let base = tmp_base("del");
        let m = add_at(&base, input("x", "bubble", "x")).expect("add");
        delete_at(&base, &m.id).expect("del");
        delete_at(&base, &m.id).expect("del2 幂等");
        assert!(list_at(&base, None).unwrap().is_empty());
        assert!(update_at(&base, &m.id, AssetPatch::default(), None).is_err());
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn corrupt_meta_listed_as_unreadable_in_report() {
        // R2：坏素材不能从库里凭空消失；旧命令结构不变，新命令把"读不出来"如实带出
        let base = tmp_base("corrupt-meta");
        let good = add_at(&base, input("b-good", "bubble", "正常素材")).expect("add");
        let bad_dir = assets_dir_at(&base).join("as-broken");
        std::fs::create_dir_all(&bad_dir).unwrap();
        std::fs::write(bad_dir.join("meta.json"), "{ 不是合法 JSON").unwrap();
        std::fs::write(bad_dir.join("source.svg"), "<svg/>").unwrap();

        assert_eq!(list_at(&base, None).expect("list").len(), 1, "旧命令仍只返回正常项");
        let (items, unreadable) = scan_at(&base, None).expect("scan");
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].id, good.id);
        assert_eq!(unreadable.len(), 1, "坏素材必须上报");
        assert_eq!(unreadable[0].id, "as-broken");
        assert!(!unreadable[0].error.is_empty(), "原因要可直接展示");
        // 分类过滤只筛正常项，不影响坏素材的上报
        let (divider, unreadable) = scan_at(&base, Some("divider")).expect("scan cat");
        assert!(divider.is_empty());
        assert_eq!(unreadable.len(), 1);
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn unreadable_doc_source_makes_scan_incomplete() {
        // R7：某篇文档的 source.md 读不出来（非 NotFound 的 IO 错误）时，
        // 影响扫描必须自认"未判定"——不能把它当成"这篇没引用"，否则用户会放心覆盖素材，实际改坏那篇文档
        let base = tmp_base("scan-undecided");
        let m = add_at(&base, input("b-scan", "bubble", "扫描用例")).expect("add");
        // 一份正常文档（不引用该素材）
        let ok_dir = base.join("documents").join("s-ok");
        std::fs::create_dir_all(&ok_dir).unwrap();
        std::fs::write(ok_dir.join("source.md"), "说明\n```v2\n正文\n```").unwrap();
        // 一份 source.md 读不出来的文档：把 source.md 做成目录 → 读取报非 NotFound 的 IO 错误
        let bad_dir = base.join("documents").join("s-bad");
        std::fs::create_dir_all(bad_dir.join("source.md")).unwrap();

        let r = update_at(&base, &m.id, AssetPatch::default(), None).expect("upd");
        let w = r.scan_warning.expect("source.md 读不出来必须给出扫描告警");
        assert!(w.contains('1'), "告警应说明未判定的篇数：{w}");
        assert!(
            r.references.iter().all(|d| d.id != "s-bad"),
            "未判定的文档不能作为引用项出现在清单里（不能让用户以为已经查清）"
        );
        assert!(r.references.is_empty());

        // 对照：source.md 真不存在（NotFound）时扫描是完整的，不该报未判定
        std::fs::remove_dir_all(bad_dir.join("source.md")).unwrap();
        let r2 = update_at(&base, &m.id, AssetPatch::default(), None).expect("upd2");
        assert!(r2.scan_warning.is_none(), "本来就没有源文件 → 扫描完整");
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn unreadable_doc_meta_shows_explicit_title() {
        // R7 复核补口：引用关系已从 source.md 确认，但标题读不出来时不能显示成空白
        // （空白会被当成"这篇没标题"），要明说读失败
        let base = tmp_base("scan-title");
        let m = add_at(&base, input("b-title", "bubble", "标题用例")).expect("add");
        let dir = base.join("documents").join("s-t");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(
            dir.join("source.md"),
            format!("```v2\n[[asset:bubble|{}|小花]]\n```", m.id),
        )
        .unwrap();
        std::fs::write(dir.join("meta.json"), "{ 坏").unwrap();
        let r = update_at(&base, &m.id, AssetPatch::default(), None).expect("upd");
        assert_eq!(r.references.len(), 1, "引用关系以 source.md 为准");
        assert_eq!(r.references[0].title, "（标题读取失败）");
        assert!(r.scan_warning.is_none(), "标题读失败不是'未判定引用'");
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn invalid_ids_rejected() {
        assert!(item_dir_at(Path::new("x"), "../evil").is_err());
        assert!(item_dir_at(Path::new("x"), "as/1").is_err());
        assert!(item_dir_at(Path::new("x"), "as-1").is_ok());
    }
}
