import type { ProvenanceArtifact } from '../types/scenario'

export function ProvenancePanel({ provenance }: { provenance: ProvenanceArtifact }) {
  return (
    <details className="provenance">
      <summary>
        <span>
          <span className="eyebrow">Audit trail</span>
          Data provenance and limitations
        </span>
        <span aria-hidden="true">+</span>
      </summary>
      <div className="provenance__content">
        <p className="proxy-warning">{provenance.warning}</p>
        <div className="source-grid">
          {provenance.sources.map((source) => (
            <article key={source.id}>
              <span className="source-status">{source.status}</span>
              <h3>{source.product}</h3>
              <p>{source.role}</p>
              <a href={source.url} rel="noreferrer" target="_blank">
                {source.provider} source ↗
              </a>
            </article>
          ))}
        </div>
      </div>
    </details>
  )
}
