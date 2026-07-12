export function StatusBanner() {
  return (
    <div className="status-banner" role="status">
      <span className="pulse" aria-hidden="true" />
      Offline fixture loaded
      <span aria-hidden="true">·</span>
      30 paired cases
      <span aria-hidden="true">·</span>
      v0.1 research scaffold
    </div>
  )
}
