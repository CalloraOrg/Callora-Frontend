import Dashboard from '../components/Dashboard';
import PlanNudge from '../components/PlanNudge';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useQuota } from '../hooks/useQuota';

// TODO: replace with real quota value from your API/context
const MOCK_USAGE_PERCENT = 87;

/**
 * DashboardPage – wrapper for the Dashboard component to set page title.
 */
export default function DashboardPage() {
  useDocumentTitle('Dashboard – Callora', 'Your Callora dashboard showing balances, recent activity and quick actions.');

  const { usagePercent, isDismissed, dismiss } = useQuota(MOCK_USAGE_PERCENT);

  return (
    <>
      {!isDismissed && (
        <PlanNudge usagePercent={usagePercent} onDismiss={dismiss} />
      )}
      <Dashboard vaultBalance={0} walletBalance={0} openDeposit={() => {}} />
    </>
  );
}
