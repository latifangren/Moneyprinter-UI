export type ApiStatusState = "checking" | "online" | "offline";

export type ApiStatus = {
  state: ApiStatusState;
  baseUrl: string;
  checkedAt: string;
  message: string;
};

type ApiEnvelope<TData> = {
  status: number;
  message?: string | null;
  data: TData;
};

export type GenerateScriptPayload = {
  video_subject: string;
  video_language: string;
  paragraph_number: number;
};

export type GenerateScriptData = {
  video_script: string;
};

export type GenerateTermsPayload = {
  video_subject: string;
  video_script: string;
  amount: number;
};

export type GenerateTermsData = {
  video_terms: string[] | string;
};

export type CreateVideoPayload = {
  video_subject: string;
  video_script: string;
  video_terms: string[] | string;
  video_aspect: "16:9" | "9:16" | "1:1";
  video_concat_mode: "random" | "sequential";
  video_transition_mode: "Shuffle" | "FadeIn" | "FadeOut" | "SlideIn" | "SlideOut" | null;
  video_clip_duration: number;
  video_count: number;
  video_source: string;
  video_language: string;
  voice_name: string;
  voice_volume: number;
  voice_rate: number;
  bgm_type: string;
  bgm_file: string;
  bgm_volume: number;
  subtitle_enabled: boolean;
  subtitle_position: "top" | "bottom" | "center" | "custom";
  custom_position: number;
  font_name: string;
  text_fore_color: string;
  text_background_color: boolean | string;
  font_size: number;
  stroke_color: string;
  stroke_width: number;
  n_threads: number;
  paragraph_number: number;
};

export type CreateVideoData = {
  task_id: string;
  request_id?: string;
  params?: Record<string, unknown>;
};

export type TaskState = -1 | 1 | 4 | number;

export type TaskData = {
  task_id?: string;
  state?: TaskState;
  progress?: number;
  videos?: string[];
  combined_videos?: string[];
  error?: string;
  message?: string;
  params?: Record<string, unknown>;
  request_id?: string;
  [key: string]: unknown;
};

export type TaskListData = {
  tasks: TaskData[];
  total: number;
  page: number;
  page_size: number;
};

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly apiStatus?: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8080";
const API_STATUS_PROBE_PATH = "/api/v1/tasks?page=1&page_size=1";

export function getApiBaseUrl(): string {
  return normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL);
}

export function normalizeApiBaseUrl(rawValue: string): string {
  const trimmedValue = rawValue.trim();

  if (!trimmedValue) {
    return DEFAULT_API_BASE_URL;
  }

  try {
    const url = new URL(trimmedValue);
    return url.toString().replace(/\/$/, "");
  } catch {
    return DEFAULT_API_BASE_URL;
  }
}

export async function checkApiStatus(baseUrl: string): Promise<ApiStatus> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 3500);
  const checkedAt = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  try {
    await requestJson<TaskListData>(baseUrl, API_STATUS_PROBE_PATH, { signal: controller.signal });

    return {
      state: "online",
      baseUrl,
      checkedAt,
      message: "Backend answered the task-list probe. Studio can connect to live generation services.",
    };
  } catch (error) {
    const isAbort = error instanceof DOMException && error.name === "AbortError";
    const apiMessage = error instanceof Error ? error.message : "Backend status check failed.";

    return {
      state: "offline",
      baseUrl,
      checkedAt,
      message: isAbort
        ? "Backend check timed out after 3.5s. Start api.bat, then refresh status."
        : `Backend unavailable: ${apiMessage}`,
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function generateScript(payload: GenerateScriptPayload, signal?: AbortSignal): Promise<GenerateScriptData> {
  return requestJson<GenerateScriptData>(getApiBaseUrl(), "/api/v1/scripts", {
    method: "POST",
    body: JSON.stringify(payload),
    signal,
  });
}

export function generateTerms(payload: GenerateTermsPayload, signal?: AbortSignal): Promise<GenerateTermsData> {
  return requestJson<GenerateTermsData>(getApiBaseUrl(), "/api/v1/terms", {
    method: "POST",
    body: JSON.stringify(payload),
    signal,
  });
}

export function createVideo(payload: CreateVideoPayload, signal?: AbortSignal): Promise<CreateVideoData> {
  return requestJson<CreateVideoData>(getApiBaseUrl(), "/api/v1/videos", {
    method: "POST",
    body: JSON.stringify(payload),
    signal,
  });
}

export function getTask(taskId: string, signal?: AbortSignal): Promise<TaskData> {
  return requestJson<TaskData>(getApiBaseUrl(), `/api/v1/tasks/${encodeURIComponent(taskId)}`, { signal });
}

export function listTasks(page = 1, pageSize = 10, signal?: AbortSignal): Promise<TaskListData> {
  return requestJson<TaskListData>(
    getApiBaseUrl(),
    `/api/v1/tasks?page=${encodeURIComponent(String(page))}&page_size=${encodeURIComponent(String(pageSize))}`,
    { signal },
  );
}

export function resolveOutputUrl(outputPath: string, baseUrl = getApiBaseUrl()): string {
  const normalizedPath = outputPath.trim().replaceAll("\\", "/");

  if (!normalizedPath) {
    return "";
  }

  try {
    return new URL(normalizedPath).toString();
  } catch (error) {
    if (!(error instanceof TypeError)) {
      throw error;
    }
  }

  const tasksIndex = normalizedPath.indexOf("/tasks/");
  const taskRelativePath = tasksIndex >= 0 ? normalizedPath.slice(tasksIndex) : normalizedPath;
  const pathWithLeadingSlash = taskRelativePath.startsWith("/") ? taskRelativePath : `/${taskRelativePath}`;
  const outputPathWithMount = pathWithLeadingSlash.startsWith("/tasks/") ? pathWithLeadingSlash : `/tasks${pathWithLeadingSlash}`;

  return `${baseUrl}${outputPathWithMount}`;
}

async function requestJson<TData>(baseUrl: string, path: string, init: RequestInit = {}): Promise<TData> {
  let response: Response;

  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
  } catch (error) {
    const isAbort = error instanceof DOMException && error.name === "AbortError";
    throw new ApiRequestError(isAbort ? "Request was cancelled or timed out." : "Backend unreachable. Start api.bat and try again.");
  }

  const payload = await parseJsonResponse(response);
  const message = getEnvelopeMessage(payload) ?? `HTTP ${response.status}`;
  const apiStatus = getEnvelopeStatus(payload);

  if (!response.ok) {
    throw new ApiRequestError(message, response.status, apiStatus);
  }

  if (apiStatus !== 200) {
    throw new ApiRequestError(message, response.status, apiStatus);
  }

  if (!isRecord(payload) || !("data" in payload)) {
    throw new ApiRequestError("Backend response did not include a data envelope.", response.status, apiStatus);
  }

  const envelope: ApiEnvelope<TData> = {
    status: apiStatus,
    message: getEnvelopeMessage(payload),
    data: payload.data as TData,
  };

  return envelope.data;
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    throw new ApiRequestError("Backend returned an empty response.", response.status);
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown JSON parse failure.";
    throw new ApiRequestError(`Backend returned invalid JSON: ${detail}`, response.status);
  }
}

function getEnvelopeStatus(payload: unknown): number | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  const status = payload.status;
  return typeof status === "number" ? status : undefined;
}

function getEnvelopeMessage(payload: unknown): string | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  const message = payload.message;
  return typeof message === "string" && message.trim() ? message : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
