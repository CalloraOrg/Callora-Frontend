import React from 'react';
import { useCompareStore, compareStore } from '../state/compareStore';
import type { APIItem } from '../data/mockApis';
import './CompareTray.css';

export default function CompareTray() {
  const { apis } = useCompareStore();

  if (apis.length === 0) return null;

  return (
    <div className="compare-tray" role="region" aria-label="Comparison tray">
      <div className="compare-tray-content">
        <div className="compare-tray-items">
          {apis.map((api) => (
            <div key={api.id} className="compare-tray-item">
              <span className="compare-tray-item-name">{api.name}</span>
              <button
                className="compare-tray-item-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  compareStore.removeApi(api.id);
                }}
                aria-label={`Remove ${api.name} from comparison`}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          ))}
        </div>
        <button
          className="compare-tray-compare-btn"
          onClick={() => compareStore.setOpen(true)}
        >
          Compare ({apis.length})
        </button>
      </div>
    </div>
  );
}
