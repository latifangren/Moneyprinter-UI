import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clapperboard,
  Loader2,
  Menu,
  PlayCircle,
  Plus,
  RefreshCcw,
  Search,
  UploadCloud,
  X,
} from "lucide-react";
import type { ApiStatus } from "./api";
import {
  checkApiStatus,
  formatApiBaseUrl,
  getApiBaseUrl,
  listTasks,
} from "./api";
import { ApiStatusCard } from "./components/ApiStatusCard";
import { TaskOutputs } from "./components/TaskOutputs";
import { TaskProgress } from "./components/TaskProgress";
import { ASSET_GROUPS, DASHBOARD_METRICS, NAV_ITEMS, type PageId } from "./content";
import { getErrorMessage } from "./apiErrors";
import { StudioPage } from "./pages/StudioPage";
import {
  getTaskSubject,
  mergeTasks,
  taskStatusLabel,
  toSubmittedTask,
  type SubmittedTask,
  type TaskUpdate,
} from "./taskModel";

export function App() {
  const [activePage, setActivePage] = useState<PageId>(() => getInitialPage());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [submittedTasks, setSubmittedTasks] = useState<SubmittedTask[]>([]);
  const [apiStatus, setApiStatus] = useState<ApiStatus>(() => ({
    state: "checking",
    baseUrl: formatApiBaseUrl(getApiBaseUrl()),
    checkedAt: "--:--",
    message: "Checking backend reachability through the task-list probe.",
  }));
  const activeNavItem = useMemo(
    () => NAV_ITEMS.find((item) => item.id === activePage) ?? NAV_ITEMS[0],
    [activePage],
  );

  useEffect(() => {
    void refreshApiStatus();
  }, []);

  useEffect(() => {
    window.history.replaceState(null, "", `#${activePage}`);
  }, [activePage]);

  async function refreshApiStatus() {
    const baseUrl = getApiBaseUrl();
    setApiStatus({
      state: "checking",
      baseUrl: formatApiBaseUrl(baseUrl),
      checkedAt: "--:--",
      message: "Checking backend reachability through the task-list probe.",
    });
    setApiStatus(await checkApiStatus(baseUrl));
  }

  function navigateTo(pageId: PageId) {
    setActivePage(pageId);
    setIsSidebarOpen(false);
  }

  function upsertSubmittedTask(taskId: string, update: TaskUpdate & Pick<SubmittedTask, "subject">) {
    setSubmittedTasks((currentTasks) => {
      const existingTask = currentTasks.find((task) => task.taskId === taskId);
      const updatedAt = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      if (!existingTask) {
        return [
          {
            taskId,
            subject: update.subject,
            status: update.status ?? "submitted",
            progress: update.progress ?? 0,
            createdAt: updatedAt,
            updatedAt,
            message: update.message ?? "Task submitted to MoneyPrinterTurbo.",
            videos: update.videos ?? [],
            combinedVideos: update.combinedVideos ?? [],
          },
          ...currentTasks,
        ];
      }

      return currentTasks.map((task) =>
        task.taskId === taskId
          ? {
              ...task,
              ...update,
              updatedAt,
              videos: update.videos ?? task.videos,
              combinedVideos: update.combinedVideos ?? task.combinedVideos,
            }
          : task,
      );
    });
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient-rose" />
      <div className="ambient ambient-orange" />
      <aside className={`sidebar ${isSidebarOpen ? "sidebar-open" : ""}`} aria-label="Main navigation">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <Clapperboard size={26} />
          </div>
          <div>
            <p className="eyebrow">MoneyPrinter</p>
            <h1>Creator Studio</h1>
          </div>
        </div>

        <nav className="nav-list">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === activePage;

            return (
              <button
                className={`nav-item ${isActive ? "nav-item-active" : ""}`}
                key={item.id}
                type="button"
                onClick={() => navigateTo(item.id)}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="nav-icon" aria-hidden="true">
                  <Icon size={20} />
                </span>
                <span>
                  <span className="nav-label">{item.label}</span>
                  <span className="nav-description">{item.description}</span>
                </span>
                <ChevronRight className="nav-arrow" size={16} aria-hidden="true" />
              </button>
            );
          })}
        </nav>

        <ApiStatusCard status={apiStatus} onRefresh={refreshApiStatus} compact />
      </aside>

      {isSidebarOpen ? (
        <button className="sidebar-scrim" type="button" aria-label="Close navigation" onClick={() => setIsSidebarOpen(false)} />
      ) : null}

      <main className="workspace">
        <header className="topbar">
          <button className="icon-button mobile-menu" type="button" onClick={() => setIsSidebarOpen(true)} aria-label="Open navigation">
            <Menu size={22} />
          </button>
          <div className="page-heading">
            <p className="eyebrow">{activeNavItem.description}</p>
            <h2>{activeNavItem.label}</h2>
          </div>
          <div className="topbar-actions">
            <label className="search-box">
              <Search size={18} aria-hidden="true" />
              <span className="sr-only">Search studio</span>
              <input type="search" placeholder="Search scripts, tasks, assets" />
            </label>
            <button className="icon-button" type="button" aria-label="Notifications">
              <Bell size={20} />
            </button>
            <button className="primary-action" type="button" onClick={() => navigateTo("studio")}>
              <Plus size={18} />
              New video
            </button>
          </div>
          <button className="icon-button close-sidebar" type="button" onClick={() => setIsSidebarOpen(false)} aria-label="Close navigation">
            <X size={22} />
          </button>
        </header>

        <section className="content-grid" aria-live="polite">
          {activePage === "dashboard" ? <DashboardPage status={apiStatus} onRefresh={refreshApiStatus} /> : null}
          {activePage === "studio" ? <StudioPage status={apiStatus} onTaskChange={upsertSubmittedTask} /> : null}
          {activePage === "tasks" ? <TasksPage status={apiStatus} submittedTasks={submittedTasks} /> : null}
          {activePage === "assets" ? <AssetsPage /> : null}
          {activePage === "settings" ? <SettingsPage status={apiStatus} onRefresh={refreshApiStatus} /> : null}
        </section>
      </main>
    </div>
  );
}

function DashboardPage({ status, onRefresh }: { status: ApiStatus; onRefresh: () => Promise<void> }) {
  return (
    <>
      <section className="hero-card panel-card">
        <div>
          <p className="eyebrow">Dark cinematic command studio</p>
          <h3>Plan, queue, and track AI video stories from one creator cockpit.</h3>
          <p className="hero-copy">
            Phase 2 connects Create Studio to live MoneyPrinterTurbo endpoints for script, terms, render submission,
            progress polling, and output previews.
          </p>
          <div className="hero-actions">
            <button className="primary-action" type="button">
              <PlayCircle size={18} />
              Start a concept
            </button>
            <button className="secondary-action" type="button">
              <UploadCloud size={18} />
              Import assets
            </button>
          </div>
        </div>
        <div className="hero-preview">
          <span className="sr-only">Creator workflow preview: Script, Terms, Render</span>
          <span className="preview-pill">Script</span>
          <span className="preview-line" />
          <span className="preview-pill accent">Terms</span>
          <span className="preview-line" />
          <span className="preview-pill warm">Render</span>
        </div>
      </section>

      <div className="metrics-grid">
        {DASHBOARD_METRICS.map((metric) => {
          const Icon = metric.icon;

          return (
            <article className="metric-card panel-card" key={metric.label}>
              <span className="metric-icon" aria-hidden="true">
                <Icon size={21} />
              </span>
              <p>{metric.label}</p>
              <strong>{metric.value}</strong>
              <span>{metric.trend}</span>
            </article>
          );
        })}
      </div>

      <div className="two-column-grid">
        <ApiStatusCard status={status} onRefresh={onRefresh} />
        <TaskQueueCard />
      </div>
    </>
  );
}

function TasksPage({ status, submittedTasks }: { status: ApiStatus; submittedTasks: SubmittedTask[] }) {
  const [serverTasks, setServerTasks] = useState<SubmittedTask[]>([]);
  const [taskError, setTaskError] = useState("");
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const backendReady = status.state === "online";

  useEffect(() => {
    if (!backendReady) {
      setServerTasks([]);
      return;
    }

    const controller = new AbortController();
    void refreshTasks(controller.signal);
    const intervalId = window.setInterval(() => void refreshTasks(controller.signal), 5000);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [backendReady]);

  async function refreshTasks(signal?: AbortSignal) {
    setIsLoadingTasks(true);
    setTaskError("");

    try {
      const response = await listTasks(1, 12, signal);
      setServerTasks(response.tasks.map((task) => toSubmittedTask(task, getTaskSubject(task), task.task_id ?? "unknown-task")));
    } catch (error) {
      if (!signal?.aborted) {
        setTaskError(getErrorMessage(error));
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoadingTasks(false);
      }
    }
  }

  const mergedTasks = mergeTasks(submittedTasks, serverTasks);

  return (
    <section className="panel-card table-card">
      <div className="section-title-row">
        <div>
          <p className="eyebrow">Tasks</p>
          <h3>Live generation queue</h3>
        </div>
        <button className="secondary-action" type="button" onClick={() => void refreshTasks()} disabled={!backendReady || isLoadingTasks}>
          {isLoadingTasks ? <Loader2 className="spin-icon" size={17} /> : <RefreshCcw size={17} />}
          {isLoadingTasks ? "Loading" : "Refresh tasks"}
        </button>
      </div>
      {!backendReady ? <p className="form-alert form-alert-info">Backend is offline, so only tasks submitted in this UI session can appear here.</p> : null}
      {taskError ? <p className="form-alert form-alert-error">{taskError}</p> : null}
      <div className="task-list">
        {mergedTasks.length > 0 ? (
          mergedTasks.map((task) => (
            <article className="task-row task-row-live" key={task.taskId}>
              <span className="task-avatar" aria-hidden="true">
                <Clapperboard size={19} />
              </span>
              <div>
                <h4>{task.subject}</h4>
                <p>{task.taskId}</p>
                <TaskProgress task={task} compact />
              </div>
              <span className={`status-chip task-status-${task.status}`}>{taskStatusLabel(task.status)}</span>
              <strong>{task.updatedAt}</strong>
              <TaskOutputs task={task} compact />
            </article>
          ))
        ) : (
          <div className="empty-state">
            <Activity size={24} aria-hidden="true" />
            <p>No submitted tasks yet. Use Create Studio to submit a real video generation task.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function AssetsPage() {
  return (
    <>
      <section className="panel-card section-title-row">
        <div>
          <p className="eyebrow">Assets</p>
          <h3>Reusable creator materials</h3>
        </div>
        <button className="primary-action" type="button">
          <UploadCloud size={18} />
          Add asset
        </button>
      </section>
      <section className="assets-grid">
        {ASSET_GROUPS.map((group) => {
          const Icon = group.icon;

          return (
            <article className="panel-card asset-card" key={group.title}>
              <span className="asset-icon" aria-hidden="true">
                <Icon size={24} />
              </span>
              <p>{group.title}</p>
              <strong>{group.count}</strong>
              <span>Placeholder collection</span>
            </article>
          );
        })}
      </section>
    </>
  );
}

function SettingsPage({ status, onRefresh }: { status: ApiStatus; onRefresh: () => Promise<void> }) {
  return (
    <div className="two-column-grid">
      <ApiStatusCard status={status} onRefresh={onRefresh} />
      <section className="panel-card settings-card">
        <p className="eyebrow">Typed API handling</p>
        <h3>Environment</h3>
        <dl>
          <div>
            <dt>Variable</dt>
            <dd>VITE_API_BASE_URL</dd>
          </div>
          <div>
            <dt>Default</dt>
            <dd>http://127.0.0.1:8080</dd>
          </div>
          <div>
            <dt>Probe path</dt>
            <dd>/api/v1/tasks?page=1&page_size=1</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

function TaskQueueCard() {
  return (
    <section className="panel-card queue-card">
      <div className="section-title-row">
        <div>
          <p className="eyebrow">Workflow</p>
          <h3>Next actions</h3>
        </div>
        <CheckCircle2 size={24} aria-hidden="true" />
      </div>
      <ol>
        <li>Start backend with `api.bat` before live generation.</li>
        <li>Use Create Studio to call `/api/v1/scripts`, `/terms`, and `/videos`.</li>
        <li>Review completed outputs from task polling and the Tasks page.</li>
      </ol>
    </section>
  );
}

function getInitialPage(): PageId {
  const hash = window.location.hash.replace("#", "");
  const page = NAV_ITEMS.find((item) => item.id === hash);

  return page?.id ?? "dashboard";
}
