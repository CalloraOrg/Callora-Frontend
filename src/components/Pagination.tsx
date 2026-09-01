interface OffsetPaginationProps {
  mode?: "offset";
  currentPage: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

interface CursorPaginationProps {
  mode: "cursor";
  currentPageIndex: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  totalItemCount: number;
  pageSize: number;
  onGoNext: () => void;
  onGoPrevious: () => void;
  onPageSizeChange: (size: number) => void;
}

type PaginationProps = OffsetPaginationProps | CursorPaginationProps;

export function Pagination(props: PaginationProps) {
  if (props.mode === "cursor") {
    return <CursorPagination {...props} />;
  }
  return <OffsetPagination {...props} />;
}

function OffsetPagination({
  currentPage,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: OffsetPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const leftBound = Math.max(2, currentPage - 1);
      const rightBound = Math.min(totalPages - 1, currentPage + 1);

      pages.push(1);

      if (leftBound > 2) {
        pages.push("...");
      }

      for (let i = leftBound; i <= rightBound; i++) {
        pages.push(i);
      }

      if (rightBound < totalPages - 1) {
        pages.push("...");
      }

      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <nav aria-label="Pagination" className="pagination-nav">
      <div className="pagination-controls">
        <div className="page-size-selector">
          <label htmlFor="page-size" className="page-size-label">
            Items per page:
          </label>
          <select
            id="page-size"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="page-size-select"
          >
            <option value={12}>12</option>
            <option value={24}>24</option>
            <option value={48}>48</option>
          </select>
        </div>

        <div className="pagination-buttons">
          <button
            className="pagination-button ghost-button"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            aria-label="First page"
          >
            First
          </button>

          <button
            className="pagination-button ghost-button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            aria-label="Previous page"
          >
            Prev
          </button>

          <div className="page-numbers">
            {pageNumbers.map((page, index) => (
              <span key={index} className="page-number-wrapper">
                {page === "..." ? (
                  <span className="ellipsis">...</span>
                ) : (
                  <button
                    className={`pagination-button ${
                      page === currentPage ? "current-page" : "ghost-button"
                    }`}
                    onClick={() => onPageChange(page as number)}
                    aria-label={`Page ${page}`}
                    aria-current={page === currentPage ? "page" : undefined}
                  >
                    {page}
                  </button>
                )}
              </span>
            ))}
          </div>

          <button
            className="pagination-button ghost-button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            aria-label="Next page"
          >
            Next
          </button>

          <button
            className="pagination-button ghost-button"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            aria-label="Last page"
          >
            Last
          </button>
        </div>

        <div className="mobile-page-indicator">
          <span>
            Page {currentPage} of {totalPages}
          </span>
        </div>
      </div>

      <PaginationStyles />
    </nav>
  );
}

function CursorPagination({
  currentPageIndex,
  hasNextPage,
  hasPreviousPage,
  totalItemCount,
  pageSize,
  onGoNext,
  onGoPrevious,
  onPageSizeChange,
}: CursorPaginationProps) {
  const displayPage = currentPageIndex + 1;
  const maxPages =
    totalItemCount > 0 ? Math.ceil(totalItemCount / pageSize) : 1;

  return (
    <nav aria-label="Pagination" className="pagination-nav">
      <div className="pagination-controls">
        <div className="page-size-selector">
          <label htmlFor="page-size" className="page-size-label">
            Items per page:
          </label>
          <select
            id="page-size"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="page-size-select"
          >
            <option value={12}>12</option>
            <option value={24}>24</option>
            <option value={48}>48</option>
          </select>
        </div>

        <div className="pagination-buttons">
          <button
            className="pagination-button ghost-button"
            onClick={onGoPrevious}
            disabled={!hasPreviousPage}
            aria-label="Previous page"
          >
            Prev
          </button>

          <span className="cursor-page-indicator" aria-current="page">
            <span className="numeric-tabular">{displayPage}</span>
            {" / "}
            <span className="numeric-tabular">{maxPages}</span>
          </span>

          <button
            className="pagination-button ghost-button"
            onClick={onGoNext}
            disabled={!hasNextPage}
            aria-label="Next page"
          >
            Next
          </button>
        </div>

        <div className="mobile-page-indicator">
          <span>
            Page{" "}
            <span className="numeric-tabular">{displayPage}</span>
            {" of "}
            <span className="numeric-tabular">{maxPages}</span>
          </span>
        </div>
      </div>

      <PaginationStyles />
    </nav>
  );
}

function PaginationStyles() {
  return (
    <style>{`
      .pagination-nav {
        width: 100%;
        margin: 24px 0;
      }
      .pagination-controls {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        flex-wrap: wrap;
      }
      .page-size-selector {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .page-size-label {
        font-size: 0.875rem;
        color: var(--muted);
      }
      .page-size-select {
        padding: 8px 12px;
        border-radius: 12px;
        border: 1px solid var(--line);
        background: var(--surface-soft);
        color: var(--text);
        font-size: 0.875rem;
        cursor: pointer;
      }
      .pagination-buttons {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .pagination-button {
        min-height: 40px;
        padding: 0 12px;
        border-radius: 12px;
        border: 1px solid var(--line);
        background: var(--surface-soft);
        color: var(--text);
        font-size: 0.875rem;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .pagination-button:hover:not(:disabled) {
        background: var(--line);
      }
      .pagination-button.current-page {
        background: var(--accent);
        color: white;
        border-color: var(--accent);
      }
      .pagination-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .page-numbers {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .ellipsis {
        color: var(--muted);
        padding: 0 8px;
      }
      .cursor-page-indicator {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 0 12px;
        font-size: 0.875rem;
        color: var(--text);
        font-variant-numeric: tabular-nums;
      }
      .mobile-page-indicator {
        display: none;
        color: var(--muted);
        font-size: 0.875rem;
      }
      @media (max-width: 360px) {
        .page-size-selector,
        .pagination-buttons .page-numbers,
        .pagination-buttons button:not(.ghost-button:nth-child(2)):not(.ghost-button:nth-child(4)) {
          display: none;
        }
        .pagination-buttons {
          gap: 12px;
        }
        .mobile-page-indicator {
          display: block;
        }
        .pagination-controls {
          justify-content: center;
        }
      }
    `}</style>
  );
}
