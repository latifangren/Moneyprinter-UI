import type { SubmittedTask } from "../taskModel";
import { clampTaskProgress, taskStatusLabel } from "../taskModel";

type TaskProgressProps = {
  task: SubmittedTask;
  compact?: boolean;
};

export function TaskProgress({ task, compact = false }: TaskProgressProps) {
  const progress = clampTaskProgress(task.progress);

  return (
    <div className={`task-progress ${compact ? "task-progress-compact" : ""}`}>
      <div className="progress-track" role="progressbar" aria-label={`${taskStatusLabel(task.status)} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="progress-meta">
        <span>{progress}%</span>
        <span>{task.message}</span>
      </div>
    </div>
  );
}
