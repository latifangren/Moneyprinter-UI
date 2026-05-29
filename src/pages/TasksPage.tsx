import { useEffect, useState } from "react";
import { Activity, Clapperboard, Loader2, RefreshCcw } from "lucide-react";
import type { ApiStatus } from "../api";
import { listTasks } from "../api";
import { getErrorMessage } from "../apiErrors";
import { TaskOutputs } from "../components/TaskOutputs";
import { TaskProgress } from "../components/TaskProgress";
import { getTaskSubject, mergeTasks, taskStatusLabel, toSubmittedTask, type SubmittedTask } from "../taskModel";

type TasksPageProps = {
  status: ApiStatus;
  submittedTasks: SubmittedTask[];
};

export function TasksPage({ status, submittedTasks }: TasksPageProps) {
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
