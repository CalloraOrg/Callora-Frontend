import { useMemo, useState } from "react";

export type EndpointGroupPreviewItem = {
  id: string;
  title: string;
  url: string;
  method: string;
  paramsCount: number;
  requiredCount: number;
};

export type EndpointGroupPreview = {
  id: string;
  label: string;
  summary: string;
  methods: string[];
  endpointCount: number;
  totalParams: number;
  endpoints: EndpointGroupPreviewItem[];
};

type EndpointGroupHoverProps = {
  groups: EndpointGroupPreview[];
};

export default function EndpointGroupHover({
  groups,
}: EndpointGroupHoverProps): JSX.Element | null {
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  const activeGroup = useMemo(
    () => groups.find((group) => group.id === activeGroupId) ?? null,
    [activeGroupId, groups],
  );

  if (groups.length === 0) {
    return null;
  }

  const clearPreview = () => {
    setActiveGroupId(null);
  };

  const handleBlurCapture = (event: React.FocusEvent<HTMLElement>) => {
    const nextFocusedElement = event.relatedTarget;

    if (
      nextFocusedElement instanceof Node &&
      event.currentTarget.contains(nextFocusedElement)
    ) {
      return;
    }

    clearPreview();
  };

  return (
    <section
      className="endpoint-group-hover"
      aria-labelledby="endpoint-group-hover-title"
    >
      <div className="endpoint-group-hover__header">
        <div>
          <h4 id="endpoint-group-hover-title">Endpoint groups</h4>
          <p>
            Hover with a pointer or focus with the keyboard to preview grouped
            endpoints before reading full docs.
          </p>
        </div>
      </div>

      <div
        className="endpoint-group-hover__shell"
        onMouseLeave={clearPreview}
        onBlurCapture={handleBlurCapture}
      >
        <div
          className="endpoint-group-hover__triggers no-print"
          role="list"
          aria-label="Endpoint groups"
        >
          {groups.map((group) => {
            const isActive = activeGroup?.id === group.id;

            return (
              <div key={group.id} role="listitem">
                <button
                  type="button"
                  className={`endpoint-group-hover__trigger${
                    isActive ? " endpoint-group-hover__trigger--active" : ""
                  }`}
                  aria-describedby={
                    isActive ? `endpoint-group-preview-${group.id}` : undefined
                  }
                  onMouseEnter={() => setActiveGroupId(group.id)}
                  onFocus={() => setActiveGroupId(group.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      clearPreview();
                      (event.currentTarget as HTMLButtonElement).blur();
                    }
                  }}
                >
                  <span className="endpoint-group-hover__trigger-label">
                    {group.label}
                  </span>
                  <span className="endpoint-group-hover__trigger-meta">
                    {group.endpointCount} endpoint
                    {group.endpointCount === 1 ? "" : "s"}
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        <div className="endpoint-group-hover__preview-region">
          {activeGroup ? (
            <article
              id={`endpoint-group-preview-${activeGroup.id}`}
              className="endpoint-group-hover__preview preview-card"
              aria-label={`${activeGroup.label} group preview`}
            >
              <div className="endpoint-group-hover__preview-topline">
                <span className="endpoint-group-hover__eyebrow">Preview</span>
                <span className="endpoint-group-hover__count">
                  {activeGroup.endpointCount} endpoint
                  {activeGroup.endpointCount === 1 ? "" : "s"}
                </span>
              </div>

              <h5>{activeGroup.label}</h5>
              <p>{activeGroup.summary}</p>

              <div
                className="endpoint-group-hover__methods"
                aria-label="Supported methods"
              >
                {activeGroup.methods.map((method) => (
                  <span
                    key={method}
                    className={`method-badge method-badge--${method.toLowerCase()}`}
                  >
                    {method}
                  </span>
                ))}
              </div>

              <ul className="endpoint-group-hover__endpoint-list">
                {activeGroup.endpoints.slice(0, 3).map((endpoint) => (
                  <li key={endpoint.id}>
                    <div className="endpoint-group-hover__endpoint-row">
                      <span>{endpoint.title}</span>
                      <code>{endpoint.url}</code>
                    </div>
                    <div className="endpoint-group-hover__endpoint-meta">
                      <span>
                        {endpoint.paramsCount} parameter
                        {endpoint.paramsCount === 1 ? "" : "s"}
                      </span>
                      <span>{endpoint.requiredCount} required</span>
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          ) : (
            <div
              className="endpoint-group-hover__empty preview-card"
              aria-live="polite"
            >
              Select a group to preview endpoints, supported methods, and
              request shape.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
