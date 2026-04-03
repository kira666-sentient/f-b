"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useRef, useState } from "react";
import type { Profile, Friendship, SharedItem } from "@/lib/app-types";
import type { FriendSummary, ActivityItem } from "@/lib/types";
import {
  canApproveSharedItem,
  formatCurrency,
  formatDateTime,
  getSharedItemCounterpartyId,
  isSharedItemBorrower
} from "@/lib/helpers";
import { Avatar, PersonIdentity, RefreshIcon } from "./ui";

export type WeatherSceneTone =
  | "clear-day"
  | "clear-night"
  | "cloudy-day"
  | "cloudy-night"
  | "rain-day"
  | "rain-night"
  | "storm";

export type DesktopWeatherData = {
  locationLabel: string;
  sourceLabel: string;
  conditionLabel: string;
  temperatureC: number | null;
  apparentTemperatureC: number | null;
  humidity: number | null;
  windKph: number | null;
  highC: number | null;
  lowC: number | null;
  sunrise: string | null;
  sunset: string | null;
  updatedAtLabel: string;
  isDay: boolean;
  tone: WeatherSceneTone;
};

export type DesktopNavItem = {
  id: string;
  label: string;
  shortLabel: string;
  hint: string;
};

export interface TopbarProps {
  onOpenSidebar: () => void;
  onOpenAbout: () => void;
}

export function Topbar({ onOpenSidebar, onOpenAbout }: TopbarProps) {
  return (
    <section className="topbar app-topbar">
      <button className="mobile-only mobile-logo-button" onClick={onOpenSidebar} type="button">
        <img className="brand-logo mobile-brand-logo" src="/fnb-logo.svg" alt="F&B" />
      </button>
      <div className="topbar-main desktop-only">
        <div className="identity-lockup topbar-lockup">
          <img className="brand-logo" src="/fnb-logo.svg" alt="F&B logo" />
          <div className="brand-copy">
            <h1 className="app-title topbar-title">Friends &amp; Benefits</h1>
          </div>
        </div>
      </div>
      <h1 className="app-title mobile-only mobile-topbar-title">Friends &amp; Benefits</h1>
      <button className="help-icon-button" onClick={onOpenAbout} title="How to use and About" type="button">?</button>
    </section>
  );
}

export interface ProfileStripProps {
  profile: Profile | null;
  userEmail: string;
  refreshing: boolean;
  onEditProfile: () => void;
  onRefresh: () => void;
  onSignOut: () => void;
}

export function ProfileStrip(props: ProfileStripProps) {
  const { profile, userEmail, refreshing, onEditProfile, onRefresh, onSignOut } = props;

  return (
    <section className="profile-strip desktop-only">
      <div className="profile-strip-identity">
        <Avatar profile={profile} size="medium" />
        <div className="profile-strip-copy">
          <span className="profile-label">Your profile</span>
          <strong>{profile?.full_name ?? userEmail}</strong>
          <p>@{profile?.username ?? "not-set"}</p>
        </div>
      </div>
      <div className="profile-strip-actions">
        <button className="primary-button profile-strip-button" onClick={onEditProfile} type="button">Edit profile</button>
        <button aria-busy={refreshing} aria-label={refreshing ? "Refreshing data" : "Refresh data"} className={`ghost-button topbar-icon-button refresh-button ${refreshing ? "button-is-loading" : ""}`} onClick={onRefresh} disabled={refreshing} title="Refresh" type="button">
          <RefreshIcon />
        </button>
        <button className="ghost-button danger-ghost-button topbar-compact-button topbar-signout-button" onClick={onSignOut} type="button">Sign out</button>
      </div>
    </section>
  );
}

export interface StatGridProps {
  friendCount: number;
  totalOwedToYou: number;
  totalYouOwe: number;
  pendingCount: number;
  incomingInvites: Friendship[];
  outgoingInvites: Friendship[];
  onOpenFriends: () => void;
  onOpenApprovals: () => void;
}

export function StatGrid(props: StatGridProps) {
  const { friendCount, totalOwedToYou, totalYouOwe, pendingCount, incomingInvites, outgoingInvites, onOpenFriends, onOpenApprovals } = props;
  const totalInviteCount = incomingInvites.length + outgoingInvites.length;
  const hasInviteSignal = totalInviteCount > 0;
  const hasPendingSignal = pendingCount > 0;

  return (
    <section className="stat-grid desktop-only">
      <button className={`stat-card stat-card-action stat-card-button ${hasInviteSignal ? "stat-card-signal" : ""}`} onClick={onOpenFriends} type="button">
        <div className="stat-card-copy">
          <span className="stat-card-label">Total friends</span>
          <strong className="stat-card-value">{friendCount}</strong>
        </div>
        <div className="stat-card-side">
          {hasInviteSignal ? (
            <span className="stat-card-badge">
              {totalInviteCount} invite{totalInviteCount === 1 ? "" : "s"}
            </span>
          ) : null}
          <span className="stat-card-hint">View invites</span>
        </div>
      </button>

      <article className="stat-card success"><span className="stat-card-label">They owe you</span><strong className="stat-card-value">{formatCurrency(totalOwedToYou)}</strong></article>

      <article className="stat-card warning"><span className="stat-card-label">You owe</span><strong className="stat-card-value">{formatCurrency(totalYouOwe)}</strong></article>

      <article className={`stat-card stat-card-action ${hasPendingSignal ? "stat-card-signal" : ""}`} onClick={onOpenApprovals}>
        <span className="stat-card-label">Pending approvals</span><strong className="stat-card-value">{pendingCount}</strong>
      </article>
    </section>
  );
}

export interface DashboardGridProps {
  balances: FriendSummary[];
  selectedFriendId: string;
  isInviteFormOpen: boolean;
  setIsInviteFormOpen: (v: boolean) => void;
  inviteUsername: string;
  setInviteUsername: (v: string) => void;
  onSendInvite: () => void;
  mutating: boolean;
  onViewStatement: (friendId: string) => void;
  onOpenDebt: () => void;
  onOpenSettlement: () => void;
  onOpenItemsDialog: () => void;
  sharedItems: SharedItem[];
  profiles: Profile[];
  userId: string;
  onCancelItem: (id: string) => void;
  onRequestReturn: (id: string, e?: React.MouseEvent) => void;
  onOpenApprovals: () => void;
  onOpenFullItems: () => void;
  networkSectionRef?: React.RefObject<HTMLElement | null>;
  moneySectionRef?: React.RefObject<HTMLElement | null>;
  itemsSectionRef?: React.RefObject<HTMLElement | null>;
}

export function DashboardGrid(props: DashboardGridProps) {
  const { balances, selectedFriendId, isInviteFormOpen, setIsInviteFormOpen, inviteUsername, setInviteUsername, onSendInvite, mutating, onViewStatement, onOpenDebt, onOpenSettlement, onOpenItemsDialog, sharedItems, profiles, userId, onCancelItem, onRequestReturn, onOpenApprovals, onOpenFullItems, networkSectionRef, moneySectionRef, itemsSectionRef } = props;
  const rightColumnRef = useRef<HTMLDivElement | null>(null);
  const [matchedColumnHeight, setMatchedColumnHeight] = useState<number | null>(null);

  useEffect(() => {
    const column = rightColumnRef.current;
    if (!column) return;

    const updateHeight = () => {
      setMatchedColumnHeight(Math.ceil(column.getBoundingClientRect().height));
    };

    updateHeight();

    const observer = new ResizeObserver(() => updateHeight());
    observer.observe(column);
    window.addEventListener("resize", updateHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

  return (
    <section className="dashboard-grid desktop-only">
      <div className="dashboard-column" style={matchedColumnHeight ? { height: `${matchedColumnHeight}px` } : undefined}>
        <article className="panel panel-network" ref={networkSectionRef}>
          <div className="section-head">
            <div>
              <h2>Your network</h2>
              <p className="muted">Friends and current balances stay organized here.</p>
            </div>
          </div>
          <section className="subpanel network-friends-subpanel">
            <div className="subpanel-head network-friends-toolbar">
              <div className="subpanel-head-main">
                <h3>Your friends</h3>
                <button className="ghost-button subpanel-icon-button" onClick={() => setIsInviteFormOpen(!isInviteFormOpen)} title="Invite a new friend" type="button">{isInviteFormOpen ? "-" : "+"}</button>
              </div>
              <span className="count-chip">{balances.length}</span>
            </div>
          </section>

          <div className="panel-scroll panel-scroll-network">
            <div className="section-stack network-scroll-stack">
              <section className="subpanel network-friends-list">
                {isInviteFormOpen && (
                  <div className="subpanel-invite-inline network-invite-inline">
                    <span className="profile-label subpanel-label">Invite by username</span>
                    <div className="inline-form-row">
                      <input aria-label="Invite by username" value={inviteUsername} onChange={(e) => setInviteUsername(e.target.value)} placeholder="friend_username" />
                      <button className="primary-button inline-form-submit" onClick={onSendInvite} disabled={mutating} type="button">Send</button>
                    </div>
                  </div>
                )}

                {balances.length === 0 ? (
                  <p className="empty-state">No accepted friends yet.</p>
                ) : (
                  <div className="stack mini-stack">
                    {balances.map((friend) => (
                      <button className={`friend-card ${selectedFriendId === friend.profile.id ? "friend-card-active" : ""}`} key={friend.friendshipId} onClick={() => onViewStatement(friend.profile.id)} type="button">
                        <PersonIdentity profile={friend.profile} />
                        <div className="friend-card-side">
                          <span className={`amount-badge ${friend.balanceInPaise > 0 ? "positive" : friend.balanceInPaise < 0 ? "negative" : ""}`}>{formatCurrency(friend.balanceInPaise)}</span>
                          <small>View statement</small>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </section>
              <div className="network-doodle-card" aria-hidden="true">
                <div className="network-doodle-figure">
                  <span className="network-doodle-head" />
                  <span className="network-doodle-body" />
                  <span className="network-doodle-arm network-doodle-arm-left" />
                  <span className="network-doodle-arm network-doodle-arm-right" />
                  <span className="network-doodle-leg network-doodle-leg-left" />
                  <span className="network-doodle-leg network-doodle-leg-right" />
                </div>
                <div className="network-doodle-note">
                  <span className="profile-label">Quick tip</span>
                  <p>Tap any friend card to open the full statement and jump into a debt or settlement flow.</p>
                </div>
              </div>
            </div>
          </div>
        </article>
      </div>

      <div className="dashboard-column" ref={rightColumnRef}>
        <article className="panel panel-money" ref={moneySectionRef}>
          <div className="section-head">
            <div>
              <h2>Money actions</h2>
              <p className="muted">Open a focused flow for either creating a debt or recording a direct settlement.</p>
            </div>
          </div>
          <div className="action-option-grid">
            <button className="action-option-card" onClick={onOpenDebt} type="button">
              <span className="profile-label">Approval flow</span>
              <strong>Create debt</strong>
              <p>Log a shared expense or cash loan. Your friend approves it from their device.</p>
            </button>
            <button className="action-option-card" onClick={onOpenSettlement} type="button">
              <span className="profile-label">Direct payment</span>
              <strong>Record settlement</strong>
              <p>Note a payment already made outside the app so balances stay accurate.</p>
            </button>
          </div>
        </article>

        <article className="panel panel-items" ref={itemsSectionRef}>
          <div className="section-head panel-head-bordered">
            <div>
              <h2>Shared items tracker</h2>
              <p className="muted">Keep track of things you lent or borrowed.</p>
            </div>
            <button className="primary-button compact-action-button" onClick={onOpenItemsDialog} type="button">+ Log Item</button>
          </div>
          <div className="panel-scroll">
            <div className="section-stack">
              {sharedItems.length === 0 ? (
                <p className="empty-state">No shared items right now.</p>
              ) : (
                <div className="stack mini-stack">
                  {sharedItems.map((item) => (
                    <div className="list-card dense item-row-card" key={item.id}>
                      <div className="item-row-main">
                        <div className="item-row-header">
                          <strong>{item.item_name}</strong>
                          <span className={`pill pill-tiny status-${item.status}`}>{item.status.replace("_", " ")}</span>
                        </div>
                        <p className="muted item-row-copy">
                          {isSharedItemBorrower(item, userId) ? "Borrowed from" : "Lent to"} {profiles.find((p) => p.id === getSharedItemCounterpartyId(item, userId))?.full_name || "friend"}
                        </p>
                      </div>
                      <div className="row-actions item-row-actions">
                        {item.status === "pending" && item.owner_id === userId && (
                          <button className="ghost-button danger-ghost-button compact-action-button" onClick={() => onCancelItem(item.id)} type="button">Cancel</button>
                        )}
                        {item.status === "active" && (
                          isSharedItemBorrower(item, userId) ? (
                            <button className="ghost-button compact-action-button" onClick={(e) => onRequestReturn(item.id, e)} type="button">Mark returned</button>
                          ) : (
                            <span className="muted caption-text">In use</span>
                          )
                        )}
                        {item.status === "pending_return" && !canApproveSharedItem(item, userId) && (
                          <span className="pill pill-small status-pending">Return pending</span>
                        )}
                        {canApproveSharedItem(item, userId) && (
                          <div className="approval-redirect">
                            <button className="ghost-button review-link-button" onClick={onOpenApprovals} type="button">Review in Approvals -&gt;</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="panel-footer-link">
            <button className="ghost-button panel-link-button" onClick={onOpenFullItems} type="button">View All Shared Items -&gt;</button>
          </div>
        </article>
      </div>
    </section>
  );
}

export function ActivityPanel({ recentActivity, onOpenFullActivity, sectionRef }: { recentActivity: ActivityItem[]; onOpenFullActivity: () => void; sectionRef?: React.RefObject<HTMLElement | null> }) {
  const previewItems = recentActivity.slice(0, 4);

  return (
    <section className="panel activity-panel desktop-only" ref={sectionRef}>
      <div className="section-head">
        <div>
          <h2>Recent activity</h2>
          <p className="muted">Latest debts and settlements across your network.</p>
        </div>
      </div>
      {recentActivity.length === 0 ? (
        <p className="empty-state">No activity yet.</p>
      ) : (
        <div className="panel-scroll panel-scroll-activity">
          <div className="stack mini-stack activity-grid">
            {previewItems.map((item) => (
              <button className="list-card dense activity-preview-card" key={`${item.kind}-${item.id}`} onClick={onOpenFullActivity} type="button">
                <div className="person-block">
                  <PersonIdentity profile={item.profile} />
                  <strong>{item.label}</strong>
                  <p>{item.detail}</p>
                  <small>{formatDateTime(new Date(item.createdAt))}</small>
                </div>
                <div className="activity-side">
                  <span className="amount-badge neutral">{formatCurrency(item.amountInPaise)}</span>
                  <span className={`pill status-${item.status}`}>{item.status}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      {recentActivity.length > 0 ? (
        <div className="panel-footer-link">
          <button className="ghost-button panel-link-button" onClick={onOpenFullActivity} type="button">Open Full Recent Activity -&gt;</button>
        </div>
      ) : null}
    </section>
  );
}

function formatWeatherMetric(value: number | null, suffix: string) {
  return value === null ? "--" : `${Math.round(value)}${suffix}`;
}

export function DashboardAmbientBackdrop({ tone }: { tone: WeatherSceneTone }) {
  const isNight = tone.includes("night");
  const isRain = tone.includes("rain") || tone === "storm";

  return (
    <div className={`dashboard-ambient dashboard-ambient-${tone} desktop-only`} aria-hidden="true">
      <div className="dashboard-ambient-glow dashboard-ambient-glow-a" />
      <div className="dashboard-ambient-glow dashboard-ambient-glow-b" />
      <div className="dashboard-ambient-halo" />
      <div className={`dashboard-ambient-orb ${isNight ? "dashboard-ambient-moon" : "dashboard-ambient-sun"}`} />
      <div className="dashboard-ambient-cloud dashboard-ambient-cloud-a" />
      <div className="dashboard-ambient-cloud dashboard-ambient-cloud-b" />
      <div className="dashboard-ambient-cloud dashboard-ambient-cloud-c" />
      {isNight ? (
        <div className="dashboard-ambient-stars">
          {Array.from({ length: 10 }).map((_, index) => (
            <span className={`dashboard-star dashboard-star-${(index % 5) + 1}`} key={index} />
          ))}
        </div>
      ) : null}
      {isRain ? (
        <div className="dashboard-ambient-rain">
          {Array.from({ length: tone === "storm" ? 18 : 12 }).map((_, index) => (
            <span className={`dashboard-rain-drop dashboard-rain-drop-${(index % 6) + 1}`} key={index} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function DesktopWeatherRail({ weather }: { weather: DesktopWeatherData }) {
  return (
    <aside className="dashboard-side-rail weather-rail desktop-only" data-tone={weather.tone}>
      <div className="dashboard-side-card weather-side-card">
        <div className="weather-side-head">
          <span className="profile-label">Weather mood</span>
          <small>{weather.sourceLabel}</small>
        </div>
        <div className="weather-temp-line">
          <strong>{weather.temperatureC === null ? "--" : `${Math.round(weather.temperatureC)}°`}</strong>
          <span>{weather.conditionLabel}</span>
        </div>
        <p className="weather-location">{weather.locationLabel}</p>
        <div className="weather-summary-pill">
          <span>Feels like</span>
          <strong>{formatWeatherMetric(weather.apparentTemperatureC, "°")}</strong>
        </div>
        <div className="weather-detail-grid">
          <div className="weather-detail-row">
            <span>Humidity</span>
            <strong>{formatWeatherMetric(weather.humidity, "%")}</strong>
          </div>
          <div className="weather-detail-row">
            <span>Wind</span>
            <strong>{formatWeatherMetric(weather.windKph, " km/h")}</strong>
          </div>
          <div className="weather-detail-row">
            <span>High</span>
            <strong>{formatWeatherMetric(weather.highC, "°")}</strong>
          </div>
          <div className="weather-detail-row">
            <span>Low</span>
            <strong>{formatWeatherMetric(weather.lowC, "°")}</strong>
          </div>
          <div className="weather-detail-row">
            <span>Sunrise</span>
            <strong>{weather.sunrise ?? "--"}</strong>
          </div>
          <div className="weather-detail-row">
            <span>Sunset</span>
            <strong>{weather.sunset ?? "--"}</strong>
          </div>
        </div>
        <div className="weather-side-foot">
          <small>Updated {weather.updatedAtLabel}</small>
        </div>
      </div>
    </aside>
  );
}

export function MagicSectionNav({
  items,
  activeId,
  onNavigate
}: {
  items: DesktopNavItem[];
  activeId: string;
  onNavigate: (id: string) => void;
}) {
  return (
    <aside className="dashboard-side-rail magic-nav-rail desktop-only">
      <nav className="dashboard-side-card magic-nav-card" aria-label="Dashboard sections">
        <div className="magic-nav-head">
          <span className="profile-label">Quick glide</span>
          <p className="muted">Jump across the dashboard.</p>
        </div>
        <div className="magic-nav-list">
          {items.map((item) => (
            <button
              className={`magic-nav-button ${activeId === item.id ? "magic-nav-button-active" : ""}`}
              key={item.id}
              onClick={() => onNavigate(item.id)}
              type="button"
            >
              <span className="magic-nav-chip">{item.shortLabel}</span>
              <span className="magic-nav-copy">
                <strong>{item.label}</strong>
                <small>{item.hint}</small>
              </span>
            </button>
          ))}
        </div>
      </nav>
    </aside>
  );
}
