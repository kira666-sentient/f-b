"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Profile, Friendship, DebtRequest, Settlement, SharedItem } from "@/lib/app-types";
import type { FriendSummary, ActivityItem } from "@/lib/types";
import {
  canApproveSharedItem,
  formatCurrency,
  formatDateTime,
  formatDateOnly,
  getSharedItemCounterpartyId,
  getSharedItemRequesterId,
  isSharedItemBorrower,
  readableProfile
} from "@/lib/helpers";
import type { DesktopWeatherData } from "./desktop-views";
import { Avatar, PersonIdentity } from "./ui";

export type MobileDashboardSection = "home" | "network" | "approvals" | "money" | "items" | "activity";

function readSectionFromHash(): MobileDashboardSection | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash || "";
  const match = hash.match(/(?:^#|#)dash-mobile=([^&]+)/);
  const raw = match?.[1];
  if (!raw) return null;
  const normalized = raw.trim() as MobileDashboardSection;
  const allowed: MobileDashboardSection[] = ["home", "network", "approvals", "money", "items", "activity"];
  return allowed.includes(normalized) ? normalized : null;
}

function writeSectionToHash(section: MobileDashboardSection) {
  const nextHash = `#dash-mobile=${section}`;
  if (typeof window === "undefined") return;
  if (window.location.hash === nextHash) return;
  // Use replaceState so section navigation does not spam history; back handling is managed separately.
  window.history.replaceState(null, "", nextHash);
}

function computeBackPriority(params: {
  isAboutDialogOpen: boolean;
  isFriendsDialogOpen: boolean;
  isFullItemsDialogOpen: boolean;
  isItemsDialogOpen: boolean;
  isRecentActivityDialogOpen: boolean;
  isSettlementDialogOpen: boolean;
  isDebtDialogOpen: boolean;
  isStatementDialogOpen: boolean;
  isProfileDialogOpen: boolean;
  isApprovalsDialogOpen: boolean;
  isInviteFormOpen: boolean;
  isSidebarOpen: boolean;
  isSubPage: boolean;
}): "about" | "friends" | "fullItems" | "items" | "recentActivity" | "settlement" | "debt" | "statement" | "profile" | "approvals" | "inviteForm" | "sidebar" | "section" | null {
  const {
    isAboutDialogOpen,
    isFriendsDialogOpen,
    isFullItemsDialogOpen,
    isItemsDialogOpen,
    isRecentActivityDialogOpen,
    isSettlementDialogOpen,
    isDebtDialogOpen,
    isStatementDialogOpen,
    isProfileDialogOpen,
    isApprovalsDialogOpen,
    isInviteFormOpen,
    isSidebarOpen,
    isSubPage
  } = params;

  if (isAboutDialogOpen) return "about";
  if (isFriendsDialogOpen) return "friends";
  if (isFullItemsDialogOpen) return "fullItems";
  if (isItemsDialogOpen) return "items";
  if (isRecentActivityDialogOpen) return "recentActivity";
  if (isSettlementDialogOpen) return "settlement";
  if (isDebtDialogOpen) return "debt";
  if (isStatementDialogOpen) return "statement";
  if (isProfileDialogOpen) return "profile";
  if (isApprovalsDialogOpen) return "approvals";
  if (isInviteFormOpen) return "inviteForm";
  if (isSidebarOpen) return "sidebar";
  if (isSubPage) return "section";
  return null;
}

export interface MobileDashboardV2Props {
  // Data
  profile: Profile | null;
  weather: DesktopWeatherData;

  balances: FriendSummary[];
  profilesById: Map<string, Profile>;
  incomingInvites: Friendship[];
  outgoingInvites: Friendship[];

  pendingApprovals: DebtRequest[];
  pendingSettlements: Settlement[];
  pendingItems: SharedItem[];

  sharedItems: SharedItem[];
  profiles: Profile[];
  userId: string;

  // Counts
  totalOwedToYou: number;
  totalYouOwe: number;
  pendingCount: number;
  pendingItemsCount: number;
  balancesCount: number;
  recentActivityCount: number;
  sharedItemsCount: number;

  // Recent
  recentActivity: ActivityItem[];

  // Sidebar control
  isSidebarOpen: boolean;
  onOpenSidebar: () => void;
  onCloseSidebar: () => void;

  // Invite draft + mutation
  inviteUsername: string;
  setInviteUsername: (v: string) => void;
  mutating: boolean;

  // Navigation-triggered actions
  onSendInvite: () => void;
  onRespondInvite: (id: string, accept: boolean) => void;
  onViewStatement: (friendId: string) => void;

  onRespondDebt: (id: string, approve: boolean) => void;
  onRespondSettlement: (id: string, approve: boolean) => void;
  onRespondItem: (id: string, action: "approve" | "reject" | "return_confirm") => void;

  onOpenDebt: () => void;
  onOpenSettlement: () => void;
  onOpenItemsDialog: () => void;

  onCancelItem: (id: string) => void;
  onRequestReturn: (id: string, e?: React.MouseEvent) => void;

  // Sidebar actions
  onOpenProfileDialog: () => void;
  onRefresh: () => void;
  onSignOut: () => void;

  // Overlay state for Android back handling
  isInviteFormOpen: boolean;
  isApprovalsDialogOpen: boolean;
  isRecentActivityDialogOpen: boolean;
  isProfileDialogOpen: boolean;
  isStatementDialogOpen: boolean;
  isDebtDialogOpen: boolean;
  isSettlementDialogOpen: boolean;
  isItemsDialogOpen: boolean;
  isAboutDialogOpen: boolean;
  isFullItemsDialogOpen: boolean;
  isFriendsDialogOpen: boolean;

  onCloseInviteForm: () => void;
  onCloseApprovalsDialog: () => void;
  onCloseRecentActivityDialog: () => void;
  onCloseProfileDialog: () => void;
  onCloseStatementDialog: () => void;
  onCloseDebtDialog: () => void;
  onCloseSettlementDialog: () => void;
  onCloseItemsDialog: () => void;
  onCloseAboutDialog: () => void;
  onCloseFullItemsDialog: () => void;
  onCloseFriendsDialog: () => void;
}

function formatWeatherMetric(value: number | null, suffix: string) {
  return value === null ? "--" : `${Math.round(value)}${suffix}`;
}

function MobileSidebarV2(props: {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile | null;
  totalOwedToYou: number;
  totalYouOwe: number;
  onOpenProfile: () => void;
  onRefresh: () => void;
  onSignOut: () => void;
}) {
  if (!props.isOpen) return null;
  const { onClose, profile, totalOwedToYou, totalYouOwe, onOpenProfile, onRefresh, onSignOut } = props;

  return (
    <div className="mobile-only">
      <div className="mobile-sidebar-backdrop" onClick={onClose} role="presentation" />
      <aside className="mobile-sidebar" onClick={(e) => e.stopPropagation()}>
        <div className="mobile-sidebar-header">
          <img className="mobile-sidebar-logo" src="/fnb-logo.svg" alt="F&B" />
          <button className="ghost-button mobile-sidebar-close" onClick={onClose} type="button">
            Close
          </button>
        </div>
        <div className="mobile-sidebar-profile">
          <Avatar profile={profile} size="medium" />
          <div>
            <strong>{readableProfile(profile)}</strong>
            <p className="muted mobile-sidebar-username">@{profile?.username ?? "not-set"}</p>
          </div>
        </div>
        <div className="mobile-sidebar-stats">
          <div className="mobile-sidebar-stat owed-to-you">
            <span>They owe you</span>
            <strong>{formatCurrency(totalOwedToYou)}</strong>
          </div>
          <div className="mobile-sidebar-stat you-owe">
            <span>You owe</span>
            <strong>{formatCurrency(totalYouOwe)}</strong>
          </div>
        </div>
        <div className="mobile-sidebar-nav">
          <button
            className="ghost-button"
            onClick={() => {
              onClose();
              onOpenProfile();
            }}
            type="button"
          >
            Profile and UPI setup
          </button>
          <button
            className="ghost-button"
            onClick={() => {
              onClose();
              onRefresh();
            }}
            type="button"
          >
            Refresh data
          </button>
          <button className="ghost-button danger-ghost-button" onClick={onSignOut} type="button">
            Sign out
          </button>
        </div>
      </aside>
    </div>
  );
}

function MobileHomeV2(props: {
  profile: Profile | null;
  pendingCount: number;
  pendingItemsCount: number;
  balancesCount: number;
  recentActivityCount: number;
  sharedItemsCount: number;
  totalOwedToYou: number;
  totalYouOwe: number;
  weather: DesktopWeatherData;
  onNavigate: (page: Exclude<MobileDashboardSection, "home">) => void;
  onOpenSidebar: () => void;
}) {
  const {
    profile,
    pendingCount,
    pendingItemsCount,
    balancesCount,
    recentActivityCount,
    sharedItemsCount,
    totalOwedToYou,
    totalYouOwe,
    weather,
    onNavigate,
    onOpenSidebar
  } = props;

  return (
    <section className="mobile-home-shell mobile-only">
      <header className="mobile-welcome mobile-only">
        <div className="mobile-welcome-text">
          <h2>Hello, {profile?.full_name?.split(" ")[0] || "Friend"}</h2>
          <p className="muted">You have {pendingCount} items to review.</p>
        </div>
        <button className="mobile-welcome-avatar" onClick={onOpenSidebar} type="button" aria-label="Open sidebar">
          <Avatar profile={profile} size="medium" />
        </button>
      </header>

      <div className="mobile-balance-strip">
        <article className="mobile-balance-card mobile-balance-positive">
          <span>They owe you</span>
          <strong>{formatCurrency(totalOwedToYou)}</strong>
        </article>
        <article className="mobile-balance-card mobile-balance-negative">
          <span>You owe</span>
          <strong>{formatCurrency(totalYouOwe)}</strong>
        </article>
      </div>

      <article className="mobile-weather-card" data-tone={weather.tone}>
        <div className="mobile-weather-head">
          <div>
            <span className="profile-label">Weather mood</span>
            <h3>{weather.locationLabel}</h3>
          </div>
          <span className="mobile-weather-source">{weather.sourceLabel}</span>
        </div>
        <div className="mobile-weather-main">
          <div className="mobile-weather-temp">
            <strong>{weather.temperatureC === null ? "--" : `${Math.round(weather.temperatureC)}°`}</strong>
            <p>{weather.conditionLabel}</p>
          </div>
          <div className="mobile-weather-summary">
            <div>
              <span>Feels like</span>
              <strong>{formatWeatherMetric(weather.apparentTemperatureC, "°")}</strong>
            </div>
            <div>
              <span>High / Low</span>
              <strong>{`${formatWeatherMetric(weather.highC, "°")} / ${formatWeatherMetric(weather.lowC, "°")}`}</strong>
            </div>
          </div>
        </div>
        <div className="mobile-weather-grid">
          <div className="mobile-weather-stat">
            <span>Humidity</span>
            <strong>{formatWeatherMetric(weather.humidity, "%")}</strong>
          </div>
          <div className="mobile-weather-stat">
            <span>Wind</span>
            <strong>{formatWeatherMetric(weather.windKph, " km/h")}</strong>
          </div>
          <div className="mobile-weather-stat">
            <span>Sunrise</span>
            <strong>{weather.sunrise ?? "--"}</strong>
          </div>
          <div className="mobile-weather-stat">
            <span>Sunset</span>
            <strong>{weather.sunset ?? "--"}</strong>
          </div>
        </div>
        <p className="mobile-weather-updated">Updated {weather.updatedAtLabel}</p>
      </article>

      <div className="mobile-home-grid">
        <button className="mobile-nav-card" onClick={() => onNavigate("network")} type="button">
          <span className="nav-card-icon">NW</span>
          <span className="nav-card-label">Your Network</span>
          <span className="nav-card-badge">{balancesCount} friends</span>
        </button>
        <button className="mobile-nav-card" onClick={() => onNavigate("approvals")} type="button">
          <span className="nav-card-icon">AP</span>
          <span className="nav-card-label">Approvals</span>
          <span className="nav-card-badge">{pendingCount} pending</span>
        </button>
        <button className="mobile-nav-card" onClick={() => onNavigate("money")} type="button">
          <span className="nav-card-icon">RS</span>
          <span className="nav-card-label">Money Actions</span>
        </button>
        <button className="mobile-nav-card" onClick={() => onNavigate("activity")} type="button">
          <span className="nav-card-icon">LG</span>
          <span className="nav-card-label">Activity</span>
          <span className="nav-card-badge">{recentActivityCount}</span>
        </button>
        <button className="mobile-nav-card items-card" onClick={() => onNavigate("items")} type="button">
          <span className="nav-card-icon">IT</span>
          <span className="nav-card-label">Item Tracker</span>
          <span className="nav-card-badge">
            {pendingItemsCount > 0 ? `${pendingItemsCount} review` : `${sharedItemsCount} items`}
          </span>
        </button>
      </div>
    </section>
  );
}

function MobileNetworkPageV2(props: {
  balances: FriendSummary[];
  inviteUsername: string;
  setInviteUsername: (v: string) => void;
  onSendInvite: () => void;
  mutating: boolean;
  incomingInvites: Friendship[];
  outgoingInvites: Friendship[];
  profilesById: Map<string, Profile>;
  onViewStatement: (friendId: string) => void;
  onRespondInvite: (id: string, accept: boolean) => void;
  onBack: () => void;
}) {
  const {
    balances,
    inviteUsername,
    setInviteUsername,
    onSendInvite,
    mutating,
    incomingInvites,
    outgoingInvites,
    profilesById,
    onViewStatement,
    onRespondInvite,
    onBack
  } = props;

  return (
    <div className="mobile-page mobile-only">
      <div className="mobile-page-header">
        <button className="mobile-back-btn" onClick={onBack} type="button">
          Back
        </button>
        <h2>Your Network</h2>
      </div>
      <div className="mobile-page-content">
        <section className="mobile-section">
          <span className="profile-label subpanel-label">Invite by username</span>
          <div className="inline-form-row">
            <input
              aria-label="Invite by username"
              value={inviteUsername}
              onChange={(e) => setInviteUsername(e.target.value)}
              placeholder="friend_username"
            />
            <button
              className="primary-button inline-form-submit"
              onClick={onSendInvite}
              disabled={mutating}
              type="button"
            >
              Send
            </button>
          </div>
        </section>

        <section className="mobile-section">
          <h3 className="mobile-section-title">
            Your friends <span className="count-chip">{balances.length}</span>
          </h3>
          {balances.length === 0 ? (
            <p className="empty-state">No accepted friends yet.</p>
          ) : (
            <div className="stack mini-stack">
              {balances.map((friend) => (
                <button className="friend-card" key={friend.friendshipId} onClick={() => onViewStatement(friend.profile.id)} type="button">
                  <PersonIdentity profile={friend.profile} />
                  <div className="friend-card-side">
                    <span
                      className={`amount-badge ${
                        friend.balanceInPaise > 0 ? "positive" : friend.balanceInPaise < 0 ? "negative" : ""
                      }`}
                    >
                      {formatCurrency(friend.balanceInPaise)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="mobile-section">
          <h3 className="mobile-section-title">
            Incoming invites <span className="count-chip">{incomingInvites.length}</span>
          </h3>
          {incomingInvites.length === 0 ? (
            <p className="empty-state">No incoming invites right now.</p>
          ) : (
            <div className="stack mini-stack">
              {incomingInvites.map((invite) => (
                <div className="list-card" key={invite.id}>
                  <PersonIdentity profile={profilesById.get(invite.requester_id)} />
                  <div className="row-actions">
                    <button
                      className="primary-button compact-action-button"
                      onClick={() => onRespondInvite(invite.id, true)}
                      disabled={mutating}
                      type="button"
                    >
                      Accept
                    </button>
                    <button
                      className="ghost-button compact-action-button"
                      onClick={() => onRespondInvite(invite.id, false)}
                      disabled={mutating}
                      type="button"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mobile-section">
          <h3 className="mobile-section-title">
            Outgoing invites <span className="count-chip">{outgoingInvites.length}</span>
          </h3>
          {outgoingInvites.length === 0 ? (
            <p className="empty-state">No pending invites sent.</p>
          ) : (
            <div className="stack mini-stack">
              {outgoingInvites.map((invite) => (
                <div className="list-card" key={invite.id}>
                  <PersonIdentity profile={profilesById.get(invite.addressee_id)} />
                  <span className="pill">Waiting</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function MobileApprovalsPageV2(props: {
  pendingApprovals: DebtRequest[];
  pendingSettlements: Settlement[];
  pendingItems: SharedItem[];
  profilesById: Map<string, Profile>;
  mutating: boolean;
  onRespondDebt: (id: string, approve: boolean) => void;
  onRespondSettlement: (id: string, approve: boolean) => void;
  onRespondItem: (id: string, action: "approve" | "reject" | "return_confirm") => void;
  onBack: () => void;
}) {
  const { pendingApprovals, pendingSettlements, pendingItems, profilesById, mutating, onRespondDebt, onRespondSettlement, onRespondItem, onBack } = props;

  return (
    <div className="mobile-page mobile-only">
      <div className="mobile-page-header">
        <button className="mobile-back-btn" onClick={onBack} type="button">
          Back
        </button>
        <h2>Pending Approvals</h2>
      </div>
      <div className="mobile-page-content">
        {pendingApprovals.length === 0 && pendingSettlements.length === 0 && pendingItems.length === 0 ? (
          <div className="mobile-empty-card">
            <p className="empty-state">No approvals waiting for you.</p>
          </div>
        ) : (
          <div className="mobile-page-stack">
            {pendingApprovals.length > 0 ? (
              <section className="mobile-section">
                <h3 className="mobile-section-title">
                  Debt requests <span className="count-chip">{pendingApprovals.length}</span>
                </h3>
                <div className="stack mini-stack">
                  {pendingApprovals.map((request) => (
                    <article className="mobile-list-card mobile-approval-card" key={request.id}>
                      <div className="mobile-card-copy">
                        <PersonIdentity profile={profilesById.get(request.creator_id)} />
                        <p className="mobile-card-title">
                          {formatCurrency(request.amount_in_paise)} for {request.reason}
                        </p>
                        <small>
                          Debt date {formatDateOnly(new Date(request.debt_date))} · Due {formatDateOnly(new Date(request.due_at ?? new Date().toISOString()))}
                        </small>
                      </div>
                      <div className="mobile-card-actions">
                        <button
                          className="primary-button compact-action-button"
                          onClick={() => onRespondDebt(request.id, true)}
                          disabled={mutating}
                          type="button"
                        >
                          Approve
                        </button>
                        <button
                          className="ghost-button compact-action-button"
                          onClick={() => onRespondDebt(request.id, false)}
                          disabled={mutating}
                          type="button"
                        >
                          Reject
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {pendingSettlements.length > 0 ? (
              <section className="mobile-section">
                <h3 className="mobile-section-title">
                  Settlements <span className="count-chip">{pendingSettlements.length}</span>
                </h3>
                <div className="stack mini-stack">
                  {pendingSettlements.map((settlement) => (
                    <article className="mobile-list-card mobile-approval-card" key={settlement.id}>
                      <div className="mobile-card-copy">
                        <PersonIdentity profile={profilesById.get(settlement.payer_id)} />
                        <p className="mobile-card-title">{formatCurrency(settlement.amount_in_paise)} payment</p>
                        <small>{settlement.note || "No note"}</small>
                      </div>
                      <div className="mobile-card-actions">
                        <button
                          className="primary-button compact-action-button"
                          onClick={() => onRespondSettlement(settlement.id, true)}
                          disabled={mutating}
                          type="button"
                        >
                          Approve
                        </button>
                        <button
                          className="ghost-button compact-action-button"
                          onClick={() => onRespondSettlement(settlement.id, false)}
                          disabled={mutating}
                          type="button"
                        >
                          Reject
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {pendingItems.length > 0 ? (
              <section className="mobile-section">
                <h3 className="mobile-section-title">
                  Shared items <span className="count-chip">{pendingItems.length}</span>
                </h3>
                <div className="stack mini-stack">
                  {pendingItems.map((item) => {
                    const isReturn = item.status === "pending_return";
                    const actor = profilesById.get(getSharedItemRequesterId(item));
                    return (
                      <article className="mobile-list-card mobile-approval-card" key={item.id}>
                        <div className="mobile-card-copy">
                          <PersonIdentity profile={actor ?? null} />
                          <p className="mobile-card-title">{item.item_name}</p>
                          <small>
                            {actor ? (isReturn ? `${readableProfile(actor)} marked this as returned.` : `${readableProfile(actor)} logged this item for your approval.`) : ""}
                          </small>
                        </div>
                        <div className="mobile-card-actions">
                          <button
                            className="primary-button compact-action-button"
                            onClick={() => onRespondItem(item.id, isReturn ? "return_confirm" : "approve")}
                            disabled={mutating}
                            type="button"
                          >
                            {isReturn ? "Confirm" : "Approve"}
                          </button>
                          <button
                            className="ghost-button compact-action-button"
                            onClick={() => onRespondItem(item.id, "reject")}
                            disabled={mutating}
                            type="button"
                          >
                            Reject
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function MobileMoneyPageV2(props: { onOpenDebt: () => void; onOpenSettlement: () => void; onBack: () => void }) {
  const { onOpenDebt, onOpenSettlement, onBack } = props;

  return (
    <div className="mobile-page mobile-only">
      <div className="mobile-page-header">
        <button className="mobile-back-btn" onClick={onBack} type="button">
          Back
        </button>
        <h2>Money Actions</h2>
      </div>
      <div className="mobile-page-content">
        <div className="mobile-action-grid">
          <button className="action-option-card" onClick={onOpenDebt} type="button">
            <span className="profile-label">Approval flow</span>
            <strong>Create debt</strong>
            <p>Log a shared expense or cash loan. Your friend approves it from their side.</p>
          </button>
          <button className="action-option-card" onClick={onOpenSettlement} type="button">
            <span className="profile-label">Direct payment</span>
            <strong>Record settlement</strong>
            <p>Note a payment already made outside the app so balances stay accurate.</p>
          </button>
        </div>
      </div>
    </div>
  );
}

function MobileItemsPageV2(props: {
  sharedItems: SharedItem[];
  profiles: Profile[];
  userId: string;
  pendingItemsCount: number;
  onOpenItemsDialog: () => void;
  onOpenApprovals: () => void;
  onCancelItem: (id: string) => void;
  onRequestReturn: (id: string, e?: React.MouseEvent) => void;
  onBack: () => void;
}) {
  const { sharedItems, profiles, userId, pendingItemsCount, onOpenItemsDialog, onOpenApprovals, onCancelItem, onRequestReturn, onBack } = props;

  return (
    <div className="mobile-page mobile-only">
      <div className="mobile-page-header">
        <button className="mobile-back-btn" onClick={onBack} type="button">
          Back
        </button>
        <h2>Shared Items</h2>
        <button className="ghost-button mobile-page-add-button" onClick={onOpenItemsDialog} type="button" aria-label="Log shared item">
          +
        </button>
      </div>
      <div className="mobile-page-content">
        {pendingItemsCount > 0 ? (
          <div className="mobile-inline-callout">
            <div>
              <strong>
                {pendingItemsCount} item approval{pendingItemsCount === 1 ? "" : "s"} waiting
              </strong>
              <p className="muted">Open approvals to confirm new items or returned ones.</p>
            </div>
            <button className="primary-button compact-action-button" onClick={onOpenApprovals} type="button">
              Open
            </button>
          </div>
        ) : null}

        {sharedItems.length === 0 ? (
          <div className="mobile-empty-card">
            <p className="empty-state">No shared items tracked.</p>
          </div>
        ) : (
          <div className="stack mini-stack">
            {sharedItems.map((item) => {
              const counterparty = profiles.find((profile) => profile.id === getSharedItemCounterpartyId(item, userId));
              const needsApproval = canApproveSharedItem(item, userId);
              const borrower = isSharedItemBorrower(item, userId);
              const detail =
                item.status === "pending"
                  ? item.owner_id === userId
                    ? `Waiting for ${readableProfile(counterparty)} to approve this record.`
                    : `${readableProfile(counterparty)} wants your confirmation.`
                  : item.status === "pending_return"
                    ? needsApproval
                      ? `${readableProfile(counterparty)} marked this as returned.`
                      : "Return confirmation is in flight."
                    : item.status === "active"
                      ? borrower
                        ? "You are currently holding this item."
                        : `${readableProfile(counterparty)} is currently holding this item.`
                      : item.status === "returned"
                        ? "This item has been marked as returned."
                        : "This request was rejected.";

              return (
                <article className="mobile-list-card mobile-item-card" key={item.id}>
                  <div className="mobile-card-copy">
                    <div className="item-row-header">
                      <strong>{item.item_name}</strong>
                      <span className={`pill pill-tiny status-${item.status}`}>{item.status.replace("_", " ")}</span>
                    </div>
                    <p className="muted item-row-copy">
                      {borrower ? "Borrowed from" : "Lent to"} {readableProfile(counterparty)}
                    </p>
                    <small>{detail}</small>
                  </div>
                  <div className="mobile-card-actions">
                    {item.status === "pending" && item.owner_id === userId ? (
                      <button className="ghost-button danger-ghost-button compact-action-button" onClick={() => onCancelItem(item.id)} type="button">
                        Cancel
                      </button>
                    ) : null}
                    {item.status === "active" && borrower ? (
                      <button className="ghost-button compact-action-button" onClick={(e) => onRequestReturn(item.id, e)} type="button">
                        Mark returned
                      </button>
                    ) : null}
                    {needsApproval ? (
                      <button className="primary-button compact-action-button" onClick={onOpenApprovals} type="button">
                        Review
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function MobileActivityPageV2(props: { recentActivity: ActivityItem[]; onBack: () => void }) {
  const { recentActivity, onBack } = props;

  return (
    <div className="mobile-page mobile-only">
      <div className="mobile-page-header">
        <button className="mobile-back-btn" onClick={onBack} type="button">
          Back
        </button>
        <h2>Recent Activity</h2>
      </div>
      <div className="mobile-page-content">
        {recentActivity.length === 0 ? (
          <div className="mobile-empty-card">
            <p className="empty-state">No activity yet.</p>
          </div>
        ) : (
          <div className="stack mini-stack">
            {recentActivity.map((item) => (
              <article className="mobile-list-card" key={`${item.kind}-${item.id}`}>
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
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function MobileDashboardV2(props: MobileDashboardV2Props) {
  const {
    profile,
    weather,
    balances,
    profilesById,
    incomingInvites,
    outgoingInvites,
    pendingApprovals,
    pendingSettlements,
    pendingItems,
    sharedItems,
    profiles,
    userId,

    totalOwedToYou,
    totalYouOwe,
    pendingCount,
    pendingItemsCount,
    balancesCount,
    recentActivityCount,
    sharedItemsCount,
    recentActivity,

    isSidebarOpen,
    onOpenSidebar,
    onCloseSidebar,

    inviteUsername,
    setInviteUsername,
    mutating,

    onSendInvite,
    onRespondInvite,
    onViewStatement,

    onRespondDebt,
    onRespondSettlement,
    onRespondItem,

    onOpenDebt,
    onOpenSettlement,
    onOpenItemsDialog,

    onCancelItem,
    onRequestReturn,

    onOpenProfileDialog,
    onRefresh,
    onSignOut,

    isInviteFormOpen,
    isApprovalsDialogOpen,
    isRecentActivityDialogOpen,
    isProfileDialogOpen,
    isStatementDialogOpen,
    isDebtDialogOpen,
    isSettlementDialogOpen,
    isItemsDialogOpen,
    isAboutDialogOpen,
    isFullItemsDialogOpen,
    isFriendsDialogOpen,

    onCloseInviteForm,
    onCloseApprovalsDialog,
    onCloseRecentActivityDialog,
    onCloseProfileDialog,
    onCloseStatementDialog,
    onCloseDebtDialog,
    onCloseSettlementDialog,
    onCloseItemsDialog,
    onCloseAboutDialog,
    onCloseFullItemsDialog,
    onCloseFriendsDialog
  } = props;

  const [section, setSection] = useState<MobileDashboardSection>(() => readSectionFromHash() ?? "home");

  const isMobileViewport = useMemo(() => {
    if (typeof window === "undefined") return false;
    const forced = document.documentElement.getAttribute("data-force-mobile") === "true";
    if (forced) return true;
    return window.matchMedia && window.matchMedia("(max-width: 640px)").matches;
  }, []);

  // Keep the URL hash in sync for crash recovery / deep-ish linking.
  useEffect(() => {
    writeSectionToHash(section);
  }, [section]);

  const historyPushedRef = useRef(false);
  const stateRef = useRef({
    section,
    isSidebarOpen,
    isInviteFormOpen,
    isApprovalsDialogOpen,
    isRecentActivityDialogOpen,
    isProfileDialogOpen,
    isStatementDialogOpen,
    isDebtDialogOpen,
    isSettlementDialogOpen,
    isItemsDialogOpen,
    isAboutDialogOpen,
    isFullItemsDialogOpen,
    isFriendsDialogOpen
  });

  useEffect(() => {
    stateRef.current = {
      section,
      isSidebarOpen,
      isInviteFormOpen,
      isApprovalsDialogOpen,
      isRecentActivityDialogOpen,
      isProfileDialogOpen,
      isStatementDialogOpen,
      isDebtDialogOpen,
      isSettlementDialogOpen,
      isItemsDialogOpen,
      isAboutDialogOpen,
      isFullItemsDialogOpen,
      isFriendsDialogOpen
    };
  }, [
    section,
    isSidebarOpen,
    isInviteFormOpen,
    isApprovalsDialogOpen,
    isRecentActivityDialogOpen,
    isProfileDialogOpen,
    isStatementDialogOpen,
    isDebtDialogOpen,
    isSettlementDialogOpen,
    isItemsDialogOpen,
    isAboutDialogOpen,
    isFullItemsDialogOpen,
    isFriendsDialogOpen
  ]);

  const needsBackHandler = useMemo(() => {
    const overlayOpen =
      isSidebarOpen ||
      isInviteFormOpen ||
      isApprovalsDialogOpen ||
      isRecentActivityDialogOpen ||
      isProfileDialogOpen ||
      isStatementDialogOpen ||
      isDebtDialogOpen ||
      isSettlementDialogOpen ||
      isItemsDialogOpen ||
      isAboutDialogOpen ||
      isFullItemsDialogOpen ||
      isFriendsDialogOpen;
    return overlayOpen || section !== "home";
  }, [
    isSidebarOpen,
    isInviteFormOpen,
    isApprovalsDialogOpen,
    isRecentActivityDialogOpen,
    isProfileDialogOpen,
    isStatementDialogOpen,
    isDebtDialogOpen,
    isSettlementDialogOpen,
    isItemsDialogOpen,
    isAboutDialogOpen,
    isFullItemsDialogOpen,
    isFriendsDialogOpen,
    section
  ]);

  const closeTopmostLayer = useCallback(() => {
    const s = stateRef.current;
    const priority = computeBackPriority({
      isAboutDialogOpen: s.isAboutDialogOpen,
      isFriendsDialogOpen: s.isFriendsDialogOpen,
      isFullItemsDialogOpen: s.isFullItemsDialogOpen,
      isItemsDialogOpen: s.isItemsDialogOpen,
      isRecentActivityDialogOpen: s.isRecentActivityDialogOpen,
      isSettlementDialogOpen: s.isSettlementDialogOpen,
      isDebtDialogOpen: s.isDebtDialogOpen,
      isStatementDialogOpen: s.isStatementDialogOpen,
      isProfileDialogOpen: s.isProfileDialogOpen,
      isApprovalsDialogOpen: s.isApprovalsDialogOpen,
      isInviteFormOpen: s.isInviteFormOpen,
      isSidebarOpen: s.isSidebarOpen,
      isSubPage: s.section !== "home"
    });

    if (priority === "about") onCloseAboutDialog();
    else if (priority === "friends") onCloseFriendsDialog();
    else if (priority === "fullItems") onCloseFullItemsDialog();
    else if (priority === "items") onCloseItemsDialog();
    else if (priority === "recentActivity") onCloseRecentActivityDialog();
    else if (priority === "settlement") onCloseSettlementDialog();
    else if (priority === "debt") onCloseDebtDialog();
    else if (priority === "statement") onCloseStatementDialog();
    else if (priority === "profile") onCloseProfileDialog();
    else if (priority === "approvals") onCloseApprovalsDialog();
    else if (priority === "inviteForm") onCloseInviteForm();
    else if (priority === "sidebar") onCloseSidebar();
    else if (priority === "section") setSection("home");
  }, [
    onCloseAboutDialog,
    onCloseFriendsDialog,
    onCloseFullItemsDialog,
    onCloseItemsDialog,
    onCloseRecentActivityDialog,
    onCloseSettlementDialog,
    onCloseDebtDialog,
    onCloseStatementDialog,
    onCloseProfileDialog,
    onCloseApprovalsDialog,
    onCloseInviteForm,
    onCloseSidebar
  ]);

  // Android back bridge: push a sentinel when we have anything to close.
  useEffect(() => {
    if (!isMobileViewport) return;

    if (needsBackHandler && !historyPushedRef.current) {
      window.history.pushState({ fnbMobileSentinel: true }, "");
      historyPushedRef.current = true;
    }

    if (!needsBackHandler && historyPushedRef.current) {
      historyPushedRef.current = false;
    }

    const handlePopState = () => {
      historyPushedRef.current = false;
      closeTopmostLayer();
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [
    isMobileViewport,
    needsBackHandler,
    closeTopmostLayer,
    onCloseAboutDialog,
    onCloseFriendsDialog,
    onCloseFullItemsDialog,
    onCloseItemsDialog,
    onCloseRecentActivityDialog,
    onCloseSettlementDialog,
    onCloseDebtDialog,
    onCloseStatementDialog,
    onCloseProfileDialog,
    onCloseApprovalsDialog,
    onCloseInviteForm,
    onCloseSidebar
  ]);

  function navigateTo(next: Exclude<MobileDashboardSection, "home">) {
    if (isSidebarOpen) onCloseSidebar();
    setSection(next);
  }

  return (
    <>
      <MobileSidebarV2
        isOpen={isSidebarOpen}
        onClose={onCloseSidebar}
        profile={profile}
        totalOwedToYou={totalOwedToYou}
        totalYouOwe={totalYouOwe}
        onOpenProfile={onOpenProfileDialog}
        onRefresh={onRefresh}
        onSignOut={onSignOut}
      />

      {section === "home" ? (
        <MobileHomeV2
          profile={profile}
          pendingCount={pendingCount}
          pendingItemsCount={pendingItemsCount}
          balancesCount={balancesCount}
          recentActivityCount={recentActivityCount}
          sharedItemsCount={sharedItemsCount}
          totalOwedToYou={totalOwedToYou}
          totalYouOwe={totalYouOwe}
          weather={weather}
          onNavigate={navigateTo}
          onOpenSidebar={onOpenSidebar}
        />
      ) : null}

      {section === "network" ? (
        <MobileNetworkPageV2
          balances={balances}
          inviteUsername={inviteUsername}
          setInviteUsername={setInviteUsername}
          onSendInvite={onSendInvite}
          mutating={mutating}
          incomingInvites={incomingInvites}
          outgoingInvites={outgoingInvites}
          profilesById={profilesById}
          onViewStatement={onViewStatement}
          onRespondInvite={onRespondInvite}
          onBack={closeTopmostLayer}
        />
      ) : null}

      {section === "approvals" ? (
        <MobileApprovalsPageV2
          pendingApprovals={pendingApprovals}
          pendingSettlements={pendingSettlements}
          pendingItems={pendingItems}
          profilesById={profilesById}
          mutating={mutating}
          onRespondDebt={onRespondDebt}
          onRespondSettlement={onRespondSettlement}
          onRespondItem={onRespondItem}
          onBack={closeTopmostLayer}
        />
      ) : null}

      {section === "money" ? (
        <MobileMoneyPageV2 onOpenDebt={onOpenDebt} onOpenSettlement={onOpenSettlement} onBack={closeTopmostLayer} />
      ) : null}

      {section === "items" ? (
        <MobileItemsPageV2
          sharedItems={sharedItems}
          profiles={profiles}
          userId={userId}
          pendingItemsCount={pendingItemsCount}
          onOpenItemsDialog={onOpenItemsDialog}
          onOpenApprovals={() => setSection("approvals")}
          onCancelItem={onCancelItem}
          onRequestReturn={onRequestReturn}
          onBack={closeTopmostLayer}
        />
      ) : null}

      {section === "activity" ? <MobileActivityPageV2 recentActivity={recentActivity} onBack={closeTopmostLayer} /> : null}
    </>
  );
}

