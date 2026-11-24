import { useId } from 'react';
import type { RefObject } from 'react';
import OpenAPIImport from '../../components/OpenAPIImport';
import type { ParsedEndpoint } from '../../components/OpenAPIImport';
import { ENDPOINTS_ERROR_ID, methodBadgeClass } from './model';
import type { EndpointEntry } from './model';

export interface OpenApiImportSectionProps {
  importOpen: boolean;
  onToggle: () => void;
  onImport: (endpoints: ParsedEndpoint[]) => void;
  onCancel: () => void;
}

export function OpenApiImportSection({
  importOpen,
  onToggle,
  onImport,
  onCancel,
}: OpenApiImportSectionProps) {
  const importSectionId = useId();

  return (
    <section className="pa-import-section surface" aria-labelledby={importSectionId}>
      <div className="pa-import-header">
        <div>
          <h2 id={importSectionId} className="pa-section-title">
            Import from OpenAPI spec
          </h2>
          <p className="pa-section-hint">
            Upload a <code>.json</code>, <code>.yaml</code>, or{' '}
            <code>.yml</code> file to pre-fill the endpoint list.
          </p>
        </div>
        <button
          type="button"
          className={importOpen ? 'pa-btn-secondary' : 'pa-btn-accent'}
          aria-expanded={importOpen}
          aria-controls={`${importSectionId}-body`}
          onClick={onToggle}
        >
          {importOpen ? 'Close importer' : 'Import spec'}
        </button>
      </div>

      {importOpen && (
        <div id={`${importSectionId}-body`} className="pa-import-body">
          <OpenAPIImport onImport={onImport} onCancel={onCancel} />
        </div>
      )}
    </section>
  );
}

export interface EndpointEditorProps {
  endpoints: EndpointEntry[];
  submitAttempted: boolean;
  duplicateEndpointIds: Set<string>;
  endpointsError: string | undefined;
  endpointsRef: RefObject<HTMLFieldSetElement>;
  onRemoveEndpoint: (id: string) => void;
}

export function EndpointEditor({
  endpoints,
  submitAttempted,
  duplicateEndpointIds,
  endpointsError,
  endpointsRef,
  onRemoveEndpoint,
}: EndpointEditorProps) {
  return (
    <fieldset
      ref={endpointsRef}
      className="pa-fieldset pa-endpoints-fieldset"
      aria-describedby={ENDPOINTS_ERROR_ID}
      tabIndex={-1}
    >
      <legend className="pa-legend">
        Endpoints
        {endpoints.length > 0 && (
          <span className="pa-legend-count" aria-label={`${endpoints.length} endpoints`}>
            {endpoints.length}
          </span>
        )}
      </legend>

      {endpoints.length === 0 ? (
        <p className="pa-endpoints-empty">
          No endpoints added yet. Use &ldquo;Import spec&rdquo; above to populate
          this list automatically.
        </p>
      ) : (
        <ul
          className="pa-endpoint-list"
          aria-label={`${endpoints.length} imported endpoints`}
        >
          {endpoints.map((ep) => {
            const isDuplicate = submitAttempted && duplicateEndpointIds.has(ep.id);
            return (
              <li
                key={ep.id}
                className={
                  isDuplicate ? 'pa-endpoint-item pa-endpoint-item-duplicate' : 'pa-endpoint-item'
                }
              >
                <span
                  className={methodBadgeClass(ep.method)}
                  aria-label={`HTTP ${ep.method}`}
                >
                  {ep.method}
                </span>
                <code className="pa-endpoint-path">{ep.path}</code>
                {ep.summary && (
                  <span className="pa-endpoint-summary">{ep.summary}</span>
                )}
                {isDuplicate && (
                  <span className="pa-endpoint-duplicate">Duplicate</span>
                )}
                <button
                  type="button"
                  className="pa-remove-btn"
                  onClick={() => onRemoveEndpoint(ep.id)}
                  aria-label={`Remove endpoint ${ep.method} ${ep.path}`}
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Always in the DOM so aria-describedby never points at nothing,
          matching how FormField renders its error region. */}
      <p
        id={ENDPOINTS_ERROR_ID}
        className="pa-endpoints-error"
        role="alert"
        aria-atomic="true"
      >
        {endpointsError}
      </p>
    </fieldset>
  );
}
