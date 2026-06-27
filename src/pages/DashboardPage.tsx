import React from 'react';
import Dashboard from '../components/Dashboard';
import useDocumentTitle from '../hooks/useDocumentTitle';

/**
 * DashboardPage – wrapper for the Dashboard component to set page title.
 */
export default function DashboardPage() {
  useDocumentTitle('Dashboard – Callora', 'Your Callora dashboard showing balances, recent activity and quick actions.');
  return <Dashboard vaultBalance={0} walletBalance={0} openDeposit={() => {}} />;
}
