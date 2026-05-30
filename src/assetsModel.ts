import type { SubmittedTask, SubmittedTaskStatus, TaskStatusFilter } from "./taskModel.ts";
import { getOutputFilename, getTaskOutputSummary, getTaskStatusGroup } from "./taskModel.ts";
import { isTaskMountedOutputPath } from "./outputUrl.ts";

export type AssetKind = "combined" | "clip";

export type AssetKindFilter = "all" | AssetKind;

export type GeneratedAsset = {
  id: string;
  taskId: string;
  subject: string;
  status: SubmittedTaskStatus;
  updatedAt: string;
  outputPath: string;
  filename: string;
  kind: AssetKind;
};

export type AssetFilters = {
  query: string;
  kindFilter: AssetKindFilter;
  statusFilter: TaskStatusFilter;
};

export type AssetKindCounts = Record<AssetKindFilter, number>;

export type AssetStatusCounts = Record<TaskStatusFilter, number>;

export function createGeneratedAssets(tasks: SubmittedTask[], trustedBaseUrl = ""): GeneratedAsset[] {
  return tasks.flatMap((task) => {
    const outputSummary = getTaskOutputSummary(task, Number.MAX_SAFE_INTEGER);
    const mountedOutputs = outputSummary.outputs
      .map((outputPath, outputIndex) => ({ outputPath, outputIndex }))
      .filter(({ outputPath }) => isTaskMountedOutputPath(outputPath, trustedBaseUrl));

    return mountedOutputs.map(({ outputPath, outputIndex }) => ({
      id: createGeneratedAssetId(task.taskId, outputPath),
      taskId: task.taskId,
      subject: task.subject,
      status: task.status,
      updatedAt: task.updatedAt,
      outputPath,
      filename: getOutputFilename(outputPath),
      kind: outputIndex < outputSummary.combinedCount ? "combined" : "clip",
    }));
  });
}

export function filterGeneratedAssets(assets: GeneratedAsset[], filters: AssetFilters): GeneratedAsset[] {
  const normalizedQuery = filters.query.trim().toLowerCase();

  return assets.filter((asset) => {
    const queryMatches = !normalizedQuery || [asset.filename, asset.subject, asset.taskId].join(" ").toLowerCase().includes(normalizedQuery);
    const kindMatches = filters.kindFilter === "all" || asset.kind === filters.kindFilter;
    const statusMatches = filters.statusFilter === "all" || getTaskStatusGroup(asset.status) === filters.statusFilter;

    return queryMatches && kindMatches && statusMatches;
  });
}

export function getAssetKindCounts(assets: GeneratedAsset[]): AssetKindCounts {
  const counts: AssetKindCounts = {
    all: assets.length,
    combined: 0,
    clip: 0,
  };

  for (const asset of assets) {
    counts[asset.kind] += 1;
  }

  return counts;
}

export function getAssetStatusCounts(assets: GeneratedAsset[]): AssetStatusCounts {
  const counts: AssetStatusCounts = {
    all: assets.length,
    active: 0,
    complete: 0,
    "needs-attention": 0,
  };

  for (const asset of assets) {
    counts[getTaskStatusGroup(asset.status)] += 1;
  }

  return counts;
}

function createGeneratedAssetId(taskId: string, outputPath: string): string {
  return `${taskId}:${outputPath}`;
}
