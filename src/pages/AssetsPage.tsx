import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { ExternalLink, FileVideo, FolderOpen, Loader2, RefreshCcw, ScanSearch, Search } from "lucide-react";
import type { ApiStatus } from "../api";
import { getApiBaseUrl, listTasks, resolveOutputUrl } from "../api";
import { getErrorMessage } from "../apiErrors";
import { OutputInspectorDialog } from "../components/OutputInspectorDialog";
import {
  createGeneratedAssets,
  filterGeneratedAssets,
  getAssetKindCounts,
  getAssetStatusCounts,
  type AssetKindFilter,
} from "../assetsModel";
import type { OutputInspectSelection } from "../outputInspectorModel";
import { isVideoOutputUrl } from "../outputUrl";
import {
  getTaskSubject,
  mergeTasks,
  taskStatusLabel,
  toSubmittedTask,
  type SubmittedTask,
  type TaskStatusFilter,
} from "../taskModel";

type AssetsPageProps = {
  status: ApiStatus;
  submittedTasks: SubmittedTask[];
};

type AssetServerState = {
  serverTasks: SubmittedTask[];
  assetError: string;
  isLoadingAssets: boolean;
  lastRefreshedAt: string;
};

type AssetServerAction =
  | { type: "offline" }
  | { type: "loading" }
  | { type: "loaded"; tasks: SubmittedTask[]; refreshedAt: string }
  | { type: "failed"; error: string };

const INITIAL_ASSET_SERVER_STATE: AssetServerState = {
  serverTasks: [],
  assetError: "",
  isLoadingAssets: false,
  lastRefreshedAt: "",
};

const ASSET_KIND_FILTERS: { id: AssetKindFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "combined", label: "Combined" },
  { id: "clip", label: "Clips" },
];

const ASSET_STATUS_FILTERS: { id: TaskStatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "complete", label: "Complete" },
  { id: "needs-attention", label: "Needs attention" },
];

function assetServerReducer(state: AssetServerState, action: AssetServerAction): AssetServerState {
  switch (action.type) {
    case "offline":
      return {
        ...state,
        serverTasks: [],
        assetError: "",
        isLoadingAssets: false,
      };
    case "loading":
      return {
        ...state,
        assetError: "",
        isLoadingAssets: true,
      };
    case "loaded":
      return {
        ...state,
        serverTasks: action.tasks,
        lastRefreshedAt: action.refreshedAt,
        isLoadingAssets: false,
      };
    case "failed":
      return {
        ...state,
        assetError: action.error,
        isLoadingAssets: false,
      };
  }
}

export function AssetsPage({ status, submittedTasks }: AssetsPageProps) {
  const [assetServerState, dispatchAssetServer] = useReducer(assetServerReducer, INITIAL_ASSET_SERVER_STATE);
  const [searchQuery, setSearchQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<AssetKindFilter>("all");
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>("all");
  const [inspectorSelection, setInspectorSelection] = useState<OutputInspectSelection | null>(null);
  const manualRefreshControllerRef = useRef<AbortController | null>(null);
  const refreshGenerationRef = useRef(0);
  const backendReady = status.state === "online";
  const { serverTasks, assetError, isLoadingAssets, lastRefreshedAt } = assetServerState;

  const refreshAssets = useCallback(async (signal: AbortSignal) => {
    if (!backendReady) {
      return;
    }

    const refreshGeneration = refreshGenerationRef.current + 1;
    refreshGenerationRef.current = refreshGeneration;
    dispatchAssetServer({ type: "loading" });

    try {
      const response = await listTasks(1, 50, signal);
      if (signal.aborted || refreshGeneration !== refreshGenerationRef.current) {
        return;
      }

      dispatchAssetServer({
        type: "loaded",
        tasks: response.tasks.map((task) => toSubmittedTask(task, getTaskSubject(task), task.task_id ?? "unknown-task")),
        refreshedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
    } catch (error) {
      if (!signal.aborted && refreshGeneration === refreshGenerationRef.current) {
        dispatchAssetServer({ type: "failed", error: getErrorMessage(error) });
      }
    }
  }, [backendReady]);

  useEffect(() => {
    if (!backendReady) {
      manualRefreshControllerRef.current?.abort();
      manualRefreshControllerRef.current = null;
      dispatchAssetServer({ type: "offline" });
      return;
    }

    const controller = new AbortController();
    void refreshAssets(controller.signal);

    return () => {
      controller.abort();
      manualRefreshControllerRef.current?.abort();
      manualRefreshControllerRef.current = null;
    };
  }, [backendReady, refreshAssets]);

  function handleRefreshAssets() {
    if (!backendReady) {
      return;
    }

    manualRefreshControllerRef.current?.abort();
    const controller = new AbortController();
    manualRefreshControllerRef.current = controller;
    void refreshAssets(controller.signal).finally(() => {
      if (manualRefreshControllerRef.current === controller) {
        manualRefreshControllerRef.current = null;
      }
    });
  }

  const mergedTasks = useMemo(() => mergeTasks(submittedTasks, serverTasks), [serverTasks, submittedTasks]);
  const tasksById = useMemo(() => new Map(mergedTasks.map((task) => [task.taskId, task])), [mergedTasks]);
  const generatedAssets = useMemo(() => createGeneratedAssets(mergedTasks, getApiBaseUrl()), [mergedTasks]);
  const kindCounts = useMemo(() => getAssetKindCounts(generatedAssets), [generatedAssets]);
  const statusCounts = useMemo(() => getAssetStatusCounts(generatedAssets), [generatedAssets]);
  const filteredAssets = useMemo(
    () => filterGeneratedAssets(generatedAssets, { query: searchQuery, kindFilter, statusFilter }),
    [generatedAssets, kindFilter, searchQuery, statusFilter],
  );
  const refreshStatus = backendReady
    ? `Manual refresh available${lastRefreshedAt ? `, last ${lastRefreshedAt}` : ""}`
    : "Backend offline; showing current-session outputs only";
  const emptyMessage = getEmptyAssetMessage(generatedAssets.length, filteredAssets.length, backendReady);

  return (
    <>
    <section className="panel-card assets-browser" aria-labelledby="assets-browser-heading">
      <div className="section-title-row assets-browser-header">
        <div>
          <p className="eyebrow">Assets</p>
          <h3 id="assets-browser-heading">Generated output browser</h3>
          <p>Read-only view of task outputs from the backend task list and this browser session.</p>
        </div>
        <button className="secondary-action" type="button" onClick={handleRefreshAssets} disabled={!backendReady || isLoadingAssets}>
          {isLoadingAssets ? <Loader2 className="spin-icon" size={17} /> : <RefreshCcw size={17} />}
          {isLoadingAssets ? "Loading" : "Refresh assets"}
        </button>
      </div>

      <div className="asset-control-panel">
        <label className="search-box asset-search-box">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search generated assets</span>
          <input value={searchQuery} type="search" placeholder="Search filename, subject, or task ID" onChange={(event) => setSearchQuery(event.target.value)} />
        </label>

        <fieldset className="asset-filter-block" aria-label="Filter by output kind">
          {ASSET_KIND_FILTERS.map((option) => (
            <button
              className={`status-chip task-filter-chip ${kindFilter === option.id ? "task-filter-chip-active" : ""}`}
              type="button"
              onClick={() => setKindFilter(option.id)}
              aria-pressed={kindFilter === option.id}
              key={option.id}
            >
              {option.label}
              <span>{kindCounts[option.id]}</span>
            </button>
          ))}
        </fieldset>

        <fieldset className="asset-filter-block" aria-label="Filter by task status">
          {ASSET_STATUS_FILTERS.map((option) => (
            <button
              className={`status-chip task-filter-chip ${statusFilter === option.id ? "task-filter-chip-active" : ""}`}
              type="button"
              onClick={() => setStatusFilter(option.id)}
              aria-pressed={statusFilter === option.id}
              key={option.id}
            >
              {option.label}
              <span>{statusCounts[option.id]}</span>
            </button>
          ))}
        </fieldset>
      </div>

      <div className="asset-refresh-meta" aria-live="polite">
        <span>{refreshStatus}</span>
        <span>{filteredAssets.length} of {generatedAssets.length} outputs shown</span>
      </div>
      {!backendReady ? <p className="form-alert form-alert-info">Backend is offline. Server task outputs were cleared, but current-session submitted outputs remain visible when available.</p> : null}
      {assetError ? <p className="form-alert form-alert-error">{assetError}</p> : null}

      {filteredAssets.length > 0 ? (
        <div className="generated-assets-grid">
          {filteredAssets.map((asset) => {
            const outputUrl = resolveOutputUrl(asset.outputPath);
            const matchedTask = tasksById.get(asset.taskId);

            return (
              <article className="generated-asset-card" key={asset.id}>
                <div className="asset-preview-frame">
                  {isVideoOutputUrl(outputUrl) ? (
                    <video controls src={outputUrl} preload="metadata" aria-label={asset.filename}>
                      <track kind="captions" label="Generated captions" srcLang="en" src="data:text/vtt,WEBVTT%0A%0A" />
                    </video>
                  ) : (
                    <div className="asset-file-preview">
                      <FileVideo size={28} aria-hidden="true" />
                    </div>
                  )}
                </div>

                <div className="asset-card-body">
                  <div className="asset-card-title-row">
                    <a className="asset-output-link" href={outputUrl} target="_blank" rel="noreferrer">
                      <ExternalLink size={16} aria-hidden="true" />
                      {asset.filename}
                    </a>
                    <span className={`status-chip asset-kind-${asset.kind}`}>{asset.kind}</span>
                  </div>
                  <button
                    className="output-inspect-button asset-inspect-button"
                    type="button"
                    onClick={() => matchedTask && setInspectorSelection({ task: matchedTask, outputPath: asset.outputPath, kind: asset.kind })}
                    disabled={!matchedTask}
                    aria-label={`Inspect ${asset.filename}`}
                  >
                    <ScanSearch size={16} aria-hidden="true" />
                    Inspect
                  </button>
                  <p>{asset.subject}</p>
                  <dl className="asset-safe-meta">
                    <div>
                      <dt>Task</dt>
                      <dd>{asset.taskId}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd><span className={`status-chip task-status-${asset.status}`}>{taskStatusLabel(asset.status)}</span></dd>
                    </div>
                    <div>
                      <dt>Updated</dt>
                      <dd>{asset.updatedAt}</dd>
                    </div>
                  </dl>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state assets-empty-state">
          <FolderOpen size={24} aria-hidden="true" />
          <p>{emptyMessage}</p>
        </div>
      )}
    </section>
    <OutputInspectorDialog selection={inspectorSelection} onClose={() => setInspectorSelection(null)} />
    </>
  );
}

function getEmptyAssetMessage(assetCount: number, filteredCount: number, backendReady: boolean): string {
  if (assetCount > 0 && filteredCount === 0) {
    return "No generated outputs match these filters.";
  }
  if (backendReady) {
    return "No generated outputs found yet. Completed tasks with returned video outputs will appear here.";
  }
  return "No current-session outputs to show while backend is offline.";
}
