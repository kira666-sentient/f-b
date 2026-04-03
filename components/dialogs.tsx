"use client";

import React from "react";
import type { Profile, DebtRequest, Settlement, SharedItem, Friendship } from "@/lib/app-types";
import type { FriendSummary, StatementEntry, DebtFormState, SettlementFormState, ItemFormState, ActivityItem } from "@/lib/types";
import {
  canApproveSharedItem,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatDateOnly,
  getSharedItemCounterpartyId,
  getSharedItemRequesterId,
  isSharedItemBorrower,
  readableProfile
} from "@/lib/helpers";
import { Avatar, PersonIdentity, FriendPicker, ChevronDownIcon } from "./ui";

const DialogBanner = ({ error, feedback }: { error: string | null; feedback: string | null }) => {
  if (!error && !feedback) return null;
  return <div className={`dialog-banner ${error ? "error-banner" : "success-banner"}`}>{error ?? feedback}</div>;
};

const DialogClose = ({ onClose, label }: { onClose: () => void; label: string }) => (
  <button aria-label={label} className="ghost-button dialog-close-button" onClick={onClose} type="button">X</button>
);

export interface ProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  profileNeedsSetup: boolean;
  profile: Profile | null;
  usernameDraft: string;
  setUsernameDraft: (v: string) => void;
  upiIdDraft: string;
  setUpiIdDraft: (v: string) => void;
  error: string | null;
  feedback: string | null;
  savingUsername: boolean;
  onSave: () => void;
}

export function ProfileDialog(props: ProfileDialogProps) {
  if (!props.isOpen) return null;
  const { onClose, profileNeedsSetup, profile, usernameDraft, setUsernameDraft, upiIdDraft, setUpiIdDraft, error, feedback, savingUsername, onSave } = props;

  return (
    <div className="dialog-backdrop full-items-backdrop" onClick={onClose} role="presentation">
      <section className="dialog-card" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <div>
            <h2>{profileNeedsSetup ? "Finish your profile" : "Your profile"}</h2>
            <p className="muted">
              {profileNeedsSetup ? "Pick a username your friends can type easily." : "This is how friends find you in the app."}
            </p>
          </div>
          <DialogClose onClose={onClose} label="Close profile dialog" />
        </div>

        <DialogBanner error={error} feedback={feedback} />

        <div className="dialog-profile">
          <Avatar profile={profile} size="large" />
          <div>
            <strong>{readableProfile(profile)}</strong>
            <p className="muted">@{profile?.username ?? "not-set"}</p>
          </div>
        </div>

        <div className="form-grid compact-grid">
          <label>
            <span>Username</span>
            <input value={usernameDraft} onChange={(e) => setUsernameDraft(e.target.value)} placeholder="for example: kiran_07" />
          </label>
          <label>
            <span>UPI ID</span>
            <input type="text" value={upiIdDraft} onChange={(e) => setUpiIdDraft(e.target.value)} placeholder="name@okaxis" />
            <small className="muted dialog-help-text">Used to generate a direct payment link for friends.</small>
          </label>
        </div>

        <div className="action-row dialog-actions-end">
          <button className="primary-button" disabled={savingUsername} onClick={onSave} type="button">
            {savingUsername ? "Saving..." : "Save profile"}
          </button>
        </div>
      </section>
    </div>
  );
}

export interface DebtDialogProps {
  isOpen: boolean;
  onClose: () => void;
  balances: FriendSummary[];
  debtForm: DebtFormState;
  setDebtForm: React.Dispatch<React.SetStateAction<DebtFormState>>;
  error: string | null;
  feedback: string | null;
  mutating: boolean;
  onCreate: () => void;
}

export function DebtDialog(props: DebtDialogProps) {
  if (!props.isOpen) return null;
  const { onClose, balances, debtForm, setDebtForm, error, feedback, mutating, onCreate } = props;
  const friendSelected = Boolean(debtForm.friendId);

  return (
    <div className="dialog-backdrop" onClick={onClose} role="presentation">
      <section className="dialog-card form-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <div>
            <h2>Record a debt</h2>
            <p className="muted">Create a request your friend can review and approve.</p>
          </div>
          <DialogClose onClose={onClose} label="Close debt dialog" />
        </div>

        <DialogBanner error={error} feedback={feedback} />

        <div className="dialog-body">
          <div className="form-grid compact-grid">
            <label>
              <span>Friend</span>
              <FriendPicker friends={balances} selectedId={debtForm.friendId} onSelect={(id) => setDebtForm((c) => ({ ...c, friendId: id }))} placeholder="Choose a friend" />
            </label>
          </div>

          {balances.length === 0 ? (
            <p className="empty-state action-hint">Add a friend first, then create a debt request here.</p>
          ) : friendSelected ? (
            <>
              <div className="hint-banner">Once the friend is selected, add the amount, date, and reason.</div>
              <div className="form-grid">
                <label>
                  <span>Amount in INR</span>
                  <input type="number" inputMode="decimal" min="0" step="0.01" value={debtForm.amount} onChange={(e) => setDebtForm((c) => ({ ...c, amount: e.target.value }))} placeholder="200" />
                </label>
                <label>
                  <span>Date</span>
                  <input type="date" value={debtForm.debtDate} onChange={(e) => setDebtForm((c) => ({ ...c, debtDate: e.target.value }))} />
                </label>
                <label>
                  <span>Return by (optional)</span>
                  <input type="datetime-local" value={debtForm.dueAt} onChange={(e) => setDebtForm((c) => ({ ...c, dueAt: e.target.value }))} />
                </label>
                <label className="full-span">
                  <span>Reason</span>
                  <textarea rows={3} value={debtForm.reason} onChange={(e) => setDebtForm((c) => ({ ...c, reason: e.target.value }))} placeholder="Auto fare, dinner, movie tickets, cash loan..." />
                </label>
              </div>
              <div className="action-row dialog-actions-end">
                <button className="primary-button" disabled={mutating} onClick={onCreate} type="button">Create debt request</button>
              </div>
            </>
          ) : (
            <p className="empty-state action-hint">Choose a friend to reveal the debt form.</p>
          )}
        </div>
      </section>
    </div>
  );
}

export interface SettlementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  balances: FriendSummary[];
  settlementForm: SettlementFormState;
  setSettlementForm: React.Dispatch<React.SetStateAction<SettlementFormState>>;
  error: string | null;
  feedback: string | null;
  mutating: boolean;
  onCreateSettlement: () => void;
  onPayOnline: () => void;
}

export function SettlementDialog(props: SettlementDialogProps) {
  if (!props.isOpen) return null;
  const { onClose, balances, settlementForm, setSettlementForm, error, feedback, mutating, onCreateSettlement, onPayOnline } = props;
  const friendSelected = Boolean(settlementForm.friendId);
  const currentFriend = balances.find((b) => b.profile.id === settlementForm.friendId);
  const amountDueInPaise = currentFriend && currentFriend.balanceInPaise < 0 ? Math.abs(currentFriend.balanceInPaise) : null;
  const canFillFull = amountDueInPaise !== null;
  const enteredAmount = Number(settlementForm.amount) * 100;
  const overpayAmount = amountDueInPaise !== null && enteredAmount > amountDueInPaise ? ((enteredAmount - amountDueInPaise) / 100).toFixed(2) : null;

  return (
    <div className="dialog-backdrop" onClick={onClose} role="presentation">
      <section className="dialog-card form-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <div>
            <h2>Record a settlement</h2>
            <p className="muted">Track a payment you already made or jump into a UPI payment.</p>
          </div>
          <DialogClose onClose={onClose} label="Close settlement dialog" />
        </div>

        <DialogBanner error={error} feedback={feedback} />

        <div className="dialog-body">
          <div className="form-grid compact-grid">
            <label>
              <span>Paid to</span>
              <FriendPicker friends={balances} selectedId={settlementForm.friendId} onSelect={(id) => setSettlementForm((c) => ({ ...c, friendId: id }))} placeholder="Choose a friend" />
            </label>
          </div>

          {balances.length === 0 ? (
            <p className="empty-state action-hint">Add a friend first, then record a settlement here.</p>
          ) : friendSelected ? (
            <>
              <div className="hint-banner">Confirm who received the payment, then add the amount and an optional note.</div>
              <div className="form-grid compact-grid">
                <label>
                  <div className="dialog-inline-head">
                    <span>Amount in INR</span>
                    {canFillFull ? (
                      <button className="ghost-button topbar-compact-button micro-action-button" onClick={() => setSettlementForm((c) => ({ ...c, amount: ((amountDueInPaise ?? 0) / 100).toString() }))} type="button">
                        Pay in full
                      </button>
                    ) : null}
                  </div>
                  <input type="number" inputMode="decimal" min="0" step="0.01" value={settlementForm.amount} onChange={(e) => setSettlementForm((c) => ({ ...c, amount: e.target.value }))} placeholder="200" />
                  {overpayAmount ? <span className="dialog-warning-text">Note: you are paying Rs {overpayAmount} more than you currently owe.</span> : null}
                </label>
                <label className="full-span">
                  <span>Note</span>
                  <input value={settlementForm.note} onChange={(e) => setSettlementForm((c) => ({ ...c, note: e.target.value }))} placeholder="UPI transfer, cash returned, bank transfer..." />
                </label>
              </div>
              <div className="action-row dialog-split-actions">
                <button className="ghost-button" disabled={mutating} onClick={onCreateSettlement} type="button">Record manual</button>
                <button className="primary-button" disabled={mutating} onClick={onPayOnline} type="button">Pay online</button>
              </div>
            </>
          ) : (
            <p className="empty-state action-hint">Choose a friend to reveal the settlement form.</p>
          )}
        </div>
      </section>
    </div>
  );
}

export interface StatementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedFriend: FriendSummary | null;
  friendStatement: StatementEntry[];
  error: string | null;
  feedback: string | null;
  onPayFriend: (friendId: string) => void;
  onLogExpense: (friendId: string) => void;
}

export function StatementDialog(props: StatementDialogProps) {
  if (!props.isOpen || !props.selectedFriend) return null;
  const { onClose, selectedFriend, friendStatement, error, feedback, onPayFriend, onLogExpense } = props;

  return (
    <div className="dialog-backdrop" onClick={onClose} role="presentation">
      <section className="dialog-card statement-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <div>
            <h2>Statement</h2>
            <p className="muted">A full record with {readableProfile(selectedFriend.profile)}.</p>
          </div>
          <DialogClose onClose={onClose} label="Close statement dialog" />
        </div>

        <DialogBanner error={error} feedback={feedback} />

        <div className="statement-shell">
          <div className="statement-header">
            <PersonIdentity profile={selectedFriend.profile} />
            <span className={`amount-badge ${selectedFriend.balanceInPaise > 0 ? "positive" : selectedFriend.balanceInPaise < 0 ? "negative" : ""}`}>
              {formatCurrency(selectedFriend.balanceInPaise)}
            </span>
          </div>

          <div className="action-row dialog-split-actions">
            <button className="primary-button" onClick={() => onPayFriend(selectedFriend.profile.id)} type="button">Pay them</button>
            <button className="ghost-button" onClick={() => onLogExpense(selectedFriend.profile.id)} type="button">Log expense</button>
          </div>

          {friendStatement.length === 0 ? (
            <p className="empty-state">No records yet with this friend.</p>
          ) : (
            <div className="statement-table-wrap">
              <table className="statement-table">
                <thead>
                  <tr><th>When</th><th>Entry</th><th>Status</th><th>Amount</th></tr>
                </thead>
                <tbody>
                  {friendStatement.map((entry) => (
                    <tr key={`${entry.kind}-${entry.id}`}>
                      <td>{formatDateTime(new Date(entry.createdAt))}</td>
                      <td><strong>{entry.title}</strong><p>{entry.detail}</p></td>
                      <td><span className={`pill status-${entry.status}`}>{entry.status}</span></td>
                      <td>
                        <div className="statement-amounts">
                          <strong>{formatCurrency(entry.amountInPaise)}</strong>
                          <small>Balance impact {formatCurrency(entry.balanceDeltaInPaise)}</small>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export interface ApprovalsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  pendingApprovals: DebtRequest[];
  pendingSettlements: Settlement[];
  pendingItems: SharedItem[];
  profilesById: Map<string, Profile>;
  error: string | null;
  feedback: string | null;
  mutating: boolean;
  onRespondDebt: (id: string, approve: boolean) => void;
  onRespondSettlement: (id: string, approve: boolean) => void;
  onRespondItem: (id: string, action: "approve" | "reject" | "return_confirm") => void;
}

export function ApprovalsDialog(props: ApprovalsDialogProps) {
  if (!props.isOpen) return null;
  const { onClose, pendingApprovals, pendingSettlements, pendingItems, profilesById, error, feedback, mutating, onRespondDebt, onRespondSettlement, onRespondItem } = props;

  return (
    <div className="dialog-backdrop" onClick={onClose} role="presentation">
      <section className="dialog-card form-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <div>
            <h2>Pending approvals</h2>
            <p className="muted">These requests need your decision.</p>
          </div>
          <DialogClose onClose={onClose} label="Close approvals dialog" />
        </div>

        <DialogBanner error={error} feedback={feedback} />

        <div className="dialog-body">
          {pendingApprovals.length === 0 && pendingSettlements.length === 0 && pendingItems.length === 0 ? (
            <p className="empty-state">No approvals waiting for you.</p>
          ) : (
            <div className="panel-scroll panel-scroll-approvals">
              <div className="stack mini-stack">
                {pendingApprovals.map((request) => (
                  <div className="list-card dense" key={request.id}>
                    <div>
                      <PersonIdentity profile={profilesById.get(request.creator_id)} />
                      <p>{formatCurrency(request.amount_in_paise)} for {request.reason}</p>
                      <small>Debt date {formatDateOnly(new Date(request.debt_date))} - Due {formatDate(request.due_at)}</small>
                    </div>
                    <div className="row-actions">
                      <button className="primary-button compact-action-button" onClick={() => onRespondDebt(request.id, true)} disabled={mutating} type="button">Approve</button>
                      <button className="ghost-button compact-action-button" onClick={() => onRespondDebt(request.id, false)} disabled={mutating} type="button">Reject</button>
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
                      <button className="primary-button compact-action-button" onClick={() => onRespondSettlement(settlement.id, true)} disabled={mutating} type="button">Approve</button>
                      <button className="ghost-button compact-action-button" onClick={() => onRespondSettlement(settlement.id, false)} disabled={mutating} type="button">Reject</button>
                    </div>
                  </div>
                ))}
                {pendingItems.map((item) => {
                  const actor = profilesById.get(getSharedItemRequesterId(item));
                  const isReturn = item.status === "pending_return";
                  const message = isReturn
                    ? `${readableProfile(actor)} wants to confirm "${item.item_name}" was returned.`
                    : `${readableProfile(actor)} logged "${item.item_name}" for approval.`;

                  return (
                    <div className="list-card dense" key={item.id}>
                      <div>
                        <PersonIdentity profile={actor} />
                        <p>{message}</p>
                      </div>
                      <div className="row-actions">
                        <button className="primary-button compact-action-button" onClick={() => onRespondItem(item.id, isReturn ? "return_confirm" : "approve")} disabled={mutating} type="button">
                          {isReturn ? "Confirm received" : "Approve"}
                        </button>
                        <button className="ghost-button compact-action-button" onClick={() => onRespondItem(item.id, "reject")} disabled={mutating} type="button">Reject</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export function AboutDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  return (
    <div className="dialog-backdrop" onClick={onClose} role="presentation">
      <section className="dialog-card dialog-card-narrow" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <div>
            <h2>About Friends &amp; Benefits</h2>
            <p className="muted">A lightweight way to manage money and borrowed stuff inside a close circle.</p>
          </div>
          <DialogClose onClose={onClose} label="Close about dialog" />
        </div>
        <div className="dialog-body">
          <div className="about-hero">
            <img src="/fnb-logo.svg" alt="F&B Logo" />
            <p>Use F&amp;B to log debts, settlements, and shared items without losing track of who owes what or who has your stuff.</p>
          </div>
          <div className="about-block">
            <h3>How it works</h3>
            <ul className="about-list muted">
              <li><strong>Network:</strong> Add friends using their exact F&amp;B username.</li>
              <li><strong>Money:</strong> Log debts when you pay and settlements when money comes back.</li>
              <li><strong>Approvals:</strong> Each important action needs the other side to approve it.</li>
              <li><strong>Items:</strong> Track things you lent or borrowed with the same shared confirmation flow.</li>
            </ul>
          </div>
          <div className="about-block">
            <h3>Creator</h3>
            <div className="about-links">
              <a href="https://www.linkedin.com/in/karan-gupta-827731326/" target="_blank" rel="noopener noreferrer" className="primary-button about-link">Connect on LinkedIn</a>
              <a href="https://instagram.com/blackhairedkaran" target="_blank" rel="noopener noreferrer" className="ghost-button about-link">Follow @blackhairedkaran</a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export interface FriendsOverviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  incomingInvites: Friendship[];
  outgoingInvites: Friendship[];
  profilesById: Map<string, Profile>;
  mutating: boolean;
  onRespondInvite: (id: string, accept: boolean) => void;
}

export function FriendsOverviewDialog(props: FriendsOverviewDialogProps) {
  const { isOpen, onClose, incomingInvites, outgoingInvites, profilesById, mutating, onRespondInvite } = props;
  if (!isOpen) return null;

  return (
    <div className="dialog-backdrop" onClick={onClose} role="presentation">
      <section className="dialog-card dialog-card-wide summary-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <div>
            <h2>Friend invites</h2>
            <p className="muted">Review incoming requests and keep an eye on outgoing ones.</p>
          </div>
          <DialogClose onClose={onClose} label="Close friend invites dialog" />
        </div>

        <div className="panel-scroll dialog-scroll-fill">
          <div className="dialog-section-block dialog-two-column-grid">
            <section className="dialog-subsection">
              <div className="dialog-section-head">
                <h3>Incoming invites</h3>
                <span className="count-chip">{incomingInvites.length}</span>
              </div>
              {incomingInvites.length === 0 ? (
                <div className="dialog-empty-block compact-empty-block">
                  <p className="empty-state">No incoming requests right now.</p>
                </div>
              ) : (
                <div className="stack mini-stack">
                  {incomingInvites.map((invite) => (
                    <div className="list-card dense summary-list-card invite-summary-card" key={invite.id}>
                      <div className="invite-summary-identity">
                        <Avatar profile={profilesById.get(invite.requester_id)} size="medium" />
                        <div className="invite-summary-copy">
                          <strong>{readableProfile(profilesById.get(invite.requester_id))}</strong>
                          <p>@{profilesById.get(invite.requester_id)?.username ?? "unknown"}</p>
                        </div>
                      </div>
                      <div className="row-actions summary-card-actions">
                        <button className="primary-button compact-action-button" disabled={mutating} onClick={() => onRespondInvite(invite.id, true)} type="button">Accept</button>
                        <button className="ghost-button compact-action-button" disabled={mutating} onClick={() => onRespondInvite(invite.id, false)} type="button">Decline</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="dialog-subsection">
              <div className="dialog-section-head">
                <h3>Outgoing invites</h3>
                <span className="count-chip">{outgoingInvites.length}</span>
              </div>
              {outgoingInvites.length === 0 ? (
                <div className="dialog-empty-block compact-empty-block">
                  <p className="empty-state">No invites waiting on your side.</p>
                </div>
              ) : (
                <div className="stack mini-stack">
                  {outgoingInvites.map((invite) => (
                    <div className="list-card dense summary-list-card invite-summary-card" key={invite.id}>
                      <div className="invite-summary-identity">
                        <Avatar profile={profilesById.get(invite.addressee_id)} size="medium" />
                        <div className="invite-summary-copy">
                          <strong>{readableProfile(profilesById.get(invite.addressee_id))}</strong>
                          <p>@{profilesById.get(invite.addressee_id)?.username ?? "unknown"}</p>
                        </div>
                      </div>
                      <div className="row-actions summary-card-actions">
                        <span className="pill pill-small">Waiting</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </section>
    </div>
  );
}

export interface ItemsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  itemForm: ItemFormState;
  setItemForm: React.Dispatch<React.SetStateAction<ItemFormState>>;
  balances: FriendSummary[];
  error: string | null;
  feedback: string | null;
  onSubmit: () => void;
}

export function ItemsDialog(props: ItemsDialogProps) {
  if (!props.isOpen) return null;
  const { onClose, itemForm, setItemForm, balances, error, feedback, onSubmit } = props;

  return (
    <div className="dialog-backdrop" onClick={onClose} role="presentation">
      <section className="dialog-card form-dialog dialog-card-narrow" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <div>
            <h2>Log shared item</h2>
            <p className="muted">Track what you lent out or borrowed in one place.</p>
          </div>
          <DialogClose onClose={onClose} label="Close items dialog" />
        </div>

        <DialogBanner error={error} feedback={feedback} />

        <div className="dialog-body">
          <div className="form-grid compact-grid">
            <label>
              <span className="profile-label">Action</span>
              <div className="select-shell">
                <select className="select-control" value={itemForm.type} onChange={(e) => setItemForm((c) => ({ ...c, type: e.target.value as "gave" | "borrowed" }))}>
                  <option value="gave">I lent an item to...</option>
                  <option value="borrowed">I borrowed an item from...</option>
                </select>
                <span className="select-shell-icon" aria-hidden="true">
                  <ChevronDownIcon className="select-chevron-icon" />
                </span>
              </div>
            </label>
            <label>
              <span className="profile-label">{itemForm.type === "gave" ? "To friend" : "From friend"}</span>
              <FriendPicker friends={balances} selectedId={itemForm.friendId} onSelect={(id) => setItemForm((c) => ({ ...c, friendId: id }))} placeholder="Choose a friend" />
            </label>
            <label>
              <span className="profile-label">Item name</span>
              <input type="text" value={itemForm.name} onChange={(e) => setItemForm((c) => ({ ...c, name: e.target.value }))} placeholder="The Matrix DVD, Toolkit, Cash" />
            </label>
          </div>
          <div className="action-row dialog-actions-end">
            <button className="primary-button" onClick={onSubmit} type="button">Save item record</button>
          </div>
        </div>
      </section>
    </div>
  );
}

export interface FullItemsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sharedItems: SharedItem[];
  profiles: Profile[];
  userId: string;
  onCancelItem: (id: string) => void;
  onRequestReturn: (id: string, e?: React.MouseEvent) => void;
  onOpenApprovals: () => void;
}

export function FullItemsDialog(props: FullItemsDialogProps) {
  const { isOpen, onClose, sharedItems, profiles, userId, onCancelItem, onRequestReturn, onOpenApprovals } = props;
  if (!isOpen) return null;

  const pendingItemsCount = sharedItems.filter((item) => canApproveSharedItem(item, userId)).length;

  return (
    <div className="dialog-backdrop" onClick={onClose} role="presentation">
      <section className="dialog-card dialog-card-wide full-items-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <div>
            <h2>Shared items tracker</h2>
            <p className="muted">A focused view of everything you have lent or borrowed.</p>
          </div>
          <DialogClose onClose={onClose} label="Close full items dialog" />
        </div>

        <div className="panel-scroll dialog-scroll-fill">
          {pendingItemsCount > 0 ? (
            <div className="dialog-callout">
              <div>
                <strong>{pendingItemsCount} item requests pending</strong>
                <p className="muted">Some items are waiting for your confirmation.</p>
              </div>
              <button className="primary-button compact-action-button" onClick={onOpenApprovals} type="button">Go to Approvals</button>
            </div>
          ) : null}

          <div className="section-stack">
            {sharedItems.length === 0 ? (
              <div className="dialog-empty-block">
                <p className="empty-state">No shared items right now.</p>
              </div>
            ) : (
                <div className="stack">
                  {sharedItems.map((item) => (
                    <div className="list-card item-full-card" key={item.id}>
                      <div className="item-full-copy">
                        <div className="item-row-header">
                          <strong>{item.item_name}</strong>
                          <span className={`pill status-${item.status}`}>{item.status.replace("_", " ")}</span>
                        </div>
                        <p className="muted item-row-copy">
                          {isSharedItemBorrower(item, userId) ? "Borrowed from" : "Lent to"} {profiles.find((p) => p.id === getSharedItemCounterpartyId(item, userId))?.full_name || "friend"}
                        </p>
                        <small className="muted">Created {new Date(item.created_at).toLocaleDateString()}</small>
                      </div>

                      <div className="row-actions item-full-actions">
                      {item.status === "pending" && item.owner_id === userId ? (
                        <button className="ghost-button danger-ghost-button compact-action-button" onClick={() => onCancelItem(item.id)} type="button">Cancel request</button>
                      ) : null}

                      {item.status === "active" ? (
                        isSharedItemBorrower(item, userId) ? (
                          <button className="primary-button compact-action-button" onClick={(e) => onRequestReturn(item.id, e)} type="button">Mark as returned</button>
                        ) : (
                          <div className="item-status-note">In use</div>
                        )
                      ) : null}

                      {item.status === "pending_return" && !canApproveSharedItem(item, userId) ? <span className="pill status-pending">Being returned...</span> : null}

                      {canApproveSharedItem(item, userId) ? (
                        <button className="primary-button compact-action-button" onClick={onOpenApprovals} type="button">Go to Approvals</button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="dialog-footer-note">
          <p className="muted">Tip: action buttons appear only when there is something for you to confirm or update.</p>
        </div>
      </section>
    </div>
  );
}

export interface RecentActivityDialogProps {
  isOpen: boolean;
  onClose: () => void;
  recentActivity: ActivityItem[];
}

export function RecentActivityDialog(props: RecentActivityDialogProps) {
  const { isOpen, onClose, recentActivity } = props;
  if (!isOpen) return null;

  return (
    <div className="dialog-backdrop" onClick={onClose} role="presentation">
      <section className="dialog-card dialog-card-wide recent-activity-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <div>
            <h2>Recent activity</h2>
            <p className="muted">A focused view of the latest debts and settlements across your network.</p>
          </div>
          <DialogClose onClose={onClose} label="Close recent activity dialog" />
        </div>

        <div className="panel-scroll dialog-scroll-fill">
          {recentActivity.length === 0 ? (
            <div className="dialog-empty-block">
              <p className="empty-state">No activity yet.</p>
            </div>
          ) : (
            <div className="stack mini-stack recent-activity-stack">
              {recentActivity.map((item) => (
                <div className="list-card dense recent-activity-card" key={`${item.kind}-${item.id}`}>
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

        <div className="dialog-footer-note">
          <p className="muted">Tip: this list updates after every approved debt, settlement, or new statement-worthy change.</p>
        </div>
      </section>
    </div>
  );
}
