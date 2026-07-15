import type { DataMode } from '../types/scenario'

export function StatusBanner({
  dataMode,
  cases,
}: {
  dataMode: DataMode
  cases: number
}) {
  return (
    <div className="status-banner" role="status">
      <span className="pulse" aria-hidden="true" />
      {dataMode === 'pinned-noaa'
        ? 'NOAA snapshot loaded'
        : 'Proxy fixture loaded'}
      <span aria-hidden="true">|</span>
      {cases} cases<span aria-hidden="true">|</span>v2 research release
    </div>
  )
}
