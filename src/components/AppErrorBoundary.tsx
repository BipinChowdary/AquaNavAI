import { Component, type ErrorInfo, type ReactNode } from 'react'

export class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('AquaNavAI render failure', error, info.componentStack)
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="load-state load-state--error">
        <span>Application error</span>
        <h1>The interface encountered a recoverable rendering failure.</h1>
        <p>{this.state.error.message}</p>
        <button type="button" onClick={() => location.reload()}>
          Reload application
        </button>
      </main>
    )
  }
}
