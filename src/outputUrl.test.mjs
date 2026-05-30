import assert from "node:assert/strict";
import test from "node:test";

import { isTaskMountedOutputPath, isVideoOutputUrl, resolveTaskOutputUrl } from "./outputUrl.ts";

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

test("detects video output URLs with query, hash, and uppercase extensions", () => {
  assert.equal(isVideoOutputUrl("/tasks/task-id/final.mp4"), true);
  assert.equal(isVideoOutputUrl("/tasks/task-id/final.WEBM?token=public"), true);
  assert.equal(isVideoOutputUrl("/tasks/task-id/final.OGG#preview"), true);
  assert.equal(isVideoOutputUrl("/tasks/task-id/final.mp4?download=1#view"), true);
  assert.equal(isVideoOutputUrl("/tasks/task-id/final.mov"), false);
  assert.equal(isVideoOutputUrl("/tasks/task-id/final.mp4.txt"), false);
});

test("identifies only task-mounted output paths as inspectable", () => {
  assert.equal(isTaskMountedOutputPath("/tasks/task-id/final.mp4"), true);
  assert.equal(isTaskMountedOutputPath("tasks/task-id/final.mp4"), true);
  assert.equal(isTaskMountedOutputPath("F:\\storage\\tasks\\task-id\\final.mp4"), true);
  assert.equal(isTaskMountedOutputPath("http://127.0.0.1:8080/tasks/task-id/final.mp4"), true);
  assert.equal(isTaskMountedOutputPath("https://backend.example.com/tasks/task-id/final.mp4", "https://backend.example.com"), true);
  assert.equal(isTaskMountedOutputPath("https://attacker.example.com/tasks/task-id/final.mp4"), false);
  assert.equal(isTaskMountedOutputPath("HTTPS://attacker.example.com/tasks/task-id/final.mp4"), false);
  assert.equal(isTaskMountedOutputPath("https://cdn.example.com/video.mp4"), false);
  assert.equal(isTaskMountedOutputPath("relative/video.mp4"), false);
  assert.equal(isTaskMountedOutputPath("https://bad url.example/video.mp4"), false);
});
