// assets.rs —— V3-R2 个人素材库：Documents/wechat-mp-workspace/assets/items/<assetId>/
// 每素材 = meta.json（语义元数据：category/name/title/desc/tags/usage/style/version/…）+ source.svg。
// 素材库为单机单用户私有资产；检索在 TS 侧做（list 后确定性打分），Rust 侧负责落盘、版本与影响扫描。
// 实现注：不另建 index.json——每素材单目录 meta 扫描即索引，量级小（≤数百）足够；与设计文档"目录即索引"等价。

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

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

/// 引用该素材的文档（影响扫描：改版后是否扩散到老文档由用户逐篇选择）
#[derive(Serialize, Deserialize, Clone)]
pub struct RefDoc {
    pub id: String,
    pub title: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct UpdateResult {
    pub meta: AssetMeta,
    pub references: Vec<RefDoc>,
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

fn list_at(base: &Path, category: Option<&str>) -> Result<Vec<AssetMeta>, String> {
    let root = assets_dir_at(base);
    let mut items = Vec::new();
    if !root.exists() {
        return Ok(items);
    }
    for entry in std::fs::read_dir(&root).map_err(|e| format!("读取素材目录失败：{e}"))? {
        let entry = entry.map_err(|e| format!("目录项错误：{e}"))?;
        if !entry.path().is_dir() {
            continue;
        }
        if let Ok(Some(m)) = read_meta(&entry.path()) {
            if let Some(c) = category {
                if m.category != c {
                    continue;
                }
            }
            items.push(m);
        }
    }
    items.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(items)
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

/// 扫描某素材被哪些文档引用（解析 documents/*/source.md 中的 [[asset:分类|<id>|…]] 引用行）
fn scan_usage_at(base: &Path, asset_id: &str) -> Result<Vec<RefDoc>, String> {
    let root = base.join("documents");
    let mut refs = Vec::new();
    if !root.exists() {
        return Ok(refs);
    }
    for entry in std::fs::read_dir(&root).map_err(|e| format!("读取文档目录失败：{e}"))? {
        let entry = entry.map_err(|e| format!("目录项错误：{e}"))?;
        let dir = entry.path();
        if !dir.is_dir() {
            continue;
        }
        let source = std::fs::read_to_string(dir.join("source.md")).unwrap_or_default();
        if source.contains(&format!("|{asset_id}|")) && source.contains("[[asset:") {
            // 文档 meta 是 DocMeta 结构（与素材 meta 不同），单独解析取标题
            let title = std::fs::read_to_string(dir.join("meta.json"))
                .ok()
                .and_then(|raw| serde_json::from_str::<crate::documents::DocMeta>(&raw).ok())
                .map(|m| m.title)
                .unwrap_or_default();
            let id = entry.file_name().to_string_lossy().to_string();
            refs.push(RefDoc { id, title });
        }
    }
    Ok(refs)
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
    let references = scan_usage_at(base, id)?;
    Ok(UpdateResult { meta, references })
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
    fn invalid_ids_rejected() {
        assert!(item_dir_at(Path::new("x"), "../evil").is_err());
        assert!(item_dir_at(Path::new("x"), "as/1").is_err());
        assert!(item_dir_at(Path::new("x"), "as-1").is_ok());
    }
}
