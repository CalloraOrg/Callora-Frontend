import { useState } from 'react';
import { useTheme } from '../ThemeContext';

type EmbedSize = 'small' | 'medium' | 'large';

const SIZES: Record<EmbedSize, { width: number; height: number }> = {
  small: { width: 300, height: 150 },
  medium: { width: 400, height: 200 },
  large: { width: 600, height: 300 },
};

interface EmbedPreviewProps {
  providerName: string;
  stats: {
    totalCalls: number;
    avgLatencyMs: number;
    uptime: number;
  };
  apiId: string;
}

/**
 * EmbedPreview Component
 * Provides an embeddable widget preview with size selector, live preview, and copy-paste snippet.
 * Features:
 * - 3 preset sizes (small, medium, large)
 * - Theme-aware widget preview
 * - Copy-to-clipboard with visual feedback
 * - Full WCAG 2.1 AA accessibility
 */
export default function EmbedPreview({
  providerName,
  stats,
  apiId,
}: EmbedPreviewProps) {
  const { actualTheme } = useTheme();
  const [selectedSize, setSelectedSize] = useState<EmbedSize>('medium');
  const [copied, setCopied] = useState(false);

  const generateSnippet = (
    apiId: string,
    size: EmbedSize,
    theme: 'light' | 'dark'
  ): string => {
    const { width, height } = SIZES[size];
    return `<iframe
  src="https://callora.io/embed/api/${apiId}?theme=${theme}"
  width="${width}"
  height="${height}"
  frameborder="0"
  allow="clipboard-read; clipboard-write"
  title="Callora API Widget — ${apiId}">
</iframe>`;
  };

  const snippet = generateSnippet(apiId, selectedSize, actualTheme);
  const { width, height } = SIZES[selectedSize];

  const handleCopy = async () => {
    try {
      // Try modern clipboard API first
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(snippet);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        // Fallback to older method
        const textarea = document.createElement('textarea');
        textarea.value = snippet;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  return (
    <section className="embed-preview-section">
      {/* Size Selector */}
      <div className="embed-section">
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>
          Widget Size
        </h3>
        <div
          role="group"
          aria-label="Widget size"
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          {(['small', 'medium', 'large'] as EmbedSize[]).map((size) => (
            <button
              key={size}
              onClick={() => setSelectedSize(size)}
              aria-pressed={selectedSize === size}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: selectedSize === size ? 600 : 400,
                color: selectedSize === size ? 'var(--text-main)' : 'var(--muted)',
                background: selectedSize === size ? 'var(--accent)' : 'var(--bg-subtle)',
                border: '1px solid',
                borderColor: selectedSize === size ? 'var(--accent)' : 'var(--border-subtle)',
                borderRadius: 6,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {size.charAt(0).toUpperCase() + size.slice(1)}
              {' '}
              ({SIZES[size].width}×{SIZES[size].height})
            </button>
          ))}
        </div>
      </div>

      {/* Widget Preview */}
      <div className="embed-section">
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>
          Preview
        </h3>
        <div
          style={{
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            overflow: 'hidden',
            background: 'var(--bg-soft)',
          }}
        >
          {/* Browser Chrome Mock */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              background: 'var(--bg-subtle)',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: '#ff5f56',
              }}
            />
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: '#ffbd2e',
              }}
            />
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: '#27c93f',
              }}
            />
          </div>

          {/* Widget Preview Container */}
          <div
            aria-label="Widget preview"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
              minHeight: Math.max(height + 32, 200),
              background: actualTheme === 'dark' ? '#1a1a1a' : '#ffffff',
            }}
          >
            <div
              style={{
                width,
                height,
                padding: 16,
                borderRadius: 8,
                background: actualTheme === 'dark'
                  ? 'linear-gradient(135deg, #2a2a2a, #1f1f1f)'
                  : 'linear-gradient(135deg, #f5f5f5, #efefef)',
                border: `1px solid ${actualTheme === 'dark' ? '#404040' : '#e0e0e0'}`,
                boxShadow:
                  actualTheme === 'dark'
                    ? '0 4px 12px rgba(0, 0, 0, 0.5)'
                    : '0 4px 12px rgba(0, 0, 0, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                color: actualTheme === 'dark' ? '#ffffff' : '#000000',
                overflow: 'hidden',
              }}
            >
              {/* Widget Header */}
              <div>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    marginBottom: 12,
                    color: actualTheme === 'dark' ? '#e0e0e0' : '#202020',
                  }}
                >
                  {providerName}
                </div>

                {/* Widget Stats Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      color: actualTheme === 'dark' ? '#a0a0a0' : '#606060',
                    }}
                  >
                    <div style={{ fontSize: '10px', opacity: 0.7 }}>Calls</div>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        marginTop: 2,
                        color: actualTheme === 'dark' ? '#10b981' : '#047857',
                      }}
                    >
                      {(stats.totalCalls / 1000).toFixed(0)}K
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: actualTheme === 'dark' ? '#a0a0a0' : '#606060',
                    }}
                  >
                    <div style={{ fontSize: '10px', opacity: 0.7 }}>
                      Uptime
                    </div>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        marginTop: 2,
                        color: actualTheme === 'dark' ? '#10b981' : '#047857',
                      }}
                    >
                      {stats.uptime}%
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: actualTheme === 'dark' ? '#a0a0a0' : '#606060',
                    }}
                  >
                    <div style={{ fontSize: '10px', opacity: 0.7 }}>
                      Latency
                    </div>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        marginTop: 2,
                        color: actualTheme === 'dark' ? '#60a5fa' : '#1e40af',
                      }}
                    >
                      {stats.avgLatencyMs}ms
                    </div>
                  </div>
                </div>
              </div>

              {/* Widget Footer Badge */}
              <div
                style={{
                  fontSize: '9px',
                  color: actualTheme === 'dark' ? '#707070' : '#909090',
                  textAlign: 'center',
                }}
              >
                Powered by Callora
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Embed Code Snippet */}
      <div className="embed-section">
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>
          Embed Code
        </h3>
        <div
          style={{
            display: 'grid',
            gap: 12,
          }}
        >
          <textarea
            value={snippet}
            readOnly
            aria-label="Embed code"
            aria-multiline="true"
            style={{
              padding: 12,
              fontSize: 12,
              fontFamily: "var(--font-mono, 'Courier New', monospace)",
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              background: 'var(--bg-subtle)',
              color: 'var(--text-main)',
              minHeight: 100,
              resize: 'vertical',
            }}
          />
          <button
            onClick={handleCopy}
            aria-label="Copy embed snippet"
            style={{
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 600,
              color: copied ? '#10b981' : 'var(--text-main)',
              background: copied ? 'var(--bg-subtle)' : 'var(--accent)',
              border: '1px solid',
              borderColor: copied ? 'var(--border-subtle)' : 'var(--accent)',
              borderRadius: 6,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            {copied ? (
              <>
                <span style={{ fontSize: 14 }}>✓</span>
                Copied!
              </>
            ) : (
              'Copy Snippet'
            )}
          </button>
        </div>
      </div>

      {/* Accessibility Announcement */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          left: '-10000px',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
        }}
      >
        {copied ? 'Embed code copied to clipboard' : ''}
      </div>

      <style>{`
        .embed-preview-section {
          display: grid;
          gap: 32px;
        }

        .embed-section {
          display: flex;
          flex-direction: column;
        }
      `}</style>
    </section>
  );
}
