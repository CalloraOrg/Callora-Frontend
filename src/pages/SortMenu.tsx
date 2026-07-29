import React from "react";

/**
 * SortMenu page used for printing tests.
 * - Contains small amount of UI "chrome" that should be hidden when printing
 * - Contains collapsible sections which should be expanded when printing
 */
export default function SortMenu(): JSX.Element {
  return (
    <div className="sort-menu-page">
      <header className="sort-menu-header no-print">
        <h1>Sort & Filters</h1>
        <div className="sort-menu-actions">
          <button className="ghost-button">Close</button>
          <button className="primary-button">Apply</button>
        </div>
      </header>

      <section className="sort-menu-content">
        <p className="no-print">This chrome is hidden on print (page header, buttons).</p>

        <div className="sort-collapsible">
          <details>
            <summary>Sort Options</summary>
            <div>
              <label>
                <input type="radio" name="sort" defaultChecked /> Relevance
              </label>
              <label>
                <input type="radio" name="sort" /> Price: low → high
              </label>
              <label>
                <input type="radio" name="sort" /> Popularity
              </label>
            </div>
          </details>

          <details>
            <summary>Advanced Filters</summary>
            <div>
              <label>
                <input type="checkbox" /> Include deprecated
              </label>
              <label>
                <input type="checkbox" /> Show only free
              </label>
            </div>
          </details>
        </div>
      </section>
    </div>
  );
}
