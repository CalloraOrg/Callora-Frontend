import { Component, type ErrorInfo, type ReactNode } from "react";
import "./RouteErrorBoundary.css";

export interface RouteErrorBoundaryProps {
  children: ReactNode;
  resetKey?: string;
  maxRetries?: number;
  message?: string;
  exhaustedMessage?: string;
  onError?: (error: Error, info: ErrorInfo) => void;
  onGoHome?: () => void;
  fallback?: (error: Error, retry: () => void, exhausted: boolean) => ReactNode;
}

interface RouteErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

export class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  static defaultProps: Partial<RouteErrorBoundaryProps> = { maxRetries: 3 };

  state: RouteErrorBoundaryState = {
    hasError: false,
    error: null,
    retryCount: 0,
  };

  static getDerivedStateFromError(
    error: Error,
  ): Partial<RouteErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
    if (!this.props.onError) {
      console.error(
        "[RouteErrorBoundary] Unhandled render error:",
        error,
        info.componentStack,
      );
    }
  }

  componentDidUpdate(prevProps: Readonly<RouteErrorBoundaryProps>): void {
    if (this.props.resetKey !== prevProps.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null, retryCount: 0 });
    }
  }

  private handleRetry = (): void => {
    const maxRetries = this.props.maxRetries ?? 3;
    if (this.state.retryCount >= maxRetries) return;
    this.setState({
      hasError: false,
      error: null,
      retryCount: this.state.retryCount + 1,
    });
  };

  render(): ReactNode {
    const { hasError, error, retryCount } = this.state;
    const maxRetries = this.props.maxRetries ?? 3;
    const exhausted = retryCount >= maxRetries;

    if (!hasError) {
      return this.props.children;
    }

    const caught = error ?? new Error("Unknown error");

    if (this.props.fallback) {
      return this.props.fallback(caught, this.handleRetry, exhausted);
    }

    return (
      <section className="route-error-boundary" role="alert" aria-live="polite">
        <div className="route-error-boundary__icon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 className="route-error-boundary__title">
          {exhausted
            ? "This page couldn't be recovered"
            : "Something went wrong"}
        </h2>
        <p className="route-error-boundary__message">
          {exhausted
            ? (this.props.exhaustedMessage ??
              "We couldn't recover this page after repeated attempts. Reload to try again.")
            : (this.props.message ??
              "An unexpected error occurred while loading this page. Try again.")}
        </p>
        <div className="route-error-boundary__actions">
          {!exhausted && (
            <button
              className="primary-button"
              type="button"
              onClick={this.handleRetry}
              aria-label="Try again"
            >
              Try again
            </button>
          )}
          <button
            className="secondary-button"
            type="button"
            onClick={() => window.location.reload()}
            aria-label="Reload page"
          >
            Reload
          </button>
          {this.props.onGoHome && (
            <button
              className="ghost-button"
              type="button"
              onClick={this.props.onGoHome}
            >
              Go home
            </button>
          )}
        </div>
      </section>
    );
  }
}

export default RouteErrorBoundary;
