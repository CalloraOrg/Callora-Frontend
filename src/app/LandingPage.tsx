import { NavLink } from "react-router-dom";
import ExternalLink from "../components/ExternalLink";
import { EXTERNAL_LINKS } from "../config/constants";
import { APP_ROUTES } from "./routes";

export type Feature = {
  icon: string;
  title: string;
  description: string;
};

export type Step = {
  title: string;
  description: string;
};

export const features: Feature[] = [
  {
    icon: "💸",
    title: "Pay-per-call billing",
    description: "Micro-payments in USDC mean every API request is billed precisely and transparently.",
  },
  {
    icon: "⛓️",
    title: "On-chain settlement",
    description: "Every transaction settles on-chain with verifiable records and near real-time visibility.",
  },
  {
    icon: "🧾",
    title: "No subscriptions",
    description: "Skip fixed plans and commitments. Pay only for the API calls your product actually makes.",
  },
  {
    icon: "🧑‍💻",
    title: "Developer-friendly",
    description: "Publish APIs quickly, define per-request pricing, and start earning USDC automatically.",
  },
];

export const consumerSteps: Step[] = [
  {
    title: "Connect wallet or sign up",
    description: "Create your account and securely link a wallet in minutes.",
  },
  {
    title: "Deposit USDC to vault",
    description: "Fund your usage balance once and keep API requests flowing.",
  },
  {
    title: "Browse and use APIs",
    description: "Discover programmable APIs and integrate them into your app.",
  },
  {
    title: "Pay automatically per call",
    description: "Billing happens in real time based on actual usage and price-per-request.",
  },
];

export const developerSteps: Step[] = [
  {
    title: "Register as developer",
    description: "Set up your publisher profile and prepare your API listing.",
  },
  {
    title: "Publish your API",
    description: "Add docs, endpoints, and metadata to make your API easy to adopt.",
  },
  {
    title: "Set pricing per request",
    description: "Choose flexible per-call pricing that reflects the value of your service.",
  },
  {
    title: "Earn USDC automatically",
    description: "Collect revenue from each successful call with transparent settlement.",
  },
];

export interface LandingPageProps {
  onStartUsingApis: () => void;
  onPublishApi: () => void;
  onTakeTour?: () => void;
}

export function LandingPage({ onStartUsingApis, onPublishApi, onTakeTour }: LandingPageProps) {
  return (
    <div className="lp-shell">
      <header className="lp-section lp-hero" aria-labelledby="hero-title">
        <div>
          <p className="lp-eyebrow">Built for API consumers and publishers</p>
          <h1 id="hero-title">Callora - Programmable API Access</h1>
          <p className="lp-subhead">
            Access and monetize APIs with usage-based billing. Callora combines programmable API access with pay-per-call settlement in USDC so teams can build faster and
            charge fairly.
          </p>

          <div className="lp-cta-row">
            <button className="lp-btn lp-btn-primary" onClick={onStartUsingApis}>
              Start Using APIs
            </button>
            <button className="lp-btn lp-btn-secondary" onClick={onPublishApi}>
              Publish Your API
            </button>
            {onTakeTour && (
              <button className="lp-btn lp-btn-secondary" onClick={onTakeTour} style={{ marginLeft: "12px" }}>
                Take the tour
              </button>
            )}
          </div>
        </div>

        <div className="lp-visual" aria-hidden="true">
          <p>API Marketplace</p>
          <span>Programmable Access • USDC Per Call • On-chain Settlement</span>
        </div>
      </header>

      <section className="lp-section">
        <p className="lp-eyebrow">Core capabilities</p>
        <h2>Why teams choose Callora</h2>

        <div className="lp-feature-grid">
          {features.map((feature) => (
            <article className="lp-card" key={feature.title}>
              <span>{feature.icon}</span>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-section">
        <p className="lp-eyebrow">How it works</p>
        <h2>A simple flow for both sides of the marketplace</h2>

        <div className="lp-flow-grid">
          <article className="lp-card">
            <h3>For API Consumers</h3>
            <ol>
              {consumerSteps.map((step) => (
                <li key={step.title}>
                  <strong>{step.title}</strong>
                  <p>{step.description}</p>
                </li>
              ))}
            </ol>
          </article>

          <article className="lp-card">
            <h3>For API Developers</h3>
            <ol>
              {developerSteps.map((step) => (
                <li key={step.title}>
                  <strong>{step.title}</strong>
                  <p>{step.description}</p>
                </li>
              ))}
            </ol>
          </article>
        </div>
      </section>

      <section className="lp-section">
        <p className="lp-eyebrow">Use cases & benefits</p>
        <h2>Designed for practical adoption</h2>

        <div className="lp-flow-grid">
          <article className="lp-card">
            <h3>Where Callora shines</h3>
            <ul>
              <li>AI workflows that need utility APIs without subscription overhead.</li>
              <li>Data providers monetizing endpoint access with frictionless micro-billing.</li>
              <li>Fintech and web3 apps requiring transparent usage-based costs.</li>
            </ul>
          </article>

          <article className="lp-card">
            <h3>Testimonials</h3>
            <p>
              “Callora helped us launch usage-based API monetization in days, not months.”
              <span> — Case study placeholder</span>
            </p>
            <p>
              “Our teams can scale integration costs exactly with demand, no wasted subscription spend.”
              <span> — Customer quote placeholder</span>
            </p>
          </article>
        </div>
      </section>

      <footer className="lp-section lp-footer">
        <nav aria-label="Footer links">
          <ExternalLink href={EXTERNAL_LINKS.about} className="link-nav">
            About
          </ExternalLink>
          <NavLink to={APP_ROUTES.documentation} className="link-nav">
            Documentation
          </NavLink>
          <ExternalLink href={EXTERNAL_LINKS.support} className="link-nav">
            Support
          </ExternalLink>
          <ExternalLink href={EXTERNAL_LINKS.terms} className="link-nav">
            Terms
          </ExternalLink>
          <ExternalLink href={EXTERNAL_LINKS.privacy} className="link-nav">
            Privacy
          </ExternalLink>
        </nav>
        <p>© {new Date().getFullYear()} Callora. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default LandingPage;
