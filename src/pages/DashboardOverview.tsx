/**
 * DashboardOverview.tsx — Interactive Dashboard Overview page component.
 *
 * GrantFox FWC26 campaign (Issue #689 / b#012) requirement:
 * Provides a hover-triggered preview card on DashboardOverview rows and cards with
 * a keyboard-accessible alternative (onFocus/onBlur, Escape dismissal, aria-describedby).
 *
 * Displays:
 * 1. Vault Balance & Wallet metrics with PreviewCards
 * 2. API Usage gauge and Runway estimation
 * 3. Pinned APIs list with PreviewCard schema/details preview
 * 4. Recent Activity log items with PreviewCard breakdown
 * 5. Quick action controls (Deposit, Top-up, Marketplace, Usage analytics)
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LowBalanceBanner from '../components/LowBalanceBanner';
import UsageGauge from '../components/UsageGauge';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import PreviewCard, { type PreviewCardData } from '../components/PreviewCard';
import { formatUsdc, formatPrice, formatTimeString } from '../utils/format';
import { LOADING_DELAY_MS } from '../config/constants';
import { usePinnedApis, pinnedApisStore } from '../state/pinnedApis';
import MOCK_APIS from '../data/mockApis';
import '../components/Dashboard.css';

export interface DashboardOverviewProps {
  /** Current Vault balance in USDC */
  vaultBalance?: number;
  /** Available Wallet balance in USDC */
  walletBalance?: number;
  /** Average cost per call in USDC */
  costPerCall?: number;
  /** Average daily API calls */
  callsPerDay?: number;
  /** Callback fired when user triggers deposit flow */
  openDeposit?: (presetAmount?: number) => void;
  /** Optional custom class name */
  className?: string;
}

export interface OverviewActivityItem {
  id: string;
  type: 'deposit' | 'usage';
  amount: number;
  date: string;
  endpoint?: string;
  status?: 'operational' | 'degraded' | 'error' | 'success';
}

export function DashboardOverview({
  vaultBalance = 150.0,
  walletBalance = 450.0,
  costPerCall = 0.005,
  callsPerDay = 120,
  openDeposit = () => {},
  className = '',
}: DashboardOverviewProps) {
  const navigate = useNavigate();
  const [activity, setActivity] = useState<OverviewActivityItem[] | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const mock: OverviewActivityItem[] = [
        {
          id: 'act-1',
          type: 'usage',
          amount: 12.5,
          date: new Date(Date.now() - 3600000).toISOString(),
          endpoint: 'WeatherSim API /v1/forecast',
          status: 'operational',
        },
        {
          id: 'act-2',
          type: 'deposit',
          amount: 100.0,
          date: new Date(Date.now() - 86400000).toISOString(),
          endpoint: 'USDC Vault Settlement',
          status: 'success',
        },
        {
          id: 'act-3',
          type: 'usage',
          amount: 8.75,
          date: new Date(Date.now() - 2 * 86400000).toISOString(),
          endpoint: 'PayFlow Stellar /v2/transact',
          status: 'operational',
        },
      ];
      setActivity(mock);
    }, LOADING_DELAY_MS);

    return () => clearTimeout(timer);
  }, []);

  const isLoading = activity === null;
  const totalUsage =
    activity?.reduce((sum, item) => (item.type === 'usage' ? sum + item.amount : sum), 0) ?? 0;

  const pinnedApiIds = usePinnedApis();
  const pinnedApis = useMemo(
    () => MOCK_APIS.filter((api) => pinnedApiIds.has(api.id)),
    [pinnedApiIds],
  );

  // Vault preview data
  const vaultPreviewData: PreviewCardData = {
    id: 'vault-overview',
    title: 'USDC Vault Overview',
    subtitle: 'Callora Stellar Vault Settlement Account',
    description: 'Pre-funded reserve for automatic API micropayments across subscribed services.',
    metrics: [
      { label: 'Available', value: `${formatUsdc(vaultBalance)} USDC` },
      { label: 'Est. Runway', value: `${Math.round(vaultBalance / (costPerCall * callsPerDay))} days` },
    ],
    status: vaultBalance < 20 ? 'warning' : 'operational',
    details: {
      'Auto-Refill': 'Disabled',
      'Settlement Layer': 'Stellar Soroban',
    },
  };

  // Wallet preview data
  const walletPreviewData: PreviewCardData = {
    id: 'wallet-overview',
    title: 'Connected Wallet',
    subtitle: 'Freighter Stellar Wallet (Public Net)',
    description: 'Instant deposit source for refilling Callora Vault reserve balances.',
    metrics: [
      { label: 'Wallet Balance', value: `${formatUsdc(walletBalance)} USDC` },
      { label: 'Min Deposit', value: '10 USDC' },
    ],
    status: 'operational',
  };

  return (
    <div className={['dashboard-overview-container', className].filter(Boolean).join(' ')}>
      <LowBalanceBanner balance={vaultBalance} openDeposit={openDeposit} />

      <section className="dashboard-grid surface">
        {/* Balance Overview Cards with PreviewCard Wrappers */}
        <PreviewCard data={vaultPreviewData} position="bottom">
          <div className="dashboard-card" data-testid="dashboard-card-vault">
            <h3 className="eyebrow">Vault balance</h3>
            <strong className="tabular-nums numeric-tabular">{formatUsdc(vaultBalance)} USDC</strong>
          </div>
        </PreviewCard>

        <PreviewCard data={walletPreviewData} position="bottom">
          <div className="dashboard-card" data-testid="dashboard-card-wallet">
            <h3 className="eyebrow">Wallet available</h3>
            <strong className="tabular-nums numeric-tabular">{formatUsdc(walletBalance)} USDC</strong>
          </div>
        </PreviewCard>

        {/* Screen-reader-friendly usage gauge */}
        <UsageGauge
          label="API usage this cycle"
          used={totalUsage}
          limit={vaultBalance}
          unit="USDC"
          costPerCall={costPerCall}
          callsPerDay={callsPerDay}
        />

        {/* Quick Actions */}
        <div className="dashboard-actions">
          <button
            type="button"
            className="primary-button no-print"
            onClick={() => openDeposit()}
          >
            Deposit
          </button>
          <button
            type="button"
            className="secondary-button dashboard-quick-topup"
            onClick={() => openDeposit(50)}
            aria-label="Quick top-up with 50 USDC"
          >
            + $50 Top-up
          </button>
          <button
            type="button"
            className="secondary-button dashboard-quick-topup"
            onClick={() => openDeposit(100)}
            aria-label="Quick top-up with 100 USDC"
          >
            + $100 Top-up
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => navigate('/marketplace')}
          >
            Browse APIs
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => navigate('/api-usage')}
          >
            View Usage
          </button>
        </div>

        {/* Pinned APIs Section with PreviewCard Wrappers */}
        <div className="dashboard-card dashboard-card--pinned">
          <div className="dashboard-card__pinned-heading">
            <h3 className="eyebrow">Pinned APIs</h3>
            {pinnedApis.length > 0 && (
              <span className="dashboard-card__pinned-count tabular-nums numeric-tabular">
                {pinnedApis.length} pinned
              </span>
            )}
          </div>

          {pinnedApis.length === 0 ? (
            <p className="dashboard-card__pinned-empty">
              Pin APIs from the marketplace to keep them handy on your dashboard.
            </p>
          ) : (
            <div className="dashboard-pinned-list">
              {pinnedApis.map((api) => {
                const apiPreviewData: PreviewCardData = {
                  id: `preview-api-${api.id}`,
                  title: api.name,
                  subtitle: api.provider?.name ?? 'Callora Verified',
                  category: api.category ?? 'Data API',
                  description: api.description,
                  status: (api.status as any) ?? 'operational',
                  price: `$${formatPrice(api.pricePerCall ?? api.pricePerRequest)}`,
                  tags: api.tags,
                  metrics: [
                    { label: 'Latency', value: `${api.avgLatencyMs ?? 45}ms` },
                    { label: 'Uptime', value: `${api.uptimePercent ?? 99.9}%` },
                  ],
                };

                return (
                  <PreviewCard key={api.id} data={apiPreviewData} position="top">
                    <div className="dashboard-pinned-item" data-testid={`pinned-api-${api.id}`}>
                      <div className="dashboard-pinned-item__content">
                        <strong>{api.name}</strong>
                        <span>{api.provider?.name}</span>
                      </div>
                      <div className="dashboard-pinned-item__meta">
                        <span className="tabular-nums numeric-tabular">{`$${formatPrice(
                          api.pricePerCall ?? api.pricePerRequest,
                        )} / call`}</span>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            pinnedApisStore.unpin(api.id);
                          }}
                          aria-label={`Unpin ${api.name} from dashboard`}
                        >
                          Unpin
                        </button>
                      </div>
                    </div>
                  </PreviewCard>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Activity Section with PreviewCard Wrappers */}
        <div className="dashboard-activity">
          <h3 className="eyebrow">Recent activity</h3>
          {isLoading && (
            <div className="activity-skeletons">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} width="100%" height={24} className="mb-2" />
              ))}
            </div>
          )}
          {!isLoading && activity && activity.length === 0 && (
            <EmptyState message="No activity yet. Deposit USDC to get started!" />
          )}
          {!isLoading && activity && activity.length > 0 && (
            <ul className="activity-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {activity.map((item) => {
                const activityPreviewData: PreviewCardData = {
                  id: `preview-act-${item.id}`,
                  title: item.type === 'deposit' ? 'USDC Deposit' : 'API Request Charge',
                  subtitle: item.endpoint,
                  description:
                    item.type === 'deposit'
                      ? 'Funded via connected Freighter Stellar Wallet.'
                      : 'Micropayment deducted from active Vault reserve.',
                  status: item.status ?? 'operational',
                  metrics: [
                    { label: 'Amount', value: `${formatUsdc(item.amount)} USDC` },
                    { label: 'Type', value: item.type.toUpperCase() },
                  ],
                  lastActive: formatTimeString(new Date(item.date)),
                };

                return (
                  <li key={item.id} style={{ marginBottom: '8px' }}>
                    <PreviewCard data={activityPreviewData} position="right">
                      <div
                        className="activity-item"
                        data-testid={`activity-item-${item.id}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          background: 'var(--bg-chip, rgba(255, 255, 255, 0.03))',
                          border: '1px solid var(--line, rgba(255, 255, 255, 0.08))',
                        }}
                      >
                        <span>{item.type === 'deposit' ? 'Deposit' : 'Usage'}:</span>
                        <strong className="tabular-nums numeric-tabular">
                          {formatUsdc(item.amount)} USDC
                        </strong>
                        <span className="date" style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #9ca3af)' }}>
                          {new Date(item.date).toLocaleDateString()}
                        </span>
                      </div>
                    </PreviewCard>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

export default DashboardOverview;
