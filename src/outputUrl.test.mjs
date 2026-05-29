import assert from "node:assert/strict";
import test from "node:test";

import { resolveTaskOutputUrl } from "./outputUrl.ts";

test("returns empty string for blank output paths", () => {
  assert.equal(resolveTaskOutputUrl(""), "");
  assert.equal(resolveTaskOutputUrl("   "), "");
});

test("preserves mounted task output paths", () => {
  assert.equal(resolveTaskOutputUrl("/tasks/task-id/final-1.mp4"), "/tasks/task-id/final-1.mp4");
  assert.equal(resolveTaskOutputUrl("tasks/task-id/final-1.mp4"), "/tasks/task-id/final-1.mp4");
});

test("maps Windows storage task paths to the mounted tasks route", () => {
  assert.equal(
    resolveTaskOutputUrl("F:\\GITHUB\\MoneyPrinterTurbo-Portable-Windows\\MoneyPrinterTurbo\\storage\\tasks\\task-id\\final-1.mp4"),
    "/tasks/task-id/final-1.mp4",
  );
});

test("maps Unix storage task paths to the mounted tasks route", () => {
  assert.equal(resolveTaskOutputUrl("/app/storage/tasks/task-id/final-1.mp4"), "/tasks/task-id/final-1.mp4");
});

test("maps backend task URLs to same-origin task paths", () => {
  assert.equal(resolveTaskOutputUrl("http://127.0.0.1:8080/tasks/task-id/final-1.mp4"), "/tasks/task-id/final-1.mp4");
});

test("preserves external URLs", () => {
  assert.equal(resolveTaskOutputUrl("https://cdn.example.com/video.mp4"), "https://cdn.example.com/video.mp4");
});

test("applies explicit base URL to task outputs", () => {
  assert.equal(
    resolveTaskOutputUrl("/tasks/task-id/final-1.mp4", "http://127.0.0.1:8080"),
    "http://127.0.0.1:8080/tasks/task-id/final-1.mp4",
  );
});
