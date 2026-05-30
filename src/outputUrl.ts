import { LOCAL_BACKEND_DEFAULT_URL } from "./apiSettings.ts";

export function resolveTaskOutputUrl(outputPath: string, baseUrl = ""): string {
  const normalizedPath = outputPath.trim().replaceAll("\\", "/");

  if (!normalizedPath) {
    return "";
  }

  const tasksIndex = normalizedPath.indexOf("/tasks/");
  const storageTasksIndex = normalizedPath.indexOf("/storage/tasks/");
  const taskRelativePath = getTaskOutputPath(normalizedPath, tasksIndex, storageTasksIndex);

  if (!taskRelativePath) {
    return new URL(normalizedPath).toString();
  }

  const pathWithLeadingSlash = taskRelativePath.startsWith("/") ? taskRelativePath : `/${taskRelativePath}`;
  const outputPathWithMount = pathWithLeadingSlash.startsWith("/tasks/") ? pathWithLeadingSlash : `/tasks${pathWithLeadingSlash}`;

  return `${baseUrl}${outputPathWithMount}`;
}

export function isVideoOutputUrl(outputUrl: string): boolean {
  return /\.(mp4|webm|ogg)(\?|#|$)/i.test(outputUrl);
}

export function isTaskMountedOutputPath(outputPath: string, trustedBaseUrl = ""): boolean {
  const normalizedPath = outputPath.trim().replaceAll("\\", "/");

  if (!normalizedPath) {
    return false;
  }

  if (/^https?:\/\//i.test(normalizedPath)) {
    try {
      const outputUrl = new URL(normalizedPath);
      return outputUrl.pathname.includes("/tasks/") && isTrustedOutputOrigin(outputUrl, trustedBaseUrl);
    } catch {
      return false;
    }
  }

  return (
    normalizedPath.includes("/tasks/") ||
    normalizedPath.includes("/storage/tasks/") ||
    normalizedPath.startsWith("tasks/") ||
    normalizedPath.startsWith("/tasks/")
  );
}

function isTrustedOutputOrigin(outputUrl: URL, trustedBaseUrl: string): boolean {
  return getTrustedOutputOrigins(trustedBaseUrl).has(outputUrl.origin) || isLoopbackHostname(outputUrl.hostname);
}

function getTrustedOutputOrigins(trustedBaseUrl: string): Set<string> {
  const origins = new Set<string>();
  addOrigin(origins, LOCAL_BACKEND_DEFAULT_URL);
  addOrigin(origins, trustedBaseUrl);

  if (typeof window !== "undefined") {
    origins.add(window.location.origin);
  }

  return origins;
}

function addOrigin(origins: Set<string>, rawUrl: string) {
  if (!rawUrl.trim()) {
    return;
  }

  try {
    origins.add(new URL(rawUrl).origin);
  } catch {
    return;
  }
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

function getTaskOutputPath(normalizedPath: string, tasksIndex: number, storageTasksIndex: number): string {
  if (storageTasksIndex >= 0) {
    return normalizedPath.slice(storageTasksIndex + "/storage".length);
  }
  if (tasksIndex >= 0) {
    return normalizedPath.slice(tasksIndex);
  }
  if (/^https?:\/\//i.test(normalizedPath)) {
    return "";
  }
  return normalizedPath;
}
