import assert from "node:assert/strict";
import test from "node:test";

import {
  APP_DEFAULT_STUDIO_SETTINGS,
  STUDIO_DEFAULTS_STORAGE_KEY,
  VIDEO_ASPECT_OPTIONS,
  VIDEO_SOURCE_OPTIONS,
  clearStoredStudioDefaultSettings,
  formatVideoAspectLabel,
  formatVideoSourceLabel,
  loadStoredStudioDefaultSettings,
  normalizeStudioDefaultSettings,
  parseStoredStudioDefaultSettings,
  saveStoredStudioDefaultSettings,
  serializeStudioDefaultSettings,
} from "./studioForm.ts";

function createMemoryStorage(initialValue = null) {
  let storedValue = initialValue;

  return {
    getItem(key) {
      assert.equal(key, STUDIO_DEFAULTS_STORAGE_KEY);
      return storedValue;
    },
    setItem(key, value) {
      assert.equal(key, STUDIO_DEFAULTS_STORAGE_KEY);
      storedValue = value;
    },
    removeItem(key) {
      assert.equal(key, STUDIO_DEFAULTS_STORAGE_KEY);
      storedValue = null;
    },
  };
}

function createFailingStorage() {
  return {
    getItem() {
      throw new Error("get blocked");
    },
    setItem() {
      throw new Error("set blocked");
    },
    removeItem() {
      throw new Error("remove blocked");
    },
  };
}

test("normalizes Studio defaults and falls back for invalid values", () => {
  assert.deepEqual(
    normalizeStudioDefaultSettings({
      videoLanguage: " id ",
      paragraphNumber: 99,
      termsAmount: 0,
      voiceName: " ",
      videoAspect: "4:3",
      videoSource: "local",
      subtitleEnabled: false,
      subject: "do not store",
      script: "do not store",
      terms: "do not store",
    }),
    {
      ...APP_DEFAULT_STUDIO_SETTINGS,
      videoLanguage: "id",
      paragraphNumber: 8,
      termsAmount: 1,
      subtitleEnabled: false,
    },
  );
});

test("exports shared dropdown options for Studio default controls", () => {
  assert.deepEqual(VIDEO_ASPECT_OPTIONS, ["9:16", "16:9", "1:1"]);
  assert.deepEqual(VIDEO_SOURCE_OPTIONS, ["pexels", "pixabay"]);
});

test("normalizes unsupported local video source to app default", () => {
  assert.equal(normalizeStudioDefaultSettings({ videoSource: "local" }).videoSource, APP_DEFAULT_STUDIO_SETTINGS.videoSource);
});

test("formats shared dropdown option labels", () => {
  assert.equal(formatVideoAspectLabel("9:16"), "Portrait 9:16");
  assert.equal(formatVideoAspectLabel("16:9"), "Landscape 16:9");
  assert.equal(formatVideoAspectLabel("1:1"), "Square 1:1");
  assert.equal(formatVideoSourceLabel("pexels"), "Pexels");
  assert.equal(formatVideoSourceLabel("pixabay"), "Pixabay");
});

test("serializes only browser-local preset fields", () => {
  const serialized = serializeStudioDefaultSettings({
    videoLanguage: "ja",
    paragraphNumber: 3,
    termsAmount: 7,
    voiceName: "ja-JP-NanamiNeural-Female",
    videoAspect: "16:9",
    videoSource: "pixabay",
    subtitleEnabled: true,
  });
  const parsed = JSON.parse(serialized);

  assert.deepEqual(Object.keys(parsed).sort(), [
    "paragraphNumber",
    "subtitleEnabled",
    "termsAmount",
    "videoAspect",
    "videoLanguage",
    "videoSource",
    "voiceName",
  ]);
  assert.equal(parsed.videoLanguage, "ja");
});

test("parses missing and corrupt stored defaults without throwing", () => {
  assert.deepEqual(parseStoredStudioDefaultSettings(null), {
    settings: APP_DEFAULT_STUDIO_SETTINGS,
    status: "missing",
  });

  const corruptResult = parseStoredStudioDefaultSettings("{not json");
  assert.equal(corruptResult.status, "corrupt");
  assert.deepEqual(corruptResult.settings, APP_DEFAULT_STUDIO_SETTINGS);
  assert.match(corruptResult.message, /invalid JSON/);
});

test("saves, loads, and clears defaults through provided storage", () => {
  const storage = createMemoryStorage();
  const settings = {
    videoLanguage: "fr",
    paragraphNumber: 2,
    termsAmount: 4,
    voiceName: "fr-FR-DeniseNeural-Female",
    videoAspect: "1:1",
    videoSource: "pixabay",
    subtitleEnabled: false,
  };

  assert.deepEqual(saveStoredStudioDefaultSettings(storage, settings), { ok: true });
  assert.deepEqual(loadStoredStudioDefaultSettings(storage), { settings, status: "loaded" });
  assert.deepEqual(clearStoredStudioDefaultSettings(storage), { ok: true });
  assert.deepEqual(loadStoredStudioDefaultSettings(storage), { settings: APP_DEFAULT_STUDIO_SETTINGS, status: "missing" });
});

test("storage failures return non-fatal action results", () => {
  const storage = createFailingStorage();

  const loadResult = loadStoredStudioDefaultSettings(storage);
  assert.equal(loadResult.status, "failed");
  assert.deepEqual(loadResult.settings, APP_DEFAULT_STUDIO_SETTINGS);
  assert.match(loadResult.message, /get blocked/);

  const saveResult = saveStoredStudioDefaultSettings(storage, APP_DEFAULT_STUDIO_SETTINGS);
  assert.equal(saveResult.ok, false);
  assert.match(saveResult.message, /set blocked/);

  const clearResult = clearStoredStudioDefaultSettings(storage);
  assert.equal(clearResult.ok, false);
  assert.match(clearResult.message, /remove blocked/);
});
