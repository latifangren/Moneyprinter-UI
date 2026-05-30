import { useEffect, useMemo, useReducer, useState } from "react";
import { RotateCcw, Save, Undo2 } from "lucide-react";
import type { ApiStatus, BackendOptionsData } from "../api";
import { getOptions } from "../api";
import { getErrorMessage } from "../apiErrors";
import { API_STATUS_PROBE_PATH, LOCAL_BACKEND_DEFAULT_URL, SAME_ORIGIN_API_BASE_LABEL } from "../apiSettings";
import { ApiStatusCard } from "../components/ApiStatusCard";
import {
  APP_DEFAULT_STUDIO_SETTINGS,
  STUDIO_DEFAULTS_STORAGE_KEY,
  clearStoredStudioDefaultSettings,
  clampNumber,
  formatVideoAspectLabel,
  formatVideoSourceLabel,
  loadStoredStudioDefaultSettings,
  saveStoredStudioDefaultSettings,
  type StudioDefaultSettings,
  type StudioDefaultsLoadResult,
  type StudioVideoAspect,
  type StudioVideoSource,
} from "../studioForm";
import {
  ensureSelectedOption,
  ensureSelectedVoiceGroup,
  getEffectiveStudioOptionSelections,
  normalizeStudioOptions,
} from "../studioOptions";

type SettingsPageProps = {
  status: ApiStatus;
  onRefresh: () => Promise<void>;
};

type SettingsStorageState = "saved" | "missing" | "corrupt" | "unavailable";

type SettingsStorageSnapshot = {
  settings: StudioDefaultSettings;
  storageState: SettingsStorageState;
  message: string;
};

type OptionsFetchStatus = "idle" | "loading" | "loaded" | "error";

type OptionsFetchState = {
  status: OptionsFetchStatus;
  data: BackendOptionsData | null;
  error: string;
};

type OptionsFetchAction =
  | { type: "loading" }
  | { type: "loaded"; data: BackendOptionsData }
  | { type: "error"; error: string };

const INITIAL_OPTIONS_FETCH_STATE: OptionsFetchState = { status: "idle", data: null, error: "" };

function optionsFetchReducer(_state: OptionsFetchState, action: OptionsFetchAction): OptionsFetchState {
  switch (action.type) {
    case "loading":
      return { status: "loading", data: null, error: "" };
    case "loaded":
      return { status: "loaded", data: action.data, error: "" };
    case "error":
      return { status: "error", data: null, error: action.error };
  }
}

export function SettingsPage({ status, onRefresh }: SettingsPageProps) {
  const [initialStudioDefaults] = useState<SettingsStorageSnapshot>(() => getInitialStudioDefaults());
  const [language, setLanguage] = useState(initialStudioDefaults.settings.videoLanguage);
  const [paragraphNumber, setParagraphNumber] = useState(initialStudioDefaults.settings.paragraphNumber);
  const [termsAmount, setTermsAmount] = useState(initialStudioDefaults.settings.termsAmount);
  const [voiceName, setVoiceName] = useState(initialStudioDefaults.settings.voiceName);
  const [videoAspect, setVideoAspect] = useState<StudioVideoAspect>(initialStudioDefaults.settings.videoAspect);
  const [videoSource, setVideoSource] = useState<StudioVideoSource>(initialStudioDefaults.settings.videoSource);
  const [subtitleEnabled, setSubtitleEnabled] = useState(initialStudioDefaults.settings.subtitleEnabled);
  const [storageState, setStorageState] = useState<SettingsStorageState>(initialStudioDefaults.storageState);
  const [settingsMessage, setSettingsMessage] = useState(initialStudioDefaults.message);
  const [optionsFetchState, dispatchOptionsFetch] = useReducer(optionsFetchReducer, INITIAL_OPTIONS_FETCH_STATE);
  const storageBadgeClass = storageState === "saved" ? "status-online" : storageState === "corrupt" || storageState === "unavailable" ? "status-offline" : "status-checking";
  const backendReady = status.state === "online";
  const optionsFetchStatus = backendReady ? optionsFetchState.status : "idle";
  const optionsLoaded = optionsFetchStatus === "loaded";
  const optionsError = optionsFetchStatus === "error" ? optionsFetchState.error : "";
  const optionsData = optionsLoaded ? optionsFetchState.data : null;
  const studioOptions = useMemo(() => normalizeStudioOptions(optionsData), [optionsData]);
  const effectiveOptions = getEffectiveStudioOptionSelections(studioOptions, { videoAspect, videoSource, voiceName });
  const selectedVideoAspect = optionsLoaded || optionsError ? effectiveOptions.videoAspect : videoAspect;
  const selectedVideoSource = optionsLoaded || optionsError ? effectiveOptions.videoSource : videoSource;
  const selectedVoiceName = optionsLoaded ? effectiveOptions.voiceName : voiceName;
  const languageOptions = useMemo(
    () => ensureSelectedOption(studioOptions.languages, language, "Current language"),
    [language, studioOptions.languages],
  );
  const voiceGroups = useMemo(
    () => ensureSelectedVoiceGroup(studioOptions.voiceGroups, selectedVoiceName),
    [selectedVoiceName, studioOptions.voiceGroups],
  );

  useEffect(() => {
    if (!backendReady) {
      return;
    }

    const controller = new AbortController();
    dispatchOptionsFetch({ type: "loading" });

    getOptions(controller.signal)
      .then((data) => {
        dispatchOptionsFetch({ type: "loaded", data });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          dispatchOptionsFetch({ type: "error", error: getErrorMessage(error) });
        }
      });

    return () => controller.abort();
  }, [backendReady]);

  function getCurrentDefaults(): StudioDefaultSettings {
    return {
      videoLanguage: language,
      paragraphNumber,
      termsAmount,
      voiceName: selectedVoiceName,
      videoAspect: selectedVideoAspect,
      videoSource: selectedVideoSource,
      subtitleEnabled,
    };
  }

  function applyDefaults(settings: StudioDefaultSettings) {
    setLanguage(settings.videoLanguage);
    setParagraphNumber(settings.paragraphNumber);
    setTermsAmount(settings.termsAmount);
    setVoiceName(settings.voiceName);
    setVideoAspect(settings.videoAspect);
    setVideoSource(settings.videoSource);
    setSubtitleEnabled(settings.subtitleEnabled);
  }

  function handleSaveDefaults() {
    const storageResult = getBrowserStorage();
    if (!storageResult.storage) {
      setStorageState("unavailable");
      setSettingsMessage(storageResult.message);
      return;
    }

    const saveResult = saveStoredStudioDefaultSettings(storageResult.storage, getCurrentDefaults());
    if (!saveResult.ok) {
      setStorageState("unavailable");
      setSettingsMessage(saveResult.message);
      return;
    }

    setStorageState("saved");
    setSettingsMessage("Studio defaults saved in this browser only. Subject, script, and terms were not stored.");
  }

  function handleRestoreSavedDefaults() {
    const storageResult = getBrowserStorage();
    if (!storageResult.storage) {
      setStorageState("unavailable");
      setSettingsMessage(storageResult.message);
      return;
    }

    const loadResult = loadStoredStudioDefaultSettings(storageResult.storage);
    applyDefaults(loadResult.settings);
    setStorageState(toSettingsStorageState(loadResult));
    setSettingsMessage(getLoadMessage(loadResult));
  }

  function handleResetAppDefaults() {
    const storageResult = getBrowserStorage();
    if (!storageResult.storage) {
      applyDefaults(APP_DEFAULT_STUDIO_SETTINGS);
      setStorageState("unavailable");
      setSettingsMessage(`${storageResult.message} App defaults were applied to this form only.`);
      return;
    }

    const clearResult = clearStoredStudioDefaultSettings(storageResult.storage);
    applyDefaults(APP_DEFAULT_STUDIO_SETTINGS);

    if (!clearResult.ok) {
      setStorageState("unavailable");
      setSettingsMessage(clearResult.message);
      return;
    }

    setStorageState("missing");
    setSettingsMessage("Saved browser defaults cleared. App defaults are active until you save a new browser-local preset.");
  }

  return (
    <div className="settings-layout">
      <div className="settings-column">
        <ApiStatusCard status={status} onRefresh={onRefresh} />
        <section className="panel-card settings-card settings-guidance-card" aria-labelledby="backend-guidance-heading">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Connection details</p>
              <h3 id="backend-guidance-heading">Backend guidance</h3>
            </div>
            <span className={`status-chip status-${status.state}`}>{status.state}</span>
          </div>
          <p>
            Settings can refresh the existing read-only status probe, but cannot write backend configuration. To change the API
            target, edit `VITE_API_BASE_URL`, then restart the Vite dev server or rebuild the app.
          </p>
          <dl>
            <div>
              <dt>Variable</dt>
              <dd>VITE_API_BASE_URL</dd>
            </div>
            <div>
              <dt>Current base</dt>
              <dd>{status.baseUrl}</dd>
            </div>
            <div>
              <dt>Local backend default</dt>
              <dd>{LOCAL_BACKEND_DEFAULT_URL}</dd>
            </div>
            <div>
              <dt>Same-origin label</dt>
              <dd>{SAME_ORIGIN_API_BASE_LABEL}</dd>
            </div>
            <div>
              <dt>Status probe path</dt>
              <dd>{API_STATUS_PROBE_PATH}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="panel-card settings-card settings-studio-card" aria-labelledby="studio-defaults-settings-heading">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Browser-local defaults</p>
            <h3 id="studio-defaults-settings-heading">Studio defaults</h3>
          </div>
          <span className={`status-chip ${storageBadgeClass}`}>{storageState}</span>
        </div>
        <p>
          Manage defaults used by Create Studio on this browser origin. These controls never call generation endpoints and do
          not write backend config.
        </p>

        <div className="prompt-card settings-defaults-form">
          <div className="form-grid compact-form-grid">
            <label htmlFor="settings-language">
              Language
              {optionsError ? (
                <input id="settings-language" value={language} onChange={(event) => setLanguage(event.target.value)} placeholder="en" />
              ) : (
                <select id="settings-language" value={language} onChange={(event) => setLanguage(event.target.value)}>
                  {languageOptions.map((option) => (
                    <option value={option.value} key={option.value || "auto"}>{option.label}</option>
                  ))}
                </select>
              )}
            </label>
            <label htmlFor="settings-paragraphs">
              Paragraphs
              <input
                id="settings-paragraphs"
                min={1}
                max={8}
                type="number"
                value={paragraphNumber}
                onChange={(event) => setParagraphNumber(clampNumber(event.target.value, 1, 8))}
              />
            </label>
            <label htmlFor="settings-terms-amount">
              Terms
              <input
                id="settings-terms-amount"
                min={1}
                max={12}
                type="number"
                value={termsAmount}
                onChange={(event) => setTermsAmount(clampNumber(event.target.value, 1, 12))}
              />
            </label>
          </div>

          <div className="form-grid compact-form-grid">
            <label htmlFor="settings-video-aspect">
              Aspect
              <select id="settings-video-aspect" value={selectedVideoAspect} onChange={(event) => setVideoAspect(event.target.value as StudioVideoAspect)}>
                {studioOptions.videoAspects.map((option) => (
                  <option value={option} key={option}>{formatVideoAspectLabel(option)}</option>
                ))}
              </select>
            </label>
            <label htmlFor="settings-video-source">
              Source
              <select id="settings-video-source" value={selectedVideoSource} onChange={(event) => setVideoSource(event.target.value as StudioVideoSource)}>
                {studioOptions.videoSources.map((option) => (
                  <option value={option} key={option}>{formatVideoSourceLabel(option)}</option>
                ))}
              </select>
            </label>
            <label htmlFor="settings-voice-name">
              Voice
              {optionsError ? (
                <input id="settings-voice-name" value={voiceName} onChange={(event) => setVoiceName(event.target.value)} />
              ) : (
                <select id="settings-voice-name" value={selectedVoiceName} onChange={(event) => setVoiceName(event.target.value)}>
                  {voiceGroups.map((group) => (
                    <optgroup label={group.label} key={group.id}>
                      {group.voices.map((voice) => (
                        <option value={voice} key={`${group.id}:${voice}`}>{voice}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              )}
            </label>
          </div>

          <p className={`form-alert ${optionsError ? "form-alert-error" : "form-alert-info"}`}>
            {optionsError
              ? `Options metadata unavailable, manual fallback active: ${optionsError}`
              : optionsLoaded
                ? "Language, voice, aspect, and source choices use /api/v1/options."
                : "Loading options metadata from /api/v1/options..."}
          </p>

          <label className="toggle-row" htmlFor="settings-subtitle-enabled">
            <span>
              Subtitles
              <small>Saved as `subtitleEnabled` for future Studio payloads.</small>
            </span>
            <input
              id="settings-subtitle-enabled"
              type="checkbox"
              checked={subtitleEnabled}
              onChange={(event) => setSubtitleEnabled(event.target.checked)}
            />
          </label>

          <div className="studio-default-actions settings-default-actions">
            <button className="primary-action" type="button" onClick={handleSaveDefaults}>
              <Save size={16} aria-hidden="true" />
              Save defaults
            </button>
            <button className="secondary-action" type="button" onClick={handleRestoreSavedDefaults}>
              <RotateCcw size={16} aria-hidden="true" />
              Restore saved defaults
            </button>
            <button className="secondary-action" type="button" onClick={handleResetAppDefaults}>
              <Undo2 size={16} aria-hidden="true" />
              Reset app defaults
            </button>
          </div>

          {settingsMessage ? <p className={`form-alert ${storageState === "corrupt" || storageState === "unavailable" ? "form-alert-error" : "form-alert-info"}`}>{settingsMessage}</p> : null}
        </div>

        <dl className="settings-storage-meta">
          <div>
            <dt>Storage scope</dt>
            <dd>Browser localStorage only</dd>
          </div>
          <div>
            <dt>Storage key</dt>
            <dd>{STUDIO_DEFAULTS_STORAGE_KEY}</dd>
          </div>
          <div>
            <dt>Saved state</dt>
            <dd>{storageState}</dd>
          </div>
          <div>
            <dt>Never stored</dt>
            <dd>Subject, script, generated terms</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

function getInitialStudioDefaults(): SettingsStorageSnapshot {
  const storageResult = getBrowserStorage();
  if (!storageResult.storage) {
    return {
      settings: APP_DEFAULT_STUDIO_SETTINGS,
      storageState: "unavailable",
      message: storageResult.message,
    };
  }

  const loadResult = loadStoredStudioDefaultSettings(storageResult.storage);
  return {
    settings: loadResult.settings,
    storageState: toSettingsStorageState(loadResult),
    message: getLoadMessage(loadResult),
  };
}

function getBrowserStorage(): { storage: Storage | null; message: string } {
  if (typeof window === "undefined") {
    return { storage: null, message: "Browser storage is unavailable during server-side rendering." };
  }

  try {
    return { storage: window.localStorage, message: "" };
  } catch (error) {
    return { storage: null, message: `Browser storage is unavailable: ${getStorageErrorMessage(error)}` };
  }
}

function toSettingsStorageState(loadResult: StudioDefaultsLoadResult): SettingsStorageState {
  if (loadResult.status === "loaded") {
    return "saved";
  }

  if (loadResult.status === "failed") {
    return "unavailable";
  }

  return loadResult.status;
}

function getLoadMessage(loadResult: StudioDefaultsLoadResult): string {
  if (loadResult.message) {
    return loadResult.message;
  }

  if (loadResult.status === "loaded") {
    return "Saved Studio defaults loaded from this browser.";
  }

  if (loadResult.status === "missing") {
    return "No saved Studio defaults found. App defaults are active.";
  }

  return "Studio defaults storage is unavailable. App defaults are active.";
}

function getStorageErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown storage error";
}
