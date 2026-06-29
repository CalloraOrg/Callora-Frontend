/**
 * DesignSystemDocs – internal /design-system/docs page.
 *
 * Lists every documented UI component with a live example, usage notes, and
 * the design tokens it consumes. Intended for contributors and designers so
 * the entire component library is discoverable in one place.
 */

import { useState } from "react";
import useDocumentTitle from "../hooks/useDocumentTitle";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PropDoc {
  name: string;
  type: string;
  description: string;
}

interface ComponentDoc {
  id: string;
  name: string;
  description: string;
  tokens: string[];
  props: PropDoc[];
  /** Inline render of a live example */
  example: () => JSX.Element;
}

// ---------------------------------------------------------------------------
// Component catalogue
// ---------------------------------------------------------------------------

const COMPONENT_DOCS: ComponentDoc[] = [
  {
    id: "button-primary",
    name: "Primary Button",
    description:
      "The main call-to-action button. Uses --theme-primary and should be used sparingly – once per view.",
    tokens: ["--theme-primary", "--radius-md", "--space-3"],
    props: [
      { name: "onClick", type: "() => void", description: "Click handler." },
      { name: "disabled", type: "boolean", description: "Disables interaction and reduces opacity." },
      { name: "children", type: "ReactNode", description: "Button label." },
    ],
    example: () => (
      <button className="primary-button" type="button">
        Approve Transaction
      </button>
    ),
  },
  {
    id: "button-secondary",
    name: "Secondary Button",
    description:
      "Ghost-style button for secondary or cancel actions. Never used as the sole action on a page.",
    tokens: ["--color-border", "--radius-md", "--space-3"],
    props: [
      { name: "onClick", type: "() => void", description: "Click handler." },
      { name: "disabled", type: "boolean", description: "Disables interaction." },
      { name: "children", type: "ReactNode", description: "Button label." },
    ],
    example: () => (
      <button className="secondary-button" type="button">
        Cancel
      </button>
    ),
  },
  {
    id: "surface-card",
    name: "Surface Card",
    description:
      "Elevated container used for dashboard tiles, vault balance cards, and info panels.",
    tokens: ["--color-surface", "--color-surface-raised", "--radius-lg", "--shadow-md"],
    props: [
      { name: "children", type: "ReactNode", description: "Card body content." },
      { name: "className", type: "string", description: "Additional CSS classes." },
    ],
    example: () => (
      <article className="surface" style={{ padding: "1rem", borderRadius: "var(--radius-lg, 8px)" }}>
        <span className="eyebrow">Vault balance</span>
        <strong style={{ display: "block", marginTop: "0.25rem" }}>284.62 USDC</strong>
      </article>
    ),
  },
  {
    id: "eyebrow",
    name: "Eyebrow Label",
    description:
      "Small uppercase label used above headings to establish section context.",
    tokens: ["--color-accent", "--font-size-xs", "--letter-spacing-wide"],
    props: [
      { name: "children", type: "ReactNode", description: "Label text." },
    ],
    example: () => <p className="eyebrow">Core capabilities</p>,
  },
  {
    id: "status-chip",
    name: "Status Chip",
    description:
      "Inline badge that surfaces transaction or system state at a glance.",
    tokens: ["--color-success", "--color-error", "--color-warn", "--radius-full"],
    props: [
      {
        name: "status",
        type: "'input' | 'approving' | 'pending' | 'confirmed' | 'failed'",
        description: "Controls colour and label.",
      },
    ],
    example: () => (
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {(["input", "approving", "pending", "confirmed", "failed"] as const).map(
          (s) => (
            <span key={s} className={`status-chip ${s}`}>
              {s}
            </span>
          ),
        )}
      </div>
    ),
  },
  {
    id: "skip-link",
    name: "Skip Link",
    description:
      "Visually hidden anchor that becomes visible on focus, allowing keyboard users to bypass the navigation and jump straight to main content. Required for WCAG 2.1 AA compliance.",
    tokens: ["--color-surface", "--theme-primary", "--z-skip-link"],
    props: [
      { name: "href", type: "string", description: "Target element id, e.g. #main-content." },
      { name: "children", type: "ReactNode", description: "Link text shown on focus." },
    ],
    example: () => (
      <a
        href="#main-content"
        className="skip-link"
        style={{ position: "static", transform: "none", opacity: 1 }}
      >
        Skip to main content
      </a>
    ),
  },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PropTable({ props }: { props: PropDoc[] }) {
  return (
    <table
      style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}
      aria-label="Component props"
    >
      <thead>
        <tr>
          {["Prop", "Type", "Description"].map((h) => (
            <th
              key={h}
              style={{
                textAlign: "left",
                padding: "0.4rem 0.6rem",
                borderBottom: "1px solid var(--color-border, #334155)",
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {props.map((p) => (
          <tr key={p.name}>
            <td style={{ padding: "0.4rem 0.6rem", fontFamily: "monospace" }}>{p.name}</td>
            <td style={{ padding: "0.4rem 0.6rem", fontFamily: "monospace", color: "var(--color-accent, #1ed6a4)" }}>
              {p.type}
            </td>
            <td style={{ padding: "0.4rem 0.6rem" }}>{p.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TokenList({ tokens }: { tokens: string[] }) {
  return (
    <ul style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", listStyle: "none", padding: 0, margin: 0 }}>
      {tokens.map((t) => (
        <li
          key={t}
          style={{
            background: "var(--color-surface-raised, #1e293b)",
            borderRadius: "var(--radius-sm, 4px)",
            padding: "0.15rem 0.5rem",
            fontFamily: "monospace",
            fontSize: "0.8rem",
          }}
        >
          {t}
        </li>
      ))}
    </ul>
  );
}

interface ComponentSectionProps {
  doc: ComponentDoc;
  isOpen: boolean;
  onToggle: () => void;
}

function ComponentSection({ doc, isOpen, onToggle }: ComponentSectionProps) {
  return (
    <article
      className="surface"
      style={{ marginBottom: "1.5rem", borderRadius: "var(--radius-lg, 8px)", overflow: "hidden" }}
      aria-labelledby={`doc-heading-${doc.id}`}
    >
      {/* Header row – always visible */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`doc-body-${doc.id}`}
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
        }}
      >
        <h2 id={`doc-heading-${doc.id}`} style={{ margin: 0, fontSize: "1.1rem" }}>
          {doc.name}
        </h2>
        <span aria-hidden="true" style={{ fontSize: "0.9rem", opacity: 0.6 }}>
          {isOpen ? "▲ collapse" : "▼ expand"}
        </span>
      </button>

      {/* Collapsible body */}
      {isOpen && (
        <div
          id={`doc-body-${doc.id}`}
          style={{ padding: "0 1.25rem 1.25rem" }}
        >
          <p style={{ marginTop: 0 }}>{doc.description}</p>

          {/* Live example */}
          <section aria-label="Live example" style={{ marginBottom: "1rem" }}>
            <p className="eyebrow" style={{ marginBottom: "0.5rem" }}>
              Live example
            </p>
            <div
              style={{
                padding: "1rem",
                background: "var(--color-surface-raised, #1e293b)",
                borderRadius: "var(--radius-md, 6px)",
              }}
            >
              <doc.example />
            </div>
          </section>

          {/* Design tokens */}
          <section aria-label="Design tokens" style={{ marginBottom: "1rem" }}>
            <p className="eyebrow" style={{ marginBottom: "0.5rem" }}>
              Design tokens
            </p>
            <TokenList tokens={doc.tokens} />
          </section>

          {/* Props table */}
          <section aria-label="Props">
            <p className="eyebrow" style={{ marginBottom: "0.5rem" }}>
              Props
            </p>
            <PropTable props={doc.props} />
          </section>
        </div>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DesignSystemDocs(): JSX.Element {
  useDocumentTitle(
    "Design System – Callora",
    "Internal design-system documentation listing all UI components with live examples, props, and design tokens.",
  );

  const [openIds, setOpenIds] = useState<Set<string>>(
    new Set([COMPONENT_DOCS[0].id]),
  );

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

  const expandAll = () =>
    setOpenIds(new Set(COMPONENT_DOCS.map((d) => d.id)));
  const collapseAll = () => setOpenIds(new Set());

  return (
    <div style={{ maxWidth: "860px", margin: "0 auto", padding: "2rem 1rem" }}>
      {/* Page header */}
      <header style={{ marginBottom: "2rem" }}>
        <p className="eyebrow">Internal reference</p>
        <h1>Design System</h1>
        <p style={{ marginTop: "0.5rem", opacity: 0.75 }}>
          Per-component documentation with live examples, design tokens, and
          prop definitions. All components adhere to WCAG 2.1 AA and use
          dark-mode-consistent design tokens.
        </p>

        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
          <button
            type="button"
            className="secondary-button"
            onClick={expandAll}
          >
            Expand all
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={collapseAll}
          >
            Collapse all
          </button>
        </div>
      </header>

      {/* Component list */}
      <main id="main-content" aria-label="Component documentation">
        {COMPONENT_DOCS.map((doc) => (
          <ComponentSection
            key={doc.id}
            doc={doc}
            isOpen={openIds.has(doc.id)}
            onToggle={() => toggle(doc.id)}
          />
        ))}
      </main>
    </div>
  );
}
