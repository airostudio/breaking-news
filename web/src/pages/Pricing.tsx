import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../lib/auth";

/**
 * PLACEHOLDER PRICING — no live Stripe integration yet.
 * Numbers/copy here mirror what will become real Stripe Products/Prices once
 * a Stripe secret key is provided; the "Subscribe" buttons are inert until then.
 */
type Tier = {
  id: "newsroom" | "bureau" | "enterprise";
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
};

const TIERS: Tier[] = [
  {
    id: "newsroom",
    name: "Newsroom",
    price: "$99",
    period: "/mo",
    description: "For local and regional outlets getting started with verified user-generated footage.",
    features: [
      "Full marketplace browsing",
      "Buy-now licensing on verified stories",
      "Standard bidding on auctions",
      "Access to verification notes on every listing",
    ],
    cta: "Subscribe",
  },
  {
    id: "bureau",
    name: "Bureau",
    price: "$349",
    period: "/mo",
    description: "For national desks that need first look at breaking footage as it's verified.",
    features: [
      "Everything in Newsroom",
      "Priority breaking-news alerts",
      "Higher bid ceilings on live auctions",
      "Early access window before Newsroom-tier outlets",
    ],
    cta: "Subscribe",
    highlighted: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    description: "For wire services and global broadcasters with volume licensing needs.",
    features: [
      "Everything in Bureau",
      "Direct API access to the listings feed",
      "Dedicated verification-desk liaison",
      "Negotiated volume licensing terms",
    ],
    cta: "Contact Sales",
  },
];

export default function Pricing() {
  const { user } = useAuth();
  const [billingNote] = useState(
    "Prices shown are placeholders pending Stripe setup. No card will be charged.",
  );

  return (
    <div className="page pricing-page">
      <div className="page-header">
        <div className="eyebrow">For News Outlets</div>
        <h1>Pricing</h1>
        <p className="lead">
          Subscribe for marketplace access, then license individual stories as they're verified —
          by buy-now or auction. Every license sale still pays the contributor who captured it{" "}
          <strong>70%</strong>, with 30% to BNO.
        </p>
      </div>

      <div className="pricing-grid">
        {TIERS.map((tier) => (
          <div key={tier.id} className={`pricing-card${tier.highlighted ? " pricing-card-highlight" : ""}`}>
            {tier.highlighted && <div className="pricing-badge">Most Popular</div>}
            <h2>{tier.name}</h2>
            <div className="pricing-amount">
              <span className="pricing-figure">{tier.price}</span>
              {tier.period && <span className="pricing-period">{tier.period}</span>}
            </div>
            <p className="pricing-desc">{tier.description}</p>
            <ul className="pricing-features">
              {tier.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <button
              type="button"
              className={`btn btn-block${tier.highlighted ? " btn-primary" : " btn-outline"}`}
              disabled
              title="Billing isn't connected yet"
            >
              {tier.cta}
            </button>
          </div>
        ))}
      </div>

      <p className="pricing-note">{billingNote}</p>

      <div className="panel pricing-addon">
        <div className="section-title">Per-license add-on</div>
        <div className="addon-row">
          <div>
            <h3>Exclusive Rights Add-on</h3>
            <p className="dek">
              Applied at the time of purchase or when an auction closes. Guarantees sole worldwide
              exclusivity on that story — BNO will not re-license the same footage to any other
              outlet, region, or platform.
            </p>
          </div>
          <div className="addon-price">
            <span className="pricing-figure">+25%</span>
            <span className="pricing-period">of purchase price</span>
          </div>
        </div>
        <p className="split-note">
          This add-on is a one-time rights premium paid on top of the base license price. It is
          separate from — and not part of — the 70/30 contributor split, which is always
          calculated on the base sale price only.
        </p>
      </div>

      <div className="panel pricing-faq">
        <div className="section-title">How licensing pricing works</div>
        <dl className="review-grid">
          <dt>Buy-now price</dt>
          <dd>Set by BNO's editors when a story is verified and listed. Pay it in full for instant licensing.</dd>
          <dt>Auction / bidding</dt>
          <dd>Outlets bid against each other; the highest bid when the auction closes wins the license.</dd>
          <dt>Exclusive Rights Add-on</dt>
          <dd>Optional +25% surcharge at checkout for guaranteed sole exclusivity, instead of a standard license.</dd>
          <dt>Contributor payout</dt>
          <dd>70% of the base license price goes directly to the person who captured the footage, every time.</dd>
        </dl>
      </div>

      {!user && (
        <p className="pricing-cta-row">
          <NavLink to="/register" className="btn btn-primary">
            Create an outlet account
          </NavLink>
        </p>
      )}
    </div>
  );
}
