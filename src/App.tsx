import { useEffect, useState, useCallback, useMemo, useRef, lazy, Suspense } from "react";
import { Routes, Route, NavLink, Navigate, useNavigate, useLocation } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";
import RouteErrorBoundary from "./components/RouteErrorBoundary";
import ServerError from "./components/ServerError";
import useDocumentTitle from "./hooks/useDocumentTitle";
import NotFound from "./components/NotFound";
import { startRouteLoading, stopRouteLoading } from "./hooks/useRouteLoading";
import { formatUsdc, formatUsdShortcut, formatUsdcStroops, normalizeUsdcAmountInput, stroopsToUsdcAmount, usdcAmountToStroops, USDC_DECIMALS } from "./utils/format";
import { useNetworkFee, formatStroops, TransactionSummaryDetails } from "./components/DepositPreview";
import { MIN_DEPOSIT, NETWORK_FEE, PRESET_AMOUNTS, TESTNET_DEPLOYMENT, testnetContractUrl, TRANSACTION_TIMEOUT_SECONDS } from "./config/constants";
import { useRuntimeConfig, usdcConfigurationError } from "./config/runtimeConfig";
import { resolveVaultConfig } from "./services/vaultConfig";
import type { WalletServiceErrorCode, UsdcTrustlineStatus, PreparedVaultDeposit } from "./services/walletService";
import { useVaultBalances } from "./hooks/useVaultBalances";
import BalanceReadout from "./components/BalanceReadout";
import LiveRegion from "./components/LiveRegion";
import CompareDrawer from "./components/CompareDrawer";
import CompareTray from "./components/CompareTray";
import ExternalLink from "./components/ExternalLink";
import { useGlobalShortcuts } from "./hooks/useGlobalShortcuts";
import OnboardingTour from "./pages/OnboardingTour";
import { ShortcutsModal } from "./components/ShortcutsModal";
import CommandPalette from "./components/CommandPalette";
import { useSessionExpiry } from "./hooks/useSessionExpiry";
import { useNotifications, NotificationsContext } from "./hooks/useNotifications";
import { isSignedIn } from "./services/authService";
import SessionExpiryBanner from "./components/SessionExpiryBanner";
import WalletStatus from "./components/WalletStatus";
import { useWalletStore } from "./state/walletStore";
import { useToast } from "./components/Toast";

import { APP_ROUTES, PRIMARY_NAV, prefetchRoute } from "./app/routes";
import {
  readPendingDeposit,
  writePendingDeposit,
  clearPendingDeposit,
  STAGE_LABELS,
  buildExplorerLink,
  getStageLabel,
  type PendingDepositRecord,
  type DepositStage,
} from "./app/deposit";
import LandingPage from "./app/LandingPage";
import StatusPage from "./app/StatusPage";
import WalletSignInButton from "./app/WalletSignInButton";
import RequireAuth from "./components/RequireAuth";
import AccountSwitcher from "./app/AccountSwitcher";
import WithdrawModal from "./components/WithdrawModal";
import "./components/DepositPreview.css";

// Re-export public API
export { prefetchRoute } from "./app/routes";
export {
  readPendingDeposit,
  writePendingDeposit,
  clearPendingDeposit,
  type PendingDepositRecord,
} from "./app/deposit";

// Route splitting: dynamic imports for all heavy page routes
const MarketplacePage = lazy(() => import("./pages/MarketplacePage"));
const PublishApi = lazy(() => import("./pages/PublishApi"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const ApiUsage = lazy(() => import("./pages/ApiUsage"));
const MyApis = lazy(() => import("./pages/MyApis"));
const PlanBadgePage = lazy(() => import("./pages/PlanBadge"));
const ThemePlayground = lazy(() => import("./pages/ThemePlayground"));
const SlaCard = lazy(() => import("./pages/SlaCard"));
const Documentation = lazy(() => import("./pages/Documentation"));
const DesignSystemDocs = lazy(() => import("./pages/DesignSystemDocs"));
const A11yAudit = lazy(() => import("./pages/A11yAudit"));
const RateLimitCard = lazy(() => import("./pages/RateLimitCard"));
const BillingHistory = lazy(() => import("./pages/BillingHistory"));
const Subscriptions = lazy(() => import("./pages/Subscriptions"));
const WebhookDeliveries = lazy(() => import("./pages/WebhookDeliveries"));
const EndpointSummary = lazy(() => import("./pages/EndpointSummary"));
const NotificationCenter = lazy(() => import("./pages/NotificationCenter"));
const BillingInvoiceSection = lazy(() => import("./pages/InvoiceCard").then(m => ({ default: m.BillingInvoiceSection })));

type DemoOutcome = "confirmed" | "failed";

type WalletServiceFailure = Error & {
  contractErrorCode?: number;
  code: WalletServiceErrorCode;
  requiresReconciliation: boolean;
};

/** `/rate-limit` no longer exists; limits are per-API. Send users to the Marketplace. */
function LegacyRateLimitRedirect() {
  const { showToast } = useToast();
  const announced = useRef(false);
  useEffect(() => {
    // Guard against StrictMode double effect invocation in development.
    if (announced.current) return;
    announced.current = true;
    showToast("Rate limits are now shown per API. Pick an API to see its limits.");
  }, [showToast]);
  return <Navigate to={APP_ROUTES.marketplace} replace />;
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const wallet = useWalletStore();
  const runtimeConfig = useRuntimeConfig();
  const vaultConfig = resolveVaultConfig({
    network: runtimeConfig.network,
    envContractId: runtimeConfig.vaultContractId,
    testnetDefault: "",
    source: "runtime",
  });
  const issuerConfigurationError = usdcConfigurationError(runtimeConfig);
  const { isExpired: isSessionExpired } = useSessionExpiry();
  const notifications = useNotifications({
    enabled: isSignedIn() && !isSessionExpired,
  });
  const unreadBadgeText =
    notifications.unreadCount > 9 ? "9+" : String(notifications.unreadCount);
  const notificationBellLabel =
    notifications.unreadCount === 0
      ? "Notifications (0 unread)"
      : `Notifications (${unreadBadgeText} unread)`;
  const notificationAnnouncement = notifications.isSignedIn
    ? notifications.unreadCount === 0
      ? "No unread notifications."
      : `${notifications.unreadCount === 1 ? "1 unread notification" : `${unreadBadgeText} unread notifications`}.`
    : "";
  const { showToast } = useToast();
  const routeTitleMap: Record<string, string> = {
    [APP_ROUTES.marketplace]: "Marketplace – Callora",
    [APP_ROUTES.dashboard]: "Dashboard – Callora",
    [APP_ROUTES.myApis]: "My APIs – Callora",
    [APP_ROUTES.billing]: "Billing – Callora",
    [APP_ROUTES.billingHistory]: "Billing History – Callora",
    [APP_ROUTES.subscriptions]: "Subscriptions – Callora",
    "/api-usage": "API Usage – Callora",
    [APP_ROUTES.landing]: "Callora",
    [APP_ROUTES.endpointSummary]: "Endpoint Summary – Callora",
    [APP_ROUTES.notifications]: "Notifications – Callora",
  };
  const routeDescriptionMap: Record<string, string> = {
    [APP_ROUTES.marketplace]: "Explore APIs on the Callora marketplace, discover and integrate APIs for your applications.",
    [APP_ROUTES.dashboard]: "Your Callora dashboard showing balances, recent activity and quick actions.",
    [APP_ROUTES.billing]: "Manage your USDC vault, deposit funds, and view transaction status.",
    [APP_ROUTES.billingHistory]: "View your full USDC transaction history with on-chain details, filters, and hover previews.",
    [APP_ROUTES.subscriptions]: "Manage your API subscriptions, plans, and renewals.",
    "/api-usage": "Monitor API usage, request stats, and view call history.",
    [APP_ROUTES.landing]: "Callora - Programmable API Access, pay-per-call billing, and on-chain settlement.",
    [APP_ROUTES.endpointSummary]: "Quick reference list of all API endpoints on Callora.",
    [APP_ROUTES.notifications]: "View your Callora notifications, usage alerts, billing updates, and campaigns.",
  };
  const currentTitle = routeTitleMap[location.pathname] ?? "Callora";
  const currentDescription = routeDescriptionMap[location.pathname];
  useDocumentTitle(currentTitle, currentDescription);

  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [amountInput, setAmountInput] = useState("50");
  const [selectedPreset, setSelectedPreset] = useState<number | "custom">(50);

  // Handle global shortcuts
  const handleGlobalKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Navigation to My APIs (e.g. g then a)
      if (event.key === "g") {
        const handleNextKey = (e: KeyboardEvent) => {
          if (e.key === "a") {
            navigate(APP_ROUTES.myApis);
          }
        };
        window.addEventListener("keydown", handleNextKey, { once: true });
      }

      // Open shortcuts modal with ?
      if (event.key === "?" || (event.shiftKey && event.key === "/")) {
        event.preventDefault();
        setIsShortcutsModalOpen(true);
        return;
      }

      // Navigation shortcuts (g followed by another key)
      if (event.key === "g") {
        // We'll handle the next key in a separate listener for sequence
        const handleNextKey = (e: KeyboardEvent) => {
          if (e.key === "h") {
            navigate(APP_ROUTES.dashboard);
          } else if (e.key === "m") {
            navigate(APP_ROUTES.marketplace);
          } else if (e.key === "b") {
            navigate(APP_ROUTES.billing);
          }
          window.removeEventListener("keydown", handleNextKey);
        };
        window.addEventListener("keydown", handleNextKey, { once: true });
      }
    },
    [navigate],
  );

  useGlobalShortcuts(handleGlobalKeyDown);

  useEffect(() => {
    const handleCommandPaletteKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleCommandPaletteKeyDown);
    return () => {
      window.removeEventListener("keydown", handleCommandPaletteKeyDown);
    };
  }, []);
  const [depositStage, setDepositStage] = useState<DepositStage>("input");
  const [demoOutcome, setDemoOutcome] = useState<DemoOutcome>("confirmed");
  const [walletAvailability, setWalletAvailability] = useState<"checking" | "available" | "missing">("checking");
  const [trustlineStatus, setTrustlineStatus] = useState<UsdcTrustlineStatus | "checking" | "connect" | "error">("checking");
  const [trustlineMessage, setTrustlineMessage] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [isAddingTrustline, setIsAddingTrustline] = useState(false);
  const [trustlineCheckVersion, setTrustlineCheckVersion] = useState(0);
  const [vaultPreflight, setVaultPreflight] = useState<{ status: "idle" | "checking" | "ready" | "blocked" | "unverified"; message: string }>({ status: "idle", message: "" });
  const [depositContractErrorCode, setDepositContractErrorCode] = useState<number | null>(null);
  const [depositFailureCode, setDepositFailureCode] = useState<WalletServiceErrorCode | null>(null);
  const [depositRequiresReconciliation, setDepositRequiresReconciliation] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Deposit funds to keep premium calls and AI workflows funded without leaving the dashboard.");
  const [submittedAmount, setSubmittedAmount] = useState<number | null>(null);
  const [submittedStartingBalance, setSubmittedStartingBalance] = useState<bigint | null>(null);
  const [pendingDeposit, setPendingDeposit] = useState<PendingDepositRecord | null>(() => readPendingDeposit());
  const [isCheckingDepositStatus, setIsCheckingDepositStatus] = useState(false);
  const [checkDepositStatusMessage, setCheckDepositStatusMessage] = useState("");
  const [validityTimeRemaining, setValidityTimeRemaining] = useState<number | null>(null);
  const [amountHint, setAmountHint] = useState<string | null>(null);
  const [preparedDeposit, setPreparedDeposit] = useState<PreparedVaultDeposit | null>(null);
  const [isPreparingDeposit, setIsPreparingDeposit] = useState(false);

  const {
    vault: vaultStroops,
    wallet: walletStroops,
    status: balancesStatus,
    error: balancesError,
    configured: vaultConfigured,
    refresh: refreshBalances,
    revision: balancesRevision,
  } = useVaultBalances({ address: walletAddress || undefined });

  // Shown between a confirmed deposit and the chain re-read; never a
  // fabricated balance. It is the vault's real pre-deposit value plus the
  // amount just deposited, cleared as soon as the refresh reports back.
  const [optimisticVault, setOptimisticVault] = useState<bigint | null>(null);
  const optimisticRevisionRef = useRef(0);
  const balancesRevisionRef = useRef(balancesRevision);
  useEffect(() => {
    balancesRevisionRef.current = balancesRevision;
  }, [balancesRevision]);
  useEffect(() => {
    if (optimisticVault === null) return;
    if (
      balancesRevision > optimisticRevisionRef.current ||
      balancesStatus === "error"
    ) {
      setOptimisticVault(null);
    }
  }, [balancesRevision, balancesStatus, optimisticVault]);

  const shownVaultStroops = optimisticVault ?? vaultStroops;
  const vaultText =
    shownVaultStroops === null ? null : formatUsdcStroops(shownVaultStroops);
  const walletText =
    walletStroops === null ? null : formatUsdcStroops(walletStroops);
  const vaultPending = optimisticVault !== null;
  const vaultNumber =
    shownVaultStroops === null ? null : Number(shownVaultStroops) / 1e7;
  const walletNumber =
    walletStroops === null ? null : Number(walletStroops) / 1e7;

  const balanceAnnouncement = useMemo(() => {
    if (!vaultConfigured) {
      return "Vault contract is not configured, so on-chain balances are unavailable.";
    }
    if (balancesStatus === "error") {
      return `Could not load on-chain balances. ${balancesError ?? ""}`.trim();
    }
    if (balancesStatus !== "ready") return "";
    const parts = [
      vaultText === null
        ? "Vault balance is unavailable."
        : `Vault balance ${vaultText} USDC.`,
    ];
    parts.push(
      walletText === null
        ? "Connect a Stellar wallet to see the wallet balance."
        : `Wallet balance ${walletText} USDC.`,
    );
    if (vaultPending) parts.push("Vault balance pending refresh.");
    return parts.join(" ");
  }, [
    vaultConfigured,
    balancesStatus,
    balancesError,
    vaultText,
    walletText,
    vaultPending,
  ]);

  const parsedAmount = Number(amountInput);
  const hasAmount = amountInput.trim().length > 0 && Number.isFinite(parsedAmount);
  const amountStroops =
    usdcAmountToStroops(submittedAmount !== null ? String(submittedAmount) : amountInput);
  const previewVaultStroops = submittedStartingBalance ?? shownVaultStroops;
  const projectedVaultStroops =
    previewVaultStroops === null || amountStroops === null
      ? null
      : previewVaultStroops + amountStroops;
  const isBusy = isAddingTrustline || isPreparingDeposit || depositStage === "approving" || depositStage === "pending";
  const hasUnconfirmedDeposit = depositRequiresReconciliation;
  const { networkFee, isEstimated: isNetworkFeeEstimated } = useNetworkFee(NETWORK_FEE, isDepositOpen && !preparedDeposit);
  const assembledNetworkFee = preparedDeposit ? formatStroops(preparedDeposit.summary.feeStroops) : null;
  const displayedNetworkFee = assembledNetworkFee ?? networkFee;
  const displayedNetworkFeeEstimated = assembledNetworkFee ? false : isNetworkFeeEstimated;
  const balanceDelta = formatUsdc(submittedAmount ?? (hasAmount ? parsedAmount : 0));

  let validationMessage = "";

  if (amountInput.trim().length === 0) {
    validationMessage = "Enter a deposit amount to continue.";
  } else if (!Number.isFinite(parsedAmount)) {
    validationMessage = "Amount must be a valid number.";
  } else if (parsedAmount < MIN_DEPOSIT) {
    validationMessage = `Minimum deposit is ${formatUsdShortcut(MIN_DEPOSIT)}.`;
  } else if (
    walletStroops !== null &&
    amountStroops !== null &&
    amountStroops > walletStroops
  ) {
    validationMessage = "Amount exceeds available wallet balance.";
  }

  const hasValidAmount = validationMessage.length === 0;
  const stageLabel = getStageLabel(depositStage, hasValidAmount);
  const vaultBlockReason = vaultConfig.error ?? (vaultPreflight.status === "blocked" ? vaultPreflight.message : null);
  const pendingHashLabel = txHash ? `${txHash.slice(0, 10)}...${txHash.slice(-8)}` : null;

  useEffect(() => {
    if (!isDepositOpen) return;

    let isCurrent = true;
    setWalletAvailability("checking");
    setTrustlineStatus("checking");
    setTrustlineMessage("");
    setVaultPreflight({ status: "idle", message: "" });
    import("./services/walletService")
      .then(async ({ isWalletAvailable, getWalletAddress, hasUsdcTrustline, preflightVaultDeposit }) => {
        const available = await isWalletAvailable();
        if (!isCurrent) return;
        setWalletAvailability(available ? "available" : "missing");
        if (!available) return;
        if (issuerConfigurationError) throw new Error(issuerConfigurationError);
        const address = await getWalletAddress(runtimeConfig);
        if (!isCurrent) return;
        setWalletAddress(address);
        if (!vaultConfig.error) {
          setVaultPreflight({ status: "checking", message: "" });
          preflightVaultDeposit(address, runtimeConfig)
            .then((result) => {
              if (!isCurrent) return;
              if (result.paused) {
                setVaultPreflight({ status: "blocked", message: "Deposits are paused on this vault right now." });
              } else if (!result.allowlisted) {
                setVaultPreflight({ status: "blocked", message: "This wallet is not on the vault's deposit allowlist." });
              } else {
                setVaultPreflight({ status: "ready", message: "" });
              }
            })
            .catch(() => {
              if (isCurrent) setVaultPreflight({ status: "unverified", message: "Could not verify vault status. You can still try the deposit." });
            });
        }
        const status = await hasUsdcTrustline(address, runtimeConfig);
        if (isCurrent) setTrustlineStatus(status);
      })
      .catch((error) => {
        if (!isCurrent) return;
        setTrustlineStatus(error.code === "SIGNATURE_REJECTED" ? "connect" : "error");
        setTrustlineMessage(error.code === "SIGNATURE_REJECTED" ? "Wallet connection cancelled. Connect Freighter when you are ready." : error.message);
      });

    return () => {
      isCurrent = false;
    };
  }, [isDepositOpen, trustlineCheckVersion, runtimeConfig, vaultConfig.error, issuerConfigurationError]);

  useEffect(() => {
    if (location.pathname !== APP_ROUTES.billing && isDepositOpen) {
      setIsDepositOpen(false);
    }
  }, [isDepositOpen, location.pathname]);

  useEffect(() => {
    startRouteLoading();
    const timer = setTimeout(() => stopRouteLoading(), 400);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  const resetFlow = (nextAmount = amountInput, nextPreset = selectedPreset) => {
    setAmountInput(nextAmount);
    setSelectedPreset(nextPreset);
    setDepositStage("input");
    setTxHash("");
    setCopied(false);
    setSubmittedAmount(null);
    setSubmittedStartingBalance(null);
    setDepositFailureCode(null);
    setDepositRequiresReconciliation(false);
    setAmountHint(null);
    setPreparedDeposit(null);
    setIsPreparingDeposit(false);
    setStatusMessage("Deposit funds to keep premium calls and AI workflows funded without leaving the dashboard.");
  };

  const openDeposit = (presetAmount?: number) => {
    navigate(APP_ROUTES.billing);
    const storedPending = readPendingDeposit();
    if (storedPending) {
      setPendingDeposit(storedPending);
      setTxHash(storedPending.hash);
      setSubmittedAmount(storedPending.amount);
      setAmountInput(String(storedPending.amount));
      setDepositRequiresReconciliation(true);
      setDepositStage("failed");
      setStatusMessage("You have an unconfirmed deposit. Check transaction status before retrying.");
      handleCheckDepositStatus();
    } else {
      const nextAmount = presetAmount !== undefined ? String(presetAmount) : amountInput;
      const nextPreset: number | "custom" = presetAmount !== undefined ? presetAmount : selectedPreset;
      if (!hasUnconfirmedDeposit) resetFlow(nextAmount, nextPreset);
    }
    setIsDepositOpen(true);
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (location.pathname === APP_ROUTES.billing && params.get("deposit") === "true") {
      if (!isDepositOpen) {
        openDeposit();
      }
    }
  }, [location.pathname, location.search, isDepositOpen]);

  const closeDeposit = () => {
    if (isBusy) return;
    setIsDepositOpen(false);
    setPreparedDeposit(null);
    setIsPreparingDeposit(false);

    // Clean up url parameter if it exists
    const url = new URL(window.location.href);
    if (url.searchParams.has("deposit")) {
      url.searchParams.delete("deposit");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  };

  const handleAmountChange = (value: string, preset: number | "custom" = "custom") => {
    if (isBusy || hasUnconfirmedDeposit) return;

    const { value: normalized, truncated } = normalizeUsdcAmountInput(value);
    resetFlow(normalized, preset);
    setAmountHint(
      truncated
        ? `USDC on Stellar supports ${USDC_DECIMALS} decimal places, so the amount was rounded down to ${normalized}.`
        : null,
    );
  };

  const handlePresetClick = (value: number) => {
    handleAmountChange(String(value), value);
  };

  const handleMax = () => {
    if (walletStroops === null) return;
    handleAmountChange(stroopsToUsdcAmount(walletStroops), "custom");
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

  const handlePrepareDeposit = async () => {
    if (!hasValidAmount || isBusy || hasUnconfirmedDeposit || walletAvailability !== "available" || (trustlineStatus !== "present" && trustlineStatus !== "unknown")) return;

    const depositConfig = runtimeConfig;
    setTxHash("");
    setCopied(false);
    setDepositFailureCode(null);
    setDepositRequiresReconciliation(false);
    setPreparedDeposit(null);
    setIsPreparingDeposit(true);
    setStatusMessage("Preparing and verifying your Soroban deposit transaction...");

    let isWalletServiceError:
      | ((error: unknown) => error is WalletServiceFailure)
      | undefined;

    try {
      const walletService = await import("./services/walletService");
      isWalletServiceError = (error): error is WalletServiceFailure =>
        error instanceof walletService.WalletServiceError;

      const prepared = await walletService.prepareVaultDeposit(amountInput, depositConfig);
      setPreparedDeposit(prepared);
      setStatusMessage("Review the decoded Soroban transaction below, then confirm to sign in Freighter.");
    } catch (error) {
      const walletError = isWalletServiceError?.(error) ? error : null;
      const failureCode = walletError?.code ?? "NETWORK_ERROR";
      if (failureCode === "TRUSTLINE_MISSING" || failureCode === "UNFUNDED_ACCOUNT") {
        setTrustlineStatus(failureCode === "TRUSTLINE_MISSING" ? "missing" : "unfunded-account");
        setTrustlineCheckVersion((version) => version + 1);
        setDepositStage("input");
        setSubmittedAmount(null);
        setSubmittedStartingBalance(null);
        setStatusMessage("Complete the wallet setup below before depositing.");
        return;
      }
      setDepositFailureCode(failureCode);
      setDepositContractErrorCode(walletError?.contractErrorCode ?? null);
      setDepositRequiresReconciliation(false);
      setDepositStage("failed");
      setStatusMessage(
        walletError
          ? walletError.message
          : "Could not prepare the deposit. Check your wallet and Stellar network, then try again.",
      );
    } finally {
      setIsPreparingDeposit(false);
    }
  };

  const handleConfirmSign = async () => {
    if (!preparedDeposit || isBusy || hasUnconfirmedDeposit) return;

    const depositConfig = preparedDeposit.config;
    const approvedAmount = parsedAmount;
    const startingBalance = shownVaultStroops;
    setSubmittedAmount(approvedAmount);
    setSubmittedStartingBalance(startingBalance);
    setTxHash("");
    setCopied(false);
    setDepositFailureCode(null);
    setDepositRequiresReconciliation(false);
    setDepositStage("approving");
    setStatusMessage("Approve this USDC deposit in your wallet to continue.");

    let isWalletServiceError:
      | ((error: unknown) => error is WalletServiceFailure)
      | undefined;

    let capturedHash = "";
    try {
      const walletService = await import("./services/walletService");
      isWalletServiceError = (error): error is WalletServiceFailure =>
        error instanceof walletService.WalletServiceError;

      const submittedDeposit = await walletService.signAndSubmit(preparedDeposit, (hash) => {
        capturedHash = hash;
        setTxHash(hash);
        setDepositStage("pending");
        setStatusMessage("Transaction submitted to Stellar. Waiting for ledger confirmation.");
      });

      const confirmedHash = submittedDeposit.hash || capturedHash;
      clearPendingDeposit();
      setPendingDeposit(null);
      setPreparedDeposit(null);
      setTxHash(confirmedHash);
      // Optimistic value until the re-read lands; the revision guard clears it.
      const approvedStroops = usdcAmountToStroops(amountInput);
      if (startingBalance !== null && approvedStroops !== null) {
        optimisticRevisionRef.current = balancesRevisionRef.current;
        setOptimisticVault(startingBalance + approvedStroops);
      }
      setDepositStage("confirmed");
      setStatusMessage(`${formatUsdShortcut(approvedAmount)} reached the vault. Your balance is updated and ready for API usage.`);
      void refreshBalances();
    } catch (error) {
      const walletError = isWalletServiceError?.(error) ? error : null;
      const failureCode = walletError?.code ?? "NETWORK_ERROR";
      setPreparedDeposit(null);
      if (failureCode === "TRUSTLINE_MISSING" || failureCode === "UNFUNDED_ACCOUNT") {
        setTrustlineStatus(failureCode === "TRUSTLINE_MISSING" ? "missing" : "unfunded-account");
        setTrustlineCheckVersion((version) => version + 1);
        setDepositStage("input");
        setSubmittedAmount(null);
        setSubmittedStartingBalance(null);
        setStatusMessage("Complete the wallet setup below before depositing.");
        return;
      }
      setDepositFailureCode(failureCode);
      setDepositContractErrorCode(walletError?.contractErrorCode ?? null);
      const reqReconciliation = walletError?.requiresReconciliation ?? false;
      setDepositRequiresReconciliation(reqReconciliation);
      const finalHash = capturedHash || txHash;
      if (reqReconciliation && finalHash) {
        const record: PendingDepositRecord = {
          hash: finalHash,
          amount: approvedAmount,
          submittedAt: Date.now(),
          network: depositConfig.network,
          contractId: depositConfig.vaultContractId,
          rpcUrl: depositConfig.rpcUrl,
        };
        writePendingDeposit(record);
        setPendingDeposit(record);
        setTxHash(finalHash);
      }
      setDepositStage("failed");
      setStatusMessage(
        walletError
          ? walletError.message
          : "Could not submit the deposit. Check your wallet and Stellar network, then try again.",
      );
    }
  };

  const handleAddTrustline = async () => {
    if (isBusy || trustlineStatus !== "missing") return;
    setIsAddingTrustline(true);
    setTrustlineMessage("Approve the USDC trustline in Freighter. Waiting for Stellar confirmation.");
    try {
      const { addUsdcTrustline } = await import("./services/walletService");
      const result = await addUsdcTrustline(runtimeConfig);
      if (result === "cancelled") {
        setTrustlineMessage("Trustline signature cancelled. You can add the USDC trustline when you are ready.");
      } else {
        // Reconnect and recheck in case the selected wallet changed while signing.
        setTrustlineCheckVersion((version) => version + 1);
      }
    } catch (error) {
      const failure = error as WalletServiceFailure;
      if (failure.code === "UNFUNDED_ACCOUNT") setTrustlineCheckVersion((version) => version + 1);
      setTrustlineMessage(failure.message || "Could not add the USDC trustline. Check your wallet and try again.");
    } finally {
      setIsAddingTrustline(false);
    }
  };

  const handleRetry = () => {
    if (hasUnconfirmedDeposit) return;
    if (submittedAmount !== null) {
      setAmountInput(String(submittedAmount));
    }

    setSelectedPreset("custom");
    setDepositStage("input");
    setTxHash("");
    setCopied(false);
    setDepositFailureCode(null);
    setDepositRequiresReconciliation(false);
    setPreparedDeposit(null);
    setIsPreparingDeposit(false);
    setStatusMessage("Review the transaction details and approve again.");
  };

  const handleCheckDepositStatus = async () => {
    const record = pendingDeposit ?? readPendingDeposit();
    const hashToCheck = record?.hash || txHash;
    if (!hashToCheck || isCheckingDepositStatus) return;

    setIsCheckingDepositStatus(true);
    setCheckDepositStatusMessage("Checking transaction status...");
    try {
      const { checkDepositStatus } = await import("./services/walletService");
      const statusConfig = record
        ? {
            ...runtimeConfig,
            network: record.network,
            vaultContractId: record.contractId,
            rpcUrl: record.rpcUrl ?? runtimeConfig.rpcUrl,
          }
        : runtimeConfig;
      const status = await checkDepositStatus(hashToCheck, statusConfig);

      if (status === "SUCCESS") {
        clearPendingDeposit();
        setPendingDeposit(null);
        setDepositRequiresReconciliation(false);
        setValidityTimeRemaining(null);
        setDepositStage("confirmed");
        const msg = "Deposit confirmed on Stellar! Your vault balance has been updated.";
        setStatusMessage(msg);
        setCheckDepositStatusMessage(msg);
        // Plain re-read from chain. No optimistic add here: this path often
        // runs after a page reload, where the chain read may already include
        // the deposit, so adding the amount again would double count.
        void refreshBalances();
      } else if (status === "FAILED") {
        clearPendingDeposit();
        setPendingDeposit(null);
        setDepositRequiresReconciliation(false);
        setValidityTimeRemaining(null);
        setDepositStage("failed");
        const msg = "Transaction failed on Stellar. You may retry your deposit.";
        setStatusMessage(msg);
        setCheckDepositStatusMessage(msg);
      } else if (status === "NOT_FOUND") {
        const submittedAt = record?.submittedAt ?? Date.now();
        const elapsedSeconds = (Date.now() - submittedAt) / 1000;
        if (elapsedSeconds > TRANSACTION_TIMEOUT_SECONDS) {
          clearPendingDeposit();
          setPendingDeposit(null);
          setDepositRequiresReconciliation(false);
          setValidityTimeRemaining(0);
          setDepositStage("failed");
          const msg = "Transaction not found and its validity window has expired. You may retry your deposit.";
          setStatusMessage(msg);
          setCheckDepositStatusMessage(msg);
        } else {
          const remaining = Math.max(1, Math.ceil(TRANSACTION_TIMEOUT_SECONDS - elapsedSeconds));
          setValidityTimeRemaining(remaining);
          setDepositRequiresReconciliation(true);
          setDepositStage("failed");
          const msg = `Transaction not found on ledger yet. Still within 120s validity window (${remaining}s remaining).`;
          setStatusMessage(msg);
          setCheckDepositStatusMessage(msg);
        }
      } else {
        // UNKNOWN
        setDepositRequiresReconciliation(true);
        setDepositStage("failed");
        const msg = "Could not verify transaction status. Please check Stellar Explorer or try again.";
        setStatusMessage(msg);
        setCheckDepositStatusMessage(msg);
      }
    } catch {
      setDepositRequiresReconciliation(true);
      setDepositStage("failed");
      const msg = "Could not check transaction status. Please check Stellar Explorer or try again.";
      setStatusMessage(msg);
      setCheckDepositStatusMessage(msg);
    } finally {
      setIsCheckingDepositStatus(false);
    }
  };

  useEffect(() => {
    const record = readPendingDeposit();
    if (record) {
      setPendingDeposit(record);
      setTxHash(record.hash);
      setSubmittedAmount(record.amount);
      setAmountInput(String(record.amount));
      setDepositRequiresReconciliation(true);
      setDepositStage("failed");
      setStatusMessage("You have an unconfirmed deposit. Check transaction status before retrying.");
      handleCheckDepositStatus();
    }
  }, []);

  useEffect(() => {
    if (!hasUnconfirmedDeposit || !pendingDeposit) return;
    const interval = setInterval(() => {
      const elapsed = (Date.now() - pendingDeposit.submittedAt) / 1000;
      if (elapsed > TRANSACTION_TIMEOUT_SECONDS) {
        setValidityTimeRemaining(0);
      } else {
        setValidityTimeRemaining(Math.max(1, Math.ceil(TRANSACTION_TIMEOUT_SECONDS - elapsed)));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [hasUnconfirmedDeposit, pendingDeposit]);

  const handleDepositAnother = () => {
    resetFlow("50", 50);
  };

  const handleServerRetry = () => {
    window.location.reload();
  };

  return (
    <NotificationsContext.Provider value={notifications}>
      <div className="app-shell">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <div className="ambient ambient-a" aria-hidden="true" />
        <div className="ambient ambient-b" aria-hidden="true" />

        <header className="topbar standalone-topbar no-print" role="banner">
          <a href="/" className="standalone-brand" aria-label="Callora home">
            <span className="standalone-logo" aria-hidden="true">C</span>
            Callora
          </a>

          <div className="topbar-actions">
            <nav className="nav" aria-label="Primary navigation">
              {PRIMARY_NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === APP_ROUTES.billing}
                  className={({ isActive }) => (isActive ? "link-nav active" : "link-nav")}
                  onMouseEnter={() => prefetchRoute(item.to)}
                  onFocus={() => prefetchRoute(item.to)}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <AccountSwitcher />
            {notifications.isSignedIn && (
              <NavLink
                to={APP_ROUTES.notifications}
                className={({ isActive }) =>
                  isActive ? "link-nav active notification-bell-link" : "link-nav notification-bell-link"
                }
                aria-label={notificationBellLabel}
                onMouseEnter={() => prefetchRoute(APP_ROUTES.notifications)}
                onFocus={() => prefetchRoute(APP_ROUTES.notifications)}
                style={{
                  position: "relative",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "6px 8px",
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {notifications.unreadCount > 0 && (
                  <span
                    className="notification-bell-badge"
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      top: 0,
                      right: 0,
                      minWidth: "16px",
                      height: "16px",
                      padding: "0 4px",
                      borderRadius: "999px",
                      background: "var(--accent, #4e85ff)",
                      color: "#fff",
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      lineHeight: "16px",
                      textAlign: "center",
                    }}
                  >
                    {unreadBadgeText}
                  </span>
                )}
              </NavLink>
            )}
            <WalletSignInButton />
            <WalletStatus />
            <ThemeToggle />
          </div>
        </header>

        <main id="main-content" role="main" className="page">
          <AppSessionExpiryBanner />
          <LiveRegion message={balanceAnnouncement} />
          <LiveRegion message={notificationAnnouncement} regionId="notifications-unread" />
          <RouteErrorBoundary
            resetKey={location.pathname}
            onGoHome={() => navigate(APP_ROUTES.dashboard)}
          >
            <Suspense fallback={<div className="route-loading-fallback" aria-busy="true" aria-label="Loading page" style={{ minHeight: "300px" }} />}>
            <Routes>
            <Route
              path={APP_ROUTES.landing}
              element={<LandingPage onStartUsingApis={() => navigate(APP_ROUTES.marketplace)} onPublishApi={() => navigate(APP_ROUTES.publish)} onTakeTour={() => navigate(APP_ROUTES.onboarding)} />}
            />

            <Route path={APP_ROUTES.publish} element={<RequireAuth><PublishApi /></RequireAuth>} />

            <Route path={APP_ROUTES.onboarding} element={<OnboardingTour onComplete={() => navigate(APP_ROUTES.dashboard)} />} />

            <Route
              path={APP_ROUTES.dashboard}
              element={
                <DashboardPage
                  vaultBalance={vaultNumber ?? undefined}
                  walletBalance={walletNumber ?? undefined}
                  walletAddress={wallet.address}
                  walletNetworkPassphrase={wallet.networkPassphrase}
                  balances={{
                    vaultText,
                    walletText,
                    status: balancesStatus,
                    error: balancesError,
                    configured: vaultConfigured,
                    walletConnected: Boolean(walletAddress),
                    pending: vaultPending,
                    onRetry: () => void refreshBalances(),
                  }}
                  costPerCall={0.08}
                  callsPerDay={120}
                  openDeposit={openDeposit}
                />
              }
            />
            <Route path={APP_ROUTES.marketplace} element={<MarketplacePage />} />

            <Route path={APP_ROUTES.themePlayground} element={<ThemePlayground />} />

            {/* ── My APIs ─────────────────────────────────────────────── */}
            <Route path={APP_ROUTES.myApis} element={<RequireAuth><MyApis /></RequireAuth>} />
            
            <Route path={APP_ROUTES.webhookDeliveries} element={<RequireAuth><WebhookDeliveries /></RequireAuth>} />

            {/* ── Plan Badge (issue #529) ──────────────────────────────── */}
            <Route path={APP_ROUTES.planBadge} element={<PlanBadgePage />} />

            <Route
              path={APP_ROUTES.billing}
              element={
                <RequireAuth>
                <section className="billing-layout">
                  <div className="surface billing-panel">
                    {hasUnconfirmedDeposit && !isDepositOpen && (
                      <div className="status-banner" role="status" style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <strong>You have an unconfirmed deposit</strong>
                          <p>A submitted transaction is awaiting verification. Check its status before depositing again.</p>
                        </div>
                        <button className="primary-button" onClick={() => openDeposit()}>
                          Check status
                        </button>
                      </div>
                    )}
                    <div className="section-heading">
                      <div>
                        <p className="eyebrow">Deposit USDC to Vault</p>
                        <h1>Review every number before you approve.</h1>
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button className="primary-button no-print" onClick={() => openDeposit()}>
                          Open deposit modal
                        </button>
                        <button
                          className="ghost-button no-print"
                          onClick={() => setIsWithdrawOpen(true)}
                          disabled={
                            !walletAddress ||
                            wallet.isNetworkMismatch ||
                            vaultStroops === null ||
                            vaultStroops === 0n
                          }
                          aria-label="Open withdrawal modal"
                        >
                          Withdraw
                        </button>
                      </div>
                    </div>

                    <div className="vault-grid">
                      <article className="vault-balance-card">
                        <span>Current vault balance</span>
                        <BalanceReadout
                          label="Vault balance"
                          value={vaultText}
                          status={balancesStatus}
                          configured={vaultConfigured}
                          error={balancesError}
                          onRetry={() => void refreshBalances()}
                          pending={vaultPending}
                        />
                        <p>Funds are used for call routing, model execution, and premium features.</p>
                      </article>

                      <article className="vault-balance-card secondary">
                        <span>Wallet available</span>
                        <BalanceReadout
                          label="Wallet available"
                          value={walletText}
                          status={walletAddress ? balancesStatus : "ready"}
                          configured={vaultConfigured}
                          error={walletAddress ? balancesError : null}
                          onRetry={() => void refreshBalances()}
                          placeholder="Connect wallet"
                        />
                        <p>Deposits settle on Stellar. Network fee is shown before wallet approval.</p>
                      </article>
                    </div>

                    <BillingInvoiceSection onPay={() => openDeposit()} />

                    <div className="info-row">
                      <div className="info-card">
                        <h2>Preset funding options</h2>
                        <p>$10, $50, $100, $500, or any custom amount above the minimum.</p>
                      </div>
                      <div className="info-card">
                        <h2>Status tracking</h2>
                        <p>Approving, pending, confirmed, and failed states are all shown in-context.</p>
                      </div>
                      <div className="info-card">
                        <h2>Explorer visibility</h2>
                        <p>Once submitted, the transaction hash is linkable and copyable from the UI.</p>
                      </div>
                    </div>
                  </div>

                  <aside className="surface prototype-panel">
                    <p className="eyebrow">Vault details</p>
                    <h2>Where your USDC goes.</h2>
                    <dl className="vault-facts">
                      <div>
                        <dt>Network</dt>
                        <dd>Stellar testnet</dd>
                      </div>
                      <div>
                        <dt>Vault contract</dt>
                        <dd>
                          <a href={testnetContractUrl(TESTNET_DEPLOYMENT.vault)} target="_blank" rel="noopener noreferrer">
                            {TESTNET_DEPLOYMENT.vault.slice(0, 6)}…{TESTNET_DEPLOYMENT.vault.slice(-6)}
                          </a>
                        </dd>
                      </div>
                      <div>
                        <dt>Settlement contract</dt>
                        <dd>
                          <a href={testnetContractUrl(TESTNET_DEPLOYMENT.settlement)} target="_blank" rel="noopener noreferrer">
                            {TESTNET_DEPLOYMENT.settlement.slice(0, 6)}…{TESTNET_DEPLOYMENT.settlement.slice(-6)}
                          </a>
                        </dd>
                      </div>
                      <div>
                        <dt>Minimum deposit</dt>
                        <dd>{MIN_DEPOSIT} USDC</dd>
                      </div>
                    </dl>
                    <p className="helper-text">
                      Every deposit and per-call debit is recorded on-chain. See past activity in{" "}
                      <NavLink to={APP_ROUTES.billingHistory}>Billing History</NavLink>.
                      {" "}<NavLink to={APP_ROUTES.subscriptions}>Manage subscriptions</NavLink>.
                    </p>
                    {runtimeConfig.enableDemoOutcome && (
                      <>
                        <div className="outcome-toggle" role="radiogroup" aria-label="Demo outcome">
                          <button role="radio" aria-checked={demoOutcome === "confirmed"} className={demoOutcome === "confirmed" ? "active" : ""} onClick={() => setDemoOutcome("confirmed")}>
                            Confirmed path
                          </button>
                          <button role="radio" aria-checked={demoOutcome === "failed"} className={demoOutcome === "failed" ? "active" : ""} onClick={() => setDemoOutcome("failed")}>
                            Failed path
                          </button>
                        </div>
                        <p className="helper-text">
                          Demo control for previewing the success and failure layouts.
                        </p>
                      </>
                    )}
                  </aside>
                </section>
                </RequireAuth>
              }
            />

            <Route path={APP_ROUTES.documentation} element={<Documentation />} />
            <Route path={APP_ROUTES.slaCard} element={<SlaCard />} />

            <Route path={APP_ROUTES.status} element={<StatusPage />} />

            <Route path="/api-usage" element={<ApiUsage />} />

            <Route path={APP_ROUTES.designSystem} element={<DesignSystemDocs />} />

            <Route path={APP_ROUTES.serverError} element={<ServerError onRetry={handleServerRetry} onGoHome={() => navigate(APP_ROUTES.dashboard)} />} />

            <Route path="/a11y-audit" element={<A11yAudit />} />

            <Route path={APP_ROUTES.rateLimitCard} element={<RateLimitCard />} />
            <Route path={APP_ROUTES.legacyRateLimit} element={<LegacyRateLimitRedirect />} />

            <Route path={APP_ROUTES.endpointSummary} element={<EndpointSummary />} />
            <Route path={APP_ROUTES.notifications} element={<NotificationCenter />} />

            {/* ── Billing History (FWC26) ──────────────────────────────── */}
            <Route path={APP_ROUTES.billingHistory} element={<BillingHistory />} />
            <Route path={APP_ROUTES.subscriptions} element={<Subscriptions />} />

            <Route path="*" element={<NotFound onGoHome={() => navigate(APP_ROUTES.dashboard)} />} />
            </Routes>
            </Suspense>
          </RouteErrorBoundary>
        </main>

        <footer className="surface app-footer no-print" role="contentinfo">
          <div>
            <p className="eyebrow">Callora</p>
            <p className="footer-copy">Reliable USDC funding and API operations for modern product teams.</p>
            <p className="footer-copy">
              <a className="footer-chain-link" href={testnetContractUrl(TESTNET_DEPLOYMENT.vault)} target="_blank" rel="noopener noreferrer">
                Deployed on Stellar testnet
              </a>
            </p>
          </div>

          <nav className="footer-nav" aria-label="Footer navigation">
            <NavLink to={APP_ROUTES.dashboard} className={({ isActive }) => (isActive ? "link-nav active" : "link-nav")}>
              Dashboard
            </NavLink>
            <NavLink to={APP_ROUTES.marketplace} className={({ isActive }) => (isActive ? "link-nav active" : "link-nav")}>
              Marketplace
            </NavLink>
            <NavLink to={APP_ROUTES.myApis} className={({ isActive }) => (isActive ? "link-nav active" : "link-nav")}>
              My APIs
            </NavLink>
            <NavLink to={APP_ROUTES.billing} className={({ isActive }) => (isActive ? "link-nav active" : "link-nav")}>
              Billing
            </NavLink>
            <NavLink to={APP_ROUTES.themePlayground} className={({ isActive }) => (isActive ? "link-nav active" : "link-nav")}>
              Theme Playground
            </NavLink>
            <NavLink to={APP_ROUTES.designSystem} className={({ isActive }) => (isActive ? "link-nav active" : "link-nav")}>
              Design System
            </NavLink>
            <NavLink to={APP_ROUTES.status} className={({ isActive }) => (isActive ? "link-nav active" : "link-nav")}>
              Status
            </NavLink>
            <NavLink to={APP_ROUTES.documentation} className={({ isActive }) => (isActive ? "link-nav active" : "link-nav")}>
              Documentation
            </NavLink>
          </nav>
        </footer>

        <ShortcutsModal isOpen={isShortcutsModalOpen} onClose={() => setIsShortcutsModalOpen(false)} />
        <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} />

        <CompareTray />
        <CompareDrawer />
        {isDepositOpen && (
          <div className="modal-backdrop" role="presentation" onClick={closeDeposit}>
            <section className="deposit-modal" role="dialog" aria-modal="true" aria-labelledby="deposit-title" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <p className="eyebrow">Secure vault funding</p>
                  <h2 id="deposit-title">Deposit USDC to Vault</h2>
                </div>

                <button className="close-button" onClick={closeDeposit} disabled={isBusy}>
                  Close
                </button>
              </div>

              <div className="modal-body">
                <div className="stage-strip" aria-label="Transaction flow status">
                  {(["input", "approving", "pending", depositStage === "failed" ? "failed" : "confirmed"] as const).map((item) => {
                    const isActive = item === depositStage || (item === "input" && depositStage === "input" && hasValidAmount);

                    return (
                      <span key={item} className={`stage-pill ${isActive ? "active" : ""}`}>
                        {STAGE_LABELS[item]}
                      </span>
                    );
                  })}
                </div>

                <div className="status-banner">
                  <div>
                    <strong>{stageLabel}</strong>
                    <p>{statusMessage}</p>
                  </div>
                  <span className={`status-chip ${depositStage}`}>{STAGE_LABELS[depositStage]}</span>
                </div>

                {walletAvailability === "available" && depositStage === "input" && (
                  <div id="usdc-trustline-status" className="security-note" role="status" aria-live="polite" aria-atomic="true">
                    {trustlineStatus === "checking" && <p>Checking your USDC trustline...</p>}
                    {trustlineStatus === "present" && <p>USDC trustline ready. Review your deposit and approve when ready.</p>}
                    {trustlineStatus === "missing" && (
                      <>
                        <strong>Add a USDC trustline before depositing</strong>
                        <p>A trustline lets your wallet hold and send this vault’s USDC asset. Adding it increases your minimum balance by a 0.5 XLM base reserve, plus a small transaction fee. This step only adds the trustline; it does not deposit or supply USDC.</p>
                      </>
                    )}
                    {trustlineStatus === "unfunded-account" && (
                      <>
                        <p>This Stellar account is not funded. Fund it with XLM, then check again before adding the USDC trustline.</p>
                        {runtimeConfig.network === "testnet" && (
                          <ExternalLink href={`https://friendbot.stellar.org/?addr=${encodeURIComponent(walletAddress)}`} ariaLabel="Fund testnet account with Friendbot">
                            Fund testnet account with Friendbot
                          </ExternalLink>
                        )}
                      </>
                    )}
                    {trustlineStatus === "unknown" && <p>Could not check your USDC trustline through Horizon. You can still approve, but a missing trustline may cause the deposit to fail.</p>}
                    {trustlineMessage && <p>{trustlineMessage}</p>}
                  </div>
                )}

                <div className="modal-grid">
                  <div className="form-panel">
                    <div className="balance-row">
                      <article className="balance-tile">
                        <span>Vault balance</span>
                        <BalanceReadout
                          label="Vault balance"
                          value={vaultText}
                          status={balancesStatus}
                          configured={vaultConfigured}
                          error={balancesError}
                          onRetry={() => void refreshBalances()}
                          pending={vaultPending}
                        />
                      </article>
                      <article className="balance-tile">
                        <span>Wallet available</span>
                        <BalanceReadout
                          label="Wallet available"
                          value={walletText}
                          status={walletAddress ? balancesStatus : "ready"}
                          configured={vaultConfigured}
                          error={walletAddress ? balancesError : null}
                          onRetry={() => void refreshBalances()}
                          placeholder="Connect wallet"
                        />
                      </article>
                    </div>

                    <label className="field-label" htmlFor="deposit-amount">
                      Amount
                    </label>

                    <div className={`input-shell ${validationMessage && depositStage === "input" ? "invalid" : ""}`}>
                      <input
                        id="deposit-amount"
                        type="text"
                        inputMode="decimal"
                        value={amountInput}
                        onChange={(event) => handleAmountChange(event.target.value)}
                        disabled={isBusy || hasUnconfirmedDeposit}
                        placeholder="0.00"
                        aria-describedby={amountHint ? "deposit-help deposit-amount-hint" : "deposit-help"}
                        aria-invalid={validationMessage.length > 0 && depositStage === "input"}
                      />
                      <span>USDC</span>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={handleMax}
                        disabled={isBusy || hasUnconfirmedDeposit || walletStroops === null}
                        aria-label={`Set maximum amount: ${walletText === null ? "wallet balance unavailable" : `${walletText} USDC`}`}
                      >
                        Max
                      </button>
                    </div>

                    <p id="deposit-help" className="helper-text">
                      Minimum deposit is {formatUsdShortcut(MIN_DEPOSIT)}. Custom deposits settle into your vault after wallet approval.
                    </p>

                    {amountHint && (
                      <p id="deposit-amount-hint" className="helper-text" role="status">
                        {amountHint}
                      </p>
                    )}

                    {validationMessage && depositStage === "input" && <p className="error-text">{validationMessage}</p>}

                    <div className="preset-row" role="radiogroup" aria-label="Deposit amount preset">
                      {PRESET_AMOUNTS.map((preset) => (
                        <button key={preset} role="radio" aria-checked={selectedPreset === preset} className={selectedPreset === preset ? "active" : ""} onClick={() => handlePresetClick(preset)} disabled={isBusy || hasUnconfirmedDeposit}>
                          ${preset}
                        </button>
                      ))}
                      <button role="radio" aria-checked={selectedPreset === "custom"} className={selectedPreset === "custom" ? "active" : ""} onClick={() => setSelectedPreset("custom")} disabled={isBusy || hasUnconfirmedDeposit}>
                        Custom
                      </button>
                    </div>

                    <div className="security-note">
                      <strong>What you are approving</strong>
                      <p>
                        Your wallet signs a USDC deposit into the Callora vault. The preview shows the exact vault credit, network fee, and post-deposit balance before
                        submission.
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
                        <strong>{hasAmount || submittedAmount ? `${balanceDelta} USDC` : "--"}</strong>
                      </div>

                      <div className="preview-row">
                        <span>Current balance</span>
                        <strong>{previewVaultStroops === null ? "--" : `${formatUsdcStroops(previewVaultStroops)} USDC`}</strong>
                      </div>

                      <div className="preview-row emphasis">
                        <span>New balance</span>
                        <strong>{projectedVaultStroops === null ? "--" : `${formatUsdcStroops(projectedVaultStroops)} USDC`}</strong>
                      </div>

                      <div className="preview-row">
                        <span>Network fee</span>
                        <strong>
                          <span>{displayedNetworkFee}</span>
                          {displayedNetworkFeeEstimated && <span> (estimated)</span>}
                        </strong>
                      </div>

                      <div className="preview-row total">
                        <span>Total cost</span>
                        <strong>{hasAmount || submittedAmount ? `${balanceDelta} USDC + ${displayedNetworkFee}` : `0.00 USDC + ${displayedNetworkFee}`}</strong>
                      </div>

                      {preparedDeposit && (
                        <TransactionSummaryDetails summary={preparedDeposit.summary} />
                      )}
                    </article>

                    {(depositStage === "pending" || depositStage === "confirmed" || depositStage === "failed") && txHash && (
                      <article className="hash-card">
                        <div>
                          <span className="eyebrow">Transaction hash</span>
                          <strong>{pendingHashLabel}</strong>
                        </div>

                        <div className="hash-actions">
                          <a href={buildExplorerLink(txHash, runtimeConfig.network)} target="_blank" rel="noreferrer">
                            View on Stellar Explorer
                          </a>
                          <button onClick={handleCopyHash}>{copied ? "Copied" : "Copy hash"}</button>
                        </div>
                      </article>
                    )}

                    {depositStage === "failed" && (
                      <article className="error-card" role="alert">
                        <strong>{depositFailureCode === "CONTRACT_REJECTED"
                          ? `${statusMessage}${depositContractErrorCode === null ? "" : ` (code ${depositContractErrorCode})`}`
                          : depositFailureCode === "SIGNATURE_REJECTED" ? "Signature rejected" : "Deposit failed"}</strong>
                        <p>{statusMessage}</p>
                        {hasUnconfirmedDeposit && validityTimeRemaining !== null && validityTimeRemaining > 0 && (
                          <p className="helper-text" style={{ marginTop: "0.5rem" }}>
                            Validity window: {validityTimeRemaining}s remaining
                          </p>
                        )}
                      </article>
                    )}

                    {depositStage === "confirmed" && (
                      <article className="success-card">
                        <strong>Deposit successful</strong>
                        <p>
                          {vaultText ? `Your updated vault balance is ${vaultText} USDC` : "Your vault balance is being refreshed."} and ready for usage.
                        </p>
                      </article>
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <div role="status" aria-live="polite" className="sr-only">
                  {checkDepositStatusMessage}
                </div>
                {depositStage === "input" && (vaultBlockReason || vaultPreflight.status === "unverified") && (
                  <p id="vault-preflight-status" className="helper-text" role="status" aria-live="polite">
                    {vaultBlockReason ?? vaultPreflight.message}
                  </p>
                )}
                {walletAvailability === "missing" ? (
                  <div className="wallet-install-prompt" role="status">
                    <p>Install Freighter to sign this Stellar deposit.</p>
                    <a className="primary-button" href="https://www.freighter.app/" target="_blank" rel="noreferrer">
                      Install Freighter
                    </a>
                  </div>
                ) : walletAvailability === "checking" ? (
                  <button className="primary-button" disabled>
                    Checking for Freighter...
                  </button>
                ) : depositStage === "failed" ? (
                  hasUnconfirmedDeposit ? (
                    <button
                      className="primary-button"
                      onClick={() => handleCheckDepositStatus()}
                      disabled={isCheckingDepositStatus}
                    >
                      {isCheckingDepositStatus ? "Checking status..." : "Check status"}
                    </button>
                  ) : (
                    <button className="primary-button" onClick={handleRetry}>
                      Retry deposit
                    </button>
                  )
                ) : depositStage === "confirmed" ? (
                  <button className="primary-button" onClick={handleDepositAnother}>
                    Deposit another amount
                  </button>
                ) : trustlineStatus === "checking" ? (
                  <button className="primary-button" disabled>Checking USDC trustline...</button>
                ) : trustlineStatus === "missing" ? (
                  <button className="primary-button" onClick={handleAddTrustline} disabled={isBusy} aria-describedby="usdc-trustline-status">
                    {isAddingTrustline ? "Adding USDC trustline..." : "Add USDC trustline"}
                  </button>
                ) : trustlineStatus === "unfunded-account" || trustlineStatus === "error" || trustlineStatus === "connect" ? (
                  <button className="primary-button" onClick={() => setTrustlineCheckVersion((version) => version + 1)} aria-describedby="usdc-trustline-status">
                    {trustlineStatus === "connect" ? "Connect Freighter" : "Check USDC trustline again"}
                  </button>
                ) : vaultPreflight.status === "checking" && depositStage === "input" ? (
                  <button className="primary-button" disabled>Checking vault...</button>
                ) : preparedDeposit && depositStage === "input" ? (
                  <button
                    className="primary-button"
                    onClick={handleConfirmSign}
                    disabled={isBusy}
                    aria-label="Confirm and sign deposit transaction"
                  >
                    Confirm &amp; Sign in Freighter
                  </button>
                ) : (
                  <button className="primary-button" onClick={handlePrepareDeposit} disabled={!hasValidAmount || isBusy || vaultBlockReason !== null} aria-describedby={vaultBlockReason ? "vault-preflight-status" : undefined} aria-label={isPreparingDeposit ? "Preparing deposit transaction" : depositStage === "approving" ? "Approve deposit in wallet" : depositStage === "pending" ? "Transaction submitted, waiting for confirmation" : "Approve deposit transaction"}>
                    {isPreparingDeposit ? "Preparing transaction..." : depositStage === "approving" ? "Approve in wallet..." : depositStage === "pending" ? "Transaction submitted..." : "Approve Transaction"}
                  </button>
                )}

                {trustlineStatus === "missing" && trustlineMessage && !isBusy && depositStage === "input" && (
                  <button className="secondary-button" onClick={() => setTrustlineCheckVersion((version) => version + 1)}>
                    Check USDC trustline again
                  </button>
                )}

                <button className="secondary-button" onClick={closeDeposit} disabled={isBusy}>
                  Cancel
                </button>
              </div>
            </section>
          </div>
        )}
        {isWithdrawOpen && (
          <WithdrawModal
            vaultStroops={vaultStroops}
            onRefreshBalances={() => void refreshBalances()}
            onShowSuccessToast={(message) => showToast(message, "success")}
            onClose={() => setIsWithdrawOpen(false)}
          />
        )}
      </div>
    </NotificationsContext.Provider>
  );
}

/**
 * AppSessionExpiryBanner — renders the session-expiry banner when the session
 * has expired, and dismisses it when the user clicks Dismiss or signs in again.
 */

function AppSessionExpiryBanner() {
  const { isExpired, dismiss } = useSessionExpiry();
  if (!isExpired) return null;
  return (
    <div style={{ padding: "0 24px" }}>
      <SessionExpiryBanner onDismiss={dismiss} />
    </div>
  );
}

export default App;
