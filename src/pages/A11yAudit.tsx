import { useState } from 'react';
import manifest from '../data/a11y-manifest.json';
import useDocumentTitle from '../hooks/useDocumentTitle';

type Status = 'all' | 'audited' | 'needs-work' | 'n/a';

export default function A11yAudit() {
  useDocumentTitle('Accessibility Audit');
  const [filter, setFilter] = useState<Status>('all');
  
  const filteredComponents = manifest.components.filter(c => filter === 'all' || c.status === filter);

  return (
    <div className="page-container a11y-audit-page">
      <div className="page-header">
        <h1>Accessibility Audit Board</h1>
        <p className="page-subtitle">Track the WCAG 2.1 AA compliance status of all design system components.</p>
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
          >
            <option value="all">All</option>
            <option value="audited">Audited</option>
            <option value="needs-work">Needs Work</option>
            <option value="n/a">N/A</option>
          </select>
        </div>
      </div>

      <div className="a11y-components-grid">
        {filteredComponents.map(comp => (
          <div key={comp.id} className="surface a11y-card">
            <div className="a11y-card-header">
              <h3>
                <a href={`#${comp.id}`} className="component-link">
                  {comp.name}
                </a>
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
