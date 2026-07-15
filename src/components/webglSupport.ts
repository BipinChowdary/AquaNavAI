export function supportsWebGl() {
  try {
    const canvas = document.createElement('canvas')
    const context =
      canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) ??
      canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false })
    if (!context) return false
    const extension = context.getExtension('WEBGL_lose_context')
    extension?.loseContext()
    return true
  } catch {
    return false
  }
}
