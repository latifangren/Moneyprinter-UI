import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Activity, Clapperboard, Loader2, RefreshCcw, Search } from "lucide-react";
import type { ApiStatus } from "../api";
import { listTasks } from "../api";
import { getErrorMessage } from "../apiErrors";
import { OutputInspectorDialog } from "../components/OutputInspectorDialog";
import { TaskOutputs } from "../components/TaskOutputs";
import { TaskProgress } from "../components/TaskProgress";
import type { OutputInspectSelection } from "../outputInspectorModel";
import {
  filterTasks,
  getTaskStatusCounts,
  getTaskSubject,
  groupTasksByStatus,
  mergeTasks,
  taskStatusLabel,
  toSubmittedTask,
  type SubmittedTask,
  type TaskStatusFilter,
} from "../taskModel";

type TasksPageProps = {
  status: ApiStatus;
  submittedTasks: SubmittedTask[];
};

type TaskServerState = {
  serverTasks: SubmittedTask[];
  taskError: string;
  isLoadingTasks: boolean;
  lastRefreshedAt: string;
};

type TaskServerAction =
  | { type: "offline" }
  | { type: "loading" }
  | { type: "loaded"; tasks: SubmittedTask[]; refreshedAt: string }
  | { type: "failed"; error: string };

const INITIAL_TASK_SERVER_STATE: TaskServerState = {
  serverTasks: [],
  taskError: "",
  isLoadingTasks: false,
  lastRefreshedAt: "",
};

const FILTER_OPTIONS: { id: TaskStatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "complete", label: "Complete" },
  { id: "needs-attention", label: "Needs attention" },
];

function taskServerReducer(state: TaskServerState, action: TaskServerAction): TaskServerState {
  switch (action.type) {
    case "offline":
      return {
        ...state,
        serverTasks: [],
        taskError: "",
        isLoadingTasks: false,
      };
    case "loading":
      return {
        ...state,
        taskError: "",
        isLoadingTasks: true,
      };
    case "loaded":
      return {
        ...state,
        serverTasks: action.tasks,
        lastRefreshedAt: action.refreshedAt,
        isLoadingTasks: false,
      };
    case "failed":
      return {
        ...state,
        taskError: action.error,
        isLoadingTasks: false,
      };
  }
}

export function TasksPage({ status, submittedTasks }: TasksPageProps) {
  const [taskServerState, dispatchTaskServer] = useReducer(taskServerReducer, INITIAL_TASK_SERVER_STATE);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>("all");
  const [hasOutputsOnly, setHasOutputsOnly] = useState(false);
  const [inspectorSelection, setInspectorSelection] = useState<OutputInspectSelection | null>(null);
  const refreshInFlightRef = useRef(false);
  const backendReady = status.state === "online";
  const { serverTasks, taskError, isLoadingTasks, lastRefreshedAt } = taskServerState;

  const refreshTasks = useCallback(async (signal?: AbortSignal) => {
    if (refreshInFlightRef.current || !backendReady) {
      return;
    }

    refreshInFlightRef.current = true;
    dispatchTaskServer({ type: "loading" });

    try {
      const response = await listTasks(1, 12, signal);
      if (signal?.aborted) {
        return;
      }

      dispatchTaskServer({
        type: "loaded",
        tasks: response.tasks.map((task) => toSubmittedTask(task, getTaskSubject(task), task.task_id ?? "unknown-task")),
        refreshedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
    } catch (error) {
      if (!signal?.aborted) {
        dispatchTaskServer({ type: "failed", error: getErrorMessage(error) });
      }
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [backendReady]);

  useEffect(() => {
    if (!backendReady) {
      refreshInFlightRef.current = false;
      dispatchTaskServer({ type: "offline" });
      return;
    }

    const controller = new AbortController();
    void refreshTasks(controller.signal);
    const intervalId = window.setInterval(() => void refreshTasks(controller.signal), 5000);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [backendReady, refreshTasks]);

  const mergedTasks = mergeTasks(submittedTasks, serverTasks);
  const statusCounts = useMemo(() => getTaskStatusCounts(mergedTasks), [mergedTasks]);
  const filteredTasks = useMemo(
    () => filterTasks(mergedTasks, { query: searchQuery, statusFilter, hasOutputsOnly }),
    [hasOutputsOnly, mergedTasks, searchQuery, statusFilter],
  );
  const taskGroups = useMemo(() => groupTasksByStatus(filteredTasks), [filteredTasks]);
  const refreshStatus = backendReady ? `Auto-refresh every 5s${lastRefreshedAt ? `, last ${lastRefreshedAt}` : ""}` : "Auto-refresh paused while backend is offline";

  return (
    <>
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
      <div className="task-control-panel">
        <label className="search-box task-search-box">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search tasks</span>
          <input value={searchQuery} type="search" placeholder="Search subject, ID, message, output" onChange={(event) => setSearchQuery(event.target.value)} />
        </label>
        <div className="task-filter-row">
          {FILTER_OPTIONS.map((option) => (
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
        </div>
        <button className={`secondary-action task-output-toggle ${hasOutputsOnly ? "task-output-toggle-active" : ""}`} type="button" onClick={() => setHasOutputsOnly((currentValue) => !currentValue)} aria-pressed={hasOutputsOnly}>
          Has outputs
        </button>
      </div>
      <div className="task-refresh-meta" aria-live="polite">
        <span>{refreshStatus}</span>
        <span>{filteredTasks.length} of {mergedTasks.length} tasks shown</span>
      </div>
      {!backendReady ? <p className="form-alert form-alert-info">Backend is offline, so only tasks submitted in this UI session can appear here.</p> : null}
      {taskError ? <p className="form-alert form-alert-error">{taskError}</p> : null}
      <div className="task-list">
        {taskGroups.length > 0 ? (
          taskGroups.map((group) => (
            <section className="task-group" aria-labelledby={`task-group-${group.id}`} key={group.id}>
              <div className="task-group-heading">
                <h4 id={`task-group-${group.id}`}>{group.label}</h4>
                <span>{group.tasks.length}</span>
              </div>
              {group.tasks.map((task) => (
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
                  <TaskOutputs task={task} compact onInspectOutput={setInspectorSelection} />
                </article>
              ))}
            </section>
          ))
        ) : (
          <div className="empty-state">
            <Activity size={24} aria-hidden="true" />
            <p>{mergedTasks.length > 0 ? "No tasks match these controls." : "No submitted tasks yet. Use Create Studio to submit a real video generation task."}</p>
          </div>
        )}
      </div>
    </section>
    <OutputInspectorDialog selection={inspectorSelection} onClose={() => setInspectorSelection(null)} />
    </>
  );
}
