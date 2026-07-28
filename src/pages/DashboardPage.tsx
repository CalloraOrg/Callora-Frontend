import DashboardOverview from './DashboardOverview';
import useDocumentTitle from '../hooks/useDocumentTitle';

/**
 * DashboardPage – wrapper for the DashboardOverview component to set page title.
 */
export default function DashboardPage() {
  useDocumentTitle(
    "Dashboard – Callora",
    "Your Callora dashboard showing balances, recent activity and quick actions.",
  );
  return (
    <DashboardOverview
      vaultBalance={0}
      walletBalance={0}
      openDeposit={(_presetAmount?: number) => {}}
    />
  );
}

