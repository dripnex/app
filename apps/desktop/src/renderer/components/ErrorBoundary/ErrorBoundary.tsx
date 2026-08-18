import { Component, type ReactNode, type ErrorInfo } from 'react';
import { captureException } from '../../sentry';
import styles from './ErrorBoundary.module.css';

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
    window.dripnex?.log?.error('React error boundary caught error', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    // Report to Sentry
    captureException(error, {
      componentStack: errorInfo.componentStack,
    });
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleViewLogs = async (): Promise<void> => {
    const logPath = await window.dripnex?.log?.getLogPath();
    if (logPath) {
      await window.dripnex?.data?.openFolder();
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className={styles.container}>
          <div className={styles.content}>
            <h1 className={styles.title}>Something went wrong</h1>
            <p className={styles.message}>
              The application encountered an unexpected error. Your notes are safe.
            </p>
            {this.state.error && <pre className={styles.details}>{this.state.error.message}</pre>}
            <div className={styles.actions}>
              <button className={styles.btnPrimary} onClick={this.handleReload}>
                Reload App
              </button>
              <button className={styles.btnSecondary} onClick={this.handleViewLogs}>
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
