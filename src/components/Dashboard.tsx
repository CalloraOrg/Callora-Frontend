import { useEffect, useState } from 'react';
import './Dashboard.css';
import { useNavigate } from 'react-router-dom';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import { formatUsdc } from '../utils/format';
import { LOADING_DELAY_MS } from '../config/constants';

// Props needed from the App state
interface DashboardProps {
  vaultBalance: number;
  walletBalance: number;
  openDeposit: () => void;
}

interface ActivityItem {
  type: 'deposit' | 'usage';
  amount: number;
  date: string; // ISO string
}

export default function Dashboard({ vaultBalance, walletBalance, openDeposit }: DashboardProps) {
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

  return (
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

      {/* Quick actions */}
      <div className="dashboard-actions">
        <button className="primary-button" onClick={openDeposit}>Deposit</button>
        <button className="secondary-button" onClick={() => navigate('/marketplace')}>Browse APIs</button>
        <button className="secondary-button" onClick={() => navigate('/api-usage')}>View Usage</button>
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
  );
}
