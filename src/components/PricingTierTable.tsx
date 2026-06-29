import React, { useState, useEffect } from "react";
import { CheckIcon } from "./icons";

export interface PricingFeature {
  label: string;
  included: boolean;
}

export interface PricingTier {
  name: string;
  price: string;
  description: string;
  features: PricingFeature[];
  ctaLabel: string;
  isRecommended?: boolean;
}

interface PricingTierTableProps {
  tiers: PricingTier[];
}

const XIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

export default function PricingTierTable({ tiers }: PricingTierTableProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    setIsMobile(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  if (isMobile) {
    return (
      <div className="pricing-tiers-mobile" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {tiers.map((tier, tierIdx) => (
          <div
            key={tier.name}
            className="pricing-tier-card"
            style={{
              padding: 24,
              borderRadius: 16,
              background: tier.isRecommended ? "var(--bg-subtle)" : "var(--surface-strong)",
              border: tier.isRecommended ? "2px solid var(--accent)" : "1px solid var(--border-subtle)",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {tier.isRecommended && (
              <div
                style={{
                  position: "absolute",
                  top: -12,
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "var(--accent)",
                  color: "white",
                  padding: "4px 12px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: "uppercase",
                }}
              >
                Recommended
              </div>
            )}

            <div style={{ textAlign: "center" }}>
              <h3 style={{ margin: 0, fontSize: 20 }}>{tier.name}</h3>
              <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>{tier.price}</div>
              <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 4 }}>{tier.description}</p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {tier.features.map((feature) => (
                <div key={feature.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {feature.included ? (
                    <CheckIcon size={20} style={{ color: "var(--accent)" }} />
                  ) : (
                    <XIcon style={{ color: "var(--muted)" }} />
                  )}
                  <span style={{ fontSize: 14 }}>{feature.label}</span>
                </div>
              ))}
            </div>

            <button
              className="primary-button"
              style={{ width: "100%", marginTop: 8 }}
            >
              {tier.ctaLabel}
            </button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="pricing-tiers-desktop" style={{ display: "grid", gridTemplateColumns: `repeat(${tiers.length}, 1fr)`, gap: 24 }}>
      {tiers.map((tier) => (
        <div
          key={tier.name}
          className="pricing-tier-card"
          style={{
            padding: 24,
            borderRadius: 16,
            background: tier.isRecommended ? "var(--bg-subtle)" : "var(--surface-strong)",
            border: tier.isRecommended ? "2px solid var(--accent)" : "1px solid var(--border-subtle)",
            position: "relative",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {tier.isRecommended && (
            <div
              style={{
                position: "absolute",
                top: -12,
                left: "50%",
                transform: "translateX(-50%)",
                background: "var(--accent)",
                color: "white",
                padding: "4px 12px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              Recommended
            </div>
          )}

          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <h3 style={{ margin: 0, fontSize: 20 }}>{tier.name}</h3>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>{tier.price}</div>
            <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 4 }}>{tier.description}</p>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
            {tier.features.map((feature) => (
              <div
                key={feature.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  fontSize: 14,
                }}
              >
                {feature.included ? (
                  <CheckIcon size={20} style={{ color: "var(--accent)" }} />
                ) : (
                  <XIcon style={{ color: "var(--muted)" }} />
                )}
                <span style={{ color: feature.included ? "var(--text-main)" : "var(--muted)" }}>
                  {feature.label}
                </span>
              </div>
            ))}
          </div>

          <button
            className="primary-button"
            style={{ width: "100%" }}
          >
            {tier.ctaLabel}
          </button>
        </div>
      ))}
    </div>
  );
}
