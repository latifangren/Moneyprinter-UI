import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, PlayCircle, RotateCcw, Save, Sparkles, Undo2, Wand2 } from "lucide-react";
import type { ApiStatus, CreateVideoPayload } from "../api";
import { createVideo, generateScript, generateTerms, getTask } from "../api";
import { getErrorMessage } from "../apiErrors";
import { TaskOutputs } from "../components/TaskOutputs";
import { TaskProgress } from "../components/TaskProgress";
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
  VIDEO_ASPECT_OPTIONS,
  VIDEO_SOURCE_OPTIONS,
  type StudioDefaultSettings,
  type StudioDefaultsLoadResult,
  type StudioVideoAspect,
  type StudioVideoSource,
} from "../studioForm";
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

export function StudioPage({ status, onTaskChange }: StudioPageProps) {
  const [initialStudioDefaults] = useState<StudioDefaultsLoadResult>(() => getInitialStudioDefaults());
  const [subject, setSubject] = useState("");
  const [script, setScript] = useState("");
  const [terms, setTerms] = useState("");
  const [language, setLanguage] = useState(initialStudioDefaults.settings.videoLanguage);
  const [paragraphNumber, setParagraphNumber] = useState(initialStudioDefaults.settings.paragraphNumber);
  const [termsAmount, setTermsAmount] = useState(initialStudioDefaults.settings.termsAmount);
  const [aspect, setAspect] = useState<StudioVideoAspect>(initialStudioDefaults.settings.videoAspect);
  const [videoSource, setVideoSource] = useState<StudioVideoSource>(initialStudioDefaults.settings.videoSource);
  const [voiceName, setVoiceName] = useState(initialStudioDefaults.settings.voiceName);
  const [subtitleEnabled, setSubtitleEnabled] = useState(initialStudioDefaults.settings.subtitleEnabled);
  const [studioMessage, setStudioMessage] = useState(initialStudioDefaults.message ?? "");
  const [studioError, setStudioError] = useState("");
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isGeneratingTerms, setIsGeneratingTerms] = useState(false);
  const [isSubmittingVideo, setIsSubmittingVideo] = useState(false);
  const [activeTask, setActiveTask] = useState<SubmittedTask | null>(null);
  const pollControllerRef = useRef<AbortController | null>(null);
  const pollGenerationRef = useRef(0);

  const backendReady = status.state === "online";
  const subjectReady = subject.trim().length > 0;
  const scriptReady = script.trim().length > 0;
  const termsReady = terms.trim().length > 0;
  const isBusy =
    isGeneratingScript ||
    isGeneratingTerms ||
    isSubmittingVideo ||
    activeTask?.status === "processing" ||
    activeTask?.status === "submitted";

  useEffect(() => {
    return () => {
      pollGenerationRef.current += 1;
      pollControllerRef.current?.abort();
    };
  }, []);

  async function handleGenerateScript() {
    if (!backendReady || !subjectReady) {
      setStudioError(
        backendReady
          ? "Enter a video subject before generating a script."
          : "Backend is offline. Start api.bat and refresh status before generating.",
      );
      return;
    }

    setIsGeneratingScript(true);
    setStudioError("");
    setStudioMessage("Generating script from the FastAPI /scripts endpoint...");

    try {
      const response = await generateScript({
        video_subject: subject.trim(),
        video_language: language.trim(),
        paragraph_number: paragraphNumber,
      });
      setScript(response.video_script);
      setStudioMessage("Script generated and loaded into the editor.");
    } catch (error) {
      setStudioError(getErrorMessage(error));
      setStudioMessage("");
    } finally {
      setIsGeneratingScript(false);
    }
  }

  async function handleGenerateTerms() {
    if (!backendReady || !subjectReady || !scriptReady) {
      setStudioError(
        !backendReady
          ? "Backend is offline. Start api.bat and refresh status before generating."
          : "Generate or paste a script before requesting search terms.",
      );
      return;
    }

    setIsGeneratingTerms(true);
    setStudioError("");
    setStudioMessage("Generating search terms from the FastAPI /terms endpoint...");

    try {
      const response = await generateTerms({
        video_subject: subject.trim(),
        video_script: script.trim(),
        amount: termsAmount,
      });
      setTerms(formatTerms(response.video_terms));
      setStudioMessage("Search terms generated for video materials.");
    } catch (error) {
      setStudioError(getErrorMessage(error));
      setStudioMessage("");
    } finally {
      setIsGeneratingTerms(false);
    }
  }

  async function handleCreateVideo() {
    if (!backendReady || !subjectReady || !scriptReady || !termsReady) {
      setStudioError(
        !backendReady
          ? "Backend is offline. Start api.bat and refresh status before submitting."
          : "Subject, script, and terms are required before video generation.",
      );
      return;
    }

    pollGenerationRef.current += 1;
    pollControllerRef.current?.abort();
    const controller = new AbortController();
    pollControllerRef.current = controller;
    const pollGeneration = pollGenerationRef.current;

    setIsSubmittingVideo(true);
    setStudioError("");
    setStudioMessage("Submitting video generation task to /videos...");

    try {
      const response = await createVideo(buildVideoPayload(), controller.signal);
      const task = createSubmittedTask(response.task_id, subject.trim(), "submitted", 0, "Task submitted. Waiting for backend progress...");
      setActiveTask(task);
      onTaskChange(response.task_id, task);
      setStudioMessage(`Task ${response.task_id} submitted. Polling progress now.`);
      await pollTask(response.task_id, subject.trim(), pollGeneration, controller.signal);
    } catch (error) {
      if (!controller.signal.aborted) {
        setStudioError(getErrorMessage(error));
        setStudioMessage("");
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsSubmittingVideo(false);
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
        setActiveTask(nextTask);
        onTaskChange(taskId, nextTask);

        if (nextTask.status === "complete") {
          setStudioMessage("Video task completed. Results are ready below.");
          setIsSubmittingVideo(false);
          return;
        }

        if (nextTask.status === "failed") {
          setStudioError(nextTask.message || "Video task failed in the backend.");
          setStudioMessage("");
          setIsSubmittingVideo(false);
          return;
        }
      } catch (error) {
        if (!signal.aborted) {
          const message = getErrorMessage(error);
          setActiveTask((currentTask) => (currentTask ? { ...currentTask, status: "error", message } : currentTask));
          onTaskChange(taskId, { subject: taskSubject, status: "error", message });
          setStudioError(message);
          setStudioMessage("");
          setIsSubmittingVideo(false);
        }
        return;
      }

      await delay(TASK_POLL_INTERVAL_MS, signal);
    }

    const timeoutMessage = `Polling stopped after ${TASK_POLL_MAX_ATTEMPTS} attempts. Check the Tasks page or backend logs for task ${taskId}.`;
    setActiveTask((currentTask) => (currentTask ? { ...currentTask, status: "timeout", message: timeoutMessage } : currentTask));
    onTaskChange(taskId, { subject: taskSubject, status: "timeout", message: timeoutMessage });
    setStudioError(timeoutMessage);
    setStudioMessage("");
    setIsSubmittingVideo(false);
  }

  function getCurrentDefaultSettings(): StudioDefaultSettings {
    return {
      videoLanguage: language,
      paragraphNumber,
      termsAmount,
      voiceName,
      videoAspect: aspect,
      videoSource,
      subtitleEnabled,
    };
  }

  function applyDefaultSettings(settings: StudioDefaultSettings) {
    setLanguage(settings.videoLanguage);
    setParagraphNumber(settings.paragraphNumber);
    setTermsAmount(settings.termsAmount);
    setAspect(settings.videoAspect);
    setVideoSource(settings.videoSource);
    setVoiceName(settings.voiceName);
    setSubtitleEnabled(settings.subtitleEnabled);
  }

  function handleSaveStudioDefaults() {
    const storage = getBrowserStorage();
    if (!storage) {
      setStudioError("Browser storage is unavailable, so Studio defaults could not be saved.");
      setStudioMessage("");
      return;
    }

    const result = saveStoredStudioDefaultSettings(storage, getCurrentDefaultSettings());
    if (!result.ok) {
      setStudioError(result.message);
      setStudioMessage("");
      return;
    }

    setStudioError("");
    setStudioMessage("Current Studio settings saved as browser-local defaults.");
  }

  function handleRestoreStudioDefaults() {
    const storage = getBrowserStorage();
    if (!storage) {
      setStudioError("Browser storage is unavailable, so saved Studio defaults could not be restored.");
      setStudioMessage("");
      return;
    }

    const result = loadStoredStudioDefaultSettings(storage);
    if (result.status === "failed") {
      setStudioError(result.message ?? "Saved Studio defaults could not be restored from browser storage.");
      setStudioMessage("");
      return;
    }

    applyDefaultSettings(result.settings);
    setStudioError("");
    setStudioMessage(
      result.status === "missing"
        ? "No browser-local Studio defaults found. App defaults were restored."
        : result.message ?? "Saved Studio defaults restored.",
    );
  }

  function handleResetStudioDefaults() {
    const storage = getBrowserStorage();
    if (!storage) {
      setStudioError("Browser storage is unavailable, so saved Studio defaults could not be cleared.");
      setStudioMessage("");
      return;
    }

    const result = clearStoredStudioDefaultSettings(storage);
    if (!result.ok) {
      setStudioError(result.message);
      setStudioMessage("");
      return;
    }

    applyDefaultSettings(APP_DEFAULT_STUDIO_SETTINGS);
    setStudioError("");
    setStudioMessage("Studio settings reset to app defaults and saved browser defaults cleared.");
  }

  function buildVideoPayload(): CreateVideoPayload {
    return {
      video_subject: subject.trim(),
      video_script: script.trim(),
      video_terms: parseTerms(terms),
      video_aspect: aspect,
      video_concat_mode: "random",
      video_transition_mode: null,
      video_clip_duration: 5,
      video_count: 1,
      video_source: videoSource.trim(),
      video_language: language.trim(),
      voice_name: voiceName.trim(),
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

  return (
    <>
      <section className="panel-card studio-layout">
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
            <div className="notice-card notice-warning" role="status">
              <AlertCircle size={18} aria-hidden="true" />
              <span>Backend is not ready. Start `api.bat`, refresh status, then run generation actions.</span>
            </div>
          ) : null}
        </div>
        <div className="prompt-card studio-form">
          <section className="studio-defaults-panel" aria-labelledby="studio-defaults-heading">
            <div>
              <h4 id="studio-defaults-heading">Studio defaults</h4>
              <p>Browser-local only. Saves visible settings, never subject, script, or terms.</p>
            </div>
            <div className="studio-default-actions">
              <button className="secondary-action" type="button" onClick={handleSaveStudioDefaults}>
                <Save size={16} aria-hidden="true" />
                Save current as default
              </button>
              <button className="secondary-action" type="button" onClick={handleRestoreStudioDefaults}>
                <RotateCcw size={16} aria-hidden="true" />
                Restore defaults
              </button>
              <button className="secondary-action" type="button" onClick={handleResetStudioDefaults}>
                <Undo2 size={16} aria-hidden="true" />
                Reset app defaults
              </button>
            </div>
          </section>

          <label htmlFor="story-subject">Video subject</label>
          <input
            id="story-subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Example: 5 habits that make small businesses grow"
          />

          <div className="form-grid compact-form-grid">
            <label htmlFor="story-language">
              Language
              <input id="story-language" value={language} onChange={(event) => setLanguage(event.target.value)} placeholder="en" />
            </label>
            <label htmlFor="story-paragraphs">
              Paragraphs
              <input
                id="story-paragraphs"
                min={1}
                max={8}
                type="number"
                value={paragraphNumber}
                onChange={(event) => setParagraphNumber(clampNumber(event.target.value, 1, 8))}
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
                onChange={(event) => setTermsAmount(clampNumber(event.target.value, 1, 12))}
              />
            </label>
          </div>

          <div className="prompt-actions split-actions">
            <span className="form-helper">POST /api/v1/scripts</span>
            <button
              className="primary-action"
              type="button"
              onClick={() => void handleGenerateScript()}
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
            onChange={(event) => setScript(event.target.value)}
            placeholder="Generated script appears here. You can edit it before creating terms or video."
            rows={8}
          />

          <div className="prompt-actions split-actions">
            <span className="form-helper">POST /api/v1/terms</span>
            <button
              className="secondary-action"
              type="button"
              onClick={() => void handleGenerateTerms()}
              disabled={!backendReady || !subjectReady || !scriptReady || isGeneratingTerms}
            >
              {isGeneratingTerms ? <Loader2 className="spin-icon" size={18} /> : <Wand2 size={18} />}
              {isGeneratingTerms ? "Generating" : "Generate Terms"}
            </button>
          </div>

          <label htmlFor="story-terms">Video terms</label>
          <input id="story-terms" value={terms} onChange={(event) => setTerms(event.target.value)} placeholder="Generated keywords, separated by commas" />

          <div className="form-grid compact-form-grid">
            <label htmlFor="video-aspect">
              Aspect
              <select id="video-aspect" value={aspect} onChange={(event) => setAspect(event.target.value as StudioVideoAspect)}>
                {VIDEO_ASPECT_OPTIONS.map((option) => (
                  <option value={option} key={option}>{formatVideoAspectLabel(option)}</option>
                ))}
              </select>
            </label>
            <label htmlFor="video-source">
              Source
              <select id="video-source" value={videoSource} onChange={(event) => setVideoSource(event.target.value as StudioVideoSource)}>
                {VIDEO_SOURCE_OPTIONS.map((option) => (
                  <option value={option} key={option}>{formatVideoSourceLabel(option)}</option>
                ))}
              </select>
            </label>
            <label htmlFor="voice-name">
              Voice
              <input id="voice-name" value={voiceName} onChange={(event) => setVoiceName(event.target.value)} />
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
              onChange={(event) => setSubtitleEnabled(event.target.checked)}
            />
          </label>

          {studioError ? <p className="form-alert form-alert-error">{studioError}</p> : null}
          {studioMessage ? <p className="form-alert form-alert-info">{studioMessage}</p> : null}

          <div className="prompt-actions">
            <button
              className="primary-action"
              type="button"
              onClick={() => void handleCreateVideo()}
              disabled={!backendReady || !subjectReady || !scriptReady || !termsReady || isBusy}
            >
              {isSubmittingVideo ? <Loader2 className="spin-icon" size={18} /> : <PlayCircle size={18} />}
              {isSubmittingVideo ? "Rendering" : "Generate Video"}
            </button>
          </div>
        </div>
      </section>

      {activeTask ? (
        <section className="panel-card result-card">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Live task</p>
              <h3>{activeTask.subject}</h3>
            </div>
            <span className={`status-chip task-status-${activeTask.status}`}>{taskStatusLabel(activeTask.status)}</span>
          </div>
          <TaskProgress task={activeTask} />
          <TaskOutputs task={activeTask} />
        </section>
      ) : (
        <section className="step-grid">
          {[
            ["1", "Script", "POST /api/v1/scripts fills the editable script field."],
            ["2", "Terms", "POST /api/v1/terms returns material search keywords."],
            ["3", "Render", "POST /api/v1/videos creates a backend task."],
            ["4", "Results", "GET /api/v1/tasks/{task_id} powers progress and output previews."],
          ].map(([step, title, copy]) => (
            <article className="panel-card step-card" key={step}>
              <span>{step}</span>
              <h4>{title}</h4>
              <p>{copy}</p>
            </article>
          ))}
        </section>
      )}
    </>
  );
}

function getInitialStudioDefaults(): StudioDefaultsLoadResult {
  const storage = getBrowserStorage();
  return storage ? loadStoredStudioDefaultSettings(storage) : { settings: APP_DEFAULT_STUDIO_SETTINGS, status: "missing" };
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
