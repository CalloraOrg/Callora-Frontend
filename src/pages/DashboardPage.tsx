import DashboardOverview, { type DashboardOverviewProps } from './DashboardOverview';
import useDocumentTitle from '../hooks/useDocumentTitle';

/**
 * DashboardPage – thin route wrapper that sets the page title and passes
 * App-level vault/wallet state into the DashboardOverview component.
 *
 * All hover-preview cards (vault balance, wallet, pinned APIs, recent
 * activity) are implemented inside DashboardOverview per issue #581.
 */
export default function DashboardPage(props: DashboardOverviewProps) {
  useDocumentTitle(
    "Dashboard – Callora",
    "Your Callora dashboard showing balances, recent activity and quick actions.",
  );
  return <DashboardOverview {...props} />;
}

