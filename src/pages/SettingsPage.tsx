import type { ApiStatus } from "../api";
import { ApiStatusCard } from "../components/ApiStatusCard";

type SettingsPageProps = {
  status: ApiStatus;
  onRefresh: () => Promise<void>;
};

export function SettingsPage({ status, onRefresh }: SettingsPageProps) {
  return (
    <div className="two-column-grid">
      <ApiStatusCard status={status} onRefresh={onRefresh} />
      <section className="panel-card settings-card">
        <p className="eyebrow">Typed API handling</p>
        <h3>Environment</h3>
        <dl>
          <div>
            <dt>Variable</dt>
            <dd>VITE_API_BASE_URL</dd>
          </div>
          <div>
            <dt>Default</dt>
            <dd>http://127.0.0.1:8080</dd>
          </div>
          <div>
            <dt>Probe path</dt>
            <dd>/api/v1/tasks?page=1&page_size=1</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
