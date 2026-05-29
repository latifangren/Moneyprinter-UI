import { UploadCloud } from "lucide-react";
import { ASSET_GROUPS } from "../content";

export function AssetsPage() {
  return (
    <>
      <section className="panel-card section-title-row">
        <div>
          <p className="eyebrow">Assets</p>
          <h3>Reusable creator materials</h3>
        </div>
        <button className="primary-action" type="button">
          <UploadCloud size={18} />
          Add asset
        </button>
      </section>
      <section className="assets-grid">
        {ASSET_GROUPS.map((group) => {
          const Icon = group.icon;

          return (
            <article className="panel-card asset-card" key={group.title}>
              <span className="asset-icon" aria-hidden="true">
                <Icon size={24} />
              </span>
              <p>{group.title}</p>
              <strong>{group.count}</strong>
              <span>Placeholder collection</span>
            </article>
          );
        })}
      </section>
    </>
  );
}
