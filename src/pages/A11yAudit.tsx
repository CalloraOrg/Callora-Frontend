import { useState, useMemo } from 'react';
import manifest from '../data/a11y-manifest.json';
import useDocumentTitle from '../hooks/useDocumentTitle';

type Status = 'all' | 'audited' | 'needs-work' | 'n/a';

export default function A11yAudit() {
  useDocumentTitle('Accessibility Audit');
  const [filter, setFilter] = useState<Status>('all');
  
  const filteredComponents = useMemo(() => {
    return manifest.components.filter(c => filter === 'all' || c.status === filter);
  }, [filter]);

  const stats = useMemo(() => {
    const total = manifest.components.length;
    const audited = manifest.components.filter(c => c.status === 'audited').length;
    const needsWork = manifest.components.filter(c => c.status === 'needs-work').length;
    const na = manifest.components.filter(c => c.status === 'n/a').length;
    const percent = total > 0 ? Math.round((audited / total) * 100) : 0;
    return { total, audited, needsWork, na, percent };
  }, []);

  return (
    <div className="page-container a11y-audit-page">
      <div className="page-header">
        <h1>Accessibility Audit Board</h1>
        <p className="page-subtitle">
          Track the WCAG 2.1 AA compliance status of all design system components.{' '}
          <a href="docs/a11y-manifest.md" className="component-link">
            Manifest upkeep guide
          </a>
        </p>
      </div>

      <div className="surface summary-section" style={{ marginBottom: '24px', padding: '16px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        <div className="stat-item"><strong>Audited:</strong> {stats.audited}</div>
        <div className="stat-item"><strong>Needs Work:</strong> {stats.needsWork}</div>
        <div className="stat-item"><strong>N/A:</strong> {stats.na}</div>
        <div className="stat-item"><strong>Audited (%):</strong> {stats.percent}%</div>
      </div>

      <div className="surface controls-section" style={{ marginBottom: '24px', padding: '16px' }}>
        <div className="form-row">
          <label htmlFor="status-filter">Filter by Status:</label>
          <select 
            id="status-filter" 
            className="filter-input" 
            value={filter} 
            onChange={(e) => setFilter(e.target.value as Status)}
            style={{ width: '200px' }}
            aria-describedby="filter-count"
          >
            <option value="all">All</option>
            <option value="audited">Audited</option>
            <option value="needs-work">Needs Work</option>
            <option value="n/a">N/A</option>
          </select>
          <span id="filter-count" className="sr-only" aria-live="polite" style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', borderWidth: 0 }}>
            {filteredComponents.length} components shown
          </span>
        </div>
      </div>

      <div className="a11y-components-grid">
        {filteredComponents.map(comp => (
          <div key={comp.id} className="surface a11y-card">
            <div className="a11y-card-header">
              <h3>
                {'docs' in comp && (comp as any).docs ? (
                  <a href={`docs/${(comp as any).docs}`} className="component-link">
                    {comp.name}
                  </a>
                ) : (
                  <span className="component-name">{comp.name}</span>
                )}
              </h3>
              <span className={`status-pill status-${comp.status.replace('/', '-')}`}>
                {comp.status}
              </span>
            </div>
          </div>
        ))}
        {filteredComponents.length === 0 && (
          <div className="empty-state-message" style={{ padding: '24px', color: 'var(--muted)' }}>
            No components found for this status.
          </div>
        )}
      </div>
    </div>
  );
}
