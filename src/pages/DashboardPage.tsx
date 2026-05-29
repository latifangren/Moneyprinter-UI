import { CheckCircle2, PlayCircle, UploadCloud } from "lucide-react";
import type { ApiStatus } from "../api";
import { ApiStatusCard } from "../components/ApiStatusCard";
import { DASHBOARD_METRICS } from "../content";

type DashboardPageProps = {
  status: ApiStatus;
  onRefresh: () => Promise<void>;
};

export function DashboardPage({ status, onRefresh }: DashboardPageProps) {
  return (
    <>
      <section className="hero-card panel-card">
        <div>
          <p className="eyebrow">Dark cinematic command studio</p>
          <h3>Plan, queue, and track AI video stories from one creator cockpit.</h3>
          <p className="hero-copy">
            Phase 2 connects Create Studio to live MoneyPrinterTurbo endpoints for script, terms, render submission,
            progress polling, and output previews.
          </p>
          <div className="hero-actions">
            <button className="primary-action" type="button">
              <PlayCircle size={18} />
              Start a concept
            </button>
            <button className="secondary-action" type="button">
              <UploadCloud size={18} />
              Import assets
            </button>
          </div>
        </div>
        <div className="hero-preview">
          <span className="sr-only">Creator workflow preview: Script, Terms, Render</span>
          <span className="preview-pill">Script</span>
          <span className="preview-line" />
          <span className="preview-pill accent">Terms</span>
          <span className="preview-line" />
          <span className="preview-pill warm">Render</span>
        </div>
      </section>

      <div className="metrics-grid">
        {DASHBOARD_METRICS.map((metric) => {
          const Icon = metric.icon;

          return (
            <article className="metric-card panel-card" key={metric.label}>
              <span className="metric-icon" aria-hidden="true">
                <Icon size={21} />
              </span>
              <p>{metric.label}</p>
              <strong>{metric.value}</strong>
              <span>{metric.trend}</span>
            </article>
          );
        })}
      </div>

      <div className="two-column-grid">
        <ApiStatusCard status={status} onRefresh={onRefresh} />
        <TaskQueueCard />
      </div>
    </>
  );
}

function TaskQueueCard() {
  return (
    <section className="panel-card queue-card">
      <div className="section-title-row">
        <div>
          <p className="eyebrow">Workflow</p>
          <h3>Next actions</h3>
        </div>
        <CheckCircle2 size={24} aria-hidden="true" />
      </div>
      <ol>
        <li>Start backend with `api.bat` before live generation.</li>
        <li>Use Create Studio to call `/api/v1/scripts`, `/terms`, and `/videos`.</li>
        <li>Review completed outputs from task polling and the Tasks page.</li>
      </ol>
    </section>
  );
}
