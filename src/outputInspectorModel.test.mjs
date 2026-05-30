import assert from "node:assert/strict";
import test from "node:test";

import {
  createOutputInspectorDetails,
  getTaskOutputItems,
} from "./outputInspectorModel.ts";

function createTask(overrides = {}) {
  return {
    taskId: "task-alpha-001",
    subject: "Night market documentary",
    status: "complete",
    progress: 100,
    createdAt: "10:00 AM",
    updatedAt: "10:08 AM",
    message: "Generation completed.",
    videos: [],
    combinedVideos: [],
    ...overrides,
  };
}

test("creates ordered combined then clip output items with stable ids", () => {
  const items = getTaskOutputItems(
    createTask({
      combinedVideos: ["/tasks/a/final.mp4", "tasks/a/teaser.webm"],
      videos: ["http://127.0.0.1:8080/tasks/a/teaser.webm", "/tasks/a/clip-1.mp4"],
    }),
  );

  assert.deepEqual(
    items.map((item) => [item.id, item.filename, item.kind]),
    [
      ["task-alpha-001:/tasks/a/final.mp4", "final.mp4", "combined"],
      ["task-alpha-001:tasks/a/teaser.webm", "teaser.webm", "combined"],
      ["task-alpha-001:/tasks/a/clip-1.mp4", "clip-1.mp4", "clip"],
    ],
  );
});

test("respects visible limit after output ordering and dedupe", () => {
  const items = getTaskOutputItems(
    createTask({
      combinedVideos: ["/tasks/a/final.mp4"],
      videos: ["/tasks/a/clip-1.mp4", "/tasks/a/clip-2.mp4"],
    }),
    2,
  );

  assert.deepEqual(
    items.map((item) => [item.filename, item.kind]),
    [
      ["final.mp4", "combined"],
      ["clip-1.mp4", "clip"],
    ],
  );
});

test("creates safe inspector details without raw backend fields", () => {
  const task = createTask({
    taskId: "task-safe-123",
    subject: "Aurora city",
    status: "processing",
    progress: 48,
    message: "Rendering clip",
    updatedAt: "10:12 AM",
  });
  const details = createOutputInspectorDetails(
    { task, outputPath: "/tasks/task-safe-123/final.mp4", kind: "combined" },
    "/tasks/task-safe-123/final.mp4?download=1",
  );

  assert.deepEqual(details, {
    filename: "final.mp4",
    taskId: "task-safe-123",
    subject: "Aurora city",
    status: "processing",
    progress: 48,
    message: "Rendering clip",
    kind: "combined",
    updatedAt: "10:12 AM",
    outputUrl: "/tasks/task-safe-123/final.mp4?download=1",
  });
  assert.equal("params" in details, false);
  assert.equal("script" in details, false);
  assert.equal("terms" in details, false);
});
