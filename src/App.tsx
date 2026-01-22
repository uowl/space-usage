import { useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

type NodeKind = "file" | "dir";

type ScanProgressEvent = {
  scan_id: string;
  scanned_entries: number;
  scanned_bytes: number;
  current_path?: string;
};

type ScanDoneEvent = {
  scan_id: string;
  root: ScanNode;
  errors: string[];
};

type SortField = "size" | "name" | "type";
type SortDirection = "asc" | "desc";

type ScanNode = {
  name: string;
  path: string;
  kind: NodeKind;
  size: number;
  children?: ScanNode[];
  omitted_children?: number;
};

function formatBytes(bytes: number) {
  const b = Math.max(0, bytes);
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  if (b < 1024) return `${b} B`;
  const exp = Math.min(units.length - 1, Math.floor(Math.log(b) / Math.log(1024)));
  const val = b / Math.pow(1024, exp);
  return `${val.toFixed(val >= 10 ? 1 : 2)} ${units[exp]}`;
}

export default function App() {
  const [paths, setPaths] = useState<string[]>([""]);
  const [maxDepth, setMaxDepth] = useState<number>(6);
  const [topChildren, setTopChildren] = useState<number>(200);
  const [scanIds, setScanIds] = useState<string[]>([]);

  const [progress, setProgress] = useState<Map<string, ScanProgressEvent>>(new Map());
  const [roots, setRoots] = useState<Map<string, ScanNode>>(new Map());
  const [scanIdToPath, setScanIdToPath] = useState<Map<string, string>>(new Map());
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<Map<string, { field: SortField; dir: SortDirection }>>(
    new Map()
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "scanning" | "done">("idle");

  const unlistenRefs = useRef<(() => void)[]>([]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const unlistenProgress = await listen<ScanProgressEvent>("scan_progress", (e) => {
        if (!mounted) return;
        setProgress((prev) => {
          const next = new Map(prev);
          next.set(e.payload.scan_id, e.payload);
          return next;
        });
      });
      const unlistenDone = await listen<ScanDoneEvent>("scan_done", (e) => {
        if (!mounted) return;
        const rootPath = e.payload.root.path;
        setRoots((prev) => {
          const next = new Map(prev);
          next.set(e.payload.scan_id, e.payload.root);
          return next;
        });
        setScanIdToPath((prev) => {
          const next = new Map(prev);
          next.set(e.payload.scan_id, rootPath);
          return next;
        });
        setErrors((prev) => [...prev, ...(e.payload.errors ?? [])]);
        setScanIds((prev) => {
          const remaining = prev.filter((id) => id !== e.payload.scan_id);
          if (remaining.length === 0) {
            setStatus("done");
          }
          return remaining;
        });
        // Set active tab if none selected
        setActiveTab((prev) => prev || rootPath);
      });
      unlistenRefs.current = [unlistenProgress, unlistenDone];
    })();

    return () => {
      mounted = false;
      for (const un of unlistenRefs.current) un();
      unlistenRefs.current = [];
    };
  }, []);

  const tabResults = useMemo(() => {
    const results = new Map<string, { root: ScanNode; children: Array<{ node: ScanNode; pct: number }> }>();

    for (const [scanId, root] of roots.entries()) {
      const path = scanIdToPath.get(scanId) || root.path;
      const children = root.children ?? [];
      const total = Math.max(1, root.size);

      let sorted = children.map((node) => ({
        node,
        pct: (node.size / total) * 100,
      }));

      // Apply sorting
      const sort = sortBy.get(path) || { field: "size" as SortField, dir: "desc" as SortDirection };
      sorted.sort((a, b) => {
        let cmp = 0;
        switch (sort.field) {
          case "size":
            cmp = a.node.size - b.node.size;
            break;
          case "name":
            cmp = a.node.name.localeCompare(b.node.name);
            break;
          case "type":
            cmp = a.node.kind.localeCompare(b.node.kind);
            break;
        }
        return sort.dir === "asc" ? cmp : -cmp;
      });

      results.set(path, { root, children: sorted });
    }

    return results;
  }, [roots, scanIdToPath, sortBy]);

  async function startScan() {
    const validPaths = paths.map((p) => p.trim()).filter((p) => p.length > 0);
    if (validPaths.length === 0) return;
    if (validPaths.length > 10) {
      alert("Maximum 10 locations allowed");
      return;
    }

    setStatus("scanning");
    setRoots(new Map());
    setScanIdToPath(new Map());
    setErrors([]);
    setProgress(new Map());
    setActiveTab(null);
    setSortBy(new Map());

    const ids = await invoke<string[]>("start_multi_scan", {
      paths: validPaths,
      maxDepth,
      topChildren,
    });
    setScanIds(ids);
    // Map scan IDs to paths (assuming order matches)
    const idToPathMap = new Map<string, string>();
    for (let i = 0; i < ids.length && i < validPaths.length; i++) {
      idToPathMap.set(ids[i], validPaths[i]);
    }
    setScanIdToPath(idToPathMap);
  }

  async function scanPath(nextPath: string) {
    const trimmed = nextPath.trim();
    if (!trimmed) return;
    setPaths([trimmed]);
    setStatus("scanning");
    setRoots(new Map());
    setErrors([]);
    setProgress(new Map());
    const ids = await invoke<string[]>("start_multi_scan", {
      paths: [trimmed],
      maxDepth,
      topChildren,
    });
    setScanIds(ids);
  }

  async function cancelScan() {
    if (scanIds.length === 0) return;
    for (const id of scanIds) {
      await invoke("cancel_scan", { scanId: id }).catch(() => {});
    }
    setScanIds([]);
    setStatus("idle");
  }

  function addPath() {
    if (paths.length >= 10) {
      alert("Maximum 10 locations allowed");
      return;
    }
    setPaths([...paths, ""]);
  }

  function setSort(path: string, field: SortField) {
    setSortBy((prev) => {
      const next = new Map(prev);
      const current = next.get(path);
      if (current?.field === field) {
        // Toggle direction
        next.set(path, { field, dir: current.dir === "asc" ? "desc" : "asc" });
      } else {
        // Default to desc for size, asc for name/type
        next.set(path, { field, dir: field === "size" ? "desc" : "asc" });
      }
      return next;
    });
  }

  function removePath(index: number) {
    setPaths(paths.filter((_, i) => i !== index));
  }

  function updatePath(index: number, value: string) {
    const updated = [...paths];
    updated[index] = value;
    setPaths(updated);
  }

  return (
    <div className="app">
      <div className="card">
        <h2 style={{ margin: "0 0 6px 0" }}>Space Usage</h2>
        <div className="muted" style={{ marginBottom: 14 }}>
          Scan a folder or mounted network path. Example: <code>/</code>, <code>/home</code>,{" "}
          <code>/mnt/nas</code>, <code>C:\</code>, <code>\\server\share</code>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {paths.map((path, index) => (
            <div key={index} className="row">
              <input
                value={path}
                onChange={(e) => updatePath(index, e.target.value)}
                placeholder={`Path ${index + 1} to scan`}
                spellCheck={false}
                style={{ flex: 1 }}
              />
              <button
                onClick={async () => {
                  const selection = await open({
                    directory: true,
                    multiple: false,
                    title: "Select a folder to scan",
                  });
                  if (typeof selection === "string") updatePath(index, selection);
                }}
                disabled={status === "scanning"}
              >
                Browse…
              </button>
              {paths.length > 1 && (
                <button
                  onClick={() => removePath(index)}
                  disabled={status === "scanning"}
                  style={{ background: "var(--danger)" }}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <div className="row">
            <button
              onClick={addPath}
              disabled={status === "scanning" || paths.length >= 10}
              style={{ background: "var(--success)", marginRight: "auto" }}
            >
              + Add location {paths.length >= 10 ? "(max 10)" : ""}
            </button>
            <button
              onClick={startScan}
              disabled={
                status === "scanning" ||
                paths.every((p) => !p.trim())
              }
            >
              Start scan
            </button>
            <button
              onClick={cancelScan}
              disabled={status !== "scanning" || scanIds.length === 0}
            >
              Cancel
            </button>
          </div>
        </div>

        <div className="row" style={{ marginTop: 10 }}>
          <label className="muted">
            Max depth{" "}
            <input
              style={{ width: 90, minWidth: 90 }}
              type="number"
              min={1}
              max={50}
              value={maxDepth}
              onChange={(e) => setMaxDepth(Number(e.target.value || 6))}
            />
          </label>
          <label className="muted">
            Top children per folder{" "}
            <input
              style={{ width: 110, minWidth: 110 }}
              type="number"
              min={10}
              max={2000}
              value={topChildren}
              onChange={(e) => setTopChildren(Number(e.target.value || 200))}
            />
          </label>
          {status === "scanning" && (
            <span className="muted">
              {progress.size > 0 && (
                <>
                  Scanned{" "}
                  {formatBytes(
                    Array.from(progress.values()).reduce(
                      (acc, p) => acc + (p.scanned_bytes ?? 0),
                      0
                    )
                  )}{" "}
                  across{" "}
                  {Array.from(progress.values())
                    .reduce((acc, p) => acc + (p.scanned_entries ?? 0), 0)
                    .toLocaleString()}{" "}
                  entries ({progress.size} location{progress.size !== 1 ? "s" : ""})
                </>
              )}
            </span>
          )}
        </div>

        {status === "scanning" &&
          Array.from(progress.values())
            .filter((p) => p.current_path)
            .map((p, i) => (
              <div key={i} className="muted" style={{ marginTop: 10 }}>
                Current: <code>{p.current_path}</code>
              </div>
            ))}
      </div>

      {tabResults.size > 0 && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="tabs">
            {Array.from(tabResults.keys()).map((path) => {
              const result = tabResults.get(path)!;
              const isActive = activeTab === path;
              return (
                <button
                  key={path}
                  className={`tab ${isActive ? "active" : ""}`}
                  onClick={() => setActiveTab(path)}
                >
                  {path}
                  <span className="muted" style={{ marginLeft: 8 }}>
                    ({formatBytes(result.root.size)})
                  </span>
                </button>
              );
            })}
          </div>

          {activeTab && tabResults.has(activeTab) && (() => {
            const result = tabResults.get(activeTab)!;
            const sort = sortBy.get(activeTab) || { field: "size" as SortField, dir: "desc" as SortDirection };
            return (
              <div>
                <div className="row" style={{ justifyContent: "space-between", marginTop: 16, marginBottom: 12 }}>
                  <div>
                    <div className="muted">Location</div>
                    <div style={{ fontWeight: 600 }}>{result.root.path}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="muted">Total size</div>
                    <div style={{ fontWeight: 700 }}>{formatBytes(result.root.size)}</div>
                  </div>
                </div>

                <div className="row" style={{ marginBottom: 10, gap: 8 }}>
                  <span className="muted">Sort by:</span>
                  <button
                    className={`sort-btn ${sort.field === "size" ? "active" : ""}`}
                    onClick={() => setSort(activeTab, "size")}
                  >
                    Size {sort.field === "size" && (sort.dir === "desc" ? "↓" : "↑")}
                  </button>
                  <button
                    className={`sort-btn ${sort.field === "name" ? "active" : ""}`}
                    onClick={() => setSort(activeTab, "name")}
                  >
                    Name {sort.field === "name" && (sort.dir === "desc" ? "↓" : "↑")}
                  </button>
                  <button
                    className={`sort-btn ${sort.field === "type" ? "active" : ""}`}
                    onClick={() => setSort(activeTab, "type")}
                  >
                    Type {sort.field === "type" && (sort.dir === "desc" ? "↓" : "↑")}
                  </button>
                </div>

                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: "50%" }}>Name</th>
                      <th>Type</th>
                      <th>Size</th>
                      <th style={{ width: "30%" }}>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.children.map(({ node, pct }) => (
                      <tr key={node.path}>
                        <td title={node.path}>
                          {node.kind === "dir" ? (
                            <button
                              style={{
                                padding: 0,
                                border: "none",
                                background: "transparent",
                                textAlign: "left",
                                color: "inherit",
                                cursor: "pointer",
                                font: "inherit",
                              }}
                              onClick={() => scanPath(node.path)}
                              disabled={status === "scanning"}
                              title="Click to scan this folder"
                            >
                              {node.name}
                            </button>
                          ) : (
                            node.name
                          )}
                        </td>
                        <td>{node.kind}</td>
                        <td>{formatBytes(node.size)}</td>
                        <td>
                          <div className="bar" aria-label={`${pct.toFixed(2)}%`}>
                            <div style={{ width: `${Math.max(0.4, pct)}%` }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {result.root.omitted_children ? (
                  <div className="muted" style={{ marginTop: 10 }}>
                    Omitted {result.root.omitted_children.toLocaleString()} children from the root
                    (increase "Top children per folder" to include more).
                  </div>
                ) : null}
              </div>
            );
          })()}
        </div>
      )}

      {errors.length > 0 && (
        <div className="card" style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Errors (non-fatal)</div>
          <div className="muted" style={{ marginBottom: 10 }}>
            Permission / IO failures are expected on some paths; the scan continues.
          </div>
          <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
            {errors.slice(0, 200).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
          {errors.length > 200 ? (
            <div className="muted" style={{ marginTop: 10 }}>
              Showing first 200 of {errors.length.toLocaleString()}.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

