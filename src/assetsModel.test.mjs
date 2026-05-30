import assert from "node:assert/strict";
import test from "node:test";

import {
  createGeneratedAssets,
  filterGeneratedAssets,
  getAssetKindCounts,
  getAssetStatusCounts,
} from "./assetsModel.ts";

function createTask(overrides = {}) {
  return {
    taskId: "task-alpha-001",
    subject: "Night market documentary",
    status: "complete",
    progress: 100,
    createdAt: "10:00 AM",
    updatedAt: "10:05 AM",
    message: "Do not search this private status text",
    videos: [],
    combinedVideos: [],
    ...overrides,
  };
}

test("creates generated assets with combined outputs before clips", () => {
  const assets = createGeneratedAssets([
    createTask({
      combinedVideos: ["/tasks/a/final.mp4", "/tasks/a/alt-final.mp4"],
      videos: ["/tasks/a/clip-01.mp4", "/tasks/a/clip-02.mp4"],
    }),
  ]);

  assert.deepEqual(
    assets.map((asset) => [asset.filename, asset.kind]),
    [
      ["final.mp4", "combined"],
      ["alt-final.mp4", "combined"],
      ["clip-01.mp4", "clip"],
      ["clip-02.mp4", "clip"],
    ],
  );
});

test("uses stable IDs from task ID and output path after summary dedupe", () => {
  const assets = createGeneratedAssets([
    createTask({
      taskId: "stable-task",
      combinedVideos: ["/tasks/stable/final.mp4"],
      videos: ["http://127.0.0.1:8080/tasks/stable/final.mp4", "/tasks/stable/clip.mp4"],
    }),
  ]);

  assert.deepEqual(
    assets.map((asset) => asset.id),
    ["stable-task:/tasks/stable/final.mp4", "stable-task:/tasks/stable/clip.mp4"],
  );
});

test("includes absolute task urls and windows storage task paths", () => {
  const assets = createGeneratedAssets([
    createTask({
      combinedVideos: ["https://127.0.0.1:8080/tasks/a/windows-final.mp4"],
      videos: ["F:\\storage\\tasks\\a\\unix-final.webm"],
    }),
  ]);

  assert.deepEqual(
    assets.map((asset) => [asset.outputPath, asset.filename]),
    [
      ["https://127.0.0.1:8080/tasks/a/windows-final.mp4", "windows-final.mp4"],
      ["F:\\storage\\tasks\\a\\unix-final.webm", "unix-final.webm"],
    ],
  );
});

test("excludes non-task output paths", () => {
  const assets = createGeneratedAssets([
    createTask({
      combinedVideos: ["https://cdn.example.com/video.mp4", "relative/video.mp4", "/tasks/a/kept.mp4"],
      videos: ["https://cdn.example.com/clip.mp4", "relative/clip.mp4"],
    }),
  ]);

  assert.deepEqual(assets.map((asset) => asset.outputPath), ["/tasks/a/kept.mp4"]);
});

test("preserves combined and clip kinds after filtering some outputs", () => {
  const assets = createGeneratedAssets([
    createTask({
      combinedVideos: ["https://cdn.example.com/combined-1.mp4", "/tasks/a/combined-2.mp4"],
      videos: ["https://cdn.example.com/clip-1.mp4", "/tasks/a/clip-2.mp4"],
    }),
  ]);

  assert.deepEqual(
    assets.map((asset) => [asset.outputPath, asset.kind]),
    [
      ["/tasks/a/combined-2.mp4", "combined"],
      ["/tasks/a/clip-2.mp4", "clip"],
    ],
  );
});

test("filters query only by filename, subject, and task ID", () => {
  const assets = createGeneratedAssets([
    createTask({
      taskId: "alpha-task",
      subject: "Aurora city reel",
      message: "secret render detail",
      videos: ["/tasks/private-folder/city-cut.mp4"],
    }),
  ]);

  assert.equal(filterGeneratedAssets(assets, { query: "AURORA", kindFilter: "all", statusFilter: "all" }).length, 1);
  assert.equal(filterGeneratedAssets(assets, { query: "alpha-task", kindFilter: "all", statusFilter: "all" }).length, 1);
  assert.equal(filterGeneratedAssets(assets, { query: "city-cut", kindFilter: "all", statusFilter: "all" }).length, 1);
  assert.equal(filterGeneratedAssets(assets, { query: "secret", kindFilter: "all", statusFilter: "all" }).length, 0);
  assert.equal(filterGeneratedAssets(assets, { query: "private-folder", kindFilter: "all", statusFilter: "all" }).length, 0);
});

test("filters by kind and status group", () => {
  const assets = createGeneratedAssets([
    createTask({ taskId: "active-task", status: "processing", combinedVideos: ["/tasks/active/final.mp4"] }),
    createTask({ taskId: "complete-task", status: "complete", videos: ["/tasks/complete/clip.mp4"] }),
    createTask({ taskId: "failed-task", status: "failed", videos: ["/tasks/failed/clip.mp4"] }),
  ]);

  assert.deepEqual(
    filterGeneratedAssets(assets, { query: "", kindFilter: "combined", statusFilter: "all" }).map((asset) => asset.taskId),
    ["active-task"],
  );
  assert.deepEqual(
    filterGeneratedAssets(assets, { query: "", kindFilter: "clip", statusFilter: "complete" }).map((asset) => asset.taskId),
    ["complete-task"],
  );
  assert.deepEqual(
    filterGeneratedAssets(assets, { query: "", kindFilter: "all", statusFilter: "needs-attention" }).map((asset) => asset.taskId),
    ["failed-task"],
  );
});

test("returns empty arrays and zero counts for empty inputs", () => {
  assert.deepEqual(createGeneratedAssets([]), []);
  assert.deepEqual(filterGeneratedAssets([], { query: "anything", kindFilter: "clip", statusFilter: "complete" }), []);
  assert.deepEqual(getAssetKindCounts([]), { all: 0, combined: 0, clip: 0 });
  assert.deepEqual(getAssetStatusCounts([]), { all: 0, active: 0, complete: 0, "needs-attention": 0 });
});
