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
      <progress className="progress-track" aria-label={`${taskStatusLabel(task.status)} progress`} max={100} value={progress} />
      <div className="progress-meta">
        <span>{progress}%</span>
        <span>{task.message}</span>
      </div>
    </div>
  );
}
