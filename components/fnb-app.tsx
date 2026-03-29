"use client";

/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useRef, useState, useTransition, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  getAppOrigin,
  getSupabaseBrowserClient,
  hasSupabaseEnv
} from "@/lib/supabase";
import type {
  DebtRequest,
  Friendship,
  Profile,
  Settlement,
  SharedItem
} from "@/lib/app-types";

import FnbLanding from "./fnb-landing";

type FriendSummary = {
  friendshipId: string;
  profile: Profile;
  balanceInPaise: number;
};

type ActivityItem = {
  id: string;
  kind: "debt" | "settlement";
  createdAt: string;
  profile: Profile | null;
  label: string;
  detail: string;
  status: string;
  amountInPaise: number;
};

type StatementEntry = {
  id: string;
  createdAt: string;
  kind: "debt" | "settlement";
  title: string;
  detail: string;
  status: string;
  amountInPaise: number;
  balanceDeltaInPaise: number;
};

type DashboardData = {
  profile: Profile | null;
  friendships: Friendship[];
  profiles: Profile[];
  debtRequests: DebtRequest[];
  settlements: Settlement[];
  sharedItems: SharedItem[];
};

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2
});

const dateTime = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short"
});

const dateOnly = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium"
});

function formatCurrency(amountInPaise: number) {
  return money.format(amountInPaise / 100);
}

function formatDate(value: string | null) {
  if (!value) {
    return "No due date";
  }

  return dateTime.format(new Date(value));
}

function formatUsernameCandidate(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
}

function makeStarterUsername(user: User) {
  const emailPart = user.email?.split("@")[0] ?? "friend";
  const base = formatUsernameCandidate(emailPart) || "friend";
  const suffix = user.id.replace(/-/g, "").slice(0, 4);
  return `${base}_${suffix}`;
}

function readableProfile(profile?: Profile | null) {
  return profile?.full_name || profile?.username || "Friend";
}

function initialsFor(profile?: Profile | null) {
  const source = readableProfile(profile).trim();
  const parts = source.split(/\s+/).filter(Boolean).slice(0, 2);

  if (parts.length === 0) {
    return "FB";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function getErrorMessage(cause: unknown) {
  if (typeof cause === "string") {
    return cause;
  }

  if (cause instanceof Error) {
    return cause.message;
  }

  return "Something went wrong. Please try again.";
}

export default function FnbApp() {
  const supabase = getSupabaseBrowserClient();
  const envReady = hasSupabaseEnv();

  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingUsername, startSavingUsername] = useTransition();
  const [mutating, startMutation] = useTransition();

  const [dashboard, setDashboard] = useState<DashboardData>({
    profile: null,
    friendships: [],
    profiles: [],
    debtRequests: [],
    settlements: [],
    sharedItems: []
  });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [usernameDraft, setUsernameDraft] = useState("");
  const [upiIdDraft, setUpiIdDraft] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isInviteFormOpen, setIsInviteFormOpen] = useState(false);
  const [isApprovalsDialogOpen, setIsApprovalsDialogOpen] = useState(false);
  const [inviteUsername, setInviteUsername] = useState("");
  const [debtForm, setDebtForm] = useState({
    friendId: "",
    amount: "",
    reason: "",
    debtDate: new Date().toISOString().slice(0, 10),
    dueAt: ""
  });
  const [settlementForm, setSettlementForm] = useState({
    friendId: "",
    amount: "",
    note: ""
  });
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [isStatementDialogOpen, setIsStatementDialogOpen] = useState(false);
  const [isDebtDialogOpen, setIsDebtDialogOpen] = useState(false);
  const [isSettlementDialogOpen, setIsSettlementDialogOpen] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState("");
  const [mobilePage, setMobilePage] = useState<"home" | "network" | "approvals" | "money" | "activity" | "items">("home");

  // Items State (Now DB driven)
  const [isItemsDialogOpen, setIsItemsDialogOpen] = useState(false);
  const [itemForm, setItemForm] = useState({ name: "", type: "gave" as "gave" | "borrowed", friendId: "", date: new Date().toISOString().slice(0, 10) });

  // About State
  const [isAboutDialogOpen, setIsAboutDialogOpen] = useState(false);

  // --- Toast auto-dismiss ---
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toastExiting, setToastExiting] = useState(false);

  useEffect(() => {
    if (feedback || error) {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setToastExiting(false);
      toastTimerRef.current = setTimeout(() => {
        setToastExiting(true);
        setTimeout(() => {
          setFeedback(null);
          setError(null);
          setToastExiting(false);
        }, 300);
      }, 4000);
    }
    return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); };
  }, [feedback, error]);

  function openProfileDialog() {
    setError(null);
    setFeedback(null);
    setUsernameDraft(dashboard.profile?.username ?? "");
    setUpiIdDraft(dashboard.profile?.upi_id ?? "");
    setIsProfileDialogOpen(true);
  }

  function openStatementDialog(friendId: string) {
    setError(null);
    setFeedback(null);
    setSelectedFriendId(friendId);
    setIsStatementDialogOpen(true);
  }

  useEffect(() => {
    const client = supabase;

    if (!client) {
      setBooting(false);
      return;
    }

    const readyClient = client;

    let active = true;

    async function bootstrap() {
      const {
        data: { session: currentSession }
      } = await readyClient.auth.getSession();

      if (!active) {
        return;
      }

      setSession(currentSession);

      if (currentSession?.user) {
        await ensureProfile(currentSession.user);
        await loadDashboard(currentSession.user.id);
      }

      if (active) {
        setBooting(false);
      }
    }

    bootstrap().catch((cause: unknown) => {
      if (active) {
        setError(getErrorMessage(cause));
        setBooting(false);
      }
    });

    const {
      data: { subscription }
    } = readyClient.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);

      if (event !== "TOKEN_REFRESHED") {
        setError(null);
        setFeedback(null);
      }

      if (!nextSession?.user) {
        setDashboard({
          profile: null,
          friendships: [],
          profiles: [],
          debtRequests: [],
          settlements: [],
          sharedItems: []
        });
        return;
      }

      const shouldSyncProfile =
        event === "SIGNED_IN" || event === "USER_UPDATED" || event === "INITIAL_SESSION";

      void (async () => {
        try {
          if (shouldSyncProfile) {
            await ensureProfile(nextSession.user);
          }

          await loadDashboard(nextSession.user.id, { silent: true });
        } catch (cause: unknown) {
          setError(getErrorMessage(cause));
        }
      })();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  useEffect(() => {
    if (!session?.user) {
      return;
    }

    const refreshSilently = () => {
      void loadDashboard(session.user.id, { silent: true }).catch((cause: unknown) => {
        setError(getErrorMessage(cause));
      });
    };

    // Poll every 60 seconds (relies on focus/visibility listeners for instant updates instead)
    const intervalId = window.setInterval(refreshSilently, 60000);

    const handleFocus = () => {
      refreshSilently();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshSilently();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  async function ensureProfile(user: User) {
    const client = supabase;

    if (!client) {
      return;
    }

    const profilePayload = {
      id: user.id,
      full_name:
        user.user_metadata?.full_name ??
        user.user_metadata?.name ??
        user.email ??
        "Friend",
      avatar_url: user.user_metadata?.avatar_url ?? null
    };

    const { error: upsertError } = await client
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" });

    if (upsertError) {
      throw upsertError;
    }

    const { data: existingProfile, error: readError } = await client
      .from("profiles")
      .select("id, username")
      .eq("id", user.id)
      .single();

    if (readError) {
      throw readError;
    }

    if (!existingProfile.username) {
      const { error: usernameError } = await client
        .from("profiles")
        .update({ username: makeStarterUsername(user) })
        .eq("id", user.id)
        .is("username", null);

      if (usernameError) {
        throw usernameError;
      }
    }
  }

  async function loadDashboard(userId: string, options?: { silent?: boolean }) {
    const client = supabase;

    if (!client) {
      return;
    }

    const silent = options?.silent ?? false;

    if (!silent) {
      setRefreshing(true);
    }

    const [profileResult, friendshipsResult, debtsResult, settlementsResult, itemsResult] =
      await Promise.all([
        client
          .from("profiles")
          .select("id, username, full_name, avatar_url, created_at")
          .eq("id", userId)
          .single(),
        client
          .from("friendships")
          .select(
            "id, requester_id, addressee_id, status, created_at, responded_at"
          )
          .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
          .order("created_at", { ascending: false }),
        client
          .from("debt_requests")
          .select(
            "id, creator_id, approver_id, amount_in_paise, currency, reason, debt_date, due_at, status, approved_at, rejected_at, created_at"
          )
          .or(`creator_id.eq.${userId},approver_id.eq.${userId}`)
          .order("created_at", { ascending: false }),
        client
          .from("settlements")
          .select(
            "id, payer_id, receiver_id, amount_in_paise, currency, note, settled_at, status, approved_at, rejected_at, created_at"
          )
          .or(`payer_id.eq.${userId},receiver_id.eq.${userId}`)
          .order("settled_at", { ascending: false }),
        client
          .from("shared_items")
          .select("id, owner_id, friend_id, item_name, type, status, created_at")
          .or(`owner_id.eq.${userId},friend_id.eq.${userId}`)
          .order("created_at", { ascending: false })
      ]);

    if (profileResult.error) {
      if (!silent) {
        setRefreshing(false);
      }
      throw profileResult.error;
    }

    if (friendshipsResult.error) {
      if (!silent) {
        setRefreshing(false);
      }
      throw friendshipsResult.error;
    }

    if (debtsResult.error) {
      if (!silent) {
        setRefreshing(false);
      }
      throw debtsResult.error;
    }

    if (settlementsResult.error) {
      if (!silent) {
        setRefreshing(false);
      }
      throw settlementsResult.error;
    }

    if (itemsResult.error) {
      if (!silent) {
        setRefreshing(false);
      }
      throw itemsResult.error;
    }

    const friendships = (friendshipsResult.data ?? []) as Friendship[];
    const debtRequests = (debtsResult.data ?? []) as DebtRequest[];
    const settlements = (settlementsResult.data ?? []) as Settlement[];
    const sharedItems = (itemsResult.data ?? []) as SharedItem[];

    const relatedProfileIds = new Set<string>();

    friendships.forEach((friendship) => {
      relatedProfileIds.add(friendship.requester_id);
      relatedProfileIds.add(friendship.addressee_id);
    });

    debtRequests.forEach((request) => {
      relatedProfileIds.add(request.creator_id);
      relatedProfileIds.add(request.approver_id);
    });

    settlements.forEach((settlement) => {
      relatedProfileIds.add(settlement.payer_id);
      relatedProfileIds.add(settlement.receiver_id);
    });

    sharedItems.forEach((item) => {
      relatedProfileIds.add(item.owner_id);
      relatedProfileIds.add(item.friend_id);
    });

    const ids = [...relatedProfileIds];
    let profiles: Profile[] = [];

    if (ids.length > 0) {
      const profilesResult = await client
        .from("profiles")
        .select("id, username, full_name, avatar_url, created_at")
        .in("id", ids);

      if (profilesResult.error) {
        if (!silent) {
          setRefreshing(false);
        }
        throw profilesResult.error;
      }

      profiles = (profilesResult.data ?? []) as Profile[];
    }

    setDashboard({
      profile: profileResult.data as Profile,
      friendships,
      profiles,
      debtRequests,
      settlements,
      sharedItems
    });
    if (!silent) {
      setRefreshing(false);
    }
  }

  async function refreshData() {
    if (!session?.user) {
      return;
    }

    try {
      await loadDashboard(session.user.id);
    } catch (cause: unknown) {
      setError(getErrorMessage(cause));
    }
  }

  const profilesById = useMemo(() => {
    return new Map(dashboard.profiles.map((profile) => [profile.id, profile]));
  }, [dashboard.profiles]);

  const acceptedFriends = useMemo<FriendSummary[]>(() => {
    if (!session?.user) {
      return [];
    }

    return dashboard.friendships
      .filter((friendship) => friendship.status === "accepted")
      .map((friendship) => {
        const friendId =
          friendship.requester_id === session.user.id
            ? friendship.addressee_id
            : friendship.requester_id;

        return {
          friendshipId: friendship.id,
          profile: profilesById.get(friendId) ?? {
            id: friendId,
            username: null,
            full_name: "Unknown friend",
            avatar_url: null,
            upi_id: null
          },
          balanceInPaise: 0
        };
      });
  }, [dashboard.friendships, profilesById, session?.user]);

  const balances = useMemo(() => {
    if (!session?.user) {
      return acceptedFriends;
    }

    const byFriend = new Map(
      acceptedFriends.map((friend) => [
        friend.profile.id,
        { ...friend, balanceInPaise: 0 }
      ])
    );

    dashboard.debtRequests
      .filter((request) => request.status === "approved")
      .forEach((request) => {
        const friendId =
          request.creator_id === session.user.id
            ? request.approver_id
            : request.creator_id;
        const item = byFriend.get(friendId);

        if (!item) {
          return;
        }

        item.balanceInPaise +=
          request.creator_id === session.user.id
            ? request.amount_in_paise
            : -request.amount_in_paise;
      });

    dashboard.settlements
      .filter((settlement) => settlement.status === "approved")
      .forEach((settlement) => {
        const friendId =
          settlement.payer_id === session.user.id
            ? settlement.receiver_id
            : settlement.payer_id;
        const item = byFriend.get(friendId);

        if (!item) {
          return;
        }

        item.balanceInPaise +=
          settlement.payer_id === session.user.id
            ? settlement.amount_in_paise
            : -settlement.amount_in_paise;
      });

    return [...byFriend.values()].sort(
      (left, right) =>
        Math.abs(right.balanceInPaise) - Math.abs(left.balanceInPaise)
    );
  }, [acceptedFriends, dashboard.debtRequests, dashboard.settlements, session?.user]);

  useEffect(() => {
    if (balances.length === 0) {
      setSelectedFriendId("");
      return;
    }

    const stillExists = balances.some(
      (friend) => friend.profile.id === selectedFriendId
    );

    if (!stillExists) {
      setSelectedFriendId(balances[0].profile.id);
    }
  }, [balances, selectedFriendId]);

  const selectedFriend = useMemo(() => {
    return balances.find((friend) => friend.profile.id === selectedFriendId) ?? null;
  }, [balances, selectedFriendId]);

  const friendStatement = useMemo<StatementEntry[]>(() => {
    if (!session?.user || !selectedFriend) {
      return [];
    }

    const friendId = selectedFriend.profile.id;
    const statementFromDebts = dashboard.debtRequests
      .filter((request) => {
        const otherId =
          request.creator_id === session.user.id
            ? request.approver_id
            : request.creator_id;

        return otherId === friendId;
      })
      .map((request) => ({
        id: request.id,
        createdAt: request.created_at,
        kind: "debt" as const,
        title:
          request.creator_id === session.user.id
            ? `You logged a debt for ${readableProfile(selectedFriend.profile)}`
            : `${readableProfile(selectedFriend.profile)} logged a debt for you`,
        detail: request.reason,
        status: request.status,
        amountInPaise: request.amount_in_paise,
        balanceDeltaInPaise:
          request.status === "approved"
            ? request.creator_id === session.user.id
              ? request.amount_in_paise
              : -request.amount_in_paise
            : 0
      }));

    const statementFromSettlements = dashboard.settlements
      .filter((settlement) => {
        const otherId =
          settlement.payer_id === session.user.id
            ? settlement.receiver_id
            : settlement.payer_id;

        return otherId === friendId;
      })
      .map((settlement) => ({
        id: settlement.id,
        createdAt: settlement.settled_at,
        kind: "settlement" as const,
        title:
          settlement.payer_id === session.user.id
            ? `You paid ${readableProfile(selectedFriend.profile)}`
            : `${readableProfile(selectedFriend.profile)} paid you`,
        detail: settlement.note || "Settlement recorded",
        status: settlement.status,
        amountInPaise: settlement.amount_in_paise,
        balanceDeltaInPaise:
          settlement.status === "approved"
            ? settlement.payer_id === session.user.id
              ? settlement.amount_in_paise
              : -settlement.amount_in_paise
            : 0
      }));

    return [...statementFromDebts, ...statementFromSettlements].sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  }, [
    dashboard.debtRequests,
    dashboard.settlements,
    selectedFriend,
    session?.user
  ]);

  const incomingInvites = useMemo(() => {
    if (!session?.user) {
      return [];
    }

    return dashboard.friendships.filter(
      (friendship) =>
        friendship.status === "pending" &&
        friendship.addressee_id === session.user.id
    );
  }, [dashboard.friendships, session?.user]);

  const outgoingInvites = useMemo(() => {
    if (!session?.user) {
      return [];
    }

    return dashboard.friendships.filter(
      (friendship) =>
        friendship.status === "pending" &&
        friendship.requester_id === session.user.id
    );
  }, [dashboard.friendships, session?.user]);

  const pendingApprovals = useMemo(() => {
    if (!session?.user) {
      return [];
    }

    return dashboard.debtRequests.filter(
      (request) =>
        request.status === "pending" && request.approver_id === session.user.id
    );
  }, [dashboard.debtRequests, session?.user]);

  const pendingSettlements = useMemo(() => {
    if (!session?.user) {
      return [];
    }

    return dashboard.settlements.filter(
      (settlement) =>
        settlement.status === "pending" && settlement.receiver_id === session.user.id
    );
  }, [dashboard.settlements, session?.user]);

  const recentActivity = useMemo<ActivityItem[]>(() => {
    if (!session?.user) {
      return [];
    }

    const debtItems = dashboard.debtRequests.map((request) => {
      const otherProfile = profilesById.get(
        request.creator_id === session.user.id
          ? request.approver_id
          : request.creator_id
      );
      const otherName = readableProfile(otherProfile);

      return {
        id: request.id,
        kind: "debt" as const,
        createdAt: request.created_at,
        profile: otherProfile ?? null,
        label:
          request.creator_id === session.user.id
            ? `${otherName} owes you`
            : `You owe ${otherName}`,
        detail: request.reason,
        status: request.status,
        amountInPaise: request.amount_in_paise
      };
    });

    const settlementItems = dashboard.settlements.map((settlement) => {
      const otherProfile = profilesById.get(
        settlement.payer_id === session.user.id
          ? settlement.receiver_id
          : settlement.payer_id
      );
      const otherName = readableProfile(otherProfile);

      return {
        id: settlement.id,
        kind: "settlement" as const,
        createdAt: settlement.settled_at,
        profile: otherProfile ?? null,
        label:
          settlement.payer_id === session.user.id
            ? `You paid ${otherName}`
            : `${otherName} paid you`,
        detail: settlement.note || "Settlement recorded",
        status: settlement.status,
        amountInPaise: settlement.amount_in_paise
      };
    });

    return [...debtItems, ...settlementItems]
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      )
      .slice(0, 10);
  }, [dashboard.debtRequests, dashboard.settlements, profilesById, session?.user]);

  const totalOwedToYou = balances.reduce((sum, friend) => {
    return friend.balanceInPaise > 0 ? sum + friend.balanceInPaise : sum;
  }, 0);

  const totalYouOwe = balances.reduce((sum, friend) => {
    return friend.balanceInPaise < 0 ? sum + Math.abs(friend.balanceInPaise) : sum;
  }, 0);

  async function signInWithGoogle() {
    const client = supabase;

    if (!client) {
      return;
    }

    setError(null);
    const redirectTo = getAppOrigin();

    const { error: signInError } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo }
    });

    if (signInError) {
      setError(signInError.message);
    }
  }

  async function signOut() {
    const client = supabase;

    if (!client) {
      return;
    }

    const { error: signOutError } = await client.auth.signOut();

    if (signOutError) {
      setError(signOutError.message);
    }
  }

  function resetMessages() {
    setError(null);
    setFeedback(null);
  }

  function setFailure(cause: unknown) {
    setFeedback(null);
    setError(getErrorMessage(cause));
  }

  async function saveProfile() {
    const client = supabase;

    if (!client || !session?.user) {
      return;
    }

    const readyClient = client;

    const sanitized = formatUsernameCandidate(usernameDraft);

    if (!sanitized || sanitized.length < 3) {
      setError("Pick a username with at least 3 letters or numbers.");
      return;
    }

    const formattedUpi = upiIdDraft.trim().toLowerCase();
    if (formattedUpi && !formattedUpi.includes("@")) {
      setError("Please enter a valid UPI ID (e.g. yourname@bank) or leave it completely blank.");
      return;
    }

    resetMessages();

    startSavingUsername(async () => {
      const { error: updateError } = await readyClient
        .from("profiles")
        .update({ username: sanitized, upi_id: formattedUpi || null })
        .eq("id", session.user.id);

      if (updateError) {
        setFailure(updateError);
        return;
      }

      setFeedback("Profile updated.");
      setIsProfileDialogOpen(false);
      await refreshData();
    });
  }

  async function sendInvite() {
    const client = supabase;

    if (!client || !session?.user || !dashboard.profile) {
      return;
    }

    const readyClient = client;

    const username = formatUsernameCandidate(inviteUsername);

    if (!username) {
      setError("Enter your friend's username.");
      return;
    }

    if (username === dashboard.profile.username) {
      setError("You cannot invite yourself.");
      return;
    }

    resetMessages();

    startMutation(async () => {
      const { data: targetProfile, error: targetError } = await readyClient
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .eq("username", username)
        .single();

      if (targetError || !targetProfile) {
        setFailure("That username was not found.");
        return;
      }

      const { data: existing, error: existingError } = await readyClient
        .from("friendships")
        .select("id, status")
        .or(
          `and(requester_id.eq.${session.user.id},addressee_id.eq.${targetProfile.id}),and(requester_id.eq.${targetProfile.id},addressee_id.eq.${session.user.id})`
        )
        .limit(1);

      if (existingError) {
        setFailure(existingError);
        return;
      }

      if ((existing ?? []).length > 0) {
        setFailure("A friend request or friendship already exists.");
        return;
      }

      const { error: insertError } = await readyClient.from("friendships").insert({
        requester_id: session.user.id,
        addressee_id: targetProfile.id,
        status: "pending"
      });

      if (insertError) {
        setFailure(insertError);
        return;
      }

      setInviteUsername("");
      setFeedback(`Invite sent to @${targetProfile.username}.`);
      await refreshData();
    });
  }

  async function respondToInvite(friendshipId: string, accept: boolean) {
    const client = supabase;

    if (!client) {
      return;
    }

    const readyClient = client;

    resetMessages();

    startMutation(async () => {
      const patch = accept
        ? { status: "accepted", responded_at: new Date().toISOString() }
        : { status: "blocked", responded_at: new Date().toISOString() };

      const { error: updateError } = await readyClient
        .from("friendships")
        .update(patch)
        .eq("id", friendshipId);

      if (updateError) {
        setFailure(updateError);
        return;
      }

      setFeedback(accept ? "Friend request accepted." : "Friend request declined.");
      await refreshData();
    });
  }

  async function createDebt() {
    const client = supabase;

    if (!client || !session?.user) {
      return;
    }

    const readyClient = client;

    const amount = Number(debtForm.amount);
    const amountInPaise = Math.round(amount * 100);

    if (!debtForm.friendId) {
      setError("Choose a friend first.");
      return;
    }

    if (!amount || amountInPaise <= 0) {
      setError("Enter a valid amount.");
      return;
    }

    if (!debtForm.reason.trim()) {
      setError("Add a reason so both sides understand the debt.");
      return;
    }

    resetMessages();

    startMutation(async () => {
      const { error: insertError } = await readyClient.from("debt_requests").insert({
        creator_id: session.user.id,
        approver_id: debtForm.friendId,
        amount_in_paise: amountInPaise,
        currency: "INR",
        reason: debtForm.reason.trim(),
        debt_date: debtForm.debtDate,
        due_at: debtForm.dueAt ? new Date(debtForm.dueAt).toISOString() : null,
        status: "pending"
      });

      if (insertError) {
        setFailure(insertError);
        return;
      }

      setDebtForm({
        friendId: "",
        amount: "",
        reason: "",
        debtDate: new Date().toISOString().slice(0, 10),
        dueAt: ""
      });
      setIsDebtDialogOpen(false);
      setFeedback("Debt request created and waiting for approval.");
      await refreshData();
    });
  }

  async function respondToDebt(requestId: string, approve: boolean) {
    const client = supabase;

    if (!client) {
      return;
    }

    const readyClient = client;

    resetMessages();

    startMutation(async () => {
      const { error: updateError } = await readyClient
        .from("debt_requests")
        .update(
          approve
            ? { status: "approved", approved_at: new Date().toISOString() }
            : { status: "rejected", rejected_at: new Date().toISOString() }
        )
        .eq("id", requestId);

      if (updateError) {
        setFailure(updateError);
        return;
      }

      setFeedback(approve ? "Debt approved." : "Debt rejected.");
      await refreshData();
    });
  }

  async function respondToSettlement(settlementId: string, approve: boolean) {
    const client = supabase;

    if (!client) {
      return;
    }

    const readyClient = client;

    resetMessages();

    startMutation(async () => {
      const { error: updateError } = await readyClient
        .from("settlements")
        .update(
          approve
            ? { status: "approved", approved_at: new Date().toISOString() }
            : { status: "rejected", rejected_at: new Date().toISOString() }
        )
        .eq("id", settlementId);

      if (updateError) {
        setFailure(updateError);
        return;
      }

      setFeedback(approve ? "Settlement approved." : "Settlement rejected.");
      await refreshData();
    });
  }

  async function createSettlement() {
    const client = supabase;

    if (!client || !session?.user) {
      return;
    }

    const readyClient = client;

    const amount = Number(settlementForm.amount);
    const amountInPaise = Math.round(amount * 100);

    if (!settlementForm.friendId) {
      setError("Choose who received the payment.");
      return;
    }

    if (!amount || amountInPaise <= 0) {
      setError("Enter a valid settlement amount.");
      return;
    }

    resetMessages();

    startMutation(async () => {
      const { error: insertError } = await readyClient.from("settlements").insert({
        payer_id: session.user.id,
        receiver_id: settlementForm.friendId,
        amount_in_paise: amountInPaise,
        currency: "INR",
        note: settlementForm.note.trim() || null,
        status: "pending"
      });

      if (insertError) {
        setFailure(insertError);
        return;
      }

      setSettlementForm({
        friendId: "",
        amount: "",
        note: ""
      });
      setIsSettlementDialogOpen(false);
      setFeedback("Settlement recorded.");
      await refreshData();
    });
  }

  async function payOnline() {
    const amount = Number(settlementForm.amount);
    const amountInPaise = Math.round(amount * 100);

    if (!settlementForm.friendId) {
      setError("Choose who received the payment.");
      return;
    }

    if (!amount || amountInPaise <= 0) {
      setError("Enter a valid settlement amount.");
      return;
    }

    const targetFriend = balances.find(f => f.profile.id === settlementForm.friendId);
    if (!targetFriend) return;

    const upiId = targetFriend.profile.upi_id;
    if (!upiId) {
      setError("That friend has not linked a UPI ID. Ask them to add it to their profile, or use \"Record manual\" instead.");
      return;
    }

    resetMessages();

    startMutation(async () => {
      const { error: insertError } = await supabase!.from("settlements").insert({
        payer_id: session!.user.id,
        receiver_id: settlementForm.friendId,
        amount_in_paise: amountInPaise,
        currency: "INR",
        note: (settlementForm.note.trim() || `UPI transfer initiated`),
        status: "pending"
      });

      if (insertError) {
        setFailure("Failed to connect to F&B server to record transaction attempt.");
        return;
      }

      const payeeName = encodeURIComponent(targetFriend.profile.full_name || "Friend");
      const upiUrl = `upi://pay?pa=${upiId}&pn=${payeeName}&am=${amount.toFixed(2)}&cu=INR&tn=F&B Settlement`;

      setFeedback("Opening your UPI app...");
      setSettlementForm({ friendId: "", amount: "", note: "" });
      setIsSettlementDialogOpen(false);
      await refreshData();

      // Native navigation to open GPay/PhonePe natively
      window.location.href = upiUrl;
    });
  }

  const profileNeedsSetup =
    !dashboard.profile?.username || dashboard.profile.username.length < 3;
  const debtFriendSelected = Boolean(debtForm.friendId);
  const settlementFriendSelected = Boolean(settlementForm.friendId);

  useEffect(() => {
    if (!booting && session?.user && dashboard.profile && profileNeedsSetup) {
      setUsernameDraft(dashboard.profile?.username ?? "");
      setIsProfileDialogOpen(true);
    }
  }, [booting, dashboard.profile, profileNeedsSetup, session?.user]);

  useEffect(() => {
    if (!isProfileDialogOpen) {
      setUsernameDraft(dashboard.profile?.username ?? "");
    }
  }, [dashboard.profile?.username, isProfileDialogOpen]);

  if (!envReady) {
    return (
      <main className="shell">
        <section className="hero">
          <p className="eyebrow">Setup required</p>
          <h1>Connect Supabase to launch F&B</h1>
          <p className="lede">
            Add your Supabase URL and anon key in <code>.env.local</code>, then
            enable Google auth in the Supabase dashboard.
          </p>
          <div className="panel inline-panel">
            <p>Required variables:</p>
            <code>NEXT_PUBLIC_SUPABASE_URL</code>
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
          </div>
        </section>
      </main>
    );
  }

  const submitItemForm = async () => {
    const client = supabase;
    if (!itemForm.name.trim() || !itemForm.friendId || !session?.user || !client) {
      setError("Please provide an item name and choose a friend.");
      return;
    }

    startMutation(async () => {
      const { error: saveError } = await client.from("shared_items").insert({
        owner_id: session.user.id,
        friend_id: itemForm.friendId,
        item_name: itemForm.name.trim(),
        type: itemForm.type,
        status: "active"
      });

      if (saveError) {
        setError(getErrorMessage(saveError));
      } else {
        setFeedback(`Recorded that you ${itemForm.type === "gave" ? "lent" : "borrowed"} an item.`);
        setItemForm({ name: "", type: "gave", friendId: "", date: new Date().toISOString().slice(0, 10) });
        setIsItemsDialogOpen(false);
        await loadDashboard(session.user.id, { silent: true });
      }
    });
  };

  const removeItem = async (id: string, e?: React.MouseEvent) => {
    const client = supabase;
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!session?.user || !client) return;

    startMutation(async () => {
      const { error: deleteError } = await client
        .from("shared_items")
        .delete()
        .eq("id", id);

      if (deleteError) {
        setError(getErrorMessage(deleteError));
      } else {
        setFeedback("Item removed.");
        await loadDashboard(session.user.id, { silent: true });
      }
    });
  };

  if (booting) {
    return (
      <main className="shell">
        <section className="hero">
          <p className="eyebrow">F&B</p>
          <h1>Loading your balances</h1>
          <p className="lede">
            Pulling your session, profile, friends, debts, and settlements.
          </p>
        </section>
      </main>
    );
  }

  if (!session) {
    return <FnbLanding onSignIn={signInWithGoogle} />;
  }


  return (
    <>
      {/* === Toast Notification (overlay, works everywhere) === */}
      {(feedback || error) && (
        <div className={`toast-notification ${error ? "toast-error" : "toast-success"} ${toastExiting ? "toast-exiting" : ""}`}>
          {error ?? feedback}
        </div>
      )}

      {/* === Mobile Sidebar Drawer (mobile-only) === */}
      {isSidebarOpen && (
        <div className="mobile-only">
          <div className="mobile-sidebar-backdrop" onClick={() => setIsSidebarOpen(false)} />
          <aside className="mobile-sidebar" onClick={e => e.stopPropagation()}>
            <div className="mobile-sidebar-header">
              <img src="/fnb-logo.svg" alt="F&B" style={{ height: "32px", width: "auto" }} />
              <button className="ghost-button" onClick={() => setIsSidebarOpen(false)} style={{ padding: '8px', fontSize: '0.85rem' }}>Close</button>
            </div>
            <div className="mobile-sidebar-profile">
              <Avatar profile={dashboard.profile} size="medium" />
              <div>
                <strong>{readableProfile(dashboard.profile)}</strong>
                <p className="muted" style={{ margin: '2px 0 0', fontSize: '0.85rem' }}>@{dashboard.profile?.username ?? "not-set"}</p>
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
              <button className="ghost-button" onClick={() => { setIsSidebarOpen(false); openProfileDialog(); }}>⚙️ Profile & UPI setup</button>
              <button className="ghost-button" onClick={() => { setIsSidebarOpen(false); refreshData(); }}>🔄 Refresh data</button>
              <button className="ghost-button danger-ghost-button" onClick={signOut}>🚪 Sign out</button>
            </div>
          </aside>
        </div>
      )}

      {/* === Mobile Full-Screen Pages === */}
      {mobilePage === "network" && (
        <div className="mobile-page mobile-only">
          <div className="mobile-page-header">
            <button className="mobile-back-btn" onClick={() => setMobilePage("home")}>← Back</button>
            <h2>Your Network</h2>
          </div>
          <div className="mobile-page-content">
            {/* Inline invite */}
            <div style={{ marginBottom: '20px' }}>
              <span className="profile-label" style={{ marginBottom: '8px' }}>Invite by username:</span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  aria-label="Invite by username"
                  value={inviteUsername}
                  onChange={(e) => setInviteUsername(e.target.value)}
                  placeholder="friend_username"
                  style={{ minHeight: '42px', padding: '8px 12px', flex: 1, minWidth: 0 }}
                />
                <button className="primary-button" onClick={sendInvite} disabled={mutating} style={{ minHeight: '42px', whiteSpace: 'nowrap', padding: '0 20px' }}>Send</button>
              </div>
            </div>

            {/* Friends list */}
            <h3 style={{ marginBottom: '12px' }}>Your friends <span className="count-chip">{balances.length}</span></h3>
            {balances.length === 0 ? (
              <p className="empty-state">No accepted friends yet.</p>
            ) : (
              <div className="stack mini-stack">
                {balances.map((friend) => (
                  <button
                    className="friend-card"
                    key={friend.friendshipId}
                    onClick={() => openStatementDialog(friend.profile.id)}
                  >
                    <PersonIdentity profile={friend.profile} />
                    <div className="friend-card-side">
                      <span className={`amount-badge ${friend.balanceInPaise > 0 ? "positive" : friend.balanceInPaise < 0 ? "negative" : ""}`}>
                        {formatCurrency(friend.balanceInPaise)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Incoming invites */}
            <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>Incoming invites <span className="count-chip">{incomingInvites.length}</span></h3>
            {incomingInvites.length === 0 ? (
              <p className="empty-state">No incoming invites right now.</p>
            ) : (
              <div className="stack mini-stack">
                {incomingInvites.map((invite) => {
                  const friend = profilesById.get(invite.requester_id);
                  return (
                    <div className="list-card" key={invite.id}>
                      <PersonIdentity profile={friend} />
                      <div className="row-actions">
                        <button className="primary-button" onClick={() => respondToInvite(invite.id, true)} disabled={mutating}>Accept</button>
                        <button className="ghost-button" onClick={() => respondToInvite(invite.id, false)} disabled={mutating}>Decline</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Outgoing invites */}
            <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>Outgoing invites <span className="count-chip">{outgoingInvites.length}</span></h3>
            {outgoingInvites.length === 0 ? (
              <p className="empty-state">No pending invites sent.</p>
            ) : (
              <div className="stack mini-stack">
                {outgoingInvites.map((invite) => {
                  const friend = profilesById.get(invite.addressee_id);
                  return (
                    <div className="list-card" key={invite.id}>
                      <PersonIdentity profile={friend} />
                      <span className="pill">Waiting</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {mobilePage === "approvals" && (
        <div className="mobile-page mobile-only">
          <div className="mobile-page-header">
            <button className="mobile-back-btn" onClick={() => setMobilePage("home")}>← Back</button>
            <h2>Pending Approvals</h2>
          </div>
          <div className="mobile-page-content">
            {pendingApprovals.length === 0 && pendingSettlements.length === 0 ? (
              <p className="empty-state">No approvals waiting for you. 🎉</p>
            ) : (
              <div className="stack mini-stack">
                {pendingApprovals.map((request) => {
                  const creator = profilesById.get(request.creator_id);
                  return (
                    <div className="list-card dense" key={request.id}>
                      <div>
                        <PersonIdentity profile={creator} />
                        <p>{formatCurrency(request.amount_in_paise)} for {request.reason}</p>
                        <small>Debt date {dateOnly.format(new Date(request.debt_date))} - Due {formatDate(request.due_at)}</small>
                      </div>
                      <div className="row-actions">
                        <button className="primary-button" onClick={() => respondToDebt(request.id, true)} disabled={mutating}>Approve</button>
                        <button className="ghost-button" onClick={() => respondToDebt(request.id, false)} disabled={mutating}>Reject</button>
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
                        <button className="primary-button" onClick={() => respondToSettlement(settlement.id, true)} disabled={mutating}>Approve</button>
                        <button className="ghost-button" onClick={() => respondToSettlement(settlement.id, false)} disabled={mutating}>Reject</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {mobilePage === "money" && (
        <div className="mobile-page mobile-only">
          <div className="mobile-page-header">
            <button className="mobile-back-btn" onClick={() => setMobilePage("home")}>← Back</button>
            <h2>Money Actions</h2>
          </div>
          <div className="mobile-page-content">
            <div style={{ display: 'grid', gap: '12px' }}>
              <button
                className="action-option-card"
                onClick={() => { setError(null); setFeedback(null); setIsDebtDialogOpen(true); }}
                type="button"
              >
                <span className="profile-label">Approval flow</span>
                <strong>Create debt</strong>
                <p>Log a shared expense or cash loan. Your friend approves it from their side.</p>
              </button>
              <button
                className="action-option-card"
                onClick={() => { setError(null); setFeedback(null); setIsSettlementDialogOpen(true); }}
                type="button"
              >
                <span className="profile-label">Direct payment</span>
                <strong>Record settlement</strong>
                <p>Note a payment already made outside the app so balances stay accurate.</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {mobilePage === "items" && (
        <div className="mobile-page mobile-only">
          <div className="mobile-page-header">
            <button className="mobile-back-btn" onClick={() => setMobilePage("home")}>← Back</button>
            <h2>Shared Items</h2>
            <button className="ghost-button" onClick={() => setIsItemsDialogOpen(true)} style={{ marginLeft: "auto", fontSize: "1.2rem", padding: "4px" }}>+</button>
          </div>
          <div className="mobile-page-content">
            {dashboard.sharedItems.length === 0 ? (
              <p className="empty-state">No shared items tracked.</p>
            ) : (
              <div className="stack mini-stack">
                {dashboard.sharedItems.map(item => (
                  <div className="list-card dense" key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{item.item_name}</strong>
                      <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                        {item.type === 'gave' ? 'Lent to' : 'Borrowed from'} {dashboard.profiles.find(p => p.id === item.friend_id)?.full_name || 'friend'}
                      </p>
                    </div>
                    <button className="ghost-button danger-ghost-button" onClick={(e) => removeItem(item.id, e)} style={{ padding: '6px' }}>Return</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {mobilePage === "activity" && (
        <div className="mobile-page mobile-only">
          <div className="mobile-page-header">
            <button className="mobile-back-btn" onClick={() => setMobilePage("home")}>← Back</button>
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
                      <small>{dateTime.format(new Date(item.createdAt))}</small>
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
      )}

      <main className="shell app-shell">
        {/* === Topbar === */}
        <section className="topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Mobile: Logo = sidebar trigger */}
          <button
            className="mobile-only"
            onClick={() => setIsSidebarOpen(true)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            <img className="brand-logo" src="/fnb-logo.svg" alt="F&B" style={{ width: '44px', height: '44px', borderRadius: '14px' }} />
          </button>

          {/* PC: Full identity lockup */}
          <div className="topbar-main desktop-only">
            <div className="identity-lockup">
              <img className="brand-logo" src="/fnb-logo.svg" alt="F&B logo" />
              <div className="brand-copy">
                <p className="eyebrow">F&B</p>
                <h1 className="app-title">Friends and Benefits</h1>
              </div>
            </div>
          </div>

          {/* Mobile: Centered title */}
          <h1 className="app-title mobile-only" style={{ fontSize: '1.1rem', margin: 0 }}>Friends & Benefits</h1>

          {/* Mobile: Help/About icon */}
          <button
            className="mobile-only help-icon-button"
            onClick={() => setIsAboutDialogOpen(true)}
            title="How to use & About Me"
            type="button"
          >
            ❓
          </button>
        </section>

        {/* === PC: Profile Strip (desktop-only) === */}
        <section className="profile-strip desktop-only">
          <div className="profile-strip-identity">
            <Avatar profile={dashboard.profile} size="medium" />
            <div className="profile-strip-copy">
              <span className="profile-label">Your profile</span>
              <strong>{dashboard.profile?.full_name ?? session.user.email}</strong>
              <p>@{dashboard.profile?.username ?? "not-set"}</p>
            </div>
          </div>

          <div className="profile-strip-actions">
            <button
              className="help-icon-button"
              onClick={() => setIsAboutDialogOpen(true)}
              title="How to use & About Me"
              type="button"
            >
              ❓
            </button>
            <button
              className="primary-button profile-strip-button"
              onClick={openProfileDialog}
              type="button"
            >
              Edit profile
            </button>
            <button
              aria-busy={refreshing}
              aria-label={refreshing ? "Refreshing data" : "Refresh data"}
              className={`ghost-button topbar-icon-button refresh-button ${refreshing ? "button-is-loading" : ""
                }`}
              onClick={refreshData}
              disabled={refreshing}
              title="Refresh"
              type="button"
            >
              <RefreshIcon />
            </button>
            <button
              className="ghost-button danger-ghost-button topbar-compact-button topbar-signout-button"
              onClick={signOut}
              type="button"
            >
              Sign out
            </button>
          </div>
        </section>

        {isProfileDialogOpen && (
          <div
            className="dialog-backdrop"
            onClick={() => setIsProfileDialogOpen(false)}
            role="presentation"
          >
            <section
              className="dialog-card"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="dialog-head">
                <div>
                  <h2>{profileNeedsSetup ? "Finish your profile" : "Your profile"}</h2>
                  <p className="muted">
                    {profileNeedsSetup
                      ? "We generated a starter username, but you should pick one your friends can type easily."
                      : "This username is what your friends use to find you. You can change it anytime."}
                  </p>
                </div>
                <button
                  aria-label="Close profile dialog"
                  className="ghost-button dialog-close-button"
                  onClick={() => setIsProfileDialogOpen(false)}
                  type="button"
                >
                  X
                </button>
              </div>

              {(error || feedback) && (
                <div className={`dialog-banner ${error ? "error-banner" : "success-banner"}`} style={{ borderRadius: '12px', padding: '12px 16px', marginBottom: '20px', fontSize: '0.9rem' }}>
                  {error ?? feedback}
                </div>
              )}

              <div className="dialog-profile">
                <Avatar profile={dashboard.profile} size="large" />
                <div>
                  <strong>{readableProfile(dashboard.profile)}</strong>
                  <p className="muted">@{dashboard.profile?.username ?? "not-set"}</p>
                </div>
              </div>

              <div className="form-grid compact-grid">
                <label>
                  <span>Username</span>
                  <input
                    value={usernameDraft}
                    onChange={(event) => setUsernameDraft(event.target.value)}
                    placeholder="for example: kiran_07"
                  />
                </label>

                <label>
                  <span>UPI ID (Optional but recommended)</span>
                  <input
                    type="text"
                    value={upiIdDraft}
                    onChange={(event) => setUpiIdDraft(event.target.value)}
                    placeholder="name@okaxis"
                  />
                  <small className="muted" style={{ display: "block", marginTop: "4px" }}>
                    Used to generate 1-click payment links so friends can pay you easily.
                  </small>
                </label>
              </div>

              <div className="action-row">
                <button
                  className="primary-button"
                  onClick={saveProfile}
                  disabled={savingUsername}
                >
                  {savingUsername ? "Saving..." : "Save profile"}
                </button>
              </div>
            </section>
          </div>
        )}

        <section className="stat-grid desktop-only">
          <article className="stat-card">
            <span>Total friends</span>
            <strong>{balances.length}</strong>
          </article>
          <article className="stat-card success">
            <span>They owe you</span>
            <strong>{formatCurrency(totalOwedToYou)}</strong>
          </article>
          <article className="stat-card warning">
            <span>You owe</span>
            <strong>{formatCurrency(totalYouOwe)}</strong>
          </article>
          <article
            className="stat-card"
            onClick={() => {
              setError(null);
              setFeedback(null);
              setIsApprovalsDialogOpen(true);
            }}
            style={{ cursor: 'pointer' }}
          >
            <span>Pending approvals</span>
            <strong>{pendingApprovals.length + pendingSettlements.length}</strong>
          </article>
        </section>

        {/* --- Mobile Welcome Section --- */}
        <header className="mobile-welcome mobile-only">
          <div className="mobile-welcome-text">
            <h2>Hello, {dashboard.profile?.full_name?.split(' ')[0] || 'Friend'}</h2>
            <p className="muted">You have {pendingApprovals.length + pendingSettlements.length} items to review.</p>
          </div>
          <div className="mobile-welcome-avatar" onClick={() => setIsSidebarOpen(true)}>
            <Avatar profile={dashboard.profile} size="medium" />
          </div>
        </header>

        {/* === Mobile Home Grid (4 nav cards) === */}
        <div className="mobile-home-grid mobile-only">
          <button className="mobile-nav-card" onClick={() => setMobilePage("network")}>
            <span className="nav-card-icon">👥</span>
            <span className="nav-card-label">Your Network</span>
            <span className="nav-card-badge">{balances.length} friends</span>
          </button>
          <button className="mobile-nav-card" onClick={() => setMobilePage("approvals")}>
            <span className="nav-card-icon">⏳</span>
            <span className="nav-card-label">Approvals</span>
            <span className="nav-card-badge">{pendingApprovals.length + pendingSettlements.length} pending</span>
          </button>
          <button className="mobile-nav-card" onClick={() => setMobilePage("money")}>
            <span className="nav-card-icon">💰</span>
            <span className="nav-card-label">Money Actions</span>
          </button>
          <button className="mobile-nav-card" onClick={() => setMobilePage("activity")}>
            <span className="nav-card-icon">📊</span>
            <span className="nav-card-label">Activity</span>
            <span className="nav-card-badge">{recentActivity.length}</span>
          </button>
          <button className="mobile-nav-card items-card" onClick={() => setMobilePage("items")}>
            <span className="nav-card-icon">🎒</span>
            <span className="nav-card-label">Item Tracker</span>
            <span className="nav-card-badge">{dashboard.sharedItems.length} items</span>
          </button>
        </div>

        <section className="dashboard-grid desktop-only">
          <div className="dashboard-column">
            <article className="panel panel-network">
              <div className="section-head">
                <div>
                  <h2>Your network</h2>
                  <p className="muted">
                    Friends, incoming invites, and outgoing requests stay organized here.
                  </p>
                </div>
              </div>

              <div className="panel-scroll panel-scroll-network">
                <div className="section-stack">
                  <section className="subpanel">
                    <div className="subpanel-head">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3>Your friends</h3>
                        <button
                          className="ghost-button"
                          onClick={() => setIsInviteFormOpen(!isInviteFormOpen)}
                          style={{ padding: '4px', minHeight: '32px', minWidth: '32px', fontSize: '1.2rem' }}
                          title="Invite a new friend"
                        >
                          {isInviteFormOpen ? "−" : "+"}
                        </button>
                      </div>
                      <span className="count-chip">{balances.length}</span>
                    </div>

                    {/* Inline Invite Form */}
                    {isInviteFormOpen && (
                      <div className="subpanel-invite-inline" style={{ padding: '0 0 16px', borderBottom: '1px solid var(--line)', marginBottom: '16px' }}>
                        <span className="profile-label" style={{ marginBottom: '8px' }}>
                          Invite by username:
                        </span>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input
                            aria-label="Invite by username"
                            value={inviteUsername}
                            onChange={(event) => setInviteUsername(event.target.value)}
                            placeholder="friend_username"
                            style={{ minHeight: '42px', padding: '8px 12px', flex: 1, minWidth: 0 }}
                          />
                          <button
                            className="primary-button"
                            onClick={sendInvite}
                            disabled={mutating}
                            style={{ minHeight: '42px', whiteSpace: 'nowrap', padding: '0 20px' }}
                          >
                            Send
                          </button>
                        </div>
                      </div>
                    )}
                    {balances.length === 0 ? (
                      <p className="empty-state">No accepted friends yet.</p>
                    ) : (
                      <div className="stack mini-stack">
                        {balances.map((friend) => (
                          <button
                            className={`friend-card ${selectedFriendId === friend.profile.id ? "friend-card-active" : ""
                              }`}
                            key={friend.friendshipId}
                            onClick={() => openStatementDialog(friend.profile.id)}
                          >
                            <PersonIdentity profile={friend.profile} />
                            <div className="friend-card-side">
                              <span
                                className={`amount-badge ${friend.balanceInPaise > 0
                                    ? "positive"
                                    : friend.balanceInPaise < 0
                                      ? "negative"
                                      : ""
                                  }`}
                              >
                                {formatCurrency(friend.balanceInPaise)}
                              </span>
                              <small>View statement</small>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="subpanel">
                    <div className="subpanel-head">
                      <h3>Incoming invites</h3>
                      <span className="count-chip">{incomingInvites.length}</span>
                    </div>
                    {incomingInvites.length === 0 ? (
                      <p className="empty-state">No incoming invites right now.</p>
                    ) : (
                      <div className="stack mini-stack">
                        {/* Featured (Latest) Invite */}
                        <div className="list-card" key={incomingInvites[0].id} style={{ borderStyle: 'solid', borderWidth: '2px' }}>
                          <PersonIdentity profile={profilesById.get(incomingInvites[0].requester_id)} />
                          <div className="row-actions">
                            <button
                              className="primary-button"
                              onClick={() => respondToInvite(incomingInvites[0].id, true)}
                              disabled={mutating}
                              style={{ padding: '8px 16px' }}
                            >
                              Accept
                            </button>
                          </div>
                        </div>

                        {/* The rest listed simply without nested scrolls */}
                        {incomingInvites.slice(1).map((invite) => {
                          const friend = profilesById.get(invite.requester_id);
                          return (
                            <div className="list-card dense" key={invite.id} style={{ opacity: 0.8, background: 'rgba(255,255,255,0.3)' }}>
                              <PersonIdentity profile={friend} />
                              <div className="row-actions">
                                <button
                                  className="primary-button"
                                  onClick={() => respondToInvite(invite.id, true)}
                                  disabled={mutating}
                                  style={{ padding: "4px 10px", minHeight: "32px", fontSize: "0.8rem" }}
                                  title="Accept"
                                >
                                  Accept
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  <section className="subpanel">
                    <div className="subpanel-head">
                      <h3>Outgoing invites</h3>
                      <span className="count-chip">{outgoingInvites.length}</span>
                    </div>
                    {outgoingInvites.length === 0 ? (
                      <p className="empty-state">No pending invites sent.</p>
                    ) : (
                      <div className="stack mini-stack">
                        {/* Featured (Latest) Outgoing Invite */}
                        <div className="list-card" key={outgoingInvites[0].id}>
                          <PersonIdentity profile={profilesById.get(outgoingInvites[0].addressee_id)} />
                          <span className="pill">Waiting</span>
                        </div>

                        {/* Extra invites listed directly */}
                        {outgoingInvites.slice(1).map((invite) => {
                          const friend = profilesById.get(invite.addressee_id);
                          return (
                            <div className="list-card dense" key={invite.id} style={{ opacity: 0.8, background: 'rgba(255,255,255,0.3)' }}>
                              <PersonIdentity profile={friend} />
                              <span className="pill" style={{ fontSize: "0.7rem" }}>Sent</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </div>
              </div>
            </article>

            {/* --- PC Items Tracker --- */}
            <article className="panel panel-items" style={{ marginBottom: '20px' }}>
              <div className="section-head" style={{ borderBottom: '1px solid var(--line)', paddingBottom: '16px', marginBottom: '16px' }}>
                <div>
                  <h2>Shared Items Tracker</h2>
                  <p className="muted">Keep track of things you lent or borrowed.</p>
                </div>
                <button className="primary-button" onClick={() => setIsItemsDialogOpen(true)} style={{ padding: '6px 12px' }}>
                  + Log Item
                </button>
              </div>
              <div className="panel-scroll" style={{ maxHeight: 'none', height: 'auto' }}>
                <div className="section-stack">
                  {dashboard.sharedItems.length === 0 ? (
                    <p className="empty-state">No shared items right now.</p>
                  ) : (
                    <div className="stack mini-stack">
                      {dashboard.sharedItems.map((item: SharedItem) => (
                        <div className="list-card dense" key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <strong>{item.item_name}</strong>
                            <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
                              <span className="profile-label" style={{ fontSize: '0.65rem', marginRight: '6px' }}>{item.type.toUpperCase()}</span> 
                              {item.type === 'gave' ? 'to' : 'from'} {dashboard.profiles.find(p => p.id === item.friend_id)?.full_name || 'friend'}
                            </p>
                          </div>
                          <button className="ghost-button danger-ghost-button" onClick={(e) => removeItem(item.id, e)} style={{ padding: '6px 12px' }}>Return</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </article>
          </div>

          <div className="dashboard-column">
            <article className="panel panel-money">
              <div className="section-head">
                <div>
                  <h2>Money actions</h2>
                  <p className="muted">
                    Open a focused flow for either creating a debt or recording a direct
                    settlement.
                  </p>
                </div>
              </div>

              <div className="action-option-grid">
                <button
                  className="action-option-card"
                  onClick={() => {
                    setError(null);
                    setFeedback(null);
                    setIsDebtDialogOpen(true);
                  }}
                  type="button"
                >
                  <span className="profile-label">Approval flow</span>
                  <strong>Create debt</strong>
                  <p>
                    Log a shared expense or cash loan. Your friend approves it from their
                    side.
                  </p>
                </button>

                <button
                  className="action-option-card"
                  onClick={() => {
                    setError(null);
                    setFeedback(null);
                    setIsSettlementDialogOpen(true);
                  }}
                  type="button"
                >
                  <span className="profile-label">Direct payment</span>
                  <strong>Record settlement</strong>
                  <p>
                    Note a payment already made outside the app so balances stay accurate.
                  </p>
                </button>
              </div>
            </article>

            <section className="panel activity-panel">
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
                  <div className="stack mini-stack">
                    {recentActivity.map((item) => (
                      <div className="list-card dense" key={`${item.kind}-${item.id}`}>
                        <div className="person-block">
                          <PersonIdentity profile={item.profile} />
                          <strong>{item.label}</strong>
                          <p>{item.detail}</p>
                          <small>{dateTime.format(new Date(item.createdAt))}</small>
                        </div>
                        <div className="activity-side">
                          <span className="amount-badge neutral">
                            {formatCurrency(item.amountInPaise)}
                          </span>
                          <span className={`pill status-${item.status}`}>{item.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        </section>

        {isDebtDialogOpen && (
          <div
            className="dialog-backdrop"
            onClick={() => setIsDebtDialogOpen(false)}
            role="presentation"
          >
            <section
              className="dialog-card form-dialog"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="dialog-head">
                <h2>Record a debt</h2>
                <button
                  aria-label="Close debt dialog"
                  className="ghost-button dialog-close-button"
                  onClick={() => setIsDebtDialogOpen(false)}
                  type="button"
                >
                  X
                </button>
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
                    <FriendPicker
                      friends={balances}
                      selectedId={debtForm.friendId}
                      onSelect={(friendId) =>
                        setDebtForm((current) => ({
                          ...current,
                          friendId
                        }))
                      }
                      placeholder="Choose a friend"
                    />
                  </label>
                </div>

                {balances.length === 0 ? (
                  <p className="empty-state action-hint">
                    Add a friend first, then you can create a debt request here.
                  </p>
                ) : debtFriendSelected ? (
                  <>
                    <div className="hint-banner">
                      Fill in the amount, date, and reason once you know who this is for.
                    </div>
                    <div className="form-grid">
                      <label>
                        <span>Amount in INR</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={debtForm.amount}
                          onChange={(event) =>
                            setDebtForm((current) => ({
                              ...current,
                              amount: event.target.value
                            }))
                          }
                          placeholder="200"
                        />
                      </label>

                      <label>
                        <span>Date</span>
                        <input
                          type="date"
                          value={debtForm.debtDate}
                          onChange={(event) =>
                            setDebtForm((current) => ({
                              ...current,
                              debtDate: event.target.value
                            }))
                          }
                        />
                      </label>

                      <label>
                        <span>Return by</span>
                        <input
                          type="datetime-local"
                          value={debtForm.dueAt}
                          onChange={(event) =>
                            setDebtForm((current) => ({
                              ...current,
                              dueAt: event.target.value
                            }))
                          }
                        />
                      </label>

                      <label className="full-span">
                        <span>Reason</span>
                        <textarea
                          rows={3}
                          value={debtForm.reason}
                          onChange={(event) =>
                            setDebtForm((current) => ({
                              ...current,
                              reason: event.target.value
                            }))
                          }
                          placeholder="Auto fare, dinner, movie tickets, cash loan..."
                        />
                      </label>
                    </div>

                    <div className="action-row">
                      <button
                        className="primary-button"
                        onClick={createDebt}
                        disabled={mutating}
                      >
                        Create debt request
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="empty-state action-hint">
                    Choose a friend to reveal the debt form.
                  </p>
                )}
              </div>
            </section>
          </div>
        )}

        {isSettlementDialogOpen && (
          <div
            className="dialog-backdrop"
            onClick={() => setIsSettlementDialogOpen(false)}
            role="presentation"
          >
            <section
              className="dialog-card form-dialog"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="dialog-head">
                <h2>Record a settlement</h2>
                <button
                  aria-label="Close settlement dialog"
                  className="ghost-button dialog-close-button"
                  onClick={() => setIsSettlementDialogOpen(false)}
                  type="button"
                >
                  X
                </button>
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
                    <FriendPicker
                      friends={balances}
                      selectedId={settlementForm.friendId}
                      onSelect={(friendId) =>
                        setSettlementForm((current) => ({
                          ...current,
                          friendId
                        }))
                      }
                      placeholder="Choose a friend"
                    />
                  </label>
                </div>

                {balances.length === 0 ? (
                  <p className="empty-state action-hint">
                    Add a friend first, then you can record a settlement here.
                  </p>
                ) : settlementFriendSelected ? (
                  <>
                    <div className="hint-banner">
                      Add the amount and note only after choosing who you paid back.
                    </div>
                    <div className="form-grid compact-grid">
                      <label>
                        <div className="section-head" style={{ marginBottom: "8px", alignItems: "flex-end", gap: "12px", border: "none" }}>
                          <span style={{ flexGrow: 1 }}>Amount in INR</span>
                          {(() => {
                            const formFriend = balances.find(f => f.profile.id === settlementForm.friendId);
                            return formFriend && formFriend.balanceInPaise < 0 ? (
                              <button
                                className="ghost-button topbar-compact-button"
                                type="button"
                                onClick={() => setSettlementForm(curr => ({ ...curr, amount: (Math.abs(formFriend.balanceInPaise) / 100).toString() }))}
                                style={{ minHeight: "28px", padding: "4px 10px", fontSize: "0.8rem", margin: 0 }}
                              >
                                Pay in full
                              </button>
                            ) : null;
                          })()}
                        </div>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={settlementForm.amount}
                          onChange={(event) =>
                            setSettlementForm((current) => ({
                              ...current,
                              amount: event.target.value
                            }))
                          }
                          placeholder="200"
                        />
                        {(() => {
                          const formFriend = balances.find(f => f.profile.id === settlementForm.friendId);
                          const enteredAmountPaise = Number(settlementForm.amount) * 100;
                          if (formFriend && formFriend.balanceInPaise < 0 && enteredAmountPaise > Math.abs(formFriend.balanceInPaise)) {
                            const excess = ((enteredAmountPaise - Math.abs(formFriend.balanceInPaise)) / 100).toFixed(2);
                            return (
                              <span style={{ color: "var(--danger)", fontSize: "0.85rem", marginTop: "8px", display: "block" }}>
                                Note: You are paying ₹{excess} more than you currently owe them.
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </label>

                      <label className="full-span">
                        <span>Note</span>
                        <input
                          value={settlementForm.note}
                          onChange={(event) =>
                            setSettlementForm((current) => ({
                              ...current,
                              note: event.target.value
                            }))
                          }
                          placeholder="UPI transfer, cash returned, bank transfer..."
                        />
                      </label>
                    </div>

                    <div className="action-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      <button
                        className="ghost-button"
                        onClick={createSettlement}
                        disabled={mutating}
                      >
                        Record manual
                      </button>
                      <button
                        className="primary-button"
                        onClick={payOnline}
                        disabled={mutating}
                      >
                        Pay online
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="empty-state action-hint">
                    Choose a friend to reveal the settlement form.
                  </p>
                )}
              </div>
            </section>
          </div>
        )}

        {isStatementDialogOpen && selectedFriend && (
          <div
            className="dialog-backdrop"
            onClick={() => setIsStatementDialogOpen(false)}
            role="presentation"
          >
            <section
              className="dialog-card statement-dialog"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="dialog-head">
                <div>
                  <h2>Statement</h2>
                  <p className="muted">
                    Full record with {readableProfile(selectedFriend.profile)}.
                  </p>
                </div>
                <button
                  aria-label="Close statement dialog"
                  className="ghost-button dialog-close-button"
                  onClick={() => setIsStatementDialogOpen(false)}
                  type="button"
                >
                  X
                </button>
              </div>

              {(error || feedback) && (
                <div className={`dialog-banner ${error ? "error-banner" : "success-banner"}`} style={{ borderRadius: '12px', padding: '12px 16px', marginBottom: '20px', fontSize: '0.9rem' }}>
                  {error ?? feedback}
                </div>
              )}

              <div className="statement-shell">
                <div className="statement-header" style={{ marginBottom: "16px" }}>
                  <PersonIdentity profile={selectedFriend.profile} />
                  <span
                    className={`amount-badge ${selectedFriend.balanceInPaise > 0
                        ? "positive"
                        : selectedFriend.balanceInPaise < 0
                          ? "negative"
                          : ""
                      }`}
                  >
                    {formatCurrency(selectedFriend.balanceInPaise)}
                  </span>
                </div>

                <div className="action-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "20px" }}>
                  <button
                    className="primary-button"
                    onClick={() => {
                      setSettlementForm(current => ({ ...current, friendId: selectedFriend.profile.id }));
                      setIsSettlementDialogOpen(true);
                    }}
                  >
                    💸 Pay them
                  </button>
                  <button
                    className="ghost-button"
                    onClick={() => {
                      setDebtForm(current => ({ ...current, friendId: selectedFriend.profile.id }));
                      setIsDebtDialogOpen(true);
                    }}
                  >
                    📝 Log expense
                  </button>
                </div>

                {friendStatement.length === 0 ? (
                  <p className="empty-state">No records yet with this friend.</p>
                ) : (
                  <div className="statement-table-wrap">
                    <table className="statement-table">
                      <thead>
                        <tr>
                          <th>When</th>
                          <th>Entry</th>
                          <th>Status</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {friendStatement.map((entry) => (
                          <tr key={`${entry.kind}-${entry.id}`}>
                            <td>{dateTime.format(new Date(entry.createdAt))}</td>
                            <td>
                              <strong>{entry.title}</strong>
                              <p>{entry.detail}</p>
                            </td>
                            <td>
                              <span className={`pill status-${entry.status}`}>
                                {entry.status}
                              </span>
                            </td>
                            <td>
                              <div className="statement-amounts">
                                <strong>{formatCurrency(entry.amountInPaise)}</strong>
                                <small>
                                  Balance impact {formatCurrency(entry.balanceDeltaInPaise)}
                                </small>
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
        )}

        {isApprovalsDialogOpen && (
          <div
            className="dialog-backdrop"
            onClick={() => setIsApprovalsDialogOpen(false)}
            role="presentation"
          >
            <section
              className="dialog-card form-dialog"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="dialog-head">
                <h2>Pending approvals</h2>
                <button
                  className="ghost-button dialog-close-button"
                  onClick={() => setIsApprovalsDialogOpen(false)}
                >
                  X
                </button>
              </div>

              {(error || feedback) && (
                <div className={`dialog-banner ${error ? "error-banner" : "success-banner"}`} style={{ borderRadius: '12px', padding: '12px 16px', marginBottom: '20px', fontSize: '0.9rem' }}>
                  {error ?? feedback}
                </div>
              )}

              <div className="dialog-body">
                <p className="muted" style={{ marginBottom: "16px" }}>These requests need your decision.</p>

                {pendingApprovals.length === 0 && pendingSettlements.length === 0 ? (
                  <p className="empty-state">No debt approvals waiting for you.</p>
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
                              <small>Debt date {dateOnly.format(new Date(request.debt_date))} - Due {formatDate(request.due_at)}</small>
                            </div>
                            <div className="row-actions">
                              <button className="primary-button" onClick={() => respondToDebt(request.id, true)} disabled={mutating}>Approve</button>
                              <button className="ghost-button" onClick={() => respondToDebt(request.id, false)} disabled={mutating}>Reject</button>
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
                              <button className="primary-button" onClick={() => respondToSettlement(settlement.id, true)} disabled={mutating}>Approve</button>
                              <button className="ghost-button" onClick={() => respondToSettlement(settlement.id, false)} disabled={mutating}>Reject</button>
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
        )}

        {isAboutDialogOpen && (
          <div className="dialog-backdrop" onClick={() => setIsAboutDialogOpen(false)} role="presentation">
            <section className="dialog-card" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '440px' }}>
              <div className="dialog-head">
                <h2>About Friends & Benefits</h2>
                <button className="ghost-button dialog-close-button" onClick={() => setIsAboutDialogOpen(false)}>X</button>
              </div>
              <div className="dialog-body" style={{ padding: '24px' }}>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                   <span className="brand-logo-emoji" style={{ fontSize: '3rem', marginBottom: '12px' }}>🤝</span>
                   <p>A simple, offline-friendly tool to track debts, settlements, and shared items within your closest circle of friends.</p>
                </div>
                
                <h3 style={{ fontSize: '1.05rem', marginBottom: '12px', borderBottom: '1px solid var(--line)', paddingBottom: '8px' }}>How to use</h3>
                <ul className="muted" style={{ fontSize: '0.9rem', paddingLeft: '20px', display: 'grid', gap: '8px', marginBottom: '24px' }}>
                   <li><strong>Network:</strong> Add friends using their exact F&B username.</li>
                   <li><strong>Money:</strong> Log debts when you pay for them, or settlements when they pay you back offline.</li>
                   <li><strong>Approvals:</strong> Once you log a money action, they must approve it!</li>
                   <li><strong>Items:</strong> Keep an unverified list of items you've lent out or borrowed.</li>
                </ul>

                <h3 style={{ fontSize: '1.05rem', marginBottom: '12px', borderBottom: '1px solid var(--line)', paddingBottom: '8px' }}>About the Creator</h3>
                <div style={{ display: 'grid', gap: '12px', marginTop: '16px' }}>
                   <a href="https://www.linkedin.com/in/karan-gupta-827731326/" target="_blank" rel="noopener noreferrer" className="primary-button" style={{ textDecoration: 'none', textAlign: 'center' }}>
                     Connect on LinkedIn
                   </a>
                   <a href="https://instagram.com/blackhairedkaran" target="_blank" rel="noopener noreferrer" className="ghost-button" style={{ textDecoration: 'none', textAlign: 'center', border: '1px solid var(--line)' }}>
                     Follow @blackhairedkaran
                   </a>
                </div>
              </div>
            </section>
          </div>
        )}

        {isItemsDialogOpen && (
          <div className="dialog-backdrop" onClick={() => setIsItemsDialogOpen(false)} role="presentation">
            <section className="dialog-card form-dialog" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '440px' }}>
              <div className="dialog-head">
                <h2>Log Shared Item</h2>
                <button className="ghost-button dialog-close-button" onClick={() => setIsItemsDialogOpen(false)}>X</button>
              </div>

              {(error || feedback) && (
                <div className={`dialog-banner ${error ? "error-banner" : "success-banner"}`} style={{ borderRadius: '12px', padding: '12px 16px', marginBottom: '20px', fontSize: '0.9rem' }}>
                  {error ?? feedback}
                </div>
              )}

              <div className="dialog-body">
                <div className="form-grid compact-grid" style={{ marginBottom: '20px' }}>
                  <label>
                    <span className="profile-label">Action</span>
                    <select
                      value={itemForm.type}
                      onChange={(e) => setItemForm(current => ({ ...current, type: e.target.value as "gave" | "borrowed" }))}
                      style={{ padding: '12px', borderRadius: '12px', border: '1px solid var(--line)' }}
                    >
                      <option value="gave">I lent an item to...</option>
                      <option value="borrowed">I borrowed an item from...</option>
                    </select>
                  </label>

                  <label>
                    <span className="profile-label">{itemForm.type === 'gave' ? 'To Friend' : 'From Friend'}</span>
                    <FriendPicker
                      friends={balances}
                      selectedId={itemForm.friendId}
                      onSelect={(friendId) => setItemForm(current => ({ ...current, friendId }))}
                      placeholder="Choose a friend"
                    />
                  </label>

                  <label>
                    <span className="profile-label">Item Name</span>
                    <input
                      type="text"
                      value={itemForm.name}
                      onChange={(e) => setItemForm(current => ({ ...current, name: e.target.value }))}
                      placeholder="e.g., The Matrix DVD, Toolkit, 500Rs Cash"
                    />
                  </label>
                </div>

                <div className="action-row">
                  <button className="primary-button" onClick={submitItemForm}>
                    Save Item record
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

      </main>
    </>
  );
}

function Avatar({
  profile,
  size = "medium"
}: {
  profile?: Profile | null;
  size?: "small" | "medium" | "large";
}) {
  return (
    <div className={`avatar avatar-${size}`}>
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt={readableProfile(profile)} />
      ) : (
        <span>{initialsFor(profile)}</span>
      )}
    </div>
  );
}



function RefreshIcon() {
  return (
    <svg
      aria-hidden="true"
      className="button-icon"
      viewBox="0 0 20 20"
      fill="none"
    >
      <path
        d="M16.667 10a6.667 6.667 0 1 1-1.953-4.714"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M13.333 3.333h3.334v3.334"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function PersonIdentity({ profile }: { profile?: Profile | null }) {
  return (
    <div className="person-identity">
      <Avatar profile={profile} />
      <div className="person-copy">
        <strong>{readableProfile(profile)}</strong>
        <p>@{profile?.username ?? "unknown"}</p>
      </div>
    </div>
  );
}

function FriendPicker({
  friends,
  selectedId,
  onSelect,
  placeholder
}: {
  friends: FriendSummary[];
  selectedId: string;
  onSelect: (friendId: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const selectedFriend =
    friends.find((friend) => friend.profile.id === selectedId) ?? null;

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [open]);

  return (
    <div className="picker-shell" ref={wrapperRef}>
      <button
        className={`picker-trigger ${open ? "picker-trigger-open" : ""}`}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {selectedFriend ? (
          <div className="picker-value">
            <PersonIdentity profile={selectedFriend.profile} />
            <span className="picker-caret">{open ? "Hide" : "Select"}</span>
          </div>
        ) : (
          <div className="picker-value">
            <span className="picker-placeholder">{placeholder}</span>
            <span className="picker-caret">Select</span>
          </div>
        )}
      </button>

      {open && (
        <div className="picker-menu">
          {friends.length === 0 ? (
            <p className="empty-state">No friends available yet.</p>
          ) : (
            friends.map((friend) => (
              <button
                className="picker-option"
                key={friend.friendshipId}
                onClick={() => {
                  onSelect(friend.profile.id);
                  setOpen(false);
                }}
                type="button"
              >
                <PersonIdentity profile={friend.profile} />
                <small>{friend.profile.username ? `@${friend.profile.username}` : ""}</small>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
