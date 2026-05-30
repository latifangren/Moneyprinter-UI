import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  ChevronRight,
  Clapperboard,
  Menu,
  Plus,
  Search,
  X,
} from "lucide-react";
import type { ApiStatus } from "./api";
import { checkApiStatus, formatApiBaseUrl, getApiBaseUrl } from "./api";
import { ApiStatusCard } from "./components/ApiStatusCard";
import { NAV_ITEMS, type PageId } from "./content";
import { AssetsPage } from "./pages/AssetsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { SettingsPage } from "./pages/SettingsPage";
import { StudioPage } from "./pages/StudioPage";
import { TasksPage } from "./pages/TasksPage";
import {
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
          {activePage === "assets" ? <AssetsPage status={apiStatus} submittedTasks={submittedTasks} /> : null}
          {activePage === "settings" ? <SettingsPage status={apiStatus} onRefresh={refreshApiStatus} /> : null}
        </section>
      </main>
    </div>
  );
}

function getInitialPage(): PageId {
  const hash = window.location.hash.replace("#", "");
  const page = NAV_ITEMS.find((item) => item.id === hash);

  return page?.id ?? "dashboard";
}
