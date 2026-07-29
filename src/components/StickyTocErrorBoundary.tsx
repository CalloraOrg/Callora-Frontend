import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class StickyTocErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="api-detail-toc"
          role="alert"
          aria-live="polite"
        >
          <p className="api-detail-toc__heading">Table of Contents</p>
          <div className="api-detail-toc__error">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--danger)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="api-detail-toc__error-text">
              Unable to load the table of contents.
            </p>
            <button
              className="ghost-button"
              type="button"
              onClick={this.handleRetry}
              aria-label="Retry loading table of contents"
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