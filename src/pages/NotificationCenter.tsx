import React from "react";
import Breadcrumb from "../components/Breadcrumb";

export default function NotificationCenter() {
  return (
    <div className="notification-center-page" style={{ padding: "var(--mkt-space-3xl)", maxWidth: "1200px", margin: "0 auto" }}>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/" },
          { label: "Notifications", href: "", isCurrent: true },
        ]}
      />
      
      <header style={{ marginBottom: "var(--mkt-space-2xl)", marginTop: "var(--mkt-space-xl)" }}>
        <h1 style={{ margin: 0 }}>Notification Center</h1>
        <p style={{ color: "var(--text-secondary)", marginTop: "8px" }}>
          Stay updated on your API usage, billing, and current campaigns.
        </p>
      </header>

      <main className="surface" style={{ padding: "var(--mkt-space-3xl)", borderRadius: "var(--radius-lg)" }}>
        {/* Issue #692: Implementation of responsive image srcset */}
        <picture>
          <source srcSet="/assets/grantfox-mobile.webp" media="(max-width: 600px)" />
          <img
            srcSet="/assets/grantfox-desktop.webp 1024w, /assets/grantfox-mobile.webp 480w"
            sizes="(max-width: 600px) 480px, 1024px"
            src="/assets/grantfox-desktop.webp"
            alt="GrantFox FWC26 Campaign Announcement"
            style={{ width: "100%", height: "auto", borderRadius: "var(--radius-md)" }}
            loading="lazy"
          />
        </picture>
        
        <div style={{ marginTop: "var(--mkt-space-xl)" }}>
          <h2>GrantFox FWC26 Campaign Live</h2>
          <p style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
            Welcome to the new campaign dashboard. Mobile devices will now correctly download optimized assets, saving bandwidth and improving initial paint speeds.
          </p>
        </div>
      </main>
    </div>
  );
}
