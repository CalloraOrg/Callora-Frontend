import { useEffect, useMemo, useState } from 'react';
import './Dashboard.css';
import LowBalanceBanner from './LowBalanceBanner';
import { useNavigate } from 'react-router-dom';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import UsageGauge from '../components/UsageGauge';
import { formatUsdc, formatPrice } from '../utils/format';
import { LOADING_DELAY_MS } from '../config/constants';
import { usePinnedApis, pinnedApisStore } from '../state/pinnedApis';
import MOCK_APIS from '../data/mockApis';

// Props needed from the App state
interface DashboardProps {
  vaultBalance: number;
  walletBalance: number;
  /** Optional average cost per call (USDC) used for runway estimation. */
  costPerCall?: number;
  /** Average daily calls used for runway-to-days conversion. Defaults to 100. */
  callsPerDay?: number;
  openDeposit: (presetAmount?: number) => void;
}

interface ActivityItem {
  type: 'deposit' | 'usage';
  amount: number;
  date: string; // ISO string
}

export default function Dashboard({
  vaultBalance,
  walletBalance,
  costPerCall,
  callsPerDay,
  openDeposit,
}: DashboardProps) {
  const navigate = useNavigate();
  const [activity, setActivity] = useState<ActivityItem[] | null>(null);

  // Simulate data fetch with a timeout
  useEffect(() => {
    const timer = setTimeout(() => {
      // Mock data – you can replace with real API call later
      const mock: ActivityItem[] = [
        { type: 'deposit', amount: 50, date: new Date().toISOString() },
        { type: 'usage', amount: 12.5, date: new Date(Date.now() - 86400000).toISOString() },
        { type: 'deposit', amount: 100, date: new Date(Date.now() - 2 * 86400000).toISOString() },
      ];
      setActivity(mock);
    }, LOADING_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const isLoading = activity === null;
  const totalUsage = activity?.reduce((sum, item) => (item.type === 'usage' ? sum + item.amount : sum), 0) ?? 0;
  const pinnedApiIds = usePinnedApis();
  const pinnedApis = useMemo(
    () => MOCK_APIS.filter((api) => pinnedApiIds.has(api.id)),
    [pinnedApiIds],
  );

  return (
    <>
      <LowBalanceBanner balance={vaultBalance} openDeposit={openDeposit} />
      <section className="dashboard-grid surface">
        {/* Balance Overview */}
      <div className="dashboard-card">
        <h3 className="eyebrow">Vault balance</h3>
        <strong>{formatUsdc(vaultBalance)} USDC</strong>
      </div>
      <div className="dashboard-card">
        <h3 className="eyebrow">Wallet available</h3>
        <strong>{formatUsdc(walletBalance)} USDC</strong>
      </div>

      {/* Screen-reader-friendly usage state */}
      <UsageGauge
        label="API usage this cycle"
        used={totalUsage}
        limit={vaultBalance}
        unit="USDC"
        costPerCall={costPerCall}
        callsPerDay={callsPerDay}
      />

      {/* Quick actions */}
      <div className="dashboard-actions">
        <button className="primary-button no-print" onClick={() => openDeposit()}>Deposit</button>
        <button className="secondary-button dashboard-quick-topup" onClick={() => openDeposit(50)} aria-label="Quick top-up with 50 USDC">+ $50 Top-up</button>
        <button className="secondary-button dashboard-quick-topup" onClick={() => openDeposit(100)} aria-label="Quick top-up with 100 USDC">+ $100 Top-up</button>
        <button className="secondary-button" onClick={() => navigate('/marketplace')}>Browse APIs</button>
        <button className="secondary-button" onClick={() => navigate('/api-usage')}>View Usage</button>
      </div>

      <div className="dashboard-card dashboard-card--pinned">
        <div className="dashboard-card__pinned-heading">
          <h3 className="eyebrow">Pinned APIs</h3>
          {pinnedApis.length > 0 && (
            <span className="dashboard-card__pinned-count">
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
            {pinnedApis.map((api) => (
              <div key={api.id} className="dashboard-pinned-item">
                <div className="dashboard-pinned-item__content">
                  <strong>{api.name}</strong>
                  <span>{api.provider?.name}</span>
                </div>
                <div className="dashboard-pinned-item__meta">
                  <span>{`$${formatPrice(api.pricePerCall ?? api.pricePerRequest)} / call`}</span>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => pinnedApisStore.unpin(api.id)}
                    aria-label={`Unpin ${api.name} from dashboard`}
                  >
                    Unpin
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="dashboard-activity">
        <h3 className="eyebrow">Recent activity</h3>
        {isLoading && (
          <div className="activity-skeletons">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} width="100%" height={20} className="mb-2" />
            ))}
          </div>
        )}
        {!isLoading && activity && activity.length === 0 && (
          <EmptyState message="No activity yet. Deposit USDC to get started!" />
        )}
        {!isLoading && activity && activity.length > 0 && (
          <ul className="activity-list">
            {activity.map((item, idx) => (
              <li key={idx} className="activity-item">
                <span>{item.type === 'deposit' ? 'Deposit' : 'Usage'}:</span>
                <strong>{formatUsdc(item.amount)} USDC</strong>
                <span className="date">{new Date(item.date).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
    </>
  );
}
