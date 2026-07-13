import type { DataMode } from '../types/scenario'

export function StatusBanner({
  dataMode,
  pairedCases,
}: {
  dataMode: DataMode
  pairedCases: number
}) {
  return (
    <div className="status-banner" role="status">
      <span className="pulse" aria-hidden="true" />
      {dataMode === 'pinned-noaa'
        ? 'NOAA snapshot loaded'
        : 'Proxy fixture loaded'}
      <span aria-hidden="true">|</span>
      {pairedCases} paired cases<span aria-hidden="true">|</span>v1 research
      release
    </div>
  )
}
