import React from 'react';

export interface NotificationCenterProps {
  notifications?: Array<{
    id: string;
    title: string;
    message: string;
    imageUrl?: string;
    imageMobileUrl?: string;
    timestamp: string;
  }>;
}

export default function NotificationCenter({ notifications = [] }: NotificationCenterProps) {
  return (
    <div className="notification-center">
      <h2>Notification Center</h2>
      {notifications.length === 0 ? (
        <p>No notifications at this time.</p>
      ) : (
        <ul>
          {notifications.map((n) => (
            <li key={n.id} className="notification-item">
              <h3>{n.title}</h3>
              <p>{n.message}</p>
              {n.imageUrl && (
                <img
                  src={n.imageUrl}
                  srcSet={`${n.imageMobileUrl || n.imageUrl} 480w, ${n.imageUrl} 1200w`}
                  sizes="(max-width: 600px) 480px, 1200px"
                  alt={n.title}
                  loading="lazy"
                />
              )}
              <span className="timestamp">{n.timestamp}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
