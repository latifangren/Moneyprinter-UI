import type { SubmittedTask } from "../taskModel";
import { taskStatusLabel } from "../taskModel";

type TaskProgressProps = {
  task: SubmittedTask;
  compact?: boolean;
};

export function TaskProgress({ task, compact = false }: TaskProgressProps) {
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
