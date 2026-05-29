import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clapperboard,
  Clock3,
  Database,
  ExternalLink,
  FileVideo,
  FolderOpen,
  Gauge,
  Image,
  LayoutDashboard,
  Loader2,
  Menu,
  Palette,
  PlayCircle,
  Plus,
  RefreshCcw,
  Search,
  Settings,
  Sparkles,
  UploadCloud,
  Wand2,
  X,
} from "lucide-react";
import type { ApiStatus, CreateVideoPayload, TaskData } from "./api";
import {
  checkApiStatus,
  createVideo,
  formatApiBaseUrl,
  generateScript,
  generateTerms,
  getApiBaseUrl,
  getTask,
  listTasks,
  resolveOutputUrl,
} from "./api";

type PageId = "dashboard" | "studio" | "tasks" | "assets" | "settings";

type NavItem = {
  id: PageId;
  label: string;
  description: string;
  icon: typeof LayoutDashboard;
};

type Metric = {
  label: string;
  value: string;
  trend: string;
  icon: typeof Gauge;
};

type SubmittedTaskStatus = "submitted" | "processing" | "complete" | "failed" | "error" | "timeout";

type SubmittedTask = {
  taskId: string;
  subject: string;
  status: SubmittedTaskStatus;
  progress: number;
  createdAt: string;
  updatedAt: string;
  message: string;
  videos: string[];
  combinedVideos: string[];
};

type TaskUpdate = Partial<Omit<SubmittedTask, "taskId" | "createdAt">>;

const DEFAULT_VIDEO_LANGUAGE = "en";
const DEFAULT_PARAGRAPH_NUMBER = 1;
const DEFAULT_TERMS_AMOUNT = 5;
const TASK_POLL_INTERVAL_MS = 2500;
const TASK_POLL_MAX_ATTEMPTS = 120;

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", description: "Overview", icon: LayoutDashboard },
  { id: "studio", label: "Create Studio", description: "Script to video", icon: Wand2 },
  { id: "tasks", label: "Tasks", description: "Generation queue", icon: Activity },
  { id: "assets", label: "Assets", description: "Materials", icon: FolderOpen },
  { id: "settings", label: "Settings", description: "API and defaults", icon: Settings },
];

const DASHBOARD_METRICS: Metric[] = [
  { label: "Draft concepts", value: "12", trend: "+4 this week", icon: Sparkles },
  { label: "Queued videos", value: "Live", trend: "Backed by FastAPI tasks", icon: Clock3 },
  { label: "Asset folders", value: "08", trend: "Local workspace", icon: Database },
  { label: "Render health", value: "Phase 2", trend: "Real API flow", icon: Gauge },
];

const ASSET_GROUPS = [
  { title: "Source images", count: "24", icon: Image },
  { title: "Video clips", count: "16", icon: FileVideo },
  { title: "Voice presets", count: "06", icon: Palette },
];

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

function StudioPage({
  status,
  onTaskChange,
}: {
  status: ApiStatus;
  onTaskChange: (taskId: string, update: TaskUpdate & Pick<SubmittedTask, "subject">) => void;
}) {
  const [subject, setSubject] = useState("");
  const [script, setScript] = useState("");
  const [terms, setTerms] = useState("");
  const [language, setLanguage] = useState(DEFAULT_VIDEO_LANGUAGE);
  const [paragraphNumber, setParagraphNumber] = useState(DEFAULT_PARAGRAPH_NUMBER);
  const [termsAmount, setTermsAmount] = useState(DEFAULT_TERMS_AMOUNT);
  const [aspect, setAspect] = useState<CreateVideoPayload["video_aspect"]>("9:16");
  const [videoSource, setVideoSource] = useState("pexels");
  const [voiceName, setVoiceName] = useState("en-US-JennyNeural-Female");
  const [studioMessage, setStudioMessage] = useState("");
  const [studioError, setStudioError] = useState("");
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isGeneratingTerms, setIsGeneratingTerms] = useState(false);
  const [isSubmittingVideo, setIsSubmittingVideo] = useState(false);
  const [activeTask, setActiveTask] = useState<SubmittedTask | null>(null);
  const pollControllerRef = useRef<AbortController | null>(null);
  const pollGenerationRef = useRef(0);

  const backendReady = status.state === "online";
  const subjectReady = subject.trim().length > 0;
  const scriptReady = script.trim().length > 0;
  const termsReady = terms.trim().length > 0;
  const isBusy =
    isGeneratingScript ||
    isGeneratingTerms ||
    isSubmittingVideo ||
    activeTask?.status === "processing" ||
    activeTask?.status === "submitted";

  useEffect(() => {
    return () => {
      pollGenerationRef.current += 1;
      pollControllerRef.current?.abort();
    };
  }, []);

  async function handleGenerateScript() {
    if (!backendReady || !subjectReady) {
      setStudioError(
        backendReady
          ? "Enter a video subject before generating a script."
          : "Backend is offline. Start api.bat and refresh status before generating.",
      );
      return;
    }

    setIsGeneratingScript(true);
    setStudioError("");
    setStudioMessage("Generating script from the FastAPI /scripts endpoint...");

    try {
      const response = await generateScript({
        video_subject: subject.trim(),
        video_language: language.trim(),
        paragraph_number: paragraphNumber,
      });
      setScript(response.video_script);
      setStudioMessage("Script generated and loaded into the editor.");
    } catch (error) {
      setStudioError(getErrorMessage(error));
      setStudioMessage("");
    } finally {
      setIsGeneratingScript(false);
    }
  }

  async function handleGenerateTerms() {
    if (!backendReady || !subjectReady || !scriptReady) {
      setStudioError(
        !backendReady
          ? "Backend is offline. Start api.bat and refresh status before generating."
          : "Generate or paste a script before requesting search terms.",
      );
      return;
    }

    setIsGeneratingTerms(true);
    setStudioError("");
    setStudioMessage("Generating search terms from the FastAPI /terms endpoint...");

    try {
      const response = await generateTerms({
        video_subject: subject.trim(),
        video_script: script.trim(),
        amount: termsAmount,
      });
      setTerms(formatTerms(response.video_terms));
      setStudioMessage("Search terms generated for video materials.");
    } catch (error) {
      setStudioError(getErrorMessage(error));
      setStudioMessage("");
    } finally {
      setIsGeneratingTerms(false);
    }
  }

  async function handleCreateVideo() {
    if (!backendReady || !subjectReady || !scriptReady || !termsReady) {
      setStudioError(
        !backendReady
          ? "Backend is offline. Start api.bat and refresh status before submitting."
          : "Subject, script, and terms are required before video generation.",
      );
      return;
    }

    pollGenerationRef.current += 1;
    pollControllerRef.current?.abort();
    const controller = new AbortController();
    pollControllerRef.current = controller;
    const pollGeneration = pollGenerationRef.current;

    setIsSubmittingVideo(true);
    setStudioError("");
    setStudioMessage("Submitting video generation task to /videos...");

    try {
      const response = await createVideo(buildVideoPayload(), controller.signal);
      const task = createSubmittedTask(response.task_id, subject.trim(), "submitted", 0, "Task submitted. Waiting for backend progress...");
      setActiveTask(task);
      onTaskChange(response.task_id, task);
      setStudioMessage(`Task ${response.task_id} submitted. Polling progress now.`);
      await pollTask(response.task_id, subject.trim(), pollGeneration, controller.signal);
    } catch (error) {
      if (!controller.signal.aborted) {
        setStudioError(getErrorMessage(error));
        setStudioMessage("");
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsSubmittingVideo(false);
      }
    }
  }

  async function pollTask(taskId: string, taskSubject: string, pollGeneration: number, signal: AbortSignal) {
    for (let attempt = 1; attempt <= TASK_POLL_MAX_ATTEMPTS; attempt += 1) {
      if (signal.aborted || pollGeneration !== pollGenerationRef.current) {
        return;
      }

      try {
        const task = await getTask(taskId, signal);
        const nextTask = toSubmittedTask(task, taskSubject, taskId);
        setActiveTask(nextTask);
        onTaskChange(taskId, nextTask);

        if (nextTask.status === "complete") {
          setStudioMessage("Video task completed. Results are ready below.");
          setIsSubmittingVideo(false);
          return;
        }

        if (nextTask.status === "failed") {
          setStudioError(nextTask.message || "Video task failed in the backend.");
          setStudioMessage("");
          setIsSubmittingVideo(false);
          return;
        }
      } catch (error) {
        if (!signal.aborted) {
          const message = getErrorMessage(error);
          setActiveTask((currentTask) => (currentTask ? { ...currentTask, status: "error", message } : currentTask));
          onTaskChange(taskId, { subject: taskSubject, status: "error", message });
          setStudioError(message);
          setStudioMessage("");
          setIsSubmittingVideo(false);
        }
        return;
      }

      await delay(TASK_POLL_INTERVAL_MS, signal);
    }

    const timeoutMessage = `Polling stopped after ${TASK_POLL_MAX_ATTEMPTS} attempts. Check the Tasks page or backend logs for task ${taskId}.`;
    setActiveTask((currentTask) => (currentTask ? { ...currentTask, status: "timeout", message: timeoutMessage } : currentTask));
    onTaskChange(taskId, { subject: taskSubject, status: "timeout", message: timeoutMessage });
    setStudioError(timeoutMessage);
    setStudioMessage("");
    setIsSubmittingVideo(false);
  }

  function buildVideoPayload(): CreateVideoPayload {
    return {
      video_subject: subject.trim(),
      video_script: script.trim(),
      video_terms: parseTerms(terms),
      video_aspect: aspect,
      video_concat_mode: "random",
      video_transition_mode: null,
      video_clip_duration: 5,
      video_count: 1,
      video_source: videoSource.trim(),
      video_language: language.trim(),
      voice_name: voiceName.trim(),
      voice_volume: 1,
      voice_rate: 1,
      bgm_type: "random",
      bgm_file: "",
      bgm_volume: 0.2,
      subtitle_enabled: true,
      subtitle_position: "bottom",
      custom_position: 70,
      font_name: "STHeitiMedium.ttc",
      text_fore_color: "#FFFFFF",
      text_background_color: true,
      font_size: 60,
      stroke_color: "#000000",
      stroke_width: 1.5,
      n_threads: 2,
      paragraph_number: paragraphNumber,
    };
  }

  return (
    <>
      <section className="panel-card studio-layout">
        <div className="studio-copy">
          <p className="eyebrow">Create Studio</p>
          <h3>Generate a complete MoneyPrinterTurbo video from one subject.</h3>
          <p>
            Write the idea, ask FastAPI for a script and search terms, then submit the real render task and watch progress
            until output videos are ready.
          </p>
          <div className="status-chip-row">
            <span className={`status-chip status-${status.state}`}>{status.state}</span>
            <span className="status-chip">{status.baseUrl}</span>
          </div>
          {!backendReady ? (
            <div className="notice-card notice-warning" role="status">
              <AlertCircle size={18} aria-hidden="true" />
              <span>Backend is not ready. Start `api.bat`, refresh status, then run generation actions.</span>
            </div>
          ) : null}
        </div>
        <div className="prompt-card studio-form">
          <label htmlFor="story-subject">Video subject</label>
          <input
            id="story-subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Example: 5 habits that make small businesses grow"
          />

          <div className="form-grid compact-form-grid">
            <label htmlFor="story-language">
              Language
              <input id="story-language" value={language} onChange={(event) => setLanguage(event.target.value)} placeholder="en" />
            </label>
            <label htmlFor="story-paragraphs">
              Paragraphs
              <input
                id="story-paragraphs"
                min={1}
                max={8}
                type="number"
                value={paragraphNumber}
                onChange={(event) => setParagraphNumber(clampNumber(event.target.value, 1, 8))}
              />
            </label>
            <label htmlFor="terms-amount">
              Terms
              <input
                id="terms-amount"
                min={1}
                max={12}
                type="number"
                value={termsAmount}
                onChange={(event) => setTermsAmount(clampNumber(event.target.value, 1, 12))}
              />
            </label>
          </div>

          <div className="prompt-actions split-actions">
            <span className="form-helper">POST /api/v1/scripts</span>
            <button
              className="primary-action"
              type="button"
              onClick={() => void handleGenerateScript()}
              disabled={!backendReady || !subjectReady || isGeneratingScript}
            >
              {isGeneratingScript ? <Loader2 className="spin-icon" size={18} /> : <Sparkles size={18} />}
              {isGeneratingScript ? "Generating" : "Generate Script"}
            </button>
          </div>

          <label htmlFor="story-script">Script</label>
          <textarea
            id="story-script"
            value={script}
            onChange={(event) => setScript(event.target.value)}
            placeholder="Generated script appears here. You can edit it before creating terms or video."
            rows={8}
          />

          <div className="prompt-actions split-actions">
            <span className="form-helper">POST /api/v1/terms</span>
            <button
              className="secondary-action"
              type="button"
              onClick={() => void handleGenerateTerms()}
              disabled={!backendReady || !subjectReady || !scriptReady || isGeneratingTerms}
            >
              {isGeneratingTerms ? <Loader2 className="spin-icon" size={18} /> : <Wand2 size={18} />}
              {isGeneratingTerms ? "Generating" : "Generate Terms"}
            </button>
          </div>

          <label htmlFor="story-terms">Video terms</label>
          <input id="story-terms" value={terms} onChange={(event) => setTerms(event.target.value)} placeholder="Generated keywords, separated by commas" />

          <div className="form-grid compact-form-grid">
            <label htmlFor="video-aspect">
              Aspect
              <select id="video-aspect" value={aspect} onChange={(event) => setAspect(event.target.value as CreateVideoPayload["video_aspect"])}>
                <option value="9:16">Portrait 9:16</option>
                <option value="16:9">Landscape 16:9</option>
                <option value="1:1">Square 1:1</option>
              </select>
            </label>
            <label htmlFor="video-source">
              Source
              <select id="video-source" value={videoSource} onChange={(event) => setVideoSource(event.target.value)}>
                <option value="pexels">Pexels</option>
                <option value="pixabay">Pixabay</option>
                <option value="local">Local</option>
              </select>
            </label>
            <label htmlFor="voice-name">
              Voice
              <input id="voice-name" value={voiceName} onChange={(event) => setVoiceName(event.target.value)} />
            </label>
          </div>

          {studioError ? <p className="form-alert form-alert-error">{studioError}</p> : null}
          {studioMessage ? <p className="form-alert form-alert-info">{studioMessage}</p> : null}

          <div className="prompt-actions">
            <button
              className="primary-action"
              type="button"
              onClick={() => void handleCreateVideo()}
              disabled={!backendReady || !subjectReady || !scriptReady || !termsReady || isBusy}
            >
              {isSubmittingVideo ? <Loader2 className="spin-icon" size={18} /> : <PlayCircle size={18} />}
              {isSubmittingVideo ? "Rendering" : "Generate Video"}
            </button>
          </div>
        </div>
      </section>

      {activeTask ? (
        <section className="panel-card result-card">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Live task</p>
              <h3>{activeTask.subject}</h3>
            </div>
            <span className={`status-chip task-status-${activeTask.status}`}>{taskStatusLabel(activeTask.status)}</span>
          </div>
          <TaskProgress task={activeTask} />
          <TaskOutputs task={activeTask} />
        </section>
      ) : (
        <section className="step-grid">
          {[
            ["1", "Script", "POST /api/v1/scripts fills the editable script field."],
            ["2", "Terms", "POST /api/v1/terms returns material search keywords."],
            ["3", "Render", "POST /api/v1/videos creates a backend task."],
            ["4", "Results", "GET /api/v1/tasks/{task_id} powers progress and output previews."],
          ].map(([step, title, copy]) => (
            <article className="panel-card step-card" key={step}>
              <span>{step}</span>
              <h4>{title}</h4>
              <p>{copy}</p>
            </article>
          ))}
        </section>
      )}
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

function ApiStatusCard({
  status,
  onRefresh,
  compact = false,
}: {
  status: ApiStatus;
  onRefresh: () => Promise<void>;
  compact?: boolean;
}) {
  return (
    <section className={`panel-card api-card ${compact ? "api-card-compact" : ""}`}>
      <div className="section-title-row">
        <div>
          <p className="eyebrow">Backend status</p>
          <h3>FastAPI connection</h3>
        </div>
        <span className={`status-light status-${status.state}`} role="status">
          <span className="sr-only">{`Backend is ${status.state}`}</span>
        </span>
      </div>
      <p className="api-message">{status.message}</p>
      <div className="api-meta">
        <span>{status.baseUrl}</span>
        <span>Checked {status.checkedAt}</span>
      </div>
      <button className="secondary-action" type="button" onClick={() => void onRefresh()} disabled={status.state === "checking"}>
        <RefreshCcw size={17} />
        {status.state === "checking" ? "Checking" : "Refresh status"}
      </button>
    </section>
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

function TaskProgress({ task, compact = false }: { task: SubmittedTask; compact?: boolean }) {
  return (
    <div className={`task-progress ${compact ? "task-progress-compact" : ""}`}>
      <div className="progress-track" role="progressbar" aria-label={`${taskStatusLabel(task.status)} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.max(0, Math.min(task.progress, 100))}>
        <span style={{ width: `${Math.max(0, Math.min(task.progress, 100))}%` }} />
      </div>
      <div className="progress-meta">
        <span>{task.progress}%</span>
        <span>{task.message}</span>
      </div>
    </div>
  );
}

function TaskOutputs({ task, compact = false }: { task: SubmittedTask; compact?: boolean }) {
  const outputs = [...task.combinedVideos, ...task.videos];

  if (outputs.length === 0) {
    return compact ? null : <p className="output-empty">No video outputs returned yet.</p>;
  }

  return (
    <div className={`output-grid ${compact ? "output-grid-compact" : ""}`}>
      {outputs.map((outputPath) => {
        const outputUrl = resolveOutputUrl(outputPath);
        const label = getOutputLabel(outputPath);

        return (
          <article className="output-card" key={outputPath}>
            {isVideoOutput(outputUrl) ? (
              <video controls src={outputUrl} preload="metadata" aria-label={label}>
                <track kind="captions" label="Generated captions" srcLang="en" src="data:text/vtt,WEBVTT%0A%0A" />
              </video>
            ) : null}
            <a href={outputUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={16} aria-hidden="true" />
              {label}
            </a>
          </article>
        );
      })}
    </div>
  );
}

function createSubmittedTask(taskId: string, subject: string, status: SubmittedTaskStatus, progress: number, message: string): SubmittedTask {
  const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return {
    taskId,
    subject,
    status,
    progress,
    createdAt: timestamp,
    updatedAt: timestamp,
    message,
    videos: [],
    combinedVideos: [],
  };
}

function toSubmittedTask(task: TaskData, fallbackSubject: string, fallbackTaskId: string): SubmittedTask {
  const state = Number(task.state ?? 4);
  const progress = typeof task.progress === "number" ? task.progress : 0;
  const status = getSubmittedTaskStatus(state);
  const message = getTaskMessage(task, status);
  const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return {
    taskId: task.task_id ?? fallbackTaskId,
    subject: fallbackSubject,
    status,
    progress,
    createdAt: timestamp,
    updatedAt: timestamp,
    message,
    videos: task.videos ?? [],
    combinedVideos: task.combined_videos ?? [],
  };
}

function getSubmittedTaskStatus(state: number): SubmittedTaskStatus {
  if (state === 1) {
    return "complete";
  }
  if (state === -1) {
    return "failed";
  }
  if (state === 4) {
    return "processing";
  }
  return "submitted";
}

function getTaskMessage(task: TaskData, status: SubmittedTaskStatus): string {
  if (typeof task.error === "string" && task.error.trim()) {
    return task.error;
  }
  if (typeof task.message === "string" && task.message.trim()) {
    return task.message;
  }
  if (status === "complete") {
    return "Generation completed.";
  }
  if (status === "failed") {
    return "Generation failed.";
  }
  return "Generation is running.";
}

function getTaskSubject(task: TaskData): string {
  const params = task.params;
  if (params && typeof params.video_subject === "string" && params.video_subject.trim()) {
    return params.video_subject;
  }
  return task.task_id ? `Task ${task.task_id.slice(0, 8)}` : "Backend task";
}

function mergeTasks(sessionTasks: SubmittedTask[], backendTasks: SubmittedTask[]): SubmittedTask[] {
  const taskMap = new Map<string, SubmittedTask>();

  for (const task of backendTasks) {
    taskMap.set(task.taskId, task);
  }
  for (const task of sessionTasks) {
    const backendTask = taskMap.get(task.taskId);
    taskMap.set(task.taskId, backendTask ? { ...task, ...backendTask, subject: task.subject } : task);
  }

  return [...taskMap.values()];
}

function formatTerms(videoTerms: string[] | string): string {
  return Array.isArray(videoTerms) ? videoTerms.join(", ") : videoTerms;
}

function parseTerms(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((term) => term.trim())
    .filter(Boolean);
}

function clampNumber(value: string, min: number, max: number): number {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.round(parsedValue)));
}

function taskStatusLabel(status: SubmittedTaskStatus): string {
  const labels: Record<SubmittedTaskStatus, string> = {
    submitted: "Submitted",
    processing: "Processing",
    complete: "Complete",
    failed: "Failed",
    error: "API error",
    timeout: "Timed out",
  };

  return labels[status];
}

function getOutputLabel(outputPath: string): string {
  const normalizedPath = outputPath.replaceAll("\\", "/");
  return normalizedPath.split("/").filter(Boolean).at(-1) ?? "Open output";
}

function isVideoOutput(outputUrl: string): boolean {
  return /\.(mp4|webm|ogg)(\?|#|$)/i.test(outputUrl);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected API error.";
}

function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }

    const timeoutId = window.setTimeout(resolve, milliseconds);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeoutId);
        resolve();
      },
      { once: true },
    );
  });
}

function getInitialPage(): PageId {
  const hash = window.location.hash.replace("#", "");
  const page = NAV_ITEMS.find((item) => item.id === hash);

  return page?.id ?? "dashboard";
}
