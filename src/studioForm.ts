export const DEFAULT_VIDEO_LANGUAGE = "en";
export const DEFAULT_PARAGRAPH_NUMBER = 1;
export const DEFAULT_TERMS_AMOUNT = 5;
export const DEFAULT_VIDEO_ASPECT = "9:16";
export const DEFAULT_VIDEO_SOURCE = "pexels";
export const DEFAULT_VOICE_NAME = "en-US-JennyNeural-Female";
export const DEFAULT_SUBTITLE_ENABLED = true;
export const STUDIO_DEFAULTS_STORAGE_KEY = "moneyprinter-ui:studio-defaults:v1";

export type StudioVideoAspect = "16:9" | "9:16" | "1:1";
export type StudioVideoSource = "pexels" | "pixabay" | "local";

export type StudioDefaultSettings = {
  videoLanguage: string;
  paragraphNumber: number;
  termsAmount: number;
  voiceName: string;
  videoAspect: StudioVideoAspect;
  videoSource: StudioVideoSource;
  subtitleEnabled: boolean;
};

export type StudioDefaultsLoadStatus = "missing" | "loaded" | "corrupt" | "failed";

export type StudioDefaultsLoadResult = {
  settings: StudioDefaultSettings;
  status: StudioDefaultsLoadStatus;
  message?: string;
};

export type StudioDefaultsStorageActionResult =
  | { ok: true }
  | { ok: false; message: string };

type StudioDefaultsStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const VIDEO_ASPECT_OPTIONS: readonly StudioVideoAspect[] = ["9:16", "16:9", "1:1"];
const VIDEO_SOURCE_OPTIONS: readonly StudioVideoSource[] = ["pexels", "pixabay", "local"];

export const APP_DEFAULT_STUDIO_SETTINGS: StudioDefaultSettings = {
  videoLanguage: DEFAULT_VIDEO_LANGUAGE,
  paragraphNumber: DEFAULT_PARAGRAPH_NUMBER,
  termsAmount: DEFAULT_TERMS_AMOUNT,
  voiceName: DEFAULT_VOICE_NAME,
  videoAspect: DEFAULT_VIDEO_ASPECT,
  videoSource: DEFAULT_VIDEO_SOURCE,
  subtitleEnabled: DEFAULT_SUBTITLE_ENABLED,
};

export function formatTerms(videoTerms: string[] | string): string {
  return Array.isArray(videoTerms) ? videoTerms.join(", ") : videoTerms;
}

export function parseTerms(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((term) => term.trim())
    .filter(Boolean);
}

export function clampNumber(value: string, min: number, max: number): number {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.round(parsedValue)));
}

export function normalizeStudioDefaultSettings(value: unknown): StudioDefaultSettings {
  const record = isRecord(value) ? value : {};

  return {
    videoLanguage: normalizeRequiredString(record.videoLanguage, APP_DEFAULT_STUDIO_SETTINGS.videoLanguage),
    paragraphNumber: clampNumber(String(record.paragraphNumber ?? APP_DEFAULT_STUDIO_SETTINGS.paragraphNumber), 1, 8),
    termsAmount: clampNumber(String(record.termsAmount ?? APP_DEFAULT_STUDIO_SETTINGS.termsAmount), 1, 12),
    voiceName: normalizeRequiredString(record.voiceName, APP_DEFAULT_STUDIO_SETTINGS.voiceName),
    videoAspect: normalizeVideoAspect(record.videoAspect),
    videoSource: normalizeVideoSource(record.videoSource),
    subtitleEnabled: typeof record.subtitleEnabled === "boolean" ? record.subtitleEnabled : APP_DEFAULT_STUDIO_SETTINGS.subtitleEnabled,
  };
}

export function serializeStudioDefaultSettings(settings: StudioDefaultSettings): string {
  return JSON.stringify(normalizeStudioDefaultSettings(settings));
}

export function parseStoredStudioDefaultSettings(rawValue: string | null): StudioDefaultsLoadResult {
  if (rawValue === null) {
    return { settings: APP_DEFAULT_STUDIO_SETTINGS, status: "missing" };
  }

  try {
    return { settings: normalizeStudioDefaultSettings(JSON.parse(rawValue) as unknown), status: "loaded" };
  } catch (error) {
    return {
      settings: APP_DEFAULT_STUDIO_SETTINGS,
      status: "corrupt",
      message: `Saved Studio defaults were ignored because browser storage contained invalid JSON: ${getStorageErrorMessage(error)}`,
    };
  }
}

export function loadStoredStudioDefaultSettings(storage: StudioDefaultsStorage): StudioDefaultsLoadResult {
  try {
    return parseStoredStudioDefaultSettings(storage.getItem(STUDIO_DEFAULTS_STORAGE_KEY));
  } catch (error) {
    return {
      settings: APP_DEFAULT_STUDIO_SETTINGS,
      status: "failed",
      message: `Studio defaults could not be loaded from browser storage: ${getStorageErrorMessage(error)}`,
    };
  }
}

export function saveStoredStudioDefaultSettings(storage: StudioDefaultsStorage, settings: StudioDefaultSettings): StudioDefaultsStorageActionResult {
  try {
    storage.setItem(STUDIO_DEFAULTS_STORAGE_KEY, serializeStudioDefaultSettings(settings));
    return { ok: true };
  } catch (error) {
    return { ok: false, message: `Studio defaults could not be saved in browser storage: ${getStorageErrorMessage(error)}` };
  }
}

export function clearStoredStudioDefaultSettings(storage: StudioDefaultsStorage): StudioDefaultsStorageActionResult {
  try {
    storage.removeItem(STUDIO_DEFAULTS_STORAGE_KEY);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: `Studio defaults could not be reset in browser storage: ${getStorageErrorMessage(error)}` };
  }
}

function normalizeRequiredString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function normalizeVideoAspect(value: unknown): StudioVideoAspect {
  return VIDEO_ASPECT_OPTIONS.includes(value as StudioVideoAspect) ? value as StudioVideoAspect : APP_DEFAULT_STUDIO_SETTINGS.videoAspect;
}

function normalizeVideoSource(value: unknown): StudioVideoSource {
  return VIDEO_SOURCE_OPTIONS.includes(value as StudioVideoSource) ? value as StudioVideoSource : APP_DEFAULT_STUDIO_SETTINGS.videoSource;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getStorageErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown storage error";
}
