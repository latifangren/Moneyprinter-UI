import assert from "node:assert/strict";
import test from "node:test";

import {
  clampTaskProgress,
  filterTasks,
  getOutputFilename,
  getTaskOutputSummary,
  getTaskStatusCounts,
  getTaskStatusGroup,
  groupTasksByStatus,
  taskMatchesQuery,
} from "./taskModel.ts";

function createTask(overrides = {}) {
  return {
    taskId: "task-alpha-001",
    subject: "Night market documentary",
    status: "processing",
    progress: 42,
    createdAt: "10:00 AM",
    updatedAt: "10:01 AM",
    message: "Rendering final cut",
    videos: [],
    combinedVideos: [],
    ...overrides,
  };
}

test("clamps progress for shared display and aria values", () => {
  assert.equal(clampTaskProgress(-20), 0);
  assert.equal(clampTaskProgress(44.6), 45);
  assert.equal(clampTaskProgress(140), 100);
  assert.equal(clampTaskProgress(Number.NaN), 0);
});

test("summarizes outputs with combined videos first and duplicates removed", () => {
  const summary = getTaskOutputSummary(
    createTask({
      combinedVideos: ["/tasks/a/combined.mp4", "tasks/a/clip.mp4"],
      videos: ["http://127.0.0.1:8080/tasks/a/clip.mp4", "F:\\storage\\tasks\\a\\raw.mp4", ""],
    }),
    2,
  );

  assert.deepEqual(summary.outputs, ["/tasks/a/combined.mp4", "tasks/a/clip.mp4", "F:\\storage\\tasks\\a\\raw.mp4"]);
  assert.equal(summary.combinedCount, 2);
  assert.equal(summary.videoCount, 1);
  assert.equal(summary.totalCount, 3);
  assert.deepEqual(summary.visibleOutputs, ["/tasks/a/combined.mp4", "tasks/a/clip.mp4"]);
  assert.equal(summary.hiddenCount, 1);
});

test("extracts output filenames across path styles", () => {
  assert.equal(getOutputFilename("F:\\storage\\tasks\\a\\final.mp4"), "final.mp4");
  assert.equal(getOutputFilename("/tasks/a/final.webm"), "final.webm");
});

test("matches tasks by subject, id, message, and output filename", () => {
  const task = createTask({ videos: ["/tasks/a/festival-final.mp4"] });

  assert.equal(taskMatchesQuery(task, "market"), true);
  assert.equal(taskMatchesQuery(task, "alpha-001"), true);
  assert.equal(taskMatchesQuery(task, "final cut"), true);
  assert.equal(taskMatchesQuery(task, "festival-final"), true);
  assert.equal(taskMatchesQuery(task, "space opera"), false);
});

test("filters by status group, query, and output presence", () => {
  const tasks = [
    createTask({ taskId: "active-1", status: "processing", subject: "City render" }),
    createTask({ taskId: "complete-1", status: "complete", subject: "Ocean render", combinedVideos: ["/tasks/ocean/final.mp4"] }),
    createTask({ taskId: "failed-1", status: "failed", subject: "Forest render", message: "Provider failed" }),
  ];

  assert.deepEqual(
    filterTasks(tasks, { query: "render", statusFilter: "complete", hasOutputsOnly: true }).map((task) => task.taskId),
    ["complete-1"],
  );
  assert.deepEqual(
    filterTasks(tasks, { query: "provider", statusFilter: "needs-attention", hasOutputsOnly: false }).map((task) => task.taskId),
    ["failed-1"],
  );
});

test("counts status groups for filter chips", () => {
  const counts = getTaskStatusCounts([
    createTask({ status: "submitted" }),
    createTask({ status: "processing" }),
    createTask({ status: "complete" }),
    createTask({ status: "failed" }),
    createTask({ status: "error" }),
    createTask({ status: "timeout" }),
  ]);

  assert.deepEqual(counts, {
    all: 6,
    active: 2,
    complete: 1,
    "needs-attention": 3,
  });
});

test("groups tasks in active, complete, needs attention order", () => {
  const groups = groupTasksByStatus([
    createTask({ taskId: "failed-1", status: "failed" }),
    createTask({ taskId: "complete-1", status: "complete" }),
    createTask({ taskId: "active-1", status: "submitted" }),
  ]);

  assert.deepEqual(
    groups.map((group) => [group.id, group.tasks.map((task) => task.taskId)]),
    [
      ["active", ["active-1"]],
      ["complete", ["complete-1"]],
      ["needs-attention", ["failed-1"]],
    ],
  );
  assert.equal(getTaskStatusGroup("timeout"), "needs-attention");
});
