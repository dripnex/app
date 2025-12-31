import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log to file via main process
    window.readied.log.error('React error boundary caught error', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleViewLogs = async (): Promise<void> => {
    const logPath = await window.readied.log.getLogPath();
    if (logPath) {
      await window.readied.data.openFolder();
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary">
          <div className="error-boundary__content">
            <h1 className="error-boundary__title">Something went wrong</h1>
            <p className="error-boundary__message">
              The application encountered an unexpected error. Your notes are safe.
            </p>
            {this.state.error && (
              <pre className="error-boundary__details">{this.state.error.message}</pre>
            )}
            <div className="error-boundary__actions">
              <button className="error-boundary__btn primary" onClick={this.handleReload}>
                Reload App
              </button>
              <button className="error-boundary__btn secondary" onClick={this.handleViewLogs}>
                View Logs
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
