import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import BottomSheet from "../components/BottomSheet";
import PlanBadge from "../components/PlanBadge";
import PricingTierTable, { type PricingTier } from "../components/PricingTierTable";
import { useToast } from "../components/Toast";
import useDocumentTitle from "../hooks/useDocumentTitle";
import { useAccountContext } from "../hooks/useAccountContext";
import { cancelSubscription, changePlan, listSubscriptions, type Subscription } from "../api/subscriptionsApi";
import { monthlyCostUsd, PRICING_PLANS, type PricingPlanId } from "../utils/pricingTiers";

const money = (value: number) => Number.isFinite(value) ? `$${value.toFixed(2)}` : "Unavailable";
const date = (value: string | null) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value)) : "—";

function tiersFor(subscription: Subscription): PricingTier[] {
  return PRICING_PLANS.map((plan) => ({
    name: plan.id.charAt(0).toUpperCase() + plan.id.slice(1), tier: plan.id,
    price: `${money(plan.monthlyBaseUsd)} / month`,
    description: plan.id === "enterprise" ? "Custom plans and dedicated support." : `${plan.includedRequests.toLocaleString()} requests included each month.`,
    features: [{ label: `${plan.includedRequests.toLocaleString()} requests included`, included: true }],
    ctaLabel: plan.id === "enterprise" ? "Contact us" : plan.id === subscription.planId ? "Current plan" : `Choose ${plan.id}`,
  }));
}

export default function Subscriptions() {
  useDocumentTitle("Subscriptions – Callora", "Manage API subscriptions and plans.");
  const { account } = useAccountContext();
  const { showToast } = useToast();
  const [rows, setRows] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [cancelling, setCancelling] = useState<Subscription | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [targetPlan, setTargetPlan] = useState<PricingPlanId | null>(null);
  const planTrigger = useRef<HTMLButtonElement | null>(null);
  const cancelTrigger = useRef<HTMLButtonElement | null>(null);
  const pendingRef = useRef(false);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    setLoading(true); setError("");
    try {
      const data = await listSubscriptions();
      if (requestId === requestRef.current) setRows(data);
    } catch (e) {
      if (requestId === requestRef.current) setError(e instanceof Error ? e.message : "Could not load subscriptions.");
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [account?.id]);

  useEffect(() => { void load(); return () => { requestRef.current += 1; }; }, [load]);
  const tierOptions = useMemo(() => editing ? tiersFor(editing) : [], [editing]);
  const currentEstimate = editing ? monthlyCostUsd(PRICING_PLANS.find((p) => p.id === editing.planId)!, editing.monthlyRequests, editing.pricePerRequest) : 0;
  const nextEstimate = editing && targetPlan ? monthlyCostUsd(PRICING_PLANS.find((p) => p.id === targetPlan)!, editing.monthlyRequests, editing.pricePerRequest) : 0;

  const submitPlan = async (tier: PricingTier) => {
    if (!editing || pendingRef.current) return;
    if (tier.tier === "enterprise") { showToast("Contact support to change to Enterprise.", "warning"); return; }
    const next = tier.tier as PricingPlanId | undefined;
    if (!next || next === editing.planId) return;
    pendingRef.current = true;
    const original = rows.find((row) => row.id === editing.id);
    if (!original) { pendingRef.current = false; return; }
    setBusyId(editing.id); setTargetPlan(next);
    setRows((previous) => previous.map((row) => row.id === editing.id ? { ...row, planId: next } : row));
    try {
      const updated = await changePlan(editing.id, next);
      setRows((previous) => previous.map((row) => row.id === updated.id ? updated : row));
      setEditing(null); setTargetPlan(null); showToast("Plan updated successfully.", "success");
    } catch (e) {
      setRows((previous) => previous.map((row) => row.id === original.id ? original : row));
      showToast(e instanceof Error ? e.message : "Could not change the plan.", "error");
    } finally { pendingRef.current = false; setBusyId(null); }
  };

  const confirmCancel = async () => {
    if (!cancelling || pendingRef.current || cancelling.status === "cancelling") return;
    pendingRef.current = true; setBusyId(cancelling.id);
    try {
      const updated = await cancelSubscription(cancelling.id);
      setRows((previous) => previous.map((row) => row.id === updated.id ? updated : row));
      setCancelling(null);
      showToast(`Subscription will end on ${date(updated.renewalDate)}.`, "success");
    } catch (e) { showToast(e instanceof Error ? e.message : "Could not cancel the subscription.", "error"); }
    finally { pendingRef.current = false; setBusyId(null); }
  };

  return <main className="page-shell" style={{ padding: "32px 0" }}>
    <header style={{ marginBottom: 24 }}><p className="eyebrow">Billing</p><h1>Subscriptions</h1><p>Manage the plans attached to your API subscriptions.</p></header>
    {loading && <p role="status">Loading subscriptions…</p>}
    {!loading && error && <section role="alert" className="surface" style={{ padding: 24 }}><p>{error}</p><button className="primary-button" onClick={() => void load()}>Try again</button></section>}
    {!loading && !error && rows.length === 0 && <section className="surface" style={{ padding: 24 }}><h2>No subscriptions yet</h2><p>Browse the marketplace to find an API to subscribe to.</p><Link className="primary-button" to="/marketplace">Browse marketplace</Link></section>}
    {!loading && !error && rows.length > 0 && <div className="surface" style={{ overflowX: "auto", borderRadius: 12 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}><thead><tr>{["API", "Plan", "Monthly estimate", "Status", "Renews / access ends", "Actions"].map((label) => <th key={label} scope="col" style={{ padding: 14 }}>{label}</th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id}>
          <td style={{ padding: 14 }}>{row.apiName}</td><td style={{ padding: 14 }}><PlanBadge tier={row.planId} /></td>
          <td style={{ padding: 14 }}>{money(monthlyCostUsd(PRICING_PLANS.find((p) => p.id === row.planId)!, row.monthlyRequests, row.pricePerRequest))} / month</td>
          <td style={{ padding: 14 }}>{row.status}</td><td style={{ padding: 14 }}>{date(row.renewalDate)}</td>
          <td style={{ padding: 14, display: "flex", gap: 8 }}>
            {row.status !== "ended" && <><button className="ghost-button" disabled={busyId === row.id} onClick={(event) => { planTrigger.current = event.currentTarget; setEditing(row); setTargetPlan(null); }}>Change plan</button>
              {row.status === "active" && <button className="ghost-button" disabled={busyId === row.id} onClick={(event) => { cancelTrigger.current = event.currentTarget; setCancelling(row); }}>Cancel</button>}</>}
          </td>
        </tr>)}</tbody>
      </table>
    </div>}
    <p style={{ marginTop: 20 }}><Link to="/billing">Back to Billing</Link></p>
    <BottomSheet open={!!editing} onClose={() => { setEditing(null); setTargetPlan(null); }} title={`Change plan${editing ? ` for ${editing.apiName}` : ""}`} triggerRef={planTrigger} defaultSnap="full">
      {editing && <><p>Current estimate: {money(currentEstimate)} / month{targetPlan && Number.isFinite(currentEstimate) && Number.isFinite(nextEstimate)
        ? ` · New estimate: ${money(nextEstimate)} / month (${nextEstimate - currentEstimate >= 0 ? "+" : "−"}${money(Math.abs(nextEstimate - currentEstimate))})`
        : targetPlan ? " · New estimate unavailable because this tier cannot cover projected usage." : ""}.</p>
        <PricingTierTable tiers={tierOptions} onSelectTier={(tier) => { if (busyId === editing.id) return; if (tier.tier === "enterprise") { showToast("Contact support to change to Enterprise.", "warning"); return; } void submitPlan(tier); }} />
        {busyId === editing.id && <p role="status">Updating plan…</p>}</>}
    </BottomSheet>
    <BottomSheet open={!!cancelling} onClose={() => setCancelling(null)} title="Cancel subscription" triggerRef={cancelTrigger}>
      {cancelling && <><p>Cancel {cancelling.apiName}? Access remains available until the end of this billing period on <strong>{date(cancelling.renewalDate)}</strong>.</p>
        <div style={{ display: "flex", gap: 12 }}><button className="ghost-button" onClick={() => setCancelling(null)}>Keep subscription</button><button className="danger-button" disabled={busyId === cancelling.id} onClick={() => void confirmCancel()}>{busyId === cancelling.id ? "Cancelling…" : "Confirm cancellation"}</button></div></>}
    </BottomSheet>
  </main>;
}
