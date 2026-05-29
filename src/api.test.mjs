import assert from "node:assert/strict";
import test from "node:test";

import {
  API_STATUS_PROBE_PATH,
  LOCAL_BACKEND_DEFAULT_URL,
  SAME_ORIGIN_API_BASE_LABEL,
} from "./apiSettings.ts";

test("exports backend Settings metadata", () => {
  assert.equal(API_STATUS_PROBE_PATH, "/api/v1/tasks?page=1&page_size=1");
  assert.equal(LOCAL_BACKEND_DEFAULT_URL, "http://127.0.0.1:8080");
  assert.equal(SAME_ORIGIN_API_BASE_LABEL, "same-origin dev proxy");
});
