import type { TaskData } from "./api";

export type SubmittedTaskStatus = "submitted" | "processing" | "complete" | "failed" | "error" | "timeout";

export type SubmittedTask = {
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

export type TaskUpdate = Partial<Omit<SubmittedTask, "taskId" | "createdAt">>;

export function createSubmittedTask(taskId: string, subject: string, status: SubmittedTaskStatus, progress: number, message: string): SubmittedTask {
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

export function toSubmittedTask(task: TaskData, fallbackSubject: string, fallbackTaskId: string): SubmittedTask {
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

export function getTaskSubject(task: TaskData): string {
  const params = task.params;
  if (params && typeof params.video_subject === "string" && params.video_subject.trim()) {
    return params.video_subject;
  }
  return task.task_id ? `Task ${task.task_id.slice(0, 8)}` : "Backend task";
}

export function mergeTasks(sessionTasks: SubmittedTask[], backendTasks: SubmittedTask[]): SubmittedTask[] {
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

export function taskStatusLabel(status: SubmittedTaskStatus): string {
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
