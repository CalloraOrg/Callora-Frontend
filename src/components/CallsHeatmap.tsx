import React, { useMemo } from 'react';

type DayData = {
  date: Date;
  count: number;
  level: number;
  isFuture: boolean;
};

export default function CallsHeatmap() {
  const grid = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Start date is exactly 12 weeks before the Sunday of the current week.
    const startOfThisWeek = new Date(today);
    startOfThisWeek.setDate(today.getDate() - today.getDay());

    const startDate = new Date(startOfThisWeek);
    startDate.setDate(startDate.getDate() - 12 * 7);

    const cols: DayData[][] = [];
    for (let c = 0; c < 13; c++) {
      const col: DayData[] = [];
      for (let r = 0; r < 7; r++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + c * 7 + r);

        let count = 0;
        let level = 0;
        const isFuture = date > today;

        if (!isFuture) {
          count = Math.floor(Math.random() * 5000);
          if (count > 0) level = 1;
          if (count > 1000) level = 2;
          if (count > 2500) level = 3;
          if (count > 4000) level = 4;
        }

        col.push({ date, count, level, isFuture });
      }
      cols.push(col);
    }
    return cols;
  }, []);

  const months = useMemo(() => {
    const monthLabels: { label: string; colIndex: number }[] = [];
    let lastMonth = -1;
    grid.forEach((col, idx) => {
      const month = col[0].date.getMonth();
      if (month !== lastMonth) {
        monthLabels.push({
          label: col[0].date.toLocaleString('default', { month: 'short' }),
          colIndex: idx,
        });
        lastMonth = month;
      }
    });
    return monthLabels;
  }, [grid]);

  const handleKeyDown = (e: React.KeyboardEvent, colIdx: number, rowIdx: number) => {
    let newCol = colIdx;
    let newRow = rowIdx;
    if (e.key === 'ArrowRight') {
      newCol = Math.min(12, colIdx + 1);
    } else if (e.key === 'ArrowLeft') {
      newCol = Math.max(0, colIdx - 1);
    } else if (e.key === 'ArrowDown') {
      newRow = Math.min(6, rowIdx + 1);
    } else if (e.key === 'ArrowUp') {
      newRow = Math.max(0, rowIdx - 1);
    }

    if (newCol !== colIdx || newRow !== rowIdx) {
      e.preventDefault();
      const nextCellId = `heatmap-cell-${newCol}-${newRow}`;
      document.getElementById(nextCellId)?.focus();
    }
  };

  return (
    <div className="calls-heatmap-container">
      <div className="heatmap-wrapper">
        <div className="heatmap-months">
          {months.map((m, i) => (
            <span key={i} className="month-label" style={{ gridColumn: m.colIndex + 1 }}>
              {m.label}
            </span>
          ))}
        </div>
        <div className="heatmap-body">
          <div className="heatmap-weekdays" aria-hidden="true">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>
          <div className="heatmap-grid" role="grid" aria-label="API Calls Heatmap">
            {grid.map((col, colIdx) => (
              <div key={colIdx} className="heatmap-col" role="row">
                {col.map((day, rowIdx) => {
                  if (day.isFuture) {
                    return (
                      <div
                        key={rowIdx}
                        className="heatmap-cell future-cell"
                        role="gridcell"
                        aria-hidden="true"
                      ></div>
                    );
                  }
                  const dateStr = day.date.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  });
                  return (
                    <div
                      key={rowIdx}
                      id={`heatmap-cell-${colIdx}-${rowIdx}`}
                      className={`heatmap-cell level-${day.level}`}
                      role="gridcell"
                      tabIndex={0}
                      aria-label={`${dateStr}: ${day.count} calls`}
                      title={`${dateStr}: ${day.count} calls`}
                      onKeyDown={(e) => handleKeyDown(e, colIdx, rowIdx)}
                    ></div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="heatmap-legend" aria-hidden="true">
          <span>Less</span>
          <div className="legend-cells">
            <div className="heatmap-cell level-0"></div>
            <div className="heatmap-cell level-1"></div>
            <div className="heatmap-cell level-2"></div>
            <div className="heatmap-cell level-3"></div>
            <div className="heatmap-cell level-4"></div>
          </div>
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
