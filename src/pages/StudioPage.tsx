import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { AlertCircle, Loader2, PlayCircle, RotateCcw, Save, Sparkles, Undo2, Wand2 } from "lucide-react";
import type { ApiStatus, BackendOptionsData, CreateVideoPayload } from "../api";
import { createVideo, generateScript, generateTerms, getOptions, getTask } from "../api";
import { getErrorMessage } from "../apiErrors";
import { OutputInspectorDialog } from "../components/OutputInspectorDialog";
import { TaskOutputs } from "../components/TaskOutputs";
import { TaskProgress } from "../components/TaskProgress";
import type { OutputInspectSelection } from "../outputInspectorModel";
import {
  APP_DEFAULT_STUDIO_SETTINGS,
  clearStoredStudioDefaultSettings,
  clampNumber,
  formatTerms,
  formatVideoAspectLabel,
  formatVideoSourceLabel,
  loadStoredStudioDefaultSettings,
  parseTerms,
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
import {
  createSubmittedTask,
  taskStatusLabel,
  toSubmittedTask,
  type SubmittedTask,
  type TaskUpdate,
} from "../taskModel";

const TASK_POLL_INTERVAL_MS = 2500;
const TASK_POLL_MAX_ATTEMPTS = 120;

type StudioPageProps = {
  status: ApiStatus;
  onTaskChange: (taskId: string, update: TaskUpdate & Pick<SubmittedTask, "subject">) => void;
};

type StudioGenerationFormProps = {
  values: StudioGenerationFormValues;
  controls: StudioGenerationFormControls;
  status: StudioGenerationFormStatus;
  actions: StudioGenerationFormActions;
};

type StudioGenerationFormValues = {
  subject: string;
  script: string;
  terms: string;
  language: string;
  paragraphNumber: number;
  termsAmount: number;
  voiceName: string;
  selectedVideoAspect: StudioVideoAspect;
  selectedVideoSource: StudioVideoSource;
  selectedVoiceName: string;
  subtitleEnabled: boolean;
  studioError: string;
  studioMessage: string;
};

type StudioGenerationFormControls = {
  languageOptions: SelectOption[];
  voiceGroups: VoiceOptionGroup[];
  studioOptions: StudioOptions;
};

type StudioGenerationFormStatus = {
  optionsError: string;
  backendReady: boolean;
  subjectReady: boolean;
  scriptReady: boolean;
  termsReady: boolean;
  isGeneratingScript: boolean;
  isGeneratingTerms: boolean;
  isSubmittingVideo: boolean;
  isBusy: boolean;
};

type StudioGenerationFormActions = {
  onSubjectChange: (value: string) => void;
  onScriptChange: (value: string) => void;
  onTermsChange: (value: string) => void;
  onLanguageChange: (value: string) => void;
  onParagraphNumberChange: (value: number) => void;
  onTermsAmountChange: (value: number) => void;
  onVideoAspectChange: (value: StudioVideoAspect) => void;
  onVideoSourceChange: (value: StudioVideoSource) => void;
  onVoiceNameChange: (value: string) => void;
  onSubtitleEnabledChange: (value: boolean) => void;
  onSaveStudioDefaults: () => void;
  onRestoreStudioDefaults: () => void;
  onResetStudioDefaults: () => void;
  onGenerateScript: () => void;
  onGenerateTerms: () => void;
  onCreateVideo: () => void;
};

type StudioTaskPanelProps = {
  activeTask: SubmittedTask;
  onInspectOutput: (selection: OutputInspectSelection) => void;
};

const STUDIO_STEP_ITEMS = [
  ["1", "Script", "POST /api/v1/scripts fills the editable script field."],
  ["2", "Terms", "POST /api/v1/terms returns material search keywords."],
  ["3", "Render", "POST /api/v1/videos creates a backend task."],
  ["4", "Results", "GET /api/v1/tasks/{task_id} powers progress and output previews."],
] as const;

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

type StudioWorkflowState = {
  subject: string;
  script: string;
  terms: string;
  settings: StudioDefaultSettings;
  studioMessage: string;
  studioError: string;
  isGeneratingScript: boolean;
  isGeneratingTerms: boolean;
  isSubmittingVideo: boolean;
  activeTask: SubmittedTask | null;
};

type StudioWorkflowAction =
  | { type: "subjectChanged"; value: string }
  | { type: "scriptChanged"; value: string }
  | { type: "termsChanged"; value: string }
  | { type: "languageChanged"; value: string }
  | { type: "paragraphNumberChanged"; value: number }
  | { type: "termsAmountChanged"; value: number }
  | { type: "videoAspectChanged"; value: StudioVideoAspect }
  | { type: "videoSourceChanged"; value: StudioVideoSource }
  | { type: "voiceNameChanged"; value: string }
  | { type: "subtitleEnabledChanged"; value: boolean }
  | { type: "defaultSettingsApplied"; settings: StudioDefaultSettings }
  | { type: "studioErrorChanged"; error: string }
  | { type: "studioNoticeChanged"; error: string; message: string }
  | { type: "scriptGenerationStarted" }
  | { type: "scriptGenerationSucceeded"; script: string }
  | { type: "scriptGenerationFailed"; error: string }
  | { type: "scriptGenerationFinished" }
  | { type: "termsGenerationStarted" }
  | { type: "termsGenerationSucceeded"; terms: string }
  | { type: "termsGenerationFailed"; error: string }
  | { type: "termsGenerationFinished" }
  | { type: "videoSubmissionStarted" }
  | { type: "videoSubmissionSucceeded"; task: SubmittedTask; message: string }
  | { type: "activeTaskChanged"; task: SubmittedTask }
  | { type: "videoTaskCompleted" }
  | { type: "videoTaskFailed"; error: string }
  | { type: "activeTaskStatusChanged"; status: "error" | "timeout"; message: string }
  | { type: "videoSubmissionFinished" };

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

function studioWorkflowReducer(state: StudioWorkflowState, action: StudioWorkflowAction): StudioWorkflowState {
  switch (action.type) {
    case "subjectChanged":
      return { ...state, subject: action.value };
    case "scriptChanged":
      return { ...state, script: action.value };
    case "termsChanged":
      return { ...state, terms: action.value };
    case "languageChanged":
      return { ...state, settings: { ...state.settings, videoLanguage: action.value } };
    case "paragraphNumberChanged":
      return { ...state, settings: { ...state.settings, paragraphNumber: action.value } };
    case "termsAmountChanged":
      return { ...state, settings: { ...state.settings, termsAmount: action.value } };
    case "videoAspectChanged":
      return { ...state, settings: { ...state.settings, videoAspect: action.value } };
    case "videoSourceChanged":
      return { ...state, settings: { ...state.settings, videoSource: action.value } };
    case "voiceNameChanged":
      return { ...state, settings: { ...state.settings, voiceName: action.value } };
    case "subtitleEnabledChanged":
      return { ...state, settings: { ...state.settings, subtitleEnabled: action.value } };
    case "defaultSettingsApplied":
      return { ...state, settings: action.settings };
    case "studioErrorChanged":
      return { ...state, studioError: action.error };
    case "studioNoticeChanged":
      return { ...state, studioError: action.error, studioMessage: action.message };
    case "scriptGenerationStarted":
      return {
        ...state,
        isGeneratingScript: true,
        studioError: "",
        studioMessage: "Generating script from the FastAPI /scripts endpoint...",
      };
    case "scriptGenerationSucceeded":
      return {
        ...state,
        script: action.script,
        studioMessage: "Script generated and loaded into the editor.",
      };
    case "scriptGenerationFailed":
      return { ...state, studioError: action.error, studioMessage: "" };
    case "scriptGenerationFinished":
      return { ...state, isGeneratingScript: false };
    case "termsGenerationStarted":
      return {
        ...state,
        isGeneratingTerms: true,
        studioError: "",
        studioMessage: "Generating search terms from the FastAPI /terms endpoint...",
      };
    case "termsGenerationSucceeded":
      return {
        ...state,
        terms: action.terms,
        studioMessage: "Search terms generated for video materials.",
      };
    case "termsGenerationFailed":
      return { ...state, studioError: action.error, studioMessage: "" };
    case "termsGenerationFinished":
      return { ...state, isGeneratingTerms: false };
    case "videoSubmissionStarted":
      return {
        ...state,
        isSubmittingVideo: true,
        studioError: "",
        studioMessage: "Submitting video generation task to /videos...",
      };
    case "videoSubmissionSucceeded":
      return { ...state, activeTask: action.task, studioMessage: action.message };
    case "activeTaskChanged":
      return { ...state, activeTask: action.task };
    case "videoTaskCompleted":
      return {
        ...state,
        studioMessage: "Video task completed. Results are ready below.",
        isSubmittingVideo: false,
      };
    case "videoTaskFailed":
      return {
        ...state,
        studioError: action.error,
        studioMessage: "",
        isSubmittingVideo: false,
      };
    case "activeTaskStatusChanged":
      return {
        ...state,
        activeTask: state.activeTask
          ? { ...state.activeTask, status: action.status, message: action.message }
          : state.activeTask,
      };
    case "videoSubmissionFinished":
      return { ...state, isSubmittingVideo: false };
  }
}

export function StudioPage({ status, onTaskChange }: StudioPageProps) {
  const [studioWorkflowState, dispatchStudioWorkflow] = useReducer(studioWorkflowReducer, undefined, getInitialStudioWorkflowState);
  const [optionsFetchState, dispatchOptionsFetch] = useReducer(optionsFetchReducer, INITIAL_OPTIONS_FETCH_STATE);
  const [inspectorSelection, setInspectorSelection] = useState<OutputInspectSelection | null>(null);
  const pollControllerRef = useRef<AbortController | null>(null);
  const pollGenerationRef = useRef(0);
  const { subject, script, terms, settings, isGeneratingScript, isGeneratingTerms, isSubmittingVideo, activeTask } = studioWorkflowState;
  const { videoLanguage: language, paragraphNumber, termsAmount, videoAspect: aspect, videoSource, voiceName, subtitleEnabled } = settings;

  const backendReady = status.state === "online";
  const optionsFetchStatus = backendReady ? optionsFetchState.status : "idle";
  const optionsLoaded = optionsFetchStatus === "loaded";
  const optionsError = optionsFetchStatus === "error" ? optionsFetchState.error : "";
  const optionsData = optionsLoaded ? optionsFetchState.data : null;
  const studioOptions = useMemo(() => normalizeStudioOptions(optionsData), [optionsData]);
  const effectiveOptions = getEffectiveStudioOptionSelections(studioOptions, { videoAspect: aspect, videoSource, voiceName });
  const selectedVideoAspect = optionsLoaded || optionsError ? effectiveOptions.videoAspect : aspect;
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

  const subjectReady = subject.trim().length > 0;
  const scriptReady = script.trim().length > 0;
  const termsReady = terms.trim().length > 0;
  const isBusy = isGeneratingScript || isGeneratingTerms || isSubmittingVideo || activeTask?.status === "processing" || activeTask?.status === "submitted";

  useEffect(() => {
    const pollGeneration = pollGenerationRef;
    const pollController = pollControllerRef;

    return () => {
      pollGeneration.current += 1;
      pollController.current?.abort();
    };
  }, []);

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

  async function handleGenerateScript() {
    if (!backendReady || !subjectReady) {
      dispatchStudioWorkflow({
        type: "studioErrorChanged",
        error: backendReady
          ? "Enter a video subject before generating a script."
          : "Backend is offline. Start api.bat and refresh status before generating.",
      });
      return;
    }

    dispatchStudioWorkflow({ type: "scriptGenerationStarted" });

    try {
      const response = await generateScript({
        video_subject: subject.trim(),
        video_language: language.trim(),
        paragraph_number: paragraphNumber,
      });
      dispatchStudioWorkflow({ type: "scriptGenerationSucceeded", script: response.video_script });
    } catch (error) {
      dispatchStudioWorkflow({ type: "scriptGenerationFailed", error: getErrorMessage(error) });
    } finally {
      dispatchStudioWorkflow({ type: "scriptGenerationFinished" });
    }
  }

  async function handleGenerateTerms() {
    if (!backendReady || !subjectReady || !scriptReady) {
      dispatchStudioWorkflow({
        type: "studioErrorChanged",
        error: !backendReady
          ? "Backend is offline. Start api.bat and refresh status before generating."
          : "Generate or paste a script before requesting search terms.",
      });
      return;
    }

    dispatchStudioWorkflow({ type: "termsGenerationStarted" });

    try {
      const response = await generateTerms({
        video_subject: subject.trim(),
        video_script: script.trim(),
        amount: termsAmount,
      });
      dispatchStudioWorkflow({ type: "termsGenerationSucceeded", terms: formatTerms(response.video_terms) });
    } catch (error) {
      dispatchStudioWorkflow({ type: "termsGenerationFailed", error: getErrorMessage(error) });
    } finally {
      dispatchStudioWorkflow({ type: "termsGenerationFinished" });
    }
  }

  async function handleCreateVideo() {
    if (!backendReady || !subjectReady || !scriptReady || !termsReady) {
      dispatchStudioWorkflow({
        type: "studioErrorChanged",
        error: !backendReady
          ? "Backend is offline. Start api.bat and refresh status before submitting."
          : "Subject, script, and terms are required before video generation.",
      });
      return;
    }

    pollGenerationRef.current += 1;
    pollControllerRef.current?.abort();
    const controller = new AbortController();
    pollControllerRef.current = controller;
    const pollGeneration = pollGenerationRef.current;

    dispatchStudioWorkflow({ type: "videoSubmissionStarted" });

    try {
      const response = await createVideo(buildVideoPayload({ subject, script, terms, selectedVideoAspect, selectedVideoSource, language, selectedVoiceName, subtitleEnabled, paragraphNumber }), controller.signal);
      const task = createSubmittedTask(response.task_id, subject.trim(), "submitted", 0, "Task submitted. Waiting for backend progress...");
      onTaskChange(response.task_id, task);
      dispatchStudioWorkflow({ type: "videoSubmissionSucceeded", task, message: `Task ${response.task_id} submitted. Polling progress now.` });
      await pollTask(response.task_id, subject.trim(), pollGeneration, controller.signal);
    } catch (error) {
      if (!controller.signal.aborted) {
        dispatchStudioWorkflow({ type: "studioNoticeChanged", error: getErrorMessage(error), message: "" });
      }
    } finally {
      if (!controller.signal.aborted) {
        dispatchStudioWorkflow({ type: "videoSubmissionFinished" });
      }
    }
  }

  async function pollTask(taskId: string, taskSubject: string, pollGeneration: number, signal: AbortSignal) {
    for (let attempt = 1; attempt <= TASK_POLL_MAX_ATTEMPTS; attempt += 1) {
      if (signal.aborted || pollGeneration !== pollGenerationRef.current) {
        return;
      }

      try {
        const task = await getTask(taskId, signal);
        const nextTask = toSubmittedTask(task, taskSubject, taskId);
        dispatchStudioWorkflow({ type: "activeTaskChanged", task: nextTask });
        onTaskChange(taskId, nextTask);

        if (nextTask.status === "complete") {
          dispatchStudioWorkflow({ type: "videoTaskCompleted" });
          return;
        }

        if (nextTask.status === "failed") {
          dispatchStudioWorkflow({ type: "videoTaskFailed", error: nextTask.message || "Video task failed in the backend." });
          return;
        }
      } catch (error) {
        if (!signal.aborted) {
          const message = getErrorMessage(error);
          dispatchStudioWorkflow({ type: "activeTaskStatusChanged", status: "error", message });
          onTaskChange(taskId, { subject: taskSubject, status: "error", message });
          dispatchStudioWorkflow({ type: "videoTaskFailed", error: message });
        }
        return;
      }

      await delay(TASK_POLL_INTERVAL_MS, signal);
    }

    const timeoutMessage = `Polling stopped after ${TASK_POLL_MAX_ATTEMPTS} attempts. Check the Tasks page or backend logs for task ${taskId}.`;
    dispatchStudioWorkflow({ type: "activeTaskStatusChanged", status: "timeout", message: timeoutMessage });
    onTaskChange(taskId, { subject: taskSubject, status: "timeout", message: timeoutMessage });
    dispatchStudioWorkflow({ type: "videoTaskFailed", error: timeoutMessage });
  }

  function handleSaveStudioDefaults() {
    const storage = getBrowserStorage();
    if (!storage) {
      dispatchStudioWorkflow({ type: "studioNoticeChanged", error: "Browser storage is unavailable, so Studio defaults could not be saved.", message: "" });
      return;
    }

    const result = saveStoredStudioDefaultSettings(storage, getCurrentDefaultSettings({ language, paragraphNumber, termsAmount, selectedVoiceName, selectedVideoAspect, selectedVideoSource, subtitleEnabled }));
    if (!result.ok) {
      dispatchStudioWorkflow({ type: "studioNoticeChanged", error: result.message, message: "" });
      return;
    }

    dispatchStudioWorkflow({ type: "studioNoticeChanged", error: "", message: "Current Studio settings saved as browser-local defaults." });
  }

  function handleRestoreStudioDefaults() {
    const storage = getBrowserStorage();
    if (!storage) {
      dispatchStudioWorkflow({ type: "studioNoticeChanged", error: "Browser storage is unavailable, so saved Studio defaults could not be restored.", message: "" });
      return;
    }

    const result = loadStoredStudioDefaultSettings(storage);
    if (result.status === "failed") {
      dispatchStudioWorkflow({ type: "studioNoticeChanged", error: result.message ?? "Saved Studio defaults could not be restored from browser storage.", message: "" });
      return;
    }

    dispatchStudioWorkflow({ type: "defaultSettingsApplied", settings: result.settings });
    dispatchStudioWorkflow({ type: "studioNoticeChanged", error: "", message: result.status === "missing" ? "No browser-local Studio defaults found. App defaults were restored." : result.message ?? "Saved Studio defaults restored." });
  }

  function handleResetStudioDefaults() {
    const storage = getBrowserStorage();
    if (!storage) {
      dispatchStudioWorkflow({ type: "studioNoticeChanged", error: "Browser storage is unavailable, so saved Studio defaults could not be cleared.", message: "" });
      return;
    }

    const result = clearStoredStudioDefaultSettings(storage);
    if (!result.ok) {
      dispatchStudioWorkflow({ type: "studioNoticeChanged", error: result.message, message: "" });
      return;
    }

    dispatchStudioWorkflow({ type: "defaultSettingsApplied", settings: APP_DEFAULT_STUDIO_SETTINGS });
    dispatchStudioWorkflow({ type: "studioNoticeChanged", error: "", message: "Studio settings reset to app defaults and saved browser defaults cleared." });
  }

  const formValues = buildStudioGenerationFormValues(studioWorkflowState, {
    language,
    paragraphNumber,
    termsAmount,
    voiceName,
    selectedVideoAspect,
    selectedVideoSource,
    selectedVoiceName,
  });
  const formControls: StudioGenerationFormControls = { languageOptions, voiceGroups, studioOptions };
  const formStatus = buildStudioGenerationFormStatus(studioWorkflowState, optionsError, {
    backendReady,
    subjectReady,
    scriptReady,
    termsReady,
    isBusy,
  });
  const formActions = buildStudioGenerationFormActions({
    dispatchStudioWorkflow,
    onSaveStudioDefaults: handleSaveStudioDefaults,
    onRestoreStudioDefaults: handleRestoreStudioDefaults,
    onResetStudioDefaults: handleResetStudioDefaults,
    onGenerateScript: handleGenerateScript,
    onGenerateTerms: handleGenerateTerms,
    onCreateVideo: handleCreateVideo,
  });

  return (
    <>
      <section className="panel-card studio-layout">
        <StudioIntroPanel status={status} backendReady={backendReady} optionsError={optionsError} optionsLoaded={optionsLoaded} />
        <StudioGenerationForm values={formValues} controls={formControls} status={formStatus} actions={formActions} />
      </section>

      {activeTask ? (
        <StudioTaskPanel activeTask={activeTask} onInspectOutput={setInspectorSelection} />
      ) : (
        <StudioStepGrid />
      )}
      <OutputInspectorDialog selection={inspectorSelection} onClose={() => setInspectorSelection(null)} />
    </>
  );
}

type CurrentDefaultSettingsInput = {
  language: string;
  paragraphNumber: number;
  termsAmount: number;
  selectedVoiceName: string;
  selectedVideoAspect: StudioVideoAspect;
  selectedVideoSource: StudioVideoSource;
  subtitleEnabled: boolean;
};

type BuildVideoPayloadInput = Pick<
  StudioGenerationFormValues,
  | "subject"
  | "script"
  | "terms"
  | "language"
  | "selectedVideoAspect"
  | "selectedVideoSource"
  | "selectedVoiceName"
  | "subtitleEnabled"
  | "paragraphNumber"
>;

type StudioFormSelectionInput = {
  language: string;
  paragraphNumber: number;
  termsAmount: number;
  voiceName: string;
  selectedVideoAspect: StudioVideoAspect;
  selectedVideoSource: StudioVideoSource;
  selectedVoiceName: string;
};

type StudioFormReadinessInput = {
  backendReady: boolean;
  subjectReady: boolean;
  scriptReady: boolean;
  termsReady: boolean;
  isBusy: boolean;
};

type StudioFormActionsInput = {
  dispatchStudioWorkflow: React.Dispatch<StudioWorkflowAction>;
  onSaveStudioDefaults: () => void;
  onRestoreStudioDefaults: () => void;
  onResetStudioDefaults: () => void;
  onGenerateScript: () => void;
  onGenerateTerms: () => void;
  onCreateVideo: () => void;
};

function getCurrentDefaultSettings({
  language,
  paragraphNumber,
  termsAmount,
  selectedVoiceName,
  selectedVideoAspect,
  selectedVideoSource,
  subtitleEnabled,
}: CurrentDefaultSettingsInput): StudioDefaultSettings {
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

function buildVideoPayload({
  subject,
  script,
  terms,
  selectedVideoAspect,
  selectedVideoSource,
  language,
  selectedVoiceName,
  subtitleEnabled,
  paragraphNumber,
}: BuildVideoPayloadInput): CreateVideoPayload {
  return {
    video_subject: subject.trim(),
    video_script: script.trim(),
    video_terms: parseTerms(terms),
    video_aspect: selectedVideoAspect,
    video_concat_mode: "random",
    video_transition_mode: null,
    video_clip_duration: 5,
    video_count: 1,
    video_source: selectedVideoSource.trim(),
    video_language: language.trim(),
    voice_name: selectedVoiceName.trim(),
    voice_volume: 1,
    voice_rate: 1,
    bgm_type: "random",
    bgm_file: "",
    bgm_volume: 0.2,
    subtitle_enabled: subtitleEnabled,
    subtitle_position: "bottom",
    custom_position: 70,
    font_name: "STHeitiMedium.ttc",
    text_fore_color: "#FFFFFF",
    text_background_color: true,
    font_size: 60,
    stroke_color: "#000000",
    stroke_width: 1.5,
    n_threads: 2,
    paragraph_number: paragraphNumber,
  };
}

function buildStudioGenerationFormValues(
  state: StudioWorkflowState,
  selections: StudioFormSelectionInput,
): StudioGenerationFormValues {
  return {
    subject: state.subject,
    script: state.script,
    terms: state.terms,
    language: selections.language,
    paragraphNumber: selections.paragraphNumber,
    termsAmount: selections.termsAmount,
    voiceName: selections.voiceName,
    selectedVideoAspect: selections.selectedVideoAspect,
    selectedVideoSource: selections.selectedVideoSource,
    selectedVoiceName: selections.selectedVoiceName,
    subtitleEnabled: state.settings.subtitleEnabled,
    studioError: state.studioError,
    studioMessage: state.studioMessage,
  };
}

function buildStudioGenerationFormStatus(
  state: StudioWorkflowState,
  optionsError: string,
  readiness: StudioFormReadinessInput,
): StudioGenerationFormStatus {
  return {
    optionsError,
    backendReady: readiness.backendReady,
    subjectReady: readiness.subjectReady,
    scriptReady: readiness.scriptReady,
    termsReady: readiness.termsReady,
    isGeneratingScript: state.isGeneratingScript,
    isGeneratingTerms: state.isGeneratingTerms,
    isSubmittingVideo: state.isSubmittingVideo,
    isBusy: readiness.isBusy,
  };
}

function buildStudioGenerationFormActions({
  dispatchStudioWorkflow,
  onSaveStudioDefaults,
  onRestoreStudioDefaults,
  onResetStudioDefaults,
  onGenerateScript,
  onGenerateTerms,
  onCreateVideo,
}: StudioFormActionsInput): StudioGenerationFormActions {
  return {
    onSubjectChange: (value) => dispatchStudioWorkflow({ type: "subjectChanged", value }),
    onScriptChange: (value) => dispatchStudioWorkflow({ type: "scriptChanged", value }),
    onTermsChange: (value) => dispatchStudioWorkflow({ type: "termsChanged", value }),
    onLanguageChange: (value) => dispatchStudioWorkflow({ type: "languageChanged", value }),
    onParagraphNumberChange: (value) => dispatchStudioWorkflow({ type: "paragraphNumberChanged", value }),
    onTermsAmountChange: (value) => dispatchStudioWorkflow({ type: "termsAmountChanged", value }),
    onVideoAspectChange: (value) => dispatchStudioWorkflow({ type: "videoAspectChanged", value }),
    onVideoSourceChange: (value) => dispatchStudioWorkflow({ type: "videoSourceChanged", value }),
    onVoiceNameChange: (value) => dispatchStudioWorkflow({ type: "voiceNameChanged", value }),
    onSubtitleEnabledChange: (value) => dispatchStudioWorkflow({ type: "subtitleEnabledChanged", value }),
    onSaveStudioDefaults,
    onRestoreStudioDefaults,
    onResetStudioDefaults,
    onGenerateScript,
    onGenerateTerms,
    onCreateVideo,
  };
}

function StudioIntroPanel({
  status,
  backendReady,
  optionsError,
  optionsLoaded,
}: Pick<StudioPageProps, "status"> & {
  backendReady: boolean;
  optionsError: string;
  optionsLoaded: boolean;
}) {
  return (
    <div className="studio-copy">
      <p className="eyebrow">Create Studio</p>
      <h3>Generate a complete MoneyPrinterTurbo video from one subject.</h3>
      <p>
        Write the idea, ask FastAPI for a script and search terms, then submit the real render task and watch progress
        until output videos are ready.
      </p>
      <div className="status-chip-row">
        <span className={`status-chip status-${status.state}`}>{status.state}</span>
        <span className="status-chip">{status.baseUrl}</span>
      </div>
      {!backendReady ? (
        <output className="notice-card notice-warning">
          <AlertCircle size={18} aria-hidden="true" />
          <span>Backend is not ready. Start `api.bat`, refresh status, then run generation actions.</span>
        </output>
      ) : null}
      {backendReady ? (
        <output className={`notice-card ${optionsError ? "notice-warning" : "notice-info"}`}>
          <AlertCircle size={18} aria-hidden="true" />
          <span>
            {optionsError
              ? `Options metadata unavailable, using safe fallback fields: ${optionsError}`
              : optionsLoaded
                ? "Options loaded from /api/v1/options."
                : "Loading options metadata from /api/v1/options..."}
          </span>
        </output>
      ) : null}
    </div>
  );
}

function StudioDefaultsPanel({
  onSaveStudioDefaults,
  onRestoreStudioDefaults,
  onResetStudioDefaults,
}: Pick<
  StudioGenerationFormActions,
  "onSaveStudioDefaults" | "onRestoreStudioDefaults" | "onResetStudioDefaults"
>) {
  return (
    <section className="studio-defaults-panel" aria-labelledby="studio-defaults-heading">
      <div>
        <h4 id="studio-defaults-heading">Studio defaults</h4>
        <p>Browser-local only. Saves visible settings, never subject, script, or terms.</p>
      </div>
      <div className="studio-default-actions">
        <button className="secondary-action" type="button" onClick={onSaveStudioDefaults}>
          <Save size={16} aria-hidden="true" />
          Save current as default
        </button>
        <button className="secondary-action" type="button" onClick={onRestoreStudioDefaults}>
          <RotateCcw size={16} aria-hidden="true" />
          Restore defaults
        </button>
        <button className="secondary-action" type="button" onClick={onResetStudioDefaults}>
          <Undo2 size={16} aria-hidden="true" />
          Reset app defaults
        </button>
      </div>
    </section>
  );
}

function StudioGenerationForm({ values, controls, status, actions }: StudioGenerationFormProps) {
  const {
    subject,
    script,
    terms,
    language,
    paragraphNumber,
    termsAmount,
    voiceName,
    selectedVideoAspect,
    selectedVideoSource,
    selectedVoiceName,
    subtitleEnabled,
    studioError,
    studioMessage,
  } = values;
  const { languageOptions, voiceGroups, studioOptions } = controls;
  const {
    optionsError,
    backendReady,
    subjectReady,
    scriptReady,
    termsReady,
    isGeneratingScript,
    isGeneratingTerms,
    isSubmittingVideo,
    isBusy,
  } = status;
  const {
    onSubjectChange,
    onScriptChange,
    onTermsChange,
    onLanguageChange,
    onParagraphNumberChange,
    onTermsAmountChange,
    onVideoAspectChange,
    onVideoSourceChange,
    onVoiceNameChange,
    onSubtitleEnabledChange,
    onSaveStudioDefaults,
    onRestoreStudioDefaults,
    onResetStudioDefaults,
    onGenerateScript,
    onGenerateTerms,
    onCreateVideo,
  } = actions;
  return (
    <div className="prompt-card studio-form">
      <StudioDefaultsPanel
        onSaveStudioDefaults={onSaveStudioDefaults}
        onRestoreStudioDefaults={onRestoreStudioDefaults}
        onResetStudioDefaults={onResetStudioDefaults}
      />

      <label htmlFor="story-subject">Video subject</label>
      <input
        id="story-subject"
        value={subject}
        onChange={(event) => onSubjectChange(event.target.value)}
        placeholder="Example: 5 habits that make small businesses grow"
      />

      <div className="form-grid compact-form-grid">
        <label htmlFor="story-language">
          Language
          {optionsError ? (
            <input
              id="story-language"
              value={language}
              onChange={(event) => onLanguageChange(event.target.value)}
              placeholder="en"
            />
          ) : (
            <select
              id="story-language"
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
        <label htmlFor="story-paragraphs">
          Paragraphs
          <input
            id="story-paragraphs"
            min={1}
            max={8}
            type="number"
            value={paragraphNumber}
            onChange={(event) => onParagraphNumberChange(clampNumber(event.target.value, 1, 8))}
          />
        </label>
        <label htmlFor="terms-amount">
          Terms
          <input
            id="terms-amount"
            min={1}
            max={12}
            type="number"
            value={termsAmount}
            onChange={(event) => onTermsAmountChange(clampNumber(event.target.value, 1, 12))}
          />
        </label>
      </div>

      <div className="prompt-actions split-actions">
        <span className="form-helper">POST /api/v1/scripts</span>
        <button
          className="primary-action"
          type="button"
          onClick={() => void onGenerateScript()}
          disabled={!backendReady || !subjectReady || isGeneratingScript}
        >
          {isGeneratingScript ? <Loader2 className="spin-icon" size={18} /> : <Sparkles size={18} />}
          {isGeneratingScript ? "Generating" : "Generate Script"}
        </button>
      </div>

      <label htmlFor="story-script">Script</label>
      <textarea
        id="story-script"
        value={script}
        onChange={(event) => onScriptChange(event.target.value)}
        placeholder="Generated script appears here. You can edit it before creating terms or video."
        rows={8}
      />

      <div className="prompt-actions split-actions">
        <span className="form-helper">POST /api/v1/terms</span>
        <button
          className="secondary-action"
          type="button"
          onClick={() => void onGenerateTerms()}
          disabled={!backendReady || !subjectReady || !scriptReady || isGeneratingTerms}
        >
          {isGeneratingTerms ? <Loader2 className="spin-icon" size={18} /> : <Wand2 size={18} />}
          {isGeneratingTerms ? "Generating" : "Generate Terms"}
        </button>
      </div>

      <label htmlFor="story-terms">Video terms</label>
      <input
        id="story-terms"
        value={terms}
        onChange={(event) => onTermsChange(event.target.value)}
        placeholder="Generated keywords, separated by commas"
      />

      <div className="form-grid compact-form-grid">
        <label htmlFor="video-aspect">
          Aspect
          <select
            id="video-aspect"
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
        <label htmlFor="video-source">
          Source
          <select
            id="video-source"
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
        <label htmlFor="voice-name">
          Voice
          {optionsError ? (
            <input
              id="voice-name"
              value={voiceName}
              onChange={(event) => onVoiceNameChange(event.target.value)}
            />
          ) : (
            <select
              id="voice-name"
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

      <label className="toggle-row" htmlFor="subtitle-enabled">
        <span>
          Subtitles
          <small>Include generated captions in video payload.</small>
        </span>
        <input
          id="subtitle-enabled"
          type="checkbox"
          checked={subtitleEnabled}
          onChange={(event) => onSubtitleEnabledChange(event.target.checked)}
        />
      </label>

      {studioError ? <p className="form-alert form-alert-error">{studioError}</p> : null}
      {studioMessage ? <p className="form-alert form-alert-info">{studioMessage}</p> : null}

      <div className="prompt-actions">
        <button
          className="primary-action"
          type="button"
          onClick={() => void onCreateVideo()}
          disabled={!backendReady || !subjectReady || !scriptReady || !termsReady || isBusy}
        >
          {isSubmittingVideo ? <Loader2 className="spin-icon" size={18} /> : <PlayCircle size={18} />}
          {isSubmittingVideo ? "Rendering" : "Generate Video"}
        </button>
      </div>
    </div>
  );
}

function StudioTaskPanel({ activeTask, onInspectOutput }: StudioTaskPanelProps) {
  return (
    <section className="panel-card result-card">
      <div className="section-title-row">
        <div>
          <p className="eyebrow">Live task</p>
          <h3>{activeTask.subject}</h3>
        </div>
        <span className={`status-chip task-status-${activeTask.status}`}>
          {taskStatusLabel(activeTask.status)}
        </span>
      </div>
      <TaskProgress task={activeTask} />
      <TaskOutputs task={activeTask} onInspectOutput={onInspectOutput} />
    </section>
  );
}

function StudioStepGrid() {
  return (
    <section className="step-grid">
      {STUDIO_STEP_ITEMS.map(([step, title, copy]) => (
        <article className="panel-card step-card" key={step}>
          <span>{step}</span>
          <h4>{title}</h4>
          <p>{copy}</p>
        </article>
      ))}
    </section>
  );
}

function getInitialStudioWorkflowState(): StudioWorkflowState {
  const storage = getBrowserStorage();
  const initialStudioDefaults: StudioDefaultsLoadResult = storage
    ? loadStoredStudioDefaultSettings(storage)
    : { settings: APP_DEFAULT_STUDIO_SETTINGS, status: "missing" };

  return {
    subject: "",
    script: "",
    terms: "",
    settings: initialStudioDefaults.settings,
    studioMessage: initialStudioDefaults.message ?? "",
    studioError: "",
    isGeneratingScript: false,
    isGeneratingTerms: false,
    isSubmittingVideo: false,
    activeTask: null,
  };
}

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch (error) {
    console.warn("Studio defaults storage unavailable", error);
    return null;
  }
}

function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }

    const timeoutId = window.setTimeout(resolve, milliseconds);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeoutId);
        resolve();
      },
      { once: true },
    );
  });
}
