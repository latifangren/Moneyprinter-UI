import { ExternalLink, ScanSearch } from "lucide-react";
import { getApiBaseUrl, resolveOutputUrl } from "../api";
import type { OutputInspectSelection } from "../outputInspectorModel";
import { getTaskOutputItems } from "../outputInspectorModel";
import { isTaskMountedOutputPath, isVideoOutputUrl } from "../outputUrl";
import type { SubmittedTask } from "../taskModel";
import { getTaskOutputSummary } from "../taskModel";

type TaskOutputsProps = {
  task: SubmittedTask;
  compact?: boolean;
  onInspectOutput?: (selection: OutputInspectSelection) => void;
};

export function TaskOutputs({ task, compact = false, onInspectOutput }: TaskOutputsProps) {
  const outputSummary = getTaskOutputSummary(task, compact ? 3 : Number.MAX_SAFE_INTEGER);
  const outputItems = getTaskOutputItems(task, compact ? 3 : Number.MAX_SAFE_INTEGER);
  const trustedBaseUrl = getApiBaseUrl();

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
        {outputItems.map((item) => {
          const outputUrl = resolveOutputUrl(item.outputPath);
          const isMountedOutput = isTaskMountedOutputPath(item.outputPath, trustedBaseUrl);

          return (
            <div className="output-action-pair" key={item.id}>
              <a className="output-link-compact" href={outputUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={14} aria-hidden="true" />
                {item.filename}
              </a>
              {onInspectOutput && isMountedOutput ? (
                <button
                  className="output-inspect-button output-inspect-button-compact"
                  type="button"
                  onClick={() => onInspectOutput({ task, outputPath: item.outputPath, kind: item.kind })}
                  aria-label={`Inspect ${item.filename}`}
                >
                  <ScanSearch size={14} aria-hidden="true" />
                  Inspect
                </button>
              ) : null}
            </div>
          );
        })}
        {outputSummary.hiddenCount > 0 ? <span className="output-more">+{outputSummary.hiddenCount} more</span> : null}
      </div>
    );
  }

  return (
    <div className="output-grid">
      {outputItems.map((item) => {
        const outputUrl = resolveOutputUrl(item.outputPath);
        const isMountedOutput = isTaskMountedOutputPath(item.outputPath, trustedBaseUrl);

        return (
          <article className="output-card" key={item.id}>
            {isMountedOutput && isVideoOutputUrl(outputUrl) ? (
              <video controls src={outputUrl} preload="metadata" aria-label={item.filename}>
                <track kind="captions" label="Generated captions" srcLang="en" src="data:text/vtt,WEBVTT%0A%0A" />
              </video>
            ) : null}
            <div className="output-card-actions">
              <a href={outputUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={16} aria-hidden="true" />
                {item.filename}
              </a>
              {onInspectOutput && isMountedOutput ? (
                <button
                  className="output-inspect-button"
                  type="button"
                  onClick={() => onInspectOutput({ task, outputPath: item.outputPath, kind: item.kind })}
                  aria-label={`Inspect ${item.filename}`}
                >
                  <ScanSearch size={16} aria-hidden="true" />
                  Inspect
                </button>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
