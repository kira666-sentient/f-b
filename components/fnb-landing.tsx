"use client";

import { memo, useState } from "react";
import LandingBearScene from "./landing-bear-scene";
import LandingWaterfallScene from "./landing-waterfall-scene";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2
});

function formatCurrency(amountInPaise: number) {
  return money.format(amountInPaise / 100);
}

// Optimization: Shared scroll handler for dot state
const handleScrollState = (e: React.UIEvent<HTMLDivElement>, setter: (idx: number) => void, currentIdx: number) => {
  const el = e.currentTarget;
  const index = Math.round(el.scrollLeft / (el.offsetWidth * 0.82));
  if (index !== currentIdx) setter(index);
};

/* --- Isolated Performance Components --- */

const HeroPreviewCarousel = memo(() => {
  const [idx, setIdx] = useState(0);
  return (
    <>
      <div className="landing-preview-layered-snapshot" onScroll={(e) => handleScrollState(e, setIdx, idx)}>
        {/* Card 1: App-accurate Approval flow */}
        <article className="layered-card dominant-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div className="label" style={{ marginBottom: 0 }}>Next Action</div>
            <strong style={{ fontSize: "1.15rem", marginTop: "-3px" }}>{formatCurrency(46000)}</strong>
          </div>
          
          <div className="landing-preview-identity" style={{ marginTop: "14px" }}>
            <div className="landing-preview-avatar">A</div>
            <div className="landing-preview-copy">
              <strong>Arjun P.</strong>
              <span>@arjun_0x</span>
            </div>
          </div>
          <div style={{ marginLeft: "52px" }}>
            <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>Logged an expense:</p>
            <strong style={{ display: "block", marginTop: "4px" }}>Cab ride home</strong>
          </div>
          <div className="landing-preview-decision-cluster" style={{ marginLeft: "52px", marginTop: "16px" }}>
            <span className="landing-btn-preview landing-btn-approve">Approve</span>
            <span className="landing-btn-preview landing-btn-reject">Reject</span>
          </div>
        </article>

        {/* Card 2: Shared Truth / Ledger */}
        <article className="layered-card balance-card">
          <div className="label">Shared Truth</div>
          <p className="muted" style={{ fontSize: "0.85rem", marginBottom: "8px" }}>Network standing:</p>
          <strong style={{ fontSize: "1.4rem", display: "block" }}>
            Arjun owes you {formatCurrency(124000)}
          </strong>
          <div className="landing-preview-balance-bar" style={{ marginTop: "16px" }}>
            <span className="landing-preview-balance-fill" />
          </div>
        </article>

        {/* Card 3: Items Tracker */}
        <article className="layered-card activity-card">
          <div className="label">Shared Items</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong>Nintendo Switch</strong>
              <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>Lent to @neha</p>
            </div>
            <span className="pill status-active" style={{ fontSize: "0.7rem", textTransform: "uppercase" }}>In Use</span>
          </div>
        </article>

        {/* Card 4: Incoming Invite */}
        <article className="layered-card invite-card">
          <div className="label">Network Link</div>
          <div className="landing-preview-identity" style={{ marginTop: "12px", marginBottom: "16px" }}>
            <div className="landing-preview-avatar" style={{ background: "var(--accent)", color: "#fff", fontWeight: 700 }}>N</div>
            <div className="landing-preview-copy">
              <strong>Neha S.</strong>
              <span>@neha_99 wants to connect</span>
            </div>
          </div>
          <button className="primary-button" style={{ width: "100%", padding: "10px", borderRadius: "12px", fontSize: "0.9rem" }}>Accept Request</button>
        </article>

        {/* Card 5: Settlement confirmed */}
        <article className="layered-card settled-card">
          <div className="label">Settled Up</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px", alignItems: "center" }}>
            <div>
              <strong style={{ fontSize: "1rem" }}>You paid Arjun</strong>
              <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>Via UPI</p>
            </div>
            <span className="amount-badge positive">{formatCurrency(124000)}</span>
          </div>
        </article>
      </div>
      
      <div className="landing-carousel-tray mobile-only">
        {[0, 1, 2, 3, 4].map(i => (
          <span key={i} className={`carousel-dot ${idx === i ? 'active' : ''}`} />
        ))}
      </div>
    </>
  );
});
HeroPreviewCarousel.displayName = "HeroPreviewCarousel";

const FlowSection = memo(() => {
  const [idx, setIdx] = useState(0);
  return (
    <article className="panel landing-panel landing-story-panel">
      <div className="section-head landing-section-head">
        <div>
          <p className="eyebrow">The Flow</p>
          <h2>From &ldquo;Who paid?&rdquo; to peace of mind.</h2>
          <p className="muted landing-panel-lede">
            Stop the group-chat math and the &ldquo;I&apos;ll get you next time&rdquo; uncertainty.
          </p>
        </div>
      </div>

      <div className="landing-feature-list landing-carousel-mobile" onScroll={(e) => handleScrollState(e, setIdx, idx)}>
        <div className="landing-feature-item">
          <span className="landing-feature-step">01</span>
          <div>
            <strong>Search &amp; Link</strong>
            <p>Find your friend&apos;s username and you&apos;re in. No syncing contacts, no social spam.</p>
          </div>
        </div>
        <div className="landing-feature-item">
          <span className="landing-feature-step">02</span>
          <div>
            <strong>Verified Entry</strong>
            <p>Anyone can log a debt, but it only touches the total once confirmed. No surprises.</p>
          </div>
        </div>
        <div className="landing-feature-item">
          <span className="landing-feature-step">03</span>
          <div>
            <strong>Settled &amp; Saved</strong>
            <p>Clear debts instantly. Once both sides confirm, the ledger zeros out, history stays.</p>
          </div>
        </div>
      </div>
      <div className="landing-carousel-tray mobile-only" style={{ marginTop: '20px', marginBottom: 0 }}>
        {[0, 1, 2].map(i => (
          <span key={i} className={`carousel-dot ${idx === i ? 'active' : ''}`} />
        ))}
      </div>
    </article>
  );
});
FlowSection.displayName = "FlowSection";

const StabilitySection = memo(() => {
  const [idx, setIdx] = useState(0);
  return (
    <article className="panel landing-panel landing-panel-soft landing-proof-panel">
      <div className="section-head landing-section-head">
        <div>
          <p className="eyebrow">The Stability</p>
          <h2>A dashboard designed for humans.</h2>
          <p className="muted landing-panel-lede">
            Built for clarity, not complexity. No sudden balance drops, hidden fees, or spreadsheets.
          </p>
        </div>
      </div>

      <div className="landing-check-grid landing-carousel-mobile" onScroll={(e) => handleScrollState(e, setIdx, idx)}>
        <div className="landing-check-card">
          <strong>Split Anything</strong>
          <p>Rent, cabs, trips. Effortlessly handle everything from a coffee to a massive vacation.</p>
        </div>
        <div className="landing-check-card">
          <strong>Mutual Agreement</strong>
          <p>Every new entry requires both friends to approve before the math happens.</p>
        </div>
        <div className="landing-check-card">
          <strong>Lend & Return</strong>
          <p>Keep track of physical items—like tools or books—and track who has them right now.</p>
        </div>
        <div className="landing-check-card">
          <strong>Settle Up Instantly</strong>
          <p>Log a payment the second your friend pays you back, bringing your balance to zero.</p>
        </div>
      </div>
      <div className="landing-carousel-tray mobile-only" style={{ marginTop: '20px', marginBottom: 0 }}>
        {[0, 1, 2, 3].map(i => (
          <span key={i} className={`carousel-dot ${idx === i ? 'active' : ''}`} />
        ))}
      </div>
    </article>
  );
});
StabilitySection.displayName = "StabilitySection";

interface FnbLandingProps {
  onSignIn: () => void;
}

export default function FnbLanding({ onSignIn }: FnbLandingProps) {
  return (
    <>
      <style>{`
        html, body {
          overflow-y: hidden !important;
          height: 100% !important;
          position: fixed !important;
          width: 100% !important;
          overscroll-behavior-y: none !important;
        }
      `}</style>

      <LandingWaterfallScene />

      <div aria-hidden="true" className="landing-world">
        <div className="landing-world-side landing-world-left">
          <LandingBearScene />
        </div>
      </div>

      <div className="landing-scroll-viewport" style={{ 
        position: 'absolute', inset: 0, width: '100%', height: '100dvh', overflowY: 'auto', zIndex: 10, WebkitOverflowScrolling: 'touch' 
      }}>
        <main className="shell landing-shell">
          <section className="hero landing-hero">
            <div className="landing-hero-copy" style={{ animation: "entrance-up 1s cubic-bezier(0.2, 0.8, 0.2, 1) calc(var(--delay, 0s) + 0.1s) backwards" }}>
              <p className="eyebrow">F&B</p>
              <h1 className="landing-title">
                <span>Track</span>
                <span>shared</span>
                <span>money</span>
                <span>without</span>
                <span>making</span>
                <span>friendships</span>
                <span>awkward.</span>
              </h1>
              <p className="lede">
                F&B keeps every split, payback, and approval in one place so both
                sides always see the same story.
              </p>

              <div className="landing-cta-stack">
                <button
                  className="primary-button landing-google-button"
                  onClick={onSignIn}
                  type="button"
                >
                  Continue with Google
                </button>
                <div className="landing-inline-features">
                  <span>Private by username</span>
                  <span className="dot-separator" />
                  <span>No phone syncing</span>
                </div>
              </div>
            </div>

            <HeroPreviewCarousel />
          </section>

          <div className="landing-scroll-cue">
            <span className="landing-scroll-dot" />
            Scroll the flow
          </div>

          <section className="landing-grid">
            <FlowSection />
            <StabilitySection />
          </section>
        </main>
      </div>
    </>
  );
}
