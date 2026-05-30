import assert from "node:assert/strict";
import test from "node:test";

import {
  API_STATUS_PROBE_PATH,
  LOCAL_BACKEND_DEFAULT_URL,
  SAME_ORIGIN_API_BASE_LABEL,
} from "./apiSettings.ts";
import { getOptions } from "./api.ts";

test("exports backend Settings metadata", () => {
  assert.equal(API_STATUS_PROBE_PATH, "/api/v1/tasks?page=1&page_size=1");
  assert.equal(LOCAL_BACKEND_DEFAULT_URL, "http://127.0.0.1:8080");
  assert.equal(SAME_ORIGIN_API_BASE_LABEL, "same-origin dev proxy");
});

test("getOptions reads backend metadata endpoint", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.equal(String(url), "/api/v1/options");
    return new Response(JSON.stringify({ status: 200, data: { voices: { azure: ["en-US-JennyNeural-Female"] } } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const options = await getOptions();
    assert.deepEqual(options.voices, { azure: ["en-US-JennyNeural-Female"] });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
