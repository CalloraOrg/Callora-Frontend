import { useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';
import ApiUsage from './ApiUsage';
import { ServerError } from './components/ServerError';
import NotFound from './components/NotFound';

type DepositStage = 'input' | 'approving' | 'pending' | 'confirmed' | 'failed';
type DemoOutcome = 'confirmed' | 'failed';

type Feature = {
  icon: string;
  title: string;
  description: string;
};

type Step = {
  title: string;
  description: string;
};

const features: Feature[] = [
  {
    icon: "💸",
    title: "Pay-per-call billing",
    description:
      "Micro-payments in USDC mean every API request is billed precisely and transparently.",
  },
  {
    icon: "⛓️",
    title: "On-chain settlement",
    description:
      "Every transaction settles on-chain with verifiable records and near real-time visibility.",
  },
  {
    icon: "🧾",
    title: "No subscriptions",
    description:
      "Skip fixed plans and commitments. Pay only for the API calls your product actually makes.",
  },
  {
    icon: "🧑‍💻",
    title: "Developer-friendly",
    description:
      "Publish APIs quickly, define per-request pricing, and start earning USDC automatically.",
  },
];

const consumerSteps: Step[] = [
  {
    title: "Connect wallet or sign up",
    description: "Create your account and securely link a wallet in minutes.",
  },
  {
    title: "Deposit USDC to vault",
    description: "Fund your usage balance once and keep API requests flowing.",
  },
  {
    title: "Browse and use APIs",
    description: "Discover programmable APIs and integrate them into your app.",
  },
  {
    title: "Pay automatically per call",
    description:
      "Billing happens in real time based on actual usage and price-per-request.",
  },
];

const developerSteps: Step[] = [
  {
    title: "Register as developer",
    description:
      "Set up your publisher profile and prepare your API listing.",
  },
  {
    title: "Publish your API",
    description:
      "Add docs, endpoints, and metadata to make your API easy to adopt.",
  },
  {
    title: "Set pricing per request",
    description:
      "Choose flexible per-call pricing that reflects the value of your service.",
  },
  {
    title: "Earn USDC automatically",
    description:
      "Collect revenue from each successful call with transparent settlement.",
  },
];

const PRESET_AMOUNTS = [10, 50, 100, 500] as const;
const MIN_DEPOSIT = 10;
const NETWORK_FEE = "0.00001 XLM";
const EXPLORER_BASE_URL = "https://stellar.expert/explorer/testnet/tx/";

const APP_ROUTES = {
  landing: "/",
  dashboard: "/dashboard",
  marketplace: "/marketplace",
  apiUsage: "/api-usage",
  billing: "/billing",
  documentation: "/documentation",
  status: "/status",
  serverError: "/500",
} as const;

function formatUsdc(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatUsdShortcut(value: number) {
  return `$${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value)}`;
}

function createMockHash() {
  const seed = `${Date.now().toString(16)}${Math.random()
    .toString(16)
    .slice(2)}`;
  return seed.toUpperCase().padEnd(64, "A").slice(0, 64);
}

function buildExplorerLink(hash: string) {
  return `${EXPLORER_BASE_URL}${hash}`;
}

function getStageLabel(stage: DepositStage, hasValidAmount: boolean) {
  if (stage === "approving") return "Approve in wallet...";
  if (stage === "pending") return "Transaction submitted...";
  if (stage === "confirmed") return "Deposit successful";
  if (stage === "failed") return "Transaction failed";

  return hasValidAmount
    ? "Review transaction preview"
    : "Enter a deposit amount";
}

function LandingPage({
  onStartUsingApis,
  onPublishApi,
}: {
  onStartUsingApis: () => void;
  onPublishApi: () => void;
}) {
  return (
    <div className="lp-shell">
      <header className="lp-section lp-hero" aria-labelledby="hero-title">
        <div>
          <p className="lp-eyebrow">Built for API consumers and publishers</p>
          <h1 id="hero-title">Callora - Programmable API Access</h1>
          <p className="lp-subhead">
            Access and monetize APIs with usage-based billing. Callora combines
            programmable API access with pay-per-call settlement in USDC so
            teams can build faster and charge fairly.
          </p>

          <div className="lp-cta-row">
            <button className="lp-btn lp-btn-primary" onClick={onStartUsingApis}>
              Start Using APIs
            </button>
            <button className="lp-btn lp-btn-secondary" onClick={onPublishApi}>
              Publish Your API
            </button>
          </div>
        </div>

        <div className="lp-visual" aria-hidden="true">
          <p>API Marketplace</p>
          <span>Programmable Access • USDC Per Call • On-chain Settlement</span>
        </div>
      </header>

      <section className="lp-section">
        <p className="lp-eyebrow">Core capabilities</p>
        <h2>Why teams choose Callora</h2>

        <div className="lp-feature-grid">
          {features.map((feature) => (
            <article className="lp-card" key={feature.title}>
              <span>{feature.icon}</span>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-section">
        <p className="lp-eyebrow">How it works</p>
        <h2>A simple flow for both sides of the marketplace</h2>

        <div className="lp-flow-grid">
          <article className="lp-card">
            <h3>For API Consumers</h3>
            <ol>
              {consumerSteps.map((step) => (
                <li key={step.title}>
                  <strong>{step.title}</strong>
                  <p>{step.description}</p>
                </li>
              ))}
            </ol>
          </article>

          <article className="lp-card">
            <h3>For API Developers</h3>
            <ol>
              {developerSteps.map((step) => (
                <li key={step.title}>
                  <strong>{step.title}</strong>
                  <p>{step.description}</p>
                </li>
              ))}
            </ol>
          </article>
        </div>
      </section>

      <section className="lp-section">
        <p className="lp-eyebrow">Use cases & benefits</p>
        <h2>Designed for practical adoption</h2>

        <div className="lp-flow-grid">
          <article className="lp-card">
            <h3>Where Callora shines</h3>
            <ul>
              <li>
                AI workflows that need utility APIs without subscription
                overhead.
              </li>
              <li>
                Data providers monetizing endpoint access with frictionless
                micro-billing.
              </li>
              <li>
                Fintech and web3 apps requiring transparent usage-based costs.
              </li>
            </ul>
          </article>

          <article className="lp-card">
            <h3>Testimonials</h3>
            <p>
              “Callora helped us launch usage-based API monetization in days,
              not months.”
              <span> — Case study placeholder</span>
            </p>
            <p>
              “Our teams can scale integration costs exactly with demand, no
              wasted subscription spend.”
              <span> — Customer quote placeholder</span>
            </p>
          </article>
        </div>
      </section>

      <footer className="lp-section lp-footer">
        <nav aria-label="Footer links">
          <a href="#">About</a>
          <a href="#">Documentation</a>
          <a href="#">Support</a>
          <a href="#">Terms</a>
          <a href="#">Privacy</a>
        </nav>
        <p>© {new Date().getFullYear()} Callora. All rights reserved.</p>
      </footer>
    </div>
  );
}

function ApiUsage() {
  return (
    <section className="surface placeholder-card">
      <p className="eyebrow">API detail</p>
      <h2>User Profile API</h2>
      <p>
        Manage user profiles, authentication, and account information with
        transparent pay-per-call pricing.
      </p>

      <div className="info-row">
        <div className="info-card">
          <h3>Endpoints</h3>
          <p>GET /users, POST /users, PATCH /users/:id</p>
        </div>
        <div className="info-card">
          <h3>Pricing</h3>
          <p>~0.002 USDC per successful call.</p>
        </div>
        <div className="info-card">
          <h3>Status</h3>
          <p>Active and ready for vault-funded usage.</p>
        </div>
      </div>

      <pre>
        <code>{`curl https://api.callora.dev/users \\
  -H "Authorization: Bearer <API_KEY>"`}</code>
      </pre>
    </section>
  );
}

function ServerError({
  onRetry,
  onGoHome,
}: {
  onRetry: () => void;
  onGoHome: () => void;
}) {
  return (
    <section className="surface placeholder-card">
      <p className="eyebrow">Server error</p>
      <h2>Something went wrong.</h2>
      <p>Please retry or return to the dashboard.</p>

      <div className="hero-actions">
        <button className="primary-button" onClick={onRetry}>
          Retry
        </button>
        <button className="secondary-button" onClick={onGoHome}>
          Go home
        </button>
      </div>
    </section>
  );
}

function NotFound({ onGoHome }: { onGoHome: () => void }) {
  return (
    <section className="surface placeholder-card">
      <p className="eyebrow">404</p>
      <h2>Page not found.</h2>
      <p>The page you are looking for does not exist.</p>
      <button className="primary-button" onClick={onGoHome}>
        Go to dashboard
      </button>
    </section>
  );
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [view, setView] = useState<ViewMode>('landing');
  const [tab, setTab] = useState<Tab>('dashboard');
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [vaultBalance, setVaultBalance] = useState(284.62);
  const [walletBalance] = useState(1260.5);
  const [amountInput, setAmountInput] = useState("50");
  const [selectedPreset, setSelectedPreset] = useState<number | "custom">(50);
  const [depositStage, setDepositStage] = useState<DepositStage>("input");
  const [demoOutcome, setDemoOutcome] = useState<DemoOutcome>("confirmed");
  const [txHash, setTxHash] = useState("");
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    "Deposit funds to keep premium calls and AI workflows funded without leaving the dashboard.",
  );
  const [submittedAmount, setSubmittedAmount] = useState<number | null>(null);
  const [submittedStartingBalance, setSubmittedStartingBalance] = useState<
    number | null
  >(null);

  const timersRef = useRef<number[]>([]);

  const parsedAmount = Number(amountInput);
  const hasAmount =
    amountInput.trim().length > 0 && Number.isFinite(parsedAmount);
  const activeAmount = submittedAmount ?? (hasAmount ? parsedAmount : 0);
  const previewCurrentBalance = submittedStartingBalance ?? vaultBalance;
  const projectedBalance = previewCurrentBalance + activeAmount;
  const isBusy = depositStage === "approving" || depositStage === "pending";

  let validationMessage = "";

  if (amountInput.trim().length === 0) {
    validationMessage = "Enter a deposit amount to continue.";
  } else if (!Number.isFinite(parsedAmount)) {
    validationMessage = "Amount must be a valid number.";
  } else if (parsedAmount < MIN_DEPOSIT) {
    validationMessage = `Minimum deposit is ${formatUsdShortcut(MIN_DEPOSIT)}.`;
  } else if (parsedAmount > walletBalance) {
    validationMessage = "Amount exceeds available wallet balance.";
  }

  const hasValidAmount = validationMessage.length === 0;
  const stageLabel = getStageLabel(depositStage, hasValidAmount);
  const balanceDelta = formatUsdc(activeAmount || 0);
  const pendingHashLabel = txHash
    ? `${txHash.slice(0, 10)}...${txHash.slice(-8)}`
    : null;

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer: number) => window.clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    if (location.pathname !== APP_ROUTES.billing && isDepositOpen) {
      setIsDepositOpen(false);
    }
  }, [isDepositOpen, location.pathname]);

  const clearTimers = () => {
    timersRef.current.forEach((timer: number) => window.clearTimeout(timer));
    timersRef.current = [];
  };

  const resetFlow = (nextAmount = amountInput, nextPreset = selectedPreset) => {
    clearTimers();
    setAmountInput(nextAmount);
    setSelectedPreset(nextPreset);
    setDepositStage("input");
    setTxHash("");
    setCopied(false);
    setSubmittedAmount(null);
    setSubmittedStartingBalance(null);
    setStatusMessage(
      "Deposit funds to keep premium calls and AI workflows funded without leaving the dashboard.",
    );
  };

  const openDeposit = () => {
    navigate(APP_ROUTES.billing);
    resetFlow(amountInput, selectedPreset);
    setIsDepositOpen(true);
  };

  const closeDeposit = () => {
    if (isBusy) return;
    setIsDepositOpen(false);
  };

  const handleAmountChange = (
    value: string,
    preset: number | "custom" = "custom",
  ) => {
    if (isBusy) return;

    const sanitized = value.replace(/[^\d.]/g, "");
    resetFlow(sanitized, preset);
  };

  const handlePresetClick = (value: number) => {
    handleAmountChange(String(value), value);
  };

  const handleMax = () => {
    handleAmountChange(walletBalance.toFixed(2), "custom");
  };

  const handleCopyHash = async () => {
    if (!txHash) return;

    try {
      await navigator.clipboard.writeText(txHash);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const handleApproveTransaction = () => {
    if (!hasValidAmount || isBusy) return;

    const approvedAmount = parsedAmount;
    const startingBalance = vaultBalance;
    const nextHash = createMockHash();

    clearTimers();
    setSubmittedAmount(approvedAmount);
    setSubmittedStartingBalance(startingBalance);
    setTxHash(nextHash);
    setCopied(false);
    setDepositStage("approving");
    setStatusMessage("Approve this USDC deposit in your wallet to continue.");

    timersRef.current.push(
      window.setTimeout(() => {
        setDepositStage("pending");
        setStatusMessage(
          "Transaction submitted to Stellar. Waiting for confirmation.",
        );
      }, 1400),
    );

    timersRef.current.push(
      window.setTimeout(() => {
        if (demoOutcome === "confirmed") {
          setDepositStage("confirmed");
          setVaultBalance(Number((startingBalance + approvedAmount).toFixed(2)));
          setStatusMessage(
            `${formatUsdShortcut(
              approvedAmount,
            )} reached the vault. Your balance is updated and ready for API usage.`,
          );
        } else {
          setDepositStage("failed");
          setStatusMessage(
            "The deposit was not confirmed. Review the details, then retry when your wallet is ready.",
          );
        }
      }, 3600),
    );
  };

  const handleRetry = () => {
    if (submittedAmount !== null) {
      setAmountInput(String(submittedAmount));
    }

    setSelectedPreset("custom");
    setDepositStage("input");
    setStatusMessage("Review the transaction details and approve again.");
  };

  const handleDepositAnother = () => {
    resetFlow("50", 50);
  };

  const handleServerRetry = () => {
    window.location.reload();
  };

  return (
    <div className="app-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <header className="topbar">
        <div>
          <p className="eyebrow">Callora Vault</p>
          <h1 className="brand">Secure USDC funding for premium API usage</h1>
        </div>

        <div className="topbar-actions">
          <nav className="nav">
            <NavLink to={APP_ROUTES.dashboard}>Dashboard</NavLink>
            <NavLink to={APP_ROUTES.marketplace}>Marketplace</NavLink>
            <NavLink to={APP_ROUTES.billing}>Billing</NavLink>
          </nav>
          <ThemeToggle />
        </div>
      </header>

      <main className="page">
        <Routes>
          <Route
            path={APP_ROUTES.landing}
            element={
              <LandingPage
                onStartUsingApis={() => navigate(APP_ROUTES.marketplace)}
                onPublishApi={() => navigate(APP_ROUTES.billing)}
              />
            }
          />

          <Route
            path={APP_ROUTES.dashboard}
            element={
              <section className="surface hero-grid">
                <div className="hero-copy">
                  <p className="eyebrow">Vault ready</p>
                  <h2>Fund once, route calls without friction.</h2>
                  <p className="hero-text">
                    Keep your USDC vault topped up for uninterrupted usage.
                    Review every deposit before signing, confirm it on Stellar,
                    and track the status without leaving the app.
                  </p>

                  <div className="hero-actions">
                    <button className="primary-button" onClick={openDeposit}>
                      Deposit USDC
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() => navigate(APP_ROUTES.billing)}
                    >
                      View vault details
                    </button>
                  </div>
                </div>
              </section>
            }
          />
          <Route
            path={APP_ROUTES.marketplace}
            element={
              <section className="surface placeholder-card">
                <p className="eyebrow">Marketplace</p>
                <h2>Discover premium APIs ready for production usage.</h2>
                <p>
                  Compare APIs, review pricing, and route high-priority
                  workloads with confidence. Use the billing tab whenever you
                  need to top up your USDC vault.
                </p>
              </section>
            }
          />

          <Route
            path={APP_ROUTES.billing}
            element={
              <section className="billing-layout">
                <div className="surface billing-panel">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">Deposit USDC to Vault</p>
                      <h2>Review every number before you approve.</h2>
                    </div>
                    <button className="primary-button" onClick={openDeposit}>
                      Open deposit modal
                    </button>
                  </div>

                  <div className="vault-grid">
                    <article className="vault-balance-card">
                      <span>Current vault balance</span>
                      <strong>{formatUsdc(vaultBalance)} USDC</strong>
                      <p>
                        Funds are used for call routing, model execution, and
                        premium features.
                      </p>
                    </article>

                    <article className="vault-balance-card secondary">
                      <span>Wallet available</span>
                      <strong>{formatUsdc(walletBalance)} USDC</strong>
                      <p>
                        Deposits settle on Stellar. Network fee is shown before
                        wallet approval.
                      </p>
                    </article>
                  </div>

                  <div className="info-row">
                    <div className="info-card">
                      <h3>Preset funding options</h3>
                      <p>
                        $10, $50, $100, $500, or any custom amount above the
                        minimum.
                      </p>
                    </div>
                    <div className="info-card">
                      <h3>Status tracking</h3>
                      <p>
                        Approving, pending, confirmed, and failed states are all
                        shown in-context.
                      </p>
                    </div>
                    <div className="info-card">
                      <h3>Explorer visibility</h3>
                      <p>
                        Once submitted, the transaction hash is linkable and
                        copyable from the UI.
                      </p>
                    </div>
                  </div>
                </div>

                <aside className="surface prototype-panel">
                  <p className="eyebrow">Prototype state preview</p>
                  <h3>Review both success and failure flows.</h3>
                  <div className="outcome-toggle">
                    <button
                      className={demoOutcome === "confirmed" ? "active" : ""}
                      onClick={() => setDemoOutcome("confirmed")}
                    >
                      Confirmed path
                    </button>
                    <button
                      className={demoOutcome === "failed" ? "active" : ""}
                      onClick={() => setDemoOutcome("failed")}
                    >
                      Failed path
                    </button>
                  </div>
                  <p className="helper-text">
                    The modal follows the real sequence. Use this toggle to
                    preview the end-state a reviewer should see after wallet
                    approval.
                  </p>
                </aside>
              </section>
            }
          />

          <Route
            path={APP_ROUTES.documentation}
            element={
              <section className="surface placeholder-card">
                <p className="eyebrow">Documentation</p>
                <h2>Everything you need to ship with the Callora vault.</h2>
                <p>
                  Implementation guides, transaction lifecycle notes, and
                  troubleshooting references live here so teams can move from
                  prototype to production quickly.
                </p>
              </section>
            }
          />

          <Route
            path={APP_ROUTES.status}
            element={
              <section className="surface placeholder-card">
                <p className="eyebrow">Status</p>
                <h2>System status updates in one place.</h2>
                <p>
                  All core services are operational. If you are still seeing
                  issues, please contact support and include what action you were
                  trying to complete.
                </p>
              </section>
            }
          />

          <Route
            path="/api-usage"
            element={<ApiUsage />}
          />

          <Route
            path={APP_ROUTES.serverError}
            element={
              <ServerError
                code="500"
                title="Server Error"
                message="Something went wrong. Please try again or contact support."
                primaryAction={{
                  label: "Go Home",
                  onClick: () => navigate(APP_ROUTES.home)
                }}
                secondaryAction={{
                  label: "Retry",
                  onClick: handleServerRetry
                }}
              />
            }
          />

          <Route
            path="*"
            element={<NotFound onGoHome={() => navigate(APP_ROUTES.dashboard)} />}
          />
        </Routes>
      </main>

      <footer className="surface app-footer">
        <div>
          <p className="eyebrow">Callora</p>
          <p className="footer-copy">
            Reliable USDC funding and API operations for modern product teams.
          </p>
        </div>

        <nav className="footer-nav" aria-label="Footer">
          <NavLink to={APP_ROUTES.dashboard}>Dashboard</NavLink>
          <NavLink to={APP_ROUTES.marketplace}>Marketplace</NavLink>
          <NavLink to={APP_ROUTES.billing}>Billing</NavLink>
          <NavLink to={APP_ROUTES.status}>Status</NavLink>
          <NavLink to={APP_ROUTES.documentation}>Documentation</NavLink>
        </nav>
      </footer>

      {isDepositOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={closeDeposit}
        >
          <section
            className="deposit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="deposit-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">Secure vault funding</p>
                <h2 id="deposit-title">Deposit USDC to Vault</h2>
              </div>

              <button
                className="close-button"
                onClick={closeDeposit}
                disabled={isBusy}
              >
                Close
              </button>
            </div>

            <div className="stage-strip" aria-label="Transaction flow status">
              {[
                "input",
                "approving",
                "pending",
                demoOutcome === "confirmed" ? "confirmed" : "failed",
              ].map((item) => {
                const isActive =
                  item === depositStage ||
                  (item === "input" &&
                    depositStage === "input" &&
                    hasValidAmount);

                return (
                  <span
                    key={item}
                    className={`stage-pill ${isActive ? "active" : ""}`}
                  >
                    {item}
                  </span>
                );
              })}
            </div>

            <div className="status-banner">
              <div>
                <strong>{stageLabel}</strong>
                <p>{statusMessage}</p>
              </div>
              <span className={`status-chip ${depositStage}`}>
                {depositStage}
              </span>
            </div>

            <div className="modal-grid">
              <div className="form-panel">
                <div className="balance-row">
                  <article className="balance-tile">
                    <span>Vault balance</span>
                    <strong>{formatUsdc(vaultBalance)} USDC</strong>
                  </article>
                  <article className="balance-tile">
                    <span>Wallet available</span>
                    <strong>{formatUsdc(walletBalance)} USDC</strong>
                  </article>
                </div>

                <label className="field-label" htmlFor="deposit-amount">
                  Amount
                </label>

                <div
                  className={`input-shell ${
                    validationMessage && depositStage === "input"
                      ? "invalid"
                      : ""
                  }`}
                >
                  <input
                    id="deposit-amount"
                    type="text"
                    inputMode="decimal"
                    value={amountInput}
                    onChange={(event) => handleAmountChange(event.target.value)}
                    disabled={isBusy}
                    placeholder="0.00"
                    aria-describedby="deposit-help"
                  />
                  <span>USDC</span>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={handleMax}
                    disabled={isBusy}
                  >
                    Max
                  </button>
                </div>

                <p id="deposit-help" className="helper-text">
                  Minimum deposit is {formatUsdShortcut(MIN_DEPOSIT)}. Custom
                  deposits settle into your vault after wallet approval.
                </p>

                {validationMessage && depositStage === "input" && (
                  <p className="error-text">{validationMessage}</p>
                )}

                <div className="preset-row">
                  {PRESET_AMOUNTS.map((preset) => (
                    <button
                      key={preset}
                      className={selectedPreset === preset ? "active" : ""}
                      onClick={() => handlePresetClick(preset)}
                      disabled={isBusy}
                    >
                      ${preset}
                    </button>
                  ))}
                  <button
                    className={selectedPreset === "custom" ? "active" : ""}
                    onClick={() => setSelectedPreset("custom")}
                    disabled={isBusy}
                  >
                    Custom
                  </button>
                </div>

                <div className="security-note">
                  <strong>What you are approving</strong>
                  <p>
                    Your wallet signs a USDC deposit into the Callora vault. The
                    preview shows the exact vault credit, network fee, and
                    post-deposit balance before submission.
                  </p>
                </div>
              </div>

              <div className="preview-panel">
                <article className="preview-card">
                  <div className="preview-header">
                    <div>
                      <span className="eyebrow">Transaction preview</span>
                      <h3>Review before wallet approval</h3>
                    </div>
                    <span className="preview-highlight">Secure preview</span>
                  </div>

                  <div className="preview-row">
                    <span>Deposit amount</span>
                    <strong>
                      {hasAmount || submittedAmount
                        ? `${balanceDelta} USDC`
                        : "--"}
                    </strong>
                  </div>

                  <div className="preview-row">
                    <span>Current balance</span>
                    <strong>{formatUsdc(previewCurrentBalance)} USDC</strong>
                  </div>

                  <div className="preview-row emphasis">
                    <span>New balance</span>
                    <strong>
                      {hasAmount || submittedAmount
                        ? `${formatUsdc(projectedBalance)} USDC`
                        : "--"}
                    </strong>
                  </div>

                  <div className="preview-row">
                    <span>Network fee</span>
                    <strong>{NETWORK_FEE}</strong>
                  </div>

                  <div className="preview-row total">
                    <span>Total cost</span>
                    <strong>
                      {hasAmount || submittedAmount
                        ? `${balanceDelta} USDC + ${NETWORK_FEE}`
                        : `0.00 USDC + ${NETWORK_FEE}`}
                    </strong>
                  </div>
                </article>

                {(depositStage === "pending" ||
                  depositStage === "confirmed" ||
                  depositStage === "failed") &&
                  txHash && (
                    <article className="hash-card">
                      <div>
                        <span className="eyebrow">Transaction hash</span>
                        <strong>{pendingHashLabel}</strong>
                      </div>

                      <div className="hash-actions">
                        <a
                          href={buildExplorerLink(txHash)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View on Stellar Explorer
                        </a>
                        <button onClick={handleCopyHash}>
                          {copied ? "Copied" : "Copy hash"}
                        </button>
                      </div>
                    </article>
                  )}

                {depositStage === "failed" && (
                  <article className="error-card">
                    <strong>Approval not confirmed</strong>
                    <p>
                      No funds were added to the vault. Retry after confirming
                      the wallet prompt or checking your network status.
                    </p>
                  </article>
                )}

                {depositStage === "confirmed" && (
                  <article className="success-card">
                    <strong>Deposit successful</strong>
                    <p>
                      Your updated vault balance is {formatUsdc(vaultBalance)}{" "}
                      USDC and ready for usage.
                    </p>
                  </article>
                )}
              </div>
            </div>

            <div className="modal-actions">
              {depositStage === "failed" ? (
                <button className="primary-button" onClick={handleRetry}>
                  Retry deposit
                </button>
              ) : depositStage === "confirmed" ? (
                <button
                  className="primary-button"
                  onClick={handleDepositAnother}
                >
                  Deposit another amount
                </button>
              ) : (
                <button
                  className="primary-button"
                  onClick={handleApproveTransaction}
                  disabled={!hasValidAmount || isBusy}
                >
                  {depositStage === "approving"
                    ? "Approve in wallet..."
                    : depositStage === "pending"
                      ? "Transaction submitted..."
                      : "Approve Transaction"}
                </button>
              )}

              <button
                className="secondary-button"
                onClick={closeDeposit}
                disabled={isBusy}
              >
                Cancel
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;