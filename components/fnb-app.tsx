"use client";

/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getAppOrigin, getSupabaseBrowserClient, hasSupabaseEnv } from "@/lib/supabase";
import type { DebtRequest, Friendship, Profile, Settlement, SharedItem } from "@/lib/app-types";
import type { FriendSummary, ActivityItem, StatementEntry, DashboardData, DebtFormState, SettlementFormState, ItemFormState } from "@/lib/types";
import { formatCurrency, formatUsernameCandidate, makeStarterUsername, readableProfile, getErrorMessage } from "@/lib/helpers";

import FnbLanding from "./fnb-landing";
import { ProfileDialog, DebtDialog, SettlementDialog, StatementDialog, ApprovalsDialog, AboutDialog, ItemsDialog } from "./dialogs";
import { MobileSidebar, MobileHome, MobileNetworkPage, MobileApprovalsPage, MobileMoneyPage, MobileItemsPage, MobileActivityPage } from "./mobile-views";
import { Topbar, ProfileStrip, StatGrid, DashboardGrid, ActivityPanel } from "./desktop-views";

export default function FnbApp() {
  const supabase = getSupabaseBrowserClient();
  const envReady = hasSupabaseEnv();

  /* ── Core state ────────────────────────────────────── */
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingUsername, startSavingUsername] = useTransition();
  const [mutating, startMutation] = useTransition();

  const [dashboard, setDashboard] = useState<DashboardData>({
    profile: null, friendships: [], profiles: [], debtRequests: [], settlements: [], sharedItems: []
  });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* ── UI state ──────────────────────────────────────── */
  const [usernameDraft, setUsernameDraft] = useState("");
  const [upiIdDraft, setUpiIdDraft] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isInviteFormOpen, setIsInviteFormOpen] = useState(false);
  const [isApprovalsDialogOpen, setIsApprovalsDialogOpen] = useState(false);
  const [inviteUsername, setInviteUsername] = useState("");
  const [debtForm, setDebtForm] = useState<DebtFormState>({ friendId: "", amount: "", reason: "", debtDate: new Date().toISOString().slice(0, 10), dueAt: "" });
  const [settlementForm, setSettlementForm] = useState<SettlementFormState>({ friendId: "", amount: "", note: "" });
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [isStatementDialogOpen, setIsStatementDialogOpen] = useState(false);
  const [isDebtDialogOpen, setIsDebtDialogOpen] = useState(false);
  const [isSettlementDialogOpen, setIsSettlementDialogOpen] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState("");
  const [mobilePage, setMobilePage] = useState<"home" | "network" | "approvals" | "money" | "activity" | "items">("home");
  const [isItemsDialogOpen, setIsItemsDialogOpen] = useState(false);
  const [itemForm, setItemForm] = useState<ItemFormState>({ name: "", type: "gave", friendId: "", date: new Date().toISOString().slice(0, 10) });
  const [isAboutDialogOpen, setIsAboutDialogOpen] = useState(false);

  /* ── Physical Back Button (Fixed for Android) ──────── */
  const historyPushedRef = useRef(false);

  useEffect(() => {
    const isAnyDialogOpen = isSidebarOpen || isInviteFormOpen || isApprovalsDialogOpen || isProfileDialogOpen || isStatementDialogOpen || isDebtDialogOpen || isSettlementDialogOpen || isItemsDialogOpen || isAboutDialogOpen;
    const isSubPage = mobilePage !== "home";
    const needsBackHandler = isSubPage || isAnyDialogOpen;

    if (needsBackHandler && !historyPushedRef.current) {
      window.history.pushState({ fnbModal: true }, "");
      historyPushedRef.current = true;
    }

    if (!needsBackHandler && historyPushedRef.current) {
      historyPushedRef.current = false;
    }

    const handlePopState = () => {
      historyPushedRef.current = false;
      if (isAboutDialogOpen) { setIsAboutDialogOpen(false); return; }
      if (isItemsDialogOpen) { setIsItemsDialogOpen(false); return; }
      if (isSettlementDialogOpen) { setIsSettlementDialogOpen(false); return; }
      if (isDebtDialogOpen) { setIsDebtDialogOpen(false); return; }
      if (isStatementDialogOpen) { setIsStatementDialogOpen(false); return; }
      if (isProfileDialogOpen) { setIsProfileDialogOpen(false); return; }
      if (isApprovalsDialogOpen) { setIsApprovalsDialogOpen(false); return; }
      if (isInviteFormOpen) { setIsInviteFormOpen(false); return; }
      if (isSidebarOpen) { setIsSidebarOpen(false); return; }
      if (mobilePage !== "home") { setMobilePage("home"); return; }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [mobilePage, isSidebarOpen, isInviteFormOpen, isApprovalsDialogOpen, isProfileDialogOpen, isStatementDialogOpen, isDebtDialogOpen, isSettlementDialogOpen, isItemsDialogOpen, isAboutDialogOpen]);

  /* ── Toast auto-dismiss ────────────────────────────── */
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toastExiting, setToastExiting] = useState(false);

  useEffect(() => {
    if (feedback || error) {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setToastExiting(false);
      toastTimerRef.current = setTimeout(() => {
        setToastExiting(true);
        setTimeout(() => { setFeedback(null); setError(null); setToastExiting(false); }, 300);
      }, 4000);
    }
    return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); };
  }, [feedback, error]);

  /* ── Dialog openers ────────────────────────────────── */
  function openProfileDialog() {
    setError(null); setFeedback(null);
    setUsernameDraft(dashboard.profile?.username ?? "");
    setUpiIdDraft(dashboard.profile?.upi_id ?? "");
    setIsProfileDialogOpen(true);
  }

  function openStatementDialog(friendId: string) {
    setError(null); setFeedback(null);
    setSelectedFriendId(friendId);
    setIsStatementDialogOpen(true);
  }

  /* ── Auth & Bootstrap ──────────────────────────────── */
  useEffect(() => {
    const client = supabase;
    if (!client) { setBooting(false); return; }
    const readyClient = client;
    let active = true;

    async function bootstrap() {
      const { data: { session: currentSession } } = await readyClient.auth.getSession();
      if (!active) return;
      setSession(currentSession);
      if (currentSession?.user) {
        await ensureProfile(currentSession.user);
        await loadDashboard(currentSession.user.id);
      }
      if (active) setBooting(false);
    }

    bootstrap().catch((cause: unknown) => { if (active) { setError(getErrorMessage(cause)); setBooting(false); } });

    const { data: { subscription } } = readyClient.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event !== "TOKEN_REFRESHED") { setError(null); setFeedback(null); }
      if (!nextSession?.user) {
        setDashboard({ profile: null, friendships: [], profiles: [], debtRequests: [], settlements: [], sharedItems: [] });
        return;
      }
      const shouldSyncProfile = event === "SIGNED_IN" || event === "USER_UPDATED" || event === "INITIAL_SESSION";
      void (async () => {
        try {
          if (shouldSyncProfile) await ensureProfile(nextSession.user);
          await loadDashboard(nextSession.user.id, { silent: true });
        } catch (cause: unknown) { setError(getErrorMessage(cause)); }
      })();
    });

    return () => { active = false; subscription.unsubscribe(); };
  }, [supabase]);

  /* ── Background polling ────────────────────────────── */
  useEffect(() => {
    if (!session?.user) return;
    const refreshSilently = () => { void loadDashboard(session.user.id, { silent: true }).catch((c: unknown) => setError(getErrorMessage(c))); };
    const intervalId = window.setInterval(refreshSilently, 60000);
    const handleFocus = () => refreshSilently();
    const handleVisibility = () => { if (document.visibilityState === "visible") refreshSilently(); };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => { window.clearInterval(intervalId); window.removeEventListener("focus", handleFocus); document.removeEventListener("visibilitychange", handleVisibility); };
  }, [session?.user?.id]);

  /* ── Data fetching ─────────────────────────────────── */
  async function ensureProfile(user: User) {
    const client = supabase;
    if (!client) return;
    const profilePayload = { id: user.id, full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? "Friend", avatar_url: user.user_metadata?.avatar_url ?? null };
    const { error: upsertError } = await client.from("profiles").upsert(profilePayload, { onConflict: "id" });
    if (upsertError) throw upsertError;
    const { data: existingProfile, error: readError } = await client.from("profiles").select("id, username").eq("id", user.id).single();
    if (readError) throw readError;
    if (!existingProfile.username) {
      const { error: usernameError } = await client.from("profiles").update({ username: makeStarterUsername(user) }).eq("id", user.id).is("username", null);
      if (usernameError) throw usernameError;
    }
  }

  async function loadDashboard(userId: string, options?: { silent?: boolean }) {
    const client = supabase;
    if (!client) return;
    const silent = options?.silent ?? false;
    if (!silent) setRefreshing(true);

    const [profileResult, friendshipsResult, debtsResult, settlementsResult, itemsResult] = await Promise.all([
      client.from("profiles").select("id, username, full_name, avatar_url, upi_id, created_at").eq("id", userId).single(),
      client.from("friendships").select("id, requester_id, addressee_id, status, created_at, responded_at").or(`requester_id.eq.${userId},addressee_id.eq.${userId}`).order("created_at", { ascending: false }),
      client.from("debt_requests").select("id, creator_id, approver_id, amount_in_paise, currency, reason, debt_date, due_at, status, approved_at, rejected_at, created_at").or(`creator_id.eq.${userId},approver_id.eq.${userId}`).order("created_at", { ascending: false }),
      client.from("settlements").select("id, payer_id, receiver_id, amount_in_paise, currency, note, settled_at, status, approved_at, rejected_at, created_at").or(`payer_id.eq.${userId},receiver_id.eq.${userId}`).order("settled_at", { ascending: false }),
      client.from("shared_items").select("id, owner_id, friend_id, item_name, type, status, created_at").or(`owner_id.eq.${userId},friend_id.eq.${userId}`).order("created_at", { ascending: false })
    ]);

    for (const r of [profileResult, friendshipsResult, debtsResult, settlementsResult, itemsResult]) {
      if (r.error) { if (!silent) setRefreshing(false); throw r.error; }
    }

    const friendships = (friendshipsResult.data ?? []) as Friendship[];
    const debtRequests = (debtsResult.data ?? []) as DebtRequest[];
    const settlements = (settlementsResult.data ?? []) as Settlement[];
    const sharedItems = (itemsResult.data ?? []) as SharedItem[];

    const relatedIds = new Set<string>();
    friendships.forEach((f) => { relatedIds.add(f.requester_id); relatedIds.add(f.addressee_id); });
    debtRequests.forEach((r) => { relatedIds.add(r.creator_id); relatedIds.add(r.approver_id); });
    settlements.forEach((s) => { relatedIds.add(s.payer_id); relatedIds.add(s.receiver_id); });
    sharedItems.forEach((i) => { relatedIds.add(i.owner_id); relatedIds.add(i.friend_id); });

    let profiles: Profile[] = [];
    const ids = [...relatedIds];
    if (ids.length > 0) {
      const profilesResult = await client.from("profiles").select("id, username, full_name, avatar_url, upi_id, created_at").in("id", ids);
      if (profilesResult.error) { if (!silent) setRefreshing(false); throw profilesResult.error; }
      profiles = (profilesResult.data ?? []) as Profile[];
    }

    setDashboard({ profile: profileResult.data as Profile, friendships, profiles, debtRequests, settlements, sharedItems });
    if (!silent) setRefreshing(false);
  }

  async function refreshData() {
    if (!session?.user) return;
    try { await loadDashboard(session.user.id); } catch (cause: unknown) { setError(getErrorMessage(cause)); }
  }

  /* ── Derived data ──────────────────────────────────── */
  const profilesById = useMemo(() => new Map(dashboard.profiles.map((p) => [p.id, p])), [dashboard.profiles]);

  const acceptedFriends = useMemo<FriendSummary[]>(() => {
    if (!session?.user) return [];
    return dashboard.friendships.filter((f) => f.status === "accepted").map((f) => {
      const friendId = f.requester_id === session.user.id ? f.addressee_id : f.requester_id;
      return { friendshipId: f.id, profile: profilesById.get(friendId) ?? { id: friendId, username: null, full_name: "Unknown friend", avatar_url: null, upi_id: null }, balanceInPaise: 0 };
    });
  }, [dashboard.friendships, profilesById, session?.user]);

  const balances = useMemo(() => {
    if (!session?.user) return acceptedFriends;
    const byFriend = new Map(acceptedFriends.map((f) => [f.profile.id, { ...f, balanceInPaise: 0 }]));
    dashboard.debtRequests.filter((r) => r.status === "approved").forEach((r) => {
      const friendId = r.creator_id === session.user.id ? r.approver_id : r.creator_id;
      const item = byFriend.get(friendId);
      if (item) item.balanceInPaise += r.creator_id === session.user.id ? r.amount_in_paise : -r.amount_in_paise;
    });
    dashboard.settlements.filter((s) => s.status === "approved").forEach((s) => {
      const friendId = s.payer_id === session.user.id ? s.receiver_id : s.payer_id;
      const item = byFriend.get(friendId);
      if (item) item.balanceInPaise += s.payer_id === session.user.id ? s.amount_in_paise : -s.amount_in_paise;
    });
    return [...byFriend.values()].sort((a, b) => Math.abs(b.balanceInPaise) - Math.abs(a.balanceInPaise));
  }, [acceptedFriends, dashboard.debtRequests, dashboard.settlements, session?.user]);

  useEffect(() => {
    if (balances.length === 0) { setSelectedFriendId(""); return; }
    if (!balances.some((f) => f.profile.id === selectedFriendId)) setSelectedFriendId(balances[0].profile.id);
  }, [balances, selectedFriendId]);

  const selectedFriend = useMemo(() => balances.find((f) => f.profile.id === selectedFriendId) ?? null, [balances, selectedFriendId]);

  const friendStatement = useMemo<StatementEntry[]>(() => {
    if (!session?.user || !selectedFriend) return [];
    const fId = selectedFriend.profile.id;
    const debts = dashboard.debtRequests.filter((r) => (r.creator_id === session.user.id ? r.approver_id : r.creator_id) === fId).map((r) => ({
      id: r.id, createdAt: r.created_at, kind: "debt" as const, title: r.creator_id === session.user.id ? `You logged a debt for ${readableProfile(selectedFriend.profile)}` : `${readableProfile(selectedFriend.profile)} logged a debt for you`,
      detail: r.reason, status: r.status, amountInPaise: r.amount_in_paise, balanceDeltaInPaise: r.status === "approved" ? (r.creator_id === session.user.id ? r.amount_in_paise : -r.amount_in_paise) : 0
    }));
    const setts = dashboard.settlements.filter((s) => (s.payer_id === session.user.id ? s.receiver_id : s.payer_id) === fId).map((s) => ({
      id: s.id, createdAt: s.settled_at, kind: "settlement" as const, title: s.payer_id === session.user.id ? `You paid ${readableProfile(selectedFriend.profile)}` : `${readableProfile(selectedFriend.profile)} paid you`,
      detail: s.note || "Settlement recorded", status: s.status, amountInPaise: s.amount_in_paise, balanceDeltaInPaise: s.status === "approved" ? (s.payer_id === session.user.id ? s.amount_in_paise : -s.amount_in_paise) : 0
    }));
    return [...debts, ...setts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [dashboard.debtRequests, dashboard.settlements, selectedFriend, session?.user]);

  const incomingInvites = useMemo(() => session?.user ? dashboard.friendships.filter((f) => f.status === "pending" && f.addressee_id === session.user.id) : [], [dashboard.friendships, session?.user]);
  const outgoingInvites = useMemo(() => session?.user ? dashboard.friendships.filter((f) => f.status === "pending" && f.requester_id === session.user.id) : [], [dashboard.friendships, session?.user]);
  const pendingApprovals = useMemo(() => session?.user ? dashboard.debtRequests.filter((r) => r.status === "pending" && r.approver_id === session.user.id) : [], [dashboard.debtRequests, session?.user]);
  const pendingSettlements = useMemo(() => session?.user ? dashboard.settlements.filter((s) => s.status === "pending" && s.receiver_id === session.user.id) : [], [dashboard.settlements, session?.user]);
  const pendingItems = useMemo(() => {
    if (!session?.user) return [];
    return dashboard.sharedItems.filter((i) => (i.status === "pending" && i.friend_id === session.user.id) || (i.status === "pending_return" && i.owner_id === session.user.id));
  }, [dashboard.sharedItems, session?.user]);

  const recentActivity = useMemo<ActivityItem[]>(() => {
    if (!session?.user) return [];
    const debtItems = dashboard.debtRequests.map((r) => { const p = profilesById.get(r.creator_id === session.user.id ? r.approver_id : r.creator_id); return { id: r.id, kind: "debt" as const, createdAt: r.created_at, profile: p ?? null, label: r.creator_id === session.user.id ? `${readableProfile(p)} owes you` : `You owe ${readableProfile(p)}`, detail: r.reason, status: r.status, amountInPaise: r.amount_in_paise }; });
    const settItems = dashboard.settlements.map((s) => { const p = profilesById.get(s.payer_id === session.user.id ? s.receiver_id : s.payer_id); return { id: s.id, kind: "settlement" as const, createdAt: s.settled_at, profile: p ?? null, label: s.payer_id === session.user.id ? `You paid ${readableProfile(p)}` : `${readableProfile(p)} paid you`, detail: s.note || "Settlement recorded", status: s.status, amountInPaise: s.amount_in_paise }; });
    return [...debtItems, ...settItems].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);
  }, [dashboard.debtRequests, dashboard.settlements, profilesById, session?.user]);

  const totalOwedToYou = balances.reduce((s, f) => f.balanceInPaise > 0 ? s + f.balanceInPaise : s, 0);
  const totalYouOwe = balances.reduce((s, f) => f.balanceInPaise < 0 ? s + Math.abs(f.balanceInPaise) : s, 0);

  /* ── Auth actions ──────────────────────────────────── */
  async function signInWithGoogle() {
    const client = supabase; if (!client) return;
    setError(null);
    const { error: signInError } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: getAppOrigin() } });
    if (signInError) setError(signInError.message);
  }

  async function signOut() {
    const client = supabase; if (!client) return;
    const { error: signOutError } = await client.auth.signOut();
    if (signOutError) setError(signOutError.message);
  }

  /* ── Mutation helpers ──────────────────────────────── */
  function resetMessages() { setError(null); setFeedback(null); }
  function setFailure(cause: unknown) { setFeedback(null); setError(getErrorMessage(cause)); }

  async function saveProfile() {
    const client = supabase; if (!client || !session?.user) return;
    const sanitized = formatUsernameCandidate(usernameDraft);
    if (!sanitized || sanitized.length < 3) { setError("Pick a username with at least 3 letters or numbers."); return; }
    const formattedUpi = upiIdDraft.trim().toLowerCase();
    if (formattedUpi && !formattedUpi.includes("@")) { setError("Please enter a valid UPI ID (e.g. yourname@bank) or leave it completely blank."); return; }
    resetMessages();
    startSavingUsername(async () => {
      const { error: updateError } = await client.from("profiles").update({ username: sanitized, upi_id: formattedUpi || null }).eq("id", session.user.id);
      if (updateError) { setFailure(updateError); return; }
      setFeedback("Profile updated."); setIsProfileDialogOpen(false); await refreshData();
    });
  }

  async function sendInvite() {
    const client = supabase; if (!client || !session?.user || !dashboard.profile) return;
    const username = formatUsernameCandidate(inviteUsername);
    if (!username) { setError("Enter your friend's username."); return; }
    if (username === dashboard.profile.username) { setError("You cannot invite yourself."); return; }
    resetMessages();
    startMutation(async () => {
      const { data: targetProfile, error: targetError } = await client.from("profiles").select("id, username, full_name, avatar_url").eq("username", username).single();
      if (targetError || !targetProfile) { setFailure("That username was not found."); return; }
      const { data: existing, error: existingError } = await client.from("friendships").select("id, status").or(`and(requester_id.eq.${session.user.id},addressee_id.eq.${targetProfile.id}),and(requester_id.eq.${targetProfile.id},addressee_id.eq.${session.user.id})`).limit(1);
      if (existingError) { setFailure(existingError); return; }
      if ((existing ?? []).length > 0) { setFailure("A friend request or friendship already exists."); return; }
      const { error: insertError } = await client.from("friendships").insert({ requester_id: session.user.id, addressee_id: targetProfile.id, status: "pending" });
      if (insertError) { setFailure(insertError); return; }
      setInviteUsername(""); setFeedback(`Invite sent to @${targetProfile.username}.`); await refreshData();
    });
  }

  async function respondToInvite(friendshipId: string, accept: boolean) {
    const client = supabase; if (!client) return; resetMessages();
    startMutation(async () => {
      const patch = accept ? { status: "accepted", responded_at: new Date().toISOString() } : { status: "blocked", responded_at: new Date().toISOString() };
      const { error: updateError } = await client.from("friendships").update(patch).eq("id", friendshipId);
      if (updateError) { setFailure(updateError); return; }
      setFeedback(accept ? "Friend request accepted." : "Friend request declined."); await refreshData();
    });
  }

  async function createDebt() {
    const client = supabase; if (!client || !session?.user) return;
    const amount = Number(debtForm.amount); const amountInPaise = Math.round(amount * 100);
    if (!debtForm.friendId) { setError("Choose a friend first."); return; }
    if (!amount || amountInPaise <= 0) { setError("Enter a valid amount."); return; }
    if (!debtForm.reason.trim()) { setError("Add a reason so both sides understand the debt."); return; }
    resetMessages();
    startMutation(async () => {
      const { error: insertError } = await client.from("debt_requests").insert({ creator_id: session.user.id, approver_id: debtForm.friendId, amount_in_paise: amountInPaise, currency: "INR", reason: debtForm.reason.trim(), debt_date: debtForm.debtDate, due_at: debtForm.dueAt ? new Date(debtForm.dueAt).toISOString() : null, status: "pending" });
      if (insertError) { setFailure(insertError); return; }
      setDebtForm({ friendId: "", amount: "", reason: "", debtDate: new Date().toISOString().slice(0, 10), dueAt: "" });
      setIsDebtDialogOpen(false); setFeedback("Debt request created and waiting for approval."); await refreshData();
    });
  }

  async function respondToDebt(requestId: string, approve: boolean) {
    const client = supabase; if (!client) return; resetMessages();
    startMutation(async () => {
      const { error: updateError } = await client.from("debt_requests").update(approve ? { status: "approved", approved_at: new Date().toISOString() } : { status: "rejected", rejected_at: new Date().toISOString() }).eq("id", requestId);
      if (updateError) { setFailure(updateError); return; }
      setFeedback(approve ? "Debt approved." : "Debt rejected."); await refreshData();
    });
  }

  async function respondToSettlement(settlementId: string, approve: boolean) {
    const client = supabase; if (!client) return; resetMessages();
    startMutation(async () => {
      const { error: updateError } = await client.from("settlements").update(approve ? { status: "approved", approved_at: new Date().toISOString() } : { status: "rejected", rejected_at: new Date().toISOString() }).eq("id", settlementId);
      if (updateError) { setFailure(updateError); return; }
      setFeedback(approve ? "Settlement approved." : "Settlement rejected."); await refreshData();
    });
  }

  async function createSettlement() {
    const client = supabase; if (!client || !session?.user) return;
    const amount = Number(settlementForm.amount); const amountInPaise = Math.round(amount * 100);
    if (!settlementForm.friendId) { setError("Choose who received the payment."); return; }
    if (!amount || amountInPaise <= 0) { setError("Enter a valid settlement amount."); return; }
    resetMessages();
    startMutation(async () => {
      const { error: insertError } = await client.from("settlements").insert({ payer_id: session.user.id, receiver_id: settlementForm.friendId, amount_in_paise: amountInPaise, currency: "INR", note: settlementForm.note.trim() || null, status: "pending" });
      if (insertError) { setFailure(insertError); return; }
      setSettlementForm({ friendId: "", amount: "", note: "" }); setIsSettlementDialogOpen(false); setFeedback("Settlement recorded."); await refreshData();
    });
  }

  async function payOnline() {
    const amount = Number(settlementForm.amount); const amountInPaise = Math.round(amount * 100);
    if (!settlementForm.friendId) { setError("Choose who received the payment."); return; }
    if (!amount || amountInPaise <= 0) { setError("Enter a valid settlement amount."); return; }
    const targetFriend = balances.find((f) => f.profile.id === settlementForm.friendId);
    if (!targetFriend) return;
    const upiId = targetFriend.profile.upi_id;
    if (!upiId) { setError("That friend has not linked a UPI ID. Ask them to add it to their profile, or use \"Record manual\" instead."); return; }
    resetMessages();
    startMutation(async () => {
      const { error: insertError } = await supabase!.from("settlements").insert({ payer_id: session!.user.id, receiver_id: settlementForm.friendId, amount_in_paise: amountInPaise, currency: "INR", note: (settlementForm.note.trim() || "UPI transfer initiated"), status: "pending" });
      if (insertError) { setFailure("Failed to connect to F&B server to record transaction attempt."); return; }
      const payeeName = encodeURIComponent(targetFriend.profile.full_name || "Friend");
      const upiUrl = `upi://pay?pa=${upiId}&pn=${payeeName}&am=${amount.toFixed(2)}&cu=INR&tn=F&B Settlement`;
      setFeedback("Opening your UPI app..."); setSettlementForm({ friendId: "", amount: "", note: "" }); setIsSettlementDialogOpen(false); await refreshData();
      window.location.href = upiUrl;
    });
  }

  const submitItemForm = async () => {
    const client = supabase;
    if (!itemForm.name.trim() || !itemForm.friendId || !session?.user || !client) { setError("Please provide an item name and choose a friend."); return; }
    startMutation(async () => {
      const { error: saveError } = await client.from("shared_items").insert({ owner_id: session.user.id, friend_id: itemForm.friendId, item_name: itemForm.name.trim(), type: itemForm.type, status: "pending" });
      if (saveError) { setError(getErrorMessage(saveError)); } else {
        setFeedback(`Item logged. Waiting for ${dashboard.profiles.find((p) => p.id === itemForm.friendId)?.full_name || 'friend'} to approve.`);
        setItemForm({ name: "", type: "gave", friendId: "", date: new Date().toISOString().slice(0, 10) }); setIsItemsDialogOpen(false); await refreshData();
      }
    });
  };

  const requestItemReturn = async (id: string, e?: React.MouseEvent) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const client = supabase; if (!session?.user || !client) return;
    startMutation(async () => {
      const { error: updateError } = await client.from("shared_items").update({ status: "pending_return" }).eq("id", id);
      if (updateError) setError(getErrorMessage(updateError)); else { setFeedback("Return request sent."); await refreshData(); }
    });
  };

  const respondToItem = async (id: string, action: "approve" | "reject" | "return_confirm") => {
    const client = supabase; if (!session?.user || !client) return;
    startMutation(async () => {
      let newStatus = ""; if (action === "approve") newStatus = "active"; else if (action === "reject") newStatus = "rejected"; else if (action === "return_confirm") newStatus = "returned";
      const { error: updateError } = await client.from("shared_items").update({ status: newStatus }).eq("id", id);
      if (updateError) setError(getErrorMessage(updateError)); else { setFeedback(action === "reject" ? "Item rejected." : "Item updated."); await refreshData(); }
    });
  };

  const cancelItem = async (id: string) => {
    const client = supabase; if (!session?.user || !client) return;
    startMutation(async () => {
      const { error: deleteError } = await client.from("shared_items").delete().eq("id", id);
      if (deleteError) setError(getErrorMessage(deleteError)); else { setFeedback("Item cancelled."); await refreshData(); }
    });
  };

  /* ── Profile setup check ───────────────────────────── */
  const profileNeedsSetup = !dashboard.profile?.username || dashboard.profile.username.length < 3;

  useEffect(() => {
    if (!booting && session?.user && dashboard.profile && profileNeedsSetup) {
      setUsernameDraft(dashboard.profile?.username ?? ""); setIsProfileDialogOpen(true);
    }
  }, [booting, dashboard.profile, profileNeedsSetup, session?.user]);

  useEffect(() => {
    if (!isProfileDialogOpen) setUsernameDraft(dashboard.profile?.username ?? "");
  }, [dashboard.profile?.username, isProfileDialogOpen]);

  /* ── Early returns ─────────────────────────────────── */
  if (!envReady) {
    return (
      <main className="shell">
        <section className="hero">
          <p className="eyebrow">Setup required</p>
          <h1>Connect Supabase to launch F&amp;B</h1>
          <p className="lede">Add your Supabase URL and anon key in <code>.env.local</code>, then enable Google auth in the Supabase dashboard.</p>
          <div className="panel inline-panel"><p>Required variables:</p><code>NEXT_PUBLIC_SUPABASE_URL</code><code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code></div>
        </section>
      </main>
    );
  }

  if (booting) {
    return (
      <main className="shell">
        <section className="hero">
          <p className="eyebrow">F&amp;B</p>
          <h1>Loading your balances</h1>
          <p className="lede">Pulling your session, profile, friends, debts, and settlements.</p>
        </section>
      </main>
    );
  }

  if (!session) return <FnbLanding onSignIn={signInWithGoogle} />;

  /* ── Render ────────────────────────────────────────── */
  const totalPending = pendingApprovals.length + pendingSettlements.length + pendingItems.length;

  return (
    <>
      {/* Toast */}
      {(feedback || error) && (
        <div className={`toast-notification ${error ? "toast-error" : "toast-success"} ${toastExiting ? "toast-exiting" : ""}`}>{error ?? feedback}</div>
      )}

      {/* Mobile Sidebar */}
      <MobileSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} profile={dashboard.profile} totalOwedToYou={totalOwedToYou} totalYouOwe={totalYouOwe} onOpenProfile={openProfileDialog} onRefresh={refreshData} onSignOut={signOut} />

      {/* Mobile Full-Screen Pages */}
      {mobilePage === "network" && (
        <MobileNetworkPage balances={balances} inviteUsername={inviteUsername} setInviteUsername={setInviteUsername} onSendInvite={sendInvite} mutating={mutating} incomingInvites={incomingInvites} outgoingInvites={outgoingInvites} profilesById={profilesById} onViewStatement={openStatementDialog} onRespondInvite={respondToInvite} onBack={() => setMobilePage("home")} />
      )}
      {mobilePage === "approvals" && (
        <MobileApprovalsPage pendingApprovals={pendingApprovals} pendingSettlements={pendingSettlements} profilesById={profilesById} mutating={mutating} onRespondDebt={respondToDebt} onRespondSettlement={respondToSettlement} onBack={() => setMobilePage("home")} />
      )}
      {mobilePage === "money" && (
        <MobileMoneyPage onOpenDebt={() => { resetMessages(); setIsDebtDialogOpen(true); }} onOpenSettlement={() => { resetMessages(); setIsSettlementDialogOpen(true); }} onBack={() => setMobilePage("home")} />
      )}
      {mobilePage === "items" && (
        <MobileItemsPage sharedItems={dashboard.sharedItems} profiles={dashboard.profiles} userId={session.user.id} onOpenItemsDialog={() => setIsItemsDialogOpen(true)} onCancelItem={cancelItem} onRequestReturn={requestItemReturn} onBack={() => setMobilePage("home")} />
      )}
      {mobilePage === "activity" && (
        <MobileActivityPage recentActivity={recentActivity} onBack={() => setMobilePage("home")} />
      )}

      <main className="shell app-shell">
        {/* Topbar */}
        <Topbar onOpenSidebar={() => setIsSidebarOpen(true)} onOpenAbout={() => setIsAboutDialogOpen(true)} />

        {/* Desktop Profile Strip */}
        <ProfileStrip profile={dashboard.profile} userEmail={session.user.email ?? ""} refreshing={refreshing} onEditProfile={openProfileDialog} onRefresh={refreshData} onSignOut={signOut} />

        {/* Desktop Stat Grid */}
        <StatGrid friendCount={balances.length} totalOwedToYou={totalOwedToYou} totalYouOwe={totalYouOwe} pendingCount={totalPending} onOpenApprovals={() => { resetMessages(); setIsApprovalsDialogOpen(true); }} />

        {/* Mobile Home */}
        <MobileHome profile={dashboard.profile} pendingCount={totalPending} balancesCount={balances.length} recentActivityCount={recentActivity.length} sharedItemsCount={dashboard.sharedItems.length} onNavigate={setMobilePage} onOpenSidebar={() => setIsSidebarOpen(true)} />

        {/* Desktop Dashboard Grid */}
        <DashboardGrid
          balances={balances} selectedFriendId={selectedFriendId} isInviteFormOpen={isInviteFormOpen} setIsInviteFormOpen={setIsInviteFormOpen}
          inviteUsername={inviteUsername} setInviteUsername={setInviteUsername} onSendInvite={sendInvite} mutating={mutating}
          incomingInvites={incomingInvites} outgoingInvites={outgoingInvites} profilesById={profilesById}
          onViewStatement={openStatementDialog} onRespondInvite={respondToInvite}
          onOpenDebt={() => { resetMessages(); setIsDebtDialogOpen(true); }} onOpenSettlement={() => { resetMessages(); setIsSettlementDialogOpen(true); }}
          onOpenItemsDialog={() => setIsItemsDialogOpen(true)} sharedItems={dashboard.sharedItems} profiles={dashboard.profiles}
          userId={session.user.id} onCancelItem={cancelItem} onRequestReturn={requestItemReturn}
        />

        {/* Desktop Activity Panel */}
        <ActivityPanel recentActivity={recentActivity} />

        {/* ── All Dialogs ──────────────────────────────── */}
        <ProfileDialog isOpen={isProfileDialogOpen} onClose={() => setIsProfileDialogOpen(false)} profileNeedsSetup={profileNeedsSetup} profile={dashboard.profile} usernameDraft={usernameDraft} setUsernameDraft={setUsernameDraft} upiIdDraft={upiIdDraft} setUpiIdDraft={setUpiIdDraft} error={error} feedback={feedback} savingUsername={savingUsername} onSave={saveProfile} />
        <DebtDialog isOpen={isDebtDialogOpen} onClose={() => setIsDebtDialogOpen(false)} balances={balances} debtForm={debtForm} setDebtForm={setDebtForm} error={error} feedback={feedback} mutating={mutating} onCreate={createDebt} />
        <SettlementDialog isOpen={isSettlementDialogOpen} onClose={() => setIsSettlementDialogOpen(false)} balances={balances} settlementForm={settlementForm} setSettlementForm={setSettlementForm} error={error} feedback={feedback} mutating={mutating} onCreateSettlement={createSettlement} onPayOnline={payOnline} />
        <StatementDialog isOpen={isStatementDialogOpen} onClose={() => setIsStatementDialogOpen(false)} selectedFriend={selectedFriend} friendStatement={friendStatement} error={error} feedback={feedback} onPayFriend={(id) => { setSettlementForm((c) => ({ ...c, friendId: id })); setIsStatementDialogOpen(false); setIsSettlementDialogOpen(true); }} onLogExpense={(id) => { setDebtForm((c) => ({ ...c, friendId: id })); setIsStatementDialogOpen(false); setIsDebtDialogOpen(true); }} />
        <ApprovalsDialog isOpen={isApprovalsDialogOpen} onClose={() => setIsApprovalsDialogOpen(false)} pendingApprovals={pendingApprovals} pendingSettlements={pendingSettlements} pendingItems={pendingItems} profilesById={profilesById} error={error} feedback={feedback} mutating={mutating} onRespondDebt={respondToDebt} onRespondSettlement={respondToSettlement} onRespondItem={respondToItem} />
        <AboutDialog isOpen={isAboutDialogOpen} onClose={() => setIsAboutDialogOpen(false)} />
        <ItemsDialog isOpen={isItemsDialogOpen} onClose={() => setIsItemsDialogOpen(false)} itemForm={itemForm} setItemForm={setItemForm} balances={balances} error={error} feedback={feedback} onSubmit={submitItemForm} />
      </main>
    </>
  );
}
