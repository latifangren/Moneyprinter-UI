import { useEffect, useMemo, useReducer } from "react";
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
  type SelectOption,
  type StudioOptions,
  type VoiceOptionGroup,
} from "../studioOptions";

type SettingsPageProps = {
  status: ApiStatus;
  onRefresh: () => Promise<void>;
};

type SettingsStudioDefaultsFormProps = {
  language: string;
  paragraphNumber: number;
  termsAmount: number;
  voiceName: string;
  selectedVideoAspect: StudioVideoAspect;
  selectedVideoSource: StudioVideoSource;
  selectedVoiceName: string;
  subtitleEnabled: boolean;
  storageState: SettingsStorageState;
  settingsMessage: string;
  optionsError: string;
  optionsLoaded: boolean;
  languageOptions: SelectOption[];
  voiceGroups: VoiceOptionGroup[];
  studioOptions: StudioOptions;
  onLanguageChange: (value: string) => void;
  onParagraphNumberChange: (value: number) => void;
  onTermsAmountChange: (value: number) => void;
  onVoiceNameChange: (value: string) => void;
  onVideoAspectChange: (value: StudioVideoAspect) => void;
  onVideoSourceChange: (value: StudioVideoSource) => void;
  onSubtitleEnabledChange: (value: boolean) => void;
  onSaveDefaults: () => void;
  onRestoreSavedDefaults: () => void;
  onResetAppDefaults: () => void;
};

type SettingsStorageState = "saved" | "missing" | "corrupt" | "unavailable";

type SettingsPageState = {
  settings: StudioDefaultSettings;
  storageState: SettingsStorageState;
  settingsMessage: string;
};

type SettingsPageAction =
  | { type: "languageChanged"; value: string }
  | { type: "paragraphNumberChanged"; value: number }
  | { type: "termsAmountChanged"; value: number }
  | { type: "voiceNameChanged"; value: string }
  | { type: "videoAspectChanged"; value: StudioVideoAspect }
  | { type: "videoSourceChanged"; value: StudioVideoSource }
  | { type: "subtitleEnabledChanged"; value: boolean }
  | {
      type: "defaultsApplied";
      settings: StudioDefaultSettings;
      storageState: SettingsStorageState;
      settingsMessage: string;
    }
  | { type: "saveSucceeded" }
  | { type: "storageUnavailable"; settings?: StudioDefaultSettings; settingsMessage: string };

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

const INITIAL_OPTIONS_FETCH_STATE: OptionsFetchState = {
  status: "idle",
  data: null,
  error: "",
};

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

function settingsPageReducer(state: SettingsPageState, action: SettingsPageAction): SettingsPageState {
  switch (action.type) {
    case "languageChanged":
      return { ...state, settings: { ...state.settings, videoLanguage: action.value } };
    case "paragraphNumberChanged":
      return { ...state, settings: { ...state.settings, paragraphNumber: action.value } };
    case "termsAmountChanged":
      return { ...state, settings: { ...state.settings, termsAmount: action.value } };
    case "voiceNameChanged":
      return { ...state, settings: { ...state.settings, voiceName: action.value } };
    case "videoAspectChanged":
      return { ...state, settings: { ...state.settings, videoAspect: action.value } };
    case "videoSourceChanged":
      return { ...state, settings: { ...state.settings, videoSource: action.value } };
    case "subtitleEnabledChanged":
      return { ...state, settings: { ...state.settings, subtitleEnabled: action.value } };
    case "defaultsApplied":
      return {
        settings: action.settings,
        storageState: action.storageState,
        settingsMessage: action.settingsMessage,
      };
    case "saveSucceeded":
      return {
        ...state,
        storageState: "saved",
        settingsMessage: "Studio defaults saved in this browser only. Subject, script, and terms were not stored.",
      };
    case "storageUnavailable":
      return {
        ...state,
        settings: action.settings ?? state.settings,
        storageState: "unavailable",
        settingsMessage: action.settingsMessage,
      };
  }
}

export function SettingsPage({ status, onRefresh }: SettingsPageProps) {
  const [settingsPageState, dispatchSettingsPage] = useReducer(settingsPageReducer, undefined, getInitialStudioDefaults);
  const [optionsFetchState, dispatchOptionsFetch] = useReducer(optionsFetchReducer, INITIAL_OPTIONS_FETCH_STATE);
  const { settings, storageState, settingsMessage } = settingsPageState;
  const {
    videoLanguage: language,
    paragraphNumber,
    termsAmount,
    voiceName,
    videoAspect,
    videoSource,
    subtitleEnabled,
  } = settings;
  const storageBadgeClass = storageState === "saved"
    ? "status-online"
    : storageState === "corrupt" || storageState === "unavailable"
      ? "status-offline"
      : "status-checking";
  const backendReady = status.state === "online";
  const optionsFetchStatus = backendReady ? optionsFetchState.status : "idle";
  const optionsLoaded = optionsFetchStatus === "loaded";
  const optionsError = optionsFetchStatus === "error" ? optionsFetchState.error : "";
  const optionsData = optionsLoaded ? optionsFetchState.data : null;
  const studioOptions = useMemo(() => normalizeStudioOptions(optionsData), [optionsData]);
  const effectiveOptions = getEffectiveStudioOptionSelections(studioOptions, {
    videoAspect,
    videoSource,
    voiceName,
  });
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
  const handleLanguageChange = (value: string) => {
    dispatchSettingsPage({ type: "languageChanged", value });
  };
  const handleParagraphNumberChange = (value: number) => {
    dispatchSettingsPage({ type: "paragraphNumberChanged", value });
  };
  const handleTermsAmountChange = (value: number) => {
    dispatchSettingsPage({ type: "termsAmountChanged", value });
  };
  const handleVoiceNameChange = (value: string) => {
    dispatchSettingsPage({ type: "voiceNameChanged", value });
  };
  const handleVideoAspectChange = (value: StudioVideoAspect) => {
    dispatchSettingsPage({ type: "videoAspectChanged", value });
  };
  const handleVideoSourceChange = (value: StudioVideoSource) => {
    dispatchSettingsPage({ type: "videoSourceChanged", value });
  };
  const handleSubtitleEnabledChange = (value: boolean) => {
    dispatchSettingsPage({ type: "subtitleEnabledChanged", value });
  };

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

  function handleSaveDefaults() {
    const storageResult = getBrowserStorage();
    if (!storageResult.storage) {
      dispatchSettingsPage({
        type: "storageUnavailable",
        settingsMessage: storageResult.message,
      });
      return;
    }

    const saveResult = saveStoredStudioDefaultSettings(storageResult.storage, getCurrentDefaults());
    if (!saveResult.ok) {
      dispatchSettingsPage({
        type: "storageUnavailable",
        settingsMessage: saveResult.message,
      });
      return;
    }

    dispatchSettingsPage({ type: "saveSucceeded" });
  }

  function handleRestoreSavedDefaults() {
    const storageResult = getBrowserStorage();
    if (!storageResult.storage) {
      dispatchSettingsPage({
        type: "storageUnavailable",
        settingsMessage: storageResult.message,
      });
      return;
    }

    const loadResult = loadStoredStudioDefaultSettings(storageResult.storage);
    dispatchSettingsPage({
      type: "defaultsApplied",
      settings: loadResult.settings,
      storageState: toSettingsStorageState(loadResult),
      settingsMessage: getLoadMessage(loadResult),
    });
  }

  function handleResetAppDefaults() {
    const storageResult = getBrowserStorage();
    if (!storageResult.storage) {
      dispatchSettingsPage({
        type: "storageUnavailable",
        settings: APP_DEFAULT_STUDIO_SETTINGS,
        settingsMessage: `${storageResult.message} App defaults were applied to this form only.`,
      });
      return;
    }

    const clearResult = clearStoredStudioDefaultSettings(storageResult.storage);

    if (!clearResult.ok) {
      dispatchSettingsPage({
        type: "storageUnavailable",
        settings: APP_DEFAULT_STUDIO_SETTINGS,
        settingsMessage: clearResult.message,
      });
      return;
    }

    dispatchSettingsPage({
      type: "defaultsApplied",
      settings: APP_DEFAULT_STUDIO_SETTINGS,
      storageState: "missing",
      settingsMessage: "Saved browser defaults cleared. App defaults are active until you save a new browser-local preset.",
    });
  }

  return (
    <div className="settings-layout">
      <div className="settings-column">
        <ApiStatusCard status={status} onRefresh={onRefresh} />
        <BackendGuidanceCard status={status} />
      </div>

      <section
        className="panel-card settings-card settings-studio-card"
        aria-labelledby="studio-defaults-settings-heading"
      >
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

        <SettingsStudioDefaultsForm
          language={language}
          paragraphNumber={paragraphNumber}
          termsAmount={termsAmount}
          voiceName={voiceName}
          selectedVideoAspect={selectedVideoAspect}
          selectedVideoSource={selectedVideoSource}
          selectedVoiceName={selectedVoiceName}
          subtitleEnabled={subtitleEnabled}
          storageState={storageState}
          settingsMessage={settingsMessage}
          optionsError={optionsError}
          optionsLoaded={optionsLoaded}
          languageOptions={languageOptions}
          voiceGroups={voiceGroups}
          studioOptions={studioOptions}
          onLanguageChange={handleLanguageChange}
          onParagraphNumberChange={handleParagraphNumberChange}
          onTermsAmountChange={handleTermsAmountChange}
          onVoiceNameChange={handleVoiceNameChange}
          onVideoAspectChange={handleVideoAspectChange}
          onVideoSourceChange={handleVideoSourceChange}
          onSubtitleEnabledChange={handleSubtitleEnabledChange}
          onSaveDefaults={handleSaveDefaults}
          onRestoreSavedDefaults={handleRestoreSavedDefaults}
          onResetAppDefaults={handleResetAppDefaults}
        />

        <SettingsStorageMeta storageState={storageState} />
      </section>
    </div>
  );
}

function BackendGuidanceCard({ status }: Pick<SettingsPageProps, "status">) {
  return (
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
  );
}

function SettingsStudioDefaultsForm({
  language,
  paragraphNumber,
  termsAmount,
  voiceName,
  selectedVideoAspect,
  selectedVideoSource,
  selectedVoiceName,
  subtitleEnabled,
  storageState,
  settingsMessage,
  optionsError,
  optionsLoaded,
  languageOptions,
  voiceGroups,
  studioOptions,
  onLanguageChange,
  onParagraphNumberChange,
  onTermsAmountChange,
  onVoiceNameChange,
  onVideoAspectChange,
  onVideoSourceChange,
  onSubtitleEnabledChange,
  onSaveDefaults,
  onRestoreSavedDefaults,
  onResetAppDefaults,
}: SettingsStudioDefaultsFormProps) {
  return (
    <div className="prompt-card settings-defaults-form">
      <div className="form-grid compact-form-grid">
        <label htmlFor="settings-language">
          Language
          {optionsError ? (
            <input
              id="settings-language"
              value={language}
              onChange={(event) => onLanguageChange(event.target.value)}
              placeholder="en"
            />
          ) : (
            <select
              id="settings-language"
              value={language}
              onChange={(event) => onLanguageChange(event.target.value)}
            >
              {languageOptions.map((option) => (
                <option value={option.value} key={option.value || "auto"}>
                  {option.label}
                </option>
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
            onChange={(event) => onParagraphNumberChange(clampNumber(event.target.value, 1, 8))}
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
            onChange={(event) => onTermsAmountChange(clampNumber(event.target.value, 1, 12))}
          />
        </label>
      </div>

      <div className="form-grid compact-form-grid">
        <label htmlFor="settings-video-aspect">
          Aspect
          <select
            id="settings-video-aspect"
            value={selectedVideoAspect}
            onChange={(event) => onVideoAspectChange(event.target.value as StudioVideoAspect)}
          >
            {studioOptions.videoAspects.map((option) => (
              <option value={option} key={option}>
                {formatVideoAspectLabel(option)}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="settings-video-source">
          Source
          <select
            id="settings-video-source"
            value={selectedVideoSource}
            onChange={(event) => onVideoSourceChange(event.target.value as StudioVideoSource)}
          >
            {studioOptions.videoSources.map((option) => (
              <option value={option} key={option}>
                {formatVideoSourceLabel(option)}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="settings-voice-name">
          Voice
          {optionsError ? (
            <input
              id="settings-voice-name"
              value={voiceName}
              onChange={(event) => onVoiceNameChange(event.target.value)}
            />
          ) : (
            <select
              id="settings-voice-name"
              value={selectedVoiceName}
              onChange={(event) => onVoiceNameChange(event.target.value)}
            >
              {voiceGroups.map((group) => (
                <optgroup label={group.label} key={group.id}>
                  {group.voices.map((voice) => (
                    <option value={voice} key={`${group.id}:${voice}`}>
                      {voice}
                    </option>
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
          onChange={(event) => onSubtitleEnabledChange(event.target.checked)}
        />
      </label>

      <div className="studio-default-actions settings-default-actions">
        <button className="primary-action" type="button" onClick={onSaveDefaults}>
          <Save size={16} aria-hidden="true" />
          Save defaults
        </button>
        <button className="secondary-action" type="button" onClick={onRestoreSavedDefaults}>
          <RotateCcw size={16} aria-hidden="true" />
          Restore saved defaults
        </button>
        <button className="secondary-action" type="button" onClick={onResetAppDefaults}>
          <Undo2 size={16} aria-hidden="true" />
          Reset app defaults
        </button>
      </div>

      {settingsMessage ? (
        <p
          className={`form-alert ${
            storageState === "corrupt" || storageState === "unavailable"
              ? "form-alert-error"
              : "form-alert-info"
          }`}
        >
          {settingsMessage}
        </p>
      ) : null}
    </div>
  );
}

function SettingsStorageMeta({ storageState }: Pick<SettingsPageState, "storageState">) {
  return (
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
  );
}

function getInitialStudioDefaults(): SettingsPageState {
  const storageResult = getBrowserStorage();
  if (!storageResult.storage) {
    return {
      settings: APP_DEFAULT_STUDIO_SETTINGS,
      storageState: "unavailable",
      settingsMessage: storageResult.message,
    };
  }

  const loadResult = loadStoredStudioDefaultSettings(storageResult.storage);
  return {
    settings: loadResult.settings,
    storageState: toSettingsStorageState(loadResult),
    settingsMessage: getLoadMessage(loadResult),
  };
}

function getBrowserStorage(): { storage: Storage | null; message: string } {
  if (typeof window === "undefined") {
    return {
      storage: null,
      message: "Browser storage is unavailable during server-side rendering.",
    };
  }

  try {
    return {
      storage: window.localStorage,
      message: "",
    };
  } catch (error) {
    return {
      storage: null,
      message: `Browser storage is unavailable: ${getStorageErrorMessage(error)}`,
    };
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
