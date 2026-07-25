import React, { useEffect, useState } from 'react';

export interface LiveRegionProps {
  message: string;
  'aria-live'?: 'polite' | 'assertive';
  clearDelayMs?: number;
}

/**
 * A visually hidden aria-live region used to announce dynamic updates to screen readers.
 * It clears itself shortly after announcing so that repeated announcements are caught.
 */
export function LiveRegion({ message, 'aria-live': ariaLive = 'polite', clearDelayMs = 3000 }: LiveRegionProps) {
  const [announcement, setAnnouncement] = useState(message);

  useEffect(() => {
    setAnnouncement(message);
    
    let timer: ReturnType<typeof setTimeout>;
    if (message) {
      timer = setTimeout(() => {
        setAnnouncement('');
      }, clearDelayMs);
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [message, clearDelayMs]);

  return (
    <div
      aria-live={ariaLive}
      aria-atomic="true"
      className="sr-only"
      style={{
        position: 'absolute',
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      {announcement}
    </div>
  );
}

export default LiveRegion;
