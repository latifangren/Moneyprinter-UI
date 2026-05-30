import { Copy, ExternalLink, Film, Link2, X } from "lucide-react";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { resolveOutputUrl } from "../api";
import {
  createOutputInspectorDetails,
  type OutputInspectSelection,
} from "../outputInspectorModel";
import { isVideoOutputUrl } from "../outputUrl";
import { taskStatusLabel } from "../taskModel";

type OutputInspectorDialogProps = {
  selection: OutputInspectSelection | null;
  onClose: () => void;
};

type CopyTarget = "output" | "task";

export function OutputInspectorDialog({ selection, onClose }: OutputInspectorDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<{ message: string; selection: OutputInspectSelection | null }>({
    message: "",
    selection: null,
  });
  const outputUrl = selection ? resolveOutputUrl(selection.outputPath) : "";
  const details = useMemo(
    () => (selection ? createOutputInspectorDetails(selection, outputUrl) : null),
    [outputUrl, selection],
  );
  const copyMessage = copyFeedback.selection === selection ? copyFeedback.message : "";
  const closeLatest = useEffectEvent(() => {
    onClose();
  });

  useEffect(() => {
    if (!selection) {
      return;
    }

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousFocus = previousFocusRef.current;
    const focusTimerId = window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeLatest();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimerId);
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
      previousFocusRef.current = null;
    };
  }, [selection]);

  if (!details) {
    return null;
  }

  async function handleCopy(value: string, target: CopyTarget) {
    const label = target === "output" ? "Output link" : "Task ID";

    if (!navigator.clipboard?.writeText) {
      setCopyFeedback({ message: `${label} copy unavailable in this browser.`, selection });
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopyFeedback({ message: `${label} copied.`, selection });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Clipboard write failed.";
      setCopyFeedback({ message: `${label} copy failed: ${message}`, selection });
    }
  }

  return (
    <div className="output-inspector-scrim">
      <button
        className="output-inspector-backdrop"
        type="button"
        aria-label="Close output inspector"
        onMouseDown={(event) => event.currentTarget === event.target && onClose()}
      />
      <aside
        className="output-inspector-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="output-inspector-heading"
        aria-describedby="output-inspector-summary"
      >
        <div className="output-inspector-header">
          <div>
            <p className="eyebrow">Output Inspector</p>
            <h3 id="output-inspector-heading">{details.filename}</h3>
          </div>
          <button className="icon-button" type="button" onClick={onClose} ref={closeButtonRef} aria-label="Close output inspector">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="output-inspector-preview">
          {isVideoOutputUrl(details.outputUrl) ? (
            <video controls src={details.outputUrl} preload="metadata" aria-label={`Preview ${details.filename}`}>
              <track kind="captions" label="Generated captions" srcLang="en" src="data:text/vtt,WEBVTT%0A%0A" />
            </video>
          ) : (
            <div className="output-inspector-file">
              <Film size={36} aria-hidden="true" />
              <span className="sr-only">{`Output file ${details.filename}`}</span>
            </div>
          )}
        </div>

        <div className="output-inspector-body">
          <div className="output-inspector-chip-row" id="output-inspector-summary">
            <span className={`status-chip task-status-${details.status}`}>{taskStatusLabel(details.status)}</span>
            <span className={`status-chip asset-kind-${details.kind}`}>{details.kind}</span>
          </div>

          <dl className="output-inspector-meta">
            <div>
              <dt>Subject</dt>
              <dd>{details.subject}</dd>
            </div>
            <div>
              <dt>Task ID</dt>
              <dd>{details.taskId}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{details.updatedAt}</dd>
            </div>
            <div>
              <dt>Progress</dt>
              <dd>{details.progress}%</dd>
            </div>
            <div>
              <dt>Message</dt>
              <dd>{details.message}</dd>
            </div>
            <div>
              <dt>Output URL</dt>
              <dd>{details.outputUrl}</dd>
            </div>
          </dl>

          <div className="output-inspector-actions">
            <a className="primary-action" href={details.outputUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={17} aria-hidden="true" />
              Open output
            </a>
            <button className="secondary-action" type="button" onClick={() => void handleCopy(details.outputUrl, "output")}>
              <Link2 size={17} aria-hidden="true" />
              Copy output link
            </button>
            <button className="secondary-action" type="button" onClick={() => void handleCopy(details.taskId, "task")}>
              <Copy size={17} aria-hidden="true" />
              Copy task ID
            </button>
          </div>

          {copyMessage ? <output className="form-alert form-alert-info">{copyMessage}</output> : null}
        </div>
      </aside>
    </div>
  );
}
