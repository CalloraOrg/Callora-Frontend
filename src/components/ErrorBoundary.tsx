import { Component, type ErrorInfo, type ReactNode } from "react";
import "./ErrorBoundary.css";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional custom fallback UI renderer. Receives the caught error and a retry callback. */
  fallback?: (error: Error, retry: () => void) => ReactNode;
  /** Optional error message shown in the default fallback. */
  message?: string;
  /** Called with the caught error for logging / telemetry. */
  onError?: (error: Error, info: ErrorInfo) => void;
  /**
   * When this key changes, the boundary resets (even without a retry click).
   * Useful for resetting the boundary when the parent re-renders with new data.
   */
  resetKey?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary — a reusable error boundary with a polished fallback UI and
 * retry action.
 *
 * Features:
 * - Catches render errors in its subtree via `getDerivedStateFromError`.
 * - Logs error details via `componentDidCatch` for telemetry.
 * - Renders an accessible, theme-aware fallback with a retry button.
 * - Accepts an optional custom `fallback` render prop for specialized UIs.
 * - Supports external reset via `resetKey` prop.
 *
 * @example
 * ```tsx
 * <ErrorBoundary message="Failed to load API key.">
 *   <CopyKeyButton value="sk-..." />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  componentDidUpdate(prevProps: Readonly<ErrorBoundaryProps>): void {
    if (this.props.resetKey !== prevProps.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const error = this.state.error ?? new Error("Unknown error");

      if (this.props.fallback) {
        return this.props.fallback(error, this.handleRetry);
      }

      return (
        <div
          className="error-boundary-fallback"
          role="alert"
          aria-live="polite"
        >
          <div className="error-boundary-fallback__icon" aria-hidden="true">
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
          <p className="error-boundary-fallback__message">
            {this.props.message ?? "Something went wrong. Please try again."}
          </p>
          <div className="error-boundary-fallback__action">
            <button
              className="ghost-button"
              type="button"
              onClick={this.handleRetry}
              aria-label="Retry"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
