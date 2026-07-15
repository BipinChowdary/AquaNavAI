export type InitializationStage =
  | 'idle'
  | 'loading_release_index'
  | 'loading_manifest'
  | 'downloading_artifacts'
  | 'verifying_checksums'
  | 'validating_contract'
  | 'starting_worker'
  | 'constructing_model'
  | 'ready'
  | 'failed'

export interface ResourceDiagnostic {
  name: string
  url: string
  status: number | null
  contentLength: number | null
  expectedChecksum: string | null
  actualChecksum: string | null
  durationMs: number | null
  outcome: 'pending' | 'downloaded' | 'verified' | 'failed'
  error?: string
}

export interface MapDiagnostic {
  mode: 'pending' | 'webgl' | 'simplified'
  reason: string | null
}

export const INITIALIZATION_SOFT_WARNING_MS = 8_000
export const INITIALIZATION_STALL_DEADLINE_MS = 30_000

export const initializationLabels: Record<InitializationStage, string> = {
  idle: 'Preparing scenario',
  loading_release_index: 'Loading release index',
  loading_manifest: 'Loading scenario manifest',
  downloading_artifacts: 'Downloading scenario artifacts',
  verifying_checksums: 'Verifying artifact checksums',
  validating_contract: 'Validating scenario contract',
  starting_worker: 'Starting routing worker',
  constructing_model: 'Constructing browser routing model',
  ready: 'Navigation V2 ready',
  failed: 'Initialization could not complete',
}
