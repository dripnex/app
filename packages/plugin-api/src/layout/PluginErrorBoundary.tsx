import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  pluginId: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary for plugin-rendered UI.
 * Catches render errors from plugin components and shows a fallback
 * instead of crashing the host application.
 */
export class PluginErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[plugin:${this.props.pluginId}] Render error:`, error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '0.5rem',
            fontSize: '0.75rem',
            color: '#ef4444',
            background: 'rgba(239, 68, 68, 0.08)',
            borderRadius: '4px',
            border: '1px solid rgba(239, 68, 68, 0.2)',
          }}
          title={this.state.error?.message}
        >
          Plugin error: {this.props.pluginId}
        </div>
      );
    }

    return this.props.children;
  }
}
