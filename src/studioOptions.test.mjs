import assert from "node:assert/strict";
import test from "node:test";

import {
  ensureSelectedOption,
  ensureSelectedVoiceGroup,
  getFirstVoice,
  normalizeStudioOptions,
} from "./studioOptions.ts";

test("normalizes backend options for Studio dropdowns", () => {
  const options = normalizeStudioOptions({
    languages: [{ label: "English", value: "en-US" }],
    voice_providers: [{ label: "Xiaomi MiMo TTS", value: "mimo-tts" }],
    voices: { "mimo-tts": ["mimo:Milo-Male", "mimo:Mia-Female"] },
    video_aspects: [{ label: "Portrait", value: "9:16" }, { label: "Invalid", value: "4:3" }],
    video_sources: [{ label: "Pexels", value: "pexels" }, { label: "Local", value: "local" }],
  });

  assert.equal(options.metadataSource, "backend");
  assert.deepEqual(options.videoAspects, ["9:16"]);
  assert.deepEqual(options.videoSources, ["pexels"]);
  assert.equal(options.voiceGroups[0].label, "Xiaomi MiMo TTS");
  assert.deepEqual(options.voiceGroups[0].voices, ["mimo:Mia-Female", "mimo:Milo-Male"]);
});

test("keeps current custom selections visible", () => {
  assert.deepEqual(
    ensureSelectedOption([{ label: "English", value: "en-US" }], "id-ID", "Current language")[0],
    { label: "Current language: id-ID", value: "id-ID" },
  );

  const groups = ensureSelectedVoiceGroup([{ id: "azure", label: "Azure", voices: ["en-US-JennyNeural-Female"] }], "custom-voice");
  assert.equal(groups[0].label, "Current custom voice");
  assert.equal(groups[0].voices[0], "custom-voice");
});

test("provides fallback options when backend metadata is unavailable", () => {
  const options = normalizeStudioOptions(null);

  assert.equal(options.metadataSource, "fallback");
  assert.equal(getFirstVoice(options.voiceGroups), "en-US-JennyNeural-Female");
  assert.deepEqual(options.videoSources, ["pexels", "pixabay"]);
});
