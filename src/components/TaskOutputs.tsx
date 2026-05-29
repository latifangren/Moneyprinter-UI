import { ExternalLink } from "lucide-react";
import { resolveOutputUrl } from "../api";
import type { SubmittedTask } from "../taskModel";

type TaskOutputsProps = {
  task: SubmittedTask;
  compact?: boolean;
};

export function TaskOutputs({ task, compact = false }: TaskOutputsProps) {
  const outputs = [...task.combinedVideos, ...task.videos];

  if (outputs.length === 0) {
    return compact ? null : <p className="output-empty">No video outputs returned yet.</p>;
  }

  return (
    <div className={`output-grid ${compact ? "output-grid-compact" : ""}`}>
      {outputs.map((outputPath) => {
        const outputUrl = resolveOutputUrl(outputPath);
        const label = getOutputLabel(outputPath);

        return (
          <article className="output-card" key={outputPath}>
            {isVideoOutput(outputUrl) ? (
              <video controls src={outputUrl} preload="metadata" aria-label={label}>
                <track kind="captions" label="Generated captions" srcLang="en" src="data:text/vtt,WEBVTT%0A%0A" />
              </video>
            ) : null}
            <a href={outputUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={16} aria-hidden="true" />
              {label}
            </a>
          </article>
        );
      })}
    </div>
  );
}

function getOutputLabel(outputPath: string): string {
  const normalizedPath = outputPath.replaceAll("\\", "/");
  return normalizedPath.split("/").filter(Boolean).at(-1) ?? "Open output";
}

function isVideoOutput(outputUrl: string): boolean {
  return /\.(mp4|webm|ogg)(\?|#|$)/i.test(outputUrl);
}
