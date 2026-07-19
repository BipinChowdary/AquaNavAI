import type { ProvenanceArtifact } from '../types/scenario'

export function ProvenancePanel({
  provenance,
}: {
  provenance: ProvenanceArtifact
}) {
  return (
    <section
      className="provenance"
      id="provenance"
      aria-labelledby="provenance-title"
    >
      <header className="provenance__heading">
        <div>
          <span className="eyebrow">Audit trail</span>
          <h2 id="provenance-title">Data provenance and limitations</h2>
        </div>
      </header>
      <div className="provenance__content">
        <p className="proxy-warning">{provenance.warning}</p>
        <div className="source-grid">
          {provenance.sources.map((source) => (
            <article key={source.id}>
              <span className="source-status">{source.status}</span>
              <h3>{source.product}</h3>
              <p>{source.role}</p>
              <a
                href={source.url ?? source.authoritativeEndpoint}
                rel="noreferrer"
                target="_blank"
              >
                {source.provider} official source
              </a>
              {source.retrievalTimestamp && (
                <p>Retrieved {source.retrievalTimestamp}</p>
              )}
              {source.sourceFileChecksum && (
                <code>{source.sourceFileChecksum.slice(0, 16)}...</code>
              )}
            </article>
          ))}
        </div>
        {provenance.limitations && (
          <ul className="limitations">
            {provenance.limitations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
