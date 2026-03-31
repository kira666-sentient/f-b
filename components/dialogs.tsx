"use client";

import React from "react";
import type { Profile, DebtRequest, Settlement, SharedItem } from "@/lib/app-types";
import type { FriendSummary, StatementEntry, DebtFormState, SettlementFormState, ItemFormState } from "@/lib/types";
import { formatCurrency, formatDate, formatDateTime, formatDateOnly, readableProfile } from "@/lib/helpers";
import { Avatar, PersonIdentity, FriendPicker } from "./ui";

/* ═══════════════════════════════════════════════════════
   Profile Dialog
   ═══════════════════════════════════════════════════════ */

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
    <div className="dialog-backdrop" onClick={onClose} role="presentation">
      <section className="dialog-card" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <div>
            <h2>{profileNeedsSetup ? "Finish your profile" : "Your profile"}</h2>
            <p className="muted">
              {profileNeedsSetup
                ? "We generated a starter username, but you should pick one your friends can type easily."
                : "This username is what your friends use to find you. You can change it anytime."}
            </p>
          </div>
          <button aria-label="Close profile dialog" className="ghost-button dialog-close-button" onClick={onClose} type="button">X</button>
        </div>

        {(error || feedback) && (
          <div className={`dialog-banner ${error ? "error-banner" : "success-banner"}`} style={{ borderRadius: '12px', padding: '12px 16px', marginBottom: '20px', fontSize: '0.9rem' }}>
            {error ?? feedback}
          </div>
        )}

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
            <span>UPI ID (Optional but recommended)</span>
            <input type="text" value={upiIdDraft} onChange={(e) => setUpiIdDraft(e.target.value)} placeholder="name@okaxis" />
            <small className="muted" style={{ display: "block", marginTop: "4px" }}>
              Used to generate 1-click payment links so friends can pay you easily.
            </small>
          </label>
        </div>

        <div className="action-row">
          <button className="primary-button" onClick={onSave} disabled={savingUsername}>
            {savingUsername ? "Saving..." : "Save profile"}
          </button>
        </div>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Debt Dialog
   ═══════════════════════════════════════════════════════ */

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
          <h2>Record a debt</h2>
          <button aria-label="Close debt dialog" className="ghost-button dialog-close-button" onClick={onClose} type="button">X</button>
        </div>

        {(error || feedback) && (
          <div className={`dialog-banner ${error ? "error-banner" : "success-banner"}`} style={{ borderRadius: '12px', padding: '12px 16px', marginBottom: '20px', fontSize: '0.9rem' }}>
            {error ?? feedback}
          </div>
        )}

        <div className="dialog-body">
          <div className="form-grid compact-grid">
            <label>
              <span>Friend</span>
              <FriendPicker friends={balances} selectedId={debtForm.friendId} onSelect={(id) => setDebtForm((c) => ({ ...c, friendId: id }))} placeholder="Choose a friend" />
            </label>
          </div>

          {balances.length === 0 ? (
            <p className="empty-state action-hint">Add a friend first, then you can create a debt request here.</p>
          ) : friendSelected ? (
            <>
              <div className="hint-banner">Fill in the amount, date, and reason once you know who this is for.</div>
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
                  <span>Return by</span>
                  <input type="datetime-local" value={debtForm.dueAt} onChange={(e) => setDebtForm((c) => ({ ...c, dueAt: e.target.value }))} />
                </label>
                <label className="full-span">
                  <span>Reason</span>
                  <textarea rows={3} value={debtForm.reason} onChange={(e) => setDebtForm((c) => ({ ...c, reason: e.target.value }))} placeholder="Auto fare, dinner, movie tickets, cash loan..." />
                </label>
              </div>
              <div className="action-row">
                <button className="primary-button" onClick={onCreate} disabled={mutating}>Create debt request</button>
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

/* ═══════════════════════════════════════════════════════
   Settlement Dialog
   ═══════════════════════════════════════════════════════ */

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

  return (
    <div className="dialog-backdrop" onClick={onClose} role="presentation">
      <section className="dialog-card form-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <h2>Record a settlement</h2>
          <button aria-label="Close settlement dialog" className="ghost-button dialog-close-button" onClick={onClose} type="button">X</button>
        </div>

        {(error || feedback) && (
          <div className={`dialog-banner ${error ? "error-banner" : "success-banner"}`} style={{ borderRadius: '12px', padding: '12px 16px', marginBottom: '20px', fontSize: '0.9rem' }}>
            {error ?? feedback}
          </div>
        )}

        <div className="dialog-body">
          <div className="form-grid compact-grid">
            <label>
              <span>Paid to</span>
              <FriendPicker friends={balances} selectedId={settlementForm.friendId} onSelect={(id) => setSettlementForm((c) => ({ ...c, friendId: id }))} placeholder="Choose a friend" />
            </label>
          </div>

          {balances.length === 0 ? (
            <p className="empty-state action-hint">Add a friend first, then you can record a settlement here.</p>
          ) : friendSelected ? (
            <>
              <div className="hint-banner">Add the amount and note only after choosing who you paid back.</div>
              <div className="form-grid compact-grid">
                <label>
                  <div className="section-head" style={{ marginBottom: "8px", alignItems: "flex-end", gap: "12px", border: "none" }}>
                    <span style={{ flexGrow: 1 }}>Amount in INR</span>
                    {(() => {
                      const f = balances.find((b) => b.profile.id === settlementForm.friendId);
                      return f && f.balanceInPaise < 0 ? (
                        <button className="ghost-button topbar-compact-button" type="button" onClick={() => setSettlementForm((c) => ({ ...c, amount: (Math.abs(f.balanceInPaise) / 100).toString() }))} style={{ minHeight: "28px", padding: "4px 10px", fontSize: "0.8rem", margin: 0 }}>
                          Pay in full
                        </button>
                      ) : null;
                    })()}
                  </div>
                  <input type="number" inputMode="decimal" min="0" step="0.01" value={settlementForm.amount} onChange={(e) => setSettlementForm((c) => ({ ...c, amount: e.target.value }))} placeholder="200" />
                  {(() => {
                    const f = balances.find((b) => b.profile.id === settlementForm.friendId);
                    const entered = Number(settlementForm.amount) * 100;
                    if (f && f.balanceInPaise < 0 && entered > Math.abs(f.balanceInPaise)) {
                      const excess = ((entered - Math.abs(f.balanceInPaise)) / 100).toFixed(2);
                      return <span style={{ color: "var(--danger)", fontSize: "0.85rem", marginTop: "8px", display: "block" }}>Note: You are paying ₹{excess} more than you currently owe them.</span>;
                    }
                    return null;
                  })()}
                </label>
                <label className="full-span">
                  <span>Note</span>
                  <input value={settlementForm.note} onChange={(e) => setSettlementForm((c) => ({ ...c, note: e.target.value }))} placeholder="UPI transfer, cash returned, bank transfer..." />
                </label>
              </div>
              <div className="action-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <button className="ghost-button" onClick={onCreateSettlement} disabled={mutating}>Record manual</button>
                <button className="primary-button" onClick={onPayOnline} disabled={mutating}>Pay online</button>
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

/* ═══════════════════════════════════════════════════════
   Statement Dialog
   ═══════════════════════════════════════════════════════ */

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
            <p className="muted">Full record with {readableProfile(selectedFriend.profile)}.</p>
          </div>
          <button aria-label="Close statement dialog" className="ghost-button dialog-close-button" onClick={onClose} type="button">X</button>
        </div>

        {(error || feedback) && (
          <div className={`dialog-banner ${error ? "error-banner" : "success-banner"}`} style={{ borderRadius: '12px', padding: '12px 16px', marginBottom: '20px', fontSize: '0.9rem' }}>{error ?? feedback}</div>
        )}

        <div className="statement-shell">
          <div className="statement-header" style={{ marginBottom: "16px" }}>
            <PersonIdentity profile={selectedFriend.profile} />
            <span className={`amount-badge ${selectedFriend.balanceInPaise > 0 ? "positive" : selectedFriend.balanceInPaise < 0 ? "negative" : ""}`}>
              {formatCurrency(selectedFriend.balanceInPaise)}
            </span>
          </div>

          <div className="action-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "20px" }}>
            <button className="primary-button" onClick={() => onPayFriend(selectedFriend.profile.id)}>💸 Pay them</button>
            <button className="ghost-button" onClick={() => onLogExpense(selectedFriend.profile.id)}>📝 Log expense</button>
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

/* ═══════════════════════════════════════════════════════
   Approvals Dialog
   ═══════════════════════════════════════════════════════ */

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
          <h2>Pending approvals</h2>
          <button className="ghost-button dialog-close-button" onClick={onClose}>X</button>
        </div>

        {(error || feedback) && (
          <div className={`dialog-banner ${error ? "error-banner" : "success-banner"}`} style={{ borderRadius: '12px', padding: '12px 16px', marginBottom: '20px', fontSize: '0.9rem' }}>{error ?? feedback}</div>
        )}

        <div className="dialog-body">
          <p className="muted" style={{ marginBottom: "16px" }}>These requests need your decision.</p>

          {pendingApprovals.length === 0 && pendingSettlements.length === 0 && pendingItems.length === 0 ? (
            <p className="empty-state">No approvals waiting for you.</p>
          ) : (
            <div className="panel-scroll" style={{ maxHeight: "60vh" }}>
              <div className="stack mini-stack">
                {pendingApprovals.map((request) => {
                  const creator = profilesById.get(request.creator_id);
                  return (
                    <div className="list-card dense" key={request.id}>
                      <div>
                        <PersonIdentity profile={creator} />
                        <p>{formatCurrency(request.amount_in_paise)} for {request.reason}</p>
                        <small>Debt date {formatDateOnly(new Date(request.debt_date))} - Due {formatDate(request.due_at)}</small>
                      </div>
                      <div className="row-actions">
                        <button className="primary-button" onClick={() => onRespondDebt(request.id, true)} disabled={mutating}>Approve</button>
                        <button className="ghost-button" onClick={() => onRespondDebt(request.id, false)} disabled={mutating}>Reject</button>
                      </div>
                    </div>
                  );
                })}
                {pendingSettlements.map((settlement) => {
                  const payer = profilesById.get(settlement.payer_id);
                  return (
                    <div className="list-card dense" key={settlement.id}>
                      <div>
                        <PersonIdentity profile={payer} />
                        <p>{formatCurrency(settlement.amount_in_paise)} payment</p>
                        <small>{settlement.note || "No note"}</small>
                      </div>
                      <div className="row-actions">
                        <button className="primary-button" onClick={() => onRespondSettlement(settlement.id, true)} disabled={mutating}>Approve</button>
                        <button className="ghost-button" onClick={() => onRespondSettlement(settlement.id, false)} disabled={mutating}>Reject</button>
                      </div>
                    </div>
                  );
                })}
                {pendingItems.map((item) => {
                  const actor = profilesById.get(item.owner_id);
                  const isReturn = item.status === "pending_return";
                  const actorName = readableProfile(actor);
                  const verb = isReturn
                    ? `wants to return "${item.item_name}"`
                    : `logged "${item.item_name}" (${item.type === "gave" ? "lent to you" : "borrowed from you"})`;

                  return (
                    <div className="list-card dense" key={item.id}>
                      <div>
                        <PersonIdentity profile={actor} />
                        <p>{actorName} {verb}</p>
                      </div>
                      <div className="row-actions">
                        <button className="primary-button" onClick={() => onRespondItem(item.id, isReturn ? "return_confirm" : "approve")} disabled={mutating}>
                          {isReturn ? "Confirm Received" : "Approve"}
                        </button>
                        <button className="ghost-button" onClick={() => onRespondItem(item.id, "reject")} disabled={mutating}>Reject</button>
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

/* ═══════════════════════════════════════════════════════
   About Dialog
   ═══════════════════════════════════════════════════════ */

export function AboutDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  return (
    <div className="dialog-backdrop" onClick={onClose} role="presentation">
      <section className="dialog-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div className="dialog-head">
          <h2>About Friends &amp; Benefits</h2>
          <button className="ghost-button dialog-close-button" onClick={onClose}>X</button>
        </div>
        <div className="dialog-body" style={{ padding: '24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <img src="/fnb-logo.svg" alt="F&B Logo" style={{ height: '64px', width: 'auto', marginBottom: '16px' }} />
            <p>A simple, offline-friendly tool to track debts, settlements, and shared items within your closest circle of friends.</p>
          </div>
          <h3 style={{ fontSize: '1.05rem', marginBottom: '12px', borderBottom: '1px solid var(--line)', paddingBottom: '8px' }}>How to use</h3>
          <ul className="muted" style={{ fontSize: '0.9rem', paddingLeft: '20px', display: 'grid', gap: '8px', marginBottom: '24px' }}>
            <li><strong>Network:</strong> Add friends using their exact F&amp;B username.</li>
            <li><strong>Money:</strong> Log debts when you pay for them, or settlements when they pay you back offline.</li>
            <li><strong>Approvals:</strong> Once you log an action, the other person must approve it!</li>
            <li><strong>Items:</strong> Track lent/borrowed items. Both logging and returning require dual-consent to stay accurate.</li>
          </ul>
          <h3 style={{ fontSize: '1.05rem', marginBottom: '12px', borderBottom: '1px solid var(--line)', paddingBottom: '8px' }}>About the Creator</h3>
          <div style={{ display: 'grid', gap: '12px', marginTop: '16px' }}>
            <a href="https://www.linkedin.com/in/karan-gupta-827731326/" target="_blank" rel="noopener noreferrer" className="primary-button" style={{ textDecoration: 'none', textAlign: 'center' }}>Connect on LinkedIn</a>
            <a href="https://instagram.com/blackhairedkaran" target="_blank" rel="noopener noreferrer" className="ghost-button" style={{ textDecoration: 'none', textAlign: 'center', border: '1px solid var(--line)' }}>Follow @blackhairedkaran</a>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Items Dialog
   ═══════════════════════════════════════════════════════ */

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
      <section className="dialog-card form-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div className="dialog-head">
          <h2>Log Shared Item</h2>
          <button className="ghost-button dialog-close-button" onClick={onClose}>X</button>
        </div>

        {(error || feedback) && (
          <div className={`dialog-banner ${error ? "error-banner" : "success-banner"}`} style={{ borderRadius: '12px', padding: '12px 16px', marginBottom: '20px', fontSize: '0.9rem' }}>{error ?? feedback}</div>
        )}

        <div className="dialog-body">
          <div className="form-grid compact-grid" style={{ marginBottom: '20px' }}>
            <label>
              <span className="profile-label">Action</span>
              <select value={itemForm.type} onChange={(e) => setItemForm((c) => ({ ...c, type: e.target.value as "gave" | "borrowed" }))} style={{ padding: '12px', borderRadius: '12px', border: '1px solid var(--line)' }}>
                <option value="gave">I lent an item to...</option>
                <option value="borrowed">I borrowed an item from...</option>
              </select>
            </label>
            <label>
              <span className="profile-label">{itemForm.type === 'gave' ? 'To Friend' : 'From Friend'}</span>
              <FriendPicker friends={balances} selectedId={itemForm.friendId} onSelect={(id) => setItemForm((c) => ({ ...c, friendId: id }))} placeholder="Choose a friend" />
            </label>
            <label>
              <span className="profile-label">Item Name</span>
              <input type="text" value={itemForm.name} onChange={(e) => setItemForm((c) => ({ ...c, name: e.target.value }))} placeholder="e.g., The Matrix DVD, Toolkit, 500Rs Cash" />
            </label>
          </div>
          <div className="action-row">
            <button className="primary-button" onClick={onSubmit}>Save Item record</button>
          </div>
        </div>
      </section>
    </div>
  );
}
