"use client";

/* eslint-disable @next/next/no-img-element */
import React from "react";
import type { Profile, Friendship, SharedItem } from "@/lib/app-types";
import type { FriendSummary, ActivityItem } from "@/lib/types";
import { formatCurrency, formatDateTime, readableProfile } from "@/lib/helpers";
import { Avatar, PersonIdentity, RefreshIcon } from "./ui";

/* ═══════════════════════════════════════════════════════
   Desktop Topbar (contains both mobile & desktop elements)
   ═══════════════════════════════════════════════════════ */

export interface TopbarProps {
  onOpenSidebar: () => void;
  onOpenAbout: () => void;
}

export function Topbar({ onOpenSidebar, onOpenAbout }: TopbarProps) {
  return (
    <section className="topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      {/* Mobile: Logo = sidebar trigger */}
      <button className="mobile-only" onClick={onOpenSidebar} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
        <img className="brand-logo" src="/fnb-logo.svg" alt="F&B" style={{ width: '44px', height: '44px', borderRadius: '14px' }} />
      </button>

      {/* PC: Full identity lockup */}
      <div className="topbar-main desktop-only">
        <div className="identity-lockup" style={{ gap: '14px' }}>
          <img className="brand-logo" src="/fnb-logo.svg" alt="F&B logo" />
          <div className="brand-copy">
            <h1 className="app-title" style={{ margin: 0, letterSpacing: '-0.02em' }}>Friends &amp; Benefits</h1>
          </div>
        </div>
      </div>

      {/* Mobile: Centered title */}
      <h1 className="app-title mobile-only" style={{ fontSize: '1.1rem', margin: 0 }}>Friends &amp; Benefits</h1>

      {/* Help/About icon (visible on all breakpoints) */}
      <button className="help-icon-button" onClick={onOpenAbout} title="How to use &amp; About Me" type="button">❓</button>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════
   Desktop Profile Strip
   ═══════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════
   Stat Cards Row
   ═══════════════════════════════════════════════════════ */

export interface StatGridProps {
  friendCount: number;
  totalOwedToYou: number;
  totalYouOwe: number;
  pendingCount: number;
  onOpenApprovals: () => void;
}

export function StatGrid(props: StatGridProps) {
  const { friendCount, totalOwedToYou, totalYouOwe, pendingCount, onOpenApprovals } = props;

  return (
    <section className="stat-grid desktop-only">
      <article className="stat-card"><span>Total friends</span><strong>{friendCount}</strong></article>
      <article className="stat-card success"><span>They owe you</span><strong>{formatCurrency(totalOwedToYou)}</strong></article>
      <article className="stat-card warning"><span>You owe</span><strong>{formatCurrency(totalYouOwe)}</strong></article>
      <article className="stat-card" onClick={onOpenApprovals} style={{ cursor: 'pointer' }}>
        <span>Pending approvals</span><strong>{pendingCount}</strong>
      </article>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════
   Desktop Dashboard Grid (Network + Money + Items)
   ═══════════════════════════════════════════════════════ */

export interface DashboardGridProps {
  /* Network column */
  balances: FriendSummary[];
  selectedFriendId: string;
  isInviteFormOpen: boolean;
  setIsInviteFormOpen: (v: boolean) => void;
  inviteUsername: string;
  setInviteUsername: (v: string) => void;
  onSendInvite: () => void;
  mutating: boolean;
  incomingInvites: Friendship[];
  outgoingInvites: Friendship[];
  profilesById: Map<string, Profile>;
  onViewStatement: (friendId: string) => void;
  onRespondInvite: (id: string, accept: boolean) => void;
  /* Money & Items */
  onOpenDebt: () => void;
  onOpenSettlement: () => void;
  onOpenItemsDialog: () => void;
  sharedItems: SharedItem[];
  profiles: Profile[];
  userId: string;
  onCancelItem: (id: string) => void;
  onRequestReturn: (id: string, e?: React.MouseEvent) => void;
}

export function DashboardGrid(props: DashboardGridProps) {
  const { balances, selectedFriendId, isInviteFormOpen, setIsInviteFormOpen, inviteUsername, setInviteUsername, onSendInvite, mutating, incomingInvites, outgoingInvites, profilesById, onViewStatement, onRespondInvite, onOpenDebt, onOpenSettlement, onOpenItemsDialog, sharedItems, profiles, userId, onCancelItem, onRequestReturn } = props;

  return (
    <section className="dashboard-grid desktop-only">
      {/* ── Column 1: Network ──────────────────────────── */}
      <div className="dashboard-column">
        <article className="panel panel-network">
          <div className="section-head">
            <div>
              <h2>Your network</h2>
              <p className="muted">Friends, incoming invites, and outgoing requests stay organized here.</p>
            </div>
          </div>
          <div className="panel-scroll panel-scroll-network">
            <div className="section-stack">
              <section className="subpanel">
                <div className="subpanel-head">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3>Your friends</h3>
                    <button className="ghost-button" onClick={() => setIsInviteFormOpen(!isInviteFormOpen)} style={{ padding: '4px', minHeight: '32px', minWidth: '32px', fontSize: '1.2rem' }} title="Invite a new friend">
                      {isInviteFormOpen ? "−" : "+"}
                    </button>
                  </div>
                  <span className="count-chip">{balances.length}</span>
                </div>

                {isInviteFormOpen && (
                  <div className="subpanel-invite-inline" style={{ padding: '0 0 16px', borderBottom: '1px solid var(--line)', marginBottom: '16px' }}>
                    <span className="profile-label" style={{ marginBottom: '8px' }}>Invite by username:</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input aria-label="Invite by username" value={inviteUsername} onChange={(e) => setInviteUsername(e.target.value)} placeholder="friend_username" style={{ minHeight: '42px', padding: '8px 12px', flex: 1, minWidth: 0 }} />
                      <button className="primary-button" onClick={onSendInvite} disabled={mutating} style={{ minHeight: '42px', whiteSpace: 'nowrap', padding: '0 20px' }}>Send</button>
                    </div>
                  </div>
                )}

                {balances.length === 0 ? (
                  <p className="empty-state">No accepted friends yet.</p>
                ) : (
                  <div className="stack mini-stack">
                    {balances.map((friend) => (
                      <button className={`friend-card ${selectedFriendId === friend.profile.id ? "friend-card-active" : ""}`} key={friend.friendshipId} onClick={() => onViewStatement(friend.profile.id)}>
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

              <section className="subpanel">
                <div className="subpanel-head"><h3>Incoming invites</h3><span className="count-chip">{incomingInvites.length}</span></div>
                {incomingInvites.length === 0 ? (
                  <p className="empty-state">No incoming invites right now.</p>
                ) : (
                  <div className="stack mini-stack">
                    <div className="list-card" key={incomingInvites[0].id} style={{ borderStyle: 'solid', borderWidth: '2px' }}>
                      <PersonIdentity profile={profilesById.get(incomingInvites[0].requester_id)} />
                      <div className="row-actions">
                        <button className="primary-button" onClick={() => onRespondInvite(incomingInvites[0].id, true)} disabled={mutating} style={{ padding: '8px 16px' }}>Accept</button>
                      </div>
                    </div>
                    {incomingInvites.slice(1).map((invite) => (
                      <div className="list-card dense" key={invite.id} style={{ opacity: 0.8, background: 'rgba(255,255,255,0.3)' }}>
                        <PersonIdentity profile={profilesById.get(invite.requester_id)} />
                        <div className="row-actions">
                          <button className="primary-button" onClick={() => onRespondInvite(invite.id, true)} disabled={mutating} style={{ padding: "4px 10px", minHeight: "32px", fontSize: "0.8rem" }} title="Accept">Accept</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="subpanel">
                <div className="subpanel-head"><h3>Outgoing invites</h3><span className="count-chip">{outgoingInvites.length}</span></div>
                {outgoingInvites.length === 0 ? (
                  <p className="empty-state">No pending invites sent.</p>
                ) : (
                  <div className="stack mini-stack">
                    <div className="list-card" key={outgoingInvites[0].id}>
                      <PersonIdentity profile={profilesById.get(outgoingInvites[0].addressee_id)} />
                      <span className="pill">Waiting</span>
                    </div>
                    {outgoingInvites.slice(1).map((invite) => (
                      <div className="list-card dense" key={invite.id} style={{ opacity: 0.8, background: 'rgba(255,255,255,0.3)' }}>
                        <PersonIdentity profile={profilesById.get(invite.addressee_id)} />
                        <span className="pill" style={{ fontSize: "0.7rem" }}>Sent</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </article>
      </div>

      {/* ── Column 2: Money + Items ────────────────────── */}
      <div className="dashboard-column">
        <article className="panel panel-money">
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

        <article className="panel panel-items">
          <div className="section-head" style={{ borderBottom: '1px solid var(--line)', paddingBottom: '16px', marginBottom: '16px' }}>
            <div>
              <h2>Shared Items Tracker</h2>
              <p className="muted">Keep track of things you lent or borrowed.</p>
            </div>
            <button className="primary-button" onClick={onOpenItemsDialog} style={{ padding: '6px 12px', fontSize: '0.85rem' }}>+ Log Item</button>
          </div>
          <div className="panel-scroll" style={{ maxHeight: 'none', height: 'auto' }}>
            <div className="section-stack">
              {sharedItems.length === 0 ? (
                <p className="empty-state">No shared items right now.</p>
              ) : (
                <div className="stack mini-stack">
                  {sharedItems.map((item) => (
                    <div className="list-card dense" key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <strong>{item.item_name}</strong>
                          <span className={`pill status-${item.status}`} style={{ fontSize: '0.6rem', padding: '2px 6px' }}>{item.status}</span>
                        </div>
                        <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
                          <span className="profile-label" style={{ fontSize: '0.65rem', marginRight: '6px' }}>{item.type.toUpperCase()}</span>
                          {item.type === 'gave' ? 'to' : 'from'} {profiles.find((p) => p.id === item.friend_id)?.full_name || 'friend'}
                        </p>
                      </div>
                      <div className="row-actions">
                        {item.status === 'pending' && item.owner_id === userId && (
                          <button className="ghost-button danger-ghost-button" onClick={() => onCancelItem(item.id)} style={{ padding: '6px 12px' }}>Cancel</button>
                        )}
                        {item.status === 'active' && (
                          ((item.type === 'gave' && item.friend_id === userId) ||
                           (item.type === 'borrowed' && item.owner_id === userId)) ? (
                            <button className="ghost-button" onClick={(e) => onRequestReturn(item.id, e)} style={{ padding: '6px 12px' }}>Mark Returned</button>
                          ) : (
                            <span className="muted" style={{ fontSize: '0.8rem' }}>In use</span>
                          )
                        )}
                        {item.status === 'pending_return' && (
                          <span className="pill status-pending" style={{ fontSize: '0.7rem' }}>Returning...</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════
   Activity Panel (full-width below dashboard grid)
   ═══════════════════════════════════════════════════════ */

export function ActivityPanel({ recentActivity }: { recentActivity: ActivityItem[] }) {
  return (
    <section className="panel activity-panel desktop-only">
      <div className="section-head">
        <div>
          <h2>Recent activity</h2>
          <p className="muted">Latest debts and settlements across your network.</p>
        </div>
      </div>
      {recentActivity.length === 0 ? (
        <p className="empty-state">No activity yet.</p>
      ) : (
        <div className="panel-scroll panel-scroll-activity" style={{ maxHeight: 'none', height: 'auto', overflow: 'visible' }}>
          <div className="stack mini-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
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
        </div>
      )}
    </section>
  );
}
