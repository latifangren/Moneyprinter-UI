import type { SubmittedTask, SubmittedTaskStatus } from "./taskModel.ts";
import { getOutputFilename, getTaskOutputSummary } from "./taskModel.ts";

export type OutputKind = "combined" | "clip";

export type OutputInspectSelection = {
  task: SubmittedTask;
  outputPath: string;
  kind: OutputKind;
};

export type OutputInspectItem = {
  id: string;
  outputPath: string;
  filename: string;
  kind: OutputKind;
};

export type OutputInspectorDetails = {
  filename: string;
  taskId: string;
  subject: string;
  status: SubmittedTaskStatus;
  progress: number;
  message: string;
  kind: OutputKind;
  updatedAt: string;
  outputUrl: string;
};

export function getTaskOutputItems(task: SubmittedTask, visibleLimit = Number.MAX_SAFE_INTEGER): OutputInspectItem[] {
  const outputSummary = getTaskOutputSummary(task, visibleLimit);

  return outputSummary.visibleOutputs.map((outputPath, outputIndex) => ({
    id: createOutputInspectItemId(task.taskId, outputPath),
    outputPath,
    filename: getOutputFilename(outputPath),
    kind: outputIndex < outputSummary.combinedCount ? "combined" : "clip",
  }));
}

export function createOutputInspectorDetails(selection: OutputInspectSelection, outputUrl: string): OutputInspectorDetails {
  return {
    filename: getOutputFilename(selection.outputPath),
    taskId: selection.task.taskId,
    subject: selection.task.subject,
    status: selection.task.status,
    progress: selection.task.progress,
    message: selection.task.message,
    kind: selection.kind,
    updatedAt: selection.task.updatedAt,
    outputUrl,
  };
}

function createOutputInspectItemId(taskId: string, outputPath: string): string {
  return `${taskId}:${outputPath}`;
}
