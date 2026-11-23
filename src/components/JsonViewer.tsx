import React from 'react';

export const JsonViewer: React.FC<{ data: unknown }> = ({ data }) => {
  return (
    <div className="json-viewer">
      {/* TODO: JSON Viewer tree implementation */}
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
};
