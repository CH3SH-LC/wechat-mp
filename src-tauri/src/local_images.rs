//! Local raster originals are immutable, content-addressed files. A model preview is a
//! separate derivative: article rendering/export always uses `data_url`, never the preview.
//! Import reads exactly the selected path/data URL; it never searches a directory.

use base64::{engine::general_purpose::STANDARD, Engine};
use image::{DynamicImage, ImageDecoder, ImageFormat, ImageReader, Limits};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{Cursor, Read};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

const MAX_ORIGINAL: usize = 32 * 1024 * 1024;
const MAX_MODEL: usize = 2 * 1024 * 1024;
const MAX_PIXELS: u64 = 40_000_000;
const MAX_DIMENSION: u32 = 32768;
static IMPORT_LOCK: Mutex<()> = Mutex::new(());

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LocalImage {
    pub asset_id: String,
    pub name: String,
    pub mime: String,
    pub width: u32,
    pub height: u32,
    pub byte_length: usize,
    pub data_url: String,
    pub model_data_url: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredImage {
    asset_id: String,
    name: String,
    mime: String,
    extension: String,
    width: u32,
    height: u32,
    byte_length: usize,
    model_mime: String,
    model_extension: String,
    model_hash: String,
}

fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn image_dir(base: &Path, id: &str) -> Result<PathBuf, String> {
    if !id.starts_with("li-")
        || id.len() != 67
        || !id[3..]
            .bytes()
            .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
    {
        return Err("本地图片引用无效，请重新选择图片".into());
    }
    Ok(base.join("local-images").join(id))
}

fn format_info(format: ImageFormat) -> Result<(&'static str, &'static str), String> {
    match format {
        ImageFormat::Png => Ok(("image/png", "png")),
        ImageFormat::Jpeg => Ok(("image/jpeg", "jpg")),
        ImageFormat::Gif => Ok(("image/gif", "gif")),
        ImageFormat::WebP => Ok(("image/webp", "webp")),
        ImageFormat::Bmp => Ok(("image/bmp", "bmp")),
        _ => Err("暂不支持这种图片格式；请使用 PNG、JPEG、GIF、WebP 或 BMP 原图".into()),
    }
}

fn check_dimensions(width: u32, height: u32) -> Result<(), String> {
    if width == 0
        || height == 0
        || width > MAX_DIMENSION
        || height > MAX_DIMENSION
        || u64::from(width) * u64::from(height) > MAX_PIXELS
    {
        return Err("图片尺寸过大或无效：最长边不能超过 32768 像素，总像素不能超过 4000 万".into());
    }
    Ok(())
}

fn read_bounded(path: &Path, limit: usize, context: &str) -> Result<Vec<u8>, String> {
    let file = File::open(path).map_err(|e| format!("{context}失败：{e}"))?;
    let meta = file
        .metadata()
        .map_err(|e| format!("读取图片属性失败：{e}"))?;
    if !meta.is_file() {
        return Err("请选择一张图片文件，不能选择文件夹或设备".into());
    }
    if meta.len() > limit as u64 {
        return Err(format!(
            "{context}超过大小限制（最多 {} MB）",
            limit / 1024 / 1024
        ));
    }
    let mut bytes = Vec::with_capacity(meta.len() as usize);
    file.take(limit as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| format!("{context}失败：{e}"))?;
    if bytes.len() > limit {
        return Err(format!("{context}超过大小限制"));
    }
    Ok(bytes)
}

fn exact_path(raw: &str) -> Result<PathBuf, String> {
    let trimmed = raw.trim();
    let value = if trimmed.len() >= 2
        && ((trimmed.starts_with('"') && trimmed.ends_with('"'))
            || (trimmed.starts_with('\'') && trimmed.ends_with('\'')))
    {
        &trimmed[1..trimmed.len().saturating_sub(1)]
    } else {
        trimmed
    };
    if value.is_empty() || value.contains('\0') {
        return Err("图片路径为空或无效".into());
    }
    let path = if value.to_ascii_lowercase().starts_with("file:") {
        let url = reqwest::Url::parse(value).map_err(|_| "图片 file URL 无效")?;
        if url.host_str().is_some_and(|h| h != "localhost")
            || url.query().is_some()
            || url.fragment().is_some()
        {
            return Err("请提供本机图片的完整 file URL，不接受远程主机、查询参数或片段".into());
        }
        url.to_file_path()
            .map_err(|_| "无法把 file URL 转为本机图片路径")?
    } else {
        PathBuf::from(value)
    };
    let text = path.to_string_lossy();
    if !path.is_absolute() || text.starts_with("\\\\") || text.starts_with("//") {
        return Err("请提供本机图片的完整绝对路径，不接受相对路径、网络共享或设备路径".into());
    }
    Ok(path)
}

fn data_url_bytes(value: &str) -> Result<Vec<u8>, String> {
    // Bound the encoded input before allocating its decoded representation.
    if value.len() > (MAX_ORIGINAL + 2) / 3 * 4 + 128 {
        return Err("图片超过 32 MB，请选择较小的原图".into());
    }
    let (header, payload) = value.split_once(',').ok_or("图片数据地址无效")?;
    let header = header.to_ascii_lowercase();
    if !(header.starts_with("data:image/") || header.starts_with("data:application/octet-stream"))
        || !header.ends_with(";base64")
    {
        return Err("图片数据必须是图片文件的 base64 数据地址".into());
    }
    let bytes = STANDARD
        .decode(payload)
        .map_err(|_| "图片 base64 数据损坏")?;
    if bytes.len() > MAX_ORIGINAL {
        return Err("图片超过 32 MB，请选择较小的原图".into());
    }
    Ok(bytes)
}

fn decode_original(bytes: &[u8]) -> Result<(DynamicImage, &'static str, &'static str), String> {
    if bytes.is_empty() {
        return Err("图片是空文件，请重新选择".into());
    }
    let format =
        image::guess_format(bytes).map_err(|_| "文件内容不是可识别的图片，或图片已损坏")?;
    let (mime, extension) = format_info(format)?;
    let mut reader = ImageReader::with_format(Cursor::new(bytes), format);
    let mut limits = Limits::default();
    limits.max_image_width = Some(MAX_DIMENSION);
    limits.max_image_height = Some(MAX_DIMENSION);
    limits.max_alloc = Some(192 * 1024 * 1024);
    reader.limits(limits);
    let mut decoder = reader
        .into_decoder()
        .map_err(|e| format!("无法读取图片：{e}"))?;
    let (width, height) = decoder.dimensions();
    check_dimensions(width, height)?;
    let orientation = decoder
        .orientation()
        .map_err(|e| format!("无法读取图片方向：{e}"))?;
    let mut decoded = DynamicImage::from_decoder(decoder)
        .map_err(|e| format!("图片无法完整解码，可能损坏或超过内存限制：{e}"))?;
    decoded.apply_orientation(orientation);
    Ok((decoded, mime, extension))
}

fn model_preview(decoded: &DynamicImage) -> Result<(Vec<u8>, &'static str, &'static str), String> {
    let mut edge = 1600;
    loop {
        // image::thumbnail also enlarges tiny images; never invent pixels or inflate
        // payloads when the original already fits the model's maximum dimensions.
        let preview = if decoded.width() <= edge && decoded.height() <= edge {
            decoded.clone()
        } else {
            decoded.thumbnail(edge, edge)
        };
        let mut out = Cursor::new(Vec::new());
        let (mime, extension) = if preview.color().has_alpha() {
            preview
                .write_to(&mut out, ImageFormat::Png)
                .map_err(|e| format!("生成图片识别预览失败：{e}"))?;
            ("image/png", "png")
        } else {
            image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, 88)
                .encode_image(&preview)
                .map_err(|e| format!("生成图片识别预览失败：{e}"))?;
            ("image/jpeg", "jpg")
        };
        let bytes = out.into_inner();
        if bytes.len() <= MAX_MODEL {
            return Ok((bytes, mime, extension));
        }
        if edge <= 256 {
            return Err("图片识别预览过大，无法安全发送给模型".into());
        }
        edge = (edge * 3 / 4).max(256);
    }
}

fn clean_name(input: Option<&str>, extension: &str) -> String {
    let name = input
        .unwrap_or("")
        .rsplit(['/', '\\'])
        .next()
        .unwrap_or("")
        .trim();
    let name: String = name.chars().filter(|c| !c.is_control()).take(160).collect();
    if name.is_empty() {
        format!("本地图片.{extension}")
    } else {
        name
    }
}

fn response(meta: &StoredImage, original: &[u8], model: &[u8]) -> LocalImage {
    LocalImage {
        asset_id: meta.asset_id.clone(),
        name: meta.name.clone(),
        mime: meta.mime.clone(),
        width: meta.width,
        height: meta.height,
        byte_length: original.len(),
        data_url: format!("data:{};base64,{}", meta.mime, STANDARD.encode(original)),
        model_data_url: format!("data:{};base64,{}", meta.model_mime, STANDARD.encode(model)),
    }
}

fn get_at(base: &Path, asset_id: &str) -> Result<LocalImage, String> {
    let dir = image_dir(base, asset_id)?;
    let stored = read_bounded(&dir.join("meta.json"), 64 * 1024, "读取已保存图片信息")?;
    let meta: StoredImage =
        serde_json::from_slice(&stored).map_err(|_| "已保存图片信息损坏，请重新导入原图")?;
    if meta.asset_id != asset_id
        || !matches!(
            (meta.mime.as_str(), meta.extension.as_str()),
            ("image/png", "png")
                | ("image/jpeg", "jpg")
                | ("image/gif", "gif")
                | ("image/webp", "webp")
                | ("image/bmp", "bmp")
        )
        || !matches!(
            (meta.model_mime.as_str(), meta.model_extension.as_str()),
            ("image/png", "png") | ("image/jpeg", "jpg")
        )
    {
        return Err("已保存图片信息不一致，请重新导入原图".into());
    }
    check_dimensions(meta.width, meta.height)?;
    let original = read_bounded(
        &dir.join(format!("original.{}", meta.extension)),
        MAX_ORIGINAL,
        "读取已保存原图",
    )?;
    if original.len() != meta.byte_length || format!("li-{}", hash(&original)) != asset_id {
        return Err("已保存原图校验失败，文件可能损坏；请重新导入原图".into());
    }
    let actual_format = image::guess_format(&original).map_err(|_| "已保存原图格式无法识别")?;
    if format_info(actual_format)?.0 != meta.mime {
        return Err("已保存原图的格式信息不一致，请重新导入原图".into());
    }
    let model = read_bounded(
        &dir.join(format!("model.{}", meta.model_extension)),
        MAX_MODEL,
        "读取图片识别预览",
    )?;
    if hash(&model) != meta.model_hash {
        return Err("图片识别预览校验失败，请重新导入原图".into());
    }
    Ok(response(&meta, &original, &model))
}

fn import_at(
    base: &Path,
    data_url: Option<&str>,
    path: Option<&str>,
    name: Option<&str>,
) -> Result<LocalImage, String> {
    // Batch drop/paste may issue several IPC calls at once. Decode one original at a
    // time so the per-image allocation bound is also the import workload's bound.
    let _lock = IMPORT_LOCK.lock().map_err(|_| "图片保存正在恢复，请重试")?;
    let (bytes, inferred_name) = match (data_url, path) {
        (Some(data), None) => (data_url_bytes(data)?, None),
        (None, Some(raw)) => {
            let path = exact_path(raw)?;
            let name = path.file_name().map(|n| n.to_string_lossy().into_owned());
            (read_bounded(&path, MAX_ORIGINAL, "读取所选图片")?, name)
        }
        _ => return Err("每次导入请提供一项：图片文件路径或图片数据".into()),
    };
    let (decoded, mime, extension) = decode_original(&bytes)?;
    let asset_id = format!("li-{}", hash(&bytes));
    let dir = image_dir(base, &asset_id)?;
    // Healthy originals are immutable. Explicit re-import can repair missing/corrupt
    // storage because the user's supplied bytes have already proved this exact hash.
    if dir.join("meta.json").exists() {
        if let Ok(existing) = get_at(base, &asset_id) {
            return Ok(existing);
        }
    }
    let (model, model_mime, model_extension) = model_preview(&decoded)?;
    let meta = StoredImage {
        asset_id,
        name: clean_name(name.or(inferred_name.as_deref()), extension),
        mime: mime.into(),
        extension: extension.into(),
        width: decoded.width(),
        height: decoded.height(),
        byte_length: bytes.len(),
        model_mime: model_mime.into(),
        model_extension: model_extension.into(),
        model_hash: hash(&model),
    };
    std::fs::create_dir_all(&dir).map_err(|e| format!("创建本地图片目录失败：{e}"))?;
    crate::documents::atomic_write_file(&dir.join(format!("original.{extension}")), &bytes)?;
    crate::documents::atomic_write_file(&dir.join(format!("model.{model_extension}")), &model)?;
    let json = serde_json::to_vec_pretty(&meta).map_err(|e| format!("保存图片信息失败：{e}"))?;
    crate::documents::atomic_write_file(&dir.join("meta.json"), &json)?;
    Ok(response(&meta, &bytes, &model))
}

#[tauri::command]
pub async fn import_local_image(
    data_url: Option<String>,
    path: Option<String>,
    name: Option<String>,
) -> Result<LocalImage, String> {
    let base = crate::sessions::workspace_dir()?;
    tauri::async_runtime::spawn_blocking(move || {
        import_at(&base, data_url.as_deref(), path.as_deref(), name.as_deref())
    })
    .await
    .map_err(|e| format!("导入图片任务失败：{e}"))?
}

#[tauri::command]
pub async fn get_local_image(asset_id: String) -> Result<LocalImage, String> {
    let base = crate::sessions::workspace_dir()?;
    tauri::async_runtime::spawn_blocking(move || get_at(&base, &asset_id))
        .await
        .map_err(|e| format!("读取图片任务失败：{e}"))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    static NEXT: AtomicUsize = AtomicUsize::new(0);
    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!(
                "wxmp-local-images-{}-{}",
                std::process::id(),
                NEXT.fetch_add(1, Ordering::Relaxed)
            ));
            std::fs::create_dir_all(&path).unwrap();
            Self(path)
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }
    fn pixels(format: ImageFormat) -> Vec<u8> {
        let mut data = Cursor::new(Vec::new());
        let mut rgb = image::RgbImage::new(13, 7);
        for (x, y, p) in rgb.enumerate_pixels_mut() {
            *p = image::Rgb([(x * 17) as u8, (y * 31) as u8, 93]);
        }
        DynamicImage::ImageRgb8(rgb)
            .write_to(&mut data, format)
            .unwrap();
        data.into_inner()
    }
    fn url(bytes: &[u8]) -> String {
        format!("data:image/png;base64,{}", STANDARD.encode(bytes))
    }
    fn original(result: &LocalImage) -> Vec<u8> {
        STANDARD
            .decode(result.data_url.split_once(',').unwrap().1)
            .unwrap()
    }

    #[test]
    fn original_bytes_survive_import_reopen_source_removal_and_duplicate() {
        let dir = Fixture::new();
        let bytes = pixels(ImageFormat::Png);
        let path = dir.0.join("活动 现场 中文.PNG");
        std::fs::write(&path, &bytes).unwrap();
        let imported = import_at(&dir.0, None, path.to_str(), None).unwrap();
        assert_eq!(imported.name, "活动 现场 中文.PNG");
        assert_eq!((imported.width, imported.height), (13, 7));
        assert_eq!(original(&imported), bytes);
        assert_eq!(imported.asset_id, format!("li-{}", hash(&bytes)));
        std::fs::remove_file(&path).unwrap();
        let readback = get_at(&dir.0, &imported.asset_id).unwrap();
        assert_eq!(original(&readback), bytes);
        let duplicate = import_at(&dir.0, Some(&url(&bytes)), None, Some("renamed.jpg")).unwrap();
        assert_eq!(duplicate.asset_id, imported.asset_id);
        assert_eq!(original(&duplicate), bytes);
        assert_eq!(
            std::fs::read_dir(dir.0.join("local-images"))
                .unwrap()
                .count(),
            1
        );
    }

    #[test]
    fn format_comes_from_decodable_bytes_not_extension_or_declared_mime() {
        let dir = Fixture::new();
        for (format, mime) in [
            (ImageFormat::Png, "image/png"),
            (ImageFormat::Jpeg, "image/jpeg"),
            (ImageFormat::Gif, "image/gif"),
            (ImageFormat::WebP, "image/webp"),
            (ImageFormat::Bmp, "image/bmp"),
        ] {
            let bytes = pixels(format);
            let stored = import_at(
                &dir.0,
                Some(&url(&bytes)),
                None,
                Some("wrong-extension.txt"),
            )
            .unwrap();
            assert_eq!(stored.mime, mime);
            assert_eq!(original(&stored), bytes);
            let preview = data_url_bytes(&stored.model_data_url).unwrap();
            assert!(image::load_from_memory(&preview).is_ok());
        }
    }

    #[test]
    fn file_url_handles_encoded_unicode_spaces_and_hash() {
        let dir = Fixture::new();
        let path = dir.0.join("现场 图 #1.png");
        let bytes = pixels(ImageFormat::Png);
        std::fs::write(&path, &bytes).unwrap();
        let file_url = reqwest::Url::from_file_path(&path).unwrap().to_string();
        let result = import_at(&dir.0, None, Some(&file_url), None).unwrap();
        assert_eq!(original(&result), bytes);
        assert_eq!(result.name, "现场 图 #1.png");
        assert_eq!(
            exact_path(&format!("\"{}\"", path.display())).unwrap(),
            path
        );
    }

    #[test]
    fn corrupt_or_non_image_inputs_do_not_create_assets() {
        let dir = Fixture::new();
        let mut truncated = pixels(ImageFormat::Png);
        truncated.truncate(36);
        for bytes in [
            b"not a png".as_slice(),
            b"<svg xmlns='http://www.w3.org/2000/svg'/>".as_slice(),
            truncated.as_slice(),
            b"".as_slice(),
        ] {
            assert!(import_at(&dir.0, Some(&url(bytes)), None, None).is_err());
        }
        assert!(!dir.0.join("local-images").exists());
        assert!(import_at(&dir.0, Some("data:image/png;base64,%%%"), None, None).is_err());
        assert!(import_at(&dir.0, None, None, None).is_err());
        assert!(import_at(&dir.0, Some(&url(b"x")), Some("C:/image.png"), None).is_err());
    }

    #[test]
    fn exact_paths_do_not_enable_scans_remote_urls_or_directory_reads() {
        let dir = Fixture::new();
        for path in [
            "image.png",
            "https://example.com/image.png",
            "file://remote-host/share/image.png",
            "\\\\server\\share\\image.png",
            "",
            "\"\"",
            "'",
        ] {
            assert!(exact_path(path).is_err(), "must reject {path}");
        }
        assert!(import_at(&dir.0, None, dir.0.to_str(), None).is_err());
        assert!(import_at(&dir.0, None, dir.0.join("missing.png").to_str(), None).is_err());
    }

    #[test]
    fn stored_integrity_and_id_validation_prevent_wrong_picture_readback() {
        let dir = Fixture::new();
        let bytes = pixels(ImageFormat::Png);
        let result = import_at(&dir.0, Some(&url(&bytes)), None, None).unwrap();
        assert!(get_at(&dir.0, "../../secret").is_err());
        let original_path = image_dir(&dir.0, &result.asset_id)
            .unwrap()
            .join("original.png");
        std::fs::write(original_path, b"corrupt").unwrap();
        assert!(get_at(&dir.0, &result.asset_id)
            .unwrap_err()
            .contains("校验失败"));
        let repaired = import_at(&dir.0, Some(&url(&bytes)), None, None).unwrap();
        assert_eq!(original(&repaired), bytes);
        assert_eq!(original(&get_at(&dir.0, &result.asset_id).unwrap()), bytes);
    }

    #[test]
    fn model_preview_is_bounded_and_does_not_replace_original() {
        let dir = Fixture::new();
        let mut encoded = Cursor::new(Vec::new());
        DynamicImage::new_rgba8(2400, 1200)
            .write_to(&mut encoded, ImageFormat::Png)
            .unwrap();
        let bytes = encoded.into_inner();
        let result = import_at(&dir.0, Some(&url(&bytes)), None, None).unwrap();
        assert_eq!((result.width, result.height), (2400, 1200));
        assert_eq!(original(&result), bytes);
        let preview_bytes = data_url_bytes(&result.model_data_url).unwrap();
        let preview = image::load_from_memory(&preview_bytes).unwrap();
        assert_eq!((preview.width(), preview.height()), (1600, 800));
        assert!(preview_bytes.len() <= MAX_MODEL);
    }

    #[test]
    fn dimension_and_byte_limits_are_checked_before_unbounded_allocation() {
        assert!(check_dimensions(1, 0).is_err());
        assert!(check_dimensions(40000, 1).is_err());
        assert!(check_dimensions(10000, 10000).is_err());
        assert!(check_dimensions(750, 12000).is_ok());
        let dir = Fixture::new();
        let path = dir.0.join("too-big.png");
        File::create(&path)
            .unwrap()
            .set_len(MAX_ORIGINAL as u64 + 1)
            .unwrap();
        assert!(import_at(&dir.0, None, path.to_str(), None)
            .unwrap_err()
            .contains("大小限制"));
    }

    #[test]
    fn original_and_preview_metadata_never_exposes_import_path() {
        let dir = Fixture::new();
        let bytes = pixels(ImageFormat::Png);
        let result = import_at(
            &dir.0,
            Some(&url(&bytes)),
            None,
            Some("C:\\private\\照片.png"),
        )
        .unwrap();
        assert_eq!(result.name, "照片.png");
        let meta = std::fs::read_to_string(
            image_dir(&dir.0, &result.asset_id)
                .unwrap()
                .join("meta.json"),
        )
        .unwrap();
        assert!(!meta.contains("private"));
        assert!(!meta.contains("data:"));
    }

    #[test]
    fn phone_exif_orientation_is_applied_only_to_model_preview() {
        let dir = Fixture::new();
        let jpeg = pixels(ImageFormat::Jpeg);
        // Minimal EXIF TIFF directory: one orientation tag, rotate 90 degrees clockwise.
        let exif: &[u8] =
            b"Exif\0\0II\x2a\0\x08\0\0\0\x01\0\x12\x01\x03\0\x01\0\0\0\x06\0\0\0\0\0\0\0";
        let mut bytes = jpeg[..2].to_vec();
        bytes.extend_from_slice(&[0xff, 0xe1]);
        bytes.extend_from_slice(&((exif.len() + 2) as u16).to_be_bytes());
        bytes.extend_from_slice(exif);
        bytes.extend_from_slice(&jpeg[2..]);
        let result = import_at(&dir.0, Some(&url(&bytes)), None, Some("phone.jpg")).unwrap();
        assert_eq!((result.width, result.height), (7, 13));
        assert_eq!(original(&result), bytes);
        let preview =
            image::load_from_memory(&data_url_bytes(&result.model_data_url).unwrap()).unwrap();
        assert_eq!((preview.width(), preview.height()), (7, 13));
    }

    #[test]
    fn damaged_preview_and_unsafe_metadata_fail_clearly_and_can_be_reimported() {
        let dir = Fixture::new();
        let bytes = pixels(ImageFormat::Png);
        let result = import_at(&dir.0, Some(&url(&bytes)), None, None).unwrap();
        let item = image_dir(&dir.0, &result.asset_id).unwrap();
        let mut meta: StoredImage =
            serde_json::from_slice(&std::fs::read(item.join("meta.json")).unwrap()).unwrap();
        std::fs::write(
            item.join(format!("model.{}", meta.model_extension)),
            b"bad preview",
        )
        .unwrap();
        assert!(get_at(&dir.0, &result.asset_id)
            .unwrap_err()
            .contains("预览校验失败"));
        assert!(import_at(&dir.0, Some(&url(&bytes)), None, None).is_ok());
        meta.extension = "../../secret".into();
        std::fs::write(item.join("meta.json"), serde_json::to_vec(&meta).unwrap()).unwrap();
        assert!(get_at(&dir.0, &result.asset_id)
            .unwrap_err()
            .contains("信息不一致"));
        assert_eq!(
            original(&import_at(&dir.0, Some(&url(&bytes)), None, None).unwrap()),
            bytes
        );
    }
}
