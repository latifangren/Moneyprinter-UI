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

function getTaskOutputPath(normalizedPath: string, tasksIndex: number, storageTasksIndex: number): string {
  if (storageTasksIndex >= 0) {
    return normalizedPath.slice(storageTasksIndex + "/storage".length);
  }
  if (tasksIndex >= 0) {
    return normalizedPath.slice(tasksIndex);
  }
  if (normalizedPath.startsWith("http://") || normalizedPath.startsWith("https://")) {
    return "";
  }
  return normalizedPath;
}
