/**
 * DesignSystemDocs – internal /design-system/docs page.
 *
 * Lists every documented UI component with a live example, usage notes, and
 * the design tokens it consumes. Also surfaces the full colour-token palette,
 * typography scale, spacing scale, border-radius tokens, and CSS utility
 * classes. Intended for contributors and designers so the entire component
 * library is discoverable in one place.
 *
 * Accessibility: WCAG 2.1 AA.
 *   - Keyboard navigable (Tab, Enter, Escape).
 *   - `aria-expanded` / `aria-controls` on every accordion.
 *   - Search results announced via aria-live.
 *   - Focus-visible ring via the global @layer focus rule.
 *   - No colour-only information; text labels always accompany swatches.
 *
 * Dark-mode: all colour values come from design tokens so the page
 * automatically adapts when `data-theme` changes.
 */

import { useState, useId, useMemo } from "react";
import useDocumentTitle from "../hooks/useDocumentTitle";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single prop entry shown in the props table. */
interface PropDoc {
  name: string;
  type: string;
  required?: boolean;
  defaultValue?: string;
  description: string;
}

/** A documented component entry in the catalogue. */
interface ComponentDoc {
  id: string;
  /** Display name shown in the accordion header and table of contents. */
  name: string;
  /** Short description of the component's purpose. */
  description: string;
  /** Design tokens consumed by this component. */
  tokens: string[];
  /** Props accepted by the component. */
  props: PropDoc[];
  /** Optional usage code snippet (plain text). */
  usageSnippet?: string;
  /** Inline render of a live example. */
  example: () => JSX.Element;
}

/** A colour-token row shown in the palette section. */
interface ColourToken {
  token: string;
  /** Raw value shown in the swatch; uses a CSS var() reference so it adapts
   *  to the active theme at render time. */
  cssVar: string;
  description: string;
}

/** A named group of colour tokens (e.g. "Background", "Text"). */
interface ColourGroup {
  label: string;
  tokens: ColourToken[];
}

// ---------------------------------------------------------------------------
// Colour token catalogue
// ---------------------------------------------------------------------------

const COLOUR_GROUPS: ColourGroup[] = [
  {
    label: "Background",
    tokens: [
      { token: "--page-bg", cssVar: "var(--page-bg)", description: "Main page background" },
      { token: "--surface", cssVar: "var(--surface)", description: "Card / panel background" },
      { token: "--surface-strong", cssVar: "var(--surface-strong)", description: "High-opacity surfaces (modals, overlays)" },
      { token: "--surface-soft", cssVar: "var(--surface-soft)", description: "Subtle backgrounds (hover states, inputs)" },
    ],
  },
  {
    label: "Text",
    tokens: [
      { token: "--text", cssVar: "var(--text)", description: "Primary text" },
      { token: "--muted", cssVar: "var(--muted)", description: "Secondary text and labels" },
    ],
  },
  {
    label: "Brand & Actions",
    tokens: [
      { token: "--accent", cssVar: "var(--accent)", description: "Primary brand colour — links, active states" },
      { token: "--accent-strong", cssVar: "var(--accent-strong)", description: "Success states, highlights, CTAs" },
    ],
  },
  {
    label: "Semantic",
    tokens: [
      { token: "--danger", cssVar: "var(--danger)", description: "Error states, destructive actions" },
      { token: "--success", cssVar: "var(--success)", description: "Success messages, confirmations" },
      { token: "--warning", cssVar: "var(--warning)", description: "Warning states" },
    ],
  },
  {
    label: "Borders",
    tokens: [
      { token: "--line", cssVar: "var(--line)", description: "Standard borders and dividers" },
      { token: "--line-strong", cssVar: "var(--line-strong)", description: "Emphasised borders" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Typography specimens
// ---------------------------------------------------------------------------

interface TypeSpecimen {
  label: string;
  element: keyof JSX.IntrinsicElements;
  className?: string;
  sampleText: string;
  notes: string;
}

const TYPE_SCALE: TypeSpecimen[] = [
  {
    label: "Brand heading",
    element: "p",
    className: "brand",
    sampleText: "Callora — Programmable API Access",
    notes: "`.brand` class — used for hero-level headings only.",
  },
  {
    label: "H1",
    element: "h1",
    sampleText: "Design System",
    notes: "One `<h1>` per page. Inherits `--font-family`.",
  },
  {
    label: "H2",
    element: "h2",
    sampleText: "Component Reference",
    notes: "Section headings inside a page.",
  },
  {
    label: "H3",
    element: "h3",
    sampleText: "Primary Button",
    notes: "Card titles and sub-section headings.",
  },
  {
    label: "Body",
    element: "p",
    sampleText:
      "All text defaults to `var(--text)`. Secondary copy uses `var(--muted)` to establish visual hierarchy.",
    notes: "Default paragraph; inherits font from `:root`.",
  },
  {
    label: "Eyebrow label",
    element: "p",
    className: "eyebrow",
    sampleText: "Internal reference",
    notes: "`.eyebrow` class — uppercase, letter-spaced, accent colour.",
  },
  {
    label: "Helper text",
    element: "p",
    className: "helper-text",
    sampleText: "Muted supplementary information shown below form fields.",
    notes: "`.helper-text` class — `var(--muted)` colour.",
  },
];

// ---------------------------------------------------------------------------
// Spacing & radius token tables
// ---------------------------------------------------------------------------

const SPACING_TOKENS = [
  { token: "--radius-xl", value: "28px", usage: "Extra-large — cards, modals" },
  { token: "--radius-lg", value: "20px", usage: "Large — sections, panels" },
  { token: "--radius-md", value: "16px", usage: "Medium — buttons, inputs" },
  { token: "--transition-speed", value: "240ms", usage: "Standard animation duration" },
];

// ---------------------------------------------------------------------------
// CSS utility classes reference
// ---------------------------------------------------------------------------

interface UtilityClass {
  name: string;
  description: string;
  category: "button" | "layout" | "typography" | "state" | "link";
}

const UTILITY_CLASSES: UtilityClass[] = [
  // Buttons
  { name: ".primary-button", description: "Primary action — gradient background, used at most once per view.", category: "button" },
  { name: ".secondary-button", description: "Secondary / cancel action — ghost style with border.", category: "button" },
  { name: ".ghost-button", description: "Minimal button with hover effect; used for low-emphasis actions.", category: "button" },
  { name: ".close-button", description: "Dismiss / close action button.", category: "button" },
  { name: ".danger-button", description: "Destructive action — uses `--danger` token.", category: "button" },
  // Layout
  { name: ".surface", description: "Elevated container: border, radius, shadow, backdrop blur.", category: "layout" },
  { name: ".app-shell", description: "Main application container with consistent padding.", category: "layout" },
  { name: ".hero-grid", description: "Two-column hero layout for landing sections.", category: "layout" },
  { name: ".modal-grid", description: "Two-column modal layout.", category: "layout" },
  // Typography
  { name: ".brand", description: "Large hero-level brand heading.", category: "typography" },
  { name: ".eyebrow", description: "Small uppercase label used above headings.", category: "typography" },
  { name: ".helper-text", description: "Secondary / muted text below form fields.", category: "typography" },
  // Links
  { name: ".link-body", description: "Inline body-text links with 1 px underline and `--visited` state.", category: "link" },
  { name: ".link-nav", description: "Structural navigation links — no underline, hover/focus states included.", category: "link" },
  // State
  { name: ".not-found", description: "404 page container.", category: "state" },
  { name: ".server-error", description: "Server-error page container.", category: "state" },
  { name: ".placeholder-card", description: "Generic placeholder / empty-state container.", category: "state" },
  { name: ".sr-only", description: "Visually hidden, still available to screen readers (WCAG 2.1 AA).", category: "state" },
];

// ---------------------------------------------------------------------------
// Component catalogue
// ---------------------------------------------------------------------------

const COMPONENT_DOCS: ComponentDoc[] = [
  // ── Buttons ─────────────────────────────────────────────────────────────
  {
    id: "button-primary",
    name: "Primary Button",
    description:
      "The main call-to-action button. Uses `.primary-button` and should be used sparingly — once per view. It receives a gradient background from the design token layer.",
    tokens: ["--accent", "--radius-md"],
    props: [
      { name: "onClick", type: "() => void", description: "Click handler." },
      { name: "disabled", type: "boolean", defaultValue: "false", description: "Disables interaction and reduces opacity." },
      { name: "children", type: "ReactNode", required: true, description: "Button label." },
    ],
    usageSnippet: '<button className="primary-button" type="button">\n  Approve Transaction\n</button>',
    example: () => (
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
        <button className="primary-button" type="button">
          Approve Transaction
        </button>
        <button className="primary-button" type="button" disabled>
          Disabled
        </button>
      </div>
    ),
  },
  {
    id: "button-secondary",
    name: "Secondary Button",
    description:
      "Ghost-style button for secondary or cancel actions. Never used as the sole action on a page.",
    tokens: ["--line", "--radius-md", "--text"],
    props: [
      { name: "onClick", type: "() => void", description: "Click handler." },
      { name: "disabled", type: "boolean", defaultValue: "false", description: "Disables interaction." },
      { name: "children", type: "ReactNode", required: true, description: "Button label." },
    ],
    usageSnippet: '<button className="secondary-button" type="button">\n  Cancel\n</button>',
    example: () => (
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
        <button className="secondary-button" type="button">
          Cancel
        </button>
        <button className="secondary-button" type="button" disabled>
          Disabled
        </button>
      </div>
    ),
  },
  {
    id: "button-danger",
    name: "Danger Button",
    description:
      "Destructive action button. Uses `.danger-button` and the `--danger` token. Must be accompanied by a confirmation step for irreversible actions.",
    tokens: ["--danger", "--radius-md"],
    props: [
      { name: "onClick", type: "() => void", description: "Click handler." },
      { name: "children", type: "ReactNode", required: true, description: "Button label." },
    ],
    usageSnippet: '<button className="danger-button" type="button">\n  Delete API Key\n</button>',
    example: () => (
      <button className="danger-button" type="button">
        Delete API Key
      </button>
    ),
  },
  // ── Surfaces & Layout ────────────────────────────────────────────────────
  {
    id: "surface-card",
    name: "Surface Card",
    description:
      "Elevated container used for dashboard tiles, vault balance cards, and info panels. Applies `--surface`, `--line`, `--radius-lg`, and backdrop blur.",
    tokens: ["--surface", "--line", "--radius-lg", "--shadow"],
    props: [
      { name: "children", type: "ReactNode", required: true, description: "Card body content." },
      { name: "className", type: "string", description: "Additional CSS classes." },
    ],
    usageSnippet: '<article className="surface" style={{ padding: "1rem" }}>\n  <span className="eyebrow">Vault balance</span>\n  <strong>284.62 USDC</strong>\n</article>',
    example: () => (
      <article className="surface" style={{ padding: "1rem", borderRadius: "var(--radius-lg, 20px)", maxWidth: 320 }}>
        <span className="eyebrow">Vault balance</span>
        <strong style={{ display: "block", marginTop: "0.25rem", fontSize: "1.5rem" }}>
          284.62 USDC
        </strong>
        <p className="helper-text" style={{ marginTop: "0.5rem" }}>
          Last updated just now
        </p>
      </article>
    ),
  },
  // ── Typography ───────────────────────────────────────────────────────────
  {
    id: "eyebrow",
    name: "Eyebrow Label",
    description:
      "Small uppercase label used above headings to establish section context. Uses the `.eyebrow` class.",
    tokens: ["--accent", "--muted"],
    props: [
      { name: "children", type: "ReactNode", required: true, description: "Label text." },
    ],
    usageSnippet: '<p className="eyebrow">Core capabilities</p>',
    example: () => (
      <div>
        <p className="eyebrow">Core capabilities</p>
        <h2 style={{ margin: "0.25rem 0 0" }}>Why teams choose Callora</h2>
      </div>
    ),
  },
  // ── Badges & Status ──────────────────────────────────────────────────────
  {
    id: "status-chip",
    name: "Status Chip",
    description:
      "Inline badge that surfaces transaction or system state at a glance. Colour is token-driven; text always carries the label so colour is never the sole indicator. Each variant also carries a unique SVG background pattern (dots, cross-hatch, or diagonal stripes) so the state remains distinguishable to color-blind users (WCAG 1.4.1).",
    tokens: ["--success", "--danger", "--warning", "--radius-full"],
    props: [
      {
        name: "status",
        type: "'input' | 'approving' | 'pending' | 'confirmed' | 'failed'",
        required: true,
        description: "Controls colour and label.",
      },
    ],
    usageSnippet: '<span className="status-chip confirmed">confirmed</span>',
    example: () => (
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {(["input", "approving", "pending", "confirmed", "failed"] as const).map((s) => (
          <span key={s} className={`status-chip ${s}`}>
            {s}
          </span>
        ))}
      </div>
    ),
  },
  // ── Navigation & Accessibility ───────────────────────────────────────────
  {
    id: "skip-link",
    name: "Skip Link",
    description:
      "Visually hidden anchor that becomes visible on focus, allowing keyboard users to bypass the navigation and jump straight to main content. Required for WCAG 2.1 AA compliance. Rendered in `App.tsx` as the very first child of `<body>`.",
    tokens: ["--text", "--page-bg", "--accent"],
    props: [
      { name: "href", type: "string", required: true, description: "Target element id, e.g. #main-content." },
      { name: "children", type: "ReactNode", required: true, description: "Link text shown on focus." },
    ],
    usageSnippet: '<a href="#main-content" className="skip-link">\n  Skip to main content\n</a>',
    example: () => (
      /* Force static positioning so it is always visible in the demo */
      <a
        href="#main-content"
        className="skip-link"
        style={{ position: "static", transform: "none", opacity: 1 }}
      >
        Skip to main content
      </a>
    ),
  },
  // ── Form Controls ────────────────────────────────────────────────────────
  {
    id: "search-bar",
    name: "SearchBar",
    description:
      "Search input with a clear button and keyboard shortcuts. Supports Escape to clear and Enter to trigger the search callback.",
    tokens: ["--surface-soft", "--line", "--accent", "--text", "--muted"],
    props: [
      { name: "value", type: "string", required: true, description: "Current search value." },
      { name: "onChange", type: "(v: string) => void", required: true, description: "Update callback." },
      { name: "placeholder", type: "string", defaultValue: '"Search APIs, providers, tags..."', description: "Input placeholder." },
      { name: "onSearch", type: "() => void", description: "Called when the user presses Enter." },
    ],
    usageSnippet: '<SearchBar value={q} onChange={setQ} onSearch={handleSearch} />',
    example: () => {
      /* Local state not available in static example — render a static mockup */
      return (
        <div
          role="search"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 0.75rem",
            borderRadius: "8px",
            background: "var(--surface-soft, rgba(255,255,255,0.04))",
            border: "1px solid var(--line, rgba(169,184,255,0.16))",
            maxWidth: 340,
          }}
        >
          {/* Simple search icon inline so we avoid importing a component */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="search"
            placeholder="Search APIs, providers, tags…"
            aria-label="Search APIs"
            style={{
              border: "none",
              outline: "none",
              background: "transparent",
              color: "var(--text)",
              width: "100%",
            }}
          />
        </div>
      );
    },
  },
  // ── Feedback & Loading ───────────────────────────────────────────────────
  {
    id: "skeleton",
    name: "Skeleton",
    description:
      "Loading placeholder with a shimmer animation. Renders an element of configurable size and radius; the parent is responsible for setting `aria-busy` / `aria-label` context.",
    tokens: ["--surface-soft", "--line"],
    props: [
      { name: "width", type: "string | number", description: "Skeleton width." },
      { name: "height", type: "string | number", description: "Skeleton height." },
      { name: "borderRadius", type: "string | number", description: "Border radius." },
      { name: "style", type: "CSSProperties", description: "Additional inline styles." },
      { name: "className", type: "string", description: "Additional CSS classes." },
    ],
    usageSnippet: '<Skeleton width={200} height={20} borderRadius={4} />',
    example: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }} aria-label="Loading content" aria-busy="true">
        <div className="skeleton" style={{ width: 200, height: 16, borderRadius: 4 }} />
        <div className="skeleton" style={{ width: 280, height: 16, borderRadius: 4 }} />
        <div className="skeleton" style={{ width: 140, height: 16, borderRadius: 4 }} />
        <div className="skeleton" style={{ width: 80, height: 32, borderRadius: 8, marginTop: "0.5rem" }} />
      </div>
    ),
  },
  {
    id: "empty-state",
    name: "EmptyState",
    description:
      "Displayed when no results are found (e.g. empty search results). Provides a heading and an optional sub-message.",
    tokens: ["--surface", "--text", "--muted"],
    props: [
      { name: "title", type: "string", defaultValue: '"No APIs found"', description: "Heading text." },
      { name: "message", type: "string", defaultValue: '"Try adjusting your filters"', description: "Subtitle text." },
    ],
    usageSnippet: '<EmptyState title="No results found" message="Try different search terms" />',
    example: () => (
      <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
        <p style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🔍</p>
        <h3 style={{ margin: 0 }}>No APIs found</h3>
        <p className="helper-text" style={{ marginTop: "0.5rem" }}>
          Try adjusting your filters
        </p>
      </div>
    ),
  },
  // ── Error States ─────────────────────────────────────────────────────────
  {
    id: "server-error",
    name: "ServerError",
    description:
      "Server-error display with retry functionality. Uses `role=\"alert\"` so the message is announced immediately by screen readers. The retry button receives `aria-busy` during an in-flight retry.",
    tokens: ["--danger", "--surface", "--accent"],
    props: [
      { name: "onRetry", type: "() => void | Promise<void>", description: "Retry callback (optional)." },
      { name: "requestId", type: "string", description: "Request ID shown masked for support." },
      { name: "title", type: "string", defaultValue: '"Something went wrong on our end"', description: "Error heading." },
      { name: "description", type: "string", description: "Error message." },
    ],
    usageSnippet: '<ServerError onRetry={refetch} requestId="req_abc123" />',
    example: () => (
      <div
        role="alert"
        style={{
          textAlign: "center",
          padding: "1.5rem",
          borderRadius: "var(--radius-lg, 20px)",
          background: "var(--surface-soft, rgba(255,255,255,0.04))",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "rgba(255,125,141,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 0.75rem",
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--danger, #ff7d8d)" strokeWidth="1.6" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h3 style={{ margin: "0 0 0.5rem" }}>Something went wrong</h3>
        <p className="helper-text" style={{ margin: "0 0 1rem" }}>
          An unexpected error occurred. Please try again.
        </p>
        <button className="primary-button" type="button">
          Retry
        </button>
      </div>
    ),
  },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Renders a table of prop definitions for a component. */
function PropTable({ props }: { props: PropDoc[] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", minWidth: 480 }}
        aria-label="Component props"
      >
        <thead>
          <tr>
            {["Prop", "Type", "Required", "Default", "Description"].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: "left",
                  padding: "0.45rem 0.65rem",
                  borderBottom: "1px solid var(--line, #334155)",
                  color: "var(--muted)",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.map((p, i) => (
            <tr
              key={p.name}
              style={{
                background: i % 2 === 0 ? "transparent" : "var(--surface-soft, rgba(255,255,255,0.02))",
              }}
            >
              <td style={{ padding: "0.45rem 0.65rem", fontFamily: "monospace", whiteSpace: "nowrap", color: "var(--accent)" }}>
                {p.name}
              </td>
              <td style={{ padding: "0.45rem 0.65rem", fontFamily: "monospace", color: "var(--accent-strong)", whiteSpace: "nowrap" }}>
                {p.type}
              </td>
              <td style={{ padding: "0.45rem 0.65rem", textAlign: "center" }}>
                {p.required ? (
                  <span aria-label="required" style={{ color: "var(--danger)" }}>✓</span>
                ) : (
                  <span aria-label="optional" style={{ color: "var(--muted)" }}>—</span>
                )}
              </td>
              <td style={{ padding: "0.45rem 0.65rem", fontFamily: "monospace", color: "var(--muted)" }}>
                {p.defaultValue ?? "—"}
              </td>
              <td style={{ padding: "0.45rem 0.65rem" }}>{p.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Renders a chip list of design tokens consumed by a component. */
function TokenList({ tokens }: { tokens: string[] }) {
  return (
    <ul
      style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", listStyle: "none", padding: 0, margin: 0 }}
      aria-label="Design tokens used"
    >
      {tokens.map((t) => (
        <li
          key={t}
          style={{
            background: "var(--surface-soft, #1e293b)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-md, 16px)",
            padding: "0.15rem 0.6rem",
            fontFamily: "monospace",
            fontSize: "0.78rem",
          }}
        >
          {t}
        </li>
      ))}
    </ul>
  );
}

/** Renders the usage code snippet with copy-to-clipboard support. */
function UsageSnippet({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div
      style={{
        position: "relative",
        background: "var(--surface-soft, rgba(0,0,0,0.3))",
        borderRadius: "var(--radius-md, 16px)",
        border: "1px solid var(--line)",
        overflow: "hidden",
      }}
    >
      <pre
        style={{
          margin: 0,
          padding: "0.85rem 1rem",
          fontFamily: "monospace",
          fontSize: "0.8rem",
          overflowX: "auto",
          lineHeight: 1.6,
        }}
      >
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? "Code copied" : "Copy usage snippet"}
        style={{
          position: "absolute",
          top: "0.5rem",
          right: "0.5rem",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-md, 16px)",
          padding: "0.2rem 0.55rem",
          fontSize: "0.75rem",
          cursor: "pointer",
          color: "var(--muted)",
        }}
      >
        {copied ? "✓ Copied" : "Copy"}
      </button>
    </div>
  );
}

interface ComponentSectionProps {
  doc: ComponentDoc;
  isOpen: boolean;
  onToggle: () => void;
}

/** Accordion card for a single component entry. */
function ComponentSection({ doc, isOpen, onToggle }: ComponentSectionProps) {
  // Unique IDs for aria-controls / aria-labelledby
  const headingId = `doc-heading-${doc.id}`;
  const bodyId = `doc-body-${doc.id}`;

  return (
    <article
      className="surface"
      style={{ marginBottom: "1rem", borderRadius: "var(--radius-lg, 20px)", overflow: "hidden" }}
      aria-labelledby={headingId}
    >
      {/* Accordion trigger — always visible */}
      <button
        type="button"
        id={`trigger-${doc.id}`}
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={bodyId}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "1rem 1.25rem",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          gap: "0.5rem",
        }}
      >
        <h2 id={headingId} style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>
          {doc.name}
        </h2>
        <span
          aria-hidden="true"
          style={{
            fontSize: "0.8rem",
            color: "var(--muted)",
            flexShrink: 0,
            transition: "transform 240ms",
            display: "inline-block",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          ▾
        </span>
      </button>

      {/* Collapsible body */}
      {isOpen && (
        <div id={bodyId} role="region" aria-labelledby={headingId} style={{ padding: "0 1.25rem 1.25rem" }}>
          <p style={{ marginTop: 0, color: "var(--muted)", lineHeight: 1.6 }}>{doc.description}</p>

          {/* Live example */}
          <section aria-label="Live example" style={{ marginBottom: "1.25rem" }}>
            <p className="eyebrow" style={{ marginBottom: "0.5rem" }}>
              Live example
            </p>
            <div
              style={{
                padding: "1.25rem",
                background: "var(--surface-soft, rgba(255,255,255,0.04))",
                borderRadius: "var(--radius-md, 16px)",
                border: "1px solid var(--line)",
              }}
            >
              <doc.example />
            </div>
          </section>

          {/* Usage snippet */}
          {doc.usageSnippet && (
            <section aria-label="Usage snippet" style={{ marginBottom: "1.25rem" }}>
              <p className="eyebrow" style={{ marginBottom: "0.5rem" }}>
                Usage
              </p>
              <UsageSnippet code={doc.usageSnippet} />
            </section>
          )}

          {/* Design tokens */}
          <section aria-label="Design tokens" style={{ marginBottom: "1.25rem" }}>
            <p className="eyebrow" style={{ marginBottom: "0.5rem" }}>
              Design tokens
            </p>
            <TokenList tokens={doc.tokens} />
          </section>

          {/* Props table */}
          {doc.props.length > 0 && (
            <section aria-label="Props table">
              <p className="eyebrow" style={{ marginBottom: "0.5rem" }}>
                Props
              </p>
              <PropTable props={doc.props} />
            </section>
          )}
        </div>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Colour palette section
// ---------------------------------------------------------------------------

function ColourPalette() {
  return (
    <section aria-labelledby="colour-palette-heading" style={{ marginBottom: "2.5rem" }}>
      <h2 id="colour-palette-heading" style={{ marginBottom: "0.25rem" }}>
        Colour Tokens
      </h2>
      <p style={{ color: "var(--muted)", marginTop: 0, marginBottom: "1.25rem" }}>
        All colour values are CSS custom properties defined in{" "}
        <code style={{ fontFamily: "monospace" }}>src/index.css</code>. They automatically adapt
        between light and dark themes.
      </p>

      {COLOUR_GROUPS.map((group) => (
        <div key={group.label} style={{ marginBottom: "1.5rem" }}>
          <p className="eyebrow" style={{ marginBottom: "0.75rem" }}>
            {group.label}
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: "0.75rem",
            }}
          >
            {group.tokens.map((t) => (
              <div
                key={t.token}
                className="surface"
                style={{
                  borderRadius: "var(--radius-md, 16px)",
                  overflow: "hidden",
                  padding: 0,
                }}
              >
                {/* Colour swatch */}
                <div
                  aria-hidden="true"
                  style={{
                    height: 56,
                    background: t.cssVar,
                    border: "1px solid var(--line)",
                    borderRadius: "var(--radius-md, 16px) var(--radius-md, 16px) 0 0",
                  }}
                />
                <div style={{ padding: "0.6rem 0.75rem" }}>
                  <p
                    style={{
                      margin: 0,
                      fontFamily: "monospace",
                      fontSize: "0.78rem",
                      color: "var(--accent)",
                    }}
                  >
                    {t.token}
                  </p>
                  <p
                    style={{
                      margin: "0.2rem 0 0",
                      fontSize: "0.78rem",
                      color: "var(--muted)",
                      lineHeight: 1.4,
                    }}
                  >
                    {t.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Typography section
// ---------------------------------------------------------------------------

function TypographyScale() {
  return (
    <section aria-labelledby="typography-heading" style={{ marginBottom: "2.5rem" }}>
      <h2 id="typography-heading" style={{ marginBottom: "0.25rem" }}>
        Typography Scale
      </h2>
      <p style={{ color: "var(--muted)", marginTop: 0, marginBottom: "1.25rem" }}>
        All type uses{" "}
        <code style={{ fontFamily: "monospace" }}>var(--font-family)</code> ={" "}
        <em>"Space Grotesk", "Segoe UI", sans-serif</em>.
      </p>

      <div
        className="surface"
        style={{ borderRadius: "var(--radius-lg, 20px)", overflow: "hidden" }}
      >
        {TYPE_SCALE.map((specimen, i) => {
          const Tag = specimen.element as keyof JSX.IntrinsicElements;
          return (
            <div
              key={specimen.label}
              style={{
                padding: "1rem 1.25rem",
                borderBottom:
                  i < TYPE_SCALE.length - 1 ? "1px solid var(--line)" : undefined,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "1rem",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                  {/* Render the specimen using the correct element */}
                  <Tag
                    className={specimen.className}
                    style={{
                      margin: 0,
                      // Prevent h1/h2 etc. from towering too tall
                      fontSize: specimen.element === "h1" ? "clamp(1.4rem, 3vw, 2rem)" : undefined,
                    }}
                  >
                    {specimen.sampleText}
                  </Tag>
                </div>
                <div style={{ flexShrink: 0, maxWidth: 280 }}>
                  <p className="eyebrow" style={{ marginBottom: "0.2rem" }}>
                    {specimen.label}
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.8rem",
                      color: "var(--muted)",
                      lineHeight: 1.5,
                    }}
                  >
                    {specimen.notes}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Spacing / tokens reference table
// ---------------------------------------------------------------------------

function SpacingReference() {
  return (
    <section aria-labelledby="spacing-heading" style={{ marginBottom: "2.5rem" }}>
      <h2 id="spacing-heading" style={{ marginBottom: "0.25rem" }}>
        Spacing & Radius Tokens
      </h2>
      <p style={{ color: "var(--muted)", marginTop: 0, marginBottom: "1.25rem" }}>
        Structural tokens shared across all themes.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}
          aria-label="Spacing and radius tokens"
        >
          <thead>
            <tr>
              {["Token", "Value", "Usage"].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    padding: "0.5rem 0.75rem",
                    borderBottom: "2px solid var(--line)",
                    color: "var(--muted)",
                    fontWeight: 600,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SPACING_TOKENS.map((t, i) => (
              <tr
                key={t.token}
                style={{
                  background: i % 2 === 0 ? "transparent" : "var(--surface-soft)",
                }}
              >
                <td style={{ padding: "0.5rem 0.75rem", fontFamily: "monospace", color: "var(--accent)" }}>
                  {t.token}
                </td>
                <td style={{ padding: "0.5rem 0.75rem", fontFamily: "monospace" }}>
                  {t.value}
                </td>
                <td style={{ padding: "0.5rem 0.75rem", color: "var(--muted)" }}>{t.usage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// CSS utilities reference
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<UtilityClass["category"], string> = {
  button: "Buttons",
  layout: "Layout",
  typography: "Typography",
  link: "Links",
  state: "State / Misc",
};

function UtilityClassesReference() {
  const categories = (Object.keys(CATEGORY_LABELS) as UtilityClass["category"][]);

  return (
    <section aria-labelledby="utilities-heading" style={{ marginBottom: "2.5rem" }}>
      <h2 id="utilities-heading" style={{ marginBottom: "0.25rem" }}>
        CSS Utility Classes
      </h2>
      <p style={{ color: "var(--muted)", marginTop: 0, marginBottom: "1.25rem" }}>
        Reusable classes defined in{" "}
        <code style={{ fontFamily: "monospace" }}>src/index.css</code>. Use these instead of
        custom styles.
      </p>

      {categories.map((cat) => {
        const items = UTILITY_CLASSES.filter((u) => u.category === cat);
        return (
          <div key={cat} style={{ marginBottom: "1.25rem" }}>
            <p className="eyebrow" style={{ marginBottom: "0.6rem" }}>
              {CATEGORY_LABELS[cat]}
            </p>
            <div
              className="surface"
              style={{ borderRadius: "var(--radius-lg, 20px)", overflow: "hidden" }}
            >
              {items.map((u, i) => (
                <div
                  key={u.name}
                  style={{
                    display: "flex",
                    gap: "1rem",
                    padding: "0.65rem 1.1rem",
                    borderBottom:
                      i < items.length - 1 ? "1px solid var(--line)" : undefined,
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                  }}
                >
                  <code
                    style={{
                      fontFamily: "monospace",
                      fontSize: "0.82rem",
                      color: "var(--accent)",
                      flexShrink: 0,
                      minWidth: 180,
                    }}
                  >
                    {u.name}
                  </code>
                  <span style={{ color: "var(--muted)", fontSize: "0.875rem", lineHeight: 1.5 }}>
                    {u.description}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page tabs
// ---------------------------------------------------------------------------

type TabId = "components" | "colours" | "typography" | "tokens" | "utilities";

interface Tab {
  id: TabId;
  label: string;
}

const TABS: Tab[] = [
  { id: "components", label: "Components" },
  { id: "colours", label: "Colours" },
  { id: "typography", label: "Typography" },
  { id: "tokens", label: "Tokens" },
  { id: "utilities", label: "Utilities" },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/**
 * DesignSystemDocs
 *
 * Internal page at `/design-system/docs`. Provides:
 *   - Tabbed navigation: Components | Colours | Typography | Tokens | Utilities
 *   - Filterable component catalogue with live examples, props table, usage
 *     snippets, and design-token chips.
 *   - Full colour-token palette with swatches.
 *   - Typography scale specimens.
 *   - Spacing / radius token reference table.
 *   - CSS utility class catalogue.
 */
export default function DesignSystemDocs(): JSX.Element {
  useDocumentTitle(
    "Design System – Callora",
    "Internal design-system documentation listing all UI components with live examples, props, and design tokens.",
  );

  const tabsId = useId();

  // ── State ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>("components");
  const [searchQuery, setSearchQuery] = useState("");
  const [openIds, setOpenIds] = useState<Set<string>>(new Set([COMPONENT_DOCS[0].id]));

  // ── Derived ──────────────────────────────────────────────────────────────
  const filteredDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return COMPONENT_DOCS;
    return COMPONENT_DOCS.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.tokens.some((t) => t.toLowerCase().includes(q)),
    );
  }, [searchQuery]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => setOpenIds(new Set(COMPONENT_DOCS.map((d) => d.id)));
  const collapseAll = () => setOpenIds(new Set());

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.currentTarget.value;
    setSearchQuery(value);
    // Auto-expand all when searching so results are visible
    if (value.trim()) {
      setOpenIds(new Set(COMPONENT_DOCS.map((d) => d.id)));
    }
  };

  const clearSearch = () => setSearchQuery("");

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "2rem 1rem" }}>
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <header style={{ marginBottom: "2rem" }}>
        <p className="eyebrow">Internal reference</p>
        <h1 style={{ margin: "0.25rem 0 0.5rem" }}>Design System</h1>
        <p style={{ marginTop: 0, color: "var(--muted)", maxWidth: 600, lineHeight: 1.6 }}>
          Per-component documentation with live examples, design tokens, and prop definitions.
          All components adhere to <strong>WCAG 2.1 AA</strong> and use dark-mode-consistent
          design tokens.
        </p>
      </header>

      {/* ── Tabbed navigation ────────────────────────────────────────────── */}
      <div
        role="tablist"
        aria-label="Design system sections"
        id={tabsId}
        style={{
          display: "flex",
          gap: "0.25rem",
          borderBottom: "2px solid var(--line)",
          marginBottom: "2rem",
          overflowX: "auto",
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            type="button"
            id={`tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "0.6rem 1rem",
              border: "none",
              borderBottom: activeTab === tab.id ? "2px solid var(--accent)" : "2px solid transparent",
              background: "transparent",
              cursor: "pointer",
              fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? "var(--accent)" : "var(--muted)",
              marginBottom: -2,
              whiteSpace: "nowrap",
              transition: "color 200ms, border-color 200ms",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Components tab ─────────────────────────────────────────────────── */}
      <div
        id="panel-components"
        role="tabpanel"
        aria-labelledby="tab-components"
        hidden={activeTab !== "components"}
      >
        {/* Search + bulk controls */}
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: "1.25rem",
          }}
        >
          {/* Search input */}
          <div
            role="search"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              flex: "1 1 240px",
              padding: "0.45rem 0.75rem",
              borderRadius: "var(--radius-md, 16px)",
              background: "var(--surface-soft)",
              border: "1px solid var(--line)",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
              style={{ flexShrink: 0, color: "var(--muted)" }}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="search"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search components…"
              aria-label="Filter components"
              style={{
                border: "none",
                outline: "none",
                background: "transparent",
                color: "var(--text)",
                width: "100%",
                fontSize: "0.875rem",
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Clear search"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--muted)",
                  padding: 0,
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Bulk toggle buttons */}
          <button
            type="button"
            className="secondary-button"
            onClick={expandAll}
            style={{ flexShrink: 0 }}
          >
            Expand all
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={collapseAll}
            style={{ flexShrink: 0 }}
          >
            Collapse all
          </button>
        </div>

        {/* Live-region for search result count */}
        <p
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {searchQuery
            ? `${filteredDocs.length} component${filteredDocs.length !== 1 ? "s" : ""} found`
            : ""}
        </p>

        {/* Component list */}
        <main id="main-content" aria-label="Component documentation">
          {filteredDocs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--muted)" }}>
              <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🔍</p>
              <p>No components match "{searchQuery}".</p>
              <button
                type="button"
                className="secondary-button"
                onClick={clearSearch}
                style={{ marginTop: "0.75rem" }}
              >
                Clear search
              </button>
            </div>
          ) : (
            filteredDocs.map((doc) => (
              <ComponentSection
                key={doc.id}
                doc={doc}
                isOpen={openIds.has(doc.id)}
                onToggle={() => toggle(doc.id)}
              />
            ))
          )}
        </main>
      </div>

      {/* ── Colours tab ───────────────────────────────────────────────────── */}
      <div
        id="panel-colours"
        role="tabpanel"
        aria-labelledby="tab-colours"
        hidden={activeTab !== "colours"}
      >
        <ColourPalette />
      </div>

      {/* ── Typography tab ────────────────────────────────────────────────── */}
      <div
        id="panel-typography"
        role="tabpanel"
        aria-labelledby="tab-typography"
        hidden={activeTab !== "typography"}
      >
        <TypographyScale />
      </div>

      {/* ── Tokens tab ────────────────────────────────────────────────────── */}
      <div
        id="panel-tokens"
        role="tabpanel"
        aria-labelledby="tab-tokens"
        hidden={activeTab !== "tokens"}
      >
        <SpacingReference />
      </div>

      {/* ── Utilities tab ─────────────────────────────────────────────────── */}
      <div
        id="panel-utilities"
        role="tabpanel"
        aria-labelledby="tab-utilities"
        hidden={activeTab !== "utilities"}
      >
        <UtilityClassesReference />
      </div>
    </div>
  );
}
