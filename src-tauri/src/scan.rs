use parking_lot::Mutex;
use rayon::prelude::*;
use serde::Serialize;
use std::{
  collections::HashMap,
  path::{Path, PathBuf},
  sync::{
    atomic::{AtomicBool, AtomicU64, Ordering},
    Arc,
  },
  time::Instant,
};
use tauri::{AppHandle, Emitter, Manager, State};
use uuid::Uuid;

#[derive(Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum NodeKind {
  File,
  Dir,
}

#[derive(Clone, Serialize)]
pub struct ScanNode {
  pub name: String,
  pub path: String,
  pub kind: NodeKind,
  pub size: u64,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub children: Option<Vec<ScanNode>>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub omitted_children: Option<u64>,
}

#[derive(Clone, Serialize)]
pub struct ScanProgressEvent {
  pub scan_id: String,
  pub scanned_entries: u64,
  pub scanned_bytes: u64,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub current_path: Option<String>,
}

#[derive(Clone, Serialize)]
pub struct ScanDoneEvent {
  pub scan_id: String,
  pub root: ScanNode,
  pub errors: Vec<String>,
}

#[derive(Default)]
pub struct ScanManager {
  scans: Mutex<HashMap<String, Arc<ScanControl>>>,
}

struct ScanControl {
  cancel: AtomicBool,
}

impl ScanControl {
  fn new() -> Self {
    Self {
      cancel: AtomicBool::new(false),
    }
  }
}

#[tauri::command]
pub async fn start_multi_scan(
  app: AppHandle,
  state: State<'_, ScanManager>,
  paths: Vec<String>,
  max_depth: u32,
  top_children: u32,
) -> Result<Vec<String>, String> {
  let mut scan_ids = Vec::new();

  for path_str in paths {
    let root_path = PathBuf::from(&path_str);
    if !root_path.exists() {
      continue; // Skip invalid paths, but continue with others
    }

    let scan_id = Uuid::new_v4().to_string();
    let control = Arc::new(ScanControl::new());

    state
      .scans
      .lock()
      .insert(scan_id.clone(), Arc::clone(&control));

    let scan_id_for_thread = scan_id.clone();
    let app_clone = app.clone();

    std::thread::spawn(move || {
      let scanned_entries = Arc::new(AtomicU64::new(0));
      let scanned_bytes = Arc::new(AtomicU64::new(0));
      let errors = Arc::new(Mutex::new(Vec::<String>::new()));

      let scan_start = Instant::now();
      let last_emit_ms = Arc::new(AtomicU64::new(0));

      let root = scan_path(
        &app_clone,
        &scan_id_for_thread,
        &root_path,
        0,
        max_depth,
        top_children,
        &control,
        Arc::clone(&scanned_entries),
        Arc::clone(&scanned_bytes),
        Arc::clone(&errors),
        scan_start,
        Arc::clone(&last_emit_ms),
      );

      let root = match root {
        Ok(r) => r,
        Err(e) => {
          errors.lock().push(e);
          ScanNode {
            name: display_name(&root_path),
            path: root_path.to_string_lossy().to_string(),
            kind: NodeKind::Dir,
            size: scanned_bytes.load(Ordering::Relaxed),
            children: Some(vec![]),
            omitted_children: None,
          }
        }
      };

      let done = ScanDoneEvent {
        scan_id: scan_id_for_thread.clone(),
        root,
        errors: errors.lock().clone(),
      };
      let _ = app_clone.emit("scan_done", done);

      if let Some(state) = app_clone.try_state::<ScanManager>() {
        state.scans.lock().remove(&scan_id_for_thread);
      }
    });

    scan_ids.push(scan_id);
  }

  Ok(scan_ids)
}

#[tauri::command]
pub async fn start_scan(
  app: AppHandle,
  state: State<'_, ScanManager>,
  path: String,
  max_depth: u32,
  top_children: u32,
) -> Result<String, String> {
  let root_path = PathBuf::from(path);
  if !root_path.exists() {
    return Err("Path does not exist".to_string());
  }

  let scan_id = Uuid::new_v4().to_string();
  let control = Arc::new(ScanControl::new());

  state
    .scans
    .lock()
    .insert(scan_id.clone(), Arc::clone(&control));

  // Run scan on a background thread (don’t block the command thread).
  let scan_id_for_thread = scan_id.clone();
  std::thread::spawn(move || {
    let scanned_entries = Arc::new(AtomicU64::new(0));
    let scanned_bytes = Arc::new(AtomicU64::new(0));
    let errors = Arc::new(Mutex::new(Vec::<String>::new()));

    let scan_start = Instant::now();
    let last_emit_ms = Arc::new(AtomicU64::new(0));

    let root = scan_path(
      &app,
      &scan_id_for_thread,
      &root_path,
      0,
      max_depth,
      top_children,
      &control,
      Arc::clone(&scanned_entries),
      Arc::clone(&scanned_bytes),
      Arc::clone(&errors),
      scan_start,
      Arc::clone(&last_emit_ms),
    );

    // If cancelled, we still emit done with whatever we computed (or empty root).
    let root = match root {
      Ok(r) => r,
      Err(e) => {
        errors.lock().push(e);
        ScanNode {
          name: display_name(&root_path),
          path: root_path.to_string_lossy().to_string(),
          kind: NodeKind::Dir,
          size: scanned_bytes.load(Ordering::Relaxed),
          children: Some(vec![]),
          omitted_children: None,
        }
      }
    };

    let done = ScanDoneEvent {
      scan_id: scan_id_for_thread.clone(),
      root,
      errors: errors.lock().clone(),
    };
    let _ = app.emit("scan_done", done);

    // cleanup
    if let Some(state) = app.try_state::<ScanManager>() {
      state.scans.lock().remove(&scan_id_for_thread);
    }
  });

  Ok(scan_id)
}

#[tauri::command]
pub async fn cancel_scan(state: State<'_, ScanManager>, scan_id: String) -> Result<(), String> {
  let scans = state.scans.lock();
  if let Some(ctrl) = scans.get(&scan_id) {
    ctrl.cancel.store(true, Ordering::Relaxed);
    Ok(())
  } else {
    Err("Scan not found".to_string())
  }
}

fn scan_path(
  app: &AppHandle,
  scan_id: &str,
  path: &Path,
  depth: u32,
  max_depth: u32,
  top_children: u32,
  control: &Arc<ScanControl>,
  scanned_entries: Arc<AtomicU64>,
  scanned_bytes: Arc<AtomicU64>,
  errors: Arc<Mutex<Vec<String>>>,
  scan_start: Instant,
  last_emit_ms: Arc<AtomicU64>,
) -> Result<ScanNode, String> {
  if control.cancel.load(Ordering::Relaxed) {
    return Err("cancelled".to_string());
  }

  // Resolve metadata early
  let md = match std::fs::symlink_metadata(path) {
    Ok(m) => m,
    Err(e) => return Err(format!("{}: {}", path.to_string_lossy(), e)),
  };

  let is_dir = md.is_dir();
  if !is_dir {
    let sz = md.len();
    scanned_entries.fetch_add(1, Ordering::Relaxed);
    scanned_bytes.fetch_add(sz, Ordering::Relaxed);
    maybe_emit_progress(
      app,
      scan_id,
      scanned_entries.load(Ordering::Relaxed),
      scanned_bytes.load(Ordering::Relaxed),
      Some(path.to_string_lossy().to_string()),
      scan_start,
      &last_emit_ms,
    );
    return Ok(ScanNode {
      name: display_name(path),
      path: path.to_string_lossy().to_string(),
      kind: NodeKind::File,
      size: sz,
      children: None,
      omitted_children: None,
    });
  }

  // Dir
  scanned_entries.fetch_add(1, Ordering::Relaxed);
  maybe_emit_progress(
    app,
    scan_id,
    scanned_entries.load(Ordering::Relaxed),
    scanned_bytes.load(Ordering::Relaxed),
    Some(path.to_string_lossy().to_string()),
    scan_start,
    &last_emit_ms,
  );

  if depth >= max_depth {
    // If we stop at depth, still compute accurate total size, but do not attach children.
    let size = compute_total_size(
      app,
      scan_id,
      path,
      control,
      Arc::clone(&scanned_entries),
      Arc::clone(&scanned_bytes),
      Arc::clone(&errors),
      scan_start,
      &last_emit_ms,
    );
    return Ok(ScanNode {
      name: display_name(path),
      path: path.to_string_lossy().to_string(),
      kind: NodeKind::Dir,
      size,
      children: None,
      omitted_children: None,
    });
  }

  let read_dir = match std::fs::read_dir(path) {
    Ok(rd) => rd,
    Err(e) => {
      errors
        .lock()
        .push(format!("{}: {}", path.to_string_lossy(), e));
      return Ok(ScanNode {
        name: display_name(path),
        path: path.to_string_lossy().to_string(),
        kind: NodeKind::Dir,
        size: 0,
        children: Some(vec![]),
        omitted_children: None,
      });
    }
  };

  let mut child_paths = Vec::<PathBuf>::new();
  for ent in read_dir {
    match ent {
      Ok(e) => child_paths.push(e.path()),
      Err(e) => errors.lock().push(format!("{}: {}", path.to_string_lossy(), e)),
    }
  }

  let mut children: Vec<ScanNode> = child_paths
    .into_par_iter()
    .map(|p| {
    scan_path(
      app,
      scan_id,
      &p,
      depth + 1,
      max_depth,
      top_children,
      control,
      Arc::clone(&scanned_entries),
      Arc::clone(&scanned_bytes),
      Arc::clone(&errors),
        scan_start,
        Arc::clone(&last_emit_ms),
    )
    .unwrap_or_else(|e| {
      errors.lock().push(e);
      ScanNode {
        name: display_name(&p),
        path: p.to_string_lossy().to_string(),
        kind: NodeKind::Dir,
        size: 0,
        children: Some(vec![]),
        omitted_children: None,
      }
    })
  })
  .collect();

  children.sort_by(|a, b| b.size.cmp(&a.size));

  let mut omitted: u64 = 0;
  if top_children > 0 && (children.len() as u32) > top_children {
    omitted = (children.len() as u32 - top_children) as u64;
    children.truncate(top_children as usize);
  }

  let size = children.iter().map(|c| c.size).sum::<u64>();

  Ok(ScanNode {
    name: display_name(path),
    path: path.to_string_lossy().to_string(),
    kind: NodeKind::Dir,
    size,
    children: Some(children),
    omitted_children: if omitted > 0 { Some(omitted) } else { None },
  })
}

fn display_name(path: &Path) -> String {
  path
    .file_name()
    .map(|s| s.to_string_lossy().to_string())
    .unwrap_or_else(|| path.to_string_lossy().to_string())
}

fn maybe_emit_progress(
  app: &AppHandle,
  scan_id: &str,
  scanned_entries: u64,
  scanned_bytes: u64,
  current_path: Option<String>,
  scan_start: Instant,
  last_emit_ms: &AtomicU64,
) {
  // Throttle UI updates (especially for network drives).
  // This must be thread-safe because scanning happens in parallel.
  let now_ms = scan_start.elapsed().as_millis() as u64;
  let min_delta = 120u64;
  loop {
    let prev = last_emit_ms.load(Ordering::Relaxed);
    if now_ms.saturating_sub(prev) < min_delta {
      return;
    }
    if last_emit_ms
      .compare_exchange(prev, now_ms, Ordering::Relaxed, Ordering::Relaxed)
      .is_ok()
    {
      break;
    }
  }

  let payload = ScanProgressEvent {
    scan_id: scan_id.to_string(),
    scanned_entries,
    scanned_bytes,
    current_path,
  };
  let _ = app.emit("scan_progress", payload);
}

fn compute_total_size(
  app: &AppHandle,
  scan_id: &str,
  path: &Path,
  control: &Arc<ScanControl>,
  scanned_entries: Arc<AtomicU64>,
  scanned_bytes: Arc<AtomicU64>,
  errors: Arc<Mutex<Vec<String>>>,
  scan_start: Instant,
  last_emit_ms: &AtomicU64,
) -> u64 {
  let mut total: u64 = 0;
  for entry in jwalk::WalkDir::new(path)
    .follow_links(false)
    .into_iter()
  {
    if control.cancel.load(Ordering::Relaxed) {
      break;
    }
    let entry = match entry {
      Ok(e) => e,
      Err(e) => {
        errors.lock().push(format!("{}: {}", path.to_string_lossy(), e));
        continue;
      }
    };

    let md = match entry.metadata() {
      Ok(m) => m,
      Err(e) => {
        errors
          .lock()
          .push(format!("{}: {}", entry.path().to_string_lossy(), e));
        continue;
      }
    };

    scanned_entries.fetch_add(1, Ordering::Relaxed);
    if md.is_file() {
      let sz = md.len();
      total = total.saturating_add(sz);
      scanned_bytes.fetch_add(sz, Ordering::Relaxed);
    }

    maybe_emit_progress(
      app,
      scan_id,
      scanned_entries.load(Ordering::Relaxed),
      scanned_bytes.load(Ordering::Relaxed),
      Some(entry.path().to_string_lossy().to_string()),
      scan_start,
      last_emit_ms,
    );
  }
  total
}

