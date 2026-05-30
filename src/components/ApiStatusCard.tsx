import { RefreshCcw } from "lucide-react";
import type { ApiStatus } from "../api";

type ApiStatusCardProps = {
  status: ApiStatus;
  onRefresh: () => Promise<void>;
  compact?: boolean;
};

export function ApiStatusCard({ status, onRefresh, compact = false }: ApiStatusCardProps) {
  return (
    <section className={`panel-card api-card ${compact ? "api-card-compact" : ""}`}>
      <div className="section-title-row">
        <div>
          <p className="eyebrow">Backend status</p>
          <h3>FastAPI connection</h3>
        </div>
        <output className={`status-light status-${status.state}`}>
          <span className="sr-only">{`Backend is ${status.state}`}</span>
        </output>
      </div>
      <p className="api-message">{status.message}</p>
      <div className="api-meta">
        <span>{status.baseUrl}</span>
        <span>Checked {status.checkedAt}</span>
      </div>
      <button className="secondary-action" type="button" onClick={() => void onRefresh()} disabled={status.state === "checking"}>
        <RefreshCcw size={17} />
        {status.state === "checking" ? "Checking" : "Refresh status"}
      </button>
    </section>
  );
}
