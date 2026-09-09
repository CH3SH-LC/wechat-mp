// documents.rs —— V3-R1 推文文档：Documents/wechat-mp-workspace/documents/<docId>/
// 每份文档 = meta.json + source.md（真源：可编辑 v2 正文）+ article.html（产物快照）。
// 文档 id 与产生它的会话 id 相同（对话与文稿分离存放，但 1:1 关联）：
// 会话终稿默认自动落盘、会话内更新就地刷新同一份文档；删除会话时其文档一并删除。

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

// ---------- 数据形态 ----------

/// 素材引用快照（V3-R3 固化副本用；R1/R2 阶段为空映射，字段先行保持兼容）
#[derive(Serialize, Deserialize, Clone, Default)]
pub struct AssetSnap {
    pub svg: String,
    pub ver: u64,
}

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
}

#[derive(Serialize, Deserialize, Clone)]
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
}

#[derive(Serialize, Deserialize)]
pub struct DocListEntry {
    pub id: String,
    pub title: String,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize)]
pub struct DocList {
    pub items: Vec<DocListEntry>,
}

// ---------- 目录与基础 ----------

fn documents_dir_at(base: &Path) -> PathBuf {
    base.join("documents")
}

fn now_ts() -> String {
    let d = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("{}{:09}", d.as_secs(), d.subsec_nanos())
}

/// 文档 id 必须可作目录名（会话 id 为 s<ts> 形态；防路径穿越）
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

fn read_meta(dir: &Path) -> Result<Option<DocMeta>, String> {
    let p = dir.join("meta.json");
    if !p.exists() {
        return Ok(None);
    }
    let raw = std::fs::read_to_string(&p).map_err(|e| format!("读取文档 meta 失败：{e}"))?;
    serde_json::from_str::<DocMeta>(&raw).map(Some).map_err(|e| format!("文档 meta 损坏：{e}"))
}

fn write_meta(dir: &Path, meta: &DocMeta) -> Result<(), String> {
    std::fs::create_dir_all(dir).map_err(|e| format!("创建文档目录失败：{e}"))?;
    let json = serde_json::to_string_pretty(meta).map_err(|e| format!("序列化失败：{e}"))?;
    std::fs::write(dir.join("meta.json"), json).map_err(|e| format!("写入 meta 失败：{e}"))
}

fn read_file(path: &Path) -> Result<String, String> {
    if !path.exists() {
        return Ok(String::new());
    }
    std::fs::read_to_string(path).map_err(|e| format!("读取文档文件失败：{e}"))
}

// ---------- 核心操作（base 可注入，便于测试） ----------

fn list_at(base: &Path) -> Result<Vec<DocListEntry>, String> {
    let root = documents_dir_at(base);
    let mut items = Vec::new();
    if !root.exists() {
        return Ok(items);
    }
    for entry in std::fs::read_dir(&root).map_err(|e| format!("读取文档目录失败：{e}"))? {
        let entry = entry.map_err(|e| format!("目录项错误：{e}"))?;
        if !entry.path().is_dir() {
            continue;
        }
        let id = entry.file_name().to_string_lossy().to_string();
        let meta = match read_meta(&entry.path()) {
            Ok(Some(m)) => m,
            _ => continue, // meta 缺失/损坏：不列为文档
        };
        // 只有含可展示正文（article.html 非空）的才算文档
        let html = read_file(&entry.path().join("article.html")).unwrap_or_default();
        if html.trim().is_empty() {
            continue;
        }
        items.push(DocListEntry { id, title: meta.title, updated_at: meta.updated_at });
    }
    items.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(items)
}

fn open_at(base: &Path, id: &str) -> Result<Option<DocContent>, String> {
    let dir = doc_dir_at(base, id)?;
    if !dir.exists() {
        return Ok(None);
    }
    let meta = match read_meta(&dir)? {
        Some(m) => m,
        None => return Ok(None),
    };
    Ok(Some(DocContent {
        id: id.to_string(),
        title: meta.title,
        updated_at: meta.updated_at,
        source: read_file(&dir.join("source.md"))?,
        html: read_file(&dir.join("article.html"))?,
        warnings: meta.warnings,
        snapshots: meta.snapshots,
    }))
}

/// 保存/就地刷新文档：id 与会话 id 相同；title/source/html 全量覆盖，同一文档不留第二版。
/// snapshots 为本次渲染所用素材引用快照（R3 起非空）。
fn save_at(
    base: &Path,
    id: &str,
    title: &str,
    source: &str,
    html: &str,
    warnings: &[String],
    snapshots: &HashMap<String, AssetSnap>,
) -> Result<DocContent, String> {
    let dir = doc_dir_at(base, id)?;
    let existing = read_meta(&dir)?;
    let now = now_ts();
    let meta = DocMeta {
        id: id.to_string(),
        title: if title.trim().is_empty() { existing.as_ref().map(|m| m.title.clone()).unwrap_or_default() } else { title.to_string() },
        created_at: existing.as_ref().map(|m| m.created_at.clone()).unwrap_or_else(|| now.clone()),
        updated_at: now,
        warnings: warnings.to_vec(),
        snapshots: snapshots.clone(),
    };
    write_meta(&dir, &meta)?;
    std::fs::write(dir.join("source.md"), source).map_err(|e| format!("写入 source.md 失败：{e}"))?;
    std::fs::write(dir.join("article.html"), html).map_err(|e| format!("写入 article.html 失败：{e}"))?;
    Ok(DocContent {
        id: id.to_string(),
        title: meta.title.clone(),
        updated_at: meta.updated_at.clone(),
        source: source.to_string(),
        html: html.to_string(),
        warnings: meta.warnings.clone(),
        snapshots: meta.snapshots.clone(),
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
    Ok(DocList { items: list_at(&base)? })
}

#[tauri::command]
pub fn open_document(id: String) -> Result<Option<DocContent>, String> {
    let base = crate::sessions::workspace_dir()?;
    open_at(&base, &id)
}

#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub fn save_document(
    id: String,
    title: String,
    source: String,
    html: String,
    warnings: Vec<String>,
    snapshots: HashMap<String, AssetSnap>,
) -> Result<DocContent, String> {
    let base = crate::sessions::workspace_dir()?;
    save_at(&base, &id, &title, &source, &html, &warnings, &snapshots)
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

    #[test]
    fn save_list_open_roundtrip() {
        let base = tmp_base("roundtrip");
        let id = "s123".to_string();
        let mut snaps = HashMap::new();
        snaps.insert("as-1".to_string(), AssetSnap { svg: "<svg/>".into(), ver: 1 });
        let c = save_at(&base, &id, "开学典礼", "说明\n```v2\n正文\n```", "<section>html</section>", &["警告一".to_string()], &snaps).expect("save");
        assert_eq!(c.title, "开学典礼");
        assert!(c.html.contains("<section>"));
        let list = list_at(&base).expect("list");
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].title, "开学典礼");
        let opened = open_at(&base, &id).expect("open").expect("some");
        assert_eq!(opened.source, "说明\n```v2\n正文\n```");
        assert_eq!(opened.warnings.len(), 1);
        assert_eq!(opened.snapshots.get("as-1").unwrap().ver, 1);
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn in_place_update_keeps_single_version() {
        let base = tmp_base("update");
        let id = "s1".to_string();
        save_at(&base, &id, "旧标题", "v1", "<section>v1</section>", &[], &HashMap::new()).expect("save1");
        let created = open_at(&base, &id).unwrap().unwrap();
        let c2 = save_at(&base, &id, "", "v2", "<section>v2</section>", &[], &HashMap::new()).expect("save2");
        assert_eq!(c2.title, "旧标题", "空标题保留旧标题");
        assert_eq!(list_at(&base).unwrap().len(), 1, "就地刷新不留第二版");
        assert!(c2.updated_at >= created.updated_at);
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn delete_removes_doc() {
        let base = tmp_base("del");
        save_at(&base, "s1", "a", "v", "<section>x</section>", &[], &HashMap::new()).expect("save");
        delete_at(&base, "s1").expect("del");
        assert!(list_at(&base).unwrap().is_empty());
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
        assert!(list_at(&base).unwrap().is_empty());
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn invalid_id_rejected() {
        assert!(doc_dir_at(Path::new("x"), "../evil").is_err());
        assert!(doc_dir_at(Path::new("x"), "a/b").is_err());
        assert!(doc_dir_at(Path::new("x"), "s-ok_1").is_ok());
    }

    #[test]
    fn corrupt_meta_skipped_in_list() {
        let base = tmp_base("corrupt");
        let dir = doc_dir_at(&base, "s-bad").unwrap();
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("meta.json"), "not json").unwrap();
        assert!(list_at(&base).unwrap().is_empty(), "损坏 meta 不应列入");
        let _ = std::fs::remove_dir_all(&base);
    }
}
