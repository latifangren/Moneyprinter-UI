import type { TaskData } from "./api";

export type SubmittedTaskStatus = "submitted" | "processing" | "complete" | "failed" | "error" | "timeout";

export type TaskStatusGroup = "active" | "complete" | "needs-attention";

export type TaskStatusFilter = "all" | TaskStatusGroup;

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

export type TaskOutputSummary = {
  outputs: string[];
  combinedCount: number;
  videoCount: number;
  totalCount: number;
  visibleOutputs: string[];
  hiddenCount: number;
};

export type TaskFilters = {
  query: string;
  statusFilter: TaskStatusFilter;
  hasOutputsOnly: boolean;
};

export type TaskStatusCounts = Record<TaskStatusFilter, number>;

export type TaskGroup = {
  id: TaskStatusGroup;
  label: string;
  tasks: SubmittedTask[];
};

export const TASK_GROUP_ORDER: TaskStatusGroup[] = ["active", "complete", "needs-attention"];

const TASK_GROUP_LABELS: Record<TaskStatusGroup, string> = {
  active: "Active",
  complete: "Complete",
  "needs-attention": "Needs attention",
};

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

export function clampTaskProgress(progress: number): number {
  if (!Number.isFinite(progress)) {
    return 0;
  }
  return Math.max(0, Math.min(Math.round(progress), 100));
}

export function getTaskOutputSummary(task: SubmittedTask, visibleLimit = 3): TaskOutputSummary {
  const combinedVideos = dedupeOutputPaths(task.combinedVideos);
  const videos = dedupeOutputPaths(task.videos, new Set(combinedVideos.map(getOutputDedupeKey)));
  const outputs = [...combinedVideos, ...videos];
  const normalizedLimit = Math.max(0, Math.floor(visibleLimit));
  const visibleOutputs = outputs.slice(0, normalizedLimit);

  return {
    outputs,
    combinedCount: combinedVideos.length,
    videoCount: videos.length,
    totalCount: outputs.length,
    visibleOutputs,
    hiddenCount: Math.max(0, outputs.length - visibleOutputs.length),
  };
}

export function taskMatchesQuery(task: SubmittedTask, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  const outputSummary = getTaskOutputSummary(task, Number.MAX_SAFE_INTEGER);
  const searchText = [
    task.subject,
    task.taskId,
    task.message,
    ...outputSummary.outputs.map(getOutputFilename),
  ]
    .join(" ")
    .toLowerCase();

  return searchText.includes(normalizedQuery);
}

export function getTaskStatusGroup(status: SubmittedTaskStatus): TaskStatusGroup {
  if (status === "complete") {
    return "complete";
  }
  if (status === "failed" || status === "error" || status === "timeout") {
    return "needs-attention";
  }
  return "active";
}

export function filterTasks(tasks: SubmittedTask[], filters: TaskFilters): SubmittedTask[] {
  return tasks.filter((task) => {
    const statusMatches = filters.statusFilter === "all" || getTaskStatusGroup(task.status) === filters.statusFilter;
    const outputMatches = !filters.hasOutputsOnly || getTaskOutputSummary(task).totalCount > 0;

    return statusMatches && outputMatches && taskMatchesQuery(task, filters.query);
  });
}

export function getTaskStatusCounts(tasks: SubmittedTask[]): TaskStatusCounts {
  const counts: TaskStatusCounts = {
    all: tasks.length,
    active: 0,
    complete: 0,
    "needs-attention": 0,
  };

  for (const task of tasks) {
    counts[getTaskStatusGroup(task.status)] += 1;
  }

  return counts;
}

export function groupTasksByStatus(tasks: SubmittedTask[]): TaskGroup[] {
  const groups: TaskGroup[] = [];

  for (const id of TASK_GROUP_ORDER) {
    const groupTasks = tasks.filter((task) => getTaskStatusGroup(task.status) === id);

    if (groupTasks.length > 0) {
      groups.push({
        id,
        label: TASK_GROUP_LABELS[id],
        tasks: groupTasks,
      });
    }
  }

  return groups;
}

export function getOutputFilename(outputPath: string): string {
  const normalizedPath = outputPath.replaceAll("\\", "/");
  return normalizedPath.split("/").filter(Boolean).at(-1) ?? "Open output";
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

function dedupeOutputPaths(outputPaths: string[], seenKeys = new Set<string>()): string[] {
  const outputs: string[] = [];

  for (const outputPath of outputPaths) {
    const dedupeKey = getOutputDedupeKey(outputPath);
    if (!dedupeKey || seenKeys.has(dedupeKey)) {
      continue;
    }
    seenKeys.add(dedupeKey);
    outputs.push(outputPath);
  }

  return outputs;
}

function getOutputDedupeKey(outputPath: string): string {
  const normalizedPath = outputPath.trim().replaceAll("\\", "/").toLowerCase();
  const storageTasksIndex = normalizedPath.indexOf("/storage/tasks/");
  const tasksIndex = normalizedPath.indexOf("/tasks/");

  if (storageTasksIndex >= 0) {
    return normalizedPath.slice(storageTasksIndex + "/storage/".length);
  }
  if (tasksIndex >= 0) {
    return normalizedPath.slice(tasksIndex + 1);
  }
  return normalizedPath.replace(/^\/+/, "");
}
