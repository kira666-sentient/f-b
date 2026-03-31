"use client";

/* eslint-disable @next/next/no-img-element */
import React from "react";
import type { Profile, DebtRequest, Settlement, SharedItem, Friendship } from "@/lib/app-types";
import type { FriendSummary, ActivityItem } from "@/lib/types";
import { formatCurrency, formatDateTime, formatDate, formatDateOnly, readableProfile } from "@/lib/helpers";
import { Avatar, PersonIdentity } from "./ui";

/* ═══════════════════════════════════════════════════════
   Mobile Sidebar Drawer
   ═══════════════════════════════════════════════════════ */

export interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile | null;
  totalOwedToYou: number;
  totalYouOwe: number;
  onOpenProfile: () => void;
  onRefresh: () => void;
  onSignOut: () => void;
}

export function MobileSidebar(props: MobileSidebarProps) {
  if (!props.isOpen) return null;
  const { onClose, profile, totalOwedToYou, totalYouOwe, onOpenProfile, onRefresh, onSignOut } = props;

  return (
    <div className="mobile-only">
      <div className="mobile-sidebar-backdrop" onClick={onClose} />
      <aside className="mobile-sidebar" onClick={(e) => e.stopPropagation()}>
        <div className="mobile-sidebar-header">
          <img src="/fnb-logo.svg" alt="F&B" style={{ height: "32px", width: "auto" }} />
          <button className="ghost-button" onClick={onClose} style={{ padding: '8px', fontSize: '0.85rem' }}>Close</button>
        </div>
        <div className="mobile-sidebar-profile">
          <Avatar profile={profile} size="medium" />
          <div>
            <strong>{readableProfile(profile)}</strong>
            <p className="muted" style={{ margin: '2px 0 0', fontSize: '0.85rem' }}>@{profile?.username ?? "not-set"}</p>
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
          <button className="ghost-button" onClick={() => { onClose(); onOpenProfile(); }}>⚙️ Profile &amp; UPI setup</button>
          <button className="ghost-button" onClick={() => { onClose(); onRefresh(); }}>🔄 Refresh data</button>
          <button className="ghost-button danger-ghost-button" onClick={onSignOut}>🚪 Sign out</button>
        </div>
      </aside>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Mobile Home (Welcome + Nav Grid)
   ═══════════════════════════════════════════════════════ */

export interface MobileHomeProps {
  profile: Profile | null;
  pendingCount: number;
  balancesCount: number;
  recentActivityCount: number;
  sharedItemsCount: number;
  onNavigate: (page: "network" | "approvals" | "money" | "activity" | "items") => void;
  onOpenSidebar: () => void;
}

export function MobileHome(props: MobileHomeProps) {
  const { profile, pendingCount, balancesCount, recentActivityCount, sharedItemsCount, onNavigate, onOpenSidebar } = props;

  return (
    <>
      <header className="mobile-welcome mobile-only">
        <div className="mobile-welcome-text">
          <h2>Hello, {profile?.full_name?.split(' ')[0] || 'Friend'}</h2>
          <p className="muted">You have {pendingCount} items to review.</p>
        </div>
        <div className="mobile-welcome-avatar" onClick={onOpenSidebar}>
          <Avatar profile={profile} size="medium" />
        </div>
      </header>

      <div className="mobile-home-grid mobile-only">
        <button className="mobile-nav-card" onClick={() => onNavigate("network")}>
          <span className="nav-card-icon">👥</span>
          <span className="nav-card-label">Your Network</span>
          <span className="nav-card-badge">{balancesCount} friends</span>
        </button>
        <button className="mobile-nav-card" onClick={() => onNavigate("approvals")}>
          <span className="nav-card-icon">⏳</span>
          <span className="nav-card-label">Approvals</span>
          <span className="nav-card-badge">{pendingCount} pending</span>
        </button>
        <button className="mobile-nav-card" onClick={() => onNavigate("money")}>
          <span className="nav-card-icon">💰</span>
          <span className="nav-card-label">Money Actions</span>
        </button>
        <button className="mobile-nav-card" onClick={() => onNavigate("activity")}>
          <span className="nav-card-icon">📊</span>
          <span className="nav-card-label">Activity</span>
          <span className="nav-card-badge">{recentActivityCount}</span>
        </button>
        <button className="mobile-nav-card items-card" onClick={() => onNavigate("items")}>
          <span className="nav-card-icon">🎒</span>
          <span className="nav-card-label">Item Tracker</span>
          <span className="nav-card-badge">{sharedItemsCount} items</span>
        </button>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════
   Mobile Full-Screen Pages
   ═══════════════════════════════════════════════════════ */

export interface MobileNetworkPageProps {
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
}

export function MobileNetworkPage(props: MobileNetworkPageProps) {
  const { balances, inviteUsername, setInviteUsername, onSendInvite, mutating, incomingInvites, outgoingInvites, profilesById, onViewStatement, onRespondInvite, onBack } = props;

  return (
    <div className="mobile-page mobile-only">
      <div className="mobile-page-header">
        <button className="mobile-back-btn" onClick={onBack}>← Back</button>
        <h2>Your Network</h2>
      </div>
      <div className="mobile-page-content">
        <div style={{ marginBottom: '20px' }}>
          <span className="profile-label" style={{ marginBottom: '8px' }}>Invite by username:</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input aria-label="Invite by username" value={inviteUsername} onChange={(e) => setInviteUsername(e.target.value)} placeholder="friend_username" style={{ minHeight: '42px', padding: '8px 12px', flex: 1, minWidth: 0 }} />
            <button className="primary-button" onClick={onSendInvite} disabled={mutating} style={{ minHeight: '42px', whiteSpace: 'nowrap', padding: '0 20px' }}>Send</button>
          </div>
        </div>

        <h3 style={{ marginBottom: '12px' }}>Your friends <span className="count-chip">{balances.length}</span></h3>
        {balances.length === 0 ? (
          <p className="empty-state">No accepted friends yet.</p>
        ) : (
          <div className="stack mini-stack">
            {balances.map((friend) => (
              <button className="friend-card" key={friend.friendshipId} onClick={() => onViewStatement(friend.profile.id)}>
                <PersonIdentity profile={friend.profile} />
                <div className="friend-card-side">
                  <span className={`amount-badge ${friend.balanceInPaise > 0 ? "positive" : friend.balanceInPaise < 0 ? "negative" : ""}`}>{formatCurrency(friend.balanceInPaise)}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>Incoming invites <span className="count-chip">{incomingInvites.length}</span></h3>
        {incomingInvites.length === 0 ? <p className="empty-state">No incoming invites right now.</p> : (
          <div className="stack mini-stack">
            {incomingInvites.map((invite) => (
              <div className="list-card" key={invite.id}>
                <PersonIdentity profile={profilesById.get(invite.requester_id)} />
                <div className="row-actions">
                  <button className="primary-button" onClick={() => onRespondInvite(invite.id, true)} disabled={mutating}>Accept</button>
                  <button className="ghost-button" onClick={() => onRespondInvite(invite.id, false)} disabled={mutating}>Decline</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>Outgoing invites <span className="count-chip">{outgoingInvites.length}</span></h3>
        {outgoingInvites.length === 0 ? <p className="empty-state">No pending invites sent.</p> : (
          <div className="stack mini-stack">
            {outgoingInvites.map((invite) => (
              <div className="list-card" key={invite.id}>
                <PersonIdentity profile={profilesById.get(invite.addressee_id)} />
                <span className="pill">Waiting</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Mobile Approvals Page ───────────────────────────── */

export interface MobileApprovalsPageProps {
  pendingApprovals: DebtRequest[];
  pendingSettlements: Settlement[];
  profilesById: Map<string, Profile>;
  mutating: boolean;
  onRespondDebt: (id: string, approve: boolean) => void;
  onRespondSettlement: (id: string, approve: boolean) => void;
  onBack: () => void;
}

export function MobileApprovalsPage(props: MobileApprovalsPageProps) {
  const { pendingApprovals, pendingSettlements, profilesById, mutating, onRespondDebt, onRespondSettlement, onBack } = props;

  return (
    <div className="mobile-page mobile-only">
      <div className="mobile-page-header">
        <button className="mobile-back-btn" onClick={onBack}>← Back</button>
        <h2>Pending Approvals</h2>
      </div>
      <div className="mobile-page-content">
        {pendingApprovals.length === 0 && pendingSettlements.length === 0 ? (
          <p className="empty-state">No approvals waiting for you. 🎉</p>
        ) : (
          <div className="stack mini-stack">
            {pendingApprovals.map((request) => (
              <div className="list-card dense" key={request.id}>
                <div>
                  <PersonIdentity profile={profilesById.get(request.creator_id)} />
                  <p>{formatCurrency(request.amount_in_paise)} for {request.reason}</p>
                  <small>Debt date {formatDateOnly(new Date(request.debt_date))} - Due {formatDate(request.due_at)}</small>
                </div>
                <div className="row-actions">
                  <button className="primary-button" onClick={() => onRespondDebt(request.id, true)} disabled={mutating}>Approve</button>
                  <button className="ghost-button" onClick={() => onRespondDebt(request.id, false)} disabled={mutating}>Reject</button>
                </div>
              </div>
            ))}
            {pendingSettlements.map((settlement) => (
              <div className="list-card dense" key={settlement.id}>
                <div>
                  <PersonIdentity profile={profilesById.get(settlement.payer_id)} />
                  <p>{formatCurrency(settlement.amount_in_paise)} payment</p>
                  <small>{settlement.note || "No note"}</small>
                </div>
                <div className="row-actions">
                  <button className="primary-button" onClick={() => onRespondSettlement(settlement.id, true)} disabled={mutating}>Approve</button>
                  <button className="ghost-button" onClick={() => onRespondSettlement(settlement.id, false)} disabled={mutating}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Mobile Money Page ───────────────────────────────── */

export function MobileMoneyPage({ onOpenDebt, onOpenSettlement, onBack }: { onOpenDebt: () => void; onOpenSettlement: () => void; onBack: () => void }) {
  return (
    <div className="mobile-page mobile-only">
      <div className="mobile-page-header">
        <button className="mobile-back-btn" onClick={onBack}>← Back</button>
        <h2>Money Actions</h2>
      </div>
      <div className="mobile-page-content">
        <div style={{ display: 'grid', gap: '12px' }}>
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

/* ── Mobile Items Page ───────────────────────────────── */

export interface MobileItemsPageProps {
  sharedItems: SharedItem[];
  profiles: Profile[];
  userId: string;
  onOpenItemsDialog: () => void;
  onCancelItem: (id: string) => void;
  onRequestReturn: (id: string, e?: React.MouseEvent) => void;
  onBack: () => void;
}

export function MobileItemsPage(props: MobileItemsPageProps) {
  const { sharedItems, profiles, userId, onOpenItemsDialog, onCancelItem, onRequestReturn, onBack } = props;

  return (
    <div className="mobile-page mobile-only">
      <div className="mobile-page-header">
        <button className="mobile-back-btn" onClick={onBack}>← Back</button>
        <h2>Shared Items</h2>
        <button className="ghost-button" onClick={onOpenItemsDialog} style={{ marginLeft: "auto", fontSize: "1.2rem", padding: "4px" }}>+</button>
      </div>
      <div className="mobile-page-content">
        {sharedItems.length === 0 ? (
          <p className="empty-state">No shared items tracked.</p>
        ) : (
          <div className="stack mini-stack">
            {sharedItems.map((item) => (
              <div className="list-card dense" key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong>{item.item_name}</strong>
                    <span className={`pill status-${item.status}`} style={{ fontSize: '0.6rem', padding: '2px 6px' }}>{item.status}</span>
                  </div>
                  <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                    {item.type === 'gave' ? 'Lent to' : 'Borrowed from'} {profiles.find((p) => p.id === item.friend_id)?.full_name || 'friend'}
                  </p>
                </div>
                <div className="row-actions">
                  {item.status === 'pending' && item.owner_id === userId && (
                    <button className="ghost-button danger-ghost-button" onClick={() => onCancelItem(item.id)} style={{ padding: '6px' }}>Cancel</button>
                  )}
                  {item.status === 'active' && (
                    ((item.type === 'gave' && item.friend_id === userId) ||
                     (item.type === 'borrowed' && item.owner_id === userId)) ? (
                      <button className="ghost-button" onClick={(e) => onRequestReturn(item.id, e)} style={{ padding: '6px' }}>Return</button>
                    ) : null
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Mobile Activity Page ────────────────────────────── */

export function MobileActivityPage({ recentActivity, onBack }: { recentActivity: ActivityItem[]; onBack: () => void }) {
  return (
    <div className="mobile-page mobile-only">
      <div className="mobile-page-header">
        <button className="mobile-back-btn" onClick={onBack}>← Back</button>
        <h2>Recent Activity</h2>
      </div>
      <div className="mobile-page-content">
        {recentActivity.length === 0 ? (
          <p className="empty-state">No activity yet.</p>
        ) : (
          <div className="stack mini-stack">
            {recentActivity.map((item) => (
              <div className="list-card dense" key={`${item.kind}-${item.id}`}>
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
