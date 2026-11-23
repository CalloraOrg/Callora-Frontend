export function StatusPage() {
  return (
    <section className="surface placeholder-card">
      <p className="eyebrow">Status</p>
      <h1>System status updates in one place.</h1>
      <p>
        All core services are operational. If you are still seeing issues, please contact support and include what action you were trying to complete.
      </p>
      <ul className="status-list" aria-label="Service status">
        {["Marketplace API", "Billing & vault deposits", "Usage metering", "Stellar testnet settlement", "Webhooks"].map((svc) => (
          <li key={svc}>
            <span>{svc}</span>
            <span className="status-ok">● Operational</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default StatusPage;
