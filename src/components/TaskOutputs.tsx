import { ExternalLink } from "lucide-react";
import { resolveOutputUrl } from "../api";
import type { SubmittedTask } from "../taskModel";
import { getOutputFilename, getTaskOutputSummary } from "../taskModel";

type TaskOutputsProps = {
  task: SubmittedTask;
  compact?: boolean;
};

export function TaskOutputs({ task, compact = false }: TaskOutputsProps) {
  const outputSummary = getTaskOutputSummary(task, compact ? 3 : Number.MAX_SAFE_INTEGER);

  if (outputSummary.totalCount === 0) {
    return compact ? null : <p className="output-empty">No video outputs returned yet.</p>;
  }

  if (compact) {
    return (
      <div className="output-grid output-grid-compact">
        <p className="output-summary">
          {outputSummary.totalCount} output{outputSummary.totalCount === 1 ? "" : "s"}
          {outputSummary.combinedCount > 0 ? `, ${outputSummary.combinedCount} combined` : ""}
        </p>
        {outputSummary.visibleOutputs.map((outputPath) => {
          const outputUrl = resolveOutputUrl(outputPath);
          const label = getOutputFilename(outputPath);

          return (
            <a className="output-link-compact" href={outputUrl} target="_blank" rel="noreferrer" key={outputPath}>
              <ExternalLink size={14} aria-hidden="true" />
              {label}
            </a>
          );
        })}
        {outputSummary.hiddenCount > 0 ? <span className="output-more">+{outputSummary.hiddenCount} more</span> : null}
      </div>
    );
  }

  return (
    <div className="output-grid">
      {outputSummary.outputs.map((outputPath) => {
        const outputUrl = resolveOutputUrl(outputPath);
        const label = getOutputFilename(outputPath);

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

function isVideoOutput(outputUrl: string): boolean {
  return /\.(mp4|webm|ogg)(\?|#|$)/i.test(outputUrl);
}
